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
const PROGRESS_KEY = 'color-clear.campaign.unlocked.v1';
const SYMBOLS = ['●', '▲', '◆', '■', '✦', '⬟'];
type Card = { node: Node; pen: Graphics; label: Label };
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
    private visualShots: {slot:number; id:number; flightId:number; age:number}[] = [];

    private voxels: Node[] = [];
    private fragments: { node: Node; age: number; vx: number; vy: number; vz: number }[] = [];
    private slots: Card[] = [];
    private lastDrag = 0;
    private supplies: Card[] = [];
    private title!: Label;
    private status!: Label;
    private remaining!: Label;
    private phaseText!: Label;
    private resultText!: Label;
    private dragId = -1;
    private signature = '';
    private sound!: AudioSource;
    private clips = new Map<string, AudioClip>();
    private muted = false;
    private lastHitSound = 0;
    private clock = 0;
    private unlocked = 1;
    private previousPhase = '';

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
        const backdrop = this.child(this.node, 'ColorClearBackground', false).addComponent(Camera);
        backdrop.priority = -10; backdrop.visibility = 0; backdrop.clearFlags = Camera.ClearFlag.SOLID_COLOR; backdrop.clearColor = new Color(this.showBackground?'#edf3e4':'#fafaf2');
        this.camera = this.child(this.node, 'ColorClearCamera', false).addComponent(Camera);
        this.camera.node.setPosition(0, 0, 30); this.camera.projection = Camera.ProjectionType.ORTHO; this.camera.near = .1; this.camera.far = 100;
        this.camera.visibility = Layers.Enum.DEFAULT; this.camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; this.camera.priority = 0;
        this.world = this.child(this.node, 'ColorClearModel', false);
        this.ui = this.child(this.node, 'ColorClearUI', true); this.ui.addComponent(UITransform).setContentSize(640, 1120);
        const canvas = this.ui.addComponent(Canvas);
        const uiCamera = this.child(this.node, 'ColorClearUICamera', false).addComponent(Camera);
        uiCamera.node.setPosition(0, 0, 1000); uiCamera.projection = Camera.ProjectionType.ORTHO; uiCamera.orthoHeight = 560; uiCamera.near = 1; uiCamera.far = 2000;
        uiCamera.visibility = Layers.Enum.UI_2D; uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; uiCamera.priority = 10; canvas.cameraComponent = uiCamera;this.uiCamera=uiCamera;
        this.title = this.text(this.ui, '', 24, 0, 490, 440, '#294d45');
        this.bonusLabel = this.text(this.ui, '✦ 同色 5 连消', 28, 0, 386, 400, '#8a5018');
        this.bonusLabel.node.active = false;
        this.button(this.ui, 'Ⅱ', -260, 490, 60, 60, () => this.pause());
        this.remaining = this.text(this.ui, '', 18, 0, 393, 540, '#8a9991');
        this.text(this.ui, '↔ 上下左右拖动，发现另一面', 17, 0, -95, 550, '#8aa28d');
        this.text(this.ui, '发射台', 20, -210, -150, 160);
        this.status = this.text(this.ui, '', 16, 90, -150, 360, '#8a9991');
        for (let i = 0; i < 6; i++) this.slots.push(this.button(this.ui, '', -245 + i * 98, -220, 86, 90, () => {if(i===this.model.slots.length)this.startReward('slot');}, '#f0f2e9'));
        for(let i=0;i<6;i++){const card=this.button(this.ui,'',-245+i*98,-291,86,48,()=>{if(this.model.takeReserve(i))this.refresh(true);});card.node.active=false;this.reserveCards.push(card);}
        this.text(this.ui, '下一批颜色 · 点前排入槽', 20, 0, -310, 550);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            const card = this.button(this.ui, '', -222 + col * 148, (row === 0 ? -354 : -366 - row * 45), 124, row ? 40 : 66, () => { if (row === 0 && this.model.phase === 'playing') {
                const slot = this.model.slots.indexOf(null);
                if (this.model.select(col)) {
                    const capsule = this.model.slots[slot]!; this.refresh(true);
                    const flight = this.button(this.ui, `${SYMBOLS[capsule.color]} ${capsule.ammo}`, -222 + col * 148, -354, 104, 60, () => {}, this.colors[capsule.color]);
                    flight.node.off(Node.EventType.TOUCH_END); // Decorative flight must not intercept another supply tap.
                    tween(flight.node).to(.18, { position: new Vec3(-245 + slot * 98, -220, 0) }).call(() => flight.node.destroy()).start();
                }
            } });
            this.supplies.push(card);
        }
        this.text(this.ui, '没有倒计时，想好了再点 · 同色弹药匹配', 16, 0, -530, 590, '#8a9991');
        this.dialog = this.child(this.ui, 'ColorClearDialog', true);this.dialog.addComponent(BlockInputEvents);
        this.dialog.addComponent(UITransform).setContentSize(640, 1120);
        this.paint(this.dialog.addComponent(Graphics), 640, 1120, '#eef2e0', 0);
        this.phaseText = this.text(this.dialog, '', 38, 0, 170, 560);
        this.resultText = this.text(this.dialog, '', 22, 0, 70, 530, '#718678');
        this.continueButton = this.button(this.dialog, '继续', 0, -40, 440, 82, () => {
            if (this.model.phase === 'paused') this.model.resume();
            else this.load(this.model.phase === 'won' ? LAST_RESCUE : this.model.level.id);
            this.refresh(true);
        }, '#68ad89');
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
        this.albumPanel=this.child(this.ui,'Album',true);this.albumPanel.addComponent(BlockInputEvents);this.albumPanel.addComponent(UITransform).setContentSize(640,1120);this.paint(this.albumPanel.addComponent(Graphics),640,1120,'#fafaf2',0);
        this.text(this.albumPanel,'救援图鉴',40,0,255,560);
        this.albumText=this.text(this.albumPanel,'',20,0,180,550);
        this.albumCards = RELEASE_LEVELS.map((rescue, index) =>
            this.button(this.albumPanel, rescue.name, -142 + index * 284, -15, 250, 260, () => {}, '#eeeade'));
        this.button(this.albumPanel,'返回',0,-270,360,64,()=>this.closeAlbum());
        this.albumPanel.active=false;
        this.button(this.ui,'图鉴',220,-530,110,48,()=>this.openAlbum());
        this.button(this.ui,'营地',-220,-530,110,48,()=>this.openCamp());
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
        this.visualShots = [];
        this.model = next;
        this.colors = RELEASE_LEVELS[id === FIRST_RESCUE ? 0 : 1].palette;
        this.orbit.reset();
        this.dragId = -1;
        this.signature = '';
        this.previousPhase = '';
        this.bonusUntil = 0;
        this.runStarted = true;
        this.camp.active = false;
        for (const node of this.voxels) node.destroy();
        this.world.removeAllChildren();
        this.voxels = [];
        for (const fragment of this.fragments) fragment.node.destroy();
        this.fragments = [];
        for (const cell of this.model.cells) {
            const node = this.cubeNode(this.world, 'Block', cell.color, cell.shape, cell.visualTint);
            node.setPosition(cell.x, cell.y, cell.z);
            node.setScale(.97, .97, .97);
            this.voxels[cell.id] = node;
            if (cell.visualDetail === 'eye') {
                const eye = this.cubeNode(node, 'Eye', cell.color, 'sphere', '#253532');
                eye.setPosition(0, .04, .53);
                eye.setScale(.42, .55, .30);
                const glint = this.cubeNode(node, 'EyeHighlight', cell.color, 'sphere', '#fffaf0');
                glint.setPosition(-.078, .148, .65);
                glint.setScale(.13, .13, .1);
            } else if (cell.visualDetail === 'bill') {
                const seam = this.cubeNode(node, 'BillSeam', cell.color, 'box', '#9c692e');
                seam.setPosition(0, -.12, .5);
                seam.setScale(.73, .07, .07);
            }
        }
        const radius = Math.max(...this.model.cells.map(cell => Math.hypot(cell.x, cell.y, cell.z)));
        this.camera.orthoHeight = radius * 2.18 + 1.25;
        this.camera.node.setPosition(0, -this.camera.orthoHeight * .27, 30);
        this.world.active = true;
        this.refresh(true);
    }
    private soundFor(name: string): void { const clip = this.clips.get(name); if (!this.muted && clip) this.sound.playOneShot(clip, name === 'hit' ? .2 : .45); }
    private burst(cell: Voxel): void {
        const worldPos = this.voxels[cell.id].worldPosition;
        for (let i = 0; i < 3 && this.fragments.length < 64; i++) {
            const n = this.cubeNode(this.node, 'ClearFragment', cell.color); n.setWorldPosition(worldPos); n.setScale(.16, .16, .16);
            this.fragments.push({ node: n, age: 0, vx: (Math.random() - .5) * 7, vy: 3 + Math.random() * 4, vz: (Math.random() - .5) * 4 });
        }
    }
    private refresh(force = false): void {
        const sig = JSON.stringify([this.model.phase, this.model.remaining, this.model.slots, this.model.supply.map(c => c.slice(0, 2)), this.muted, this.model.reserve,...(this.model.slots.some(Boolean)?[this.model.yaw.toFixed(2),this.model.pitch.toFixed(2)]:[])]);
        if (!force && sig === this.signature) return; this.signature = sig;
        this.title.string = `第 ${this.model.level.id === FIRST_RESCUE ? '01' : '02'} 关 · ${this.model.level.name}`;
        this.remaining.node.active=this.showRemaining||this.showProgress;this.remaining.string=[this.showRemaining?`剩余 ${this.model.remaining} 块`:'',this.showProgress?`已清除 ${Math.round(this.model.progress*100)}%`:''].filter(Boolean).join(' · ');this.status.node.active=this.showLabels;
        const visible = new Set(this.model.slots.some(Boolean) ? this.model.visibleTargets().map(c => c.color) : []);
        this.status.string = this.model.slots.some(s => s && visible.has(s.color)) ? '同色消除中' : '↔ 转一转找同色';
        this.slots.forEach((card, i) => {
            const capsule = this.model.slots[i];
            this.paint(card.pen, 86, 90, capsule ? this.colors[capsule.color] : '#f0f2e9');
            card.label.color = new Color(capsule ? this.ink(this.colors[capsule.color]) : '#526c60');
            card.label.string = i >= this.model.slots.length ? '▣' : capsule ? `${SYMBOLS[capsule.color]} ${capsule.ammo}` : '';
        });
        this.supplies.forEach((card, i) => {
            const row = Math.floor(i / 4), column = i % 4, capsule = this.model.supply[column][row];
            this.paint(card.pen, 124, row ? 40 : 66, capsule && !row ? this.colors[capsule.color] : '#edf1e7');
            if (capsule && row) {
                card.pen.fillColor = new Color(this.colors[capsule.color]);
                card.pen.roundRect(-52, -11, 22, 22, 6);
                card.pen.fill();
            }
            card.label.color = new Color(!row && capsule ? this.ink(this.colors[capsule.color]) : '#26463c');
            card.label.string = capsule ? (row ? '    ' : SYMBOLS[capsule.color] + ' ') +
                (this.model.isAmmoHidden(column, row) ? '?' : capsule.ammo) : '·';
        });
        this.reserveCards.forEach((card,i)=>{const c=this.model.reserve[i];card.node.active=!!c;if(c){this.paint(card.pen,86,48,this.colors[c.color]);card.label.string=`${SYMBOLS[c.color]} ${c.ammo}`;}});
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
    private drawProjectiles():void {
        const g=this.projectilePen;g.clear();
        for(let i=this.visualShots.length-1;i>=0;i--){const shot=this.visualShots[i],flight=this.model.flights.find(f=>f.id===shot.flightId);if(!flight){this.visualShots.splice(i,1);continue;}
            const target=this.voxels[shot.id];if(!target)continue;const aim=new Vec3(0,this.model.cells[shot.id].shape==='hemisphere'?.23:0,0);Vec3.transformMat4(aim,aim,target.worldMatrix);const screen=this.camera.worldToScreen(aim),world=this.uiCamera.screenToWorld(screen),end=this.ui.getComponent(UITransform)!.convertToNodeSpaceAR(world);
            const x=-245+shot.slot*98,y=-175,t=Math.max(0,Math.min(1,1-flight.time/(flight.duration??FLIGHT_SECONDS))),cx=(x+end.x)/2,cy=Math.max(y,end.y)+30;
            const px=(1-t)*(1-t)*x+2*(1-t)*t*cx+t*t*end.x,py=(1-t)*(1-t)*y+2*(1-t)*t*cy+t*t*end.y;
            g.strokeColor=new Color('#a9d9cf');g.lineWidth=3;g.moveTo(x,y);g.lineTo(px,py);g.stroke();g.fillColor=new Color('#ffffed');g.circle(px,py,6);g.fill();
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
        this.paint(this.camp.addComponent(Graphics), 640, 1120, '#fff3dc', 0);
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
        this.text(this.camp, '鸭命要紧', 54, 0, 460, 500, '#17493e');
        this.campTitle = this.text(this.camp, '', 27, 0, -321, 500, '#17493e');
        this.campStatus = this.text(this.camp, '', 17, 0, -367, 530, '#345a50');
        const go = this.button(this.camp, '出发救鸭', 0, -428, 465, 74, () => {
            if (this.runStarted && this.model.phase === 'paused') {
                this.camp.active = false;
                this.world.active = true;
                this.model.resume();
                this.refresh(true);
                return;
            }
            this.load(this.unlocked === 2 ? LAST_RESCUE : FIRST_RESCUE);
        }, '#f5af61');
        go.label.fontSize = 29;
        this.button(this.camp, '图鉴', 146, -512, 250, 57, () => this.openAlbum(), '#dfece1');
        this.button(this.camp, '音效开关', -146, -512, 250, 57, () => {
            this.muted = !this.muted;
            try { sys.localStorage.setItem('color-clear.muted', String(this.muted)); } catch {}
            this.campStatus.string = this.muted ? '音效已关' : '音效已开';
        }, '#dfece1');
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
            card.label.string = (unlocked ? '✓' : '?') + '\n' + rescue.name;
            this.paint(card.pen, 250, 260, unlocked ? '#dcecdf' : '#eeeade');
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
    private touchMove(e: EventTouch): void { if (e.getID() === this.dragId) { this.orbit.drag(this.model,e.getUIDelta().x*.67,-e.getUIDelta().y*.67,this.clock-this.lastDrag);this.lastDrag=this.clock;this.refresh(true); } }
    private touchEnd(e: EventTouch): void { if (e.getID() === this.dragId) { this.orbit.release(e.type===Input.EventType.TOUCH_CANCEL,this.clock-this.lastDrag); this.dragId = -1; } }
    update(dt: number): void {
        this.clock += dt;
        if (this.camp.active || this.albumPanel.active) return;
        this.bonusLabel.node.active = this.clock < this.bonusUntil;
        this.orbit.step(this.model,dt,this.dragId>=0);
        this.model.tick(dt);Quat.fromAxisAngle(this.qPitch,new Vec3(1,0,0),this.model.pitch);Quat.fromAxisAngle(this.qYaw,new Vec3(0,1,0),this.model.yaw);Quat.multiply(this.qModel,this.qPitch,this.qYaw);this.world.setRotation(this.qModel);
        for (const e of this.model.drainEvents()) {
            if(e.type==='won')this.album.book.unlock(this.model.level.id);
            if(e.type==='bonus'){this.bonusUntil=this.clock+1.1;this.soundFor('chain');}
            if (e.type === 'clear' && e.cell) { this.burst(e.cell); this.voxels[e.cell.id].active = false; }
            if(e.type==='fire'&&e.cell)this.visualShots.push({slot:e.slot!,id:e.cell.id,flightId:e.flightId!,age:0});
            if (e.type === 'hit') { if (this.clock - this.lastHitSound > .045) { this.soundFor('hit'); this.lastHitSound = this.clock; } }
            else if (['load', 'chain', 'won', 'lost'].includes(e.type)) this.soundFor(e.type);
        }
        for (let i = this.fragments.length - 1; i >= 0; i--) { const p = this.fragments[i]; p.age += dt; if (p.age > .65) { p.node.destroy(); this.fragments.splice(i, 1); continue; } p.vy -= 14 * dt; p.node.translate(new Vec3(p.vx * dt, p.vy * dt, p.vz * dt)); p.node.setScale(.16 * (1 - p.age / .65), .16 * (1 - p.age / .65), .16 * (1 - p.age / .65)); }
        if (this.model.phase === 'won' && this.previousPhase !== 'won') { this.unlocked = 2; try { sys.localStorage.setItem(PROGRESS_KEY, '2'); } catch { /* optional */ } }
        this.drawProjectiles();
        this.previousPhase = this.model.phase; this.refresh();
    }
    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); game.off(Game.EVENT_HIDE, this.pause, this);
        this.campFrame?.destroy();this.campImage?.destroy();for (const m of this.materialsByColor.values()) m.destroy();for(const m of this.meshCache.values())m.destroy();
    }
}
