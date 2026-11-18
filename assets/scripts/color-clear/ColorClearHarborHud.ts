import {Color, Graphics} from 'cc';

function paint(pen: Graphics, hex: string, shape: () => void): void {
    pen.fillColor = new Color(hex);
    shape();
    pen.fill();
}

function duck(pen: Graphics, x: number, step: number): void {
    paint(pen, '#eb9b46', () => {
        pen.ellipse(x - 7 + step * 3, -14, 5, 2.5);
        pen.ellipse(x + 7 - step * 3, -13, 5, 2.5);
    });
    paint(pen, '#f6cf63', () => {
        pen.ellipse(x - 5, -4, 15, 10);
        pen.circle(x + 5, 4, 11);
    });
    paint(pen, '#ffac4d', () => pen.ellipse(x + 15, 1, 8, 4));
    paint(pen, '#193333', () => pen.circle(x + 8, 7, 2.2));
}

function cook(pen: Graphics, x: number, step: number, frozen: boolean): void {
    paint(pen, frozen ? '#71c5de' : '#aa614e', () => {
        pen.roundRect(x - 14, -13, 28, 22, 8);
        pen.ellipse(x - 7 + step * 4, -14, 5, 2.5);
        pen.ellipse(x + 8 - step * 4, -14, 5, 2.5);
    });
    paint(pen, '#eaba8f', () => pen.roundRect(x - 10, -5, 25, 16, 6));
    paint(pen, '#f7ecd9', () => {
        pen.circle(x - 7, 10, 7);
        pen.circle(x + 2, 14, 8);
        pen.circle(x + 11, 11, 6);
        pen.roundRect(x - 11, 5, 25, 7, 3);
    });
    paint(pen, '#4d392e', () => pen.circle(x + 8, 1, 2));
}

export function drawHarborChase(pen: Graphics, gap: number, clock: number, frozen: boolean, ended: boolean): void {
    pen.clear();
    paint(pen, '#112932e8', () => pen.roundRect(-262, -24, 524, 48, 19));
    paint(pen, '#53777aa0', () => pen.roundRect(-232, -15, 464, 3, 1.5));
    const retreat = 120 * (1 - gap);
    const cookX = -186 + retreat;
    const duckX = cookX + 22 + gap * 300;
    paint(pen, frozen ? '#8de0f6' : gap < .18 ? '#ef9580' : '#ebca7f',
        () => pen.roundRect(cookX, -16, Math.max(4, duckX - cookX), 3, 1.5));
    const step = Math.sin(clock * 12);
    cook(pen, cookX, frozen || ended ? 0 : -step, frozen);
    duck(pen, duckX, ended ? 0 : step);
    paint(pen, '#edc58a', () => {
        pen.moveTo(213, -13);
        pen.lineTo(213, 12);
        pen.lineTo(235, 6);
        pen.lineTo(213, 1);
        pen.close();
    });
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
