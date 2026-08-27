import type {
  BrowseResult,
  DeleteResult,
  Details,
  MoveResult,
  Session,
  SortDirection,
  SortKey,
  TextDocument,
  TextSaveResult,
} from './types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    });
  } catch {
    // A network-level failure over the tailnet, not an HTTP error.
    throw new ApiError('Cannot reach the server', 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body; the generic message stands.
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export interface BrowseParams {
  path: string;
  query: string;
  category: string;
  sort: SortKey;
  direction: SortDirection;
}

export function browse(params: BrowseParams, signal?: AbortSignal): Promise<BrowseResult> {
  const search = new URLSearchParams({
    path: params.path,
    sort: params.sort,
    direction: params.direction,
  });
  if (params.query) search.set('q', params.query);
  if (params.category !== 'all') search.set('category', params.category);

  return request<BrowseResult>(`/api/browse?${search}`, { signal });
}

export function getSession(): Promise<Session> {
  return request<Session>('/api/session');
}

export function getDetails(path: string, signal?: AbortSignal): Promise<Details> {
  return request<Details>(`/api/details?path=${encodeURIComponent(path)}`, { signal });
}

export function createFolder(path: string, name: string): Promise<{ path: string }> {
  return request<{ path: string }>('/api/folders', json({ path, name }));
}

export function deletePaths(paths: string[]): Promise<DeleteResult> {
  return request<DeleteResult>('/api/delete', json({ paths }));
}

/** Move entries into another folder — what a drag onto a folder tile does. */
export function movePaths(paths: string[], destination: string): Promise<MoveResult> {
  return request<MoveResult>('/api/move', json({ paths, destination }));
}

export function getText(path: string, signal?: AbortSignal): Promise<TextDocument> {
  return request<TextDocument>(`/api/text?path=${encodeURIComponent(path)}`, { signal });
}

/**
 * Save edited text. `modifiedAt` is the mtime the editor loaded; the server
 * refuses the write with a 409 if the file changed underneath it.
 */
export function saveText(
  path: string,
  content: string,
  modifiedAt: number,
): Promise<TextSaveResult> {
  return request<TextSaveResult>('/api/text', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content, modifiedAt }),
  });
}

export function thumbnailUrl(path: string): string {
  return `/api/thumbnail?path=${encodeURIComponent(path)}`;
}

export function previewUrl(path: string): string {
  return `/api/preview?path=${encodeURIComponent(path)}`;
}

export function downloadUrl(path: string): string {
  return `/api/download?path=${encodeURIComponent(path)}`;
}

/**
 * Bundle downloads are handed off to the browser as a normal navigation, so
 * the file streams to disk instead of being buffered in a blob.
 */
export async function downloadBundle(paths: string[]): Promise<void> {
  const { token } = await request<{ token: string }>('/api/bundles', json({ paths }));
  window.location.assign(`/api/bundles/${token}`);
}

export async function isReachable(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}
