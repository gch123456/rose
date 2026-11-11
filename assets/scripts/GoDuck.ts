import { _decorator, Component, Node, Graphics, Color, UITransform, Label, input, Input, EventKeyboard, KeyCode, EventTouch, view, ResolutionPolicy, profiler, game, Game as CocosGame, Canvas } from 'cc';
import { EscapeGame } from './EscapeGame';
const { ccclass } = _decorator;
@ccclass('GoDuck')
export class GoDuck extends Component {
    game = new EscapeGame();
    private pen: Graphics;
    private hud: Label;
    private note: Label;
    private panel: Node;
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
        this.hud = this.label(this.node, '', 24, 0, 0, 620);
        this.note = this.label(this.node, '', 20, 0, 0, 620);
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
        this.hud.node.setPosition(0, this.h / 2 - 45);
        this.note.node.setPosition(0, this.h / 2 - 90);
        this.pauseButton.setPosition(this.w / 2 - 66, this.h / 2 - 140);
        this.audioButton.setPosition(-this.w / 2 + 66, this.h / 2 - 140);
        this.state = '';
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
        const event = ['hurt', 'end', 'warning', 'kill', 'pickup', 'hit', 'shot'].find(e => events.includes(e));
        if (!event)
            return;
        this.soundAt = now + .045;
        const o = this.audio.createOscillator(), gain = this.audio.createGain();
        o.type = event === 'hurt' ? 'sawtooth' : 'sine';
        o.frequency.setValueAtTime(({ hurt: 110, end: 220, warning: 390, kill: 650, pickup: 950, hit: 480, shot: 300 } as any)[event], now);
        o.frequency.exponentialRampToValueAtTime(event === 'hurt' ? 60 : 180, now + .07);
        gain.gain.setValueAtTime(.025, now);
        gain.gain.exponentialRampToValueAtTime(.001, now + .09);
        o.connect(gain);
        gain.connect(this.audio.destination);
        o.start(now);
        o.stop(now + .1);
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
        const title = g.phase === 'menu' ? '鸭命要紧' : g.phase === 'paused' ? '暂停追捕' : g.phase === 'complete' ? '90 秒小样结束' : '被抓住了！';
        this.label(this.panel, title, 46, 0, 150, this.w - 30);
        this.label(this.panel, g.phase === 'menu' ? '射手鸭 · 走位与清群实验 A' : g.phase === 'lost' ? `死因：${g.deathCause}` : g.phase === 'complete' ? '这是战斗实验，尚非正式通关' : '手动继续后恢复战斗', 23, 0, 85, this.w - 40);
        this.button(this.panel, g.phase === 'paused' ? '继续逃跑' : '开始 90 秒试玩', 0, -5, 340, () => {
            this.enableAudio();
            if (g.phase === 'paused')
                g.phase = 'playing';
            else
                g.start();
        });
        this.label(this.panel, g.phase === 'menu' ? '单指按住拖动 / WASD 移动\n自动射击，谷粒弹最多穿透两只敌人\n红色直线：夹子即将冲刺，向侧边躲开' : `击退 ${g.kills}  ·  拾取 ${g.score}\n固定一级，不弹升级卡\n本阶段未加入 Boss、职业解锁与次数`, 21, 0, -145, this.w - 40);
    }
    update(dt: number) {
        const camera = this.node.parent.getComponent(Canvas)?.cameraComponent;
        if (camera) {
            const pos = camera.node.worldPosition;
            this.node.setWorldPosition(pos.x, pos.y, 0);
        }
        const g = this.game;
        this.game.tick(dt, this.stick.x + Number(this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) - Number(this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)), this.stick.y + Number(this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) - Number(this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)));
        this.sound(g.events);
        g.events = [];
        this.draw();
        this.menus();
        this.hud.string = `生命 ${'♥'.repeat(g.hp)}${'·'.repeat(5 - g.hp)}   ${Math.ceil(90 - g.time)} 秒\n击退 ${g.kills}    谷粒 ${g.score}`;
        this.note.string = this.muted ? '声音已关闭' : g.time < 8 ? '靠近敌人自动射击 · 走近谷粒拾取' : '射手鸭 · 固定一级 · 谷粒弹穿透 2 只';
        this.pauseButton.active = ['playing', 'paused'].includes(g.phase);
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
        for (const e of g.enemies) {
            const x = sx(e.x), y = sy(e.y);
            if (e.state === 'windup') {
                p.strokeColor = new Color('#ff6d79');
                p.lineWidth = 18;
                p.moveTo(x, y);
                p.lineTo(x + e.dx * 160, y + e.dy * 160);
                p.stroke();
            }
            p.fillColor = new Color(e.kind === 'clip' ? '#dd8596' : '#b6c5c3');
            if (e.kind === 'clip') {
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
        for (const s of g.shots) {
            p.strokeColor = new Color('#fff3a7');
            p.lineWidth = 4;
            p.moveTo(sx(s.x) - s.dx * 15, sy(s.y) - s.dy * 15);
            p.lineTo(sx(s.x), sy(s.y));
            p.stroke();
            this.circle(sx(s.x), sy(s.y), 4, '#fff3a7');
        }
        for (const f of g.effects) {
            p.strokeColor = new Color('#ffe4a5');
            p.lineWidth = 3;
            p.circle(sx(f.x), sy(f.y), 10 + (1 - f.life / .18) * 12);
            p.stroke();
        }
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
        if (this.finger !== -1) {
            p.strokeColor = new Color(210, 235, 230, 110);
            p.lineWidth = 3;
            p.circle(this.origin.x, this.origin.y, 65);
            p.stroke();
            this.circle(this.origin.x + this.stick.x * 50, this.origin.y + this.stick.y * 50, 20, '#78a99f');
        }
        if (g.phase !== 'playing') {
            p.fillColor = new Color(8, 23, 30, 235);
            p.rect(-this.w / 2, -this.h / 2, this.w, this.h);
            p.fill();
        }
    }
}
