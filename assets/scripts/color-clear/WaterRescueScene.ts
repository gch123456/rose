import {
    Color, Material, Mesh, MeshRenderer, Node, Vec3, primitives, utils,
} from 'cc';
import {BlockMeshIndex} from './ColorClearBlockMesh';
import {createHarborDuck} from './ColorClearHarborDuck';
import {harborDuckScale} from './ColorClearHarborDuckGeometry';
import {makeRaincoatSurface} from './ColorClearHarborLevels';
import type {Voxel} from './ColorClearGame';
import type {Valve, WaterArrival, WaterRescueGame} from './WaterRescueGame';

type Point = readonly [number, number, number];
type Flow = Valve | 'merge';
type Branch = 'left' | 'right';
type ShellSection = WaterArrival | `${Branch}-top` | `${Branch}-middle`;
type Debris = {node: Node; origin: Vec3; velocity: Vec3; age: number; lifetime: number; size: number; roll: number};
const CLAY = ['#d48459', '#eab581', '#f6c991', '#ba6242', '#f0a36d', '#bd7249'];
const ROUTES: Record<Flow, readonly Point[]> = {
    left: [[-2.08, 2.47, .95], [-2.09, 1.63, 1.66], [-1.85, .68, 2.14], [-2.08, -.16, 1.90],
        [-1.60, -.94, 2.20], [-.70, -1.42, 2.37], [0, -1.55, 2.46]],
    right: [[2.08, 2.24, .93], [2.14, 1.51, 1.58], [1.86, .56, 2.28], [2.06, -.18, 1.95],
        [1.69, -.85, 2.23], [.72, -1.40, 2.41], [0, -1.55, 2.46]],
    merge: [[0, -1.52, 2.44], [.20, -1.77, 2.68], [.11, -2.19, 2.80], [0, -2.62, 2.99]],
    drain: [[0, -1.90, 2.70], [-.14, -2.17, 2.96], [0, -2.54, 3.20],
        [.24, -2.69, 3.69], [.54, -2.72, 4.56], [.75, -2.74, 5.32]],
};
const OUTLETS: Record<WaterArrival, Point> = {
    left: [-1.44, .25, 1.8], right: [1.44, .05, 1.84], merge: [0, -1.14, 2.34], drain: [.21, -2.49, 3.09],
};
const FLOWS = ['left', 'right', 'merge', 'drain'] as const;
const SEGMENTS = 36;
const ACROSS = [-1, -.72, -.34, 0, .34, .72, 1];

function smoothPoint(points: readonly Point[], fraction: number, destination: Vec3): void {
    const pathT = Math.min(points.length - 1, Math.max(0, fraction * (points.length - 1)));
    const i = Math.min(points.length - 2, Math.floor(pathT));
    const t = pathT - i;
    const [a, b, c, d] = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
    const coordinate = (axis: number) => .5 * ((2 * b[axis]) + (-a[axis] + c[axis]) * t
        + (2 * a[axis] - 5 * b[axis] + 4 * c[axis] - d[axis]) * t * t
        + (-a[axis] + 3 * b[axis] - 3 * c[axis] + d[axis]) * t * t * t);
    destination.set(coordinate(0), coordinate(1), coordinate(2));
}

class StreamRibbon {
    readonly node: Node;
    readonly mesh: Mesh;
    private readonly renderer: MeshRenderer;
    private readonly positions = new Float32Array((SEGMENTS + 1) * ACROSS.length * 3);
    private readonly colors = new Float32Array((SEGMENTS + 1) * ACROSS.length * 4);
    private readonly indices = new Uint16Array(SEGMENTS * (ACROSS.length - 1) * 12);
    private readonly point = new Vec3();
    private readonly next = new Vec3();

    constructor(parent: Node, name: Flow, material: Material) {
        this.node = new Node(name + ' water');
        parent.addChild(this.node);
        let index = 0;
        for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < ACROSS.length - 1; j++) {
            const a = i * ACROSS.length + j, b = a + ACROSS.length;
            this.indices.set([a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b], index);
            index += 12;
        }
        this.mesh = utils.MeshUtils.createDynamicMesh(0, {
            positions: this.positions, colors: this.colors, indices16: this.indices,
            minPos: new Vec3(-5, -4, -1), maxPos: new Vec3(5, 4, 7),
        }, undefined, {
            maxSubMeshes: 1, maxSubMeshVertices: (SEGMENTS + 1) * ACROSS.length,
            maxSubMeshIndices: this.indices.length,
        });
        this.renderer = this.node.addComponent(MeshRenderer);
        this.renderer.mesh = this.mesh;
        this.renderer.setMaterial(material, 0);
        this.node.active = false;
    }

    paint(path: readonly Point[], length: number, width: number, time: number, surge: number, dry = false): void {
        this.node.active = length > 0 && width > 0;
        if (!this.node.active) return;
        for (let i = 0; i <= SEGMENTS; i++) {
            const position = i / SEGMENTS * length;
            smoothPoint(path, position, this.point);
            const direction = position > .992 ? -1 : 1;
            smoothPoint(path, position + .008 * direction, this.next);
            const dx = (this.next.x - this.point.x) * direction, dy = (this.next.y - this.point.y) * direction;
            const size = Math.hypot(dx, dy) || 1;
            const nx = size < .00001 ? 1 : -dy / size;
            const ny = size < .00001 ? 0 : dx / size;
            const taper = .62 + .38 * Math.min(1, i / 5, (SEGMENTS - i + 2) / 6);
            for (let j = 0; j < ACROSS.length; j++) {
                const lateral = ACROSS[j], edge = Math.abs(lateral);
                const wave = Math.sin(position * 112 - time * (18 + surge * 5) + lateral * 2.7);
                const shimmer = Math.max(0, Math.sin(position * 49 - time * 11 - lateral * 3));
                const foam = Math.pow(Math.max(0, wave), 8) * (.16 + surge * .08);
                const sheen = (1 - edge) * (.14 + shimmer * .4) + foam;
                const spread = width * taper * (1 + wave * .08 + surge * .07);
                const index = i * ACROSS.length + j;
                const vertex = index * 3, color = index * 4;
                this.positions[vertex] = this.point.x + nx * lateral * spread;
                this.positions[vertex + 1] = this.point.y + ny * lateral * spread;
                this.positions[vertex + 2] = this.point.z + (1 - edge * edge) * (.08 + .02 * wave);
                this.colors[color] = dry ? .29 : Math.min(1, .10 + sheen * 1.3);
                this.colors[color + 1] = dry ? .51 : Math.min(1, .57 + sheen * .66);
                this.colors[color + 2] = dry ? .48 : Math.min(1, .68 + sheen * .55);
                this.colors[color + 3] = 1;
            }
        }
        this.mesh.updateSubMesh(0, {positions: this.positions, colors: this.colors, indices16: this.indices});
        this.renderer.onGeometryChanged();
    }
}

function section(cell: Voxel, scale: number): ShellSection {
    const x = cell.x / scale, y = cell.y / scale, z = cell.z / scale;
    if (y >= -.48 || (Math.abs(x) > 1.35 && y > -1.51)) {
        const side = x < 0 ? 'left' : 'right';
        return y > 1.42 ? `${side}-top` : y > .53 ? `${side}-middle` : side;
    }
    return z > .15 && y > -2.08 ? 'merge' : 'drain';
}

function glaze(geometry: ReturnType<typeof primitives.sphere>): Mesh {
    const colors: number[] = [];
    const normals = geometry.normals ?? [];
    for (let i = 0; i < normals.length; i += 3) {
        const [x, y, z] = [normals[i], normals[i + 1], normals[i + 2]];
        const key = Math.max(0, -.45 * x + .71 * y + .54 * z);
        const highlight = Math.pow(Math.max(0, -.41 * x + .54 * y + .73 * z), 11) * .21;
        const brightness = Math.min(1, .57 + .34 * key + highlight);
        colors.push(brightness, brightness, Math.min(1, brightness + .025), 1);
    }
    return utils.MeshUtils.createMesh({...geometry, colors});
}

export class WaterRescueScene {
    readonly root: Node;
    readonly duck: Node;
    private readonly shell = new Map<ShellSection, Node>();
    private readonly channels = new Map<Branch, StreamRibbon>();
    private readonly ribbons = new Map<Flow, StreamRibbon>();
    private readonly meshAssets: Mesh[] = [];
    private readonly materials = new Map<string, Material>();
    private readonly debris: Debris[] = [];
    private particleCursor = 0;
    private readonly spouts: Node[] = [];
    private landed = false;
    private mergeAt = Infinity;
    private wonAt = Infinity;
    private leftImpact = -Infinity;
    private rightImpact = -Infinity;

    constructor(parent: Node) {
        this.root = new Node('Rotating water sculpture');
        parent.addChild(this.root);
        const sphere = this.track(glaze(primitives.sphere(.5, {segments: 20})));
        const pebble = this.track(glaze(primitives.box()));
        const disk = this.track(glaze(primitives.cylinder(.5, .5, .25, {radialSegments: 40})));
        this.duck = createHarborDuck(this.root, color => this.material(color, 'vertices'), sphere, 11);
        this.duck.setScale(1, 1, 1);
        this.shape(this.root, 'Glazed basin', disk, this.material('#23695e', 'vertices'), [0, -2.93, .60], [6.05, 1.25, 6.84]);
        this.shape(this.root, 'Pool water edge', disk, this.material('#90d0b3', 'vertices'), [0, -2.76, .60], [5.68, .55, 6.44]);
        this.shape(this.root, 'Pool water', disk, this.material('#50aeb0', 'vertices'), [0, -2.70, .60], [5.35, .32, 6.02]);
        this.shape(this.root, 'Pool reflection', disk, this.material('#70c6b2', 'vertices'),
            [-.50, -2.654, 2.44], [3.38, .07, .62]);
        this.createShell();
        const waterMaterial = this.material('#ffffff', 'vertices');
        for (const flow of FLOWS) {
            const ribbon = new StreamRibbon(this.root, flow, waterMaterial);
            this.ribbons.set(flow, ribbon);
            this.track(ribbon.mesh);
        }
        for (const side of ['left', 'right'] as const) {
            const guide = new StreamRibbon(this.root, side, waterMaterial);
            guide.node.name = side + ' dry channel';
            guide.paint(ROUTES[side], 1, .057, 0, 0, true);
            this.channels.set(side, guide);
            this.track(guide.mesh);
            const origin = ROUTES[side][0];
            const spout = new Node('Brass spout assembly');
            this.root.addChild(spout);
            this.spouts.push(spout);
            this.shape(spout, 'Brass spout', disk, this.material('#b8783c', 'vertices'), origin, [.70, 1.30, .70]);
            this.shape(spout, 'Brass rim', disk, this.material('#f1b367', 'vertices'),
                [origin[0], origin[1] + .14, origin[2]], [.81, .28, .81]);
            this.shape(spout, 'Valve blue inset', disk, this.material('#67dfda', 'vertices'),
                [origin[0], origin[1] + .18, origin[2]], [.53, .20, .53]);
        }
        for (let i = 0; i < 54; i++) {
            const foam = i % 3 !== 0;
            const node = this.shape(this.root, foam ? 'Pool foam' : 'Clay chip', foam ? sphere : pebble,
                this.material(foam ? (i % 2 ? '#c1fff1' : '#f0ffef') : CLAY[i % CLAY.length], foam ? 'flat' : 'vertices'),
                [0, 0, 0], [1, 1, 1]);
            node.active = false;
            this.debris.push({node, origin: new Vec3(), velocity: new Vec3(), age: 0, lifetime: 0, size: 0, roll: 0});
        }
    }

    private material(hex: string, kind: 'flat' | 'vertices'): Material {
        const key = kind + hex;
        const existing = this.materials.get(key);
        if (existing) return existing;
        const material = new Material();
        material.initialize({effectName: 'builtin-unlit', defines: {USE_VERTEX_COLOR: kind === 'vertices'}});
        material.setProperty('mainColor', new Color(hex));
        this.materials.set(key, material);
        return material;
    }

    private track(mesh: Mesh): Mesh {
        this.meshAssets.push(mesh);
        return mesh;
    }

    private shape(parent: Node, name: string, mesh: Mesh, material: Material, p: Point, scale: Point): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.setPosition(...p);
        node.setScale(...scale);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        renderer.setMaterial(material, 0);
        return node;
    }

    private createShell(): void {
        const scale = harborDuckScale(11);
        const shell = makeRaincoatSurface();
        for (const part of [...FLOWS, 'left-top', 'left-middle', 'right-top', 'right-middle'] as const) {
            const index = new BlockMeshIndex(shell.filter(cell => section(cell, scale) === part).map(cell => ({
                ...cell, color: Math.abs(cell.x * 13 + cell.y * 17 + cell.z * 23) % CLAY.length,
            })), CLAY);
            const positions: number[] = [], colors: number[] = [], indices: number[] = [];
            for (const chunk of index.chunkKeys) {
                const geometry = index.makeChunk(chunk);
                const start = positions.length / 3;
                positions.push(...geometry.positions);
                colors.push(...geometry.colors);
                indices.push(...geometry.indices.map(index => index + start));
            }
            const mesh = this.track(utils.MeshUtils.createMesh({positions, colors, indices}));
            this.shell.set(part, this.shape(this.root, part + ' clay', mesh, this.material('#ffffff', 'vertices'), [0, 0, 0],
                [1 / scale, 1 / scale, 1 / scale]));
        }
    }

    reset(): void {
        this.mergeAt = this.wonAt = Infinity;
        this.landed = false;
        for (const spout of this.spouts) spout.active = true;
        this.leftImpact = this.rightImpact = -Infinity;
        this.duck.setPosition(0, 0, 0);
        this.duck.setRotationFromEuler(0, 0, 0);
        for (const shell of this.shell.values()) shell.active = true;
        for (const channel of this.channels.values()) channel.node.active = true;
        for (const ribbon of this.ribbons.values()) ribbon.node.active = false;
        for (const particle of this.debris) particle.node.active = false;
    }

    impact(event: WaterArrival, time: number): void {
        const shell = this.shell.get(event);
        if (shell) shell.active = false;
        if (event === 'merge') this.mergeAt = time;
        if (event === 'drain') this.wonAt = time;
        if (event === 'left') this.leftImpact = time;
        if (event === 'right') this.rightImpact = time;
        const strength = event === 'drain' ? 3 : event === 'merge' ? 2 : 1;
        this.spray(OUTLETS[event], 11 + strength * 5, strength);
    }

    private spray([x, y, z]: Point, count: number, strength: number): void {
        for (let i = 0; i < count; i++) {
            const particle = this.debris[this.particleCursor++ % this.debris.length];
            const angle = i * 2.399963;
            const spread = (i % 5) / 5;
            particle.origin.set(x + Math.cos(angle) * spread, y + (i % 4) * .15, z + Math.sin(angle) * .25);
            particle.velocity.set(Math.cos(angle) * (1 + spread * strength * 1.6), 1.1 + (i % 7) * .67,
                1 + Math.sin(angle) * .5 + strength * .64);
            particle.age = 0;
            particle.lifetime = .40 + (i % 6) * .095;
            particle.size = .10 + spread * (particle.node.name === 'Clay chip' ? .28 : .17);
            particle.roll = angle * 50;
            particle.node.setPosition(particle.origin);
            particle.node.active = true;
        }
    }

    update(game: WaterRescueGame, time: number, dt: number): void {
        const afterWin = time - this.wonAt;
        const afterMerge = time - this.mergeAt;
        const waterVisible = afterWin < 1.25 ? Math.min(1, (1.25 - afterWin) * 3) : 0;
        const afterImpact = time - Math.max(this.leftImpact, this.rightImpact);
        const pressure = game.merged ? 1 : 0;
        for (const side of ['left', 'right'] as const) {
            const progress = game.progress(side);
            this.channels.get(side)!.node.active = !game.opened(side);
            for (const [section, at, point] of [['top', .26, 1], ['middle', .52, 2]] as const) {
                const tile = this.shell.get(`${side}-${section}`)!;
                if (progress < at || !tile.active) continue;
                tile.active = false;
                this.spray(ROUTES[side][point], 7, 1);
            }
            this.ribbons.get(side)!.paint(ROUTES[side], progress, .185 * waterVisible, time, pressure);
        }
        this.ribbons.get('merge')!.paint(ROUTES.merge, game.merged ? Math.min(1, afterMerge * 5) : 0,
            (.34 + .20 * Math.max(0, 1 - afterMerge * 2)) * waterVisible, time, 2);
        this.ribbons.get('drain')!.paint(ROUTES.drain, game.progress('drain'), .67 * waterVisible, time, 3);

        for (const particle of this.debris) {
            if (!particle.node.active) continue;
            particle.age += dt;
            if (particle.age >= particle.lifetime) { particle.node.active = false; continue; }
            const t = particle.age, from = particle.origin, velocity = particle.velocity;
            particle.node.setPosition(from.x + velocity.x * t, Math.max(-2.65, from.y + velocity.y * t - 7.8 * t * t),
                from.z + velocity.z * t);
            const size = particle.size * Math.min(1, (1 - t / particle.lifetime) * 4);
            particle.node.setScale(size, size * (particle.node.name === 'Clay chip' ? .73 : 1.18), size);
            particle.node.setRotationFromEuler(t * 440, particle.roll + t * 240, t * 320);
        }
        if (game.won) {
            const t = Math.max(0, Math.min(1, afterWin / .90));
            this.duck.setPosition(t * .48, Math.sin(t * Math.PI) * .69 - t * .27, 1.57 * t);
            this.duck.setRotationFromEuler(8 * Math.sin(t * Math.PI * 2), t * 16, -7 * Math.sin(t * Math.PI));
            if (!this.landed && t === 1) {
                this.landed = true;
                this.spray([.40, -2.66, 3.17], 22, 3);
            }
            if (afterWin > 1.15) for (const spout of this.spouts) spout.active = false;
        } else if (afterImpact < .34) {
            this.duck.setRotationFromEuler(2.5 * Math.sin(afterImpact * 22), 0, .7 * Math.sin(afterImpact * 18));
        } else {
            this.duck.setRotationFromEuler(0, 0, 0);
        }
    }

    dispose(): void {
        for (const mesh of this.meshAssets) mesh.destroy();
        for (const material of this.materials.values()) material.destroy();
    }
}
