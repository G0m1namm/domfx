---
title: "Compatibilidad con navegadores"
description: "Navegadores probados y límites de captura, colocación y efectos."
---

domfx necesita WebGPU en un contexto seguro, como HTTPS o localhost. Cuando un
efecto no puede dibujarse, el contenido original sigue visible e interactivo.

Los [21 efectos](/docs/es/api#available-effects) comparten los límites de captura
y colocación descritos abajo. Las pruebas de navegador no establecen la misma
cobertura visual o de rendimiento para todos los efectos.

<span id="measured-environments"></span>

## Entornos medidos

El **registro de compatibilidad v1, del 2026-09-16 UTC**, cubre Chromium
153.0.8010.12 y una prueba más limitada de Chrome 152.0.7977.83 en macOS 26.6.2,
Apple M5 Pro, con WebGPU nativo mediante Metal. Incluye captura, colocación,
renderizado de Fire, interacción original y liberación de recursos. También hay
pruebas de tipos, importaciones SSR y GPU en aplicaciones Vite con los paquetes
de uso independiente y GSAP instalados desde archivos tar.

Son entornos probados, no versiones mínimas compatibles. Consulta el
[registro versionado](https://github.com/G0m1namm/domfx/blob/afcfd626eea273d7881048eb03b21973e10cce40/engineering/browser-support.md)
para ver los casos y las mediciones exactos.

<span id="untested-coverage"></span>

## Cobertura sin probar

Ese registro no ofrece cobertura suficiente de Safari, Firefox, Edge, dispositivos
móviles, GPU de Windows/Linux, otras GPU de macOS, densidades de píxeles
fraccionarias, otros empaquetadores ni pérdida física del dispositivo.
Sin probar no significa incompatible.

Se han comprobado los controles nativos, el foco, la selección de texto y la
semántica del canvas decorativo. No es una auditoría de tecnologías de asistencia
ni una garantía de frecuencia de fotogramas, uso de memoria GPU o rendimiento
en sesiones largas.

<span id="capture-and-composition-limits"></span>

## Límites de captura y composición

El efecto usa una instantánea del elemento objetivo. PNG, JPEG, WebP, el `currentSrc`
seleccionado, los fondos CSS compatibles y las fuentes incrustables dependen de
que los recursos estén listos y de CORS. Se aceptan más formatos de los que cubren
los recursos probados.

- Se rechazan imágenes SVG externas y referencias a imágenes SVG, vídeo, `iframe`,
  `object`, `embed`, raíces abiertas de Shadow DOM, `image-set()` y propiedades
  visuales con URL, como las máscaras. Los trazados SVG en línea son distintos
  de las imágenes SVG externas.
- La traslación y las escalas positivas alineadas con los ejes tienen verificación
  limitada. Se rechazan rotación, inclinación, perspectiva, escala cero o negativa
  y zoom CSS.
- Los ancestros HTML posicionados entre el objetivo y el contenedor del efecto
  pueden tener recortes rectangulares por desbordamiento. Se rechazan recortes
  redondeados, `clip-path`, máscaras, contención de pintura, `overflow: clip` e
  intermediarios con posición fija. No están establecidos el apilamiento arbitrario,
  el contenido en la capa superior ni la composición mediante Shadow DOM y `slot`.
- El canvas separado no puede reproducir opacidad distinta de 1, filtros, filtros
  de fondo ni modos de mezcla del objetivo o sus intermediarios. Aplica los efectos
  de grupo al contenedor del efecto o a sus ancestros para que afecten al subárbol
  compartido.
- Las sombras grandes o el contenido desbordado pueden exceder el margen de captura.
  Usa un contenedor del efecto explícito y un apilamiento compatible; la fidelidad
  de captura tiene límites.

<span id="when-an-effect-is-unavailable"></span>

## Cuando un efecto no está disponible

Consulta `effect.reason` y `effect.reasonDetail`, corrige la condición y
[reintenta explícitamente](/docs/es/troubleshooting#recover-explicitly). La preferencia
de movimiento reducido suprime la salida de forma predeterminada; elige
`motion: 'static'` al crear el efecto para una decoración inmóvil. Consulta
[movimiento reducido](/docs/es/api/shared#reduced-motion).

<span id="source-and-feedback-access"></span>

## Acceso al código y comentarios

El [repositorio del código](https://github.com/G0m1namm/domfx) es público.
[Informa de un problema](https://github.com/G0m1namm/domfx/issues) con un ejemplo
mínimo reproducible, versiones de paquetes, navegador y dispositivo, y el motivo
informado. Consulta la [política de seguridad](https://github.com/G0m1namm/domfx/blob/main/SECURITY.md)
para comunicar problemas de seguridad.
