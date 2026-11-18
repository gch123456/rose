import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const root = process.env.PREVIEW_URL || 'http://127.0.0.1:4179/preview';
    for (const [tier, min, max] of [['warmup', 0, 0], ['planning', 1, 2], ['challenge', 2, 4]]) {
        await page.goto(root + '/wizard-duck.html');
        await page.waitForFunction(() => window.__readyModel?.ready);
        await page.locator('#difficulty').selectOption(tier);
        await page.locator('#play').click();
        await page.waitForFunction(value => window.__colorClear?.snapshot().rescueTier === value, tier);
        const masks = await page.locator('#supply > .mystery-card').count();
        assert.ok(masks >= min && masks <= max);
        assert.equal(await page.locator('#supply > :nth-child(-n+8).mystery-card').count(), 0);
        if (masks > 0) {
            const firstHidden = await page.locator('#supply > .mystery-card').first().evaluate(node =>
                Array.from(node.parentElement.children).indexOf(node));
            const column = firstHidden % 4;
            const row = Math.floor(firstHidden / 4);
            for (let i = 0; i < row - 1; i++) await page.locator('#supply > button[data-column="' + column + '"]').tap();
            const revealed = await page.locator('#supply > :nth-child(' + (5 + column) + ') strong').textContent();
            assert.match(revealed, /^\d+$/);
        }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: wizard difficulty selection, mystery count bounds, and second-row reveal.');
} finally {
    await browser.close();
}
