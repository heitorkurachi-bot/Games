'use strict';

// A Ilha Perdida: aventura cooperativa para 2 jogadores, vista de cima.
// Espada (AÇÃO), esquiva (EXTRA), chaves, baús, placas duplas e um chefão.
// Quem cai é revivido pelo colega. Se os dois caírem, a fase recomeça.
// Legenda dos mapas:
//   #  parede      .  chão        S  início       E  saída (os dois juntos)
//   ~  água        m  arbusto (corte com a espada)  x  espinhos
//   k  chave       h  coração     $  moeda        C  baú
//   L  porta trancada (gasta 1 chave)
//   a b  placa ->  A B  porta: abre de vez quando TODAS as placas da letra estão pisadas ao mesmo tempo
//   g  gosma       V  morcego (voa sobre água)     R  arqueiro     K  cavaleiro    Z  chefão
(() => {
  const THEMES = {
    forest: { floor: ['#1f3a2a', '#21402d'], wall: '#2e5a3c', wallTop: '#3f7a52', name: 'Floresta' },
    cave: { floor: ['#171b33', '#1a1f3a'], wall: '#2c3259', wallTop: '#3d4579', name: 'Caverna' },
    temple: { floor: ['#3a3020', '#3f3523'], wall: '#6b5636', wallTop: '#8a7048', name: 'Templo' },
    ruins: { floor: ['#2a2d33', '#2e3138'], wall: '#4a4f5a', wallTop: '#616877', name: 'Ruínas' },
    lair: { floor: ['#2e1717', '#331a1a'], wall: '#5a2a2a', wallTop: '#7a3a3a', name: 'Covil' },
  };
  const CH_COLORS = { a: '#c084fc', b: '#fb923c' };

  const LEVELS = [
    {
      name: 'Floresta Sussurrante', theme: 'forest',
      tip: 'AÇÃO: espada · EXTRA: esquiva · Abram o baú para achar a chave',
      map: [
        '################################',
        '#SS....mm.......#..............#',
        '#SS....mm...g...#....g.....C...#',
        '#...............#..............#',
        '#....h..........#......mmm.....#',
        '#.......####....#..............#',
        '#.......#$$#....m..........g...#',
        '#.......#..#....m..............#',
        '#....g.........................#',
        '#..........mmm..#...........$..#',
        '#...............#####L##########',
        '#....$..........#..............#',
        '#.......g.......#.....$....g...#',
        '#mmmmmmmmmmm....#..........EE..#',
        '#...............#..........EE..#',
        '################################',
      ],
    },
    {
      name: 'Caverna dos Morcegos', theme: 'cave',
      tip: 'Morcegos voam sobre a água. Usem as pontes!',
      map: [
        '################################',
        '#SS.....~~~.........~~~........#',
        '#SS.....~~~...V.....~~~...V....#',
        '#.......~~~.........~~~........#',
        '#..g....~~~....k....~~~...g....#',
        '#...........................C..#',
        '#.......~~~.........~~~........#',
        '#.......~~~...V.....~~~........#',
        '######L######################L##',
        '#......~~~~~~~~~~~~~~~~~~......#',
        '#..V...~~~~~~~~~~~~~~~~~~...V..#',
        '#..........................h...#',
        '#..$...~~~~~~~~~~~~~~~~~~......#',
        '#......~~~~~~~~~~~~~~~~~~..EE..#',
        '#...g..~~~~~~~~~~~~~~~~~~..EE..#',
        '################################',
      ],
    },
    {
      name: 'Templo Gêmeo', theme: 'temple',
      tip: 'Cada porta só abre com os DOIS pisando nas placas ao mesmo tempo',
      map: [
        '################################',
        '#SS.......#.........#..........#',
        '#SS.......#....R....#....g.....#',
        '#.........#.........#..........#',
        '#..a......#..b......#..........#',
        '#.........A..xxx....B.....R....#',
        '#.........A..xxx....B..........#',
        '#......a..#.....h...#..........#',
        '#.........#.........#....$.....#',
        '#..g......#.xxx.....#..........#',
        '#.........#.xxx.....#......EE..#',
        '#....$....#.....b...#......EE..#',
        '#.........#....R....#..........#',
        '#.........#.........#....g.....#',
        '#.........#.........#..........#',
        '################################',
      ],
    },
    {
      name: 'Ruínas Antigas', theme: 'ruins',
      tip: 'Cavaleiros perseguem quem chega perto. Ataquem juntos!',
      map: [
        '################################',
        '#SS.....#.......K.......#......#',
        '#SS.....#...............#..C...#',
        '#.......#....######.....#......#',
        '#...g...#....#$$$$#.....#......#',
        '#.......#....#....#..R..#......#',
        '#.......L....##..##.....##..####',
        '#.......#...............#......#',
        '#.......#....K..........#..K...#',
        '####.####...............#......#',
        '#.......#..mmmmmmm..a...A......#',
        '#...R...#...............A......#',
        '#.......#..a.....xxxx...#......#',
        '#..k....#...............#...EE.#',
        '#.......#.....h.........#...EE.#',
        '################################',
      ],
    },
    {
      name: 'Covil do Golem', theme: 'lair',
      tip: 'Derrotem o Golem! Fujam das pedras quando ele bater no chão',
      map: [
        '################################',
        '#SS............................#',
        '#SS............................#',
        '#....##..................##....#',
        '#....##..................##....#',
        '#..............................#',
        '#..............................#',
        '#...............Z..............#',
        '#..............................#',
        '#..............................#',
        '#....##..................##....#',
        '#....##..................##....#',
        '#..h........................h..#',
        '#...........................EE.#',
        '#...........................EE.#',
        '################################',
      ],
    },
  ];

  const ENEMIES = {
    g: { kind: 'slime', hp: 2, r: 14, speed: 60 },
    V: { kind: 'bat', hp: 1, r: 12, speed: 115, fly: true },
    R: { kind: 'archer', hp: 3, r: 14, speed: 0 },
    K: { kind: 'knight', hp: 4, r: 16, speed: 88 },
  };
  const HERO_R = 14, SPEED = 200, MAX_HP = 5, REVIVE_TIME = 1.5, REVIVE_DIST = 52;
  const SWORD_REACH = 48, SWORD_ARC = 1.25; // raio e meia-abertura (rad)

  class AdventureGame {
    constructor(players) {
      this.pausable = true;
      this.players = players.slice(0, 2);
      this.coins = new Map(this.players.map((p) => [p, 0]));
      this.totalTime = 0;
      this.fx = new Particles();
      this.load(0);
    }

    load(i) {
      this.level = i;
      const L = LEVELS[i], rows = L.map;
      const R = rows.length, C = Math.max(...rows.map((r) => r.length));
      const ts = Math.floor(Math.min(W / C, (H - 60) / R));
      Object.assign(this, { R, C, ts, s: ts / 40, ox: Math.floor((W - C * ts) / 2), oy: 56 + Math.floor((H - 56 - R * ts) / 2), theme: THEMES[L.theme] });
      this.base = [];
      this.pickups = [];
      this.plates = [];
      this.doors = [];
      this.doorAt = {};
      this.chests = {};
      this.enemies = [];
      this.shots = [];
      this.boss = null;
      const spawns = [];
      for (let r = 0; r < R; r++) {
        const row = [];
        for (let c = 0; c < C; c++) {
          const ch = rows[r][c] || '#';
          const cx = this.cx(c), cy = this.cy(r);
          let b = '.';
          if ('#~mxLE'.includes(ch)) b = ch;
          else if (ch === 'C') { b = 'C'; this.chests[c + ',' + r] = { open: false }; }
          else if (ch === 'S') spawns.push({ c, r });
          else if (ch === 'k') this.pickups.push({ type: 'key', x: cx, y: cy });
          else if (ch === 'h') this.pickups.push({ type: 'heart', x: cx, y: cy });
          else if (ch === '$') this.pickups.push({ type: 'coin', x: cx, y: cy });
          else if (ch === 'a' || ch === 'b') this.plates.push({ c, r, ch });
          else if (ch === 'A' || ch === 'B') {
            b = 'D';
            const d = { c, r, ch: ch.toLowerCase(), open: false };
            this.doors.push(d);
            this.doorAt[c + ',' + r] = d;
          } else if (ENEMIES[ch]) {
            const e = ENEMIES[ch];
            this.enemies.push({ ...e, x: cx, y: cy, r: e.r * this.s, maxHp: e.hp, vx: 0, vy: 0, kx: 0, ky: 0, t: rand(0.3, 1.5), flash: 0, phase: Math.random() * 6 });
          } else if (ch === 'Z') {
            this.boss = { x: cx, y: cy, r: 40 * this.s, hp: 50, maxHp: 50, state: 'walk', t: 2.5, cycles: 0, flash: 0, kx: 0, ky: 0, dead: false };
          }
          row.push(b);
        }
        this.base.push(row);
      }

      this.heroes = this.players.map((p, k) => {
        const sp = spawns[k % spawns.length];
        return {
          p, x: this.cx(sp.c), y: this.cy(sp.r), r: HERO_R * this.s, hp: MAX_HP, face: { x: 1, y: 0 },
          atk: 0, atkCd: 0, hitSet: null, dash: 0, dashCd: 0, inv: 0, kx: 0, ky: 0, down: false, revive: 0,
        };
      });
      this.keys = 0;
      this.levelCoins = new Map(this.coins);
      this.t = 0;
      this.shake = 0;
      this.state = 'intro';
      this.timer = 2.8;
    }

    cx(c) { return this.ox + (c + 0.5) * this.ts; }
    cy(r) { return this.oy + (r + 0.5) * this.ts; }
    col(x) { return Math.floor((x - this.ox) / this.ts); }
    row(y) { return Math.floor((y - this.oy) / this.ts); }
    tile(c, r) { return (this.base[r] && this.base[r][c]) || '#'; }

    // mode: 'walk' (heróis e inimigos de chão), 'fly' (morcegos), 'shot' (projéteis)
    solid(c, r, mode) {
      const b = this.tile(c, r);
      if (b === '#' || b === 'L' || b === 'C') return true;
      if (b === 'D') return !this.doorAt[c + ',' + r].open;
      if (b === '~') return mode === 'walk';
      if (b === 'm') return mode !== 'fly';
      return false;
    }
    hits(x, y, rad, mode) {
      for (let r = this.row(y - rad); r <= this.row(y + rad); r++) {
        for (let c = this.col(x - rad); c <= this.col(x + rad); c++) if (this.solid(c, r, mode)) return true;
      }
      return false;
    }
    move(e, dx, dy, rad, mode) {
      const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3) || 1;
      let blocked = false;
      for (let i = 0; i < steps; i++) {
        if (!this.hits(e.x + dx / steps, e.y, rad, mode)) e.x += dx / steps; else blocked = true;
        if (!this.hits(e.x, e.y + dy / steps, rad, mode)) e.y += dy / steps; else blocked = true;
      }
      return blocked;
    }

    alive() { return this.heroes.filter((h) => !h.down); }
    nearest(x, y) {
      let best = null, bd = Infinity;
      for (const h of this.alive()) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }
      return { h: best, d: bd };
    }

    hurtHero(h, from) {
      if (h.down || h.inv > 0 || h.dash > 0) return;
      h.hp--;
      h.inv = 1;
      const dx = h.x - from.x, dy = h.y - from.y, d = Math.hypot(dx, dy) || 1;
      h.kx = (dx / d) * 380 * this.s;
      h.ky = (dy / d) * 380 * this.s;
      this.shake = Math.max(this.shake, 0.2);
      Sfx.play('hurt');
      this.fx.burst(h.x, h.y, h.p.color, 12, 160);
      if (h.hp <= 0) { h.down = true; h.revive = 0; Sfx.play('explode'); }
    }

    hitEnemy(e, h, dmg = 1) {
      e.hp -= dmg;
      e.flash = 0.15;
      const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy) || 1, k = e === this.boss ? 90 : 420;
      e.kx = (dx / d) * k * this.s;
      e.ky = (dy / d) * k * this.s;
      Sfx.play('hit');
      this.fx.burst(e.x, e.y, '#ffffff', 6, 120, 0.3, 3);
    }

    drop(x, y) {
      const r = Math.random();
      if (r < 0.3) this.pickups.push({ type: 'coin', x, y });
      else if (r < 0.45) this.pickups.push({ type: 'heart', x, y });
    }

    openChest(c, r, h) {
      const ch = this.chests[c + ',' + r];
      if (!ch || ch.open) return;
      ch.open = true;
      Sfx.play('win');
      const x = this.cx(c), y = this.cy(r) + this.ts;
      // O baú sempre traz uma chave, um coração e moedas
      this.pickups.push({ type: 'key', x: x - 14 * this.s, y }, { type: 'heart', x: x + 14 * this.s, y }, { type: 'coin', x, y: y + 16 * this.s });
      this.fx.burst(this.cx(c), this.cy(r), '#ffd23f', 24, 200);
    }

    swing(h) {
      const reach = SWORD_REACH * this.s, fa = Math.atan2(h.face.y, h.face.x);
      const inArc = (x, y, extra) => {
        const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
        if (d > reach + extra) return false;
        let da = Math.abs(Math.atan2(dy, dx) - fa);
        if (da > Math.PI) da = Math.PI * 2 - da;
        return da < SWORD_ARC || d < h.r + extra;
      };
      for (const e of this.enemies) if (!h.hitSet.has(e) && inArc(e.x, e.y, e.r)) { h.hitSet.add(e); this.hitEnemy(e, h); }
      const B = this.boss;
      if (B && !B.dead && !h.hitSet.has(B) && inArc(B.x, B.y, B.r)) { h.hitSet.add(B); this.hitEnemy(B, h); }
      // Arbustos e baús à frente
      for (const k of [0.6, 1.1]) {
        const tx = h.x + h.face.x * reach * k, ty = h.y + h.face.y * reach * k, c = this.col(tx), r = this.row(ty);
        if (this.tile(c, r) === 'm' && !h.hitSet.has(c + ',' + r)) {
          h.hitSet.add(c + ',' + r);
          this.base[r][c] = '.';
          this.fx.burst(this.cx(c), this.cy(r), '#4ade80', 14, 160, 0.5, 4);
          Sfx.play('hit');
          if (Math.random() < 0.35) this.drop(this.cx(c), this.cy(r));
        }
        if (this.tile(c, r) === 'C') this.openChest(c, r, h);
      }
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
        if (this.state === 'fail') { this.coins = new Map(this.levelCoins); this.load(this.level); return; }
        if (this.level + 1 < LEVELS.length) { this.load(this.level + 1); return; }
        const ranked = this.players.slice().sort((a, b) => this.coins.get(b) - this.coins.get(a));
        Engine.finishGame({
          title: 'A ilha foi salva!',
          subtitle: `O Golem caiu. Aventura completa em ${fmtTime(this.totalTime)}`,
          winners: this.players.slice(),
          lines: ranked.map((p, i) => ({ player: p, text: `${p.name}: ${this.coins.get(p)} moedas${i === 0 && this.coins.get(p) > 0 ? '  (mais rico)' : ''}` })),
          color: '#c084fc',
        });
        return;
      }

      this.t += dt;
      this.totalTime += dt;
      const s = this.s;

      // Heróis
      for (const h of this.heroes) {
        h.inv = Math.max(0, h.inv - dt);
        h.atk = Math.max(0, h.atk - dt);
        h.atkCd = Math.max(0, h.atkCd - dt);
        h.dash = Math.max(0, h.dash - dt);
        h.dashCd = Math.max(0, h.dashCd - dt);
        const kd = Math.pow(0.002, dt);
        if (h.down) { h.kx = h.ky = 0; continue; }
        const dev = h.p.device, d = dev.dir(h.x, h.y), mag = Math.hypot(d.x, d.y);
        if (dev.kind === 'mouse') {
          const m = Input.mouse, dx = m.x - h.x, dy = m.y - h.y, dd = Math.hypot(dx, dy);
          if (dd > 8) h.face = { x: dx / dd, y: dy / dd };
        } else if (mag > 0.3 && h.atk <= 0) {
          h.face = { x: d.x / mag, y: d.y / mag };
        }
        if (dev.pressed('b') && h.dashCd <= 0 && mag > 0.3) { h.dash = 0.18; h.dashCd = 0.7; Sfx.play('shoot'); }
        if (dev.pressed('a') && h.atkCd <= 0) { h.atk = 0.18; h.atkCd = 0.32; h.hitSet = new Set(); Sfx.play('swing'); }
        if (h.atk > 0) this.swing(h);
        const spd = SPEED * s * (h.dash > 0 ? 2.8 : h.atk > 0 ? 0.55 : 1);
        this.move(h, (d.x * spd + h.kx) * dt, (d.y * spd + h.ky) * dt, h.r, 'walk');
        h.kx *= kd;
        h.ky *= kd;

        // Portas trancadas: encostar com chave abre
        const reach = h.r + 8 * s;
        for (let r = this.row(h.y - reach); r <= this.row(h.y + reach); r++) {
          for (let c = this.col(h.x - reach); c <= this.col(h.x + reach); c++) {
            if (this.tile(c, r) === 'L' && this.keys > 0) {
              this.keys--;
              this.base[r][c] = '.';
              Sfx.play('door');
              this.fx.burst(this.cx(c), this.cy(r), '#ffd23f', 18, 180);
            }
          }
        }
        // Espinhos
        if (this.tile(this.col(h.x), this.row(h.y)) === 'x') this.hurtHero(h, { x: h.x - h.face.x, y: h.y - h.face.y });
      }

      // Reviver
      for (const h of this.heroes) {
        if (!h.down) continue;
        const helper = this.heroes.some((o) => !o.down && Math.hypot(o.x - h.x, o.y - h.y) < REVIVE_DIST * s);
        h.revive = helper ? h.revive + dt : Math.max(0, h.revive - dt * 0.5);
        if (h.revive >= REVIVE_TIME) { h.down = false; h.hp = 3; h.inv = 1.5; Sfx.play('confirm'); this.fx.burst(h.x, h.y, '#ffffff', 18, 160); }
      }
      if (!this.alive().length) { this.state = 'fail'; this.timer = 2.8; Sfx.play('lose'); return; }

      // Placas duplas: abrem de vez quando todas da letra estão pisadas
      for (const ch of ['a', 'b']) {
        const plates = this.plates.filter((p) => p.ch === ch);
        if (!plates.length) continue;
        for (const pl of plates) pl.on = this.heroes.some((h) => !h.down && this.col(h.x) === pl.c && this.row(h.y) === pl.r);
        const doors = this.doors.filter((d) => d.ch === ch);
        if (plates.every((p) => p.on) && doors.some((d) => !d.open)) {
          doors.forEach((d) => { d.open = true; });
          Sfx.play('door');
          this.shake = 0.25;
        }
      }

      // Itens
      for (const it of this.pickups) {
        const h = this.alive().find((o) => Math.hypot(o.x - it.x, o.y - it.y) < o.r + 12 * s);
        if (!h) continue;
        if (it.type === 'heart' && h.hp >= MAX_HP) continue;
        it.taken = true;
        if (it.type === 'key') this.keys++;
        else if (it.type === 'heart') h.hp = Math.min(MAX_HP, h.hp + 1);
        else this.coins.set(h.p, this.coins.get(h.p) + 1);
        Sfx.play('pickup');
        this.fx.burst(it.x, it.y, it.type === 'heart' ? '#ff5d73' : '#ffd23f', 10, 120);
      }
      this.pickups = this.pickups.filter((it) => !it.taken);

      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateShots(dt);

      // Saída
      this.exitOpen = !this.boss || this.boss.dead;
      if (this.exitOpen && this.heroes.every((h) => !h.down && this.tile(this.col(h.x), this.row(h.y)) === 'E')) {
        this.state = 'clear';
        this.timer = 2.6;
        Sfx.play('win');
      }
    }

    updateEnemies(dt) {
      const s = this.s, kd = Math.pow(0.002, dt);
      for (const e of this.enemies) {
        e.flash = Math.max(0, e.flash - dt);
        e.t -= dt;
        e.phase += dt;
        const { h: target, d: dist } = this.nearest(e.x, e.y);
        let mx = 0, my = 0;
        if (e.kind === 'slime') {
          if (e.t <= 0) {
            e.t = rand(0.8, 1.8);
            if (target && dist < 260 * s && Math.random() < 0.6) { const a = Math.atan2(target.y - e.y, target.x - e.x); e.vx = Math.cos(a); e.vy = Math.sin(a); }
            else { const a = Math.random() * Math.PI * 2; e.vx = Math.cos(a); e.vy = Math.sin(a); }
          }
          mx = e.vx; my = e.vy;
        } else if (e.kind === 'bat') {
          if (target && dist < 420 * s) {
            const a = Math.atan2(target.y - e.y, target.x - e.x) + Math.sin(e.phase * 4) * 0.8;
            mx = Math.cos(a); my = Math.sin(a);
          } else { mx = Math.cos(e.phase); my = Math.sin(e.phase * 1.3); }
        } else if (e.kind === 'archer') {
          if (e.t <= 0 && target && dist < 480 * s) {
            e.t = 2.2;
            const a = Math.atan2(target.y - e.y, target.x - e.x), sp = 300 * s;
            this.shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 * s, kind: 'arrow', life: 4 });
            Sfx.play('shoot');
          }
        } else if (e.kind === 'knight') {
          if (target && dist < 320 * s) { const a = Math.atan2(target.y - e.y, target.x - e.x); mx = Math.cos(a); my = Math.sin(a); }
          else if (e.t <= 0) { e.t = rand(1, 2); const a = Math.random() * Math.PI * 2; e.vx = Math.cos(a) * 0.4; e.vy = Math.sin(a) * 0.4; }
          if (!(target && dist < 320 * s)) { mx = e.vx; my = e.vy; }
        }
        const sp = e.speed * s;
        const blocked = this.move(e, (mx * sp + e.kx) * dt, (my * sp + e.ky) * dt, e.r, e.fly ? 'fly' : 'walk');
        if (blocked && e.kind === 'slime') e.t = 0;
        e.kx *= kd;
        e.ky *= kd;
        for (const h of this.heroes) if (Math.hypot(h.x - e.x, h.y - e.y) < h.r + e.r * 0.9) this.hurtHero(h, e);
      }
      const before = this.enemies.length;
      this.enemies = this.enemies.filter((e) => {
        if (e.hp > 0) return true;
        this.fx.burst(e.x, e.y, '#e5e7eb', 18, 200);
        this.drop(e.x, e.y);
        return false;
      });
      if (this.enemies.length < before) Sfx.play('explode');
    }

    updateBoss(dt) {
      const B = this.boss;
      if (!B || B.dead) return;
      const s = this.s, angry = B.hp < B.maxHp / 2;
      B.flash = Math.max(0, B.flash - dt);
      B.t -= dt;
      const { h: target } = this.nearest(B.x, B.y);
      if (B.state === 'walk') {
        if (target) {
          const a = Math.atan2(target.y - B.y, target.x - B.x), sp = (angry ? 80 : 55) * s;
          this.move(B, (Math.cos(a) * sp + B.kx) * dt, (Math.sin(a) * sp + B.ky) * dt, B.r * 0.8, 'walk');
        }
        if (B.t <= 0) { B.state = 'windup'; B.t = 0.9; }
      } else if (B.state === 'windup') {
        if (B.t <= 0) {
          const n = angry ? 16 : 12, sp = 230 * s, off = Math.random();
          for (let i = 0; i < n; i++) {
            const a = ((i + off) / n) * Math.PI * 2;
            this.shots.push({ x: B.x, y: B.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 9 * s, kind: 'rock', life: 5 });
          }
          this.shake = 0.5;
          Sfx.play('explode');
          B.cycles++;
          if (B.cycles % 3 === 0) {
            for (const dx of [-1, 1]) {
              const e = ENEMIES.g;
              this.enemies.push({ ...e, x: B.x + dx * 70 * s, y: B.y + 50 * s, r: e.r * s, maxHp: e.hp, vx: 0, vy: 0, kx: 0, ky: 0, t: 0.5, flash: 0, phase: 0 });
            }
          }
          B.state = 'walk';
          B.t = angry ? rand(1.6, 2.4) : rand(2.5, 3.5);
        }
      }
      B.kx *= Math.pow(0.002, dt);
      B.ky *= Math.pow(0.002, dt);
      for (const h of this.heroes) if (Math.hypot(h.x - B.x, h.y - B.y) < h.r + B.r * 0.85) this.hurtHero(h, B);
      if (B.hp <= 0) {
        B.dead = true;
        this.shake = 0.8;
        this.fx.burst(B.x, B.y, '#a8a29e', 70, 380, 1.2, 7);
        this.fx.burst(B.x, B.y, '#ffd23f', 40, 300, 1, 5);
        for (let i = 0; i < 6; i++) this.pickups.push({ type: 'coin', x: B.x + rand(-50, 50) * s, y: B.y + rand(-50, 50) * s });
        this.shots = [];
        Sfx.play('win');
      }
    }

    updateShots(dt) {
      for (const sh of this.shots) {
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.life -= dt;
        if (this.solid(this.col(sh.x), this.row(sh.y), 'shot')) { sh.dead = true; this.fx.burst(sh.x, sh.y, '#a8a29e', 4, 80, 0.3, 3); continue; }
        for (const h of this.heroes) {
          if (!h.down && h.inv <= 0 && h.dash <= 0 && Math.hypot(h.x - sh.x, h.y - sh.y) < h.r + sh.r) { this.hurtHero(h, sh); sh.dead = true; break; }
        }
      }
      this.shots = this.shots.filter((sh) => !sh.dead && sh.life > 0);
    }

    // ---------------------------------------------------------------- desenho
    draw(ctx) {
      const { ts, ox, oy, s, theme } = this;
      ctx.save();
      applyShake(ctx, this.shake);
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 56, W, H - 56);
      for (let r = 0; r < this.R; r++) {
        for (let c = 0; c < this.C; c++) {
          const x = ox + c * ts, y = oy + r * ts, b = this.base[r][c];
          ctx.fillStyle = theme.floor[(r + c) % 2];
          ctx.fillRect(x, y, ts, ts);
          if (b === '#') {
            ctx.fillStyle = theme.wall;
            ctx.fillRect(x, y, ts, ts);
            ctx.fillStyle = theme.wallTop;
            ctx.fillRect(x, y, ts, 6 * s);
          } else if (b === '~') {
            ctx.fillStyle = '#1e4f8a';
            ctx.fillRect(x, y, ts, ts);
            ctx.strokeStyle = 'rgba(160,210,255,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const wv = Math.sin(this.t * 2 + c) * 3;
            ctx.moveTo(x + 6, y + ts * 0.4 + wv); ctx.quadraticCurveTo(x + ts / 2, y + ts * 0.3 + wv, x + ts - 6, y + ts * 0.4 + wv);
            ctx.stroke();
          } else if (b === 'm') {
            ctx.fillStyle = '#2f8f4e';
            ctx.beginPath();
            ctx.arc(x + ts * 0.35, y + ts * 0.55, ts * 0.28, 0, Math.PI * 2);
            ctx.arc(x + ts * 0.65, y + ts * 0.55, ts * 0.28, 0, Math.PI * 2);
            ctx.arc(x + ts * 0.5, y + ts * 0.35, ts * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(x + ts * 0.45, y + ts * 0.25, 4 * s, 4 * s);
          } else if (b === 'x') {
            ctx.fillStyle = '#d1d5db';
            const n = 3, w = ts / n;
            for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
              ctx.beginPath();
              ctx.moveTo(x + i * w + 2, y + (j + 1) * w - 2); ctx.lineTo(x + i * w + w / 2, y + j * w + 2); ctx.lineTo(x + (i + 1) * w - 2, y + (j + 1) * w - 2);
              ctx.fill();
            }
          } else if (b === 'L') {
            ctx.fillStyle = '#8a5a2b';
            ctx.fillRect(x + 2, y, ts - 4, ts);
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(x + ts / 2, y + ts * 0.42, 6 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(x + ts / 2 - 2 * s, y + ts * 0.42, 4 * s, 10 * s);
          } else if (b === 'C') {
            const open = this.chests[c + ',' + r].open;
            ctx.fillStyle = open ? '#5a3a1a' : '#a0642c';
            ctx.fillRect(x + 5 * s, y + 10 * s, ts - 10 * s, ts - 16 * s);
            ctx.fillStyle = '#ffd23f';
            ctx.fillRect(x + 5 * s, y + (open ? 6 : 16) * s, ts - 10 * s, 4 * s);
            if (!open) ctx.fillRect(x + ts / 2 - 3 * s, y + 18 * s, 6 * s, 7 * s);
          } else if (b === 'E') {
            const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
            ctx.fillStyle = this.exitOpen ? `rgba(192,132,252,${0.35 + pulse * 0.35})` : 'rgba(120,120,140,0.2)';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
          } else if (b === 'D') {
            const d = this.doorAt[c + ',' + r], col = CH_COLORS[d.ch];
            if (!d.open) {
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
        ctx.globalAlpha = pl.on ? 1 : 0.6;
        Draw.roundRect(ctx, x + inset, y + inset, ts - inset * 2, ts - inset * 2, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const it of this.pickups) this.drawPickup(ctx, it);
      for (const e of this.enemies) this.drawEnemy(ctx, e);
      if (this.boss && !this.boss.dead) this.drawBoss(ctx, this.boss);
      for (const sh of this.shots) {
        if (sh.kind === 'arrow') {
          const a = Math.atan2(sh.vy, sh.vx);
          ctx.save();
          ctx.translate(sh.x, sh.y);
          ctx.rotate(a);
          ctx.fillStyle = '#e7d3a8';
          ctx.fillRect(-10 * s, -1.5 * s, 18 * s, 3 * s);
          ctx.fillStyle = '#d1d5db';
          ctx.beginPath(); ctx.moveTo(10 * s, -4 * s); ctx.lineTo(14 * s, 0); ctx.lineTo(10 * s, 4 * s); ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
          ctx.fillStyle = '#a8a29e';
          ctx.fill();
          ctx.strokeStyle = '#57534e';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      for (const h of this.heroes) this.drawHero(ctx, h);
      this.fx.draw(ctx);
      ctx.restore();
      this.drawHud(ctx);

      const L = LEVELS[this.level];
      if (this.state === 'intro') Draw.banner(ctx, `Fase ${this.level + 1}: ${L.name}`, theme.name, L.tip, '#c084fc');
      if (this.state === 'clear') Draw.banner(ctx, 'Fase concluída!', this.level + 1 < LEVELS.length ? 'A aventura continua...' : 'Vocês salvaram a ilha!', null, '#5ee38b');
      if (this.state === 'fail') Draw.banner(ctx, 'Os dois caíram!', 'Tentando a fase de novo...', null, '#ff5d73');
    }

    drawPickup(ctx, it) {
      const s = this.s, bob = Math.sin(this.t * 4 + it.x) * 3, x = it.x, y = it.y + bob;
      if (it.type === 'coin') {
        ctx.beginPath();
        ctx.ellipse(x, y, 7 * s * Math.abs(Math.cos(this.t * 3 + it.x)) + 2, 8 * s, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
      } else if (it.type === 'heart') {
        this.heart(ctx, x, y, 9 * s, '#ff5d73');
      } else {
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.arc(x - 6 * s, y, 5 * s, 0, Math.PI * 2);
        ctx.moveTo(x - 1 * s, y); ctx.lineTo(x + 11 * s, y); ctx.moveTo(x + 7 * s, y); ctx.lineTo(x + 7 * s, y + 5 * s); ctx.moveTo(x + 11 * s, y); ctx.lineTo(x + 11 * s, y + 5 * s);
        ctx.stroke();
      }
    }

    heart(ctx, x, y, z, color) {
      ctx.beginPath();
      ctx.moveTo(x, y + z * 0.9);
      ctx.bezierCurveTo(x - z * 1.6, y - z * 0.2, x - z * 0.9, y - z * 1.3, x, y - z * 0.4);
      ctx.bezierCurveTo(x + z * 0.9, y - z * 1.3, x + z * 1.6, y - z * 0.2, x, y + z * 0.9);
      ctx.fillStyle = color;
      ctx.fill();
    }

    drawEnemy(ctx, e) {
      const s = this.s, white = e.flash > 0;
      if (e.kind === 'slime') {
        const sq = 1 + Math.sin(e.phase * 8) * 0.12;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 3 * s, e.r * sq, e.r / sq, 0, 0, Math.PI * 2);
        ctx.fillStyle = white ? '#fff' : '#65d36e';
        ctx.fill();
        ctx.fillStyle = '#10131f';
        ctx.fillRect(e.x - 5 * s, e.y - 2 * s, 3 * s, 4 * s);
        ctx.fillRect(e.x + 3 * s, e.y - 2 * s, 3 * s, 4 * s);
      } else if (e.kind === 'bat') {
        const flap = Math.sin(e.phase * 18) * 8 * s;
        ctx.fillStyle = white ? '#fff' : '#8b5cf6';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - 18 * s, e.y - flap); ctx.lineTo(e.x - 8 * s, e.y + 4 * s);
        ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + 18 * s, e.y - flap); ctx.lineTo(e.x + 8 * s, e.y + 4 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.fillRect(e.x - 4 * s, e.y - 2 * s, 2 * s, 2 * s);
        ctx.fillRect(e.x + 2 * s, e.y - 2 * s, 2 * s, 2 * s);
      } else if (e.kind === 'archer') {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = white ? '#fff' : '#9a6b3f';
        ctx.fill();
        ctx.strokeStyle = '#e7d3a8';
        ctx.lineWidth = 2.5 * s;
        const { h } = this.nearest(e.x, e.y), a = h ? Math.atan2(h.y - e.y, h.x - e.x) : 0;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * e.r * 0.6, e.y + Math.sin(a) * e.r * 0.6, e.r * 0.8, a - 1.1, a + 1.1);
        ctx.stroke();
      } else {
        ctx.fillStyle = white ? '#fff' : '#9ca3af';
        Draw.roundRect(ctx, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2, 5 * s);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - 3 * s, e.y - e.r - 6 * s, 6 * s, 8 * s);
        ctx.fillStyle = '#1f2433';
        ctx.fillRect(e.x - e.r * 0.6, e.y - 3 * s, e.r * 1.2, 4 * s);
      }
      if (e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - 14 * s, e.y - e.r - 12 * s, 28 * s, 4 * s);
        ctx.fillStyle = '#ff5d73';
        ctx.fillRect(e.x - 14 * s, e.y - e.r - 12 * s, 28 * s * (e.hp / e.maxHp), 4 * s);
      }
    }

    drawBoss(ctx, B) {
      const s = this.s, shake = B.state === 'windup' ? rand(-3, 3) : 0;
      const x = B.x + shake, y = B.y;
      if (B.state === 'windup') {
        ctx.beginPath();
        ctx.arc(B.x, B.y, B.r + 30 * s * (1 - B.t / 0.9), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,90,90,0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.fillStyle = B.flash > 0 ? '#fff' : '#78716c';
      Draw.roundRect(ctx, x - B.r, y - B.r, B.r * 2, B.r * 2, 14 * s);
      ctx.fill();
      ctx.fillStyle = '#57534e';
      ctx.fillRect(x - B.r - 14 * s, y - 10 * s, 14 * s, 30 * s);
      ctx.fillRect(x + B.r, y - 10 * s, 14 * s, 30 * s);
      const angry = B.hp < B.maxHp / 2;
      ctx.fillStyle = angry ? '#ef4444' : '#fbbf24';
      ctx.fillRect(x - 18 * s, y - 14 * s, 10 * s, 8 * s);
      ctx.fillRect(x + 8 * s, y - 14 * s, 10 * s, 8 * s);
      ctx.fillStyle = '#44403c';
      ctx.fillRect(x - 14 * s, y + 10 * s, 28 * s, 6 * s);
    }

    drawHero(ctx, h) {
      const s = this.s;
      if (h.down) {
        ctx.globalAlpha = 0.45;
        Draw.playerDot(ctx, h.x, h.y, h.r, h.p);
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(h.x, h.y, REVIVE_DIST * s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        if (h.revive > 0) {
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.r + 8, -Math.PI / 2, -Math.PI / 2 + (h.revive / REVIVE_TIME) * Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        Draw.text(ctx, 'SOCORRO!', h.x, h.y - 30 * s, { size: 14, weight: 900, color: h.p.color });
        return;
      }
      if (h.inv > 0 && Math.floor(h.inv * 12) % 2) return;
      // espada
      const fa = Math.atan2(h.face.y, h.face.x);
      if (h.atk > 0) {
        const k = 1 - h.atk / 0.18, a = fa - SWORD_ARC + k * SWORD_ARC * 2, len = SWORD_REACH * s;
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.arc(h.x, h.y, len, fa - SWORD_ARC, a);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r);
        ctx.lineTo(h.x + Math.cos(a) * len, h.y + Math.sin(a) * len);
        ctx.stroke();
      } else {
        const a = fa + 0.9;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * h.r * 0.8, h.y + Math.sin(a) * h.r * 0.8);
        ctx.lineTo(h.x + Math.cos(a) * h.r * 1.7, h.y + Math.sin(a) * h.r * 1.7);
        ctx.stroke();
      }
      if (h.dash > 0) {
        ctx.globalAlpha = 0.35;
        Draw.playerDot(ctx, h.x - h.face.x * 14 * s, h.y - h.face.y * 14 * s, h.r, h.p);
        ctx.globalAlpha = 1;
      }
      Draw.playerDot(ctx, h.x, h.y, h.r, h.p);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(h.x + h.face.x * h.r * 0.75, h.y + h.face.y * h.r * 0.75, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    drawHud(ctx) {
      Draw.hudBar(ctx);
      Draw.text(ctx, `AVENTURA  ·  Fase ${this.level + 1}/${LEVELS.length}: ${LEVELS[this.level].name}`, 20, 27, { size: 19, align: 'left' });
      // chaves
      this.drawPickup(ctx, { type: 'key', x: 560, y: 27 - Math.sin(this.t * 4 + 560) * 3 });
      Draw.text(ctx, `× ${this.keys}`, 580, 28, { size: 19, align: 'left', color: '#ffd23f' });
      this.heroes.forEach((h, i) => {
        const x = 690 + i * 290;
        Draw.playerDot(ctx, x, 27, 11, h.p);
        for (let k = 0; k < MAX_HP; k++) this.heart(ctx, x + 26 + k * 24, 28, 7, k < h.hp ? '#ff5d73' : '#2c3254');
        Draw.text(ctx, `${this.coins.get(h.p)}`, x + 160, 28, { size: 18, align: 'left', color: '#ffd23f' });
      });
      const B = this.boss;
      if (B && !B.dead && this.state === 'play') {
        Draw.panel(ctx, W / 2 - 250, H - 34, 500, 18, 'rgba(0,0,0,0.6)', null, 9);
        Draw.panel(ctx, W / 2 - 250, H - 34, Math.max(18, 500 * (B.hp / B.maxHp)), 18, '#ef4444', null, 9);
        Draw.text(ctx, 'GOLEM DE PEDRA', W / 2, H - 46, { size: 15, weight: 900, color: '#fca5a5' });
      }
    }
  }

  GAMES.push({
    id: 'adventure',
    name: 'A Ilha Perdida',
    tag: 'AVENTURA',
    min: 2,
    max: 2,
    desc: ['Aventura em dupla: espada, chaves, baús,', 'placas duplas e um chefão. 5 fases.'],
    controls: 'Mover: direcional · Espada: AÇÃO · Esquiva: EXTRA',
    create: (ps) => new AdventureGame(ps),
    icon(ctx, x, y, t) {
      ctx.fillStyle = '#1f3a2a';
      ctx.fillRect(x - 60, y - 50, 120, 100);
      ctx.fillStyle = '#2f8f4e';
      ctx.beginPath(); ctx.arc(x + 38, y - 30, 16, 0, Math.PI * 2); ctx.fill();
      const a = -0.8 + Math.sin(t * 6) * 0.9;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - 10, y + 6); ctx.lineTo(x - 10 + Math.cos(a) * 46, y + 6 + Math.sin(a) * 46); ctx.stroke();
      Draw.playerDot(ctx, x - 22, y + 14, 14, { color: PLAYER_COLORS[0], slot: 0 });
      Draw.playerDot(ctx, x + 22, y + 30, 11, { color: PLAYER_COLORS[1], slot: 1 });
    },
  });
})();
