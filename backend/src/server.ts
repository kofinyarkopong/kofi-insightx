// ─────────────────────────────────────────────────────────────────────────────
// Express server — Football Prediction Dashboard backend
// Works locally (port 3001) and on Vercel (serverless, exported as default)
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import forebetRouter from './routes/forebet';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production, ALLOWED_ORIGINS env var controls which frontends can connect.
// Set it to your Vercel frontend URL in the backend Vercel project settings.
// Locally it defaults to the Vite dev server.

const rawOrigins = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin on Vercel)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/forebet', forebetRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    env: process.env.VERCEL ? 'vercel' : 'local',
    playwrightEnabled: !process.env.VERCEL,
  });
});

// ── Start (only when running directly, not on Vercel) ─────────────────────────

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║   Football Prediction Dashboard — Backend API    ║
║   Listening on http://localhost:${PORT}             ║
╚══════════════════════════════════════════════════╝
    `);
    console.log('Endpoints:');
    console.log(`  GET  http://localhost:${PORT}/api/forebet?date=YYYY-MM-DD`);
    console.log(`  POST http://localhost:${PORT}/api/forebet/manual`);
    console.log(`  POST http://localhost:${PORT}/api/forebet/deep-verify`);
    console.log(`  DEL  http://localhost:${PORT}/api/forebet/cache?date=YYYY-MM-DD`);
  });
}

// Vercel requires the Express app to be the default export
export default app;
