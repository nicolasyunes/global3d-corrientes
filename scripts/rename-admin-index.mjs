// En producción el admin se sirve desde dist/taller.html y no desde
// dist/index.html. Vercel sirve primero los archivos que existen y recién
// después aplica las reglas de vercel.json: con un index.html en la raíz,
// www.global3d.com.ar/ mostraba el admin en vez de la tienda. Sin ese
// archivo, vercel.json decide por dominio (tienda en global3d.com.ar,
// admin en el resto) y sirve taller.html para el admin.

import { renameSync } from 'node:fs'

renameSync('dist/index.html', 'dist/taller.html')
