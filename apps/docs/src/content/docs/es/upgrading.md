---
title: "Actualización"
description: "Actualiza paquetes compatibles y revisa las notas de migración."
---

La versión experimental `%DOMFX_BROWSER_VERSION%` está disponible en npm.
Consulta las versiones exactas en la [guía de instalación](/docs/es/installation).

<span id="upgrade-compatible-packages"></span>

## Actualiza paquetes compatibles

Los paquetes tienen versiones independientes. Consulta sus registros de cambios
y notas de publicación, el rango de core que requiere browser y los rangos de
`peerDependencies` del adaptador GSAP. Que los números de versión coincidan
no basta para establecer compatibilidad.

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

<span id="animation-and-binding-names"></span>

## Nombres de animación y enlaces

Prefiere `clock: 'auto'` para la animación automática. El valor existente
`clock: 'ambient'` sigue funcionando con el mismo comportamiento temporal; la propiedad de solo
lectura `clock` informa del valor proporcionado. El valor predeterminado sigue
siendo `'manual'` para el control externo.

`bindEffect` y `bindEffectAsync` son alias compatibles de los enlaces con nombres
Fire, incluidos sus tipos. Las llamadas existentes no requieren migración. Ambos
nombres conservan los valores iniciales fijos, la interpolación lineal y los
objetivos privados de animación. Consulta los
[enlaces con valores iniciales fijos](/docs/es/api/gsap#snapshot-bindings).

Para encadenar animaciones GSAP, usa llamadas nativas a `.to(effect, ...)` para
que cada segmento parta de los valores anteriores. Cambiar desde los enlaces
modifica este comportamiento y permite que `killTweensOf(effect)` y la sobrescritura
de propiedades actúen directamente sobre la instancia. Registra la limpieza antes
de que termine la configuración; consulta la [guía de GSAP](/docs/es/gsap).
