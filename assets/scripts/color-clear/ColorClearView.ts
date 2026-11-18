import {RescueFeedback} from './ColorClearRescueFeedback';
import {drawAmmoRack, drawCampCorners, drawGear, drawHarborMotion, drawLauncher, drawOrbitTrail, drawRescueHarbor, drawRescueModule, drawSpareAmmo} from './ColorClearRescueArt';
import {fitRescueScreen, mixRescueColors, RESCUE_STAGE} from './ColorClearNativeStyle';
import {BLOCK_INDEX_CAPACITY, BLOCK_VERTEX_CAPACITY, BlockMeshIndex} from './ColorClearBlockMesh';
import { _decorator, Component, Node, Camera, Canvas, UITransform, Graphics, Label, Color, Layers, Mesh, MeshRenderer, Material, primitives, utils, input, Input, EventTouch, view, ResolutionPolicy, game, Game, resources, AudioClip, AudioSource, sys, isValid, Vec3, Quat, BlockInputEvents, tween, ImageAsset, Rect, Texture2D, SpriteFrame, Sprite, JsonAsset } from 'cc';
import { ColorClearGame, FLIGHT_SECONDS } from './ColorClearGame';
import type { Voxel, RewardTicket, PieceShape } from './ColorClearGame';
import {makeReleaseLevel, chooseReleaseQueue} from './ColorClearRelease';
import {HARBOR_STAGES, makeHarborStage} from './ColorClearHarborLevels';
import {HarborChase} from './ColorClearHarborChase';
import {createHarborDuck} from './ColorClearHarborDuck';
import {drawHarborChase, drawHarborDeck} from './ColorClearHarborHud';
import {ModelOrbit} from './ColorClearOrbit';
import {AlbumService} from './ColorClearAlbum';
import {wechatAlbumTransport} from './ColorClearWechat';
import {specialPieceGeometry} from './ColorClearGeometry';
const { ccclass, property } = _decorator;
const FIRST_RESCUE = HARBOR_STAGES[0].id;
const LAST_RESCUE = HARBOR_STAGES[HARBOR_STAGES.length - 1].id;
const STAGE_LAYER = 1 << 18;
const CREAM = '#f9f6ec';
const TEAL = '#245d51';
const SLOT_Y = -178;
const FRONT_Y = -304;
const ORBIT_SECONDS = .76;
const MUSIC_KEY = 'color-clear.music';
const EFFECTS_KEY = 'color-clear.muted';
const PROGRESS_KEY = 'color-clear.campaign.unlocked.v2';
const OLD_PROGRESS_KEY = 'color-clear.campaign.unlocked.v1';
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
    private colors: readonly string[] = HARBOR_STAGES[0].palette;
    private wizardPayload: unknown;
    private wizardQueue = -1;
    private wizardLoading = false;
    private camp!: Node;
    private campTitle!: Label;
    private chase = new HarborChase('tutorial');
    private chasePen!: Graphics;
    private chaseLabel!: Label;
    private chasePaintTime = -Infinity;
    private chaseShownGap = .63;
    private chaseRunTime = 0;
    private skillButton!: Card;
    private skillUsed = false;
    private harborBackdrop!: Sprite;
    private wholeDuck: Node | null = null;
    private escapeShowUntil = 0;
    private wonDialogPending = false;
    private campStatus!: Label;
    private continueButton!: Card;
    private emergencyButton!: Card;
    private restartButton!: Card;
    private albumCards: Card[] = [];
    private albumPortraits: Sprite[] = [];
    private albumMarks: Label[] = [];
    private ownedPictures: {texture: Texture2D; frame: SpriteFrame}[] = [];
    private albumFromCamp = false;
    private runStarted = false;
    private materialsByColor = new Map<string, Material>();
    private readonly feedback = new RescueFeedback();
    private orbitTier = 0;
    private orbitStarted = -Infinity;
    private sameColorUntil = -Infinity;
    private readonly muzzleFlashes = new Map<number, {until: number; color: number}>();
    private ambientTick = -Infinity;
    private fullSince = Infinity;
    private bonusLabel!: Label;
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
    private readonly reticleInk = new Color('#1d4149');
    private readonly reticleGold = new Color('#ffdb7a');
    private readonly reticleWhite = new Color('#fffcf0');
    private shotColors: Color[] = [];
    private hitMarkers: {id: number; life: number; fresh: boolean}[] = [];
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
    private loadHint!: Label;
    private remaining!: Label;
    private phaseText!: Label;
    private resultText!: Label;
    private dragId = -1;
    private sound!: AudioSource;
    private clips = new Map<string, AudioClip>();
    private effectsMuted = false;
    private musicEnabled = true;
    private audioReady = false;
    private inForeground = true;
    private music!: AudioSource;
    private settingsPanel!: Node;
    private musicButton!: Card;
    private effectsButton!: Card;
    private stageRoot!: Node;
    private stagePen!: Graphics;
    private harborMotion!: Graphics;
    private backTrail!: Graphics;
    private frontTrail!: Graphics;
    private screenFit = {x: 0, y: 0, scale: 1};
    private lastHitSound = 0;
    private clock = 0;
    private unlocked = 1;

    onLoad(): void {
        this.album=new AlbumService(sys.localStorage,wechatAlbumTransport(this.albumApiOrigin));
        view.setDesignResolutionSize(640, 1120, ResolutionPolicy.SHOW_ALL);
        try {
            const saved = Number(sys.localStorage.getItem(PROGRESS_KEY));
            const old = Number(sys.localStorage.getItem(OLD_PROGRESS_KEY));
            this.unlocked = saved === 2 || saved === 3 ? saved : old === 2 ? 2 : 1;
            this.effectsMuted = sys.localStorage.getItem(EFFECTS_KEY) === 'true';
            this.musicEnabled = sys.localStorage.getItem(MUSIC_KEY) !== 'false';
        } catch { /* storage optional */ }
        const box = primitives.box();
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
        const canvasNode = this.child(this.node, 'ColorClearCanvas', true);
        canvasNode.addComponent(UITransform).setContentSize(640, 1120);
        const canvas = canvasNode.addComponent(Canvas);
        this.ui = this.child(canvasNode, 'ColorClearUI', true);
        this.ui.addComponent(UITransform).setContentSize(640, 1120);
        const uiCamera = this.child(this.node, 'ColorClearUICamera', false).addComponent(Camera);
        uiCamera.node.setPosition(0, 0, 1000);
        uiCamera.projection = Camera.ProjectionType.ORTHO;
        uiCamera.orthoHeight = 560;
        uiCamera.near = 1;
        uiCamera.far = 2000;
        uiCamera.visibility = Layers.Enum.UI_2D;
        uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        uiCamera.priority = 10;
        canvas.cameraComponent = uiCamera;
        this.uiCamera = uiCamera;
        this.title = this.text(this.ui, '', 34, 0, 482, 414, '#204d42');
        this.title.isBold = true;
        const chaseTrack = this.child(this.ui, 'HarborChase', true);
        chaseTrack.setPosition(0, 404);
        this.chasePen = chaseTrack.addComponent(Graphics);
        this.chaseLabel = this.text(this.ui, '', 17, 0, 363, 260, '#fff7d5');
        this.chaseLabel.isBold = true;
        this.chaseLabel.enableOutline = true;
        this.chaseLabel.outlineColor = new Color('#183b42');
        this.chaseLabel.outlineWidth = 2;
        this.bonusLabel = this.text(this.ui, '', 25, 0, -85, 365, '#fff0a1');
        this.bonusLabel.isBold = true;
        this.bonusLabel.node.active = false;
        this.settingsButton(this.ui, -266, 515);
        this.remaining = this.text(this.ui, '', 16, 0, 335, 540, '#486a61');
        this.text(this.ui, '拖动转面', 16, -213, -86, 142, '#fff7e4');
        this.text(this.ui, '发射台', 17, -250, -124, 110, '#42675d');
        this.loadHint = this.text(this.ui, '点前排装填', 17, -205, -238, 190, '#42675d');
        this.status = this.text(this.ui, '', 16, 90, -124, 360, '#486a61');
        for (let i = 0; i < 6; i++) this.slots.push(this.button(this.ui, '', -245 + i * 98, SLOT_Y, 88, 76, () => {if(i===this.model.slots.length)this.startReward('slot');}, '#f0f2e9'));
        for(let i=0;i<6;i++){const card=this.button(this.ui,'',-245+i*98,-231,86,30,()=>{if(this.model.takeReserve(i))this.refresh(true);});card.node.active=false;this.reserveCards.push(card);}
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            const card = this.button(this.ui, '', -222 + col * 148, (row === 0 ? FRONT_Y : -340 - row * 44), 134, row ? 38 : 76, () => { if (row === 0 && this.model.phase === 'playing') {
                const slot = this.model.slots.indexOf(null);
                if (this.model.select(col)) {
                    const capsule = this.model.slots[slot]!; this.refresh(true);
                    const flight = this.button(this.ui, '', -222 + col * 148, FRONT_Y, 134, 76, () => {});
                    drawRescueModule(flight.pen, 134, 76, this.colors[capsule.color]);
                    flight.label.node.setPosition(25, -5);
                    flight.label.isBold = true;
                    flight.label.string = String(capsule.ammo);
                    flight.node.off(Node.EventType.TOUCH_END); // Decorative flight must not intercept another supply tap.
                    tween(flight.node).to(.12, { position: new Vec3(-245 + slot * 98, SLOT_Y, 0), scale: new Vec3(.58, .58, 1) }).call(() => flight.node.destroy()).start();
                }
            } });
            card.label.fontSize = row ? 23 : 25;
            card.label.isBold = !row;
            card.label.node.setPosition(row ? 15 : 24, row ? 0 : -5);
            this.supplies.push(card);
        }
        this.dialog = this.child(this.ui, 'ColorClearDialog', true);this.dialog.addComponent(BlockInputEvents);
        this.dialog.addComponent(UITransform).setContentSize(640, 1120);
        this.drawModal(this.dialog, 570, 740, -63);
        this.phaseText = this.text(this.dialog, '', 38, 0, 170, 560);
        this.resultText = this.text(this.dialog, '', 22, 0, 70, 530, '#718678');
        this.continueButton = this.button(this.dialog, '继续', 0, -40, 440, 82, () => {
            if (this.model.phase === 'paused') this.model.resume();
            else this.load(this.model.phase === 'won' ? this.nextStageId() : this.model.level.id);
            this.refresh(true);
        }, '#acd6c2');
        this.emergencyButton = this.button(this.dialog, '免费暂存一颗', 0, -130, 440, 64, () => {
            if (this.model.useEmergencyReserve()) this.refresh(true);
        }, '#f9d590');
        this.restartButton = this.button(this.dialog, '重新开始这一关', 0, -222, 440, 64, () => this.load(this.model.level.id));
        this.rewardPanel=this.child(this.ui,'SimulatedReward',true);this.rewardPanel.addComponent(BlockInputEvents);this.rewardPanel.addComponent(UITransform).setContentSize(640,1120);this.paint(this.rewardPanel.addComponent(Graphics),640,1120,'#eef2e0',0);
        this.rewardTitle=this.text(this.rewardPanel,'开发测试 · 模拟广告',28,0,160,560);
        this.text(this.rewardPanel,'没有接入真实微信广告',21,0,80,520,'#718678');
        this.button(this.rewardPanel,'模拟看完并领取',0,-30,440,82,()=>this.finishReward(true),'#68ad89');
        this.button(this.rewardPanel,'取消，不领取',0,-145,440,72,()=>this.finishReward(false));this.rewardPanel.active=false;
        this.frontTrail = this.child(this.ui, 'FrontComboTrail', true).addComponent(Graphics);
        this.projectilePen=this.child(this.ui,'ProjectileOverlay',true).addComponent(Graphics);
        this.albumPanel = this.child(this.ui, 'Album', true);
        this.albumPanel.addComponent(BlockInputEvents);
        this.albumPanel.addComponent(UITransform).setContentSize(640, 1120);
        this.drawModal(this.albumPanel, 574, 590);
        this.text(this.albumPanel, '救援图鉴', 41, 0, 221, 450, TEAL).isBold = true;
        this.albumText = this.text(this.albumPanel, '', 23, 0, 159, 440, '#46683e');
        this.albumCards = HARBOR_STAGES.map((rescue, index) => {
            const card = this.button(this.albumPanel, rescue.name, (index - 1) * 172, -19, 158, 272, () => this.replayStage(index), '#eeeade');
            card.label.node.setPosition(0, -97);
            card.label.isBold = true;
            this.text(card.node, String(index + 1).padStart(2, '0'), 17, -53, 104, 50, '#4c6c61');
            this.albumMarks.push(this.text(card.node, '?', 54, 0, 14, 130, '#617d6c'));
            const portrait = this.loadPicture(card.node, index === 2 ? 'wizard-card' : 'raincoat-card', 142, 142, 0, 15);
            portrait.node.active = false;
            this.albumPortraits.push(portrait);
            return card;
        });
        this.button(this.albumPanel, '返回', 0, -225, 330, 62, () => this.closeAlbum(), '#dcece0');
        this.albumPanel.active = false;
        this.button(this.ui, '图鉴', 220, -520, 144, 56, () => this.openAlbum(), '#dcece0');
        this.button(this.ui, '营地', -220, -520, 144, 56, () => this.openCamp(), '#dcece0');
        this.skillButton = this.button(this.ui, '', 0, -520, 172, 56, () => this.useHarborSkill(), '#ffd37c');
        this.skillButton.label.isBold = true;
        this.button(this.dialog, '回救援营地', 0, -310, 440, 64, () => this.openCamp());
        this.createCamp();
        this.createSettings();
        this.sound = this.node.addComponent(AudioSource);
        for (const name of ['load', 'hit', 'hit-lift', 'hit-peak', 'chain', 'surge', 'won', 'lost']) resources.load(`color-clear-audio/${name}`, AudioClip, (error, clip) => { if (!error && clip && isValid(this.node)) this.clips.set(name, clip); });
        this.music = this.node.addComponent(AudioSource);
        this.music.loop = true;
        this.music.volume = .22;
        resources.load('color-clear-audio/camp', AudioClip, (error, clip) => {
            if (error || !clip || !isValid(this.node)) return;
            this.music.clip = clip;
            this.syncMusic();
        });
        this.layoutScreen();
        view.on('canvas-resize', this.layoutScreen, this);
        view.on('design-resolution-changed', this.layoutScreen, this);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this); input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        game.on(Game.EVENT_HIDE, this.onGameHide, this);
        game.on(Game.EVENT_SHOW, this.onGameShow, this);
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
        this.stageRoot = this.child(node, 'RescueLayout', false);
        this.stageRoot.layer = STAGE_LAYER;
        this.stagePen = this.panel(this.stageRoot, 'ModelStage', 0, 167, 600, 562, '#edf8f3', '#bfd8cc', 38);
        this.paintStage(false);
        this.harborBackdrop = this.loadPicture(this.stageRoot, 'harbor-diorama', 598, 560, 0, 167);
        this.harborBackdrop.node.layer = STAGE_LAYER;
        this.harborBackdrop.node.active = this.showBackground;
        const trim = this.child(this.stageRoot, 'HarborDeck', false);
        trim.layer = STAGE_LAYER;
        trim.setPosition(0, 167);
        const deck = trim.addComponent(Graphics);
        if (this.showBackground) {
            drawHarborDeck(deck);
            deck.fillColor = new Color(CREAM);
            for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
                deck.moveTo(dx * 301, dy * 282);
                deck.lineTo(dx * 262, dy * 282);
                deck.quadraticCurveTo(dx * 299, dy * 280, dx * 301, dy * 243);
                deck.close();
            }
            deck.fill();
        }
        const motion = this.child(this.stageRoot, 'HarborMotion', false);
        motion.layer = STAGE_LAYER;
        motion.setPosition(0, 167);
        this.harborMotion = motion.addComponent(Graphics);
        const trail = this.child(this.stageRoot, 'BackComboTrail', false);
        trail.layer = STAGE_LAYER;
        this.backTrail = trail.addComponent(Graphics);
        this.panel(this.stageRoot, 'LaunchRail', 0, SLOT_Y - 2, 600, 90, '#b7ccc0', '#86a9a2', 23);
        const rack = this.child(this.stageRoot, 'AmmoRack', false);
        rack.layer = STAGE_LAYER;
        rack.setPosition(0, -372);
        drawAmmoRack(rack.addComponent(Graphics));
    }
    private paintStage(wizard: boolean): void {
        this.paint(this.stagePen, 600, 562, '#edf8f3', 38);
        if (this.showBackground) drawRescueHarbor(this.stagePen, wizard);
        this.outline(this.stagePen, 600, 562, '#c5d8cc', 38);
    }
    private layoutScreen(): void {
        const safe = sys.getSafeAreaRect(false);
        const visible = view.getVisibleSize();
        const fit = safe.width > 30 && safe.height > 30 ? safe
            : {x: (640 - visible.width) / 2, y: (1120 - visible.height) / 2, width: visible.width, height: visible.height};
        this.screenFit = fitRescueScreen(fit);
        const {x, y, scale} = this.screenFit;
        this.ui.setPosition(x, y);
        this.ui.setScale(scale, scale, 1);
        this.stageRoot.setPosition(x, y);
        this.stageRoot.setScale(scale, scale, 1);
        this.layoutModel();
    }
    private layoutModel(): void {
        const {x, y, scale} = this.screenFit;
        const ratio = ((this.meshRadius - 1) * 2.13 + 1.5) / (560 * scale);
        this.camera.orthoHeight = this.uiCamera.orthoHeight * ratio;
        this.camera.node.setPosition(-x * ratio, -(y + RESCUE_STAGE.modelY * scale) * ratio, 30);
    }
    private drawModal(node: Node, width: number, height: number, y = 0): void {
        const pen = node.addComponent(Graphics);
        pen.fillColor = new Color('#183c35a6');
        pen.rect(-1100, -1100, 2200, 2200);
        pen.fill();
        this.panel(node, 'ModalCard', 0, y, width, height, CREAM, '#dec89e', 31);
    }
    private loadPicture(parent: Node, name: string, w: number, h: number, x: number, y: number, crop = false): Sprite {
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
            if (crop) {
                const cropHeight = texture.width * h / w;
                frame.rect = new Rect(0, texture.height * .19, texture.width, cropHeight);
            }
            sprite.spriteFrame = frame;
            this.ownedPictures.push({texture, frame});
        });
        return sprite;
    }
    private button(parent: Node, label: string, x: number, y: number, w: number, h: number, click: () => void, color = '#edf1e5'): Card {
        const n = this.child(parent, 'Button', true); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); const pen = n.addComponent(Graphics); this.paint(pen, w, h, color);
        const l = this.text(n, label, 23, 0, 0, w - 10);
        n.on(Node.EventType.TOUCH_END, () => {
            if (!isValid(this.node)) return;
            click();
            this.unlockAudio();
        });
        return {node: n, pen, label: l};
    }
    private blockMaterial(hex: string, vertexColors: boolean): Material {
        const key = hex + (vertexColors ? ':vertex' : '');
        let material = this.materialsByColor.get(key);
        if (!material) {
            material = new Material();
            material.initialize({ effectName: 'builtin-unlit', defines: { USE_INSTANCING: true, USE_VERTEX_COLOR: vertexColors } });
            material.setProperty('mainColor', new Color(hex));
            this.materialsByColor.set(key, material);
        }
        return material;
    }
    private cubeNode(parent: Node, name: string, color: number, shape: PieceShape = 'box', tint?: string): Node {
        const node = this.child(parent, name, false);
        const renderer = node.addComponent(MeshRenderer);
        renderer.mesh = this.meshCache.get(shape)!;
        renderer.setMaterial(this.blockMaterial(tint ?? this.colors[color], false), 0);
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
            const stage = makeHarborStage(id, this.wizardPayload, this.wizardQueue);
            const tier = HARBOR_STAGES.find(rescue => rescue.id === id)!.tier;
            next = new ColorClearGame(stage.level, tier, Math.random, {freeStallRescue: true, exitIds: stage.exitIds});
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
        this.colors = HARBOR_STAGES[this.stageIndex()].palette;
        this.chase = new HarborChase(id === FIRST_RESCUE ? 'tutorial' : id === LAST_RESCUE ? 'long' : 'bridge');
        this.chasePaintTime = -Infinity;
        this.chaseShownGap = this.chase.separation;
        this.chaseRunTime = 0;
        this.skillUsed = false;
        this.escapeShowUntil = 0;
        this.wonDialogPending = false;
        this.paintStage(id === LAST_RESCUE);
        this.orbit.reset();
        this.dragId = -1;
        this.feedback.reset();
        this.orbitTier = 0;
        this.orbitStarted = -Infinity;
        this.sameColorUntil = -Infinity;
        this.muzzleFlashes.clear();
        this.ambientTick = -Infinity;
        this.fullSince = Infinity;
        this.harborMotion.clear();
        this.frontTrail.clear();
        this.backTrail.clear();
        this.runStarted = true;
        this.camp.active = false;
        this.clearBatches();
        if (this.wholeDuck) this.wholeDuck.destroy();
        this.wholeDuck = createHarborDuck(this.world, color => this.blockMaterial(color, false), this.meshCache.get('sphere')!, id);
        this.wholeDuck.active = id !== LAST_RESCUE;
        this.fragments = [];
        this.hitMarkers = [];
        this.projectilePen.clear();
        this.paintedEffects = false;
        this.fragmentColors = this.colors.map(color => new Color(color));
        this.shotColors = this.colors.map(color => new Color(mixRescueColors(color, '#ffffff', .18)));
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
        this.layoutModel();
        this.world.active = true;
        this.refresh(true);
    }
    private soundFor(name: string): void {
        const clip = this.clips.get(name);
        if (!this.effectsMuted && clip) this.sound.playOneShot(clip, name.startsWith('hit') ? .36 : .53);
    }
    private playHitFeedback(): void {
        const tier = this.feedback.hit(this.clock);
        if (tier) {
            this.orbitStarted = this.clock;
            this.orbitTier = tier;
            this.soundFor(tier === 3 ? 'surge' : 'chain');
            this.lastHitSound = this.clock;
        } else if (this.clock - this.lastHitSound >= .064) {
            this.soundFor(this.feedback.level >= 2 ? 'hit-peak' : this.feedback.level ? 'hit-lift' : 'hit');
            this.lastHitSound = this.clock;
        }
    }
    private drawRescueFeedback(): void {
        const count = this.feedback.count;
        this.bonusLabel.node.active = count >= 5 && this.clock - this.feedback.lastHit < .72;
        if (this.bonusLabel.node.active) {
            this.bonusLabel.string = `${count} 连消${this.clock < this.sameColorUntil ? ' · 同色 ×5' : ''}`;
        }
        if (this.showBackground && !this.harborBackdrop.spriteFrame && this.clock - this.ambientTick >= 1 / 15) {
            this.ambientTick = this.clock;
            drawHarborMotion(this.harborMotion, this.clock, this.model.level.id === LAST_RESCUE);
        }
        if (!this.orbitTier) return;
        const progress = (this.clock - this.orbitStarted) / ORBIT_SECONDS;
        this.backTrail.clear();
        this.frontTrail.clear();
        if (progress >= 1) {
            this.orbitTier = 0;
            return;
        }
        drawOrbitTrail(this.backTrail, progress, this.orbitTier, false);
        drawOrbitTrail(this.frontTrail, progress, this.orbitTier, true);
    }
    private stageIndex(): number {
        return HARBOR_STAGES.findIndex(rescue => rescue.id === this.model.level.id);
    }
    private nextStageId(): number {
        return HARBOR_STAGES[Math.min(this.stageIndex() + 1, HARBOR_STAGES.length - 1)].id;
    }
    private replayStage(index: number): void {
        if (index >= this.unlocked) return;
        this.albumPanel.active = false;
        this.load(HARBOR_STAGES[index].id);
    }
    private useHarborSkill(): void {
        if (this.skillUsed || this.model.phase !== 'playing' || this.camp.active || this.settingsPanel.active || this.albumPanel.active) return;
        if (this.model.level.id === LAST_RESCUE) {
            this.chase.freeze(5);
        } else {
            const cleared = this.model.openShellWithWater(this.unlocked >= 2 ? 20 : 10);
            if (!cleared) return;
            this.orbitStarted = this.clock;
            this.orbitTier = 3;
        }
        this.skillUsed = true;
        this.chasePaintTime = -Infinity;
        this.soundFor('surge');
        if (this.model.phase === 'playing') this.refresh();
    }
    private showDuckEscape(): void {
        const duck = this.wholeDuck;
        if (!duck) return;
        duck.active = true;
        tween(this.world).to(.20, {eulerAngles: new Vec3(0, 22, 0)}, {easing: 'quadOut'}).start();
        tween(duck)
            .to(.18, {position: new Vec3(1.1, .90, 1.8)}, {easing: 'quadOut'})
            .to(.17, {position: new Vec3(2.7, .05, 3)}, {easing: 'quadIn'})
            .to(.20, {position: new Vec3(4.5, 1.20, 5.3)}, {easing: 'quadOut'})
            .to(.30, {position: new Vec3(8.4, .05, 8)}, {easing: 'quadIn'})
            .start();
        this.escapeShowUntil = this.clock + .95;
        this.wonDialogPending = true;
    }
    private drawChaseTrack(dt: number): void {
        const escaped = this.model.phase === 'won';
        const caught = this.chase.caught;
        const target = escaped ? 1 : this.chase.separation;
        this.chaseShownGap += (target - this.chaseShownGap) * (1 - Math.exp(-Math.min(dt, .25) * 6));
        if (this.model.phase === 'playing' || (escaped && this.wonDialogPending)) {
            this.chaseRunTime += dt * (this.clock - this.feedback.lastHit < .2 ? 1.38 : 1);
        }
        if (this.clock - this.chasePaintTime < 1 / 24) return;
        this.chasePaintTime = this.clock;
        drawHarborChase(this.chasePen, this.chaseShownGap, this.chaseRunTime,
            this.chase.frozen > 0, caught || (escaped && !this.wonDialogPending), caught);
        const label = escaped ? '鸭鸭已安全上船' : caught ? '被烤鸭师傅追上了'
            : this.chase.frozen > 0 ? '追兵冻结'
            : this.chase.separation < .18 ? '追兵靠近'
            : `还剩 ${this.model.cells.length - this.model.combo} 块`;
        if (this.chaseLabel.string !== label) this.chaseLabel.string = label;
    }
    private updateLoadHint(): void {
        const waiting = this.model.phase === 'playing' && !this.model.flights.length && this.model.slots.every(Boolean);
        if (!waiting) this.fullSince = Infinity;
        else if (!Number.isFinite(this.fullSince)) this.fullSince = this.clock;
        const label = this.clock - this.fullSince >= .7 ? '转面找同色' : '点前排装填';
        if (this.loadHint.string !== label) this.loadHint.string = label;
    }
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
        }, undefined, { maxSubMeshes: 1, maxSubMeshVertices: cells * BLOCK_VERTEX_CAPACITY, maxSubMeshIndices: cells * BLOCK_INDEX_CAPACITY });
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
        this.title.string = `第 ${String(this.stageIndex() + 1).padStart(2, '0')} 关 · ${this.model.level.name}`;
        this.remaining.node.active=this.showRemaining||this.showProgress;this.remaining.string=[this.showRemaining?`剩余 ${this.model.remaining} 块`:'',this.showProgress?`已清除 ${Math.round(this.model.progress*100)}%`:''].filter(Boolean).join(' · ');this.status.node.active=this.showLabels;
        this.status.string = this.model.flights.length ? '同色消除中' : '↔ 转一转找同色';
        this.slots.forEach((card, i) => {
            const capsule = this.model.slots[i];
            const locked = i >= this.model.slots.length;
            const fill = capsule ? this.colors[capsule.color] : undefined;
            const key = fill ?? (locked ? 'locked' : 'empty');
            if (card.paintKey !== key) {
                card.paintKey = key;
                drawLauncher(card.pen, fill, locked);
                card.label.color = new Color('#284149');
                card.label.fontSize = locked ? 19 : 20;
                card.label.isBold = true;
                card.label.node.setPosition(0, locked ? -1 : 2);
            }
            card.label.string = locked ? '扩槽' : capsule ? String(capsule.ammo) : '';
        });
        this.supplies.forEach((card, i) => {
            const row = Math.floor(i / 4), column = i % 4, capsule = this.model.supply[column][row];
            const mystery = this.model.isAmmoHidden(column, row);
            const swatch = capsule ? this.colors[capsule.color] : '';
            const key = swatch + ':' + mystery;
            if (card.paintKey !== key) {
                card.paintKey = key;
                if (!row && capsule) drawRescueModule(card.pen, 134, 76, swatch);
                else drawSpareAmmo(card.pen, swatch, mystery);
                card.label.color = new Color('#233e45');
            }
            card.label.string = capsule ? mystery ? '?' : String(capsule.ammo) : '';
        });
        this.loadHint.node.active = this.model.reserve.length === 0;
        this.reserveCards.forEach((card, index) => {
            const capsule = this.model.reserve[index];
            card.node.active = !!capsule;
            if (!capsule) return;
            const fill = this.colors[capsule.color];
            if (card.paintKey !== fill) {
                card.paintKey = fill;
                this.paint(card.pen, 86, 30, fill, 9);
                card.label.color = new Color(this.ink(fill));
            }
            card.label.string = String(capsule.ammo);
        });
        this.skillButton.label.string = this.skillUsed ? '技能已使用'
            : this.model.level.id === LAST_RESCUE ? '冻结追兵'
            : `水花 · ${this.unlocked >= 2 ? 20 : 10}`;
        const skillKey = this.skillUsed ? 'spent' : 'ready';
        if (this.skillButton.paintKey !== skillKey) {
            this.skillButton.paintKey = skillKey;
            this.paint(this.skillButton.pen, 172, 56, this.skillUsed ? '#e4e5da' : '#ffd37c', 18);
        }
        this.dialog.active = !this.camp.active && this.model.phase !== 'playing' && this.clock >= this.escapeShowUntil;
        this.continueButton.label.string = this.model.phase === 'won'
            ? this.model.level.id !== LAST_RESCUE ? `下一关 · ${HARBOR_STAGES[this.stageIndex() + 1].name}` : '再救一次'
            : this.model.phase === 'paused' ? '继续救援' : '再试一次';
        const canRescue = this.model.canUseEmergencyReserve;
        this.emergencyButton.node.active = canRescue;
        this.emergencyButton.node.setPosition(0, -40);
        this.continueButton.node.setPosition(0, canRescue ? -136 : -40);
        this.restartButton.node.active = this.model.phase === 'paused';
        this.phaseText.string = this.model.phase === 'won' ? '安全抵达！' : this.model.phase === 'lost' ? '换个顺序再来' : '休息一下';
        this.resultText.string = this.model.phase === 'lost' ? this.model.reason : `已清除 ${this.model.cells.length - this.model.remaining} 块`;
    }
    private startReward(kind:'slot'|'continue'):void {
        const owner=this.model,ticket=owner.beginReward(kind);if(!ticket)return;this.pendingReward={owner,ticket};if(this.dragId>=0)this.orbit.release(true,0);this.dragId=-1;
        this.rewardTitle.string=kind==='slot'?`开发测试 · 模拟解锁第${owner.slots.length+1}槽`:'开发测试 · 模拟暂存续关';this.rewardPanel.active=true;this.refresh(true);
    }
    private finishReward(completed:boolean):void {
        const pending=this.pendingReward;if(!pending)return;this.pendingReward=null;this.rewardPanel.active=false;pending.owner.resolveReward(pending.ticket,completed);if(pending.owner===this.model)this.refresh(true);
    }
    private drawReticle(x: number, y: number, radius: number, hit: boolean): void {
        const pen = this.projectilePen;
        const arm = radius * .58;
        const trace = (): void => {
            for (const dx of [-1, 1]) {
                for (const dy of [-1, 1]) {
                    pen.moveTo(x + (radius - arm) * dx, y + radius * dy);
                    pen.lineTo(x + radius * dx, y + radius * dy);
                    pen.lineTo(x + radius * dx, y + (radius - arm) * dy);
                }
            }
            pen.stroke();
        };
        pen.strokeColor = this.reticleInk;
        pen.lineWidth = hit ? 6 : 4;
        trace();
        pen.strokeColor = hit ? this.reticleGold : this.reticleWhite;
        pen.lineWidth = hit ? 3 : 2;
        trace();
    }
    private drawProjectiles(dt: number): void {
        const pen = this.projectilePen;
        const flights = this.chase.caught ? [] : this.model.flights;
        for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
            this.hitMarkers[i].life -= dt;
            if (this.hitMarkers[i].life <= 0) this.hitMarkers.splice(i, 1);
        }
        const visible = flights.length > 0 || this.fragments.length > 0 || this.hitMarkers.length > 0 || this.muzzleFlashes.size > 0;
        if (!visible && !this.paintedEffects) return;
        pen.clear();
        this.paintedEffects = visible;
        for (const [slot, flash] of this.muzzleFlashes) {
            const time = flash.until - this.clock;
            if (time <= 0) { this.muzzleFlashes.delete(slot); continue; }
            const x = -245 + slot * 98, y = SLOT_Y + 34, width = 4 + time * 58;
            pen.fillColor = this.shotColors[flash.color];
            pen.ellipse(x, y, width, width * .48);
            pen.fill();
            pen.fillColor = this.reticleWhite;
            pen.circle(x, y + 3, width * .41);
            pen.fill();
        }
        const targetsInView = flights.length || this.hitMarkers.length
            ? this.model.visibleVoxelPositions([...flights.map(flight => flight.target), ...this.hitMarkers.map(mark => mark.id)])
            : null;
        for (const flight of flights) {
            const target = this.cellsById.get(flight.target);
            if (!target || !targetsInView?.has(flight.target)) continue;
            const end = this.projectCell(target);
            const x = -245 + flight.slot * 98, y = SLOT_Y + 34;
            const t = Math.max(0, Math.min(1, 1 - flight.time / (flight.duration ?? FLIGHT_SECONDS)));
            const tail = Math.max(0, t - .16);
            const dx = end.x - x, dy = end.y - y;
            const px = x + dx * t, py = y + dy * t + 36 * (1 - t) * t;
            pen.strokeColor = this.reticleInk;
            pen.lineWidth = 6;
            pen.moveTo(x + dx * tail, y + dy * tail + 36 * (1 - tail) * tail);
            pen.lineTo(px, py);
            pen.stroke();
            pen.fillColor = this.reticleInk;
            pen.circle(px, py, 6);
            pen.fill();
            pen.fillColor = this.shotColors[flight.color];
            pen.circle(px, py, 4.3);
            pen.fill();
            this.drawReticle(end.x, end.y, 11, false);
        }
        for (const mark of this.hitMarkers) {
            const cell = this.cellsById.get(mark.id);
            const fresh = mark.fresh;
            mark.fresh = false;
            if (!cell || !targetsInView?.has(mark.id)) continue;
            if (fresh) this.burst(cell);
            const end = this.projectCell(cell);
            this.drawReticle(end.x, end.y, 8 + 9 * (1 - mark.life / .18), true);
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
        const ground = this.camp.addComponent(Graphics);
        this.paint(ground, 2400, 2600, '#f4f8ef', 0);
        this.panel(this.camp, 'CampArtFrame', 0, 94, 604, 550, '#e6efde', '#c4d5bc', 42);
        this.loadPicture(this.camp, 'camp', 594, 540, 0, 94, true);
        const corners = this.child(this.camp, 'ArtworkCorners', true);
        corners.setPosition(0, 94);
        drawCampCorners(corners.addComponent(Graphics));
        this.settingsButton(this.camp, -266, 515);
        this.text(this.camp, '鸭命要紧', 66, 0, 477, 420, '#17493e').isBold = true;
        this.panel(this.camp, 'Mission', 0, -272, 598, 140, '#fff9e9', '#e7d3aa', 29);
        this.text(this.camp, '救援任务', 19, -185, -230, 160, '#76552e').isBold = true;
        this.campTitle = this.text(this.camp, '', 32, 0, -276, 550, '#17493e');
        this.campTitle.isBold = true;
        this.campStatus = this.text(this.camp, '', 18, 0, -313, 530, '#345a50');
        const go = this.button(this.camp, '出发救鸭', 0, -406, 596, 86, () => {
            if (this.runStarted && this.model.phase === 'paused') {
                this.camp.active = false;
                this.world.active = true;
                this.model.resume();
                this.refresh(true);
                return;
            }
            this.load(HARBOR_STAGES[this.unlocked - 1].id);
        }, '#ffcc70');
        go.label.fontSize = 33;
        go.label.isBold = true;
        const album = this.button(this.camp, '救援图鉴', 0, -508, 335, 64, () => this.openAlbum(), '#e2eee4');
        album.label.isBold = true;
    }
    private settingsButton(parent: Node, x: number, y: number): void {
        const gear = this.button(parent, '', x, y, 69, 69, () => this.openSettings(), '#e3efe5');
        this.outline(gear.pen, 69, 69, '#c7dacd', 20);
        drawGear(gear.pen);
    }
    private createSettings(): void {
        this.settingsPanel = this.child(this.ui, 'Settings', true);
        this.settingsPanel.addComponent(BlockInputEvents);
        this.settingsPanel.addComponent(UITransform).setContentSize(2600, 2600);
        this.drawModal(this.settingsPanel, 530, 490);
        this.text(this.settingsPanel, '设置', 42, 0, 174, 390, TEAL).isBold = true;
        this.musicButton = this.button(this.settingsPanel, '', 0, 65, 408, 79, () => {
            this.musicEnabled = !this.musicEnabled;
            try { sys.localStorage.setItem(MUSIC_KEY, String(this.musicEnabled)); } catch { /* storage optional */ }
            this.syncMusic();
            this.refreshSettings();
        });
        this.effectsButton = this.button(this.settingsPanel, '', 0, -36, 408, 79, () => {
            this.effectsMuted = !this.effectsMuted;
            try { sys.localStorage.setItem(EFFECTS_KEY, String(this.effectsMuted)); } catch { /* storage optional */ }
            this.refreshSettings();
            this.soundFor('load');
        });
        this.button(this.settingsPanel, '完成', 0, -161, 408, 70, () => {
            this.settingsPanel.active = false;
        }, '#ffcf78').label.isBold = true;
        this.settingsPanel.active = false;
    }
    private openSettings(): void {
        if (this.dragId >= 0) this.orbit.release(true, 0);
        this.dragId = -1;
        this.refreshSettings();
        this.settingsPanel.setSiblingIndex(this.ui.children.length - 1);
        this.settingsPanel.active = true;
    }
    private refreshSettings(): void {
        const toggles = [
            {card: this.musicButton, label: '音乐', enabled: this.musicEnabled},
            {card: this.effectsButton, label: '音效', enabled: !this.effectsMuted},
        ];
        for (const {card, label, enabled} of toggles) {
            this.paint(card.pen, 408, 79, enabled ? '#dcecdf' : '#eee9df', 23);
            card.label.string = `${label}    ${enabled ? '开启' : '关闭'}`;
            card.label.isBold = true;
        }
    }
    private unlockAudio(): void {
        if (this.audioReady) return;
        this.audioReady = true;
        this.syncMusic();
    }
    private syncMusic(): void {
        if (!this.audioReady || !this.music.clip || !this.inForeground || !this.musicEnabled) {
            if (this.music.playing) this.music.pause();
        } else if (!this.music.playing) {
            this.music.play();
        }
    }
    private onGameHide(): void {
        this.inForeground = false;
        this.syncMusic();
        this.pause();
    }
    private onGameShow(): void {
        this.inForeground = true;
        this.layoutScreen();
        this.syncMusic();
    }
    private openCamp(): void {
        this.pause();
        this.campTitle.string = `第 ${String(this.unlocked).padStart(2, '0')} 关 · ${HARBOR_STAGES[this.unlocked - 1].name}`;
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
        const count = HARBOR_STAGES.filter(rescue => owned.has(rescue.id)).length;
        this.albumText.string = '已救援 ' + count + ' / ' + HARBOR_STAGES.length;
        this.albumCards.forEach((card, index) => {
            const rescue = HARBOR_STAGES[index], unlocked = owned.has(rescue.id);
            card.label.string = rescue.name;
            this.albumMarks[index].node.active = !unlocked;
            this.albumPortraits[index].node.active = unlocked;
            this.paint(card.pen, 158, 272, unlocked ? '#fdf9ec' : '#eeeade', 19);
            this.outline(card.pen, 158, 272, unlocked ? '#9bbca8' : '#d4c8ad', 19);
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
        const point = event.getUILocation();
        const {x, y, scale} = this.screenFit;
        const localX = (point.x - 320 - x) / scale, localY = (point.y - 560 - y) / scale;
        if (id === null || this.camp.active || this.albumPanel.active || this.settingsPanel.active
            || this.model.phase !== 'playing' || this.dragId >= 0
            || localX < RESCUE_STAGE.left || localX > RESCUE_STAGE.right
            || localY < RESCUE_STAGE.bottom || localY > RESCUE_STAGE.top) return;
        this.dragId = id;
        this.orbit.beginDrag();
        this.lastDrag = this.clock;
    }
    private touchMove(e: EventTouch): void { if (e.getID() === this.dragId) { this.orbit.drag(this.model,e.getUIDelta().x*.67,-e.getUIDelta().y*.67,this.clock-this.lastDrag);this.lastDrag=this.clock; } }
    private touchEnd(e: EventTouch): void {
        const cancelled = e.type === Input.EventType.TOUCH_CANCEL;
        if (!cancelled) this.unlockAudio();
        if (e.getID() === this.dragId) {
            this.orbit.release(cancelled, this.clock - this.lastDrag);
            this.dragId = -1;
        }
    }
    update(dt: number): void {
        this.clock += dt;
        if (this.camp.active || this.albumPanel.active || this.settingsPanel.active) return;
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
                this.unlocked = Math.max(this.unlocked, Math.min(HARBOR_STAGES.length, this.stageIndex() + 2));
                try { sys.localStorage.setItem(PROGRESS_KEY, String(this.unlocked)); } catch { /* storage optional */ }
                this.showDuckEscape();
            } else if (event.type === 'clear' && event.cell) {
                this.chase.hit();
                if (this.hitMarkers.length >= 9) this.hitMarkers.shift();
                this.hitMarkers.push({id: event.cell.id, life: .18, fresh: true});
                const detail = this.details.get(event.cell.id);
                if (detail) detail.active = false;
                for (const key of this.blockIndex!.dirtyChunks(event.cell)) this.dirtyBatches.add(key);
            }
            if (event.type === 'hit') this.playHitFeedback();
            else if (event.type === 'fire' && event.slot !== undefined && event.color !== undefined) {
                this.muzzleFlashes.set(event.slot, {until: this.clock + .105, color: event.color});
            } else if (event.type === 'bonus') this.sameColorUntil = this.clock + .55;
            else if (event.type === 'load' || event.type === 'won' || event.type === 'lost') {
                this.soundFor(event.type);
            }
        }
        if (this.model.phase === 'playing' && !this.model.escapeReady) {
            this.chase.tick(Math.min(.25, dt));
            if (this.chase.caught) this.model.caughtByCook();
        }
        if (this.wonDialogPending && this.clock >= this.escapeShowUntil) {
            this.wonDialogPending = false;
            this.refresh();
        }
        this.drawChaseTrack(dt);
        for (const key of this.dirtyBatches) this.updateBatch(key);
        this.dirtyBatches.clear();
        if (events.length) this.refresh();
        this.updateLoadHint();
        this.drawRescueFeedback();
        this.drawProjectiles(dt);
    }
    onDestroy(): void {
        this.clearBatches();
        input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); game.off(Game.EVENT_HIDE, this.onGameHide, this);
        game.off(Game.EVENT_SHOW, this.onGameShow, this);
        view.off('canvas-resize', this.layoutScreen, this);
        view.off('design-resolution-changed', this.layoutScreen, this);
        for (const picture of this.ownedPictures) { picture.frame.destroy(); picture.texture.destroy(); }
        for (const m of this.materialsByColor.values()) m.destroy();for(const m of this.meshCache.values())m.destroy();
    }
}
