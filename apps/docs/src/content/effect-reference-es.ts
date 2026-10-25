import type { EffectId } from '@domfx/site/effects';

export const effectReferenceEs = {
  electricity: {
    description:
      'Filamentos eléctricos azules siguen la forma visible. contourSpread, definido al crear, es una fracción finita no negativa del lado menor del border-box sin transformar, incluidos los márgenes transparentes: 0.1 permite 10 px CSS exteriores con un lado menor de 100px. Limita la distancia con signo positiva; el grosor, ruido y detalle de las chispas se mantienen. Cero es transparente; omitirlo conserva el renderizado anterior.',
    intensity:
      'Cambia la fuerza y el brillo eléctricos; no mueve los filamentos. Con contourSpread, escala la salida premultiplicada sin cambiar la extensión ni el detalle.',
  },
  frost: {
    description:
      'Una capa de hielo blanco azulado con humo tenue y pequeñas partículas de escarcha. mistOpacity, modificable, cambia la opacidad de la niebla sin alterar la capa ni los granos.',
    intensity:
      'El modo anterior extiende la escarcha hacia dentro y refuerza la niebla y las partículas. Con coatingDepth o mistReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero.',
  },
  fire: {
    description:
      'Llamas cálidas y chispas se elevan desde la forma visible. emberDensity, definido al crear, selecciona cuántas brasas aparecen sin cambiar el tamaño ni el recorrido de las que quedan; la instancia expone el valor resuelto como solo lectura.',
    intensity:
      'Con flameReach, cambia la fuerza visual sin cambiar el alcance ni el detalle fino. Omitir flameReach conserva la intensidad y flameHeight anteriores.',
  },
  dither: {
    description: 'Puntos ordenados cubren el borde y forman estelas ascendentes.',
    intensity:
      'Sin opciones de extensión: Aumenta la densidad de puntos, la cobertura interior y el alcance exterior. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  slime: {
    description:
      'Una capa verde brillante con gotas que se estiran y caen. gloss, modificable, cambia los brillos sin mover los contornos de la capa ni las gotas.',
    intensity:
      'El modo anterior cambia la geometría de la capa y las gotas. Con coatingDepth o dripReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero.',
  },
  kinetic: {
    description:
      'Un pulso brillante recorre la forma con una estela violeta y fragmentos geométricos. fragmentTravel, definido al crear, es una fracción finita no negativa del lado menor del border-box sin transformar, incluidos los márgenes transparentes: 0.1 permite 10 px CSS de recorrido exterior del centro de los fragmentos con un lado menor de 100px. La deriva lateral fija de 3px y la huella de 5px añaden 8px al soporte exterior. Cero es transparente; omitirlo conserva el renderizado anterior.',
    intensity:
      'Con fragmentTravel, escala la fuerza premultiplicada y mantiene la cobertura del pulso y la estela, el recorrido y el tamaño fino de los fragmentos. Omitirlo conserva el comportamiento anterior del pulso y los fragmentos.',
  },
  'burned-paper': {
    description:
      'Un borde carbonizado irregular con zonas quemadas marrones y algunas grietas luminosas. emberGlow, modificable, cambia el brillo sin eliminar el carbón ni la quemadura.',
    intensity:
      'El modo anterior extiende la quemadura hacia dentro y refuerza la ceniza. Con scorchDepth o ashReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero. El contenido original permanece intacto.',
  },
  halftone: {
    description:
      'Puntos de semitono siguen el borde. dotSpacing, definido al crear, fija el espaciado local en píxeles CSS y escala el radio proporcionalmente sin ampliar el soporte.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  stipple: {
    description: 'Puntos dispersos siguen la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  scanlines: {
    description: 'Bandas horizontales finas se mueven a lo largo del borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  crosshatch: {
    description: 'Líneas cruzadas forman un entramado a lo largo del borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  diamonds: {
    description: 'Una retícula de rombos sigue la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  'contour-echoes': {
    description: 'Contornos sucesivos repiten el borde de la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  engraving: {
    description: 'Líneas finas grabadas dan textura al borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  'woven-mesh': {
    description: 'Hilos entrelazados crean una textura tejida en el borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  hexagons: {
    description: 'Una retícula hexagonal sigue la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  interference: {
    description: 'Ondas superpuestas forman un patrón de interferencia alrededor del borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  shards: {
    description: 'Fragmentos angulares se agrupan a lo largo del borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  circuits: {
    description: 'Trazos semejantes a circuitos siguen la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  'star-shimmer': {
    description: 'Pequeños destellos en forma de estrella brillan a lo largo del borde.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  'brush-fringe': {
    description: 'Pinceladas forman una franja alrededor de la forma visible.',
    intensity:
      'Sin opciones de extensión: Refuerza el patrón y amplía su alcance. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;
