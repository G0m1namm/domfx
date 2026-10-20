import {
  effectBindings,
  fullscreenVertex,
  vectorHash,
  valueNoise,
  cssDistanceGradient,
} from './shader-primitives.js';

export const slimeShader = `
${effectBindings}

${fullscreenVertex}

// CSS distance and its analytic bilinear gradient share four raster reads.
// The gradient's raster/raster units cancel; only the distance needs division.
${cssDistanceGradient}

${vectorHash}

${valueNoise}

@fragment fn fragment(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  if (params.w <= 0 || params.z <= 0) { return vec4f(0); }
  let p = pos.xy / params.w;
  let targetField = field(p);
  let distance = targetField.x;
  if (distance < -12 || distance > 31) { return vec4f(0); }
  let intensity = clamp(params.z, 0, 1);
  let aa = clamp(.45 / params.w, .15, .65);
  let extent = vec2f(textureDimensions(distances)) / params.w;
  let inset = vec2f(.5 / params.w);
  let seed = vec2f(params.y * .137, params.y * .071);
  // One continuous liquid surface: pooling rim and drips share geometry and
  // shading, rather than laying bright lines over an otherwise solid edge.
  let flow = p * vec2f(.065, .08) + seed + vec2f(0, -params.x * .085);
  let folds = noise(flow);
  let poolWidth = (1.1 + folds * 1.4) * intensity;
  var liquidDistance = distance - poolWidth;
  var liquidGradient = targetField.yz;

  let cell = floor(p / 12);
  // Projection <=7px, droplet support <=30px, probe jitter <=2.4px per axis;
  // the first omitted cell is >=39.6px away. All drips fit the 32px padding.
  for (var y = -3; y <= 3; y++) {
    for (var x = -3; x <= 3; x++) {
      let id = cell + vec2f(f32(x), f32(y));
      let random = hash(id + seed);
      if (random > .56) { continue; }
      let detail = hash(id + seed + vec2f(17.3, 43.7));
      let jitter = vec2f(hash(id + seed + 7.1), hash(id + seed + 53.2));
      let probe = (id + .5) * 12 + (jitter - .5) * 4.8;
      if (any(probe < inset) || any(probe > extent - inset)) { continue; }
      if (length(p - probe) > 37) { continue; }
      var surface = field(probe);
      if (abs(surface.x) > 7) { continue; }
      var origin = probe;
      for (var step = 0; step < 3; step++) {
        let squared = dot(surface.yz, surface.yz);
        if (!(squared >= .04 && squared <= 4)) { break; }
        let correction = surface.yz * surface.x / max(squared, .25);
        origin -= correction * min(1, 7 / max(length(correction), .001));
        if (any(origin < inset) || any(origin > extent - inset)) { break; }
        surface = field(origin);
      }
      if (any(origin < inset) || any(origin > extent - inset)) { continue; }
      let squared = dot(surface.yz, surface.yz);
      if (!(abs(surface.x) <= .35 && squared >= .04 && squared <= 4)) { continue; }
      if (length(origin - probe) > 7 || length(p - origin) > 30) { continue; }
      let normal = surface.yz / sqrt(squared);
      // Only surfaces with open space underneath can release a gravity-led drip.
      let facing = smoothstep(.15, .65, normal.y);
      if (facing <= 0) { continue; }
      let cycle = 6.2 + detail * 3.4;
      let elapsed = fract(params.x / cycle + random * 5) * cycle;
      let releaseAt = cycle * .7;
      let growth = clamp(elapsed / releaseAt, 0, 1);
      let fallingTime = max(elapsed - releaseAt, 0);
      let maxLength = (6 + detail * 7) * intensity * facing;
      // Increasing weight stretches the attached drop. At release, retain its
      // downward velocity and add constant gravity, in CSS pixels / second².
      let tip = maxLength * growth * growth * growth;
      let releaseVelocity = 3 * maxLength / releaseAt;
      let dropY = tip + releaseVelocity * fallingTime + 90 * fallingTime * fallingTime;
      let local = p - origin;
      let bend = normal.x * 1.4 + (detail - .5) * 1.2;
      let dropX = bend * growth;
      let drift = dropX * clamp(local.y / max(tip, 1), 0, 1);
      let dx = local.x - drift;
      // Surface tension retracts the neck after separation; it no longer
      // follows the falling droplet as a permanent strand.
      let recoil = exp(-fallingTime * 22);
      let neckEnd = mix(1.2 * intensity, tip, recoil);
      let thickness = (2.7 + random * 1.6) * intensity;
      let along = clamp(local.y / max(neckEnd, 1), 0, 1);
      let pinch = smoothstep(.78, 1, growth);
      let neckWidth = thickness * pow(1 - along, 2)
                    + mix(.9, .12, pinch) * intensity * recoil;
      let neck = max(abs(dx) - neckWidth, max(-local.y - 2, local.y - neckEnd));
      var neckGradient = vec2f(sign(dx), 2 * thickness * (1 - along) / max(neckEnd, 1));
      if (-local.y - 2 > abs(dx) - neckWidth) { neckGradient = vec2f(0, -1); }
      if (local.y - neckEnd > max(abs(dx) - neckWidth, -local.y - 2)) {
        neckGradient = vec2f(0, 1);
      }
      // The bead gathers volume, then keeps its size in flight. A damped
      // stretch relaxes toward a round drop while preserving projected area.
      let radius = (2.4 + detail * .8) * intensity * pow(.08 + .92 * growth, 1.0 / 3.0);
      let stretch = 1 + .55 * growth * growth * exp(-fallingTime * 9)
                    * cos(fallingTime * 20);
      let axis = sqrt(stretch);
      let dropOffset = vec2f((local.x - dropX) * axis, (local.y - dropY) / axis);
      let bulb = length(dropOffset) - radius;
      let bulbGradient = dropOffset * vec2f(axis, 1 / axis) / max(length(dropOffset), .001);
      let joinWidth = mix(1.8, .2, pinch);
      let unionBlend = clamp(.5 + .5 * (bulb - neck) / joinWidth, 0, 1);
      var shape = mix(bulb, neck, unionBlend) - joinWidth * unionBlend * (1 - unionBlend);
      let shapeGradient = mix(bulbGradient, neckGradient, unionBlend);
      // Fade only at the padded output boundary, not by shrinking the falling mass.
      shape += smoothstep(27, 30, length(local)) * 8;
      let merge = clamp(.5 + .5 * (shape - liquidDistance) / 2, 0, 1);
      liquidDistance = mix(shape, liquidDistance, merge) - 2 * merge * (1 - merge);
      liquidGradient = mix(shapeGradient, liquidGradient, merge);
    }
  }
  // Coverage keeps both boundaries sharp, independently of gel translucency.
  let depth = (1.5 + intensity * 6) * (.88 + folds * .12);
  let coatingDistance = max(liquidDistance, -distance - depth);
  let coverage = 1 - smoothstep(-aa, aa, coatingDistance);
  var gradient = liquidGradient;
  if (-distance - depth > liquidDistance) { gradient = -targetField.yz; }
  gradient /= max(length(gradient), .001);

  // Rounded cross-section inferred from the contour, with analytic gradients
  // shared by the rim and droplets. No extra texture or screen derivatives.
  let thickness = clamp(-coatingDistance / max(2.6 * intensity, .5), 0, 1);
  let slope = 1 - thickness;
  let bulge = sqrt(max(1 - slope * slope, .001));
  let ripple = (folds - .5) * .08 * thickness;
  let normal = normalize(vec3f(gradient * slope + vec2f(ripple, -ripple), bulge));
  let light = normalize(vec3f(-.4, -.55, .73));
  let halfLight = normalize(light + vec3f(0, 0, 1));
  let diffuse = max(dot(normal, light), 0);
  let specular = pow(max(dot(normal, halfLight), 0), 42);
  let reflection = pow(max(dot(normal, normalize(vec3f(.55, .2, .81))), 0), 12) * .14;
  let pigment = mix(vec3f(.42, .85, .075), vec3f(.18, .58, .025), thickness);
  let color = clamp(pigment * (.65 + diffuse * .4)
                    + vec3f(.86, 1, .68) * (specular * .85 + reflection), vec3f(0), vec3f(1));
  // Thin gel reveals the original content but never fades out at its border.
  // Reflections stay more opaque; output remains premultiplied RGBA.
  let opacity = clamp(.62 + thickness * .24 + specular * .3, 0, 1);
  let alpha = coverage * opacity;
  return vec4f(color * alpha, alpha);
}`;
