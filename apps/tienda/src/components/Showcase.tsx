const BASE = `${import.meta.env.BASE_URL}a-medida/`

// Con "reducir movimiento" el video no arranca solo: queda el poster.
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

// Muestra de trabajo a medida: el cartel del taller impreso en la Giga.
export function Showcase() {
  const still = prefersReducedMotion()
  return (
    <figure className="showcase">
      <div className="showcase-grid">
        <div className="showcase-video">
          <video
            src={`${BASE}global3d-letras.mp4`}
            poster={`${BASE}global3d-letras.jpg`}
            autoPlay={!still}
            muted
            loop
            playsInline
            preload={still ? 'none' : 'auto'}
            aria-label="Animación: la impresora imprime las letras GLOBAL 3D y se encienden"
          />
        </div>
        <div className="showcase-photo">
          <img
            src={`${BASE}cartel-impresora.jpg`}
            alt="Cartel GLOBAL 3D con letras iluminadas, junto a la impresora grande del taller"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="showcase-photo">
          <img
            src={`${BASE}cartel-encendido.jpg`}
            alt="El cartel GLOBAL 3D encendido: letras blancas y 3D en naranja"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      <figcaption>
        Carteles con letras corpóreas iluminadas, piezas grandes y lo que se
        te ocurra. Este lo hicimos para nuestro taller.
      </figcaption>
    </figure>
  )
}
