---
title: "Actualización"
description: "Actualiza paquetes compatibles y revisa las notas de migración."
---

domfx es experimental y no está publicado. Todavía no existe un comando de
actualización desde un registro. Usa artefactos verificados y compatibles de la
[guía de instalación](/docs/es/installation).

<span id="upgrade-compatible-packages"></span>

## Actualiza paquetes compatibles

Las bibliotecas tienen versiones independientes. Lee el registro de cambios de
cada paquete y las notas de publicación antes de actualizar: el rango de
dependencia core del paquete browser y el rango peer del enlace GSAP determinan
la compatibilidad. No presupongas que los números de versión son iguales.
Fija las versiones exactas o los archivos tar que verificaste e incluye el
lockfile de tu aplicación en el control de versiones.

Con artefactos locales, sustituye juntos los archivos tar de browser y core
y la sustitución de core. Actualiza el artefacto GSAP opcional cuando cambien
su compatibilidad o comportamiento; la integración independiente no necesita
dependencia GSAP. Ejecuta la instalación de tu gestor de paquetes y luego
la compilación y revisión de tipos de la aplicación.

<span id="check-migration-notes"></span>

## Revisa las notas de migración

Las pruebas públicas usarán la etiqueta opcional `alpha` en lugar de `latest`.
Durante `0.x`, los cambios incompatibles requieren una versión menor con notas
de migración explícitas. Las API alfa pueden cambiar; un parche compatible debe
conservar el contrato documentado.

Prueba tu objetivo y línea de tiempo: avance y retroceso, selección de texto y
controles originales, comportamiento alternativo con movimiento reducido o
indisponibilidad, actualización de captura, desmontaje y nuevo montaje. Elimina
efectos y enlaces obsoletos antes de crear sustitutos. Corrige la condición de
indisponibilidad antes de reintentar explícitamente; no añadas otro enlace
para recuperar el efecto.

Conserva el lockfile anterior para revertir. Si falla una actualización, informa
de versiones de paquetes, entorno, código de motivo y mensaje de diagnóstico
junto con un caso pequeño reproducible. Consulta
[solución de problemas](/docs/es/troubleshooting).

<span id="animation-and-binding-names"></span>

## Nombres de animación y enlaces

Prefiere `clock: 'auto'` para la animación automática. El valor existente
`clock: 'ambient'` sigue funcionando con el mismo tiempo; la propiedad de solo
lectura `clock` informa del valor proporcionado. El valor predeterminado sigue
siendo `'manual'` para el control externo.

`bindEffect` y `bindEffectAsync`, junto con sus tipos genéricos, son alias
compatibles de los enlaces con nombres Fire. Las llamadas existentes no requieren
migración. Ambos nombres conservan los valores iniciales al crear, la interpolación
lineal y los objetivos proxy privados.

Para secuencias normales de GSAP, usa llamadas nativas a `.to(effect, ...)`.
Es una elección de comportamiento: las llamadas `.to()` encadenadas heredan
los valores anteriores, y la sobrescritura o `killTweensOf(effect)` se aplica
a la instancia real. Registra la limpieza explícita del efecto antes de que
termine su configuración. Consulta la [guía de GSAP](/docs/es/gsap).
