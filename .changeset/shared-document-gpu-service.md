---
'@domfx/browser': patch
---

Share one GPU renderer service per Document across fire attachments. Targets retain
independent canvases, rasters and controls, including when sharing a host. Deduplicate
concurrent initialization, serialize GPU preparation, and release the service after the
last attachment and its pending work finish cleanup.
