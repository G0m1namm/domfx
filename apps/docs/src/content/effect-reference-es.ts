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
      'Una capa de hielo blanco azulado con humo tenue y pequeñas partículas de escarcha.',
    intensity: 'Extiende la escarcha hacia dentro y refuerza el humo y las partículas.',
  },
  fire: {
    description: 'Llamas cálidas y chispas se elevan desde la forma visible.',
    intensity:
      'Con flameReach, cambia la fuerza visual sin cambiar el alcance ni el detalle fino. Omitir flameReach conserva la intensidad y flameHeight anteriores.',
  },
  dither: {
    description: 'Puntos ordenados cubren el borde y forman estelas ascendentes.',
    intensity: 'Aumenta la densidad de puntos, la cobertura interior y el alcance exterior.',
  },
  slime: {
    description: 'Una capa verde brillante con gotas que se estiran y caen.',
    intensity: 'Refuerza la capa y acentúa el goteo.',
  },
  kinetic: {
    description:
      'Un pulso brillante recorre la forma con una estela violeta y fragmentos geométricos. fragmentTravel, definido al crear, es una fracción finita no negativa del lado menor del border-box sin transformar, incluidos los márgenes transparentes: 0.1 permite 10 px CSS de recorrido exterior del centro de los fragmentos con un lado menor de 100px. La deriva lateral fija de 3px y la huella de 5px añaden 8px al soporte exterior. Cero es transparente; omitirlo conserva el renderizado anterior.',
    intensity:
      'Con fragmentTravel, escala la fuerza premultiplicada y mantiene la cobertura del pulso y la estela, el recorrido y el tamaño fino de los fragmentos. Omitirlo conserva el comportamiento anterior del pulso y los fragmentos.',
  },
  'burned-paper': {
    description:
      'Un borde carbonizado irregular con zonas quemadas marrones y algunas grietas luminosas.',
    intensity:
      'Extiende la quemadura hacia dentro sin ensanchar el borde exterior. El contenido original permanece intacto.',
  },
  halftone: {
    description: 'Puntos de semitono siguen el borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  stipple: {
    description: 'Puntos dispersos siguen la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  scanlines: {
    description: 'Bandas horizontales finas se mueven a lo largo del borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  crosshatch: {
    description: 'Líneas cruzadas forman un entramado a lo largo del borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  diamonds: {
    description: 'Una retícula de rombos sigue la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  'contour-echoes': {
    description: 'Contornos sucesivos repiten el borde de la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  engraving: {
    description: 'Líneas finas grabadas dan textura al borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  'woven-mesh': {
    description: 'Hilos entrelazados crean una textura tejida en el borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  hexagons: {
    description: 'Una retícula hexagonal sigue la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  interference: {
    description: 'Ondas superpuestas forman un patrón de interferencia alrededor del borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  shards: {
    description: 'Fragmentos angulares se agrupan a lo largo del borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  circuits: {
    description: 'Trazos semejantes a circuitos siguen la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  'star-shimmer': {
    description: 'Pequeños destellos en forma de estrella brillan a lo largo del borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  'brush-fringe': {
    description: 'Pinceladas forman una franja alrededor de la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;
