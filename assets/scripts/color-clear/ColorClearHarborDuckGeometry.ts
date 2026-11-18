export type HarborPoint = readonly [number, number, number];
export type HarborDuckRegion = 'coat' | 'face' | 'beak' | 'cap';
export type HarborDuckPart = {
    name: string;
    color: string;
    position: HarborPoint;
    size: HarborPoint;
    roll: number;
    region: HarborDuckRegion;
};

function regionFor(name: string): HarborDuckRegion {
    if (['Head', 'Face', 'Cheek', 'Eye', 'EyeGlint'].includes(name)) return 'face';
    if (['WebbedFoot', 'Toe', 'LowerBill', 'UpperBill', 'BillShine', 'CoatClasp'].includes(name)) return 'beak';
    if (name.startsWith('Sailor') || name === 'CapBadge') return 'cap';
    return 'coat';
}

/** Dimensions of the same ellipsoids used by the playable shell and its revealed duck. */
export function harborDuckParts(stageId: number): readonly HarborDuckPart[] {
    const parts: HarborDuckPart[] = [];
    const piece = (name: string, color: string, position: HarborPoint, size: HarborPoint, roll = 0): void => {
        parts.push({ name, color, position, size, roll, region: regionFor(name) });
    };
    const raincoat = stageId === 11;
    const sailor = stageId === 13;
    const coat = raincoat ? '#3d9b87' : sailor ? '#4587ae' : '#6a51a0';
    const lining = raincoat ? '#67c5a9' : sailor ? '#70b8ce' : '#9878c5';
    const trim = raincoat ? '#f8cd79' : sailor ? '#f3edda' : '#f4c785';

    piece('Tail', coat, [0, -.83, -1.86], [1.22, 1.10, 1.82]);
    piece('Coat', coat, [0, -.98, -.21], [4.25, 3.05, 4.0]);
    piece('Breast', lining, [0, -1.14, 1.23], [2.89, 2.34, 1.60]);
    for (const sign of [-1, 1]) {
        piece('Wing', lining, [sign * 1.56, -1.02, .02], [1.68, 1.57, 2.65], sign * 22);
        piece('WingInset', coat, [sign * 1.80, -1.19, .62], [.64, .69, 1.3], sign * 18);
        piece('WebbedFoot', '#dd7d39', [sign * .81, -2.44, 1.14], [1.43, .53, 1.84]);
        piece('Toe', '#ffb15e', [sign * .82, -2.36, 1.57], [1.23, .34, 1.17]);
    }

    if (raincoat) {
        piece('RainHood', coat, [0, 1.12, .25], [3.27, 3.48, 2.96]);
        piece('HoodRim', lining, [0, 1.17, .94], [3.1, 2.85, 1.95]);
    }

    piece('Head', '#f6c95e', [0, 1.13, .89], [2.62, 2.52, 2.37]);
    piece('Face', '#ffdd80', [0, 1.20, 1.43], [2.34, 2.12, 1.49]);
    piece('LowerBill', '#da7145', [0, .75, 2.06], [1.63, .47, 1.45]);
    piece('UpperBill', '#ffad61', [0, .94, 2.09], [1.72, .48, 1.42]);
    piece('BillShine', '#ffd190', [0, 1.05, 2.51], [.87, .12, .24]);

    for (const sign of [-1, 1]) {
        piece('Cheek', '#f7a362', [sign * .87, 1.03, 2.00], [.43, .23, .16]);
        piece('Eye', '#26313d', [sign * .53, 1.59, 2.00], [.35, .48, .23]);
        piece('EyeGlint', '#fff7e2', [sign * .53 - .042, 1.67, 2.10], [.107, .127, .080]);
    }

    if (sailor) {
        piece('SailorCapBand', coat, [0, 2.23, .73], [2.63, .43, 2.08]);
        piece('SailorCap', '#fff0cb', [0, 2.53, .60], [2.48, .75, 2.10], -8);
        piece('CapBadge', '#f4be63', [0, 2.33, 1.74], [.38, .37, .14]);
    } else if (!raincoat) {
        piece('WizardBrim', coat, [0, 2.19, .67], [3.37, .47, 2.70], -8);
        piece('WizardHat', lining, [.29, 2.53, .62], [1.83, .87, 1.60], -21);
        piece('HatGem', trim, [.13, 2.46, 1.48], [.43, .35, .17]);
    }

    piece('CoatClasp', trim, [0, -.27, 2.02], [.45, .39, .17]);
    return parts;
}

export function harborDuckScale(stageId: number): number {
    if (stageId === 11) return 2.30;
    if (stageId === 13) return 3.25;
    return 1;
}
