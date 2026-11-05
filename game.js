(function () {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const hud = document.getElementById('hud');
  const healthFill = document.getElementById('health-fill');
  const healthText = document.getElementById('health-text');
  const scoreValue = document.getElementById('score-value');
  const waveValue = document.getElementById('wave-value');
  const startScreen = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over-screen');
  const finalScore = document.getElementById('final-score');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');

  // ---------- Input state ----------
  const keys = {};
  const mouse = { x: W / 2, y: H / 2, down: false };

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  // ---------- Game state ----------
  let player, bullets, enemies, enemyBullets, particles, floatingTexts;
  let score, wave, running, lastTime, shootCooldown, enemySpawnTimer, shake;

  function resetGame() {
    player = {
      x: W / 2,
      y: H / 2,
      r: 22,
      speed: 240,
      maxHp: 100,
      hp: 100,
      angle: 0
    };
    bullets = [];
    enemies = [];
    enemyBullets = [];
    particles = [];
    floatingTexts = [];
    score = 0;
    wave = 1;
    shootCooldown = 0;
    enemySpawnTimer = 0;
    shake = 0;
    running = true;
    updateHud();
  }

  // ---------- Helpers ----------
  function updateHud() {
    const hp = Math.max(0, player.hp);
    const pct = (hp / player.maxHp) * 100;
    healthFill.style.width = pct + '%';
    healthFill.style.background =
      pct > 50 ? 'linear-gradient(90deg, #39d353, #2ee56f)' :
      pct > 25 ? 'linear-gradient(90deg, #ffb020, #ffcc44)' :
      'linear-gradient(90deg, #ff4444, #ff6b6b)';
    healthText.textContent = Math.round(hp);
    scoreValue.textContent = score;
    waveValue.textContent = wave;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // ---------- Spawning ----------
  function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = -30; y = Math.random() * H; }
    else if (side === 1) { x = W + 30; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = -30; }
    else { x = Math.random() * W; y = H + 30; }

    const type = Math.random() < 0.3 ? 'heavy' : 'scout';
    const hp = type === 'heavy' ? 80 + wave * 10 : 40 + wave * 6;
    enemies.push({
      x, y,
      r: type === 'heavy' ? 22 : 15,
      hp,
      maxHp: hp,
      speed: type === 'heavy' ? 60 : 120 + wave * 4,
      type,
      shootTimer: Math.random() * 2,
      scoreVal: type === 'heavy' ? 20 : 10
    });
  }

  function fireBullet() {
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    const muzzleX = player.x + cos * (player.r + 10);
    const muzzleY = player.y + sin * (player.r + 10);
    bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: cos * 640,
      vy: sin * 640,
      r: 5,
      life: 1
    });
    spawnParticles(muzzleX, muzzleY, 4, '#8fd0ff', 0.2);
    shootCooldown = 0.15;
  }

  function enemyFire(enemy) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const speed = enemy.type === 'heavy' ? 150 : 210;
    enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 4
    });
  }

  // ---------- Effects ----------
  function spawnParticles(x, y, count, color, spread) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (Math.random() + 0.2) * 120;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        r: 2 + Math.random() * 3,
        color
      });
    }
    if (spread !== undefined) { shake = Math.max(shake, spread * 5); }
  }

  function addFloatText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  // ---------- Update ----------
  function update(dt) {
    // Player movement
    let dx = 0, dy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      player.x += (dx / len) * player.speed * dt;
      player.y += (dy / len) * player.speed * dt;
    }
    player.x = Math.max(player.r, Math.min(W - player.r, player.x));
    player.y = Math.max(player.r, Math.min(H - player.r, player.y));

    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // Shooting
    if (shootCooldown > 0) shootCooldown -= dt;
    if (mouse.down && shootCooldown <= 0) fireBullet();

    // Enemies
    enemySpawnTimer -= dt;
    const spawnInterval = Math.max(0.4, 1.6 - wave * 0.1);
    if (enemySpawnTimer <= 0) {
      spawnEnemy();
      enemySpawnTimer = spawnInterval;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(ang) * e.speed * dt;
      e.y += Math.sin(ang) * e.speed * dt;

      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist(e, player) < 480) {
        enemyFire(e);
        e.shootTimer = e.type === 'heavy' ? 2.4 : 1.4;
      }
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 1.6;
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        bullets.splice(i, 1);
        continue;
      }
      // Hit enemies
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (dist(b, e) < b.r + e.r) {
          e.hp -= 25;
          spawnParticles(b.x, b.y, 5, '#ff9d5c', 0.6);
          if (e.hp <= 0) {
            score += e.scoreVal;
            spawnParticles(e.x, e.y, 14, '#ff5c5c', 1.2);
            addFloatText(e.x, e.y - 14, '+' + e.scoreVal, '#ffd166');
            enemies.splice(j, 1);
          }
          hit = true;
          break;
        }
      }
      if (hit) { bullets.splice(i, 1); }
    }

    // Enemy bullets vs player
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        enemyBullets.splice(i, 1);
        continue;
      }
      if (dist(b, player) < b.r + player.r) {
        player.hp -= 12;
        shake = Math.max(shake, 8);
        spawnParticles(b.x, b.y, 10, '#ff4444', 1);
        enemyBullets.splice(i, 1);
        if (player.hp <= 0) {
          endGame();
          return;
        }
      }
    }

    // Enemies touching player
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (dist(e, player) < e.r + player.r) {
        player.hp -= 20;
        shake = Math.max(shake, 10);
        spawnParticles(player.x, player.y, 12, '#ff4444', 1.4);
        enemies.splice(i, 1);
        if (player.hp <= 0) {
          endGame();
          return;
        }
      }
    }

    // Wave progression
    if (enemies.length === 0 && enemySpawnTimer <= 0) {
      wave++;
      updateHud();
      enemySpawnTimer = 2;
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.y -= 30 * dt;
      t.life -= dt;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }

    if (shake > 0) shake *= Math.pow(0.001, dt);
    updateHud();
  }

  function endGame() {
    running = false;
    finalScore.textContent = score;
    hud.classList.remove('visible');
    gameOverScreen.classList.remove('hidden');
  }

  // ---------- Draw ----------
  function drawMech(m, friendly) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);

    // legs / torso
    ctx.fillStyle = friendly ? '#2a4d8f' : '#7d3f2a';
    ctx.fillRect(-m.r * 0.55, -m.r * 0.7, m.r * 0.55, m.r * 1.4);
    // cockpit
    ctx.fillStyle = friendly ? '#4ec3ff' : '#ff4e4e';
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // barrel
    ctx.fillStyle = friendly ? '#8fd0ff' : '#c96a4a';
    ctx.fillRect(0, -m.r * 0.18, m.r + 12, m.r * 0.36);

    ctx.restore();
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(60, 90, 130, 0.12)';
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (shake > 0.3) {
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      ctx.translate(sx, sy);
    }

    drawGrid();

    // Player
    if (running) drawMech(player, true);

    // Enemies
    for (const e of enemies) {
      drawMech(e, false);
      // hp bar
      const frac = e.hp / e.maxHp;
      ctx.fillStyle = '#1a2436';
      ctx.fillRect(e.x - 20, e.y - e.r - 12, 40, 4);
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(e.x - 20, e.y - e.r - 12, 40 * frac, 4);
    }

    // Bullets
    ctx.fillStyle = '#8fd0ff';
    for (const b of bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }

    // Enemy bullets
    ctx.fillStyle = '#ff5c5c';
    for (const b of enemyBullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }

    // Particles
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating texts
    ctx.font = 'bold 15px Courier New';
    ctx.textAlign = 'center';
    for (const t of floatingTexts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ---------- Loop ----------
  function loop(ts) {
    if (lastTime === undefined) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    dt = Math.min(dt, 0.05);

    if (running) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Start ----------
  function startGame() {
    resetGame();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.add('visible');
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  resetGame();
  requestAnimationFrame(loop);
})();
