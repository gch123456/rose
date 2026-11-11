export type EnemyKind = 'glove' | 'clip' | 'lid';
export type GearKey = 'line' | 'spread' | 'bubble' | 'feather';
export interface Pursuer {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    hp: number;
    visibleFor: number;
    state: 'chase' | 'windup' | 'dash' | 'recover';
    timer: number;
    cooldown: number;
    dx: number;
    dy: number;
    aimX: number;
    aimY: number;
    slowFor: number;
}
export interface Shot {
    x: number;
    y: number;
    dx: number;
    dy: number;
    left: number;
    hit: number[];
    delay: number;
    damage: number;
    pierce: number;
    kind: 'grain' | 'feather';
    evolved: boolean;
    // Shared by a whole volley, so overlapping scatter lanes cannot multiply damage indefinitely.
    budget: {
        hits: Map<number, number>;
        max: number;
    };
}
export interface GearChoice {
    kind: 'branch' | 'auxiliary';
    due: number;
    spawnedAt: number;
    retryAt: number;
    options: {
        key: GearKey;
        x: number;
        y: number;
    }[];
}
export class EscapeGame {
    readonly duration = 150;
    phase = 'menu';
    time = 0;
    hp = 5;
    level = 1;
    xp = 0;
    kills = 0;
    score = 0;
    x = 0;
    y = 0;
    branch: 'base' | 'line' | 'spread' = 'base';
    auxiliary: 'none' | 'bubble' | 'feather' = 'none';
    evolved = false;
    choice: GearChoice | null = null;
    choiceRetries = 0;
    choiceHistory: {
        kind: string;
        key: GearKey;
        reason: 'picked' | 'timeout';
        time: number;
        retries: number;
    }[] = [];
    viewWidth = 640;
    viewHeight = 1120;
    enemies: Pursuer[] = [];
    shots: Shot[] = [];
    drops: {
        x: number;
        y: number;
        value: number;
    }[] = [];
    foods: {
        x: number;
        y: number;
    }[] = [];
    effects: {
        x: number;
        y: number;
        life: number;
        duration: number;
        radius: number;
        kind: string;
    }[] = [];
    events: string[] = [];
    deathCause = '';
    facing = { x: 0, y: 1 };
    notice = '';
    noticeFor = 0;
    private serial = 0;
    private spawnAt = 1;
    private clipAt = 30;
    private lidAt = 55;
    private fire = 0;
    private auxiliaryFire = 0;
    private immunity = 0;
    private move = { x: 0, y: 1 };
    private foodThresholds = [45, 100];
    random: () => number;
    constructor(random: () => number = Math.random) {
        this.random = random;
    }
    get nextXp() {
        return 10 + 4 * (this.level - 1);
    }
    get damage() {
        return 12 * (1 + .08 * (this.level - 1));
    }
    get attackInterval() {
        return .55 / (1 + .04 * Math.floor(this.level / 2));
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
        this.xp = 0;
        this.kills = 0;
        this.score = 0;
        this.x = 0;
        this.y = 0;
        this.branch = 'base';
        this.auxiliary = 'none';
        this.evolved = false;
        this.choice = null;
        this.choiceHistory = [];
        this.choiceRetries = 0;
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.foods = [];
        this.effects = [];
        this.events = [];
        this.deathCause = '';
        this.notice = '';
        this.noticeFor = 0;
        this.serial = 0;
        this.spawnAt = 1;
        this.clipAt = 30;
        this.lidAt = 55;
        this.fire = 0;
        this.auxiliaryFire = 0;
        this.immunity = 0;
        this.move = { x: 0, y: 1 };
        this.facing = { x: 0, y: 1 };
        this.foodThresholds = [45, 100];
    }
    private announce(message: string, event: string) {
        this.notice = message;
        this.noticeFor = 2.5;
        this.events.push(event);
    }
    private effect(x: number, y: number, radius: number, kind: string, life = .35) {
        this.effects.push({ x, y, radius, kind, life, duration: life });
    }
    private experience(value: number) {
        this.score += value;
        if (this.level === 12)
            return;
        this.xp += value;
        while (this.level < 12 && this.xp >= this.nextXp) {
            this.xp -= this.nextXp;
            this.level++;
            this.effect(this.x, this.y, 60, 'level', .65);
            this.announce(`升级！Lv.${this.level} · 火力增强`, 'level');
        }
        if (this.level === 12)
            this.xp = 0;
    }
    spawn(kind: EnemyKind, x: number, y: number) {
        if (this.enemies.filter(e => e.hp > 0).length >= 160)
            return null;
        const e: Pursuer = { id: ++this.serial, kind, x, y, hp: kind === 'lid' ? 140 : kind === 'clip' ? 48 : 12,
            visibleFor: 0, state: 'chase', timer: 0, cooldown: kind === 'lid' ? 5 : 4,
            dx: 0, dy: 0, aimX: x, aimY: y, slowFor: 0 };
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
            let kind: EnemyKind = 'glove';
            if (this.time >= this.clipAt) {
                this.clipAt += 8;
                if (this.enemies.filter(e => e.kind === 'clip' && e.hp > 0).length < 3)
                    kind = 'clip';
            }
            // A simultaneous special slot goes to the clip; advance both schedules without backlog.
            if (this.time >= this.lidAt) {
                this.lidAt += 15;
                if (kind === 'glove' && this.enemies.filter(e => e.kind === 'lid' && e.hp > 0).length < 2)
                    kind = 'lid';
            }
            this.spawn(kind, this.x + dx * d, this.y + dy * d);
            return;
        }
    }
    hit(e: Pursuer, damage: number) {
        if (e.hp <= 0)
            return;
        e.hp -= damage;
        this.events.push('hit');
        this.effect(e.x, e.y, 20, 'hit', .18);
        if (e.hp > 0)
            return;
        this.kills++;
        this.events.push('kill');
        const x = Math.max(-830, Math.min(830, e.x)), y = Math.max(-830, Math.min(830, e.y));
        this.drops.push({ x, y, value: e.kind === 'lid' ? 6 : e.kind === 'clip' ? 3 : 1 });
        if (this.drops.length > 260)
            this.drops[0].value += this.drops.pop()!.value;
        while (this.foodThresholds.length && this.time >= this.foodThresholds[0]) {
            this.foodThresholds.shift();
            this.foods.push({ x, y });
        }
    }
    private safeChoicePoint(x: number, y: number) {
        if (Math.abs(x) > 830 || Math.abs(y) > 830)
            return false;
        const rx = x - this.x, ry = y - this.y;
        if (Math.abs(rx) > this.viewWidth / 2 - 55 || ry > this.viewHeight / 2 - 190 || ry < -this.viewHeight / 2 + 140)
            return false;
        for (const e of this.enemies) {
            if (e.hp <= 0)
                continue;
            if (Math.hypot(x - e.x, y - e.y) < 60)
                return false;
            if (e.kind === 'lid' && e.state === 'windup' && Math.hypot(x - e.aimX, y - e.aimY) < 90)
                return false;
            if (e.kind === 'clip' && (e.state === 'windup' || e.state === 'dash')) {
                const t = Math.max(0, Math.min(160, (x - e.x) * e.dx + (y - e.y) * e.dy));
                if (Math.hypot(x - e.x - t * e.dx, y - e.y - t * e.dy) < 50)
                    return false;
            }
        }
        return true;
    }
    private resolveChoice(key: GearKey, reason: 'picked' | 'timeout') {
        const c = this.choice!;
        if (c.kind === 'branch')
            this.branch = key as 'line' | 'spread';
        else {
            this.auxiliary = key as 'bubble' | 'feather';
            this.auxiliaryFire = 0;
        }
        this.choiceHistory.push({ kind: c.kind, key, reason, time: this.time, retries: this.choiceRetries });
        this.choice = null;
        if (reason === 'picked') {
            this.immunity = Math.max(this.immunity, .6);
            for (const e of this.enemies) {
                const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
                if (d < 90) {
                    const a = d ? 0 : e.id * 2.4;
                    e.x = this.x + (d ? dx / d : Math.cos(a)) * 100;
                    e.y = this.y + (d ? dy / d : Math.sin(a)) * 100;
                }
            }
        }
        const names = { line: '长线穿透', spread: '三向散射', bubble: '泡泡圈 · 范围减速', feather: '飞羽 · 远程补刀' };
        this.announce(`${reason === 'timeout' ? '自动装备' : '获得装备'}：${names[key]}`, 'gear');
        this.effect(this.x, this.y, 90, 'gear', .65);
    }
    private updateChoice() {
        if (!this.choice) {
            const kind = this.time >= 25 && this.branch === 'base' ? 'branch' : this.time >= 70 && this.auxiliary === 'none' ? 'auxiliary' : null;
            if (kind) {
                this.choice = { kind, due: kind === 'branch' ? 25 : 70, spawnedAt: this.time, retryAt: this.time, options: [] };
                this.choiceRetries = 0;
                this.announce(kind === 'branch' ? '武器掉落！走近长线或散射' : '辅助掉落！走近泡泡圈或飞羽', 'gear');
            }
        }
        const c = this.choice;
        if (!c)
            return;
        if (this.time + 1e-8 >= c.due + 15) {
            this.resolveChoice(c.kind === 'branch' ? 'line' : 'bubble', 'timeout');
            return;
        }
        // Revalidate on camera movement/resize; unsuitable tokens are placed again, never clamped onto a player.
        if (c.options.length && c.options.some(o => Math.abs(o.x - this.x) > this.viewWidth / 2 - 45 || o.y - this.y > this.viewHeight / 2 - 180 || o.y - this.y < -this.viewHeight / 2 + 100))
            c.options = [];
        if (!c.options.length && this.time >= c.retryAt) {
            this.choiceRetries++;
            c.retryAt = this.time + .25;
            const points: {
                x: number;
                y: number;
            }[] = [];
            for (const radius of [120, 150, 90])
                for (let i = 0; i < 24; i++) {
                    const a = Math.PI + i * Math.PI / 12, x = this.x + Math.cos(a) * radius, y = this.y + Math.sin(a) * radius;
                    if (this.safeChoicePoint(x, y))
                        points.push({ x, y });
                }
            let a: {
                x: number;
                y: number;
            } | undefined, b: {
                x: number;
                y: number;
            } | undefined;
            for (const point of points) {
                const other = points.find(p => Math.hypot(p.x - point.x, p.y - point.y) >= 90);
                if (other) {
                    a = point;
                    b = other;
                    break;
                }
            }
            if (a && b) {
                const keys: GearKey[] = c.kind === 'branch' ? ['line', 'spread'] : ['bubble', 'feather'];
                c.options = [{ ...a, key: keys[0] }, { ...b, key: keys[1] }];
                c.spawnedAt = this.time;
            }
        }
        if (this.time - c.spawnedAt >= .8) {
            const option = c.options.find(o => Math.hypot(o.x - this.x, o.y - this.y) <= 22);
            if (option)
                this.resolveChoice(option.key, 'picked');
        }
    }
    private target(range: number) {
        return this.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - this.x, e.y - this.y) <= range)
            .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))[0];
    }
    private shoot(target: Pursuer, kind: 'grain' | 'feather') {
        const angle = Math.atan2(target.y - this.y, target.x - this.x), feather = kind === 'feather';
        const spread = !feather && this.branch === 'spread';
        const angles = spread ? (this.evolved ? [-36, -18, 0, 18, 36] : [-18, 0, 18]) : (!feather && this.evolved ? [0, 0] : [0]);
        const damage = this.damage * (feather ? .6 : spread ? (this.evolved ? 1.28 : .8) : this.evolved ? .8 : 1);
        const budget = { hits: new Map<number, number>(), max: feather ? 1 : spread || this.evolved ? 2 : 1 };
        this.facing = { x: Math.cos(angle), y: Math.sin(angle) };
        for (const [index, offset] of angles.entries()) {
            const a = angle + offset * Math.PI / 180;
            this.shots.push({ x: this.x, y: this.y, dx: Math.cos(a), dy: Math.sin(a), left: feather ? 300 : 280,
                hit: [], delay: !feather && !spread && this.evolved ? index * .08 : 0, damage, pierce: feather ? 2 : spread ? 1 : this.branch === 'line' ? 5 : 2, kind, evolved: !feather && this.evolved, budget });
        }
        this.events.push('shot');
    }
    private attacks(dt: number) {
        this.fire -= dt;
        this.auxiliaryFire -= dt;
        const target = this.target(280);
        if (target && this.fire <= 0) {
            this.shoot(target, 'grain');
            this.fire = this.attackInterval;
        }
        if (this.auxiliary === 'bubble' && this.auxiliaryFire <= 0) {
            this.auxiliaryFire = 1.5;
            this.effect(this.x, this.y, 90, 'bubble', .5);
            this.events.push('bubble');
            for (const e of this.enemies)
                if (e.hp > 0 && Math.hypot(e.x - this.x, e.y - this.y) <= 90) {
                    this.hit(e, this.damage * .35);
                    e.slowFor = 1;
                }
        }
        else if (this.auxiliary === 'feather' && this.auxiliaryFire <= 0) {
            const far = this.target(300);
            if (far) {
                this.shoot(far, 'feather');
                this.auxiliaryFire = 1.2;
            }
        }
        for (const s of this.shots) {
            if (s.delay > 0) {
                s.delay -= dt;
                continue;
            }
            const travel = Math.min(s.left, 420 * dt), ax = s.x, ay = s.y;
            s.x += s.dx * travel;
            s.y += s.dy * travel;
            s.left -= travel;
            const hits = this.enemies.filter(e => e.hp > 0 && !s.hit.includes(e.id)).map(e => {
                const t = Math.max(0, Math.min(travel, (e.x - ax) * s.dx + (e.y - ay) * s.dy));
                return { e, t, d: Math.hypot(e.x - ax - s.dx * t, e.y - ay - s.dy * t) };
            }).filter(h => h.d <= (h.e.kind === 'lid' ? 22 : 14)).sort((a, b) => a.t - b.t);
            for (const { e } of hits) {
                s.hit.push(e.id);
                const count = s.budget.hits.get(e.id) || 0;
                if (count < s.budget.max) {
                    this.hit(e, s.damage);
                    s.budget.hits.set(e.id, count + 1);
                }
                if (s.hit.length >= s.pierce) {
                    s.left = 0;
                    break;
                }
            }
        }
        this.shots = this.shots.filter(s => s.left > 0);
    }
    private hurt(cause: string) {
        if (this.immunity > 0 || this.hp <= 0)
            return;
        this.hp--;
        this.immunity = 1;
        this.deathCause = cause;
        this.events.push('hurt');
    }
    private moveEnemies(dt: number) {
        for (const e of this.enemies) {
            if (e.hp <= 0)
                continue;
            if (Math.abs(e.x - this.x) <= this.viewWidth / 2 + 10 && Math.abs(e.y - this.y) <= this.viewHeight / 2 + 10)
                e.visibleFor += dt;
            e.slowFor -= dt;
            let dx = this.x - e.x, dy = this.y - e.y, d = Math.hypot(dx, dy) || 1;
            let speed = e.kind === 'lid' ? 35 : e.kind === 'clip' ? 65 : 60;
            if (e.state === 'chase') {
                e.cooldown -= dt;
                const canWindup = !this.choice && e.visibleFor >= .7 && e.cooldown <= 0;
                if (canWindup && ((e.kind === 'clip' && d < 220) || (e.kind === 'lid' && d < 160))) {
                    e.state = 'windup';
                    e.timer = e.kind === 'lid' ? .9 : .8;
                    e.dx = dx / d;
                    e.dy = dy / d;
                    e.aimX = this.x;
                    e.aimY = this.y;
                    this.events.push('warning');
                    speed = 0;
                }
            }
            else {
                e.timer -= dt;
                if (e.state === 'windup') {
                    speed = 0;
                    if (e.timer <= 0) {
                        if (e.kind === 'lid') {
                            this.effect(e.aimX, e.aimY, 60, 'slam', .35);
                            if (Math.hypot(this.x - e.aimX, this.y - e.aimY) < 72)
                                this.hurt('锅盖怪压盖');
                            e.state = 'recover';
                            e.timer = .8;
                        }
                        else {
                            e.state = 'dash';
                            e.timer = .35;
                        }
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
                        e.cooldown = e.kind === 'lid' ? 5 : 4;
                    }
                }
            }
            if (e.slowFor > 0)
                speed *= .65;
            e.x += dx / d * speed * dt;
            e.y += dy / d * speed * dt;
            if (e.visibleFor >= .7 && Math.hypot(e.x - this.x, e.y - this.y) < (e.kind === 'lid' ? 30 : 22)) {
                this.hurt(e.kind === 'lid' ? '锅盖怪接触' : e.kind === 'clip' ? '夹子怪冲撞 / 接触' : '手套怪接触');
            }
        }
        this.enemies = this.enemies.filter(e => e.hp > 0);
    }
    tick(dt: number, mx: number, my: number) {
        if (this.phase !== 'playing')
            return;
        dt = Math.max(0, Math.min(dt, .05));
        this.time += dt;
        this.immunity -= dt;
        this.noticeFor -= dt;
        const m = Math.hypot(mx, my);
        this.move = m > 0 ? { x: mx / m, y: my / m } : { x: 0, y: 1 };
        if (m > 0) {
            this.x = Math.max(-850, Math.min(850, this.x + this.move.x * 175 * dt));
            this.y = Math.max(-850, Math.min(850, this.y + this.move.y * 175 * dt));
        }
        this.updateChoice();
        if (!this.evolved && this.time >= 120) {
            this.evolved = true;
            this.announce(this.branch === 'spread' ? '进化！五向风暴' : '进化！双脉冲长线', 'evolve');
            this.effect(this.x, this.y, 180, 'evolve', 1);
        }
        if (this.time + 1e-8 >= this.spawnAt) {
            this.wave();
            this.spawnAt += 1 / (this.time < 20 ? 2 : this.time < 50 ? 3 : this.time < 90 ? 4 : this.time < 120 ? 5 : 6);
        }
        this.attacks(dt);
        this.moveEnemies(dt);
        this.drops = this.drops.filter(d => {
            if (Math.hypot(d.x - this.x, d.y - this.y) >= 55)
                return true;
            this.experience(d.value);
            this.events.push('pickup');
            return false;
        });
        this.foods = this.foods.filter(f => {
            if (Math.hypot(f.x - this.x, f.y - this.y) >= 55)
                return true;
            if (this.hp <= 0)
                return true; // Food cannot resurrect a lethal hit from this step.
            if (this.hp < 5) {
                this.hp++;
                this.announce('补给！恢复 1 格生命', 'heal');
            }
            else {
                this.experience(3);
                this.announce('满血补给 +3 经验', 'heal');
            }
            return false;
        });
        this.effects = this.effects.filter(e => (e.life -= dt) > 0);
        if (this.hp <= 0) {
            this.hp = 0;
            this.phase = 'lost';
            this.events.push('end');
        }
        else if (this.time >= this.duration) {
            this.time = this.duration;
            this.phase = 'complete';
            this.events.push('end');
        }
        if (this.events.length > 64)
            this.events = this.events.slice(-64);
    }
}
