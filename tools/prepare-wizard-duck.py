#!/usr/bin/env python3
"""Deterministically rasterize the supplied textured wizard duck as a filled solid.

Requires numpy, scipy, trimesh, Pillow and rtree. The original and optimized GLBs
are read only. No cells are randomly removed or added to meet the piece budget.
"""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import struct
import numpy as np
import trimesh
from scipy import ndimage

PALETTE = ['#e8ebe4', '#174d8b', '#69b8d2', '#e7b74c', '#795536', '#273438']


def glb_info(path):
    raw = path.read_bytes()
    json_length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + json_length])
    triangles = sum(doc['accessors'][p['indices']]['count'] // 3
                    for m in doc.get('meshes', []) for p in m['primitives']
                    if 'indices' in p and p.get('mode', 4) == 4)
    return {'bytes': len(raw), 'triangles': triangles, 'sha256': hashlib.sha256(raw).hexdigest()}


def filled_voxels(mesh, pitch):
    vox = mesh.voxelized(pitch, method='subdivide')
    shell = vox.matrix.copy()
    solid = ndimage.binary_fill_holes(np.pad(shell, 1))[1:-1, 1:-1, 1:-1]
    return vox, shell, solid


def sample_palette(mesh, points):
    closest, _, face_ids = mesh.nearest.on_surface(points)
    barycentric = trimesh.triangles.points_to_barycentric(mesh.triangles[face_ids], closest)
    uv = (mesh.visual.uv[mesh.faces[face_ids]] * barycentric[:, :, None]).sum(axis=1)
    image = np.asarray(mesh.visual.material.baseColorTexture.convert('RGB'))
    # Trimesh flips glTF V on import; convert its bottom-left UVs to image rows.
    u = np.clip(np.rint(uv[:, 0] * (image.shape[1] - 1)), 0, image.shape[1] - 1).astype(int)
    v = np.clip(np.rint((1 - uv[:, 1]) * (image.shape[0] - 1)), 0, image.shape[0] - 1).astype(int)
    rgb = image[v, u].astype(float) / 255
    palette = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in PALETTE]) / 255
    # Compare in perceptual Lab space so blue/cyan and warm staff/gold stay distinct.
    def lab(colors):
        linear = np.where(colors <= .04045, colors / 12.92, ((colors + .055) / 1.055) ** 2.4)
        xyz = linear @ np.array([[.4124564, .2126729, .0193339], [.3575761, .7151522, .1191920], [.1804375, .0721750, .9503041]])
        xyz /= np.array([.95047, 1., 1.08883])
        f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
        return np.column_stack((116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])))
    distance = ((lab(rgb)[:, None, :] - lab(palette)[None, :, :]) ** 2).sum(axis=2)
    colors = distance.argmin(axis=1)
    # Four bounded tones per logical family. Texture luminance selects the tone;
    # geometry lighting supplies direction, never extra ammunition colors.
    shades = np.clip(palette[:, None, :] * np.array([.72, .90, 1.04, 1.15])[None, :, None], 0, 1)
    tone_distance = ((lab(rgb)[:, None, :] - lab(shades.reshape(-1, 3)).reshape(6, 4, 3)[colors]) ** 2).sum(axis=2)
    tones = tone_distance.argmin(axis=1)
    tints = ['#' + ''.join(f'{int(round(v * 255)):02x}' for v in shades[c, t]) for c, t in zip(colors, tones)]
    return colors, tints


def attach_appearance(cells, points, tints):
    for cell, tint in zip(cells, tints):
        cell['visualTint'] = tint
        cell.pop('visualDetail', None)
    # Author-marked source-space facial landmarks, mapped to exposed owner cells.
    occupied = {(c['x'], c['y'], c['z']) for c in cells}
    front = [i for i,c in enumerate(cells) if (c['x'], c['y'], c['z']+1) not in occupied]
    for target, detail in [((-.14,.275,.27),'eye'), ((.085,.325,.225),'eye'), ((-.1,.08,.43),'bill')]:
        candidates = [i for i in front if cells[i].get('visualDetail') is None]
        i = min(candidates, key=lambda i: float(np.linalg.norm(points[i] - target)))
        cells[i]['visualDetail'] = detail



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--mesh', type=Path, default=Path(__file__).resolve().parents[1] / 'preview/models/wizard-duck.glb')
    parser.add_argument('--target', type=int, default=650)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'preview/color-clear/ready')
    parser.add_argument('--enrich', type=Path, help='Add appearance to an existing grid without changing gameplay cells')
    parser.add_argument('--prefix', default='wizard')
    args = parser.parse_args()
    if args.enrich:
        data = json.loads(args.enrich.read_text())
        report = json.loads(args.enrich.with_name(args.enrich.name.replace('-cells.json', '-report.json')).read_text())
        transform = np.array(report['transforms']['voxelTransform'])
        points = trimesh.transform_points(np.array([[c[k] for k in ['x','y','z']] for c in data['cells']]) + np.array(report['transforms']['indexOffset']), transform)
        texture_mesh = trimesh.load(args.mesh, force='mesh', process=False)
        _, tints = sample_palette(texture_mesh, points)
        attach_appearance(data['cells'], points, tints)
        data['metadata']['appearance'] = 'four bounded texture tones per logical color; removable source-space face landmarks'
        args.enrich.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        print('Enriched', len(data['cells']), 'cells; logical colors and grid unchanged')
        return
    mesh = trimesh.load(args.mesh, force='mesh', process=False)
    # Bound the search by the longest dimension; search decisions are deterministic.
    target = args.target
    if not 600 <= target <= 6000: raise ValueError('target must be600–6000')
    factor = (target / 650) ** (1 / 3)
    lo, hi = float(mesh.extents.max() / (16 * factor)), float(mesh.extents.max() / (11 * factor))
    choices = []
    for _ in range(13):
        pitch = (lo + hi) / 2
        vox, shell, solid = filled_voxels(mesh, pitch)
        count = int(solid.sum())
        choices.append((abs(count - target), pitch, vox, shell, solid))
        if count > target:
            lo = pitch
        else:
            hi = pitch
    _, pitch, vox, shell, solid = min((item for item in choices if int(item[4].sum()) <= 6000), key=lambda item: (item[0], item[1]))
    indices = np.argwhere(solid)
    points = trimesh.transform_points(indices, vox.transform)
    colors, tints = sample_palette(mesh, points)
    # Preserve the GLB's Y-up orientation and center all integer grid coordinates.
    offset = np.array([int((indices[:, 0].min() + indices[:, 0].max()) // 2), int((indices[:, 1].min() + indices[:, 1].max()) // 2), int((indices[:, 2].min() + indices[:, 2].max()) // 2)])
    grid = indices - offset
    cells = [{'id': i, 'x': int(p[0]), 'y': int(p[1]), 'z': int(p[2]), 'color': int(color), 'core': False, 'alive': True, 'shape': 'box'} for i, (p, color) in enumerate(zip(grid, colors))]
    attach_appearance(cells, points, tints)
    labels, components = ndimage.label(solid)
    component_sizes = sorted([int(n) for n in np.bincount(labels.ravel())[1:]], reverse=True)
    interior_count = int(solid.sum() - shell.sum())
    assert target * .85 <= len(cells) <= target * 1.15, f'Cell count outside target range: {len(cells)}'
    assert components == 1, f'Unexpected disconnected volume: {component_sizes}'
    assert interior_count > 0, 'Rasterization did not produce a filled interior'
    metadata = {'generator': 'tools/prepare-wizard-duck.py', 'method': 'triangle shell rasterization and enclosed interior fill', 'pitch': pitch, 'solidCellCount': len(cells), 'shellCellCount': int(shell.sum()), 'filledInteriorCellCount': interior_count, 'connectedComponents': int(components), 'axes': 'original GLB Y-up; integer grid centered on all three axes', 'textureSampling': 'nearest source triangle, barycentric UV interpolation, V-flipped image sampling, nearest Lab logical palette with four bounded source-texture tones per family'}
    report = {**metadata, 'name': '法师鸭', 'original': glb_info(args.source), 'optimized': glb_info(args.mesh), 'inputWatertight': bool(mesh.is_watertight), 'sealed': bool(interior_count > 0), 'sealingDescription': 'Coarse rasterized shell encloses an interior; binary hole fill adds only enclosed grid cells. Source mesh is not watertight.', 'closingApplied': False, 'manualBridgesAdded': 0, 'randomDeletionApplied': False, 'targetCount': target, 'searchedPitches': [{'pitch': item[1], 'cells': int(item[4].sum())} for item in choices], 'gridDimensions': [int(n) for n in np.ptp(grid, axis=0) + 1], 'componentSizes': component_sizes, 'palette': PALETTE, 'colorCounts': {PALETTE[int(k)]: int(v) for k, v in sorted(collections.Counter(colors).items())}, 'transforms': {'sourceToGridScale': 1 / pitch, 'voxelTransform': vox.transform.tolist(), 'indexOffset': offset.tolist()}}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / f'{args.prefix}-cells.json').write_text(json.dumps({'name': '法师鸭', 'palette': PALETTE, 'cells': cells, 'metadata': metadata}, ensure_ascii=False, separators=(',', ':')) + '\n')
    (args.output_dir / f'{args.prefix}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['solidCellCount', 'pitch', 'filledInteriorCellCount', 'connectedComponents', 'gridDimensions', 'colorCounts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
