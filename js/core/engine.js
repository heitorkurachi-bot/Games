'use strict';

const W = 1280, H = 720;
const PLAYER_COLORS = ['#ff5d73', '#4dabff', '#ffd23f', '#5ee38b'];
// Cores que podem ser escolhidas nas configurações
const PALETTE = [...PLAYER_COLORS, '#c084fc', '#fb923c', '#2dd4bf', '#f472b6', '#e5e7eb'];
const FONT = '"Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Arial, sans-serif';

// Cada arquivo em js/games/ adiciona sua definição aqui.
const GAMES = [];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- desenho
const Draw = {
  text(ctx, str, x, y, o = {}) {
    ctx.font = `${o.weight || 700} ${o.size || 24}px ${FONT}`;
    ctx.fillStyle = o.color || '#fff';
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 18; }
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  },
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  panel(ctx, x, y, w, h, fill = 'rgba(16,19,36,0.9)', stroke = null, r = 14, lw = 2) {
    this.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  },
  button(ctx, r, label, selected) {
    this.panel(ctx, r.x, r.y, r.w, r.h, selected ? '#2b3266' : 'rgba(24,28,52,0.95)', selected ? '#8ea2ff' : 'rgba(255,255,255,0.12)', 12, selected ? 3 : 2);
    this.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 24, color: selected ? '#fff' : '#b8bfdc' });
  },
  hudBar(ctx, h = 52) {
    ctx.fillStyle = 'rgba(8,10,22,0.94)';
    ctx.fillRect(0, 0, W, h);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, h - 2, W, 2);
  },
  banner(ctx, title, sub, extra, color = '#fff') {
    ctx.fillStyle = 'rgba(5,6,14,0.78)';
    ctx.fillRect(0, H / 2 - 105, W, 210);
    this.text(ctx, title, W / 2, H / 2 - 40, { size: 60, weight: 900, color, shadow: color, blur: 24 });
    if (sub) this.text(ctx, sub, W / 2, H / 2 + 20, { size: 28, color: '#dfe3f5' });
    if (extra) this.text(ctx, extra, W / 2, H / 2 + 62, { size: 20, weight: 500, color: '#9aa3c7' });
  },
  countdown(ctx, timer) {
    const n = Math.ceil(timer);
    const f = timer - Math.floor(timer);
    this.text(ctx, String(n), W / 2, H / 2, { size: 120 + f * 60, weight: 900, color: '#fff', shadow: '#8ea2ff', blur: 30 });
  },
  playerDot(ctx, x, y, r, p) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.15);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    this.text(ctx, String(p.slot + 1), x, y + 1, { size: r * 1.1, weight: 900, color: '#10131f' });
  },
};

// Desloca o desenho aleatoriamente (tremor de tela)
function applyShake(ctx, amount) {
  if (amount > 0) ctx.translate(rand(-1, 1) * amount * 14, rand(-1, 1) * amount * 14);
}

// Conta 3-2-1 e devolve true no "vai!"
function countdownTick(game, dt) {
  const before = Math.ceil(game.timer);
  game.timer -= dt;
  const after = Math.ceil(game.timer);
  if (game.timer <= 0) { Sfx.play('go'); return true; }
  if (after !== before) Sfx.play('tick');
  return false;
}

// ---------------------------------------------------------------- partículas
class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, n = 14, speed = 180, life = 0.6, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4), max: life, color, size });
    }
  }
  update(dt) {
    const k = Math.pow(0.05, dt);
    for (const p of this.list) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= k; p.vy *= k;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- sons (sintetizados, sem arquivos)
const Sfx = (() => {
  let ac = null;
  let master = 0.8;
  function ensure() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sem áudio */ } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  window.addEventListener('keydown', ensure);
  window.addEventListener('mousedown', ensure);

  function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (!ac || ac.state !== 'running') return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    if (master <= 0) return;
    g.gain.setValueAtTime(vol * master, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.15) {
    if (!ac || ac.state !== 'running' || master <= 0) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf;
    g.gain.value = vol * master;
    src.connect(g).connect(ac.destination);
    src.start();
  }
  const sounds = {
    select: () => tone(660, 0.07, 'square', 0.04),
    confirm: () => { tone(523, 0.08, 'square', 0.05); tone(784, 0.12, 'square', 0.05, 0, 0.07); },
    back: () => tone(330, 0.1, 'square', 0.05, -100),
    shoot: () => tone(900, 0.08, 'square', 0.035, -550),
    hit: () => noise(0.12, 0.12),
    explode: () => { noise(0.45, 0.22); tone(120, 0.4, 'sawtooth', 0.06, -80); },
    pickup: () => { tone(988, 0.06, 'triangle', 0.08); tone(1319, 0.1, 'triangle', 0.08, 0, 0.06); },
    hurt: () => tone(240, 0.25, 'sawtooth', 0.07, -160),
    door: () => tone(200, 0.12, 'triangle', 0.07, 120),
    bump: () => tone(320, 0.05, 'square', 0.05, 80),
    jump: () => tone(380, 0.12, 'square', 0.035, 380),
    swing: () => tone(700, 0.07, 'sawtooth', 0.03, -400),
    beep: () => tone(1200, 0.04, 'square', 0.035),
    tick: () => tone(440, 0.1, 'triangle', 0.08),
    go: () => tone(880, 0.3, 'triangle', 0.1),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0, i * 0.11)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, 0, i * 0.13)),
  };
  return {
    get volume() { return master; },
    set volume(v) { master = clamp(v, 0, 1); },
    play(name) { try { ensure(); if (sounds[name]) sounds[name](); } catch (e) { /* ignora */ } } };
})();

// ---------------------------------------------------------------- menus com mouse
const Menu = {
  // Devolve o item sob o cursor (se o mouse se mexeu) e o item clicado
  pointer(rects) {
    const m = Input.mouse;
    let inside = -1;
    rects.forEach((r, i) => { if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) inside = i; });
    const click = Input.byId('mouse').pressed('a');
    return { hover: Input.mouseMoved ? inside : -1, click: click ? inside : -1 };
  },
};

// ---------------------------------------------------------------- motor
const Engine = {
  players: [],      // { slot, name, color, device, score }
  scene: null,
  time: 0,
  last: 0,
  paused: false,
  pauseSel: 0,
  currentDef: null,
  tournament: null, // { games: [defs], index, points: Map(jogador -> pontos) }
  pauseItems: ['Continuar', 'Reiniciar jogo', 'Sair para o menu'],

  init() {
    this.canvas = document.getElementById('game');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    Input.attach(this.canvas);
    this.setScene(new LobbyScene());
    requestAnimationFrame((t) => this.frame(t));
  },

  setScene(s) {
    this.scene = s;
    this.paused = false;
    if (s.enter) s.enter();
  },

  startGame(def) {
    this.currentDef = def;
    this.setScene(def.create(this.players.slice()));
  },

  // result: { title, subtitle, winners: [jogadores], lines: [{player, text}], color }
  startTournament(defs) {
    this.tournament = { games: defs, index: 0, points: new Map(this.players.map((p) => [p, 0])) };
    this.startGame(defs[0]);
  },

  finishGame(result) {
    for (const p of result.winners || []) p.score++;
    const T = this.tournament;
    if (T) for (const p of result.winners || []) T.points.set(p, T.points.get(p) + 1);
    Sfx.play(result.winners && result.winners.length ? 'win' : 'lose');
    this.setScene(new ResultScene(result));
  },

  // Navegação de menu combinada de vários dispositivos
  nav(devs = this.players.map((p) => p.device)) {
    const r = { up: false, down: false, left: false, right: false, a: false, b: false };
    for (const d of devs) {
      for (const k of ['up', 'down', 'left', 'right']) if (d.navPressed(k)) r[k] = true;
      if (d.kind === 'mouse') { if (d.pressed('b')) r.b = true; continue; }
      if (d.pressed('a')) r.a = true;
      if (d.pressed('b')) r.b = true;
    }
    return r;
  },

  pausePressed() {
    return Input.escPressed() || this.players.some((p) => p.device.pressed('start'));
  },

  frame(t) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    Input.update();
    this.time += dt;

    const s = this.scene;
    if (this.paused) this.updatePause();
    else if (s.pausable && this.pausePressed()) { this.paused = true; this.pauseSel = 0; Sfx.play('select'); }
    else s.update(dt);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0d18';
    ctx.fillRect(0, 0, W, H);
    this.scene.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (this.paused) this.drawPause(ctx);

    requestAnimationFrame((t2) => this.frame(t2));
  },

  pauseRects() {
    return this.pauseItems.map((_, i) => ({ x: W / 2 - 190, y: 290 + i * 72, w: 380, h: 58 }));
  },

  updatePause() {
    const n = this.nav();
    const items = this.pauseItems;
    if (this.pausePressed() || n.b) { this.paused = false; return; }
    if (n.up) { this.pauseSel = (this.pauseSel + items.length - 1) % items.length; Sfx.play('select'); }
    if (n.down) { this.pauseSel = (this.pauseSel + 1) % items.length; Sfx.play('select'); }
    const p = Menu.pointer(this.pauseRects());
    if (p.hover >= 0) this.pauseSel = p.hover;
    if (p.click >= 0) this.pauseSel = p.click;
    if (n.a || p.click >= 0) {
      Sfx.play('confirm');
      if (this.pauseSel === 0) this.paused = false;
      else if (this.pauseSel === 1) this.startGame(this.currentDef);
      else { this.tournament = null; this.setScene(new SelectScene()); }
    }
  },

  drawPause(ctx) {
    ctx.fillStyle = 'rgba(4,5,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    Draw.text(ctx, 'PAUSADO', W / 2, 210, { size: 64, weight: 900, shadow: '#8ea2ff' });
    this.pauseRects().forEach((r, i) => Draw.button(ctx, r, this.pauseItems[i], i === this.pauseSel));
    Draw.text(ctx, 'Esc / Start / extra: voltar ao jogo', W / 2, 560, { size: 18, weight: 500, color: '#8b93b8' });
  },
};
