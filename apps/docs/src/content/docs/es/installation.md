---
title: "Instalación"
description: "Comienza con artefactos locales de un ensayo de publicación verificado."
---

Todavía no existe un comando de instalación desde un registro compatible. Necesitas
acceso a una copia local compatible del repositorio o a sus archivos tar de core,
browser y, opcionalmente, GSAP. Usa Node 22.22.3 y pnpm 11.5.0 para el proceso verificado.

<span id="build-verified-artifacts"></span>

## Genera artefactos verificados

Desde la copia del repositorio:

```sh
pnpm install --frozen-lockfile
pnpm --filter @domfx/gpu-tests exec playwright install chromium
pnpm release:rehearse
```

El ensayo necesita acceso al registro para las dependencias, una sesión de escritorio
y Chromium con WebGPU. Muestra la ruta de un directorio fuera del repositorio con
`artifacts/`, consumidores nuevos de uso independiente y GSAP, registros de comandos,
resultados de GPU e imágenes PNG. La falta de acceso al navegador o a la GPU significa
que la verificación falló; no cuenta como una prueba de renderizado superada.

<span id="create-your-preview-app"></span>

## Crea tu aplicación de prueba

Crea un directorio vacío fuera del repositorio. Copia los archivos tar del ensayo en
un subdirectorio `artifacts/`. Para los artefactos `0.0.0` actuales, guarda esto como
`package.json`; usa los nombres de archivo reales si cambian las versiones:

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
    "@domfx/core": "file:./artifacts/domfx-core-0.0.0.tgz",
    "@domfx/browser": "file:./artifacts/domfx-browser-0.0.0.tgz"
  },
  "devDependencies": { "typescript": "5.9.3", "vite": "7.3.6" }
}
```

Guarda esto como `pnpm-workspace.yaml`:

```yaml
autoInstallPeers: false
strictPeerDependencies: true
overrides:
  '@domfx/core': file:./artifacts/domfx-core-0.0.0.tgz
```

Conserva la sustitución aunque core sea una dependencia directa: resuelve la versión
de core aún no publicada que requiere browser hacia tu artefacto local. Ejecuta
`pnpm install --ignore-scripts`. No necesitas alias de código fuente, copiar shaders
ni un plugin TypeGPU en la aplicación consumidora; importa las exportaciones públicas
de los paquetes compilados.

<span id="provide-the-target-and-host"></span>

## Proporciona el objetivo y el contenedor

Crea `index.html`:

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <title>domfx preview</title>
  <style>
    body { background: #14151B; color: #E8EAF3; font-family: sans-serif; }
    #host { position: relative; padding: 60px; width: 280px; }
    #target { width: 160px; height: 48px; }
  </style>
  <div id="host"><button id="target">Original content</button></div>
  <script type="module" src="/main.ts"></script>
</html>
```

El contenedor debe estar conectado al documento, tener posición CSS y contener al
objetivo como descendiente estricto en el mismo documento. Deja espacio para el efecto
y elige un orden de apilamiento que permita que el canvas añadido se superponga al objetivo.

Continúa con [GSAP](/docs/es/gsap) para crear tu propia línea de tiempo o con
[uso independiente](/docs/es/standalone) para crear `main.ts`.
Ejecuta `pnpm dev` durante el desarrollo; para producción, ejecuta `pnpm build`
y luego `pnpm preview`. Abre la URL local indicada en un navegador con WebGPU medido.

<span id="add-the-optional-gsap-binding"></span>

## Añade el enlace opcional de GSAP

Para animar propiedades de forma nativa, añade solo `gsap` a tu aplicación.
El artefacto `@domfx/gsap` solo hace falta para las funciones opcionales de instantánea
que gestionan el ciclo de vida.

Para seguir la guía de GSAP, añade esta dependencia a `package.json`:

```json
"gsap": "3.15.0"
```

Si eliges las [funciones opcionales de instantánea](/docs/es/api/gsap#snapshot-bindings),
añade también su artefacto:

```json
"@domfx/gsap": "file:./artifacts/domfx-gsap-0.0.0.tgz"
```

Ejecuta `pnpm install --ignore-scripts` otra vez. GSAP es una dependencia peer explícita
que aporta tu aplicación; el paquete browser independiente no lo instala.

Las guías usan Fire como ejemplo. La referencia de la API enumera
[todas las funciones de efecto](/docs/es/api#available-effects) y sus opciones compartidas.
`flameHeight` es una opción de creación exclusiva de Fire. Usa artefactos actuales
compatibles entre sí para las exportaciones documentadas; no combines declaraciones
antiguas con ejemplos nuevos.
