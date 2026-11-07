---
title: "Actualización"
description: "Actualiza paquetes compatibles y revisa las notas de migración."
---

La versión experimental `%DOMFX_BROWSER_VERSION%` está disponible en npm.
Consulta las versiones exactas en la [guía de instalación](/docs/es/installation).

<span id="upgrade-compatible-packages"></span>

## Actualiza paquetes compatibles

Todos los paquetes públicos `@domfx` comparten una versión, así que usa la misma
versión de todos los paquetes `@domfx`. Un paquete puede recibir una versión nueva
sin cambios propios. Consulta los registros de cambios, las notas de publicación y
el rango de `peerDependencies` del adaptador GSAP.

Fija las versiones que verificaste y guarda el archivo de bloqueo de dependencias
en el control de versiones. Actualiza el adaptador GSAP opcional cuando sea
necesario; los efectos independientes no dependen de él. Reinstala y ejecuta la
compilación y las comprobaciones de tipos de tu aplicación.

<span id="check-migration-notes"></span>

## Revisa las notas de migración

Las etiquetas de npm pueden cambiar; `latest` no garantiza una API estable.
Fija versiones exactas en lugar de depender de una etiqueta que puede cambiar.
Durante `0.x`, los cambios incompatibles requieren una versión menor con notas
de migración explícitas. Las API alfa pueden cambiar; un parche compatible debe
conservar el contrato documentado.

Prueba tu objetivo y línea de tiempo: avance y retroceso, selección de texto y
controles originales, comportamiento con movimiento reducido o
efectos no disponibles, actualización de captura, desmontaje y nuevo montaje. Elimina
efectos y enlaces obsoletos antes de crear sustitutos. Corrige la condición de
indisponibilidad antes de reintentar explícitamente; no añadas otro enlace
para recuperar el efecto.

Conserva el archivo de bloqueo anterior para volver a las versiones previas. Si falla una actualización, informa
de versiones de paquetes, entorno, código de motivo y mensaje de diagnóstico
junto con un ejemplo mínimo reproducible. Consulta
[solución de problemas](/docs/es/troubleshooting).

<span id="removed-options"></span>

## Opciones eliminadas

La próxima versión elimina dos opciones. Ambas lanzan un error al crear el efecto en
JavaScript y no superan la comprobación de tipos en TypeScript.

- **`clock: 'ambient'`:** usa `clock: 'auto'`, que tiene el mismo comportamiento
  temporal. El valor antiguo lanza `invalid-clock-mode`.
- **`flameHeight` de Fire:** omítelo para usar la apariencia predeterminada, que es
  el antiguo valor predeterminado de `24`, o usa `flameReach` para dimensionar las
  llamas en relación con el objetivo. Ya no es posible usar llamas con un tamaño
  personalizado en píxeles. La opción antigua lanza `invalid-fire-parameter`.

<span id="relative-effect-sizing"></span>

## Tamaño relativo del efecto

El tamaño relativo está disponible en `0.1.0-alpha.2`. Elige los campos de la [referencia de tu efecto](/docs/es/api/effects). Omitirlos conserva la apariencia
predeterminada.
En las opciones emparejadas, la que omitas vale cero.

En el modo relativo, la intensidad cambia la fuerza visual sin cambiar el alcance
ni la profundidad configurados. Las opciones de tamaño se fijan al crear el efecto:
libera la instancia y crea otra para cambiarlas. Revisa sus límites de captura antes
de cambiar de modo.

Slime también ofrece `dripDensity` (0–1, valor predeterminado 0.56). Los valores más
altos añaden más gotas sin cambiar su tamaño, recorrido o ritmo. Se fija al crear
el efecto y no activa el tamaño relativo por sí sola. Consulta las
[opciones de Slime](/docs/es/api/effects/slime#effect-options).

<span id="animation-and-binding-names"></span>

## Nombres de animación y enlaces

Usa `clock: 'auto'` para la animación automática. El valor predeterminado sigue
siendo `'manual'` para el control externo.

La próxima versión elimina los enlaces con nombres Fire. Cambia `bindFire` por
`bindEffect`, `bindFireAsync` por `bindEffectAsync`, `FireBindingOptions` por
`EffectBindingOptions`, `FireBinding` por `EffectBinding` y `AsyncFireBinding` por
`AsyncEffectBinding`. El comportamiento no cambia: los enlaces conservan los valores
iniciales fijos, la interpolación lineal y los objetivos privados de animación.
Consulta los
[enlaces con valores iniciales fijos](/docs/es/api/gsap#snapshot-bindings).

Para encadenar animaciones GSAP, usa llamadas nativas a `.to(effect, ...)` para
que cada segmento parta de los valores anteriores. Cambiar desde los enlaces
modifica este comportamiento y permite que `killTweensOf(effect)` y la sobrescritura
de propiedades actúen directamente sobre la instancia. Registra la limpieza antes
de que termine la configuración; consulta la [guía de GSAP](/docs/es/gsap).

<span id="capture-exports"></span>

## Exportaciones de captura

La próxima versión reduce las exportaciones de captura.

- **`captureElement` y `CaptureFrame`:** impórtalos desde
  `@domfx/browser/experimental`. Ya no se exportan desde `@domfx/browser`, y
  `CaptureFrame` ya no se exporta desde `@domfx/core`.
  `@domfx/browser/experimental` es inestable y puede cambiar en cualquier versión.
- **`classifyAlpha`:** se eliminó de `@domfx/core`. Compara tú mismo el alfa de un
  fotograma: `frame.pixels[index * 4 + 3] >= 128`.
- **`CaptureError` y `CaptureErrorCode`:** no cambian. `refresh()` sigue rechazando
  con `CaptureError`, así que comprueba su `code`.
