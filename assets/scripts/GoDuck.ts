import { _decorator, Component, Node, Graphics, Color, UITransform, Label, input, Input, EventKeyboard, KeyCode, EventTouch, view, ResolutionPolicy, profiler, game, Game as CocosGame, Canvas, resources, Sprite, SpriteFrame, JsonAsset, Texture2D, isValid, sys } from 'cc';
import { EscapeGame, Character } from './EscapeGame';
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
    game = new EscapeGame();
    private save: SaveState = loadSave(sys.localStorage.getItem(SAVE_KEY));
    private selected: Character = 'shooter';
    private newUnlocks: Character[] = [];
    private menuSig: string | undefined;
    // Settlement performance: -1 idle, 0..2 animation playing, >=2 results panel. Tap or any key skips.
    private settleFor = -1;
    private pen: Graphics;
    // 渲染分层：静态氛围 / 世界地面 / 动态对象 / 精灵 / HUD 与菜单 / 文字 / 按钮。
    private bgPen: Graphics;
    private groundPen: Graphics;
    private framePen: Graphics;
    private menuDuck: Sprite;
    private colorCache = new Map<string, Color>();
    private clock = 0;
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
        profiler.hideStats();
        this.bgPen = this.layer('Backdrop');
        this.groundPen = this.layer('Ground');
        this.pen = this.layer('World');
        this.selected = this.save.current;
        this.loadEnemies();
        this.loadDuck();
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
        fit(this.hud, 24); fit(this.note, 18); fit(this.banner, 25); fit(this.progress, 18);
        this.gearLabels.forEach(l => fit(l, 19));
        for (const b of [this.pauseButton, this.audioButton]) {
            const l = b.getComponentInChildren(Label);
            if (l) l.fontSize = Math.round(20 * s);
        }
        this.menuDuck.node.setPosition(0, 430 * s);
        this.menuDuck.node.getComponent(UITransform).setContentSize(120 * s, 120 * s);
        this.drawBackdrop();
        this.state = '';
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
        const event = ['hurt', 'evolve', 'gear', 'level', 'heal', 'end', 'warning', 'bubble', 'boss', 'kill', 'pickup', 'hit', 'shot'].find(e => events.includes(e));
        if (!event)
            return;
        this.soundAt = now + .045;
        const o = this.audio.createOscillator(), gain = this.audio.createGain();
        o.type = event === 'hurt' ? 'sawtooth' : 'sine';
        o.frequency.setValueAtTime(({ hurt: 110, evolve: 1100, gear: 820, level: 980, heal: 780, end: 220, warning: 390, bubble: 550, boss: 140, kill: 650, pickup: 950, hit: 480, shot: 300 } as any)[event], now);
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
        else {
            this.label(this.panel, g.phase === 'paused' ? '本局进度' : '本局战绩', Math.round(20 * s), 0, 130 * s, W - 60, { color: PAL.textFaint });
            this.label(this.panel, `Lv.${g.level} · 击退 ${g.kills} · 谷粒 ${g.score}\n${this.weaponName()} / ${this.auxiliaryName()}`,
                Math.round(20 * s), 0, 70 * s, W - 60, { color: PAL.text });
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
                }
            }, { variant: 'primary', h: 76 * s });
        const tip = isMenu ? '单指拖动 / WASD 移动 · 自动攻击\n25 秒选分支 · 70 秒选辅助 · 120 秒进化\n射手首胜解锁战士 · 战士首胜解锁法师'
            : '单指拖动 / WASD 移动 · 自动攻击\n结算演出可点按任意处跳过';
        this.label(this.panel, tip, Math.round(18 * s), 0, isMenu ? -215 * s : -180 * s, W - 60, { color: PAL.textFaint });
    }
    update(dt: number) {
        this.clock += dt;
        const camera = this.node.parent.getComponent(Canvas)?.cameraComponent;
        if (camera) {
            const pos = camera.node.worldPosition;
            this.node.setWorldPosition(pos.x, pos.y, 0);
        }
        const g = this.game;
        this.game.tick(dt, this.stick.x + Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)), this.stick.y + Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)));
        this.updateDuck(dt);
        this.updateEnemies();
        this.sound(g.events);
        g.events = [];
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
        this.hud.string = `${mm}:${ss}    Lv.${g.level}\n击退 ${g.kills}   经验 ${g.level === 12 ? 'MAX' : `${g.xp}/${g.nextXp}`}`;
        this.note.string = `${this.weaponName()}  /  ${this.auxiliaryName()}${this.muted ? ' · 静音' : ''}`;
        this.banner.string = settling ? (g.phase === 'won' ? this.rescueText() : `被做成${this.dishName(g.deathCause)}…`) : g.phase === 'playing' && g.noticeFor > 0 ? g.notice : '';
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
            const color = f.kind === 'bubble' ? '#82dee9' : f.kind === 'evolve' ? '#93efff' : f.kind === 'slam' ? '#ff8191' : '#ffe4a5';
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
        const target = nextUnlockTarget(this.save);
        return target ? `解救了${CHARACTER_NAMES[target]}！` : '三只职业鸭都自由了！';
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
}
