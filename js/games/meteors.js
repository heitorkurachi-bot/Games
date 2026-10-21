'use strict';

// Chuva de Meteoros: sobrevivência cooperativa em ondas.
// Quem cai pode ser revivido por um colega que fique perto. Se todos caírem, acabou.
// Cristais dão pontos individuais (o "MVP" da equipe).
(() => {
  const AREA = { x0: 24, y0: 70, x1: W - 24, y1: H - 20 };
  const WAVES = [
    { name: 'Garoa', dur: 18, rate: 1.3, warn: 1.3, rmin: 38, rmax: 58, comets: 0, big: 0 },
    { name: 'Chuva', dur: 20, rate: 2.2, warn: 1.2, rmin: 40, rmax: 62, comets: 0, big: 0 },
    { name: 'Cometas!', dur: 22, rate: 1.6, warn: 1.2, rmin: 40, rmax: 60, comets: 0.4, big: 0 },
    { name: 'Tempestade', dur: 22, rate: 3.0, warn: 1.1, rmin: 40, rmax: 66, comets: 0.3, big: 0 },
    { name: 'Gigantes', dur: 24, rate: 2.0, warn: 1.1, rmin: 40, rmax: 60, comets: 0.25, big: 0.3 },
    { name: 'Caos', dur: 25, rate: 3.2, warn: 1.0, rmin: 42, rmax: 70, comets: 0.45, big: 0.22 },
    { name: 'Apocalipse', dur: 28, rate: 4.0, warn: 0.9, rmin: 44, rmax: 72, comets: 0.55, big: 0.3 },
  ];
  const PR = 15, SPEED = 270, REVIVE_TIME = 1.3, REVIVE_DIST = 48;

  class MeteorsGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.fx = new Particles();
      this.heroes = players.map((p, i) => ({
        p, x: W / 2 + (i - (players.length - 1) / 2) * 70, y: H / 2 + 40, down: false, revive: 0, inv: 0, gems: 0,
      }));
      this.wave = 0;
      this.shake = 0;
      this.t = 0;
      this.startWave();
    }

    startWave() {
      this.meteors = [];
      this.comets = [];
      this.craters = this.craters || [];
      this.crystals = [];
      this.crystalT = 2;
      this.spawnAcc = 0;
      this.state = 'intro';
      this.timer = 2.4;
      this.left = WAVES[this.wave].dur;
      // Bônus: todos voltam no começo de cada onda
      for (const h of this.heroes) { h.down = false; h.revive = 0; h.inv = 1; }
    }

    alive() { return this.heroes.filter((h) => !h.down); }

    spawnMeteor(w, big) {
      const living = this.alive();
      let x, y;
      if (living.length && Math.random() < 0.55) {
        const h = living[Math.floor(Math.random() * living.length)];
        x = h.x + rand(-110, 110);
        y = h.y + rand(-110, 110);
      } else {
        x = rand(AREA.x0, AREA.x1);
        y = rand(AREA.y0, AREA.y1);
      }
      const r = big ? rand(110, 140) : rand(w.rmin, w.rmax);
      const warn = big ? w.warn + 0.8 : w.warn;
      this.meteors.push({ x: clamp(x, AREA.x0, AREA.x1), y: clamp(y, AREA.y0, AREA.y1), r, t: warn, warn });
    }

    spawnComet() {
      const horizontal = Math.random() < 0.5, dirSign = Math.random() < 0.5 ? 1 : -1, speed = 950;
      const c = { warn: 1.0, r: 20, trail: [] };
      if (horizontal) {
        c.y = rand(AREA.y0 + 30, AREA.y1 - 30);
        c.x = dirSign > 0 ? -40 : W + 40;
        c.vx = speed * dirSign; c.vy = 0;
      } else {
        c.x = rand(AREA.x0 + 30, AREA.x1 - 30);
        c.y = dirSign > 0 ? 20 : H + 40;
        c.vx = 0; c.vy = speed * dirSign;
      }
      this.comets.push(c);
    }

    knockDown(h) {
      h.down = true;
      h.revive = 0;
      this.shake = 0.3;
      Sfx.play('hurt');
      this.fx.burst(h.x, h.y, h.p.color, 24, 240);
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, this.shake - dt);
      this.t += dt;
      for (const c of this.craters) c.life -= dt;
      this.craters = this.craters.filter((c) => c.life > 0);

      if (this.state === 'intro') {
        this.timer -= dt;
        this.moveHeroes(dt);
        if (this.timer <= 0) { this.state = 'play'; Sfx.play('go'); }
        return;
      }
      if (this.state === 'waveClear' || this.state === 'over') {
        this.timer -= dt;
        if (this.state === 'waveClear') this.moveHeroes(dt);
        if (this.timer > 0) return;
        if (this.state === 'over') { this.finish(false); return; }
        if (this.wave + 1 >= WAVES.length) { this.finish(true); return; }
        this.wave++;
        this.startWave();
        return;
      }

      const w = WAVES[this.wave];
      this.left -= dt;
      this.moveHeroes(dt);

      // Gera perigos
      this.spawnAcc += dt * w.rate;
      while (this.spawnAcc >= 1) { this.spawnAcc--; this.spawnMeteor(w, false); }
      if (w.big && Math.random() < w.big * dt) this.spawnMeteor(w, true);
      if (w.comets && Math.random() < w.comets * dt) this.spawnComet();

      // Meteoros
      for (const m of this.meteors) {
        m.t -= dt;
        if (m.t <= 0 && !m.done) {
          m.done = true;
          this.shake = Math.max(this.shake, m.r > 100 ? 0.45 : 0.18);
          Sfx.play(m.r > 100 ? 'explode' : 'hit');
          this.fx.burst(m.x, m.y, '#ff9f43', Math.floor(m.r / 2), m.r * 4, 0.7, 5);
          this.craters.push({ x: m.x, y: m.y, r: m.r, life: 3 });
          for (const h of this.heroes) if (!h.down && h.inv <= 0 && Math.hypot(h.x - m.x, h.y - m.y) < m.r + PR * 0.6) this.knockDown(h);
        }
      }
      this.meteors = this.meteors.filter((m) => !m.done);

      // Cometas
      for (const c of this.comets) {
        if (c.warn > 0) { c.warn -= dt; continue; }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.trail.push({ x: c.x, y: c.y });
        if (c.trail.length > 14) c.trail.shift();
        for (const h of this.heroes) if (!h.down && h.inv <= 0 && Math.hypot(h.x - c.x, h.y - c.y) < c.r + PR) this.knockDown(h);
      }
      this.comets = this.comets.filter((c) => c.x > -200 && c.x < W + 200 && c.y > -200 && c.y < H + 200);

      // Cristais
      this.crystalT -= dt;
      if (this.crystalT <= 0 && this.crystals.length < 4) {
        this.crystalT = rand(2, 3.5);
        this.crystals.push({ x: rand(AREA.x0 + 30, AREA.x1 - 30), y: rand(AREA.y0 + 30, AREA.y1 - 30), t: 0 });
      }
      for (const cr of this.crystals) {
        cr.t += dt;
        const h = this.heroes.find((o) => !o.down && Math.hypot(o.x - cr.x, o.y - cr.y) < PR + 14);
        if (h) { cr.taken = true; h.gems++; Sfx.play('pickup'); this.fx.burst(cr.x, cr.y, '#67e8f9', 12, 140); }
      }
      this.crystals = this.crystals.filter((c) => !c.taken && c.t < 9);

      // Reviver
      for (const h of this.heroes) {
        if (!h.down) continue;
        const helper = this.heroes.some((o) => !o.down && Math.hypot(o.x - h.x, o.y - h.y) < REVIVE_DIST);
        h.revive = helper ? h.revive + dt : Math.max(0, h.revive - dt * 0.5);
        if (h.revive >= REVIVE_TIME) { h.down = false; h.inv = 1.5; Sfx.play('confirm'); this.fx.burst(h.x, h.y, '#ffffff', 18, 160); }
      }

      if (!this.alive().length) { this.state = 'over'; this.timer = 2.8; Sfx.play('lose'); return; }
      if (this.left <= 0) { this.state = 'waveClear'; this.timer = 2.2; this.meteors = []; this.comets = []; Sfx.play('win'); }
    }

    moveHeroes(dt) {
      for (const h of this.heroes) {
        h.inv = Math.max(0, h.inv - dt);
        if (h.down) continue;
        const d = h.p.device.dir(h.x, h.y);
        h.x = clamp(h.x + d.x * SPEED * dt, AREA.x0 + PR, AREA.x1 - PR);
        h.y = clamp(h.y + d.y * SPEED * dt, AREA.y0 + PR, AREA.y1 - PR);
      }
    }

    finish(victory) {
      const ranked = this.heroes.slice().sort((a, b) => b.gems - a.gems);
      const lines = ranked.map((h, i) => ({ player: h.p, text: `${h.p.name}: ${h.gems} cristais${i === 0 && h.gems > 0 ? '  (MVP)' : ''}` }));
      if (victory) {
        Engine.finishGame({
          title: 'Sobreviveram!',
          subtitle: `As ${WAVES.length} ondas foram vencidas. Todos ganham 1 ponto!`,
          winners: this.players.slice(),
          lines,
          color: '#5ee38b',
        });
      } else {
        Engine.finishGame({
          title: `A equipe caiu na onda ${this.wave + 1}`,
          subtitle: `"${WAVES[this.wave].name}". Lembrem de reviver os colegas!`,
          winners: [],
          lines,
          color: '#ff5d73',
        });
      }
    }

    draw(ctx) {
      ctx.save();
      applyShake(ctx, this.shake);
      // Chão
      const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 760);
      g.addColorStop(0, '#2a1f2e');
      g.addColorStop(1, '#120c17');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,159,67,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0);

      for (const c of this.craters) {
        ctx.globalAlpha = Math.min(1, c.life) * 0.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0609';
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Alvos dos meteoros
      for (const m of this.meteors) {
        const k = 1 - m.t / m.warn;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,70,70,${0.08 + k * 0.22})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,90,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r * k, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,120,60,0.35)';
        ctx.fill();
        // meteoro caindo
        const fy = m.y - (1 - k) * 500;
        ctx.beginPath();
        ctx.arc(m.x + (1 - k) * 120, fy, m.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffb35c';
        ctx.shadowColor = '#ff6b2c';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Cometas
      for (const c of this.comets) {
        if (c.warn > 0) {
          ctx.setLineDash([14, 10]);
          ctx.strokeStyle = `rgba(103,232,249,${Math.floor(c.warn * 10) % 2 ? 0.8 : 0.35})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (c.vy === 0) { ctx.moveTo(0, c.y); ctx.lineTo(W, c.y); } else { ctx.moveTo(c.x, 0); ctx.lineTo(c.x, H); }
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        c.trail.forEach((p, i) => {
          ctx.globalAlpha = i / c.trail.length * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, c.r * (i / c.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = '#67e8f9';
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = '#e0fbff';
        ctx.fill();
      }

      // Cristais
      for (const cr of this.crystals) {
        const blink = cr.t > 7 && Math.floor(cr.t * 8) % 2;
        if (blink) continue;
        ctx.save();
        ctx.translate(cr.x, cr.y + Math.sin(cr.t * 4) * 3);
        ctx.rotate(cr.t * 1.5);
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 14;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.restore();
      }

      // Jogadores
      for (const h of this.heroes) {
        if (h.down) {
          ctx.globalAlpha = 0.45;
          Draw.playerDot(ctx, h.x, h.y, PR, h.p);
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(h.x, h.y, REVIVE_DIST, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.18)';
          ctx.setLineDash([6, 6]);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
          if (h.revive > 0) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, PR + 8, -Math.PI / 2, -Math.PI / 2 + (h.revive / REVIVE_TIME) * Math.PI * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          Draw.text(ctx, 'SOCORRO!', h.x, h.y - 30, { size: 14, weight: 900, color: h.p.color });
          continue;
        }
        if (h.inv > 0 && Math.floor(h.inv * 10) % 2) continue;
        Draw.playerDot(ctx, h.x, h.y, PR, h.p);
      }

      this.fx.draw(ctx);
      ctx.restore();

      // HUD
      Draw.hudBar(ctx);
      const w = WAVES[this.wave];
      Draw.text(ctx, `CHUVA DE METEOROS  ·  Onda ${this.wave + 1}/${WAVES.length}: ${w.name}`, 20, 27, { size: 20, align: 'left' });
      const frac = clamp(this.left / w.dur, 0, 1);
      Draw.panel(ctx, 640, 17, 260, 20, '#241a2a', null, 10);
      Draw.panel(ctx, 640, 17, Math.max(20, 260 * frac), 20, '#ff9f43', null, 10);
      Draw.text(ctx, `${Math.ceil(Math.max(0, this.left))}s`, 920, 27, { size: 18, align: 'left', color: '#ffb35c' });
      this.heroes.forEach((h, i) => {
        const x = W - 20 - (this.heroes.length - 1 - i) * 82;
        Draw.playerDot(ctx, x - 52, 27, 11, h.p);
        Draw.text(ctx, String(h.gems), x - 34, 28, { size: 18, align: 'left', color: h.down ? '#6b7280' : '#67e8f9' });
      });

      if (this.state === 'intro') Draw.banner(ctx, `Onda ${this.wave + 1}`, w.name, this.wave === 0 ? 'Desviem dos círculos vermelhos · Fiquem perto de quem caiu para reviver' : 'Todos voltaram à ativa!', '#ff9f43');
      if (this.state === 'waveClear') Draw.banner(ctx, 'Onda superada!', this.wave + 1 < WAVES.length ? 'Respirem...' : 'O céu está limpo!', null, '#5ee38b');
      if (this.state === 'over') Draw.banner(ctx, 'Todos caíram!', `Vocês chegaram até a onda ${this.wave + 1}`, null, '#ff5d73');
    }
  }

  GAMES.push({
    id: 'meteors',
    name: 'Chuva de Meteoros',
    tag: 'COOP',
    min: 1,
    max: 4,
    desc: ['Sobrevivam a 7 ondas de meteoros.', 'Revivam quem cair. Cristais = MVP.'],
    controls: 'Mover: direcional · Mouse: aponte',
    create: (ps) => new MeteorsGame(ps),
    icon(ctx, x, y, t) {
      ctx.beginPath();
      ctx.arc(x + 10, y + 20, 34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,70,70,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const k = (t * 0.8) % 1;
      ctx.beginPath();
      ctx.arc(x + 10 + (1 - k) * 30, y + 20 - (1 - k) * 60, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb35c';
      ctx.fill();
      Draw.playerDot(ctx, x - 34, y - 30, 10, { color: PLAYER_COLORS[2], slot: 2 });
    },
  });
})();
