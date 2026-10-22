---
title: "Compatibilidad del navegador"
description: "Entornos medidos, límites de captura y cobertura sin probar."
---

Este resumen usa el **registro de compatibilidad v1, 2026-09-16 UTC**. Una prueba
superada se aplica al entorno, las pruebas y la versión del código que allí se
indican. No establece una versión mínima del navegador, compatibilidad con una
familia de navegadores ni aprobación de publicación.

Todos los [efectos disponibles](/docs/es/api#available-effects) comparten los
límites de captura, colocación y composición descritos abajo. El registro
histórico incluye pruebas de Fire; no establece la misma cobertura visual o de
rendimiento para todos los efectos. La guía de uso independiente usa Fire como
ejemplo de la API compartida, y las vistas previas interactivas de las referencias
son demostraciones, no evidencia de verificación.

<span id="measured-environments"></span>

## Entornos medidos

- **Chromium 153.0.8010.12**, macOS 26.6.2 en el Apple M5 Pro medido, WebGPU
  nativo mediante Apple Metal 3: se superaron 386 casos de desarrollo y producción
  sin omisiones ni reintentos. Ventana de 1280 × 900, DPR 2; captura, galería,
  colocación y desplazamiento también tienen cobertura con DPR 1. Las pruebas de
  renderizado positivo desactivaron movimiento reducido.
- **Chrome 152.0.7977.83** en ese equipo: se superó una prueba de producción más
  limitada de captura, SDF, Fire determinista, interacción con el botón original
  y liberación a 1280 × 720, DPR 2. No equivale a la suite completa de Chromium.
- **Consumidores Vite empaquetados**: el registro versionado contiene resultados
  de tipos estrictos, importaciones SSR, salida GPU real y ciclo de vida de
  consumidores independientes y GSAP instalados desde archivos tar. Esto no
  establece compatibilidad con otros empaquetadores.

El adaptador informado por el navegador es `apple / metal-3`; los campos de
dispositivo y descripción estaban vacíos. No se infiere una identidad de
dispositivo más amplia de esos campos.

<span id="untested-coverage"></span>

## Cobertura sin probar

Safari, Firefox, Edge, dispositivos móviles, GPU nativas de Windows/Linux, otras
GPU de macOS, DPR fraccionario, otros empaquetadores y la pérdida física del
dispositivo carecen de cobertura suficiente fuera del alcance explícito del
registro. SIN PROBAR significa que no hay una observación válida, no que se haya
superado una prueba ni que exista incompatibilidad.

Las pruebas de ciclo de vida accesible cubren entrada nativa, foco, selección
de texto y semántica del canvas decorativo. No son una auditoría de VoiceOver,
NVDA ni otra tecnología de asistencia. Las mediciones históricas de rendimiento
tienen pruebas fijas propias; no establecen garantías de frecuencia de fotogramas,
VRAM total ni sesiones largas.

<span id="capture-and-composition-limits"></span>

## Límites de captura y composición

La captura del objetivo es una instantánea. PNG/JPEG/WebP, el `currentSrc`
seleccionado, fondos CSS compatibles y fuentes incrustables siguen dependiendo
de que los recursos estén listos y de CORS. Las pruebas de recursos medidas son
más limitadas que los formatos aceptados. Se rechazan documentos y referencias
de imagen SVG, vídeo, iframe/object/embed, raíces shadow abiertas, `image-set()`
y otras pinturas con URL como máscaras. Las rutas SVG en línea dentro del
documento son distintas de las imágenes SVG externas.

La traslación y las escalas positivas alineadas con los ejes tienen verificación
limitada. Se rechazan rotación, inclinación, perspectiva, escala cero o negativa
y zoom CSS. Los ancestros HTML intermedios con posición pueden tener recortes
rectangulares de overflow; se rechazan recortes redondeados, clip paths,
máscaras, contención de pintura, `overflow: clip` e intermediarios fijos.
No están establecidos el apilamiento arbitrario, la capa superior ni la
composición de shadow/slot.

La opacidad del objetivo o de un intermediario distinta de 1, los filtros, los
filtros de fondo y los modos de mezcla no pueden reproducirse en el canvas
separado. Los efectos aplicados al contenedor y grupos externos actúan de forma
nativa sobre el subárbol compartido. Usa un contenedor explícito y un apilamiento
compatible. Overflow o sombras grandes pueden exceder el margen de captura;
no infieras fidelidad de pintura ilimitada a partir de las pruebas medidas.

<span id="when-an-effect-is-unavailable"></span>

## Cuando un efecto no está disponible

El DOM original conserva el contenido y la interacción. El movimiento reducido
suprime de forma predeterminada la salida animada. Consulta el código de motivo
y usa la [recuperación explícita](/docs/es/troubleshooting) después de corregir
la condición.

El [registro versionado de navegador y dispositivo](https://github.com/G0m1namm/domfx/blob/afcfd626eea273d7881048eb03b21973e10cce40/engineering/browser-support.md)
conserva toda la evidencia de pruebas, accesibilidad, rendimiento y cobertura
faltante. Los enlaces al código requieren acceso mientras el repositorio sea privado.

<span id="source-and-feedback-access"></span>

## Acceso al código y comentarios

El repositorio es privado actualmente. Los enlaces al código en GitHub requieren
acceso hasta que el mantenedor lo abra para la versión alfa; las guías de este
sitio siguen siendo legibles localmente. Después del lanzamiento, informa de un
caso pequeño reproducible con versiones, entorno y código de motivo mediante
GitHub Issues. Envía los informes de seguridad por el canal privado de informes.
