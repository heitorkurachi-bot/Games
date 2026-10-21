'use strict';

// Batalha de Tanques: todos contra todos. Cada rodada acontece numa arena
// diferente. Quem vencer 3 rodadas leva a partida.
// Legenda: # parede  c caixote (quebra)  1-4 início dos jogadores
(() => {
  const ROUNDS_TO_WIN = 3;
  const TR = 15, SPEED = 165, BULLET_SPEED = 430, MAX_HP = 3;
  const POWERS = {
    speed: { label: 'V', color: '#38bdf8', name: 'Velocidade' },
    triple: { label: '3', color: '#f472b6', name: 'Tiro triplo' },
    shield: { label: 'E', color: '#a3e635', name: 'Escudo' },
    heal: { label: '+', color: '#f87171', name: 'Vida' },
  };

  const ARENAS = [
    {
      name: 'Campo Aberto',
      map: [
        '################################',
        '#1............................2#',
        '#..............................#',
        '#....##..................##....#',
        '#....##.......cc.........##....#',
        '#.............cc...............#',
        '#..............................#',
        '#.......cc............cc.......#',
        '#.......cc............cc.......#',
        '#..............................#',
        '#.............cc...............#',
        '#....##.......cc.........##....#',
        '#....##..................##....#',
        '#..............................#',
        '#3............................4#',
        '################################',
      ],
    },
    {
      name: 'Labirinto',
      map: [
        '################################',
        '#1.....#..............#.......2#',
        '#......#..............#........#',
        '#..##..#...cccccc.....#..##....#',
        '#..##..........................#',
        '#..........######.........##...#',
        '#####......#....#..........#####',
        '#.....cc...#....#...cc.........#',
        '#.....cc...#....#...cc.........#',
        '#####......#....#..........#####',
        '#..........##..##..............#',
        '#..##..........................#',
        '#..##..#.....cccccc..#..##.....#',
        '#......#.............#.........#',
        '#3.....#.............#.......4.#',
        '################################',
      ],
    },
    {
      name: 'Depósito de Caixotes',
      map: [
        '################################',
        '#1.....c.......c.......c......2#',
        '#......c.......c.......c.......#',
        '#ccc...c...ccc...ccc...c...ccc.#',
        '#..............................#',
        '#...cc.....cc.......cc....cc...#',
        '#...cc.....cc..##...cc....cc...#',
        '#..............##..............#',
        '#..............##..............#',
        '#...cc.....cc..##...cc....cc...#',
        '#...cc.....cc.......cc....cc...#',
        '#..............................#',
        '#.ccc...c...ccc...ccc...c...ccc#',
        '#.......c.......c.......c......#',
        '#3......c.......c.......c.....4#',
        '################################',
      ],
    },
    {
      name: 'Corredores',
      map: [
        '################################',
        '#1............................2#',
        '#.############....############.#',
        '#..............................#',
        '#.....#....................#...#',
        '#.....#....cccc....cccc....#...#',
        '#.....#....................#...#',
        '#.....######.....##.....####...#',
        '#.....######.....##.....####...#',
        '#.....#....................#...#',
        '#.....#....cccc....cccc....#...#',
        '#.....#....................#...#',
        '#..............................#',
        '#.############....############.#',
        '#3............................4#',
        '################################',
      ],
    },
  ];

  class TanksGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.wins = new Map(players.map((p) => [p, 0]));
      this.round = 0;
      this.fx = new Particles();
      this.startRound();
    }

    startRound() {
      const A = ARENAS[this.round % ARENAS.length];
      const rows = A.map, R = rows.length, C = Math.max(...rows.map((r) => r.length));
      const ts = Math.floor(Math.min(W / C, (H - 60) / R));
      Object.assign(this, { R, C, ts, ox: Math.floor((W - C * ts) / 2), oy: 56 + Math.floor((H - 56 - R * ts) / 2) });
      this.grid = [];
      this.crateHp = {};
      const spawns = {};
      for (let r = 0; r < R; r++) {
        const row = [];
        for (let c = 0; c < C; c++) {
          const ch = rows[r][c] || '#';
          if (ch === '#') row.push('#');
          else if (ch === 'c') { row.push('c'); this.crateHp[c + ',' + r] = 2; }
          else { row.push('.'); if ('1234'.includes(ch)) spawns[ch] = { c, r }; }
        }
        this.grid.push(row);
      }
      this.tanks = this.players.map((p, i) => {
        const s = spawns[String(i + 1)];
        const x = this.ox + (s.c + 0.5) * ts, y = this.oy + (s.r + 0.5) * ts;
        return { p, x, y, ang: Math.atan2(H / 2 - y, W / 2 - x), hp: MAX_HP, alive: true, cd: 0, pow: null, powT: 0 };
      });
      this.bullets = [];
      this.pickups = [];
      this.pickupT = 5;
      this.shake = 0;
      this.state = 'countdown';
      this.timer = 3;
      this.roundWinner = null;
      Sfx.play('tick');
    }

    col(x) { return Math.floor((x - this.ox) / this.ts); }
    row(y) { return Math.floor((y - this.oy) / this.ts); }
    solid(c, r) {
      if (r < 0 || r >= this.R || c < 0 || c >= this.C) return true;
      return this.grid[r][c] !== '.';
    }
    hits(x, y, rad) {
      const c0 = this.col(x - rad), c1 = this.col(x + rad), r0 = this.row(y - rad), r1 = this.row(y + rad);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solid(c, r)) return true;
      return false;
    }
    move(e, dx, dy) {
      const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3) || 1;
      for (let i = 0; i < steps; i++) {
        if (!this.hits(e.x + dx / steps, e.y, TR)) e.x += dx / steps;
        if (!this.hits(e.x, e.y + dy / steps, TR)) e.y += dy / steps;
      }
    }

    shoot(t) {
      const mine = this.bullets.filter((b) => b.owner === t).length;
      if (mine >= 5) return;
      const angles = t.pow === 'triple' ? [-0.22, 0, 0.22] : [0];
      let fired = false;
      for (const da of angles) {
        const a = t.ang + da, x = t.x + Math.cos(a) * 22, y = t.y + Math.sin(a) * 22;
        if (this.solid(this.col(x), this.row(y))) continue;
        this.bullets.push({ x, y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, owner: t, bounces: 1, age: 0 });
        fired = true;
      }
      if (fired) { t.cd = 0.42; Sfx.play('shoot'); }
    }

    damage(t) {
      if (t.pow === 'shield') {
        t.pow = null;
        Sfx.play('door');
        this.fx.burst(t.x, t.y, POWERS.shield.color, 16, 180);
        return;
      }
      t.hp--;
      this.shake = Math.max(this.shake, 0.2);
      this.fx.burst(t.x, t.y, t.p.color, 10, 160);
      Sfx.play('hit');
      if (t.hp <= 0) {
        t.alive = false;
        this.shake = 0.45;
        this.fx.burst(t.x, t.y, '#ff9f43', 40, 300, 0.9, 6);
        this.fx.burst(t.x, t.y, t.p.color, 24, 220, 0.8, 5);
        Sfx.play('explode');
      }
    }

    updateBullets(dt) {
      for (const b of this.bullets) {
        b.age += dt;
        const steps = Math.ceil((BULLET_SPEED * dt) / 4);
        for (let i = 0; i < steps && !b.dead; i++) {
          const nx = b.x + (b.vx * dt) / steps, ny = b.y + (b.vy * dt) / steps;
          const c = this.col(nx), r = this.row(ny);
          if (this.solid(c, r)) {
            if (this.grid[r] && this.grid[r][c] === 'c') {
              const key = c + ',' + r;
              this.crateHp[key]--;
              this.fx.burst(nx, ny, '#c08a4a', 8, 120);
              if (this.crateHp[key] <= 0) {
                this.grid[r][c] = '.';
                this.fx.burst(this.ox + (c + 0.5) * this.ts, this.oy + (r + 0.5) * this.ts, '#c08a4a', 18, 180);
                Sfx.play('hit');
              }
              b.dead = true;
              break;
            }
            const hx = this.solid(this.col(nx), this.row(b.y)), hy = this.solid(this.col(b.x), this.row(ny));
            if (hx || !hy) b.vx = -b.vx;
            if (hy || !hx) b.vy = -b.vy;
            b.bounces--;
            if (b.bounces < 0) { b.dead = true; this.fx.burst(b.x, b.y, '#ffffff', 5, 80, 0.3, 3); }
            break;
          }
          b.x = nx;
          b.y = ny;
          for (const t of this.tanks) {
            if (!t.alive) continue;
            if (t === b.owner && b.bounces === 1) continue; // o próprio tiro só acerta depois de ricochetear
            if (Math.hypot(t.x - b.x, t.y - b.y) < TR + 4) { b.dead = true; this.damage(t); break; }
          }
        }
        if (b.age > 4) b.dead = true;
      }
      this.bullets = this.bullets.filter((b) => !b.dead);
    }

    spawnPickup() {
      const alive = this.tanks.filter((t) => t.alive);
      for (let tries = 0; tries < 40; tries++) {
        const c = 1 + Math.floor(Math.random() * (this.C - 2)), r = 1 + Math.floor(Math.random() * (this.R - 2));
        if (this.grid[r][c] !== '.') continue;
        const x = this.ox + (c + 0.5) * this.ts, y = this.oy + (r + 0.5) * this.ts;
        if (alive.some((t) => Math.hypot(t.x - x, t.y - y) < 120)) continue;
        const keys = Object.keys(POWERS);
        this.pickups.push({ x, y, type: keys[Math.floor(Math.random() * keys.length)], t: 0 });
        return;
      }
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, this.shake - dt);

      if (this.state === 'countdown') {
        if (countdownTick(this, dt)) this.state = 'play';
        return;
      }

      // Tanques
      const tanks = this.tanks.filter((t) => t.alive);
      for (const t of tanks) {
        const d = t.p.device.dir(t.x, t.y);
        const mag = Math.hypot(d.x, d.y);
        const spd = SPEED * (t.pow === 'speed' ? 1.55 : 1);
        if (mag > 0.15) {
          t.ang = Math.atan2(d.y, d.x);
          this.move(t, d.x * spd * dt, d.y * spd * dt);
        }
        t.cd -= dt;
        if (t.p.device.held('a') && t.cd <= 0) this.shoot(t);
        if (t.pow) { t.powT -= dt; if (t.powT <= 0) t.pow = null; }
      }
      // Tanques se empurram
      for (let i = 0; i < tanks.length; i++) for (let j = i + 1; j < tanks.length; j++) {
        const a = tanks[i], b = tanks[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        if (d < TR * 2) {
          const push = (TR * 2 - d) / 2;
          this.move(a, (-dx / d) * push, (-dy / d) * push);
          this.move(b, (dx / d) * push, (dy / d) * push);
        }
      }

      this.updateBullets(dt);

      // Itens
      this.pickupT -= dt;
      if (this.pickupT <= 0 && this.pickups.length < 3) { this.pickupT = rand(5, 8); this.spawnPickup(); }
      for (const pk of this.pickups) {
        pk.t += dt;
        const t = tanks.find((o) => Math.hypot(o.x - pk.x, o.y - pk.y) < TR + 14);
        if (!t) continue;
        pk.taken = true;
        Sfx.play('pickup');
        this.fx.burst(pk.x, pk.y, POWERS[pk.type].color, 14, 150);
        if (pk.type === 'heal') t.hp = Math.min(MAX_HP, t.hp + 1);
        else { t.pow = pk.type; t.powT = pk.type === 'shield' ? 12 : 8; }
      }
      this.pickups = this.pickups.filter((p) => !p.taken);

      // Fim da rodada
      if (this.state === 'play' && tanks.length <= 1) {
        this.state = 'ending';
        this.timer = 2.2;
        this.roundWinner = tanks[0] ? tanks[0].p : null;
        if (this.roundWinner) this.wins.set(this.roundWinner, this.wins.get(this.roundWinner) + 1);
        Sfx.play('win');
      } else if (this.state === 'ending') {
        this.timer -= dt;
        if (this.timer > 0) return;
        const champ = this.players.find((p) => this.wins.get(p) >= ROUNDS_TO_WIN);
        if (champ) {
          const ranked = this.players.slice().sort((a, b) => this.wins.get(b) - this.wins.get(a));
          Engine.finishGame({
            title: `${champ.name} venceu!`,
            subtitle: `Primeiro a vencer ${ROUNDS_TO_WIN} rodadas na Batalha de Tanques`,
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
      const { ts, ox, oy } = this;
      ctx.save();
      applyShake(ctx, this.shake);
      for (let r = 0; r < this.R; r++) {
        for (let c = 0; c < this.C; c++) {
          const x = ox + c * ts, y = oy + r * ts, b = this.grid[r][c];
          ctx.fillStyle = (r + c) % 2 ? '#1b2a22' : '#1e2f26';
          ctx.fillRect(x, y, ts, ts);
          if (b === '#') {
            ctx.fillStyle = '#3d4a5c';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#4f5f75';
            ctx.fillRect(x, y, ts, 5);
          } else if (b === 'c') {
            const hp = this.crateHp[c + ',' + r];
            ctx.fillStyle = hp > 1 ? '#a8733a' : '#7d5428';
            ctx.fillRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.strokeStyle = '#5a3a18';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.beginPath();
            ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + ts - 6, y + ts - 6);
            ctx.moveTo(x + ts - 6, y + 6); ctx.lineTo(x + 6, y + ts - 6);
            ctx.stroke();
          }
        }
      }

      for (const pk of this.pickups) {
        const P = POWERS[pk.type], bob = Math.sin(pk.t * 4) * 3;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y + bob, 13, 0, Math.PI * 2);
        ctx.fillStyle = P.color;
        ctx.shadowColor = P.color;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
        Draw.text(ctx, P.label, pk.x, pk.y + bob + 1, { size: 16, weight: 900, color: '#10131f' });
      }

      for (const t of this.tanks) if (t.alive) this.drawTank(ctx, t);

      for (const b of this.bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = b.owner.p.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      this.fx.draw(ctx);
      ctx.restore();

      // HUD
      Draw.hudBar(ctx);
      const A = ARENAS[this.round % ARENAS.length];
      Draw.text(ctx, `TANQUES  ·  Rodada ${this.round + 1}  ·  Arena: ${A.name}`, 20, 27, { size: 20, align: 'left' });
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
        Draw.text(ctx, `Arena ${(this.round % ARENAS.length) + 1}: ${A.name}`, W / 2, H / 2 - 110, { size: 34, weight: 800, shadow: '#000' });
        Draw.countdown(ctx, this.timer);
        if (this.round === 0) Draw.text(ctx, 'AÇÃO: atirar  ·  Tiros ricocheteiam uma vez  ·  Pegue os itens!', W / 2, H / 2 + 110, { size: 22, color: '#dfe3f5', shadow: '#000' });
      }
      if (this.state === 'ending') {
        const w = this.roundWinner;
        Draw.banner(ctx, w ? `${w.name} vence a rodada!` : 'Empate!', w ? `${this.wins.get(w)}/${ROUNDS_TO_WIN} vitórias` : 'Ninguém sobreviveu', null, w ? w.color : '#fff');
      }
    }

    drawTank(ctx, t) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.pow === 'shield') {
        ctx.beginPath();
        ctx.arc(0, 0, TR + 9, 0, Math.PI * 2);
        ctx.strokeStyle = POWERS.shield.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(Engine.time * 8);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.rotate(t.ang);
      ctx.fillStyle = '#1f2433';
      ctx.fillRect(-17, -15, 34, 7);
      ctx.fillRect(-17, 8, 34, 7);
      Draw.roundRect(ctx, -14, -11, 28, 22, 5);
      ctx.fillStyle = t.p.color;
      ctx.fill();
      ctx.fillStyle = '#1f2433';
      ctx.fillRect(4, -3.5, 20, 7);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      ctx.restore();
      // vida
      for (let k = 0; k < MAX_HP; k++) {
        ctx.fillStyle = k < t.hp ? t.p.color : 'rgba(255,255,255,0.15)';
        ctx.fillRect(t.x - 16 + k * 11, t.y - 30, 9, 4);
      }
      if (t.pow && t.pow !== 'shield') Draw.text(ctx, POWERS[t.pow].label, t.x + 24, t.y - 28, { size: 13, weight: 900, color: POWERS[t.pow].color });
    }
  }

  GAMES.push({
    id: 'tanks',
    name: 'Batalha de Tanques',
    tag: 'VERSUS',
    min: 2,
    max: 4,
    desc: ['Todos contra todos em 4 arenas.', 'Ricochetes, caixotes e itens. Faça 3.'],
    controls: 'Mover: direcional · Atirar: AÇÃO',
    create: (ps) => new TanksGame(ps),
    icon(ctx, x, y, t) {
      ctx.save();
      ctx.translate(x - 8, y + 6);
      ctx.rotate(-0.4 + Math.sin(t * 1.5) * 0.2);
      ctx.scale(1.6, 1.6);
      ctx.fillStyle = '#1f2433';
      ctx.fillRect(-17, -15, 34, 7);
      ctx.fillRect(-17, 8, 34, 7);
      Draw.roundRect(ctx, -14, -11, 28, 22, 5);
      ctx.fillStyle = PLAYER_COLORS[1];
      ctx.fill();
      ctx.fillStyle = '#1f2433';
      ctx.fillRect(4, -3.5, 22, 7);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + 44, y - 34, 6, 0, Math.PI * 2);
      ctx.fillStyle = PLAYER_COLORS[1];
      ctx.fill();
    },
  });
})();
