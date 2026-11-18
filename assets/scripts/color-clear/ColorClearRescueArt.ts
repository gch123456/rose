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
const BRASS = '#e7ae62';

function rounded(pen: Graphics, color: string, x: number, y: number, w: number, h: number, radius: number): void {
    fill(pen, color, () => pen.roundRect(x, y, w, h, radius));
}

export function drawRescueModule(pen: Graphics, w: number, h: number, color: string): void {
    pen.clear();
    const x = -w / 2, y = -h / 2;
    const edge = mixRescueColors(color, INK, .47);
    const enamel = mixRescueColors(color, '#fff5d9', .20);
    const highlight = mixRescueColors(color, '#ffffff', .68);
    // Two bumpers and the dark gasket sit underneath the molded shell.
    rounded(pen, '#162f32a0', x + 5, y, w - 10, h - 4, 14);
    rounded(pen, INK, x + 6, y + 5, w - 12, h - 19, 16);
    rounded(pen, edge, x + 7, y + 10, w - 14, h - 24, 14);
    rounded(pen, color, x + 9, y + 16, w - 18, h - 29, 13);
    rounded(pen, enamel, x + 12, y + 23, w - 24, h - 41, 11);
    // The case itself is shaped around the little upward beak and the wings.
    const nose = x + w * .31;
    fill(pen, edge, () => {
        pen.moveTo(nose - 22, y + 26);
        pen.bezierCurveTo(nose - 27, y + 39, nose - 22, y + 66, nose - 3, y + 67);
        pen.bezierCurveTo(nose + 9, y + 68, nose + 16, y + 59, nose + 16, y + 48);
        pen.lineTo(nose + 15, y + 29);
        pen.quadraticCurveTo(nose - 3, y + 10, nose - 22, y + 26);
        pen.close();
    });
    fill(pen, enamel, () => {
        pen.moveTo(nose - 21, y + 29);
        pen.bezierCurveTo(nose - 26, y + 43, nose - 15, y + 65, nose - 2, y + 65);
        pen.bezierCurveTo(nose + 9, y + 65, nose + 14, y + 56, nose + 14, y + 47);
        pen.lineTo(nose + 13, y + 32);
        pen.quadraticCurveTo(nose - 4, y + 18, nose - 21, y + 29);
        pen.close();
    });
    fill(pen, '#bd7443', () => {
        pen.moveTo(nose + 8, y + 49);
        pen.quadraticCurveTo(nose + 19, y + 55, nose + 27, y + 49);
        pen.quadraticCurveTo(nose + 27, y + 42, nose + 8, y + 43);
        pen.close();
    });
    fill(pen, '#ffc974', () => {
        pen.moveTo(nose + 8, y + 50);
        pen.quadraticCurveTo(nose + 18, y + 57, nose + 26, y + 49);
        pen.quadraticCurveTo(nose + 26, y + 46, nose + 8, y + 46);
        pen.close();
    });
    fill(pen, INK, () => pen.circle(nose + 4, y + 55, 2.5));
    fill(pen, highlight, () => {
        pen.ellipse(nose - 10, y + 57, 6, 3);
        pen.ellipse(nose - 10, y + 36, 9, 4.8);
    });
    rounded(pen, edge, w / 2 - 62, y + 20, 52, 29, 8);
    rounded(pen, '#fff8e3', w / 2 - 60, y + 22, 48, 26, 7);
    rounded(pen, BRASS, x + 18, y + 7, 17, 5, 2);
    rounded(pen, BRASS, w / 2 - 35, y + 7, 17, 5, 2);
}

export function drawLauncher(pen: Graphics, color: string | undefined, locked: boolean): void {
    pen.clear();
    rounded(pen, '#203c43', -44, -38, 88, 73, 15);
    rounded(pen, '#6c9295', -41, -34, 82, 69, 13);
    rounded(pen, '#31535b', -36, -27, 72, 57, 10);
    rounded(pen, '#213b45', -32, -24, 64, 49, 8);
    if (locked) {
        rounded(pen, '#52757c', -28, -19, 56, 37, 9);
        fill(pen, '#9cb2a9', () => {
            pen.circle(-22, 11, 2);
            pen.circle(22, 11, 2);
        });
        return;
    }
    rounded(pen, '#263e45', -18, 20, 36, 18, 7);
    rounded(pen, color ?? '#8aaba8', -15, 24, 30, 13, 6);
    fill(pen, '#274952', () => pen.ellipse(0, 32, 10, 4));
    if (color) {
        rounded(pen, mixRescueColors(color, INK, .3), -31, -18, 62, 37, 9);
        rounded(pen, color, -29, -13, 58, 33, 8);
        rounded(pen, '#fffae7', -26, -10, 52, 25, 7);
    }
    rounded(pen, color ? '#ffc66b' : '#729699', -8, -32, 16, 4, 2);
}

export function drawSpareAmmo(pen: Graphics, color: string, mystery: boolean): void {
    pen.clear();
    rounded(pen, '#24424b', -66, -18, 132, 36, 9);
    rounded(pen, '#496a70', -64, -15, 128, 32, 8);
    rounded(pen, mystery ? '#6b6457' : '#35545e', -62, -13, 124, 26, 7);
    if (color) {
        rounded(pen, mixRescueColors(color, INK, .32), -56, -11, 25, 22, 6);
        rounded(pen, color, -54, -7, 21, 17, 5);
        rounded(pen, mixRescueColors(color, '#ffffff', .64), -52, 3, 13, 3, 1.5);
    }
}

export function drawAmmoRack(pen: Graphics): void {
    rounded(pen, '#203e46', -300, -121, 600, 242, 24);
    rounded(pen, '#7a9d98', -296, -115, 592, 234, 22);
    rounded(pen, '#436970', -291, -108, 582, 220, 18);
    rounded(pen, '#33515b', -287, -105, 574, 207, 17);
    for (let col = 0; col < 4; col++) {
        const center = -222 + col * 148;
        rounded(pen, '#253e48', center - 67, -106, 134, 218, 16);
        rounded(pen, '#53737a', center - 64, -102, 128, 206, 14);
    }
}

export function drawPond(pen: Graphics, wizard: boolean): void {
    fill(pen, wizard ? '#708f9d' : '#7ba196', () => pen.roundRect(-300, -281, 600, 562, 38));
    fill(pen, wizard ? '#9db3b5' : '#a9bb98', () => pen.circle(204, 174, 56));
    fill(pen, wizard ? '#608b98' : '#6c9c90', () => {
        pen.moveTo(-295, -58);
        pen.bezierCurveTo(-175, 53, -131, 48, -42, -22);
        pen.bezierCurveTo(65, -86, 171, 67, 295, -15);
        pen.lineTo(295, -201);
        pen.lineTo(-295, -201);
        pen.close();
    });
    fill(pen, wizard ? '#4c7887' : '#588e86', () => {
        pen.moveTo(-297, -129);
        pen.bezierCurveTo(-177, -93, -84, -160, 46, -121);
        pen.bezierCurveTo(148, -86, 234, -112, 297, -90);
        pen.lineTo(297, -238);
        pen.quadraticCurveTo(297, -278, 251, -278);
        pen.lineTo(-251, -278);
        pen.quadraticCurveTo(-297, -278, -297, -238);
        pen.close();
    });
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
