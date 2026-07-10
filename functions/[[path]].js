import { Hono } from 'hono';

const app = new Hono();

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

function renderCreateRoomPage(error = '') {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workout SaaS: Создать комнату</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #ffffff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
    .container { width: 90%; max-width: 900px; }
    .header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
    .header h1 { color: #2D3748; font-size: 32px; font-weight: 700; margin: 0; }
    .card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 30px; }
    .form-group { margin-bottom: 25px; position: relative; }
    .label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    label { font-size: 14px; color: #718096; }
    .help-icon { color: #A0AEC0; font-size: 14px; cursor: pointer; transition: color 0.2s; }
    .help-icon:hover { color: #FF5A50; }
    input { width: 100%; padding: 14px 18px; background-color: #EDF2F7; border: 1px solid transparent; border-radius: 10px; font-size: 16px; color: #2D3748; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #CBD5E0; }
    .password-toggle { position: absolute; right: 18px; bottom: 14px; color: #2D3748; cursor: pointer; }
    .btn-submit { background-color: #FF5A50; color: white; border: none; border-radius: 10px; padding: 12px 25px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
    .btn-submit:hover { background-color: #E54E45; }
    .alert-danger { background-color: #FFF5F5; border: 1px solid #FEB2B2; color: #C53030; padding: 12px 18px; border-radius: 10px; font-size: 14px; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <span>🚀</span>
    <h1>Workout SaaS: Создать комнату</h1>
  </div>
  ${error ? `<div class="alert-danger"><i class="fas fa-exclamation-triangle"></i>${error}</div>` : ''}
  <form action="/create_room" method="POST" class="card">
    <div class="form-group">
      <div class="label-row"><label>Название (напр: Моя Качалка)</label></div>
      <input type="text" name="title" required>
    </div>
    <div class="form-group">
      <div class="label-row">
        <label>Придумайте адрес для ссылки (напр: matrix, kachalka77)</label>
        <i class="far fa-question-circle help-icon" onclick="alert('Ссылка на комнату будет: https://ВАШ_САЙТ.pages.dev/ВАШ_АДРЕС')"></i>
      </div>
      <input type="text" name="slug" required>
    </div>
    <div class="form-group">
      <div class="label-row"><label>Пароль админа</label></div>
      <input type="password" name="password" id="passwordField" required>
      <i class="far fa-eye password-toggle" onclick="document.getElementById('passwordField').type = (document.getElementById('passwordField').type === 'password' ? 'text' : 'password')"></i>
    </div>
    <div class="form-group">
      <div class="label-row">
        <label>ID чата в Telegram (необязательно)</label>
        <i class="far fa-question-circle help-icon" onclick="alert('Добавьте бота @Cardioid_Cat_AllBot в группу, дайте права админа и узнайте ID чата у @getidsbot')"></i>
      </div>
      <input type="text" name="tg_id">
    </div>
    <button type="submit" class="btn-submit">Создать комнату</button>
  </form>
</div>
</body>
</html>`;
}

function renderRoomPage(room, profiles, ex_types, games, logs, summary, hall_of_fame, is_admin, last_action_text, ex_icons, ex_map) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${room.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
  <style>
    body { background: #FFFFFF; font-family: 'Inter', sans-serif; display: flex; min-height: 100vh; margin: 0; }
    .sidebar { width: 260px; background: #F1F3F9; border-right: 1px solid #E2E8F0; padding: 25px 15px; }
    .main-content { flex-grow: 1; padding: 25px; }
    .btn-main { background: #FF5A50; color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; width: 100%; }
    .accordion-button:not(.collapsed) { background-color: #FFF5F5; color: #FF5A50; }
  </style>
</head>
<body>
<div class="sidebar">
  <h5>⚙️ Настройки</h5>
  ${is_admin ? `<a href="/logout?slug=${room.slug}" class="btn btn-sm btn-light mb-2">Выйти</a>` : `
    <form action="/login" method="POST">
      <input type="hidden" name="slug" value="${room.slug}">
      <input type="password" name="password" class="form-control form-control-sm mb-2" placeholder="Пароль">
      <button class="btn btn-dark btn-sm w-100">Войти</button>
    </form>`}
  <hr>
  <h6>Участники</h6>
  <ul class="list-unstyled">
    ${profiles.results.map(p => `<li>👤 ${p.name}</li>`).join('')}
  </ul>
  <h6>Упражнения</h6>
  <ul class="list-unstyled">
    ${ex_types.results.filter(e => e.name !== '🏆 Победа').map(e => `<li>${e.unit_type === 'time' ? '🕒' : '💪'} ${e.name}</li>`).join('')}
  </ul>
  <h6>Игры</h6>
  <ul class="list-unstyled">
    ${games.results.map(g => `<li>🎲 ${g.game_name} (${g.val} ${g.ex_name})</li>`).join('')}
  </ul>
  ${is_admin ? `<p class="small mt-3">${last_action_text || 'Нет действий'}</p><a href="/undo/${room.slug}" class="btn btn-sm btn-outline-dark">↩ Отменить</a>` : ''}
</div>
<div class="main-content">
  <h1>${room.title}</h1>
  ${is_admin ? `
  <div class="row g-3 mb-4">
    <div class="col-md-6">
      <form action="/add_profile" method="POST">
        <input type="hidden" name="slug" value="${room.slug}">
        <div class="input-group">
          <input type="text" name="name" class="form-control" placeholder="Имя участника" required>
          <button class="btn btn-dark">+ Добавить</button>
        </div>
      </form>
    </div>
    <div class="col-md-6">
      <form action="/add_exercise" method="POST">
        <input type="hidden" name="slug" value="${room.slug}">
        <div class="input-group">
          <input type="text" name="name" class="form-control" placeholder="Название упражнения" required>
          <select name="unit_type" class="form-select" style="max-width: 130px;">
            <option value="amount">Количество</option>
            <option value="time">Время</option>
          </select>
          <button class="btn btn-dark">+ Добавить</button>
        </div>
      </form>
    </div>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-8">
      <form action="/add_game" method="POST">
        <input type="hidden" name="slug" value="${room.slug}">
        <div class="input-group">
          <input type="text" name="game_name" class="form-control" placeholder="Название игры" required>
          <select name="ex_name" class="form-select" style="max-width: 160px;" required>
            <option value="">Упражнение</option>
            ${ex_types.results.filter(e => e.name !== '🏆 Победа').map(e => `<option value="${e.name}">${e.name}</option>`).join('')}
          </select>
          <input type="text" name="val" class="form-control" placeholder="Кол-во или ММ:СС" required>
          <button class="btn btn-dark">+ Добавить</button>
        </div>
      </form>
    </div>
  </div>
  <hr>
  <h3>📝 Ввод долгов</h3>
  <form action="/add_log" method="POST">
    <input type="hidden" name="slug" value="${room.slug}">
    <select name="profile_id" class="form-select mb-2" required>
      <option value="">Выберите человека...</option>
      ${profiles.results.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
    </select>
    <select name="ex_name" class="form-select mb-2" required>
      <option value="">Упражнение</option>
      ${ex_types.results.filter(e => e.name !== '🏆 Победа').map(e => `<option value="${e.name}">${e.name}</option>`).join('')}
    </select>
    <input type="text" name="value" class="form-control mb-2" placeholder="Сколько?" required>
    <div class="d-flex gap-2">
      <button type="submit" name="action_type" value="add" class="btn-main">➕ Добавить долг</button>
      <button type="submit" name="action_type" value="writeoff" class="btn btn-outline-success px-4">Списать</button>
    </div>
  </form>
  <hr>
  <h3>🎲 Игра</h3>
  <form action="/play_game" method="POST">
    <input type="hidden" name="slug" value="${room.slug}">
    <select name="game_name" class="form-select mb-2">
      ${games.results.map(g => `<option value="${g.game_name}">${g.game_name} (${g.val} ${g.ex_name})</option>`).join('')}
    </select>
    <label class="mb-2">Кто победил?</label>
    <div class="row">
      ${profiles.results.map(p => `
      <div class="col-6 col-md-3 form-check">
        <input class="form-check-input" type="checkbox" name="winner_ids" value="${p.id}" id="winner_${p.id}">
        <label class="form-check-label" for="winner_${p.id}">${p.name}</label>
      </div>`).join('')}
    </div>
    <button type="submit" class="btn-main mt-2">🔥 Раздать долги</button>
  </form>
  ` : ''}
  <hr>
  <h3>🏆 Рейтинг чемпионов</h3>
  <ul class="list-group">
    ${hall_of_fame.map(p => `<li class="list-group-item d-flex justify-content-between"><span>👤 ${p.name}</span><span class="fw-bold">${p.wins} побед</span></li>`).join('')}
    ${hall_of_fame.length === 0 ? '<li class="list-group-item text-muted">Побед пока нет</li>' : ''}
  </ul>
  <hr>
  <h3>📊 Текущие долги</h3>
  <div class="accordion" id="debtsAccordion">
    ${Object.entries(summary).map(([name, items], idx) => {
      const hasDebt = Object.values(items).some(v => v > 0);
      return `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${hasDebt ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            👤 ${name}
          </button>
        </h2>
        <div id="collapse${idx}" class="accordion-collapse collapse ${hasDebt ? 'show' : ''}">
          <div class="accordion-body">
            ${hasDebt ? Object.entries(items).filter(([ex, val]) => val > 0).map(([ex, val]) => `
              <div class="d-flex justify-content-between">
                <span>${ex_icons[ex] || '💪'} ${ex}</span>
                <span class="fw-bold">${ex_map[ex] === 'time' ? `${Math.floor(val/60)}:${(val%60).toString().padStart(2,'0')}` : val}</span>
              </div>`).join('') : '<div class="text-success">Долгов нет! ✨</div>'}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

async function checkAdmin(c, room_slug, password) {
  if (!password) return false;
  const { results } = await c.env.DB.prepare("SELECT password FROM rooms WHERE slug = ?").bind(room_slug).all();
  return results.length > 0 && results[0].password === password;
}

async function sendTgNotification(env, room, text) {
  const token = env.BOT_TOKEN;
  const chat_id = room.tg_chat_id;
  if (!token || !chat_id) return;
  try {
    const { results: members } = await env.DB.prepare("SELECT user_id FROM group_members WHERE chat_id = ?").bind(chat_id).all();
    let fullText;
    if (members.length > 0) {
      const mentions = members.map(m => `<a href="tg://user?id=${m.user_id}">\u2060</a>`).join('');
      fullText = `📢 @all ${mentions}\n${text}`;
    } else {
      fullText = `📢 @all\n${text}`;
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: fullText,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Ошибка отправки в Telegram:', e);
  }
}

// ========== МАРШРУТЫ ==========

app.get('/', (c) => c.html(renderCreateRoomPage()));

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.text('Комната не найдена', 404);

  const room = rooms[0];
  const room_id = room.room_id;

  const profiles = await c.env.DB.prepare("SELECT * FROM profiles WHERE room_id = ?").bind(room_id).all();
  const ex_types = await c.env.DB.prepare("SELECT * FROM exercise_types WHERE room_id = ?").bind(room_id).all();
  const games = await c.env.DB.prepare("SELECT * FROM games_presets WHERE room_id = ?").bind(room_id).all();
  const logs = await c.env.DB.prepare("SELECT wl.*, p.name as profile_name FROM workout_logs wl LEFT JOIN profiles p ON wl.profile_id = p.id WHERE wl.room_id = ? ORDER BY wl.created_at DESC").bind(room_id).all();

  const idToName = {};
  profiles.results.forEach(p => idToName[p.id] = p.name);
  const ex_map = {};
  ex_types.results.forEach(e => ex_map[e.name] = e.unit_type);
  const ex_icons = {};
  ex_types.results.forEach(e => ex_icons[e.name] = e.unit_type === 'time' ? '🕒' : '💪');

  const hof = {};
  logs.results.forEach(l => {
    if (l.exercise_type === '🏆 Победа') {
      const name = idToName[l.profile_id] || l.profile_name;
      hof[name] = (hof[name] || 0) + 1;
    }
  });
  const hall_of_fame = Object.entries(hof).map(([name, wins]) => ({ name, wins }));

  const summary = {};
  profiles.results.forEach(p => summary[p.name] = {});
  logs.results.forEach(l => {
    if (l.exercise_type === '🏆 Победа') return;
    const name = idToName[l.profile_id] || l.profile_name;
    if (summary[name] !== undefined) {
      const ex = l.exercise_type;
      summary[name][ex] = (summary[name][ex] || 0) + l.amount;
    }
  });

  const cookie = c.req.header('Cookie') || '';
  const is_admin = cookie.includes(`auth_${room_id}=1`);

  const last_log = logs.results[0];
  const last_action_text = last_log ? `Последнее: ${idToName[last_log.profile_id] || last_log.profile_name} - ${last_log.exercise_type}` : '';

  return c.html(renderRoomPage(room, profiles, ex_types, games, logs, summary, hall_of_fame, is_admin, last_action_text, ex_icons, ex_map));
});

app.post('/create_room', async (c) => {
  const body = await c.req.parseBody();
  const { title, slug, password, tg_id } = body;
  if (!title || !slug) return c.html(renderCreateRoomPage('Заполните обязательные поля'));
  try {
    await c.env.DB.prepare("INSERT INTO rooms (slug, title, password, tg_chat_id) VALUES (?, ?, ?, ?)")
      .bind(slug, title, password, tg_id || null).run();
    const { results: roomRows } = await c.env.DB.prepare("SELECT room_id FROM rooms WHERE slug = ?").bind(slug).all();
    const room_id = roomRows[0].room_id;
    await c.env.DB.prepare("INSERT OR IGNORE INTO exercise_types (room_id, name, unit_type) VALUES (?, '🏆 Победа', 'amount')").bind(room_id).run();
    return c.redirect(`/${slug}`);
  } catch (e) {
    return c.html(renderCreateRoomPage('Адрес уже занят или ошибка'));
  }
});

app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { slug, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length > 0 && rooms[0].password === password) {
    c.header('Set-Cookie', `auth_${rooms[0].room_id}=1; Path=/; HttpOnly`);
  }
  return c.redirect(`/${slug}`);
});

app.post('/logout', async (c) => {
  const slug = c.req.query('slug') || '';
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length > 0) {
    c.header('Set-Cookie', `auth_${rooms[0].room_id}=; Path=/; Max-Age=0`);
  }
  return c.redirect(`/${slug}`);
});

app.post('/add_profile', async (c) => {
  const body = await c.req.parseBody();
  const { slug, name, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.redirect('/');
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  await c.env.DB.prepare("INSERT OR IGNORE INTO profiles (room_id, name) VALUES (?, ?)").bind(rooms[0].room_id, name).run();
  return c.redirect(`/${slug}`);
});

app.post('/add_exercise', async (c) => {
  const body = await c.req.parseBody();
  const { slug, name, unit_type, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0 || name === '🏆 Победа') return c.redirect(`/${slug}`);
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  await c.env.DB.prepare("INSERT OR IGNORE INTO exercise_types (room_id, name, unit_type) VALUES (?, ?, ?)").bind(rooms[0].room_id, name, unit_type || 'amount').run();
  return c.redirect(`/${slug}`);
});

app.post('/add_game', async (c) => {
  const body = await c.req.parseBody();
  const { slug, game_name, ex_name, val, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.redirect('/');
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  let numericVal = parseInt(val);
  if (isNaN(numericVal) && val.includes(':')) {
    const parts = val.split(':');
    numericVal = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  if (isNaN(numericVal)) return c.redirect(`/${slug}`);
  const unit_type = (await c.env.DB.prepare("SELECT unit_type FROM exercise_types WHERE name = ? AND room_id = ?").bind(ex_name, rooms[0].room_id).all()).results[0]?.unit_type || 'amount';
  await c.env.DB.prepare("INSERT OR IGNORE INTO games_presets (room_id, game_name, ex_name, val, unit_type) VALUES (?, ?, ?, ?, ?)").bind(rooms[0].room_id, game_name, ex_name, numericVal, unit_type).run();
  return c.redirect(`/${slug}`);
});

app.post('/add_log', async (c) => {
  const body = await c.req.parseBody();
  const { slug, profile_id, ex_name, value, action_type, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.redirect('/');
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  let numericVal = parseInt(value);
  if (isNaN(numericVal) && value.includes(':')) {
    const parts = value.split(':');
    numericVal = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  if (isNaN(numericVal)) return c.redirect(`/${slug}`);
  const amount = action_type === 'writeoff' ? -numericVal : numericVal;
  await c.env.DB.prepare("INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, ?, ?, ?)").bind(profile_id, ex_name, amount, rooms[0].room_id).run();

  const pName = (await c.env.DB.prepare("SELECT name FROM profiles WHERE id = ?").bind(profile_id).all()).results[0]?.name || 'Кто-то';
  const actionTxt = action_type === 'writeoff' ? 'списал(а)' : 'получил(а) долг';
  await sendTgNotification(c.env, rooms[0], `⚖️ ${pName} ${actionTxt}: ${ex_name} (${value})`);

  return c.redirect(`/${slug}`);
});

app.post('/play_game', async (c) => {
  const body = await c.req.parseBody();
  const { slug, game_name, winner_ids, password } = body;
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.redirect('/');
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  const room_id = rooms[0].room_id;
  const { results: games } = await c.env.DB.prepare("SELECT * FROM games_presets WHERE room_id = ? AND game_name = ?").bind(room_id, game_name).all();
  if (games.length === 0) return c.redirect(`/${slug}`);
  const game = games[0];
  const winnerList = Array.isArray(winner_ids) ? winner_ids : [winner_ids];
  const { results: allProfiles } = await c.env.DB.prepare("SELECT id, name FROM profiles WHERE room_id = ?").bind(room_id).all();
  const losersNames = [];
  for (const p of allProfiles) {
    if (winnerList.includes(String(p.id))) {
      await c.env.DB.prepare("INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, '🏆 Победа', 1, ?)").bind(p.id, room_id).run();
    } else {
      await c.env.DB.prepare("INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, ?, ?, ?)").bind(p.id, game.ex_name, game.val, room_id).run();
      losersNames.push(p.name);
    }
  }
  if (losersNames.length > 0) {
    let valDisplay = game.val;
    if (game.unit_type === 'time') {
      valDisplay = `${Math.floor(game.val / 60)}:${(game.val % 60).toString().padStart(2, '0')}`;
    }
    const msg = `🎮 Игра: ${game_name}\n💀 Проиграли: ${losersNames.join(', ')} (+${valDisplay} ${game.ex_name})`;
    await sendTgNotification(c.env, rooms[0], msg);
  }
  return c.redirect(`/${slug}`);
});

app.get('/undo/:slug', async (c) => {
  const slug = c.req.param('slug');
  const { results: rooms } = await c.env.DB.prepare("SELECT * FROM rooms WHERE slug = ?").bind(slug).all();
  if (rooms.length === 0) return c.redirect('/');
  const password = c.req.query('password') || '';
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`);
  await c.env.DB.prepare("DELETE FROM workout_logs WHERE id = (SELECT id FROM workout_logs WHERE room_id = ? ORDER BY created_at DESC LIMIT 1)").bind(rooms[0].room_id).run();
  return c.redirect(`/${slug}`);
});

// Глобальный обработчик ошибок
app.onError((err, c) => {
  console.error(`Ошибка: ${err.message}`);
  return c.text('Внутренняя ошибка сервера', 500);
});

export const onRequest = app.fetch;
