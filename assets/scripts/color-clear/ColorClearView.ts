import { BlockMeshIndex } from './ColorClearBlockMesh';
import { _decorator, Component, Node, Camera, Canvas, UITransform, Graphics, Label, Color, Layers, Mesh, MeshRenderer, Material, primitives, utils, input, Input, EventTouch, view, ResolutionPolicy, game, Game, resources, AudioClip, AudioSource, sys, isValid, Vec3, Quat, BlockInputEvents, tween, ImageAsset, Texture2D, SpriteFrame, Sprite, JsonAsset } from 'cc';
import { ColorClearGame, FLIGHT_SECONDS } from './ColorClearGame';
import type { Voxel, RewardTicket, PieceShape } from './ColorClearGame';
import { makeReleaseLevel, RELEASE_LEVELS, chooseReleaseQueue } from './ColorClearRelease';
import {ModelOrbit} from './ColorClearOrbit';
import {AlbumService} from './ColorClearAlbum';
import {wechatAlbumTransport} from './ColorClearWechat';
import {specialPieceGeometry} from './ColorClearGeometry';
const { ccclass, property } = _decorator;
const FIRST_RESCUE = RELEASE_LEVELS[0].id;
const LAST_RESCUE = RELEASE_LEVELS[1].id;
const STAGE_LAYER = 1 << 18;
const CREAM = '#fff7e7';
const TEAL = '#245d51';
const SLOT_Y = -199;
const FRONT_Y = -319;
const PROGRESS_KEY = 'color-clear.campaign.unlocked.v1';
const SYMBOLS = ['●', '▲', '◆', '■', '✦', '⬟'];
type Card = { node: Node; pen: Graphics; label: Label; paintKey?: string };
type BlockBatch = { node: Node; renderer: MeshRenderer; mesh: Mesh };
/** Attach only to a new empty scene after selecting the colorClear engine profile.
 * Browser preview is validated independently; this adapter requires Creator import/runtime validation. */
@ccclass('ColorClearView')
export class ColorClearView extends Component {
    @property albumApiOrigin = '';
    private orbit=new ModelOrbit();
    private qPitch=new Quat();private qYaw=new Quat();private qModel=new Quat();
    private album!: AlbumService;private albumPanel!: Node;private albumText!: Label;private albumResume=false;
    @property showProgress = false;
    @property showRemaining = false;
    @property showLabels = false;
    @property showBackground = true;
    private model = new ColorClearGame(makeReleaseLevel(FIRST_RESCUE), 'warmup');
    private colors: readonly string[] = RELEASE_LEVELS[0].palette;
    private wizardPayload: unknown;
    private wizardQueue = -1;
    private wizardLoading = false;
    private camp!: Node;
    private campTitle!: Label;
    private campStatus!: Label;
    private continueButton!: Card;
    private emergencyButton!: Card;
    private albumCards: Card[] = [];
    private albumPortraits: Sprite[] = [];
    private albumMarks: Label[] = [];
    private ownedPictures: {texture: Texture2D; frame: SpriteFrame}[] = [];
    private albumFromCamp = false;
    private runStarted = false;
    private materialsByColor = new Map<string, Material>();
    private bonusUntil = 0;
    private bonusLabel!: Label;
    private campImage: Texture2D | null = null;
    private campFrame: SpriteFrame | null = null;
    private world!: Node;
    private ui!: Node;
    private dialog!: Node;
    private camera!: Camera;
    private cube!: Mesh;
    private meshCache = new Map<PieceShape, Mesh>();
    private rewardPanel!: Node;
    private rewardTitle!: Label;
    private pendingReward: {owner: ColorClearGame; ticket: RewardTicket} | null = null;
    private reserveCards: Card[] = [];
    private projectilePen!: Graphics;
    private uiCamera!: Camera;
    private readonly shotTint = new Color('#a9d9cf');
    private readonly shotLight = new Color('#ffffed');
    private readonly localPoint = new Vec3();
    private readonly screenPoint = new Vec3();
    private readonly uiPoint = new Vec3();
    private paintedEffects = false;
    private fragments: { x: number; y: number; vx: number; vy: number; life: number; color: Color }[] = [];
    private fragmentColors: Color[] = [];
    private blockIndex: BlockMeshIndex | null = null;
    private readonly batches = new Map<string, BlockBatch>();
    private readonly dirtyBatches = new Set<string>();
    private readonly details = new Map<number, Node>();
    private readonly cellsById = new Map<number, Voxel>();
    private meshRadius = 1;
    private renderedYaw = NaN;
    private renderedPitch = NaN;
    private slots: Card[] = [];
    private lastDrag = 0;
    private supplies: Card[] = [];
    private title!: Label;
    private status!: Label;
    private remaining!: Label;
    private phaseText!: Label;
    private resultText!: Label;
    private dragId = -1;
    private sound!: AudioSource;
    private clips = new Map<string, AudioClip>();
    private muted = false;
    private lastHitSound = 0;
    private clock = 0;
    private unlocked = 1;

    onLoad(): void {
        this.album=new AlbumService(sys.localStorage,wechatAlbumTransport(this.albumApiOrigin));
        view.setDesignResolutionSize(640, 1120, ResolutionPolicy.SHOW_ALL);
        try { this.unlocked = Number(sys.localStorage.getItem(PROGRESS_KEY)) === 2 ? 2 : 1; this.muted = sys.localStorage.getItem('color-clear.muted') === 'true'; } catch { /* storage optional */ }
        const box = primitives.box();
        const normals = box.normals ?? [];
        box.colors = [];
        for (let i = 0; i < normals.length; i += 3) {
            const shade = normals[i + 1] > .5 ? 1 : normals[i + 1] < -.5 ? .71 : normals[i + 2] > .5 ? .94 : .83;
            box.colors.push(shade, shade, shade, 1);
        }
        this.cube = utils.MeshUtils.createMesh(box);
        this.meshCache.set('box', this.cube);
        this.meshCache.set('sphere',utils.MeshUtils.createMesh(primitives.sphere(.5)));
        this.meshCache.set('cylinder',utils.MeshUtils.createMesh(primitives.cylinder(.5,.5,1)));
        for(const kind of ['hemisphere','wedge'] as const)this.meshCache.set(kind,utils.MeshUtils.createMesh(specialPieceGeometry(kind)));
        this.createStageBackground();
        this.camera = this.child(this.node, 'ColorClearCamera', false).addComponent(Camera);
        this.camera.node.setPosition(0, 0, 30); this.camera.projection = Camera.ProjectionType.ORTHO; this.camera.near = .1; this.camera.far = 100;
        this.camera.visibility = Layers.Enum.DEFAULT; this.camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; this.camera.priority = 0;
        this.world = this.child(this.node, 'ColorClearModel', false);
        this.ui = this.child(this.node, 'ColorClearUI', true); this.ui.addComponent(UITransform).setContentSize(640, 1120);
        const canvas = this.ui.addComponent(Canvas);
        const uiCamera = this.child(this.node, 'ColorClearUICamera', false).addComponent(Camera);
        uiCamera.node.setPosition(0, 0, 1000); uiCamera.projection = Camera.ProjectionType.ORTHO; uiCamera.orthoHeight = 560; uiCamera.near = 1; uiCamera.far = 2000;
        uiCamera.visibility = Layers.Enum.UI_2D; uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; uiCamera.priority = 10; canvas.cameraComponent = uiCamera;this.uiCamera=uiCamera;
        this.title = this.text(this.ui, '', 29, 0, 502, 435, '#204d42');
        this.title.isBold = true;
        this.bonusLabel = this.text(this.ui, '✦ 同色 5 连消', 28, 0, 386, 400, '#8a5018');
        this.bonusLabel.node.active = false;
        this.button(this.ui, 'Ⅱ', -260, 490, 60, 60, () => this.pause());
        this.remaining = this.text(this.ui, '', 18, 0, 393, 540, '#8a9991');
        this.text(this.ui, '拖动查看另一面', 17, 0, -108, 550, '#486a61');
        this.text(this.ui, '发射台', 19, -240, -148, 105, '#365b51');
        this.text(this.ui, '点前排装填', 19, -213, -267, 150, '#365b51');
        this.status = this.text(this.ui, '', 16, 90, -150, 360, '#8a9991');
        for (let i = 0; i < 6; i++) this.slots.push(this.button(this.ui, '', -245 + i * 98, SLOT_Y, 86, 90, () => {if(i===this.model.slots.length)this.startReward('slot');}, '#f0f2e9'));
        for(let i=0;i<6;i++){const card=this.button(this.ui,'',-245+i*98,-259,86,40,()=>{if(this.model.takeReserve(i))this.refresh(true);});card.node.active=false;this.reserveCards.push(card);}
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            const card = this.button(this.ui, '', -222 + col * 148, (row === 0 ? FRONT_Y : -337 - row * 48), 134, row ? 39 : 74, () => { if (row === 0 && this.model.phase === 'playing') {
                const slot = this.model.slots.indexOf(null);
                if (this.model.select(col)) {
                    const capsule = this.model.slots[slot]!; this.refresh(true);
                    const flight = this.button(this.ui, `${SYMBOLS[capsule.color]} ${capsule.ammo}`, -222 + col * 148, FRONT_Y, 104, 60, () => {}, this.colors[capsule.color]);
                    flight.node.off(Node.EventType.TOUCH_END); // Decorative flight must not intercept another supply tap.
                    tween(flight.node).to(.18, { position: new Vec3(-245 + slot * 98, SLOT_Y, 0) }).call(() => flight.node.destroy()).start();
                }
            } });
            card.label.fontSize = row ? 24 : 30;
            card.label.isBold = !row;
            this.supplies.push(card);
        }
        this.text(this.ui, '没有倒计时，想好了再点 · 同色弹药匹配', 16, 0, -530, 590, '#8a9991');
        this.dialog = this.child(this.ui, 'ColorClearDialog', true);this.dialog.addComponent(BlockInputEvents);
        this.dialog.addComponent(UITransform).setContentSize(640, 1120);
        this.drawModal(this.dialog, 570, 740, -63);
        this.phaseText = this.text(this.dialog, '', 38, 0, 170, 560);
        this.resultText = this.text(this.dialog, '', 22, 0, 70, 530, '#718678');
        this.continueButton = this.button(this.dialog, '继续', 0, -40, 440, 82, () => {
            if (this.model.phase === 'paused') this.model.resume();
            else this.load(this.model.phase === 'won' ? LAST_RESCUE : this.model.level.id);
            this.refresh(true);
        }, '#acd6c2');
        this.emergencyButton = this.button(this.dialog, '✦ 应急暂存一颗', 0, -130, 440, 64, () => {
            if (this.model.useEmergencyReserve()) this.refresh(true);
        }, '#f9d590');
        this.button(this.dialog, '重新开始这一关', 0, -222, 440, 64, () => this.load(this.model.level.id));
        this.button(this.dialog, '声音开关', 0, -308, 440, 64, () => { this.muted = !this.muted; try { sys.localStorage.setItem('color-clear.muted', String(this.muted)); } catch { /* optional */ } this.refresh(true); });
        this.rewardPanel=this.child(this.ui,'SimulatedReward',true);this.rewardPanel.addComponent(BlockInputEvents);this.rewardPanel.addComponent(UITransform).setContentSize(640,1120);this.paint(this.rewardPanel.addComponent(Graphics),640,1120,'#eef2e0',0);
        this.rewardTitle=this.text(this.rewardPanel,'开发测试 · 模拟广告',28,0,160,560);
        this.text(this.rewardPanel,'没有接入真实微信广告',21,0,80,520,'#718678');
        this.button(this.rewardPanel,'模拟看完并领取',0,-30,440,82,()=>this.finishReward(true),'#68ad89');
        this.button(this.rewardPanel,'取消，不领取',0,-145,440,72,()=>this.finishReward(false));this.rewardPanel.active=false;
        this.projectilePen=this.child(this.ui,'ProjectileOverlay',true).addComponent(Graphics);
        this.albumPanel = this.child(this.ui, 'Album', true);
        this.albumPanel.addComponent(BlockInputEvents);
        this.albumPanel.addComponent(UITransform).setContentSize(640, 1120);
        this.drawModal(this.albumPanel, 574, 590);
        this.text(this.albumPanel, '救援图鉴', 41, 0, 221, 450, TEAL).isBold = true;
        this.albumText = this.text(this.albumPanel, '', 23, 0, 159, 440, '#46683e');
        this.albumCards = RELEASE_LEVELS.map((rescue, index) => {
            const card = this.button(this.albumPanel, rescue.name, -134 + index * 268, -19, 242, 272, () => {}, '#eeeade');
            card.label.node.setPosition(0, -97);
            card.label.isBold = true;
            this.text(card.node, String(index + 1).padStart(2, '0'), 17, -88, 104, 50, '#4c6c61');
            this.albumMarks.push(this.text(card.node, '?', 54, 0, 14, 130, '#617d6c'));
            const portrait = this.loadPicture(card.node, index === 0 ? 'raincoat-card' : 'wizard-card', 172, 172, 0, 15);
            portrait.node.active = false;
            this.albumPortraits.push(portrait);
            return card;
        });
        this.button(this.albumPanel, '返回', 0, -225, 330, 62, () => this.closeAlbum(), '#dcece0');
        this.albumPanel.active = false;
        this.button(this.ui, '图鉴', 220, -535, 116, 43, () => this.openAlbum(), '#dcece0');
        this.button(this.ui, '营地', -220, -535, 116, 43, () => this.openCamp(), '#dcece0');
        this.button(this.dialog, '回救援营地', 0, -393, 440, 64, () => this.openCamp());
        this.createCamp();
        this.sound = this.node.addComponent(AudioSource);
        for (const name of ['load', 'hit', 'chain', 'won', 'lost']) resources.load(`color-clear-audio/${name}`, AudioClip, (error, clip) => { if (!error && clip && isValid(this.node)) this.clips.set(name, clip); });
        input.on(Input.EventType.TOUCH_START, this.touchStart, this); input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        game.on(Game.EVENT_HIDE, this.pause, this);
        this.openCamp();
    }
    private child(parent: Node, name: string, ui: boolean): Node { const n = new Node(name); n.layer = ui ? Layers.Enum.UI_2D : Layers.Enum.DEFAULT; parent.addChild(n); return n; }
    private text(parent: Node, value: string, size: number, x: number, y: number, width: number, color = '#293b39'): Label {
        const n = this.child(parent, 'Text', true); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(width, size * 3.6);
        const l = n.addComponent(Label); l.string = value; l.fontSize = size; l.lineHeight = size * 1.45; l.color = new Color(color); l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER; l.overflow = Label.Overflow.SHRINK; if(!this.showLabels&&['A LITTLE COLOR BREAK','转转积木','↔ 上下左右拖动，发现另一面','发射台','下一批颜色 · 点前排入槽','没有倒计时，想好了再点 · 同色弹药匹配'].includes(value))n.active=false;return l;
    }
    private paint(g: Graphics, w: number, h: number, hex: string, radius = 20): void { g.clear(); g.fillColor = new Color(hex); g.roundRect(-w / 2, -h / 2, w, h, radius); g.fill(); }
    private outline(g: Graphics, width: number, height: number, hex: string, radius: number): void {
        g.strokeColor = new Color(hex);
        g.lineWidth = 2;
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.stroke();
    }
    private panel(parent: Node, name: string, x: number, y: number, w: number, h: number,
        fill: string, edge: string, radius: number): Graphics {
        const node = this.child(parent, name, true);
        node.layer = parent.layer;
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(w, h);
        const pen = node.addComponent(Graphics);
        this.paint(pen, w, h, fill, radius);
        this.outline(pen, w, h, edge, radius);
        return pen;
    }
    private createStageBackground(): void {
        const node = this.child(this.node, 'BackdropCanvas', false);
        node.layer = STAGE_LAYER;
        node.addComponent(UITransform).setContentSize(640, 1120);
        const canvas = node.addComponent(Canvas);
        const camera = this.child(this.node, 'BackdropCamera', false).addComponent(Camera);
        camera.node.setPosition(0, 0, 1000);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 560;
        camera.near = 1;
        camera.far = 2000;
        camera.priority = -10;
        camera.visibility = STAGE_LAYER;
        camera.clearColor = new Color(CREAM);
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        canvas.cameraComponent = camera;
        const pen = this.panel(node, 'ModelStage', 0, 167, 596, 570,
            this.showBackground ? '#deeee5' : '#f6f4e8', '#cbddd0', 38);
        if (this.showBackground) {
            pen.fillColor = new Color('#f0e1bf');
            pen.ellipse(0, -225, 174, 27);
            pen.fill();
            pen.fillColor = new Color('#fcf2d9');
            pen.ellipse(0, -216, 174, 22);
            pen.fill();
            pen.fillColor = new Color('#ffffff88');
            pen.roundRect(-269, 163, 120, 25, 13);
            pen.roundRect(165, 113, 92, 19, 10);
            pen.fill();
        }
        this.panel(node, 'AmmoPanel', 0, -393, 596, 249, '#fffaf0', '#e3d8bb', 28);
    }
    private drawModal(node: Node, width: number, height: number, y = 0): void {
        const pen = node.addComponent(Graphics);
        pen.fillColor = new Color('#183c35a6');
        pen.rect(-1100, -1100, 2200, 2200);
        pen.fill();
        this.panel(node, 'ModalCard', 0, y, width, height, CREAM, '#dec89e', 31);
    }
    private loadPicture(parent: Node, name: string, w: number, h: number, x: number, y: number): Sprite {
        const art = this.child(parent, 'Artwork', true);
        art.setPosition(x, y);
        art.addComponent(UITransform).setContentSize(w, h);
        const sprite = art.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('color-clear-release/' + name, ImageAsset, (error, asset) => {
            if (error || !asset || !isValid(art)) return;
            const texture = new Texture2D();
            texture.image = asset;
            const frame = new SpriteFrame();
            frame.texture = texture;
            sprite.spriteFrame = frame;
            this.ownedPictures.push({texture, frame});
        });
        return sprite;
    }
    private button(parent: Node, label: string, x: number, y: number, w: number, h: number, click: () => void, color = '#edf1e5'): Card {
        const n = this.child(parent, 'Button', true); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); const pen = n.addComponent(Graphics); this.paint(pen, w, h, color);
        const l = this.text(n, label, 23, 0, 0, w - 10);
        n.on(Node.EventType.TOUCH_END, () => { if (isValid(this.node)) click(); }); return { node: n, pen, label: l };
    }
    private blockMaterial(hex: string, faceShading: boolean): Material {
        const key = hex + (faceShading ? ':faces' : '');
        let material = this.materialsByColor.get(key);
        if (!material) {
            material = new Material();
            material.initialize({ effectName: 'builtin-unlit', defines: { USE_INSTANCING: true, USE_VERTEX_COLOR: faceShading } });
            material.setProperty('mainColor', new Color(hex));
            this.materialsByColor.set(key, material);
        }
        return material;
    }
    private cubeNode(parent: Node, name: string, color: number, shape: PieceShape = 'box', tint?: string): Node {
        const node = this.child(parent, name, false);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = this.meshCache.get(shape)!;
        renderer.setMaterial(this.blockMaterial(tint ?? this.colors[color], shape === 'box'), 0);
        return node;
    }
    private load(id: number): void {
        if (id === LAST_RESCUE && !this.wizardPayload) {
            if (this.wizardLoading) return;
            this.wizardLoading = true;
            this.campStatus.string = '正在准备法师鸭…';
            this.resultText.string = '正在准备法师鸭…';
            resources.load('color-clear-release/wizard', JsonAsset, (error, asset) => {
                if (!isValid(this.node)) return;
                this.wizardLoading = false;
                if (error || !asset) {
                    this.campStatus.string = '模型加载失败，点出发重试';
                    this.resultText.string = '模型加载失败，请重试';
                    return;
                }
                this.wizardPayload = asset.json;
                this.load(id);
            });
            return;
        }
        let next: ColorClearGame;
        try {
            if (id === LAST_RESCUE) this.wizardQueue = chooseReleaseQueue(this.wizardQueue);
            next = new ColorClearGame(makeReleaseLevel(id, this.wizardPayload, this.wizardQueue),
                id === LAST_RESCUE ? 'challenge' : 'warmup');
        } catch (error) {
            this.campStatus.string = '关卡数据无法加载';
            this.resultText.string = '关卡数据无法加载';
            console.error(error);
            return;
        }
        if (this.pendingReward) this.pendingReward.owner.resolveReward(this.pendingReward.ticket, false);
        this.pendingReward = null;
        this.rewardPanel.active = false;
        this.model = next;
        this.colors = RELEASE_LEVELS[id === FIRST_RESCUE ? 0 : 1].palette;
        this.orbit.reset();
        this.dragId = -1;
        this.bonusUntil = 0;
        this.runStarted = true;
        this.camp.active = false;
        this.clearBatches();
        this.fragments = [];
        this.projectilePen.clear();
        this.paintedEffects = false;
        this.fragmentColors = this.colors.map(color => new Color(color));
        this.renderedYaw = this.renderedPitch = NaN;
        for (const card of [...this.slots, ...this.supplies, ...this.reserveCards]) card.paintKey = undefined;
        this.meshRadius = 1 + Math.max(...this.model.cells.map(cell => Math.hypot(cell.x, cell.y, cell.z)));
        this.cellsById.clear();
        this.blockIndex = new BlockMeshIndex(this.model.cells, this.colors);
        for (const key of this.blockIndex.chunkKeys) this.updateBatch(key);
        for (const cell of this.model.cells) {
            this.cellsById.set(cell.id, cell);
            if (!cell.visualDetail) continue;
            const owner = this.child(this.world, 'BlockAccent', false);
            owner.setPosition(cell.x, cell.y, cell.z);
            this.details.set(cell.id, owner);
            if (cell.visualDetail === 'eye') {
                const eye = this.cubeNode(owner, 'Eye', cell.color, 'sphere', '#253532');
                eye.setPosition(0, .04, .53);
                eye.setScale(.42, .55, .30);
                const glint = this.cubeNode(owner, 'EyeHighlight', cell.color, 'sphere', '#fffaf0');
                glint.setPosition(-.078, .148, .65);
                glint.setScale(.13, .13, .1);
            } else {
                const seam = this.cubeNode(owner, 'BillSeam', cell.color, 'box', '#9c692e');
                seam.setPosition(0, -.12, .5);
                seam.setScale(.73, .07, .07);
            }
        }
        this.camera.orthoHeight = (this.meshRadius - 1) * 2.48 + 1.5;
        this.camera.node.setPosition(0, -this.camera.orthoHeight * .23, 30);
        this.world.active = true;
        this.refresh(true);
    }
    private soundFor(name: string): void { const clip = this.clips.get(name); if (!this.muted && clip) this.sound.playOneShot(clip, name === 'hit' ? .2 : .45); }
    private clearBatches(): void {
        for (const {node, mesh} of this.batches.values()) {
            node.active = false;
            node.destroy();
            mesh.destroy();
        }
        for (const owner of this.details.values()) { owner.active = false; owner.destroy(); }
        this.batches.clear();
        this.details.clear();
        this.dirtyBatches.clear();
    }
    private updateBatch(key: string): void {
        const index = this.blockIndex!;
        const data = index.makeChunk(key);
        const previous = this.batches.get(key);
        if (!data.indices.length) {
            if (previous) previous.node.active = false;
            return;
        }
        const geometry = {
            positions: Float32Array.from(data.positions),
            colors: Float32Array.from(data.colors),
            indices16: Uint16Array.from(data.indices),
        };
        if (previous) {
            previous.mesh.updateSubMesh(0, geometry);
            previous.renderer.onGeometryChanged();
            previous.node.active = true;
            return;
        }
        const cells = index.cellCount(key);
        const edge = this.meshRadius;
        const mesh = utils.MeshUtils.createDynamicMesh(0, {
            ...geometry,
            minPos: {x: -edge, y: -edge, z: -edge},
            maxPos: {x: edge, y: edge, z: edge},
        }, undefined, { maxSubMeshes: 1, maxSubMeshVertices: cells * 24, maxSubMeshIndices: cells * 36 });
        const node = this.child(this.world, 'BlockBatch', false);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = mesh;
        renderer.setMaterial(this.blockMaterial('#ffffff', true), 0);
        this.batches.set(key, {node, renderer, mesh});
    }
    private projectCell(cell: Voxel): Vec3 {
        this.localPoint.set(cell.x, cell.y, cell.z);
        Vec3.transformMat4(this.localPoint, this.localPoint, this.world.worldMatrix);
        this.camera.worldToScreen(this.localPoint, this.screenPoint);
        this.uiCamera.screenToWorld(this.screenPoint, this.uiPoint);
        return this.ui.getComponent(UITransform)!.convertToNodeSpaceAR(this.uiPoint, this.localPoint);
    }
    private burst(cell: Voxel): void {
        if (this.fragments.length >= 28) return;
        const point = this.projectCell(cell);
        this.fragments.push({x: point.x, y: point.y, vx: (Math.random() - .5) * 84,
            vy: 40 + Math.random() * 44, life: .28, color: this.fragmentColors[cell.color]});
    }
    private refresh(_force = false): void {
        this.title.string = `第 ${this.model.level.id === FIRST_RESCUE ? '01' : '02'} 关 · ${this.model.level.name}`;
        this.remaining.node.active=this.showRemaining||this.showProgress;this.remaining.string=[this.showRemaining?`剩余 ${this.model.remaining} 块`:'',this.showProgress?`已清除 ${Math.round(this.model.progress*100)}%`:''].filter(Boolean).join(' · ');this.status.node.active=this.showLabels;
        this.status.string = this.model.flights.length ? '同色消除中' : '↔ 转一转找同色';
        this.slots.forEach((card, i) => {
            const capsule = this.model.slots[i];
            const fill = capsule ? this.colors[capsule.color] : '#e5ede3';
            if (card.paintKey !== fill) {
                card.paintKey = fill;
                this.paint(card.pen, 86, 90, fill);
                this.outline(card.pen, 86, 90, '#c5d9c8', 19);
                card.label.color = new Color(capsule ? this.ink(fill) : '#526c60');
            }
            card.label.string = i >= this.model.slots.length ? '扩槽' : capsule ? `${SYMBOLS[capsule.color]} ${capsule.ammo}` : '';
        });
        this.supplies.forEach((card, i) => {
            const row = Math.floor(i / 4), column = i % 4, capsule = this.model.supply[column][row];
            const mystery = this.model.isAmmoHidden(column, row);
            const color = capsule && !row ? this.colors[capsule.color] : mystery ? '#fbefd7' : '#f6f4e9';
            const swatch = capsule ? this.colors[capsule.color] : '';
            const key = color + ':' + swatch + ':' + mystery;
            if (card.paintKey !== key) {
                card.paintKey = key;
                this.paint(card.pen, 134, row ? 39 : 74, color, row ? 12 : 19);
                this.outline(card.pen, 134, row ? 39 : 74, mystery ? '#ad8e62' : '#ccd9cc', row ? 12 : 19);
                if (swatch && row) {
                    card.pen.fillColor = new Color(swatch);
                    card.pen.roundRect(-52, -11, 22, 22, 6);
                    card.pen.fill();
                }
                card.label.color = new Color(!row && capsule ? this.ink(color) : '#26463c');
            }
            card.label.string = capsule ? (row ? '    ' : SYMBOLS[capsule.color] + ' ') +
                (mystery ? '?' : capsule.ammo) : '·';
        });
        this.reserveCards.forEach((card, index) => {
            const capsule = this.model.reserve[index];
            card.node.active = !!capsule;
            if (!capsule) return;
            const fill = this.colors[capsule.color];
            if (card.paintKey !== fill) {
                card.paintKey = fill;
                this.paint(card.pen, 86, 40, fill);
                card.label.color = new Color(this.ink(fill));
            }
            card.label.string = SYMBOLS[capsule.color] + ' ' + capsule.ammo;
        });
        this.dialog.active = !this.camp.active && this.model.phase !== 'playing';
        this.continueButton.label.string = this.model.phase === 'won'
            ? this.model.level.id === FIRST_RESCUE ? '下一关 · 法师鸭' : '再救一次'
            : this.model.phase === 'paused' ? '继续救援' : '再试一次';
        this.emergencyButton.node.active = this.model.canUseEmergencyReserve;
        this.phaseText.string = this.model.phase === 'won' ? '安全抵达！' : this.model.phase === 'lost' ? '换个顺序再来' : '休息一下';
        this.resultText.string = this.model.phase === 'lost' ? this.model.reason : `已清除 ${this.model.cells.length - this.model.remaining} 块\n声音：${this.muted ? '关' : '开'}`;
    }
    private startReward(kind:'slot'|'continue'):void {
        const owner=this.model,ticket=owner.beginReward(kind);if(!ticket)return;this.pendingReward={owner,ticket};if(this.dragId>=0)this.orbit.release(true,0);this.dragId=-1;
        this.rewardTitle.string=kind==='slot'?`开发测试 · 模拟解锁第${owner.slots.length+1}槽`:'开发测试 · 模拟暂存续关';this.rewardPanel.active=true;this.refresh(true);
    }
    private finishReward(completed:boolean):void {
        const pending=this.pendingReward;if(!pending)return;this.pendingReward=null;this.rewardPanel.active=false;pending.owner.resolveReward(pending.ticket,completed);if(pending.owner===this.model)this.refresh(true);
    }
    private drawProjectiles(dt: number): void {
        const pen = this.projectilePen;
        const visible = this.model.flights.length > 0 || this.fragments.length > 0;
        if (!visible && !this.paintedEffects) return;
        pen.clear();
        this.paintedEffects = visible;
        pen.strokeColor = this.shotTint;
        pen.lineWidth = 3;
        pen.fillColor = this.shotLight;
        for (const flight of this.model.flights) {
            const target = this.cellsById.get(flight.target);
            if (!target) continue;
            const end = this.projectCell(target);
            const x = -245 + flight.slot * 98, y = SLOT_Y + 45;
            const t = Math.max(0, Math.min(1, 1 - flight.time / (flight.duration ?? FLIGHT_SECONDS)));
            const lift = 60 * (1 - t) * t;
            const px = x + (end.x - x) * t, py = y + (end.y - y) * t + lift;
            pen.moveTo(x, y);
            pen.lineTo(px, py);
            pen.stroke();
            pen.circle(px, py, 5);
            pen.fill();
        }
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const particle = this.fragments[i];
            particle.life -= dt;
            if (particle.life <= 0) { this.fragments.splice(i, 1); continue; }
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy -= 220 * dt;
            const size = 2 + 16 * particle.life;
            pen.fillColor = particle.color;
            pen.rect(particle.x, particle.y, size, size);
            pen.fill();
        }
    }
    private ink(hex: string): string {
        const parts = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const linear = parts.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 >= .179 ? '#000000' : '#ffffff';
    }
    private createCamp(): void {
        this.camp = this.child(this.ui, 'RescueCamp', true);
        this.camp.addComponent(BlockInputEvents);
        this.camp.addComponent(UITransform).setContentSize(640, 1120);
        this.paint(this.camp.addComponent(Graphics), 640, 1120, CREAM, 0);
        const art = this.child(this.camp, 'CampArtwork', true);
        art.setPosition(0, 56);
        art.addComponent(UITransform).setContentSize(640, 960);
        const sprite = art.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('color-clear-release/camp', ImageAsset, (error, asset) => {
            if (error || !asset || !isValid(art)) return;
            this.campImage = new Texture2D();
            this.campImage.image = asset;
            this.campFrame = new SpriteFrame();
            this.campFrame.texture = this.campImage;
            sprite.spriteFrame = this.campFrame;
        });
        this.text(this.camp, '鸭命要紧', 64, 0, 460, 500, '#17493e').isBold = true;
        this.text(this.camp, '今日也要平安上岸', 21, 0, 410, 470, '#32584d');
        this.panel(this.camp, 'Mission', 0, -316, 385, 90, '#fff8e8', '#d9bc86', 21);
        this.text(this.camp, '救援任务', 16, 0, -287, 260, '#786341');
        this.campTitle = this.text(this.camp, '', 29, 0, -327, 360, '#17493e');
        this.campTitle.isBold = true;
        this.campStatus = this.text(this.camp, '', 17, 0, -379, 530, '#345a50');
        const go = this.button(this.camp, '出发救鸭', 0, -430, 536, 78, () => {
            if (this.runStarted && this.model.phase === 'paused') {
                this.camp.active = false;
                this.world.active = true;
                this.model.resume();
                this.refresh(true);
                return;
            }
            this.load(this.unlocked === 2 ? LAST_RESCUE : FIRST_RESCUE);
        }, '#f5af61');
        go.label.fontSize = 33;
        go.label.isBold = true;
        this.panel(this.camp, 'CampNav', 0, -517, 550, 66, TEAL, '#1a4a40', 21);
        this.button(this.camp, '图鉴', 137, -517, 237, 54, () => this.openAlbum(), TEAL).label.color = new Color(CREAM);
        this.button(this.camp, '音效开关', -137, -517, 237, 54, () => {
            this.muted = !this.muted;
            try { sys.localStorage.setItem('color-clear.muted', String(this.muted)); } catch {}
            this.campStatus.string = this.muted ? '音效已关' : '音效已开';
        }, TEAL).label.color = new Color(CREAM);
    }
    private openCamp(): void {
        this.pause();
        this.campTitle.string = this.unlocked === 2 ? '第 02 关 · 法师鸭' : '第 01 关 · 雨衣鸭';
        this.campStatus.string = this.runStarted && this.model.phase === 'paused' ? '保留本局进度' : '';
        this.camp.setSiblingIndex(this.ui.children.length - 1);
        this.camp.active = true;
        this.world.active = false;
    }
    private openAlbum(): void {
        if (this.albumPanel.active) return;
        this.albumFromCamp = this.camp.active;
        this.albumResume = !this.albumFromCamp && this.model.phase === 'playing';
        this.pause();
        this.album.refresh();
        const owned = new Set(this.album.book.entries.map(entry => entry.levelId));
        const count = RELEASE_LEVELS.filter(rescue => owned.has(rescue.id)).length;
        this.albumText.string = '已救援 ' + count + ' / ' + RELEASE_LEVELS.length;
        this.albumCards.forEach((card, index) => {
            const rescue = RELEASE_LEVELS[index], unlocked = owned.has(rescue.id);
            card.label.string = rescue.name;
            this.albumMarks[index].node.active = !unlocked;
            this.albumPortraits[index].node.active = unlocked;
            this.paint(card.pen, 242, 272, unlocked ? '#fdf9ec' : '#eeeade', 19);
            this.outline(card.pen, 242, 272, unlocked ? '#9bbca8' : '#d4c8ad', 19);
        });
        this.albumPanel.setSiblingIndex(this.ui.children.length - 1);
        this.albumPanel.active = true;
    }
    private closeAlbum(): void {
        this.albumPanel.active = false;
        if (!this.albumFromCamp && this.albumResume) this.model.resume();
        this.refresh(true);
    }
    private pause(): void { if(this.dragId>=0)this.orbit.release(true,0);this.dragId = -1; this.model.pause(); this.refresh(true); }
    private touchStart(event: EventTouch): void {
        const id = event.getID();
        const y = event.getUILocation().y;
        if (id === null || this.camp.active || this.albumPanel.active || this.model.phase !== 'playing'
            || this.dragId >= 0 || y <= 450 || y >= 970) return;
        this.dragId = id;
        this.orbit.beginDrag();
        this.lastDrag = this.clock;
    }
    private touchMove(e: EventTouch): void { if (e.getID() === this.dragId) { this.orbit.drag(this.model,e.getUIDelta().x*.67,-e.getUIDelta().y*.67,this.clock-this.lastDrag);this.lastDrag=this.clock; } }
    private touchEnd(e: EventTouch): void { if (e.getID() === this.dragId) { this.orbit.release(e.type===Input.EventType.TOUCH_CANCEL,this.clock-this.lastDrag); this.dragId = -1; } }
    update(dt: number): void {
        this.clock += dt;
        if (this.camp.active || this.albumPanel.active) return;
        this.bonusLabel.node.active = this.clock < this.bonusUntil;
        this.orbit.step(this.model, dt, this.dragId >= 0);
        this.model.tick(dt);
        if (this.renderedYaw !== this.model.yaw || this.renderedPitch !== this.model.pitch) {
            this.renderedYaw = this.model.yaw;
            this.renderedPitch = this.model.pitch;
            Quat.fromAxisAngle(this.qPitch, Vec3.UNIT_X, this.renderedPitch);
            Quat.fromAxisAngle(this.qYaw, Vec3.UNIT_Y, this.renderedYaw);
            Quat.multiply(this.qModel, this.qPitch, this.qYaw);
            this.world.setRotation(this.qModel);
        }
        const events = this.model.drainEvents();
        for (const event of events) {
            if (event.type === 'won') {
                this.album.book.unlock(this.model.level.id);
                this.unlocked = 2;
                try { sys.localStorage.setItem(PROGRESS_KEY, '2'); } catch { /* storage optional */ }
            } else if (event.type === 'bonus') {
                this.bonusUntil = this.clock + 1.1;
                this.soundFor('chain');
            } else if (event.type === 'clear' && event.cell) {
                this.burst(event.cell);
                const detail = this.details.get(event.cell.id);
                if (detail) detail.active = false;
                for (const key of this.blockIndex!.dirtyChunks(event.cell)) this.dirtyBatches.add(key);
            }
            if (event.type === 'hit' && this.clock - this.lastHitSound > .045) {
                this.soundFor('hit');
                this.lastHitSound = this.clock;
            } else if (event.type === 'load' || event.type === 'chain' || event.type === 'won' || event.type === 'lost') {
                this.soundFor(event.type);
            }
        }
        for (const key of this.dirtyBatches) this.updateBatch(key);
        this.dirtyBatches.clear();
        if (events.length) this.refresh();
        this.drawProjectiles(dt);
    }
    onDestroy(): void {
        this.clearBatches();
        input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); game.off(Game.EVENT_HIDE, this.pause, this);
        for (const picture of this.ownedPictures) { picture.frame.destroy(); picture.texture.destroy(); }
        this.campFrame?.destroy();this.campImage?.destroy();for (const m of this.materialsByColor.values()) m.destroy();for(const m of this.meshCache.values())m.destroy();
    }
}
