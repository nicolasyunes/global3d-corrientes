# Estilos de letra caja — especificación propia

Base de diseño para el generador de `letra-caja.html`. Surge de estudiar los
13 estilos de LetraMaker (plan Maker, 06/10/2026): parámetros visibles en su
interfaz y medición por cortes de los STL/DXF que exporta, con un SVG de prueba
(anillo con hueco + barra). No se usó su código. Nombres, valores por defecto y
mejoras son nuestros.

## Convenciones medidas (comunes a todos los estilos)

| Qué | Valor que usan | Nota para el nuestro |
|---|---|---|
| Pared exterior | 2 mm (1–5) | igual |
| Pared interior (segunda pared que forma escalón) | 2 mm (0–5) | igual |
| Holgura de encaje | **0,1 mm por lado**, la misma en todos los contactos | la nuestra es **por contacto** y arranca en 0,2 (calibrar) |
| Acrílico | 3,1 mm (chapa de 3 + 0,1) | igual; en los nuestros el frente también puede ser impreso |
| Apoyos inclinados | 1 mm de ancho, 30° (25–60°) | reemplaza al escalón de 3 pasos que usamos hoy |
| Piezas superpuestas | exportan cuerpos que se tocan sin unir (el slicer los fusiona) | nosotros los unimos con manifold: un cuerpo por pieza |
| Archivos | ZIP: STL "archivo único" + "piezas separadas", DXF para corte | nosotros: 3MF con piezas nombradas + STL + DXF |

Orientación de impresión: **el frente va sobre la cama** en todos los estilos de
frente impreso. La cara visible sale lisa y la letra se cierra por atrás. Es al
revés de nuestro prototipo actual (tapa al frente) y conviene adoptarlo.

## Estilos

Perfil = corte de la pared, desde el frente (z = 0) hacia atrás.

### 1. Frente acrílico · fondo impreso
- **Piezas:** cuerpo impreso (fondo + paredes) · frente de acrílico (DXF).
- **Perfil:** fondo 2 · pared doble (ext 2 + int 2) hasta `alto − acrílico` · solo la pared exterior en el último tramo, que forma el **rebaje** donde apoya el acrílico al ras.
- **Parámetros:** espesor fondo 2 (0,5–20) · pared ext 2 · pared int 2 · alto pared 35 · acrílico 3,1.
- **Extra:** DXF de "base LED" (placa para montar los módulos).

### 2. Frente acrílico · fondo calado
- Igual que el 1 pero **sin fondo impreso**: atrás cierra una placa de PVC cortada (DXF), que apoya en el mismo tipo de rebaje.
- **Piezas:** cuerpo (solo paredes) · acrílico · PVC.

### 3. Frente acrílico · apoyo doble
- **Piezas:** cuerpo (pared exterior sola) · acrílico al frente · PVC atrás.
- **Perfil:** pared exterior 2 a todo el alto (45). Dos **apoyos inclinados** interiores: uno sostiene el PVC a 3 mm del borde trasero y otro el acrílico a 3 mm del frente.
- **Parámetros:** acrílico 3 · PVC 3 · pared ext 2 · alto 45 (10–150) · ancho de apoyos 1 (0,5–5) · ángulo de apoyos 30° (25–60).

### 4. Frente acrílico · apoyo único
- Como el 3 con **fondo impreso** (2 mm) en vez de PVC. Un solo apoyo inclinado para el acrílico.

### 5. Frente acrílico · ajuste trasero
- El acrílico entra **desde atrás** y apoya en un **reborde frontal** (marco de 0,5 mm de ancho y 1 mm de espesor, más las dos paredes).
- **Perfil:** reborde frontal 1 · pared doble hasta ≈25 · pared exterior sola en los últimos 10, que alojan un PVC grueso (10 mm) que cierra atrás.
- **Parámetros:** ancho del reborde 0,5 (0–10) · espesor del reborde 1 · paredes 2/2 · alto 35 · PVC 10 (0–50).

### 6. Retroiluminada (halo)
- **Una pieza:** caja con el **frente cerrado** (2 mm) y la **parte de atrás abierta**. El LED ilumina la pared donde se monta y la letra queda recortada contra el halo.
- **Perfil:** frente 2 · pared 4 (1–12) · alto 50 (5–80).
- Para el nuestro hacen falta separadores, que dejan la letra a 20–40 mm de la pared.

### 7. Frente acrílico · encastre
- **Piezas:** marco impreso · acrílico · tapa trasera con pollera.
- **Marco:** reborde frontal 1 × (ancho de borde 2 + pared 2) que sostiene el acrílico desde adelante · pared exterior 2 a todo el alto.
- **Tapa:** fondo 1 · pollera de 2 mm que entra por dentro de la pared con holgura 0,1 por lado. El alto de la pollera es `alto − 2·espesor − reducción` (≈20).
- **Parámetros:** acrílico 3,1 · ancho de borde 2 · espesor de borde 1 · pared ext 2 · alto 45 · rebaje de pared ext 0 (0–50) · pared int 2 · holgura 0,1 (0–2) · fondo 1 · **reducción de pared interior 20** (cuánto más corta es la pollera).

### 8. Frente impreso · encastre ← el más cercano a nuestro prototipo
- **Piezas:** frente + paredes (una pieza, el frente sobre la cama) · tapa trasera con pollera.
- **Perfil frontal:** frente 2 · pared exterior 2 hasta 45.
- **Tapa:** fondo 1 · pollera 2 × 22,8 de alto, holgura 0,1 por lado.
- **Parámetros:** espesor del frente 2 · pared ext 2 · alto 45 · pared int (pollera) 2 · holgura 0,1 · rebaje 0 · fondo 1 · reducción de pared interior 20.
- **Para el LED:** el frente impreso actúa como difusor (1,2–2 mm en PLA blanco o natural). La tapa trasera es la que se saca para instalar.

### 9. LED doble
- Fondo impreso 2 · pared doble · **una segunda pared interior** paralela al contorno, a 10 mm (1–30) y de 2 mm de espesor. Forma dos canales para tiras LED (borde e interior) y una luz más pareja en letras anchas · rebaje para acrílico 3,1 al frente.

### 10. Letra curva
- La letra se **barre en un arco** (60°, radio 60, centro de rotación 120 mm, 128 segmentos) sobre una base con esquinas redondeadas. Es un objeto decorativo de escritorio, no un cartel de pared. Frente de acrílico opcional.
- **Cómo se arma** (visto en su vista 3D y verificado con las medidas): el eje es **horizontal y paralelo a la línea del texto**. La palabra arranca acostada sobre la base, con el pie de la letra a radio + centro (180 mm) del eje, y sube en arco hacia atrás. Cada trazo vertical queda como una aleta curva. Con un texto de 260 × 100: alto = 280 · sen 60° + base 10 = 252,5 mm ✓.
- Base: espesor 10, margen a los costados 20, margen atrás 15, avance frontal 0, esquinas redondeadas 5.
- Exporta una sola pieza unida (no separada).

### 11. Calado paramétrico
- Frente impreso fino (1 mm) **perforado con un patrón**: forma del agujero (círculo…), disposición (rejilla triangular…), diámetro 3 (1–8), espaciado 1,5 (0,5–5), rotación, degradado orgánico opcional. La luz sale por los agujeros.
- Paredes 2/2 · alto 35 · PVC atrás 3,1 (expandido).

### 12. Neón LED (canal)
- Perfil bajo (≈8 mm): fondo 1,2 · paredes 1,2 · alto 7 (1–60). El canal es la forma de la letra (para trazos) o su contorno, en *modo contorno*.
- **Traba:** reborde interior de 0,8 de profundidad y 1,5 de alto, ubicado a 5 mm del fondo, que retiene la manguera de neón a presión.

### 13. Orgánica
- La **pared exterior tiene relieve**, con una plantilla de perfil: zigzag estriado, ondas, perlas… Amplitud 3 (0,5–15), período 10, inclinación, ángulo máximo 45° (para imprimir sin soportes).
- Cuerpo 30 · pared 2 · acrílico 3 con holgura 0,15 · apoyo inclinado 1 mm a 45° · fondo 2.

## Qué hacemos distinto

1. **Frente siempre imprimible:** cada estilo de acrílico tiene variante con frente impreso en 3D (difusor), además del DXF para el acrílico tercerizado.
2. **Tolerancia por contacto:** pollera ↔ pared, frente ↔ rebaje, acrílico ↔ marco, PVC ↔ apoyo y agujeros, cada una con su valor. Ellos usan una sola.
3. **Piezas unidas:** un cuerpo cerrado por pieza (manifold), no cuerpos superpuestos.
4. **Agujeros opcionales** de cable y de tornillo, con su tolerancia.
5. **3MF** con nombres de pieza y color.

## Orden de implementación (hecho)

1. ✅ *Frente impreso · tapa trasera*, como el medido: frente en la cama y tapa trasera con pollera. Se mantienen "tapa al frente" y "al ras".
2. ✅ Apoyos inclinados (ancho + ángulo) como pieza común: "al ras", orgánica y traba del neón.
3. ✅ *Frente acrílico · fondo impreso* (1) y *encastre* (7), con el DXF del acrílico y la holgura aplicada. En encastre, la pollera llega al frente y lo aprieta (mejora sobre el medido).
4. ✅ *Retroiluminada* (6), con torres ciegas para espárrago y separadores impresos.
5. ✅ *LED doble* (9) y *calado* (11). Calado con fondo impreso o PVC (DXF con agujeros).
6. ✅ *Neón* (12), con traba plana abajo e inclinada arriba; *orgánica* (13), con zigzag, ondas o serrucho y aviso de voladizo; y *curva* (10), extrusión en arco con base.

7. ✅ **Tres piezas: contorno · frente · base**. Son los estilos de ellos que llevan acrílico adelante y PVC atrás. En los nuestros la base también se imprime en 3D (por defecto) o sale en DXF para cortarla en PVC. Lo mismo vale para el frente.
   - *Frente y base al ras* (2, fondo hueco): pared doble con un rebaje en cada punta.
   - *Apoyo doble* (3): solo pared exterior, con un apoyo inclinado para cada placa.
   - *Ajuste trasero* (5): reborde frontal, y el frente entra por atrás dentro de la pared interior. Se imprime con el reborde en la cama.
   - El calado usa el mismo control de base (antes compartía el del frente).
   - Hay un DXF por placa (frente → acrílico, base → PVC), con una capa por letra.
8. ✅ *Curva* rehecha: el eje pasa a ser horizontal (antes era vertical y las letras se pisaban). Se agregan el avance frontal y el redondeo de la base, y avisos de soportes (arco > 50°) y de tamaño de cama.

Pendientes: estilo 4 (apoyo único con fondo impreso), plantilla de perforación para la halo y acentos unidos a su letra. El corte automático de letras grandes queda descartado: alcanza con separar en piezas.
