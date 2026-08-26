/**
 * File-type classification.
 *
 * Two levels: a coarse `category` that drives the filter chips and the tile
 * icon, and a human `kind` label ("tar.gz archive", "JPEG image") shown in the
 * inspector. Extensions win over sniffing — we never read file contents to
 * decide what something is.
 */

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

export const CATEGORY_ORDER: Category[] = [
  'folder',
  'image',
  'video',
  'audio',
  'document',
  'spreadsheet',
  'presentation',
  'archive',
  'code',
  'text',
  'data',
  'ebook',
  'font',
  'design',
  'disk',
  'executable',
  'other',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  folder: 'Folders',
  image: 'Images',
  video: 'Video',
  audio: 'Audio',
  document: 'Documents',
  spreadsheet: 'Spreadsheets',
  presentation: 'Presentations',
  archive: 'Archives',
  code: 'Code',
  text: 'Text',
  data: 'Data',
  ebook: 'E-books',
  font: 'Fonts',
  design: 'Design',
  disk: 'Disk images',
  executable: 'Apps',
  other: 'Other',
};

interface TypeSpec {
  category: Category;
  kind: string;
  mime: string;
}

/**
 * Compound extensions, checked first so `backup.tar.gz` reads as a tarball
 * rather than a gzip blob. Keys are matched against the end of the filename.
 */
const COMPOUND: Record<string, TypeSpec> = {
  '.tar.gz': { category: 'archive', kind: 'tar.gz', mime: 'application/gzip' },
  '.tar.bz2': { category: 'archive', kind: 'tar.bz2', mime: 'application/x-bzip2' },
  '.tar.xz': { category: 'archive', kind: 'tar.xz', mime: 'application/x-xz' },
  '.tar.zst': { category: 'archive', kind: 'tar.zst', mime: 'application/zstd' },
  '.tar.lz4': { category: 'archive', kind: 'tar.lz4', mime: 'application/x-lz4' },
  '.d.ts': { category: 'code', kind: 'TypeScript declarations', mime: 'text/plain' },
};

const BY_EXTENSION: Record<string, TypeSpec> = {
  // --- Images --------------------------------------------------------------
  '.jpg': { category: 'image', kind: 'JPEG image', mime: 'image/jpeg' },
  '.jpeg': { category: 'image', kind: 'JPEG image', mime: 'image/jpeg' },
  '.jfif': { category: 'image', kind: 'JPEG image', mime: 'image/jpeg' },
  '.png': { category: 'image', kind: 'PNG image', mime: 'image/png' },
  '.gif': { category: 'image', kind: 'GIF image', mime: 'image/gif' },
  '.webp': { category: 'image', kind: 'WebP image', mime: 'image/webp' },
  '.avif': { category: 'image', kind: 'AVIF image', mime: 'image/avif' },
  '.heic': { category: 'image', kind: 'HEIC image', mime: 'image/heic' },
  '.heif': { category: 'image', kind: 'HEIF image', mime: 'image/heif' },
  '.tif': { category: 'image', kind: 'TIFF image', mime: 'image/tiff' },
  '.tiff': { category: 'image', kind: 'TIFF image', mime: 'image/tiff' },
  '.bmp': { category: 'image', kind: 'Bitmap image', mime: 'image/bmp' },
  '.ico': { category: 'image', kind: 'Icon', mime: 'image/x-icon' },
  '.svg': { category: 'image', kind: 'SVG image', mime: 'image/svg+xml' },
  '.raw': { category: 'image', kind: 'Camera raw', mime: 'image/x-dcraw' },
  '.cr2': { category: 'image', kind: 'Canon raw', mime: 'image/x-canon-cr2' },
  '.cr3': { category: 'image', kind: 'Canon raw', mime: 'image/x-canon-cr3' },
  '.nef': { category: 'image', kind: 'Nikon raw', mime: 'image/x-nikon-nef' },
  '.arw': { category: 'image', kind: 'Sony raw', mime: 'image/x-sony-arw' },
  '.dng': { category: 'image', kind: 'Digital negative', mime: 'image/x-adobe-dng' },

  // --- Video ---------------------------------------------------------------
  '.mp4': { category: 'video', kind: 'MPEG-4 video', mime: 'video/mp4' },
  '.m4v': { category: 'video', kind: 'MPEG-4 video', mime: 'video/x-m4v' },
  '.mov': { category: 'video', kind: 'QuickTime video', mime: 'video/quicktime' },
  '.mkv': { category: 'video', kind: 'Matroska video', mime: 'video/x-matroska' },
  '.webm': { category: 'video', kind: 'WebM video', mime: 'video/webm' },
  '.avi': { category: 'video', kind: 'AVI video', mime: 'video/x-msvideo' },
  '.wmv': { category: 'video', kind: 'Windows Media video', mime: 'video/x-ms-wmv' },
  '.flv': { category: 'video', kind: 'Flash video', mime: 'video/x-flv' },
  '.mpg': { category: 'video', kind: 'MPEG video', mime: 'video/mpeg' },
  '.mpeg': { category: 'video', kind: 'MPEG video', mime: 'video/mpeg' },
  '.ts': { category: 'video', kind: 'MPEG transport stream', mime: 'video/mp2t' },
  '.3gp': { category: 'video', kind: '3GPP video', mime: 'video/3gpp' },

  // --- Audio ---------------------------------------------------------------
  '.mp3': { category: 'audio', kind: 'MP3 audio', mime: 'audio/mpeg' },
  '.m4a': { category: 'audio', kind: 'AAC audio', mime: 'audio/mp4' },
  '.aac': { category: 'audio', kind: 'AAC audio', mime: 'audio/aac' },
  '.wav': { category: 'audio', kind: 'WAV audio', mime: 'audio/wav' },
  '.flac': { category: 'audio', kind: 'FLAC audio', mime: 'audio/flac' },
  '.ogg': { category: 'audio', kind: 'Ogg audio', mime: 'audio/ogg' },
  '.oga': { category: 'audio', kind: 'Ogg audio', mime: 'audio/ogg' },
  '.opus': { category: 'audio', kind: 'Opus audio', mime: 'audio/opus' },
  '.wma': { category: 'audio', kind: 'Windows Media audio', mime: 'audio/x-ms-wma' },
  '.aiff': { category: 'audio', kind: 'AIFF audio', mime: 'audio/aiff' },
  '.mid': { category: 'audio', kind: 'MIDI', mime: 'audio/midi' },

  // --- Documents -----------------------------------------------------------
  '.pdf': { category: 'document', kind: 'PDF document', mime: 'application/pdf' },
  '.doc': { category: 'document', kind: 'Word document', mime: 'application/msword' },
  '.docx': {
    category: 'document',
    kind: 'Word document',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  '.odt': { category: 'document', kind: 'OpenDocument text', mime: 'application/vnd.oasis.opendocument.text' },
  '.rtf': { category: 'document', kind: 'Rich text', mime: 'application/rtf' },
  '.pages': { category: 'document', kind: 'Pages document', mime: 'application/x-iwork-pages-sffpages' },
  '.tex': { category: 'document', kind: 'LaTeX source', mime: 'text/x-tex' },

  // --- Spreadsheets --------------------------------------------------------
  '.xls': { category: 'spreadsheet', kind: 'Excel workbook', mime: 'application/vnd.ms-excel' },
  '.xlsx': {
    category: 'spreadsheet',
    kind: 'Excel workbook',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  '.ods': {
    category: 'spreadsheet',
    kind: 'OpenDocument spreadsheet',
    mime: 'application/vnd.oasis.opendocument.spreadsheet',
  },
  '.numbers': { category: 'spreadsheet', kind: 'Numbers spreadsheet', mime: 'application/x-iwork-numbers-sffnumbers' },

  // --- Presentations -------------------------------------------------------
  '.ppt': { category: 'presentation', kind: 'PowerPoint deck', mime: 'application/vnd.ms-powerpoint' },
  '.pptx': {
    category: 'presentation',
    kind: 'PowerPoint deck',
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  },
  '.odp': {
    category: 'presentation',
    kind: 'OpenDocument presentation',
    mime: 'application/vnd.oasis.opendocument.presentation',
  },
  '.key': { category: 'presentation', kind: 'Keynote deck', mime: 'application/x-iwork-keynote-sffkey' },

  // --- Archives ------------------------------------------------------------
  '.zip': { category: 'archive', kind: 'ZIP archive', mime: 'application/zip' },
  '.tar': { category: 'archive', kind: 'tar archive', mime: 'application/x-tar' },
  '.gz': { category: 'archive', kind: 'gzip archive', mime: 'application/gzip' },
  '.bz2': { category: 'archive', kind: 'bzip2 archive', mime: 'application/x-bzip2' },
  '.xz': { category: 'archive', kind: 'xz archive', mime: 'application/x-xz' },
  '.zst': { category: 'archive', kind: 'zstd archive', mime: 'application/zstd' },
  '.7z': { category: 'archive', kind: '7-Zip archive', mime: 'application/x-7z-compressed' },
  '.rar': { category: 'archive', kind: 'RAR archive', mime: 'application/vnd.rar' },
  '.tgz': { category: 'archive', kind: 'tar.gz', mime: 'application/gzip' },
  '.tbz': { category: 'archive', kind: 'tar.bz2', mime: 'application/x-bzip2' },
  '.lz4': { category: 'archive', kind: 'LZ4 archive', mime: 'application/x-lz4' },

  // --- Code ----------------------------------------------------------------
  '.js': { category: 'code', kind: 'JavaScript', mime: 'text/javascript' },
  '.mjs': { category: 'code', kind: 'JavaScript', mime: 'text/javascript' },
  '.cjs': { category: 'code', kind: 'JavaScript', mime: 'text/javascript' },
  '.jsx': { category: 'code', kind: 'JSX', mime: 'text/jsx' },
  '.tsx': { category: 'code', kind: 'TypeScript JSX', mime: 'text/plain' },
  '.py': { category: 'code', kind: 'Python', mime: 'text/x-python' },
  '.rb': { category: 'code', kind: 'Ruby', mime: 'text/x-ruby' },
  '.go': { category: 'code', kind: 'Go', mime: 'text/x-go' },
  '.rs': { category: 'code', kind: 'Rust', mime: 'text/x-rust' },
  '.java': { category: 'code', kind: 'Java', mime: 'text/x-java' },
  '.kt': { category: 'code', kind: 'Kotlin', mime: 'text/x-kotlin' },
  '.swift': { category: 'code', kind: 'Swift', mime: 'text/x-swift' },
  '.c': { category: 'code', kind: 'C source', mime: 'text/x-c' },
  '.h': { category: 'code', kind: 'C header', mime: 'text/x-c' },
  '.cpp': { category: 'code', kind: 'C++ source', mime: 'text/x-c++' },
  '.hpp': { category: 'code', kind: 'C++ header', mime: 'text/x-c++' },
  '.cs': { category: 'code', kind: 'C#', mime: 'text/plain' },
  '.php': { category: 'code', kind: 'PHP', mime: 'text/x-php' },
  '.sh': { category: 'code', kind: 'Shell script', mime: 'text/x-shellscript' },
  '.bash': { category: 'code', kind: 'Shell script', mime: 'text/x-shellscript' },
  '.zsh': { category: 'code', kind: 'Shell script', mime: 'text/x-shellscript' },
  '.ps1': { category: 'code', kind: 'PowerShell script', mime: 'text/plain' },
  '.sql': { category: 'code', kind: 'SQL', mime: 'text/plain' },
  '.html': { category: 'code', kind: 'HTML', mime: 'text/html' },
  '.htm': { category: 'code', kind: 'HTML', mime: 'text/html' },
  '.css': { category: 'code', kind: 'Stylesheet', mime: 'text/css' },
  '.scss': { category: 'code', kind: 'Sass stylesheet', mime: 'text/x-scss' },
  '.lua': { category: 'code', kind: 'Lua', mime: 'text/x-lua' },
  '.pl': { category: 'code', kind: 'Perl', mime: 'text/x-perl' },
  '.r': { category: 'code', kind: 'R script', mime: 'text/x-r' },
  '.ipynb': { category: 'code', kind: 'Jupyter notebook', mime: 'application/json' },

  // --- Data / config -------------------------------------------------------
  '.json': { category: 'data', kind: 'JSON', mime: 'application/json' },
  '.jsonl': { category: 'data', kind: 'JSON Lines', mime: 'application/jsonl' },
  '.yaml': { category: 'data', kind: 'YAML', mime: 'text/yaml' },
  '.yml': { category: 'data', kind: 'YAML', mime: 'text/yaml' },
  '.toml': { category: 'data', kind: 'TOML', mime: 'text/plain' },
  '.xml': { category: 'data', kind: 'XML', mime: 'application/xml' },
  '.csv': { category: 'data', kind: 'CSV', mime: 'text/csv' },
  '.tsv': { category: 'data', kind: 'TSV', mime: 'text/tab-separated-values' },
  '.ini': { category: 'data', kind: 'INI config', mime: 'text/plain' },
  '.conf': { category: 'data', kind: 'Config file', mime: 'text/plain' },
  '.env': { category: 'data', kind: 'Environment file', mime: 'text/plain' },
  '.parquet': { category: 'data', kind: 'Parquet', mime: 'application/vnd.apache.parquet' },
  '.sqlite': { category: 'data', kind: 'SQLite database', mime: 'application/vnd.sqlite3' },
  '.db': { category: 'data', kind: 'Database', mime: 'application/octet-stream' },

  // --- Plain text ----------------------------------------------------------
  '.txt': { category: 'text', kind: 'Plain text', mime: 'text/plain' },
  '.md': { category: 'text', kind: 'Markdown', mime: 'text/markdown' },
  '.markdown': { category: 'text', kind: 'Markdown', mime: 'text/markdown' },
  '.log': { category: 'text', kind: 'Log file', mime: 'text/plain' },
  '.rst': { category: 'text', kind: 'reStructuredText', mime: 'text/plain' },

  // --- E-books -------------------------------------------------------------
  '.epub': { category: 'ebook', kind: 'EPUB book', mime: 'application/epub+zip' },
  '.mobi': { category: 'ebook', kind: 'Mobipocket book', mime: 'application/x-mobipocket-ebook' },
  '.azw3': { category: 'ebook', kind: 'Kindle book', mime: 'application/vnd.amazon.ebook' },

  // --- Fonts ---------------------------------------------------------------
  '.ttf': { category: 'font', kind: 'TrueType font', mime: 'font/ttf' },
  '.otf': { category: 'font', kind: 'OpenType font', mime: 'font/otf' },
  '.woff': { category: 'font', kind: 'WOFF font', mime: 'font/woff' },
  '.woff2': { category: 'font', kind: 'WOFF2 font', mime: 'font/woff2' },

  // --- Design --------------------------------------------------------------
  '.psd': { category: 'design', kind: 'Photoshop document', mime: 'image/vnd.adobe.photoshop' },
  '.ai': { category: 'design', kind: 'Illustrator document', mime: 'application/postscript' },
  '.sketch': { category: 'design', kind: 'Sketch document', mime: 'application/octet-stream' },
  '.fig': { category: 'design', kind: 'Figma document', mime: 'application/octet-stream' },
  '.xcf': { category: 'design', kind: 'GIMP image', mime: 'image/x-xcf' },
  '.blend': { category: 'design', kind: 'Blender scene', mime: 'application/octet-stream' },
  '.stl': { category: 'design', kind: 'STL model', mime: 'model/stl' },
  '.obj': { category: 'design', kind: 'OBJ model', mime: 'model/obj' },
  '.3mf': { category: 'design', kind: '3MF model', mime: 'model/3mf' },

  // --- Disk images ---------------------------------------------------------
  '.iso': { category: 'disk', kind: 'Disc image', mime: 'application/x-iso9660-image' },
  '.img': { category: 'disk', kind: 'Disk image', mime: 'application/octet-stream' },
  '.dmg': { category: 'disk', kind: 'macOS disk image', mime: 'application/x-apple-diskimage' },
  '.vhd': { category: 'disk', kind: 'Virtual hard disk', mime: 'application/octet-stream' },
  '.qcow2': { category: 'disk', kind: 'QEMU disk image', mime: 'application/octet-stream' },

  // --- Executables / packages ---------------------------------------------
  '.deb': { category: 'executable', kind: 'Debian package', mime: 'application/vnd.debian.binary-package' },
  '.rpm': { category: 'executable', kind: 'RPM package', mime: 'application/x-rpm' },
  '.apk': { category: 'executable', kind: 'Android package', mime: 'application/vnd.android.package-archive' },
  '.exe': { category: 'executable', kind: 'Windows executable', mime: 'application/vnd.microsoft.portable-executable' },
  '.msi': { category: 'executable', kind: 'Windows installer', mime: 'application/x-msi' },
  '.appimage': { category: 'executable', kind: 'AppImage', mime: 'application/octet-stream' },
  '.pkg': { category: 'executable', kind: 'macOS installer', mime: 'application/octet-stream' },
};

const FALLBACK: TypeSpec = { category: 'other', kind: 'File', mime: 'application/octet-stream' };

export function classify(filename: string): TypeSpec {
  const lower = filename.toLowerCase();

  for (const [suffix, spec] of Object.entries(COMPOUND)) {
    if (lower.endsWith(suffix)) return spec;
  }

  const dot = lower.lastIndexOf('.');
  if (dot <= 0) {
    // Dotfiles (`.gitignore`) and extensionless files read as plain text.
    return lower.startsWith('.')
      ? { category: 'text', kind: 'Config file', mime: 'text/plain' }
      : FALLBACK;
  }

  return BY_EXTENSION[lower.slice(dot)] ?? FALLBACK;
}

/** Thumbnails are only worth generating for these two categories. */
export function canThumbnail(category: Category): boolean {
  return category === 'image' || category === 'video';
}

/**
 * Formats sharp can decode. SVG and camera raw are excluded — sharp either
 * cannot read them or would need a delegate we do not ship.
 */
const SHARP_READABLE = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.gif', '.webp', '.avif',
  '.heic', '.heif', '.tif', '.tiff',
]);

export function isSharpReadable(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot > 0 && SHARP_READABLE.has(lower.slice(dot));
}
