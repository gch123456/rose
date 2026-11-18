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

export function drawRescueModule(pen: Graphics, w: number, h: number, color: string): void {
    pen.clear();
    const x = -w * .23, y = -h * .04;
    const edge = mixRescueColors(color, INK, .37);
    const enamel = mixRescueColors(color, '#fff7dc', .25);
    const shine = mixRescueColors(color, '#ffffff', .66);
    // A single rounded duck-shaped piece with a raised head and a soft flank.
    fill(pen, '#38554a30', () => pen.ellipse(1, -h * .42, w * .43, 6));
    fill(pen, edge, () => {
        pen.moveTo(-w * .43, y + 10);
        pen.quadraticCurveTo(-w * .50, y + 1, -w * .41, y - 14);
        pen.bezierCurveTo(-w * .34, y - 38, w * .39, y - 35, w * .44, y - 8);
        pen.quadraticCurveTo(w * .45, y + 13, w * .23, y + 15);
        pen.quadraticCurveTo(x + 17, y + 35, x - 3, y + 33);
        pen.quadraticCurveTo(x - 23, y + 31, -w * .43, y + 10);
        pen.close();
    });
    fill(pen, color, () => pen.ellipse(9, y - 4, w * .36, h * .30));
    fill(pen, enamel, () => {
        pen.ellipse(13, y + 1, w * .31, h * .23);
        pen.ellipse(x, y + 14, w * .16, h * .26);
    });
    fill(pen, '#c68146', () => pen.ellipse(x - 17, y + 11, 10, 6));
    fill(pen, '#ffd18b', () => pen.ellipse(x - 19, y + 13, 8, 4));
    fill(pen, INK, () => pen.circle(x - 7, y + 20, 3));
    fill(pen, '#ef9d8766', () => pen.ellipse(x + 1, y + 11, 6, 3));
    fill(pen, shine, () => {
        pen.ellipse(x + 4, y + 26, 7, 3);
        pen.ellipse(14, y + 9, w * .19, 4);
    });
}

export function drawLauncher(pen: Graphics, color: string | undefined, locked: boolean): void {
    pen.clear();
    rounded(pen, '#b5cfc1', -44, -38, 88, 73, 21);
    rounded(pen, locked ? '#e5ece2' : '#d5e7dc', -41, -33, 82, 68, 19);
    rounded(pen, locked ? '#d8e6db' : '#b8d2c6', -35, -25, 70, 52, 16);
    if (locked) return;
    fill(pen, '#6b9b8d', () => pen.ellipse(0, 31, 15, 5));
    if (color) {
        rounded(pen, mixRescueColors(color, INK, .28), -29, -20, 58, 38, 13);
        rounded(pen, mixRescueColors(color, '#fff7dc', .34), -28, -16, 56, 34, 13);
    }
}

export function drawSpareAmmo(pen: Graphics, color: string, mystery: boolean): void {
    pen.clear();
    rounded(pen, mystery ? '#f8e9cb' : '#f6f3e8', -65, -17, 130, 34, 12);
    if (!color) return;
    const tint = mixRescueColors(color, INK, .28);
    fill(pen, tint, () => {
        pen.ellipse(-38, -4, 14, 7);
        pen.circle(-47, 4, 8);
    });
    fill(pen, color, () => {
        pen.ellipse(-37, -2, 13, 6);
        pen.circle(-46, 5, 7);
    });
    fill(pen, '#eaa650', () => pen.ellipse(-53, 2, 4, 2.5));
    fill(pen, INK, () => pen.circle(-48, 7, 1.3));
}

export function drawAmmoRack(pen: Graphics): void {
    rounded(pen, '#d8ded0', -299, -121, 598, 242, 23);
    rounded(pen, '#e7ebdc', -296, -115, 592, 234, 22);
    for (let col = 0; col < 4; col++) {
        const center = -222 + col * 148;
        rounded(pen, '#d3e3d8', center - 67, -108, 134, 216, 17);
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
