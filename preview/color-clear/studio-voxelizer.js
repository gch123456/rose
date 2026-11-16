/** Deterministic solid voxel sampling. Triangle colors are sRGB components in [0,1].
 * Cells use integer palette indices. Meshes must have a closed, two-manifold
 * geometric edge topology. Optional triangle.solid integer groups are unioned;
 * within each solid, nested shells use odd-even filling. Textures are unsupported.
 */
export function voxelizeTriangles(triangles, { targetCount = 400, colorCount = 4 } = {}) {
  if (!Number.isInteger(targetCount) || targetCount < 200 || targetCount > 800) throw new Error('targetCount must be an integer from 200 to 800');
  if (!Number.isInteger(colorCount) || colorCount < 2 || colorCount > 6) throw new Error('colorCount must be an integer from 2 to 6');
  if (!Array.isArray(triangles) || !triangles.length || triangles.length > 50000) throw new Error('Model must contain 1–50,000 triangles');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) {
    for (const key of ['a', 'b', 'c']) {
      if (!Array.isArray(t?.[key]) || t[key].length !== 3 || !t[key].every(Number.isFinite)) throw new Error('Model contains invalid or nonfinite vertices');
      t[key].forEach((n, i) => { min[i] = Math.min(min[i], n); max[i] = Math.max(max[i], n); });
    }
    if (!Array.isArray(t.color) || t.color.length !== 3 || !t.color.every(n => Number.isFinite(n) && n >= 0 && n <= 1)) throw new Error('Triangle color must be sRGB components from 0 to 1');
  }
  const size = max.map((n, i) => n - min[i]), scale = Math.max(...size);
  if (!Number.isFinite(scale) || scale <= 0 || size.some(n => n / scale < 0.01)) throw new Error('Model is empty or too thin for solid voxelization');
  const mesh = triangles.map(t => ({ ...t, ...Object.fromEntries(['a', 'b', 'c'].map(k => [k, t[k].map((n, i) => (n - min[i]) / scale)])) }));
  const edges = new Map();
  const vertexKey = p => p.map(n => Math.round(n * 1e7)).join(',');
  for (const t of mesh) {
    if (lengthSquared(cross(sub(t.b, t.a), sub(t.c, t.a))) < 1e-22) throw new Error('Model contains degenerate triangles');
    if (t.solid !== undefined && (!Number.isInteger(t.solid) || t.solid < 0)) throw new Error('Triangle solid must be a nonnegative integer');
    const keys = [t.a, t.b, t.c].map(vertexKey);
    for (let i = 0; i < 3; i++) {
      const edge = `${t.solid ?? 0}:` + [keys[i], keys[(i + 1) % 3]].sort().join('|');
      edges.set(edge, (edges.get(edge) || 0) + 1);
    }
  }
  if ([...edges.values()].some(n => n !== 2)) throw new Error('Model must be a closed solid; open or non-manifold edges were found');
  const dimensions = size.map(n => n / scale);
  let best = null;
  // Exhaustive bounded search avoids assuming monotonic counts for narrow features.
  for (let resolution = 3; resolution <= 24; resolution++) {
    const sampled = sample(mesh, dimensions, resolution);
    if (sampled.length && sampled.length <= 800 && (!best || Math.abs(sampled.length - targetCount) < Math.abs(best.points.length - targetCount))) best = { points: sampled, resolution };
  }
  if (!best || best.points.length < 32) throw new Error('Model does not produce a suitable solid voxel result');
  const { palette, indices } = quantize(mesh, colorCount);
  const cells = best.points.map((point, id) => {
    let nearest = Infinity, index = 0;
    for (let i = 0; palette.length > 1 && i < mesh.length; i++) {
      const distance = triangleDistanceSquared(point.position, mesh[i]);
      if (distance < nearest - 1e-12) { nearest = distance; index = i; }
    }
    return { id, x: point.x, y: point.y, z: point.z, color: indices[index], core: false, alive: true, shape: 'box' };
  });
  const warnings = [];
  if (cells.length !== targetCount) warnings.push(`Target ${targetCount}; solid grid produced ${cells.length} blocks. No blocks were randomly removed.`);
  if (palette.length < colorCount) warnings.push(`Model has ${palette.length} distinct material colors after quantization.`);
  return { cells, diagnostics: { actualCount: cells.length, targetCount, palette, gridResolution: best.resolution, warnings } };
}

function sample(mesh, dimensions, resolution) {
  const step = 1 / resolution, dims = dimensions.map(n => Math.max(1, Math.ceil(n * resolution - 1e-9)));
  const origin = dimensions.map((n, i) => (n - dims[i] * step) / 2);
  const columns = Array.from({ length: dims[0] * dims[1] }, () => new Map());
  for (const { a, b, c, solid = 0 } of mesh) {
    const determinant = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(determinant) < 1e-14) continue;
    const low = [0, 1].map(k => Math.max(0, Math.ceil((Math.min(a[k], b[k], c[k]) - origin[k]) / step - 0.500001)));
    const high = [0, 1].map(k => Math.min(dims[k] - 1, Math.floor((Math.max(a[k], b[k], c[k]) - origin[k]) / step - 0.499999)));
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) {
      // Fixed submicroscopic displacement avoids vertex/edge ray ambiguity.
      const px = origin[0] + (x + 0.50000013) * step, py = origin[1] + (y + 0.50000037) * step;
      const u = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / determinant;
      const v = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / determinant;
      if (u >= -1e-12 && v >= -1e-12 && u + v <= 1 + 1e-12) {
        const column = columns[x * dims[1] + y];
        if (!column.has(solid)) column.set(solid, []);
        column.get(solid).push(u * a[2] + v * b[2] + (1 - u - v) * c[2]);
      }
    }
  }
  const points = [];
  for (let x = 0; x < dims[0]; x++) for (let y = 0; y < dims[1]; y++) {
    const intervals = [];
    for (const values of columns[x * dims[1] + y].values()) {
      const raw = values.sort((a, b) => a - b);
      const hits = raw.filter((n, i) => !i || n - raw[i - 1] > 1e-9);
      if (hits.length % 2) throw new Error('Model has ambiguous open or intersecting surfaces');
      for (let h = 0; h < hits.length; h += 2) intervals.push([hits[h], hits[h + 1]]);
    }
    for (let z = 0; z < dims[2]; z++) {
      const pz = origin[2] + (z + 0.5) * step;
      for (const [low, high] of intervals) if (pz >= low - 1e-10 && pz <= high + 1e-10) {
        points.push({ x: x - Math.floor(dims[0] / 2), y: y - Math.floor(dims[1] / 2), z: z - Math.floor(dims[2] / 2), position: [origin[0] + (x + 0.5) * step, origin[1] + (y + 0.5) * step, pz] });
        break;
      }
    }
    if (points.length > 800) return points;
  }
  return points;
}

const sub = (a, b) => a.map((n, i) => n - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const lengthSquared = a => dot(a, a);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function triangleDistanceSquared(p, { a, b, c }) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return lengthSquared(ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return lengthSquared(bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return lengthSquared(sub(ap, ab.map(n => n * d1 / (d1 - d3))));
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return lengthSquared(cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return lengthSquared(sub(ap, ac.map(n => n * d2 / (d2 - d6))));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return lengthSquared(sub(bp, sub(c, b).map(n => n * (d4 - d3) / ((d4 - d3) + (d5 - d6)))));
  const normal = cross(ab, ac), distance = dot(ap, normal);
  return distance * distance / lengthSquared(normal);
}

function quantize(mesh, count) {
  const materials = new Map();
  for (const t of mesh) {
    const key = t.color.map(n => Math.round(n * 255)).join(',');
    const existing = materials.get(key);
    const weight = Math.sqrt(lengthSquared(cross(sub(t.b, t.a), sub(t.c, t.a))));
    if (existing) existing.weight += weight;
    else materials.set(key, { color: key.split(',').map(Number), weight });
  }
  const colors = [...materials.values()].sort((a, b) => b.weight - a.weight || a.color.join(',').localeCompare(b.color.join(',')));
  const centers = [colors[0].color.slice()];
  while (centers.length < Math.min(count, colors.length)) {
    let best = null, score = -1;
    for (const entry of colors) {
      const distance = Math.min(...centers.map(c => lengthSquared(sub(c, entry.color))));
      if (distance * entry.weight > score) { score = distance * entry.weight; best = entry.color; }
    }
    centers.push(best.slice());
  }
  const nearest = color => { let id = 0, distance = Infinity; centers.forEach((center, i) => { const d = lengthSquared(sub(color, center)); if (d < distance) { distance = d; id = i; } }); return id; };
  for (let pass = 0; pass < 8; pass++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const entry of colors) { const sum = sums[nearest(entry.color)]; entry.color.forEach((n, i) => { sum[i] += n * entry.weight; }); sum[3] += entry.weight; }
    sums.forEach((sum, i) => { if (sum[3]) centers[i] = sum.slice(0, 3).map(n => n / sum[3]); });
  }
  return { palette: centers.map(c => '#' + c.map(n => Math.round(n).toString(16).padStart(2, '0')).join('')), indices: mesh.map(t => nearest(t.color.map(n => Math.round(n * 255)))) };
}
