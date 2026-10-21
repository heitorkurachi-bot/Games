'use strict';

// Camada de entrada unificada: cada "dispositivo" (esquema de teclado, mouse
// ou controle) expõe a mesma interface, então os jogos não precisam saber de
// onde veio o comando.
//   device.dir(px, py)    -> {x, y} entre -1 e 1 (o mouse aponta a partir de px,py)
//   device.held('a')      -> botão segurado ('a' = ação, 'b' = extra, 'start')
//   device.pressed('a')   -> botão apertado neste quadro
//   device.navPressed(d)  -> direção ('up','down','left','right') apertada neste quadro
const Input = (() => {
  const keys = new Set();
  const mouse = { x: 640, y: 360, left: false, right: false, moved: false };
  let canvas = null;
  let frameMoved = false;
  let escNow = false, escPrev = false;

  // Quando definido, captura o próximo keydown (usado para digitar nomes e remapear teclas)
  let capture = null;

  window.addEventListener('keydown', (e) => {
    if (capture) { e.preventDefault(); capture(e); return; }
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.left = mouse.right = false; });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function attach(c) {
    canvas = c;
    c.addEventListener('mousemove', (e) => { const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; mouse.moved = true; });
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0) mouse.left = true;
      if (e.button === 2) mouse.right = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) mouse.left = false;
      if (e.button === 2) mouse.right = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  const EMPTY = { x: 0, y: 0, a: false, b: false, start: false };

  function nav(s, d) {
    if (d === 'up') return s.y < -0.5;
    if (d === 'down') return s.y > 0.5;
    if (d === 'left') return s.x < -0.5;
    return s.x > 0.5;
  }

  class Device {
    constructor(id, kind, name, hint) {
      Object.assign(this, { id, kind, name });
      if (hint) this.hint = hint;
      this.cur = { ...EMPTY };
      this.prev = { ...EMPTY };
    }
    get available() { return true; }
    update() { this.prev = this.cur; this.cur = this.read(); }
    held(btn) { return !!this.cur[btn]; }
    pressed(btn) { return !!this.cur[btn] && !this.prev[btn]; }
    navPressed(d) { return nav(this.cur, d) && !nav(this.prev, d); }
    dir() { return { x: this.cur.x, y: this.cur.y }; }
  }

  class KeyboardDevice extends Device {
    constructor(id, name, map) {
      super(id, 'keyboard', name, null);
      this.map = { ...map };
      this.defaults = { ...map };
    }
    get hint() {
      const m = this.map, k = keyLabel;
      return `${k(m.up)} ${k(m.left)} ${k(m.down)} ${k(m.right)} mover · ${k(m.a)} ação · ${k(m.b)} extra`;
    }
    read() {
      const m = this.map, k = (c) => keys.has(c);
      let x = (k(m.right) ? 1 : 0) - (k(m.left) ? 1 : 0);
      let y = (k(m.down) ? 1 : 0) - (k(m.up) ? 1 : 0);
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y, a: k(m.a), b: k(m.b), start: k(m.start) };
    }
  }

  class MouseDevice extends Device {
    constructor() {
      super('mouse', 'mouse', 'Mouse', 'Aponte para mover · Botão esq. ação · Botão dir. extra');
    }
    read() { return { x: 0, y: 0, a: mouse.left, b: mouse.right, start: false }; }
    // O jogador do mouse se move em direção ao cursor
    dir(px, py) {
      if (px === undefined) return { x: 0, y: 0 };
      const dx = mouse.x - px, dy = mouse.y - py, d = Math.hypot(dx, dy);
      if (d < 8) return { x: 0, y: 0 };
      const s = Math.min(1, d / 48) / d;
      return { x: dx * s, y: dy * s };
    }
  }

  class GamepadDevice extends Device {
    constructor(i) {
      super('gp' + i, 'gamepad', 'Controle ' + (i + 1), 'Analógico/D-pad · A ação · B extra · Start pausa');
      this.index = i;
    }
    get pad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      return pads[this.index] || null;
    }
    get available() { const p = this.pad; return !!(p && p.connected); }
    read() {
      const p = this.pad;
      if (!p || !p.connected) return { ...EMPTY };
      const btn = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      let x = p.axes[0] || 0, y = p.axes[1] || 0;
      const mag = Math.hypot(x, y);
      if (mag < 0.25) { x = 0; y = 0; } else if (mag > 1) { x /= mag; y /= mag; }
      if (btn(14)) x = -1;
      if (btn(15)) x = 1;
      if (btn(12)) y = -1;
      if (btn(13)) y = 1;
      return { x, y, a: btn(0), b: btn(1) || btn(2), start: btn(9) };
    }
  }

  const devices = [
    new KeyboardDevice('kb1', 'Teclado (WASD)',
      { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyF', b: 'KeyG', start: 'Escape' }),
    new KeyboardDevice('kb2', 'Teclado (Setas)',
      { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight', start: 'Backspace' }),
    new KeyboardDevice('kb3', 'Teclado (IJKL)',
      { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', a: 'KeyU', b: 'KeyO', start: 'KeyP' }),
    new MouseDevice(),
    new GamepadDevice(0), new GamepadDevice(1), new GamepadDevice(2), new GamepadDevice(3),
  ];

  // Nome legível de uma tecla a partir do KeyboardEvent.code
  function keyLabel(code) {
    if (!code) return '—';
    const named = {
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Espaço', Enter: 'Enter',
      ShiftLeft: 'Shift esq.', ShiftRight: 'Shift dir.', ControlLeft: 'Ctrl esq.', ControlRight: 'Ctrl dir.',
      AltLeft: 'Alt', AltRight: 'AltGr', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Esc',
      Comma: ',', Period: '.', Slash: '/', Semicolon: 'Ç', Quote: '~', BracketLeft: '´', BracketRight: '[', Backslash: ']', Minus: '-', Equal: '=',
    };
    if (named[code]) return named[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
    return code;
  }

  function update() {
    for (const d of devices) d.update();
    escPrev = escNow;
    escNow = keys.has('Escape');
    frameMoved = mouse.moved;
    mouse.moved = false;
  }

  return {
    attach,
    update,
    keyLabel,
    setCapture(fn) { capture = fn; },
    devices,
    mouse,
    get mouseMoved() { return frameMoved; },
    escPressed: () => escNow && !escPrev,
    byId: (id) => devices.find((d) => d.id === id),
    gamepadCount: () => devices.filter((d) => d.kind === 'gamepad' && d.available).length,
  };
})();
