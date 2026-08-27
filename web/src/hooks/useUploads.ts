import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadResult } from '../lib/types';

export type TransferStatus = 'queued' | 'uploading' | 'done' | 'failed' | 'cancelled';

export interface Transfer {
  id: string;
  name: string;
  size: number;
  loaded: number;
  status: TransferStatus;
  error: string | null;
  bytesPerSecond: number;
  secondsRemaining: number;
  targetPath: string;
}

/** A settled upload, kept in the notification centre after the panel is gone. */
export interface UploadRecord {
  id: string;
  name: string;
  size: number;
  status: Exclude<TransferStatus, 'queued' | 'uploading'>;
  error: string | null;
  targetPath: string;
  finishedAt: number;
  seen: boolean;
}

/** How many files go up at once. Two keeps a single Pi's uplink saturated. */
const MAX_PARALLEL = 2;

const HISTORY_KEY = 'fileshare.uploads.v1';
const HISTORY_LIMIT = 100;

/**
 * History survives a reload, so the bell still answers "did that batch of
 * photos actually land?" the next morning. Private-mode browsers throw on
 * every storage call, hence the try/catch on both sides.
 */
function loadHistory(): UploadRecord[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UploadRecord[]).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

interface QueueItem {
  transfer: Transfer;
  file: File;
}

/**
 * Upload queue built on XMLHttpRequest rather than fetch: `upload.onprogress`
 * is the only way to get real byte-level progress in the browser, and the
 * mockup's transfer panel needs a percentage, a rate, and an ETA per file.
 */
export function useUploads(onFileComplete: () => void) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [history, setHistory] = useState<UploadRecord[]>(loadHistory);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    } catch {
      // Storage full or blocked; the in-memory history still works this session.
    }
  }, [history]);

  const queue = useRef<QueueItem[]>([]);
  const inflight = useRef(new Map<string, XMLHttpRequest>());
  const completionCallback = useRef(onFileComplete);

  useEffect(() => {
    completionCallback.current = onFileComplete;
  }, [onFileComplete]);

  /** `pump` and `start` call each other, so one side goes through a ref. */
  const pumpRef = useRef<() => void>(() => {});

  const patch = useCallback((id: string, changes: Partial<Transfer>) => {
    setTransfers((current) =>
      current.map((transfer) => (transfer.id === id ? { ...transfer, ...changes } : transfer)),
    );
  }, []);

  /** Record a finished upload in the notification centre, newest first. */
  const remember = useCallback(
    (transfer: Transfer, status: UploadRecord['status'], error: string | null) => {
      setHistory((current) =>
        [
          {
            id: transfer.id,
            name: transfer.name,
            size: transfer.size,
            status,
            error,
            targetPath: transfer.targetPath,
            finishedAt: Date.now(),
            seen: false,
          },
          ...current,
        ].slice(0, HISTORY_LIMIT),
      );
    },
    [],
  );

  const start = useCallback(
    (item: QueueItem) => {
      const { transfer, file } = item;
      const xhr = new XMLHttpRequest();
      inflight.current.set(transfer.id, xhr);

      const startedAt = performance.now();
      patch(transfer.id, { status: 'uploading' });

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) return;
        const elapsed = Math.max((performance.now() - startedAt) / 1000, 0.001);
        const rate = event.loaded / elapsed;
        patch(transfer.id, {
          loaded: event.loaded,
          bytesPerSecond: rate,
          secondsRemaining: rate > 0 ? (event.total - event.loaded) / rate : 0,
        });
      });

      const finish = () => {
        inflight.current.delete(transfer.id);
        pumpRef.current();
      };

      xhr.addEventListener('load', () => {
        let rejectedReason: string | null = null;
        try {
          const body = JSON.parse(xhr.responseText) as UploadResult & { error?: string };
          // The server reports per-file outcomes, so a 200 can still mean this
          // particular file was refused.
          if (body.rejected?.length) rejectedReason = body.rejected[0]?.reason ?? 'Upload rejected';
          else if (xhr.status >= 400) rejectedReason = body.error ?? `Upload failed (${xhr.status})`;
        } catch {
          if (xhr.status >= 400) rejectedReason = `Upload failed (${xhr.status})`;
        }

        if (rejectedReason) {
          patch(transfer.id, { status: 'failed', error: rejectedReason });
          remember(transfer, 'failed', rejectedReason);
        } else {
          patch(transfer.id, {
            status: 'done',
            loaded: transfer.size,
            secondsRemaining: 0,
            error: null,
          });
          remember(transfer, 'done', null);
          completionCallback.current();
        }
        finish();
      });

      xhr.addEventListener('error', () => {
        patch(transfer.id, { status: 'failed', error: 'Connection lost' });
        remember(transfer, 'failed', 'Connection lost');
        finish();
      });

      xhr.addEventListener('abort', () => {
        patch(transfer.id, { status: 'cancelled', error: null });
        remember(transfer, 'cancelled', null);
        finish();
      });

      const body = new FormData();
      body.append('file', file, file.name);

      xhr.open('POST', `/api/upload?path=${encodeURIComponent(transfer.targetPath)}`);
      xhr.send(body);
    },
    [patch, remember],
  );

  const pump = useCallback(() => {
    while (inflight.current.size < MAX_PARALLEL && queue.current.length > 0) {
      const item = queue.current.shift();
      if (!item) break;
      start(item);
    }
  }, [start]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (files: File[], targetPath: string) => {
      if (files.length === 0) return;

      const items: QueueItem[] = files.map((file) => ({
        file,
        transfer: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: file.name,
          size: file.size,
          loaded: 0,
          status: 'queued',
          error: null,
          bytesPerSecond: 0,
          secondsRemaining: 0,
          targetPath,
        },
      }));

      setTransfers((current) => [...current, ...items.map((item) => item.transfer)]);
      queue.current.push(...items);
      pump();
    },
    [pump],
  );

  const cancel = useCallback(
    (id: string) => {
      const xhr = inflight.current.get(id);
      if (xhr) {
        // The abort listener records it; nothing else to do here.
        xhr.abort();
        return;
      }
      // Not started yet — drop it from the queue instead.
      const dropped = queue.current.find((item) => item.transfer.id === id);
      queue.current = queue.current.filter((item) => item.transfer.id !== id);
      if (dropped) remember(dropped.transfer, 'cancelled', null);
      setTransfers((current) =>
        current.map((transfer) =>
          transfer.id === id && transfer.status === 'queued'
            ? { ...transfer, status: 'cancelled' }
            : transfer,
        ),
      );
    },
    [remember],
  );

  const cancelAll = useCallback(() => {
    for (const item of queue.current) remember(item.transfer, 'cancelled', null);
    queue.current = [];
    for (const xhr of inflight.current.values()) xhr.abort();
    setTransfers((current) =>
      current.map((transfer) =>
        transfer.status === 'queued' ? { ...transfer, status: 'cancelled' } : transfer,
      ),
    );
  }, [remember]);

  /** Clear finished rows so the panel collapses once everything has landed. */
  const clearSettled = useCallback(() => {
    setTransfers((current) =>
      current.filter((transfer) => transfer.status === 'queued' || transfer.status === 'uploading'),
    );
  }, []);

  useEffect(() => {
    const requests = inflight.current;
    return () => {
      for (const xhr of requests.values()) xhr.abort();
    };
  }, []);

  const markHistorySeen = useCallback(() => {
    setHistory((current) =>
      current.some((record) => !record.seen)
        ? current.map((record) => (record.seen ? record : { ...record, seen: true }))
        : current,
    );
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const active = transfers.filter(
    (transfer) => transfer.status === 'queued' || transfer.status === 'uploading',
  );
  const unseenCount = history.reduce((count, record) => count + (record.seen ? 0 : 1), 0);

  return {
    transfers,
    active,
    history,
    unseenCount,
    enqueue,
    cancel,
    cancelAll,
    clearSettled,
    markHistorySeen,
    clearHistory,
  };
}
