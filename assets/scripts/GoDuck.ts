import { _decorator, Component, Node, Graphics, Color, UITransform, Label, input, Input, EventKeyboard, KeyCode, EventTouch, view, ResolutionPolicy, profiler, game, Game as CocosGame, Canvas, resources, Sprite, SpriteFrame, JsonAsset, Texture2D, isValid, sys } from 'cc';
import { EscapeGame, Character } from './EscapeGame';
import { SaveState, loadSave, persist, recordResult, recordStart, SAVE_KEY } from './SaveData';
const { ccclass } = _decorator;
const CHARACTER_NAMES: Record<Character, string> = { shooter: '射手鸭', warrior: '战士鸭', mage: '法师鸭' };
@ccclass('GoDuck')
export class GoDuck extends Component {
    game = new EscapeGame();
    private save: SaveState = loadSave(sys.localStorage.getItem(SAVE_KEY));
    private selected: Character = 'shooter';
    private newUnlocks: Character[] = [];
    private pen: Graphics;
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
        this.pen = this.node.addComponent(Graphics);
        this.selected = this.save.current;
        this.loadDuck();
        this.hud = this.label(this.node, '', 24, 0, 0, 620);
        this.note = this.label(this.node, '', 20, 0, 0, 620);
        this.banner = this.label(this.node, '', 25, 0, 0, 590);
        this.progress = this.label(this.node, '', 20, 0, 0, 590);
        this.gearLabels = [0, 1].map(() => this.label(this.node, '', 20, 0, 0, 180));
        this.panel = new Node('Menus');
        this.panel.layer = this.node.layer;
        this.node.addChild(this.panel);
        this.pauseButton = this.button(this.node, '暂停', 0, 0, 100, () => this.pause());
        this.audioButton = this.button(this.node, '声音', 0, 0, 100, () => {
            this.muted = !this.muted;
            if (!this.muted)
                this.enableAudio();
        });
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
        view.setDesignResolutionSize(this.w, this.h, ResolutionPolicy.SHOW_ALL);
        this.game.setViewport(this.w, this.h);
        this.hud.node.setPosition(0, this.h / 2 - 43);
        this.note.node.setPosition(0, this.h / 2 - 124);
        this.banner.node.setPosition(0, this.h / 2 - 224);
        this.progress.node.setPosition(0, -this.h / 2 + 62);
        this.pauseButton.setPosition(this.w / 2 - 66, this.h / 2 - 174);
        this.audioButton.setPosition(-this.w / 2 + 66, this.h / 2 - 174);
        this.state = '';
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
        if (e.keyCode === KeyCode.ESCAPE)
            this.pause();
    }
    private keyUp(e: EventKeyboard) {
        this.keys.delete(e.keyCode);
    }
    private touchStart(e: EventTouch) {
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
    private label(parent: Node, text: string, size: number, x: number, y: number, width: number) {
        const n = new Node('Text');
        n.layer = parent.layer;
        parent.addChild(n);
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(width, size * 3);
        const l = n.addComponent(Label);
        l.string = text;
        l.fontSize = size;
        l.lineHeight = size * 1.4;
        l.color = new Color('#fff3cf');
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        return l;
    }
    private button(parent: Node, text: string, x: number, y: number, width: number, action: () => void) {
        const n = new Node('Button');
        n.layer = parent.layer;
        parent.addChild(n);
        n.setPosition(x, y);
        n.addComponent(UITransform).setContentSize(width, 64);
        const p = n.addComponent(Graphics);
        p.fillColor = new Color('#345b55');
        p.roundRect(-width / 2, -32, width, 64, 12);
        p.fill();
        p.strokeColor = new Color('#f5cf7d');
        p.lineWidth = 2;
        p.roundRect(-width / 2, -32, width, 64, 12);
        p.stroke();
        this.label(n, text, 22, 0, 0, width - 12);
        n.on(Node.EventType.TOUCH_END, () => {
            this.clearInput();
            action();
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
    private menus() {
        const g = this.game;
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
        this.label(this.panel, title, 46, 0, 150, this.w - 30);
        this.label(this.panel, g.phase === 'menu' ? '捡谷粒升级 · 拾装备变强' : g.phase === 'paused' ? '手动继续后恢复战斗' : g.phase === 'won' ? (unlockText || '冲出了出口——继续用本职业挑战或换新角色') : `包装出品 · 死因：${g.deathCause}`, 23, 0, 85, this.w - 40);
        if (g.phase === 'menu') {
            this.label(this.panel, '选择职业鸭', 20, 0, -40, this.w - 40);
            (['shooter', 'warrior', 'mage'] as Character[]).forEach((c, i) => {
                const x = (i - 1) * 130;
                if (this.save.unlocked.includes(c))
                    this.button(this.panel, `${CHARACTER_NAMES[c]}${this.selected === c ? ' ✓' : ''}`, x, -85, 118, () => {
                        this.selected = c;
                        this.save = recordStart(this.save, c);
                        this.writeSave();
                        this.state = '';
                    });
                else
                    this.label(this.panel, `${CHARACTER_NAMES[c]}\n🔒 未解锁`, 16, x, -85, 118);
            });
        }
        this.button(this.panel, g.phase === 'paused' ? '继续逃跑' : g.phase === 'menu' ? '开始逃跑' : '再来一局', 0, -5, 340, () => {
            this.enableAudio();
            if (g.phase === 'paused')
                g.phase = 'playing';
            else {
                g.character = this.selected;
                g.start();
            }
        });
        this.label(this.panel, g.phase === 'menu' ? '单指拖动 / WASD 移动 · 自动攻击\n25 秒选分支 · 70 秒选辅助 · 120 秒进化\n射手首胜解锁战士 · 战士首胜解锁法师' : `Lv.${g.level} · 击退 ${g.kills} · 谷粒 ${g.score}\n${this.weaponName()} / ${this.auxiliaryName()}`, 21, 0, -145, this.w - 40);
    }
    update(dt: number) {
        const camera = this.node.parent.getComponent(Canvas)?.cameraComponent;
        if (camera) {
            const pos = camera.node.worldPosition;
            this.node.setWorldPosition(pos.x, pos.y, 0);
        }
        const g = this.game;
        this.game.tick(dt, this.stick.x + Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)), this.stick.y + Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)));
        this.updateDuck(dt);
        this.sound(g.events);
        g.events = [];
        this.draw();
        this.menus();
        this.hud.string = `生命 ${'♥'.repeat(g.hp)}${'·'.repeat(Math.max(0, 5 - g.hp))}   ${Math.ceil((g.boss ? g.limit : g.duration) - g.time)} 秒\nLv.${g.level}   击退 ${g.kills}   经验 ${g.level === 12 ? 'MAX' : `${g.xp}/${g.nextXp}`}`;
        this.note.string = `${this.weaponName()}  /  ${this.auxiliaryName()}${this.muted ? ' · 静音' : ''}`;
        this.banner.string = g.phase === 'playing' && g.noticeFor > 0 ? g.notice : '';
        const c = g.choice;
        this.progress.string = g.phase !== 'playing' ? '' : c
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
        this.pen.fillColor = new Color(c);
        this.pen.circle(x, y, r);
        this.pen.fill();
    }
    private draw() {
        const g = this.game, p = this.pen, sx = (x: number) => x - g.x, sy = (y: number) => y - g.y;
        p.clear();
        p.fillColor = new Color('#152c36');
        p.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        p.fill();
        p.strokeColor = new Color('#203d48');
        p.lineWidth = 1;
        for (let x = -1800; x <= 1800; x += 80) {
            p.moveTo(sx(x), -this.h / 2);
            p.lineTo(sx(x), this.h / 2);
        }
        for (let y = -1800; y <= 1800; y += 80) {
            p.moveTo(-this.w / 2, sy(y));
            p.lineTo(this.w / 2, sy(y));
        }
        p.stroke();
        p.strokeColor = new Color('#d3a967');
        p.lineWidth = 5;
        p.rect(sx(-850), sy(-850), 1700, 1700);
        p.stroke();
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
            p.fillColor = new Color(ready ? '#274e60' : '#253640');
            p.roundRect(x - 29, y - 29, 58, 58, 10);
            p.fill();
            p.strokeColor = new Color(ready ? '#f8d97e' : '#849c9a');
            p.lineWidth = 3;
            p.roundRect(x - 29, y - 29, 58, 58, 10);
            p.stroke();
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
        if (this.finger !== -1) {
            p.strokeColor = new Color(210, 235, 230, 110);
            p.lineWidth = 3;
            p.circle(this.origin.x, this.origin.y, 65);
            p.stroke();
            this.circle(this.origin.x + this.stick.x * 50, this.origin.y + this.stick.y * 50, 20, '#78a99f');
        }
        if (g.phase === 'playing') {
            p.fillColor = new Color('#203c46');
            p.roundRect(-260, this.h / 2 - 100, 520, 9, 4);
            p.fill();
            p.fillColor = new Color('#e6c978');
            p.roundRect(-260, this.h / 2 - 100, Math.max(1, 520 * (g.level === 12 ? 1 : g.xp / g.nextXp)), 9, 4);
            p.fill();
        }
        if (g.phase !== 'playing') {
            p.fillColor = new Color(8, 23, 30, 235);
            p.rect(-this.w / 2, -this.h / 2, this.w, this.h);
            p.fill();
        }
    }
}
