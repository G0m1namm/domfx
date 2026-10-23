---
title: "Instalación"
description: "Instala la versión alfa experimental desde npm."
---

Instala la versión experimental `0.1.0-alpha.0` desde npm. Usa Node 22.22.3
y pnpm 11.5.0 para el proceso verificado.

<span id="build-verified-artifacts"></span>
<span id="genera-artefactos-verificados"></span>
<span id="install-the-alpha"></span>

## Instala la versión alfa

```sh
pnpm add -E @domfx/browser@0.1.0-alpha.0
```

Core se instala automáticamente. GSAP es opcional. Fija versiones exactas y conserva
el lockfile; la API es experimental aunque la etiqueta `latest` de npm apunte a ella.

<span id="create-your-preview-app"></span>

## Crea tu aplicación de prueba

Para una aplicación de prueba nueva, crea un directorio vacío y guarda esto como `package.json`:

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
    "@domfx/core": "0.1.0-alpha.0",
    "@domfx/browser": "0.1.0-alpha.0"
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
  <title>Vista previa de domfx</title>
  <style>
    body { background: #14151B; color: #E8EAF3; font-family: sans-serif; }
    #host { position: relative; padding: 60px; width: 280px; }
    #target { width: 160px; height: 48px; }
  </style>
  <div id="host"><button id="target">Contenido original</button></div>
  <script type="module" src="/main.ts"></script>
</html>
```

El contenedor debe estar conectado al documento, tener posición CSS y contener al
elemento objetivo. Ambos deben estar en el mismo documento y ser elementos distintos. Deja espacio para el efecto
y elige un orden de apilamiento que permita que el canvas añadido se superponga al objetivo.

Continúa con [GSAP](/docs/es/gsap) para crear tu propia línea de tiempo o con
[uso independiente](/docs/es/standalone) para crear `main.ts`.
Ejecuta `pnpm dev` durante el desarrollo; para producción, ejecuta `pnpm build`
y luego `pnpm preview`. Abre la URL local indicada en uno de los navegadores con WebGPU verificados.

<span id="add-the-optional-gsap-binding"></span>

## Añade el enlace opcional de GSAP

Para animar propiedades de forma nativa, añade solo `gsap` a tu aplicación.
El paquete `@domfx/gsap` solo hace falta para las funciones opcionales que conservan los valores iniciales
y gestionan el ciclo de vida.

Para seguir la guía de GSAP, añade esta dependencia a `package.json`:

```json
"gsap": "3.15.0"
```

Si eliges las [funciones opcionales que conservan los valores iniciales](/docs/es/api/gsap#snapshot-bindings),
añade también el paquete:

```json
"@domfx/gsap": "0.1.0-alpha.0"
```

Ejecuta `pnpm install --ignore-scripts` otra vez. GSAP es una dependencia compartida (`peer dependency`) explícita
que debe aportar tu aplicación; el paquete browser independiente no lo instala.

Las guías usan Fire como ejemplo. La referencia de la API enumera
[todas las funciones de efecto](/docs/es/api#available-effects) y sus opciones compartidas.
`flameHeight` es una opción de creación exclusiva de Fire. Usa versiones de paquetes
compatibles entre sí para las exportaciones documentadas; no combines declaraciones
antiguas con ejemplos nuevos.
