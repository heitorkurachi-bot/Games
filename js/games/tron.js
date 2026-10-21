'use strict';

// Motos de Luz: cada moto deixa um rastro. Bateu, perdeu.
// A cada rodada a arena muda e a velocidade aumenta. Quem vencer 3 rodadas leva.
(() => {
  const CELL = 16, GC = 80, GR = 41;
  const OX = 0, OY = 58 + Math.floor((H - 58 - GR * CELL) / 2);
  const ROUNDS_TO_WIN = 3, BOOST_MAX = 1.5;
  const MID_R = Math.floor(GR / 2), MID_C = Math.floor(GC / 2);
  // Posição inicial e direção de cada jogador (as "faixas" centrais ficam livres de obstáculos)
  const STARTS = [
    { c: 6, r: MID_R, dx: 1, dy: 0 },
    { c: GC - 7, r: MID_R, dx: -1, dy: 0 },
    { c: MID_C, r: 3, dx: 0, dy: 1 },
    { c: MID_C, r: GR - 4, dx: 0, dy: -1 },
  ];

  function block(set, c, r, w, h) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(c + i, r + j);
  }

  const PHASES = [
    { name: 'Arena Livre', speed: 11, build() {} },
    {
      name: 'Corredores', speed: 12.5,
      build(set) {
        for (let c = 12; c < GC - 12; c++) {
          if (Math.abs(c - MID_C) <= 3) continue;
          set(c, 10); set(c, GR - 11);
        }
      },
    },
    {
      name: 'Pilares', speed: 13.5,
      build(set) {
        for (const c of [16, 28, 49, 61]) for (const r of [8, GR - 11]) block(set, c, r, 3, 3);
        block(set, 22, 15, 3, 3); block(set, GC - 25, 15, 3, 3);
        block(set, 22, GR - 18, 3, 3); block(set, GC - 25, GR - 18, 3, 3);
      },
    },
    {
      name: 'A Caixa', speed: 14.5,
      build(set) {
        const c0 = 26, c1 = GC - 27, r0 = 11, r1 = GR - 12;
        for (let c = c0; c <= c1; c++) if (Math.abs(c - MID_C) > 2) { set(c, r0); set(c, r1); }
        for (let r = r0; r <= r1; r++) if (Math.abs(r - MID_R) > 2) { set(c0, r); set(c1, r); }
      },
    },
    {
      name: 'Caos', speed: 15.5,
      build(set) {
        let seed = 1337;
        const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (let k = 0; k < 46; k++) {
          const c = 3 + Math.floor(rnd() * (GC - 8)), r = 3 + Math.floor(rnd() * (GR - 8));
          if (Math.abs(r - MID_R) <= 3 || Math.abs(c - MID_C) <= 3) continue;
          block(set, c, r, 2, 2);
        }
      },
    },
  ];

  class TronGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.wins = new Map(players.map((p) => [p, 0]));
      this.round = 0;
      this.fx = new Particles();
      this.startRound();
    }

    startRound() {
      this.phase = PHASES[this.round % PHASES.length];
      this.grid = new Int8Array(GC * GR);
      this.phase.build((c, r) => { if (c >= 0 && c < GC && r >= 0 && r < GR) this.grid[r * GC + c] = -1; });
      this.bikes = this.players.map((p, i) => {
        const s = STARTS[i];
        const b = { p, idx: i + 1, c: s.c, r: s.r, dx: s.dx, dy: s.dy, queue: [], alive: true, boost: BOOST_MAX, boosting: false, acc: 0 };
        this.grid[s.r * GC + s.c] = b.idx;
        return b;
      });
      this.shake = 0;
      this.state = 'countdown';
      this.timer = 3;
      this.roundWinner = null;
      Sfx.play('tick');
    }

    headPos(b) { return { x: OX + (b.c + 0.5) * CELL, y: OY + (b.r + 0.5) * CELL }; }

    readInput(b) {
      const h = this.headPos(b);
      const d = b.p.device.dir(h.x, h.y);
      const last = b.queue.length ? b.queue[b.queue.length - 1] : { dx: b.dx, dy: b.dy };
      const ax = Math.abs(d.x), ay = Math.abs(d.y);
      if (Math.max(ax, ay) < 0.5) return;
      let nd;
      if (ax > 0.5 && ay > 0.5) {
        // diagonal: vira para o eixo perpendicular ao movimento atual
        nd = last.dx !== 0 ? { dx: 0, dy: Math.sign(d.y) } : { dx: Math.sign(d.x), dy: 0 };
      } else {
        nd = ax > ay ? { dx: Math.sign(d.x), dy: 0 } : { dx: 0, dy: Math.sign(d.y) };
      }
      if (nd.dx === last.dx && nd.dy === last.dy) return;
      if (nd.dx === -last.dx && nd.dy === -last.dy) return; // não dá ré
      if (b.queue.length < 2) b.queue.push(nd);
    }

    step(b) {
      if (b.queue.length) { const q = b.queue.shift(); b.dx = q.dx; b.dy = q.dy; }
      const nc = b.c + b.dx, nr = b.r + b.dy;
      if (nc < 0 || nc >= GC || nr < 0 || nr >= GR || this.grid[nr * GC + nc] !== 0) { this.crash(b); return; }
      b.c = nc;
      b.r = nr;
      this.grid[nr * GC + nc] = b.idx;
    }

    crash(b) {
      b.alive = false;
      this.shake = 0.4;
      const h = this.headPos(b);
      this.fx.burst(h.x, h.y, b.p.color, 40, 320, 0.9, 5);
      Sfx.play('explode');
      // O rastro de quem bateu se desfaz e libera espaço
      for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i] !== b.idx) continue;
        this.grid[i] = 0;
        if (Math.random() < 0.08) this.fx.burst(OX + ((i % GC) + 0.5) * CELL, OY + (Math.floor(i / GC) + 0.5) * CELL, b.p.color, 2, 60, 0.5, 3);
      }
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, this.shake - dt);

      if (this.state === 'countdown') {
        for (const b of this.bikes) this.readInput(b);
        if (countdownTick(this, dt)) this.state = 'play';
        return;
      }

      if (this.state === 'play') {
        for (const b of this.bikes) {
          if (!b.alive) continue;
          this.readInput(b);
          b.boosting = b.p.device.held('a') && b.boost > 0;
          b.boost = b.boosting ? b.boost - dt : Math.min(BOOST_MAX, b.boost + dt * 0.25);
          b.acc += dt * this.phase.speed * (b.boosting ? 1.8 : 1);
        }
        // Avança um passo por vez, alternando entre as motos, para ser justo
        let moved = true;
        while (moved) {
          moved = false;
          for (const b of this.bikes) {
            if (b.alive && b.acc >= 1) { b.acc -= 1; this.step(b); moved = true; }
          }
        }
        const alive = this.bikes.filter((b) => b.alive);
        if (alive.length <= 1) {
          this.state = 'ending';
          this.timer = 2.2;
          this.roundWinner = alive[0] ? alive[0].p : null;
          if (this.roundWinner) this.wins.set(this.roundWinner, this.wins.get(this.roundWinner) + 1);
          Sfx.play('win');
        }
        return;
      }

      if (this.state === 'ending') {
        this.timer -= dt;
        if (this.timer > 0) return;
        const champ = this.players.find((p) => this.wins.get(p) >= ROUNDS_TO_WIN);
        if (champ) {
          const ranked = this.players.slice().sort((a, b) => this.wins.get(b) - this.wins.get(a));
          Engine.finishGame({
            title: `${champ.name} venceu!`,
            subtitle: `Primeiro a vencer ${ROUNDS_TO_WIN} rodadas nas Motos de Luz`,
            winners: [champ],
            lines: ranked.map((p) => ({ player: p, text: `${p.name}: ${this.wins.get(p)} rodada(s)` })),
            color: champ.color,
          });
          return;
        }
        this.round++;
        this.startRound();
      }
    }

    draw(ctx) {
      ctx.save();
      applyShake(ctx, this.shake);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(OX, OY, GC * CELL, GR * CELL);
      ctx.strokeStyle = 'rgba(77,171,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 0; c <= GC; c += 2) { ctx.moveTo(OX + c * CELL, OY); ctx.lineTo(OX + c * CELL, OY + GR * CELL); }
      for (let r = 0; r <= GR; r += 2) { ctx.moveTo(OX, OY + r * CELL); ctx.lineTo(OX + GC * CELL, OY + r * CELL); }
      ctx.stroke();

      const colors = this.players.map((p) => p.color);
      for (let i = 0; i < this.grid.length; i++) {
        const v = this.grid[i];
        if (!v) continue;
        const x = OX + (i % GC) * CELL, y = OY + Math.floor(i / GC) * CELL;
        if (v < 0) {
          ctx.fillStyle = '#39406a';
          ctx.fillRect(x, y, CELL, CELL);
        } else {
          ctx.fillStyle = colors[v - 1];
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
          ctx.globalAlpha = 1;
        }
      }

      for (const b of this.bikes) {
        if (!b.alive) continue;
        const h = this.headPos(b);
        ctx.beginPath();
        ctx.arc(h.x, h.y, CELL * 0.62, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = b.p.color;
        ctx.shadowBlur = b.boosting ? 30 : 16;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(h.x, h.y, CELL * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = b.p.color;
        ctx.fill();
      }

      ctx.strokeStyle = '#4dabff';
      ctx.lineWidth = 2;
      ctx.strokeRect(OX + 1, OY + 1, GC * CELL - 2, GR * CELL - 2);
      this.fx.draw(ctx);
      ctx.restore();

      // HUD
      Draw.hudBar(ctx);
      Draw.text(ctx, `MOTOS DE LUZ  ·  Rodada ${this.round + 1}  ·  ${this.phase.name}`, 20, 27, { size: 20, align: 'left' });
      this.bikes.forEach((b, i) => {
        const p = b.p, x = W - 20 - (this.bikes.length - 1 - i) * 150 - 130;
        Draw.playerDot(ctx, x, 27, 11, p);
        for (let k = 0; k < ROUNDS_TO_WIN; k++) {
          ctx.beginPath();
          ctx.arc(x + 22 + k * 18, 27, 6, 0, Math.PI * 2);
          ctx.fillStyle = k < this.wins.get(p) ? p.color : '#2c3254';
          ctx.fill();
        }
        ctx.fillStyle = '#2c3254';
        ctx.fillRect(x + 78, 22, 40, 10);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 78, 22, 40 * (b.boost / BOOST_MAX), 10);
      });

      if (this.state === 'countdown') {
        Draw.text(ctx, `${this.phase.name}  ·  velocidade ${this.round % PHASES.length + 1}`, W / 2, H / 2 - 110, { size: 32, weight: 800, shadow: '#000' });
        Draw.countdown(ctx, this.timer);
        if (this.round === 0) Draw.text(ctx, 'Direcional: virar  ·  Segure AÇÃO: turbo  ·  Não bata em nada!', W / 2, H / 2 + 110, { size: 22, color: '#dfe3f5', shadow: '#000' });
      }
      if (this.state === 'ending') {
        const w = this.roundWinner;
        Draw.banner(ctx, w ? `${w.name} vence a rodada!` : 'Empate!', w ? `${this.wins.get(w)}/${ROUNDS_TO_WIN} vitórias` : 'Bateram ao mesmo tempo', null, w ? w.color : '#fff');
      }
    }
  }

  GAMES.push({
    id: 'tron',
    name: 'Motos de Luz',
    tag: 'VERSUS',
    min: 2,
    max: 4,
    desc: ['Deixe rastro e encurrale os outros.', '5 arenas, cada vez mais rápido.'],
    controls: 'Virar: direcional · Turbo: segure AÇÃO',
    create: (ps) => new TronGame(ps),
    icon(ctx, x, y, t) {
      const k = (t * 0.5) % 1;
      ctx.lineWidth = 7;
      ctx.lineCap = 'square';
      ctx.strokeStyle = PLAYER_COLORS[0];
      ctx.beginPath(); ctx.moveTo(x - 50, y + 30); ctx.lineTo(x - 10, y + 30); ctx.lineTo(x - 10, y - 20 - k * 20); ctx.stroke();
      ctx.strokeStyle = PLAYER_COLORS[3];
      ctx.beginPath(); ctx.moveTo(x + 50, y - 40); ctx.lineTo(x + 20, y - 40); ctx.lineTo(x + 20, y + 10 + k * 25); ctx.stroke();
    },
  });
})();
