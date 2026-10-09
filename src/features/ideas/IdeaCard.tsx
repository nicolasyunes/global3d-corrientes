import Icon from '@/components/Icon'
import {
  coverOf,
  detectSource,
  SOURCE_LABEL,
  STATUS_LABEL,
  type Idea,
  type IdeaStatus,
} from './ideas'
import { ideaFileUrl } from './ideas.api'

// Soft backgrounds for cards without a picture, picked by id so a card keeps
// its tone.
const TONES = ['#ece5da', '#e3ebe4', '#e2e8ef', '#ebe4ef', '#efe4dc']
const toneOf = (id: string) =>
  TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % TONES.length]

export function StatusMark({ status }: { status: string }) {
  const s = status as IdeaStatus
  return (
    <span className={`istat istat--${s}`}>
      <i aria-hidden="true" />
      {STATUS_LABEL[s] ?? status}
    </span>
  )
}

export function HighMark() {
  return (
    <span className="ihigh">
      <Icon name="flag" size={14} />
      Alta
    </span>
  )
}

export default function IdeaCard({
  idea,
  collectionName,
  onOpen,
  children,
}: {
  idea: Idea
  collectionName?: string | null
  onOpen: () => void
  children?: React.ReactNode
}) {
  const cover = coverOf(idea, ideaFileUrl)
  const source =
    idea.url || idea.source !== 'photo' ? detectSource(idea.url) : 'photo'
  const label =
    !idea.url && idea.files.some((f) => f.kind === 'image')
      ? 'Foto propia'
      : SOURCE_LABEL[source]
  const links = idea.url ? 1 : 0
  const models = idea.files.filter((f) => f.kind === 'model').length
  return (
    <li className="icard">
      <button type="button" className="icard__open" onClick={onOpen}>
        <span
          className="icard__img"
          style={cover.url ? undefined : { background: toneOf(idea.id) }}
        >
          {cover.url &&
            (cover.video && !idea.preview_image_url ? (
              <video src={cover.url} muted preload="metadata" />
            ) : (
              <img
                src={cover.url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ))}
          {!cover.url && <Icon name="image" size={28} />}
          {cover.video && (
            <span className="icard__play" aria-hidden="true">
              <Icon name="play" size={18} />
            </span>
          )}
          <span className="isource">
            <Icon name={label === 'Foto propia' ? 'image' : 'link'} size={12} />
            {label}
          </span>
        </span>
        <span className="icard__title">{idea.title}</span>
      </button>
      {collectionName !== undefined && collectionName && (
        <span className="icard__coll">{collectionName}</span>
      )}
      <span className="icard__foot">
        {collectionName === undefined ? (
          <StatusMark status={idea.status} />
        ) : (
          <span className="icard__counts">
            <span title="Links">
              <Icon name="link" size={13} />
              {links}
            </span>
            <span title="Archivos 3D">
              <Icon name="cube" size={13} />
              {models === 0
                ? 'sin archivos'
                : `${models} ${models === 1 ? 'archivo' : 'archivos'}`}
            </span>
          </span>
        )}
        {idea.priority === 'high' && <HighMark />}
      </span>
      {children}
    </li>
  )
}
