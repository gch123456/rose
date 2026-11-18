import {Color, Graphics} from 'cc';
import type {HarborDelivery} from './ColorClearHarborDelivery';

function paint(pen: Graphics, hex: string, shape: () => void): void {
    pen.fillColor = new Color(hex);
    shape();
    pen.fill();
}

function outline(pen: Graphics, hex: string, width: number, shape: () => void): void {
    pen.strokeColor = new Color(hex);
    pen.lineWidth = width;
    shape();
    pen.stroke();
}

function drawDock(pen: Graphics, scroll: number): void {
    paint(pen, '#354553', () => pen.roundRect(-262, -36, 524, 72, 19));
    paint(pen, '#96b4b5', () => pen.roundRect(-259, -32, 518, 65, 17));
    paint(pen, '#355c6d', () => {
        pen.moveTo(-253, 5);
        pen.quadraticCurveTo(-203, 24, -161, 14);
        pen.quadraticCurveTo(-86, 30, -16, 9);
        pen.quadraticCurveTo(49, 28, 110, 12);
        pen.quadraticCurveTo(166, 29, 252, 9);
        pen.lineTo(252, -20);
        pen.lineTo(-253, -20);
        pen.close();
    });
    paint(pen, '#fff0b6', () => pen.circle(178, 20, 8));
    outline(pen, '#c7dada88', 2, () => {
        pen.moveTo(-200, 25);
        pen.lineTo(-175, 25);
        pen.moveTo(18, 24);
        pen.lineTo(41, 24);
        pen.moveTo(120, 7);
        pen.lineTo(138, 7);
        pen.moveTo(-40, -5);
        pen.lineTo(-12, -5);
    });

    paint(pen, '#477d86', () => pen.roundRect(-255, -26, 510, 22, 9));
    outline(pen, '#b2dbca75', 1.5, () => {
        for (let i = 0; i < 5; i++) {
            const x = -213 + i * 94 - scroll / 2;
            const y = -12 - (i % 2) * 5;
            pen.moveTo(x, y);
            pen.lineTo(x + 18, y);
        }
    });
    paint(pen, '#b17c5b', () => pen.roundRect(-252, -31, 504, 15, 7));
    outline(pen, '#e2b27d', 2, () => {
        pen.moveTo(-245, -18);
        pen.lineTo(244, -18);
    });
    outline(pen, '#774f4b', 2, () => {
        for (let i = 0; i < 12; i++) {
            const x = -215 + i * 41 - scroll;
            pen.moveTo(x, -20);
            pen.lineTo(x - 5, -28);
        }
    });

    for (const x of [-229, 225]) {
        paint(pen, '#314e53', () => {
            pen.roundRect(x - 2, -19, 4, 39, 1);
            pen.roundRect(x - 8, 17, 16, 4, 2);
        });
        paint(pen, '#fff0ab53', () => pen.circle(x, 10, 13));
        paint(pen, '#f9d58b', () => pen.roundRect(x - 4, 6, 8, 10, 2));
    }
}

function drawRunningDuck(pen: Graphics, x: number, phase: number, running: boolean, caught: boolean): void {
    const stride = running ? Math.sin(phase) : 0;
    const bounce = running ? Math.abs(Math.cos(phase)) * 5 : 0;
    const y = 1 + bounce;
    paint(pen, '#593f4160', () => pen.ellipse(x, -19, 23, 3));
    paint(pen, '#bd713f', () => pen.ellipse(x - 9 - stride * 10, -16 + Math.max(0, -stride * 5), 8, 3.4));
    paint(pen, '#ffad58', () => pen.ellipse(x + 4 + stride * 11, -16 + Math.max(0, stride * 5), 9, 3.8));
    paint(pen, '#287b74', () => {
        pen.ellipse(x - 7, y - 5, 21, 13);
        pen.ellipse(x + 7, y + 8, 17, 17);
        pen.moveTo(x - 27, y - 5);
        pen.quadraticCurveTo(x - 34, y + 4, x - 23, y + 1);
        pen.lineTo(x - 15, y - 4);
        pen.close();
    });
    paint(pen, '#57bba1', () => {
        pen.ellipse(x - 10, y - 2, 17, 11);
        pen.ellipse(x + 8, y + 11, 14, 14);
    });
    paint(pen, '#f9dc89', () => pen.ellipse(x + 12, y + 7, 10, 11));
    paint(pen, '#ffb163', () => {
        pen.moveTo(x + 18, y + 5);
        pen.quadraticCurveTo(x + 37, y + 6, x + 31, y - 1);
        pen.quadraticCurveTo(x + 27, y - 5, x + 17, y - 1);
        pen.close();
    });
    paint(pen, '#f19483', () => pen.ellipse(x + 11, y + 1, 3.5, 2));
    paint(pen, '#253e49', () => pen.ellipse(x + 16, y + 9, caught ? 2.8 : 2.1, caught ? 3.8 : 2.8));
    paint(pen, '#c5ead0', () => pen.ellipse(x + 3, y + 19, 6, 2));
    outline(pen, '#287b748e', 2, () => {
        pen.moveTo(x - 13, y + 1 + stride * 2);
        pen.quadraticCurveTo(x + 5, y - 3, x - 11, y - 9 - stride * 2);
    });
}

function drawRunningCook(pen: Graphics, x: number, phase: number, running: boolean, frozen: boolean): void {
    const stride = running ? Math.sin(phase) : 0;
    const y = running ? Math.abs(Math.cos(phase)) * 3 : 0;
    paint(pen, '#593f4160', () => pen.ellipse(x, -19, 20, 3));
    paint(pen, '#4f555d', () => {
        pen.ellipse(x - 9 - stride * 8, -15 + Math.max(0, -stride * 7), 7, 4);
        pen.ellipse(x + 7 + stride * 8, -15 + Math.max(0, stride * 7), 7.5, 4);
    });
    paint(pen, frozen ? '#5e90a7' : '#6886a2', () => pen.ellipse(x - 3, y - 5, 16, 12));
    paint(pen, '#f5e4c7', () => pen.ellipse(x + 2, y - 5, 11, 9));
    paint(pen, '#e9ae93', () => {
        pen.ellipse(x + 4, y + 8, 15, 12);
        pen.ellipse(x + 13 + stride * 5, y - 6, 7, 4.5);
        pen.ellipse(x + 19, y + 6, 5, 4);
    });
    paint(pen, frozen ? '#9beaf1' : '#c85f56', () => {
        pen.moveTo(x - 14, y + 3);
        pen.quadraticCurveTo(x - 3, y + 2, x + 13, y + 1);
        pen.quadraticCurveTo(x + 5, y - 7, x - 3, y - 3);
        pen.lineTo(x - 17 - stride * 3, y - 2);
        pen.close();
    });
    paint(pen, '#fff6df', () => {
        pen.circle(x - 11, y + 18, 8);
        pen.circle(x, y + 23, 10);
        pen.circle(x + 10, y + 20, 8);
        pen.roundRect(x - 15, y + 11, 33, 9, 3);
    });
    paint(pen, '#d8e0d1', () => pen.roundRect(x - 13, y + 11, 29, 3, 1.5));
    paint(pen, '#613d3c', () => {
        pen.ellipse(x + 13, y + 9, 1.9, 2.7);
        pen.ellipse(x + 12, y + 2, 5, 1.8);
    });
    if (frozen) {
        paint(pen, '#7ad8ed55', () => pen.roundRect(x - 23, -20, 47, 49, 7));
        outline(pen, '#c9f6ff', 1.5, () => {
            pen.moveTo(x - 20, 23);
            pen.lineTo(x - 9, 17);
            pen.moveTo(x + 20, 12);
            pen.lineTo(x + 14, 2);
            pen.moveTo(x - 3, -16);
            pen.lineTo(x + 12, -17);
        });
    }
}

/** A miniature side-scrolling dock, 524 × 72, centered on the HUD node. */
export function drawHarborChase(pen: Graphics, gap: number, clock: number, frozen: boolean, ended: boolean,
    caught: boolean, motion: HarborDelivery): void {
    pen.clear();
    const distance = Math.min(1, Math.max(0, gap));
    const running = !ended;
    drawDock(pen, motion.scroll);
    const duckX = motion.duckX;
    const cookX = Math.max(-207, duckX - (caught ? 29 : 37 + distance * 250));

    if (running && motion.speed > 0) {
        outline(pen, '#fff8c89d', 1.7, () => {
            pen.moveTo(duckX - 50 - motion.speed * 5, 9);
            pen.lineTo(duckX - 37, 9);
            pen.moveTo(duckX - 50, 2);
            pen.lineTo(duckX - 35, 2);
            pen.moveTo(duckX - 46, -7);
            pen.lineTo(duckX - 33, -7);
        });
    }
    drawRunningCook(pen, cookX, clock * 14, running && !frozen, frozen);
    drawRunningDuck(pen, duckX, motion.stride * 19, running, caught);
}

export function drawHarborDeck(pen: Graphics): void {
    paint(pen, '#17283299', () => pen.ellipse(0, -230, 176, 23));
    paint(pen, '#765642', () => pen.ellipse(0, -220, 169, 24));
    paint(pen, '#aa8059', () => pen.ellipse(0, -210, 170, 22));
    pen.strokeColor = new Color('#5e433755');
    pen.lineWidth = 2;
    for (let y = -222; y < -191; y += 9) {
        pen.moveTo(-121, y);
        pen.quadraticCurveTo(0, y - 5, 121, y);
    }
    pen.stroke();
}
