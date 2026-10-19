# domfx domain

Decorative effects follow captured shapes while the original page remains the source of content and interaction.

## Language

**Effect target**: The exact element selected for an effect; its captured paint determines the shape. Selecting a container does not implicitly select its children separately.
_Avoid_: Subject, affected subtree (when a single selected element is meant).
_Reader-facing label_: Target element.

**Silhouette**: The inside/outside shape classified from captured alpha, including inner holes and disconnected regions.
_Reader-facing label_: Visible shape.

**Coverage mask**: The captured alpha coverage before classification into silhouette membership.

**Effect host**: The caller-selected page container that contains the target and its decorative output layer.
_Reader-facing label_: Effect container.

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
