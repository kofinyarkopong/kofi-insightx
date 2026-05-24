'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// Job watcher — runs permanently on your Mac
//
// Polls the Supabase scrape_queue table every 30 seconds.
// When it finds a pending job, it picks it up, runs the pipeline, and updates
// the job status to completed or failed.
//
// Start manually : node src/job-watcher.js
// As a service   : bash install-service.sh  (sets up a launchd agent)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { claimPendingJob, completeJob, failJob, setJobProgress } = require('./db');
const { runPipeline } = require('./pipeline');

const POLL_INTERVAL_MS = 30_000;  // 30 seconds
let   isRunning        = false;

async function poll() {
  if (isRunning) return;

  const job = await claimPendingJob();
  if (!job) return;

  isRunning = true;
  const date = job.date instanceof Date
    ? job.date.toISOString().slice(0, 10)
    : String(job.date).slice(0, 10);

  console.log(`\n[Watcher] Picked up job ${job.id} for ${date}`);

  try {
    const { fixturesFound, fixturesSaved, warnings } = await runPipeline({
      date,
      onProgress: async (msg) => {
        console.log(`[Watcher] ${msg}`);
        await setJobProgress(job.id, msg).catch(() => null);
      },
    });

    await completeJob(job.id, fixturesFound, fixturesSaved);
    console.log(`[Watcher] Job ${job.id} completed — ${fixturesSaved} fixtures saved`);

    if (warnings.length) {
      console.warn('[Watcher] Warnings:', warnings);
    }

  } catch (err) {
    console.error(`[Watcher] Job ${job.id} failed:`, err.message);
    await failJob(job.id, err.message);
  } finally {
    isRunning = false;
  }
}

async function start() {
  console.log(`
╔══════════════════════════════════════════════════╗
║   Dr Kofi InsightX — Job Watcher                 ║
║   Polling Supabase scrape_queue every 30 s       ║
║   Press Ctrl+C to stop                           ║
╚══════════════════════════════════════════════════╝
  `);

  // Initial poll immediately on start
  await poll().catch(err => console.error('[Watcher] Initial poll error:', err));

  // Then poll on interval
  setInterval(() => {
    poll().catch(err => console.error('[Watcher] Poll error:', err));
  }, POLL_INTERVAL_MS);
}

start();
