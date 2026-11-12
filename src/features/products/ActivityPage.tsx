import ProductActivity from './ProductActivity'
import './products.css'

// `/admin/actividad`: quién creó o cambió productos y movió stock, y cuándo.
// Antes estaba al pie de la lista de productos.
export default function ActivityPage() {
  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Productos y stock</p>
          <h1 className="page-title">Actividad</h1>
          <p className="muted">
            Lo último que se hizo con los productos: altas, cambios en las
            fichas y movimientos de stock, con quién y cuándo.
          </p>
        </div>
      </div>
      <ProductActivity limit={50} pageable title="Últimos movimientos" />
    </>
  )
}
