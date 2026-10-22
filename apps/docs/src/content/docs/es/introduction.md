---
title: "Introducción"
description: "Efectos con GPU para tu HTML. Conserva tu contenido y añade efectos a sus bordes."
---

domfx añade efectos con GPU al borde de la forma visible de un elemento del DOM. El texto
sigue siendo seleccionable, los botones conservan sus controladores de eventos y los enlaces
siguen funcionando. El efecto se dibuja en un canvas separado junto al contenido original.

> domfx es experimental. El ámbito de paquetes @domfx ya está elegido, pero los paquetes
> aún no se han publicado. Comienza con el [proceso de instalación local](/docs/es/installation).

<span id="start-with-your-element"></span>

## Comienza con tu elemento

Elige el **elemento objetivo** exacto: texto, un SVG en línea, una imagen transparente,
un botón o una tarjeta. La captura de su apariencia determina la **forma visible** (silueta),
incluidos los huecos y las partes separadas. Una imagen opaca produce un rectángulo;
la transparencia define el borde. Seleccionar un contenedor captura la apariencia conjunta de su contenido.

Elige un **contenedor del efecto** (`host`) con CSS `position: relative` que contenga
el objetivo. domfx añade allí la salida decorativa, sin envolver, mover ni reemplazar
tu contenido.

<span id="start-with-gsap"></span>

## Comienza con GSAP

Si ya usas GSAP, sigue la [guía completa de GSAP](/docs/es/gsap): aplica un efecto
a tu propio encabezado, anímalo con una línea de tiempo que controles, avanza o
retrocede en ella y registra una función de limpieza. El encabezado sigue siendo HTML real y
seleccionable. Primero [instala artefactos compatibles](/docs/es/installation);
la instalación pública desde npm llegará después de una publicación alfa verificada.

<span id="control-animation"></span>

## Controla la animación

- [Uso independiente](/docs/es/standalone): usa animación automática o controla
  el tiempo del efecto con tu código.
- [GSAP](/docs/es/gsap): anima un efecto con tu propia línea de tiempo. Anima el
  tiempo y la intensidad junto con el resto de tu secuencia.

<span id="choose-an-effect"></span>

## Elige un efecto

Elige entre Electricity, Frost, Fire, Slime, Burned paper, Kinetic bloom y los
efectos de patrón de la [galería de efectos](/es/effects/). Cada función devuelve
el mismo `EffectHandle` con controles de tiempo, intensidad, actualización de
captura y liberación de recursos. Consulta los [efectos disponibles](/docs/es/api#available-effects)
para ver el nombre de cada importación.

La [guía de uso independiente](/docs/es/standalone#attach-fire) usa Fire en su
ejemplo interactivo. Sus controles de intensidad y reproducción se aplican a todos
los efectos. `flameHeight` es exclusivo de Fire; omítelo al usar otra función.

<span id="keep-the-original-usable"></span>

## Mantén utilizable el contenido original

El efecto es una decoración opcional. Si falta WebGPU, se solicita movimiento
reducido o la captura no es compatible, el DOM original sigue disponible.
Consulta el estado y el código del motivo, y libera el efecto cuando desaparezca
la página o el componente.

Consulta la [referencia de la API](/docs/es/api) para conocer el contrato público,
la [compatibilidad con navegadores](/docs/es/support) para los límites medidos y
[solución de problemas](/docs/es/troubleshooting) si el efecto no se muestra.
