"use strict";

/* ===== 常量 ===== */
const ROWS = 8;
const COLS = 8;
const COLOR_COUNT = 6;
const CANDY_ICONS = ["🍎", "🫐", "🍋", "🍇", "🍉", "🥕"];
const CLEAR_MS = 340;
const DROP_MS = 270;
// 动画时长（奖励结算阶段会调快，营造爽快感）
let clearMs = CLEAR_MS;
let dropMs = DROP_MS;
const BASE_POINTS = 60;

/* ===== 关卡配置：每关不同的形状、目标、步数、障碍数量（位置随机生成） ===== */
/* walls:       隔断块数量，不可交换/不可消除/阻挡掉落，可被特殊糖果摧毁 */
/* ice:         冻结块数量，糖果被冰层包裹不可交换，在它上下左右消除即可破冰（糖果保留） */
/* iceLayers:   冰层厚度（1~3 层），每次消除只破一层，全部破完才解冻；目标数 = 冰块数 × 层数 */
/* jelly:       果冻格数量，糖果下方垫有果冻，消除上方糖果时果冻减1层；目标数 = 果冻数 × 层数 */
/* jellyLayers: 果冻厚度（1~2 层） */
/* ingredients: 食材数量，从顶部下落，落到底部即收集成功 */
/* shape:       棋盘形状模板名，空洞格子不渲染、不参与匹配与掉落 */
/* goal:        通关目标 { type: 'score'|'ice'|'fruit'|'jelly'|'ingredient', target } */
/*   score: target 为目标分数；ice: target 为需破冰层数总和；fruit: target 为 { 颜色索引: 数量 } */
/*   jelly: target 为需清除的果冻总层数；ingredient: target 为需收集的食材数 */
const LEVEL_CONFIGS = [
    { moves: 18, walls: 0, ice: 0,  iceLayers: 1, shape: "full",    goal: { type: "score", target: 1200 } },
    { moves: 14, walls: 0, ice: 8,  iceLayers: 1, shape: "full",    goal: { type: "ice", target: 8 } },
    { moves: 20, walls: 4, ice: 0,  iceLayers: 1, shape: "corners", goal: { type: "score", target: 2800 } },
    { moves: 20, walls: 2, ice: 0,  iceLayers: 1, shape: "corners", goal: { type: "fruit", target: { 0: 18, 2: 18 } } },
    { moves: 22, walls: 0, ice: 0,  iceLayers: 1, shape: "cross",   goal: { type: "score", target: 4800 } },
    { moves: 18, walls: 2, ice: 10, iceLayers: 2, shape: "cross",   goal: { type: "ice", target: 20 } },
    { moves: 22, walls: 0, ice: 0,  iceLayers: 1, shape: "diamond", goal: { type: "fruit", target: { 1: 22, 4: 22 } } },
    { moves: 22, walls: 4, ice: 0,  iceLayers: 1, shape: "diamond", goal: { type: "score", target: 8500 } },
    { moves: 20, walls: 3, ice: 12, iceLayers: 2, shape: "donut",   goal: { type: "ice", target: 24 } },
    { moves: 22, walls: 0, ice: 0,  iceLayers: 1, shape: "donut",   goal: { type: "fruit", target: { 3: 24, 5: 24 } } },
    { moves: 24, walls: 4, ice: 0,  iceLayers: 1, shape: "stairs",  goal: { type: "score", target: 13000 } },
    { moves: 24, walls: 4, ice: 12, iceLayers: 3, shape: "stairs",  goal: { type: "ice", target: 36 } },
    { moves: 24, walls: 0, ice: 0,  iceLayers: 1, shape: "zigzag",  goal: { type: "fruit", target: { 0: 28, 3: 28 } } },
    { moves: 26, walls: 6, ice: 0,  iceLayers: 1, shape: "zigzag",  goal: { type: "score", target: 18000 } },
    { moves: 26, walls: 5, ice: 14, iceLayers: 3, shape: "cross",   goal: { type: "ice", target: 42 } },
    { moves: 20, walls: 0, ice: 0, iceLayers: 1, jelly: 10, jellyLayers: 1, shape: "full",    goal: { type: "jelly", target: 10 } },
    { moves: 22, walls: 2, ice: 0, iceLayers: 1, jelly: 12, jellyLayers: 1, shape: "corners", goal: { type: "jelly", target: 12 } },
    { moves: 24, walls: 0, ice: 0, iceLayers: 1, jelly: 12, jellyLayers: 2, shape: "diamond", goal: { type: "jelly", target: 24 } },
    { moves: 22, walls: 2, ice: 0, iceLayers: 1, shape: "corners", ingredients: 3, goal: { type: "ingredient", target: 3 } },
    { moves: 24, walls: 2, ice: 0, iceLayers: 1, shape: "stairs",  ingredients: 4, goal: { type: "ingredient", target: 4 } },
    { moves: 26, walls: 3, ice: 0, iceLayers: 1, shape: "zigzag",  ingredients: 5, goal: { type: "ingredient", target: 5 } },
];

function getLevelConfig(lv) {
    if (lv <= LEVEL_CONFIGS.length) return LEVEL_CONFIGS[lv - 1];
    /* 超出预定义关卡：程序化生成，形状/目标类型轮换，难度递增 */
    const base = LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1];
    const extra = lv - LEVEL_CONFIGS.length;
    const shapes = ["full", "corners", "cross", "diamond", "donut", "stairs", "zigzag"];
    const shape = shapes[extra % shapes.length];
    const goalTypes = ["score", "ice", "fruit", "jelly", "ingredient"];
    const gt = goalTypes[extra % goalTypes.length];
    let goal, ice = 0, iceLayers = 1, jelly = 0, jellyLayers = 1, ingredients = 0;
    if (gt === "score") {
        goal = { type: "score", target: Math.round(18000 * Math.pow(1.1, extra)) };
    } else if (gt === "ice") {
        iceLayers = Math.min(3, 1 + Math.floor(extra / 6));
        ice = Math.min(14, 10 + Math.floor(extra / 4));
        goal = { type: "ice", target: ice * iceLayers };
    } else if (gt === "jelly") {
        jellyLayers = Math.min(2, 1 + Math.floor(extra / 8));
        jelly = Math.min(14, 10 + Math.floor(extra / 4));
        goal = { type: "jelly", target: jelly * jellyLayers };
    } else if (gt === "ingredient") {
        ingredients = Math.min(6, 3 + Math.floor(extra / 5));
        goal = { type: "ingredient", target: ingredients };
    } else {
        const c1 = extra % COLOR_COUNT, c2 = (c1 + 2) % COLOR_COUNT;
        const n = Math.min(32, 24 + Math.floor(extra / 2));
        goal = { type: "fruit", target: {} };
        goal.target[c1] = n;
        goal.target[c2] = n;
    }
    return {
        moves: Math.min(30, base.moves + Math.floor(extra / 3)),
        walls: Math.min(12, base.walls + (extra % 3)),
        ice: gt === "ice" ? ice : Math.min(14, base.ice + ((extra + 1) % 4)),
        iceLayers: gt === "ice" ? iceLayers : 1,
        jelly: gt === "jelly" ? jelly : 0,
        jellyLayers: gt === "jelly" ? jellyLayers : 1,
        ingredients: gt === "ingredient" ? ingredients : 0,
        shape,
        goal,
    };
}

/* ===== 随机形状模板：返回空洞坐标集合（空洞不渲染、不参与匹配与掉落） ===== */
const SHAPE_TEMPLATES = {
    /* 完整矩形 */
    full: () => new Set(),
    /* 缺四角（各挖 2x2） */
    corners: () => {
        const s = new Set();
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
            s.add(key(r, c)); s.add(key(r, COLS - 1 - c));
            s.add(key(ROWS - 1 - r, c)); s.add(key(ROWS - 1 - r, COLS - 1 - c));
        }
        return s;
    },
    /* 十字形（四角切斜） */
    cross: () => {
        const s = new Set();
        for (let c = 0; c < COLS; c++) {
            if (c < 2 || c > COLS - 3) { s.add(key(0, c)); s.add(key(ROWS - 1, c)); }
            if (c < 1 || c > COLS - 2) { s.add(key(1, c)); s.add(key(ROWS - 2, c)); }
        }
        return s;
    },
    /* 菱形（四角切三角） */
    diamond: () => {
        const s = new Set();
        const mid = (COLS - 1) / 2;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (Math.abs(r - mid) + Math.abs(c - mid) > mid + 1) s.add(key(r, c));
        }
        return s;
    },
    /* 环形（中间挖 2x2 洞） */
    donut: () => {
        const s = new Set();
        for (let r = 3; r <= 4; r++) for (let c = 3; c <= 4; c++) s.add(key(r, c));
        return s;
    },
    /* 阶梯形（右上角与左下角各切三角） */
    stairs: () => {
        const s = new Set();
        for (let c = 4; c < COLS; c++) for (let r = 0; r < c - 3; r++) s.add(key(r, c));
        for (let c = 0; c <= 3; c++) for (let r = ROWS - 1; r > 4 + c; r--) s.add(key(r, c));
        return s;
    },
    /* Z 形（右上缺角 + 左下缺角 + 中心横洞） */
    zigzag: () => {
        const s = new Set();
        for (let r = 0; r < 2; r++) for (let c = COLS - 2; c < COLS; c++) s.add(key(r, c));
        for (let r = ROWS - 2; r < ROWS; r++) for (let c = 0; c < 2; c++) s.add(key(r, c));
        for (let r = 3; r <= 4; r++) for (let c = 3; c <= 4; c++) s.add(key(r, c));
        return s;
    },
};

function genShape(shapeName) {
    const fn = SHAPE_TEMPLATES[shapeName] || SHAPE_TEMPLATES.full;
    return fn();
}

/* ===== 随机生成障碍布局：每次进入关卡地图都不同（空洞上不放障碍） ===== */
function genObstacles(cfg) {
    const wallSet = new Set();
    const iceSet = new Set();
    const jellySet = new Set();
    const colWallCount = new Array(COLS).fill(0);
    let attempts = 0;
    /* 隔断块：随机散布，每列最多2个避免堵死掉落通道 */
    while (wallSet.size < cfg.walls && attempts < 300) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        const k = key(r, c);
        if (wallSet.has(k) || holeSet.has(k) || colWallCount[c] >= 2) continue;
        wallSet.add(k);
        colWallCount[c]++;
    }
    /* 冻结块：随机散布，不与隔断块/空洞重叠 */
    attempts = 0;
    while (iceSet.size < cfg.ice && attempts < 300) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        const k = key(r, c);
        if (wallSet.has(k) || iceSet.has(k) || holeSet.has(k)) continue;
        iceSet.add(k);
    }
    /* 果冻格：随机散布，不与隔断块/冻结块/空洞重叠 */
    attempts = 0;
    while (jellySet.size < (cfg.jelly || 0) && attempts < 300) {
        attempts++;
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        const k = key(r, c);
        if (wallSet.has(k) || iceSet.has(k) || jellySet.has(k) || holeSet.has(k)) continue;
        jellySet.add(k);
    }
    return { wallSet, iceSet, jellySet };
}

/* ===== DOM 引用 ===== */
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score-display");
const levelEl = document.getElementById("level-display");
const targetEl = document.getElementById("target-display");
const movesEl = document.getElementById("moves-display");
const progressEl = document.getElementById("progress-bar-inner");
const comboBanner = document.getElementById("combo-banner");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalText = document.getElementById("modal-text");
const modalBtn = document.getElementById("modal-btn");
const hintEl = document.getElementById("hint");
const levelSelectEl = document.getElementById("level-select");
const levelGridEl = document.getElementById("level-grid");
const levelBackBtn = document.getElementById("level-back-btn");
const devBtn = document.getElementById("dev-btn");
const devPanel = document.getElementById("dev-panel");
const devCloseBtn = document.getElementById("dev-close-btn");
const devSceneGrid = document.getElementById("dev-scene-grid");
const toolBtns = {
    hammer: document.getElementById("tool-hammer"),
    bomb: document.getElementById("tool-bomb"),
    shuffle: document.getElementById("tool-shuffle"),
    swap: document.getElementById("tool-swap")
};
const toolCountEls = {
    hammer: document.getElementById("hammer-count"),
    bomb: document.getElementById("bomb-count"),
    shuffle: document.getElementById("shuffle-count"),
    swap: document.getElementById("swap-count")
};

/* ===== 音效系统（WebAudio 合成，无需音频文件） ===== */
let audioCtx = null;
let soundOn = true;

function getAudioCtx() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            soundOn = false;
        }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
}

/* 基础音符：type 波形，freq 频率，dur 时长，delay 延迟(秒)，vol 音量 */
function playTone(type, freq, dur, delay = 0, vol = 0.22) {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    /* 播放结束后断开节点，防止音频图无限膨胀导致越玩越卡 */
    osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch (e) {}
    };
}

/* 上滑琶音 */
function playSlide(type, freqStart, freqEnd, dur, delay = 0, vol = 0.22) {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.003, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    /* 播放结束后断开节点，防止音频图无限膨胀 */
    osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch (e) {}
    };
}

/* 消除音效：根据消除数量音调升高 */
function soundClear(size, combo) {
    const base = 320 + Math.min(combo, 6) * 80; // 连击越高音调越高
    const notes = Math.min(1 + Math.floor(size / 3), 4); // 消得多音符多
    for (let i = 0; i < notes; i++) {
        playTone("sine", base * Math.pow(1.25, i), 0.18, i * 0.06);
    }
}

/* 连击英语词汇：等级越高词越震撼 */
const COMBO_WORDS = {
    2: "GOOD",
    3: "GREAT",
    4: "PERFECT",
    5: "EXCELLENT",
    6: "AMAZING",
    7: "FANTASTIC",
};

function getComboWord(combo) {
    if (combo >= 8) return "LEGENDARY";
    return COMBO_WORDS[combo] || "GOOD";
}

/* 英语语音播报（Web Speech API，浏览器内置无需音频文件） */
function speakComboWord(word) {
    if (!soundOn) return;
    try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // 避免连续连击时语音堆积
        const utter = new SpeechSynthesisUtterance(word);
        utter.lang = "en-US";
        utter.rate = 1.15;
        utter.pitch = 1.25;
        utter.volume = 0.9;
        /* 优先选用英语女声，音色更清亮 */
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find((v) => v.lang && v.lang.startsWith("en") && /female|samantha|zira|google/i.test(v.name))
            || voices.find((v) => v.lang && v.lang.startsWith("en"));
        if (enVoice) utter.voice = enVoice;
        window.speechSynthesis.speak(utter);
    } catch (e) { /* 语音不可用时静默降级，不影响游戏 */ }
}

/* 部分浏览器需异步加载语音列表 */
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/* 连击音效 */
function soundCombo(combo) {
    playTone("triangle", 520 + combo * 60, 0.12);
    playTone("triangle", 660 + combo * 60, 0.12, 0.1);
    speakComboWord(getComboWord(combo));
}

/* 特殊糖果生成 */
function soundSpecial() {
    playSlide("square", 300, 900, 0.35);
}

/* 特殊糖果引爆 */
function soundExplosion() {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    // 白噪声爆炸
    const dur = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    /* 播放结束后断开节点，防止音频图无限膨胀 */
    src.onended = () => {
        try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (e) {}
    };
    playSlide("sawtooth", 200, 60, 0.4, 0, 0.18);
}

/* 掉落音效 */
function soundDrop() {
    playTone("sine", 220, 0.08, 0, 0.12);
    playTone("sine", 180, 0.08, 0.05, 0.1);
}

/* 无效交换 */
function soundInvalid() {
    playTone("square", 160, 0.12, 0, 0.15);
}

/* 破冰：清脆碎裂声 */
function soundIceBreak() {
    playTone("triangle", 1200, 0.06, 0, 0.18);
    playTone("triangle", 1600, 0.05, 0.04, 0.15);
    playTone("sine", 900, 0.08, 0.08, 0.12);
}

/* 过关 */
function soundWin() {
    const melody = [523.25, 659.25, 783.99, 1046.5];
    melody.forEach((f, i) => playTone("triangle", f, 0.3, i * 0.15));
}

/* 失败 */
function soundLose() {
    playSlide("sawtooth", 400, 120, 0.8, 0, 0.2);
}

/* 道具使用 */
function soundTool() {
    playTone("triangle", 440, 0.1);
    playTone("triangle", 560, 0.1, 0.09);
}

/* ===== 游戏状态 ===== */
let grid = [];              // grid[r][c] = { color, special, el }
let score = 0;
let level = 1;
let target = 1000;
let movesLeft = 20;
let busy = false;
let gameOver = false;
let tools = { hammer: 3, bomb: 1, shuffle: 1, swap: 2 };
let activeTool = null;      // 当前选中的道具
let selectedKey = null;     // 点击选中的糖果（用于点选交换）
let dragStart = null;       // 拖拽起点
let swipeInfo = null;       // 滑动换位信息（跟手位移 + 阈值触发）
let swapFirst = null;       // 换位道具第一个选择
let modalMode = null;        // 'win' | 'lose'
let lastActionTime = Date.now(); // 最近一次用户操作时间（用于无操作提示）
let hintActive = false;     // 提示动画是否正在播放
let holeSet = new Set();    // 随机形状地图的空洞格（不渲染/不匹配/不掉落）
let goal = null;            // 当前关卡目标 { type, target }
let iceBroken = 0;          // 已破冰块数
let fruitCleared = {};      // 已消除各颜色水果数 { colorIndex: count }
let jellyGrid = [];         // 果冻层数二维数组 jellyGrid[r][c] = 0~2（0=无果冻）
let jellyCleared = 0;       // 已清除果冻层数
let ingredientsCollected = 0; // 已收集食材数
let winStars = 1;           // 过关星级（bonusRound 前计算）
let devMode = false;        // 开发者模式：关闭过关/失败判定，步数无限

/* ===== 关卡进度（localStorage 持久化） ===== */
let unlockedLevel = Number(localStorage.getItem("xxl_unlocked") || 1);
let levelStars = JSON.parse(localStorage.getItem("xxl_stars") || "{}");

/* ===== 工具函数 ===== */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const key = (r, c) => r + "," + c;
const parseKey = (k) => k.split(",").map(Number);
const inBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const randColor = () => Math.floor(Math.random() * COLOR_COUNT);
const isAdjacent = (r1, c1, r2, c2) => Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
/* 列的最高/最低非空洞行（食材放置与收集判定用） */
const topRowOf = (c) => { for (let r = 0; r < ROWS; r++) if (!holeSet.has(key(r, c))) return r; return -1; };
const bottomRowOf = (c) => { for (let r = ROWS - 1; r >= 0; r--) if (!holeSet.has(key(r, c))) return r; return -1; };

function makeCell(color, special = null) {
    return { color, special, frozen: 0, wall: false, el: null };
}

function makeWallCell() {
    return { color: -1, special: null, frozen: 0, wall: true, el: null };
}

function createCandyEl(cell, r, c) {
    const el = document.createElement("div");
    el.className = "candy";
    el.dataset.r = r;
    el.dataset.c = c;
    if (cell.wall) {
        el.classList.add("wall");
        el.textContent = "🧱";
        return el;
    }
    if (cell.ingredient) {
        el.dataset.ingredient = "1";
        el.textContent = "🥥";
        return el;
    }
    el.textContent = CANDY_ICONS[cell.color];
    el.dataset.color = cell.color;
    if (cell.special) {
        el.dataset.special = cell.special;
        el.textContent = cell.special === "bomb" ? "💥" : (cell.special === "rainbow" ? "⭐" : CANDY_ICONS[cell.color]);
    }
    if (cell.frozen) {
        el.classList.add("frozen");
        el.dataset.ice = cell.frozen; // 冰层厚度，CSS 据此显示 ❄❄❄
    }
    return el;
}

/* 检查已有元素是否与格子数据匹配（颜色/特殊/冻结/墙体一致才可复用） */
function elMatchesCell(el, cell) {
    if (cell.wall) return el.classList.contains("wall");
    if (el.classList.contains("wall")) return false;
    if (!!el.dataset.ingredient !== !!cell.ingredient) return false;
    if (cell.ingredient) return true; // 食材仅靠 data-ingredient 匹配
    if (el.dataset.color != String(cell.color)) return false;
    if ((el.dataset.special || "") !== (cell.special || "")) return false;
    if (el.classList.contains("frozen") !== !!cell.frozen) return false;
    if (Number(el.dataset.ice || 0) !== (cell.frozen || 0)) return false; // 冰层厚度变化需重建
    return true;
}

/* ===== 渲染：复用已有 DOM 元素，避免每次全量销毁重建 64 个节点造成手机 GC 卡顿 ===== */
function render() {
    stopHint();
    const pool = new Set();
    const children = [...boardEl.children];
    for (const el of children) {
        if (el.classList.contains("candy")) pool.add(el);
        else el.remove(); /* 移除 fly-score 等临时元素 */
    }
    const frag = document.createDocumentFragment();
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (!cell || holeSet.has(key(r, c))) {
                /* 空洞/空位占位：维持 grid 布局不错位 */
                const hole = document.createElement("div");
                hole.className = "hole";
                frag.appendChild(hole);
                continue;
            }
            const el = cell.el;
            if (el && pool.has(el) && elMatchesCell(el, cell)) {
                pool.delete(el);
                /* 复用：仅更新坐标数据与临时状态类 */
                el.dataset.r = r;
                el.dataset.c = c;
                el.classList.remove("clearing", "ice-break", "selected", "hint-swap", "swiping");
                el.style.removeProperty("--hx");
                el.style.removeProperty("--hy");
                el.style.removeProperty("transform");
                frag.appendChild(el);
            } else {
                cell.el = createCandyEl(cell, r, c);
                frag.appendChild(cell.el);
            }
            /* 果冻层视觉：jellyGrid 与糖果数据独立，每次渲染同步 data-jelly */
            const jl = (jellyGrid[r] && jellyGrid[r][c]) || 0;
            if (jl > 0) cell.el.dataset.jelly = jl;
            else cell.el.removeAttribute("data-jelly");
        }
    }
    for (const el of pool) el.remove();
    boardEl.appendChild(frag);
    updateSelection();
}

/* ===== 棋盘初始化（随机形状+障碍，避免开局自动消除，无可行步则重新生成） ===== */
function initBoard() {
    const cfg = getLevelConfig(level);
    holeSet = genShape(cfg.shape || "full");
    const { wallSet, iceSet, jellySet } = genObstacles(cfg);
    grid = [];
    jellyGrid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        jellyGrid[r] = [];
        for (let c = 0; c < COLS; c++) {
            jellyGrid[r][c] = 0;
            if (holeSet.has(key(r, c))) {
                grid[r][c] = null; // 空洞格：不存在任何糖果
                continue;
            }
            if (wallSet.has(key(r, c))) {
                grid[r][c] = makeWallCell();
                continue;
            }
            let color;
            let guard = 0;
            do {
                color = randColor();
                guard++;
            } while (
                guard < 30 &&
                ((c >= 2 && grid[r][c - 1] && !grid[r][c - 1].wall && grid[r][c - 2] && !grid[r][c - 2].wall &&
                    grid[r][c - 1].color === color && grid[r][c - 2].color === color) ||
                 (r >= 2 && grid[r - 1][c] && !grid[r - 1][c].wall && grid[r - 2][c] && !grid[r - 2][c].wall &&
                    grid[r - 1][c].color === color && grid[r - 2][c].color === color))
            );
            const cell = makeCell(color);
            if (iceSet.has(key(r, c))) cell.frozen = cfg.iceLayers || 1;
            if (jellySet.has(key(r, c))) jellyGrid[r][c] = cfg.jellyLayers || 1;
            grid[r][c] = cell;
        }
    }
    /* 食材放置：在可到达底部的列的顶端放置食材 */
    if (cfg.ingredients) {
        const validCols = [];
        for (let c = 0; c < COLS; c++) {
            if (bottomRowOf(c) >= 0) validCols.push(c);
        }
        for (let i = 0; i < cfg.ingredients && validCols.length > 0; i++) {
            const idx = Math.floor(Math.random() * validCols.length);
            const c = validCols.splice(idx, 1)[0];
            const r = topRowOf(c);
            const cell = grid[r][c];
            if (cell && !cell.wall && !cell.frozen) {
                cell.ingredient = true;
                cell.color = -1;
                cell.special = null;
                jellyGrid[r][c] = 0; // 食材格不放果冻
            }
        }
    }
    if (!hasAnyMove()) initBoard();
}

/* ===== 匹配检测：找出所有消除组 ===== */
function findMatchGroups() {
    const runs = [];
    // 横向扫描（隔断块/食材不参与匹配）
    for (let r = 0; r < ROWS; r++) {
        let c = 0;
        while (c < COLS) {
            const cell = grid[r][c];
            if (!cell || cell.wall || cell.ingredient) { c++; continue; }
            let len = 1;
            while (c + len < COLS && grid[r][c + len] && !grid[r][c + len].wall && !grid[r][c + len].ingredient && grid[r][c + len].color === cell.color) len++;
            if (len >= 3) {
                const cells = [];
                for (let i = 0; i < len; i++) cells.push([r, c + i]);
                runs.push({ dir: "h", len, cells });
            }
            c += len;
        }
    }
    // 纵向扫描（隔断块/食材不参与匹配）
    for (let c = 0; c < COLS; c++) {
        let r = 0;
        while (r < ROWS) {
            const cell = grid[r][c];
            if (!cell || cell.wall || cell.ingredient) { r++; continue; }
            let len = 1;
            while (r + len < ROWS && grid[r + len][c] && !grid[r + len][c].wall && !grid[r + len][c].ingredient && grid[r + len][c].color === cell.color) len++;
            if (len >= 3) {
                const cells = [];
                for (let i = 0; i < len; i++) cells.push([r + i, c]);
                runs.push({ dir: "v", len, cells });
            }
            r += len;
        }
    }
    if (runs.length === 0) return [];

    // 合并相交的 run 成组（L 型 / T 型合并处理）
    const groups = [];
    const cellGroup = new Map();
    for (const run of runs) {
        const hitIdx = new Set();
        for (const [r, c] of run.cells) {
            const gi = cellGroup.get(key(r, c));
            if (gi !== undefined) hitIdx.add(gi);
        }
        let group;
        if (hitIdx.size === 0) {
            group = { runs: [run], cells: new Set() };
            groups.push(group);
        } else {
            const idxArr = [...hitIdx];
            group = groups[idxArr[0]];
            for (let i = 1; i < idxArr.length; i++) {
                const g2 = groups[idxArr[i]];
                if (!g2 || g2 === group) continue;
                for (const rr of g2.runs) group.runs.push(rr);
                for (const k of g2.cells) {
                    group.cells.add(k);
                    cellGroup.set(k, groups.indexOf(group));
                }
                groups[idxArr[i]] = null;
            }
            group.runs.push(run);
        }
        const gIdx = groups.indexOf(group);
        for (const [r, c] of run.cells) {
            group.cells.add(key(r, c));
            cellGroup.set(key(r, c), gIdx);
        }
    }

    // 汇总每组信息：最大长度、方向、生成特殊糖果的落点
    const result = [];
    for (const g of groups) {
        if (!g) continue;
        let maxLen = 0, hasH = false, hasV = false;
        for (const run of g.runs) {
            if (run.dir === "h") hasH = true; else hasV = true;
            if (run.len > maxLen) maxLen = run.len;
        }
        let pivot;
        if (hasH && hasV) {
            // L/T 型：找交叉点（同时属于两个 run 的格子）
            for (const k of g.cells) {
                let cnt = 0;
                for (const run of g.runs) {
                    if (run.cells.some(([r, c]) => key(r, c) === k)) cnt++;
                }
                if (cnt >= 2) { pivot = k; break; }
            }
        } else {
            const longest = g.runs.reduce((a, b) => (b.len > a.len ? b : a));
            const mid = Math.floor(longest.cells.length / 2);
            pivot = key(longest.cells[mid][0], longest.cells[mid][1]);
        }
        if (!pivot) pivot = g.cells.values().next().value;
        result.push({ cells: g.cells, maxLen, hasH, hasV, pivot });
    }
    return result;
}

/* ===== 找到一个可合成交换步（返回 {r1,c1,r2,c2} 或 null） ===== */
function findHintMove() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (!cell || cell.wall || cell.frozen) continue;
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const r2 = r + dr, c2 = c + dc;
                if (!inBoard(r2, c2)) continue;
                const cell2 = grid[r2][c2];
                if (!cell2 || cell2.wall || cell2.frozen) continue;
                swapCells(r, c, r2, c2);
                const ok = findMatchGroups().length > 0;
                swapCells(r, c, r2, c2);
                if (ok) return { r1: r, c1: c, r2, c2 };
            }
        }
    }
    return null;
}

/* ===== 是否存在可行步（隔断块/冻结块不可交换） ===== */
function hasAnyMove() {
    if (findHintMove()) return true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (cell && !cell.wall && !cell.frozen && cell.special) return true; // 特殊糖果可主动触发
        }
    }
    return false;
}

/* ===== 无损交换（仅内部数据，不渲染） ===== */
function swapCells(r1, c1, r2, c2) {
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
}

/* ===== 特殊糖果效果触发（连锁扩散） ===== */
function expandSpecials(clearSet, r, c, triggered = new Set()) {
    const cell = grid[r][c];
    if (!cell || !cell.special) return;
    const k = key(r, c);
    if (triggered.has(k)) return;
    triggered.add(k);
    const { special } = cell;
    if (special === "striped-h") {
        for (let cc = 0; cc < COLS; cc++) addWithSpecial(clearSet, r, cc, triggered);
    } else if (special === "striped-v") {
        for (let rr = 0; rr < ROWS; rr++) addWithSpecial(clearSet, rr, c, triggered);
    } else if (special === "bomb") {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (inBoard(r + dr, c + dc)) addWithSpecial(clearSet, r + dr, c + dc, triggered);
            }
        }
    } else if (special === "rainbow") {
        // 彩虹糖：消除全场同色糖果
        for (let rr = 0; rr < ROWS; rr++) {
            for (let cc = 0; cc < COLS; cc++) {
                if (grid[rr][cc] && grid[rr][cc].color === cell.color) {
                    addWithSpecial(clearSet, rr, cc, triggered);
                }
            }
        }
    }
}

function addWithSpecial(clearSet, r, c, triggered) {
    const cell = grid[r][c];
    if (cell && cell.ingredient) return; // 食材不受特殊糖果波及
    clearSet.add(key(r, c));
    if (cell && cell.special) expandSpecials(clearSet, r, c, triggered);
}

/* ===== 相邻破冰：被消除格的上下左右若有冻结块，一并破冰（保留糖果） ===== */
function breakAdjacentIce(clearSet) {
    const broken = new Set();
    for (const k of clearSet) {
        const [r, c] = parseKey(k);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (!inBoard(nr, nc)) continue;
            const nk = key(nr, nc);
            if (clearSet.has(nk) || broken.has(nk)) continue;
            const cell = grid[nr][nc];
            if (cell && cell.frozen) {
                broken.add(nk);
                if (cell.el) cell.el.classList.add("ice-break");
            }
        }
    }
    return broken;
}

/* 破一层冰：层数-1，减到 0 才彻底解冻移除冰层样式（多层冰机制核心） */
function breakOneIce(cell) {
    if (!cell || !cell.frozen) return;
    cell.frozen--;
    if (cell.frozen <= 0) {
        cell.frozen = 0;
        if (cell.el) {
            cell.el.classList.remove("frozen", "ice-break");
            cell.el.removeAttribute("data-ice");
        }
    } else {
        if (cell.el) {
            cell.el.classList.remove("ice-break");
            cell.el.dataset.ice = cell.frozen;
        }
    }
}

function applyIceBreak(broken) {
    for (const k of broken) {
        const [r, c] = parseKey(k);
        breakOneIce(grid[r][c]);
    }
}

/* 破一层果冻：糖果被消除时其下方果冻减1层，减到0该格果冻清除 */
function breakOneJelly(r, c) {
    if (!jellyGrid[r] || !jellyGrid[r][c]) return;
    jellyGrid[r][c]--;
    jellyCleared++;
    if (jellyGrid[r][c] <= 0) jellyGrid[r][c] = 0;
}

/* ===== 消除主循环：处理匹配 → 特殊糖果生成 → 连击 ===== */
async function processMatches() {
    let combo = 0;
    while (true) {
        const groups = findMatchGroups();
        if (groups.length === 0) break;
        combo++;
        if (combo >= 2) { showCombo(combo); soundCombo(combo); }

        const clearSet = new Set();
        const specialsToCreate = [];
        for (const g of groups) {
            for (const k of g.cells) clearSet.add(k);
            // 按消除规模决定生成的特殊糖果
            let special = null;
            if (g.maxLen >= 5) special = "rainbow";
            else if (g.hasH && g.hasV) special = "bomb";
            else if (g.maxLen === 4) special = g.hasH ? "striped-h" : "striped-v";
            if (special) specialsToCreate.push({ at: g.pivot, special });
        }

        // 被消除格上若有特殊糖果则连锁触发
        const triggered = new Set();
        for (const k of [...clearSet]) {
            const [r, c] = parseKey(k);
            if (grid[r][c] && grid[r][c].special) expandSpecials(clearSet, r, c, triggered);
        }

        // 计分（连击加成）
        const mult = 1 + (combo - 1) * 0.5;
        const points = Math.round(clearSet.size * BASE_POINTS * mult);
        score += points;
        updateHUD();
        showFlyScore(points, clearSet);
        soundClear(clearSet.size, combo);
        if (specialsToCreate.length > 0) soundSpecial();

        // 播放消除动画（冻结块破冰，隔断块/普通糖果消除）
        const frozenKeys = new Set();
        for (const k of clearSet) {
            const [r, c] = parseKey(k);
            const cell = grid[r][c];
            if (!cell || !cell.el) continue;
            if (cell.frozen) {
                frozenKeys.add(k);
                cell.el.classList.add("ice-break");
            } else {
                cell.el.classList.add("clearing");
            }
        }
        // 相邻破冰：被消除格上下左右的冻结块也一并破冰
        const adjFrozen = breakAdjacentIce(clearSet);
        if (adjFrozen.size > 0) soundIceBreak();
        await sleep(clearMs);
        /* 目标埋点：须在移除前统计（水果计数需读取 grid 数据） */
        onCleared(clearSet, frozenKeys, adjFrozen);

        // 移除糖果（冻结块只破一层冰保留糖果），放置生成的特殊糖果
        for (const k of clearSet) {
            const [r, c] = parseKey(k);
            const cell = grid[r][c];
            if (!cell) continue;
            if (frozenKeys.has(k)) {
                breakOneIce(cell);
                continue;
            }
            breakOneJelly(r, c);
            if (cell.el) cell.el.remove();
            grid[r][c] = null;
        }
        applyIceBreak(adjFrozen);
        for (const sp of specialsToCreate) {
            if (!clearSet.has(sp.at) || frozenKeys.has(sp.at)) continue;
            const [r, c] = parseKey(sp.at);
            grid[r][c] = makeCell(randColor(), sp.special);
        }
        // 渲染新生成的特殊糖果元素
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                if (cell && !cell.el) {
                    cell.el = createCandyEl(cell, r, c);
                    boardEl.appendChild(cell.el);
                }
            }
        }

        await dropAndRefill();
    }
    return combo;
}

/* ===== 重力掉落与补块（隔断块/冻结块/空洞不动，糖果堆积在其上方） ===== */
/* 食材到达列底部即收集（循环重力+收集直至稳定，再补新糖果） */
async function dropAndRefill() {
    let dropped = false;
    while (true) {
        // 重力掉落
        let gravDropped = false;
        for (let c = 0; c < COLS; c++) {
            let write = ROWS - 1;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (holeSet.has(key(r, c))) {
                    // 空洞格是锚点：不可通过，上方糖果堆积在它上面
                    write = r - 1;
                    continue;
                }
                const cell = grid[r][c];
                if (!cell) continue;
                if (cell.wall || cell.frozen) {
                    // 障碍格是锚点：不可移动，上方糖果堆积在它上面
                    write = r - 1;
                    continue;
                }
                if (write !== r) {
                    grid[write][c] = grid[r][c];
                    grid[r][c] = null;
                    gravDropped = true;
                }
                write--;
            }
        }
        // 食材收集：到达列底部的食材移除并计数
        let collected = 0;
        for (let c = 0; c < COLS; c++) {
            const br = bottomRowOf(c);
            if (br < 0) continue;
            const cell = grid[br][c];
            if (cell && cell.ingredient) {
                if (cell.el) cell.el.remove();
                grid[br][c] = null;
                ingredientsCollected++;
                collected++;
            }
        }
        if (collected > 0) soundSpecial();
        if (!gravDropped && collected === 0) break;
        dropped = dropped || gravDropped || collected > 0;
    }
    // 补新糖果（所有空格，空洞除外）
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (!grid[r][c] && !holeSet.has(key(r, c))) {
                grid[r][c] = makeCell(randColor());
                dropped = true;
            }
        }
    }
    if (dropped) {
        soundDrop();
        render();
        await sleep(dropMs);
    }
}

/* ===== 交换两格并重渲染 ===== */
function doSwapRender(r1, c1, r2, c2) {
    swapCells(r1, c1, r2, c2);
    render();
}

/* ===== 玩家交换处理：无效则回退（隔断块/冻结块不可交换） ===== */
async function handleSwap(r1, c1, r2, c2) {
    const a = grid[r1][c1], b = grid[r2][c2];
    if (!a || !b || a.wall || b.wall || a.frozen || b.frozen) {
        soundInvalid();
        if ((a && a.frozen) || (b && b.frozen)) {
            hintEl.textContent = "❄️ 冻结块不可交换，在它旁边消除即可破冰！";
        } else if ((a && a.wall) || (b && b.wall)) {
            hintEl.textContent = "🧱 隔断块不可交换！";
        }
        return;
    }
    busy = true;
    doSwapRender(r1, c1, r2, c2);
    await sleep(dropMs);
    /* 组合技：双方均为特殊糖果时直接触发，无需凑成三连 */
    if (a.special && b.special) {
        await activateCombo(r1, c1, r2, c2);
        return;
    }
    const groups = findMatchGroups();
    if (groups.length === 0) {
        // 无效交换：回退
        soundInvalid();
        doSwapRender(r1, c1, r2, c2);
        await sleep(dropMs);
        busy = false;
        return;
    }
    movesLeft--;
    await processMatches();
    await checkBoardState();
    busy = false;
    await checkLevelEnd();
}

/* ===== 特殊糖果组合技：两个特殊糖果交换产生增强效果 ===== */
/* 交换后原 a 位于 (r2,c2)，原 b 位于 (r1,c1) */
async function activateCombo(r1, c1, r2, c2) {
    const a = grid[r2][c2], b = grid[r1][c1];
    const sa = a.special, sb = b.special;
    const isR = s => s === "rainbow";
    const isS = s => s === "striped-h" || s === "striped-v";
    const isB = s => s === "bomb";

    movesLeft--;
    soundExplosion();
    hintEl.textContent = "✨ 组合技触发！";

    const clearSet = new Set();
    const triggered = new Set();
    /* 中心点取交换后 b 的位置 */
    const midR = r1, midC = c1;

    if (isR(sa) && isR(sb)) {
        /* 彩虹+彩虹：全屏清除 */
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (grid[r][c] && !grid[r][c].wall) addWithSpecial(clearSet, r, c, triggered);
    } else if (isR(sa) || isR(sb)) {
        /* 彩虹+条纹/炸弹：全场同色普通糖果变为对应特殊糖果并全部触发 */
        const otherCell = isR(sa) ? b : a;
        const targetColor = otherCell.color;
        const newSpecial = isS(otherCell.special) ? otherCell.special : "bomb";
        const converted = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                if (cell && !cell.wall && !cell.frozen && !cell.special && cell.color === targetColor) {
                    cell.special = newSpecial;
                    converted.push([r, c]);
                }
            }
        }
        render();
        soundSpecial();
        await sleep(200);
        for (const [r, c] of converted) {
            if (grid[r][c] && grid[r][c].special) addWithSpecial(clearSet, r, c, triggered);
        }
        /* 两个原始特殊糖果一并消除 */
        clearSet.add(key(r1, c1));
        clearSet.add(key(r2, c2));
    } else if (isS(sa) && isS(sb)) {
        /* 条纹+条纹：十字清除（整行+整列） */
        for (let c = 0; c < COLS; c++) addWithSpecial(clearSet, midR, c, triggered);
        for (let r = 0; r < ROWS; r++) addWithSpecial(clearSet, r, midC, triggered);
    } else if ((isS(sa) && isB(sb)) || (isB(sa) && isS(sb))) {
        /* 条纹+炸弹：三行三列清除 */
        for (let dr = -1; dr <= 1; dr++)
            for (let c = 0; c < COLS; c++)
                if (inBoard(midR + dr, c)) addWithSpecial(clearSet, midR + dr, c, triggered);
        for (let dc = -1; dc <= 1; dc++)
            for (let r = 0; r < ROWS; r++)
                if (inBoard(r, midC + dc)) addWithSpecial(clearSet, r, midC + dc, triggered);
    } else if (isB(sa) && isB(sb)) {
        /* 炸弹+炸弹：5×5 范围爆炸 */
        for (let dr = -2; dr <= 2; dr++)
            for (let dc = -2; dc <= 2; dc++)
                if (inBoard(midR + dr, midC + dc)) addWithSpecial(clearSet, midR + dr, midC + dc, triggered);
    }

    /* 计分（组合技 1.5 倍加成） */
    const points = Math.round(clearSet.size * BASE_POINTS * 1.5);
    score += points;
    updateHUD();
    showFlyScore(points, clearSet);

    /* 消除动画与移除（流程与 activateSpecial 一致） */
    const frozenKeys = new Set();
    for (const k of clearSet) {
        const [rr, cc] = parseKey(k);
        const cell = grid[rr][cc];
        if (!cell || !cell.el) continue;
        if (cell.frozen) { frozenKeys.add(k); cell.el.classList.add("ice-break"); }
        else cell.el.classList.add("clearing");
    }
    const adjFrozen = breakAdjacentIce(clearSet);
    if (adjFrozen.size > 0) soundIceBreak();
    await sleep(clearMs);
    onCleared(clearSet, frozenKeys, adjFrozen);

    for (const k of clearSet) {
        const [rr, cc] = parseKey(k);
        const cell = grid[rr][cc];
        if (!cell) continue;
        if (frozenKeys.has(k)) { breakOneIce(cell); continue; }
        breakOneJelly(rr, cc);
        if (cell.el) cell.el.remove();
        grid[rr][cc] = null;
    }
    applyIceBreak(adjFrozen);

    await dropAndRefill();
    await processMatches();
    await checkBoardState();
    busy = false;
    await checkLevelEnd();
}

/* ===== 点击/拖动特殊糖果：主动触发 ===== */
async function activateSpecial(r, c) {
    busy = true;
    soundExplosion();
    const clearSet = new Set();
    const triggered = new Set();
    expandSpecials(clearSet, r, c, triggered);
    const points = Math.round(clearSet.size * BASE_POINTS);
    score += points;
    updateHUD();
    showFlyScore(points, clearSet);
    const frozenKeys = new Set();
    for (const k of clearSet) {
        const [rr, cc] = parseKey(k);
        const cell = grid[rr][cc];
        if (!cell || !cell.el) continue;
        if (cell.frozen) {
            frozenKeys.add(k);
            cell.el.classList.add("ice-break");
        } else {
            cell.el.classList.add("clearing");
        }
    }
    // 相邻破冰：特殊糖果波及范围旁的冻结块也破冰
    const adjFrozen = breakAdjacentIce(clearSet);
    if (adjFrozen.size > 0) soundIceBreak();
    await sleep(clearMs);
    onCleared(clearSet, frozenKeys, adjFrozen);
    for (const k of clearSet) {
        const [rr, cc] = parseKey(k);
        const cell = grid[rr][cc];
        if (!cell) continue;
        if (frozenKeys.has(k)) {
            breakOneIce(cell);
            continue;
        }
        breakOneJelly(rr, cc);
        if (cell.el) cell.el.remove();
        grid[rr][cc] = null;
    }
    applyIceBreak(adjFrozen);
    await dropAndRefill();
    await processMatches();
    await checkBoardState();
    if (!inBonus) {
        busy = false;
        checkLevelEnd();
    }
}

/* ===== 掉落后棋盘可能死局：检测并洗牌（洗牌后需消除新凑出的三连） ===== */
async function checkBoardState() {
    let guard = 0;
    while (!hasAnyMove() && guard < 20) {
        guard++;
        hintEl.textContent = "无可消除，自动洗牌...";
        await sleep(400);
        shuffleBoard();
        render();
        await sleep(dropMs);
        /* 洗牌打乱颜色后可能恰好凑出三连，必须继续消除，
           否则会出现"三个连一起也不自动消除"的问题 */
        await processMatches();
    }
}

/* ===== 洗牌（保留特殊糖果，隔断块/冻结块/空洞不参与） ===== */
/* 随机重新分配颜色（而非仅排列现有色），保证更高概率凑出可行步；
   同时避免洗牌后立即三连，让棋盘稳定呈现 */
function shuffleBoard() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (!cell || cell.wall || cell.frozen || cell.special || cell.ingredient) continue;
            let color;
            let guard = 0;
            do {
                color = randColor();
                guard++;
            } while (
                guard < 30 &&
                ((c >= 2 && grid[r][c - 1] && !grid[r][c - 1].wall && grid[r][c - 2] && !grid[r][c - 2].wall &&
                    !holeSet.has(key(r, c - 1)) && !holeSet.has(key(r, c - 2)) &&
                    grid[r][c - 1].color === color && grid[r][c - 2].color === color) ||
                 (r >= 2 && grid[r - 1][c] && !grid[r - 1][c].wall && grid[r - 2][c] && !grid[r - 2][c].wall &&
                    !holeSet.has(key(r - 1, c)) && !holeSet.has(key(r - 2, c)) &&
                    grid[r - 1][c].color === color && grid[r - 2][c].color === color))
            );
            cell.color = color;
        }
    }
}

/* ===== 关卡目标系统：分数 / 破冰 / 收集水果 ===== */
/* 消除埋点：clearSet 被消除的格子，frozenKeys 其中破冰保留的，adjFrozen 相邻破冰的 */
function onCleared(clearSet, frozenKeys, adjFrozen) {
    if (!goal) return;
    /* 水果收集：真正被消除的糖果（破冰保留的不算） */
    if (goal.type === "fruit") {
        for (const k of clearSet) {
            if (frozenKeys && frozenKeys.has(k)) continue;
            const [r, c] = parseKey(k);
            const cell = grid[r][c];
            if (!cell || cell.wall) continue;
            if (goal.target[cell.color] !== undefined) {
                fruitCleared[cell.color] = (fruitCleared[cell.color] || 0) + 1;
            }
        }
    }
    /* 破冰计数：被消除格上的冰 + 相邻破冰 */
    if (goal.type === "ice") {
        iceBroken += (frozenKeys ? frozenKeys.size : 0) + (adjFrozen ? adjFrozen.size : 0);
    }
}

/* 目标完成度百分比（用于进度条） */
function goalProgress() {
    if (devMode) return 0;
    if (!goal) return Math.min(100, Math.round((score / Math.max(1, target)) * 100));
    if (goal.type === "score") return Math.min(100, Math.round((score / goal.target) * 100));
    if (goal.type === "ice") return Math.min(100, Math.round((iceBroken / goal.target) * 100));
    if (goal.type === "jelly") return Math.min(100, Math.round((jellyCleared / goal.target) * 100));
    if (goal.type === "ingredient") return Math.min(100, Math.round((ingredientsCollected / goal.target) * 100));
    if (goal.type === "fruit") {
        let total = 0, done = 0;
        for (const c in goal.target) {
            total += goal.target[c];
            done += Math.min(fruitCleared[c] || 0, goal.target[c]);
        }
        return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    }
    return 0;
}

/* 是否达成通关目标 */
function goalAchieved() {
    if (!goal) return score >= target;
    if (goal.type === "score") return score >= goal.target;
    if (goal.type === "ice") return iceBroken >= goal.target;
    if (goal.type === "jelly") return jellyCleared >= goal.target;
    if (goal.type === "ingredient") return ingredientsCollected >= goal.target;
    if (goal.type === "fruit") {
        for (const c in goal.target) {
            if ((fruitCleared[c] || 0) < goal.target[c]) return false;
        }
        return true;
    }
    return false;
}

/* goals-bar：详细目标进度条目 */
function updateGoalsBar() {
    const bar = document.getElementById("goals-bar");
    if (!bar) return;
    if (!goal) { bar.innerHTML = ""; return; }
    let html = "";
    if (goal.type === "score") {
        html += '<span class="goal-item' + (score >= goal.target ? " done" : "") + '">🎯 ' + score + '/' + goal.target + '</span>';
    } else if (goal.type === "ice") {
        html += '<span class="goal-item' + (iceBroken >= goal.target ? " done" : "") + '">❄️ ' + iceBroken + '/' + goal.target + '</span>';
    } else if (goal.type === "jelly") {
        html += '<span class="goal-item' + (jellyCleared >= goal.target ? " done" : "") + '">🧃 ' + jellyCleared + '/' + goal.target + '</span>';
    } else if (goal.type === "ingredient") {
        html += '<span class="goal-item' + (ingredientsCollected >= goal.target ? " done" : "") + '">🥥 ' + ingredientsCollected + '/' + goal.target + '</span>';
    } else if (goal.type === "fruit") {
        for (const c in goal.target) {
            const got = fruitCleared[c] || 0;
            const need = goal.target[c];
            html += '<span class="goal-item' + (got >= need ? " done" : "") + '">' + CANDY_ICONS[c] + ' ' + got + '/' + need + '</span>';
        }
    }
    bar.innerHTML = html;
}

/* 关卡开场提示文案 */
function goalHintText() {
    if (!goal) return "滑动、拖动或点击相邻糖果交换，三连即可消除！";
    if (goal.type === "score") return "达到目标分数即可过关！";
    if (goal.type === "ice") return "❄️ 在冰块旁边消除，破冰 " + goal.target + " 层即可过关！";
    if (goal.type === "jelly") return "🧃 消除果冻上方的糖果，清除 " + goal.target + " 层果冻即可过关！";
    if (goal.type === "ingredient") return "🥥 消除食材下方的糖果，让 " + goal.target + " 个食材落到底部即可过关！";
    if (goal.type === "fruit") {
        const parts = Object.keys(goal.target).map((c) => CANDY_ICONS[c] + "x" + goal.target[c]);
        return "收集指定水果即可过关：" + parts.join("  ");
    }
    return "滑动、拖动或点击相邻糖果交换，三连即可消除！";
}

/* 星级评定：分数关按超额完成度，其他关按剩余步数（bonusRound 前调用） */
function calcStars() {
    if (!goal || goal.type === "score") {
        const t = goal ? goal.target : target;
        if (score >= t * 1.5) return 3;
        if (score >= t * 1.2) return 2;
        return 1;
    }
    const total = getLevelConfig(level).moves;
    if (movesLeft >= Math.ceil(total * 0.3)) return 3;
    if (movesLeft > 0) return 2;
    return 1;
}

/* ===== HUD / 进度条 / 连击 / 飞行分数 ===== */
function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    if (goal && goal.type === "ice") {
        targetEl.textContent = "❄️" + iceBroken + "/" + goal.target;
    } else if (goal && goal.type === "jelly") {
        targetEl.textContent = "🧃" + jellyCleared + "/" + goal.target;
    } else if (goal && goal.type === "ingredient") {
        targetEl.textContent = "🥥" + ingredientsCollected + "/" + goal.target;
    } else if (goal && goal.type === "fruit") {
        let d = 0, t = 0;
        for (const c in goal.target) {
            d += Math.min(fruitCleared[c] || 0, goal.target[c]);
            t += goal.target[c];
        }
        targetEl.textContent = d + "/" + t;
    } else {
        targetEl.textContent = target;
    }
    movesEl.textContent = devMode ? "∞" : movesLeft;
    progressEl.style.width = goalProgress() + "%";
    updateGoalsBar();
    for (const t2 in toolCountEls) {
        toolCountEls[t2].textContent = tools[t2];
        toolBtns[t2].classList.toggle("disabled", tools[t2] <= 0);
    }
}

function updateSelection() {
    document.querySelectorAll(".candy.selected").forEach((el) => el.classList.remove("selected"));
    if (selectedKey) {
        const [r, c] = parseKey(selectedKey);
        const cell = grid[r] && grid[r][c];
        if (cell && cell.el) cell.el.classList.add("selected");
    }
}



function showCombo(n) {
    const word = getComboWord(n);
    comboBanner.textContent = word + "!";
    comboBanner.dataset.level = Math.min(n, 8); // CSS 按等级配色
    /* 重启动画：先移除 show 再强制回流，保证连续连击每次都弹出 */
    comboBanner.classList.remove("show");
    void comboBanner.offsetWidth;
    comboBanner.classList.add("show");
    clearTimeout(comboBanner._hideTimer);
    comboBanner._hideTimer = setTimeout(() => comboBanner.classList.remove("show"), 900);
}

function showFlyScore(points, clearSet) {
    // 在消除区域中心显示飞行分数
    let sumR = 0, sumC = 0, n = 0;
    for (const k of clearSet) {
        const [r, c] = parseKey(k);
        sumR += r; sumC += c; n++;
    }
    const avgR = sumR / n, avgC = sumC / n;
    const cellSize = boardEl.querySelector(".candy") ? boardEl.querySelector(".candy").offsetWidth : 56;
    const fly = document.createElement("div");
    fly.className = "fly-score";
    fly.textContent = "+" + points;
    fly.style.left = (avgC * (cellSize + 4)) + "px";
    fly.style.top = (avgR * (cellSize + 4)) + "px";
    boardEl.appendChild(fly);
    setTimeout(() => fly.remove(), 900);
}

/* ===== 奖励光点：从剩余步数飞向目标糖果 ===== */
function flyBonusOrb(targetR, targetC) {
    const movesRect = movesEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const cellSize = boardEl.querySelector(".candy") ? boardEl.querySelector(".candy").offsetWidth : 56;
    // 目标糖果中心（棋盘 padding 10px + 格间距 4px）
    const targetX = boardRect.left + 10 + targetC * (cellSize + 4) + cellSize / 2;
    const targetY = boardRect.top + 10 + targetR * (cellSize + 4) + cellSize / 2;
    const startX = movesRect.left + movesRect.width / 2;
    const startY = movesRect.top + movesRect.height / 2;

    const orb = document.createElement("div");
    orb.className = "bonus-orb";
    document.body.appendChild(orb);

    const flyMs = 360;
    const anim = orb.animate([
        { left: startX + "px", top: startY + "px", transform: "translate(-50%,-50%) scale(0.4)", opacity: 0.7 },
        { transform: "translate(-50%,-50%) scale(1.6)", opacity: 1, offset: 0.25 },
        { left: targetX + "px", top: targetY + "px", transform: "translate(-50%,-50%) scale(1)", opacity: 1 }
    ], { duration: flyMs, easing: "cubic-bezier(0.45, 0, 0.55, 1)", fill: "forwards" });
    anim.onfinish = () => orb.remove();
    /* 兜底：切后台等情况下 onfinish 可能不触发，防止光点残留在 body 上越积越多 */
    setTimeout(() => { if (orb.parentNode) orb.remove(); }, flyMs + 800);
    return flyMs;
}

/* ===== 关卡结束判定（按目标类型判定通关） ===== */
async function checkLevelEnd() {
    if (gameOver || devMode) return;
    if (goalAchieved()) {
        gameOver = true;
        winStars = calcStars(); // bonusRound 消耗步数前先算星级
        if (movesLeft > 0) await bonusRound();
        showModal("win");
    } else if (movesLeft <= 0) {
        gameOver = true;
        showModal("lose");
    }
}

/* ===== 过关奖励：剩余步数化为条纹糖果依次引爆 ===== */
let inBonus = false;
async function bonusRound() {
    inBonus = true;
    busy = true;
    // 加速模式：消除/掉落动画提速约一倍，结算不拖沓
    clearMs = Math.round(CLEAR_MS * 0.45);
    dropMs = Math.round(DROP_MS * 0.45);
    hintEl.textContent = "🎁 剩余步数结算中...";
    const stepBonus = BASE_POINTS * 3; // 每步额外奖励
    while (movesLeft > 0) {
        // 随机选一个普通糖果作为光点落点（排除障碍格）
        const candidates = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                if (cell && !cell.wall && !cell.frozen && !cell.special && !cell.ingredient) candidates.push([r, c]);
            }
        }
        if (candidates.length === 0) break;
        const [r, c] = candidates[Math.floor(Math.random() * candidates.length)];

        // 步数高亮脉冲 + 光点从步数飞向目标糖果
        movesEl.classList.add("moves-pulse");
        const flyMs = flyBonusOrb(r, c);
        await sleep(flyMs);
        movesEl.classList.remove("moves-pulse");

        // 光点到达：步数-1，加分
        movesLeft--;
        score += stepBonus;
        updateHUD();

        // 目标糖果升级为条纹糖果并立即引爆（含连锁、掉落）
        grid[r][c].special = Math.random() < 0.5 ? "striped-h" : "striped-v";
        render();
        soundSpecial();
        await sleep(80);
        await activateSpecial(r, c);
    }
    // 恢复正常速度
    clearMs = CLEAR_MS;
    dropMs = DROP_MS;
    hintEl.textContent = "🎉 结算完成！";
    inBonus = false;
}

/* ===== 弹窗 ===== */
function showModal(mode) {
    modalMode = mode;
    stopHint();
    if (mode === "win") soundWin(); else soundLose();
    modal.classList.remove("hidden");
    if (mode === "win") {
        // 星级：checkLevelEnd 在 bonusRound 前已计算
        const stars = winStars;
        levelStars[level] = Math.max(levelStars[level] || 0, stars);
        localStorage.setItem("xxl_stars", JSON.stringify(levelStars));
        // 解锁下一关
        if (level >= unlockedLevel) {
            unlockedLevel = level + 1;
            localStorage.setItem("xxl_unlocked", String(unlockedLevel));
        }
        modalTitle.textContent = "🎉 恭喜过关！";
        modalText.textContent = "⭐".repeat(stars) + "  分数 " + score;
        modalBtn.textContent = "下一关";
    } else {
        modalTitle.textContent = "😢 闯关失败";
        let msg;
        if (goal && goal.type === "ice") {
            msg = "需破冰 " + goal.target + " 层，已破 " + iceBroken + " 层";
        } else if (goal && goal.type === "fruit") {
            msg = "水果未集齐：" + Object.keys(goal.target)
                .map((c) => CANDY_ICONS[c] + (fruitCleared[c] || 0) + "/" + goal.target[c]).join("  ");
        } else {
            msg = "目标 " + target + " 分，本次得分 " + score + (score >= target * 0.7 ? "，就差一点！" : "");
        }
        modalText.textContent = msg;
        modalBtn.textContent = "返回选关";
    }
}

function hideModal() {
    modal.classList.add("hidden");
    modalMode = null;
}

/* ===== 开始关卡（nextLevel=true 进入下一关，否则重开当前 level 关） ===== */
function startGame(nextLevel) {
    if (nextLevel) level++;
    const cfg = getLevelConfig(level);
    goal = cfg.goal;
    target = goal && goal.type === "score" ? goal.target : 0;
    iceBroken = 0;
    fruitCleared = {};
    jellyCleared = 0;
    jellyGrid = [];
    ingredientsCollected = 0;
    movesLeft = cfg.moves;
    if (nextLevel) {
        // 道具补给
        tools.hammer = Math.min(3, tools.hammer + 1);
        tools.bomb = Math.min(2, tools.bomb + 1);
        tools.shuffle = 1;
        tools.swap = Math.min(3, tools.swap + 1);
    } else {
        tools = { hammer: 3, bomb: 1, shuffle: 1, swap: 2 };
    }
    score = 0;
    gameOver = false;
    busy = false;
    activeTool = null;
    selectedKey = null;
    swapFirst = null;
    /* 清理可能残留的奖励光点，防止跨关卡累积 */
    document.querySelectorAll(".bonus-orb").forEach((el) => el.remove());
    stopHint();
    lastActionTime = Date.now();
    hintEl.textContent = goalHintText();
    initBoard();
    render();
    updateHUD();
    hideModal();
}

/* ===== 道具选择 ===== */
function setTool(name) {
    markAction();
    if (busy || gameOver) return;
    if (tools[name] <= 0) return;
    activeTool = activeTool === name ? null : name;
    selectedKey = null;
    swapFirst = null;
    updateSelection();
    for (const t in toolBtns) toolBtns[t].classList.toggle("active", t === activeTool);
    if (activeTool === "hammer") hintEl.textContent = "🔨 锤子：点击要敲掉的糖果";
    else if (activeTool === "bomb") hintEl.textContent = "💣 炸弹：点击中心格，炸掉 3x3";
    else if (activeTool === "shuffle") hintEl.textContent = "🔄 刷新：立即洗牌";
    else if (activeTool === "swap") hintEl.textContent = "🔀 换位：点击两个任意糖果交换";
    else hintEl.textContent = "滑动、拖动或点击相邻糖果交换，三连即可消除！";
}

/* ===== 使用道具 ===== */
async function useTool(r, c) {
    const tool = activeTool;
    activeTool = null;
    soundTool();
    for (const t in toolBtns) toolBtns[t].classList.remove("active");
    if (tool === "hammer") {
        const cell = grid[r][c];
        if (cell && cell.ingredient) {
            hintEl.textContent = "🥥 食材不能用锤子敲掉！";
            activeTool = "hammer";
            toolBtns.hammer.classList.add("active");
            return;
        }
        tools.hammer--;
        updateHUD();
        busy = true;
        if (cell) {
            if (cell.frozen) {
                // 锤子破一层冰：糖果保留
                cell.el.classList.add("ice-break");
                await sleep(clearMs);
                breakOneIce(cell);
                if (goal && goal.type === "ice") iceBroken++;
            } else {
                // 锤子敲掉普通糖果：计入水果目标（需在移除前统计）
                onCleared(new Set([key(r, c)]), null, null);
                cell.el.classList.add("clearing");
                await sleep(clearMs);
                breakOneJelly(r, c);
                cell.el.remove();
                grid[r][c] = null;
            }
        }
        score += BASE_POINTS;
        updateHUD();
        await dropAndRefill();
        await processMatches();
        await checkBoardState();
        busy = false;
        hintEl.textContent = "滑动、拖动或点击相邻糖果交换，三连即可消除！";
    } else if (tool === "bomb") {
        tools.bomb--;
        updateHUD();
        busy = true;
        const clearSet = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (inBoard(r + dr, c + dc)) clearSet.add(key(r + dr, c + dc));
            }
        }
        // 食材不受炸弹波及
        for (const k of [...clearSet]) {
            const [rr, cc] = parseKey(k);
            if (grid[rr][cc] && grid[rr][cc].ingredient) clearSet.delete(k);
        }
        const points = clearSet.size * BASE_POINTS;
        score += points;
        updateHUD();
        showFlyScore(points, clearSet);
        const frozenKeys = new Set();
        for (const k of clearSet) {
            const [rr, cc] = parseKey(k);
            const cell2 = grid[rr][cc];
            if (!cell2 || !cell2.el) continue;
            if (cell2.frozen) {
                frozenKeys.add(k);
                cell2.el.classList.add("ice-break");
            } else {
                cell2.el.classList.add("clearing");
            }
        }
        // 相邻破冰：爆炸范围旁的冻结块也破冰
        const adjFrozen = breakAdjacentIce(clearSet);
        if (adjFrozen.size > 0) soundIceBreak();
        await sleep(clearMs);
        onCleared(clearSet, frozenKeys, adjFrozen);
        for (const k of clearSet) {
            const [rr, cc] = parseKey(k);
            const cell2 = grid[rr][cc];
            if (!cell2) continue;
            if (frozenKeys.has(k)) {
                breakOneIce(cell2);
                continue;
            }
            breakOneJelly(rr, cc);
            if (cell2.el) cell2.el.remove();
            grid[rr][cc] = null;
        }
        applyIceBreak(adjFrozen);
        await dropAndRefill();
        await processMatches();
        await checkBoardState();
        busy = false;
        hintEl.textContent = "滑动、拖动或点击相邻糖果交换，三连即可消除！";
    } else if (tool === "swap") {
        const pickCell = grid[r][c];
        if (!pickCell || pickCell.wall || pickCell.frozen) {
            hintEl.textContent = "隔断块和冻结块不可换位！";
            activeTool = "swap";
            toolBtns.swap.classList.add("active");
            return;
        }
        if (!swapFirst) {
            swapFirst = key(r, c);
            selectedKey = swapFirst;
            updateSelection();
            hintEl.textContent = "再点击第二个糖果完成换位";
            activeTool = "swap"; // 保持道具激活
            toolBtns.swap.classList.add("active");
            return;
        }
        const [r1, c1] = parseKey(swapFirst);
        if (r1 === r && c1 === c) { // 取消
            swapFirst = null;
            selectedKey = null;
            updateSelection();
            return;
        }
        tools.swap--;
        updateHUD();
        swapFirst = null;
        selectedKey = null;
        updateSelection();
        // 换位道具：不消耗步数的自由交换
        doSwapRender(r1, c1, r, c);
        await sleep(dropMs);
        const groups = findMatchGroups();
        if (groups.length === 0) {
            doSwapRender(r1, c1, r, c); // 回退
        } else {
            busy = true;
            await processMatches();
            await checkBoardState();
            busy = false;
            await checkLevelEnd();
        }
        hintEl.textContent = "滑动、拖动或点击相邻糖果交换，三连即可消除！";
    }
}

/* ===== 洗牌道具 ===== */
async function useShuffleTool() {
    tools.shuffle--;
    updateHUD();
    busy = true;
    shuffleBoard();
    render();
    await sleep(dropMs);
    await processMatches();
    await checkBoardState();
    busy = false;
    hintEl.textContent = "滑动、拖动或点击相邻糖果交换，三连即可消除！";
}

/* ===== 无操作提示：10秒无操作时模拟交换动画，用户操作立即停止 ===== */
function stopHint() {
    if (!hintActive) return;
    hintActive = false;
    document.querySelectorAll(".candy.hint-swap").forEach((el) => {
        el.classList.remove("hint-swap");
        el.style.removeProperty("--hx");
        el.style.removeProperty("--hy");
    });
}

function startHint() {
    if (hintActive || busy || gameOver) return;
    const move = findHintMove();
    if (!move) return;
    const cellA = grid[move.r1][move.c1];
    const cellB = grid[move.r2][move.c2];
    if (!cellA || !cellB || !cellA.el || !cellB.el) return;
    const dx = cellB.el.offsetLeft - cellA.el.offsetLeft;
    const dy = cellB.el.offsetTop - cellA.el.offsetTop;
    cellA.el.style.setProperty("--hx", dx + "px");
    cellA.el.style.setProperty("--hy", dy + "px");
    cellB.el.style.setProperty("--hx", -dx + "px");
    cellB.el.style.setProperty("--hy", -dy + "px");
    cellA.el.classList.add("hint-swap");
    cellB.el.classList.add("hint-swap");
    hintActive = true;
}

/* 用户有任何操作时调用：重置计时并立即停止提示 */
function markAction() {
    lastActionTime = Date.now();
    stopHint();
}

setInterval(() => {
    if (busy || gameOver) { stopHint(); return; }
    if (Date.now() - lastActionTime >= 10000) startHint();
}, 1000);

/* ===== 点击/拖动事件 ===== */
function getCandyFromEvent(e) {
    const el = e.target.closest(".candy");
    if (!el) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function onBoardPointerDown(e) {
    markAction();
    if (busy || gameOver) return;
    const pos = getCandyFromEvent(e);
    if (!pos) return;
    if (activeTool === "hammer" || activeTool === "bomb" || activeTool === "swap") {
        useTool(pos.r, pos.c);
        return;
    }
    // 隔断块/冻结块不可选中
    const downCell = grid[pos.r][pos.c];
    if (downCell && downCell.wall) return;
    if (downCell && downCell.frozen) {
        hintEl.textContent = "❄️ 冻结块不可交换，在它旁边消除即可破冰！";
        return;
    }
    // 已选中一个糖果，再点击相邻糖果 → 点选交换
    if (selectedKey && selectedKey !== key(pos.r, pos.c)) {
        const [sr, sc] = parseKey(selectedKey);
        if (isAdjacent(sr, sc, pos.r, pos.c)) {
            selectedKey = null;
            updateSelection();
            handleSwap(sr, sc, pos.r, pos.c);
            return;
        }
    }
    dragStart = pos;
    selectedKey = key(pos.r, pos.c);
    updateSelection();
    /* 记录滑动起点，用于跟手位移与阈值触发换位 */
    swipeInfo = {
        x: e.clientX, y: e.clientY,
        r: pos.r, c: pos.c,
        el: downCell.el,
        cellSize: downCell.el ? downCell.el.offsetWidth : 56,
        tracking: false,   // 是否已进入跟手模式
        triggered: false,  // 滑动换位是否已触发
    };
    /* 捕获指针：手指滑出糖果/棋盘也能持续收到 move/up 事件 */
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
}

/* ===== 滑动换位：跟手位移 + 超阈值自动触发交换 ===== */
/* 取消滑动：恢复糖果位置与状态 */
function cancelSwipe() {
    if (swipeInfo && swipeInfo.el) {
        swipeInfo.el.classList.remove("swiping");
        swipeInfo.el.style.transform = "";
    }
    swipeInfo = null;
}

function onBoardPointerMove(e) {
    if (!swipeInfo || swipeInfo.triggered) return;
    if (busy || gameOver) { cancelSwipe(); return; }
    const dx = e.clientX - swipeInfo.x;
    const dy = e.clientY - swipeInfo.y;
    const dist = Math.hypot(dx, dy);
    const cellSize = swipeInfo.cellSize;
    const triggerDist = cellSize * 0.35; // 滑动触发阈值：格子尺寸的 35%

    /* 位移超过 6px 进入跟手模式：取消选中动画，禁用过渡保证跟手流畅 */
    if (!swipeInfo.tracking && dist > 6) {
        swipeInfo.tracking = true;
        selectedKey = null;
        updateSelection();
        if (swipeInfo.el) swipeInfo.el.classList.add("swiping");
    }

    if (dist < triggerDist) {
        /* 未达阈值：糖果跟手微移（限制在半格内，避免越界视觉） */
        if (swipeInfo.tracking && swipeInfo.el) {
            const limit = cellSize * 0.45;
            const cx = Math.max(-limit, Math.min(limit, dx));
            const cy = Math.max(-limit, Math.min(limit, dy));
            swipeInfo.el.style.transform = "translate(" + cx + "px," + cy + "px)";
        }
        return;
    }

    /* 达到阈值：按主方向立即触发换位，无需等松手 */
    swipeInfo.triggered = true;
    if (swipeInfo.el) {
        swipeInfo.el.classList.remove("swiping");
        swipeInfo.el.style.transform = "";
    }
    let dr = 0, dc = 0;
    if (Math.abs(dx) >= Math.abs(dy)) dc = dx > 0 ? 1 : -1;
    else dr = dy > 0 ? 1 : -1;
    const r2 = swipeInfo.r + dr, c2 = swipeInfo.c + dc;
    const sr = swipeInfo.r, sc = swipeInfo.c;
    swipeInfo = null;
    dragStart = null;
    /* 滑出棋盘边界：取消换位（糖果自动回弹） */
    if (!inBoard(r2, c2)) return;
    handleSwap(sr, sc, r2, c2);
}

function onBoardPointerUp(e) {
    markAction();
    /* 恢复跟手位移，结束滑动状态 */
    const info = swipeInfo;
    if (info && info.el) {
        info.el.classList.remove("swiping");
        info.el.style.transform = "";
    }
    swipeInfo = null;
    if (busy || gameOver) { dragStart = null; return; }
    if (!dragStart) return;
    /* 滑动换位已触发，不再走点选/拖动逻辑 */
    if (info && info.triggered) { dragStart = null; return; }
    const start = dragStart;
    dragStart = null;
    /* setPointerCapture 后 e.target 为棋盘，改用坐标取松手位置的糖果 */
    const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    const candyEl = elAtPoint && elAtPoint.closest ? elAtPoint.closest(".candy") : null;
    if (!candyEl) return;
    const pos = { r: Number(candyEl.dataset.r), c: Number(candyEl.dataset.c) };
    const cell = grid[start.r][start.c];
    // 单击特殊糖果（未拖动）主动触发
    if (pos.r === start.r && pos.c === start.c && cell && cell.special) {
        selectedKey = null;
        updateSelection();
        activateSpecial(start.r, start.c);
        return;
    }
    if (!isAdjacent(start.r, start.c, pos.r, pos.c)) return;
    // 拖动到相邻格 → 拖动交换
    selectedKey = null;
    updateSelection();
    handleSwap(start.r, start.c, pos.r, pos.c);
}

/* ===== 音效开关按钮 ===== */
const soundBtn = document.getElementById("sound-btn");
soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "🔊" : "🔇";
    /* 关音效时立即停止正在播报的语音 */
    if (!soundOn && window.speechSynthesis) window.speechSynthesis.cancel();
    if (soundOn) playTone("sine", 660, 0.12);
});

/* ===== 道具按钮绑定 ===== */
toolBtns.hammer.addEventListener("click", () => setTool("hammer"));
toolBtns.bomb.addEventListener("click", () => setTool("bomb"));
toolBtns.shuffle.addEventListener("click", () => {
    markAction();
    if (busy || gameOver || tools.shuffle <= 0) return;
    useShuffleTool();
});
toolBtns.swap.addEventListener("click", () => setTool("swap"));

/* ===== 棋盘事件绑定 ===== */
boardEl.addEventListener("pointerdown", onBoardPointerDown);
boardEl.addEventListener("pointermove", onBoardPointerMove);
boardEl.addEventListener("pointerup", onBoardPointerUp);
boardEl.addEventListener("pointercancel", cancelSwipe);

/* ===== 关卡选择首页 ===== */
function buildLevelGrid() {
    levelGridEl.innerHTML = "";
    const total = Math.max(LEVEL_CONFIGS.length, unlockedLevel + 3);
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement("button");
        const locked = i > unlockedLevel;
        btn.className = "level-btn" + (locked ? " locked" : "");
        if (locked) {
            btn.textContent = "🔒";
        } else {
            const s = levelStars[i] || 0;
            btn.innerHTML =
                '<span class="lv-num">' + i + "</span>" +
                '<span class="lv-stars">' + (s > 0 ? "⭐".repeat(s) : "✨") + "</span>";
            btn.addEventListener("click", () => startLevel(i));
        }
        levelGridEl.appendChild(btn);
    }
}

function showLevelSelect() {
    stopHint();
    buildLevelGrid();
    levelSelectEl.classList.remove("hidden");
}

function startLevel(lv) {
    level = lv;
    levelSelectEl.classList.add("hidden");
    startGame(false);
}

/* 返回选关按钮（游戏内） */
if (levelBackBtn) {
    levelBackBtn.addEventListener("click", () => {
        if (busy) return;
        gameOver = true;
        devMode = false;
        hideModal();
        showLevelSelect();
    });
}

/* ===== 弹窗按钮：过关→下一关 / 失败→返回选关 ===== */
modalBtn.addEventListener("click", () => {
    if (modalMode === "win") {
        startGame(true);
    } else {
        hideModal();
        showLevelSelect();
    }
});

/* ===== 开发者模式：场景测试面板 ===== */
const DEV_SCENES = [
    { id: "combo-ss",   icon: "↔️↕️", name: "条纹+条纹", desc: "滑动交换中间两颗触发十字清除" },
    { id: "combo-sb",   icon: "↔️💥", name: "条纹+炸弹", desc: "滑动交换触发三行三列清除" },
    { id: "combo-bb",   icon: "💥💥", name: "炸弹+炸弹", desc: "滑动交换触发 5×5 大爆炸" },
    { id: "combo-rs",   icon: "⭐↔️", name: "彩虹+条纹", desc: "滑动交换，全场同色变条纹并引爆" },
    { id: "combo-rb",   icon: "⭐💥", name: "彩虹+炸弹", desc: "滑动交换，全场同色变炸弹并引爆" },
    { id: "combo-rr",   icon: "⭐⭐", name: "彩虹+彩虹", desc: "滑动交换触发全屏清除" },
    { id: "jelly-full", icon: "🧃",   name: "全场果冻",   desc: "每格1层果冻，消除糖果清果冻" },
    { id: "jelly-2x",   icon: "🧃🧃", name: "双层果冻",   desc: "中心4×4双层，外圈单层" },
    { id: "ingredient", icon: "🥥",   name: "食材下落",   desc: "顶部3个食材，护送到底部" },
    { id: "ice-multi",  icon: "❄️",   name: "多层冰块",   desc: "中心区域2~3层冰" },
    { id: "wall-maze",  icon: "🧱",   name: "隔断迷宫",   desc: "棋盘内网格状隔断块" },
    { id: "dead-board", icon: "💀",   name: "死局洗牌",   desc: "无可行步，测试自动洗牌" },
    { id: "chain",      icon: "🔗",   name: "连锁连击",   desc: "散布特殊糖果，触发连锁" },
    { id: "special-all",icon: "🎁",   name: "特殊展览",   desc: "四种特殊糖果各放一颗" },
];

/* 安全棋盘：(r+c)%色数 排列，保证无三连且无可行步（组合技测试用） */
function genSafeBoard() {
    holeSet = new Set();
    grid = [];
    jellyGrid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        jellyGrid[r] = [];
        for (let c = 0; c < COLS; c++) {
            jellyGrid[r][c] = 0;
            grid[r][c] = makeCell((r + c) % COLOR_COUNT);
        }
    }
}

/* 随机棋盘：正常随机颜色，避免开局三连（障碍/食材测试用） */
function genRandomBoard() {
    holeSet = new Set();
    grid = [];
    jellyGrid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        jellyGrid[r] = [];
        for (let c = 0; c < COLS; c++) {
            jellyGrid[r][c] = 0;
            let color, guard = 0;
            do {
                color = randColor();
                guard++;
            } while (guard < 30 && (
                (c >= 2 && grid[r][c - 1].color === color && grid[r][c - 2].color === color) ||
                (r >= 2 && grid[r - 1][c].color === color && grid[r - 2][c].color === color)
            ));
            grid[r][c] = makeCell(color);
        }
    }
}

/* 组合技场景：安全棋盘 + 中间两颗相邻特殊糖果，交换即触发 */
function applyComboScene(s1, s2) {
    genSafeBoard();
    grid[3][3] = makeCell(0, s1);
    grid[3][4] = makeCell(0, s2);
}

function applyJellyScene(doubleCenter) {
    genRandomBoard();
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            jellyGrid[r][c] = 1;
    if (doubleCenter) {
        for (let r = 2; r < 6; r++)
            for (let c = 2; c < 6; c++)
                jellyGrid[r][c] = 2;
    }
}

function applyIngredientScene() {
    genRandomBoard();
    for (const c of [1, 3, 5]) {
        const cell = grid[0][c];
        cell.ingredient = true;
        cell.color = -1;
        cell.special = null;
    }
}

function applyIceScene() {
    genRandomBoard();
    for (let r = 2; r < 6; r++)
        for (let c = 2; c < 6; c++)
            grid[r][c].frozen = ((r + c) % 2 === 0) ? 3 : 2;
}

function applyWallScene() {
    genRandomBoard();
    for (let r = 1; r < ROWS - 1; r += 2)
        for (let c = 1; c < COLS - 1; c += 2)
            grid[r][c] = makeWallCell();
}

function applyChainScene() {
    genRandomBoard();
    const spots = [[1, 1, "striped-h"], [1, 6, "striped-v"], [6, 1, "bomb"], [6, 6, "bomb"], [3, 3, "striped-h"]];
    for (const [r, c, sp] of spots) {
        grid[r][c] = makeCell(grid[r][c].color, sp);
    }
}

function applySpecialShowcase() {
    genSafeBoard();
    grid[2][2] = makeCell(0, "striped-h");
    grid[2][5] = makeCell(1, "striped-v");
    grid[5][2] = makeCell(2, "bomb");
    grid[5][5] = makeCell(3, "rainbow");
}

function applyDevScene(id) {
    switch (id) {
        case "combo-ss":    applyComboScene("striped-h", "striped-v"); break;
        case "combo-sb":    applyComboScene("striped-h", "bomb"); break;
        case "combo-bb":    applyComboScene("bomb", "bomb"); break;
        case "combo-rs":    applyComboScene("rainbow", "striped-h"); break;
        case "combo-rb":    applyComboScene("rainbow", "bomb"); break;
        case "combo-rr":    applyComboScene("rainbow", "rainbow"); break;
        case "jelly-full":  applyJellyScene(false); break;
        case "jelly-2x":    applyJellyScene(true); break;
        case "ingredient":  applyIngredientScene(); break;
        case "ice-multi":   applyIceScene(); break;
        case "wall-maze":   applyWallScene(); break;
        case "dead-board":  genSafeBoard(); break;
        case "chain":       applyChainScene(); break;
        case "special-all": applySpecialShowcase(); break;
    }
}

async function startDevScene(sceneId) {
    hideDevPanel();
    devMode = true;
    levelSelectEl.classList.add("hidden");
    /* 初始化游戏状态（步数无限，道具充足，无过关目标） */
    goal = null;
    target = 0;
    iceBroken = 0;
    fruitCleared = {};
    jellyCleared = 0;
    jellyGrid = [];
    ingredientsCollected = 0;
    movesLeft = 999;
    tools = { hammer: 9, bomb: 9, shuffle: 9, swap: 9 };
    score = 0;
    gameOver = false;
    busy = false;
    activeTool = null;
    selectedKey = null;
    swapFirst = null;
    document.querySelectorAll(".bonus-orb").forEach((el) => el.remove());
    stopHint();
    lastActionTime = Date.now();
    const scene = DEV_SCENES.find((s) => s.id === sceneId);
    hintEl.textContent = "🛠️ " + scene.name + "：" + scene.desc;
    applyDevScene(sceneId);
    render();
    updateHUD();
    hideModal();
    /* 死局场景：加载后立即检测并自动洗牌 */
    if (sceneId === "dead-board") {
        busy = true;
        await checkBoardState();
        busy = false;
    }
}

function buildDevPanel() {
    devSceneGrid.innerHTML = "";
    for (const s of DEV_SCENES) {
        const btn = document.createElement("button");
        btn.className = "dev-scene-btn";
        btn.innerHTML =
            '<span class="dev-scene-icon">' + s.icon + "</span>" +
            '<span class="dev-scene-name">' + s.name + "</span>" +
            '<span class="dev-scene-desc">' + s.desc + "</span>";
        btn.addEventListener("click", () => startDevScene(s.id));
        devSceneGrid.appendChild(btn);
    }
}

function showDevPanel() {
    buildDevPanel();
    devPanel.classList.remove("hidden");
}

function hideDevPanel() {
    devPanel.classList.add("hidden");
}

if (devBtn) devBtn.addEventListener("click", showDevPanel);
if (devCloseBtn) devCloseBtn.addEventListener("click", hideDevPanel);

/* ===== 启动：先显示关卡选择首页 ===== */
showLevelSelect();
