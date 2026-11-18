import {makeRaincoatDuck, RAINCOAT_DUCK_ID, WIZARD_RESCUE_ID, RAINCOAT_PALETTE} from '../../assets/scripts/color-clear/ColorClearStarter.ts';
import wizard from './ready/wizard-level.json';
import shuffles from './ready/wizard-shuffles.json';
import {variantData} from './supply-variants.js';

export const RESCUES = [
    {id: RAINCOAT_DUCK_ID, name: '雨衣鸭', tier: 'warmup', palette: RAINCOAT_PALETTE,
        colors: ['薄荷绿', '暖黄', '珊瑚橙']},
    {id: WIZARD_RESCUE_ID, name: '法师鸭', tier: 'challenge', palette: wizard.palette,
        colors: ['羽白', '深蓝', '冰蓝', '亮金', '木棕', '墨灰']},
];
export const RESCUE_COUNT = RESCUES.length;
export const CAMPAIGN_PROGRESS_KEY = 'campaign.unlocked.v1';
export const WIZARD_QUEUE_COUNT = shuffles.variants.length;

let starter;
export function makeCampaignLevel(order, variant = -1) {
    if (order !== 2) return starter ??= makeRaincoatDuck();
    // The build verifies each shipped queue against the original wizard model.
    const level = (shuffles.variants[variant] ? variantData(wizard, shuffles.variants[variant]) : wizard).level;
    return {...level, id: WIZARD_RESCUE_ID};
}

export function campaignModel(id) {
    const index = RESCUES.findIndex(rescue => rescue.id === id);
    if (index < 0) throw new Error('未发布的救援模型');
    return {level: makeCampaignLevel(index + 1), palette: RESCUES[index].palette};
}

export function normalizeRescueOrder(value) {
    return Math.max(1, Math.min(RESCUE_COUNT, Math.floor(Number(value)) || 1));
}
