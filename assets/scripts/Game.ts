export type Kind = 'chicken' | 'duck' | 'goose';
export const ITEMS = {
    peck: { name: '啄击', desc: '自动啄击最近敌人', max: 5, type: 'weapon', pair: 'pepper' },
    wave: { name: '水波', desc: '周期水波，范围伤害并减速', max: 5, type: 'weapon', pair: 'magnet' },
    honk: { name: '鹅鸣', desc: '范围震击，推开周围敌人', max: 5, type: 'weapon', pair: 'boots' },
    pepper: { name: '辣椒', desc: '每级伤害增加 20%', max: 3, type: 'passive', pair: '' },
    boots: { name: '小靴子', desc: '每级移动速度增加 12%', max: 3, type: 'passive', pair: '' },
    magnet: { name: '谷物袋', desc: '每级拾取范围增加 35', max: 3, type: 'passive', pair: '' },
};
export type Item = keyof typeof ITEMS;
export interface Enemy {
    id: number;
    x: number;
    y: number;
    hp: number;
    max: number;
    kind: string;
    speed: number;
    slow: number;
    wind: number;
    dx: number;
    dy: number;
    charge: number;
}
export class Game {
    phase = 'menu';
    time = 0;
    bossTime = 0;
    hp = 100;
    level = 1;
    xp = 0;
    kills = 0;
    x = 0;
    y = 0;
    character: Kind = 'duck';
    equipment: Partial<Record<Item, number>> = {};
    evolved: Item[] = [];
    choices: Item[] = [];
    enemies: Enemy[] = [];
    drops: {
        x: number;
        y: number;
        value: number;
        chest: boolean;
    }[] = [];
    effects: {
        x: number;
        y: number;
        r: number;
        life: number;
        color: string;
    }[] = [];
    message = '';
    messageTime = 0;
    private spawnClock = 0;
    private eliteAt = 45;
    private cooldown: Record<string, number> = {};
    private invincible = 0;
    private serial = 0;
    random: () => number;
    constructor(random: () => number = Math.random) { this.random = random; }
    start(kind: Kind) { this.phase = 'playing'; this.character = kind; this.time = 0; this.bossTime = 0; this.hp = 100; this.level = 1; this.xp = 0; this.kills = 0; this.x = 0; this.y = 0; this.enemies = []; this.drops = []; this.effects = []; this.choices = []; this.evolved = []; this.equipment = { [kind === 'chicken' ? 'peck' : kind === 'duck' ? 'wave' : 'honk']: 1 }; this.cooldown = {}; this.invincible = 0; this.spawnClock = 0; this.eliteAt = 45; this.message = '守住这片小小的家园！'; this.messageTime = 4; }
    get requiredXP() { return 7 + this.level * 4; }
    options(): Item[] { return (Object.keys(ITEMS) as Item[]).filter(k => { const v = this.equipment[k] || 0; if (v >= ITEMS[k].max)
        return false; if (v)
        return true; return Object.keys(this.equipment).filter(i => ITEMS[i as Item].type === ITEMS[k].type).length < 3; }); }
    gainXP(n: number) { this.xp += n; if (!this.choices.length && this.xp >= this.requiredXP) {
        const pool = this.options();
        while (pool.length && this.choices.length < 3) {
            this.choices.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
        }
        if (!this.choices.length) {
            this.xp -= this.requiredXP;
            this.level++;
            this.hp = Math.min(100, this.hp + 12);
        }
    } }
    choose(i: number) { const k = this.choices[i]; if (!k)
        return; this.xp -= this.requiredXP; this.level++; this.equipment[k] = (this.equipment[k] || 0) + 1; this.choices = []; this.gainXP(0); }
    openChest() { const eligible = (Object.keys(this.equipment) as Item[]).find(k => ITEMS[k].type === 'weapon' && this.equipment[k] === 5 && this.equipment[ITEMS[k].pair as Item] && !this.evolved.includes(k)); if (eligible) {
        this.evolved.push(eligible);
        this.message = ITEMS[eligible].name + '进化！威力翻倍';
    }
    else {
        const pool = this.options().filter(k => this.equipment[k]);
        if (pool.length) {
            const k = pool[Math.floor(this.random() * pool.length)];
            this.equipment[k]++;
            this.message = '宝箱：' + ITEMS[k].name + '升级';
        }
        else {
            this.hp = Math.min(100, this.hp + 25);
            this.message = '宝箱：恢复 25 生命';
        }
    } this.messageTime = 4; return !!eligible; }
    spawn(kind: string, distance = 500) { if (this.enemies.length >= 160)
        return; const a = this.random() * Math.PI * 2; const max = kind === 'boss' ? 1400 : kind === 'elite' ? 120 + this.time : 10 + this.time * .13; this.enemies.push({ id: ++this.serial, x: this.x + Math.cos(a) * distance, y: this.y + Math.sin(a) * distance, hp: max, max, kind, speed: kind === 'boss' ? 30 : kind === 'beast' ? 65 : kind === 'elite' ? 42 : 30 + this.time * .08, slow: 0, wind: 0, dx: 0, dy: 0, charge: kind === 'boss' ? 3 : 0 }); }
    hit(e: Enemy, damage: number) { if (e.hp <= 0)
        return; e.hp -= damage; if (e.hp > 0)
        return; this.kills++; if (e.kind === 'boss') {
        this.phase = 'won';
        this.message = '家园守住了！获得家园宝箱';
        return;
    } this.drops.push({ x: e.x, y: e.y, value: e.kind === 'elite' ? 12 : 2, chest: e.kind === 'elite' }); if (this.drops.length > 260) {
        const first = this.drops.shift();
        this.drops[0].value += first.value;
    } }
    tick(dt: number, mx: number, my: number) {
        if (!['playing', 'boss'].includes(this.phase) || this.choices.length)
            return;
        dt = Math.min(dt, .05);
        this.time += this.phase === 'playing' ? dt : 0;
        this.messageTime -= dt;
        this.invincible -= dt;
        const mag = Math.hypot(mx, my) || 1;
        const speed = 175 * (1 + (this.equipment.boots || 0) * .12);
        this.x = Math.max(-850, Math.min(850, this.x + mx / mag * speed * dt));
        this.y = Math.max(-850, Math.min(850, this.y + my / mag * speed * dt));
        if (this.phase === 'playing') {
            this.spawnClock -= dt;
            if (this.spawnClock <= 0) {
                const minute = Math.floor(this.time / 60);
                for (let i = 0; i < 1 + minute; i++)
                    this.spawn(this.random() < .25 ? 'beast' : 'bug', this.time < 1 ? 100 : 420);
                this.spawnClock = Math.max(.13, .8 - this.time * .0035);
            }
            if (this.time >= this.eliteAt) {
                this.spawn('elite');
                this.eliteAt += 45;
            }
            if (this.time >= 180) {
                this.phase = 'boss';
                this.enemies = [];
                this.spawn('boss');
                this.message = '野猪首领来了 · 留意红色冲撞预警';
                this.messageTime = 5;
            }
        }
        else {
            this.bossTime += dt;
            if (this.bossTime >= 90) {
                this.phase = 'lost';
                this.message = '天黑了，首领突破了防线';
            }
        }
        for (const k of ['peck', 'wave', 'honk'] as Item[]) {
            const lv = this.equipment[k] || 0;
            if (!lv)
                continue;
            this.cooldown[k] = (this.cooldown[k] || 0) - dt;
            if (this.cooldown[k] > 0)
                continue;
            const nearest = this.enemies.filter(e => e.hp > 0).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
            if (!nearest)
                continue;
            const evolved = this.evolved.includes(k);
            const range = k === 'peck' ? 210 : k === 'wave' ? 135 + lv * 16 : 115 + lv * 12;
            const damage = (k === 'peck' ? 17 + lv * 7 : 10 + lv * 5) * (1 + (this.equipment.pepper || 0) * .2) * (evolved ? 2 : 1);
            this.cooldown[k] = (k === 'peck' ? .55 : k === 'wave' ? 1.3 : 1.8) * (this.character === 'chicken' && k === 'peck' ? .8 : 1);
            if (k === 'peck') {
                if (Math.hypot(nearest.x - this.x, nearest.y - this.y) < range) {
                    this.hit(nearest, damage);
                    this.effects.push({ x: nearest.x, y: nearest.y, r: 23, life: .5, color: '#ffe39a' });
                }
                else
                    this.cooldown[k] = .1;
            }
            else {
                this.effects.push({ x: this.x, y: this.y, r: range, life: .65, color: k === 'wave' ? '#75d8e8' : '#ffda79' });
                for (const e of this.enemies) {
                    const d = Math.hypot(e.x - this.x, e.y - this.y);
                    if (d < range) {
                        this.hit(e, damage);
                        if (k === 'wave')
                            e.slow = 1.3;
                        else if (e.kind !== 'boss') {
                            e.x += (e.x - this.x) / (d || 1) * 45;
                            e.y += (e.y - this.y) / (d || 1) * 45;
                        }
                    }
                }
            }
        }
        for (const e of this.enemies) {
            if (e.hp <= 0)
                continue;
            let dx = this.x - e.x, dy = this.y - e.y;
            const d = Math.hypot(dx, dy) || 1;
            e.slow -= dt;
            let sp = e.speed * (e.slow > 0 ? .45 : 1);
            if (e.kind === 'boss') {
                e.charge -= dt;
                if (e.wind > 0) {
                    e.wind -= dt;
                    sp = 0;
                    if (e.wind <= 0)
                        e.charge = -.65;
                }
                else if (e.charge < 0) {
                    dx = e.dx;
                    dy = e.dy;
                    sp = 520;
                    e.charge += dt * 2;
                    if (e.charge >= 0)
                        e.charge = 3;
                }
                else if (e.charge <= .05) {
                    e.wind = .9;
                    e.dx = dx / d;
                    e.dy = dy / d;
                }
            }
            const norm = e.kind === 'boss' && e.charge < 0 ? 1 : d;
            e.x += dx / norm * sp * dt;
            e.y += dy / norm * sp * dt;
            if (d < (e.kind === 'boss' ? 48 : 24) && this.invincible <= 0) {
                this.hp -= e.kind === 'boss' ? 22 : 8;
                this.invincible = .65;
                if (this.hp <= 0) {
                    this.hp = 0;
                    this.phase = 'lost';
                    this.message = '这次没守住，再试一次！';
                }
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        const pickup = 45 + (this.equipment.magnet || 0) * 35;
        this.drops = this.drops.filter(p => { const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < pickup) {
            if (p.chest)
                this.openChest();
            this.gainXP(p.value);
            return false;
        } return true; });
        this.effects = this.effects.filter(f => (f.life -= dt) > 0);
    }
}
