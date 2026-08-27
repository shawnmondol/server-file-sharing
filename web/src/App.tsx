import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  deletePaths,
  createFolder,
  downloadBundle,
  downloadUrl,
  getDetails,
  getSession,
  movePaths,
} from './lib/api';
import { CATEGORY_LABELS, formatBytes } from './lib/format';
import type { Details, Entry, Session } from './lib/types';
import { useBrowse } from './hooks/useBrowse';
import { useConnection } from './hooks/useConnection';
import { useUploads } from './hooks/useUploads';
import { useViewMode } from './hooks/useViewMode';
import { Breadcrumbs } from './components/Breadcrumbs';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DropOverlay } from './components/DropOverlay';
import { EmptyState } from './components/EmptyState';
import { FilterChips } from './components/FilterChips';
import { Gallery } from './components/Gallery';
import { InspectorSheet, InspectorSidebar } from './components/Inspector';
import { NotificationBell, NotificationPanel } from './components/NotificationCenter';
import { OfflineBanner } from './components/OfflineBanner';
import { PreviewOverlay } from './components/PreviewOverlay';
import { PromptDialog } from './components/PromptDialog';
import { SelectionBar } from './components/SelectionBar';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { Toast, type ToastMessage } from './components/Toast';
import { TransferPanel } from './components/TransferPanel';
import { ViewToggle } from './components/ViewToggle';

/** How long the upload toast lingers once every transfer has settled. */
const TOAST_LINGER_MS = 4000;

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const { state, result, loading, error, update, navigate, reload } = useBrowse();
  const { status: connection, recheck } = useConnection();
  const [view, setView] = useViewMode();
  const online = connection !== 'offline';

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'error') => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  // Stable, because the toast re-arms its auto-dismiss timer whenever this
  // identity changes — an inline arrow would keep the toast up for as long as
  // anything on the page was re-rendering.
  const dismissToast = useCallback(() => setToast(null), []);

  const uploads = useUploads(reload);

  // --- Session -------------------------------------------------------------
  useEffect(() => {
    getSession()
      .then(setSession)
      .catch((cause: unknown) => {
        setSessionError(
          cause instanceof ApiError && cause.status === 403
            ? cause.message
            : 'Could not identify you to the server.',
        );
      });
  }, []);

  const canWrite = session?.user.canWrite ?? false;
  const entries = useMemo(() => result?.entries ?? [], [result]);

  // --- Selection -----------------------------------------------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [sheetEntry, setSheetEntry] = useState<Entry | null>(null);

  // A folder change or a new filter invalidates whatever was selected.
  useEffect(() => {
    setSelected(new Set());
    setAnchor(null);
    setSheetEntry(null);
  }, [state.path, state.query, state.category]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selected.has(entry.path)),
    [entries, selected],
  );

  // The inspector follows a single selection; with several selected the
  // selection toolbar takes over, exactly as in artboard 3c.
  const inspectorEntry = selectedEntries.length === 1 ? selectedEntries[0] ?? null : null;

  const handleSelect = useCallback(
    (entry: Entry, modifiers: { toggle: boolean; range: boolean }) => {
      const additive = modifiers.toggle || selectMode;

      setSelected((current) => {
        if (modifiers.range && anchor) {
          const from = entries.findIndex((candidate) => candidate.path === anchor);
          const to = entries.findIndex((candidate) => candidate.path === entry.path);
          if (from !== -1 && to !== -1) {
            const [start, end] = from < to ? [from, to] : [to, from];
            const next = new Set(current);
            for (const inRange of entries.slice(start, end + 1)) next.add(inRange.path);
            return next;
          }
        }

        if (additive) {
          const next = new Set(current);
          if (next.has(entry.path)) next.delete(entry.path);
          else next.add(entry.path);
          return next;
        }

        return new Set([entry.path]);
      });

      if (!modifiers.range) setAnchor(entry.path);
      // On a phone a plain tap opens the details sheet; in select mode it just
      // ticks the tile.
      if (!additive && !modifiers.range) setSheetEntry(entry);
    },
    [anchor, entries, selectMode],
  );

  const handleOpen = useCallback(
    (entry: Entry) => {
      if (entry.isDirectory) {
        navigate(entry.path);
        return;
      }
      // The server decides what has a viewer; everything else downloads.
      if (entry.preview) {
        setPreviewEntry(entry);
        return;
      }
      window.location.assign(downloadUrl(entry.path));
    },
    [navigate],
  );

  // --- Details -------------------------------------------------------------
  const detailTarget = inspectorEntry ?? sheetEntry;
  const [details, setDetails] = useState<Details | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!detailTarget) {
      setDetails(null);
      return;
    }

    const controller = new AbortController();
    setDetails(null);
    setDetailsLoading(true);

    getDetails(detailTarget.path, controller.signal)
      .then(setDetails)
      .catch(() => {
        // A missing digest is not worth a toast — the inspector says so itself.
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });

    return () => controller.abort();
  }, [detailTarget]);

  // --- Preview -------------------------------------------------------------
  const [previewEntry, setPreviewEntry] = useState<Entry | null>(null);

  // --- Downloads -----------------------------------------------------------
  const [bundling, setBundling] = useState(false);

  const download = useCallback(
    async (targets: Entry[]) => {
      if (targets.length === 0) return;

      // One plain file streams straight down; folders and multi-selections go
      // through a zip bundle.
      const single = targets[0];
      if (targets.length === 1 && single && !single.isDirectory) {
        window.location.assign(downloadUrl(single.path));
        return;
      }

      setBundling(true);
      try {
        await downloadBundle(targets.map((entry) => entry.path));
      } catch (cause) {
        notify(cause instanceof ApiError ? cause.message : 'Could not prepare the download');
      } finally {
        setBundling(false);
      }
    },
    [notify],
  );

  // --- Move ----------------------------------------------------------------
  // Paths currently being dragged, so their tiles can dim and a folder cannot
  // be dropped onto itself.
  const [draggingPaths, setDraggingPaths] = useState<Set<string>>(new Set());
  const canMove = canWrite && online;

  const beginDrag = useCallback(
    (entry: Entry): string[] => {
      // Dragging one tile of a multi-selection takes the whole selection with
      // it, the way a file manager does.
      const paths =
        selected.has(entry.path) && selected.size > 1
          ? entries.filter((candidate) => selected.has(candidate.path)).map((candidate) => candidate.path)
          : [entry.path];
      setDraggingPaths(new Set(paths));
      return paths;
    },
    [entries, selected],
  );

  const endDrag = useCallback(() => {
    setDraggingPaths((current) => (current.size === 0 ? current : new Set()));
  }, []);

  const move = useCallback(
    async (destination: string, paths: string[]) => {
      endDrag();
      if (!canWrite) {
        notify('Your account has read-only access to the share');
        return;
      }
      if (!online) {
        notify('Moving is paused while the server is unreachable');
        return;
      }

      try {
        const outcome = await movePaths(paths, destination);

        if (outcome.failed.length > 0) {
          const only = outcome.failed[0];
          notify(
            outcome.failed.length === 1 && only
              ? `Could not move “${only.path.split('/').pop()}”: ${only.reason}`
              : `${outcome.failed.length} items could not be moved`,
          );
        } else if (outcome.moved.length > 0) {
          notify(
            `Moved ${outcome.moved.length === 1 ? '1 item' : `${outcome.moved.length} items`} to ${
              destination.split('/').pop() || 'Shared Files'
            }`,
            'info',
          );
        }

        setSelected(new Set());
        setSheetEntry(null);
        reload();
      } catch (cause) {
        notify(cause instanceof ApiError ? cause.message : 'Move failed');
      }
    },
    [canWrite, endDrag, notify, online, reload],
  );

  // Stable identities: FileTile is memoised, and an inline arrow here would
  // re-render every tile in the grid on every App render.
  const dropIntoFolder = useCallback(
    (folder: Entry, paths: string[]) => void move(folder.path, paths),
    [move],
  );
  const dropIntoPath = useCallback(
    (destination: string, paths: string[]) => void move(destination, paths),
    [move],
  );

  // --- Delete --------------------------------------------------------------
  const [pendingDelete, setPendingDelete] = useState<Entry[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      const outcome = await deletePaths(pendingDelete.map((entry) => entry.path));
      if (outcome.failed.length > 0) {
        notify(
          outcome.failed.length === 1 && outcome.failed[0]
            ? `Could not delete ${outcome.failed[0].path}: ${outcome.failed[0].reason}`
            : `${outcome.failed.length} items could not be deleted`,
        );
      }
      setSelected(new Set());
      setSheetEntry(null);
      reload();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : 'Delete failed');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }, [notify, pendingDelete, reload]);

  // --- New folder ----------------------------------------------------------
  const [creatingFolder, setCreatingFolder] = useState(false);

  const submitNewFolder = useCallback(
    async (name: string) => {
      setCreatingFolder(false);
      try {
        await createFolder(state.path, name);
        reload();
      } catch (cause) {
        notify(cause instanceof ApiError ? cause.message : 'Could not create the folder');
      }
    },
    [notify, reload, state.path],
  );

  // --- Upload --------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);

  const startUpload = useCallback(
    (files: File[]) => {
      if (!canWrite) {
        notify('Your account has read-only access to the share');
        return;
      }
      if (!online) {
        notify('Uploads are paused while the server is unreachable');
        return;
      }
      uploads.enqueue(files, state.path);
    },
    [canWrite, notify, online, state.path, uploads],
  );

  // Dragenter/dragleave fire for every child element, so the overlay is driven
  // by a depth counter rather than a boolean.
  useEffect(() => {
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setDragDepth((depth) => depth + 1);
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    const onDragLeave = () => setDragDepth((depth) => Math.max(0, depth - 1));
    const onDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      setDragDepth(0);
      startUpload(Array.from(event.dataTransfer.files));
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [startUpload]);

  // --- Transfers & notifications -------------------------------------------
  const [transfersVisible, setTransfersVisible] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const activeUploads = uploads.active.length;
  const queuedOrSettled = uploads.transfers.length;
  const { clearSettled, markHistorySeen } = uploads;

  useEffect(() => {
    if (activeUploads > 0) {
      setTransfersVisible(true);
      return;
    }
    if (queuedOrSettled === 0) {
      setTransfersVisible(false);
      return;
    }
    // Everything has landed: show the result just long enough to read, then
    // retire the toast. The bell keeps the outcome from here on.
    const timer = setTimeout(() => {
      setTransfersVisible(false);
      clearSettled();
    }, TOAST_LINGER_MS);
    return () => clearTimeout(timer);
  }, [activeUploads, queuedOrSettled, clearSettled]);

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((open) => {
      if (!open) markHistorySeen();
      return !open;
    });
  }, [markHistorySeen]);

  // --- Keyboard ------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      // The preview overlay owns the keyboard while it is up — Backspace in
      // the text editor must never reach the delete shortcut below.
      if (previewEntry) return;

      if (event.key === 'Escape') {
        setSelected(new Set());
        setSheetEntry(null);
      } else if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
        event.preventDefault();
        setSelected(new Set(entries.map((entry) => entry.path)));
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEntries.length > 0) {
        event.preventDefault();
        if (canWrite && online) setPendingDelete(selectedEntries);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canWrite, entries, online, previewEntry, selectedEntries]);

  // --- Render --------------------------------------------------------------
  if (sessionError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <h1 className="text-[15px] font-semibold">Not signed in</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{sessionError}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-faint)]">
            Open this app through its Tailscale address so the server can see who you are.
          </p>
        </div>
      </div>
    );
  }

  const disk = result?.disk ?? session?.disk ?? { totalBytes: 0, freeBytes: 0, usedBytes: 0 };
  const folderName = result?.breadcrumbs.at(-1)?.name ?? 'Shared Files';
  const searching = state.query.length > 0;

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <TitleBar
        hostname={session?.server.hostname ?? ''}
        atRoot={state.path === '' && state.query === ''}
        connection={connection}
        query={state.query}
        sort={state.sort}
        direction={state.direction}
        canWrite={canWrite}
        onQueryChange={(query) => update({ query })}
        onSortChange={(sort) => update({ sort })}
        onDirectionToggle={() => update({ direction: state.direction === 'asc' ? 'desc' : 'asc' })}
        onUploadClick={() => fileInputRef.current?.click()}
        onNewFolderClick={() => setCreatingFolder(true)}
        onHomeClick={() => navigate('')}
      />

      {!online && (
        <OfflineBanner
          hostname={session?.server.hostname ?? ''}
          onRetry={() => {
            void recheck().then((reachable) => reachable && reload());
          }}
        />
      )}

      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2 sm:px-4">
        <div className="min-w-0 flex-1">
          {result && (
            <Breadcrumbs
              crumbs={result.breadcrumbs}
              canMove={canMove}
              onNavigate={navigate}
              onDropInto={dropIntoPath}
            />
          )}
        </div>
        <ViewToggle view={view} onChange={setView} />

        <button
          type="button"
          onClick={() => {
            setSelectMode((current) => !current);
            setSheetEntry(null);
          }}
          aria-pressed={selectMode}
          className={[
            'shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold lg:hidden',
            selectMode ? 'bg-[var(--accent)] text-white' : 'text-[var(--accent)]',
          ].join(' ')}
        >
          {selectMode ? 'Done' : 'Select'}
        </button>
      </div>

      {selectedEntries.length > 1 ? (
        <SelectionBar
          count={selectedEntries.length}
          bytes={selectedEntries.reduce((sum, entry) => sum + entry.size, 0)}
          canWrite={canWrite}
          online={online}
          busy={bundling}
          onDownload={() => void download(selectedEntries)}
          onDelete={() => setPendingDelete(selectedEntries)}
          onDeselect={() => setSelected(new Set())}
        />
      ) : (
        result && (
          <FilterChips
            categories={result.categories}
            active={state.category}
            totalCount={result.totalCount}
            onChange={(category) => update({ category })}
          />
        )
      )}

      <div className="flex min-h-0 flex-1">
        <main className="scroll-pane relative flex min-w-0 flex-1 flex-col">
          {dragDepth > 0 && canWrite && (
            <DropOverlay
              folderName={folderName}
              maxUploadBytes={session?.server.maxUploadBytes ?? 0}
              freeBytes={disk.freeBytes}
            />
          )}

          {error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13px] text-[var(--text-muted)]">{error}</p>
              <button
                type="button"
                onClick={reload}
                className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[12px] font-semibold text-white"
              >
                Try again
              </button>
            </div>
          ) : loading && !result ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--text-muted)]">
              Loading…
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              query={state.query}
              category={state.category}
              categoryLabel={
                state.category === 'all'
                  ? 'this filter'
                  : (CATEGORY_LABELS[state.category as keyof typeof CATEGORY_LABELS] ?? state.category)
              }
              canUpload={canWrite}
              onClearFilter={() => update({ category: 'all' })}
              onClearSearch={() => update({ query: '' })}
              onUpload={() => fileInputRef.current?.click()}
            />
          ) : (
            <Gallery
              entries={entries}
              selected={selected}
              showPaths={searching}
              view={view}
              canMove={canMove}
              draggingPaths={draggingPaths}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onDragStart={beginDrag}
              onDragEnd={endDrag}
              onDropInto={dropIntoFolder}
            />
          )}
        </main>

        {/* Always mounted, so selecting a tile never reflows the gallery. */}
        <InspectorSidebar
          entry={inspectorEntry}
          selectedCount={selectedEntries.length}
          details={details}
          detailsLoading={detailsLoading}
          canWrite={canWrite}
          online={online}
          onDownload={() => inspectorEntry && void download([inspectorEntry])}
          onDelete={() => inspectorEntry && setPendingDelete([inspectorEntry])}
          onPreview={() => setPreviewEntry(inspectorEntry)}
          onClose={() => setSelected(new Set())}
        />
      </div>

      <StatusBar
        itemCount={result?.totalCount ?? 0}
        totalBytes={result?.totalBytes ?? 0}
        disk={disk}
        trailing={
          canWrite && (
            <NotificationBell
              unseenCount={uploads.unseenCount}
              open={notificationsOpen}
              onToggle={toggleNotifications}
            />
          )
        }
      />

      {sheetEntry && !selectMode && (
        <InspectorSheet
          entry={sheetEntry}
          details={details}
          detailsLoading={detailsLoading}
          canWrite={canWrite}
          online={online}
          onDownload={() => void download([sheetEntry])}
          onDelete={() => setPendingDelete([sheetEntry])}
          onPreview={() => setPreviewEntry(sheetEntry)}
          onClose={() => {
            setSheetEntry(null);
            setSelected(new Set());
          }}
        />
      )}

      {previewEntry && (
        <PreviewOverlay
          entry={previewEntry}
          canWrite={canWrite}
          online={online}
          onSaved={reload}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={
            pendingDelete.length === 1
              ? `Delete “${pendingDelete[0]?.name}”?`
              : `Delete ${pendingDelete.length} items?`
          }
          body={`${formatBytes(
            pendingDelete.reduce((sum, entry) => sum + entry.size, 0),
          )} will be removed from the share immediately. This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {creatingFolder && (
        <PromptDialog
          title="New folder"
          label={`Inside ${folderName}`}
          placeholder="Folder name"
          confirmLabel="Create"
          onConfirm={(name) => void submitNewFolder(name)}
          onCancel={() => setCreatingFolder(false)}
        />
      )}

      {/* The toast covers uploads in flight; once they settle it retires and
          the bell below takes over. Both at once would just be the same list
          stacked on itself. */}
      {transfersVisible && !notificationsOpen && (
        <TransferPanel
          transfers={uploads.transfers}
          onCancel={uploads.cancel}
          onCancelAll={uploads.cancelAll}
          onClear={() => {
            setTransfersVisible(false);
            clearSettled();
          }}
        />
      )}

      {canWrite && (
        <NotificationPanel
          history={uploads.history}
          open={notificationsOpen}
          onToggle={toggleNotifications}
          onClear={uploads.clearHistory}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={dismissToast} />}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          startUpload(Array.from(event.target.files ?? []));
          // Reset so re-picking the same file fires change again.
          event.target.value = '';
        }}
      />
    </div>
  );
}
