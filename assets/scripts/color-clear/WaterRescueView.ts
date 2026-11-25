import {
    _decorator, AudioClip, AudioSource, BlockInputEvents, Camera, Canvas, Color, Component,
    EventTouch, Game, Graphics, ImageAsset, Input, Label, Layers, Node, ResolutionPolicy,
    Sprite, SpriteFrame, Texture2D, UITransform, game, input, isValid, resources, screen, sys, view,
} from 'cc';
import {AlbumService} from './ColorClearAlbum';
import {wechatAlbumTransport} from './ColorClearWechat';
import {fitRescueScreen} from './ColorClearNativeStyle';
import {WaterRescueGame} from './WaterRescueGame';
import type {Valve, WaterArrival} from './WaterRescueGame';
import {DIR, PIPE_COLUMNS, PIPE_LAYOUTS, PIPE_ROWS, WaterRoutingGame} from './WaterRoutingGame';
import {WaterRescueScene} from './WaterRescueScene';

const {ccclass} = _decorator;
const BG_LAYER = 1 << 18;
const WIDTH = 640;
const HEIGHT = 1120;
const INK = '#092d2c';
const PAPER = '#fff4db';
const MUSIC_KEY = 'color-clear.music';
const EFFECTS_KEY = 'color-clear.muted';
const ROUTING_BEST_KEY = 'color-clear.water-routing.best.';
const PIPE_INK = '#0b3436';
const FEED_COLORS = ['#9aab9a', '#76f4ce', '#88d9ff', '#ffe393'];
const PIPE_ORIGIN_Y = -242;
const PIPE_SPACING_X = 102;
const PIPE_SPACING_Y = 91;
const PIPE_ARMS = [
    [DIR.north, 0, PIPE_SPACING_Y / 2], [DIR.east, PIPE_SPACING_X / 2, 0],
    [DIR.south, 0, -PIPE_SPACING_Y / 2], [DIR.west, -PIPE_SPACING_X / 2, 0],
] as const;
const VALVES = [
    {id: 'left', name: '左水阀', color: '#7ad8cb'},
    {id: 'right', name: '右水阀', color: '#83cbee'},
    {id: 'drain', name: '排洪阀', color: '#ffd883'},
] as const;
type Button = {node: Node; plate: Graphics; title: Label; note: Label};
type Modal = 'settings' | 'album';
type Screen = 'home' | 'play' | 'won';
const IMPACT_SOUND: Record<WaterArrival, string> = {left: 'water-hit', right: 'water-hit', merge: 'water-merge', drain: 'water-drain'};

@ccclass('WaterRescueView')
export class WaterRescueView extends Component {
    openLegacy?: () => void;
    private readonly albumApiOrigin = '';
    private level = new WaterRescueGame();
    private routing: WaterRoutingGame | null = null;
    private nextLayout = 0;
    private routingLayout = 0;
    private bestMoves = 0;
    private sculpture!: WaterRescueScene;
    private album!: AlbumService;
    private camera!: Camera;
    private ui!: Node;
    private backdrop!: Node;
    private home!: Node;
    private play!: Node;
    private won!: Node;
    private modal!: Node;
    private modalType: Modal | null = null;
    private sceneState: Screen = 'home';
    private status!: Label;
    private playTitle!: Label;
    private tutorialPanel!: Node;
    private routingPanel!: Node;
    private routingCanvas!: Graphics;
    private routingStatus!: Label;
    private routingSteps!: Label;
    private routingDrain!: Button;
    private victoryRecord!: Label;
    private nextRoutingButton!: Button;
    private eventLabel!: Label;
    private eventAt = -Infinity;
    private resultAt = Infinity;
    private controls = new Map<Valve, Button>();
    private landscape!: Sprite;
    private texture?: Texture2D;
    private frame?: SpriteFrame;
    private effects!: AudioSource;
    private soundtrack!: AudioSource;
    private readonly clips = new Map<string, AudioClip>();
    private musicEnabled = true;
    private effectsMuted = false;
    private audioReady = false;
    private foreground = true;
    private clock = 0;
    private frameTime = 0;
    private fit = {x: 0, y: 0, scale: 1};
    private dragId: number | null = null;
    private idleAt = 0;
    private yaw = -12;
    private pitch = 7;

    onLoad(): void {
        view.setDesignResolutionSize(WIDTH, HEIGHT, ResolutionPolicy.SHOW_ALL);
        this.album = new AlbumService(sys.localStorage, wechatAlbumTransport(this.albumApiOrigin));
        this.createWorld();
        this.createBackdrop();
        this.ui = this.canvas('Rescue UI', Layers.Enum.UI_2D, 20, false);
        this.home = this.layer(this.ui, 'Water camp');
        this.play = this.layer(this.ui, 'Water playground');
        this.won = this.layer(this.ui, 'Water victory');
        this.createHome();
        this.createPlay();
        this.createVictory();
        this.modal = this.layer(this.ui, 'Water dialog');
        this.modal.active = false;
        this.effects = this.node.addComponent(AudioSource);
        this.soundtrack = this.node.addComponent(AudioSource);
        this.soundtrack.playOnAwake = false;
        this.soundtrack.loop = true;
        this.soundtrack.volume = .13;
        for (const id of ['water-valve', 'water-hit', 'water-merge', 'water-drain', 'water-duck']) {
            resources.load('color-clear-audio/' + id, AudioClip, (error, clip) => {
                if (!error && clip && isValid(this.node)) this.clips.set(id, clip);
            });
        }
        resources.load('color-clear-audio/camp', AudioClip, (error, clip) => {
            if (error || !clip || !isValid(this.node)) return;
            this.soundtrack.clip = clip;
            this.syncMusic();
        });
        this.readPreferences();
        this.show('home');
        view.on('canvas-resize', this.layout, this);
        view.on('design-resolution-changed', this.layout, this);
        input.on(Input.EventType.TOUCH_START, this.beginDrag, this);
        input.on(Input.EventType.TOUCH_MOVE, this.drag, this);
        input.on(Input.EventType.TOUCH_END, this.endDrag, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.endDrag, this);
        game.on(Game.EVENT_HIDE, this.hide, this);
        game.on(Game.EVENT_SHOW, this.restore, this);
    }

    private layer(parent: Node, name: string, layer = parent.layer): Node {
        const node = new Node(name);
        node.layer = layer;
        parent.addChild(node);
        return node;
    }

    private canvas(name: string, layer: number, priority: number, clear: boolean): Node {
        const host = this.layer(this.node, name, layer);
        host.addComponent(UITransform).setContentSize(WIDTH, HEIGHT);
        const camera = this.layer(this.node, name + ' camera').addComponent(Camera);
        camera.node.setPosition(0, 0, 1000);
        camera.priority = priority;
        camera.orthoHeight = HEIGHT / 2;
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.far = 2000;
        camera.visibility = layer;
        camera.clearColor = new Color('#133f3d');
        camera.clearFlags = clear ? Camera.ClearFlag.SOLID_COLOR : Camera.ClearFlag.DEPTH_ONLY;
        host.addComponent(Canvas).cameraComponent = camera;
        return this.layer(host, name + ' layout');
    }

    private createBackdrop(): void {
        this.backdrop = this.canvas('Greenhouse', BG_LAYER, -20, true);
        const art = this.layer(this.backdrop, 'Water garden artwork');
        art.addComponent(UITransform).setContentSize(WIDTH, HEIGHT);
        this.landscape = art.addComponent(Sprite);
        this.landscape.sizeMode = Sprite.SizeMode.CUSTOM;
        resources.load('color-clear-release/water-garden', ImageAsset, (error, image) => {
            if (error || !image || !isValid(this.node)) return;
            const texture = this.texture = new Texture2D();
            texture.image = image;
            const frame = this.frame = new SpriteFrame();
            frame.texture = texture;
            this.landscape.spriteFrame = frame;
            this.layout();
        });
    }

    private createWorld(): void {
        const world = this.layer(this.node, 'Water stage', Layers.Enum.DEFAULT);
        world.setPosition(0, 0, 0);
        this.camera = this.layer(world, 'Water stage camera').addComponent(Camera);
        this.camera.node.setPosition(0, 0, 20);
        this.camera.projection = Camera.ProjectionType.ORTHO;
        this.camera.priority = 0;
        this.camera.visibility = Layers.Enum.DEFAULT;
        this.camera.far = 80;
        this.camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        this.sculpture = new WaterRescueScene(world);
    }

    private label(parent: Node, words: string, x: number, y: number, size: number, bold = false, color = PAPER): Label {
        const node = this.layer(parent, words || 'Text');
        node.setPosition(x, y);
        node.addComponent(UITransform);
        const label = node.addComponent(Label);
        label.string = words;
        label.fontSize = size;
        label.lineHeight = size + 3;
        label.isBold = bold;
        label.color = new Color(color);
        return label;
    }

    private rect(pen: Graphics, x: number, y: number, w: number, h: number, radius: number, fill: string): void {
        pen.fillColor = new Color(fill);
        pen.roundRect(x - w / 2, y - h / 2, w, h, radius);
        pen.fill();
    }

    private panel(parent: Node, x: number, y: number, w: number, h: number, radius: number, fill: string): Graphics {
        const panel = this.layer(parent, 'Panel').addComponent(Graphics);
        this.rect(panel, x, y, w, h, radius, fill);
        return panel;
    }

    private button(parent: Node, title: string, x: number, y: number, width: number, height: number,
        onTap: () => void, color: string, note = ''): Button {
        const node = this.layer(parent, title);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        const plate = node.addComponent(Graphics);
        const text = this.label(node, title, 0, note ? 10 : 0, height > 64 ? 28 : 23, true, INK);
        const detail = this.label(node, note, 0, -23, 17, false, INK);
        const paint = {node, plate, title: text, note: detail};
        this.paintButton(paint, color);
        node.on(Node.EventType.TOUCH_END, () => {
            this.audioReady = true;
            this.syncMusic();
            onTap();
        });
        return paint;
    }

    private paintButton(button: Button, color: string): void {
        const {width, height} = button.node.getComponent(UITransform)!;
        const pen = button.plate;
        pen.clear();
        this.rect(pen, 0, -5, width, height, 20, '#092f33cc');
        this.rect(pen, 0, 0, width, height, 20, color);
        this.rect(pen, 0, height / 2 - 4, width - 27, 2, 1, '#ffffffaa');
    }

    private createHome(): void {
        this.panel(this.home, 0, 474, 600, 115, 28, '#0d3938e8');
        this.label(this.home, '鸭鸭救援', 0, 490, 53, true);
        this.label(this.home, '温室水池', 0, 445, 22, false, '#9fd5c2');
        this.panel(this.home, 0, -430, 596, 208, 28, '#0d3938ee');
        this.button(this.home, '开始接管挑战', 0, -391, 540, 75, () => this.startRescue(true), '#ffda89');
        this.button(this.home, '放水教学', -207, -478, 126, 56, () => this.startRescue(false), '#b4e0cf');
        this.button(this.home, '图鉴', -69, -478, 126, 56, () => this.openModal('album'), '#b4e0cf');
        this.button(this.home, '设置', 69, -478, 126, 56, () => this.openModal('settings'), '#b4e0cf');
        this.button(this.home, '原版试玩', 207, -478, 126, 56, () => this.openLegacy?.(), '#b4e0cf');
    }

    private createPlay(): void {
        this.panel(this.play, 0, 477, 600, 95, 25, '#0d3938eb');
        this.playTitle = this.label(this.play, '雨衣鸭', 0, 478, 43, true);
        this.button(this.play, '设置', -231, 477, 103, 54, () => this.openModal('settings'), '#b4e0cf');
        this.button(this.play, '营地', 231, 477, 103, 54, () => this.goHome(), '#b4e0cf');
        const event = this.label(this.play, '', 0, 369, 48, true, '#fff0b7');
        event.enableOutline = true;
        event.outlineWidth = 4;
        event.outlineColor = new Color('#104847');
        event.node.active = false;
        this.eventLabel = event;

        const tutorial = this.tutorialPanel = this.layer(this.play, 'Water lesson controls');
        this.panel(tutorial, 0, -410, 600, 235, 29, '#143e3bf2');
        this.status = this.label(tutorial, '', 0, -332, 26, true, '#fff1d5');
        VALVES.forEach((valve, i) => {
            const button = this.button(tutorial, valve.name, (i - 1) * 184, -417, 162, 118,
                () => this.openValve(valve.id), valve.color, '开启');
            button.title.node.setPosition(0, -16);
            button.note.node.setPosition(0, -43);
            this.controls.set(valve.id, button);
        });
        this.label(tutorial, '拖动鸭鸭看水路', 0, -494, 21, false, '#afcfbf');
        this.createRoutingPanel();
    }

    private pipePosition(index: number): {x: number; y: number} {
        return {
            x: (index % PIPE_COLUMNS - (PIPE_COLUMNS - 1) / 2) * PIPE_SPACING_X,
            y: PIPE_ORIGIN_Y - Math.floor(index / PIPE_COLUMNS) * PIPE_SPACING_Y,
        };
    }

    private createRoutingPanel(): void {
        const panel = this.routingPanel = this.layer(this.play, 'Water routing panel');
        this.panel(panel, 0, -338, 596, 425, 29, '#103836f5');
        this.routingStatus = this.label(panel, '', 0, -151, 25, true);
        this.routingSteps = this.label(panel, '', 0, -183, 18, false, '#acdad0');
        this.routingCanvas = this.layer(panel, 'Pipe artwork').addComponent(Graphics);
        for (let index = 0; index < PIPE_COLUMNS * PIPE_ROWS; index++) {
            const position = this.pipePosition(index);
            const tile = this.layer(panel, 'Pipe ' + index);
            tile.setPosition(position.x, position.y);
            tile.addComponent(UITransform).setContentSize(96, 87);
            tile.on(Node.EventType.TOUCH_END, () => this.turnPipe(index));
        }
        this.label(panel, '左', -244, PIPE_ORIGIN_Y, 19, true, INK);
        this.label(panel, '右', 244, PIPE_ORIGIN_Y, 19, true, INK);
        this.routingDrain = this.button(panel, '等待两路水', 0, -519, 250, 45, () => this.openValve('drain'), '#a6b9ac');
    }

    private turnPipe(index: number): void {
        if (this.sceneState !== 'play' || this.modalType || !this.routing?.turn(index)) return;
        this.playSound('water-valve', .33);
        if (this.routing.solved) {
            this.level.open('left');
            this.level.open('right');
        }
        this.renderRouting();
    }

    private pipeStroke(pen: Graphics, x: number, y: number, endX: number, endY: number, width: number, color: string): void {
        pen.strokeColor = new Color(color);
        pen.lineWidth = width;
        pen.moveTo(x, y);
        pen.lineTo(endX, endY);
        pen.stroke();
    }

    private renderRouting(): void {
        const routing = this.routing!;
        const pen = this.routingCanvas;
        pen.clear();
        for (let index = 0; index < routing.tiles.length; index++) {
            const {x, y} = this.pipePosition(index);
            this.rect(pen, x, y - 3, 91, 82, 16, '#091f20');
            this.rect(pen, x, y, 91, 82, 16, routing.feeds[index] ? '#255b55' : '#314b43');
        }
        for (let index = 0; index < routing.tiles.length; index++) {
            const {x, y} = this.pipePosition(index);
            const fill = FEED_COLORS[routing.feeds[index]];
            for (const [side, dx, dy] of PIPE_ARMS) {
                if (!(routing.tiles[index] & side)) continue;
                this.pipeStroke(pen, x, y, x + dx, y + dy, 23, PIPE_INK);
                this.pipeStroke(pen, x, y, x + dx, y + dy, 14, fill);
            }
            for (const [radius, color] of [[13, PIPE_INK], [7, fill]] as const) {
                pen.fillColor = new Color(color);
                pen.circle(x, y, radius);
                pen.fill();
            }
        }
        for (const [side, fill] of [[-1, FEED_COLORS[1]], [1, FEED_COLORS[2]]] as const) {
            this.pipeStroke(pen, side * 244, PIPE_ORIGIN_Y, side * 204, PIPE_ORIGIN_Y, 23, PIPE_INK);
            this.pipeStroke(pen, side * 244, PIPE_ORIGIN_Y, side * 204, PIPE_ORIGIN_Y, 14, fill);
            pen.fillColor = new Color(fill);
            pen.circle(side * 244, PIPE_ORIGIN_Y, 19);
            pen.fill();
        }
        const exit = this.pipePosition(routing.exit);
        const outlet = FEED_COLORS[routing.outletFeed];
        this.pipeStroke(pen, exit.x, exit.y - 46, exit.x, exit.y - 62, 23, PIPE_INK);
        this.pipeStroke(pen, exit.x, exit.y - 46, exit.x, exit.y - 62, 14, outlet);
        this.rect(pen, exit.x, exit.y - 61, 60, 24, 8, outlet);
        this.routingStatus.string = this.level.won ? '排洪成功' : this.level.opened('drain') ? '洪水正在冲开出口'
            : routing.solved ? '两股水已接通！' : routing.outletFeed ? '已接通一路，再接另一路' : '点管件转向，把两股水引到出口';
        const best = this.bestMoves ? ' · 最佳 ' + this.bestMoves : '';
        this.routingSteps.string = '布局 ' + (this.routingLayout + 1) + ' · ' + routing.moves + ' 步' + best;
        const ready = this.level.available('drain');
        this.routingDrain.title.string = this.level.opened('drain') ? '排洪中'
            : ready ? '打开排洪阀' : routing.solved ? '正在汇流' : '等待两路水';
        this.paintButton(this.routingDrain, ready ? '#ffd883' : '#a6b9ac');

    }

    private createVictory(): void {
        this.panel(this.won, 0, 475, 600, 106, 28, '#0d3938eb');
        this.label(this.won, '雨衣鸭获救！', 0, 477, 48, true);
        this.panel(this.won, 0, -419, 596, 193, 28, '#0d3938ee');
        this.victoryRecord = this.label(this.won, '', 0, -376, 23, true, '#bdedcd');
        this.nextRoutingButton = this.button(this.won, '挑战下一张', -132, -454, 235, 77, () => this.startRescue(true), '#ffda89');
        this.button(this.won, '回营地', 132, -454, 235, 77, () => this.goHome(), '#b4e0cf');
    }

    private layout(): void {
        const safe = sys.getSafeAreaRect(false), visible = view.getVisibleSize();
        this.fit = fitRescueScreen(safe.width > 30 && safe.height > 30 ? safe :
            {x: (WIDTH - visible.width) / 2, y: (HEIGHT - visible.height) / 2, width: visible.width, height: visible.height});
        const {x, y, scale} = this.fit;
        this.ui.setPosition(x, y);
        this.ui.setScale(scale, scale, 1);
        const aspect = this.texture ? this.texture.width / this.texture.height : 2 / 3;
        const window = screen.windowSize;
        const width = Math.max(window.width / view.getScaleX(), window.height / view.getScaleY() * aspect);
        this.landscape.node.getComponent(UITransform)!.setContentSize(width, width / aspect);
        const expanded = this.routing !== null && this.sceneState === 'play';
        const ratio = (expanded ? .0165 : .0135) / scale;
        this.camera.orthoHeight = HEIGHT / 2 * ratio;
        this.camera.node.setPosition(-x * ratio, -(y + (expanded ? 138 : 63) * scale) * ratio, 20);
    }

    private show(state: Screen): void {
        this.sceneState = state;
        this.home.active = state === 'home';
        this.play.active = state === 'play';
        this.won.active = state === 'won';
        this.layout();
    }

    private goHome(): void {
        this.level = new WaterRescueGame();
        this.routing = null;
        this.sculpture.reset();
        this.dragId = null;
        this.resultAt = Infinity;
        this.show('home');
    }

    private startRescue(challenge: boolean): void {
        this.level = new WaterRescueGame();
        this.routingLayout = this.nextLayout;
        this.routing = challenge ? new WaterRoutingGame(this.routingLayout) : null;
        this.bestMoves = 0;
        if (challenge) {
            try {
                const saved = Number(sys.localStorage.getItem(ROUTING_BEST_KEY + this.routingLayout));
                if (Number.isSafeInteger(saved) && saved > 0) this.bestMoves = saved;
            } catch { /* storage optional */ }
        }
        this.tutorialPanel.active = !challenge;
        this.routingPanel.active = challenge;
        this.playTitle.string = challenge ? '双流接管' : '雨衣鸭';
        this.sculpture.reset();
        this.resultAt = Infinity;
        this.eventAt = -Infinity;
        this.eventLabel.node.active = false;
        this.dragId = null;
        this.idleAt = this.clock + 1;
        this.yaw = -12;
        this.pitch = 7;
        this.show('play');
        this.renderControls();
    }

    private openValve(valve: Valve): void {
        if (this.sceneState !== 'play' || this.modalType || (this.routing && valve !== 'drain') || !this.level.open(valve)) return;
        this.playSound('water-valve', .65);
        this.renderControls();
    }

    private renderControls(): void {
        if (this.routing) {
            this.renderRouting();
            return;
        }
        this.status.string = this.level.won ? '雨衣鸭出水啦' : this.level.opened('drain') ? '洪水正在冲开出口'
            : this.level.merged ? '两股水已汇合 · 打开排洪阀'
            : this.level.opened('left') && this.level.opened('right') ? '两股水正在靠近'
            : this.level.opened('left') || this.level.opened('right') ? '打开另一侧，汇合两股水'
            : '打开任意水阀';
        for (const valve of VALVES) {
            const button = this.controls.get(valve.id)!;
            const opened = this.level.opened(valve.id);
            const ready = this.level.available(valve.id);
            button.note.string = opened ? '已开启' : ready ? '点击开启' : '汇流后可开';
            this.paintButton(button, opened ? '#d4ead7' : ready ? valve.color : '#a5beb5');
            const pen = button.plate;
            for (const [y, radius, fill] of [
                [19, 24, '#305952'], [23, 21, '#fff2ce'], [23, 17, ready ? '#b4773f' : '#748f82'],
                [23, 11, opened ? '#8bd6bb' : '#e9c77f'],
            ] as const) {
                pen.fillColor = new Color(fill);
                pen.circle(0, y, radius);
                pen.fill();
            }
            this.rect(pen, 0, 23, 37, 8, 4, opened ? '#3a8071' : '#6a593d');
            if (opened) this.rect(pen, 0, 23, 8, 32, 4, '#3a8071');
        }
    }

    private openModal(kind: Modal): void {
        if (this.modalType) return;
        this.dragId = null;
        this.modalType = kind;
        this.modal.active = true;
        this.drawModal();
    }

    private drawModal(): void {
        for (const child of this.modal.children.slice()) { child.removeFromParent(); child.destroy(); }
        const blocker = this.layer(this.modal, 'Dialog shield');
        blocker.addComponent(UITransform).setContentSize(1900, 2300);
        blocker.addComponent(BlockInputEvents);
        this.panel(blocker, 0, 0, 1900, 2300, 0, '#062423b8');
        this.panel(blocker, 0, 0, 550, 400, 29, '#f3edda');
        if (this.modalType === 'settings') {
            this.label(blocker, '声音设置', 0, 136, 34, true, INK);
            this.button(blocker, this.musicEnabled ? '音乐 · 开' : '音乐 · 关', 0, 55, 424, 69, () => {
                this.musicEnabled = !this.musicEnabled;
                this.savePreference(MUSIC_KEY, this.musicEnabled);
                this.syncMusic();
                this.drawModal();
            }, '#bedfd1');
            this.button(blocker, this.effectsMuted ? '音效 · 关' : '音效 · 开', 0, -31, 424, 69, () => {
                this.effectsMuted = !this.effectsMuted;
                this.savePreference(EFFECTS_KEY, this.effectsMuted);
                this.drawModal();
            }, '#bedfd1');
        } else {
            this.album.refresh();
            const rescued = this.album.book.entries.some(entry => entry.levelId === 11);
            this.label(blocker, '救援图鉴', 0, 137, 35, true, INK);
            this.label(blocker, rescued ? '雨衣鸭 · 已获救' : '雨衣鸭 · 等待救援', 0, 39, 29, true, INK);
        }
        this.button(blocker, '返回', 0, -128, 290, 59, () => {
            this.modalType = null;
            this.modal.active = false;
        }, '#ffda89');
    }

    private savePreference(key: string, value: boolean): void {
        try { sys.localStorage.setItem(key, String(value)); } catch { /* storage optional */ }
    }

    private readPreferences(): void {
        try {
            this.musicEnabled = sys.localStorage.getItem(MUSIC_KEY) !== 'false';
            this.effectsMuted = sys.localStorage.getItem(EFFECTS_KEY) === 'true';
        } catch { /* storage optional */ }
    }

    private playSound(id: string, volume: number): void {
        const clip = this.clips.get(id);
        if (!this.effectsMuted && this.foreground && clip) this.effects.playOneShot(clip, volume);
    }

    private syncMusic(): void {
        const playing = this.musicEnabled && this.audioReady && this.foreground && this.node.activeInHierarchy && this.soundtrack.clip;
        if (playing && !this.soundtrack.playing) this.soundtrack.play();
        if (!playing) this.soundtrack.pause();
    }

    suspendForLegacy(): void {
        this.dragId = null;
        this.soundtrack.pause();
        this.effects.stop();
    }

    restoreFromLegacy(): void {
        this.readPreferences();
        this.layout();
        this.syncMusic();
    }

    private hide(): void {
        this.foreground = false;
        this.dragId = null;
        this.syncMusic();
    }

    private restore(): void {
        this.foreground = true;
        this.layout();
        this.syncMusic();
    }

    private beginDrag(event: EventTouch): void {
        if (!this.enabledInHierarchy || this.modalType || this.dragId !== null || this.resultAt !== Infinity) return;
        const point = event.getUILocation(), {x, y, scale} = this.fit;
        if (Math.abs((point.x - WIDTH / 2 - x) / scale) > 298) return;
        const row = (point.y - HEIGHT / 2 - y) / scale;
        if (row < (this.routing && this.sceneState === 'play' ? -122 : -243) || row > 423) return;
        this.dragId = event.getID();
    }

    private drag(event: EventTouch): void {
        if (this.dragId === null || event.getID() !== this.dragId) return;
        const delta = event.getUIDelta();
        this.yaw = ((this.yaw + delta.x * .64 + 540) % 360) - 180;
        this.pitch = Math.max(-62, Math.min(62, this.pitch - delta.y * .48));
    }

    private endDrag(event: EventTouch): void {
        if (this.dragId === null || event.getID() !== this.dragId) return;
        this.dragId = null;
        this.idleAt = this.clock + 1;
    }

    private hit(event: WaterArrival): void {
        this.sculpture.impact(event, this.clock);
        this.playSound(IMPACT_SOUND[event], event === 'drain' || event === 'merge' ? .84 : .56);
        if (event === 'merge' || event === 'drain') {
            this.eventAt = this.clock;
            this.eventLabel.string = event === 'merge' ? '双流汇合！' : '洪水冲开出口！';
            this.eventLabel.node.active = true;
            const wx = (globalThis as {wx?: {vibrateShort?(options: {type: string}): void}}).wx;
            try { wx?.vibrateShort?.({type: event === 'merge' ? 'medium' : 'heavy'}); }
            catch { /* Haptics are optional on the current device. */ }
        }
        if (event === 'drain') {
            this.album.refresh();
            this.album.book.unlock(11);
            this.victoryRecord.string = '已收录到救援图鉴';
            this.nextRoutingButton.title.string = this.routing ? '挑战下一张' : '开始接管挑战';
            if (this.routing) {
                const moves = this.routing.moves;
                if (!this.bestMoves || moves < this.bestMoves) {
                    this.bestMoves = moves;
                    try { sys.localStorage.setItem(ROUTING_BEST_KEY + this.routingLayout, String(moves)); } catch { /* storage optional */ }
                }
                this.victoryRecord.string = '本轮 ' + moves + ' 步 · 最佳 ' + this.bestMoves + ' 步';
                this.nextLayout = (this.routingLayout + 1) % PIPE_LAYOUTS;
            }
            this.dragId = null;
            this.resultAt = this.clock + 1.45;
        }
    }

    private animateMessage(): void {
        if (!this.eventLabel.node.active) return;
        const elapsed = this.clock - this.eventAt;
        if (elapsed >= 1.24) {
            this.eventLabel.node.active = false;
            return;
        }
        const angle = Math.min(1, elapsed * 3.2);
        this.eventLabel.node.setScale(1 + Math.sin(angle * Math.PI) * .18, 1 + Math.sin(angle * Math.PI) * .18, 1);
    }

    update(seconds: number): void {
        if (!this.foreground || this.modalType) return;
        const dt = Math.min(seconds, .1);
        this.clock += dt;
        if (this.dragId === null && this.clock > this.idleAt && !this.level.won) {
            this.yaw += Math.cos(this.clock * 1.05) * dt * 8;
        }
        if (this.level.won) {
            this.yaw += (-6 - this.yaw) * dt * 4;
            this.pitch += (8 - this.pitch) * dt * 4;
        }
        this.sculpture.root.setRotationFromEuler(this.pitch, this.yaw, 0);
        const arrivals = this.level.advance(dt);
        if (arrivals.length) {
            for (const event of arrivals) this.hit(event);
            this.renderControls();
        }
        if (this.sceneState === 'play' && this.clock >= this.resultAt) {
            this.playSound('water-duck', .72);
            this.show('won');
        }
        this.frameTime += dt;
        if (this.frameTime >= 1 / 30) {
            this.sculpture.update(this.level, this.clock, this.frameTime);
            this.frameTime = 0;
            this.animateMessage();
        }
    }

    onDestroy(): void {
        this.sculpture?.dispose();
        this.frame?.destroy();
        this.texture?.destroy();
        view.off('canvas-resize', this.layout, this);
        view.off('design-resolution-changed', this.layout, this);
        game.off(Game.EVENT_HIDE, this.hide, this);
        game.off(Game.EVENT_SHOW, this.restore, this);
        input.off(Input.EventType.TOUCH_START, this.beginDrag, this);
        input.off(Input.EventType.TOUCH_MOVE, this.drag, this);
        input.off(Input.EventType.TOUCH_END, this.endDrag, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.endDrag, this);
    }
}
