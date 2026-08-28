import { waHref } from '@/lib/whatsapp'

const MSG = 'Hola! Quiero un pedido personalizado (nombre, color o escudo a elección).'

export default function CustomOrderCTA({ variant }: { variant: 'strip' | 'card' }) {
  return (
    <div className={variant === 'card' ? 'sf-cta-card' : 'sf-cta-strip'}>
      <div className="sf-cta__text">
        <strong>¿Lo querés a tu medida?</strong> Personalizamos casi todo con nombres, colores,
        escudos o diseños propios.
      </div>
      <a className="btn btn--primary" href={waHref(MSG)} target="_blank" rel="noopener noreferrer">
        Pedir personalizado
      </a>
    </div>
  )
}
