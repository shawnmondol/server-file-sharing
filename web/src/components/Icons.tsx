import type { ReactElement, SVGProps } from 'react';
import type { Category } from '../lib/types';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * One stroked-path system at a 24px grid, so every glyph shares a weight and
 * optical size regardless of where it is used.
 */
function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4.6-4.6" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v12" />
    <path d="M7 11l5 5 5-5" />
    <path d="M4 19h16" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const NewFolderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M12 11v5M9.5 13.5h5" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon strokeWidth={2.6} {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
);

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19V5" />
    <path d="M6 11l6-6 6 6" />
  </Icon>
);

export const RetryIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4h-4" />
  </Icon>
);

const FolderGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);

const ImageGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.6" />
    <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17" />
  </Icon>
);

const VideoGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10.5l5-2.5v8l-5-2.5z" />
  </Icon>
);

const AudioGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </Icon>
);

const DocumentGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </Icon>
);

const SpreadsheetGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M4 15h16M10 4v16" />
  </Icon>
);

const PresentationGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="11" rx="2" />
    <path d="M12 15v5M8.5 20h7" />
  </Icon>
);

const ArchiveGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M3 7l1.6-3h14.8L21 7" />
    <path d="M11 11h2M11 14h2" />
  </Icon>
);

const CodeGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 7l-5 5 5 5" />
    <path d="M15 7l5 5-5 5" />
  </Icon>
);

const TextGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
    <path d="M8.5 13h7M8.5 16.5h4" />
  </Icon>
);

const DataGlyph = (props: IconProps) => (
  <Icon {...props}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </Icon>
);

const EbookGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H19v18H6.5A2.5 2.5 0 0 0 4 22z" />
    <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19" />
  </Icon>
);

const FontGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 19l6-14 6 14" />
    <path d="M7.8 14h8.4" />
  </Icon>
);

const DesignGlyph = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6" />
  </Icon>
);

const DiskGlyph = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 3.5a8.5 8.5 0 0 1 7.4 4.3" />
  </Icon>
);

const ExecutableGlyph = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M9.5 9.5l5 2.5-5 2.5z" />
  </Icon>
);

const FileGlyph = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v5h5" />
  </Icon>
);

const GLYPHS: Record<Category, (props: IconProps) => ReactElement> = {
  folder: FolderGlyph,
  image: ImageGlyph,
  video: VideoGlyph,
  audio: AudioGlyph,
  document: DocumentGlyph,
  spreadsheet: SpreadsheetGlyph,
  presentation: PresentationGlyph,
  archive: ArchiveGlyph,
  code: CodeGlyph,
  text: TextGlyph,
  data: DataGlyph,
  ebook: EbookGlyph,
  font: FontGlyph,
  design: DesignGlyph,
  disk: DiskGlyph,
  executable: ExecutableGlyph,
  other: FileGlyph,
};

export function CategoryIcon({ category, ...rest }: IconProps & { category: Category }) {
  const Glyph = GLYPHS[category] ?? FileGlyph;
  return <Glyph {...rest} />;
}
