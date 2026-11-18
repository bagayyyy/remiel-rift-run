"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("field");
const weapons = [
  { title: "羽芒", interval: .25, damage: 2, speed: 1.48, pellets: 1, spread: .095, hits: 1, tint: "#ffd0e7" },
  { title: "星散", interval: .58, damage: 1, speed: 1.26, pellets: 5, spread: .37, hits: 1, tint: "#ffa278" },
  { title: "破晓", interval: .88, damage: 8, speed: 2.35, pellets: 1, spread: .072, hits: 3, tint: "#a5f0ff" }
];
const lane = [-.75, -.38, 0, .38, .75];
const playerDepth = .067;
const finishDepth = .043;
const bossEvery = 4;
const gateChargeMax = 8;
const cadenceStep = 8;
const upgrades = {
  attack: { title: "攻击", cap: Infinity, color: "#ffacd4", pale: "#ffe4f4" },
  lanes: { title: "弹道", cap: 4, color: "#80e7fb", pale: "#e0fdff" },
  cadence: { title: "射速", cap: 6, color: "#e9c289", pale: "#fff1cf" }
};
const gateKinds = ["lanes", "attack", "cadence", "attack"];
const redGate = { color: "#ff667a", pale: "#ffe0e5" };
const opening = [
  [1.9, [2]], [4.5, [3]], [7.1, [1, 4]], [10.2, [0]], [13.4, [2, 3]], [16.4, [1], null, 4]
];
const visual = new ArenaRenderer(canvas);
const gunButtons = [...document.querySelectorAll(".gun")];
const keys = new Set();
let pointer = null;
let lastTime = performance.now();
let decorTime = 0;
let nextId = 0;
let nextVolley = 0;
let selected = 0;
let audio = null;

function remembered(key, fallback) {
  try { return localStorage.getItem("remiel-rift-" + key) ?? fallback; }
  catch { return fallback; }
}
function remember(key, value) {
  try { localStorage.setItem("remiel-rift-" + key, value); }
  catch { /* The game can run without browser storage. */ }
}
let best = Math.max(0, Number(remembered("endless-best", 0)) || 0);
let farthest = Math.max(0, Number(remembered("endless-wave", 0)) || 0);
let soundOn = remembered("sound", "off") === "on";

function fresh(mode) {
  return {
    mode, x: 0, targetX: 0, elapsed: 0, wave: 0, inWave: 0,
    health: 5, levels: { attack: 0, lanes: 0, cadence: 0 }, score: 0,
    invulnerable: 0, kick: 0, flash: 0, lossReason: "防线失守",
    fireIn: .08, gateIn: .65, crateIn: 9.2,
    formation: 0, formations: opening, gateCount: 0, nextWaveIn: null,
    actors: [], shots: [], bolts: [], particles: [],
    banner: "", bannerUntil: 0, ping: "", pingUntil: 0, pingTone: "",
    boss: null
  };
}
let game = fresh("ready");

function formatScore(score) {
  return String(score).padStart(5, "0");
}
function weaponDamage(gun = weapons[selected]) {
  const level = game.levels.attack;
  const bonus = level <= 5 ? level : 5 + Math.floor(8 * (Math.sqrt(1 + (level - 5) / 6) - 1));
  return gun.damage + bonus;
}
function syncLoadout() {
  const gun = weapons[selected];
  $("attackStat").textContent = weaponDamage(gun);
  $("attackTier").textContent = "Lv " + game.levels.attack;
  $("laneStat").textContent = gun.pellets + game.levels.lanes;
  $("cadenceStat").textContent = "+" + game.levels.cadence * cadenceStep + "%";
}
function syncBoss() {
  $("bossHud").hidden = !game.boss;
  if (game.boss) {
    $("bossLife").style.width = 100 * game.boss.hp / game.boss.maxHp + "%";
    const stats = game.boss.hp + " / " + game.boss.maxHp + "  ·  距防线 " + Math.ceil(Math.max(0, game.boss.approach - game.boss.age)) + " 秒";
    if ($("bossStats").textContent !== stats) $("bossStats").textContent = stats;
  }
}
function syncHud() {
  $("health").setAttribute("aria-valuenow", game.health);
  [...$("health").children].forEach((cell, i) => cell.classList.toggle("empty", i >= game.health));
  $("score").value = formatScore(game.score);
  $("best").textContent = formatScore(best);
  $("farthest").textContent = farthest ? "最远 " + farthest + " 波" : "";
  syncLoadout();
  $("waveLabel").textContent = "第 " + String(game.wave + 1).padStart(2, "0") + " 波 · " + (bossWave() ? "首领" : "无限模式");
  syncBoss();
}
function score(points) {
  const previousBest = best;
  game.score += points;
  best = Math.max(game.score, best);
  if (best > previousBest) remember("endless-best", best);
  syncHud();
}
function announce(message) {
  $("announcement").textContent = message;
}
function notice(message, danger = false) {
  game.ping = message;
  game.pingUntil = game.elapsed + 1.05;
  game.pingTone = danger ? "danger" : "";
  announce(message);
}
function showBanner(message) {
  game.banner = message;
  game.bannerUntil = game.elapsed + 1.55;
  announce(message);
}
function selectGun(index) {
  if (!weapons[index] || index === selected) return;
  selected = index;
  gunButtons.forEach((button, i) => button.setAttribute("aria-pressed", i === index));
  syncLoadout();
  play("select");
  announce("已切换至" + weapons[index].title);
}
function syncSound() {
  const button = $("soundBtn");
  const label = soundOn ? "关闭音效" : "开启音效";
  button.setAttribute("aria-pressed", soundOn);
  button.setAttribute("aria-label", label);
  button.title = label;
}
function wakeAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!soundOn || !AudioContext) return;
  try {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch { audio = null; }
}
const sounds = {
  fire: [320, 115, .056, .018, "triangle"], hit: [165, 74, .2, .065, "sawtooth"],
  crystal: [680, 1190, .12, .05, "triangle"], gate: [420, 930, .22, .06, "sine"],
  start: [296, 590, .22, .06, "triangle"], select: [490, 640, .08, .04, "sine"],
  boss: [145, 65, .45, .06, "triangle"], finish: [310, 1030, .58, .08, "triangle"]
};
function play(name) {
  if (!soundOn || audio?.state !== "running") return;
  const [from, to, duration, volume, type] = sounds[name];
  const now = audio.currentTime;
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.type = type;
  tone.frequency.setValueAtTime(from, now);
  tone.frequency.exponentialRampToValueAtTime(to, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  tone.connect(gain);
  gain.connect(audio.destination);
  tone.start(now);
  tone.stop(now + duration);
}
function setScreen(mode) {
  const previous = game.mode;
  game.mode = mode;
  const modes = {
    ready: ["E N D L E S S   /   R I F T   R U N", "裂隙突围", "射击改变门的收益，每四波迎战首领。", "开始突围", "待命"],
    paused: ["P A U S E D", "行动暂停", "雷米埃尔正在等你归队。", "继续突围", "已暂停"],
    lost: ["M I S S I O N   F A I L E D", "突围中断", game.lossReason + " · 第 " + (game.wave + 1) + " 波 · 得分 " + formatScore(game.score), "再试一次", "行动结束"]
  };
  const screen = modes[mode];
  $("screen").hidden = !screen;
  $("restartBtn").hidden = mode !== "paused";
  $("pauseBtn").disabled = mode !== "playing" && mode !== "paused";
  $("pauseBtn").title = mode === "paused" ? "继续 / P" : "暂停 / P";
  $("pauseBtn").setAttribute("aria-label", mode === "paused" ? "继续" : "暂停");
  $("status").textContent = screen ? screen[4] : "作战中";
  if (screen) {
    $("screenKicker").textContent = screen[0];
    $("screenTitle").textContent = screen[1];
    $("screenText").textContent = screen[2];
    const button = $("startBtn");
    button.firstChild.nodeValue = screen[3] + " ";
    if (previous !== mode) {
      keys.clear();
      pointer = null;
      if (!document.hidden) button.focus({ preventScroll: true });
    }
  }
}
function start() {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) focused.blur();
  wakeAudio();
  game = fresh("playing");
  keys.clear();
  pointer = null;
  setScreen("playing");
  beginWave(0);
  play("start");
}
function pause() {
  if (game.mode === "playing") setScreen("paused");
  else if (game.mode === "paused") {
    $("startBtn").blur();
    wakeAudio();
    setScreen("playing");
  }
}
function lose(reason) {
  game.lossReason = reason;
  setScreen("lost");
  announce(reason);
}
function hurt(amount, reason) {
  game.health = Math.max(0, game.health - amount);
  game.invulnerable = .8;
  game.flash = 1;
  syncHud();
  play("hit");
  if (game.health <= 0) {
    lose(reason);
    return;
  }
  notice(reason + " · 生命 −" + amount, true);
}
function actor(type, x, z, details) {
  return { id: ++nextId, type, x, z, phase: Math.random() * 6.28, hit: 0, ...details };
}
function bossWave() {
  return (game.wave + 1) % bossEvery === 0;
}
function isThreat(item) {
  return item.type === "enemy" || item.type === "runner" || item.type === "armored";
}
function makeEnemy(x, z, type = "enemy") {
  const depth = game.wave;
  const heavy = type === "armored";
  const runner = type === "runner";
  const normalHp = 7 + 3.3 * depth + .83 * depth ** 1.64;
  const hp = Math.round(heavy ? 31 + 13 * depth + 4.3 * depth ** 1.62 : normalHp * (runner ? .74 : 1));
  const rush = Math.min(.088, .008 * depth);
  return actor(type, x, z, {
    baseX: x, hp, maxHp: hp, speed: (heavy ? .117 : runner ? .202 : .144) + rush,
    armor: heavy ? 1 + Math.floor(depth / 4) : 0, width: heavy ? .155 : runner ? .095 : .108
  });
}
function spawnFormation([, lanes, heavyLane, runnerLane]) {
  lanes.forEach((index, i) => game.actors.push(makeEnemy(lane[index], .99 + i * .13)));
  if (heavyLane != null) game.actors.push(makeEnemy(lane[heavyLane], .99, "armored"));
  if (runnerLane != null) game.actors.push(makeEnemy(lane[runnerLane], 1.12, "runner"));
}
function makeFormations(index) {
  if (index === 0) return opening;
  const boss = bossWave();
  const tier = Math.floor(index / bossEvery);
  const count = boss ? 3 : Math.min(12, 7 + Math.floor((index + 1) / 3));
  const gap = boss ? 5.1 : Math.max(1.58, 3 - .075 * index);
  const start = boss ? 4.2 : .95;
  const extraPairs = Math.min(3, Math.max(0, Math.floor((index - 5) / 4)));
  const rotation = Math.floor(Math.random() * lane.length);
  const direction = Math.random() < .5 ? -1 : 1;
  return Array.from({ length: count }, (_, i) => {
    const step = (j) => (rotation + lane.length + direction * ((i * 2 + j) % lane.length)) % lane.length;
    const heavy = boss ? tier >= 2 && i === 0 : i % 3 === 2 || (index >= 8 && i === 0);
    const runner = boss || (i + index) % (index >= 9 ? 2 : 3) === 0;
    const lanes = [step(0)];
    if (!boss && (i + 1) % (index < 2 ? 3 : 2) === 0) lanes.push(step(2));
    if (!boss && i < extraPairs) lanes.push(step(4));
    return [start + i * gap, lanes, heavy ? step(1) : null, runner ? step(3) : null];
  });
}
function beginWave(index) {
  game.wave = index;
  game.inWave = 0;
  game.formation = 0;
  game.formations = makeFormations(index);
  game.nextWaveIn = null;
  if (index + 1 > farthest) {
    farthest = index + 1;
    remember("endless-wave", farthest);
  }
  if (bossWave()) spawnBoss();
  else showBanner("第 " + (index + 1) + " 波 · " + (index === 0 ? "守住防线" : "以骸来袭"));
  syncHud();
}
function spawnGates() {
  const order = game.gateCount;
  const goodKind = gateKinds[order % gateKinds.length];
  const badKind = gateKinds[(order + 1) % gateKinds.length];
  const heavy = game.actors.find((item) => !item.dead && item.type === "armored" && Math.abs(item.baseX) > .1);
  const side = heavy && order % 3 !== 0 ? -Math.sign(heavy.baseX) : order % 2 === 0 ? 1 : -1;
  const penalty = game.wave >= 6 && order % 3 === 2 ? 3 : 2;
  const speed = .191 + Math.min(.051, .0035 * game.wave);
  game.actors.push(
    actor("gate", side * .51, .99, { kind: goodKind, penalty: 0, charge: 0, volleys: new Set(), width: .405, speed }),
    actor("gate", -side * .51, .99, { kind: badKind, penalty, charge: 0, volleys: new Set(), width: .485, speed })
  );
  game.gateCount++;
}
function gateReward(item) {
  const tiers = Math.floor(item.charge / (gateChargeMax / 2));
  if (item.penalty) return Math.min(0, tiers - item.penalty);
  const available = upgrades[item.kind].cap - game.levels[item.kind];
  return Math.min(available, 1 + tiers);
}
function spawnCrate() {
  const hp = Math.round(12 + 2.4 * game.wave + .19 * game.wave ** 1.4);
  const x = lane[Math.floor(Math.random() * lane.length)];
  game.actors.push(actor("crate", x, .98, {
    hp, maxHp: hp, speed: .16, width: .12
  }));
}
function spawnBoss() {
  const tier = Math.floor(game.wave / bossEvery);
  const hp = Math.round(690 * (1 + .82 * tier + .31 * tier ** 1.70));
  const approach = Math.max(14, 24 - 1.15 * tier);
  game.boss = actor("boss", 0, 1.02, {
    hp, maxHp: hp, width: .235, fireIn: .85, age: 0, pattern: 0, tier, approach,
    speed: (1.02 - finishDepth) / approach
  });
  showBanner("第 " + (game.wave + 1) + " 波 · 裂隙暴君");
  play("boss");
}
function updateSpawns(dt) {
  game.inWave += dt;
  const formation = !bossWave() || game.boss ? game.formations[game.formation] : null;
  if (formation && game.inWave >= formation[0]) {
    spawnFormation(formation);
    game.formation++;
  }
  if (!formation && !game.boss && !game.actors.some(isThreat)) {
    game.nextWaveIn ??= bossWave() ? 2.1 : 1.4;
    game.nextWaveIn -= dt;
    if (game.nextWaveIn <= 0) beginWave(game.wave + 1);
  }
  game.crateIn -= dt;
  if (game.crateIn <= 0) {
    spawnCrate();
    game.crateIn += 15.8 + Math.min(6.2, .45 * game.wave);
  }
  game.gateIn -= dt;
  if (game.gateIn <= 0) {
    spawnGates();
    game.gateIn += 10.6 + Math.min(2.6, .23 * game.wave);
  }
}
function fire() {
  const gun = weapons[selected];
  const volley = ++nextVolley;
  const damage = weaponDamage(gun);
  const extra = game.levels.lanes;
  const count = gun.pellets + extra;
  for (let i = 0; i < count; i++) {
    const bonusIndex = i - gun.pellets;
    const bonus = bonusIndex >= 0;
    const side = (bonusIndex + volley) % 2 === 0 ? 1 : -1;
    const fan = gun.pellets === 1 ? 0 : 2 * i / (gun.pellets - 1) - 1;
    const muzzle = bonus ? side * (.027 + .019 * Math.floor(bonusIndex / 2)) : fan * .036;
    const spread = bonus ? side * (.073 + .048 * Math.floor(bonusIndex / 2)) : fan * gun.spread;
    game.shots.push({
      x: game.x + muzzle, z: playerDepth + .009, vx: spread,
      remaining: gun.hits, hitIds: new Set(), volley,
      speed: gun.speed, damage: bonus ? Math.max(1, Math.floor(damage / 2)) : damage,
      tint: gun.tint, beam: selected === 2, bonus
    });
  }
  game.kick = .1;
  play("fire");
}
function burst(x, z, tint, count) {
  for (let i = 0; i < count; i++) {
    game.particles.push({ x, z, vx: (Math.random() - .5) * .92, vz: (Math.random() - .5) * .5, tint,
      life: .23 + Math.random() * .33, size: 1.1 + Math.random() * 3.8 });
  }
}
function destroy(target) {
  target.dead = true;
  if (target.type === "boss") {
    game.boss = null;
    game.bolts.length = 0;
    const healed = game.health < 5;
    if (healed) game.health++;
    burst(target.x, target.z, "#ffd4f2", 64);
    score(1000 + 350 * target.tier);
    showBanner("首领击破" + (healed ? " · 生命 +1" : ""));
    play("finish");
    return;
  }
  if (target.type === "crate") {
    if (game.health < 5) {
      game.health++;
      notice("补给回收 · 生命 +1");
    } else {
      notice("补给回收 · 生命已满");
    }
    burst(target.x, target.z, "#ffc582", 14);
    score(45);
    play("gate");
    return;
  }
  burst(target.x, target.z, "#bbb4ff", target.type === "armored" ? 15 : 9);
  score(target.type === "armored" ? 155 : target.type === "runner" ? 95 : 75);
  play("crystal");
}
function updateShots(dt) {
  const targets = game.actors.filter((a) => !a.used && !a.dead);
  if (game.boss) targets.push(game.boss);
  for (const shot of game.shots) {
    const prevZ = shot.z;
    const prevX = shot.x;
    shot.z += shot.speed * dt;
    shot.x += shot.vx * dt;
    const hits = [];
    for (const target of targets) {
      const gate = target.type === "gate";
      if (target.dead || shot.hitIds.has(target.id) || (gate && (target.charge >= gateChargeMax || target.volleys.has(shot.volley)))) continue;
      const before = prevZ - (target.prevZ ?? target.z);
      const after = shot.z - target.z;
      const margin = gate ? 0 : .033;
      if ((gate ? before >= 0 : before > margin) || after < -margin) continue;
      const part = Math.max(0, (-margin - before) / (after - before));
      if (Math.abs(prevX + (shot.x - prevX) * part - target.x) <= target.width) hits.push({ target, part });
    }
    hits.sort((a, b) => a.part - b.part);
    for (const { target } of hits) {
      if (target.type === "gate") {
        target.volleys.add(shot.volley);
        target.charge++;
        target.hit = .18;
        continue;
      }
      shot.hitIds.add(target.id);
      target.hp -= Math.max(1, shot.damage - (shot.beam ? 0 : target.armor ?? 0));
      target.hit = .085;
      if (target.hp <= 0) destroy(target);
      else if (target.type === "boss") syncBoss();
      if (--shot.remaining <= 0) break;
    }
  }
  game.shots = game.shots.filter((s) => s.remaining > 0 && s.z < 1.12 && Math.abs(s.x) < 1.22);
}
function moveActors(dt) {
  for (const item of game.actors) {
    item.prevZ = item.z;
    item.z -= item.speed * dt;
    item.hit = Math.max(0, item.hit - dt);
    if (isThreat(item)) {
      const runner = item.type === "runner";
      item.x = item.baseX + (runner ? .079 : .039) * Math.sin(game.elapsed * (runner ? 5 : 3.5) + item.phase);
    }
  }
}
function applyGate(item) {
  const change = gateReward(item);
  const { title, color } = upgrades[item.kind];
  const level = game.levels[item.kind];
  const next = Math.max(0, level + change);
  const actual = next - level;
  const label = item.kind === "cadence" ? Math.abs(actual) * cadenceStep + "%" : Math.abs(actual) + (item.kind === "attack" ? " 级" : "");
  game.levels[item.kind] = next;
  if (actual > 0) {
    score(25 * actual);
    notice(title + " +" + label);
  } else if (level + change < 0) {
    hurt(1, "红门反噬" + (actual < 0 ? " · " + title + " −" + label : ""));
  } else {
    syncHud();
    if (actual < 0) notice(title + " −" + label, true);
    else notice(item.penalty ? "红门减益已解除" : title + "已满");
  }
  burst(game.x, playerDepth, item.penalty ? redGate.color : color, 15);
  play(actual < 0 ? "hit" : "gate");
}
function resolveFinish() {
  let leaks = 0;
  let breached = game.boss && game.boss.z <= finishDepth ? "裂隙暴君突破防线" : "";
  for (const item of game.actors) {
    if (item.dead) continue;
    if (item.type === "gate") {
      if (item.used || item.z > playerDepth) continue;
      item.used = true;
      if (Math.abs(item.x - game.x) > item.width) continue;
      applyGate(item);
      continue;
    }
    if (item.z > finishDepth) continue;
    item.dead = true;
    if (item.type === "crate") continue;
    if (item.type === "armored") breached ||= "重装以骸突破防线";
    else leaks++;
    burst(item.x, finishDepth, "#ff85a6", 12);
  }
  game.actors = game.actors.filter((a) => !a.dead && a.z > -.11);
  if (game.mode !== "playing") return;
  if (breached) {
    game.flash = 1;
    play("hit");
    lose(breached);
  } else if (leaks) hurt(leaks, "小型以骸突破防线");
}
function moveBoss(dt) {
  const boss = game.boss;
  if (!boss) return;
  boss.age += dt;
  boss.hit = Math.max(0, boss.hit - dt);
  boss.prevZ = boss.z;
  boss.z -= boss.speed * dt;
  boss.x = Math.sin(boss.age * (.83 + Math.min(.28, boss.tier * .052))) * .53 + Math.sin(boss.age * 2.1) * .081;
  syncBoss();
  if (boss.z > .90 || boss.z < .17) return;
  boss.fireIn -= dt;
  if (boss.fireIn > 0) return;
  const rage = boss.hp < boss.maxHp * .45;
  const speed = (rage ? .44 : .36) + Math.min(.09, boss.tier * .012);
  const z = boss.z - .045;
  const aimed = (game.x - boss.x) * speed / (z - playerDepth);
  const offsets = boss.pattern % 2 === 0 ? [-.32, 0, .32] : [-.17, .17];
  for (const offset of offsets) game.bolts.push({ x: boss.x, z, vx: aimed + offset, speed });
  boss.pattern++;
  boss.fireIn = (rage ? 1.21 : 1.83) - Math.min(.36, boss.tier * .052);
}
function moveBolts(dt) {
  for (const bolt of game.bolts) {
    const before = bolt.z;
    bolt.x += bolt.vx * dt;
    bolt.z -= bolt.speed * dt;
    if (before >= playerDepth && bolt.z < playerDepth && Math.abs(bolt.x - game.x) < .13) {
      bolt.dead = true;
      burst(game.x, playerDepth, "#ff9bce", 8);
      if (game.invulnerable <= 0) hurt(1, "被首领弹幕击中");
      if (game.mode !== "playing") break;
    }
  }
  game.bolts = game.bolts.filter((b) => !b.dead && b.z > -.04 && Math.abs(b.x) < 1.3);
}
function moveParticles(dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}
function update(dt) {
  game.elapsed += dt;
  game.kick = Math.max(0, game.kick - dt);
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  game.flash = Math.max(0, game.flash - dt * 5);
  const move = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
  if (move) game.targetX = Math.max(-.93, Math.min(.93, game.targetX + move * dt * 1.85));
  game.x += (game.targetX - game.x) * Math.min(1, dt * 14);
  updateSpawns(dt);
  moveActors(dt);
  moveBoss(dt);
  game.fireIn -= dt;
  if (game.fireIn <= 0) {
    fire();
    game.fireIn += weapons[selected].interval / (1 + game.levels.cadence * cadenceStep / 100);
  }
  updateShots(dt);
  resolveFinish();
  if (game.mode === "playing") moveBolts(dt);
  moveParticles(dt);
}
function showMessages() {
  $("banner").hidden = game.mode !== "playing" || game.bannerUntil <= game.elapsed;
  if (!$("banner").hidden && $("banner").textContent !== game.banner) $("banner").textContent = game.banner;
  $("ping").hidden = game.mode !== "playing" || game.pingUntil <= game.elapsed;
  if (!$("ping").hidden && $("ping").textContent !== game.ping) {
    $("ping").textContent = game.ping;
    $("ping").dataset.tone = game.pingTone;
  }
}
function frame(time) {
  const dt = Math.min(.10, Math.max(0, (time - lastTime) / 1000));
  lastTime = time;
  if (game.mode === "ready") decorTime += dt;
  for (let remaining = dt; remaining > 0 && game.mode === "playing";) {
    const step = Math.min(.025, remaining);
    update(step);
    remaining -= step;
  }
  visual.draw(game, game.mode === "ready" ? decorTime * .38 : game.elapsed, selected);
  showMessages();
  requestAnimationFrame(frame);
}

$("startBtn").addEventListener("click", () => game.mode === "paused" ? pause() : start());
$("restartBtn").addEventListener("click", start);
$("pauseBtn").addEventListener("click", pause);
$("soundBtn").addEventListener("click", () => {
  soundOn = !soundOn;
  remember("sound", soundOn ? "on" : "off");
  wakeAudio();
  syncSound();
  play("select");
});
gunButtons.forEach((button, i) => {
  visual.drawWeaponCard(button.querySelector("canvas"), i);
  button.addEventListener("click", () => selectGun(i));
});
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(key) && game.mode === "playing") {
    e.preventDefault();
    keys.add(key);
  }
  if (e.repeat) return;
  if (["1", "2", "3"].includes(key)) selectGun(Number(key) - 1);
  if (key === "p" || key === "Escape") pause();
});
document.addEventListener("keyup", (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
function aim(e) {
  const rect = canvas.getBoundingClientRect();
  game.targetX = Math.max(-.93, Math.min(.93, (e.clientX - rect.left - rect.width / 2) / visual.roadHalf(playerDepth)));
}
canvas.addEventListener("pointerdown", (e) => {
  if (game.mode !== "playing" || pointer !== null || e.button !== 0) return;
  pointer = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  aim(e);
});
canvas.addEventListener("pointermove", (e) => {
  if (pointer === e.pointerId && game.mode === "playing") aim(e);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(type, (e) => { if (e.pointerId === pointer) pointer = null; });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.mode === "playing") pause();
});
window.addEventListener("blur", () => keys.clear());

syncSound();
syncHud();
setScreen("ready");
requestAnimationFrame(frame);
