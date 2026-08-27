import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from '../lib/types';

const STORAGE_KEY = 'fileshare.view';

/**
 * Grid or list, remembered per browser.
 *
 * Deliberately not in the URL alongside path and filters: those describe what
 * you are looking at and are worth sharing, whereas this is how *you* like to
 * look at it and should still be true tomorrow.
 */
export function useViewMode(): [ViewMode, (view: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      // Private mode throws on every storage call; the default is fine.
      return 'grid';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Not worth surfacing — the choice just will not survive a reload.
    }
  }, [view]);

  return [view, useCallback((next: ViewMode) => setView(next), [])];
}
