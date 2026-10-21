'use strict';

// Masmorra Cooperativa: peguem todas as gemas e levem todo mundo até a saída.
// Legenda dos mapas:
//   #  parede          .  chão           S  início         E  saída
//   *  gema            x  espinhos (sobem e descem)
//   a b c  placa de pressão   ->   A B C  porta da mesma letra (aberta enquanto alguém pisa na placa)
//   H  patrulha horizontal    V  patrulha vertical
(() => {
  const CH_COLORS = { a: '#c084fc', b: '#fb923c', c: '#2dd4bf' };
  const SPIKE_PERIOD = 2.6, SPIKE_UP = 1.5, SPIKE_WARN = 1.1;

  const LEVELS = [
    {
      name: 'Primeiros Passos',
      tip: 'Peguem todas as gemas e fiquem TODOS na saída verde',
      map: [
        '################################',
        '#SS............................#',
        '#SS.....*..........*...........#',
        '#..............................#',
        '#.....######.........######....#',
        '#.....#....#....*....#....#....#',
        '#.....#.*..#.........#..*.#....#',
        '#.....#....#.........#....#....#',
        '#.....##.###.........###.##....#',
        '#..............................#',
        '#...*..........H...........*...#',
        '#..............................#',
        '#.........*..........*.....EEE.#',
        '#..........................EEE.#',
        '################################',
      ],
    },
    {
      name: 'Placas de Pressão',
      tip: 'Pisem nas placas para abrir as portas da mesma cor',
      map: [
        '################################',
        '#SS.......#..........#.........#',
        '#SS.......#....*.....#....*....#',
        '#.........#..........#.........#',
        '#.........A..........B......EEE#',
        '#....a....A....a.....B..b...EEE#',
        '#.........A......b...B.........#',
        '#..*......#..........#.........#',
        '#.........#.....*....#....*....#',
        '#.........#..........#.........#',
        '################################',
      ],
    },
    {
      name: 'Patrulha e Espinhos',
      tip: 'Os espinhos piscam antes de subir. Fujam das patrulhas!',
      map: [
        '################################',
        '#SS....#.......................#',
        '#SS....#...*.....xxxx.....*....#',
        '#......#.........xxxx..........#',
        '#......#....V..........V.......#',
        '#..*...#.......................#',
        '#......####.......######...#####',
        '#..............................#',
        '#....H.........................#',
        '#..............*..........xx...#',
        '#######...xxxxxxxxxxxxxx...xx..#',
        '#...*.....xxxxxxxxxxxxxx.......#',
        '#.........xxxx*xxxxxxxxx.....EE#',
        '#............................EE#',
        '################################',
      ],
    },
    {
      name: 'Trabalho em Equipe',
      tip: 'Um segura a porta, o outro abre caminho',
      map: [
        '################################',
        '#SS......#.........#.....*.....#',
        '#SS..a...A....H....#...........#',
        '#........A.........B...V.......#',
        '#..*.....#....b....B.......EE..#',
        '#........#.........#....a..EE..#',
        '####.#####...*.....#####A#######',
        '#...........xxxx...............#',
        '#..H.....*..xxxx.......b...*...#',
        '#...........xxxx...............#',
        '################################',
      ],
    },
    {
      name: 'O Grande Desafio',
      tip: 'Tudo junto: placas, espinhos e patrulhas',
      map: [
        '################################',
        '#SS...#........xx.......#......#',
        '#SS...#...*....xx...*...#..*...#',
        '#.....#........xx.......#......#',
        '#..a..A....V...xx.......C......#',
        '#.....#........xx...H...C...c..#',
        '###.###........xx.......#......#',
        '#..............xx.......###B####',
        '#...*....b.....xx..............#',
        '#..............xx.....V........#',
        '#######################.########',
        '#..*.....H.............b.....EE#',
        '#............................EE#',
        '#...xxxx......*.......xxxx.....#',
        '################################',
      ],
    },
  ];

  class DungeonGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.totalTime = 0;
      this.falls = 0;
      this.fx = new Particles();
      this.load(0);
    }

    load(i) {
      this.level = i;
      const rows = LEVELS[i].map;
      const R = rows.length, C = Math.max(...rows.map((r) => r.length));
      const ts = Math.floor(Math.min(W / C, (H - 64) / R));
      Object.assign(this, { R, C, ts, ox: Math.floor((W - C * ts) / 2), oy: 58 + Math.floor((H - 58 - R * ts) / 2) });

      this.base = [];
      this.gems = [];
      this.plates = [];
      this.doors = [];
      this.doorAt = {};
      this.enemies = [];
      const spawns = [];
      for (let r = 0; r < R; r++) {
        const row = [];
        for (let c = 0; c < C; c++) {
          const ch = rows[r][c] || '#';
          let b = '.';
          if (ch === '#') b = '#';
          else if (ch === 'x' || ch === 'E') b = ch;
          else if (ch === 'S') spawns.push({ c, r });
          else if (ch === '*') this.gems.push({ c, r, taken: false });
          else if ('abc'.includes(ch)) this.plates.push({ c, r, ch, on: false });
          else if ('ABC'.includes(ch)) {
            b = 'D';
            const d = { c, r, ch: ch.toLowerCase(), open: false };
            this.doors.push(d);
            this.doorAt[c + ',' + r] = d;
          } else if (ch === 'H' || ch === 'V') {
            this.enemies.push({ x: this.cx(c), y: this.cy(r), vx: ch === 'H' ? 1 : 0, vy: ch === 'V' ? 1 : 0 });
          }
          row.push(b);
        }
        this.base.push(row);
      }

      this.heroes = this.players.map((p, k) => {
        const s = spawns[k % spawns.length];
        return { p, x: this.cx(s.c), y: this.cy(s.r), inv: 0 };
      });
      this.active = { a: false, b: false, c: false };
      this.lives = 5;
      this.t = 0;
      this.shake = 0;
      this.state = 'intro';
      this.timer = 2.8;
    }

    cx(c) { return this.ox + (c + 0.5) * this.ts; }
    cy(r) { return this.oy + (r + 0.5) * this.ts; }
    col(x) { return Math.floor((x - this.ox) / this.ts); }
    row(y) { return Math.floor((y - this.oy) / this.ts); }
    tileUnder(e) { const r = this.row(e.y), c = this.col(e.x); return (this.base[r] && this.base[r][c]) || '#'; }

    solid(c, r) {
      if (r < 0 || r >= this.R || c < 0 || c >= this.C) return true;
      const b = this.base[r][c];
      if (b === '#') return true;
      if (b === 'D') return !this.doorAt[c + ',' + r].open;
      return false;
    }

    hits(x, y, rad) {
      const c0 = this.col(x - rad), c1 = this.col(x + rad), r0 = this.row(y - rad), r1 = this.row(y + rad);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solid(c, r)) return true;
      return false;
    }

    // Movimento em passos pequenos para não atravessar paredes
    move(e, dx, dy, rad) {
      const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3) || 1;
      const sx = dx / steps, sy = dy / steps;
      let bx = false, by = false;
      for (let i = 0; i < steps; i++) {
        if (!this.hits(e.x + sx, e.y, rad)) e.x += sx; else bx = true;
        if (!this.hits(e.x, e.y + sy, rad)) e.y += sy; else by = true;
      }
      return { bx, by };
    }

    // A porta não fecha em cima de ninguém
    occupied(d) {
      const x0 = this.ox + d.c * this.ts, y0 = this.oy + d.r * this.ts, x1 = x0 + this.ts, y1 = y0 + this.ts;
      const rad = this.ts * 0.34;
      const over = (e) => e.x + rad > x0 && e.x - rad < x1 && e.y + rad > y0 && e.y - rad < y1;
      return this.heroes.some(over) || this.enemies.some(over);
    }

    hurt(h) {
      this.lives--;
      this.falls++;
      this.shake = 0.35;
      Sfx.play('hurt');
      this.fx.burst(h.x, h.y, h.p.color, 22, 220);
      // Renasce ao lado de um colega para ninguém ficar preso atrás de portas
      const mate = this.heroes.find((o) => o !== h);
      if (mate) { h.x = mate.x; h.y = mate.y; } else { const s = this.heroes.indexOf(h); h.x = this.cx(1 + s % 2); h.y = this.cy(1); }
      h.inv = 2;
      if (this.lives <= 0) { this.state = 'fail'; this.timer = 2.8; Sfx.play('lose'); }
    }

    update(dt) {
      this.fx.update(dt);
      this.shake = Math.max(0, this.shake - dt);

      if (this.state === 'intro') {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'play'; Sfx.play('go'); }
        return;
      }
      if (this.state === 'clear' || this.state === 'fail') {
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.state === 'fail') { this.load(this.level); return; }
        if (this.level + 1 < LEVELS.length) { this.load(this.level + 1); return; }
        Engine.finishGame({
          title: 'Masmorra concluída!',
          subtitle: `Todas as ${LEVELS.length} fases em ${fmtTime(this.totalTime)} com ${this.falls} queda(s)`,
          winners: this.players.slice(),
          lines: [{ text: 'Vitória da equipe: todos ganham 1 ponto!' }],
          color: '#5ee38b',
        });
        return;
      }

      this.t += dt;
      this.totalTime += dt;
      const ts = this.ts, rad = ts * 0.3, speed = ts * 4.2;

      for (const h of this.heroes) {
        h.inv = Math.max(0, h.inv - dt);
        const d = h.p.device.dir(h.x, h.y);
        this.move(h, d.x * speed * dt, d.y * speed * dt, rad);
      }

      // Placas e portas
      const active = { a: false, b: false, c: false };
      for (const pl of this.plates) {
        pl.on = this.heroes.some((h) => this.col(h.x) === pl.c && this.row(h.y) === pl.r);
        if (pl.on) active[pl.ch] = true;
      }
      for (const k of 'abc') if (active[k] !== this.active[k]) Sfx.play('door');
      this.active = active;
      for (const d of this.doors) {
        if (active[d.ch]) d.open = true;
        else if (d.open && !this.occupied(d)) d.open = false;
      }

      // Gemas
      for (const g of this.gems) {
        if (g.taken) continue;
        const gx = this.cx(g.c), gy = this.cy(g.r);
        const h = this.heroes.find((o) => Math.hypot(o.x - gx, o.y - gy) < ts * 0.55);
        if (h) { g.taken = true; Sfx.play('pickup'); this.fx.burst(gx, gy, '#fff4a8', 16, 160); }
      }

      // Inimigos
      const erad = ts * 0.32, espeed = ts * 2.8;
      for (const e of this.enemies) {
        const b = this.move(e, e.vx * espeed * dt, e.vy * espeed * dt, erad);
        if (b.bx) e.vx = -e.vx;
        if (b.by) e.vy = -e.vy;
      }

      // Dano
      const phase = this.t % SPIKE_PERIOD;
      this.spikesUp = phase >= SPIKE_UP;
      for (const h of this.heroes) {
        if (h.inv > 0 || this.state !== 'play') continue;
        if (this.spikesUp && this.tileUnder(h) === 'x') { this.hurt(h); continue; }
        if (this.enemies.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < erad + rad * 0.85)) this.hurt(h);
      }

      // Vitória da fase
      this.exitOpen = this.gems.every((g) => g.taken);
      if (this.state === 'play' && this.exitOpen && this.heroes.every((h) => this.tileUnder(h) === 'E')) {
        this.state = 'clear';
        this.timer = 2.6;
        Sfx.play('win');
      }
    }

    draw(ctx) {
      const { ts, ox, oy } = this;
      ctx.save();
      applyShake(ctx, this.shake);
      const phase = this.t % SPIKE_PERIOD;
      const warn = phase >= SPIKE_WARN && phase < SPIKE_UP;

      for (let r = 0; r < this.R; r++) {
        for (let c = 0; c < this.C; c++) {
          const x = ox + c * ts, y = oy + r * ts, b = this.base[r][c];
          if (b === '#') {
            ctx.fillStyle = '#2c3254';
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = '#3a4170';
            ctx.fillRect(x, y, ts, 5);
            continue;
          }
          ctx.fillStyle = (r + c) % 2 ? '#141930' : '#171c35';
          ctx.fillRect(x, y, ts, ts);
          if (b === 'E') {
            const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
            ctx.fillStyle = this.exitOpen ? `rgba(46,204,113,${0.45 + pulse * 0.35})` : 'rgba(46,204,113,0.15)';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
          } else if (b === 'x') {
            this.drawSpikes(ctx, x, y, ts, this.spikesUp, warn);
          } else if (b === 'D') {
            const d = this.doorAt[c + ',' + r], col = CH_COLORS[d.ch];
            if (d.open) {
              ctx.strokeStyle = col;
              ctx.globalAlpha = 0.5;
              ctx.lineWidth = 2;
              ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
              ctx.globalAlpha = 1;
            } else {
              ctx.fillStyle = col;
              ctx.fillRect(x + 2, y, ts - 4, ts);
              ctx.fillStyle = 'rgba(0,0,0,0.25)';
              for (let k = 0; k < 3; k++) ctx.fillRect(x + 2, y + 6 + k * (ts / 3), ts - 4, 4);
            }
          }
        }
      }

      for (const pl of this.plates) {
        const x = ox + pl.c * ts, y = oy + pl.r * ts, inset = pl.on ? ts * 0.22 : ts * 0.14;
        ctx.fillStyle = CH_COLORS[pl.ch];
        ctx.globalAlpha = pl.on ? 1 : 0.65;
        Draw.roundRect(ctx, x + inset, y + inset, ts - inset * 2, ts - inset * 2, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const g of this.gems) {
        if (g.taken) continue;
        const x = this.cx(g.c), y = this.cy(g.r) + Math.sin(this.t * 3 + g.c) * 3, s = ts * 0.24;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(this.t * 2 + g.r) * 0.3);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.75, 0);
        ctx.closePath();
        ctx.fillStyle = '#fff4a8';
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }

      const erad = ts * 0.32;
      for (const e of this.enemies) {
        ctx.beginPath();
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2 + this.t * 3, rr = k % 2 ? erad : erad * 1.25;
          ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fillStyle = '#6b7280';
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - erad * 0.45, e.y - erad * 0.25, erad * 0.3, erad * 0.3);
        ctx.fillRect(e.x + erad * 0.15, e.y - erad * 0.25, erad * 0.3, erad * 0.3);
      }

      for (const h of this.heroes) {
        if (h.inv > 0 && Math.floor(h.inv * 10) % 2) continue;
        Draw.playerDot(ctx, h.x, h.y, ts * 0.3, h.p);
      }

      this.fx.draw(ctx);
      ctx.restore();
      this.drawHud(ctx);

      const L = LEVELS[this.level];
      if (this.state === 'intro') Draw.banner(ctx, `Fase ${this.level + 1}`, L.name, L.tip, '#8ea2ff');
      if (this.state === 'clear') Draw.banner(ctx, 'Fase concluída!', this.level + 1 < LEVELS.length ? 'Preparem-se para a próxima...' : 'Vocês venceram a masmorra!', null, '#5ee38b');
      if (this.state === 'fail') Draw.banner(ctx, 'Acabaram as vidas', 'Tentando a fase de novo...', null, '#ff5d73');
    }

    drawSpikes(ctx, x, y, ts, up, warn) {
      const n = 3, w = ts / n;
      if (up) {
        ctx.fillStyle = '#e5e7eb';
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const bx = x + i * w, by = y + j * w;
          ctx.beginPath();
          ctx.moveTo(bx + 2, by + w - 2); ctx.lineTo(bx + w / 2, by + 2); ctx.lineTo(bx + w - 2, by + w - 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = warn && Math.floor(this.t * 12) % 2 ? '#f87171' : '#4b5563';
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) ctx.fillRect(x + i * w + w / 2 - 2, y + j * w + w / 2 - 2, 4, 4);
      }
    }

    drawHud(ctx) {
      Draw.hudBar(ctx);
      Draw.text(ctx, `MASMORRA  ·  Fase ${this.level + 1}/${LEVELS.length}: ${LEVELS[this.level].name}`, 20, 27, { size: 20, align: 'left' });
      const got = this.gems.filter((g) => g.taken).length;
      Draw.text(ctx, `Gemas ${got}/${this.gems.length}`, 760, 27, { size: 20, color: got === this.gems.length ? '#5ee38b' : '#fff4a8' });
      for (let i = 0; i < 5; i++) this.drawHeart(ctx, 900 + i * 30, 27, i < this.lives);
      Draw.text(ctx, fmtTime(this.totalTime), W - 20, 27, { size: 20, align: 'right', color: '#a9b1d6' });
    }

    drawHeart(ctx, x, y, full) {
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.bezierCurveTo(x - 14, y - 2, x - 8, y - 12, x, y - 4);
      ctx.bezierCurveTo(x + 8, y - 12, x + 14, y - 2, x, y + 8);
      ctx.fillStyle = full ? '#ff5d73' : '#2c3254';
      ctx.fill();
    }
  }

  GAMES.push({
    id: 'dungeon',
    name: 'Masmorra Coop',
    tag: 'COOP',
    min: 2,
    max: 4,
    desc: ['Gemas, placas, portas e armadilhas.', 'Um segura a porta pro outro. 5 fases.'],
    controls: 'Mover: direcional · Mouse: aponte',
    create: (ps) => new DungeonGame(ps),
    icon(ctx, x, y, t) {
      const s = 22;
      for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#141930' : '#1c2240';
        ctx.fillRect(x + i * s, y + j * s, s, s);
      }
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(x + s * 0.2, y - s * 2, s * 0.6, s * 2);
      ctx.fillStyle = '#fff4a8';
      ctx.beginPath();
      const gy = y + 18 + Math.sin(t * 3) * 3;
      ctx.moveTo(x - 20, gy - 12); ctx.lineTo(x - 11, gy); ctx.lineTo(x - 20, gy + 12); ctx.lineTo(x - 29, gy);
      ctx.fill();
      Draw.playerDot(ctx, x - 22, y - 22, 10, { color: PLAYER_COLORS[0], slot: 0 });
      Draw.playerDot(ctx, x + 22, y + 22, 10, { color: PLAYER_COLORS[1], slot: 1 });
    },
  });
})();
