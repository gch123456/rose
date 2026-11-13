export type EnemyKind = 'glove' | 'clip' | 'lid' | 'boss';
export type Character = 'shooter' | 'warrior' | 'mage';
export type BranchKey = 'line' | 'spread' | 'wide' | 'heavy' | 'blast' | 'chain';
export type GearKey = BranchKey | 'bubble' | 'feather';
export interface Pursuer {
    id: number;
    kind: EnemyKind;
    x: number;
    y: number;
    hp: number;
    visibleFor: number;
    state: 'chase' | 'windup' | 'dash' | 'recover' | 'arrive' | 'fanwind' | 'fan';
    timer: number;
    cooldown: number;
    dx: number;
    dy: number;
    aimX: number;
    aimY: number;
    slowFor: number;
    shots?: BossShot[];
}
export interface BossShot {
    x: number;
    y: number;
    dx: number;
    dy: number;
    left: number;
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
export interface GameEffect {
    x: number;
    y: number;
    life: number;
    duration: number;
    radius: number;
    kind: string;
    angle?: number;
}
// ── 传送阵救援 ──────────────────────────────────────────────
// 待救小鸭是拾取物而非护送对象：走过去即经出生点传送阵撤离，
// 不改变「移动输入＋自动攻击」的核心循环，也不引入护送血条。
export const RESCUE_PICKUP_RADIUS = 55;
export const RESCUE_BATCH = 2;
export const RESCUE_INTERVAL = 9;
export const RESCUE_MAX_ACTIVE = 8;
export const RESCUE_OPENING_COUNT = 3;
export const WIN_RESCUE_BONUS = 12;
export interface StrayDuck {
    x: number;
    y: number;
    bob: number;
}
export class EscapeGame {
    readonly duration = 150;
    readonly bossAt = 150;
    readonly limit = 180;
    character: Character = 'shooter';
    phase = 'menu';
    time = 0;
    hp = 5;
    level = 1;
    xp = 0;
    kills = 0;
    score = 0;
    strays: StrayDuck[] = [];
    rescued = 0;
    rescueBonus = 0;
    x = 0;
    y = 0;
    branch: 'base' | BranchKey = 'base';
    auxiliary: 'none' | 'bubble' | 'feather' = 'none';
    evolved = false;
    boss: Pursuer | null = null;
    bossNext: 'dash' | 'fan' = 'dash';
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
    effects: GameEffect[] = [];
    events: string[] = [];
    deathCause = '';
    facing = { x: 0, y: 1 };
    notice = '';
    noticeFor = 0;
    private serial = 0;
    private spawnAt = 1;
    private rescueAt = RESCUE_INTERVAL;
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
    get totalRescued() {
        return this.rescued + this.rescueBonus;
    }
    get nextXp() {
        return 10 + 4 * (this.level - 1);
    }
    private get baseDamage() {
        return this.character === 'warrior' ? 18 : 12;
    }
    private get baseInterval() {
        return this.character === 'warrior' ? .75 : this.character === 'mage' ? .9 : .55;
    }
    get damage() {
        return this.baseDamage * (1 + .08 * (this.level - 1));
    }
    get attackInterval() {
        let interval = this.baseInterval / (1 + .04 * Math.floor(this.level / 2));
        if (this.character === 'warrior' && this.branch === 'heavy')
            interval *= 1.3;
        return interval;
    }
    get attackRange() {
        return this.character === 'warrior' ? (this.branch === 'heavy' ? 125 : 100) : this.character === 'mage' ? 260 : 280;
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
        this.boss = null;
        this.bossNext = 'dash';
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
        this.strays = [];
        this.rescued = 0;
        this.rescueBonus = 0;
        this.rescueAt = RESCUE_INTERVAL;
        this.spawnStrays(RESCUE_OPENING_COUNT, true);
    }
    // Spawn stray ducks around the player (or around the portal at run start).
    // They stay inside the arena and are capped so they never pile up.
    private spawnStrays(count: number, nearPortal = false) {
        const cx = nearPortal ? 0 : this.x, cy = nearPortal ? 0 : this.y;
        for (let i = 0; i < count && this.strays.length < RESCUE_MAX_ACTIVE; i++) {
            const a = this.random() * Math.PI * 2;
            const r = nearPortal ? 95 + this.random() * 90 : 170 + this.random() * 190;
            this.strays.push({
                x: Math.max(-820, Math.min(820, cx + Math.cos(a) * r)),
                y: Math.max(-820, Math.min(820, cy + Math.sin(a) * r)),
                bob: this.random() * Math.PI * 2
            });
        }
    }
    private announce(message: string, event: string) {
        this.notice = message;
        this.noticeFor = 2.5;
        this.events.push(event);
    }
    private effect(x: number, y: number, radius: number, kind: string, life = .35): GameEffect {
        const entry: GameEffect = { x, y, radius, kind, life, duration: life };
        this.effects.push(entry);
        return entry;
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
        if (e.kind === 'boss') {
            if (e.state === 'arrive')
                return; // Arrival preview cannot be damaged.
            e.hp -= damage;
            this.events.push('hit');
            this.effect(e.x, e.y, 24, 'hit', .18);
            return; // No drops, no pursuer kill count; judgment happens at end of step.
        }
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
            this.branch = key as BranchKey;
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
        const names = { line: '长线穿透', spread: '三向散射', wide: '宽斩 · 大范围清群', heavy: '重斩 · 高伤窄角', blast: '爆裂 · 大水花', chain: '连锁 · 跳两目标', bubble: '泡泡圈 · 范围减速', feather: '飞羽 · 远程补刀' };
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
            const fallback: GearKey = c.kind === 'branch' ? this.character === 'warrior' ? 'wide' : this.character === 'mage' ? 'blast' : 'line' : 'bubble';
            this.resolveChoice(fallback, 'timeout');
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
                const keys: GearKey[] = c.kind === 'branch' ? this.character === 'warrior' ? ['wide', 'heavy'] : this.character === 'mage' ? ['blast', 'chain'] : ['line', 'spread'] : ['bubble', 'feather'];
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
    private hittable(): Pursuer[] {
        const list = this.enemies.filter(e => e.hp > 0);
        if (this.boss && this.boss.hp > 0 && this.boss.state !== 'arrive')
            list.push(this.boss);
        return list;
    }
    private target(range: number) {
        return this.hittable().filter(e => Math.hypot(e.x - this.x, e.y - this.y) <= range)
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
        if (this.character === 'warrior')
            this.warriorAttack();
        else if (this.character === 'mage')
            this.mageAttack();
        else {
            const target = this.target(280);
            if (target && this.fire <= 0) {
                this.shoot(target, 'grain');
                this.fire = this.attackInterval;
            }
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
            const hits = this.hittable().filter(e => !s.hit.includes(e.id)).map(e => {
                const t = Math.max(0, Math.min(travel, (e.x - ax) * s.dx + (e.y - ay) * s.dy));
                return { e, t, d: Math.hypot(e.x - ax - s.dx * t, e.y - ay - s.dy * t) };
            }).filter(h => h.d <= (h.e.kind === 'boss' ? 32 : h.e.kind === 'lid' ? 22 : 14)).sort((a, b) => a.t - b.t);
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
    private warriorAttack() {
        if (this.fire > 0)
            return;
        const range = this.branch === 'heavy' ? 125 : 100;
        const target = this.target(range);
        if (!target)
            return;
        const aim = Math.atan2(target.y - this.y, target.x - this.x);
        this.facing = { x: Math.cos(aim), y: Math.sin(aim) };
        this.fire = this.attackInterval;
        this.events.push('shot');
        if (this.branch === 'wide' && this.evolved) {
            // Evolved wide: two-layer full-circle arc, each enemy takes the budget-capped 1.6D exactly once.
            for (const e of this.hittable())
                if (Math.hypot(e.x - this.x, e.y - this.y) <= range)
                    this.hit(e, this.damage * 1.6);
            this.effect(this.x, this.y, range, 'slash', .25).angle = Math.PI;
            return;
        }
        // Half-arcs: heavy 90°, base 120°, wide 220°.
        const half = this.branch === 'heavy' ? Math.PI / 4 : this.branch === 'wide' ? 11 * Math.PI / 18 : Math.PI / 3;
        const slashed = new Set<number>();
        for (const e of this.hittable()) {
            const diff = Math.atan2(e.y - this.y, e.x - this.x) - aim;
            const da = Math.atan2(Math.sin(diff), Math.cos(diff));
            if (Math.hypot(e.x - this.x, e.y - this.y) <= range && Math.abs(da) <= half) {
                slashed.add(e.id);
                this.hit(e, this.damage * (this.branch === 'heavy' ? 1.6 : 1));
            }
        }
        if (this.branch === 'heavy' && this.evolved)
            // The extension shockwave only reaches enemies the slash did not already cover.
            for (const e of this.hittable())
                if (!slashed.has(e.id) && Math.hypot(e.x - this.x, e.y - this.y) <= 165)
                    this.hit(e, this.damage * .96);
        this.effect(this.x, this.y, range, 'slash', .25).angle = half;
    }
    private mageAttack() {
        if (this.fire > 0)
            return;
        const target = this.target(260);
        if (!target)
            return;
        this.facing = { x: Math.cos(Math.atan2(target.y - this.y, target.x - this.x)), y: Math.sin(Math.atan2(target.y - this.y, target.x - this.x)) };
        this.fire = this.attackInterval;
        this.events.push('shot');
        const bx = target.x, by = target.y;
        const byDistance = (a: Pursuer, b: Pursuer) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by);
        if (this.branch === 'chain') {
            // Chain: the bubble pops inside 50, then jumps outward to unhit enemies at .8D each.
            const popped = new Set<number>();
            for (const e of this.hittable().filter(e => Math.hypot(e.x - bx, e.y - by) <= 50).sort(byDistance)) {
                popped.add(e.id);
                this.hit(e, this.damage * (this.evolved ? 1.6 : 1));
            }
            let jumps = 0;
            for (const e of this.hittable().filter(e => !popped.has(e.id) && Math.hypot(e.x - bx, e.y - by) <= 100).sort(byDistance)) {
                if (jumps >= (this.evolved ? 4 : 2))
                    break;
                popped.add(e.id);
                jumps++;
                this.hit(e, this.damage * .8);
            }
            this.effect(bx, by, 50, 'burst', .3);
            return;
        }
        // Blast: every enemy inside the burst radius takes one hit per burst, 1.6D when evolved.
        const radius = this.evolved ? 105 : 65;
        for (const e of this.hittable().filter(e => Math.hypot(e.x - bx, e.y - by) <= radius).sort(byDistance))
            this.hit(e, this.damage * (this.evolved ? 1.6 : 1));
        this.effect(bx, by, radius, 'burst', .3);
    }
    private hurt(cause: string, hearts = 1) {
        if (this.immunity > 0 || this.hp <= 0)
            return;
        this.hp -= hearts;
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
    private spawnBoss(): Pursuer {
        const candidates: { x: number; y: number }[] = [];
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            candidates.push({ x: this.x + Math.cos(a) * 200, y: this.y + Math.sin(a) * 200 });
        }
        const inside = candidates.filter(c => Math.abs(c.x) <= 780 && Math.abs(c.y) <= 780);
        // Prefer a visible point above the player; fall back to any in-bounds candidate, then a clamped point.
        const pick = inside.find(c => c.y > this.y) || inside[0]
            || { x: Math.max(-780, Math.min(780, this.x)), y: Math.max(-780, Math.min(780, this.y + 200)) };
        return { id: ++this.serial, kind: 'boss', x: pick.x, y: pick.y, hp: 900, visibleFor: 1,
            state: 'arrive', timer: 1, cooldown: 0, dx: 0, dy: -1, aimX: pick.x, aimY: pick.y, slowFor: 0, shots: [] };
    }
    private startBossMove(b: Pursuer) {
        const a = Math.atan2(this.y - b.y, this.x - b.x);
        b.dx = Math.cos(a);
        b.dy = Math.sin(a);
        b.state = this.bossNext === 'dash' ? 'windup' : 'fanwind';
        b.timer = this.bossNext === 'dash' ? .9 : .8;
        this.events.push('warning');
    }
    private updateBoss(dt: number) {
        const b = this.boss!;
        b.timer -= dt;
        if (b.state === 'arrive') {
            if (b.timer <= 0)
                this.startBossMove(b);
            return;
        }
        if (b.state === 'windup') {
            // Stationary telegraph; direction was locked when the windup started.
            if (b.timer <= 0) {
                b.state = 'dash';
                b.timer = .45;
            }
            return;
        }
        if (b.state === 'dash') {
            const nx = b.x + b.dx * 420 * dt, ny = b.y + b.dy * 420 * dt;
            b.x = Math.max(-850, Math.min(850, nx));
            b.y = Math.max(-850, Math.min(850, ny));
            if (Math.hypot(this.x - b.x, this.y - b.y) < 44)
                this.hurt('Boss冲撞', 2);
            if (b.timer <= 0 || b.x !== nx || b.y !== ny) {
                b.state = 'recover';
                b.timer = 1.2;
                this.bossNext = 'fan';
            }
            return;
        }
        if (b.state === 'fanwind') {
            if (b.timer <= 0) {
                const base = Math.atan2(b.dy, b.dx);
                for (const offset of [-25, 0, 25]) {
                    const a = base + offset * Math.PI / 180;
                    b.shots!.push({ x: b.x, y: b.y, dx: Math.cos(a), dy: Math.sin(a), left: 450 });
                }
                b.state = 'fan';
                b.timer = 2.2;
            }
            return;
        }
        if (b.state === 'fan') {
            // Boss holds position through the full 2.2s attack phase even if shells die early.
            const kept: BossShot[] = [];
            for (const s of b.shots!) {
                s.x += s.dx * 150 * dt;
                s.y += s.dy * 150 * dt;
                s.left -= 150 * dt;
                if (s.left <= 0 || Math.abs(s.x) > 850 || Math.abs(s.y) > 850)
                    continue;
                if (Math.hypot(s.x - this.x, s.y - this.y) < 20) {
                    this.hurt('Boss弹丸');
                    continue;
                }
                kept.push(s);
            }
            b.shots = kept;
            if (b.timer <= 0) {
                b.shots = [];
                b.state = 'recover';
                b.timer = 1.2;
                this.bossNext = 'dash';
            }
            return;
        }
        if (b.timer <= 0)
            this.startBossMove(b); // recover window: stationary, hittable, no attacks
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
            const names: Record<Character, Record<string, string>> = {
                shooter: { spread: '进化！五向风暴', line: '进化！双脉冲长线' },
                warrior: { wide: '进化！全周宽斩', heavy: '进化！重斩震波' },
                mage: { blast: '进化！大爆裂水花', chain: '进化！四段连锁' }
            };
            this.announce(names[this.character][this.branch] || '进化！武器强化', 'evolve');
            this.effect(this.x, this.y, 180, 'evolve', 1);
        }
        if (this.time + 1e-8 >= this.spawnAt && this.time < this.bossAt) {
            this.wave();
            this.spawnAt += 1 / (this.time < 20 ? 2 : this.time < 50 ? 3 : this.time < 90 ? 4 : this.time < 120 ? 5 : 6);
        }
        // Boss phase stops new arrivals; strays already on the field remain collectible.
        if (this.time + 1e-8 >= this.rescueAt && this.time < this.bossAt) {
            this.spawnStrays(RESCUE_BATCH);
            this.rescueAt += RESCUE_INTERVAL;
        }
        this.attacks(dt);
        this.moveEnemies(dt);
        if (!this.boss && this.time >= this.bossAt) {
            // Existing damage/kills of this step already settled above; survivors retire without rewards.
            this.enemies = [];
            this.choice = null;
            this.boss = this.spawnBoss();
            this.announce('出口出现巨型捕鸭夹！', 'boss');
        }
        if (this.boss)
            this.updateBoss(dt);
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
        this.strays = this.strays.filter(d => {
            if (Math.hypot(d.x - this.x, d.y - this.y) >= RESCUE_PICKUP_RADIUS)
                return true;
            this.rescued++;
            this.events.push('rescue');
            this.effect(d.x, d.y, 72, 'rescue', .5);
            return false;
        });
        this.effects = this.effects.filter(e => (e.life -= dt) > 0);
        // Judgement order: a lethal player hit wins over the boss dying; victory beats the countdown.
        if (this.hp <= 0) {
            this.hp = 0;
            this.phase = 'lost';
            this.events.push('end');
        }
        else if (this.boss && this.boss.hp <= 0) {
            this.phase = 'won';
            this.rescueBonus = WIN_RESCUE_BONUS;
            this.events.push('end');
        }
        else if (this.time >= this.limit) {
            this.time = this.limit;
            this.deathCause = '出口被封锁';
            this.phase = 'lost';
            this.events.push('end');
        }
        if (this.events.length > 64)
            this.events = this.events.slice(-64);
    }
}
