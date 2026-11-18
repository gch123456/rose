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
