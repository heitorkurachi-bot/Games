'use strict';

// Escalada Coop: plataforma com pulo. Dá para subir na cabeça dos colegas
// para alcançar lugares altos (torre humana). Todos precisam chegar à saída.
// Legenda dos mapas:
//   #  bloco          .  vazio          S  início          E  saída
//   -  plataforma fina (atravessa por baixo; segure para baixo para descer)
//   ^  mola (lança quem passar por cima)   x  espinhos   *  gema (opcional)
//   a b  placa de pressão   ->   A B  porta da mesma letra
(() => {
  const CH_COLORS = { a: '#c084fc', b: '#fb923c' };
  // Valores para um bloco de 40px (são escalados pelo tamanho real do bloco).
  // Pulo sozinho ~108px (2,7 blocos); em cima de um colega ~138px (3,4 blocos).
  const RUN = 250, GRAVITY = 1900, JUMP = 640, SPRING = 1250, MAX_FALL = 950;

  const LEVELS = [
    {
      name: 'Primeiros Saltos',
      tip: 'AÇÃO pula. Levem TODOS até a saída verde',
      map: [
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#.................*............#',
        '#...............#####..........#',
        '#..........*...................#',
        '#.........####.............EEE.#',
        '#.....................##########',
        '#SS.....###....................#',
        '#SS............................#',
        '#......#####...xxx.............#',
        '################################',
      ],
    },
    {
      name: 'Torre Humana',
      tip: 'Alto demais? Suba na cabeça de um colega!',
      map: [
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#................*.............#',
        '#...............a..............#',
        '#.........#########............#',
        '#SS.......A....................#',
        '#SS.......A..*...........EEEE..#',
        '################################',
      ],
    },
    {
      name: 'Molas e Espinhos',
      tip: 'Pulem nas molas amarelas para ir bem alto',
      map: [
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#.............*................#',
        '#..............................#',
        '#.......------------...........#',
        '#.........................EEE..#',
        '#.......................########',
        '#SS.....................########',
        '#SS.....................########',
        '#......^.....xxxxx...#.^########',
        '################################',
      ],
    },
    {
      name: 'Portas em Cadeia',
      tip: 'Placas seguram as portas. Uma torre humana alcança a placa alta',
      map: [
        '################################',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#..........#.........#',
        '#.........#.....*....#.........#',
        '#.........A......b...B.........#',
        '#...*.....A....####..B.....*...#',
        '#SS.......A..........B.........#',
        '#SS..a....A.a........B..b.EEEE.#',
        '################################',
      ],
    },
    {
      name: 'O Topo',
      tip: 'Torre humana, placas e molas trancadas. Lá em cima é a saída!',
      map: [
        '################################',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#.........................EEE.b#',
        '#........................#######',
        '#.....................B..#######',
        '#.................a*.B^B.#######',
        '#................--------......#',
        '#..............................#',
        '#..............................#',
        '#..............................#',
        '#...........a.*................#',
        '#.........######...............#',
        '#SS..*..............A..........#',
        '#SS....xxx.........A^A.........#',
        '################################',
      ],
    },
  ];

  class PlatformGame {
    constructor(players) {
      this.pausable = true;
      this.players = players;
      this.totalTime = 0;
      this.falls = 0;
      this.gemsTotal = 0;
      this.fx = new Particles();
      this.load(0);
    }

    load(i) {
      this.level = i;
      const rows = LEVELS[i].map;
      const R = rows.length, C = Math.max(...rows.map((r) => r.length));
      const ts = Math.floor(Math.min(W / C, (H - 60) / R));
      Object.assign(this, { R, C, ts, s: ts / 40, ox: Math.floor((W - C * ts) / 2), oy: 56 + Math.floor((H - 56 - R * ts) / 2) });

      this.base = [];
      this.gems = [];
      this.plates = [];
      this.doors = [];
      this.doorAt = {};
      const spawns = [];
      for (let r = 0; r < R; r++) {
        const row = [];
        for (let c = 0; c < C; c++) {
          const ch = rows[r][c] || '#';
          let b = '.';
          if ('#-^xE'.includes(ch)) b = ch;
          else if (ch === 'S') spawns.push({ c, r });
          else if (ch === '*') this.gems.push({ c, r, taken: false });
          else if (ch === 'a' || ch === 'b') this.plates.push({ c, r, ch, on: false });
          else if (ch === 'A' || ch === 'B') {
            b = 'D';
            const d = { c, r, ch: ch.toLowerCase(), open: false };
            this.doors.push(d);
            this.doorAt[c + ',' + r] = d;
          }
          row.push(b);
        }
        this.base.push(row);
      }

      const s = this.s, w = 24 * s, h = 30 * s;
      this.heroes = this.players.map((p, k) => {
        const sp = spawns[k % spawns.length];
        const x = ts * sp.c + this.ox + (ts - w) / 2, y = this.oy + (sp.r + 1) * ts - h;
        return { p, x, y, w, h, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, face: 1, on: null, dxFrame: 0, spring: false, inv: 0, safe: { x, y } };
      });
      this.active = { a: false, b: false };
      this.t = 0;
      this.state = 'intro';
      this.timer = 2.8;
    }

    // ---------------------------------------------------------- mapa
    col(x) { return Math.floor((x - this.ox) / this.ts); }
    row(y) { return Math.floor((y - this.oy) / this.ts); }
    tile(c, r) {
      if (c < 0 || c >= this.C || r < 0) return '#';
      if (r >= this.R) return '.';
      return this.base[r][c];
    }
    solid(c, r) {
      const b = this.tile(c, r);
      if (b === '#') return true;
      if (b === 'D') return !this.doorAt[c + ',' + r].open;
      return false;
    }
    boxSolid(x, y, w, h) {
      for (let r = this.row(y); r <= this.row(y + h - 0.01); r++) {
        for (let c = this.col(x); c <= this.col(x + w - 0.01); c++) if (this.solid(c, r)) return true;
      }
      return false;
    }
    boxHas(x, y, w, h, ch) {
      for (let r = this.row(y); r <= this.row(y + h - 0.01); r++) {
        for (let c = this.col(x); c <= this.col(x + w - 0.01); c++) if (this.tile(c, r) === ch) return true;
      }
      return false;
    }
    cols(h) { const a = []; for (let c = this.col(h.x); c <= this.col(h.x + h.w - 0.01); c++) a.push(c); return a; }

    // ---------------------------------------------------------- movimento
    moveX(h, dx) {
      const x0 = h.x, steps = Math.ceil(Math.abs(dx) / 4);
      for (let i = 0; i < steps; i++) {
        const nx = h.x + dx / steps;
        if (this.boxSolid(nx, h.y, h.w, h.h)) { h.vx = 0; break; }
        h.x = nx;
      }
      h.dxFrame = h.x - x0;
    }

    moveY(h, dy, drop) {
      h.grounded = false;
      h.on = null;
      const steps = Math.max(1, Math.ceil(Math.abs(dy) / 4));
      for (let i = 0; i < steps; i++) {
        const ny = h.y + dy / steps;
        if (dy < 0) {
          if (this.boxSolid(h.x, ny, h.w, h.h)) {
            // Correção de quina: se a cabeça só raspou na borda, desliza para o lado
            const shift = this.cornerShift(h, ny);
            if (shift === null) { h.y = this.oy + (this.row(ny) + 1) * this.ts; h.vy = 0; return; }
            h.x += shift;
          }
          h.y = ny;
          continue;
        }
        const oldBottom = h.y + h.h, newBottom = ny + h.h;
        const rB = this.row(newBottom - 0.01), top = this.oy + rB * this.ts;
        let land = null;
        if (this.boxSolid(h.x, ny, h.w, h.h)) land = top;
        else if (!drop && oldBottom <= top + 0.01 && this.cols(h).some((c) => this.tile(c, rB) === '-')) land = top;
        if (land === null) {
          // cabeça de um colega funciona como plataforma
          for (const o of this.heroes) {
            if (o === h || o.dead) continue;
            if (h.x < o.x + o.w && h.x + h.w > o.x && oldBottom <= o.y + 0.01 && newBottom >= o.y) { land = o.y; h.on = o; break; }
          }
        }
        if (land !== null) {
          h.y = land - h.h;
          h.vy = 0;
          h.grounded = true;
          return;
        }
        h.y = ny;
      }
    }

    cornerShift(h, ny) {
      const max = 12 * this.s;
      for (let d = 1; d <= max; d++) {
        for (const sx of [-d, d]) if (!this.boxSolid(h.x + sx, ny, h.w, h.h) && !this.boxSolid(h.x + sx, h.y, h.w, h.h)) return sx;
      }
      return null;
    }

    hurt(h) {
      this.falls++;
      Sfx.play('hurt');
      this.fx.burst(h.x + h.w / 2, h.y + h.h / 2, h.p.color, 22, 220);
      h.x = h.safe.x;
      h.y = h.safe.y;
      h.vx = h.vy = 0;
      h.inv = 1.2;
    }

    // A porta não fecha em cima de ninguém
    occupied(d) {
      const x0 = this.ox + d.c * this.ts, y0 = this.oy + d.r * this.ts, x1 = x0 + this.ts, y1 = y0 + this.ts;
      return this.heroes.some((h) => h.x + h.w > x0 && h.x < x1 && h.y + h.h > y0 && h.y < y1);
    }

    update(dt) {
      this.fx.update(dt);
      if (this.state === 'intro') {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'play'; Sfx.play('go'); }
        return;
      }
      if (this.state === 'clear') {
        this.timer -= dt;
        if (this.timer > 0) return;
        if (this.level + 1 < LEVELS.length) { this.load(this.level + 1); return; }
        Engine.finishGame({
          title: 'Chegaram ao topo!',
          subtitle: `${LEVELS.length} fases em ${fmtTime(this.totalTime)} · ${this.falls} queda(s) · ${this.gemsTotal} gema(s)`,
          winners: this.players.slice(),
          lines: [{ text: 'Vitória da equipe: todos ganham 1 ponto!' }],
          color: '#5ee38b',
        });
        return;
      }

      this.t += dt;
      this.totalTime += dt;
      const s = this.s;

      for (const h of this.heroes) {
        const dev = h.p.device;
        h.inv = Math.max(0, h.inv - dt);
        const d = dev.dir(h.x + h.w / 2, h.y + h.h / 2);
        const mx = Math.abs(d.x) > 0.25 ? Math.sign(d.x) * Math.min(1, Math.abs(d.x) * 1.4) : 0;
        h.vx = mx * RUN * s;
        if (mx) h.face = Math.sign(mx);

        const kb = dev.kind === 'keyboard';
        const jumpPressed = dev.pressed('a') || (kb && dev.navPressed('up'));
        const jumpHeld = dev.held('a') || (kb && dev.cur.y < -0.5);
        h.buffer = jumpPressed ? 0.12 : h.buffer - dt;
        h.coyote = h.grounded ? 0.1 : h.coyote - dt;
        if (h.buffer > 0 && h.coyote > 0) {
          h.vy = -JUMP * s;
          h.buffer = 0;
          h.coyote = 0;
          h.spring = false;
          Sfx.play('jump');
        }
        if (h.vy >= 0) h.spring = false;
        if (!jumpHeld && h.vy < 0 && !h.spring) h.vy = Math.max(h.vy, -JUMP * s * 0.45); // pulo curto ao soltar
        h.vy = Math.min(MAX_FALL * s, h.vy + GRAVITY * s * dt);

        const carry = h.on ? h.on.dxFrame : 0; // quem está em cima é carregado
        this.moveX(h, h.vx * dt + carry);
        this.moveY(h, h.vy * dt, dev.cur.y > 0.5);

        // Mola: lança quem pisar nela
        if (h.grounded && this.boxHas(h.x + 2, h.y + h.h - 4 * s, h.w - 4, 4 * s, '^')) {
          h.vy = -SPRING * s;
          h.grounded = false;
          h.on = null;
          h.spring = true;
          Sfx.play('bump');
          this.fx.burst(h.x + h.w / 2, h.y + h.h, '#ffd23f', 10, 160, 0.4, 3);
        }

        // Posição segura para renascer
        const under = this.row(h.y + h.h + 1);
        if (h.grounded && !h.on && this.cols(h).every((c) => this.solid(c, under) || this.tile(c, under) === '-') && !this.boxHas(h.x, h.y, h.w, h.h, '^')) {
          h.safe = { x: h.x, y: h.y };
        }
        // Perigos
        const m = 4 * s;
        if (h.inv <= 0 && this.boxHas(h.x + m, h.y + m, h.w - 2 * m, h.h - m, 'x')) this.hurt(h);
        else if (h.y > this.oy + this.R * this.ts + 40) this.hurt(h);
      }

      // Placas e portas
      const active = { a: false, b: false };
      for (const pl of this.plates) {
        pl.on = this.heroes.some((h) => this.col(h.x + h.w / 2) === pl.c && this.row(h.y + h.h - 2) === pl.r);
        if (pl.on) active[pl.ch] = true;
      }
      for (const k of 'ab') if (active[k] !== this.active[k]) Sfx.play('door');
      this.active = active;
      for (const d of this.doors) {
        if (active[d.ch]) d.open = true;
        else if (d.open && !this.occupied(d)) d.open = false;
      }

      // Gemas
      for (const g of this.gems) {
        if (g.taken) continue;
        const gx = this.ox + (g.c + 0.5) * this.ts, gy = this.oy + (g.r + 0.5) * this.ts;
        if (this.heroes.some((h) => Math.hypot(h.x + h.w / 2 - gx, h.y + h.h / 2 - gy) < this.ts * 0.55)) {
          g.taken = true;
          this.gemsTotal++;
          Sfx.play('pickup');
          this.fx.burst(gx, gy, '#fff4a8', 16, 160);
        }
      }

      // Todos na saída
      if (this.heroes.every((h) => this.tile(this.col(h.x + h.w / 2), this.row(h.y + h.h / 2)) === 'E')) {
        this.state = 'clear';
        this.timer = 2.6;
        Sfx.play('win');
      }
    }

    // ---------------------------------------------------------- desenho
    draw(ctx) {
      const { ts, ox, oy, s } = this;
      const g = ctx.createLinearGradient(0, 56, 0, H);
      g.addColorStop(0, '#1b2350');
      g.addColorStop(1, '#0c1024');
      ctx.fillStyle = g;
      ctx.fillRect(0, 56, W, H - 56);

      for (let r = 0; r < this.R; r++) {
        for (let c = 0; c < this.C; c++) {
          const x = ox + c * ts, y = oy + r * ts, b = this.base[r][c];
          if (b === '#') {
            ctx.fillStyle = '#353a6a';
            ctx.fillRect(x, y, ts, ts);
            if (!this.solid(c, r - 1) && r > 0) { ctx.fillStyle = '#7c86e0'; ctx.fillRect(x, y, ts, 6 * s); }
          } else if (b === '-') {
            ctx.fillStyle = '#a3a8d6';
            ctx.fillRect(x, y, ts, 7 * s);
            ctx.fillStyle = '#6b70a3';
            ctx.fillRect(x, y + 7 * s, ts, 3 * s);
          } else if (b === '^') {
            ctx.fillStyle = '#4b4f7a';
            ctx.fillRect(x + 4 * s, y + ts * 0.85, ts - 8 * s, ts * 0.15);
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 3 * s;
            ctx.beginPath();
            for (let k = 0; k <= 4; k++) ctx.lineTo(x + ts * (k % 2 ? 0.75 : 0.25), y + ts * (0.85 - k * 0.09));
            ctx.stroke();
            ctx.fillStyle = '#ffd23f';
            ctx.fillRect(x + 4 * s, y + ts * 0.42, ts - 8 * s, 5 * s);
          } else if (b === 'x') {
            ctx.fillStyle = '#e5e7eb';
            const n = 3, w = ts / n;
            for (let k = 0; k < n; k++) {
              ctx.beginPath();
              ctx.moveTo(x + k * w + 2, y + ts);
              ctx.lineTo(x + k * w + w / 2, y + ts * 0.45);
              ctx.lineTo(x + (k + 1) * w - 2, y + ts);
              ctx.fill();
            }
          } else if (b === 'E') {
            const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
            ctx.fillStyle = `rgba(46,204,113,${0.25 + pulse * 0.25})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
          } else if (b === 'D') {
            const d = this.doorAt[c + ',' + r], col = CH_COLORS[d.ch];
            if (d.open) {
              ctx.strokeStyle = col;
              ctx.globalAlpha = 0.45;
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

      // Bandeira na saída
      const exits = [];
      this.base.forEach((row, r) => row.forEach((b, c) => { if (b === 'E') exits.push({ c, r }); }));
      if (exits.length) {
        const last = exits[exits.length - 1], fx = ox + (last.c + 1) * ts - 6, fy = oy + (last.r + 1) * ts;
        ctx.fillStyle = '#dfe3f5';
        ctx.fillRect(fx, fy - ts * 1.6, 3, ts * 1.6);
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.moveTo(fx, fy - ts * 1.6);
        ctx.lineTo(fx - ts * 0.7, fy - ts * 1.35 + Math.sin(this.t * 6) * 3);
        ctx.lineTo(fx, fy - ts * 1.1);
        ctx.fill();
      }

      for (const pl of this.plates) {
        const x = ox + pl.c * ts, y = oy + (pl.r + 1) * ts, ph = (pl.on ? 4 : 9) * s;
        ctx.fillStyle = CH_COLORS[pl.ch];
        ctx.fillRect(x + ts * 0.15, y - ph, ts * 0.7, ph);
      }

      for (const gm of this.gems) {
        if (gm.taken) continue;
        const x = ox + (gm.c + 0.5) * ts, y = oy + (gm.r + 0.5) * ts + Math.sin(this.t * 3 + gm.c) * 3, z = ts * 0.22;
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(0, -z); ctx.lineTo(z * 0.75, 0); ctx.lineTo(0, z); ctx.lineTo(-z * 0.75, 0);
        ctx.closePath();
        ctx.fillStyle = '#fff4a8';
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }

      for (const h of this.heroes) {
        if (h.inv > 0 && Math.floor(h.inv * 10) % 2) continue;
        Draw.roundRect(ctx, h.x, h.y, h.w, h.h, 6 * s);
        ctx.fillStyle = h.p.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.stroke();
        const ex = h.x + h.w / 2 + h.face * 4 * s;
        ctx.fillStyle = '#fff';
        ctx.fillRect(ex - 6 * s, h.y + 7 * s, 5 * s, 6 * s);
        ctx.fillRect(ex + 2 * s, h.y + 7 * s, 5 * s, 6 * s);
        ctx.fillStyle = '#10131f';
        ctx.fillRect(ex - 6 * s + (h.face > 0 ? 2 : 0) * s, h.y + 9 * s, 3 * s, 3 * s);
        ctx.fillRect(ex + 2 * s + (h.face > 0 ? 2 : 0) * s, h.y + 9 * s, 3 * s, 3 * s);
        Draw.text(ctx, String(h.p.slot + 1), h.x + h.w / 2, h.y + h.h - 8 * s, { size: 11 * s + 2, weight: 900, color: '#10131f' });
      }

      this.fx.draw(ctx);

      Draw.hudBar(ctx);
      const L = LEVELS[this.level];
      Draw.text(ctx, `ESCALADA  ·  Fase ${this.level + 1}/${LEVELS.length}: ${L.name}`, 20, 27, { size: 20, align: 'left' });
      const got = this.gems.filter((gm) => gm.taken).length;
      Draw.text(ctx, `Gemas ${got}/${this.gems.length}`, 790, 27, { size: 20, color: '#fff4a8' });
      Draw.text(ctx, `Quedas ${this.falls}`, 960, 27, { size: 20, color: '#ff8fa0' });
      Draw.text(ctx, fmtTime(this.totalTime), W - 20, 27, { size: 20, align: 'right', color: '#a9b1d6' });

      if (this.state === 'intro') Draw.banner(ctx, `Fase ${this.level + 1}`, L.name, L.tip, '#8ea2ff');
      if (this.state === 'clear') Draw.banner(ctx, 'Fase concluída!', this.level + 1 < LEVELS.length ? 'Preparem-se para a próxima...' : 'Vocês chegaram ao topo!', null, '#5ee38b');
    }
  }

  GAMES.push({
    id: 'platform',
    name: 'Escalada Coop',
    tag: 'COOP',
    min: 2,
    max: 4,
    desc: ['Plataforma com pulo: subam na cabeça', 'dos colegas, usem molas e placas. 5 fases.'],
    controls: 'Mover: direcional · Pular: AÇÃO (ou cima no teclado)',
    create: (ps) => new PlatformGame(ps),
    icon(ctx, x, y, t) {
      ctx.fillStyle = '#353a6a';
      ctx.fillRect(x - 60, y + 30, 120, 22);
      ctx.fillStyle = '#7c86e0';
      ctx.fillRect(x - 60, y + 30, 120, 5);
      ctx.fillStyle = '#353a6a';
      ctx.fillRect(x + 20, y - 30, 40, 60);
      ctx.fillStyle = '#7c86e0';
      ctx.fillRect(x + 20, y - 30, 40, 5);
      const bob = Math.abs(Math.sin(t * 3)) * 8;
      Draw.roundRect(ctx, x - 22, y + 2, 24, 28, 5);
      ctx.fillStyle = PLAYER_COLORS[1];
      ctx.fill();
      Draw.roundRect(ctx, x - 22, y - 28 - bob, 24, 28, 5);
      ctx.fillStyle = PLAYER_COLORS[0];
      ctx.fill();
    },
  });
})();
