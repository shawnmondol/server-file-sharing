import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, browse } from '../lib/api';
import type { BrowseResult, SortDirection, SortKey } from '../lib/types';

export interface BrowseState {
  path: string;
  query: string;
  category: string;
  sort: SortKey;
  direction: SortDirection;
}

function stateFromUrl(): BrowseState {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const direction = params.get('dir');

  return {
    path: params.get('path') ?? '',
    query: params.get('q') ?? '',
    category: params.get('type') ?? 'all',
    sort: sort === 'name' || sort === 'size' || sort === 'date' ? sort : 'date',
    direction: direction === 'asc' || direction === 'desc' ? direction : 'desc',
  };
}

function urlFromState(state: BrowseState): string {
  const params = new URLSearchParams();
  if (state.path) params.set('path', state.path);
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('type', state.category);
  if (state.sort !== 'date') params.set('sort', state.sort);
  if (state.direction !== 'desc') params.set('dir', state.direction);

  const search = params.toString();
  return search ? `${window.location.pathname}?${search}` : window.location.pathname;
}

/** Typing a filename should not fire a recursive tree walk on every keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Owns where you are in the library and what you are filtering by, and keeps
 * that in the URL so a folder can be bookmarked, shared over the tailnet, and
 * reached with the browser's back button.
 */
export function useBrowse() {
  const [state, setState] = useState<BrowseState>(stateFromUrl);
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Debounce only the query; a folder change or a sort click should be instant.
  const [debouncedQuery, setDebouncedQuery] = useState(state.query);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(state.query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.query]);

  // Popstate is the browser's back button; adopt whatever the URL now says.
  useEffect(() => {
    const onPopState = () => {
      const next = stateFromUrl();
      setState(next);
      setDebouncedQuery(next.query);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const skipHistory = useRef(true);
  useEffect(() => {
    const url = urlFromState({ ...state, query: debouncedQuery });
    if (skipHistory.current) {
      skipHistory.current = false;
      window.history.replaceState(null, '', url);
    } else if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState(null, '', url);
    }
  }, [state, debouncedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    browse({ ...state, query: debouncedQuery }, controller.signal)
      .then((data) => {
        setResult(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof ApiError ? cause.message : 'Could not load this folder');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [state, debouncedQuery, reloadToken]);

  const update = useCallback((changes: Partial<BrowseState>) => {
    setState((current) => ({ ...current, ...changes }));
  }, []);

  const navigate = useCallback((path: string) => {
    // Entering a folder clears the search and the type filter, matching what
    // Finder does: the filter belonged to the folder you were looking at.
    setState((current) => ({ ...current, path, query: '', category: 'all' }));
    setDebouncedQuery('');
  }, []);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { state, result, loading, error, update, navigate, reload };
}
