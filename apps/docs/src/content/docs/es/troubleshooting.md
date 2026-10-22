---
title: "Solución de problemas"
description: "Lee el motivo informado, corrige la condición y vuelve a intentarlo explícitamente."
---

Espera a `effect.ready` y luego consulta `lifecycle`, `raster` y el código
`reason`. Usa `reasonDetail` para diagnosticar, no para la lógica del programa.
La indisponibilidad del entorno no rechaza `ready`; las opciones no válidas y
los conflictos de objetivo pueden producir errores sincrónicos.

<span id="missing-or-suppressed-output"></span>

## Salida ausente o suprimida

- `no-webgpu`, `no-adapter`, `canvas-webgpu-unavailable`: comprueba el navegador
  y dispositivo reales, y usa un contexto seguro o una dirección local. Mantén
  utilizable el contenido original. Compilar o revisar tipos no demuestra que
  WebGPU esté disponible.
- `reduced-motion`: respeta la preferencia. Elige `motion: 'static'` al crear
  el efecto para una decoración inmóvil, o reintenta explícitamente cuando cambie
  la preferencia. No hay una opción para forzar la animación.
- `empty-mask`, `missing-exterior`: el objetivo necesita píxeles opacos
  clasificados y exterior transparente dentro del margen de captura. Un objetivo
  totalmente transparente no tiene silueta.
- `capture-budget`, `target-budget`, `aggregate-budget`: reduce el tamaño
  capturado, el DPR o el número de efectos simultáneos. Libera los efectos sin uso.
- `renderer-failed`, `device-lost`: inspecciona los diagnósticos de GPU y shader.
  Un reintento explícito puede recrearlos; la recuperación no está garantizada.

<span id="misplaced-or-rejected-output"></span>

## Salida mal colocada o rechazada

Comprueba que el contenedor esté conectado, tenga posición CSS y contenga el
objetivo. Deja espacio para la decoración y usa un apilamiento compatible.
`unsupported-placement` señala geometría o recorte fuera de los
[límites actuales](/docs/es/support#capture-and-composition-limits).
No lo compenses con una caja delimitadora supuesta. `reasonDetail` identifica
el elemento rechazado (etiqueta e ID si existe), la propiedad y valor CSS
calculados, y una corrección sugerida. Por ejemplo, un `h1#title` rotado
informa de su `transform` calculado y pide traslación o escala positiva alineada
con los ejes. Un filtro identifica el elemento afectado y sugiere quitarlo o
aplicarlo al contenedor compartido. La redacción es diagnóstica; usa el código
`reason` para las decisiones del programa.

Para `unsupported-composition`, revisa la opacidad del objetivo y los
intermediarios, los filtros (incluso `blur(0px)`), los filtros de fondo y los
modos de mezcla. Anima la opacidad del contenedor cuando el contenido nativo
y su efecto deban desvanecerse juntos, como en el
[ejemplo de GSAP](/docs/es/gsap). Corrige el CSS antes de reintentar.

<span id="failed-or-stale-capture"></span>

## Captura fallida u obsoleta

`capture-failed` señala diagnósticos de recursos, CORS, fuentes o decodificación.
Espera a las fuentes y los recursos decodificados. Los cambios observados en el
objetivo pueden actualizar la captura automáticamente; la pintura no observada
de ancestros u hojas de estilo, hover/focus y el dibujo en canvas requieren una
actualización explícita. Es una captura de instantánea, no vídeo continuo.

`target-not-visible` y `stale-raster` pueden describir una suspensión, no un
fallo. La salida actualizada puede reanudarse al hacerse visible; una apariencia
capturada obsoleta necesita actualización o reintento cuando vuelva a ser visible.
Un objetivo sin borde pero con outline, o un subárbol con `content-visibility: auto`,
pueden rechazarse para evitar que la captura cambie el contenido original.

<span id="installation-or-shader-errors"></span>

## Errores de instalación o shaders

Si la instalación intenta usar el registro para core, conserva la
[sustitución local del archivo tar](/docs/es/installation#create-your-preview-app)
y revisa cada ruta de artefacto. Las instrucciones del registro deben esperar
a la publicación de los paquetes.

Si aparece un error de metadatos de shader, recompila y empaqueta otra vez el
paquete browser, y reinstala su archivo tar. La compilación del paquete aplica
la transformación TypeGPU. Importa la exportación pública; no importes archivos
fuente ni rutas dist privadas ni añadas un plugin de shaders al consumidor.

Para `renderer-failed` durante la inicialización GPU, consulta `reasonDetail`
para ver el nombre del efecto y la línea y columna WGSL generadas, si el compilador
nativo las proporciona. Los programas se preparan juntos para el renderizador
compartido; el shader indicado puede pertenecer a un efecto distinto del adjuntado.
Reintentar no corrige un shader inválido; corrige primero la compilación del paquete.

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
  // Also dispose the attachment on component unmount.
  await effect.ready;
  console.table(trace.records);
} finally {
  trace.dispose();
}
```

Cada registro contiene el efecto, un número de objetivo opaco y local a la sesión,
la revisión de captura, etapa, fase y marca de tiempo CPU en milisegundos. Las
etapas cubren la adquisición del renderizador, captura, preparación, aceptación
o descarte de la revisión y primera presentación. Presentación significa envío
de la salida decorativa, no ejecución GPU completa ni aparición en pantalla.
No hay registros por fotograma.

Solo puede ejecutarse una sesión a la vez. La capacidad predeterminada es de
128 registros y acepta enteros de 1 a 4096; al llegar al límite se descartan
los más antiguos. `records` devuelve una instantánea. Cópiala antes de liberar
la sesión si la necesitas después. Liberar la sesión borra registros y marcas
retenidos; no libera efectos.

Usa `userTiming: true` para crear también marcas `domfx:` limitadas en el panel
Performance del navegador. Los registros no conservan texto DOM ni selectores.
Mantén locales los registros exportados y desactiva los diagnósticos para medir
rendimiento. Esta es una interfaz experimental de depuración, no telemetría
estable de aplicaciones.

La entrada experimental también expone tipos GPU internos y queda fuera de
las garantías TypeScript de la API raíz para consumidores. Para registrar con
TypeScript, usa la configuración de pruebas GPU del repositorio. Las integraciones
de aplicaciones pueden usar `reason` y `reasonDetail` de la API raíz sin ella.

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

Los reintentos simultáneos comparten un intento y conservan los controles y
enlaces GSAP. Actualizar la captura o asignar controles no recupera una instancia
no disponible. Reintentar sobre una instancia liberada se rechaza; crea otro
efecto después de volver a montar. `effect-target-owned` significa que otro
efecto activo usa el objetivo, uno de sus ancestros o un descendiente. Libera
primero ese efecto; una superposición visual arbitraria es otra condición.
