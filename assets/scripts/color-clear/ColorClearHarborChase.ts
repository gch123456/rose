export type HarborChaseMode = 'tutorial' | 'bridge' | 'long';

const MODES = {
    tutorial: { opening: 12, approachPerSecond: .032, minimum: .24 },
    bridge: { opening: 20, approachPerSecond: .035, minimum: 0 },
    long: { opening: 32, approachPerSecond: .026, minimum: 0 },
} as const;

const HIT_DISTANCE = .018;
const HIT_BREATHING_ROOM = 1.5;

/** Advance only during active play. The chase follows physical hits, regardless
 * of the current angle, ammo color, or speed of the visual feedback. */
export class HarborChase {
    private gap = .63;
    private openingTime: number;
    private frozenTime = 0;
    private hitProtection = 0;
    private readonly rules: typeof MODES[HarborChaseMode];

    constructor(mode: HarborChaseMode) {
        this.rules = MODES[mode];
        this.openingTime = this.rules.opening;
    }

    get separation(): number { return this.gap; }
    get frozen(): number { return this.frozenTime; }
    get caught(): boolean { return this.gap === 0; }

    tick(dt: number): void {
        if (!Number.isFinite(dt) || dt <= 0 || this.caught) return;

        // Protection windows overlap. Only the part of the frame after all
        // protection expires lets the cook close the gap.
        const protection = Math.max(this.openingTime, this.frozenTime, this.hitProtection);
        const exposedTime = Math.max(0, dt - protection);
        this.openingTime = Math.max(0, this.openingTime - dt);
        this.frozenTime = Math.max(0, this.frozenTime - dt);
        this.hitProtection = Math.max(0, this.hitProtection - dt);
        this.gap = Math.max(this.rules.minimum, this.gap - this.rules.approachPerSecond * exposedTime);
    }

    hit(amount = 1): void {
        if (!Number.isFinite(amount) || amount <= 0 || this.caught) return;
        this.gap = Math.min(1, this.gap + HIT_DISTANCE * amount);
        this.hitProtection = HIT_BREATHING_ROOM;
    }

    freeze(seconds = 5): void {
        if (!Number.isFinite(seconds) || seconds <= 0 || this.caught) return;
        this.frozenTime = Math.max(this.frozenTime, seconds);
    }
}
