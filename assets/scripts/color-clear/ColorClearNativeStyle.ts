import type {Voxel} from './ColorClearGame.ts';

export const RESCUE_STAGE = {left: -300, right: 300, bottom: -114, top: 448, modelY: 162};

type ScreenRect = { x: number; y: number; width: number; height: number };

export function fitRescueScreen(safe: ScreenRect): {x: number; y: number; scale: number} {
    // Safe-area coordinates use the design resolution's lower-left origin.
    return {
        x: safe.x + safe.width / 2 - 320,
        y: safe.y + safe.height / 2 - 560,
        scale: Math.min(1, (safe.width - 12) / 622, (safe.height - 20) / 1100),
    };
}

const channel = (hex: string, index: number): number => parseInt(hex.slice(index, index + 2), 16);

export function mixRescueColors(base: string, tint: string, amount: number): string {
    return '#' + [1, 3, 5].map(index => {
        const from = channel(base, index);
        return Math.round(from + (channel(tint, index) - from) * amount).toString(16).padStart(2, '0');
    }).join('');
}

export function rescueBlockTint(voxel: Pick<Voxel, 'color' | 'visualTint'>, palette: readonly string[]): string {
    const base = palette[voxel.color];
    if (!voxel.visualTint) return base;
    // Keep the source model's texture detail while remapping it to the exact
    // ammo color family before the mesh applies its fixed lighting.
    const tint = voxel.visualTint;
    const lightness = (channel(tint, 1) * .21 + channel(tint, 3) * .72 + channel(tint, 5) * .07) / 255;
    return mixRescueColors(base, lightness < .64 ? '#17372e' : '#ffffff', Math.abs(lightness - .64) * .16);
}
