/** Presentation only. Only confirmed hits count, including different colors. */
export class RescueFeedback {
    count = 0;
    lastHit = -Infinity;

    get level(): number {
        return this.count >= 20 ? 3 : this.count >= 12 ? 2 : this.count >= 5 ? 1 : 0;
    }

    reset(): void {
        this.count = 0;
        this.lastHit = -Infinity;
    }

    hit(time: number): number {
        if (time - this.lastHit > .28) this.count = 0;
        this.lastHit = time;
        this.count++;
        if (this.count === 5) return 1;
        if (this.count === 12) return 2;
        return this.count % 20 === 0 ? 3 : 0;
    }
}

export function launcherRecoil(elapsed: number): {x: number; y: number} {
    if (elapsed < 0 || elapsed >= .128 || !Number.isFinite(elapsed)) return {x: 0, y: 0};
    const release = (1 - elapsed / .128) ** 1.7;
    return {x: Math.sin(elapsed * 78) * 4.1 * release, y: -5.2 * Math.cos(elapsed * 50) * release};
}

export function hitFountain(strong: boolean, available: number, random = Math.random) {
    const count = Math.min(strong ? 9 : 5, Math.max(0, available));
    return Array.from({length: count}, (_, index) => {
        const spread = count > 1 ? index / (count - 1) * 2 - 1 : 0;
        return {
            vx: (spread + (random() - .5) * .20) * (strong ? 168 : 104),
            vy: (strong ? 238 : 170) + random() * 82 - Math.abs(spread) * 36,
            life: (strong ? .42 : .34) + random() * .13,
            size: 4 + random() * (strong ? 5 : 3),
            glint: index % 3 === 1,
        };
    });
}
