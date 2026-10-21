'use strict';

// ================================================================ Lobby: entrada dos jogadores
class LobbyScene {
  enter() { this.t = 0; }

  gearRect() { return { x: W - 250, y: 18, w: 230, h: 46 }; }

  update(dt) {
    this.t += dt;
    const gear = Menu.pointer([this.gearRect()]);
    if (Input.mouseMoved) this.gearHover = gear.hover >= 0;
    if (gear.click >= 0 || Input.devices.some((d) => d.available && d.pressed('start'))) {
      Sfx.play('confirm');
      Engine.setScene(new SettingsScene());
      return;
    }
    const P = Engine.players;
    for (const d of Input.devices) {
      if (!d.available) continue;
      const pl = P.find((p) => p.device === d);
      if (d.pressed('a')) {
        if (!pl) {
          if (P.length < 4) this.join(d);
        } else if (pl === P[0] && Engine.time - pl.joinedAt > 0.35) {
          Sfx.play('confirm');
          Engine.setScene(new SelectScene());
          return;
        }
      } else if (d.pressed('b') && pl) {
        P.splice(P.indexOf(pl), 1);
        Sfx.play('back');
      }
    }
  }

  join(d) {
    const used = Engine.players.map((p) => p.slot);
    let slot = 0;
    while (used.includes(slot)) slot++;
    const prof = Settings.profiles[slot];
    Engine.players.push({ slot, name: prof.name, color: prof.color, device: d, score: 0, joinedAt: Engine.time });
    Engine.players.sort((a, b) => a.slot - b.slot);
    Sfx.play('confirm');
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    const g = this.gearRect();
    Draw.panel(ctx, g.x, g.y, g.w, g.h, this.gearHover ? '#2b3266' : 'rgba(24,28,52,0.9)', this.gearHover ? '#8ea2ff' : 'rgba(255,255,255,0.14)', 12, 2);
    Draw.text(ctx, 'Configurações', g.x + 16, g.y + 17, { size: 18, align: 'left' });
    Draw.text(ctx, 'Esc · Start · clique', g.x + 16, g.y + 35, { size: 13, weight: 500, align: 'left', color: '#8b93b8' });
    Draw.text(ctx, 'ARCADE EM GRUPO', W / 2, 92, { size: 76, weight: 900, color: '#fff', shadow: '#7c8cff', blur: 30 });
    Draw.text(ctx, '2 a 4 jogadores  ·  controle, teclado ou mouse  ·  coop e versus', W / 2, 150, { size: 22, weight: 500, color: '#a9b1d6' });

    // Vagas
    const cw = 260, ch = 220, gap = 30, x0 = (W - (4 * cw + 3 * gap)) / 2, y0 = 190;
    for (let s = 0; s < 4; s++) {
      const x = x0 + s * (cw + gap);
      const p = Engine.players.find((pl) => pl.slot === s);
      if (p) {
        Draw.panel(ctx, x, y0, cw, ch, 'rgba(22,26,48,0.95)', p.color, 18, 3);
        Draw.playerDot(ctx, x + cw / 2, y0 + 72, 38, p);
        Draw.text(ctx, p.name, x + cw / 2, y0 + 136, { size: 26, color: p.color });
        Draw.text(ctx, p.device.name, x + cw / 2, y0 + 170, { size: 18, weight: 500, color: '#c3c9e6' });
        if (p === Engine.players[0]) {
          Draw.panel(ctx, x + cw / 2 - 62, y0 - 14, 124, 28, p.color, null, 14);
          Draw.text(ctx, 'ANFITRIÃO', x + cw / 2, y0 + 1, { size: 15, weight: 900, color: '#10131f' });
        }
      } else {
        Draw.panel(ctx, x, y0, cw, ch, 'rgba(14,16,30,0.7)', 'rgba(255,255,255,0.12)', 18, 2);
        const a = 0.45 + 0.35 * Math.sin(this.t * 4 + s);
        ctx.globalAlpha = a;
        Draw.text(ctx, 'Aperte AÇÃO', x + cw / 2, y0 + ch / 2 - 16, { size: 24, color: '#dfe3f5' });
        Draw.text(ctx, 'para entrar', x + cw / 2, y0 + ch / 2 + 16, { size: 20, weight: 500, color: '#aab2d6' });
        ctx.globalAlpha = 1;
      }
    }

    // Controles
    Draw.panel(ctx, 75, 440, W - 150, 200, 'rgba(14,16,30,0.8)', 'rgba(255,255,255,0.08)', 16);
    Draw.text(ctx, 'CONTROLES', 105, 470, { size: 18, weight: 900, color: '#7c8cff', align: 'left' });
    const list = ['kb1', 'kb2', 'kb3', 'mouse'].map((id) => Input.byId(id));
    list.forEach((d, i) => {
      const cx = 105 + (i % 2) * 545, cy = 510 + Math.floor(i / 2) * 42;
      Draw.text(ctx, d.name, cx, cy, { size: 20, align: 'left', color: '#fff' });
      Draw.text(ctx, d.hint, cx + 170, cy, { size: 17, weight: 500, align: 'left', color: '#a9b1d6' });
    });
    const gp = Input.byId('gp0');
    const n = Input.gamepadCount();
    Draw.text(ctx, 'Controle', 105, 594, { size: 20, align: 'left', color: '#fff' });
    Draw.text(ctx, gp.hint, 275, 594, { size: 17, weight: 500, align: 'left', color: '#a9b1d6' });
    Draw.text(ctx, n ? `${n} controle(s) detectado(s)` : 'Nenhum controle detectado. Conecte e aperte um botão.', W - 105, 594,
      { size: 16, weight: 600, align: 'right', color: n ? '#5ee38b' : '#8b93b8' });

    const P = Engine.players;
    const msg = P.length
      ? `${P[0].name}: aperte AÇÃO de novo para escolher o jogo   ·   EXTRA para sair da vaga`
      : 'Cada jogador aperta AÇÃO no seu próprio dispositivo';
    Draw.text(ctx, msg, W / 2, 680, { size: 20, weight: 600, color: P.length ? '#ffd23f' : '#a9b1d6' });
  }
}

// ================================================================ Seleção de jogo
const TAG_COLORS = { COOP: '#5ee38b', VERSUS: '#ff5d73', TIMES: '#4dabff', FESTA: '#ffd23f', AVENTURA: '#c084fc' };
const NON_COMPETITIVE = ['COOP', 'AVENTURA'];
const TOURNAMENT_SIZE = 4;

class SelectScene {
  enter() {
    this.t = 0;
    this.sel = clamp(SelectScene.last || 0, 0, GAMES.length);
  }

  // Cards dos jogos + botão do campeonato (último índice)
  rects() {
    const C = SelectScene.COLS, w = 396, h = 150, gx = 14, gy = 12, x0 = (W - (C * w + (C - 1) * gx)) / 2, y0 = 92;
    const r = GAMES.map((_, i) => ({ x: x0 + (i % C) * (w + gx), y: y0 + Math.floor(i / C) * (h + gy), w, h }));
    r.push({ x: W / 2 - 330, y: y0 + Math.ceil(GAMES.length / C) * (h + gy) + 2, w: 660, h: 50 });
    return r;
  }

  // O campeonato usa só jogos competitivos que comportam o grupo atual
  champGames() {
    const n = Engine.players.length;
    return GAMES.filter((g) => !NON_COMPETITIVE.includes(g.tag) && n >= g.min && n <= g.max);
  }

  enabled(i) {
    if (i === GAMES.length) return Engine.players.length >= 2 && this.champGames().length >= 2;
    const n = Engine.players.length;
    return n >= GAMES[i].min && n <= GAMES[i].max;
  }

  update(dt) {
    this.t += dt;
    const n = Engine.nav();
    const prev = this.sel, N = GAMES.length;
    if (this.sel === N) {
      if (n.up) this.sel = N - 1;
    } else {
      if (n.left) this.sel = Math.max(0, this.sel - 1);
      if (n.right) this.sel = Math.min(N - 1, this.sel + 1);
      const C = SelectScene.COLS;
      if (n.up && this.sel >= C) this.sel -= C;
      if (n.down) this.sel = this.sel + C < N ? this.sel + C : N;
    }
    const p = Menu.pointer(this.rects());
    if (p.hover >= 0) this.sel = p.hover;
    if (p.click >= 0) this.sel = p.click;
    if (this.sel !== prev) Sfx.play('select');
    SelectScene.last = this.sel;

    if (n.b) { Sfx.play('back'); Engine.setScene(new LobbyScene()); return; }
    if (n.a || p.click >= 0) {
      if (!this.enabled(this.sel)) { Sfx.play('back'); return; }
      Sfx.play('confirm');
      if (this.sel === N) {
        const pool = this.champGames().sort(() => Math.random() - 0.5);
        Engine.startTournament(pool.slice(0, TOURNAMENT_SIZE));
      } else {
        Engine.startGame(GAMES[this.sel]);
      }
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    Draw.text(ctx, 'ESCOLHA O JOGO', W / 2, 52, { size: 42, weight: 900, shadow: '#7c8cff' });
    const rects = this.rects();

    GAMES.forEach((def, i) => {
      const r = rects[i], sel = i === this.sel, ok = this.enabled(i);
      Draw.panel(ctx, r.x, r.y, r.w, r.h, sel ? 'rgba(34,40,78,0.97)' : 'rgba(18,21,40,0.92)', sel ? '#8ea2ff' : 'rgba(255,255,255,0.08)', 16, sel ? 3 : 2);
      Draw.panel(ctx, r.x + 12, r.y + 12, 100, r.h - 24, 'rgba(8,10,22,0.8)', null, 12);
      ctx.save();
      ctx.translate(r.x + 62, r.y + r.h / 2);
      ctx.scale(0.68, 0.68);
      def.icon(ctx, 0, 0, this.t);
      ctx.restore();
      const tx = r.x + 126, maxW = r.w - 138;
      Draw.text(ctx, def.name, tx, r.y + 30, { size: 24, weight: 800, align: 'left' });
      const tagW = def.tag.length > 6 ? 98 : 78;
      Draw.panel(ctx, tx, r.y + 46, tagW, 22, TAG_COLORS[def.tag], null, 11);
      Draw.text(ctx, def.tag, tx + tagW / 2, r.y + 58, { size: 13, weight: 900, color: '#10131f' });
      const count = def.min === def.max ? `${def.min} jogadores` : `${def.min}–${def.max} jogadores`;
      Draw.text(ctx, count, tx + tagW + 10, r.y + 58, { size: 15, weight: 600, align: 'left', color: '#c3c9e6' });
      wrapText(ctx, def.desc.join(' '), maxW, 15).slice(0, 3)
        .forEach((line, k) => Draw.text(ctx, line, tx, r.y + 88 + k * 20, { size: 15, weight: 500, align: 'left', color: '#a9b1d6' }));
      if (!ok) {
        Draw.panel(ctx, r.x, r.y, r.w, r.h, 'rgba(5,6,14,0.74)', null, 16);
        const msg = Engine.players.length > def.max ? `Máximo de ${def.max} jogadores` : `Precisa de pelo menos ${def.min} jogadores`;
        Draw.text(ctx, msg, r.x + r.w / 2, r.y + r.h / 2, { size: 21, color: '#ffd23f' });
      }
    });

    const cr = rects[GAMES.length], csel = this.sel === GAMES.length;
    if (this.enabled(GAMES.length)) {
      Draw.panel(ctx, cr.x, cr.y, cr.w, cr.h, csel ? '#3a2f0c' : 'rgba(30,26,12,0.95)', csel ? '#ffd23f' : 'rgba(255,210,63,0.35)', 14, csel ? 3 : 2);
      const n = Math.min(TOURNAMENT_SIZE, this.champGames().length);
      Draw.text(ctx, `MODO CAMPEONATO  ·  ${n} jogos sorteados, pódio no final`, W / 2, cr.y + cr.h / 2 + 1, { size: 21, weight: 800, color: '#ffd23f' });
    } else {
      Draw.panel(ctx, cr.x, cr.y, cr.w, cr.h, 'rgba(18,21,40,0.7)', 'rgba(255,255,255,0.06)', 14);
      Draw.text(ctx, 'Modo Campeonato: precisa de 2 ou mais jogadores', W / 2, cr.y + cr.h / 2 + 1, { size: 19, weight: 600, color: '#6b7394' });
    }

    drawScoreboard(ctx, 664);
    const hint = this.sel < GAMES.length ? `${GAMES[this.sel].controls}   ·   ` : '';
    Draw.text(ctx, `${hint}AÇÃO: jogar   ·   EXTRA: voltar   ·   Esc/Start: pausa`, W / 2, 704, { size: 16, weight: 500, color: '#8b93b8' });
  }
}

SelectScene.COLS = 3;

// Quebra um texto em linhas que caibam na largura dada
function wrapText(ctx, text, maxW, size, weight = 500) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ================================================================ Resultado
class ResultScene {
  constructor(result) { this.r = result; }

  enter() {
    this.t = 0;
    this.sel = 0;
    const T = Engine.tournament;
    if (T) {
      const next = T.games[T.index + 1];
      this.labels = [next ? `Próximo: ${next.name}` : 'Ver o pódio', 'Encerrar campeonato'];
    } else {
      this.labels = ['Jogar de novo', 'Escolher outro jogo'];
    }
  }

  rects() {
    return [{ x: W / 2 - 340, y: 560, w: 320, h: 58 }, { x: W / 2 + 20, y: 560, w: 320, h: 58 }];
  }

  update(dt) {
    this.t += dt;
    if (this.t < 0.8) return; // evita pular a tela sem querer
    const n = Engine.nav();
    if (n.left || n.right) { this.sel = 1 - this.sel; Sfx.play('select'); }
    const p = Menu.pointer(this.rects());
    if (p.hover >= 0) this.sel = p.hover;
    if (p.click >= 0) this.sel = p.click;
    const T = Engine.tournament;
    if (n.b && !T) { Sfx.play('back'); Engine.setScene(new SelectScene()); return; }
    if (!(n.a || p.click >= 0)) return;
    Sfx.play('confirm');
    if (T) {
      if (this.sel === 1) { Engine.tournament = null; Engine.setScene(new SelectScene()); return; }
      T.index++;
      if (T.index < T.games.length) Engine.startGame(T.games[T.index]);
      else Engine.setScene(new PodiumScene(T));
    } else if (this.sel === 0) {
      Engine.startGame(Engine.currentDef);
    } else {
      Engine.setScene(new SelectScene());
    }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    const r = this.r, color = r.color || '#ffd23f', T = Engine.tournament;
    if (T) Draw.text(ctx, `CAMPEONATO  ·  JOGO ${T.index + 1} DE ${T.games.length}`, W / 2, 40, { size: 18, weight: 900, color: '#ffd23f' });
    Draw.text(ctx, r.title, W / 2, 110, { size: 58, weight: 900, color, shadow: color, blur: 26 });
    if (r.subtitle) Draw.text(ctx, r.subtitle, W / 2, 170, { size: 24, weight: 500, color: '#c3c9e6' });

    const winners = r.winners || [];
    winners.forEach((p, i) => {
      const x = W / 2 + (i - (winners.length - 1) / 2) * 110;
      const bob = Math.sin(this.t * 5 + i) * 6;
      drawCrown(ctx, x, 222 + bob);
      Draw.playerDot(ctx, x, 270 + bob, 34, p);
    });

    (r.lines || []).forEach((l, i) => {
      const y = 350 + i * 38;
      if (l.player) {
        Draw.playerDot(ctx, W / 2 - 200, y, 13, l.player);
        Draw.text(ctx, l.text, W / 2 - 176, y, { size: 22, weight: 600, align: 'left', color: '#dfe3f5' });
      } else {
        Draw.text(ctx, l.text, W / 2, y, { size: 22, weight: 600, color: '#dfe3f5' });
      }
    });

    this.rects().forEach((rc, i) => Draw.button(ctx, rc, this.labels[i], i === this.sel));
    if (T) drawScoreboard(ctx, 664, 'CAMPEONATO', (p) => T.points.get(p));
    else drawScoreboard(ctx, 664);
  }
}

// ================================================================ Pódio do campeonato
class PodiumScene {
  constructor(T) {
    this.T = T;
    this.ranked = Engine.players.slice().sort((a, b) => T.points.get(b) - T.points.get(a));
    const top = T.points.get(this.ranked[0]);
    this.champs = this.ranked.filter((p) => T.points.get(p) === top);
  }

  enter() {
    this.t = 0;
    this.fx = new Particles();
    Engine.tournament = null;
    Sfx.play('win');
  }

  rects() { return [{ x: W / 2 - 170, y: 620, w: 340, h: 56 }]; }

  update(dt) {
    this.t += dt;
    this.fx.update(dt);
    if (Math.random() < dt * 8) this.fx.burst(rand(100, W - 100), rand(80, 300), PLAYER_COLORS[Math.floor(Math.random() * 4)], 12, 200, 1.2, 5);
    if (this.t < 1.2) return;
    const n = Engine.nav();
    const p = Menu.pointer(this.rects());
    if (n.a || n.b || p.click >= 0) { Sfx.play('confirm'); Engine.setScene(new SelectScene()); }
  }

  draw(ctx) {
    drawBackdrop(ctx, this.t);
    this.fx.draw(ctx);
    const T = this.T;
    const title = this.champs.length === 1 ? `${this.champs[0].name} é o campeão!` : 'Empate no topo!';
    const color = this.champs.length === 1 ? this.champs[0].color : '#ffd23f';
    Draw.text(ctx, title, W / 2, 80, { size: 54, weight: 900, color, shadow: color, blur: 26 });
    Draw.text(ctx, T.games.map((g) => g.name).join('  ·  '), W / 2, 132, { size: 18, weight: 500, color: '#a9b1d6' });

    // Pódio: 2º, 1º, 3º, 4º. Quem empata em pontos fica na mesma altura.
    const order = [1, 0, 2, 3].filter((i) => i < this.ranked.length);
    const top = T.points.get(this.ranked[0]) || 1;
    order.forEach((rank, k) => {
      const p = this.ranked[rank], pts = T.points.get(p);
      const place = this.ranked.findIndex((o) => T.points.get(o) === pts);
      const x = W / 2 + (k - (order.length - 1) / 2) * 200;
      const h = 70 + 180 * (pts / top) * (place === 0 ? 1 : 0.85);
      const y = 580 - h;
      Draw.panel(ctx, x - 80, y, 160, h, 'rgba(24,28,52,0.95)', p.color, 10, 3);
      Draw.text(ctx, `${place + 1}º`, x, y + 34, { size: 32, weight: 900, color: p.color });
      Draw.text(ctx, `${pts} ponto(s)`, x, y + 70, { size: 18, weight: 600, color: '#dfe3f5' });
      const bob = Math.sin(this.t * 4 + k) * 5;
      if (place === 0) drawCrown(ctx, x, y - 92 + bob);
      Draw.playerDot(ctx, x, y - 44 + bob, 32, p);
    });

    this.rects().forEach((r) => Draw.button(ctx, r, 'Voltar ao menu', true));
  }
}

// ================================================================ auxiliares de cena
function drawBackdrop(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#11142a');
  g.addColorStop(1, '#070811');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(124,140,255,0.06)';
  ctx.lineWidth = 1;
  const off = (t * 20) % 40;
  for (let x = -40 + off; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -40 + off; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function drawScoreboard(ctx, y, label = 'PLACAR DA SESSÃO', scoreOf = (p) => p.score) {
  const P = Engine.players;
  if (!P.length) return;
  const w = 190, gap = 14, total = P.length * w + (P.length - 1) * gap, x0 = (W - total) / 2;
  Draw.text(ctx, label, x0 - 20, y, { size: 15, weight: 900, color: '#7c8cff', align: 'right' });
  P.forEach((p, i) => {
    const x = x0 + i * (w + gap);
    Draw.panel(ctx, x, y - 18, w, 36, 'rgba(18,21,40,0.95)', p.color, 18, 2);
    Draw.playerDot(ctx, x + 20, y, 11, p);
    Draw.text(ctx, p.name, x + 40, y + 1, { size: 17, weight: 600, align: 'left', color: '#dfe3f5' });
    Draw.text(ctx, String(scoreOf(p)), x + w - 18, y + 1, { size: 20, weight: 900, align: 'right', color: p.color });
  });
}

function drawCrown(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 22, y + 10);
  ctx.lineTo(x - 22, y - 10);
  ctx.lineTo(x - 11, y + 1);
  ctx.lineTo(x, y - 14);
  ctx.lineTo(x + 11, y + 1);
  ctx.lineTo(x + 22, y - 10);
  ctx.lineTo(x + 22, y + 10);
  ctx.closePath();
  ctx.fillStyle = '#ffd23f';
  ctx.fill();
}
