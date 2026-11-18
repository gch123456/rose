import {readFileSync, writeFileSync} from 'node:fs';
import {decodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
import {makeReleaseLevel, RELEASE_LEVELS, WIZARD_QUEUE_COUNT} from '../assets/scripts/color-clear/ColorClearRelease.ts';
import {variantData} from '../preview/color-clear/supply-variants.js';
import {wizardFingerprint} from './build-wizard.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const base = read('../preview/color-clear/ready/wizard-level.json');
const shuffles = read('../preview/color-clear/ready/wizard-shuffles.json');
const wizard = RELEASE_LEVELS[1];
if (shuffles.version !== 1 || shuffles.fingerprint !== wizardFingerprint(base.level)
    || shuffles.variants.length !== WIZARD_QUEUE_COUNT || base.palette.join() !== wizard.palette.join()) {
    throw new Error('法师鸭成品数据与发布配置不符');
}
const level = decodeLevel(base);
const layouts = [level, ...shuffles.variants.map(variant => decodeLevel(variantData(base, variant)))];
const tints = [...new Set(level.cells.map(cell => cell.visualTint))];
const cells = level.cells.map((cell, index) => {
    if (!cell.alive || cell.core || cell.shape !== 'box' || cell.id !== index || !cell.visualTint) {
        throw new Error('法师鸭积木无法用发布格式表示');
    }
    return [cell.x, cell.y, cell.z, cell.color, tints.indexOf(cell.visualTint), [undefined, 'eye', 'bill'].indexOf(cell.visualDetail)];
});
const payload = {
    version: 1,
    pose: [level.initialYaw, level.initialPitch],
    tints,
    cells,
    queues: layouts.map(layout => layout.supply.map(lane => lane.map(({id, color, ammo}) => [id, color, ammo]))),
};
makeReleaseLevel(wizard.id, payload);
const json = JSON.stringify(payload) + '\n';
const target = new URL('../assets/resources/color-clear-release/wizard.json', import.meta.url);
if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== json) throw new Error('法师鸭发布资源需要重新构建');
} else {
    writeFileSync(target, json);
}
console.log('Verified five 4500-block clear routes and compact wizard asset (' + Buffer.byteLength(json) + ' bytes)');
