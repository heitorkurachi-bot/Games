'use strict';

// Hóquei de Mesa: dois times (jogadores alternados entre esquerda e direita).
// São 3 períodos, cada um com uma mesa diferente. Se terminar empatado, vai para o gol de ouro.
// Com 3 jogadores, quem joga sozinho ganha um rebatedor maior e mais rápido.
(() => {
  const F = { x0: 70, y0: 92, x1: W - 70, y1: H - 26 };
  const CY = (F.y0 + F.y1) / 2;
  const GOAL_H = 190, GY0 = CY - GOAL_H / 2, GY1 = CY + GOAL_H / 2;
  const MR = 28, PR = 17, MSPEED = 430, MAXV = 1100;
  const TEAMS = [
    { name: 'Laranja', color: '#ff9f43' },
    { name: 'Ciano', color: '#22d3ee' },
  ];
  const PERIODS = [
    { name: 'Clássico', dur: 60, pucks: 1, bumpers: [] },
    {
      name: 'Pinball', dur: 60, pucks: 1,
      bumpers: [{ x: W / 2, y: CY - 150, r: 34 }, { x: W / 2, y: CY + 150, r: 34 }, { x: W / 2 - 250, y: CY, r: 24 }, { x: W / 2 + 250, y: CY, r: 24 }],
    },
    { name: 'Dois Discos', dur: 60, pucks: 2, bumpers: [] },
  ];

  class HockeyGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      const sizes = [0, 0];
      players.forEach((_, i) => sizes[i % 2]++);
      this.mallets = players.map((p, i) => {
        const team = i % 2, solo = sizes[team] === 1 && sizes[1 - team] > 1;
        return { p, team, r: MR * (solo ? 1.3 : 1), boost: solo ? 1.12 : 1, x: 0, y: 0, vx: 0, vy: 0, dash: 0, dashCd: 0, slot: Math.floor(i / 2), mates: sizes[team] };
      });
      this.score = [0, 0];
      this.period = 0;
      this.fx = new Particles();
      this.startPeriod();
    }

    startPeriod() {
      const P = PERIODS[this.period];
      this.bumpers = P.bumpers;
      this.left = P.dur;
      this.golden = false;
      this.resetPositions(null);
      this.state = 'countdown';
      this.timer = 3;
      Sfx.play('tick');
    }

    // Recoloca todos. O disco começa do lado de quem levou o gol.
    resetPositions(concededTeam) {
      for (const m of this.mallets) {
        m.x = m.team === 0 ? F.x0 + 140 : F.x1 - 140;
        m.y = m.mates > 1 ? CY + (m.slot === 0 ? -120 : 120) : CY;
        m.vx = m.vy = 0;
      }
      const n = PERIODS[this.period].pucks;
      this.pucks = [];
      for (let i = 0; i < n; i++) {
        let x = W / 2;
        if (concededTeam !== null) x += concededTeam === 0 ? -140 : 140;
        const y = n === 1 ? CY : CY + (i === 0 ? -110 : 110);
        this.pucks.push({ x, y, vx: 0, vy: 0 });
      }
    }

    moveMallets(dt) {
      for (const m of this.mallets) {
        const ox = m.x, oy = m.y;
        m.dash = Math.max(0, m.dash - dt);
        m.dashCd = Math.max(0, m.dashCd - dt);
        if (m.p.device.pressed('a') && m.dashCd <= 0) { m.dash = 0.16; m.dashCd = 0.9; }
        const d = m.p.device.dir(m.x, m.y);
        const spd = MSPEED * m.boost * (m.dash > 0 ? 2.3 : 1);
        m.x += d.x * spd * dt;
        m.y += d.y * spd * dt;
        // cada time fica na sua metade
        const minX = m.team === 0 ? F.x0 + m.r : W / 2 + m.r;
        const maxX = m.team === 0 ? W / 2 - m.r : F.x1 - m.r;
        m.x = clamp(m.x, minX, maxX);
        m.y = clamp(m.y, F.y0 + m.r, F.y1 - m.r);
        for (const b of this.bumpers) {
          const dx = m.x - b.x, dy = m.y - b.y, dd = Math.hypot(dx, dy) || 1;
          if (dd < m.r + b.r) { m.x = b.x + (dx / dd) * (m.r + b.r); m.y = b.y + (dy / dd) * (m.r + b.r); }
        }
        m.vx = dt > 0 ? (m.x - ox) / dt : 0;
        m.vy = dt > 0 ? (m.y - oy) / dt : 0;
      }
      // colegas de time não se sobrepõem
      for (let i = 0; i < this.mallets.length; i++) for (let j = i + 1; j < this.mallets.length; j++) {
        const a = this.mallets[i], b = this.mallets[j];
        if (a.team !== b.team) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }

    // Colisão de disco com um círculo (rebatedor ou obstáculo), devolve true se bateu
    collide(pk, cx, cy, r, vx, vy, bounce) {
      const dx = pk.x - cx, dy = pk.y - cy, d = Math.hypot(dx, dy);
      if (d >= r + PR || d === 0) return false;
      const nx = dx / d, ny = dy / d;
      pk.x = cx + nx * (r + PR);
      pk.y = cy + ny * (r + PR);
      const rel = (pk.vx - vx) * nx + (pk.vy - vy) * ny;
      if (rel < 0) {
        pk.vx -= (1 + bounce) * rel * nx;
        pk.vy -= (1 + bounce) * rel * ny;
      }
      return true;
    }

    updatePucks(dt) {
      const steps = 4, h = dt / steps;
      for (const pk of this.pucks) {
        for (let s = 0; s < steps; s++) {
          pk.x += pk.vx * h;
          pk.y += pk.vy * h;
          const inMouth = pk.y > GY0 + PR * 0.5 && pk.y < GY1 - PR * 0.5;
          // paredes de cima e de baixo (dentro do gol, as laterais da rede)
          const top = pk.x < F.x0 || pk.x > F.x1 ? GY0 + PR : F.y0 + PR;
          const bot = pk.x < F.x0 || pk.x > F.x1 ? GY1 - PR : F.y1 - PR;
          if (pk.y < top) { pk.y = top; pk.vy = Math.abs(pk.vy); Sfx.play('bump'); }
          if (pk.y > bot) { pk.y = bot; pk.vy = -Math.abs(pk.vy); Sfx.play('bump'); }
          if (!inMouth) {
            if (pk.x < F.x0 + PR) { pk.x = F.x0 + PR; pk.vx = Math.abs(pk.vx); Sfx.play('bump'); }
            if (pk.x > F.x1 - PR) { pk.x = F.x1 - PR; pk.vx = -Math.abs(pk.vx); Sfx.play('bump'); }
          }
          if (pk.x < F.x0 - PR * 1.5) { this.goal(1, pk); return; }
          if (pk.x > F.x1 + PR * 1.5) { this.goal(0, pk); return; }
          for (const m of this.mallets) {
            if (this.collide(pk, m.x, m.y, m.r, m.vx, m.vy, 0.9)) {
              if (Math.hypot(pk.vx, pk.vy) > 200) Sfx.play('bump');
            }
          }
          for (const b of this.bumpers) {
            if (this.collide(pk, b.x, b.y, b.r, 0, 0, 1.15)) { Sfx.play('door'); this.fx.burst(pk.x, pk.y, '#c084fc', 6, 120, 0.3, 3); b.flash = 0.2; }
          }
        }
        const sp = Math.hypot(pk.vx, pk.vy);
        if (sp > MAXV) { pk.vx *= MAXV / sp; pk.vy *= MAXV / sp; }
        const k = Math.pow(0.7, dt);
        pk.vx *= k;
        pk.vy *= k;
      }
    }

    goal(team, pk) {
      this.score[team]++;
      this.lastGoal = team;
      this.state = 'goal';
      this.timer = 1.8;
      this.shake = 0.4;
      this.fx.burst(pk.x, pk.y, TEAMS[team].color, 50, 380, 1, 6);
      Sfx.play('win');
    }

    finish() {
      const team = this.score[0] > this.score[1] ? 0 : 1;
      const T = TEAMS[team];
      Engine.finishGame({
        title: `Time ${T.name} venceu!`,
        subtitle: `${TEAMS[0].name} ${this.score[0]} x ${this.score[1]} ${TEAMS[1].name}`,
        winners: this.mallets.filter((m) => m.team === team).map((m) => m.p),
        lines: this.mallets.map((m) => ({ player: m.p, text: `${m.p.name}: Time ${TEAMS[m.team].name}` })),
        color: T.color,
      });
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, (this.shake || 0) - dt);
      for (const b of this.bumpers) b.flash = Math.max(0, (b.flash || 0) - dt);

      if (this.state === 'countdown') {
        this.moveMallets(dt);
        if (countdownTick(this, dt)) this.state = 'play';
        return;
      }
      if (this.state === 'goal') {
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.golden) { this.finish(); return; }
        this.resetPositions(1 - this.lastGoal);
        this.state = 'play';
        return;
      }
      if (this.state === 'periodEnd') {
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.period + 1 < PERIODS.length) { this.period++; this.startPeriod(); return; }
        if (this.score[0] === this.score[1]) {
          // gol de ouro: o próximo gol decide
          this.golden = true;
          this.resetPositions(null);
          this.state = 'countdown';
          this.timer = 3;
          return;
        }
        this.finish();
        return;
      }

      this.moveMallets(dt);
      this.updatePucks(dt);
      if (this.state !== 'play' || this.golden) return;
      this.left -= dt;
      if (this.left <= 0) {
        this.left = 0;
        this.state = 'periodEnd';
        this.timer = 2.4;
        Sfx.play('go');
      }
    }

    draw(ctx) {
      ctx.save();
      applyShake(ctx, this.shake || 0);
      // Mesa
      ctx.fillStyle = '#0d1b26';
      ctx.fillRect(0, 56, W, H - 56);
      ctx.fillStyle = '#12293a';
      ctx.fillRect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
      // gols
      ctx.fillStyle = TEAMS[0].color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(F.x0 - 46, GY0, 46, GOAL_H);
      ctx.fillStyle = TEAMS[1].color;
      ctx.fillRect(F.x1, GY0, 46, GOAL_H);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2, F.y0); ctx.lineTo(W / 2, F.y1);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, CY, 90, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(F.x0, CY, 130, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(F.x1, CY, 130, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
      // bordas
      ctx.strokeStyle = '#5b7a99';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(F.x0, GY0); ctx.lineTo(F.x0, F.y0); ctx.lineTo(F.x1, F.y0); ctx.lineTo(F.x1, GY0);
      ctx.moveTo(F.x1, GY1); ctx.lineTo(F.x1, F.y1); ctx.lineTo(F.x0, F.y1); ctx.lineTo(F.x0, GY1);
      ctx.stroke();

      for (const b of this.bumpers) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.flash > 0 ? '#f5d0fe' : '#7e22ce';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#c084fc';
        ctx.stroke();
      }

      for (const pk of this.pucks) {
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, PR, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0d18';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f8fafc';
        ctx.stroke();
      }

      for (const m of this.mallets) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = TEAMS[m.team].color;
        ctx.globalAlpha = m.dash > 0 ? 1 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        Draw.playerDot(ctx, m.x, m.y, m.r * 0.55, m.p);
      }

      this.fx.draw(ctx);
      ctx.restore();

      // HUD
      Draw.hudBar(ctx);
      const P = PERIODS[this.period];
      Draw.text(ctx, `HÓQUEI  ·  Período ${this.period + 1}/${PERIODS.length}: ${P.name}`, 20, 27, { size: 20, align: 'left' });
      Draw.text(ctx, String(this.score[0]), W / 2 - 40, 28, { size: 34, weight: 900, color: TEAMS[0].color });
      Draw.text(ctx, ':', W / 2, 26, { size: 30, weight: 900 });
      Draw.text(ctx, String(this.score[1]), W / 2 + 40, 28, { size: 34, weight: 900, color: TEAMS[1].color });
      Draw.text(ctx, this.golden ? 'GOL DE OURO' : fmtTime(Math.ceil(this.left)), W - 20, 27, { size: 22, align: 'right', color: this.golden ? '#ffd23f' : '#a9b1d6' });

      if (this.state === 'countdown') {
        const sub = this.golden ? 'GOL DE OURO: quem marcar primeiro vence!' : `Período ${this.period + 1}: ${P.name}`;
        Draw.text(ctx, sub, W / 2, H / 2 - 120, { size: 32, weight: 800, shadow: '#000' });
        Draw.countdown(ctx, this.timer);
        if (this.period === 0 && !this.golden) Draw.text(ctx, 'AÇÃO: arrancada  ·  Cada time defende o seu gol', W / 2, H / 2 + 120, { size: 22, color: '#dfe3f5', shadow: '#000' });
      }
      if (this.state === 'goal') {
        const T = TEAMS[this.lastGoal];
        Draw.banner(ctx, 'GOL!', `Ponto do time ${T.name}`, `${this.score[0]} x ${this.score[1]}`, T.color);
      }
      if (this.state === 'periodEnd') {
        const last = this.period + 1 >= PERIODS.length;
        Draw.banner(ctx, `Fim do ${this.period + 1}º período`, last && this.score[0] === this.score[1] ? 'Empate! Vamos para o gol de ouro' : `${this.score[0]} x ${this.score[1]}`,
          last ? null : `Próximo: ${PERIODS[this.period + 1].name}`, '#8ea2ff');
      }
    }
  }

  GAMES.push({
    id: 'hockey',
    name: 'Hóquei de Mesa',
    tag: 'TIMES',
    min: 2,
    max: 4,
    desc: ['Times em 3 períodos: clássico,', 'pinball e dois discos de uma vez.'],
    controls: 'Mover: direcional · Arrancada: AÇÃO',
    create: (ps) => new HockeyGame(ps),
    icon(ctx, x, y, t) {
      ctx.fillStyle = '#12293a';
      ctx.fillRect(x - 60, y - 50, 120, 100);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x, y + 50); ctx.stroke();
      const px = x + Math.sin(t * 2) * 30;
      ctx.beginPath(); ctx.arc(px, y, 9, 0, Math.PI * 2); ctx.fillStyle = '#0b0d18'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 42, y - 16, 15, 0, Math.PI * 2); ctx.fillStyle = TEAMS[0].color; ctx.fill();
      ctx.beginPath(); ctx.arc(x + 42, y + 16, 15, 0, Math.PI * 2); ctx.fillStyle = TEAMS[1].color; ctx.fill();
    },
  });
})();
