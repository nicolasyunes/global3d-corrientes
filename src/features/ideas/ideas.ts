import { daysBetween } from '@/features/production/due'
import type { Database } from '@/lib/database.types'

type Tables = Database['public']['Tables']

export type IdeaSource =
  | 'makerworld'
  | 'cults'
  | 'printables'
  | 'thingiverse'
  | 'instagram'
  | 'tiktok'
  | 'pinterest'
  | 'photo'
  | 'other'

export type IdeaStatus = 'idea' | 'to_test' | 'tested'
export type IdeaPriority = 'normal' | 'high'
export type IdeaFileKind = 'image' | 'video' | 'model'

export type IdeaFile = Tables['idea_files']['Row']
export type Collection = Tables['idea_collections']['Row']
export type Idea = Tables['ideas']['Row'] & { files: IdeaFile[] }

export const SOURCE_LABEL: Record<IdeaSource, string> = {
  makerworld: 'MakerWorld',
  cults: 'Cults',
  printables: 'Printables',
  thingiverse: 'Thingiverse',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  photo: 'Foto propia',
  other: 'Link',
}

export const STATUSES: IdeaStatus[] = ['idea', 'to_test', 'tested']

export const STATUS_LABEL: Record<IdeaStatus, string> = {
  idea: 'Idea',
  to_test: 'Para probar',
  tested: 'Probada',
}

const HOSTS: [RegExp, IdeaSource][] = [
  [/(^|\.)makerworld\.com$/, 'makerworld'],
  [/(^|\.)cults3d\.com$/, 'cults'],
  [/(^|\.)printables\.com$/, 'printables'],
  [/(^|\.)thingiverse\.com$/, 'thingiverse'],
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'pinterest'],
]

// The site label comes from the domain alone, so it shows even when the
// page itself can't be read.
export function detectSource(url: string | null | undefined): IdeaSource {
  if (!url) return 'other'
  let host: string
  try {
    host = new URL(url.trim()).hostname.toLowerCase()
  } catch {
    return 'other'
  }
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'other'
}

export function isUrl(text: string): boolean {
  try {
    const u = new URL(text.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export const MAX_IDEA_FILE_BYTES = 50 * 1024 * 1024
const MODEL_EXT = /\.(stl|3mf|obj|step|stp)$/i
const VIDEO_EXT = /\.(mp4|webm|mov)$/i

export const IDEA_FILE_ACCEPT =
  'image/*,video/mp4,video/webm,video/quicktime,.stl,.3mf,.obj,.step,.stp'

export function fileKind(name: string, type: string): IdeaFileKind | null {
  if (MODEL_EXT.test(name)) return 'model'
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/') || VIDEO_EXT.test(name)) return 'video'
  return null
}

export function validateIdeaFile(file: File): string | null {
  if (!fileKind(file.name, file.type))
    return `${file.name}: solo fotos, videos o archivos STL/3MF/OBJ/STEP.`
  if (file.size > MAX_IDEA_FILE_BYTES)
    return `${file.name}: no puede superar los 50 MB.`
  return null
}

export function collectionCountdown(
  target: string | null,
  today: string,
): string | null {
  if (!target) return null
  const diff = daysBetween(today, target)
  if (diff < 0) return 'ya pasó'
  if (diff === 0) return 'es hoy'
  return diff === 1 ? 'falta 1 día' : `faltan ${diff} días`
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-AR', {
    month: 'short',
    timeZone: 'UTC',
  })
  return `${d} ${month.replace('.', '')}`
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface IdeaFilter {
  collection?: string // 'all' | 'none' | collection id
  onlyHigh?: boolean
  query?: string
}

export function filterIdeas(ideas: readonly Idea[], f: IdeaFilter): Idea[] {
  const q = fold(f.query?.trim() ?? '')
  return ideas.filter(
    (i) =>
      (!f.collection ||
        f.collection === 'all' ||
        (f.collection === 'none'
          ? i.collection_id === null
          : i.collection_id === f.collection)) &&
      (!f.onlyHigh || i.priority === 'high') &&
      (!q || fold(`${i.title} ${i.notes ?? ''}`).includes(q)),
  )
}

export interface IdeaGroup {
  collection: Collection | null
  ideas: Idea[]
}

// One section per collection in its order (empty ones too, so "Agregar acá"
// is always reachable), then the loose ideas.
export function groupByCollection(
  ideas: readonly Idea[],
  collections: readonly Collection[],
): IdeaGroup[] {
  const ordered = [...collections].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  )
  const groups: IdeaGroup[] = ordered.map((c) => ({
    collection: c,
    ideas: ideas.filter((i) => i.collection_id === c.id),
  }))
  const known = new Set(ordered.map((c) => c.id))
  const loose = ideas.filter(
    (i) => !i.collection_id || !known.has(i.collection_id),
  )
  if (loose.length) groups.push({ collection: null, ideas: loose })
  return groups
}

// The picture on the card: the one read from the link, else the first own
// photo or video.
export function coverOf(
  idea: Idea,
  urlOf: (path: string) => string = (p) => p,
): { url: string | null; video: boolean } {
  if (idea.preview_image_url)
    return {
      url: idea.preview_image_url,
      video: idea.source === 'tiktok' || /\/reels?\//.test(idea.url ?? ''),
    }
  const media = idea.files.find((f) => f.kind === 'image' || f.kind === 'video')
  if (media)
    return { url: urlOf(media.storage_path), video: media.kind === 'video' }
  return { url: null, video: false }
}

export function statusSummary(ideas: readonly Idea[]): string {
  const n = (s: IdeaStatus) => ideas.filter((i) => i.status === s).length
  const parts: string[] = []
  if (n('tested'))
    parts.push(`${n('tested')} ${n('tested') === 1 ? 'probada' : 'probadas'}`)
  if (n('to_test')) parts.push(`${n('to_test')} por probar`)
  if (n('idea'))
    parts.push(`${n('idea')} ${n('idea') === 1 ? 'idea' : 'ideas'}`)
  return parts.join(' · ') || 'Vacía'
}
