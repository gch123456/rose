import { _decorator, Component, Graphics, Color } from 'cc';
const { ccclass, executeInEditMode } = _decorator;
/** Persistent edit-scene illustration; GoDuck hides this node when the game starts. */
@ccclass('EditorHomePreview')
@executeInEditMode
export class EditorHomePreview extends Component {
    onLoad() {
        const ink = this.getComponent(Graphics) || this.addComponent(Graphics);
        ink.clear();
        ink.fillColor = new Color('#152c36');
        ink.rect(-640, -360, 1280, 720); ink.fill();
        ink.fillColor = new Color('#f4d85e');
        ink.circle(0, -70, 28); ink.fill();
        ink.fillColor = new Color('#6dbf9a');
        ink.circle(14, -50, 17); ink.fill();
    }
}
