import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { ars } from '../lib/format'
import { loadMpSdk, mpResultMessage } from '../lib/mercadopago'

interface Brick {
  unmount: () => void
}
interface MpGlobal {
  new (
    publicKey: string,
    opts: { locale: string },
  ): {
    bricks: () => {
      create: (
        kind: 'payment',
        containerId: string,
        settings: unknown,
      ) => Promise<Brick>
    }
  }
}

const CONTAINER = 'mp-card-brick'

/**
 * Pago con Mercado Pago (Payment Brick) de la seña o el total de un pedido:
 * tarjeta de crédito o débito acá mismo, o "Pagar con Mercado Pago" (dinero en
 * cuenta, tarjetas guardadas), que lleva al login de Mercado Pago y vuelve a
 * esta página. Los datos de la tarjeta los maneja Mercado Pago; acá solo llega
 * un token. El cobro y el monto los decide el servidor.
 */
export function MpCardPayment({
  orderToken,
  amount,
  publicKey,
  onPaid,
}: {
  orderToken: string
  amount: number
  publicKey: string
  onPaid: () => void
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  // Cada formulario se crea recién cuando el anterior terminó de cerrarse: si
  // no, al cerrarse vacía el contenedor que ya usa el nuevo.
  const previous = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let alive = true
    setPhase('loading')
    const created = previous.current
      .then(() =>
        Promise.all([
          loadMpSdk(),
          // Sin preferencia igual se puede pagar con tarjeta.
          api
            .mercadoPagoPreference(orderToken, window.location.href)
            .catch(() => null),
        ]),
      )
      .then(([, preferenceId]) => {
        if (!alive) return null
        const MP = (window as unknown as { MercadoPago: MpGlobal }).MercadoPago
        const mp = new MP(publicKey, { locale: 'es-AR' })
        return mp.bricks().create('payment', CONTAINER, {
          initialization: preferenceId ? { amount, preferenceId } : { amount },
          customization: {
            visual: { style: { theme: 'default' } },
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              ...(preferenceId ? { mercadoPago: 'all' } : {}),
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => alive && setPhase('ready'),
            // Los errores no críticos (un campo mal cargado) los muestra el
            // propio formulario; solo se tapa si no puede funcionar.
            onError: (e: { type?: string } | undefined) => {
              if (alive && e?.type === 'critical') setPhase('error')
            },
            onSubmit: async ({
              selectedPaymentMethod,
              formData,
            }: {
              selectedPaymentMethod?: string
              formData?: unknown
            }) => {
              // "Pagar con Mercado Pago": el Brick lleva al login de Mercado
              // Pago y el pago entra por el aviso (mp-webhook).
              if (selectedPaymentMethod === 'wallet_purchase') return
              const r = await api.payWithMercadoPago(orderToken, formData)
              const msg = mpResultMessage(r.status, r.statusDetail)
              if (alive) setResult(msg)
              if (r.status === 'approved' || r.status === 'in_process') onPaid()
              // El Brick espera que la promesa se rechace si el pago falló.
              if (!msg.ok) throw new Error(r.statusDetail ?? 'rechazado')
            },
          },
        })
      })
      .catch(() => {
        if (alive) setPhase('error')
        return null
      })
    previous.current = created.then(() => undefined)
    return () => {
      alive = false
      previous.current = created.then((b) => {
        try {
          b?.unmount()
        } catch {
          // Ya estaba cerrado.
        }
      })
    }
  }, [orderToken, amount, publicKey, onPaid])

  return (
    <section className="panel" aria-labelledby="mp-title">
      <h2 id="mp-title">Pagá con Mercado Pago: {ars(amount)}</h2>
      <p className="muted">
        Con tu cuenta de Mercado Pago (dinero en cuenta o tarjetas guardadas) o
        con cualquier tarjeta de crédito o débito. Las cuotas y su interés
        dependen de tu tarjeta.
      </p>
      {result && (
        <div
          className={result.ok ? 'notice n-ok' : 'notice n-danger'}
          role={result.ok ? 'status' : 'alert'}
        >
          {result.text}
        </div>
      )}
      {phase === 'loading' && (
        <div className="skeleton" style={{ height: 320 }} />
      )}
      {phase === 'error' && (
        <div className="notice n-danger" role="alert">
          No se pudo cargar el pago con tarjeta. Probá de nuevo en un rato o
          pagá por transferencia.
        </div>
      )}
      <div id={CONTAINER} />
    </section>
  )
}
