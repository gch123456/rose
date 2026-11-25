export type Valve = 'left' | 'right' | 'drain';
export type WaterArrival = Valve | 'merge';

export const WATER_TRAVEL = {left: .67, right: .73, drain: .78} as const;
const SIDES = ['left', 'right'] as const;
const VALVES = [...SIDES, 'drain'] as const;

export class WaterRescueGame {
    private readonly elapsed = new Map<Valve, number>();
    private readonly arrived = new Set<Valve>();

    get merged(): boolean { return SIDES.every(side => this.arrived.has(side)); }
    get won(): boolean { return this.arrived.has('drain'); }
    opened(valve: Valve): boolean { return this.elapsed.has(valve); }

    available(valve: Valve): boolean {
        return !this.opened(valve) && (valve !== 'drain' || this.merged);
    }

    open(valve: Valve): boolean {
        if (!this.available(valve)) return false;
        this.elapsed.set(valve, 0);
        return true;
    }

    progress(valve: Valve): number {
        return Math.min(1, (this.elapsed.get(valve) ?? 0) / WATER_TRAVEL[valve]);
    }

    advance(seconds: number): WaterArrival[] {
        if (!Number.isFinite(seconds) || seconds <= 0) return [];
        const mergedBefore = this.merged;
        const events: WaterArrival[] = [];
        for (const valve of VALVES) {
            const current = this.elapsed.get(valve);
            if (current === undefined || this.arrived.has(valve)) continue;
            const time = current + seconds;
            this.elapsed.set(valve, time);
            if (time >= WATER_TRAVEL[valve]) {
                this.arrived.add(valve);
                events.push(valve);
            }
        }
        if (!mergedBefore && this.merged) events.push('merge');
        return events;
    }
}
