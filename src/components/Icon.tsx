const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  printer: 'M4 3h16v4H4zM6 7v10M18 7v10M4 17h16v4H4zM10 12h4v5h-4z',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  brush: 'M14 4l6 6-8 8H6v-6zM4 20c2 0 2-2 2-2',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  users:
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5M17 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 14c2.4 0 4 1.3 4.6 4',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7',
  back: 'M15 5l-7 7 7 7',
  spark:
    'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  kanban: 'M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  close: 'M6 6l12 12M18 6L6 18',
  del: 'M9 6h11v12H9l-6-6zM12 10l4 4M16 10l-4 4',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  next: 'M9 5l7 7-7 7',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  sand: 'M4 15h16v4H4zM6 15l2-8h8l2 8M10 11h4',
  chat: 'M4 5h16v11H9l-5 4z',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  wrench: 'M14 6a4 4 0 0 0 5 5l-9 9-4-4 9-9zM6 16l2 2',
  play: 'M8 5l11 7-11 7z',
  auto: 'M4 12a8 8 0 0 1 14-5l2-2v6h-6l2-2a5 5 0 1 0 1 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  spool:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v6M12 15v6',
  cart: 'M3 4h2l2.4 11h10.2L20 8H6.2M9 19.5h.01M17 19.5h.01',
  calc: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8v3H8zM8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
