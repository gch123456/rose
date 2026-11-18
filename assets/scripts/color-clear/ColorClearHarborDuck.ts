import {MeshRenderer, Node} from 'cc';
import type {Material, Mesh} from 'cc';
import {harborDuckParts, harborDuckScale} from './ColorClearHarborDuckGeometry';

/** An intact duck that can be revealed independently of its voxel shell. */
export function createHarborDuck(parent: Node, materialFor: (hex: string) => Material, sphere: Mesh, stageId: number): Node {
    const duck = new Node('RescuedDuck');
    duck.layer = parent.layer;
    parent.addChild(duck);
    const scale = harborDuckScale(stageId);
    duck.setScale(scale, scale, scale);
    for (const part of harborDuckParts(stageId)) {
        const node = new Node(part.name);
        node.layer = duck.layer;
        duck.addChild(node);
        node.setPosition(...part.position);
        node.setScale(...part.size);
        if (part.roll) node.setRotationFromEuler(0, 0, part.roll);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = sphere;
        renderer.setMaterial(materialFor(part.color), 0);
    }
    return duck;
}
