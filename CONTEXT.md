# domfx domain

Decorative effects follow captured shapes while the original page remains the source of content and interaction.

## Language

**Effect target**: The exact element selected for an effect; its captured paint determines the shape. Selecting a container does not implicitly select its children separately.
_Avoid_: Subject, affected subtree (when a single selected element is meant).

**Silhouette**: The inside/outside shape classified from captured alpha, including inner holes and disconnected regions.

**Coverage mask**: The captured alpha coverage before classification into silhouette membership.

**Effect host**: The caller-selected page container that contains the target and its decorative output layer.

**Effect layer**: The decorative output associated with one target, spatially aligned to the page.

**Capture revision**: One requested version of the target's painted appearance; newer requests supersede older work.

**Stale raster**: A previous capture that no longer represents the target's current paint. It is hidden until a valid replacement arrives.

**Unavailable effect**: An effect that cannot currently render under the environment, resource or composition conditions; its original target remains usable.
