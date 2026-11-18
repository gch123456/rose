export type DockFlight = {x: number; y: number; color: number; duration: number; age: number; blocks: number};

const MAX_FLIGHTS = 12;
const BOOST_WINDOW = .30;

/** Bridges cleared voxels and the pursuit: only a landing moves the duck. */
export class HarborDelivery {
    readonly flights: DockFlight[] = [];
    duckX = 69;
    scroll = 0;
    stride = 0;
    private boost = 0;
    private chain = 0;
    private sinceLanding = Infinity;
    private boostTime = 0;

    get speed(): number { return this.boostTime > 0 ? this.boost : 0; }

    queue(x: number, y: number, color: number): void {
        const count = this.flights.length;
        if (count >= MAX_FLIGHTS) {
            this.flights[count - 1].blocks++;
            return;
        }
        this.flights.push({x, y, color, duration: .24 + (count % 4) * .02, age: 0, blocks: 1});
    }

    step(dt: number): number {
        if (!Number.isFinite(dt) || dt <= 0) return 0;
        let landed = 0;
        let firstArrival = dt;
        let lastArrival = 0;
        for (let i = this.flights.length - 1; i >= 0; i--) {
            const flight = this.flights[i];
            const rest = flight.duration - flight.age;
            flight.age += dt;
            if (flight.age < flight.duration) continue;
            landed += flight.blocks;
            firstArrival = Math.min(firstArrival, rest);
            lastArrival = Math.max(lastArrival, rest);
            this.flights.splice(i, 1);
        }
        if (!landed) {
            this.advance(dt);
            this.sinceLanding += dt;
            return 0;
        }
        this.advance(firstArrival);
        if (this.sinceLanding + firstArrival > .36) this.chain = 0;
        this.chain += landed;
        this.boost = Math.min(3.2, 1 + this.chain * .22);
        this.boostTime = BOOST_WINDOW;
        this.sinceLanding = dt - lastArrival;
        this.advance(dt - firstArrival);
        return landed;
    }

    private advance(dt: number): void {
        const moving = Math.min(dt, this.boostTime);
        this.boostTime -= moving;
        this.duckX = Math.min(146, this.duckX + moving * this.boost * 34);
        this.scroll = (this.scroll + moving * this.boost * 53) % 41;
        this.stride += dt + moving * this.boost * .56;
    }
}
