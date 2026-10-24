import type { EffectId } from '@domfx/site/effects';

export const effectReferenceEs = {
  electricity: {
    description: 'Filamentos eléctricos azules se ramifican y siguen la forma visible.',
    intensity: 'Aumenta el alcance y el brillo de los filamentos eléctricos.',
  },
  frost: {
    description:
      'Una capa de hielo blanco azulado con humo tenue y pequeñas partículas de escarcha.',
    intensity:
      'El modo anterior extiende la escarcha hacia dentro y refuerza la niebla y las partículas. Con coatingDepth o mistReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero.',
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
    intensity:
      'El modo anterior cambia la geometría de la capa y las gotas. Con coatingDepth o dripReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero.',
  },
  kinetic: {
    description:
      'Un pulso brillante recorre la forma con una estela violeta y fragmentos geométricos.',
    intensity: 'Aumenta el ancho y el brillo del pulso y el alcance de los fragmentos.',
  },
  'burned-paper': {
    description:
      'Un borde carbonizado irregular con zonas quemadas marrones y algunas grietas luminosas.',
    intensity:
      'El modo anterior extiende la quemadura hacia dentro y refuerza la ceniza. Con scorchDepth o ashReach, la intensidad solo cambia la fuerza visual; el alcance omitido vale cero. El contenido original permanece intacto.',
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
