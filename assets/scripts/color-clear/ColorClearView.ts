import { _decorator, Component, Node, Camera, Canvas, UITransform, Graphics, Label, Color, Layers, Rect, Mesh, MeshRenderer, Material, primitives, utils, DirectionalLight, input, Input, EventTouch, view, ResolutionPolicy, game, Game, resources, AudioClip, AudioSource, sys, isValid, Vec3, tween } from 'cc';
import { ColorClearGame, FLIGHT_SECONDS } from './ColorClearGame';
import type { Voxel, RewardTicket, PieceShape } from './ColorClearGame';
import { makeLevel, LEVEL_COUNT } from './ColorClearLevels';
import {specialPieceGeometry} from './ColorClearGeometry';
const { ccclass, property } = _decorator;
const COLORS = ['#f28576', '#efc75f', '#7eb5e1', '#70bba0'];
const SYMBOLS = ['●', '▲', '◆', '■'];
type Card = { node: Node; pen: Graphics; label: Label };
/** Attach only to a new empty scene after selecting the colorClear engine profile.
 * Browser preview is validated independently; this adapter requires Creator import/runtime validation. */
@ccclass('ColorClearView')
export class ColorClearView extends Component {
    @property showProgress = false;
    @property showRemaining = false;
    @property showLabels = false;
    @property showBackground = true;
    private model = new ColorClearGame(makeLevel(1));
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
    private materials: Material[] = [];
    private voxels: Node[] = [];
    private fragments: { node: Node; age: number; vx: number; vy: number; vz: number }[] = [];
    private slots: Card[] = [];
    private markers: Node[] = [];
    private rotationSpeed = 0;
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
        view.setDesignResolutionSize(640, 1120, ResolutionPolicy.SHOW_ALL);
        try { this.unlocked = Math.max(1, Math.min(LEVEL_COUNT, Number(sys.localStorage.getItem('color-clear.unlocked')) || 1)); this.muted = sys.localStorage.getItem('color-clear.muted') === 'true'; } catch { /* storage optional */ }
        this.cube = utils.MeshUtils.createMesh(primitives.box());this.meshCache.set('box',this.cube);
        this.meshCache.set('sphere',utils.MeshUtils.createMesh(primitives.sphere(.5)));
        this.meshCache.set('cylinder',utils.MeshUtils.createMesh(primitives.cylinder(.5,.5,1)));
        for(const kind of ['hemisphere','wedge'] as const)this.meshCache.set(kind,utils.MeshUtils.createMesh(specialPieceGeometry(kind)));
        this.materials = [...COLORS, '#fff4ce'].map(hex => { const m = new Material(); m.initialize({ effectName: 'builtin-standard', defines: { USE_INSTANCING: true } }); m.setProperty('mainColor', new Color(hex)); return m; });
        const backdrop = this.child(this.node, 'ColorClearBackground', false).addComponent(Camera);
        backdrop.priority = -10; backdrop.visibility = 0; backdrop.clearFlags = Camera.ClearFlag.SOLID_COLOR; backdrop.clearColor = new Color(this.showBackground?'#edf3e4':'#fafaf2');
        this.camera = this.child(this.node, 'ColorClearCamera', false).addComponent(Camera);
        this.camera.node.setPosition(0, 0, 30); this.camera.projection = Camera.ProjectionType.ORTHO; this.camera.near = .1; this.camera.far = 100;
        this.camera.rect = new Rect(0, .39, 1, .48); this.camera.visibility = Layers.Enum.DEFAULT; this.camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; this.camera.priority = 0;
        this.world = this.child(this.node, 'ColorClearModel', false);
        const light = this.child(this.node, 'ColorClearLight', false); light.setRotationFromEuler(-35, -25, 0); light.addComponent(DirectionalLight).illuminance = 65000;
        this.ui = this.child(this.node, 'ColorClearUI', true); this.ui.addComponent(UITransform).setContentSize(640, 1120);
        const canvas = this.ui.addComponent(Canvas);
        const uiCamera = this.child(this.node, 'ColorClearUICamera', false).addComponent(Camera);
        uiCamera.node.setPosition(0, 0, 1000); uiCamera.projection = Camera.ProjectionType.ORTHO; uiCamera.orthoHeight = 560; uiCamera.near = 1; uiCamera.far = 2000;
        uiCamera.visibility = Layers.Enum.UI_2D; uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY; uiCamera.priority = 10; canvas.cameraComponent = uiCamera;this.uiCamera=uiCamera;
        this.text(this.ui, 'A LITTLE COLOR BREAK', 13, 0, 520, 500, '#84998a');
        this.text(this.ui, '转转积木', 34, 0, 480, 500);
        this.title = this.text(this.ui, '', 19, 0, 430, 540, '#718678');
        this.button(this.ui, 'Ⅱ', -260, 490, 60, 60, () => this.pause());
        this.remaining = this.text(this.ui, '', 18, 0, 393, 540, '#8a9991');
        this.text(this.ui, '↔ 左右拖动，发现另一面', 17, 0, -95, 550, '#8aa28d');
        this.text(this.ui, '发射台', 20, -210, -150, 160);
        this.status = this.text(this.ui, '', 16, 90, -150, 360, '#8a9991');
        for (let i = 0; i < 6; i++) this.slots.push(this.button(this.ui, '', -245 + i * 98, -220, 86, 90, () => {if(i===this.model.slots.length)this.startReward('slot');}, '#f0f2e9'));
        for(let i=0;i<6;i++){const card=this.button(this.ui,'',-245+i*98,-291,86,48,()=>{if(this.model.takeReserve(i))this.refresh(true);});card.node.active=false;this.reserveCards.push(card);}
        this.text(this.ui, '下一批颜色 · 点前排入槽', 20, 0, -330, 550);
        for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
            const card = this.button(this.ui, '', -222 + col * 148, -378 - row * 88, 124, row ? 62 : 90, () => { if (row === 0 && this.model.phase === 'playing') {
                const slot = this.model.slots.indexOf(null);
                if (this.model.select(col)) {
                    const capsule = this.model.slots[slot]!; this.refresh(true);
                    const flight = this.button(this.ui, `${SYMBOLS[capsule.color]} ${capsule.ammo}`, -222 + col * 148, -378, 104, 78, () => {}, COLORS[capsule.color]);
                    tween(flight.node).to(.18, { position: new Vec3(-245 + slot * 98, -220, 0) }).call(() => flight.node.destroy()).start();
                }
            } });
            this.supplies.push(card);
        }
        this.text(this.ui, '没有倒计时，想好了再点 · ◇ 核心可连锁', 16, 0, -530, 590, '#8a9991');
        this.dialog = this.child(this.ui, 'ColorClearDialog', true);
        this.dialog.addComponent(UITransform).setContentSize(640, 1120);
        this.paint(this.dialog.addComponent(Graphics), 640, 1120, '#eef2e0', 0);
        this.phaseText = this.text(this.dialog, '', 38, 0, 170, 560);
        this.resultText = this.text(this.dialog, '', 22, 0, 70, 530, '#718678');
        this.button(this.dialog, '继续 / 下一关', 0, -40, 440, 82, () => {
            if(this.model.phase==='lost'&&this.model.canContinue){this.startReward('continue');return;}
            if (this.model.phase === 'paused') this.model.resume();
            else this.load(this.model.phase === 'won' ? (this.model.level.id % LEVEL_COUNT) + 1 : this.model.level.id);
            this.refresh(true);
        }, '#70bba0');
        this.button(this.dialog, '重新开始这一关', 0, -150, 440, 72, () => this.load(this.model.level.id));
        this.button(this.dialog, '声音开关', 0, -250, 440, 64, () => { this.muted = !this.muted; try { sys.localStorage.setItem('color-clear.muted', String(this.muted)); } catch { /* optional */ } this.refresh(true); });
        this.rewardPanel=this.child(this.ui,'SimulatedReward',true);this.rewardPanel.addComponent(UITransform).setContentSize(640,1120);this.paint(this.rewardPanel.addComponent(Graphics),640,1120,'#eef2e0',0);
        this.rewardTitle=this.text(this.rewardPanel,'开发测试 · 模拟广告',28,0,160,560);
        this.text(this.rewardPanel,'没有接入真实微信广告',21,0,80,520,'#718678');
        this.button(this.rewardPanel,'模拟看完并领取',0,-30,440,82,()=>this.finishReward(true),'#70bba0');
        this.button(this.rewardPanel,'取消，不领取',0,-145,440,72,()=>this.finishReward(false));this.rewardPanel.active=false;
        this.projectilePen=this.child(this.ui,'ProjectileOverlay',true).addComponent(Graphics);
        this.sound = this.node.addComponent(AudioSource);
        for (const name of ['load', 'hit', 'chain', 'won', 'lost']) resources.load(`color-clear-audio/${name}`, AudioClip, (error, clip) => { if (!error && clip && isValid(this.node)) this.clips.set(name, clip); });
        input.on(Input.EventType.TOUCH_START, this.touchStart, this); input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        game.on(Game.EVENT_HIDE, this.pause, this);
        this.load(1);
    }
    private child(parent: Node, name: string, ui: boolean): Node { const n = new Node(name); n.layer = ui ? Layers.Enum.UI_2D : Layers.Enum.DEFAULT; parent.addChild(n); return n; }
    private text(parent: Node, value: string, size: number, x: number, y: number, width: number, color = '#293b39'): Label {
        const n = this.child(parent, 'Text', true); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(width, size * 3.6);
        const l = n.addComponent(Label); l.string = value; l.fontSize = size; l.lineHeight = size * 1.45; l.color = new Color(color); l.horizontalAlign = Label.HorizontalAlign.CENTER; l.verticalAlign = Label.VerticalAlign.CENTER; l.overflow = Label.Overflow.SHRINK; if(!this.showLabels&&['A LITTLE COLOR BREAK','转转积木','↔ 左右拖动，发现另一面','发射台','下一批颜色 · 点前排入槽','没有倒计时，想好了再点 · ◇ 核心可连锁'].includes(value))n.active=false;return l;
    }
    private paint(g: Graphics, w: number, h: number, hex: string, radius = 20): void { g.clear(); g.fillColor = new Color(hex); g.roundRect(-w / 2, -h / 2, w, h, radius); g.fill(); }
    private button(parent: Node, label: string, x: number, y: number, w: number, h: number, click: () => void, color = '#edf1e5'): Card {
        const n = this.child(parent, 'Button', true); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); const pen = n.addComponent(Graphics); this.paint(pen, w, h, color);
        const l = this.text(n, label, 23, 0, 0, w - 10);
        n.on(Node.EventType.TOUCH_END, () => { if (isValid(this.node)) click(); }); return { node: n, pen, label: l };
    }
    private cubeNode(parent: Node, name: string, color: number, shape: PieceShape='box'): Node {
        const n = this.child(parent, name, false); const r = n.addComponent(MeshRenderer); r.mesh = this.meshCache.get(shape)!; r.setMaterial(this.materials[color], 0); return n;
    }
    private load(id: number): void {
        if(this.pendingReward){this.pendingReward.owner.resolveReward(this.pendingReward.ticket,false);this.pendingReward=null;}if(this.rewardPanel)this.rewardPanel.active=false;this.visualShots=[];
        this.model = new ColorClearGame(makeLevel(id)); this.dragId = -1; this.rotationSpeed = 0; this.signature = ''; this.previousPhase = '';
        this.world.removeAllChildren(); for (const n of this.voxels) n.destroy(); this.voxels = []; this.markers = [];
        for (const p of this.fragments) p.node.destroy(); this.fragments = [];
        for (const cell of this.model.cells) {
            const n = this.cubeNode(this.world, `Block-${cell.id}`, cell.color, cell.shape); n.setPosition(cell.x, cell.y, cell.z); n.setScale(cell.shape&&cell.shape!=='box'?1:.94,cell.shape&&cell.shape!=='box'?1:.94,cell.shape&&cell.shape!=='box'?1:.94); this.voxels.push(n);
            if (cell.core) { const mark = this.cubeNode(n, 'ChainCore', 4); mark.setPosition(0, 0, .54); mark.setScale(.25, .25, .12); }
            const range = this.cubeNode(n, 'RangeCorner', 4); range.setPosition(.41, .41, .51); range.setScale(.11, .11, .05); range.active = false; this.markers.push(range);
        }
        this.camera.orthoHeight = Math.max(5, Math.max(...this.model.cells.map(c => Math.abs(c.x))) + 3);
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
        const sig = JSON.stringify([this.model.phase, this.model.remaining, this.model.slots, this.model.supply.map(c => c.slice(0, 2)), this.muted, this.model.reserve]);
        if (!force && sig === this.signature) return; this.signature = sig;
        this.title.string = `第 ${String(this.model.level.id).padStart(2, '0')} 关 · ${this.model.level.name}`;
        this.remaining.node.active=this.showRemaining||this.showProgress;this.remaining.string=[this.showRemaining?`剩余 ${this.model.remaining} 块`:'',this.showProgress?`已清除 ${Math.round(this.model.progress*100)}%`:''].filter(Boolean).join(' · ');this.status.node.active=this.showLabels;
        const targets = this.model.visibleTargets();
        const visible = new Set(targets.map(c => c.color));
        const affected = new Set(targets.filter(c => c.core).flatMap(c => this.model.chainPreview(c.id).map(b => b.id)));
        this.markers.forEach((n, i) => n.active = this.model.cells[i].alive && affected.has(i));
        this.status.string = this.model.slots.some(s => s && visible.has(s.color)) ? '同色消除中' : '↔ 转一转找同色';
        this.slots.forEach((card, i) => { const s = this.model.slots[i]; this.paint(card.pen,86,90,s?COLORS[s.color]:'#f0f2e9');card.label.string=i>=this.model.slots.length?'▣':s?`${SYMBOLS[s.color]} ${s.ammo}`:''; });
        this.supplies.forEach((card, i) => { const row = Math.floor(i / 4), s = this.model.supply[i % 4][row]; this.paint(card.pen, 124, row ? 62 : 90, s ? COLORS[s.color] : '#f0f2e9'); card.label.string = s ? `${SYMBOLS[s.color]} ${s.ammo}` : '·'; });
        this.reserveCards.forEach((card,i)=>{const c=this.model.reserve[i];card.node.active=!!c;if(c){this.paint(card.pen,86,48,COLORS[c.color]);card.label.string=`${SYMBOLS[c.color]} ${c.ammo}`;}});
        this.dialog.active = this.model.phase !== 'playing';
        this.phaseText.string = this.model.phase === 'won' ? '清得漂亮！' : this.model.phase === 'lost' ? '换个顺序再来' : '休息一下';
        this.resultText.string = this.model.phase === 'lost' ? this.model.reason : `已清除 ${this.model.cells.length - this.model.remaining} 块\n声音：${this.muted ? '关' : '开'}`;
    }
    private startReward(kind:'slot'|'continue'):void {
        const owner=this.model,ticket=owner.beginReward(kind);if(!ticket)return;this.pendingReward={owner,ticket};this.rotationSpeed=0;this.dragId=-1;
        this.rewardTitle.string=kind==='slot'?`开发测试 · 模拟解锁第${owner.slots.length+1}槽`:'开发测试 · 模拟暂存续关';this.rewardPanel.active=true;this.refresh(true);
    }
    private finishReward(completed:boolean):void {
        const pending=this.pendingReward;if(!pending)return;this.pendingReward=null;this.rewardPanel.active=false;pending.owner.resolveReward(pending.ticket,completed);if(pending.owner===this.model)this.refresh(true);
    }
    private drawProjectiles():void {
        const g=this.projectilePen;g.clear();
        for(let i=this.visualShots.length-1;i>=0;i--){const shot=this.visualShots[i],flight=this.model.flights.find(f=>f.id===shot.flightId);if(!flight){this.visualShots.splice(i,1);continue;}
            const target=this.voxels[shot.id];if(!target)continue;const aim=target.worldPosition.clone();if(this.model.cells[shot.id].shape==='hemisphere')aim.y+=.23;const screen=this.camera.worldToScreen(aim),world=this.uiCamera.screenToWorld(screen),end=this.ui.getComponent(UITransform)!.convertToNodeSpaceAR(world);
            const x=-245+shot.slot*98,y=-175,t=Math.max(0,Math.min(1,1-flight.time/FLIGHT_SECONDS)),cx=(x+end.x)/2,cy=Math.max(y,end.y)+30;
            const px=(1-t)*(1-t)*x+2*(1-t)*t*cx+t*t*end.x,py=(1-t)*(1-t)*y+2*(1-t)*t*cy+t*t*end.y;
            g.strokeColor=new Color('#a9d9cf');g.lineWidth=3;g.moveTo(x,y);g.lineTo(px,py);g.stroke();g.fillColor=new Color('#ffffed');g.circle(px,py,6);g.fill();
        }
    }
    private pause(): void { this.dragId = -1; this.rotationSpeed = 0; this.model.pause(); this.refresh(true); }
    private touchStart(e: EventTouch): void { const p = e.getUILocation(); if (this.model.phase === 'playing' && this.dragId < 0 && p.y > 450 && p.y < 970) { this.dragId = e.getID(); this.rotationSpeed = 0; this.lastDrag = this.clock; } }
    private touchMove(e: EventTouch): void { if (e.getID() === this.dragId) { const delta = e.getUIDelta().x * .008; this.rotationSpeed = Math.max(-1.8, Math.min(1.8, delta / Math.max(.008, this.clock - this.lastDrag))); this.lastDrag = this.clock; this.model.rotate(delta); this.refresh(true); } }
    private touchEnd(e: EventTouch): void { if (e.getID() === this.dragId) { if (e.type === Input.EventType.TOUCH_CANCEL || this.clock - this.lastDrag > .09) this.rotationSpeed = 0; this.dragId = -1; } }
    update(dt: number): void {
        this.clock += dt;
        if (this.model.phase === 'playing' && this.dragId < 0 && Math.abs(this.rotationSpeed) > .015) { this.model.rotate(this.rotationSpeed * Math.min(dt, .04)); this.rotationSpeed *= Math.exp(-18 * Math.min(dt, .04)); this.refresh(true); }
        this.model.tick(dt); this.world.setRotationFromEuler(0, this.model.yaw * 180 / Math.PI, 0);
        for (const e of this.model.drainEvents()) {
            if (e.type === 'clear' && e.cell) { this.burst(e.cell); this.voxels[e.cell.id].active = false; }
            if(e.type==='fire'&&e.cell)this.visualShots.push({slot:e.slot!,id:e.cell.id,flightId:e.flightId!,age:0});
            if (e.type === 'hit') { if (this.clock - this.lastHitSound > .045) { this.soundFor('hit'); this.lastHitSound = this.clock; } }
            else if (['load', 'chain', 'won', 'lost'].includes(e.type)) this.soundFor(e.type);
        }
        for (let i = this.fragments.length - 1; i >= 0; i--) { const p = this.fragments[i]; p.age += dt; if (p.age > .65) { p.node.destroy(); this.fragments.splice(i, 1); continue; } p.vy -= 14 * dt; p.node.translate(new Vec3(p.vx * dt, p.vy * dt, p.vz * dt)); p.node.setScale(.16 * (1 - p.age / .65), .16 * (1 - p.age / .65), .16 * (1 - p.age / .65)); }
        if (this.model.phase === 'won' && this.previousPhase !== 'won') { this.unlocked = Math.max(this.unlocked, Math.min(LEVEL_COUNT, this.model.level.id + 1)); try { sys.localStorage.setItem('color-clear.unlocked', String(this.unlocked)); } catch { /* optional */ } }
        this.drawProjectiles();
        this.previousPhase = this.model.phase; this.refresh();
    }
    onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); game.off(Game.EVENT_HIDE, this.pause, this);
        for (const m of this.materials) m.destroy();for(const m of this.meshCache.values())m.destroy();
    }
}
