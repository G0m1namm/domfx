# domfx domain

Decorative effects follow captured shapes while the original page remains the source of content and interaction.

## Language

**Effect target**: The exact element selected for an effect; its captured paint determines the shape. Selecting a container does not implicitly select its children separately.
_Avoid_: Subject, affected subtree (when a single selected element is meant).
_Reader-facing label_: Target element.
_Spanish_: Elemento objetivo.

**Silhouette**: The inside/outside shape classified from captured alpha, including inner holes and disconnected regions.
_Reader-facing label_: Visible shape.
_Spanish_: Forma visible.

**Coverage mask**: The captured alpha coverage before classification into silhouette membership.

**Effect host**: The caller-selected page container that contains the target and its decorative output layer.
_Reader-facing label_: Effect container.
_Spanish_: Contenedor del efecto.

**Effect layer**: The decorative output associated with one target, spatially aligned to the page.

**Capture revision**: One requested version of the target's painted appearance.

**Stale raster**: A previous capture that no longer represents the target's current paint.

**Unavailable effect**: An effect that cannot currently render under the environment, resource or composition conditions; its original target remains usable.

**Effect instance**: One attached effect with its animation controls, current state and cleanup lifetime.
_Avoid_: Attachment handle in introductory documentation.

**Effect time**: The animation sample selected in seconds. It can move forward or backward independently of elapsed real time.

**Automatic animation**: domfx advances effect time while the effect can render, excluding time spent paused or hidden.
_Avoid_: Ambient animation in reader-facing prose.

**External control**: Caller code or an animation library sets effect time. domfx does not advance it automatically.
_Avoid_: Manual clock ownership in reader-facing prose.

**Capture status**: Whether the captured appearance is up to date, being refreshed or out of date.
_Avoid_: Raster health in reader-facing prose.

## Reader-facing EN/ES terms

Use these terms in public guidance; keep API identifiers, package names and effect
names unchanged. The Spanish terms describe behavior rather than translating identifiers.

| English             | Spanish                            | Usage                                                                                                             |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Effect instance     | Instancia de efecto                | One returned `EffectHandle`.                                                                                      |
| Automatic animation | Animación automática               | domfx advances effect time.                                                                                       |
| External control    | Control externo                    | Caller code or GSAP sets effect time.                                                                             |
| Capture status      | Estado de captura                  | Whether the captured appearance is current.                                                                       |
| Refresh             | Actualizar la captura              | `refresh()` captures the target again.                                                                            |
| Retry               | Reintentar                         | `retry()` starts setup again after correcting a condition.                                                        |
| Dispose / cleanup   | Liberar recursos / limpieza        | `dispose()` releases the effect; cleanup can also remove caller-owned animations and listeners.                   |
| Timeline / playback | Línea de tiempo / reproducción     | Follow established Spanish animation terminology.                                                                 |
| Keyframe            | Fotograma clave                    | A specified state in an animation.                                                                                |
| Tween               | Animación de propiedades           | Introduce GSAP's `Tween` as an animation object; interpolation is the process of calculating intermediate values. |
| Easing              | Curva de aceleración               | Explain `ease` as the rate of change, including linear change.                                                    |
| Snapshot binding    | Enlace con valores iniciales fijos | Optional GSAP helper that captures starting controls when created.                                                |

Terminology references: [MDN's Spanish animation guide](https://developer.mozilla.org/es/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API)
and [Animation reference](https://developer.mozilla.org/es/docs/Web/API/Animation).
Their vocabulary does not change domfx units: effect time and GSAP durations are in seconds.
