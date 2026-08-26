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

/** How many files go up at once. Two keeps a single Pi's uplink saturated. */
const MAX_PARALLEL = 2;

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
        } else {
          patch(transfer.id, {
            status: 'done',
            loaded: transfer.size,
            secondsRemaining: 0,
            error: null,
          });
          completionCallback.current();
        }
        finish();
      });

      xhr.addEventListener('error', () => {
        patch(transfer.id, { status: 'failed', error: 'Connection lost' });
        finish();
      });

      xhr.addEventListener('abort', () => {
        patch(transfer.id, { status: 'cancelled', error: null });
        finish();
      });

      const body = new FormData();
      body.append('file', file, file.name);

      xhr.open('POST', `/api/upload?path=${encodeURIComponent(transfer.targetPath)}`);
      xhr.send(body);
    },
    [patch],
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

  const cancel = useCallback((id: string) => {
    const xhr = inflight.current.get(id);
    if (xhr) {
      xhr.abort();
      return;
    }
    // Not started yet — drop it from the queue instead.
    queue.current = queue.current.filter((item) => item.transfer.id !== id);
    setTransfers((current) =>
      current.map((transfer) =>
        transfer.id === id && transfer.status === 'queued'
          ? { ...transfer, status: 'cancelled' }
          : transfer,
      ),
    );
  }, []);

  const cancelAll = useCallback(() => {
    queue.current = [];
    for (const xhr of inflight.current.values()) xhr.abort();
    setTransfers((current) =>
      current.map((transfer) =>
        transfer.status === 'queued' ? { ...transfer, status: 'cancelled' } : transfer,
      ),
    );
  }, []);

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

  const active = transfers.filter(
    (transfer) => transfer.status === 'queued' || transfer.status === 'uploading',
  );

  return { transfers, active, enqueue, cancel, cancelAll, clearSettled };
}
