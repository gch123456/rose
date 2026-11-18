export type HarborChaseMode = 'tutorial' | 'bridge' | 'long';

const MODES = {
    tutorial: { opening: 12, approachPerSecond: .032, minimum: .24 },
    bridge: { opening: 20, approachPerSecond: .030, minimum: 0 },
    long: { opening: 32, approachPerSecond: .023, minimum: 0 },
} as const;

const OPENING_DRIFT = .006;
const HIT_DISTANCE = .018;
const HIT_BREATHING_ROOM = 1.5;

export function conveyorDuckX(clearance: number): number {
    return -190 + Math.max(0, Math.min(1, clearance)) * 340;
}

/** Advance only during active play. The belt brings the duck toward the oven,
 * and arriving blocks buy distance and time. */
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

        const stopped = Math.max(this.frozenTime, this.hitProtection);
        const openingDrift = Math.max(0, Math.min(dt, this.openingTime) - stopped);
        const exposedTime = Math.max(0, dt - Math.max(this.openingTime, stopped));
        this.openingTime = Math.max(0, this.openingTime - dt);
        this.frozenTime = Math.max(0, this.frozenTime - dt);
        this.hitProtection = Math.max(0, this.hitProtection - dt);
        this.gap = Math.max(this.rules.minimum, this.gap - OPENING_DRIFT * openingDrift - this.rules.approachPerSecond * exposedTime);
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
