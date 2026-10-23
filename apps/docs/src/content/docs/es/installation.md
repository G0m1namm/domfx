---
title: "Instalación"
description: "Instala la versión alfa experimental desde npm."
---

Usa Node 22.22.3, pnpm 11.5.0 y un [navegador con WebGPU](/docs/es/support).
Esta guía crea una pequeña aplicación con Vite y la versión experimental
`%DOMFX_BROWSER_VERSION%`. La API puede cambiar.

<span id="build-verified-artifacts"></span>
<span id="genera-artefactos-verificados"></span>
<span id="install-the-alpha"></span>

## Instala la versión alfa

Si ya tienes una aplicación:

```sh
%DOMFX_BROWSER_INSTALL%
```

Core se instala automáticamente. GSAP es opcional. Fija versiones exactas y conserva
el archivo de bloqueo de dependencias; la API es experimental aunque la etiqueta
`latest` de npm apunte a ella.

<span id="create-your-preview-app"></span>

## Crea tu aplicación de prueba

Para una aplicación nueva, ejecuta `mkdir my-domfx-preview` y después
`cd my-domfx-preview`. Guarda esto como `package.json`:

```json
{
  "name": "my-domfx-preview",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@domfx/core": "%DOMFX_CORE_VERSION%",
    "@domfx/browser": "%DOMFX_BROWSER_VERSION%"
  },
  "devDependencies": { "typescript": "5.9.3", "vite": "7.3.7" }
}
```

Guarda esto como `pnpm-workspace.yaml`:

```yaml
autoInstallPeers: false
strictPeerDependencies: true
```

Ejecuta `pnpm install --ignore-scripts`. Importa las exportaciones públicas de los
paquetes compilados; no necesitas alias de código fuente, copiar shaders ni un plugin TypeGPU.

<span id="provide-the-target-and-host"></span>

## Proporciona el objetivo y el contenedor

Crea `index.html`:

```html
<!doctype html>
<html lang="es">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <link rel="icon" href="data:," />
  <title>Vista previa de domfx</title>
  <style>
    body { background: #14151B; color: #E8EAF3; font-family: sans-serif; }
    #host { position: relative; padding: 3rem; width: fit-content; }
    #target { min-width: 10rem; min-height: 3rem; font: inherit; }
  </style>
  <div id="host"><button id="target">Contenido original</button></div>
  <p>Clics: <output id="clicks">0</output></p>
  <script type="module" src="/main.ts"></script>
</html>
```

El **elemento objetivo** (`target`) es el botón cuya forma recibe el efecto.
El **contenedor del efecto** (`host`) contiene el objetivo y el canvas decorativo.
Usa elementos distintos en el mismo documento, con `position: relative` en el
contenedor y espacio para las llamas. Mantén ambos en el documento durante el efecto.

Continúa con [uso independiente](/docs/es/standalone#attach-fire) para crear
`main.ts` y ver el resultado. Si ya usas GSAP, sigue la [guía de GSAP](/docs/es/gsap).

<span id="add-the-optional-gsap-binding"></span>

## Añade el enlace opcional de GSAP

Para animar propiedades de forma nativa, añade solo `gsap` a tu aplicación.
El paquete `@domfx/gsap` solo hace falta para las funciones opcionales que conservan los valores iniciales
y gestionan el ciclo de vida.

Para seguir la guía de GSAP:

```sh
pnpm add -E gsap@3.15.0
```

Si necesitas las [funciones opcionales](/docs/es/api/gsap#snapshot-bindings):

```sh
pnpm add -E @domfx/gsap@%DOMFX_GSAP_VERSION%
```

Tu aplicación aporta GSAP; `@domfx/browser` no lo instala.
