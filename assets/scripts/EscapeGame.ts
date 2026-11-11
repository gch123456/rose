export interface Pursuer {
    id: number;
    kind: 'glove' | 'clip';
    x: number;
    y: number;
    hp: number;
    visibleFor: number;
    state: 'chase' | 'windup' | 'dash' | 'recover';
    timer: number;
    cooldown: number;
    dx: number;
    dy: number;
}
export interface Shot {
    x: number;
    y: number;
    dx: number;
    dy: number;
    left: number;
    hit: number[];
}
export class EscapeGame {
    phase = 'menu';
    time = 0;
    hp = 5;
    level = 1;
    kills = 0;
    score = 0;
    x = 0;
    y = 0;
    viewWidth = 640;
    viewHeight = 1120;
    enemies: Pursuer[] = [];
    shots: Shot[] = [];
    drops: {
        x: number;
        y: number;
        value: number;
    }[] = [];
    effects: {
        x: number;
        y: number;
        life: number;
    }[] = [];
    events: string[] = [];
    deathCause = '';
    facing = { x: 0, y: 1 };
    private serial = 0;
    private spawnAt = 1;
    private clipAt = 30;
    private fire = 0;
    private immunity = 0;
    private move = { x: 0, y: 1 };
    random: () => number;
    constructor(random: () => number = Math.random) {
        this.random = random;
    }
    setViewport(w: number, h: number) {
        this.viewWidth = w;
        this.viewHeight = h;
    }
    start() {
        this.phase = 'playing';
        this.time = 0;
        this.hp = 5;
        this.level = 1;
        this.kills = 0;
        this.score = 0;
        this.x = 0;
        this.y = 0;
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.effects = [];
        this.events = [];
        this.deathCause = '';
        this.spawnAt = 1;
        this.clipAt = 30;
        this.fire = 0;
        this.immunity = 0;
        this.move = { x: 0, y: 1 };
    }
    spawn(kind: 'glove' | 'clip', x: number, y: number) {
        if (this.enemies.filter(e => e.hp > 0).length >= 160)
            return null;
        const e: Pursuer = { id: ++this.serial, kind, x, y, hp: kind === 'clip' ? 48 : 12, visibleFor: 0, state: 'chase', timer: 0, cooldown: 4, dx: 0, dy: 0 };
        this.enemies.push(e);
        return e;
    }
    private wave() {
        const toward = Math.hypot(this.x, this.y) < 100 ? this.move : { x: -this.x, y: -this.y };
        for (let tries = 0; tries < 16; tries++) {
            const a = this.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
            if ((dx * toward.x + dy * toward.y) / Math.hypot(toward.x, toward.y) > Math.SQRT1_2)
                continue;
            const d = Math.min((this.viewWidth / 2 + 22) / Math.max(.001, Math.abs(dx)), (this.viewHeight / 2 + 22) / Math.max(.001, Math.abs(dy)));
            let kind: 'glove' | 'clip' = 'glove';
            if (this.time >= this.clipAt) {
                this.clipAt += 8;
                if (this.enemies.filter(e => e.kind === 'clip' && e.hp > 0).length < 3)
                    kind = 'clip';
            }
            this.spawn(kind, this.x + dx * d, this.y + dy * d);
            return;
        }
    }
    hit(e: Pursuer, n: number) {
        if (e.hp <= 0)
            return;
        e.hp -= n;
        this.events.push('hit');
        this.effects.push({ x: e.x, y: e.y, life: .18 });
        if (e.hp > 0)
            return;
        this.kills++;
        this.events.push('kill');
        this.drops.push({ x: Math.max(-830, Math.min(830, e.x)), y: Math.max(-830, Math.min(830, e.y)), value: e.kind === 'clip' ? 3 : 1 });
        if (this.drops.length > 260) {
            const d = this.drops.shift();
            this.drops[0].value += d.value;
        }
    }
    tick(dt: number, mx: number, my: number) {
        if (this.phase !== 'playing')
            return;
        dt = Math.max(0, Math.min(dt, .05));
        this.time += dt;
        this.immunity -= dt;
        const m = Math.hypot(mx, my);
        if (m > 0) {
            this.move = { x: mx / m, y: my / m };
            this.x = Math.max(-850, Math.min(850, this.x + this.move.x * 175 * dt));
            this.y = Math.max(-850, Math.min(850, this.y + this.move.y * 175 * dt));
        }
        else {
            this.move = { x: 0, y: 1 };
        }
        if (this.time + 1e-8 >= this.spawnAt) {
            this.wave();
            this.spawnAt += 1 / (this.time < 20 ? 2 : this.time < 50 ? 3 : 4);
        }
        this.fire -= dt;
        const target = this.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - this.x, e.y - this.y) <= 280).sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
        if (target && this.fire <= 0) {
            const d = Math.hypot(target.x - this.x, target.y - this.y) || 1;
            this.facing = { x: (target.x - this.x) / d, y: (target.y - this.y) / d };
            this.shots.push({ x: this.x, y: this.y, dx: this.facing.x, dy: this.facing.y, left: 280, hit: [] });
            this.fire = .55;
            this.events.push('shot');
        }
        for (const s of this.shots) {
            const travel = Math.min(s.left, 420 * dt), ax = s.x, ay = s.y;
            s.x += s.dx * travel;
            s.y += s.dy * travel;
            s.left -= travel;
            const hits = this.enemies.filter(e => e.hp > 0 && !s.hit.includes(e.id)).map(e => {
                const t = Math.max(0, Math.min(travel, (e.x - ax) * s.dx + (e.y - ay) * s.dy));
                return { e, t, d: Math.hypot(e.x - ax - s.dx * t, e.y - ay - s.dy * t) };
            }).filter(h => h.d <= 14).sort((a, b) => a.t - b.t);
            for (const h of hits) {
                s.hit.push(h.e.id);
                this.hit(h.e, 12);
                if (s.hit.length === 2) {
                    s.left = 0;
                    break;
                }
            }
        }
        this.shots = this.shots.filter(s => s.left > 0);
        for (const e of this.enemies) {
            if (e.hp <= 0)
                continue;
            if (Math.abs(e.x - this.x) <= this.viewWidth / 2 + 10 && Math.abs(e.y - this.y) <= this.viewHeight / 2 + 10)
                e.visibleFor += dt;
            let dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1, speed = e.kind === 'clip' ? 65 : 60;
            if (e.state === 'chase') {
                e.cooldown -= dt;
                if (e.kind === 'clip' && e.visibleFor >= .7 && e.cooldown <= 0 && d < 220) {
                    e.state = 'windup';
                    e.timer = .8;
                    e.dx = dx / d;
                    e.dy = dy / d;
                    this.events.push('warning');
                    speed = 0;
                }
            }
            else {
                e.timer -= dt;
                if (e.state === 'windup') {
                    speed = 0;
                    if (e.timer <= 0) {
                        e.state = 'dash';
                        e.timer = .35;
                    }
                }
                else if (e.state === 'dash') {
                    dx = e.dx;
                    dy = e.dy;
                    d = 1;
                    speed = 400;
                    if (e.timer <= 0) {
                        e.state = 'recover';
                        e.timer = .8;
                        speed = 0;
                    }
                }
                else {
                    speed = 0;
                    if (e.timer <= 0) {
                        e.state = 'chase';
                        e.cooldown = 4;
                    }
                }
            }
            e.x += dx / d * speed * dt;
            e.y += dy / d * speed * dt;
            if (e.visibleFor >= .7 && Math.hypot(e.x - this.x, e.y - this.y) < 22 && this.immunity <= 0) {
                this.hp--;
                this.immunity = 1;
                this.deathCause = e.kind === 'clip' ? '夹子怪冲撞 / 接触' : '手套怪接触';
                this.events.push('hurt');
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
        this.drops = this.drops.filter(d => {
            if (Math.hypot(d.x - this.x, d.y - this.y) < 55) {
                this.score += d.value;
                this.events.push('pickup');
                return false;
            }
            return true;
        });
        this.effects = this.effects.filter(e => (e.life -= dt) > 0);
        if (this.hp <= 0) {
            this.hp = 0;
            this.phase = 'lost';
            this.events.push('end');
        }
        else if (this.time >= 90) {
            this.time = 90;
            this.phase = 'complete';
            this.events.push('end');
        }
        if (this.events.length > 64)
            this.events = this.events.slice(-64);
    }
}
