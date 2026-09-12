/** Slow Float64 truth oracle for small diagnostic masks only. */
export function signedDistanceOracle(
  mask: Uint8Array,
  width: number,
  _height: number,
): Float64Array {
  const values = new Float64Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    const x = i % width;
    const y = Math.floor(i / width);
    const target = mask[i] ? 0 : 1;
    let best = Infinity;
    for (let j = 0; j < mask.length; j += 1) {
      if (mask[j] === target) {
        best = Math.min(best, Math.hypot((j % width) - x, Math.floor(j / width) - y));
      }
    }
    values[i] = mask[i] ? -best : best;
  }
  return values;
}

/** Exact separable Float64 Euclidean distance transform, used for full raster validation.
 * A row sweep finds the closest class pixel in each row; a column scan minimizes
 * dx² + dy² over every row. Independent of jump flooding; O(width * height²).
 */
export function exactDistanceField(mask: Uint8Array, width: number, height: number): Float64Array {
  if (mask.length !== width * height) {
    throw new Error('mask dimensions do not match pixels');
  }
  const result = new Float64Array(mask.length);
  for (const wanted of [0, 1]) {
    const horizontal = new Float64Array(mask.length);
    for (let y = 0; y < height; y += 1) {
      let nearest = -Infinity;
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (mask[i] === wanted) {
          nearest = x;
        }
        horizontal[i] = (x - nearest) ** 2;
      }
      nearest = Infinity;
      for (let x = width - 1; x >= 0; x -= 1) {
        const i = y * width + x;
        if (mask[i] === wanted) {
          nearest = x;
        }
        horizontal[i] = Math.min(horizontal[i], (x - nearest) ** 2);
      }
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (mask[i] === wanted) {
          continue;
        }
        let squared = Infinity;
        for (let row = 0; row < height; row += 1) {
          squared = Math.min(squared, horizontal[row * width + x] + (row - y) ** 2);
        }
        result[i] = (mask[i] ? -1 : 1) * Math.sqrt(squared);
      }
    }
  }
  return result;
}
