export type Category =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'code'
  | 'text'
  | 'ebook'
  | 'font'
  | 'design'
  | 'disk'
  | 'executable'
  | 'data'
  | 'other';

export interface Entry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  childCount: number | null;
  category: Category;
  kind: string;
  mime: string;
  addedAt: number;
  modifiedAt: number;
  owner: string;
  mode: string;
  hasThumbnail: boolean;
}

export interface Crumb {
  name: string;
  path: string;
}

export interface DiskUsage {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export type SortKey = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface BrowseResult {
  path: string;
  query: string;
  sort: SortKey;
  direction: SortDirection;
  breadcrumbs: Crumb[];
  entries: Entry[];
  totalCount: number;
  totalBytes: number;
  categories: Array<{ category: Category; count: number }>;
  disk: DiskUsage;
}

export interface Details {
  path: string;
  isDirectory: boolean;
  sha256?: string | null;
  archiveEntries?: number | null;
  kind?: string;
  childCount?: number;
  totalBytes?: number;
}

export interface Session {
  user: {
    login: string;
    displayName: string;
    profilePic: string | null;
    canWrite: boolean;
  };
  server: {
    hostname: string;
    maxUploadBytes: number;
    videoThumbnails: boolean;
  };
  disk: DiskUsage;
  categories: Array<{ category: Category; label: string }>;
}

export interface DeleteResult {
  deleted: string[];
  failed: Array<{ path: string; reason: string }>;
}

export interface UploadResult {
  uploaded: Array<{ path: string; name: string; size: number }>;
  rejected: Array<{ name: string; reason: string }>;
}
