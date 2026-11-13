import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    SurvivorGame, MOW_UPGRADES, MOW_BOSS_AT, MOW_LIMIT, MOW_ENEMY_CAP,
    MOW_DUCK_CAP, MOW_DUCK_RADIUS, MOW_WIN_BONUS, MOW_WAVE_STEP,
} from '../assets/scripts/SurvivorGame.ts';

const fixed = (v = .5) => () => v;
const advance = (g, seconds, mx = 0, my = 0) => {
    for (let i = 0; i < Math.round(seconds * 60); i++)
        g.tick(1 / 60, mx, my);
};
const granted = g => Object.values(g.upgrades).reduce((a, b) => a + b, 0);

test('start clears every run field and puts three ducks around the portal', () => {
    const g = new SurvivorGame(fixed());
    g.start('shooter');
    assert.equal(g.phase, 'playing');
    assert.equal(g.time, 0);
    assert.equal(g.hp, 6);
    assert.equal(g.level, 1);
    assert.equal(g.kills, 0);
    assert.equal(g.totalRescued, 0);
    assert.equal(g.boss, null);
    assert.equal(g.ducks.length, 3);
    assert.ok(g.ducks.every(d => Math.hypot(d.x, d.y) > MOW_DUCK_RADIUS));
    assert.ok(g.ducks.every(d => Math.abs(d.x) <= 820 && Math.abs(d.y) <= 820));
});

test('restart wipes upgrades, toasts, horde and rescue counts', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    g.upgrades.blades = 3;
    g.rescued = 7;
    g.freed = 9;
    g.upgradeToasts.push({ id: 'blades', icon: '剑', name: '万剑诀', level: 2, life: 2, duration: 2 });
    g.enemies.push({ id: 99, kind: 'grunt', x: 0, y: 0, hp: 5, maxHp: 5, radius: 15, speed: 0, flash: 0, wobble: 0, dead: false });
    g.start('mage');
    assert.equal(g.character, 'mage');
    assert.equal(g.upgrades.blades, undefined);
    assert.equal(g.upgradeToasts.length, 0);
    assert.equal(g.enemies.length, 0);
    assert.equal(g.totalRescued, 0);
    assert.equal(g.ducks.length, 3);
});

test('the opening seconds already mow down enemies with an automatic sword volley', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    advance(g, 1.6);
    assert.ok(g.kills > 0, 'auto attack should produce kills in the opening seconds');
    assert.ok(g.swords.length + g.kills > 0);
    assert.ok(g.gems.length > 0, 'kills drop soul gems');
});

test('horde density scales with time and stays under the hard cap', () => {
    const g = new SurvivorGame(fixed(.31));
    g.start();
    advance(g, 12);
    assert.ok(g.enemies.length > 0);
    for (let i = 0; i < 600; i++) {
        g.tick(.05, 0, 0);
        assert.ok(g.enemies.length <= MOW_ENEMY_CAP);
    }
});

test('wave calls add a burst of enemies and advance the wave counter', () => {
    const g = new SurvivorGame(fixed(.37));
    g.start();
    g.time = MOW_WAVE_STEP - .001;
    const before = g.enemies.length;
    g.tick(.02, 0, 0);
    assert.equal(g.wave, 2);
    assert.ok(g.enemies.length > before);
    assert.ok(g.events.includes('wave'));
});

// ── 升级：不弹窗、不冻结、不要求玩家做选择 ────────────────────────
test('gaining experience grants an upgrade automatically while the world keeps running', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    const t = g.time;
    g.experience(8);
    advance(g, .3);
    assert.ok(g.time > t + .25, 'the clock must never freeze for an upgrade');
    assert.equal(g.level, 2);
    assert.equal(granted(g), 1, 'one level grants exactly one upgrade');
    assert.ok(g.upgradeToasts.length >= 1, 'a toast announces what was gained');
    assert.equal(g.pendingChoice, undefined, 'there is no choice state left to stop the game');
    assert.ok(g.enemies.length > 0, 'the horde keeps spawning during the upgrade');
});

test('applyUpgrade stacks levels, respects max and caps the toast pool', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    assert.equal(g.applyUpgrade('blades'), true);
    assert.equal(g.upgrades.blades, 1);
    assert.equal(g.applyUpgrade('blades'), true);
    assert.equal(g.upgrades.blades, 2);
    assert.equal(g.applyUpgrade('no-such-upgrade'), false);
    for (let i = 0; i < 10; i++)
        g.applyUpgrade('boots');
    assert.equal(g.upgrades.boots, 4, 'max level must be respected');
    assert.equal(g.applyUpgrade('boots'), false);
    assert.ok(g.upgradeToasts.length <= 3, 'toast pool is capped at three');
});

test('a large experience gain delivers every level-up over time instead of swallowing them', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    g.experience(100);
    const levels = g.level - 1;
    assert.ok(levels >= 3);
    advance(g, 3);
    assert.ok(granted(g) >= levels, `expected at least ${levels} upgrades, got ${granted(g)}`);
    assert.ok(g.time > 2.9, 'no popup ever freezes the run');
});

test('upgrade toasts expire cleanly and never block the run', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    g.experience(8);
    advance(g, .1);
    assert.ok(g.upgradeToasts.length > 0);
    g.upgradeToasts.forEach(t => { t.life = .01; });
    g.tick(.05, 0, 0);
    assert.equal(g.upgradeToasts.length, 0);
    assert.equal(g.phase, 'playing');
});

test('auto upgrades only ever come from the catalog and never exceed max', () => {
    const g = new SurvivorGame();
    g.start();
    for (let i = 0; i < 80; i++)
        g.applyUpgrade(MOW_UPGRADES[i % MOW_UPGRADES.length].id);
    for (const u of MOW_UPGRADES)
        assert.ok((g.upgrades[u.id] || 0) <= u.max, `${u.id} exceeded its max level`);
});

test('spirit grants experience without recursing or stalling the clock', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    assert.equal(g.applyUpgrade('spirit'), true);
    const t = g.time;
    advance(g, 1);
    assert.ok(g.time > t + .9);
    assert.ok(g.level >= 2);
});

test('vigor raises max health and heals, snack only heals', () => {
    const g = new SurvivorGame(fixed(.21));
    g.start();
    g.hp = 2;
    assert.equal(g.applyUpgrade('vigor'), true);
    assert.equal(g.maxHp, 7);
    assert.equal(g.hp, 3);
    g.hp = 2;
    assert.equal(g.applyUpgrade('snack'), true);
    assert.equal(g.maxHp, 7);
    assert.equal(g.hp, 3);
});

test('walking over a stray duck sends it through the portal with a rescue event', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    g.ducks = [{ x: 0, y: 0, bob: 0 }];
    g.tick(.01, 0, 0);
    assert.equal(g.rescued, 1);
    assert.equal(g.totalRescued, 1);
    assert.equal(g.ducks.length, 0);
    assert.ok(g.events.includes('rescue'));
    assert.ok(g.floats.some(f => f.kind === 'rescue'));
    assert.equal(g.kills, 0, 'a rescue is not a kill and grants no experience');
});

test('ducks outside the pickup radius stay, and the active count is capped', () => {
    const g = new SurvivorGame(fixed(.31));
    g.start();
    g.ducks = [{ x: MOW_DUCK_RADIUS + 5, y: 0, bob: 0 }, { x: 0, y: MOW_DUCK_RADIUS + 5, bob: 0 }];
    g.tick(.01, 0, 0);
    assert.equal(g.ducks.length, 2);
    g.ducks = Array.from({ length: MOW_DUCK_CAP }, (_, i) => ({ x: 700 + i, y: 700, bob: 0 }));
    g.duckAt = g.time;
    g.tick(.01, 0, 0);
    assert.equal(g.ducks.length, MOW_DUCK_CAP);
});

test('kills free ducks automatically: the more you mow, the more you save', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    assert.equal(g.killsPerDuck, 8);
    g.kills = 23;
    g.freed = Math.floor(g.kills / g.killsPerDuck);
    assert.equal(g.freed, 2);
    g.upgrades.mercy = 4;
    assert.equal(g.killsPerDuck, 4);
    g.freed = Math.floor(g.kills / g.killsPerDuck);
    assert.equal(g.freed, 5);
    assert.equal(g.totalRescued, 5);
});

test('upgrade levels feed the weapon stats and the six-slot skill bar', () => {
    const g = new SurvivorGame(fixed());
    g.start('shooter');
    const blades = g.bladeCount, interval = g.bladeInterval, damage = g.bladeDamage;
    g.upgrades.blades = 2;
    g.upgrades.haste = 2;
    g.upgrades.edge = 2;
    g.upgrades.orbit = 2;
    assert.equal(g.bladeCount, blades + 4);
    assert.ok(g.bladeInterval < interval);
    assert.ok(g.bladeDamage > damage);
    assert.equal(g.orbitCount, 3);
    assert.equal(g.skillLevels.length, 6);
    assert.equal(g.skillLevels[0].icon, '剑');
});

test('the boss arrives on schedule and defeating it wins with a rescue bonus', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    g.time = MOW_BOSS_AT - .005;
    g.tick(.02, 0, 0);
    assert.ok(g.boss);
    assert.equal(g.boss.state, 'arrive');
    g.ducks = [];
    g.rescued = 3;
    g.boss.hp = 0;
    g.tick(.01, 0, 0);
    assert.equal(g.phase, 'won');
    assert.equal(g.rescueBonus, MOW_WIN_BONUS);
    assert.equal(g.totalRescued, 3 + g.freed + MOW_WIN_BONUS);
    assert.ok(g.events.includes('end'));
});

test('losing or timing out grants no breakout bonus', () => {
    const g = new SurvivorGame(fixed());
    g.start();
    g.hp = 0;
    g.tick(.01, 0, 0);
    assert.equal(g.phase, 'lost');
    assert.equal(g.rescueBonus, 0);
    const h = new SurvivorGame(fixed());
    h.start();
    h.time = MOW_LIMIT - .005;
    h.tick(.02, 0, 0);
    assert.equal(h.phase, 'lost');
    assert.equal(h.deathCause, '出口被封锁');
});

test('a long deterministic run stays finite: no NaN, bounded arrays, sensible kill count', () => {
    const g = new SurvivorGame(fixed(.43));
    g.start();
    for (let i = 0; i < 1200; i++) {
        g.tick(.05, Math.sin(i / 37), Math.cos(i / 53));
        if (g.phase !== 'playing')
            break;
        assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y));
        assert.ok(g.floats.length <= 60);
        assert.ok(g.particles.length <= 240);
        assert.ok(g.effects.length <= 70);
        assert.ok(g.upgradeToasts.length <= 3);
        assert.ok(g.enemies.length <= MOW_ENEMY_CAP);
    }
    assert.ok(g.kills > 20, 'a full run should feel like mowing, not plinking');
    assert.ok(g.level > 1);
});
