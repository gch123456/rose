import {Color, Graphics} from 'cc';

const palette = new Map<string, Color>();

function color(hex: string): Color {
    let cached = palette.get(hex);
    if (!cached) {
        cached = new Color(hex);
        palette.set(hex, cached);
    }
    return cached;
}

function paint(pen: Graphics, hex: string, shape: () => void): void {
    pen.fillColor = color(hex);
    shape();
    pen.fill();
}

function outline(pen: Graphics, hex: string, width: number, shape: () => void): void {
    pen.strokeColor = color(hex);
    pen.lineWidth = width;
    shape();
    pen.stroke();
}

function drawConveyor(pen: Graphics, scroll: number, frozen: boolean): void {
    paint(pen, '#374c5c', () => pen.roundRect(-262, -36, 524, 72, 20));
    paint(pen, frozen ? '#e3f3f2' : '#fcefd7', () => pen.roundRect(-258, -32, 516, 64, 17));
    paint(pen, frozen ? '#b7dce9' : '#eadbc4', () => pen.roundRect(-257, -25, 514, 24, 8));
    outline(pen, '#ffffff93', 1.5, () => {
        pen.moveTo(-140, 25);
        pen.lineTo(233, 25);
        for (let x = -112; x < 210; x += 58) {
            pen.moveTo(x, 23);
            pen.lineTo(x, -8);
        }
    });

    paint(pen, '#536d7d', () => pen.roundRect(-215, -29, 453, 19, 9));
    paint(pen, frozen ? '#89bdcf' : '#9ab3ad', () => pen.roundRect(-212, -26, 448, 13, 6));
    outline(pen, frozen ? '#e2faff' : '#5e807b', 2, () => {
        const offset = ((scroll % 38) + 38) % 38;
        for (let x = -157 - offset; x < 226; x += 38) {
            if (x - 6 < -208) continue;
            pen.moveTo(x + 6, -15);
            pen.lineTo(x, -19);
            pen.lineTo(x + 6, -23);
        }
    });
    paint(pen, '#e6dbc5', () => {
        pen.circle(-207, -20, 6);
        pen.circle(229, -20, 6);
    });
    paint(pen, '#708890', () => {
        pen.circle(-207, -20, 2.4);
        pen.circle(229, -20, 2.4);
    });
    outline(pen, '#708890', 1, () => {
        const angle = scroll / 6;
        const dx = Math.cos(angle) * 4;
        const dy = Math.sin(angle) * 4;
        for (const x of [-207, 229]) {
            pen.moveTo(x - dx, -20 - dy);
            pen.lineTo(x + dx, -20 + dy);
        }
    });

    // The mint guard sets the safe end apart from the oven.
    paint(pen, '#659c8b', () => pen.roundRect(215, -11, 29, 19, 7));
    paint(pen, '#b8e1cd', () => pen.roundRect(219, -8, 21, 13, 4));
    outline(pen, '#3d746b', 2.5, () => {
        pen.moveTo(225, -1);
        pen.lineTo(228, -4);
        pen.lineTo(234, 2);
    });
}

function drawOven(pen: Graphics, frozen: boolean, reachedOven: boolean): void {
    paint(pen, '#ab685d', () => pen.roundRect(-245, -23, 100, 47, 15));
    paint(pen, '#df8f77', () => pen.roundRect(-243, -19, 96, 46, 14));
    paint(pen, '#f3ac8d', () => pen.roundRect(-240, -14, 91, 40, 13));
    paint(pen, '#cc7d64', () => pen.roundRect(-244, -26, 100, 8, 4));
    paint(pen, '#fff2d6', () => {
        pen.roundRect(-231, 18, 31, 4, 2);
        pen.circle(-222, 5, 4.5);
    });
    paint(pen, frozen ? '#76d8e9' : '#ffd180', () => pen.circle(-222, 5, 2.7));
    outline(pen, '#b86d61', 2, () => {
        pen.moveTo(-232, -2);
        pen.lineTo(-221, -2);
        pen.moveTo(-232, -7);
        pen.lineTo(-222, -7);
    });

    // A deep arch with its own light, bounded by the oven's enamel face.
    paint(pen, '#985450', () => {
        pen.moveTo(-210, -20);
        pen.lineTo(-210, -1);
        pen.bezierCurveTo(-210, 22, -156, 22, -156, -1);
        pen.lineTo(-156, -20);
        pen.close();
    });
    paint(pen, frozen ? '#527987' : '#713c43', () => {
        pen.moveTo(-206, -18);
        pen.lineTo(-206, -2);
        pen.bezierCurveTo(-206, 17, -160, 17, -160, -2);
        pen.lineTo(-160, -18);
        pen.close();
    });
    paint(pen, frozen ? '#93ccdb' : '#e99164', () => pen.ellipse(-183, -13, 20, 5));
    paint(pen, frozen ? '#d2f1f1' : reachedOven ? '#fff0bf' : '#ffbf7e',
        () => pen.ellipse(-183, -13, reachedOven ? 17 : 11, reachedOven ? 3.7 : 2));
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

/** A miniature bakery conveyor, 524 × 72, centered on the HUD node. */
export function drawHarborConveyor(pen: Graphics, duckX: number, scroll: number, stride: number,
    boost: number, frozen: boolean, ended: boolean, reachedOven: boolean): void {
    pen.clear();
    drawConveyor(pen, scroll, frozen);
    drawOven(pen, frozen, reachedOven);
    if (reachedOven) return;
    const running = !ended && boost > 0;
    if (running) {
        outline(pen, '#83a79f', 1.8, () => {
            pen.moveTo(duckX - 47 - boost * 5, 8);
            pen.lineTo(duckX - 35, 8);
            pen.moveTo(duckX - 46, 1);
            pen.lineTo(duckX - 34, 1);
            pen.moveTo(duckX - 42, -7);
            pen.lineTo(duckX - 32, -7);
        });
    }
    drawRunningDuck(pen, duckX, stride * 19, running, duckX < -136);
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
