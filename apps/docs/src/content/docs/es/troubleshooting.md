---
title: "Solución de problemas"
description: "Lee el motivo informado, corrige la condición y vuelve a intentarlo explícitamente."
---

Espera a `effect.ready` y luego consulta `lifecycle`, `raster` y el código
`reason`. Usa `reasonDetail` para diagnosticar, no para la lógica del programa.
La indisponibilidad del entorno no rechaza `ready`; las opciones no válidas y
los conflictos de objetivo pueden producir errores síncronos.

<span id="missing-or-suppressed-output"></span>

## Salida ausente o suprimida

- `no-webgpu`, `no-adapter`, `canvas-webgpu-unavailable`: comprueba el navegador
  y dispositivo reales, y usa un contexto seguro o una dirección local. Mantén
  utilizable el contenido original. Compilar o comprobar tipos no demuestra que
  WebGPU esté disponible.
- `reduced-motion`: respeta la preferencia. Elige `motion: 'static'` al crear
  el efecto para una decoración inmóvil, o reintenta explícitamente cuando cambie
  la preferencia. No hay una opción para forzar la animación.
- `empty-mask`, `missing-exterior`: la forma capturada necesita píxeles opacos
  y espacio transparente alrededor. Un objetivo totalmente transparente no tiene
  forma visible.
- `capture-budget`, `target-budget`, `aggregate-budget`: reduce el tamaño
  capturado, la densidad de píxeles del dispositivo (DPR) o el número de efectos simultáneos. Libera los efectos sin uso.
- `renderer-failed`, `device-lost`: inspecciona los diagnósticos de GPU y shader.
  Un reintento explícito puede recrearlos; la recuperación no está garantizada.

<span id="misplaced-or-rejected-output"></span>

## Salida mal colocada o rechazada

Comprueba que `host` esté conectado, tenga una posición CSS distinta de `static`
y contenga el elemento objetivo. Deja espacio para la decoración y usa un
apilamiento compatible. Para `unsupported-placement`, lee `reasonDetail`: indica
el elemento, el CSS no admitido y una corrección sugerida. Compáralo con los
[límites actuales](/docs/es/support#capture-and-composition-limits) y corrige el
CSS antes de reintentar.

Para `unsupported-composition`, revisa la opacidad del objetivo y los
intermediarios, los filtros (incluso `blur(0px)`), los filtros de fondo y los
modos de mezcla. Anima la opacidad del contenedor cuando el contenido nativo
y su efecto deban desvanecerse juntos, como en el
[ejemplo de GSAP](/docs/es/gsap). Corrige el CSS antes de reintentar.

<span id="failed-or-stale-capture"></span>

## Captura fallida u obsoleta

`capture-failed` señala diagnósticos de recursos, CORS, fuentes o decodificación.
Espera a las fuentes y los recursos decodificados. Los cambios observados en el
objetivo pueden actualizar la captura automáticamente; los cambios no detectados en la apariencia
de elementos antecesores u hojas de estilo, los estados hover/focus y el dibujo en canvas requieren una
actualización explícita. Cada captura es una instantánea, no una grabación continua de vídeo.

`target-not-visible` y `stale-raster` pueden describir una suspensión, no un
fallo. La salida actualizada puede reanudarse al hacerse visible; una apariencia
capturada obsoleta necesita actualización o reintento cuando vuelva a ser visible.
Un objetivo sin borde pero con contorno CSS (`outline`), o un subárbol con `content-visibility: auto`,
pueden rechazarse para evitar que la captura cambie el contenido original.

<span id="installation-or-shader-errors"></span>

## Errores de instalación o shaders

Instala los paquetes publicados con las versiones exactas de la
[guía de instalación](/docs/es/installation). Revisa el archivo de bloqueo de
dependencias por si quedan versiones incompatibles o sustituciones por archivos
tar locales.

Importa desde `@domfx/browser`, no desde archivos fuente ni rutas `dist` privadas.
El paquete ya incluye la transformación de shaders de TypeGPU; tu aplicación no
necesita un plugin de shaders. Si aparecen errores de metadatos de shader,
reinstala el paquete publicado e informa del error si persiste.

Para `renderer-failed`, `reasonDetail` puede incluir el nombre del efecto y la
línea y columna WGSL generadas. El shader indicado puede pertenecer a otro efecto
porque el renderizador prepara los programas juntos. Reintentar no corrige un
shader inválido; incluye el diagnóstico y la versión del paquete en el informe.

<span id="trace-an-attachment"></span>

## Registra un efecto

Para depurar localmente, importa `startEffectDiagnostics` desde
`@domfx/browser/experimental`. Inicia la sesión antes de crear el efecto; los
efectos existentes no reciben instrumentación retroactiva. Con `target` montado
y `host` posicionado, usa este módulo JavaScript en una compilación local:

```js
import { attachFrost } from '@domfx/browser';
import { startEffectDiagnostics } from '@domfx/browser/experimental';

const trace = startEffectDiagnostics({ capacity: 128 });
try {
  const effect = attachFrost(target, { host, clock: 'manual' });
  window.addEventListener('pagehide', () => effect.dispose(), { once: true });
  // Libera también el efecto al desmontar el componente.
  await effect.ready;
  console.table(trace.records);
} finally {
  trace.dispose();
}
```

Los registros describen las etapas de configuración y captura con marcas de
tiempo de CPU en milisegundos. Un registro de presentación indica que se envió
la salida, no que terminó la ejecución en la GPU ni que apareció en pantalla.
No hay registros por fotograma, texto del DOM ni selectores.

Solo puede ejecutarse una sesión a la vez. `capacity` vale 128 de forma
predeterminada y acepta enteros de 1 a 4096; cuando se llena, se descartan los
registros más antiguos. `records` devuelve una instantánea. Cópiala antes de llamar
a `trace.dispose()`, que borra los registros y las marcas, pero no libera los
efectos. `userTiming: true` añade también marcas `domfx:` limitadas al panel
Performance del navegador.

Mantén locales los registros exportados y desactiva el registro al medir el
rendimiento. Esta entrada experimental de JavaScript expone tipos GPU internos
y queda fuera de las garantías de TypeScript de la API principal. Usa `reason`
y `reasonDetail` de la API principal para diagnosticar desde tu aplicación.

<span id="recover-explicitly"></span>

## Recupera el efecto explícitamente

Después de corregir la condición informada, una acción asíncrona del usuario
puede ejecutar lo siguiente para cualquier instancia de efecto:

```ts
try {
  await effect.retry();
  console.info(effect.lifecycle, effect.raster, effect.reason, effect.reasonDetail);
} catch (error) {
  console.info(error);
}
```

Que la promesa de reintento se resuelva indica que terminó el intento; consulta
el estado para saber si funcionó. Los reintentos simultáneos comparten un intento
y conservan los controles y enlaces GSAP. `refresh()` actualiza la captura;
no recupera un efecto no disponible. Consulta los
[métodos del efecto](/docs/es/api/effect-handle#refresh-retry-and-dispose).

Reintentar sobre una instancia liberada se rechaza. Crea otro efecto después de
volver a montar el elemento. `effect-target-owned` significa que otro efecto
ocupa el objetivo, uno de sus ancestros o un descendiente. Libera primero ese
efecto; esta restricción se refiere al árbol del DOM, no a la superposición visual.
