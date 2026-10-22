import type { EffectId } from '@domfx/site/effects';

export const effectReferenceEs = {
  electricity: {
    description: 'Filamentos eléctricos azules se ramifican y siguen la forma visible.',
    intensity: 'Aumenta el alcance y el brillo de los filamentos eléctricos.',
  },
  frost: {
    description: 'Una capa de hielo blanco azulado, humo tenue y pequeñas partículas de escarcha.',
    intensity: 'Extiende la escarcha hacia dentro y refuerza el humo y las partículas.',
  },
  fire: {
    description: 'Llamas cálidas y chispas se elevan desde la forma visible.',
    intensity:
      'Aumenta el alcance y el brillo de las llamas. Usa flameHeight para fijar su escala al crear el efecto.',
  },
  dither: {
    description: 'Puntos ordenados cubren el borde y forman estelas ascendentes.',
    intensity: 'Aumenta la densidad de puntos, la cobertura interior y el alcance exterior.',
  },
  slime: {
    description: 'Una capa verde brillante con gotas que se estiran y caen.',
    intensity: 'Refuerza la capa y el material que gotea.',
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
      'Extiende la quemadura hacia dentro sin ensanchar el borde exterior. El contenido original permanece intacto.',
  },
  halftone: {
    description: 'Un patrón de puntos de semitono sigue el borde.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  stipple: {
    description: 'Marcas de punteado dispersas trazan la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  scanlines: {
    description: 'Bandas horizontales finas forman un borde animado.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  crosshatch: {
    description: 'Líneas cruzadas forman un borde tramado.',
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
    description: 'Líneas grabadas forman un borde con textura.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
  'woven-mesh': {
    description: 'Hilos entrelazados crean una textura de malla tejida en el borde.',
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
    description: 'Fragmentos angulares forman un borde geométrico.',
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
    description: 'Marcas semejantes a pinceladas forman una franja alrededor de la forma visible.',
    intensity: 'Refuerza el patrón y amplía su alcance.',
  },
} satisfies Record<EffectId, { description: string; intensity: string }>;
