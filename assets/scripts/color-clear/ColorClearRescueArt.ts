import {Color, Graphics} from 'cc';
import {mixRescueColors} from './ColorClearNativeStyle';

function fill(pen: Graphics, color: string, shape: () => void): void {
    pen.fillColor = new Color(color);
    shape();
    pen.fill();
}

export function drawGear(pen: Graphics): void {
    pen.strokeColor = new Color('#25534a');
    pen.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
        const angle = Math.PI * i / 4;
        const x = Math.cos(angle), y = Math.sin(angle);
        pen.moveTo(x * 13, y * 13);
        pen.lineTo(x * 19, y * 19);
    }
    pen.circle(0, 0, 14);
    pen.circle(0, 0, 5);
    pen.stroke();
}

const INK = '#23434a';

function rounded(pen: Graphics, color: string, x: number, y: number, w: number, h: number, radius: number): void {
    fill(pen, color, () => pen.roundRect(x, y, w, h, radius));
}

function drawAmmoDuck(pen: Graphics, x: number, y: number, color: string, scale = 1): void {
    const shade = mixRescueColors(color, INK, .28);
    const light = mixRescueColors(color, '#ffe5b8', .24);
    const gloss = mixRescueColors(color, '#fff7dd', .67);
    fill(pen, shade, () => {
        pen.ellipse(x - 3 * scale, y - 8 * scale, 17 * scale, 11 * scale);
        pen.ellipse(x + 2 * scale, y + 4 * scale, 12 * scale, 13 * scale);
    });
    fill(pen, light, () => {
        pen.ellipse(x - 4 * scale, y - 6 * scale, 16 * scale, 10 * scale);
        pen.ellipse(x + scale, y + 5 * scale, 11 * scale, 12 * scale);
    });
    fill(pen, color, () => pen.ellipse(x - 6 * scale, y - 5 * scale, 8 * scale, 4.5 * scale));
    fill(pen, '#de8756', () => pen.ellipse(x + 13 * scale, y + 3 * scale, 6 * scale, 3.6 * scale));
    fill(pen, '#f6b96f', () => pen.ellipse(x + 14 * scale, y + 4.2 * scale, 5.2 * scale, 2.4 * scale));
    fill(pen, '#db936caa', () => pen.ellipse(x + 6 * scale, y + 2.4 * scale, 3.2 * scale, 1.7 * scale));
    fill(pen, INK, () => pen.circle(x + 6 * scale, y + 8 * scale, 1.9 * scale));
    fill(pen, gloss, () => {
        pen.ellipse(x - 2.5 * scale, y + 12 * scale, 3.5 * scale, 1.5 * scale);
        pen.ellipse(x - 9 * scale, y - 4 * scale, 4.2 * scale, 1.2 * scale);
    });
}

export function drawRescueModule(pen: Graphics, w: number, h: number, color: string): void {
    pen.clear();
    const left = -w / 2;
    const bottom = -h / 2;
    const shade = mixRescueColors(color, '#37585a', .34);
    const glaze = mixRescueColors(color, '#fff2c9', .19);
    const shine = mixRescueColors(color, '#fff3dc', .63);

    fill(pen, '#30495133', () => pen.ellipse(0, bottom + 10, w * .43, 9));
    rounded(pen, shade, left + 6, bottom + 8, w - 12, h - 18, 23);
    rounded(pen, color, left + 6, bottom + 13, w - 12, h - 23, 22);
    rounded(pen, glaze, left + 10, bottom + 18, w - 20, h - 30, 19);
    rounded(pen, shine, left + 26, h / 2 - 17, w * .46, 3, 1.5);

    // The count sits on the glazed shell without an inset frame.
    drawAmmoDuck(pen, left + w * .29, 4, color, 1.3);
    fill(pen, shade, () => {
        pen.ellipse(left + 23, bottom + 11, 5, 2.5);
        pen.ellipse(w / 2 - 23, bottom + 11, 5, 2.5);
    });
}

export function drawLauncher(pen: Graphics, color: string | undefined, locked: boolean): void {
    pen.clear();
    rounded(pen, '#ac6d65', -43, -36, 86, 70, 22);
    rounded(pen, locked ? '#e1a79a' : '#f2b39e', -42, -31, 84, 65, 20);
    rounded(pen, locked ? '#92adab' : '#588084', -35, -23, 70, 48, 16);
    rounded(pen, locked ? '#c7d5c3' : '#84a7a1', -33, -20, 66, 42, 15);
    rounded(pen, '#f7c7b0aa', -20, 27, 40, 3, 1.5);
    if (!locked) {
        fill(pen, '#496e74', () => pen.ellipse(0, 30, 9.5, 3.7));
        rounded(pen, color ? '#ffd180' : '#789894', -7, -27, 14, 3, 1.5);
    }
}

export function drawLauncherAmmo(pen: Graphics, color: string | undefined): void {
    pen.clear();
    if (!color) return;
    const shade = mixRescueColors(color, INK, .24);
    const glaze = mixRescueColors(color, '#ffedcd', .19);
    rounded(pen, shade, -29, -18, 58, 37, 13);
    rounded(pen, glaze, -28, -13, 56, 32, 12);
    rounded(pen, mixRescueColors(color, '#fff5dd', .63), -17, 14, 25, 2.5, 1.25);
}

export function drawSpareAmmo(pen: Graphics, color: string, mystery: boolean): void {
    pen.clear();
    rounded(pen, mystery ? '#b78574' : '#779a97', -65, -17, 130, 33, 12);
    rounded(pen, mystery ? '#eab9a0' : '#abc9bd', -65, -13, 130, 29, 11);
    if (color) drawAmmoDuck(pen, -40, 1, color, .59);
}

export function drawAmmoRack(pen: Graphics): void {
    rounded(pen, '#9c6d67', -300, -121, 600, 242, 26);
    rounded(pen, '#d69586', -299, -116, 598, 237, 25);
    rounded(pen, '#e4a697', -294, -108, 588, 221, 21);
    rounded(pen, '#f4c7b0', -267, 112, 534, 4, 2);
    for (let col = 0; col < 4; col++) {
        const center = -222 + col * 148;
        rounded(pen, '#6b8d88', center - 67, -107, 134, 216, 18);
        rounded(pen, '#8eafa1', center - 65, -102, 130, 207, 16);
    }
}

export function drawRescueHarbor(pen: Graphics, wizard: boolean): void {
    fill(pen, wizard ? '#315471' : '#81aaa3', () => pen.roundRect(-300, -281, 600, 562, 38));
    fill(pen, wizard ? '#e9cf8e' : '#c1c69c', () => pen.circle(204, 174, 56));
    fill(pen, wizard ? '#3b6074' : '#6c9c90', () => {
        pen.moveTo(-295, -58);
        pen.bezierCurveTo(-175, 53, -131, 48, -42, -22);
        pen.bezierCurveTo(65, -86, 171, 67, 295, -15);
        pen.lineTo(295, -201);
        pen.lineTo(-295, -201);
        pen.close();
    });
    fill(pen, wizard ? '#375f70' : '#588e86', () => {
        pen.moveTo(-297, -129);
        pen.bezierCurveTo(-177, -93, -84, -160, 46, -121);
        pen.bezierCurveTo(148, -86, 234, -112, 297, -90);
        pen.lineTo(297, -238);
        pen.quadraticCurveTo(297, -278, 251, -278);
        pen.lineTo(-251, -278);
        pen.quadraticCurveTo(-297, -278, -297, -238);
        pen.close();
    });
    if (wizard) {
        fill(pen, '#f8e5afac', () => {
            for (const [x, y, r] of [[-238,190,2.8],[-161,211,3],[-86,171,2],[126,180,2.4],[251,105,2.2],
                [-246,103,1.7],[18,217,2],[270,203,1.8],[98,123,1.6]]) pen.circle(x, y, r);
        });
    }
    const island = wizard ? '#2c5365' : '#557d75';
    fill(pen, island, () => {
        pen.ellipse(-224, -66, 65, 8);
        pen.ellipse(228, -103, 52, 8);
    });
    rounded(pen, island, -251, -65, 53, 49, 5);
    rounded(pen, wizard ? '#53768a' : '#a99e79', -245, -61, 41, 41, 4);
    fill(pen, wizard ? '#325867' : '#977963', () => {
        pen.moveTo(-260, -21);
        pen.lineTo(-224, 13);
        pen.lineTo(-189, -21);
        pen.close();
    });
    rounded(pen, '#e8c581', -233, -58, 16, 26, 4);
    rounded(pen, '#6b6454', -226, -58, 2, 25, 1);
    // Small foreground piers and paper lanterns frame the model.
    for (const [x, y, height] of [[-264,-184,88],[245,-176,84],[-230,-172,54],[274,-179,56]]) {
        rounded(pen, '#345456', x - 3, y, 8, height, 3);
        rounded(pen, '#a0825f', x - 1, y + 5, 4, height - 10, 2);
        if (height < 60) continue;
        fill(pen, '#d8b36d30', () => pen.circle(x + 11, y + height - 15, 21));
        rounded(pen, '#dab273', x + 5, y + height - 26, 15, 18, 5);
        rounded(pen, '#fff0b8', x + 8, y + height - 20, 9, 10, 3);
    }
    fill(pen, '#d5e9e477', () => {
        pen.roundRect(-246, 150, 103, 12, 6);
        pen.roundRect(-200, 170, 67, 9, 5);
        pen.roundRect(156, 101, 87, 10, 5);
        pen.roundRect(-257, -205, 70, 5, 3);
        pen.roundRect(177, -183, 76, 5, 3);
        pen.roundRect(127, -235, 80, 4, 2);
    });
    fill(pen, '#28424e75', () => pen.ellipse(0, -226, 174, 21));
    fill(pen, '#865c46', () => pen.ellipse(0, -216, 166, 29));
    fill(pen, '#d4ab76', () => pen.ellipse(0, -207, 166, 26));
    pen.strokeColor = new Color('#bb8e6159');
    pen.lineWidth = 2;
    for (let y = -213; y <= -194; y += 10) {
        pen.moveTo(-124, y);
        pen.quadraticCurveTo(0, y - 9, 130, y);
    }
    pen.stroke();
    fill(pen, '#456e6f', () => {
        pen.ellipse(-233, -219, 37, 8);
        pen.ellipse(217, -207, 29, 6);
    });
    fill(pen, '#8ac4a5', () => {
        pen.ellipse(-238, -226, 25, 8);
        pen.ellipse(218, -215, 20, 7);
    });
    fill(pen, '#f79889', () => {
        pen.ellipse(-243, -219, 6, 8);
        pen.ellipse(-235, -217, 6, 9);
    });
}

export function drawHarborMotion(pen: Graphics, time: number, wizard: boolean): void {
    pen.clear();
    for (let i = 0; i < 3; i++) {
        const float = Math.sin(time * 1.6 + i * 2.1);
        const x = (i === 1 ? 227 : -232 + i * 21) + float * 9;
        const y = 27 + i * 25 + float * 3;
        fill(pen, wizard ? '#b6d3c873' : '#e0edc897', () => pen.ellipse(x, y, 12 + float * 2, 1.8));
        if (i === 1) {
            fill(pen, '#f2c47b', () => {
                pen.moveTo(x - 10, y + 3);
                pen.lineTo(x, y + 16);
                pen.lineTo(x + 10, y + 3);
                pen.close();
            });
            rounded(pen, '#d9895f', x - 9, y + 2, 18, 3, 1.5);
        }
    }
}

export function drawOrbitTrail(pen: Graphics, progress: number, tier: number, front: boolean): void {
    const radius = 176 + tier * 15;
    const head = progress * Math.PI * 2.7 - 1.2;
    for (let i = 7; i >= 0; i--) {
        const angle = head - i * .16;
        const depth = Math.sin(angle);
        if ((depth >= 0) !== front) continue;
        const x = Math.cos(angle) * radius;
        const y = 172 - depth * 49 + Math.cos(angle) * 20;
        const size = (1.7 + tier + (8 - i) * .49) * (1 - progress * .45);
        fill(pen, i < 3 ? '#fff1ab' : '#efc274b0', () => pen.circle(x, y, size));
        if (i === 0) {
            fill(pen, '#fffbe1', () => {
                pen.moveTo(x - size * 2.3, y);
                pen.lineTo(x, y + size * 1.8);
                pen.lineTo(x + size * 2.3, y);
                pen.lineTo(x, y - size * 1.8);
                pen.close();
            });
        }
    }
}

export function drawCampCorners(pen: Graphics): void {
    fill(pen, '#f4f8ef', () => {
        for (const dx of [-1, 1]) {
            for (const dy of [-1, 1]) {
                const x = dx * 302, y = dy * 275;
                pen.moveTo(x, y);
                pen.lineTo(x - dx * 39, y);
                pen.quadraticCurveTo(x - dx * 4, y - dy * 4, x, y - dy * 39);
                pen.close();
            }
        }
    });
}
