// ─────────────────────────────────────────────────────────────────────────────
// useFilters — manages filter state and derives the four lists
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import type { Fixture, FilterSettings } from '../types/Fixture';
import { DEFAULT_FILTERS } from '../types/Fixture';
import { buildListA, buildListB, buildListC, buildListD, buildNeedsReview } from '../utils/filters';

export function useFilters(fixtures: Fixture[]) {
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);

  const updateFilter = <K extends keyof FilterSettings>(key: K, value: FilterSettings[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const listA       = useMemo(() => buildListA(fixtures, filters), [fixtures, filters]);
  const listB       = useMemo(() => buildListB(listA, filters), [listA, filters]);
  const listC       = useMemo(() => buildListC(listB, filters), [listB, filters]);
  const listD       = useMemo(() => buildListD(listB), [listB]);
  const needsReview = useMemo(() => buildNeedsReview(fixtures), [fixtures]);

  return {
    filters,
    updateFilter,
    resetFilters,
    listA,
    listB,
    listC,
    listD,
    needsReview,
  };
}
