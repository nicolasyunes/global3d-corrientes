// Íconos de trazo, heredan el color del texto
type P = { size?: number }
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconCart = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M5 7h14l-1.5 11h-11z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
)
export const IconMenu = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconSun = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconMoon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>
)
export const IconClock = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const IconTruck = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M3 7h11v9H3z" />
    <path d="M14 10h4l3 3v3h-7" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </svg>
)
export const IconPin = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const IconWhatsApp = ({ size = 26 }: P) => (
  <svg {...base(size)}>
    <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />
    <path d="M9 9.5c.3 1.8 1.7 3.3 3.5 4l1.2-1.1 2 .9c-.2 1.2-1.1 2-2.3 1.8-3-.5-5.4-2.9-5.9-5.9C7.3 8 8 7.1 9.3 6.9l.9 2z" />
  </svg>
)
export const IconTrash = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
export const IconCopy = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
)
export const IconClose = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconSearch = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)
export const IconSpark = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />
  </svg>
)
export const IconBank = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M3 9.5 12 5l9 4.5" />
    <path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7" />
    <path d="M3 19.5h18" />
  </svg>
)
export const IconCash = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="6.5" width="18" height="11" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 9.5v.01M17.5 14.5v.01" />
  </svg>
)
export const IconCard = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </svg>
)
export const IconStore = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M4 10v9h16v-9" />
    <path d="M3 10l1.5-5h15L21 10a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" />
    <path d="M10 19v-4h4v4" />
  </svg>
)
export const IconBox = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3 4 7v10l8 4 8-4V7z" />
    <path d="M4 7l8 4 8-4M12 11v10" />
  </svg>
)
export const IconLock = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)
export const IconUser = ({ size = 22 }: P) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)
