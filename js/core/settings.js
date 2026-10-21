'use strict';

// Preferências salvas no navegador: nome e cor de cada vaga, teclas dos
// esquemas de teclado e volume. Se o navegador bloquear o armazenamento,
// tudo funciona normalmente, só não fica salvo.
const Settings = {
  KEY: 'arcade-em-grupo:settings',
  ACTIONS: [
    ['up', 'Cima'], ['down', 'Baixo'], ['left', 'Esquerda'], ['right', 'Direita'], ['a', 'Ação'], ['b', 'Extra'],
  ],
  NAMES: ['Raio', 'Trovão', 'Foguete', 'Pantera', 'Tubarão', 'Cometa', 'Ninja', 'Pirata', 'Robô', 'Dragão', 'Coruja', 'Furacão'],
  profiles: [0, 1, 2, 3].map((s) => ({ name: 'Jogador ' + (s + 1), color: PLAYER_COLORS[s] })),

  keyboards() { return ['kb1', 'kb2', 'kb3'].map((id) => Input.byId(id)); },

  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { /* sem armazenamento */ }
    if (!data) return;
    if (Array.isArray(data.profiles)) {
      data.profiles.forEach((p, i) => {
        if (!this.profiles[i] || !p) return;
        if (typeof p.name === 'string' && p.name.trim()) this.profiles[i].name = p.name.slice(0, 12);
        if (PALETTE.includes(p.color)) this.profiles[i].color = p.color;
      });
    }
    if (data.keys) for (const d of this.keyboards()) if (data.keys[d.id]) Object.assign(d.map, data.keys[d.id]);
    if (typeof data.volume === 'number') Sfx.volume = data.volume;
  },

  save() {
    const keys = {};
    for (const d of this.keyboards()) keys[d.id] = { ...d.map };
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ profiles: this.profiles, keys, volume: Sfx.volume }));
    } catch (e) { /* sem armazenamento */ }
  },

  // Aplica nome/cor da vaga ao jogador que estiver nela
  syncPlayers() {
    for (const p of Engine.players) {
      p.name = this.profiles[p.slot].name;
      p.color = this.profiles[p.slot].color;
    }
  },

  // Atribui uma tecla; se ela já estava em uso em algum esquema, troca as duas de lugar
  bind(dev, action, code) {
    const old = dev.map[action];
    for (const d of this.keyboards()) {
      for (const [k] of this.ACTIONS) if (d.map[k] === code && !(d === dev && k === action)) d.map[k] = old;
    }
    dev.map[action] = code;
  },
};

// ================================================================ Tela de configurações
class SettingsScene {
  enter() {
    this.t = 0;
    this.tab = 0;
    this.row = 0;
    this.scheme = 0;
    this.editing = null; // { kind: 'name' | 'key', ... }
  }

  rows() {
    if (this.tab === 0) {
      const r = [];
      for (let s = 0; s < 4; s++) { r.push({ kind: 'name', slot: s }); r.push({ kind: 'color', slot: s }); }
      return r;
    }
    if (this.tab === 1) {
      return [{ kind: 'scheme' }, ...Settings.ACTIONS.map(([action, label]) => ({ kind: 'key', action, label })), { kind: 'reset' }];
    }
    return [{ kind: 'volume' }, { kind: 'test' }];
  }

  // row 0 = abas; as linhas de conteúdo começam em 1
  rowRects() {
    const h = 50;
    return this.rows().map((_, i) => ({ x: W / 2 - 400, y: 170 + i * (h + 4), w: 800, h }));
  }
  tabRects() { return [0, 1, 2].map((i) => ({ x: W / 2 - 390 + i * 265, y: 96, w: 250, h: 50 })); }

  leave() {
    Settings.save();
    Settings.syncPlayers();
    Sfx.play('back');
    Engine.setScene(new LobbyScene());
  }

  startNameEdit(slot) {
    this.editing = { kind: 'name', slot, text: Settings.profiles[slot].name };
    Input.setCapture((e) => {
      const ed = this.editing;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        Settings.profiles[slot].name = ed.text.trim() || 'Jogador ' + (slot + 1);
        this.stopEdit(true);
      } else if (e.code === 'Escape') {
        this.stopEdit(false);
      } else if (e.code === 'Backspace') {
        ed.text = ed.text.slice(0, -1);
      } else if (e.key.length === 1 && ed.text.length < 12) {
        ed.text += e.key;
      }
    });
  }

  startKeyEdit(action) {
    const dev = Settings.keyboards()[this.scheme];
    this.editing = { kind: 'key', action };
    Input.setCapture((e) => {
      if (e.code === 'Escape') { this.stopEdit(false); return; }
      Settings.bind(dev, action, e.code);
      this.stopEdit(true);
    });
  }

  stopEdit(ok) {
    Input.setCapture(null);
    this.editing = null;
    Settings.save();
    Settings.syncPlayers();
    Sfx.play(ok ? 'confirm' : 'back');
  }

  cycleColor(slot, step) {
    const used = Settings.profiles.filter((_, i) => i !== slot).map((p) => p.color);
    let i = PALETTE.indexOf(Settings.profiles[slot].color);
    do { i = (i + step + PALETTE.length) % PALETTE.length; } while (used.includes(PALETTE[i]));
    Settings.profiles[slot].color = PALETTE[i];
  }

  cycleName(slot, step) {
    const list = ['Jogador ' + (slot + 1), ...Settings.NAMES];
    const i = list.indexOf(Settings.profiles[slot].name);
    Settings.profiles[slot].name = list[(i + step + list.length) % list.length] || list[0];
  }

  // AÇÃO (ou clique) na linha atual
  activate(r) {
    if (r.kind === 'name') this.startNameEdit(r.slot);
    else if (r.kind === 'key') { this.startKeyEdit(r.action); Sfx.play('select'); }
    else if (r.kind === 'reset') {
      const d = Settings.keyboards()[this.scheme];
      Object.assign(d.map, d.defaults);
      Sfx.play('confirm');
    } else if (r.kind === 'test') Sfx.play('win');
    else this.change(r, 1);
  }

  change(r, step) {
    if (r.kind === 'color') this.cycleColor(r.slot, step);
    else if (r.kind === 'name') this.cycleName(r.slot, step);
    else if (r.kind === 'scheme') this.scheme = (this.scheme + step + 3) % 3;
    else if (r.kind === 'volume') { Sfx.volume = Math.round((Sfx.volume + step * 0.1) * 10) / 10; Sfx.play('pickup'); return; }
    else return;
    Sfx.play('select');
  }

  update(dt) {
    this.t += dt;
    if (this.editing) return; // as teclas vão para a captura
    const n = Engine.nav(Input.devices.filter((d) => d.available));
    if (n.b || Input.escPressed()) { this.leave(); return; }

    const rows = this.rows();
    const prev = this.row;
    if (n.up) this.row = Math.max(0, this.row - 1);
    if (n.down) this.row = Math.min(rows.length, this.row + 1);

    const tp = Menu.pointer(this.tabRects());
    const rp = Menu.pointer(this.rowRects());
    if (rp.hover >= 0) this.row = rp.hover + 1;
    if (tp.click >= 0) { this.tab = tp.click; this.row = 0; Sfx.play('select'); return; }

    if (this.row === 0) {
      if (n.left || n.right) { this.tab = (this.tab + (n.right ? 1 : 2)) % 3; Sfx.play('select'); }
    } else {
      const r = rows[this.row - 1];
      if (n.left) this.change(r, -1);
      if (n.right) this.change(r, 1);
      if (n.a) this.activate(r);
      if (rp.click >= 0) { this.row = rp.click + 1; this.activate(rows[rp.click]); }
    }
    if (this.row !== prev) Sfx.play('select');
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    Draw.text(ctx, 'CONFIGURAÇÕES', W / 2, 52, { size: 42, weight: 900, shadow: '#7c8cff' });
    ['Jogadores', 'Controles', 'Som'].forEach((label, i) => {
      const r = this.tabRects()[i], on = this.tab === i;
      Draw.panel(ctx, r.x, r.y, r.w, r.h, on ? '#2b3266' : 'rgba(24,28,52,0.9)', this.row === 0 && on ? '#8ea2ff' : 'rgba(255,255,255,0.1)', 12, this.row === 0 && on ? 3 : 2);
      Draw.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 22, color: on ? '#fff' : '#9aa3c7' });
    });

    const rows = this.rows(), rects = this.rowRects();
    rows.forEach((row, i) => {
      const r = rects[i], sel = this.row === i + 1;
      Draw.panel(ctx, r.x, r.y, r.w, r.h, sel ? 'rgba(43,50,102,0.95)' : 'rgba(18,21,40,0.9)', sel ? '#8ea2ff' : 'rgba(255,255,255,0.06)', 10, sel ? 3 : 1);
      const cy = r.y + r.h / 2 + 1, lx = r.x + 24, vx = r.x + 330;
      const label = (s) => Draw.text(ctx, s, lx, cy, { size: 20, weight: 700, align: 'left', color: '#dfe3f5' });
      const value = (s, color = '#fff') => Draw.text(ctx, s, vx, cy, { size: 20, weight: 600, align: 'left', color });
      const arrows = () => { if (sel) Draw.text(ctx, '◀  ▶', r.x + r.w - 24, cy, { size: 16, align: 'right', color: '#8ea2ff' }); };

      if (row.kind === 'name') {
        const prof = Settings.profiles[row.slot];
        Draw.playerDot(ctx, lx + 12, cy, 12, { slot: row.slot, color: prof.color });
        Draw.text(ctx, `Nome do jogador ${row.slot + 1}`, lx + 36, cy, { size: 20, align: 'left', color: '#dfe3f5' });
        if (this.editing && this.editing.kind === 'name' && this.editing.slot === row.slot) {
          const caret = Math.floor(this.t * 2) % 2 ? '|' : ' ';
          value(this.editing.text + caret, '#ffd23f');
          Draw.text(ctx, 'Enter: salvar · Esc: cancelar', r.x + r.w - 24, cy, { size: 15, align: 'right', color: '#ffd23f' });
        } else {
          value(prof.name);
          if (sel) Draw.text(ctx, 'AÇÃO: digitar · ◀ ▶ sugestões', r.x + r.w - 24, cy, { size: 15, align: 'right', color: '#8ea2ff' });
        }
      } else if (row.kind === 'color') {
        label(`   Cor do jogador ${row.slot + 1}`);
        PALETTE.forEach((c, k) => {
          const x = vx + 12 + k * 34, mine = Settings.profiles[row.slot].color === c;
          const taken = Settings.profiles.some((p, j) => j !== row.slot && p.color === c);
          ctx.globalAlpha = taken ? 0.2 : 1;
          ctx.beginPath();
          ctx.arc(x, cy, mine ? 13 : 10, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
          if (mine) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
          ctx.globalAlpha = 1;
        });
        arrows();
      } else if (row.kind === 'scheme') {
        label('Esquema de teclado');
        value(Settings.keyboards()[this.scheme].name, '#ffd23f');
        arrows();
      } else if (row.kind === 'key') {
        label(row.label);
        const dev = Settings.keyboards()[this.scheme];
        if (this.editing && this.editing.kind === 'key' && this.editing.action === row.action) value('Aperte uma tecla...  (Esc cancela)', '#ffd23f');
        else value(Input.keyLabel(dev.map[row.action]));
        if (sel && !this.editing) Draw.text(ctx, 'AÇÃO: trocar', r.x + r.w - 24, cy, { size: 15, align: 'right', color: '#8ea2ff' });
      } else if (row.kind === 'reset') {
        label('Restaurar teclas padrão deste esquema');
      } else if (row.kind === 'volume') {
        label('Volume');
        const v = Sfx.volume;
        Draw.panel(ctx, vx, cy - 9, 300, 18, '#1c2040', null, 9);
        if (v > 0) Draw.panel(ctx, vx, cy - 9, Math.max(18, 300 * v), 18, '#7c8cff', null, 9);
        Draw.text(ctx, v > 0 ? `${Math.round(v * 100)}%` : 'Mudo', vx + 320, cy, { size: 20, align: 'left' });
        arrows();
      } else if (row.kind === 'test') {
        label('Testar som');
      }
    });

    if (this.tab === 1) Draw.text(ctx, 'Controles e mouse não precisam de configuração. Se uma tecla já estiver em uso, as duas trocam de lugar.', W / 2, 640, { size: 16, weight: 500, color: '#8b93b8' });
    Draw.text(ctx, '◀ ▶ nas abas: trocar de aba   ·   AÇÃO: editar   ·   EXTRA ou Esc: salvar e voltar', W / 2, 690, { size: 17, weight: 500, color: '#8b93b8' });
  }
}
