import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, persist, regenAttempts, spendAttempt, grantAdBonus, MAX_ATTEMPTS, REGEN_MS, AD_BONUS } from '../assets/scripts/SaveData.ts';

const MIN = 60_000;
// regen keeps whole periods and preserves the remainder, so progress is never lost.
test('a fresh save starts full and regen does nothing while full', () => {
    const s = defaultSave();
    assert.equal(s.version, 2);
    assert.equal(s.attempts, MAX_ATTEMPTS);
    assert.equal(MAX_ATTEMPTS, 5);
    assert.equal(REGEN_MS, 10 * MIN);
    assert.equal(AD_BONUS, 2);
    const r = regenAttempts(s, s.attemptUpdatedAt + REGEN_MS * 3);
    assert.equal(r.attempts, MAX_ATTEMPTS, 'full attempts stay capped');
    assert.equal(r.attemptUpdatedAt, s.attemptUpdatedAt + REGEN_MS * 3, 'full clock rolls to now');
});
test('spending one attempt works and starts the regen clock', () => {
    const s = defaultSave();
    const spent = spendAttempt(s, 1000);
    assert.ok(spent.ok);
    assert.equal(spent.save.attempts, 4);
    assert.equal(spent.save.attemptUpdatedAt, 1000);
    const spent2 = spendAttempt(spent.save, 2000);
    assert.equal(spent2.save.attempts, 3);
});
test('a save with zero attempts refuses to start', () => {
    const s = { ...defaultSave(), attempts: 0, attemptUpdatedAt: 1000 };
    const r = spendAttempt(s, 2000);
    assert.equal(r.ok, false);
    assert.equal(r.save.attempts, 0, 'no attempt is deducted');
});
test('ten minutes offline restore exactly one attempt and keep the remainder', () => {
    const s = { ...defaultSave(), attempts: 2, attemptUpdatedAt: 0 };
    const r = regenAttempts(s, REGEN_MS + 4 * MIN);
    assert.equal(r.attempts, 3);
    assert.equal(r.attemptUpdatedAt, REGEN_MS, 'clock advances by whole periods only');
    const r2 = regenAttempts(r, r.attemptUpdatedAt + REGEN_MS * 2);
    assert.equal(r2.attempts, 5, 'multiple periods restore multiple attempts');
});
test('regen never exceeds the cap even after hours away', () => {
    const s = { ...defaultSave(), attempts: 1, attemptUpdatedAt: 0 };
    const r = regenAttempts(s, REGEN_MS * 100);
    assert.equal(r.attempts, MAX_ATTEMPTS);
    assert.equal(r.attemptUpdatedAt, REGEN_MS * 100, 'capped clock rolls to now');
});
test('the ad placeholder grants two bonus attempts above the cap', () => {
    const s = defaultSave();
    const r = grantAdBonus(s, s.attemptUpdatedAt + 1000);
    assert.equal(r.attempts, MAX_ATTEMPTS + AD_BONUS, 'bonus can exceed the cap');
    const low = { ...defaultSave(), attempts: 2, attemptUpdatedAt: 0 };
    const r2 = grantAdBonus(low, REGEN_MS);
    assert.equal(r2.attempts, 3 + AD_BONUS, 'regen applies before the bonus');
});
test('a legacy v1 save migrates to v2 with full attempts', () => {
    const v1 = { version: 1, wins: { shooter: true, warrior: false, mage: false }, unlocked: ['shooter', 'warrior'], current: 'warrior' };
    const s = loadSave(JSON.stringify(v1));
    assert.equal(s.version, 2);
    assert.deepEqual(s.unlocked, ['shooter', 'warrior']);
    assert.equal(s.current, 'warrior');
    assert.equal(s.attempts, MAX_ATTEMPTS, 'migrating players start full');
    assert.ok(typeof s.attemptUpdatedAt === 'number');
});
test('corrupt saves still fall back to a full default v2 save', () => {
    for (const raw of [null, '', 'not json', '{"version":99}']) {
        const s = loadSave(raw);
        assert.equal(s.version, 2, String(raw));
        assert.equal(s.attempts, MAX_ATTEMPTS);
        assert.deepEqual(s.unlocked, ['shooter']);
    }
});
test('attempts round-trip through persist and loadSave', () => {
    let stored = null;
    const write = (k, v) => { stored = v; };
    const s = spendAttempt(defaultSave(), 500).save;
    persist(s, write);
    const loaded = loadSave(stored);
    assert.equal(loaded.attempts, 4);
    assert.equal(loaded.attemptUpdatedAt, 500);
});
