'use strict';

// Batata Quente: quem está com a bomba passa ao encostar em outro jogador.
// Quando o pavio acaba, quem estiver com ela sai da rodada. O último que sobrar vence.
// A arena muda a cada rodada. Quem vencer 3 rodadas leva.
(() => {
  const ROUNDS_TO_WIN = 3;
  const R = 18, SPEED = 250, HOLDER_BONUS = 1.1, PASS_LOCK = 0.5;
  const FULL = { x0: 30, y0: 76, x1: W - 30, y1: H - 24 };
  const ARENAS = [
    { name: 'Pátio', area: FULL, rects: [] },
    {
      name: 'Pilares', area: FULL,
      rects: [{ x: 320, y: 200, w: 80, h: 80 }, { x: 880, y: 200, w: 80, h: 80 }, { x: 320, y: 500, w: 80, h: 80 }, { x: 880, y: 500, w: 80, h: 80 }, { x: 600, y: 350, w: 80, h: 80 }],
    },
    {
      name: 'Corredores', area: FULL,
      rects: [{ x: 180, y: 190, w: 380, h: 28 }, { x: 720, y: 190, w: 380, h: 28 }, { x: 180, y: 560, w: 380, h: 28 }, { x: 720, y: 560, w: 380, h: 28 }, { x: 626, y: 300, w: 28, h: 180 }],
    },
    { name: 'Ringue Apertado', area: { x0: 260, y0: 150, x1: W - 260, y1: H - 70 }, rects: [] },
  ];

  class PotatoGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.wins = new Map(players.map((p) => [p, 0]));
      this.round = 0;
      this.fx = new Particles();
      this.startRound();
    }

    startRound() {
      this.arena = ARENAS[this.round % ARENAS.length];
      const a = this.arena.area, cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
      const rad = Math.min(230, (a.y1 - a.y0) / 2 - 50), n = this.players.length;
      this.runners = this.players.map((p, i) => {
        const ang = Math.PI / 4 + (i / n) * Math.PI * 2;
        const r = { p, x: cx + Math.cos(ang) * rad * 1.4, y: cy + Math.sin(ang) * rad, alive: true, dash: 0, dashCd: 0 };
        this.resolve(r);
        return r;
      });
      this.holder = null;
      this.shake = 0;
      this.state = 'countdown';
      this.timer = 3;
      this.roundWinner = null;
      Sfx.play('tick');
    }

    giveBomb() {
      const alive = this.runners.filter((r) => r.alive);
      this.holder = alive[Math.floor(Math.random() * alive.length)];
      this.fuse = rand(7, 12);
      this.fuseMax = this.fuse;
      this.lock = 1; // o primeiro portador tem um segundo para reagir
      this.beepT = 0;
      this.fx.burst(this.holder.x, this.holder.y, '#ff9f43', 16, 160);
    }

    // Mantém o jogador dentro da arena e fora dos obstáculos
    resolve(r) {
      const a = this.arena.area;
      r.x = clamp(r.x, a.x0 + R, a.x1 - R);
      r.y = clamp(r.y, a.y0 + R, a.y1 - R);
      for (const o of this.arena.rects) {
        const nx = clamp(r.x, o.x, o.x + o.w), ny = clamp(r.y, o.y, o.y + o.h);
        const dx = r.x - nx, dy = r.y - ny, d = Math.hypot(dx, dy);
        if (d >= R) continue;
        if (d > 0) { r.x = nx + (dx / d) * R; r.y = ny + (dy / d) * R; continue; }
        // centro dentro do retângulo: sai pelo lado mais próximo
        const exits = [[r.x - o.x, -1, 0], [o.x + o.w - r.x, 1, 0], [r.y - o.y, 0, -1], [o.y + o.h - r.y, 0, 1]].sort((p, q) => p[0] - q[0]);
        const [, ex, ey] = exits[0];
        if (ex) r.x = ex < 0 ? o.x - R : o.x + o.w + R;
        else r.y = ey < 0 ? o.y - R : o.y + o.h + R;
      }
    }

    move(dt) {
      for (const r of this.runners) {
        if (!r.alive) continue;
        r.dash = Math.max(0, r.dash - dt);
        r.dashCd = Math.max(0, r.dashCd - dt);
        if (r.p.device.pressed('a') && r.dashCd <= 0) { r.dash = 0.18; r.dashCd = 1.4; Sfx.play('shoot'); }
        const d = r.p.device.dir(r.x, r.y);
        const spd = SPEED * (r === this.holder ? HOLDER_BONUS : 1) * (r.dash > 0 ? 2.6 : 1);
        const steps = 3;
        for (let s = 0; s < steps; s++) {
          r.x += (d.x * spd * dt) / steps;
          r.y += (d.y * spd * dt) / steps;
          this.resolve(r);
        }
      }
      // jogadores se empurram
      const alive = this.runners.filter((r) => r.alive);
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (d < R * 2) {
          const push = (R * 2 - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
          this.resolve(a); this.resolve(b);
        }
      }
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, this.shake - dt);

      if (this.state === 'countdown') {
        if (countdownTick(this, dt)) { this.state = 'play'; this.giveBomb(); }
        return;
      }
      if (this.state === 'boom') {
        this.timer -= dt;
        this.move(dt);
        if (this.timer <= 0) { this.state = 'play'; this.giveBomb(); }
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
            subtitle: `Sobreviveu a ${ROUNDS_TO_WIN} rodadas de Batata Quente`,
            winners: [champ],
            lines: ranked.map((p) => ({ player: p, text: `${p.name}: ${this.wins.get(p)} rodada(s)` })),
            color: champ.color,
          });
          return;
        }
        this.round++;
        this.startRound();
        return;
      }

      this.move(dt);

      // Passar a bomba
      this.lock -= dt;
      if (this.lock <= 0) {
        const h = this.holder;
        const target = this.runners.find((r) => r.alive && r !== h && Math.hypot(r.x - h.x, r.y - h.y) < R * 2 + 4);
        if (target) {
          this.holder = target;
          this.lock = PASS_LOCK;
          Sfx.play('pickup');
          this.fx.burst(target.x, target.y, '#ff9f43', 10, 140);
        }
      }

      // Pavio
      this.fuse -= dt;
      this.beepT -= dt;
      if (this.beepT <= 0) { Sfx.play('beep'); this.beepT = clamp(this.fuse * 0.12, 0.07, 0.7); }
      if (this.fuse <= 0) this.explode();
    }

    explode() {
      const h = this.holder;
      h.alive = false;
      this.holder = null;
      this.shake = 0.5;
      this.fx.burst(h.x, h.y, '#ff9f43', 60, 420, 1, 7);
      this.fx.burst(h.x, h.y, h.p.color, 30, 260, 0.9, 5);
      Sfx.play('explode');
      const alive = this.runners.filter((r) => r.alive);
      if (alive.length <= 1) {
        this.state = 'ending';
        this.timer = 2.4;
        this.roundWinner = alive[0] ? alive[0].p : null;
        if (this.roundWinner) this.wins.set(this.roundWinner, this.wins.get(this.roundWinner) + 1);
        Sfx.play('win');
      } else {
        this.state = 'boom';
        this.timer = 1.6;
        this.lastOut = h.p;
      }
    }

    draw(ctx) {
      const a = this.arena.area;
      ctx.save();
      applyShake(ctx, this.shake);
      ctx.fillStyle = '#140f0a';
      ctx.fillRect(0, 56, W, H - 56);
      ctx.fillStyle = '#2a2117';
      ctx.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      ctx.strokeStyle = 'rgba(255,159,67,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
      for (const o of this.arena.rects) {
        ctx.fillStyle = '#4a3a28';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = '#5e4a33';
        ctx.fillRect(o.x, o.y, o.w, 5);
      }

      for (const r of this.runners) {
        if (!r.alive) {
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(r.x, r.y, R * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = '#000';
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        if (r.dash > 0) {
          ctx.globalAlpha = 0.3;
          Draw.playerDot(ctx, r.x - r.p.device.dir(r.x, r.y).x * 16, r.y - r.p.device.dir(r.x, r.y).y * 16, R, r.p);
          ctx.globalAlpha = 1;
        }
        Draw.playerDot(ctx, r.x, r.y, R, r.p);
      }

      // A bomba
      const h = this.holder;
      if (h && (this.state === 'play')) {
        const k = 1 - this.fuse / this.fuseMax;
        const pulse = 1 + Math.sin(Engine.time * (6 + k * 30)) * 0.12;
        const bx = h.x, by = h.y - 34;
        ctx.beginPath();
        ctx.arc(h.x, h.y, R + 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,80,60,${0.5 + k * 0.5})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx, by, 14 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = k > 0.75 && Math.floor(Engine.time * 12) % 2 ? '#ff5d3c' : '#1f1f24';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + 6, by - 12);
        ctx.quadraticCurveTo(bx + 14, by - 22, bx + 10, by - 28);
        ctx.strokeStyle = '#c8a26b';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx + 10, by - 28, 3 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      }

      this.fx.draw(ctx);
      ctx.restore();

      // HUD
      Draw.hudBar(ctx);
      Draw.text(ctx, `BATATA QUENTE  ·  Rodada ${this.round + 1}  ·  ${this.arena.name}`, 20, 27, { size: 20, align: 'left' });
      this.players.forEach((p, i) => {
        const x = W - 20 - (this.players.length - 1 - i) * 120 - 100;
        Draw.playerDot(ctx, x, 27, 11, p);
        for (let k = 0; k < ROUNDS_TO_WIN; k++) {
          ctx.beginPath();
          ctx.arc(x + 24 + k * 22, 27, 7, 0, Math.PI * 2);
          ctx.fillStyle = k < this.wins.get(p) ? p.color : '#2c3254';
          ctx.fill();
        }
      });

      if (this.state === 'countdown') {
        Draw.text(ctx, `Arena: ${this.arena.name}`, W / 2, H / 2 - 120, { size: 34, weight: 800, shadow: '#000' });
        Draw.countdown(ctx, this.timer);
        if (this.round === 0) Draw.text(ctx, 'Encoste em alguém para passar a bomba  ·  AÇÃO: arrancada', W / 2, H / 2 + 120, { size: 22, color: '#dfe3f5', shadow: '#000' });
      }
      if (this.state === 'boom') Draw.banner(ctx, 'BUM!', `${this.lastOut.name} está fora`, 'Nova bomba chegando...', '#ff9f43');
      if (this.state === 'ending') {
        const w = this.roundWinner;
        Draw.banner(ctx, w ? `${w.name} sobreviveu!` : 'Ninguém sobrou!', w ? `${this.wins.get(w)}/${ROUNDS_TO_WIN} vitórias` : null, null, w ? w.color : '#fff');
      }
    }
  }

  GAMES.push({
    id: 'potato',
    name: 'Batata Quente',
    tag: 'FESTA',
    min: 2,
    max: 4,
    desc: ['Passe a bomba antes que ela exploda!', 'Melhor com 3+. A arena muda a cada rodada.'],
    controls: 'Mover: direcional · Arrancada: AÇÃO',
    create: (ps) => new PotatoGame(ps),
    icon(ctx, x, y, t) {
      const pulse = 1 + Math.sin(t * 10) * 0.1;
      ctx.beginPath();
      ctx.arc(x, y + 6, 30 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#1f1f24';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 14, y - 20);
      ctx.quadraticCurveTo(x + 30, y - 40, x + 22, y - 50);
      ctx.strokeStyle = '#c8a26b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 22, y - 50, 5 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    },
  });
})();
