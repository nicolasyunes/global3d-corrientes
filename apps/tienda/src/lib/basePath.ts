// La tienda se sirve en /tienda (global3d-corrientes.vercel.app/tienda) y en
// la raíz del dominio propio (global3d.com.ar, ver vercel.json). Los archivos
// siempre viven bajo /tienda/; lo que cambia es la base de las rutas.

export function shopBase(pathname: string): '' | '/tienda' {
  return pathname === '/tienda' || pathname.startsWith('/tienda/')
    ? '/tienda'
    : ''
}
