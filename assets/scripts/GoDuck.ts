import { _decorator, Component, Node, Graphics, Color, UITransform, Label, input, Input, EventKeyboard, KeyCode, EventTouch, view, ResolutionPolicy, profiler, game, Game as CocosGame, Canvas, resources, Sprite, SpriteFrame, JsonAsset, Texture2D, isValid, sys } from 'cc';
import { EscapeGame, Character } from './EscapeGame';
import { SurvivorGame } from './SurvivorGame';
import { SaveState, loadSave, persist, recordResult, recordStart, nextUnlockTarget, regenAttempts, spendAttempt, grantAdBonus, MAX_ATTEMPTS, REGEN_MS, AD_BONUS, SAVE_KEY } from './SaveData';
const { ccclass } = _decorator;
const CHARACTER_NAMES: Record<Character, string> = { shooter: '射手鸭', warrior: '战士鸭', mage: '法师鸭' };

// ── 视觉系统「暖夜加工厂」─────────────────────────────────────
// 所有颜色集中在此，方便后续换肤。整体走低饱和夜色 + 暖光点缀，
// 让像素鸭、谷粒和弹幕保持最高对比度，长时间盯着也不刺眼。
const PAL = {
    nightTop: '#1B2740',
    nightMid: '#27374F',
    nightBottom: '#141D33',
    ink: '#0C1424',
    card: '#1C2B45',
    cardEdge: '#5A6E92',
    glowWarm: '#FFD28A',
    glowCool: '#7FD9D2',
    text: '#FBF4E6',
    textDim: '#BAC8DC',
    textFaint: '#8496B2',
    gold: '#FFD98A',
    goldDeep: '#E9A85C',
    mint: '#8FE3D0',
    coral: '#FF8C93',
    lilac: '#C9BCFF',
    floorLine: '#7186A8',
    danger: '#FF6F80',
};
// ── 视觉系统「晴日牧场」：割草模式的亮色 Q 版像素风 ──────────────
// 与上面的暖夜加工厂（经典模式）完全隔离；以奶油/薄荷草地为底，
// 用高饱和金、青、珊瑚红把剑气、魂珠、伤害数字从浅色背景里拉出来。
const Q = {
    skyTop: '#DFF4F7',
    skyMid: '#F2FBE9',
    skyBottom: '#FFF3D6',
    grassA: '#CDEDC4',
    grassB: '#BFE4B4',
    grassLine: '#9FCE9B',
    hill: '#8FCFA8',
    hillShade: '#77BE95',
    cloud: '#FFFFFF',
    sun: '#FFE9A3',
    ink: '#33445C',
    inkSoft: '#6B7E93',
    panel: '#FFFBF0',
    panelEdge: '#E7C88A',
    panelShade: '#F3E6C8',
    gold: '#FFC94A',
    goldDeep: '#E99A2E',
    sword: '#FFF3AF',
    swordEdge: '#FFB238',
    mint: '#4BD3A5',
    mintLight: '#A9F2D2',
    coral: '#FF6F79',
    lilac: '#B79CFF',
    damage: '#E4504C',
    crit: '#FF8A24',
    heart: '#FF6272',
    gem: '#42CF9C',
    gemLight: '#A5F5CE',
    enemyInk: '#3B4B63',
    danger: '#FF5D6B',
    white: '#FFFFFF',
    // 沉没地牢浅水遗迹地面（与 concept-art 01 调色板一致）
    floorA: '#C6DADE',
    floorB: '#B0C2CC',
    floorLine: '#7A94B2',
    floorShade: '#566E8E',
    glowSpot: '#B2FAF4',
};
const PORTAL_INTRO = 1.35; // 开局传送阵演出时长（秒）
const MOW_PORTAL_INTRO = 1.1;
const rgbOf = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16),
});
const mixHex = (a: string, b: string, t: number) => {
    const x = rgbOf(a), y = rgbOf(b), h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h(x.r + (y.r - x.r) * t) + h(x.g + (y.g - x.g) * t) + h(x.b + (y.b - x.b) * t);
};
// 确定性伪随机：地面装饰每帧位置固定，不会闪烁。
const noise = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
};

@ccclass('GoDuck')
export class GoDuck extends Component {
    // 默认进入割草模式；经典模式保留完整旧玩法，菜单里一键切换。
    mode: 'mow' | 'classic' = 'mow';
    mow = new SurvivorGame();
    classic = new EscapeGame();
    // 经典模式的既有代码继续用 this.game 读写；两种状态对象结构不同，故用 any 兼容。
    private get game(): any {
        return this.mode === 'mow' ? this.mow : this.classic;
    }
    private save: SaveState = loadSave(sys.localStorage.getItem(SAVE_KEY));
    private selected: Character = 'shooter';
    private newUnlocks: Character[] = [];
    private menuSig: string | undefined;
    // Settlement performance: -1 idle, 0..2 animation playing, >=2 results panel. Tap or any key skips.
    private settleFor = -1;
    // 传送阵入场演出与救鸭提示：纯表现层状态，不参与规则判定。
    private portalIntro = 0;
    private rescueToast = 0;
    private toastCount = 0;
    private toastY = 0;
    private lastRescued = 0;
    private toastLabel: Label;
    // 割草模式专用：伤害数字复用固定池，自动升级飘条与底部技能栏各一组标签。
    private floatLabels: Label[] = [];
    private upgradeLabels: Label[] = [];
    private skillLabels: Label[] = [];
    private mowIntro = 0;
    private mowToast = 0;
    private mowToastCount = 0;
    private lastMowRescued = 0;
    private pen: Graphics;
    // 渲染分层：静态氛围 / 世界地面 / 动态对象 / 精灵 / HUD 与菜单 / 文字 / 按钮。
    private bgPen: Graphics;
    private groundPen: Graphics;
    private framePen: Graphics;
    // 沉没地牢像素背景：菜单用标题图，割草局内用水下遗迹图，经典模式保留程序绘制。
    private bgSprite: Sprite | null = null;
    private bgFrames = new Map<string, SpriteFrame>();
    private bgKey = '';
    private menuDuck: Sprite;
    private colorCache = new Map<string, Color>();
    private clock = 0;
    // Profiler 基线：默认关闭统计，正式包无额外开销；开启后每 2 秒输出一行可复制的采样 JSON。
    private profiling = false;
    private profileAcc = 0;
    private s = 1;
    private enemyRoot: Node;
    private enemyFrames = new Map<string, SpriteFrame>();
    private enemySprites: Sprite[] = [];
    private duckSprite: Sprite;
    private duckFrames = new Map<string, SpriteFrame>();
    private duckManifest: { idle: Record<string, string>; walk: Record<string, string[]> };
    private duckDirection = 'south';
    private duckTime = 0;
    private duckX = 0;
    private duckY = 0;
    private hud: Label;
    private note: Label;
    private panel: Node;
    private banner: Label;
    private progress: Label;
    private gearLabels: Label[] = [];
    private keys = new Set<number>();
    private finger = -1;
    private origin = { x: 0, y: 0 };
    private stick = { x: 0, y: 0 };
    private w = 640;
    private h = 1120;
    private state = '';
    private audio: any;
    private muted = false;
    private soundAt = 0;
    private pauseButton: Node;
    private audioButton: Node;
    onLoad() {
        const preview = this.node.parent.getChildByName('EditorPreview');
        if (preview)
            preview.active = false;
        // 真机采样入口：微信开发者工具控制台执行
        // wx.setStorageSync('goduck.profiler', '1') 后重启小游戏即可打开统计。
        try {
            this.profiling = sys.localStorage.getItem('goduck.profiler') === '1';
        } catch {
            this.profiling = false;
        }
        if (this.profiling) profiler.showStats();
        else profiler.hideStats();
        this.bgPen = this.layer('Backdrop');
        this.groundPen = this.layer('Ground');
        this.pen = this.layer('World');
        this.selected = this.save.current;
        this.loadEnemies();
        this.loadDuck();
        this.loadBackdrops();
        this.framePen = this.layer('HudFrame');
        const duckNode = new Node('MenuDuck');
        duckNode.layer = this.node.layer;
        this.node.addChild(duckNode);
        duckNode.addComponent(UITransform).setContentSize(120, 120);
        this.menuDuck = duckNode.addComponent(Sprite);
        this.menuDuck.sizeMode = Sprite.SizeMode.CUSTOM;
        duckNode.active = false;
        this.hud = this.label(this.node, '', 24, 0, 0, 620, { color: PAL.text, bold: true });
        this.note = this.label(this.node, '', 18, 0, 0, 620, { color: PAL.textDim });
        this.banner = this.label(this.node, '', 25, 0, 0, 590, { color: PAL.gold, bold: true });
        this.progress = this.label(this.node, '', 18, 0, 0, 590, { color: PAL.text });
        this.gearLabels = [0, 1].map(() => this.label(this.node, '', 19, 0, 0, 190, { color: PAL.text, bold: true }));
        this.toastLabel = this.label(this.node, '', 22, 0, 140, 340, { color: PAL.mint, bold: true });
        this.toastLabel.node.active = false;
        // 割草模式标签池：全部预创建，运行时只改 string / position / active，避免每帧建节点。
        this.floatLabels = Array.from({ length: 14 }, () => {
            const l = this.label(this.node, '', 20, 0, 0, 200, { color: Q.damage, bold: true });
            l.node.active = false;
            return l;
        });
        this.upgradeLabels = Array.from({ length: 3 }, () => this.label(this.node, '', 20, 0, 0, 300, { color: Q.ink, bold: true }));
        this.skillLabels = Array.from({ length: 6 }, () => this.label(this.node, '', 17, 0, 0, 100, { color: Q.ink, bold: true }));
        for (const l of [...this.upgradeLabels, ...this.skillLabels])
            l.node.active = false;
        this.panel = new Node('Menus');
        this.panel.layer = this.node.layer;
        this.node.addChild(this.panel);
        this.pauseButton = this.button(this.node, '暂停', 0, 0, 96, () => this.pause(), { variant: 'chip', h: 52 });
        this.audioButton = this.button(this.node, '声音', 0, 0, 96, () => {
            this.muted = !this.muted;
            if (!this.muted)
                this.enableAudio();
        }, { variant: 'chip', h: 52 });
        this.resize();
        view.on('canvas-resize', this.resize, this);
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        game.on(CocosGame.EVENT_HIDE, this.hide, this);
        if (typeof window !== 'undefined')
            window.addEventListener('blur', this.blur);
    }
    onDestroy() {
        view.off('canvas-resize', this.resize, this);
        game.off(CocosGame.EVENT_HIDE, this.hide, this);
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.TOUCH_START, this.touchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        if (typeof window !== 'undefined')
            window.removeEventListener('blur', this.blur);
        this.audio?.close();
    }
    private resize() {
        this.clearInput();
        const size = view.getFrameSize(), aspect = size.width / Math.max(1, size.height);
        this.w = aspect < 1 ? 640 : 640 * aspect;
        this.h = aspect < 1 ? 640 / aspect : 640;
        // 布局以 640×1120 竖屏为基准，横屏或矮屏整体等比收紧。
        this.s = Math.min(1, this.h / 1120, this.w / 640);
        view.setDesignResolutionSize(this.w, this.h, ResolutionPolicy.SHOW_ALL);
        this.game.setViewport(this.w, this.h);
        const s = this.s;
        this.hud.node.setPosition(0, this.h / 2 - 55 * s);
        this.note.node.setPosition(0, this.h / 2 - 110 * s);
        this.banner.node.setPosition(0, this.h / 2 - 300 * s);
        this.progress.node.setPosition(0, -this.h / 2 + 70 * s);
        // 两个按钮必须留在顶部 180px 安全区内，否则会和摇杆抢触摸。
        this.pauseButton.setPosition(this.w / 2 - 62 * s, this.h / 2 - 174 * s);
        this.audioButton.setPosition(-this.w / 2 + 62 * s, this.h / 2 - 174 * s);
        const fit = (l: Label, base: number) => { l.fontSize = Math.round(base * s); l.lineHeight = Math.round(base * 1.4 * s); };
        fit(this.hud, 24); fit(this.note, 18); fit(this.banner, 25); fit(this.progress, 18); fit(this.toastLabel, 22);
        this.gearLabels.forEach(l => fit(l, 19));
        this.floatLabels.forEach(l => fit(l, 20));
        this.upgradeLabels.forEach(l => fit(l, 20));
        this.skillLabels.forEach(l => fit(l, 17));
        for (const b of [this.pauseButton, this.audioButton]) {
            const l = b.getComponentInChildren(Label);
            if (l) l.fontSize = Math.round(20 * s);
        }
        this.menuDuck.node.setPosition(0, 430 * s);
        this.menuDuck.node.getComponent(UITransform).setContentSize(120 * s, 120 * s);
        if (this.mode === 'mow') this.drawBackdropMow();
        else this.drawBackdrop();
        this.state = '';
    }
    // 沉没地牢背景贴图：异步加载，加载完成前回退到程序绘制的亮色天空。
    private loadBackdrops() {
        const n = new Node('PixelBackdrop');
        n.layer = this.node.layer;
        this.node.addChild(n);
        n.setSiblingIndex(0); // 压到最底层，位于 Backdrop 程序绘制之下
        n.addComponent(UITransform);
        const sprite = n.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.node.active = false;
        this.bgSprite = sprite;
        for (const key of ['sunken', 'title']) {
            resources.load('bg/' + key + '/texture', Texture2D, (error, texture) => {
                if (!isValid(this)) return;
                if (error) { console.warn('Backdrop texture could not load: ' + key); return; }
                texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                const frame = new SpriteFrame(); frame.texture = texture;
                this.bgFrames.set(key, frame);
                // 贴图晚于首次 resize 到达：强制重切背景，否则程序天空会一直压在贴图上。
                this.bgKey = '';
                if (this.mode === 'mow') this.drawBackdropMow();
            });
        }
    }

    // 按模式与阶段切换背景贴图；等比放大取中（cover），保证像素不变形。
    private syncBackdrop() {
        const sprite = this.bgSprite;
        if (!sprite) return;
        const want = this.mode === 'mow' ? (this.mow && this.mow.phase === 'menu' ? 'title' : 'sunken') : '';
        if (want !== this.bgKey) {
            this.bgKey = want;
            sprite.node.active = !!want && this.bgFrames.has(want);
            if (want) sprite.spriteFrame = this.bgFrames.get(want) || null;
        }
        if (want && this.bgFrames.has(want)) {
            const scale = Math.max(this.w / 640, this.h / 1120);
            sprite.node.setPosition(0, 0, 0);
            sprite.node.getComponent(UITransform).setContentSize(640 * scale, 1120 * scale);
        }
    }

    private loadEnemies() {
        this.enemyRoot = new Node('PixelEnemies'); this.enemyRoot.layer = this.node.layer;
        this.node.addChild(this.enemyRoot);
        for (const kind of ['glove', 'clip', 'lid']) {
            resources.load('enemies/' + kind + '/texture', Texture2D, (error, texture) => {
                if (!isValid(this)) return;
                if (error) { console.warn('Enemy texture could not load: ' + kind); return; }
                texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                const frame = new SpriteFrame(); frame.texture = texture;
                this.enemyFrames.set(kind, frame);
            });
        }
    }
    private updateEnemies() {
        const g = this.game;
        this.enemyRoot.active = g.phase === 'playing';
        if (!this.enemyRoot.active) return;
        let count = 0;
        for (const enemy of g.enemies) {
            const x = enemy.x - g.x, y = enemy.y - g.y, frame = this.enemyFrames.get(enemy.kind);
            if (!frame || enemy.hp <= 0 || Math.abs(x) > this.w / 2 + 48 || Math.abs(y) > this.h / 2 + 48) continue;
            let sprite = this.enemySprites[count];
            if (!sprite) {
                if (count >= 160) break;
                const n = new Node('Enemy'); n.layer = this.node.layer; this.enemyRoot.addChild(n);
                sprite = n.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                this.enemySprites.push(sprite);
            }
            sprite.node.active = true; sprite.spriteFrame = frame;
            const size = enemy.kind === 'lid' ? 48 : 36;
            sprite.node.getComponent(UITransform).setContentSize(size, size);
            sprite.node.setPosition(x, y);
            const locked = enemy.state === 'windup' || enemy.state === 'dash';
            sprite.node.angle = enemy.kind === 'clip' ? Math.atan2(locked ? enemy.dy : -y, locked ? enemy.dx : -x) * 180 / Math.PI + 135 : 0;
            count++;
        }
        for (let i = count; i < this.enemySprites.length; i++) this.enemySprites[i].node.active = false;
    }
    private loadDuck() {
        const n = new Node('PixelDuck'); n.layer = this.node.layer; this.node.addChild(n);
        this.duckSprite = n.addComponent(Sprite); this.duckSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        n.addComponent(UITransform).setContentSize(48, 48); n.active = false;
        resources.load('duck/manifest', JsonAsset, (error, asset) => {
            if (!isValid(this)) return;
            if (error) { console.warn('Duck sprite manifest could not load', error.message); return; }
            this.duckManifest = asset.json as typeof this.duckManifest;
            const paths = new Set([...Object.values(this.duckManifest.idle), ...Object.values(this.duckManifest.walk).reduce((all, frames) => all.concat(frames), [] as string[])]);
            for (const path of paths) resources.load(path + '/texture', Texture2D, (err, texture) => {
                if (!isValid(this) || err) return;
                texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
                const frame = new SpriteFrame(); frame.texture = texture;
                this.duckFrames.set(path, frame);
            });
        });
    }
    private updateDuck(dt: number) {
        const g = this.game, dx = g.x - this.duckX, dy = g.y - this.duckY;
        this.duckX = g.x; this.duckY = g.y;
        const moving = g.phase === 'playing' && Math.hypot(dx, dy) > .001;
        if (moving) {
            const directions = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
            this.duckDirection = directions[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
            this.duckTime += dt;
        } else if (g.phase !== 'paused') this.duckTime = 0;
        const walk = this.duckManifest?.walk[this.duckDirection];
        const path = moving && walk?.length ? walk[Math.floor(this.duckTime * 9) % walk.length] : this.duckManifest?.idle[this.duckDirection];
        const frame = path && this.duckFrames.get(path);
        this.duckSprite.spriteFrame = frame || this.duckSprite.spriteFrame;
        this.duckSprite.node.active = !!this.duckSprite.spriteFrame && g.phase === 'playing';
    }
    private clearInput() {
        this.keys.clear();
        this.finger = -1;
        this.stick = { x: 0, y: 0 };
    }
    private blur = () => this.hide();
    private hide() {
        if (this.game.phase === 'playing')
            this.game.phase = 'paused';
        this.clearInput();
    }
    private pause() {
        if (this.game.phase === 'playing')
            this.hide();
        else if (this.game.phase === 'paused') {
            this.game.phase = 'playing';
            this.clearInput();
        }
    }
    private keyDown(e: EventKeyboard) {
        this.keys.add(e.keyCode);
        if ((this.game.phase === 'won' || this.game.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2) {
            this.settleFor = 2;
            return;
        }
        if (e.keyCode === KeyCode.ESCAPE)
            this.pause();
    }
    private keyUp(e: EventKeyboard) {
        this.keys.delete(e.keyCode);
    }
    private touchStart(e: EventTouch) {
        if ((this.game.phase === 'won' || this.game.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2) {
            this.settleFor = 2;
            return;
        }
        if (this.game.phase !== 'playing' || this.finger !== -1)
            return;
        const p = e.getUILocation();
        if (p.y > this.h - 180)
            return;
        this.finger = e.getID();
        this.origin = { x: p.x - this.w / 2, y: p.y - this.h / 2 };
        this.stick = { x: 0, y: 0 };
    }
    private touchMove(e: EventTouch) {
        if (e.getID() !== this.finger)
            return;
        const p = e.getUILocation(), x = p.x - this.w / 2 - this.origin.x, y = p.y - this.h / 2 - this.origin.y, d = Math.max(65, Math.hypot(x, y));
        this.stick = { x: x / d, y: y / d };
    }
    private touchEnd(e: EventTouch) {
        if (e.getID() === this.finger) {
            this.finger = -1;
            this.stick = { x: 0, y: 0 };
        }
    }
    private layer(name: string): Graphics {
        const n = new Node(name);
        n.layer = this.node.layer;
        this.node.addChild(n);
        return n.addComponent(Graphics);
    }
    private c(hex: string, a = 255): Color {
        const key = hex + '@' + a;
        let v = this.colorCache.get(key);
        if (!v) { v = new Color(hex); v.a = a; this.colorCache.set(key, v); }
        return v;
    }
    private card(p: Graphics, x: number, y: number, w: number, h: number, r: number, fill: string, alpha = 255, edge?: string, edgeAlpha = 255, lw = 1.5) {
        p.fillColor = this.c(fill, alpha);
        p.roundRect(x, y, w, h, r);
        p.fill();
        if (edge) {
            p.strokeColor = this.c(edge, edgeAlpha);
            p.lineWidth = lw;
            p.roundRect(x, y, w, h, r);
            p.stroke();
        }
    }
    private glow(p: Graphics, x: number, y: number, r: number, hex: string, maxAlpha = 50, layers = 7) {
        for (let i = layers; i >= 1; i--) {
            const t = i / layers;
            p.fillColor = this.c(hex, Math.round(maxAlpha * Math.pow(1 - t, 1.5)));
            p.circle(x, y, r * t);
            p.fill();
        }
    }
    private label(parent: Node, text: string, size: number, x: number, y: number, width: number, opts?: { color?: string; bold?: boolean; lineHeight?: number }) {
        const n = new Node('Text');
        n.layer = parent.layer;
        parent.addChild(n);
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(width, size * 3);
        const l = n.addComponent(Label);
        l.string = text;
        l.fontSize = size;
        l.lineHeight = opts?.lineHeight ?? size * 1.4;
        l.color = this.c(opts?.color ?? PAL.text);
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        if (opts?.bold) (l as any).isBold = true;
        return l;
    }
    private button(parent: Node, text: string, x: number, y: number, width: number, action: () => void,
        opts?: { h?: number; variant?: 'primary' | 'chip' | 'career' | 'ghost'; selected?: boolean; disabled?: boolean }) {
        const h = opts?.h ?? 64, variant = opts?.variant ?? 'ghost';
        const n = new Node('Button');
        n.layer = parent.layer;
        parent.addChild(n);
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(width, h);
        const p = n.addComponent(Graphics);
        const r = Math.min(h / 2, 28);
        if (variant === 'primary' || variant === 'career') {
            p.fillColor = this.c('#000000', 65);
            p.roundRect(-width / 2, -h / 2 - 5, width, h, r);
            p.fill();
        }
        let fill = '#243553', edge = PAL.cardEdge, textColor = PAL.text, edgeAlpha = 170;
        if (variant === 'primary') { fill = PAL.gold; edge = '#FFF4D6'; textColor = '#2B2233'; edgeAlpha = 230; }
        else if (variant === 'chip') { fill = '#1B2942'; edge = PAL.cardEdge; edgeAlpha = 130; textColor = PAL.textDim; }
        else if (variant === 'career') {
            fill = opts?.selected ? '#3B4B6D' : '#1D2B45';
            edge = opts?.selected ? PAL.gold : PAL.cardEdge;
            edgeAlpha = opts?.selected ? 255 : 120;
            textColor = opts?.selected ? PAL.gold : PAL.textDim;
        }
        if (opts?.disabled) { fill = '#1B2438'; edge = '#3E4B66'; textColor = PAL.textFaint; edgeAlpha = 90; }
        this.card(p, -width / 2, -h / 2, width, h, r, fill, variant === 'chip' ? 215 : 255, edge, edgeAlpha, variant === 'primary' ? 2 : 1.5);
        if (variant === 'primary') {
            p.fillColor = this.c('#FFFFFF', 60);
            p.roundRect(-width / 2 + 12, h / 2 - 15, width - 24, 6, 3);
            p.fill();
        }
        const base = variant === 'chip' ? 20 : variant === 'career' ? 18 : 23;
        this.label(n, text, Math.round(base * this.s), 0, 0, width - 12, { color: textColor, bold: variant !== 'chip' });
        n.on(Node.EventType.TOUCH_END, () => {
            this.clearInput();
            if (!opts?.disabled) action();
        });
        return n;
    }
    private enableAudio() {
        try {
            const C = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
            if (!this.audio && C)
                this.audio = new C();
            this.audio?.resume();
        }
        catch {
            this.muted = true;
        }
    }
    private sound(events: string[]) {
        if (this.muted || !this.audio || this.audio.state !== 'running' || !events.length)
            return;
        const now = this.audio.currentTime;
        if (now < this.soundAt)
            return;
        const event = ['hurt', 'evolve', 'gear', 'upgrade', 'wave', 'thunder', 'level', 'heal', 'end', 'warning', 'bubble', 'boss', 'rescue', 'kill', 'pickup', 'hit', 'shot'].find(e => events.includes(e));
        if (!event)
            return;
        this.soundAt = now + .045;
        const o = this.audio.createOscillator(), gain = this.audio.createGain();
        o.type = event === 'hurt' ? 'sawtooth' : 'sine';
        o.frequency.setValueAtTime(({ hurt: 110, evolve: 1100, gear: 820, upgrade: 900, wave: 260, thunder: 170, level: 980, heal: 780, end: 220, warning: 390, bubble: 550, boss: 140, rescue: 720, kill: 650, pickup: 950, hit: 480, shot: 300 } as any)[event], now);
        o.frequency.exponentialRampToValueAtTime(event === 'hurt' ? 60 : 180, now + .07);
        gain.gain.setValueAtTime(.025, now);
        gain.gain.exponentialRampToValueAtTime(.001, now + .09);
        o.connect(gain);
        gain.connect(this.audio.destination);
        o.start(now);
        o.stop(now + .1);
    }
    private writeSave() {
        persist(this.save, (key, value) => sys.localStorage.setItem(key, value));
    }
    private attemptLine() {
        const atk = regenAttempts(this.save, Date.now());
        if (atk.attempts >= MAX_ATTEMPTS)
            return `开局次数 ${atk.attempts}/${MAX_ATTEMPTS} · 充足`;
        const rest = Math.max(0, Math.ceil((REGEN_MS - (Date.now() - atk.attemptUpdatedAt)) / 1000));
        const mm = String(Math.floor(rest / 60)).padStart(2, '0'), ss = String(rest % 60).padStart(2, '0');
        return `开局次数 ${atk.attempts}/${MAX_ATTEMPTS} · 下 1 次 ${mm}:${ss}`;
    }
    private menus() {
        const g = this.game;
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        if (settling) {
            // The panel waits until the performance finishes or is skipped; clear stale panel content once.
            if (this.state !== g.phase) {
                this.state = g.phase;
                for (const n of this.panel.children.slice())
                    n.destroy();
            }
            return;
        }
        if (this.state === g.phase)
            return;
        this.state = g.phase;
        for (const n of this.panel.children.slice())
            n.destroy();
        if (g.phase === 'playing')
            return;
        // A victory is settled exactly once per phase change; repeat wins re-reward nothing.
        if (g.phase === 'won') {
            const result = recordResult(this.save, g.character, true);
            if (result.unlocked.length) {
                this.save = result.save;
                this.newUnlocks = result.unlocked;
                this.writeSave();
            }
        }
        const unlockText = this.newUnlocks.length ? `新解锁：${this.newUnlocks.map(c => CHARACTER_NAMES[c]).join('、')}！` : '';
        const title = g.phase === 'menu' ? '鸭命要紧' : g.phase === 'paused' ? '暂停追捕' : g.phase === 'won' ? '突围成功！' : '被做成鸭货了…';
        const subtitle = g.phase === 'menu' ? '捡谷粒升级 · 拾装备变强 · 冲出加工厂'
            : g.phase === 'paused' ? '手动继续后恢复战斗'
                : g.phase === 'won' ? (unlockText || '冲出了出口——继续用本职业挑战或换新角色')
                    : `包装出品 · 死因：${g.deathCause}`;
        const s = this.s, W = this.w, isMenu = g.phase === 'menu';
        this.button(this.panel, '切换：割草模式', 0, 390 * s, 220 * s, () => this.switchMode('mow'), { variant: 'chip', h: 50 * s });
        this.label(this.panel, title, Math.round(50 * s), 0, 300 * s, W - 30, { color: isMenu ? PAL.gold : PAL.text, bold: true });
        this.label(this.panel, subtitle, Math.round(21 * s), 0, 248 * s, W - 48, { color: PAL.textDim });
        if (isMenu) {
            this.label(this.panel, '选择职业鸭', Math.round(19 * s), 0, 150 * s, W - 40, { color: PAL.textFaint });
            (['shooter', 'warrior', 'mage'] as Character[]).forEach((c, i) => {
                const x = (i - 1) * 140 * s, unlocked = this.save.unlocked.includes(c);
                this.button(this.panel, `${CHARACTER_NAMES[c]}\n${unlocked ? (this.selected === c ? '✓ 已选择' : '点击选择') : '尚未解锁'}`,
                    x, 70 * s, 128 * s, () => {
                        if (!unlocked) return;
                        this.selected = c;
                        this.save = recordStart(this.save, c);
                        this.writeSave();
                        this.state = '';
                    }, { variant: 'career', h: 88 * s, selected: unlocked && this.selected === c, disabled: !unlocked });
            });
        }
        else if (g.phase === 'paused') {
            this.label(this.panel, '本局进度', Math.round(20 * s), 0, 130 * s, W - 60, { color: PAL.textFaint });
            this.label(this.panel, `Lv.${g.level} · 击退 ${g.kills} · 谷粒 ${g.score}\n${this.weaponName()} / ${this.auxiliaryName()}`,
                Math.round(20 * s), 0, 70 * s, W - 60, { color: PAL.text });
        }
        else {
            // 结算主数字：这一局有多少只鸭免于上餐桌。
            this.label(this.panel, `${g.totalRescued} 只鸭`, Math.round(54 * s), 0, 165 * s, W - 60, { color: PAL.gold, bold: true });
            this.label(this.panel, g.phase === 'won' ? '免于上餐桌 · 一起冲出了加工厂' : '免于上餐桌 · 你替它们争取了时间',
                Math.round(21 * s), 0, 122 * s, W - 48, { color: PAL.textDim });
            this.label(this.panel, `经传送阵撤离 ${g.rescued} 只${g.rescueBonus ? ` · 突围加成 ${g.rescueBonus} 只` : ''}`,
                Math.round(18 * s), 0, 88 * s, W - 60, { color: PAL.textFaint });
            this.label(this.panel, `Lv.${g.level} · 击退 ${g.kills} · 谷粒 ${g.score}\n${this.weaponName()} / ${this.auxiliaryName()}`,
                Math.round(18 * s), 0, 44 * s, W - 60, { color: PAL.text });
        }
        // One run costs one attempt, deducted when the run actually starts (not when resuming from pause).
        const atk = regenAttempts(this.save, Date.now());
        const canStart = atk.attempts > 0;
        const startLabel = g.phase === 'paused' ? '继续逃跑' : g.phase === 'menu' ? `开始逃跑（余 ${atk.attempts} 次）` : `再来一局（余 ${atk.attempts} 次）`;
        const mainY = isMenu ? -110 * s : -60 * s;
        if (g.phase !== 'paused' && !canStart) {
            this.label(this.panel, `开局次数不足（0/${MAX_ATTEMPTS}）· 恢复中`, Math.round(24 * s), 0, -8 * s, 380, { color: PAL.coral, bold: true });
            this.button(this.panel, `看广告补 ${AD_BONUS} 次（占位）`, 0, mainY, 400 * s, () => {
                this.save = grantAdBonus(this.save, Date.now());
                this.writeSave();
                this.state = '';
            }, { variant: 'primary', h: 76 * s });
        }
        else
            this.button(this.panel, startLabel, 0, mainY, 400 * s, () => {
                this.enableAudio();
                if (g.phase === 'paused')
                    g.phase = 'playing';
                else {
                    const spent = spendAttempt(this.save, Date.now());
                    if (!spent.ok) {
                        this.state = '';
                        return;
                    }
                    this.save = spent.save;
                    this.writeSave();
                    g.character = this.selected;
                    g.start();
                    // 点「开始」后先播放传送阵入场演出，玩法推进在 update 中冻结。
                    this.portalIntro = PORTAL_INTRO;
                    this.lastRescued = 0;
                    this.rescueToast = 0;
                }
            }, { variant: 'primary', h: 76 * s });
        const tip = isMenu ? '单指拖动 / WASD 移动 · 自动攻击\n25 秒选分支 · 70 秒选辅助 · 120 秒进化\n射手首胜解锁战士 · 战士首胜解锁法师'
            : '单指拖动 / WASD 移动 · 自动攻击\n结算演出可点按任意处跳过';
        this.label(this.panel, tip, Math.round(18 * s), 0, isMenu ? -215 * s : -180 * s, W - 60, { color: PAL.textFaint });
    }
    // 把 profiler.stats 里的关键计数每 2 秒打成一行 JSON，便于从微信开发者工具
    // 控制台直接复制、贴进 docs/baselines 的采集表；关闭时完全不执行。
    private sampleProfiler(dt: number) {
        this.profileAcc += dt;
        if (this.profileAcc < 2) return;
        this.profileAcc = 0;
        const s: any = (profiler as any).stats;
        if (!s) return;
        const v = (k: string) => Math.round((s[k]?.counter?.value ?? 0) * 100) / 100;
        console.log(JSON.stringify({
            tag: 'goduck.profile',
            mode: this.mode,
            phase: this.game.phase,
            enemies: this.game.enemies?.length ?? 0,
            fps: v('fps'),
            frameMs: v('frame'),
            draws: v('draws'),
            instances: v('instances'),
            logic: v('logic'),
            render: v('render'),
            textureMB: v('textureMemory'),
            bufferMB: v('bufferMemory'),
        }));
    }
    update(dt: number) {
        if (this.profiling) this.sampleProfiler(dt);
        this.syncBackdrop();
        if (this.mode === 'mow') {
            this.updateMow(dt);
            return;
        }
        this.clock += dt;
        const camera = this.node.parent.getComponent(Canvas)?.cameraComponent;
        if (camera) {
            const pos = camera.node.worldPosition;
            this.node.setWorldPosition(pos.x, pos.y, 0);
        }
        const g = this.game;
        const mx = this.stick.x + Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT));
        const my = this.stick.y + Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN));
        // 入场演出期间冻结计时、刷怪与伤害，玩家看清传送阵后再正式开局。
        if (g.phase === 'playing' && this.portalIntro > 0)
            this.portalIntro = Math.max(0, this.portalIntro - dt);
        else
            this.game.tick(dt, mx, my);
        this.updateDuck(dt);
        this.updateEnemies();
        this.sound(g.events);
        g.events = [];
        if (g.rescued !== this.lastRescued) {
            this.toastCount = g.rescued - this.lastRescued;
            this.lastRescued = g.rescued;
            this.rescueToast = 1;
        }
        this.rescueToast = Math.max(0, this.rescueToast - dt);
        this.toastY = (140 + (1 - this.rescueToast) * 55) * this.s;
        this.toastLabel.node.active = this.rescueToast > 0 && g.phase === 'playing';
        if (this.toastLabel.node.active) {
            this.toastLabel.node.setPosition(0, this.toastY);
            this.toastLabel.string = `+${this.toastCount} 只鸭经传送阵撤离`;
        }
        const introOn = g.phase === 'playing' && this.portalIntro > 0;
        this.hud.node.active = !introOn;
        this.note.node.active = !introOn;
        this.progress.node.active = !introOn;
        if (g.phase === 'won' || g.phase === 'lost') {
            if (this.settleFor < 0)
                this.settleFor = 0;
            else if (this.settleFor < 2)
                this.settleFor += dt;
        }
        else
            this.settleFor = -1;
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        // Rebuild the menu when regen changes start availability while the player sits on a panel.
        if (g.phase !== 'playing' && g.phase !== 'paused') {
            const atk = regenAttempts(this.save, Date.now());
            const sig = atk.attempts >= MAX_ATTEMPTS ? 'full' : String(atk.attempts);
            if (this.menuSig !== undefined && this.menuSig !== sig)
                this.state = '';
            this.menuSig = sig;
        }
        this.draw();
        this.drawGround();
        this.menus();
        const idlePath = this.duckManifest?.idle?.south;
        const idleFrame = idlePath ? this.duckFrames.get(idlePath) : undefined;
        if (idleFrame) this.menuDuck.spriteFrame = idleFrame;
        this.menuDuck.node.active = g.phase === 'menu' && !!this.menuDuck.spriteFrame;
        const left = Math.max(0, Math.ceil((g.boss ? g.limit : g.duration) - g.time));
        const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
        this.hud.string = `${mm}:${ss}   Lv.${g.level}   救出 ${g.rescued} 只\n击退 ${g.kills}   经验 ${g.level === 12 ? 'MAX' : `${g.xp}/${g.nextXp}`}`;
        this.note.string = `${this.weaponName()}  /  ${this.auxiliaryName()}${this.muted ? ' · 静音' : ''}`;
        this.banner.string = g.phase === 'playing' && this.portalIntro > 0 ? '传送阵启动 · 鸭子入场'
            : settling ? (g.phase === 'won' ? this.rescueText() : `被做成${this.dishName(g.deathCause)}… · 仍有 ${g.totalRescued} 只被你送走`)
                : g.phase === 'playing' && g.noticeFor > 0 ? g.notice : '';
        const c = g.choice;
        this.progress.string = settling ? '点按任意处跳过' : g.phase !== 'playing' ? this.attemptLine() : c
            ? `走近装备二选一 · ${Math.max(0, Math.ceil(c.due + 15 - g.time))} 秒后自动选${c.kind === 'branch' ? (g.character === 'warrior' ? '宽斩' : g.character === 'mage' ? '爆裂' : '长线') : '泡泡圈'}`
            : g.boss ? `击败巨型捕鸭夹！${Math.max(0, Math.ceil(g.limit - g.time))} 秒内突围`
                : g.time < 25 ? `捡谷粒自动升级 · ${Math.ceil(25 - g.time)} 秒后掉落武器分支`
                    : g.time < 70 ? `${Math.ceil(70 - g.time)} 秒后掉落辅助装备`
                        : g.time < 120 ? `${Math.ceil(120 - g.time)} 秒后主武器进化` : '武器已进化！准备迎接出口 Boss';
        const names = { line: '长线\n穿透 5 只', spread: '散射\n三向覆盖', wide: '宽斩\n220° 清群', heavy: '重斩\n高伤窄角', blast: '爆裂\n半径 105', chain: '连锁\n跳两目标', bubble: '泡泡圈\n范围伤害 / 减速', feather: '飞羽\n穿透补刀' };
        this.gearLabels.forEach((label, i) => {
            const o = c?.options[i];
            label.node.active = !!o && g.phase === 'playing';
            if (o) {
                label.string = names[o.key];
                label.node.setPosition(o.x - g.x, o.y - g.y - 54);
            }
        });
        this.pauseButton.active = ['playing', 'paused'].includes(g.phase);
        this.audioButton.active = this.pauseButton.active;
        const pl = this.pauseButton.getComponentInChildren(Label), al = this.audioButton.getComponentInChildren(Label);
        if (pl) pl.string = g.phase === 'paused' ? '继续' : '暂停';
        if (al) al.string = this.muted ? '静音' : '声音';
        // 放在文案赋值之后：卡片宽度可以按当前帧的文字长度自适应。
        this.drawFrame();
    }
    private weaponName() {
        const g = this.game;
        if (g.character === 'warrior')
            return g.evolved ? (g.branch === 'wide' ? '全周宽斩' : '重斩震波') : g.branch === 'wide' ? '宽斩' : g.branch === 'heavy' ? '重斩' : '羽翼锅铲斩';
        if (g.character === 'mage')
            return g.evolved ? (g.branch === 'blast' ? '大爆裂水花' : '四段连锁') : g.branch === 'blast' ? '爆裂水泡' : g.branch === 'chain' ? '连锁水泡' : '水泡';
        return g.evolved ? (g.branch === 'spread' ? '五向风暴' : '双脉冲长线') : g.branch === 'line' ? '长线穿透' : g.branch === 'spread' ? '三向散射' : '谷粒弹';
    }
    private auxiliaryName() {
        return this.game.auxiliary === 'bubble' ? '泡泡圈' : this.game.auxiliary === 'feather' ? '飞羽' : '辅助待掉落';
    }
    private circle(x: number, y: number, r: number, c: string) {
        this.pen.fillColor = this.c(c);
        this.pen.circle(x, y, r);
        this.pen.fill();
    }
    private heart(p: Graphics, x: number, y: number, r: number, filled: boolean, hex: string) {
        p.fillColor = this.c(hex, filled ? 255 : 40);
        p.circle(x - r * .45, y + r * .2, r * .55); p.fill();
        p.circle(x + r * .45, y + r * .2, r * .55); p.fill();
        p.moveTo(x - r, y - r * .1);
        p.lineTo(x, y - r * 1.2);
        p.lineTo(x + r, y - r * .1);
        p.close(); p.fill();
    }
    // 静态氛围层：只在视口变化时重画一次，不产生每帧开销。
    private drawBackdrop() {
        const p = this.bgPen, w = this.w, h = this.h, s = this.s;
        p.clear();
        const bands = 30;
        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const hex = t < .5 ? mixHex(PAL.nightTop, PAL.nightMid, t * 2) : mixHex(PAL.nightMid, PAL.nightBottom, (t - .5) * 2);
            p.fillColor = this.c(hex);
            p.rect(-w / 2, h / 2 - (i + 1) * (h / bands), w, h / bands + 1);
            p.fill();
        }
        this.glow(p, -w * .3, h * .3, w * 1.05, PAL.glowWarm, 30, 7);
        this.glow(p, w * .34, -h * .34, w * .9, PAL.glowCool, 22, 6);
        // 远景剪影：管道与货架，只提供纵深，不抢主体。
        p.fillColor = this.c('#0E1728', 105);
        p.roundRect(-w / 2 - 20, h / 2 - 150 * s, 230 * s, 26 * s, 13 * s); p.fill();
        p.roundRect(-w / 2 + 178 * s, h / 2 - 220 * s, 26 * s, 96 * s, 13 * s); p.fill();
        p.roundRect(w / 2 - 160 * s, -h / 2 + 210 * s, 180 * s, 18 * s, 9 * s); p.fill();
        p.roundRect(w / 2 - 160 * s, -h / 2 + 320 * s, 180 * s, 18 * s, 9 * s); p.fill();
        p.roundRect(w / 2 - 172 * s, -h / 2 + 200 * s, 16 * s, 140 * s, 8 * s); p.fill();
        p.roundRect(w / 2 - 24 * s, -h / 2 + 200 * s, 16 * s, 140 * s, 8 * s); p.fill();
        for (let i = 0; i < 8; i++) {
            const a = Math.round(48 * (1 - i / 8));
            p.fillColor = this.c(PAL.ink, a);
            p.rect(-w / 2, -h / 2 + i * h / 16, w, h / 16 + 1); p.fill();
            p.rect(-w / 2, h / 2 - (i + 1) * h / 16, w, h / 16 + 1); p.fill();
        }
    }
    // 世界地面层：随相机滚动的加工厂地砖、警戒带与出口门。
    private drawGround() {
        const p = this.groundPen, g = this.game;
        p.clear();
        if (g.phase !== 'playing' && g.phase !== 'paused') return;
        const sx = (x: number) => x - g.x, sy = (y: number) => y - g.y, step = 200;
        const x0 = Math.floor((g.x - this.w / 2 - step) / step) * step, x1 = g.x + this.w / 2 + step;
        const y0 = Math.floor((g.y - this.h / 2 - step) / step) * step, y1 = g.y + this.h / 2 + step;
        for (let x = x0; x <= x1; x += step) {
            for (let y = y0; y <= y1; y += step) {
                const gx = Math.floor(x / step), gy = Math.floor(y / step), r = noise(gx, gy);
                const px = sx(x), py = sy(y);
                if ((gx + gy) % 2 === 0) {
                    p.fillColor = this.c('#FFFFFF', 7);
                    p.rect(px, py, step, step); p.fill();
                }
                p.strokeColor = this.c(PAL.floorLine, 32);
                p.lineWidth = 1.5;
                p.moveTo(px, py); p.lineTo(px + step, py);
                p.moveTo(px, py); p.lineTo(px, py + step);
                p.stroke();
                if (r > .74) {
                    p.strokeColor = this.c('#0A1220', 58); p.lineWidth = 3;
                    for (let k = 0; k < 4; k++) { p.moveTo(px + 52, py + 84 + k * 12); p.lineTo(px + 148, py + 84 + k * 12); }
                    p.stroke();
                }
                else if (r > .5) {
                    p.fillColor = this.c(PAL.gold, 20);
                    p.circle(px + step / 2, py + step / 2, 6); p.fill();
                }
                else if (r > .34) {
                    p.fillColor = this.c(PAL.glowCool, 12);
                    p.circle(px + 54 + r * 80, py + 130 * r, 28); p.fill();
                }
            }
        }
        // 出生点传送阵：鸭子从这里入场，待救小鸭也从这里撤离。
        const px = sx(0), py = sy(0), R = 62;
        if (Math.abs(px) < this.w / 2 + R && Math.abs(py) < this.h / 2 + R) {
            const spin = this.clock * 1.1, pulse = .55 + .45 * Math.sin(this.clock * 3);
            this.glow(p, px, py, R * 2.2, PAL.glowCool, Math.round(30 * pulse), 5);
            p.fillColor = this.c(PAL.ink, 170);
            p.circle(px, py, R); p.fill();
            p.strokeColor = this.c(PAL.mint, 175); p.lineWidth = 4;
            p.circle(px, py, R); p.stroke();
            p.strokeColor = this.c(PAL.gold, 120); p.lineWidth = 2.5;
            p.circle(px, py, R * .72); p.stroke();
            p.strokeColor = this.c(PAL.lilac, 140); p.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                const a = spin + i * Math.PI / 6, r0 = i % 3 === 0 ? R * .56 : R * .8;
                p.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
                p.lineTo(px + Math.cos(a) * R * .95, py + Math.sin(a) * R * .95);
            }
            p.stroke();
            p.fillColor = this.c(PAL.mint, Math.round(45 + 35 * pulse));
            p.circle(px, py, R * .32); p.fill();
        }
        const limit = 850, pad = 26;
        p.strokeColor = this.c(PAL.goldDeep, 125); p.lineWidth = 4;
        for (const e of [[-limit, -limit, limit, -limit], [-limit, limit, limit, limit], [-limit, -limit, -limit, limit], [limit, -limit, limit, limit]]) {
            p.moveTo(sx(e[0]), sy(e[1])); p.lineTo(sx(e[2]), sy(e[3]));
        }
        p.stroke();
        p.strokeColor = this.c(PAL.goldDeep, 80); p.lineWidth = 8;
        for (let x = -limit; x <= limit; x += 64) {
            const vx = sx(x);
            if (vx < -this.w / 2 - 32 || vx > this.w / 2 + 32) continue;
            for (const y of [-limit, limit]) {
                const vy = sy(y);
                if (vy < -this.h / 2 - 40 || vy > this.h / 2 + 40) continue;
                p.moveTo(vx, vy + (y > 0 ? -pad : pad));
                p.lineTo(vx + 18, vy + (y > 0 ? -pad - 16 : pad + 16));
            }
        }
        p.stroke();
        const gateX = sx(0), gateY = sy(limit);
        if (Math.abs(gateX) < this.w / 2 + 160 && Math.abs(gateY) < this.h / 2 + 200) {
            const pulse = .55 + .45 * Math.sin(this.clock * 3);
            this.glow(p, gateX, gateY - 30, 130, PAL.gold, Math.round(34 * pulse), 5);
            this.card(p, gateX - 66, gateY - 96, 132, 128, 20, '#3A3350', 220, PAL.gold, 150, 3);
            p.fillColor = this.c('#0C1424', 210);
            p.roundRect(gateX - 48, gateY - 80, 96, 100, 14); p.fill();
            p.fillColor = this.c(PAL.gold, 85);
            p.roundRect(gateX - 8, gateY - 72, 16, 84, 8); p.fill();
        }
    }
    // HUD / 菜单 / 结算层：盖在精灵之上、文字之下。
    private drawFrame() {
        const p = this.framePen, g = this.game, w = this.w, h = this.h, s = this.s;
        p.clear();
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        if (g.phase === 'playing') {
            this.card(p, -w / 2 + 16 * s, h / 2 - 132 * s, w - 32 * s, 120 * s, 26 * s, PAL.card, 214, PAL.cardEdge, 100, 1.5);
            p.fillColor = this.c('#FFFFFF', 13);
            p.roundRect(-w / 2 + 30 * s, h / 2 - 26 * s, w - 60 * s, 5 * s, 3 * s); p.fill();
            p.strokeColor = this.c(PAL.cardEdge, 50); p.lineWidth = 1.5;
            p.moveTo(-w / 2 + 40 * s, h / 2 - 94 * s); p.lineTo(w / 2 - 40 * s, h / 2 - 94 * s); p.stroke();
            for (let i = 0; i < 5; i++)
                this.heart(p, -w / 2 + 40 * s + i * 23 * s, h / 2 - 38 * s, 8 * s, i < g.hp, PAL.coral);
            const bw = w - 64 * s, by = h / 2 - 128 * s;
            this.card(p, -bw / 2, by, bw, 9 * s, 5 * s, '#0C1424', 230);
            const ratio = g.level === 12 ? 1 : Math.min(1, g.xp / Math.max(1, g.nextXp));
            this.card(p, -bw / 2, by, Math.max(9 * s, bw * ratio), 9 * s, 5 * s, PAL.gold);
            this.card(p, -w / 2 + 16 * s, -h / 2 + 22 * s, w - 32 * s, 88 * s, 26 * s, PAL.card, 205, PAL.cardEdge, 80, 1.5);
            if (this.banner.string) {
                const bw2 = Math.min(w - 56 * s, Math.max(250 * s, this.banner.string.length * 27 * s));
                this.card(p, -bw2 / 2, h / 2 - 330 * s, bw2, 60 * s, 30 * s, PAL.card, 225, PAL.gold, 120, 1.5);
            }
            if (this.rescueToast > 0)
                this.card(p, -150 * s, this.toastY - 23 * s, 300 * s, 46 * s, 23 * s, PAL.card, 230, PAL.mint, 165, 1.5);
            if (this.finger !== -1) {
                const ox = this.origin.x, oy = this.origin.y;
                p.fillColor = this.c(PAL.card, 70);
                p.circle(ox, oy, 68 * s); p.fill();
                p.strokeColor = this.c(PAL.text, 55); p.lineWidth = 3 * s;
                p.circle(ox, oy, 68 * s); p.stroke();
                const kx = ox + this.stick.x * 50 * s, ky = oy + this.stick.y * 50 * s;
                p.fillColor = this.c(PAL.mint, 190);
                p.circle(kx, ky, 21 * s); p.fill();
                p.strokeColor = this.c('#FFFFFF', 85); p.lineWidth = 2 * s;
                p.circle(kx, ky, 21 * s); p.stroke();
            }
            if (this.portalIntro > 0)
                this.drawPortalIntro();
        }
        else if (settling) {
            p.fillColor = this.c(PAL.ink, 195);
            p.rect(-w / 2, -h / 2, w, h); p.fill();
            this.glow(p, 0, 0, w * .95, g.phase === 'won' ? PAL.gold : PAL.coral, 42, 7);
            this.drawSettlement();
        }
        else {
            p.fillColor = this.c(PAL.ink, 165);
            p.rect(-w / 2, -h / 2, w, h); p.fill();
            this.glow(p, 0, 150 * s, 360 * s, PAL.glowWarm, 46, 8);
            this.glow(p, 0, -220 * s, 260 * s, PAL.glowCool, 22, 6);
            for (let i = 0; i < 16; i++) {
                const seed = noise(i, 7), x = (seed - .5) * (w - 80 * s);
                const y = -h / 2 + ((this.clock * (16 + seed * 26) + seed * h) % h);
                p.fillColor = this.c(i % 3 === 0 ? PAL.mint : PAL.gold, 45 + Math.round(seed * 65));
                p.circle(x, y, 2 + seed * 4); p.fill();
            }
            const cy = 430 * s;
            p.strokeColor = this.c(PAL.gold, 120); p.lineWidth = 3 * s;
            p.circle(0, cy, 76 * s); p.stroke();
            p.strokeColor = this.c(PAL.gold, 45); p.lineWidth = 1.5 * s;
            p.circle(0, cy, 92 * s); p.stroke();
            if (!this.menuDuck.node.active) {
                p.fillColor = this.c(PAL.gold); p.circle(0, cy - 12 * s, 26 * s); p.fill();
                p.fillColor = this.c(PAL.mint); p.circle(0, cy + 20 * s, 20 * s); p.fill();
                p.fillColor = this.c(PAL.goldDeep);
                p.moveTo(16 * s, cy + 12 * s); p.lineTo(38 * s, cy + 4 * s); p.lineTo(16 * s, cy - 2 * s); p.close(); p.fill();
                p.fillColor = this.c(PAL.ink); p.circle(7 * s, cy + 22 * s, 4 * s); p.fill();
            }
            this.card(p, -w / 2 + 20 * s, -280 * s, w - 40 * s, 480 * s, 32 * s, PAL.card, 226, PAL.cardEdge, 135, 2);
            p.fillColor = this.c('#FFFFFF', 13);
            p.roundRect(-w / 2 + 36 * s, 186 * s, w - 72 * s, 6 * s, 3 * s); p.fill();
            p.strokeColor = this.c(PAL.cardEdge, 50); p.lineWidth = 1.5;
            p.moveTo(-w / 2 + 48 * s, -45 * s); p.lineTo(w / 2 - 48 * s, -45 * s); p.stroke();
            p.fillColor = this.c(PAL.gold, 140);
            p.circle(-14 * s, 340 * s, 3 * s); p.fill();
            p.circle(14 * s, 340 * s, 3 * s); p.fill();
        }
    }
    // 开局传送阵演出：旋转符环、中心亮盘、鸭子由光中放大现身，两端柔和淡入淡出。
    private drawPortalIntro() {
        const p = this.framePen, s = this.s, w = this.w, h = this.h;
        const t = 1 - this.portalIntro / PORTAL_INTRO;
        const fade = Math.min(1, t * 5) * Math.min(1, (1 - t) * 5);
        const R = (90 + 150 * Math.min(1, t * 1.6)) * s, spin = this.clock * 3.4;
        p.fillColor = this.c(PAL.ink, Math.round(215 * fade));
        p.rect(-w / 2, -h / 2, w, h); p.fill();
        this.glow(p, 0, 0, R * 2.4, PAL.glowCool, Math.round(52 * fade), 7);
        this.glow(p, 0, 0, R * 1.3, PAL.glowWarm, Math.round(40 * fade), 5);
        for (let ring = 0; ring < 3; ring++) {
            p.strokeColor = this.c([PAL.gold, PAL.mint, PAL.lilac][ring], Math.round((215 - ring * 48) * fade));
            p.lineWidth = (5 - ring) * s;
            p.circle(0, 0, R * (1 - ring * .24)); p.stroke();
        }
        p.strokeColor = this.c(PAL.text, Math.round(145 * fade)); p.lineWidth = 3 * s;
        for (let i = 0; i < 16; i++) {
            const a = spin + i * Math.PI / 8;
            p.moveTo(Math.cos(a) * R * .82, Math.sin(a) * R * .82);
            p.lineTo(Math.cos(a) * R * .97, Math.sin(a) * R * .97);
        }
        p.stroke();
        p.fillColor = this.c(PAL.ink, Math.round(232 * fade));
        p.circle(0, 0, R * .7); p.fill();
        p.fillColor = this.c(PAL.text, Math.round(28 * fade));
        p.circle(0, 0, R * .66); p.fill();
        this.drawSettleDuck(0, 8 * s, Math.max(.05, Math.min(1, t * 2.2) * 1.5));
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6 + spin * .6, r = R * (1.06 + .16 * Math.sin(this.clock * 4 + i));
            p.fillColor = this.c(i % 2 ? PAL.gold : PAL.mint, Math.round(190 * fade));
            p.circle(Math.cos(a) * r, Math.sin(a) * r, (3 + i % 3) * s); p.fill();
        }
    }
    private draw() {
        const g = this.game, p = this.pen, sx = (x: number) => x - g.x, sy = (y: number) => y - g.y;
        p.clear();
        for (const d of g.drops)
            this.circle(sx(d.x), sy(d.y), 5, '#e4c76d');
        for (const f of g.foods) {
            const x = sx(f.x), y = sy(f.y);
            this.circle(x, y, 13, '#cf665f');
            p.fillColor = new Color('#fff0c4');
            p.rect(x - 3, y - 8, 6, 16);
            p.rect(x - 8, y - 3, 16, 6);
            p.fill();
        }
        for (const d of g.strays) {
            const x = sx(d.x), y = sy(d.y);
            if (Math.abs(x) > this.w / 2 + 48 || Math.abs(y) > this.h / 2 + 48) continue;
            const bob = Math.sin(this.clock * 3 + d.bob) * 4, cy = y + bob;
            this.glow(p, x, cy, 40, PAL.mint, 20, 3);
            p.strokeColor = this.c(PAL.mint, 150); p.lineWidth = 2.5;
            p.circle(x, cy - 8, 21); p.stroke();
            this.circle(x, cy - 2, 11, '#F3D58C');
            this.circle(x + 4, cy + 3, 8, PAL.mint);
            p.fillColor = this.c(PAL.goldDeep);
            p.moveTo(x + 10, cy); p.lineTo(x + 21, cy - 3); p.lineTo(x + 10, cy - 6); p.close(); p.fill();
            p.fillColor = this.c(PAL.ink);
            p.circle(x + 5, cy + 1, 2); p.fill();
            p.fillColor = this.c(PAL.mint, 190);
            p.circle(x, cy + 13, 3); p.fill();
        }
        for (const o of g.choice?.options || []) {
            const x = sx(o.x), y = sy(o.y), ready = g.time - g.choice!.spawnedAt >= .8;
            if (ready) this.glow(p, x, y, 72, PAL.gold, 24, 4);
            this.card(p, x - 34, y - 34, 68, 68, 18, ready ? '#33456A' : PAL.card, 242, ready ? PAL.gold : PAL.cardEdge, ready ? 230 : 110, ready ? 3 : 1.5);
            p.strokeColor = new Color(o.key === 'bubble' ? '#89e7e8' : '#ffe09a');
            p.lineWidth = 4;
            if (o.key === 'bubble') {
                p.circle(x, y, 18);
                p.stroke();
            }
            else if (o.key === 'line') {
                p.moveTo(x - 20, y);
                p.lineTo(x + 20, y);
                p.stroke();
                for (let j = 0; j < 5; j++)
                    this.circle(x - 20 + j * 10, y, 3, '#ffe09a');
            }
            else if (o.key === 'spread') {
                for (const a of [-.55, 0, .55]) {
                    p.moveTo(x - 15, y);
                    p.lineTo(x + 19, y + Math.sin(a) * 28);
                }
                p.stroke();
            }
            else {
                p.moveTo(x - 17, y - 14);
                p.lineTo(x + 17, y + 14);
                p.stroke();
            }
        }
        for (const e of g.enemies) {
            const x = sx(e.x), y = sy(e.y);
            if (e.state === 'windup' && e.kind === 'lid') {
                this.circle(sx(e.aimX), sy(e.aimY), 60, '#693e49');
                p.strokeColor = new Color('#ff8191');
                p.lineWidth = 4;
                p.circle(sx(e.aimX), sy(e.aimY), 60);
                p.stroke();
                p.circle(sx(e.aimX), sy(e.aimY), 60 * (1 - Math.max(0, e.timer) / .9));
                p.stroke();
            }
            if (e.state === 'windup' && e.kind === 'clip') {
                p.strokeColor = new Color('#ff6d79');
                p.lineWidth = 18;
                p.moveTo(x, y);
                p.lineTo(x + e.dx * 160, y + e.dy * 160);
                p.stroke();
            }
            if (!this.enemyFrames.has(e.kind)) {
            p.fillColor = new Color(e.kind === 'clip' ? '#dd8596' : '#b6c5c3');
            if (e.kind === 'lid') {
                this.circle(x, y, 18, '#8096ad');
                p.strokeColor = new Color('#d6e7eb');
                p.lineWidth = 2;
                p.circle(x, y, 14);
                p.stroke();
                p.fillColor = new Color('#e0b85c');
                p.roundRect(x - 7, y - 3, 14, 6, 3);
                p.fill();
            }
            else if (e.kind === 'clip') {
                p.moveTo(x - 15, y + 13);
                p.lineTo(x, y - 14);
                p.lineTo(x + 15, y + 13);
                p.lineTo(x + 7, y + 17);
                p.lineTo(x, y);
                p.lineTo(x - 7, y + 17);
                p.close();
                p.fill();
            }
            else {
                p.roundRect(x - 12, y - 13, 24, 26, 5);
                p.fill();
                for (let i = 0; i < 3; i++) {
                    p.roundRect(x - 11 + i * 8, y + 5, 6, 17, 3);
                    p.fill();
                }
            }
            }
            if (e.visibleFor < .7) {
                p.strokeColor = new Color('#ffd578');
                p.lineWidth = 2;
                p.circle(x, y, 22);
                p.stroke();
            }
        }
        const b = g.boss;
        if (b) {
            const x = sx(b.x), y = sy(b.y);
            if (b.state === 'arrive') {
                p.strokeColor = new Color('#ff6d79');
                p.lineWidth = 3;
                p.circle(x, y, 36 + Math.sin(g.time * 9) * 4);
                p.stroke();
            }
            if (b.state === 'windup') {
                p.strokeColor = new Color('#ff6d79');
                p.lineWidth = 26;
                p.moveTo(x, y);
                p.lineTo(x + b.dx * 200, y + b.dy * 200);
                p.stroke();
            }
            if (b.state === 'fanwind') {
                const base = Math.atan2(b.dy, b.dx);
                p.strokeColor = new Color('#ff8191');
                p.lineWidth = 9;
                for (const off of [-25, 0, 25]) {
                    const a = base + off * Math.PI / 180;
                    p.moveTo(x, y);
                    p.lineTo(x + Math.cos(a) * 450, y + Math.sin(a) * 450);
                }
                p.stroke();
            }
            p.fillColor = new Color('#c25b68');
            p.moveTo(x - 30, y + 26);
            p.lineTo(x, y - 28);
            p.lineTo(x + 30, y + 26);
            p.lineTo(x + 14, y + 34);
            p.lineTo(x, y);
            p.lineTo(x - 14, y + 34);
            p.close();
            p.fill();
            p.strokeColor = new Color('#ffd578');
            p.lineWidth = 3;
            p.circle(x, y, 34);
            p.stroke();
            p.fillColor = new Color('#203c46');
            p.roundRect(x - 45, y + 46, 90, 8, 4);
            p.fill();
            p.fillColor = new Color('#ff6d79');
            p.roundRect(x - 45, y + 46, Math.max(1, 90 * Math.max(0, b.hp) / 900), 8, 4);
            p.fill();
            for (const s of b.shots || [])
                this.circle(sx(s.x), sy(s.y), 8, '#ff8191');
        }
        for (const s of g.shots) {
            if (s.delay > 0)
                continue;
            const color = s.kind === 'feather' ? '#c9bcff' : s.evolved ? '#9bf7ff' : '#fff3a7';
            p.strokeColor = new Color(color);
            p.lineWidth = s.evolved ? 7 : 4;
            p.moveTo(sx(s.x) - s.dx * 15, sy(s.y) - s.dy * 15);
            p.lineTo(sx(s.x), sy(s.y));
            p.stroke();
            this.circle(sx(s.x), sy(s.y), s.kind === 'feather' ? 6 : 4, color);
            if (s.evolved) {
                p.lineWidth = 2;
                p.moveTo(sx(s.x) - s.dy * 7, sy(s.y) + s.dx * 7);
                p.lineTo(sx(s.x) - s.dx * 24 - s.dy * 7, sy(s.y) - s.dy * 24 + s.dx * 7);
                p.stroke();
            }
        }
        for (const f of g.effects) {
            if (f.kind === 'slash') {
                const cx = sx(f.x), cy = sy(f.y), a = Math.atan2(g.facing.y, g.facing.x);
                p.strokeColor = new Color('#ffe4a5');
                p.lineWidth = 6;
                if ((f.angle ?? 0) >= Math.PI) {
                    // Evolved wide: two-layer full-circle arc.
                    p.circle(cx, cy, f.radius);
                    p.stroke();
                    p.lineWidth = 3;
                    p.circle(cx, cy, f.radius * .8);
                    p.stroke();
                }
                else {
                    const half = f.angle ?? Math.PI / 3;
                    p.arc(cx, cy, f.radius, a - half, a + half, false);
                    p.stroke();
                }
                continue;
            }
            if (f.kind === 'burst') {
                p.strokeColor = new Color('#82dee9');
                p.lineWidth = 6;
                p.circle(sx(f.x), sy(f.y), f.radius * (.4 + .6 * (1 - f.life / f.duration)));
                p.stroke();
                continue;
            }
            const color = f.kind === 'bubble' ? '#82dee9' : f.kind === 'evolve' ? '#93efff' : f.kind === 'slam' ? '#ff8191' : f.kind === 'rescue' ? '#8FE3D0' : '#ffe4a5';
            p.strokeColor = new Color(color);
            p.lineWidth = f.kind === 'bubble' ? 6 : 3;
            p.circle(sx(f.x), sy(f.y), f.radius * (.4 + .6 * (1 - f.life / f.duration)));
            p.stroke();
        }
        if (g.evolved) {
            p.strokeColor = new Color('#8fe4e9');
            p.lineWidth = 2;
            p.circle(0, 0, 26 + Math.sin(g.time * 5) * 3);
            p.stroke();
        }
        if (!this.duckSprite.spriteFrame) {
        this.circle(0, -8, 15, '#0b2027');
        this.circle(0, 0, 13, '#e6bc66');
        this.circle(5, 11, 10, '#74bcb0');
        this.circle(8, 13, 2, '#112d35');
        p.fillColor = new Color('#ed9957');
        p.moveTo(12, 9);
        p.lineTo(23, 5);
        p.lineTo(12, 2);
        p.close();
        p.fill();
        p.strokeColor = new Color('#fff1bf');
        p.lineWidth = 5;
        p.moveTo(0, 0);
        p.lineTo(g.facing.x * 24, g.facing.y * 24);
        p.stroke();
        }
    }
    private dishName(cause: string) {
        return ({ '手套怪接触': '手撕鸭', '夹子怪冲撞 / 接触': '脆皮鸭卷', '锅盖怪压盖': '铁板鸭', '锅盖怪接触': '铁板鸭', 'Boss冲撞': '包装鸭脖', 'Boss弹丸': '爆浆鸭丸', '出口被封锁': '封坛老鸭' } as Record<string, string>)[cause] || '卤鸭拼盘';
    }
    private rescueText() {
        const target = nextUnlockTarget(this.save), n = this.game.totalRescued;
        return target ? `解救了${CHARACTER_NAMES[target]}！· ${n} 只鸭免于上餐桌` : `三只职业鸭都自由了！· ${n} 只鸭撤离`;
    }
    private drawSettleDuck(x: number, y: number, scale: number) {
        const p = this.framePen;
        p.fillColor = new Color('#e6bc66');
        p.circle(x, y - 10 * scale, 13 * scale);
        p.fill();
        p.circle(x, y - 24 * scale, 10 * scale);
        p.fill();
        p.fillColor = new Color('#ed9957');
        p.moveTo(x + 8 * scale, y - 22 * scale);
        p.lineTo(x + 20 * scale, y - 26 * scale);
        p.lineTo(x + 8 * scale, y - 29 * scale);
        p.close();
        p.fill();
        p.fillColor = new Color('#0b2027');
        p.circle(x + 3 * scale, y - 26 * scale, 2.2 * scale);
        p.fill();
        p.fillColor = new Color('#74bcb0');
        p.roundRect(x - 6 * scale, y - 4 * scale, 12 * scale, 9 * scale, 4 * scale);
        p.fill();
    }
    private drawSettlement() {
        const g = this.game, p = this.framePen, t = Math.max(0, Math.min(1, this.settleFor / 2));
        const ease = (x: number) => x * x * (3 - 2 * x);
        if (g.phase === 'lost') {
            // The duck slides into the gift box, the lid shuts and the dish label pops on.
            const sink = ease(Math.min(1, t * 1.6));
            const duckY = 120 - sink * 140, duckScale = 1 - .7 * sink;
            this.drawSettleDuck(0, duckY, duckScale);
            p.fillColor = new Color('#5a3d4a');
            p.roundRect(-75, -85, 150, 110, 10);
            p.fill();
            p.strokeColor = new Color('#e4c76d');
            p.lineWidth = 3;
            p.roundRect(-75, -85, 150, 110, 10);
            p.stroke();
            const lid = ease(Math.max(0, Math.min(1, (t - .35) / .35)));
            const lidY = 130 - lid * 105;
            p.fillColor = new Color('#6d4a58');
            p.roundRect(-80, lidY - 12, 160, 24, 8);
            p.fill();
            p.strokeColor = new Color('#e4c76d');
            p.roundRect(-80, lidY - 12, 160, 24, 8);
            p.stroke();
            if (t > .75) {
                const pop = ease((t - .75) / .25);
                p.fillColor = new Color('#fff0c4');
                p.roundRect(-55 * pop, -50 * pop, 110 * pop, 40 * pop, 6);
                p.fill();
                p.strokeColor = new Color('#cf665f');
                p.lineWidth = 4;
                p.moveTo(-55 * pop, -30 * pop);
                p.lineTo(55 * pop, -30 * pop);
                p.stroke();
            }
        }
        else {
            // The exit gate glows open, the duck runs out and the next character pops in beside it.
            const run = ease(Math.min(1, t / .55));
            const gateW = 60 + run * 90;
            p.fillColor = new Color('#ffe9a8');
            p.roundRect(-gateW / 2, this.h / 2 - 150, gateW, 130, 12);
            p.fill();
            p.strokeColor = new Color('#f5cf7d');
            p.lineWidth = 3;
            p.roundRect(-gateW / 2, this.h / 2 - 150, gateW, 130, 12);
            p.stroke();
            const bob = Math.sin(this.settleFor * 18) * 4 * (1 - run);
            this.drawSettleDuck(0, 40 - run * (this.h / 2 - 190) + bob, 1 + run * .2);
            if (t > .5) {
                const pop = ease(Math.min(1, (t - .5) / .3));
                const bounce = Math.abs(Math.sin((t - .5) * 14)) * (1 - pop) * 26;
                this.drawSettleDuck(130, -this.h / 2 + 240 + bounce, .9);
                for (let i = 0; i < 10; i++) {
                    const a = i * Math.PI / 5 + this.settleFor * 3;
                    const r = 60 + (i * 37) % 90;
                    p.fillColor = this.c(['#ffe09a', '#9bf7ff', '#ff9bb0'][i % 3]);
                    p.circle(Math.cos(a) * r * 1.4, Math.sin(a) * r, 4 + i % 3);
                    p.fill();
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 割草模式「万剑救鸭」：亮色 Q 版像素风表现层
    // 分层：Backdrop（静态晴空）→ Ground（滚动草地＋传送阵）→ World（魂珠/小鸭/影子）
    //      → 像素精灵 → HudFrame（剑气/粒子/血条/HUD/升级飘条/结算）
    // ══════════════════════════════════════════════════════════════
    private switchMode(mode: 'mow' | 'classic') {
        if (this.mode === mode)
            return;
        this.mode = mode;
        this.classic.phase = 'menu';
        this.mow.phase = 'menu';
        this.mow.upgradeToasts = [];
        this.settleFor = -1;
        this.portalIntro = 0;
        this.mowIntro = 0;
        this.mowToast = 0;
        this.newUnlocks = [];
        this.clearInput();
        this.state = '';
        this.menuSig = undefined;
        this.enemyRoot.active = false;
        for (const s of this.enemySprites)
            s.node.active = false;
        this.duckSprite.node.active = false;
        this.menuDuck.node.active = false;
        this.toastLabel.node.active = false;
        for (const l of [...this.floatLabels, ...this.upgradeLabels, ...this.skillLabels])
            l.node.active = false;
        for (const pen of [this.bgPen, this.groundPen, this.pen, this.framePen])
            pen.clear();
        for (const n of [this.pen.node, this.groundPen.node, this.enemyRoot])
            n.setPosition(0, 0, 0);
        if (mode === 'mow') {
            this.toastLabel.color = this.c(Q.mint);
        }
        else {
            this.toastLabel.color = this.c(PAL.mint);
            this.hud.color = this.c(PAL.text);
            this.note.color = this.c(PAL.textDim);
            this.banner.color = this.c(PAL.gold);
            this.progress.color = this.c(PAL.text);
        }
        this.resize();
    }
    /** 自动升级飘条：右上角自上而下最多三条，不遮挡中央战斗与顶部 HUD。 */
    private mowUpgradeY(i: number) {
        return this.h / 2 - 218 * this.s - i * 54 * this.s;
    }
    private updateMowEnemies() {
        const g = this.mow;
        this.enemyRoot.active = g.phase === 'playing' || g.phase === 'paused';
        if (!this.enemyRoot.active) {
            for (const s of this.enemySprites) s.node.active = false;
            return;
        }
        let count = 0;
        for (const e of g.enemies) {
            if (e.dead) continue;
            const x = e.x - g.x, y = e.y - g.y;
            if (Math.abs(x) > this.w / 2 + 60 || Math.abs(y) > this.h / 2 + 60) continue;
            const key = e.kind === 'brute' ? 'lid' : e.kind === 'runner' ? 'clip' : 'glove';
            const frame = this.enemyFrames.get(key);
            if (!frame) continue;
            let sprite = this.enemySprites[count];
            if (!sprite) {
                if (count >= 190) break;
                const n = new Node('Enemy'); n.layer = this.node.layer; this.enemyRoot.addChild(n);
                sprite = n.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                this.enemySprites.push(sprite);
            }
            sprite.node.active = true;
            sprite.spriteFrame = frame;
            sprite.node.getComponent(UITransform).setContentSize(e.kind === 'brute' ? 54 : e.kind === 'runner' ? 32 : 36,
                e.kind === 'brute' ? 54 : e.kind === 'runner' ? 32 : 36);
            sprite.node.setPosition(x, y);
            sprite.node.angle = e.kind === 'runner' ? Math.atan2(g.y - e.y, g.x - e.x) * 180 / Math.PI + 135 : 0;
            sprite.color = e.flash > 0 ? this.c(Q.white) : e.kind === 'brute' ? this.c('#DED6FA') : this.c(Q.white);
            count++;
        }
        for (let i = count; i < this.enemySprites.length; i++)
            this.enemySprites[i].node.active = false;
    }
    private updateMow(dt: number) {
        this.clock += dt;
        const camera = this.node.parent.getComponent(Canvas)?.cameraComponent;
        if (camera) {
            const pos = camera.node.worldPosition;
            this.node.setWorldPosition(pos.x, pos.y, 0);
        }
        const g = this.mow, s = this.s;
        const mx = this.stick.x + Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT));
        const my = this.stick.y + Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN));
        if (g.phase === 'playing' && this.mowIntro > 0)
            this.mowIntro = Math.max(0, this.mowIntro - dt);
        else
            g.tick(dt, mx, my);
        // 屏震只作用于世界层，HUD 保持稳定。
        const sh = g.shake * 9 * s;
        const ox = Math.sin(this.clock * 61) * sh, oy = Math.cos(this.clock * 47) * sh;
        this.pen.node.setPosition(ox, oy, 0);
        this.groundPen.node.setPosition(ox, oy, 0);
        this.enemyRoot.setPosition(ox, oy, 0);
        this.updateDuck(dt);
        this.updateMowEnemies();
        this.sound(g.events);
        g.events = [];
        if (g.totalRescued !== this.lastMowRescued) {
            this.mowToastCount = g.totalRescued - this.lastMowRescued;
            this.lastMowRescued = g.totalRescued;
            this.mowToast = 1.1;
        }
        this.mowToast = Math.max(0, this.mowToast - dt);
        if (g.phase === 'won' || g.phase === 'lost') {
            if (this.settleFor < 0) this.settleFor = 0;
            else if (this.settleFor < 2) this.settleFor += dt;
        }
        else
            this.settleFor = -1;
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        if (g.phase !== 'playing' && g.phase !== 'paused') {
            const atk = regenAttempts(this.save, Date.now());
            const sig = atk.attempts >= MAX_ATTEMPTS ? 'full' : String(atk.attempts);
            if (this.menuSig !== undefined && this.menuSig !== sig) this.state = '';
            this.menuSig = sig;
        }
        this.menusMow();
        // 先算文案，HUD 胶囊宽度才能按当前帧的文字长度自适应。
        this.updateMowLabels(settling);
        this.drawGroundMow();
        this.drawWorldMow();
        this.drawFrameMow();
        const idlePath = this.duckManifest?.idle?.south;
        const idleFrame = idlePath ? this.duckFrames.get(idlePath) : undefined;
        if (idleFrame) this.menuDuck.spriteFrame = idleFrame;
        this.menuDuck.node.active = g.phase === 'menu' && !!this.menuDuck.spriteFrame;
    }
    private updateMowLabels(settling: boolean) {
        const g = this.mow, s = this.s, playing = g.phase === 'playing' || g.phase === 'paused';
        this.hud.color = this.c(Q.ink);
        this.note.color = this.c(Q.inkSoft);
        this.banner.color = this.c(Q.goldDeep);
        this.progress.color = this.c(Q.ink);
        this.toastLabel.color = this.c(Q.mint);
        this.hud.node.active = playing;
        this.note.node.active = playing;
        this.banner.node.active = playing || settling;
        this.progress.node.active = true;
        this.gearLabels.forEach(l => l.node.active = false);
        this.pauseButton.active = playing;
        this.audioButton.active = playing;
        const pl = this.pauseButton.getComponentInChildren(Label), al = this.audioButton.getComponentInChildren(Label);
        if (pl) pl.string = g.phase === 'paused' ? '继续' : '暂停';
        if (al) al.string = this.muted ? '静音' : '声音';
        const left = Math.max(0, Math.ceil((g.boss ? g.limit : g.duration) - g.time));
        const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
        this.hud.node.setPosition(0, this.h / 2 - 74 * s);
        this.note.node.setPosition(0, this.h / 2 - 126 * s);
        this.banner.node.setPosition(0, this.h / 2 - 292 * s);
        this.progress.node.setPosition(0, -this.h / 2 + 138 * s);
        this.hud.string = `${mm}:${ss}   第 ${g.wave} 波   Lv.${g.level}\n击退 ${g.kills}   救出 ${g.totalRescued} 只   连斩 ${g.combo}`;
        this.note.string = `万剑 ×${g.bladeCount} · 剑阵 ${g.orbitCount} · 雷劫 ${g.thunderCount} · 领域 ${Math.round(g.auraRadius)}${this.muted ? ' · 静音' : ''}`;
        this.banner.string = settling
            ? (g.phase === 'won' ? `${g.totalRescued} 只鸭免于上餐桌！` : `仍救出 ${g.totalRescued} 只鸭`)
            : this.mowIntro > 0 ? '传送阵启动 · 鸭子入场！'
                : g.phase === 'playing' && g.noticeFor > 0 ? g.notice : '';
        this.progress.string = settling ? '点按任意处跳过'
            : g.phase !== 'playing' ? this.attemptLine()
                : g.boss ? `击败巨型捕鸭夹！剩余 ${Math.max(0, Math.ceil(g.limit - g.time))} 秒`
                    : `捡绿色魂珠自动成长 · 每 ${g.killsPerDuck} 次击退多救 1 只鸭`;
        // 升级飘条只作展示，不需要玩家做任何选择或停顿。
        this.upgradeLabels.forEach((l, i) => {
            const t = g.upgradeToasts[i];
            l.node.active = !!t && g.phase === 'playing';
            if (!t || !l.node.active) return;
            l.string = `${t.icon} ${t.name} Lv.${t.level}`;
            l.node.setPosition(this.w / 2 - 166 * s, this.mowUpgradeY(i));
        });
        for (let i = 0; i < 6; i++) {
            const l = this.skillLabels[i];
            l.node.active = playing;
            if (l.node.active) {
                const sk = g.skillLevels[i];
                l.string = `${sk.icon} ${sk.level}`;
                l.color = this.c(sk.hot ? Q.goldDeep : Q.inkSoft);
                l.node.setPosition((i - 2.5) * ((this.w - 44 * s) / 6), -this.h / 2 + 62 * s);
            }
        }
        // 伤害数字：固定 14 个标签复用，取最近的一批。
        const floats = g.floats.slice(-this.floatLabels.length);
        this.floatLabels.forEach((l, i) => {
            const f = floats[i];
            l.node.active = !!f && playing && g.phase === 'playing';
            if (!f || !l.node.active) return;
            const hex = f.kind === 'crit' ? Q.crit : f.kind === 'rescue' ? '#1E9E72' : f.kind === 'heal' ? '#3CB37A' : Q.damage;
            const a = Math.round(255 * Math.min(1, f.life / .28));
            l.color = this.c(hex, a);
            l.string = f.text;
            l.node.setPosition(f.x - g.x, f.y - g.y + (1 - f.life / f.duration) * 42 * s);
            l.fontSize = Math.round((f.kind === 'crit' ? 26 : 20) * s);
        });
        this.toastLabel.node.active = this.mowToast > 0 && playing;
        if (this.toastLabel.node.active) {
            this.toastLabel.node.setPosition(0, (150 + (1 - this.mowToast) * 50) * s);
            this.toastLabel.string = `+${this.mowToastCount} 只鸭免于上餐桌`;
        }
    }
    // 静态晴空：只在视口变化时重画。方块云、阶梯远山、像素花瓣。
    private drawBackdropMow() {
        const p = this.bgPen, w = this.w, h = this.h, s = this.s;
        p.clear();
        if (this.bgFrames.has('sunken')) {
            // 沉没地牢贴图已生效：只在图上叠边缘暗角，保证浅色遗迹上的文字可读。
            this.vignette(p, w, h);
            return;
        }
        const bands = 24;
        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const hex = t < .5 ? mixHex(Q.skyTop, Q.skyMid, t * 2) : mixHex(Q.skyMid, Q.skyBottom, (t - .5) * 2);
            p.fillColor = this.c(hex);
            p.rect(-w / 2, h / 2 - (i + 1) * (h / bands), w, h / bands + 1);
            p.fill();
        }
        // 太阳与柔光
        this.glow(p, -w * .29, h * .31, w * .62, Q.sun, 40, 6);
        p.fillColor = this.c(Q.sun, 235);
        p.circle(-w * .29, h * .31, 58 * s); p.fill();
        p.fillColor = this.c(Q.white, 150);
        p.circle(-w * .29 - 14 * s, h * .31 + 16 * s, 40 * s); p.fill();
        // 方块云：硬边，像素感
        for (let i = 0; i < 7; i++) {
            const seed = noise(i, 3);
            const cx = (seed - .5) * (w + 200 * s), cy = h * (.36 - (i % 3) * .16) + (noise(i, 9) - .5) * 90 * s;
            const cw = (110 + noise(i, 11) * 90) * s, ch = 26 * s;
            p.fillColor = this.c(Q.cloud, 205);
            p.rect(cx - cw / 2, cy, cw, ch); p.fill();
            p.rect(cx - cw / 2 + 18 * s, cy + ch, cw * .62, ch * .8); p.fill();
            p.rect(cx - cw / 2 + 40 * s, cy - ch * .55, cw * .38, ch * .7); p.fill();
        }
        // 阶梯远山：两层，每层用等宽方块拼出轮廓
        for (let layer = 0; layer < 2; layer++) {
            const base = -h / 2 + (layer === 0 ? 250 : 170) * s;
            const step = 34 * s;
            p.fillColor = this.c(layer === 0 ? Q.hill : Q.hillShade, layer === 0 ? 180 : 205);
            for (let k = -Math.ceil(w / step / 2) - 1; k <= Math.ceil(w / step / 2) + 1; k++) {
                const x = k * step;
                const peak = (Math.sin(k * .55 + layer * 2) * .5 + .5) * (layer === 0 ? 90 : 62) * s;
                const hh = 90 * s + peak;
                p.rect(x, base - hh, step + 1, hh + h / 2); p.fill();
            }
        }
        // 边缘柔和暗角，保证浅色背景上的文字可读
        this.vignette(p, w, h);
    }

    private vignette(p: Graphics, w: number, h: number) {
        for (let i = 0; i < 7; i++) {
            p.fillColor = this.c(Q.ink, Math.round(16 * (1 - i / 7)));
            p.rect(-w / 2, -h / 2 + i * h / 14, w, h / 14 + 1); p.fill();
            p.rect(-w / 2, h / 2 - (i + 1) * h / 14, w, h / 14 + 1); p.fill();
        }
    }
    // 滚动地面：沉没地牢浅水石板棋盘格、水光斑与珊瑚，常驻传送阵与场地边界。
    private drawGroundMow() {
        const p = this.groundPen, g = this.mow, s = this.s;
        p.clear();
        if (g.phase !== 'playing' && g.phase !== 'paused') return;
        const sx = (x: number) => x - g.x, sy = (y: number) => y - g.y, step = 80;
        const x0 = Math.floor((g.x - this.w / 2 - step) / step) * step, x1 = g.x + this.w / 2 + step;
        const y0 = Math.floor((g.y - this.h / 2 - step) / step) * step, y1 = g.y + this.h / 2 + step;
        for (let x = x0; x <= x1; x += step) {
            for (let y = y0; y <= y1; y += step) {
                const gx = Math.floor(x / step), gy = Math.floor(y / step), r = noise(gx, gy);
                const px = sx(x), py = sy(y);
                p.fillColor = this.c((gx + gy) % 2 === 0 ? Q.floorA : Q.floorB, 225);
                p.rect(px, py, step, step); p.fill();
                p.strokeColor = this.c(Q.floorLine, 70);
                p.lineWidth = 2;
                p.moveTo(px, py); p.lineTo(px + step, py);
                p.moveTo(px, py); p.lineTo(px, py + step);
                p.stroke();
                if (r > .82) {
                    // 水光斑与珊瑚：青光四瓣＋黄花芯
                    const fx = px + 20 + r * 30, fy = py + 24 + noise(gy, gx) * 32;
                    p.fillColor = this.c(r > .92 ? Q.coral : Q.glowSpot, 220);
                    for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) {
                        p.rect(fx + dx * s - 4 * s, fy + dy * s - 4 * s, 8 * s, 8 * s); p.fill();
                    }
                    p.fillColor = this.c(Q.gold, 240);
                    p.rect(fx - 3 * s, fy - 3 * s, 6 * s, 6 * s); p.fill();
                }
                else if (r < .09) {
                    p.fillColor = this.c(Q.floorShade, 110);
                    p.rect(px + 30, py + 34, 20 * s, 8 * s); p.fill();
                }
            }
        }
        // 出生点传送阵：待救小鸭从这里撤离，也是每局的视觉锚点
        const px = sx(0), py = sy(0), R = 66 * s;
        if (Math.abs(px) < this.w / 2 + R * 2 && Math.abs(py) < this.h / 2 + R * 2) {
            const spin = this.clock * 1.2, pulse = .55 + .45 * Math.sin(this.clock * 3);
            this.glow(p, px, py, R * 2.4, Q.mint, Math.round(38 * pulse), 5);
            p.fillColor = this.c(Q.panel, 210);
            p.circle(px, py, R); p.fill();
            p.strokeColor = this.c(Q.mint, 235); p.lineWidth = 5 * s;
            p.circle(px, py, R); p.stroke();
            p.strokeColor = this.c(Q.gold, 190); p.lineWidth = 3 * s;
            p.circle(px, py, R * .74); p.stroke();
            p.strokeColor = this.c(Q.lilac, 200); p.lineWidth = 3 * s;
            for (let i = 0; i < 12; i++) {
                const a = spin + i * Math.PI / 6, r0 = i % 3 === 0 ? R * .5 : R * .78;
                p.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
                p.lineTo(px + Math.cos(a) * R * .95, py + Math.sin(a) * R * .95);
            }
            p.stroke();
            p.fillColor = this.c(Q.mintLight, Math.round(120 + 70 * pulse));
            p.circle(px, py, R * .3); p.fill();
        }
        // 场地边界：金色虚线警戒带
        const limit = 850;
        p.strokeColor = this.c(Q.goldDeep, 150); p.lineWidth = 5 * s;
        for (const e of [[-limit, -limit, limit, -limit], [-limit, limit, limit, limit], [-limit, -limit, -limit, limit], [limit, -limit, limit, limit]]) {
            p.moveTo(sx(e[0]), sy(e[1])); p.lineTo(sx(e[2]), sy(e[3]));
        }
        p.stroke();
        p.strokeColor = this.c(Q.white, 170); p.lineWidth = 6 * s;
        for (let x = -limit; x <= limit; x += 70) {
            const vx = sx(x);
            if (vx < -this.w / 2 - 30 || vx > this.w / 2 + 30) continue;
            for (const y of [-limit, limit]) {
                const vy = sy(y);
                if (vy < -this.h / 2 - 40 || vy > this.h / 2 + 40) continue;
                p.moveTo(vx, vy + (y > 0 ? -18 * s : 18 * s));
                p.lineTo(vx + 16 * s, vy + (y > 0 ? -18 * s - 14 * s : 18 * s + 14 * s));
            }
        }
        p.stroke();
    }
    // 精灵之下的世界层：魂珠、待救小鸭、影子、玩家脚下光环。
    private drawWorldMow() {
        const g = this.mow, p = this.pen, s = this.s;
        p.clear();
        if (g.phase !== 'playing' && g.phase !== 'paused') return;
        const sx = (x: number) => x - g.x, sy = (y: number) => y - g.y;
        // 玩家脚下金光领域
        this.glow(p, 0, 0, g.auraRadius * 1.7, Q.gold, 22, 5);
        p.strokeColor = this.c(Q.gold, 130); p.lineWidth = 3 * s;
        p.circle(0, 0, g.auraRadius); p.stroke();
        p.strokeColor = this.c(Q.white, 150); p.lineWidth = 2 * s;
        for (let i = 0; i < 12; i++) {
            const a = this.clock * .8 + i * Math.PI / 6;
            p.moveTo(Math.cos(a) * (g.auraRadius - 8 * s), Math.sin(a) * (g.auraRadius - 8 * s));
            p.lineTo(Math.cos(a) * g.auraRadius, Math.sin(a) * g.auraRadius);
        }
        p.stroke();
        // 敌人影子
        for (const e of g.enemies) {
            if (e.dead) continue;
            const x = sx(e.x), y = sy(e.y);
            if (Math.abs(x) > this.w / 2 + 50 || Math.abs(y) > this.h / 2 + 50) continue;
            p.fillColor = this.c(Q.ink, 32);
            p.circle(x, y - 12 * s, (e.kind === 'brute' ? 24 : 15) * s); p.fill();
        }
        // 绿色魂珠：菱形＋光晕＋跳动
        for (const d of g.gems) {
            const x = sx(d.x), y = sy(d.y);
            if (Math.abs(x) > this.w / 2 + 30 || Math.abs(y) > this.h / 2 + 30) continue;
            const bob = Math.sin(this.clock * 4 + d.bob) * 3 * s, r = (d.value > 2 ? 9 : 6) * s;
            this.glow(p, x, y + bob, r * 3.2, Q.gem, 34, 4);
            p.fillColor = this.c(Q.gemLight);
            p.moveTo(x, y + bob + r); p.lineTo(x + r, y + bob); p.lineTo(x, y + bob - r); p.lineTo(x - r, y + bob);
            p.close(); p.fill();
            p.fillColor = this.c(Q.white, 210);
            p.rect(x - r * .28, y + bob + r * .15, r * .5, r * .5); p.fill();
        }
        // 待救小鸭：亮黄 Q 版像素鸭＋薄荷撤离圈
        for (const d of g.ducks) {
            const x = sx(d.x), y = sy(d.y);
            if (Math.abs(x) > this.w / 2 + 50 || Math.abs(y) > this.h / 2 + 50) continue;
            const bob = Math.sin(this.clock * 3.4 + d.bob) * 5 * s;
            this.glow(p, x, y + bob, 46 * s, Q.mint, 40, 4);
            p.strokeColor = this.c(Q.mint, 210); p.lineWidth = 3 * s;
            p.circle(x, y + bob - 4 * s, 26 * s); p.stroke();
            this.pixelDuck(p, x, y + bob, 1.05 * s);
        }
    }
    // 统一的 Q 版像素鸭画法，供拾取物与结算演出复用。
    private pixelDuck(p: Graphics, x: number, y: number, k: number) {
        p.fillColor = this.c(Q.gold);
        p.circle(x, y - 4 * k, 13 * k); p.fill();
        p.fillColor = this.c('#FFE48A');
        p.circle(x - 2 * k, y - 20 * k, 10 * k); p.fill();
        p.fillColor = this.c(Q.goldDeep);
        p.moveTo(x + 7 * k, y - 20 * k); p.lineTo(x + 20 * k, y - 24 * k); p.lineTo(x + 7 * k, y - 27 * k);
        p.close(); p.fill();
        p.fillColor = this.c(Q.ink);
        p.circle(x + 3 * k, y - 23 * k, 2.2 * k); p.fill();
        p.fillColor = this.c(Q.mint);
        p.roundRect(x - 8 * k, y + 2 * k, 16 * k, 10 * k, 4 * k); p.fill();
        p.fillColor = this.c(Q.white, 190);
        p.circle(x - 6 * k, y - 8 * k, 3 * k); p.fill();
    }
    // 最高层：剑气 / 粒子 / 血条 / Boss / HUD / 升级卡 / 结算。
    private drawFrameMow() {
        const p = this.framePen, g = this.mow, w = this.w, h = this.h, s = this.s;
        p.clear();
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        const inGame = g.phase === 'playing' || g.phase === 'paused';
        if (inGame) {
            const sx = (x: number) => x - g.x, sy = (y: number) => y - g.y;
            const useSprites = this.enemyFrames.has('glove') && this.enemyFrames.has('clip') && this.enemyFrames.has('lid');
            // 素材尚未加载时用程序像素块顶上；加载完成后只画血条与命中闪。
            for (const e of g.enemies) {
                if (e.dead) continue;
                const x = sx(e.x), y = sy(e.y);
                if (Math.abs(x) > w / 2 + 60 || Math.abs(y) > h / 2 + 60) continue;
                if (!useSprites) {
                    const r = (e.kind === 'brute' ? 22 : 14) * s;
                    p.fillColor = this.c(e.kind === 'brute' ? '#7C63A8' : Q.enemyInk);
                    p.rect(x - r, y - r, r * 2, r * 2); p.fill();
                    p.fillColor = this.c(Q.danger);
                    p.rect(x - r * .55, y + r * .1, r * .35, r * .35); p.fill();
                    p.rect(x + r * .2, y + r * .1, r * .35, r * .35); p.fill();
                }
                if (e.flash > 0) {
                    p.strokeColor = this.c(Q.white, Math.round(220 * e.flash / .14)); p.lineWidth = 3 * s;
                    p.circle(x, y, (e.kind === 'brute' ? 28 : 19) * s); p.stroke();
                }
                if (e.kind === 'brute') {
                    this.card(p, x - 26 * s, y + 30 * s, 52 * s, 7 * s, 3 * s, Q.ink, 170);
                    this.card(p, x - 26 * s, y + 30 * s, 52 * s * Math.max(0, e.hp / e.maxHp), 7 * s, 3 * s, Q.coral);
                }
            }
            // Boss：巨型捕鸭夹，冲刺前有红色预警线
            const b = g.boss;
            if (b) {
                const x = sx(b.x), y = sy(b.y);
                if (b.state === 'windup') {
                    p.strokeColor = this.c(Q.danger, 150); p.lineWidth = 26 * s;
                    p.moveTo(x, y); p.lineTo(x + b.dx * 260 * s, y + b.dy * 260 * s);
                    p.stroke();
                }
                this.glow(p, x, y, 120 * s, Q.coral, 34, 5);
                p.fillColor = this.c('#E2636E');
                p.moveTo(x - 42 * s, y + 34 * s); p.lineTo(x, y - 40 * s); p.lineTo(x + 42 * s, y + 34 * s);
                p.lineTo(x + 20 * s, y + 46 * s); p.lineTo(x, y);
                p.lineTo(x - 20 * s, y + 46 * s); p.close(); p.fill();
                p.fillColor = this.c(Q.gold);
                p.circle(x, y, 20 * s); p.fill();
                p.fillColor = this.c(Q.ink);
                p.rect(x - 10 * s, y - 4 * s, 5 * s, 8 * s); p.fill();
                p.rect(x + 5 * s, y - 4 * s, 5 * s, 8 * s); p.fill();
                const bw = 150 * s;
                this.card(p, -bw / 2, h / 2 - 168 * s, bw, 12 * s, 6 * s, Q.ink, 170);
                this.card(p, -bw / 2, h / 2 - 168 * s, bw * Math.max(0, b.hp / b.maxHp), 12 * s, 6 * s, Q.coral);
                p.strokeColor = this.c(Q.panelEdge); p.lineWidth = 2 * s;
                p.roundRect(-bw / 2, h / 2 - 168 * s, bw, 12 * s, 6 * s); p.stroke();
            }
            // 万剑：外发光 → 金边 → 白芯 → 菱形剑尖，暴击改冷白紫。
            for (const sw of g.swords) {
                const x = sx(sw.x), y = sy(sw.y);
                if (Math.abs(x) > w / 2 + 60 || Math.abs(y) > h / 2 + 60) continue;
                const len = (sw.crit ? 46 : 36) * s;
                const tx = x - sw.dx * len, ty = y - sw.dy * len;
                const edge = sw.crit ? Q.lilac : Q.swordEdge;
                p.strokeColor = this.c(edge, 55); p.lineWidth = (sw.crit ? 14 : 10) * s;
                p.moveTo(tx, ty); p.lineTo(x, y); p.stroke();
                p.strokeColor = this.c(edge, 235); p.lineWidth = (sw.crit ? 7 : 5) * s;
                p.moveTo(tx, ty); p.lineTo(x, y); p.stroke();
                p.strokeColor = this.c(Q.white, 240); p.lineWidth = 2.2 * s;
                p.moveTo(tx + sw.dx * 5 * s, ty + sw.dy * 5 * s); p.lineTo(x, y); p.stroke();
                p.fillColor = this.c(sw.crit ? Q.white : Q.sword);
                const r = (sw.crit ? 6 : 4.5) * s;
                p.moveTo(x + sw.dx * r, y + sw.dy * r);
                p.lineTo(x - sw.dy * r * .6, y + sw.dx * r * .6);
                p.lineTo(x - sw.dx * r, y - sw.dy * r);
                p.lineTo(x + sw.dy * r * .6, y - sw.dx * r * .6);
                p.close(); p.fill();
            }
            // 护身剑阵
            const spin = g.time * 3.4;
            for (let i = 0; i < g.orbitCount; i++) {
                const a = spin + i * Math.PI * 2 / g.orbitCount;
                const x = Math.cos(a) * g.orbitRadius, y = Math.sin(a) * g.orbitRadius;
                this.glow(p, x, y, 18 * s, Q.gold, 30, 3);
                p.fillColor = this.c(Q.sword);
                p.moveTo(x, y + 9 * s); p.lineTo(x + 6 * s, y); p.lineTo(x, y - 9 * s); p.lineTo(x - 6 * s, y);
                p.close(); p.fill();
                p.strokeColor = this.c(Q.goldDeep, 200); p.lineWidth = 1.6 * s;
                p.moveTo(x, y + 9 * s); p.lineTo(x + 6 * s, y); p.lineTo(x, y - 9 * s); p.lineTo(x - 6 * s, y);
                p.close(); p.stroke();
            }
            // 主角鸭描边：像素精灵之上再压一圈高光，浅色背景里更醒目。
            this.glow(p, 0, 0, 44 * s, Q.gold, 26, 4);
            p.strokeColor = this.c(Q.white, 225); p.lineWidth = 3 * s;
            p.circle(0, 0, 27 * s); p.stroke();
            // 特效：雷劫、升级、救鸭、Boss 登场
            for (const f of g.effects) {
                const x = sx(f.x), y = sy(f.y), t = 1 - f.life / f.duration;
                const r = f.radius * (.35 + .65 * t);
                if (f.kind === 'thunder') {
                    p.strokeColor = this.c(Q.gold, Math.round(230 * (1 - t))); p.lineWidth = 5 * s;
                    p.circle(x, y, r); p.stroke();
                    p.strokeColor = this.c(Q.white, Math.round(235 * (1 - t))); p.lineWidth = 3 * s;
                    p.moveTo(x - 8 * s, y + 150 * s); p.lineTo(x + 6 * s, y + 40 * s);
                    p.lineTo(x - 5 * s, y + 12 * s); p.lineTo(x + 9 * s, y - 40 * s);
                    p.stroke();
                    continue;
                }
                const hex = f.kind === 'level' ? Q.mint : f.kind === 'upgrade' ? Q.gold
                    : f.kind === 'rescue' ? Q.mint : f.kind === 'boss' ? Q.danger : Q.lilac;
                p.strokeColor = this.c(hex, Math.round(220 * (1 - t))); p.lineWidth = (f.kind === 'level' ? 6 : 4) * s;
                p.circle(x, y, r); p.stroke();
            }
            // 像素碎片
            for (const q of g.particles) {
                const x = sx(q.x), y = sy(q.y);
                if (Math.abs(x) > w / 2 + 20 || Math.abs(y) > h / 2 + 20) continue;
                p.fillColor = this.c(q.color, Math.round(230 * Math.max(0, q.life / q.duration)));
                const sz = q.size * s;
                p.rect(x - sz / 2, y - sz / 2, sz, sz); p.fill();
            }
            // ── HUD：顶部玉牌 + 底部六格技能栏 ──────────────────
            this.card(p, -w / 2 + 14 * s, h / 2 - 148 * s, w - 28 * s, 132 * s, 24 * s, Q.panel, 238, Q.panelEdge, 235, 3 * s);
            p.fillColor = this.c(Q.gold, 200);
            p.roundRect(-w / 2 + 26 * s, h / 2 - 30 * s, w - 52 * s, 6 * s, 3 * s); p.fill();
            for (let i = 0; i < g.maxHp; i++)
                this.heart(p, -w / 2 + (36 + i * 26) * s, h / 2 - 52 * s, 9 * s, i < g.hp, Q.heart);
            const barW = w - 60 * s, barY = h / 2 - 142 * s;
            this.card(p, -barW / 2, barY, barW, 9 * s, 5 * s, Q.panelShade, 255);
            this.card(p, -barW / 2, barY, Math.max(9 * s, barW * g.progress), 9 * s, 5 * s, Q.mint);
            this.card(p, -w / 2 + 14 * s, -h / 2 + 16 * s, w - 28 * s, 96 * s, 24 * s, Q.panel, 238, Q.panelEdge, 235, 3 * s);
            const slotW = (w - 44 * s) / 6;
            const slotColors = [Q.gold, Q.mintLight, Q.lilac, Q.sun, Q.grassB, Q.coral];
            for (let i = 0; i < 6; i++) {
                const cx = (i - 2.5) * slotW;
                const sk = g.skillLevels[i];
                this.card(p, cx - slotW / 2 + 5 * s, -h / 2 + 26 * s, slotW - 10 * s, 76 * s, 14 * s,
                    sk.hot ? slotColors[i] : Q.panelShade, sk.hot ? 235 : 175,
                    sk.hot ? Q.goldDeep : Q.panelEdge, sk.hot ? 220 : 120, 2 * s);
            }
            if (this.banner.string && g.phase === 'playing') {
                const bw = Math.min(w - 56 * s, Math.max(260 * s, this.banner.string.length * 27 * s));
                this.card(p, -bw / 2, h / 2 - 322 * s, bw, 58 * s, 29 * s, Q.panel, 235, Q.gold, 200, 2 * s);
            }
            if (this.progress.string && g.phase === 'playing') {
                const pw = Math.min(w - 48 * s, Math.max(250 * s, this.progress.string.length * 16 * s));
                this.card(p, -pw / 2, -h / 2 + 116 * s, pw, 38 * s, 19 * s, Q.panel, 220, Q.panelEdge, 160, 1.8 * s);
            }
            if (this.mowToast > 0)
                this.card(p, -170 * s, (150 + (1 - this.mowToast) * 50) * s - 24 * s, 340 * s, 48 * s, 24 * s, Q.panel, 240, Q.mint, 220, 2 * s);
            if (this.finger !== -1) {
                const ox = this.origin.x, oy = this.origin.y;
                p.fillColor = this.c(Q.panel, 95);
                p.circle(ox, oy, 68 * s); p.fill();
                p.strokeColor = this.c(Q.ink, 70); p.lineWidth = 3 * s;
                p.circle(ox, oy, 68 * s); p.stroke();
                p.fillColor = this.c(Q.mint, 210);
                p.circle(ox + this.stick.x * 50 * s, oy + this.stick.y * 50 * s, 21 * s); p.fill();
                p.strokeColor = this.c(Q.white, 220); p.lineWidth = 2 * s;
                p.circle(ox + this.stick.x * 50 * s, oy + this.stick.y * 50 * s, 21 * s); p.stroke();
            }
            if (this.mowIntro > 0)
                this.drawMowPortalIntro();
            this.drawMowUpgradeToasts();
        }
        else if (settling) {
            p.fillColor = this.c(Q.panel, 225);
            p.rect(-w / 2, -h / 2, w, h); p.fill();
            this.glow(p, 0, 60 * s, w * 1.05, g.phase === 'won' ? Q.gold : Q.mint, 44, 7);
            this.drawMowSettlement();
        }
        else {
            // 菜单 / 暂停：浅色遮罩 + 漂浮像素鸭与花瓣
            p.fillColor = this.c(Q.panel, 175);
            p.rect(-w / 2, -h / 2, w, h); p.fill();
            this.glow(p, 0, 210 * s, 380 * s, Q.gold, 40, 7);
            for (let i = 0; i < 18; i++) {
                const seed = noise(i, 17);
                const x = (seed - .5) * (w - 60 * s);
                const y = -h / 2 + ((this.clock * (14 + seed * 22) + seed * h) % h);
                p.fillColor = this.c(i % 3 === 0 ? Q.coral : i % 3 === 1 ? Q.gold : Q.mint, 130);
                p.rect(x, y, (5 + seed * 6) * s, (5 + seed * 6) * s); p.fill();
            }
            const cy = 430 * s;
            p.strokeColor = this.c(Q.gold, 210); p.lineWidth = 5 * s;
            p.circle(0, cy, 82 * s); p.stroke();
            p.strokeColor = this.c(Q.white, 190); p.lineWidth = 2.5 * s;
            p.circle(0, cy, 98 * s); p.stroke();
            if (!this.menuDuck.node.active)
                this.pixelDuck(p, 0, cy + 6 * s, 2.2 * s);
            // 菜单卡片底板
            this.card(p, -w / 2 + 20 * s, -280 * s, w - 40 * s, 480 * s, 32 * s, Q.panel, 232, Q.panelEdge, 235, 3 * s);
            p.fillColor = this.c(Q.gold, 180);
            p.roundRect(-w / 2 + 38 * s, 188 * s, w - 76 * s, 6 * s, 3 * s); p.fill();
            p.strokeColor = this.c(Q.panelEdge, 190); p.lineWidth = 2 * s;
            p.moveTo(-w / 2 + 48 * s, -45 * s); p.lineTo(w / 2 - 48 * s, -45 * s); p.stroke();
        }
    }
    private drawMowPortalIntro() {
        const p = this.framePen, s = this.s, w = this.w, h = this.h;
        const t = 1 - this.mowIntro / MOW_PORTAL_INTRO;
        const fade = Math.min(1, t * 5) * Math.min(1, (1 - t) * 5);
        const R = (80 + 170 * Math.min(1, t * 1.6)) * s, spin = this.clock * 3.2;
        p.fillColor = this.c(Q.panel, Math.round(215 * fade));
        p.rect(-w / 2, -h / 2, w, h); p.fill();
        this.glow(p, 0, 0, R * 2.4, Q.mint, Math.round(50 * fade), 6);
        this.glow(p, 0, 0, R * 1.3, Q.gold, Math.round(44 * fade), 5);
        for (let ring = 0; ring < 3; ring++) {
            p.strokeColor = this.c([Q.gold, Q.mint, Q.lilac][ring], Math.round((230 - ring * 55) * fade));
            p.lineWidth = (5 - ring) * s;
            p.circle(0, 0, R * (1 - ring * .24)); p.stroke();
        }
        p.strokeColor = this.c(Q.white, Math.round(200 * fade)); p.lineWidth = 3 * s;
        for (let i = 0; i < 16; i++) {
            const a = spin + i * Math.PI / 8;
            p.moveTo(Math.cos(a) * R * .82, Math.sin(a) * R * .82);
            p.lineTo(Math.cos(a) * R * .97, Math.sin(a) * R * .97);
        }
        p.stroke();
        this.pixelDuck(p, 0, -6 * s, Math.max(.05, Math.min(1, t * 2.2) * 1.6) * s * 2.6);
        for (let i = 0; i < 14; i++) {
            const a = i * Math.PI / 7 + spin * .6, r = R * (1.05 + .14 * Math.sin(this.clock * 4 + i));
            p.fillColor = this.c(i % 2 ? Q.gold : Q.mint, Math.round(220 * fade));
            p.rect(Math.cos(a) * r - 4 * s, Math.sin(a) * r - 4 * s, 8 * s, 8 * s); p.fill();
        }
    }
    /** 右上角滑出的获得提示：纯展示，不铺遮罩、不冻结世界、不拦截输入。 */
    private drawMowUpgradeToasts() {
        const p = this.framePen, g = this.mow, w = this.w, s = this.s;
        g.upgradeToasts.forEach((t, i) => {
            const fade = Math.min(1, t.life / .45);
            const x = w / 2 - 311 * s, y = this.mowUpgradeY(i) - 23 * s;
            const slide = (1 - Math.max(0, Math.min(1, (t.duration - t.life) / .18))) * 60 * s;
            p.fillColor = this.c(Q.ink, Math.round(26 * fade));
            p.roundRect(x + 5 * s + slide, y - 5 * s, 290 * s, 46 * s, 23 * s); p.fill();
            this.card(p, x + slide, y, 290 * s, 46 * s, 23 * s,
                Q.panel, Math.round(238 * fade), Q.gold, Math.round(210 * fade), 2 * s);
            p.fillColor = this.c(Q.gold, Math.round(230 * fade));
            p.circle(x + 26 * s + slide, y + 23 * s, 7 * s); p.fill();
        });
    }
    private drawMowSettlement() {
        const g = this.mow, p = this.framePen, s = this.s;
        const t = Math.max(0, Math.min(1, this.settleFor / 2));
        const ease = (x: number) => x * x * (3 - 2 * x);
        const R = (70 + 60 * ease(Math.min(1, t * 1.5))) * s;
        this.glow(p, 0, 40 * s, R * 2.6, Q.mint, 46, 6);
        p.strokeColor = this.c(Q.gold, 230); p.lineWidth = 6 * s;
        p.circle(0, 40 * s, R); p.stroke();
        p.strokeColor = this.c(Q.white, 220); p.lineWidth = 3 * s;
        p.circle(0, 40 * s, R * .74); p.stroke();
        const n = Math.min(12, Math.max(1, Math.floor(g.totalRescued / 4)));
        for (let i = 0; i < n; i++) {
            const a = i * 2.399 + this.clock * .6;
            const rise = ease(Math.min(1, t * 1.3 + i * .03));
            const rr = (20 + (i % 4) * 16) * s * (1 - rise * .7);
            const x = Math.cos(a) * rr, y = 40 * s + Math.sin(a) * rr * .6 + rise * 90 * s;
            this.pixelDuck(p, x, y, (1 - rise * .45) * s);
        }
        for (let i = 0; i < 14; i++) {
            const a = i * Math.PI / 7 + this.clock * 1.4;
            const r = (70 + (i * 29) % 130) * s * (1 + t * .5);
            p.fillColor = this.c([Q.gold, Q.mint, Q.coral, Q.white][i % 4], Math.round(220 * (1 - t * .45)));
            p.rect(Math.cos(a) * r, 40 * s + Math.sin(a) * r, 8 * s, 8 * s); p.fill();
        }
    }
    private menusMow() {
        const g = this.mow;
        const settling = (g.phase === 'won' || g.phase === 'lost') && this.settleFor >= 0 && this.settleFor < 2;
        if (settling) {
            if (this.state !== g.phase) {
                this.state = g.phase;
                for (const n of this.panel.children.slice()) n.destroy();
            }
            return;
        }
        if (this.state === g.phase)
            return;
        this.state = g.phase;
        for (const n of this.panel.children.slice()) n.destroy();
        if (g.phase === 'playing')
            return;
        if (g.phase === 'won') {
            const result = recordResult(this.save, g.character, true);
            if (result.unlocked.length) {
                this.save = result.save;
                this.newUnlocks = result.unlocked;
                this.writeSave();
            }
        }
        const unlockText = this.newUnlocks.length ? `新解锁：${this.newUnlocks.map(c => CHARACTER_NAMES[c]).join('、')}！` : '';
        const s = this.s, W = this.w, isMenu = g.phase === 'menu';
        this.button(this.panel, '切换：经典模式', 0, 390 * s, 220 * s, () => this.switchMode('classic'), { variant: 'chip', h: 50 * s });
        const title = isMenu ? '鸭命要紧' : g.phase === 'paused' ? '暂停一下' : g.phase === 'won' ? '突围成功！' : '被做成鸭货了…';
        const subtitle = isMenu ? '万剑自动清场 · 捡魂珠自动成长 · 救鸭免于上餐桌'
            : g.phase === 'paused' ? '手动继续后恢复战斗'
                : g.phase === 'won' ? (unlockText || '巨型捕鸭夹碎了，鸭子们自由了')
                    : `死因：${g.deathCause} · 但鸭子们记得你`;
        this.label(this.panel, title, Math.round(50 * s), 0, 300 * s, W - 30, { color: Q.goldDeep, bold: true });
        this.label(this.panel, subtitle, Math.round(20 * s), 0, 248 * s, W - 48, { color: Q.inkSoft });
        if (isMenu) {
            this.label(this.panel, '选择职业鸭', Math.round(19 * s), 0, 150 * s, W - 40, { color: Q.inkSoft });
            (['shooter', 'warrior', 'mage'] as Character[]).forEach((c, i) => {
                const x = (i - 1) * 140 * s, unlocked = this.save.unlocked.includes(c);
                const names: Record<Character, string> = { shooter: '御剑鸭', warrior: '剑阵鸭', mage: '引雷鸭' };
                this.button(this.panel, `${names[c]}\n${unlocked ? (this.selected === c ? '✓ 已选择' : '点击选择') : '尚未解锁'}`,
                    x, 70 * s, 128 * s, () => {
                        if (!unlocked) return;
                        this.selected = c;
                        this.save = recordStart(this.save, c);
                        this.writeSave();
                        this.state = '';
                    }, { variant: 'career', h: 88 * s, selected: unlocked && this.selected === c, disabled: !unlocked });
            });
        }
        else if (g.phase === 'paused') {
            this.label(this.panel, '本局进度', Math.round(20 * s), 0, 130 * s, W - 60, { color: Q.inkSoft });
            this.label(this.panel, `Lv.${g.level} · 击退 ${g.kills} · 救出 ${g.totalRescued} 只\n万剑 ×${g.bladeCount} · 剑阵 ${g.orbitCount} · 雷劫 ${g.thunderCount}`,
                Math.round(20 * s), 0, 70 * s, W - 60, { color: Q.ink });
        }
        else {
            this.label(this.panel, `${g.totalRescued} 只鸭`, Math.round(58 * s), 0, 165 * s, W - 60, { color: Q.goldDeep, bold: true });
            this.label(this.panel, '免于上餐桌', Math.round(24 * s), 0, 122 * s, W - 48, { color: Q.ink, bold: true });
            this.label(this.panel, `传送阵撤离 ${g.rescued} 只 · 斩妖放生 ${g.freed} 只${g.rescueBonus ? ` · 突围加成 ${g.rescueBonus} 只` : ''}`,
                Math.round(17 * s), 0, 88 * s, W - 50, { color: Q.inkSoft });
            this.label(this.panel, `第 ${g.wave} 波 · Lv.${g.level} · 击退 ${g.kills} · 连斩峰值 ${g.combo}\n通关用时 ${Math.floor(g.time)} 秒 · 最高构筑 万剑 ×${g.bladeCount}`,
                Math.round(17 * s), 0, 44 * s, W - 60, { color: Q.inkSoft });
        }
        const atk = regenAttempts(this.save, Date.now());
        const canStart = atk.attempts > 0;
        const startLabel = g.phase === 'paused' ? '继续割草' : isMenu ? `开始割草（余 ${atk.attempts} 次）` : `再来一局（余 ${atk.attempts} 次）`;
        const mainY = isMenu ? -110 * s : -60 * s;
        if (g.phase !== 'paused' && !canStart) {
            this.label(this.panel, `开局次数不足（0/${MAX_ATTEMPTS}）· 恢复中`, Math.round(23 * s), 0, -8 * s, 380, { color: Q.coral, bold: true });
            this.button(this.panel, `看广告补 ${AD_BONUS} 次（占位）`, 0, mainY, 400 * s, () => {
                this.save = grantAdBonus(this.save, Date.now());
                this.writeSave();
                this.state = '';
            }, { variant: 'primary', h: 76 * s });
        }
        else
            this.button(this.panel, startLabel, 0, mainY, 400 * s, () => {
                this.enableAudio();
                if (g.phase === 'paused')
                    g.phase = 'playing';
                else {
                    const spent = spendAttempt(this.save, Date.now());
                    if (!spent.ok) { this.state = ''; return; }
                    this.save = spent.save;
                    this.writeSave();
                    g.start(this.selected);
                    this.mowIntro = MOW_PORTAL_INTRO;
                    this.lastMowRescued = 0;
                    this.mowToast = 0;
                }
            }, { variant: 'primary', h: 76 * s });
        const tip = isMenu ? `单指拖动 / WASD 移动 · 武器全自动\n成长自动发放、不打断战斗 · 每 ${g.killsPerDuck} 次击退多救 1 只鸭\n首胜解锁剑阵鸭 · 再胜解锁引雷鸭`
            : '结算演出可点按任意处跳过';
        this.label(this.panel, tip, Math.round(18 * s), 0, isMenu ? -215 * s : -180 * s, W - 60, { color: Q.inkSoft });
    }
}
