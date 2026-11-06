// Panel "Diseño" de los generadores: guardar en Supabase, volver a abrir y
// asociar a un pedido. Las herramientas se sirven en el mismo dominio que el
// admin (/herramientas), así que comparten la sesión de Supabase y el operador
// elegido en el admin (localStorage `g3d.operator`).
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import {
  deleteDesign,
  getDesign,
  listOpenOrders,
  listRecentDesigns,
  saveDesign,
  uploadDesignFiles,
  type DesignKind,
  type DesignRow,
} from '@/features/designs/designs.api'

export interface Generador {
  kind: DesignKind
  // Estado completo del generador (parámetros, SVG, agujeros…)
  leer: () => Json
  // Vuelve a armar el generador con un estado guardado
  aplicar: (params: Json) => Promise<void> | void
  // Archivos que se guardan junto al diseño (3MF, SVG original…)
  archivos: () => Promise<{ name: string; kind: string; blob: Blob }[]>
  miniatura: () => Promise<Blob | null>
  nombreSugerido: () => string
}

const operadorActual = (): string | null => {
  try {
    return localStorage.getItem('g3d.operator')
  } catch {
    return null
  }
}

const esc = (s: string) =>
  s.replace(
    /[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!,
  )

export async function montarDisenos(raiz: HTMLElement, gen: Generador) {
  raiz.innerHTML = `
    <h2>Diseño</h2>
    <p class="hint" data-r="sesion">Conectando…</p>
    <div data-r="form" hidden>
      <label>Nombre <input type="text" data-r="nombre" maxlength="120" /></label>
      <label>Pedido
        <input type="search" data-r="buscar" placeholder="Buscar cliente o detalle…" />
        <select data-r="pedido"><option value="">Sin pedido</option></select>
      </label>
      <div class="fila-ag">
        <button type="button" class="btn primary" data-r="guardar">Guardar</button>
        <button type="button" class="btn" data-r="nuevo">Guardar como nuevo</button>
        <button type="button" class="btn" data-r="abrir">Abrir…</button>
      </div>
      <p class="hint" data-r="estado"></p>
      <div data-r="lista" class="disenos-lista" hidden></div>
    </div>`
  const $ = <T extends HTMLElement>(r: string) =>
    raiz.querySelector(`[data-r="${r}"]`) as T
  const nombre = $<HTMLInputElement>('nombre')
  const pedido = $<HTMLSelectElement>('pedido')
  const buscar = $<HTMLInputElement>('buscar')
  const estado = $<HTMLParagraphElement>('estado')
  let actual: DesignRow | null = null
  let pedidos: { id: string; label: string }[] = []

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    $('sesion').innerHTML =
      'Para guardar diseños, <a href="/admin/login" target="_blank" rel="noopener">iniciá sesión en el admin</a> y volvé a cargar esta página. El generador funciona igual sin sesión.'
    return
  }
  $('sesion').hidden = true
  $('form').hidden = false

  const pintarPedidos = () => {
    const q = buscar.value.trim().toLowerCase()
    const sel = pedido.value || actual?.order_id || ''
    pedido.innerHTML =
      '<option value="">Sin pedido</option>' +
      pedidos
        .filter((o) => !q || o.label.toLowerCase().includes(q) || o.id === sel)
        .map((o) => `<option value="${o.id}">${esc(o.label)}</option>`)
        .join('')
    pedido.value = sel
  }
  buscar.addEventListener('input', pintarPedidos)
  try {
    pedidos = await listOpenOrders()
    pintarPedidos()
  } catch (e) {
    estado.textContent = `No se pudieron leer los pedidos: ${(e as Error).message}`
  }

  const mostrarActual = () => {
    $('guardar').textContent = actual ? 'Guardar cambios' : 'Guardar'
    $<HTMLButtonElement>('nuevo').hidden = !actual
    if (!actual) return
    const cuando = new Date(actual.updated_at).toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    estado.innerHTML =
      `Guardado ${cuando}` +
      (actual.order_id
        ? ` · <a href="/admin/orders/${actual.order_id}" target="_blank" rel="noopener">ver el pedido</a>`
        : '')
  }

  const guardar = async (comoNuevo: boolean) => {
    const n = nombre.value.trim() || gen.nombreSugerido()
    nombre.value = n
    for (const b of ['guardar', 'nuevo'])
      $<HTMLButtonElement>(b).disabled = true
    estado.textContent = 'Guardando…'
    try {
      let fila = await saveDesign({
        id: comoNuevo ? null : actual?.id,
        kind: gen.kind,
        name: n,
        params: gen.leer(),
        orderId: pedido.value || null,
        createdBy: operadorActual(),
      })
      estado.textContent = 'Subiendo archivos…'
      fila = await uploadDesignFiles(
        fila.id,
        await gen.archivos(),
        await gen.miniatura(),
      )
      actual = fila
      // La URL queda apuntando al diseño: se puede recargar o compartir
      history.replaceState(null, '', `?diseno=${fila.id}`)
      mostrarActual()
    } catch (e) {
      estado.textContent = `No se pudo guardar: ${(e as Error).message}`
    } finally {
      for (const b of ['guardar', 'nuevo'])
        $<HTMLButtonElement>(b).disabled = false
    }
  }
  $('guardar').addEventListener('click', () => guardar(false))
  $('nuevo').addEventListener('click', () => guardar(true))

  const abrir = async (id: string) => {
    estado.textContent = 'Abriendo…'
    try {
      const d = await getDesign(id)
      if (!d) {
        estado.textContent = 'Ese diseño ya no existe.'
        return
      }
      actual = d
      nombre.value = d.name
      pintarPedidos()
      pedido.value = d.order_id ?? ''
      await gen.aplicar(d.params)
      history.replaceState(null, '', `?diseno=${d.id}`)
      $('lista').hidden = true
      mostrarActual()
    } catch (e) {
      estado.textContent = `No se pudo abrir: ${(e as Error).message}`
    }
  }

  // Lista de los últimos diseños de este generador
  $('abrir').addEventListener('click', async () => {
    const lista = $('lista')
    if (!lista.hidden) {
      lista.hidden = true
      return
    }
    lista.hidden = false
    lista.textContent = 'Cargando…'
    try {
      const filas = await listRecentDesigns(gen.kind)
      if (!filas.length) {
        lista.textContent = 'Todavía no hay diseños guardados.'
        return
      }
      const nombrePedido = (id: string | null) =>
        pedidos.find((o) => o.id === id)?.label.split(' · ')[0]
      lista.innerHTML = filas
        .map(
          (d) => `<div class="disenos-fila">
            <button type="button" class="disenos-abrir" data-id="${d.id}"><b>${esc(d.name)}</b>
              <span>${new Date(d.updated_at).toLocaleDateString('es-AR')}${d.order_id ? ` · ${esc(nombrePedido(d.order_id) ?? 'con pedido')}` : ''}</span></button>
            <button type="button" class="disenos-borrar" data-id="${d.id}" aria-label="Borrar ${esc(d.name)}">✕</button>
          </div>`,
        )
        .join('')
      lista
        .querySelectorAll<HTMLButtonElement>('.disenos-abrir')
        .forEach((b) => b.addEventListener('click', () => abrir(b.dataset.id!)))
      lista
        .querySelectorAll<HTMLButtonElement>('.disenos-borrar')
        .forEach((b) =>
          b.addEventListener('click', async () => {
            const d = filas.find((x) => x.id === b.dataset.id)
            if (!d || !confirm(`¿Borrar el diseño "${d.name}" y sus archivos?`))
              return
            await deleteDesign(d)
            if (actual?.id === d.id) {
              actual = null
              history.replaceState(null, '', location.pathname)
              mostrarActual()
              estado.textContent = 'Diseño borrado.'
            }
            b.closest('.disenos-fila')?.remove()
          }),
        )
    } catch (e) {
      lista.textContent = `No se pudo leer la lista: ${(e as Error).message}`
    }
  })

  mostrarActual()
  const url = new URLSearchParams(location.search)
  const id = url.get('diseno')
  if (id) await abrir(id)
  else if (url.get('pedido')) {
    // Llegó desde el pedido del admin ("Nueva letra caja")
    pedido.value = url.get('pedido')!
    if (pedido.value)
      estado.textContent = 'Se va a guardar en el pedido elegido.'
  }
}
