import { _decorator, Component, Node, Graphics, Color, UITransform, Label, input, Input, EventKeyboard, KeyCode, EventTouch, Vec3, view, ResolutionPolicy, profiler } from 'cc';
import { Game, ITEMS, Item, Kind } from './Game';
const { ccclass } = _decorator;
@ccclass('GoDuck')
export class GoDuck extends Component {
    game = new Game();
    private pen: Graphics;
    private hud: Label;
    private banner: Label;
    private panel: Node;
    private keys = new Set<number>();
    private stick = { x: 0, y: 0 };
    private origin = { x: 0, y: 0 };
    private touchId = -1;
    private uiState = '';
    private w = 1280;
    private h = 720;
    onLoad() { const preview = this.node.parent.getChildByName('EditorPreview'); if (preview) preview.active = false; profiler.hideStats(); view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT); this.w = view.getVisibleSize().width; this.h = view.getVisibleSize().height; this.pen = this.node.addComponent(Graphics); this.hud = this.label(this.node, '', this.w < 700 ? 12 : 20, -this.w / 2 + 25, this.h / 2 - 40, this.w - 50); this.hud.node.setPosition(0, this.h / 2 - 40); this.hud.horizontalAlign = Label.HorizontalAlign.LEFT; this.banner = this.label(this.node, '', 22, 0, this.h / 2 - 112, this.w - 40); this.panel = new Node('Menus'); this.panel.layer = this.node.layer; this.node.addChild(this.panel); input.on(Input.EventType.KEY_DOWN, this.keyDown, this); input.on(Input.EventType.KEY_UP, this.keyUp, this); input.on(Input.EventType.TOUCH_START, this.touchStart, this); input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); }
    onDestroy() { input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this); input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this); }
    private keyDown(e: EventKeyboard) { this.keys.add(e.keyCode); if (this.game.choices.length && e.keyCode >= KeyCode.DIGIT_1 && e.keyCode <= KeyCode.DIGIT_3)
        this.game.choose(e.keyCode - KeyCode.DIGIT_1); if (e.keyCode === KeyCode.ESCAPE && !this.game.choices.length) {
        if (this.game.phase === 'playing' || this.game.phase === 'boss') {
            this.previousPhase = this.game.phase;
            this.game.phase = 'paused';
        }
        else if (this.game.phase === 'paused')
            this.game.phase = this.previousPhase;
    } }
    private previousPhase = 'playing';
    private keyUp(e: EventKeyboard) { this.keys.delete(e.keyCode); }
    private touchStart(e: EventTouch) { if (this.touchId !== -1)
        return; this.touchId = e.getID(); const p = e.getUILocation(); this.origin = { x: p.x, y: p.y }; this.stick = { x: 0, y: 0 }; }
    private touchMove(e: EventTouch) { if (e.getID() !== this.touchId)
        return; const p = e.getUILocation(); const x = p.x - this.origin.x, y = p.y - this.origin.y; const d = Math.max(65, Math.hypot(x, y)); this.stick = { x: x / d, y: y / d }; }
    private touchEnd(e: EventTouch) { if (e.getID() === this.touchId) {
        this.touchId = -1;
        this.stick = { x: 0, y: 0 };
    } }
    private label(parent: Node, text: string, size: number, x: number, y: number, width = 600) { const n = new Node('Text'); n.layer = parent.layer; parent.addChild(n); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(width, size * 2.4); const l = n.addComponent(Label); l.string = text; l.fontSize = size; l.lineHeight = size * 1.4; l.color = new Color('#fff4d4'); l.horizontalAlign = Label.HorizontalAlign.CENTER; return l; }
    private button(text: string, x: number, y: number, action: () => void, width = 260) { const n = new Node('Button'); n.layer = this.panel.layer; this.panel.addChild(n); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(width, 92); const g = n.addComponent(Graphics); g.fillColor = new Color('#31564b'); g.roundRect(-width / 2, -46, width, 92, 14); g.fill(); g.strokeColor = new Color('#e9c975'); g.lineWidth = 2; g.roundRect(-width / 2, -46, width, 92, 14); g.stroke(); this.label(n, text, 20, 0, 0, width - 16); n.on(Node.EventType.TOUCH_END, () => { this.keys.clear(); this.stick = { x: 0, y: 0 }; action(); }); }
    private menus() {
        const g = this.game;
        const state = g.phase + ':' + g.level + ':' + g.choices.join(',');
        if (state === this.uiState)
            return;
        this.uiState = state;
        this.panel.removeAllChildren();
        if (g.phase === 'menu') {
            this.label(this.panel, '家园保卫战', this.w < 700 ? 36 : 54, 0, this.w < 700 ? 230 : 170);
            this.label(this.panel, 'GO DUCK  /  三分钟，守住小小的家', this.w < 700 ? 15 : 22, 0, this.w < 700 ? 180 : 110, this.w - 20);
            const chars: Kind[] = ['chicken', 'duck', 'goose'];
            ['小鸡 · 快速啄击', '小鸭 · 水波减速', '大鹅 · 鸣叫击退'].forEach((t, i) => this.button(t, this.w < 700 ? 0 : (i - 1) * 300, this.w < 700 ? 85 - i * 105 : -20, () => g.start(chars[i]), this.w < 700 ? this.w - 50 : 260));
            this.label(this.panel, 'WASD / 方向键移动 · 手机按住拖动\n自动攻击 · 捡谷物升级 · 满三分钟迎战首领', this.w < 700 ? 14 : 20, 0, this.w < 700 ? -235 : -155, this.w - 20);
        }
        else if (g.choices.length) {
            this.label(this.panel, '补给时间 · 选择一项', this.w < 700 ? 25 : 36, 0, this.w < 700 ? 215 : 155);
            this.label(this.panel, '战斗与计时已暂停', 19, 0, this.w < 700 ? 170 : 105);
            g.choices.forEach((k, i) => this.button(`${i + 1}  ${ITEMS[k].name}  Lv.${(g.equipment[k] || 0) + 1}\n${ITEMS[k].desc}`, this.w < 700 ? 0 : (i - 1) * 310, this.w < 700 ? 65 - i * 105 : -15, () => g.choose(i), this.w < 700 ? this.w - 30 : 292));
            this.label(this.panel, '进化：满级啄击＋辣椒 / 水波＋谷物袋 / 鹅鸣＋小靴子 → 拾取宝箱', this.w < 700 ? 11 : 17, 0, this.w < 700 ? -230 : -130, this.w - 16);
        }
        else if (g.phase === 'won' || g.phase === 'lost') {
            this.label(this.panel, g.phase === 'won' ? '家园守住了！' : '再出发一次吧', 46, 0, 120);
            this.label(this.panel, `击退 ${g.kills} 只入侵者 · 成长至 Lv.${g.level}\n${g.phase === 'won' ? '获得家园宝箱 · 谢谢你守护这片家园' : g.message}`, 23, 0, 30, 850);
            this.button('再来一局', 0, -100, () => { g.phase = 'menu'; });
        }
        else if (g.phase === 'paused') {
            this.label(this.panel, '休息一下', 40, 0, 80);
            this.button('继续守卫', 0, -30, () => g.phase = this.previousPhase);
        }
    }
    private circle(x: number, y: number, r: number, c: string) { this.pen.fillColor = new Color(c); this.pen.circle(x, y, r); this.pen.fill(); }
    update(dt: number) { const g = this.game; let mx = this.stick.x + (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT) ? 1 : 0) - (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT) ? 1 : 0); let my = this.stick.y + (this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP) ? 1 : 0) - (this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN) ? 1 : 0); g.tick(dt, mx, my); this.draw(); this.menus(); const t = Math.floor(g.time); const items = (Object.keys(g.equipment) as Item[]).map(k => `${ITEMS[k].name} ${g.evolved.includes(k) ? '★' : g.equipment[k]}`).join('  '); this.hud.string = g.phase === 'menu' ? '' : `生命 ${g.hp}/100     Lv.${g.level}  谷物 ${g.xp}/${g.requiredXP}     ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} / 3:00     击退 ${g.kills}\n${items}     · Esc 暂停`; const boss = g.enemies.find(e => e.kind === 'boss'); this.banner.string = g.messageTime > 0 ? g.message : boss ? `野猪首领  ${Math.ceil(boss.hp)} / ${boss.max}   · 剩余 ${Math.ceil(90 - g.bossTime)} 秒` : ''; }
    private draw() {
        const g = this.game, p = this.pen;
        p.clear();
        p.fillColor = new Color('#193c32');
        p.rect(-this.w / 2, -this.h / 2, this.w, this.h);
        p.fill();
        const sx = (x: number) => x - g.x, sy = (y: number) => y - g.y;
        p.strokeColor = new Color('#244b3c');
        p.lineWidth = 1;
        for (let x = -1000; x <= 1000; x += 90) {
            p.moveTo(sx(x), -this.h / 2);
            p.lineTo(sx(x), this.h / 2);
        }
        for (let y = -1000; y <= 1000; y += 90) {
            p.moveTo(-this.w / 2, sy(y));
            p.lineTo(this.w / 2, sy(y));
        }
        p.stroke();
        // Decorative home remains background; the player is the only damageable defender.
        p.fillColor = new Color('#987450');
        p.roundRect(sx(-115), sy(150), 230, 125, 12);
        p.fill();
        p.fillColor = new Color('#c88a56');
        p.moveTo(sx(-145), sy(275));
        p.lineTo(sx(0), sy(365));
        p.lineTo(sx(145), sy(275));
        p.close();
        p.fill();
        p.fillColor = new Color('#362f2b');
        p.rect(sx(-25), sy(150), 50, 70);
        p.fill();
        p.strokeColor = new Color('#a28f57');
        p.lineWidth = 8;
        p.rect(sx(-900), sy(-900), 1800, 1800);
        p.stroke();
        for (const d of g.drops) {
            const x = sx(d.x), y = sy(d.y);
            if (d.chest) {
                p.fillColor = new Color('#efb94f');
                p.roundRect(x - 13, y - 10, 26, 20, 4);
                p.fill();
            }
            else
                this.circle(x, y, 5, '#a9e486');
        }
        for (const e of g.enemies) {
            const x = sx(e.x), y = sy(e.y);
            if (e.wind > 0) {
                p.strokeColor = new Color('#ff6868');
                p.lineWidth = 46;
                p.moveTo(x, y);
                p.lineTo(x + e.dx * 450, y + e.dy * 450);
                p.stroke();
            }
            const r = e.kind === 'boss' ? 40 : e.kind === 'elite' ? 24 : e.kind === 'beast' ? 17 : 12;
            this.circle(x, y - 5, r + 3, '#143127');
            this.circle(x, y, r, e.kind === 'boss' ? '#a55d64' : e.kind === 'elite' ? '#b789d0' : e.kind === 'beast' ? '#bd8262' : '#a0b75a');
            this.circle(x - 5, y + 4, 3, '#252b29');
            this.circle(x + 5, y + 4, 3, '#252b29');
            if (e.hp < e.max) {
                p.fillColor = new Color('#ef7d72');
                p.rect(x - r, y + r + 5, r * 2 * Math.max(0, e.hp) / e.max, 4);
                p.fill();
            }
        }
        if (g.phase === 'playing' || g.phase === 'boss') {
            p.strokeColor = new Color(117, 216, 232, 65);
            p.lineWidth = 2;
            p.circle(0, 0, g.character === 'chicken' ? 210 : g.character === 'duck' ? 151 : 127);
            p.stroke();
        }
        for (const f of g.effects) {
            p.strokeColor = new Color(f.color);
            p.lineWidth = 3;
            if (f.color === '#ffe39a') {
                p.lineWidth = 7;
                p.moveTo(0, 8); p.lineTo(sx(f.x), sy(f.y)); p.stroke();
            }
            p.circle(sx(f.x), sy(f.y), f.r * (1.1 - f.life));
            p.stroke();
        }
        this.circle(0, -13, 23, '#132e26');
        this.circle(0, 0, 21, g.character === 'chicken' ? '#ffe3a0' : g.character === 'duck' ? '#f4d85e' : '#f3f0de');
        this.circle(9, 13, 13, g.character === 'duck' ? '#6dbf9a' : '#fff0cb');
        this.circle(13, 16, 2.5, '#213730');
        p.fillColor = new Color('#e99646');
        p.moveTo(20, 10);
        p.lineTo(34, 6);
        p.lineTo(20, 2);
        p.close();
        p.fill();
        if (g.character === 'chicken')
            this.circle(7, 27, 6, '#e47569');
        if (g.phase === 'menu' || g.choices.length || ['won', 'lost', 'paused'].includes(g.phase)) {
            p.fillColor = new Color(11, 28, 25, 225);
            p.rect(-this.w / 2, -this.h / 2, this.w, this.h);
            p.fill();
        }
    }
}
