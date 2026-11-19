"use strict";

class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.back = document.createElement("canvas");
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.demo = [
      { type: "gate", x: -.51, z: .19, kind: "attack", penalty: 2, charge: 4, width: .485 },
      { type: "gate", x: .51, z: .19, kind: "lanes", penalty: 0, charge: 8, width: .405 },
      { type: "crate", x: -.46, z: .61, hp: 12 },
      { type: "runner", x: .48, z: .67, phase: 1, hp: 5, maxHp: 5 },
      { type: "armored", x: .06, z: .78, phase: 3, hp: 39, maxHp: 39 }
    ];
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.unit = Math.max(.76, Math.min(1.3, Math.min(w / 420, h / 485)));
    this.canvas.width = this.back.width = Math.round(w * dpr);
    this.canvas.height = this.back.height = Math.round(h * dpr);
    this.buildBackdrop();
  }

  depth(z) {
    return Math.pow(Math.max(0, 1 - z), 1.62);
  }

  roadHalf(z) {
    return this.w * (.101 + .338 * this.depth(z));
  }

  point(x, z) {
    const p = this.depth(z);
    return [this.w / 2 + x * this.roadHalf(z), this.h * (.198 + .714 * p), (.35 + .82 * p) * this.unit];
  }

  shape(ctx, points, fill, edge, width = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  ellipse(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  line(ctx, points, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  buildBackdrop() {
    const { w, h, dpr } = this;
    const ctx = this.back.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let seed = 5491;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const horizon = h * .198;
    const sky = ctx.createLinearGradient(0, 0, 0, h * .42);
    sky.addColorStop(0, "#281729");
    sky.addColorStop(.46, "#77415d");
    sky.addColorStop(1, "#4b304a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const haze = ctx.createRadialGradient(w * .51, horizon * .85, 6, w * .51, horizon, w * .52);
    haze.addColorStop(0, "#e295aa");
    haze.addColorStop(.37, "#a56083a3");
    haze.addColorStop(1, "#4f244100");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h * .5);
    for (let i = 0; i < 33; i++) {
      const x = w * (.07 + i * .027);
      const top = horizon * (.27 + random() * .65);
      const bw = w * (.012 + random() * .018);
      ctx.fillStyle = ["#50334d", "#604057", "#704c61"][i % 3];
      ctx.fillRect(x, top, bw, horizon - top + 6);
      if (i % 5 === 1) this.line(ctx, [[x + bw * .35, top], [x + bw * .35, top - horizon * .13]], "#78516a");
      if (i % 3 === 0) {
        ctx.fillStyle = "#f7a9bc74";
        ctx.fillRect(x + bw * .56, top + 7, 2, 2);
      }
    }
    const pavement = ctx.createLinearGradient(0, horizon, 0, h);
    pavement.addColorStop(0, "#504051");
    pavement.addColorStop(.49, "#322838");
    pavement.addColorStop(1, "#211a2b");
    this.shape(ctx, [
      this.point(-1.8, 1), this.point(1.8, 1), this.point(1.8, -.2), this.point(-1.8, -.2)
    ], pavement);
    const road = ctx.createLinearGradient(0, horizon, 0, h);
    road.addColorStop(0, "#706071");
    road.addColorStop(.24, "#514352");
    road.addColorStop(.67, "#38303f");
    road.addColorStop(1, "#342b3c");
    this.shape(ctx, [this.point(-1.06, 1), this.point(1.06, 1), this.point(1.06, -.17), this.point(-1.06, -.17)], road);
    const reflection = ctx.createLinearGradient(w * .22, 0, w * .79, 0);
    reflection.addColorStop(0, "#e599c400");
    reflection.addColorStop(.58, "#e599c424");
    reflection.addColorStop(1, "#e599c400");
    this.shape(ctx, [this.point(-.64, 1), this.point(.59, 1), this.point(.85, -.18), this.point(-.7, -.18)], reflection);

    for (let i = 0; i < 780; i++) {
      const z = -.1 + random() * 1.09;
      const [x, y, s] = this.point((random() - .5) * 2.86, z);
      ctx.fillStyle = i % 2 ? "#ecc5df18" : "#0e091f30";
      ctx.fillRect(x, y, (1 + random() * 5) * s, .68 * s);
    }
    for (let i = 0; i < 17; i++) {
      const z = -.09 + i * .063;
      const x = (random() - .5) * 1.76;
      const d = random() * .15;
      this.line(ctx, [this.point(x, z), this.point(x + d, z + .013), this.point(x + d * .81, z + .032), this.point(x + d * 1.8, z + .051)], "#1b132a75");
    }
    for (const side of [-1, 1]) {
      this.line(ctx, [this.point(side * 1.06, 1), this.point(side * 1.06, -.19)], "#df9fac81", 2.4);
      this.line(ctx, [this.point(side * .99, 1), this.point(side * .99, -.19)], "#e6a09f56", 1);
      this.line(ctx, [this.point(side * 1.17, 1), this.point(side * 1.17, -.19)], "#241b2f", 2.5);
      for (let i = 26; i >= 0; i--) {
        const z = -.1 + i * .043;
        const [x, y, s] = this.point(side * 1.17, z);
        const lamp = i % 5 === 1;
        const top = y - (lamp ? 37 : 19) * s;
        this.line(ctx, [[x + 3 * s, y + 1], [x + 3 * s, top]], "#20162b", 5 * s);
        this.line(ctx, [[x, y], [x, top]], "#7f556c", 2.4 * s);
        if (lamp) this.line(ctx, [[x - 3 * s, top], [x + 4 * s, top]], "#ff9bc3", 2.2 * s);
      }
      for (let i = 12; i >= 0; i--) {
        const z = .11 + i * .065;
        const [x, y, s] = this.point(side * (1.41 + random() * .28), z);
        const bw = (44 + random() * 61) * s * Math.max(1, w / 570);
        const bh = Math.max(h * .17, (165 + random() * 200) * s);
        const away = side * bw;
        const x2 = x + away;
        const y2 = y + 9 * s;
        const top = y - bh;
        const front = i % 2 ? "#3c2b42" : "#32273d";
        const edge = i % 2 ? "#161426" : "#242033";
        this.shape(ctx, [[x, y], [x, top], [x2, top + 18 * s], [x2, y2]], front, "#685064", .9);
        this.shape(ctx, [[x, top], [x - side * 14 * s, top - 9 * s], [x - side * 14 * s, y - 6 * s], [x, y]], edge);
        this.line(ctx, [[x + side * 4 * s, top + 2 * s], [x + side * 4 * s, y - 1]], "#b77d9466");
        for (let row = 1; row < 12; row++) {
          const wy = top + row * 15 * s + 10 * s;
          if (wy > y - 14 * s) break;
          for (let col = 1; col < 5; col++) {
            if (random() < .45) continue;
            ctx.fillStyle = ["#e793ad77", "#e2acc266", "#b98cc460", "#634563"][Math.floor(random() * 4)];
            ctx.fillRect(x + away * col / 5, wy, Math.max(1, 5 * s), Math.max(1, 4 * s));
          }
        }
        if (i === 3 || i === 8) {
          const sign = x + side * bw * .22;
          const sy = y - 55 * s;
          ctx.save();
          ctx.shadowColor = "#ff7eac";
          ctx.shadowBlur = 12 * s;
          ctx.fillStyle = "#ff98bc";
          ctx.fillRect(sign - 2 * s, sy - 28 * s, 4 * s, 30 * s);
          ctx.restore();
        }
      }
      for (let i = 1; i <= 4; i++) {
        const [x, y, s] = this.point(side * (1.34 + random() * .18), .14 + i * .145);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s);
        this.ellipse(ctx, 0, -2, 23, 5, "#100c20");
        this.crystal(ctx, side * 3, -2, 9, 38, side * .35, "#9f70bf", "#d5a2ef");
        this.crystal(ctx, -side * 10, -1, 7, 22, -side * .43, "#624c91", "#aa8cdd");
        this.crystal(ctx, side * 13, 2, 6, 20, side * .65, "#995389", "#ea91ba");
        ctx.restore();
      }
    }
    const vignette = ctx.createRadialGradient(w * .5, h * .52, h * .19, w * .5, h * .5, Math.max(w * .59, h * .66));
    vignette.addColorStop(0, "#110c1a00");
    vignette.addColorStop(1, "#100b19a0");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  motion(ctx, time) {
    for (const x of [-.34, .34]) {
      for (let i = 0; i < 16; i++) {
        const z = -.13 + ((1.14 + i * .078 - time * .126 % 1.248) % 1.248);
        if (z > .97) continue;
        const a = this.point(x - .009, z);
        const b = this.point(x + .009, z);
        const c = this.point(x + .007, z + .035);
        const d = this.point(x - .007, z + .035);
        this.shape(ctx, [a, b, c, d], "#ebc7dc55");
      }
    }
    for (let i = 0; i < 26; i++) {
      const z = .13 + (i * .087 % .92);
      const x = Math.sin(i * 8.174) * .98 + Math.sin(time * .23 + i) * .025;
      const [sx, sy, s] = this.point(x, z);
      const opacity = .18 + .1 * Math.sin(i + time * 1.7);
      ctx.globalAlpha = opacity;
      this.ellipse(ctx, sx, sy - (7 + i % 7 * 14) * s, (i % 4 === 0 ? 1.5 : .8) * s, .9 * s, i % 3 ? "#ffc1d8" : "#bdb1ff");
    }
    ctx.globalAlpha = 1;
  }

  crystal(ctx, x, y, width, height, tilt, color, light) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const outline = [[-width, -height * .18], [-width * .83, -height * .68], [0, -height], [width, -height * .71], [width * .77, -height * .26], [0, 0]];
    this.shape(ctx, outline, color, "#271c3b", 1);
    this.shape(ctx, [[-width * .83, -height * .68], [0, -height], [width * .30, -height * .6], [0, -height * .09]], light);
    this.line(ctx, [[-width * .78, -height * .66], [width * .3, -height * .6], [width * .8, -height * .7]], "#f7daf08c", .7);
    ctx.restore();
  }

  gate(ctx, item, time) {
    const [x, y, scale] = this.point(item.x, item.z);
    const half = this.roadHalf(item.z) * item.width;
    const height = Math.max(37, 79 * scale);
    const { title } = upgrades[item.kind];
    const { color, pale } = item.penalty ? redGate : upgrades[item.kind];
    const amount = gateReward(item);
    const fraction = item.charge / gateChargeMax;
    ctx.save();
    ctx.translate(x, y);
    if (item.used) ctx.globalAlpha = .2;
    const gleam = ctx.createLinearGradient(0, -height, 0, 0);
    gleam.addColorStop(0, color + (item.hit ? "a5" : "68"));
    gleam.addColorStop(.46, "#1b1428bb");
    gleam.addColorStop(.90, color + "7e");
    gleam.addColorStop(1, color);
    this.shape(ctx, [[-half, 0], [-half, -height], [half, -height], [half, 0]], gleam);
    ctx.shadowColor = color;
    ctx.shadowBlur = (item.hit ? 25 : 8) * scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.1 * scale;
    ctx.strokeRect(-half, -height, half * 2, height);
    ctx.shadowBlur = 0;
    for (const side of [-1, 1]) {
      const edge = side * half;
      ctx.fillStyle = "#171425";
      ctx.fillRect(edge - 3 * scale, -height - 5 * scale, 6 * scale, height + 9 * scale);
      this.line(ctx, [[edge, 0], [edge, -height]], pale, 1.2 * scale);
      if (item.penalty) {
        for (let i = 0; i < 3; i++) {
          const stripe = -height * (.24 + i * .20);
          this.line(ctx, [[edge - side * 3, stripe], [edge - side * 14 * scale, stripe - 7 * scale]], color, 2.2 * scale);
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      const fy = (i * .18 + time * .77) % 1;
      const fx = (((i * .618) % 1) - .5) * half * 1.65;
      this.ellipse(ctx, fx, -height * fy, 1.4 * scale, 1.4 * scale, pale);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = pale;
    ctx.strokeStyle = "#21172d";
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.font = "800 " + Math.max(9, Math.round(13 * scale)) + "px sans-serif";
    ctx.strokeText(title, 0, -height * .80);
    ctx.fillText(title, 0, -height * .80);
    ctx.font = "900 " + Math.max(10, Math.round(25 * scale)) + "px sans-serif";
    const magnitude = Math.abs(amount);
    const unit = item.kind === "cadence" ? magnitude * cadenceStep + "%" : magnitude + (item.kind === "attack" ? "级" : "");
    const label = amount === 0 ? (item.penalty ? "解除" : "满级") : (amount > 0 ? "+" : "−") + unit;
    ctx.strokeText(label, 0, -height * .51);
    ctx.fillText(label, 0, -height * .51);
    ctx.font = "800 " + Math.max(8, Math.round(10 * scale)) + "px ui-monospace, monospace";
    const charge = item.charge + "/" + gateChargeMax;
    ctx.strokeText(charge, 0, -height * .24);
    ctx.fillText(charge, 0, -height * .24);
    const bar = half * 1.5;
    const barY = -height * .12;
    const barHeight = Math.max(2, 3.5 * scale);
    ctx.fillStyle = "#2c203e";
    ctx.fillRect(-bar / 2, barY, bar, barHeight);
    ctx.fillStyle = pale;
    ctx.fillRect(-bar / 2, barY, bar * fraction, barHeight);
    ctx.fillStyle = "#1a152b";
    ctx.fillRect(-.5, barY, 1, barHeight);
    ctx.restore();
  }

  defenseLine(ctx, game) {
    const [left, y] = this.point(-1.04, finishDepth);
    const [right] = this.point(1.04, finishDepth);
    ctx.save();
    ctx.setLineDash([9, 6]);
    this.line(ctx, [[left, y], [right, y]], game.flash > 0 ? "#ff639d" : "#ffd1e289", 2);
    ctx.setLineDash([]);
    const center = this.w / 2;
    ctx.fillStyle = "#211729";
    ctx.fillRect(center - 21, y + 7, 42, 17);
    ctx.fillStyle = "#f1c1dc";
    ctx.font = "800 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("防线", center, y + 19);
    ctx.restore();
  }

  crate(ctx, item) {
    const [x, y, scale] = this.point(item.x, item.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    this.ellipse(ctx, 0, 0, 28, 7, "#130f21a0");
    this.shape(ctx, [[-24, -5], [-24, -36], [24, -36], [24, -5]], item.hit ? "#ffdfb6" : "#744b55", "#281d2d", 2);
    this.shape(ctx, [[-24, -36], [-17, -44], [17, -44], [24, -36]], "#d49279", "#312334", 1.5);
    this.shape(ctx, [[-18, -31], [18, -31], [18, -9], [-18, -9]], "#4d3645", "#b27a68", 1);
    ctx.fillStyle = "#d6a285";
    ctx.fillRect(-24, -36, 5, 31);
    ctx.fillRect(19, -36, 5, 31);
    ctx.fillStyle = "#ffca91";
    ctx.textAlign = "center";
    ctx.font = "800 15px sans-serif";
    ctx.fillStyle = "#ffabd3";
    ctx.fillText("✦", 0, -49);
    ctx.font = "900 18px ui-monospace, monospace";
    ctx.fillStyle = "#ffca91";
    ctx.fillText(item.hp, 0, -13);
    ctx.restore();
  }

  enemy(ctx, item, time) {
    const [x, y, scale] = this.point(item.x, item.z);
    const boss = item.type === "boss";
    const armor = item.type === "armored" || boss;
    const runner = item.type === "runner";
    const scaleUp = boss ? Math.min(2.85, this.w * .24 / (54 * scale)) : armor ? 1.48 : runner ? .87 : 1;
    const gait = Math.sin(time * (boss ? 4 : runner ? 15 : 10) + item.phase);
    const shell = item.hit ? "#e9daff" : "#332947";
    const spark = item.hit ? "#fff0fc" : boss ? "#ff8bc9" : armor ? "#ffb686" : runner ? "#7df1da" : "#c6adff";
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * scaleUp, scale * scaleUp);
    this.ellipse(ctx, 0, 0, 25, 6, "#100d207f");
    ctx.translate(0, boss ? -4 + gait * 2.5 : -Math.abs(gait) * 2);
    const leg = armor ? 8 : 6;
    for (const side of [-1, 1]) {
      const swing = gait * side * 4.4;
      this.shape(ctx, [[side * 4, -23], [side * 13, -23], [side * (leg + 3) + swing, -9], [side * (leg + 5) + swing, -1], [side * (leg - 3) + swing, -2], [side * 3, -13]], shell, "#191627", 1.7);
      this.shape(ctx, [[side * 12, -43], [side * 21, -38], [side * (22 + swing), -21], [side * (14 + swing), -14], [side * (16 + swing), -29], [side * 10, -33]], shell, "#1d172a", 1.6);
      this.crystal(ctx, side * 16, -32, armor ? 6.5 : 4.2, armor ? 30 : 20, side * .55, boss ? "#a1407b" : "#65529c", spark);
    }
    this.shape(ctx, [[-16, -46], [-10, -56], [10, -57], [17, -44], [12, -31], [6, -22], [-8, -23], [-13, -34]], shell, "#1b152a", 2);
    this.shape(ctx, [[-13, -44], [-5, -47], [7, -47], [14, -43], [7, -36], [0, -26], [-6, -37]], armor ? "#5c405f" : "#53436b");
    this.crystal(ctx, 0, -27, armor ? 6.8 : 5.1, 16, .13, boss ? "#c84e8b" : "#8a64c7", spark);
    this.shape(ctx, [[-9, -55], [-11, -63], [-5, -71], [5, -72], [10, -66], [10, -57], [2, -50]], shell, "#1e182c", 1.3);
    this.line(ctx, [[-6, -61], [-1, -58], [7, -62]], spark, 2.5);
    this.crystal(ctx, 4, -65, armor ? 5 : 4, armor ? 17 : 13, .24, boss ? "#a3498a" : "#7c64bf", spark);
    if (boss) {
      this.crystal(ctx, -13, -56, 5.5, 25, -.46, "#a9497f", "#ffbfe6");
      this.crystal(ctx, 13, -56, 5.5, 25, .46, "#a9497f", "#ffbfe6");
    }
    ctx.restore();
    if (!boss) {
      const rise = (armor ? 90 : 84) * scale * scaleUp;
      const width = Math.max(21, (armor ? 42 : 32) * scale * scaleUp);
      const textSize = Math.max(9, Math.round(12 * scale * scaleUp));
      ctx.save();
      ctx.font = "800 " + textSize + "px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#20172d";
      const label = (armor ? "重装 " : runner ? "疾行 " : "") + item.hp;
      ctx.strokeText(label, x, y - rise - 4);
      ctx.fillStyle = "#fff1ee";
      ctx.fillText(label, x, y - rise - 4);
      ctx.fillStyle = "#221a30";
      ctx.fillRect(x - width / 2 - 1, y - rise - 1, width + 2, 5);
      ctx.fillStyle = spark;
      ctx.fillRect(x - width / 2, y - rise, width * item.hp / item.maxHp, 3);
      ctx.restore();
    }
  }

  wing(ctx, side, flap) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.translate(11, -33);
    ctx.rotate(flap * side * .1);
    const gradient = ctx.createLinearGradient(0, -26, 26, 17);
    gradient.addColorStop(0, "#fff8ff");
    gradient.addColorStop(.47, "#e7e0fa");
    gradient.addColorStop(1, "#9e8dcc");
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(7, -10, 20, -9, 34, -28);
    ctx.bezierCurveTo(35, -17, 31, -10, 25, -4);
    ctx.bezierCurveTo(31, -7, 34, -10, 38, -14);
    ctx.bezierCurveTo(36, -6, 30, 2, 21, 5);
    ctx.bezierCurveTo(26, 4, 30, 3, 34, 0);
    ctx.bezierCurveTo(30, 8, 24, 12, 15, 12);
    ctx.bezierCurveTo(20, 13, 22, 13, 26, 12);
    ctx.bezierCurveTo(20, 20, 8, 17, 0, 11);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "#584563";
    ctx.lineWidth = 1.45;
    ctx.stroke();
    this.line(ctx, [[3, 6], [16, 1], [25, -5]], "#fff7ffb5", 1);
    this.line(ctx, [[5, 10], [17, 7], [26, 3]], "#9480b37f", 1);
    ctx.restore();
  }

  player(ctx, game, time, gun) {
    const [x, y, scale] = this.point(game.x, .067);
    const bob = Math.sin(time * 13) * (game.mode === "ready" ? .6 : 1.6);
    const activeGun = ["#ffb4d7", "#ffb387", "#b1edff"][gun];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    this.ellipse(ctx, 0, 0, 33, 8, "#160f20b6");
    ctx.beginPath();
    ctx.ellipse(0, -1, 37, 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffb3d8a8";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (game.invulnerable > 0 && Math.floor(time * 17) % 2) ctx.globalAlpha = .44;
    ctx.translate(0, bob);
    this.wing(ctx, -1, Math.sin(time * 5));
    this.wing(ctx, 1, Math.sin(time * 5));
    const stride = Math.sin(time * 13) * 1.7;
    for (const side of [-1, 1]) {
      const step = stride * side;
      this.shape(ctx, [[side * 4, -19], [side * 11, -19], [side * 10, -8 + step], [side * 12, -2 + step], [side * 5, -1 + step], [side * 4, -6 + step]], "#e2d9f3", "#534462", 1.3);
      this.shape(ctx, [[side * 4, -6 + step], [side * 11, -6 + step], [side * 13, -2 + step], [side * 5, 0 + step]], "#a68ebc", "#514060", 1.1);
    }
    this.shape(ctx, [[-11, -39], [-16, -31], [-12, -21], [-19, -16], [-9, -13], [0, -17], [10, -13], [18, -17], [11, -25], [16, -33], [10, -42]], "#eee6f8", "#5d4569", 1.6);
    this.shape(ctx, [[-8, -34], [9, -36], [12, -23], [8, -20], [0, -25], [-8, -21], [-12, -25]], "#b9a5d4");
    this.shape(ctx, [[0, -28], [-8, -19], [0, -21], [8, -19]], "#7661a2");
    ctx.save();
    ctx.translate(13, -38 + game.kick * 19);
    ctx.rotate(.18);
    this.shape(ctx, [[-3, 12], [-4, -13], [4, -17], [7, 9], [4, 15]], "#39354d", "#21192c", 1.25);
    this.shape(ctx, [[-1, 7], [-2, -20], [3, -21], [4, 8]], activeGun);
    if (game.kick > .058) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = activeGun;
      this.shape(ctx, [[0, -24], [-5, -32], [0, -29], [3, -41], [6, -30], [11, -31], [4, -24]], activeGun);
    }
    ctx.restore();
    const hair = ctx.createLinearGradient(-10, -73, 15, -36);
    hair.addColorStop(0, "#ffd0dc");
    hair.addColorStop(.49, "#ec96b4");
    hair.addColorStop(1, "#9b4c78");
    this.shape(ctx, [[-8, -56], [-19, -52], [-22, -40], [-14, -43], [-13, -34], [-4, -39], [1, -49], [8, -45], [10, -36], [16, -40], [22, -36], [20, -50], [12, -59]], "#a85983", "#5f3456", 1.1);
    ctx.beginPath();
    ctx.moveTo(-19, -54);
    ctx.bezierCurveTo(-23, -68, -11, -73, -4, -70);
    ctx.bezierCurveTo(6, -78, 21, -68, 22, -57);
    ctx.bezierCurveTo(24, -45, 16, -39, 8, -43);
    ctx.bezierCurveTo(0, -39, -10, -43, -15, -47);
    ctx.lineTo(-20, -44);
    ctx.bezierCurveTo(-18, -49, -18, -52, -19, -54);
    ctx.fillStyle = hair;
    ctx.fill();
    ctx.strokeStyle = "#744263";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    this.line(ctx, [[-12, -64], [-5, -67], [3, -65], [11, -61]], "#ffe0e6a0", 1.6);
    this.line(ctx, [[4, -66], [9, -58], [9, -52], [6, -46]], "#b7668c", 1.3);
    this.shape(ctx, [[15, -60], [21, -58], [26, -61], [24, -53], [26, -48], [19, -49], [14, -46], [15, -53]], "#b7a5de", "#6c548c", 1);
    ctx.beginPath();
    ctx.ellipse(-1, -78, 16, 4, -.09, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd4e6c9";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#ffaecf";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  projectile(ctx, item, hostile = false) {
    const [x, ground, s] = this.point(item.x, item.z);
    const y = ground - (hostile ? 29 : 58) * s;
    const tint = hostile ? "#ff85c0" : item.tint;
    const streak = hostile ? 10 : item.beam ? 24 : 11;
    ctx.save();
    ctx.shadowColor = tint;
    ctx.shadowBlur = hostile ? 10 : 6;
    this.line(ctx, [[x, y + (hostile ? -streak : streak) * s], [x, y]], tint, (hostile || item.beam ? 4 : 2.7) * s);
    this.ellipse(ctx, x, y, (hostile ? 3.1 : 1.7) * s, 2 * s, "#fff1fe");
    ctx.restore();
  }

  drawJinghong(ctx, game) {
    const cast = game.skillCast;
    const age = game.elapsed - cast.started;
    const [x, y, scale] = this.point(game.x, playerDepth);
    ctx.save();
    if (age < .46) {
      const sweep = age / .46;
      const z = playerDepth + (1 - playerDepth) * sweep;
      const [left, waveY] = this.point(-1.04, z);
      const [right] = this.point(1.04, z);
      const [origin] = this.point(cast.originX * (1 - sweep), z);
      const lift = 24 + 62 * sweep;
      ctx.globalAlpha = (1 - sweep) * .85;
      ctx.beginPath();
      ctx.moveTo(left, waveY);
      ctx.quadraticCurveTo(origin, waveY - lift, right, waveY);
      ctx.strokeStyle = jinghong.color;
      ctx.shadowColor = jinghong.color;
      ctx.shadowBlur = 17;
      ctx.lineWidth = 5 - 2 * sweep;
      ctx.stroke();
    }
    ctx.globalAlpha = Math.min(.8, (game.skillUntil - game.elapsed) * 7);
    ctx.beginPath();
    ctx.ellipse(x, y - 37 * scale, 54 * scale, 52 * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ff86c51a";
    ctx.fill();
    ctx.strokeStyle = "#ffc2e4";
    ctx.shadowColor = jinghong.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  drawDamageNumbers(ctx, game) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = jinghong.color;
    ctx.strokeStyle = "#29142b";
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    for (const number of game.damageNumbers) {
      const age = (game.elapsed - number.created) / jinghong.damageTextDuration;
      const [x, y, s] = this.point(number.x, number.z);
      const lift = number.type === "boss" ? 84 : number.type === "armored" ? 62 : 44;
      const textY = Math.max(22, y - s * lift - 31 * age);
      const size = Math.max(15, Math.round(s * 21));
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.font = "900 " + size + "px ui-monospace, monospace";
      const label = String(number.damage);
      const width = ctx.measureText(label).width;
      const spacing = width + 7;
      const middle = (number.hits - 1) / 2;
      const margin = width / 2 + middle * spacing + 4;
      const center = Math.max(margin, Math.min(this.w - margin, x));
      for (let hit = 0; hit < number.hits; hit++) {
        const textX = center + (hit - middle) * spacing;
        ctx.strokeText(label, textX, textY);
        ctx.fillText(label, textX, textY);
      }
    }
    ctx.restore();
  }

  draw(game, time, gun) {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(this.back, 0, 0, w, h);
    this.motion(ctx, time);
    this.defenseLine(ctx, game);
    for (const shot of game.shots) this.projectile(ctx, shot);
    const items = game.mode === "ready" ? [...this.demo] : [...game.actors];
    if (game.boss) items.push(game.boss);
    items.push({ type: "player", z: .067 });
    items.sort((a, b) => b.z - a.z);
    for (const item of items) {
      if (item.dead || item.z > 1 || item.z < -.11) continue;
      if (item.type === "gate") this.gate(ctx, item, time);
      else if (item.type === "crate") this.crate(ctx, item);
      else if (item.type === "player") this.player(ctx, game, time, gun);
      else this.enemy(ctx, item, item.type === "boss" ? item.age : game.mode === "ready" ? time : game.enemyTime);
    }
    for (const bolt of game.bolts) this.projectile(ctx, bolt, true);
    for (const p of game.particles) {
      const [x, y, s] = this.point(p.x, p.z);
      ctx.globalAlpha = Math.min(1, p.life * 2.65);
      this.ellipse(ctx, x, y - p.life * 23 * s, p.size * s, p.size * .65 * s, p.tint);
    }
    ctx.globalAlpha = 1;
    if (game.skillCast) this.drawJinghong(ctx, game);
    if (game.flash > 0) {
      const damage = ctx.createRadialGradient(w / 2, h / 2, h * .22, w / 2, h / 2, Math.max(w, h) * .64);
      damage.addColorStop(0, "#ff174d00");
      damage.addColorStop(1, "#ed4274c0");
      ctx.globalAlpha = game.flash * .7;
      ctx.fillStyle = damage;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (game.damageNumbers.length) this.drawDamageNumbers(ctx, game);
  }

  drawWeaponCard(canvas, gun) {
    const ctx = canvas.getContext("2d");
    const color = ["#ff9fcb", "#ffc297", "#a2e7f6"][gun];
    const bodies = [
      [[9, 29], [24, 29], [34, 20], [67, 20], [71, 26], [96, 26], [96, 32], [68, 33], [57, 34], [51, 45], [40, 45], [42, 34], [31, 34], [19, 42], [9, 41]],
      [[9, 34], [35, 30], [41, 23], [73, 23], [76, 21], [97, 21], [97, 30], [70, 32], [60, 35], [50, 35], [43, 44], [35, 44], [37, 36], [22, 41], [9, 43]],
      [[10, 35], [18, 25], [33, 25], [38, 20], [62, 20], [66, 15], [98, 15], [102, 20], [102, 33], [69, 34], [59, 38], [55, 45], [46, 45], [47, 36], [30, 36], [23, 43], [11, 43]]
    ];
    this.shape(ctx, bodies[gun], "#b3a0bc", "#25192d", 2.4);
    this.line(ctx, [[13, 34], [30, 33], [39, 26], [66, 26]], "#f4e5f1", 2);
    this.line(ctx, gun === 2 ? [[67, 20], [96, 20], [96, 29], [71, 30]] : [[58, 29], [92, 28]], color, gun === 2 ? 3.7 : 2.5);
    this.shape(ctx, [[35, 32], [54, 31], [51, 36], [40, 37]], "#53445d");
    this.ellipse(ctx, 60, 29, 2.5, 2, color);
  }
}
