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

export function drawDuckCapsule(pen: Graphics, width: number, height: number, color: string, compact: boolean): void {
    pen.clear();
    const radius = height * .43;
    const edge = mixRescueColors(color, '#234a41', .33);
    const shine = mixRescueColors(color, '#ffffff', .72);
    fill(pen, '#27494024', () => pen.roundRect(-width / 2 + 3, -height / 2, width - 6, height - 4, radius));
    fill(pen, edge, () => pen.roundRect(-width / 2 + 1, -height / 2 + 3, width - 2, height - 5, radius));
    fill(pen, color, () => pen.roundRect(-width / 2 + 2, -height / 2 + 8, width - 4, height - 10, radius));
    if (compact) {
        fill(pen, shine, () => pen.roundRect(-width * .31, height * .25, width * .43, 3, 1.5));
        return;
    }
    fill(pen, shine, () => pen.roundRect(-width * .32, height * .26, width * .47, 5, 2.5));
    // A small duck in profile on the shell leaves the ammo count unobstructed.
    const x = -width * .28;
    fill(pen, '#fff9eae8', () => {
        pen.ellipse(x - 4, -3, 12, 8);
        pen.circle(x + 2, 4, 8);
    });
    fill(pen, '#e98738', () => pen.ellipse(x + 10, 2, 5, 2.7));
    fill(pen, '#315851', () => pen.circle(x + 4, 6, 1.4));
}

export function drawPond(pen: Graphics, wizard: boolean): void {
    fill(pen, wizard ? '#ecedfb' : '#edf8f3', () => pen.roundRect(-300, -281, 600, 562, 38));
    fill(pen, wizard ? '#f7f4ffff' : '#fff8dd', () => pen.circle(204, 174, 56));
    fill(pen, wizard ? '#e2e9f7' : '#ddece1', () => {
        pen.moveTo(-295, -58);
        pen.bezierCurveTo(-175, 53, -131, 48, -42, -22);
        pen.bezierCurveTo(65, -86, 171, 67, 295, -15);
        pen.lineTo(295, -201);
        pen.lineTo(-295, -201);
        pen.close();
    });
    fill(pen, wizard ? '#d4e9ed' : '#cfeade', () => {
        pen.moveTo(-297, -129);
        pen.bezierCurveTo(-177, -93, -84, -160, 46, -121);
        pen.bezierCurveTo(148, -86, 234, -112, 297, -90);
        pen.lineTo(297, -238);
        pen.quadraticCurveTo(297, -278, 251, -278);
        pen.lineTo(-251, -278);
        pen.quadraticCurveTo(-297, -278, -297, -238);
        pen.close();
    });
    fill(pen, '#ffffff9c', () => {
        pen.roundRect(-246, 150, 103, 12, 6);
        pen.roundRect(-200, 170, 67, 9, 5);
        pen.roundRect(156, 101, 87, 10, 5);
        pen.roundRect(-257, -205, 70, 5, 3);
        pen.roundRect(177, -183, 76, 5, 3);
        pen.roundRect(127, -235, 80, 4, 2);
    });
    fill(pen, '#477e7335', () => pen.ellipse(0, -226, 174, 21));
    fill(pen, '#e2b681', () => pen.ellipse(0, -216, 166, 29));
    fill(pen, '#f9e2b7', () => pen.ellipse(0, -207, 166, 26));
    pen.strokeColor = new Color('#bb8e6159');
    pen.lineWidth = 2;
    for (let y = -213; y <= -194; y += 10) {
        pen.moveTo(-124, y);
        pen.quadraticCurveTo(0, y - 9, 130, y);
    }
    pen.stroke();
    fill(pen, '#82bca0', () => {
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
