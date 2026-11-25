// Used as the Home scene's existing GoDuck component only in the staged build.
import { _decorator, Component, Node } from 'cc';
import { ColorClearView } from './color-clear/ColorClearView';
import { WaterRescueView } from './color-clear/WaterRescueView';

const { ccclass } = _decorator;

@ccclass('GoDuck')
export class GoDuck extends Component {
    onLoad(): void {
        const scene = this.node.scene;
        if (!scene) throw new Error('Rescue bootstrap has no scene');
        const root = new Node('DuckRescue');
        scene.addChild(root);

        // The authored Home scene owns the old camera and editor preview. The
        // rescue view creates its own camera and UI under a scene-level root.
        const home = this.node.parent;
        if (home && home !== scene) home.active = false;
        const water = root.addComponent(WaterRescueView);
        water.openLegacy = () => {
            water.suspendForLegacy();
            root.active = false;
            const legacyRoot = new Node('DuckRescueLegacy');
            scene.addChild(legacyRoot);
            const legacy = legacyRoot.addComponent(ColorClearView);
            legacy.addWaterEntry(() => {
                legacyRoot.active = false;
                legacyRoot.destroy();
                root.active = true;
                water.restoreFromLegacy();
            });
        };
    }
}
