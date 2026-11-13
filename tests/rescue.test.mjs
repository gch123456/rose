import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
    EscapeGame,
    RESCUE_PICKUP_RADIUS,
    RESCUE_INTERVAL,
    RESCUE_MAX_ACTIVE,
    RESCUE_OPENING_COUNT,
    RESCUE_BATCH,
    WIN_RESCUE_BONUS
} from '../assets/scripts/EscapeGame.ts';

const stray = (x, y) => ({x, y, bob: 0});
const bossStub = hp => ({
    id: 999, kind: 'boss', x: 0, y: 300, hp, visibleFor: 1,
    state: 'arrive', timer: 1, cooldown: 0, dx: 0, dy: -1,
    aimX: 0, aimY: 300, slowFor: 0, shots: []
});

test('a run opens with stray ducks waiting around the portal, all inside the arena', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    assert.equal(g.strays.length, RESCUE_OPENING_COUNT);
    assert.equal(g.rescued, 0);
    assert.equal(g.rescueBonus, 0);
    assert.equal(g.totalRescued, 0);
    assert.ok(g.strays.every(d => Math.abs(d.x) <= 820 && Math.abs(d.y) <= 820));
    assert.ok(g.strays.every(d => Math.hypot(d.x, d.y) > RESCUE_PICKUP_RADIUS));
});

test('walking over a stray sends it through the portal and reports a rescue event', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(0, 0)];
    g.tick(.01, 0, 0);
    assert.equal(g.rescued, 1);
    assert.equal(g.totalRescued, 1);
    assert.equal(g.strays.length, 0);
    assert.ok(g.events.includes('rescue'));
    assert.ok(g.effects.some(e => e.kind === 'rescue'));
    // A rescue is not a kill and grants no experience by itself.
    assert.equal(g.kills, 0);
    assert.equal(g.score, 0);
});

test('strays outside the pickup radius stay on the field', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(RESCUE_PICKUP_RADIUS, 0), stray(RESCUE_PICKUP_RADIUS + 10, 0)];
    g.tick(.01, 0, 0);
    assert.equal(g.rescued, 0);
    assert.equal(g.strays.length, 2);
});

test('a new batch arrives on schedule but never exceeds the active cap', () => {
    const g = new EscapeGame(() => .31);
    g.start();
    assert.equal(g.strays.length, RESCUE_OPENING_COUNT);
    g.time = RESCUE_INTERVAL - .001;
    g.tick(.01, 0, 0);
    assert.equal(g.strays.length, RESCUE_OPENING_COUNT + RESCUE_BATCH);
    g.strays = Array.from({length: RESCUE_MAX_ACTIVE}, (_, i) => stray(600 + i * 5, 600));
    g.rescueAt = g.time;
    g.tick(.01, 0, 0);
    assert.equal(g.strays.length, RESCUE_MAX_ACTIVE);
});

test('the boss phase stops new arrivals but leaves existing strays collectible', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(0, 0)];
    g.time = g.bossAt - .005;
    g.rescueAt = g.time + .001;
    g.tick(.02, 0, 0);
    assert.ok(g.time >= g.bossAt);
    assert.equal(g.strays.length, 0); // it was picked up, no new batch spawned
    assert.ok(g.boss);
});

test('winning adds the breakout bonus on top of the ducks actually rescued', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(0, 0), stray(10, 0)];
    g.tick(.01, 0, 0);
    assert.equal(g.rescued, 2);
    g.boss = bossStub(0);
    g.tick(.01, 0, 0);
    assert.equal(g.phase, 'won');
    assert.equal(g.rescueBonus, WIN_RESCUE_BONUS);
    assert.equal(g.totalRescued, 2 + WIN_RESCUE_BONUS);
});

test('losing grants no breakout bonus', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(0, 0)];
    g.tick(.01, 0, 0);
    g.hp = 0;
    g.tick(.01, 0, 0);
    assert.equal(g.phase, 'lost');
    assert.equal(g.rescueBonus, 0);
    assert.equal(g.totalRescued, 1);
});

test('restarting a run clears rescued counts and puts the opening ducks back', () => {
    const g = new EscapeGame(() => .5);
    g.start();
    g.strays = [stray(0, 0)];
    g.tick(.01, 0, 0);
    g.boss = bossStub(0);
    g.tick(.01, 0, 0);
    assert.equal(g.totalRescued, 1 + WIN_RESCUE_BONUS);
    g.start();
    assert.equal(g.rescued, 0);
    assert.equal(g.rescueBonus, 0);
    assert.equal(g.totalRescued, 0);
    assert.equal(g.strays.length, RESCUE_OPENING_COUNT);
    assert.equal(g.boss, null);
});
