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
