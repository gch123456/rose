import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { makeRaincoatDuck } from '../assets/scripts/color-clear/ColorClearStarter.ts';

const root = process.env.PREVIEW_URL || 'http://127.0.0.1:4179/preview';
const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        localStorage.setItem('color-clear.unlocked', '10');
    });
    await page.goto(root + '/color-clear.html?autospin=0&level=2');
    const starter = makeRaincoatDuck();
    const snapshot = () => page.evaluate(() => window.__colorClear.snapshot());
    assert.equal((await snapshot()).level, 11, 'legacy unlocks do not bypass the new starter');
    await page.screenshot({ path: '/tmp/rose-raincoat-rescue.png' });
    for (const [index, { column }] of starter.solution.entries()) {
        await page.locator('#supply [data-column="' + column + '"]').tap();
        try {
            await page.waitForFunction(() => window.__colorClear.snapshot().slots.every(slot => !slot), null, {timeout: 25000});
        } catch (error) {
            console.error('Starter replay stalled at tube', index, await snapshot());
            throw error;
        }
    }
    await page.waitForFunction(() => window.__colorClear.snapshot().phase === 'won');
    assert.equal((await snapshot()).shots, starter.cells.length);
    await page.locator('#primary').tap();
    await page.waitForFunction(() => window.__colorClear.snapshot().level === 12);
    assert.equal((await snapshot()).remaining, 4500);
    assert.equal((await snapshot()).rescueTier, 'challenge');
    await page.goto(root + '/duck-camp.html');
    if (await page.locator('#daily-close').isVisible()) await page.locator('#daily-close').tap();
    await page.locator('[data-open-album]').tap();
    assert.match(await page.locator('#album-count').innerText(), /1 \/ 2/);
    assert.equal(await page.locator('#album-grid > .album-card').count(), 2);
    assert.equal(await page.locator('#album-grid > .album-card.locked .locked-mark').innerText(), '?');
    await page.locator('#album-grid img').waitFor();
    await page.waitForFunction(() => document.querySelector('#album-grid img')?.naturalWidth > 0);
    await page.screenshot({ path: '/tmp/rose-curated-album.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: legacy progress isolation, complete raincoat rescue through touch, wizard unlock, flat album.');
} finally {
    await browser.close();
}
