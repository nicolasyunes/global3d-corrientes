import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import { IDEA_FILE_ACCEPT } from './ideas'

// Files from a drop, the picker or Ctrl+V anywhere while it is mounted.
export default function FileDrop({
  onFiles,
  title = 'Fotos, capturas, reels o STL/3MF',
}: {
  onFiles: (files: File[]) => void
  title?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const latest = useRef(onFiles)
  latest.current = onFiles

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        latest.current(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div
      className={`idrop${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = [...e.dataTransfer.files]
        if (files.length) onFiles(files)
      }}
    >
      <button
        type="button"
        className="idrop__btn"
        aria-label="Elegir archivos"
        onClick={() => input.current?.click()}
      >
        <Icon name="upload" size={20} />
      </button>
      <span className="idrop__text">
        <strong>{title}</strong>
        <span>Arrastralas, elegilas o pegalas con Ctrl+V</span>
      </span>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={IDEA_FILE_ACCEPT}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
    </div>
  )
}
