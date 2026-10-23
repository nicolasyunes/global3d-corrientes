import { strToU8, zipSync } from 'fflate'
import type { Parte } from './mesh'
import type { Impresora } from './printers'
import { IMPRESORA_DEFAULT } from './printers'

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const n4 = (v: number) => String(Math.round(v * 1e4) / 1e4)

export interface Opciones3mf {
  partes: Parte[]
  // hex color per filament slot (slot 1 = first)
  colores: string[]
  // filament slot (1-based) for each part
  extrusorDe: number[]
  titulo: string
  ancho: number
  alto: number
  impresora?: Impresora
  capa?: number
}

// 3MF that Bambu Studio opens as a project: one object per color with its
// filament, centered on the bed of the chosen printer.
export function build3mf(o: Opciones3mf): Uint8Array {
  const capa = o.capa ?? 0.2
  const im = o.impresora ?? IMPRESORA_DEFAULT
  const cama = im.cama
  const tx = cama[0] / 2 - o.ancho / 2
  const ty = cama[1] / 2 - o.alto / 2
  const pid = 1
  const parentId = o.partes.length + 2
  const bases = o.colores
    .map(
      (c, i) =>
        `<base name="Filamento ${i + 1}" displaycolor="${c.toUpperCase()}FF"/>`,
    )
    .join('')
  const objs = o.partes
    .map((p, i) => {
      const v: string[] = []
      const t: string[] = []
      for (let k = 0; k < p.pos.length; k += 3) {
        v.push(
          `<vertex x="${n4(p.pos[k])}" y="${n4(p.pos[k + 1])}" z="${n4(p.pos[k + 2])}"/>`,
        )
      }
      for (let k = 0; k < p.tri.length; k += 3) {
        t.push(
          `<triangle v1="${p.tri[k]}" v2="${p.tri[k + 1]}" v3="${p.tri[k + 2]}"/>`,
        )
      }
      return `<object id="${i + 2}" type="model" name="${esc(p.nombre)}" pid="${pid}" pindex="${o.extrusorDe[i] - 1}"><mesh><vertices>${v.join('')}</vertices><triangles>${t.join('')}</triangles></mesh></object>`
    })
    .join('')
  const comps = o.partes
    .map((_, i) => `<component objectid="${i + 2}"/>`)
    .join('')
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="es-AR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${esc(o.titulo)}</metadata><metadata name="Application">BambuStudio-01.07.04.52</metadata><resources><basematerials id="${pid}">${bases}</basematerials>${objs}<object id="${parentId}" type="model" name="${esc(o.titulo)}"><components>${comps}</components></object></resources><build><item objectid="${parentId}" transform="1 0 0 0 1 0 0 0 1 ${n4(tx)} ${n4(ty)} 0" printable="1"/></build></model>`

  const parts = o.partes
    .map(
      (p, i) =>
        `<part id="${i + 2}" subtype="normal_part"><metadata key="name" value="${esc(p.nombre)}"/><metadata key="extruder" value="${o.extrusorDe[i]}"/></part>`,
    )
    .join('')
  const modelCfg = `<?xml version="1.0" encoding="UTF-8"?><config><object id="${parentId}"><metadata key="name" value="${esc(o.titulo)}"/><metadata key="extruder" value="${o.extrusorDe[0] ?? 1}"/><metadata key="layer_height" value="${capa}"/><metadata key="wall_generator" value="arachne"/>${parts}</object><plate><metadata key="plater_id" value="1"/><model_instance><metadata key="object_id" value="${parentId}"/><metadata key="instance_id" value="0"/><metadata key="identify_id" value="1"/></model_instance></plate><assemble><assemble_item object_id="${parentId}" instance_id="0" offset="0 0 0"/></assemble></config>`

  const cols = [...o.colores]
  while (cols.length < 2) cols.push('#FFFFFF')
  const proj = JSON.stringify(
    {
      layer_height: String(capa),
      initial_layer_print_height: String(capa),
      curr_bed_type: 'Textured PEI Plate',
      filament_colour: cols,
      filament_diameter: cols.map(() => '1.75'),
      filament_type: cols.map(() => 'PLA'),
      filament_settings_id: cols.map(() => im.perfilFilamento),
      print_settings_id: im.perfilProceso,
      printer_settings_id: im.perfilImpresora,
      printer_model: im.modelo,
      printer_variant: '0.4',
      nozzle_diameter: ['0.4'],
      printable_area: [
        '0x0',
        `${cama[0]}x0`,
        `${cama[0]}x${cama[1]}`,
        `0x${cama[1]}`,
      ],
      printable_height: String(im.alturaMaxima),
    },
    null,
    2,
  )

  const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`
  return zipSync(
    {
      '[Content_Types].xml': strToU8(ct),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
      'Metadata/model_settings.config': strToU8(modelCfg),
      'Metadata/project_settings.config': strToU8(proj),
    },
    { level: 6 },
  )
}
