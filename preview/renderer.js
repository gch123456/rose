/* 割草模式网页试玩渲染层：仅用 Canvas 2D，读取 SurvivorGame 的状态。
   与 Cocos 版共用同一份规则源码（由 tools/build-preview.mjs 内联注入）。 */
(function () {
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const W = 640, H = 1120;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const C = {
        skyTop: '#DFF4F7', skyMid: '#F2FBE9', skyBottom: '#FFF3D6',
        grassA: '#CDEDC4', grassB: '#BFE4B4', grassLine: '#9FCE9B',
        hill: '#8FCFA8', hillShade: '#77BE95', cloud: '#FFFFFF', sun: '#FFE9A3',
        ink: '#33445C', inkSoft: '#6B7E93', panel: '#FFFBF0', edge: '#E7C88A', shade: '#F3E6C8',
        gold: '#FFC94A', goldDeep: '#E99A2E', sword: '#FFF3AF', swordEdge: '#FFB238',
        mint: '#4BD3A5', mintLight: '#A9F2D2', coral: '#FF6F79', lilac: '#B79CFF',
        damage: '#E4504C', crit: '#FF8A24', heart: '#FF6272', gem: '#42CF9C',
        gemLight: '#A5F5CE', enemy: '#3B4B63', danger: '#FF5D6B', white: '#FFFFFF',
        // 沉没地牢浅水遗迹地面（与 Cocos 端 Q 调色板一致）
        grassA: '#C6DADE', grassB: '#B0C2CC', grassLine: '#7A94B2', glowSpot: '#B2FAF4'
    };
    const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const col = (h, a = 1) => { const [r, g, b] = rgb(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
    const mix = (a, b, t) => {
        const x = rgb(a), y = rgb(b);
        return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
    };
    const noise = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const ease = t => t * t * (3 - 2 * t);
    const g = new SurvivorGame();
    // 沉没地牢背景贴图（由 build-preview.mjs 以 base64 注入）
    const bgImgs = {};
    for (const [key, src] of Object.entries(window.__GODUCK_BG || {})) {
        const img = new Image();
        img.onload = () => { bgImgs[key] = img; };
        img.src = src;
    }
    const keys = new Set();
    let charSel = 0;
    let intro = 0, settleFor = -1, clock = 0, lastRescued = 0, toast = 0, toastCount = 0;
    let finger = -1, origin = { x: 0, y: 0 }, stick = { x: 0, y: 0 };
    let soundOn = false, audio = null, soundAt = 0;

    function rr(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else {
            ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
        }
    }
    function fillCard(x, y, w, h, r, fill, a = 1, edge, ea = 1, lw = 2) {
        ctx.fillStyle = col(fill, a); rr(x, y, w, h, r); ctx.fill();
        if (edge) { ctx.strokeStyle = col(edge, ea); ctx.lineWidth = lw; rr(x, y, w, h, r); ctx.stroke(); }
    }
    function circle(x, y, r, fill, a = 1) { ctx.fillStyle = col(fill, a); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function ring(x, y, r, stroke, a = 1, lw = 2) { ctx.strokeStyle = col(stroke, a); ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    function glow(x, y, r, hex, alpha = .18, layers = 6) {
        for (let i = layers; i >= 1; i--) circle(x, y, r * i / layers, hex, alpha * Math.pow(1 - i / layers, 1.4));
    }
    function text(str, x, y, size, color, bold = false, align = 'center') {
        ctx.font = (bold ? 'bold ' : '') + size + 'px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
        ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
    }
    function heart(x, y, r, filled) {
        const c = col(C.heart, filled ? 1 : .16);
        circle(x - r * .45, y + r * .2, r * .55, C.heart, filled ? 1 : .16);
        circle(x + r * .45, y + r * .2, r * .55, C.heart, filled ? 1 : .16);
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - r, y - r * .1); ctx.lineTo(x, y - r * 1.2);
        ctx.lineTo(x + r, y - r * .1); ctx.closePath(); ctx.fill();
    }
    function diamond(x, y, r, fill, a = 1) {
        ctx.fillStyle = col(fill, a); ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x + r, y);
        ctx.lineTo(x, y - r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
    }
    function duck(x, y, k) {
        circle(x, y - 4 * k, 13 * k, C.gold);
        circle(x - 2 * k, y - 20 * k, 10 * k, '#FFE48A');
        ctx.fillStyle = C.goldDeep; ctx.beginPath(); ctx.moveTo(x + 7 * k, y - 20 * k);
        ctx.lineTo(x + 20 * k, y - 24 * k); ctx.lineTo(x + 7 * k, y - 27 * k); ctx.closePath(); ctx.fill();
        circle(x + 3 * k, y - 23 * k, 2.2 * k, C.ink);
        fillCard(x - 8 * k, y + 2 * k, 16 * k, 10 * k, 4 * k, C.mint, 1);
        circle(x - 6 * k, y - 8 * k, 3 * k, C.white, .75);
    }
    function button(x, y, w, h, label, primary) {
        fillCard(x - w / 2, y - h / 2, w, h, 22, primary ? C.gold : C.shade, 1, primary ? C.goldDeep : C.edge, .9, 2);
        text(label, x, y, primary ? 24 : 20, primary ? '#4A3410' : C.ink, true);
    }
    function hit(x, y, bx, by, w, h) { return Math.abs(x - bx) <= w / 2 && Math.abs(y - by) <= h / 2; }

    function startRun() {
        g.start(['shooter', 'warrior', 'mage'][charSel]);
        intro = 1.1; settleFor = -1; toast = 0; lastRescued = 0;
        if (soundOn && !audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } }
    }
    function beep(freq) {
        if (!soundOn || !audio || audio.state !== 'running') return;
        const now = audio.currentTime;
        if (now < soundAt) return;
        soundAt = now + .05;
        const o = audio.createOscillator(), gn = audio.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(freq, now);
        o.frequency.exponentialRampToValueAtTime(180, now + .08);
        gn.gain.setValueAtTime(.02, now); gn.gain.exponentialRampToValueAtTime(.001, now + .09);
        o.connect(gn); gn.connect(audio.destination); o.start(now); o.stop(now + .1);
    }

    // ── 输入 ────────────────────────────────────────────────────
    function uiPos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W - W / 2, y: H / 2 - (e.clientY - r.top) / r.height * H };
    }
    window.addEventListener('keydown', e => {
        keys.add(e.key);
        if ((e.key === 'Enter' || e.key === ' ') && g.phase !== 'playing') {
            if (g.phase === 'paused') g.phase = 'playing'; else startRun();
            return;
        }
        if (e.key === 'Escape' && g.phase === 'playing') g.phase = 'paused';
        else if (e.key === 'Escape' && g.phase === 'paused') g.phase = 'playing';
    });
    window.addEventListener('keyup', e => keys.delete(e.key));
    canvas.addEventListener('pointerdown', e => {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const p = uiPos(e), settling = (g.phase === 'won' || g.phase === 'lost') && settleFor >= 0 && settleFor < 2;
        if (settling) { settleFor = 2; return; }
        if (g.phase === 'menu') {
            for (const [cx, idx] of [[-140, 0], [0, 1], [140, 2]])
                if (hit(p.x, p.y, cx, 6, 128, 88)) charSel = idx;
            if (hit(p.x, p.y, 0, -110, 400, 76)) startRun();
            return;
        }
        if (g.phase === 'won' || g.phase === 'lost') {
            if (hit(p.x, p.y, 0, -120, 400, 76)) startRun();
            return;
        }
        if (g.phase === 'paused') {
            if (hit(p.x, p.y, 0, -120, 400, 76)) g.phase = 'playing';
            return;
        }
        if (p.y > H / 2 - 180) return;
        finger = e.pointerId; origin = p; stick = { x: 0, y: 0 };
    });
    canvas.addEventListener('pointermove', e => {
        if (e.pointerId !== finger) return;
        const p = uiPos(e), dx = p.x - origin.x, dy = p.y - origin.y, d = Math.max(65, Math.hypot(dx, dy));
        stick = { x: dx / d, y: dy / d };
    });
    const endPointer = e => { if (e.pointerId === finger) { finger = -1; stick = { x: 0, y: 0 }; } };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    // ── 场景 ────────────────────────────────────────────────────
    function backdrop() {
        const img = (g.phase === 'menu' ? (bgImgs.title || bgImgs.sunken) : bgImgs.sunken);
        if (img) {
            // 沉没地牢贴图：cover 取中，贴图之上只叠暗角。
            ctx.imageSmoothingEnabled = false;
            const scale = Math.max(W / 640, H / 1120), iw = 640 * scale, ih = 1120 * scale;
            ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
            for (let i = 0; i < 7; i++) {
                ctx.fillStyle = col(C.ink, .06 * (1 - i / 7));
                ctx.fillRect(0, i * H / 14, W, H / 14 + 1);
                ctx.fillRect(0, H - (i + 1) * H / 14, W, H / 14 + 1);
            }
            return;
        }
        for (let i = 0; i < 24; i++) {
            const t = i / 23;
            ctx.fillStyle = t < .5 ? mix(C.skyTop, C.skyMid, t * 2) : mix(C.skyMid, C.skyBottom, (t - .5) * 2);
            ctx.fillRect(0, i * H / 24, W, H / 24 + 1);
        }
        glow(-W * .29, H * .19, W * .62, C.sun, .16, 6);
        circle(-W * .29, H * .19, 58, C.sun, .92);
        circle(-W * .29 - 14, H * .19 - 16, 40, C.white, .58);
        for (let i = 0; i < 7; i++) {
            const seed = noise(i, 3), cx = (seed - .5) * (W + 200), cy = H * (.18 + (i % 3) * .14) + (noise(i, 9) - .5) * 90;
            const cw = 110 + noise(i, 11) * 90, ch = 26;
            ctx.fillStyle = col(C.cloud, .8);
            ctx.fillRect(cx - cw / 2, cy - ch, cw, ch);
            ctx.fillRect(cx - cw / 2 + 18, cy - ch - ch * .8, cw * .62, ch * .8);
            ctx.fillRect(cx - cw / 2 + 40, cy - ch - ch * 1.25, cw * .38, ch * .7);
        }
        for (let layer = 0; layer < 2; layer++) {
            const base = H - (layer === 0 ? 250 : 170);
            const step = 34;
            ctx.fillStyle = col(layer === 0 ? C.hill : C.hillShade, layer === 0 ? .7 : .8);
            for (let k = -12; k <= 12; k++) {
                const peak = (Math.sin(k * .55 + layer * 2) * .5 + .5) * (layer === 0 ? 90 : 62);
                ctx.fillRect(W / 2 + k * step, base - 90 - peak, step + 1, 90 + peak + 250);
            }
        }
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = col(C.ink, .06 * (1 - i / 7));
            ctx.fillRect(0, i * H / 14, W, H / 14 + 1);
            ctx.fillRect(0, H - (i + 1) * H / 14, W, H / 14 + 1);
        }
    }
    function ground() {
        const step = 80;
        const sx = x => W / 2 + x - g.x, sy = y => H / 2 - (y - g.y);
        const x0 = Math.floor((g.x - W / 2 - step) / step) * step, x1 = g.x + W / 2 + step;
        const y0 = Math.floor((g.y - H / 2 - step) / step) * step, y1 = g.y + H / 2 + step;
        for (let x = x0; x <= x1; x += step)
            for (let y = y0; y <= y1; y += step) {
                const gx = Math.floor(x / step), gy = Math.floor(y / step), r = noise(gx, gy);
                const px = sx(x), py = sy(y) - step;
                ctx.fillStyle = col((gx + gy) % 2 === 0 ? C.grassA : C.grassB, .88);
                ctx.fillRect(px, py, step, step);
                ctx.strokeStyle = col(C.grassLine, .28); ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + step, py); ctx.moveTo(px, py); ctx.lineTo(px, py + step); ctx.stroke();
                if (r > .82) {
                    const fx = px + 20 + r * 30, fy = py + 24 + noise(gy, gx) * 32;
                    ctx.fillStyle = col(r > .92 ? C.coral : C.glowSpot, .86);
                    for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6]]) ctx.fillRect(fx + dx - 4, fy + dy - 4, 8, 8);
                    ctx.fillStyle = col(C.gold, .94); ctx.fillRect(fx - 3, fy - 3, 6, 6);
                }
            }
        // 传送阵
        const px = sx(0), py = sy(0), R = 66;
        if (Math.abs(px) < W / 2 + R * 2 && Math.abs(py) < H / 2 + R * 2) {
            const spin = clock * 1.2, pulse = .55 + .45 * Math.sin(clock * 3);
            glow(px, py, R * 2.4, C.mint, .16 * pulse, 5);
            circle(px, py, R, C.panel, .82);
            ring(px, py, R, C.mint, .92, 5);
            ring(px, py, R * .74, C.gold, .75, 3);
            ctx.strokeStyle = col(C.lilac, .8); ctx.lineWidth = 3; ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = spin + i * Math.PI / 6, r0 = i % 3 === 0 ? R * .5 : R * .78;
                ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0);
                ctx.lineTo(px + Math.cos(a) * R * .95, py + Math.sin(a) * R * .95);
            }
            ctx.stroke();
            circle(px, py, R * .3, C.mintLight, .47 + .28 * pulse);
        }
        // 边界
        const limit = 850;
        ctx.strokeStyle = col(C.goldDeep, .6); ctx.lineWidth = 5; ctx.beginPath();
        for (const e of [[-limit, -limit, limit, -limit], [-limit, limit, limit, limit], [-limit, -limit, -limit, limit], [limit, -limit, limit, limit]]) {
            ctx.moveTo(sx(e[0]), sy(e[1])); ctx.lineTo(sx(e[2]), sy(e[3]));
        }
        ctx.stroke();
    }
    function worldLow() {
        const sx = x => W / 2 + x - g.x, sy = y => H / 2 - (y - g.y);
        glow(W / 2, H / 2, g.auraRadius * 1.7, C.gold, .09, 5);
        ring(W / 2, H / 2, g.auraRadius, C.gold, .5, 3);
        ctx.strokeStyle = col(C.white, .6); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const a = clock * .8 + i * Math.PI / 6;
            ctx.moveTo(W / 2 + Math.cos(a) * (g.auraRadius - 8), H / 2 + Math.sin(a) * (g.auraRadius - 8));
            ctx.lineTo(W / 2 + Math.cos(a) * g.auraRadius, H / 2 + Math.sin(a) * g.auraRadius);
        }
        ctx.stroke();
        for (const e of g.enemies) {
            if (e.dead) continue;
            const x = sx(e.x), y = sy(e.y);
            if (Math.abs(x - W / 2) > W / 2 + 50 || Math.abs(y - H / 2) > H / 2 + 50) continue;
            circle(x, y + 12, e.kind === 'brute' ? 24 : 15, C.ink, .13);
        }
        for (const d of g.gems) {
            const x = sx(d.x), y = sy(d.y);
            if (Math.abs(x - W / 2) > W / 2 + 30 || Math.abs(y - H / 2) > H / 2 + 30) continue;
            const bob = Math.sin(clock * 4 + d.bob) * 3, r = d.value > 2 ? 9 : 6;
            glow(x, y + bob, r * 3.2, C.gem, .14, 4);
            diamond(x, y + bob, r, C.gemLight, 1);
            ctx.fillStyle = col(C.white, .82); ctx.fillRect(x - r * .28, y + bob - r * .65, r * .5, r * .5);
        }
        for (const d of g.ducks) {
            const x = sx(d.x), y = sy(d.y);
            if (Math.abs(x - W / 2) > W / 2 + 50 || Math.abs(y - H / 2) > H / 2 + 50) continue;
            const bob = Math.sin(clock * 3.4 + d.bob) * 5;
            glow(x, y + bob, 46, C.mint, .16, 4);
            ring(x, y + bob - 4, 26, C.mint, .82, 3);
            duck(x, y + bob + 8, 1.05);
        }
    }
    function worldHigh() {
        const sx = x => W / 2 + x - g.x, sy = y => H / 2 - (y - g.y);
        // 敌人：亮色 Q 版像素块（网页预览无 png，用方块＋红眼代替）
        for (const e of g.enemies) {
            if (e.dead) continue;
            const x = sx(e.x), y = sy(e.y);
            if (Math.abs(x - W / 2) > W / 2 + 60 || Math.abs(y - H / 2) > H / 2 + 60) continue;
            const r = e.kind === 'brute' ? 22 : 14;
            ctx.fillStyle = e.kind === 'brute' ? '#7C63A8' : e.kind === 'runner' ? '#5A7BB8' : C.enemy;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
            ctx.fillStyle = col(C.white, .16); ctx.fillRect(x - r, y - r, r * 2, 5);
            ctx.fillStyle = C.danger; ctx.fillRect(x - r * .6, y - 2, r * .35, r * .35); ctx.fillRect(x + r * .2, y - 2, r * .35, r * .35);
            if (e.flash > 0) ring(x, y, r + 6, C.white, clamp(e.flash / .14, 0, 1) * .86, 3);
            if (e.kind === 'brute') {
                fillCard(x - 26, y - 40, 52, 7, 3, C.ink, .68);
                fillCard(x - 26, y - 40, 52 * clamp(e.hp / e.maxHp, 0, 1), 7, 3, C.coral, 1);
            }
        }
        const b = g.boss;
        if (b) {
            const x = sx(b.x), y = sy(b.y);
            if (b.state === 'windup') {
                ctx.strokeStyle = col(C.danger, .6); ctx.lineWidth = 26; ctx.beginPath();
                ctx.moveTo(x, y); ctx.lineTo(x + b.dx * 260, y - b.dy * 260); ctx.stroke();
            }
            glow(x, y, 120, C.coral, .14, 5);
            ctx.fillStyle = '#E2636E'; ctx.beginPath();
            ctx.moveTo(x - 42, y + 34); ctx.lineTo(x, y - 40); ctx.lineTo(x + 42, y + 34);
            ctx.lineTo(x + 20, y + 46); ctx.lineTo(x, y); ctx.lineTo(x - 20, y + 46); ctx.closePath(); ctx.fill();
            circle(x, y, 20, C.gold);
            ctx.fillStyle = C.ink; ctx.fillRect(x - 10, y - 4, 5, 8); ctx.fillRect(x + 5, y - 4, 5, 8);
            fillCard(W / 2 - 75, 152, 150, 12, 6, C.ink, .68);
            fillCard(W / 2 - 75, 152, 150 * clamp(b.hp / b.maxHp, 0, 1), 12, 6, C.coral, 1);
            text('巨型捕鸭夹', W / 2, 140, 17, C.ink, true);
        }
        // 万剑
        for (const s of g.swords) {
            const x = sx(s.x), y = sy(s.y);
            if (Math.abs(x - W / 2) > W / 2 + 60 || Math.abs(y - H / 2) > H / 2 + 60) continue;
            const len = s.crit ? 46 : 36, tx = x - s.dx * len, ty = y + s.dy * len;
            const edge = s.crit ? C.lilac : C.swordEdge;
            ctx.lineCap = 'round';
            ctx.strokeStyle = col(edge, .22); ctx.lineWidth = s.crit ? 14 : 10;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = col(edge, .92); ctx.lineWidth = s.crit ? 7 : 5;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = col(C.white, .95); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(tx + s.dx * 5, ty - s.dy * 5); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = s.crit ? C.white : C.sword;
            diamond(x, y, s.crit ? 6 : 4.5, s.crit ? C.white : C.sword, 1);
        }
        // 护身剑阵
        const spin = g.time * 3.4;
        for (let i = 0; i < g.orbitCount; i++) {
            const a = spin + i * Math.PI * 2 / g.orbitCount;
            const x = W / 2 + Math.cos(a) * g.orbitRadius, y = H / 2 - Math.sin(a) * g.orbitRadius;
            glow(x, y, 18, C.gold, .12, 3);
            diamond(x, y, 9, C.sword, 1);
        }
        // 主角鸭
        glow(W / 2, H / 2, 44, C.gold, .1, 4);
        ring(W / 2, H / 2, 27, C.white, .88, 3);
        duck(W / 2, H / 2 + 8, 1.35);
        // 特效
        for (const f of g.effects) {
            const x = sx(f.x), y = sy(f.y), t = 1 - f.life / f.duration, r = f.radius * (.35 + .65 * t);
            const hex = f.kind === 'thunder' ? C.gold : f.kind === 'level' ? C.mint
                : f.kind === 'upgrade' ? C.gold : f.kind === 'rescue' ? C.mint : f.kind === 'boss' ? C.danger : C.lilac;
            ring(x, y, r, hex, .86 * (1 - t), f.kind === 'level' ? 6 : 4);
            if (f.kind === 'thunder') {
                ctx.strokeStyle = col(C.white, .9 * (1 - t)); ctx.lineWidth = 3; ctx.beginPath();
                ctx.moveTo(x - 8, y - 150); ctx.lineTo(x + 6, y - 40); ctx.lineTo(x - 5, y - 12); ctx.lineTo(x + 9, y + 40); ctx.stroke();
            }
        }
        for (const q of g.particles) {
            const x = sx(q.x), y = sy(q.y);
            if (Math.abs(x - W / 2) > W / 2 + 20 || Math.abs(y - H / 2) > H / 2 + 20) continue;
            ctx.fillStyle = col(q.color, .9 * clamp(q.life / q.duration, 0, 1));
            ctx.fillRect(x - q.size / 2, y - q.size / 2, q.size, q.size);
        }
        // 伤害数字
        for (const f of g.floats) {
            const a = clamp(f.life / .28, 0, 1);
            const hex = f.kind === 'crit' ? C.crit : f.kind === 'rescue' ? '#1E9E72' : f.kind === 'heal' ? '#3CB37A' : C.damage;
            text(f.text, sx(f.x), sy(f.y) - (1 - f.life / f.duration) * 42, f.kind === 'crit' ? 26 : 20, col(hex, a), true);
        }
    }
    function hud() {
        fillCard(14, 16, W - 28, 132, 24, C.panel, .93, C.edge, .92, 3);
        fillCard(26, 30, W - 52, 6, 3, C.gold, .78);
        for (let i = 0; i < g.maxHp; i++) heart(36 + i * 26, 68, 9, i < g.hp);
        const barW = W - 60;
        fillCard(30, 138, barW, 9, 5, C.shade, 1);
        fillCard(30, 138, Math.max(9, barW * g.progress), 9, 5, C.mint, 1);
        const left = Math.max(0, Math.ceil((g.boss ? g.limit : g.duration) - g.time));
        const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
        text(mm + ':' + ss + '   第 ' + g.wave + ' 波   Lv.' + g.level, W / 2, 74, 24, C.ink, true);
        text('击退 ' + g.kills + '   救出 ' + g.totalRescued + ' 只   连斩 ' + g.combo, W / 2, 104, 18, C.inkSoft);
        text('万剑 ×' + g.bladeCount + ' · 剑阵 ' + g.orbitCount + ' · 雷劫 ' + g.thunderCount + ' · 领域 ' + Math.round(g.auraRadius), W / 2, 126, 17, C.inkSoft);
        fillCard(14, H - 112, W - 28, 96, 24, C.panel, .93, C.edge, .92, 3);
        const slotW = (W - 44) / 6, slotColors = [C.gold, C.mintLight, C.lilac, C.sun, C.grassB, C.coral];
        g.skillLevels.forEach((sk, i) => {
            const cx = W / 2 + (i - 2.5) * slotW;
            fillCard(cx - slotW / 2 + 5, H - 102, slotW - 10, 76, 14, sk.hot ? slotColors[i] : C.shade, sk.hot ? .92 : .7, sk.hot ? C.goldDeep : C.edge, .75, 2);
            text(sk.icon + ' ' + sk.level, cx, H - 64, 18, sk.hot ? C.goldDeep : C.inkSoft, true);
        });
        const tip = g.boss ? '击败巨型捕鸭夹！剩余 ' + Math.max(0, Math.ceil(g.limit - g.time)) + ' 秒'
            : '捡绿色魂珠自动成长 · 每 ' + g.killsPerDuck + ' 次击退多救 1 只鸭';
        fillCard(W / 2 - Math.min(W - 48, Math.max(250, tip.length * 16)) / 2, H - 154, Math.min(W - 48, Math.max(250, tip.length * 16)), 38, 19, C.panel, .86, C.edge, .62, 2);
        text(tip, W / 2, H - 135, 18, C.ink, true);
        if (g.noticeFor > 0) {
            const bw = Math.min(W - 56, Math.max(260, g.notice.length * 27));
            fillCard(W / 2 - bw / 2, 322, bw, 58, 29, C.panel, .92, C.gold, .8, 2);
            text(g.notice, W / 2, 351, 23, C.goldDeep, true);
        }
        if (toast > 0) {
            fillCard(W / 2 - 170, H - 300 - (1 - toast) * 50, 340, 48, 24, C.panel, .94, C.mint, .86, 2);
            text('+' + toastCount + ' 只鸭免于上餐桌', W / 2, H - 276 - (1 - toast) * 50, 21, C.mint, true);
        }
        if (finger !== -1) {
            const ox = W / 2 + origin.x, oy = H / 2 - origin.y;
            circle(ox, oy, 68, C.panel, .37); ring(ox, oy, 68, C.ink, .28, 3);
            circle(ox + stick.x * 50, oy - stick.y * 50, 21, C.mint, .82);
        }
    }
    /** 自动升级飘条：右上角依次滑入，纯展示，不铺遮罩、不拦输入、不暂停世界。 */
    function upgradeToasts() {
        g.upgradeToasts.forEach((t, i) => {
            const fade = Math.min(1, t.life / .45);
            const x = W - 311, y = 218 + i * 54;
            const inT = Math.max(0, Math.min(1, (t.duration - t.life) / .18));
            const slide = (1 - inT) * 60;
            fillCard(x + slide, y, 290, 46, 23, C.panel, .94 * fade, C.gold, .82 * fade, 2);
            circle(x + 26 + slide, y + 23, 7, C.gold, fade);
            text(t.icon + ' ' + t.name + ' Lv.' + t.level, x + 158 + slide, y + 23, 20, col(C.ink, fade), true);
        });
    }
    function introFx() {
        const t = 1 - intro / 1.1, fade = Math.min(1, t * 5) * Math.min(1, (1 - t) * 5);
        const R = 80 + 170 * Math.min(1, t * 1.6), spin = clock * 3.2;
        ctx.fillStyle = col(C.panel, .84 * fade); ctx.fillRect(0, 0, W, H);
        glow(W / 2, H / 2, R * 2.4, C.mint, .2 * fade, 6);
        glow(W / 2, H / 2, R * 1.3, C.gold, .17 * fade, 5);
        for (let k = 0; k < 3; k++) ring(W / 2, H / 2, R * (1 - k * .24), [C.gold, C.mint, C.lilac][k], (.9 - k * .2) * fade, 5 - k);
        ctx.strokeStyle = col(C.white, .78 * fade); ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i < 16; i++) {
            const a = spin + i * Math.PI / 8;
            ctx.moveTo(W / 2 + Math.cos(a) * R * .82, H / 2 + Math.sin(a) * R * .82);
            ctx.lineTo(W / 2 + Math.cos(a) * R * .97, H / 2 + Math.sin(a) * R * .97);
        }
        ctx.stroke();
        duck(W / 2, H / 2 + 20, clamp(t * 2.2, .05, 1) * 3.4);
        text('传送阵启动 · 鸭子入场！', W / 2, H / 2 + 130, 26, col(C.goldDeep, fade), true);
    }
    function settlement() {
        const t = clamp(settleFor / 2, 0, 1), R = 70 + 60 * ease(Math.min(1, t * 1.5));
        ctx.fillStyle = col(C.panel, .88); ctx.fillRect(0, 0, W, H);
        glow(W / 2, H / 2 - 40, R * 2.6, C.mint, .18, 6);
        ring(W / 2, H / 2 - 40, R, C.gold, .9, 6);
        ring(W / 2, H / 2 - 40, R * .74, C.white, .86, 3);
        const n = Math.min(12, Math.max(1, Math.floor(g.totalRescued / 4)));
        for (let i = 0; i < n; i++) {
            const a = i * 2.399 + clock * .6, rise = ease(Math.min(1, t * 1.3 + i * .03));
            const rr2 = (20 + (i % 4) * 16) * (1 - rise * .7);
            duck(W / 2 + Math.cos(a) * rr2, H / 2 - 40 - Math.sin(a) * rr2 * .6 - rise * 90, 1 - rise * .45);
        }
        text(g.phase === 'won' ? '突围成功！' : '战斗结束', W / 2, 180, 40, C.goldDeep, true);
        text('点按任意处跳过', W / 2, H - 120, 19, C.inkSoft);
    }
    function menuPanel() {
        ctx.fillStyle = col(C.panel, .68); ctx.fillRect(0, 0, W, H);
        glow(W / 2, 230, 380, C.gold, .16, 7);
        ring(W / 2, 230, 82, C.gold, .82, 5);
        ring(W / 2, 230, 98, C.white, .75, 2.5);
        duck(W / 2, 236, 2.2);
        fillCard(20, 320, W - 40, 480, 32, C.panel, .9, C.edge, .92, 3);
        fillCard(38, 336, W - 76, 6, 3, C.gold, .7);
        text('鸭命要紧', W / 2, 380, 52, C.goldDeep, true);
        text('万剑自动清场 · 捡魂珠自动成长 · 救鸭免于上餐桌', W / 2, 430, 19, C.inkSoft);
        text('选择职业鸭', W / 2, 480, 19, C.inkSoft);
        const names = ['御剑鸭', '剑阵鸭', '引雷鸭'];
        names.forEach((n, i) => {
            const x = W / 2 + (i - 1) * 140;
            fillCard(x - 64, 510, 128, 88, 16, charSel === i ? C.gold : C.shade, charSel === i ? .95 : .8,
                charSel === i ? C.goldDeep : C.edge, .8, 2);
            text(n, x, 542, 20, charSel === i ? C.goldDeep : C.ink, true);
            text(charSel === i ? '✓ 已选择' : '点击选择', x, 574, 16, C.inkSoft);
        });
        button(W / 2, 670, 400, 76, '开始割草', true);
        text('单指拖动 / WASD 移动 · 武器全自动', W / 2, 745, 18, C.inkSoft);
        text('成长自动发放、不打断战斗 · 每 ' + g.killsPerDuck + ' 次击退多救 1 只鸭', W / 2, 772, 18, C.inkSoft);
        text('经典模式请在微信体验版中切换', W / 2, 799, 17, C.inkSoft);
        text('按 Enter / 空格 也可开局', W / 2, 860, 17, C.inkSoft);
    }
    function pausePanel() {
        ctx.fillStyle = col(C.panel, .68); ctx.fillRect(0, 0, W, H);
        fillCard(20, 320, W - 40, 480, 32, C.panel, .92, C.edge, .92, 3);
        text('暂停一下', W / 2, 390, 46, C.goldDeep, true);
        text('Lv.' + g.level + ' · 击退 ' + g.kills + ' · 救出 ' + g.totalRescued + ' 只', W / 2, 470, 21, C.ink);
        text('万剑 ×' + g.bladeCount + ' · 剑阵 ' + g.orbitCount + ' · 雷劫 ' + g.thunderCount, W / 2, 510, 19, C.inkSoft);
        button(W / 2, 680, 400, 76, '继续割草', true);
        text('按 Esc / Enter 继续', W / 2, 750, 17, C.inkSoft);
    }
    function resultPanel() {
        ctx.fillStyle = col(C.panel, .68); ctx.fillRect(0, 0, W, H);
        fillCard(20, 320, W - 40, 480, 32, C.panel, .92, C.edge, .92, 3);
        text(g.phase === 'won' ? '突围成功！' : '被做成鸭货了…', W / 2, 375, 42, C.goldDeep, true);
        text(g.totalRescued + ' 只鸭', W / 2, 450, 62, C.goldDeep, true);
        text('免于上餐桌', W / 2, 505, 26, C.ink, true);
        text('传送阵撤离 ' + g.rescued + ' 只 · 斩妖放生 ' + g.freed + ' 只'
            + (g.rescueBonus ? ' · 突围加成 ' + g.rescueBonus + ' 只' : ''), W / 2, 548, 17, C.inkSoft);
        text('第 ' + g.wave + ' 波 · Lv.' + g.level + ' · 击退 ' + g.kills
            + ' · 万剑 ×' + g.bladeCount, W / 2, 582, 18, C.inkSoft);
        text('用时 ' + Math.floor(g.time) + ' 秒' + (g.deathCause ? ' · 死因：' + g.deathCause : ''), W / 2, 610, 17, C.inkSoft);
        button(W / 2, 680, 400, 76, '再来一局', true);
        text('按 Enter / 空格 也可重开', W / 2, 750, 17, C.inkSoft);
    }

    let prev = performance.now();
    function frame(now) {
        const dt = Math.min(.05, (now - prev) / 1000);
        prev = now; clock += dt;
        const mx = stick.x + Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft'));
        const my = stick.y + Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown'));
        if (g.phase === 'playing' && intro > 0) intro = Math.max(0, intro - dt);
        else g.tick(dt, mx, my);
        const events = g.events.slice(); g.events = [];
        if (events.includes('level')) beep(980);
        else if (events.includes('upgrade')) beep(900);
        else if (events.includes('thunder')) beep(170);
        else if (events.includes('hurt')) beep(110);
        else if (events.includes('rescue')) beep(720);
        else if (events.includes('kill')) beep(650);
        else if (events.includes('shot')) beep(300);
        if (g.totalRescued !== lastRescued) { toastCount = g.totalRescued - lastRescued; lastRescued = g.totalRescued; toast = 1.1; }
        toast = Math.max(0, toast - dt);
        if (g.phase === 'won' || g.phase === 'lost') {
            if (settleFor < 0) settleFor = 0;
            else if (settleFor < 2) settleFor += dt;
        } else settleFor = -1;
        ctx.save();
        const sh = g.shake * 9, ox = Math.sin(clock * 61) * sh, oy = Math.cos(clock * 47) * sh;
        backdrop();
        const inGame = g.phase === 'playing' || g.phase === 'paused';
        if (inGame) {
            ctx.translate(ox, oy);
            ground(); worldLow(); worldHigh();
            ctx.translate(-ox, -oy);
            hud();
            if (intro > 0) introFx();
            upgradeToasts();
            if (g.phase === 'paused') pausePanel();
        } else if ((g.phase === 'won' || g.phase === 'lost') && settleFor >= 0 && settleFor < 2) {
            settlement();
        } else if (g.phase === 'menu') menuPanel();
        else resultPanel();
        ctx.restore();
        requestAnimationFrame(frame);
    }
    // 调试/截图入口：?auto=1 直接开局，&fast=N 快进 N 秒战斗，便于验收画面。
    const params = new URLSearchParams(location.search);
    window.__mow = { g, startRun, skipIntro: () => { intro = 0; } };
    if (params.has('auto')) {
        startRun();
        intro = 0;
        const secs = Math.min(90, Number(params.get('fast') || 0));
        for (let i = 0; i < secs * 60; i++) {
            g.tick(1 / 60, Math.sin(i / 40) * .6, Math.cos(i / 33) * .6);
            if (g.phase !== 'playing') break;
        }
        // ?upgrade=1 强制显示一组飘条用于画面验收（仅调试参数）。
        if (params.has('upgrade')) {
            g.experience(g.nextXp + 1);
            for (let i = 0; i < 60 && !g.upgradeToasts.length; i++)
                g.tick(.05, 0, 0);
            // duration 略大于 life，保持「已入场」状态，避免调试飘条停在滑入途中被裁切。
            g.upgradeToasts.forEach(t => { t.life = 99; t.duration = 100; });
        }
    }
    requestAnimationFrame(frame);
})();
