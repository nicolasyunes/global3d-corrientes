// Llavero con logo — Global3D (prototipo)
// Paramétrico para OpenSCAD / OpenSCAD Playground.
// El logo se importa de logo.svg (formas rellenas; los trazos sin relleno no se importan).

/* [Logo] */
// Archivo SVG del logo
logo_file = "logo.svg";
// Ancho del logo (mm)
logo_ancho = 30; // [10:1:80]
// Proporción alto/ancho del logo (la calcula la página al subir el SVG)
logo_aspecto = 1; // [0.1:0.01:5]

/* [Texto] */
// Texto debajo del logo (vacío = sin texto)
texto = "GLOBAL3D";
// Altura de las letras (mm)
tam_texto = 6; // [3:0.5:14]
fuente = "Liberation Sans:style=Bold";
// Espacio entre logo y texto (mm)
separacion = 3; // [0:0.5:10]

/* [Base] */
forma = "redondeada"; // [redondeada, circulo, contorno]
// Espesor de la base (mm)
espesor_base = 3; // [1.2:0.2:6]
// Margen alrededor del logo y el texto (mm)
margen = 3; // [1:0.5:10]
// Radio de las esquinas (solo forma redondeada)
radio_esquinas = 4; // [0:0.5:15]

/* [Relieve] */
// relieve = sobresale de la base; a_ras = incrustado a nivel (ideal multicolor)
modo = "relieve"; // [relieve, a_ras]
// Altura del relieve o profundidad del incrustado (mm)
alto_relieve = 1; // [0.2:0.2:3]

/* [Argolla] */
posicion_argolla = "arriba"; // [arriba, izquierda]
// Diámetro del agujero (mm)
agujero = 5; // [3:0.5:10]
// Pared alrededor del agujero (mm)
pared_argolla = 2.5; // [1.5:0.5:5]

/* [Exportación] */
// Para exportar STL por separado (multicolor): base o relieve
parte = "todo"; // [todo, base, relieve]
color_base = "#1b1b1b";
color_relieve = "#f9d72c";

/* [Hidden] */
$fn = 64;
hay_texto = len(texto) > 0;
logo_alto = logo_ancho * logo_aspecto;
// OpenSCAD no mide texto de forma estable: estimación para Liberation Sans Bold
// en mayúsculas (size ≈ altura de ascenso, no em; por eso el factor ~0.95)
texto_ancho = hay_texto ? len(texto) * tam_texto * 0.95 : 0;
contenido_ancho = max(logo_ancho, texto_ancho);
contenido_alto = logo_alto + (hay_texto ? separacion + tam_texto : 0);
logo_y = contenido_alto / 2 - logo_alto / 2;
base_ancho = contenido_ancho + 2 * margen;
base_alto = contenido_alto + 2 * margen;
diam_circulo = sqrt(pow(contenido_ancho, 2) + pow(contenido_alto, 2)) + 2 * margen;
argolla_d = agujero + 2 * pared_argolla;

arriba = posicion_argolla == "arriba";
dir = arriba ? [0, 1] : [-1, 0];
// Distancia del centro al borde de la base en la dirección de la argolla
borde =
  forma == "circulo" ? diam_circulo / 2
  : forma == "contorno" ? (arriba ? contenido_alto / 2 : logo_ancho / 2) + margen
  : (arriba ? base_alto / 2 : base_ancho / 2);
// En contorno + izquierda la argolla se alinea con el logo, no con el centro
eje = (forma == "contorno" && !arriba) ? [0, logo_y] : [0, 0];
pos_argolla = eje + dir * (borde + agujero / 2 + 0.6);

module logo2d()
  translate([0, logo_y]) resize([logo_ancho, logo_alto]) import(logo_file, center = true);

module texto2d()
  if (hay_texto)
    translate([0, -contenido_alto / 2 + tam_texto / 2])
      text(texto, size = tam_texto, font = fuente, halign = "center", valign = "center");

module arte2d() { logo2d(); texto2d(); }

module forma2d() {
  if (forma == "circulo")
    circle(d = diam_circulo);
  else if (forma == "contorno") {
    // Cierre morfológico en el logo (tapa huecos chicos) y cápsula lisa detrás del texto
    cierre = 2;
    offset(r = margen) {
      offset(r = -cierre) offset(delta = cierre) logo2d();
      hull() texto2d();
    }
  } else
    offset(r = radio_esquinas) offset(delta = -radio_esquinas)
      square([base_ancho, base_alto], center = true);
}

module base2d()
  difference() {
    union() {
      forma2d();
      // Lengüeta: se hunde hacia la base para quedar siempre unida
      hull() {
        translate(pos_argolla) circle(d = argolla_d);
        translate(pos_argolla - dir * argolla_d) circle(d = argolla_d);
      }
    }
    translate(pos_argolla) circle(d = agujero);
  }

module base3d()
  color(color_base)
    difference() {
      linear_extrude(espesor_base) base2d();
      if (modo == "a_ras")
        translate([0, 0, espesor_base - alto_relieve])
          linear_extrude(alto_relieve + 0.01) arte2d();
    }

module relieve3d()
  color(color_relieve)
    translate([0, 0, modo == "relieve" ? espesor_base : espesor_base - alto_relieve])
      linear_extrude(alto_relieve) arte2d();

if (parte != "relieve") base3d();
if (parte != "base") relieve3d();
