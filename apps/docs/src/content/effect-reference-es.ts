import type { EffectId } from '@domfx/site/effects';

export const effectReferenceEs = {
  electricity: {
    description: 'Filamentos eléctricos azules se ramifican y siguen la forma visible.',
    intensity: 'Aumenta el alcance y el brillo de los filamentos eléctricos.',
  },
  frost: {
    description:
      'Una capa de hielo blanco azulado con humo tenue y pequeñas partículas de escarcha.',
    intensity: 'Extiende la escarcha hacia dentro y refuerza el humo y las partículas.',
  },
  fire: {
    description: 'Llamas cálidas y chispas se elevan desde la forma visible.',
    intensity:
      'Aumenta el alcance y el brillo de las llamas. Usa flameHeight para fijar su escala al crear el efecto.',
  },
  dither: {
    description: 'Puntos ordenados cubren el borde y forman estelas ascendentes.',
    intensity:
      'Sin opciones de extensión: Aumenta la densidad de puntos, la cobertura interior y el alcance exterior. En modo relativo, intensity escala la opacidad sin cambiar la extensión ni las marcas.',
  },
  slime: {
    description: 'Una capa verde brillante con gotas que se estiran y caen.',
    intensity: 'Refuerza la capa y acentúa el goteo.',
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
    description: 'Puntos de semitono siguen el borde.',
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
