import { Hono } from 'hono'

const app = new Hono()

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function timeToSeconds(tStr) {
  tStr = String(tStr).trim()
  if (!tStr) return null
  try {
    if (tStr.includes(':')) {
      const parts = tStr.split(':')
      if (parts.length === 2) {
        const m = parseInt(parts[0])
        const s = parseInt(parts[1])
        return m * 60 + s
      }
      return null
    }
    return parseInt(tStr)
  } catch {
    return null
  }
}

function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function getUnitIcon(unitType) {
  return unitType === 'time' ? '🕒' : '💪'
}

async function checkAdmin(c, roomSlug, password) {
  if (!password) return false
  const { results } = await c.env.DB.prepare(
    'SELECT password FROM rooms WHERE slug = ?'
  ).bind(roomSlug).all()
  return results.length > 0 && results[0].password === password
}

async function sendTgNotification(env, room, text) {
  const token = env.BOT_TOKEN
  const chatId = room.tg_chat_id
  if (!token || !chatId) return
  try {
    const { results: members } = await env.DB.prepare(
      'SELECT user_id FROM group_members WHERE chat_id = ?'
    ).bind(chatId).all()
    let fullText
    if (members.length > 0) {
      const mentions = members
        .map(m => `<a href="tg://user?id=${m.user_id}">\u2060</a>`)
        .join('')
      fullText = `📢 @all ${mentions}\n${text}`
    } else {
      fullText = `📢 @all\n${text}`
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullText,
        parse_mode: 'HTML'
      })
    })
  } catch (e) {
    console.error('Ошибка отправки в Telegram:', e)
  }
}

// ==================== ГЕНЕРАТОРЫ СТРАНИЦ ====================

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
        body {
            font-family: 'Inter', sans-serif;
            background-color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            width: 90%;
            max-width: 900px;
        }
        .header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 25px;
        }
        .header h1 {
            color: #2D3748;
            font-size: 32px;
            font-weight: 700;
            margin: 0;
        }
        .card {
            background: #ffffff;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 30px;
        }
        .form-group {
            margin-bottom: 25px;
            position: relative;
        }
        .label-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        label {
            font-size: 14px;
            color: #718096;
        }
        .help-icon {
            color: #A0AEC0;
            font-size: 14px;
            cursor: pointer;
            transition: color 0.2s;
        }
        .help-icon:hover {
            color: #FF5A50;
        }
        input {
            width: 100%;
            padding: 14px 18px;
            background-color: #EDF2F7;
            border: 1px solid transparent;
            border-radius: 10px;
            font-size: 16px;
            color: #2D3748;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }
        input:focus {
            border-color: #CBD5E0;
        }
        .password-toggle {
            position: absolute;
            right: 18px;
            bottom: 14px;
            color: #2D3748;
            cursor: pointer;
        }
        .btn-submit {
            background-color: #FF5A50;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 12px 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-submit:hover {
            background-color: #E54E45;
        }
        .alert-container {
            margin-bottom: 20px;
        }
        .alert-danger {
            background-color: #FFF5F5;
            border: 1px solid #FEB2B2;
            color: #C53030;
            padding: 12px 18px;
            border-radius: 10px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        /* Попап – теперь вне карточки, позиционируем относительно body */
        .global-popup {
            position: fixed;
            background: #ffffff;
            border: 1px solid #E2E8F0;
            border-radius: 12px;
            padding: 12px 16px;
            font-size: 13px;
            color: #2D3748;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
            max-width: 280px;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
            pointer-events: none;
        }
        .global-popup.active {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .global-popup::before {
            content: '';
            position: absolute;
            top: -8px;
            left: 20px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 8px solid #ffffff;
            filter: drop-shadow(0 -1px 1px rgba(0,0,0,0.05));
        }
        .global-popup::after {
            content: '';
            position: absolute;
            top: -9px;
            left: 19px;
            width: 0;
            height: 0;
            border-left: 9px solid transparent;
            border-right: 9px solid transparent;
            border-bottom: 9px solid #E2E8F0;
            z-index: -1;
        }
        .global-popup .popup-close {
            position: absolute;
            top: 8px;
            right: 12px;
            color: #A0AEC0;
            cursor: pointer;
            font-size: 14px;
            pointer-events: auto;
        }
        .global-popup .popup-close:hover {
            color: #FF5A50;
        }
        .global-popup p {
            margin: 0;
            padding-right: 20px;
            line-height: 1.4;
        }
        @media (max-width: 640px) {
            .global-popup {
                max-width: 240px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <span>🚀</span>
        <h1>Workout SaaS: Создать комнату</h1>
    </div>

    <form action="/create_room" method="POST" class="card">
        <div class="form-group">
            <div class="label-row">
                <label>Название (напр: Моя Качалка)</label>
            </div>
            <input type="text" name="title" required>
        </div>

        <div class="form-group">
            <div class="label-row">
                <label>Придумайте адрес для ссылки (напр: matrix, kachalka77)</label>
                <i class="far fa-question-circle help-icon" data-popup="slug-popup"></i>
            </div>
            <input type="text" name="slug" required>
        </div>

        <div class="form-group">
            <div class="label-row">
                <label>Пароль админа</label>
            </div>
            <input type="password" name="password" id="passwordField" required>
            <i class="far fa-eye password-toggle" onclick="togglePass()"></i>
        </div>

        <div class="form-group">
            <div class="label-row">
                <label>ID чата в Telegram (необязательно)</label>
                <i class="far fa-question-circle help-icon" data-popup="tg-popup"></i>
            </div>
            <input type="text" name="tg_id">
        </div>

        ${error ? `<div class="alert-container"><div class="alert-danger"><i class="fas fa-exclamation-triangle"></i>${escapeHtml(error)}</div></div>` : ''}
        <button type="submit" class="btn-submit">Создать комнату</button>
    </form>
</div>

<!-- Глобальные попапы -->
<div id="slug-popup" class="global-popup">
    <span class="popup-close">&times;</span>
    <p>Ссылка на вашу комнату будет: <strong>${escapeHtml('https://workout-cloudflare.il8988123.workers.dev/')}</strong> + введённый адрес.<br>Пример: <strong>${escapeHtml('https://workout-cloudflare.il8988123.workers.dev/matrix')}</strong></p>
</div>
<div id="tg-popup" class="global-popup">
    <span class="popup-close">&times;</span>
    <p>Для получения уведомлений о долгах:<br>
    1. Добавьте бота <strong>@Cardioid_Cat_AllBot</strong> в вашу группу.<br>
    2. Назначьте его администратором.<br>
    3. ID чата можно узнать у бота <strong>@getidsbot</strong>.<br>
    Уведомления будут приходить только для этой комнаты.</p>
</div>

<script>
    function togglePass() {
        const passInput = document.getElementById('passwordField');
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
    }

    // Позиционирование попапа относительно иконки
    function positionPopup(icon, popup) {
        const rect = icon.getBoundingClientRect();
        const popupRect = popup.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 8;
        let left = rect.left + window.scrollX;
        
        if (left + popupRect.width > window.innerWidth - 10) {
            left = window.innerWidth - popupRect.width - 10;
        }
        if (left < 10) left = 10;
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        
        const arrowOffset = (rect.left + window.scrollX) - left + (rect.width / 2) - 8;
        popup.style.setProperty('--arrow-left', Math.max(8, Math.min(arrowOffset, popupRect.width - 24)) + 'px');
        popup.style.setProperty('--before-left', 'var(--arrow-left)');
        popup.style.setProperty('--after-left', 'calc(var(--arrow-left) - 1px)');
    }

    // Инициализация всех попапов
    document.querySelectorAll('.help-icon').forEach(icon => {
        const popupId = icon.getAttribute('data-popup');
        const popup = document.getElementById(popupId);
        if (!popup) return;
        
        if (!document.getElementById('popup-arrow-style')) {
            const style = document.createElement('style');
            style.id = 'popup-arrow-style';
            style.textContent = ".global-popup::before { left: var(--before-left, 20px) !important; } .global-popup::after { left: var(--after-left, 19px) !important; }";
            document.head.appendChild(style);
        }
        
        function openPopup(e) {
            e.stopPropagation();
            document.querySelectorAll('.global-popup.active').forEach(p => {
                if (p !== popup) p.classList.remove('active');
            });
            positionPopup(icon, popup);
            popup.classList.add('active');
        }
        
        function closePopup() {
            popup.classList.remove('active');
        }
        
        icon.addEventListener('click', openPopup);
        const closeBtn = popup.querySelector('.popup-close');
        if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closePopup(); });
        
        document.addEventListener('click', function(event) {
            if (popup.classList.contains('active') && !popup.contains(event.target) && !icon.contains(event.target)) {
                closePopup();
            }
        });
        
        window.addEventListener('resize', () => { if (popup.classList.contains('active')) positionPopup(icon, popup); });
        window.addEventListener('scroll', () => { if (popup.classList.contains('active')) positionPopup(icon, popup); });
    });
</script>
</body>
</html>`
}

function renderRoomPage(room, profiles, exTypes, games, logs, summary, hallOfFame, isAdmin, lastActionText, exIcons, exMap, errorMessage = '') {
  // Генерируем HTML для сайдбара (настройки, игры, упражнения, участники)
  const profilesListHtml = profiles.length > 0
    ? profiles.map(p => `<div class="submenu-item"><span>${escapeHtml(p.name)}</span><button class="btn-del-tiny" data-url="/delete_profile/${p.id}" data-name="${escapeHtml(p.name)}"><i class="bi bi-trash"></i></button></div>`).join('')
    : '<div class="text-muted small p-2">Нет участников</div>'

  const exercisesListHtml = exTypes.filter(ex => ex.name !== '🏆 Победа').length > 0
    ? exTypes.filter(ex => ex.name !== '🏆 Победа').map(ex => `<div class="submenu-item"><span>${getUnitIcon(ex.unit_type)} ${escapeHtml(ex.name)}</span><button class="btn-del-tiny" data-url="/delete_ex/${ex.id}" data-name="${escapeHtml(ex.name)}"><i class="bi bi-trash"></i></button></div>`).join('')
    : '<div class="text-muted small p-2">Нет упражнений</div>'

  const gamesListHtml = games.length > 0
    ? games.map(g => `<div class="submenu-item"><span>${escapeHtml(g.game_name)} (${g.val} ${escapeHtml(g.ex_name)})</span><button class="btn-del-tiny" data-url="/delete_game/${g.id}" data-name="${escapeHtml(g.game_name)}"><i class="bi bi-trash"></i></button></div>`).join('')
    : '<div class="text-muted small p-2">Нет игр</div>'

  // Опции для выбора упражнения в форме добавления игры
  const gameExOptions = exTypes.filter(ex => ex.name !== '🏆 Победа').map(ex =>
    `<option value="${escapeHtml(ex.name)}" data-unit="${ex.unit_type}">${escapeHtml(ex.name)}</option>`
  ).join('')

  // Опции для выбора профиля
  const profileOptions = profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')

  // Опции для выбора упражнения в форме ввода долгов
  const exDebtOptions = exTypes.filter(ex => ex.name !== '🏆 Победа').map(ex =>
    `<option value="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</option>`
  ).join('')

  // Опции для выбора игры в форме проведения игры
  const gameOptions = games.map(g =>
    `<option value="${escapeHtml(g.game_name)}">${escapeHtml(g.game_name)} (${g.val} ${escapeHtml(g.ex_name)})</option>`
  ).join('')

  // Чекбоксы победителей
  const winnerCheckboxes = profiles.map(p =>
    `<div class="form-check">
       <input class="form-check-input" type="checkbox" name="winner_ids" value="${p.id}" id="winner_${p.id}">
       <label class="form-check-label" for="winner_${p.id}">${escapeHtml(p.name)}</label>
     </div>`
  ).join('')

  // Рейтинг чемпионов
  const hallOfFameHtml = hallOfFame.length > 0
    ? hallOfFame.map((p, index) => {
        const wins = p.wins
        let winsWord = 'побед'
        if (wins % 10 === 1 && wins % 100 !== 11) winsWord = 'победа'
        else if (wins % 10 >= 2 && wins % 10 <= 4 && (wins % 100 < 10 || wins % 100 >= 20)) winsWord = 'победы'
        return `<div class="d-flex justify-content-between align-items-center ${index !== hallOfFame.length - 1 ? 'border-bottom' : ''} py-2">
                 <span class="hall-of-fame-text">👤 ${escapeHtml(p.name)}</span>
                 <span class="fw-bold" style="color: #3182CE;">${wins} ${winsWord}</span>
               </div>`
      }).join('')
    : '<div class="text-center py-2 hall-of-fame-text">Побед пока нет.</div>'

  // Аккордеон долгов
  const debtsAccordionHtml = Object.entries(summary).map(([name, items], idx) => {
    const hasDebt = Object.values(items).some(v => v > 0)
    const itemsHtml = hasDebt
      ? Object.entries(items)
          .filter(([ex, val]) => val > 0)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ex, val]) => {
            const displayVal = exMap[ex] === 'time' ? formatTime(val) : val
            return `<div class="d-flex justify-content-between border-bottom py-2">
                     <span class="text-muted">${exIcons[ex] || '💪'} ${escapeHtml(ex)}</span>
                     <span class="fw-bold">${displayVal}</span>
                   </div>`
          }).join('')
      : '<div class="text-center py-2"><span class="text-success fw-bold">Долгов нет! ✨</span></div>'
    return `
      <div class="accordion-item border-0 mb-2 shadow-sm" style="border-radius: 12px; overflow: hidden;">
        <h2 class="accordion-header">
          <button class="accordion-button collapsed fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${idx}">
            👤 ${escapeHtml(name)}
          </button>
        </h2>
        <div id="collapse${idx}" class="accordion-collapse collapse">
          <div class="accordion-body bg-white">${itemsHtml}</div>
        </div>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>💪 ${escapeHtml(room.title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
    <style>
        :root { --sidebar-bg: #F1F3F9; --accent-red: #FF5A50; --border-color: #E2E8F0; }
        body { background: #FFFFFF; font-family: 'Inter', sans-serif; display: flex; min-height: 100vh; margin: 0; }
        
        .sidebar {
            width: 260px;
            background: var(--sidebar-bg);
            border-right: 1px solid var(--border-color);
            padding: 25px 15px;
            display: flex;
            flex-direction: column;
            transition: width 0.3s;
            position: relative;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .sidebar.collapsed {
            width: 85px;
            padding: 25px 12px;
        }
        .sidebar.collapsed .sidebar-text,
        .sidebar.collapsed .undo-section,
        .sidebar.collapsed .submenu-settings,
        .sidebar.collapsed .sidebar-hide {
            display: none !important;
        }
        .toggle-btn {
            position: absolute;
            right: 5px;
            top: 20px;
            background: #fff;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            cursor: pointer;
            z-index: 100;
            padding: 2px 5px;
        }
        .nav-link-custom { background: #fff; border: 1px solid var(--border-color); border-radius: 12px; padding: 12px; margin-bottom: 5px; display: flex; align-items: center; text-decoration: none; color: #2D3748; font-weight: 500; font-size: 0.85rem; cursor: pointer; }
        .submenu-settings { display: none; background: #fff; border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 15px; padding: 8px; flex-direction: column; gap: 4px; }
        .submenu-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-size: 0.8rem; border-bottom: 1px solid #f1f1f1; }
        .submenu-item:last-child { border-bottom: none; }
        .btn-del-tiny { color: #A0AEC0; cursor: pointer; border: none; background: none; }
        .btn-del-tiny:hover { color: var(--accent-red); }
        .tab-btn { cursor: pointer; padding-bottom: 10px; font-weight: 700; color: #A0AEC0; border-bottom: 3px solid transparent; }
        .tab-btn.active { color: var(--accent-red); border-bottom-color: var(--accent-red); }
        .ex-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .btn-check-custom { border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; text-align: center; cursor: pointer; background: #fff; font-size: 0.9rem; }
        .selected-ex { border-color: var(--accent-red); background: #FFF5F5; color: var(--accent-red); }
        .btn-main { background: var(--accent-red); color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; width: 100%; }
        .btn-outline-green { border: 2px solid #48BB78; color: #48BB78; background: transparent; border-radius: 10px; font-weight: 700; }
        .undo-section { margin-top: auto; padding-top: 20px; border-top: 1px solid #CBD5E0; }
        .btn-undo { border: 1px solid var(--border-color); background: #fff; border-radius: 8px; padding: 8px; font-size: 0.85rem; width: 100%; }
        .accordion-button:not(.collapsed) { background-color: #FFF5F5; color: var(--accent-red); }
        .hall-of-fame-card { background: #EBF4FF; border: none; border-radius: 12px; }
        .hall-of-fame-text { color: #3182CE; font-weight: 500; }
        .winner-checkbox-group {
            max-height: 250px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 10px;
            background: white;
        }
        .winner-checkbox-group .form-check {
            padding: 8px 12px 8px 2rem;
            margin: 0;
            border-radius: 10px;
            transition: background 0.1s;
        }
        .winner-checkbox-group .form-check:hover {
            background: #F7FAFC;
        }
        .winner-checkbox-group .form-check-input {
            width: 1.2em;
            height: 1.2em;
            margin-top: 0.1em;
            cursor: pointer;
        }
        .winner-checkbox-group .form-check-label {
            cursor: pointer;
            font-size: 1rem;
            margin-left: 10px;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                width: 85px;
                padding: 25px 12px;
            }
            .sidebar:not(.collapsed) {
                width: 260px;
                padding: 25px 15px;
            }
            .sidebar.collapsed {
                width: 85px;
                padding: 25px 12px;
            }
            .toggle-btn {
                position: absolute;
                right: 5px;
                top: 20px;
            }
            .main-content {
                width: calc(100% - 85px);
                padding: 15px !important;
            }
            body:has(.sidebar:not(.collapsed)) .main-content {
                width: calc(100% - 260px);
            }
            .ex-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (min-width: 769px) {
            .main-content {
                flex-grow: 1;
            }
        }
    </style>
</head>
<body>

    <div class="sidebar" id="sidebar">
        <button class="toggle-btn" onclick="toggleSidebar()">
            <i id="toggle-icon" class="bi bi-chevron-double-left"></i>
        </button>
        
        <div class="h-100 d-flex flex-column">
            <h5 class="mb-4">
                <i class="bi bi-gear"></i>
                <span class="sidebar-text">&nbsp; Настройки</span>
            </h5>
            ${isAdmin ? `<a href="/logout?slug=${escapeHtml(room.slug)}" class="btn btn-sm btn-light mb-4 border sidebar-text">Выйти</a>` : `
                <div class="card border-0 bg-white p-3 shadow-sm mb-4 sidebar-hide" style="border-radius: 12px;">
                    <p class="text-muted small mb-2">🔑 Вход для админа</p>
                    <form action="/login" method="POST">
                        <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                        <input type="password" name="password" class="form-control form-control-sm mb-2" placeholder="Пароль">
                        <button class="btn btn-dark btn-sm w-100">Войти</button>
                    </form>
                </div>
            `}
            ${isAdmin ? `
                <div class="nav-link-custom" onclick="toggleSubmenu('sub-games')"><i class="bi bi-controller"></i>&nbsp; <span class="sidebar-text">НАСТРОЙКА ИГР</span></div>
                <div id="sub-games" class="submenu-settings">
                    <form action="/add_game" method="POST" class="p-2 border-bottom mb-2">
                        <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                        <input type="text" name="name" class="form-control form-control-sm mb-1" placeholder="Название игры" required pattern=".*\\S.*" title="Название не может состоять только из пробелов" style="font-size: 0.75rem;">
                        <select name="ex_name" class="form-select form-select-sm mb-1" style="font-size: 0.75rem;" required onchange="updateGameValPlaceholder(this)">
                            <option value="" disabled selected>Упражнение</option>
                            ${gameExOptions}
                        </select>
                        <input type="text" name="val" id="game_val_input" class="form-control form-control-sm mb-1" placeholder="Кол-во или ММ:СС" required pattern=".*\\S.*" style="font-size: 0.75rem;">
                        <button type="submit" class="btn btn-dark btn-sm w-100" style="font-size: 0.7rem;">+ Добавить</button>
                    </form>
                    ${gamesListHtml}
                </div>

                <div class="nav-link-custom" onclick="toggleSubmenu('sub-ex')"><i class="bi bi-person-walking"></i>&nbsp; <span class="sidebar-text">УПРАЖНЕНИЯ</span></div>
                <div id="sub-ex" class="submenu-settings">
                    <form action="/add_exercise" method="POST" class="p-2 border-bottom mb-2">
                        <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                        <input type="text" name="name" class="form-control form-control-sm mb-1" placeholder="Название" required pattern=".*\\S.*" title="Название не может состоять только из пробелов" style="font-size: 0.75rem;">
                        <select name="unit_type" class="form-select form-select-sm mb-1" style="font-size: 0.75rem;">
                            <option value="amount">Количество</option>
                            <option value="time">Время (ММ:СС)</option>
                        </select>
                        <button type="submit" class="btn btn-dark btn-sm w-100" style="font-size: 0.7rem;">+ Добавить</button>
                    </form>
                    ${exercisesListHtml}
                </div>

                <div class="nav-link-custom" onclick="toggleSubmenu('sub-users')"><i class="bi bi-person-fill"></i>&nbsp; <span class="sidebar-text">УЧАСТНИКИ</span></div>
                <div id="sub-users" class="submenu-settings">
                    <form action="/add_profile" method="POST" class="p-2 border-bottom mb-2">
                        <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                        <input type="text" name="name" class="form-control form-control-sm mb-1" placeholder="Имя" required pattern=".*\\S.*" title="Имя не может состоять только из пробелов" style="font-size: 0.75rem;">
                        <button type="submit" class="btn btn-dark btn-sm w-100" style="font-size: 0.7rem;">+ Добавить</button>
                    </form>
                    ${profilesListHtml}
                </div>

                <div class="undo-section">
                    <p class="small text-muted mb-1 sidebar-text" style="font-size: 0.75rem;">${escapeHtml(lastActionText) || 'Нет действий'}</p>
                    <button class="btn-undo sidebar-text" data-bs-toggle="modal" data-bs-target="#confirmUndo">
                        <i class="bi bi-arrow-left-short"></i> Отменить
                    </button>
                </div>
            ` : ''}
        </div>
    </div>

    <div class="main-content flex-grow-1 p-5">
        ${errorMessage ? `<div class="alert alert-danger alert-dismissible fade show" role="alert" style="border-radius: 12px;">${escapeHtml(errorMessage)}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>` : ''}

        <h1 class="fw-bold mb-4">💪 ${escapeHtml(room.title)}</h1>

        ${isAdmin ? `
        <div class="d-flex gap-4 mb-4 border-bottom">
            <div id="tab-vvod" class="tab-btn active" onclick="switchMainTab('vvod')">📝 Ввод</div>
            <div id="tab-igra" class="tab-btn" onclick="switchMainTab('igra')">🎲 Игра</div>
        </div>

        <div id="view-vvod">
            <form action="/add_log" method="POST" id="vvod-form">
                <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                <input type="hidden" name="action_type" id="action_type" value="add">
                <select class="form-select form-select-lg mb-3 border-0 bg-light" name="profile_id" required style="border-radius: 12px;">
                    <option value="" disabled selected>Выберите человека...</option>
                    ${profileOptions}
                </select>
                <input type="hidden" name="ex_name" id="selected-ex-name" required>
                <div class="ex-grid mb-4">
                    ${exTypes.filter(ex => ex.name !== '🏆 Победа').map(ex => {
                        return `<div class="btn-check-custom" data-unit="${ex.unit_type}" onclick="selectExercise(this, '${escapeHtml(ex.name)}')">${getUnitIcon(ex.unit_type)} ${escapeHtml(ex.name)}</div>`
                    }).join('')}
                </div>
                <div id="vvod-controls" style="display:none;">
                    <input type="text" name="value" id="exercise-value" class="form-control form-control-lg mb-3" placeholder="Сколько?" required>
                    <div class="d-flex gap-2">
                        <button type="submit" class="btn-main" onclick="document.getElementById('action_type').value='add'">➕ Добавить долг</button>
                        <button type="submit" class="btn-outline-green px-4" onclick="document.getElementById('action_type').value='writeoff'"><i class="bi bi-check2"></i> Списать</button>
                    </div>
                </div>
            </form>
        </div>

        <div id="view-igra" style="display:none;">
            <form action="/play_game" method="POST">
                <input type="hidden" name="slug" value="${escapeHtml(room.slug)}">
                <label class="small text-muted">Игра?</label>
                <select name="game_name" class="form-select mb-3 bg-light border-0 py-2">
                    ${gameOptions}
                </select>
                
                <label class="small text-muted mb-2 d-block">Кто победил?</label>
                <div class="winner-checkbox-group mb-3">
                    ${winnerCheckboxes}
                </div>
                <p class="small text-muted mb-3">✓ Выберите всех, кто выиграл (можно нескольких)</p>
                
                <button type="submit" class="btn-main">🔥 Раздать долги</button>
            </form>
        </div>
        ` : ''}

        <h4 class="mt-5 mb-3">🥇 Рейтинг чемпионов</h4>
        <div class="card hall-of-fame-card mb-4 shadow-sm">
            <div class="card-body">${hallOfFameHtml}</div>
        </div>

        <h4 class="mt-5 mb-3">📊 Текущие долги</h4>
        <div class="accordion" id="debtsAccordion">${debtsAccordionHtml}</div>
    </div>

    <div class="modal fade" id="deleteConfirmModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border-radius: 15px;">
          <div class="modal-body text-center p-4">
            <h5 class="fw-bold mb-3">Удалить <span id="delItemName"></span>?</h5>
            <p class="text-muted small">Это действие нельзя отменить.</p>
            <div class="d-flex gap-2">
              <button class="btn btn-light w-100" data-bs-dismiss="modal">Отмена</button>
              <a id="confirmDelLink" class="btn btn-danger w-100">Удалить</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="confirmUndo" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border-radius: 15px;">
          <div class="modal-body text-center p-4">
            <h5 class="fw-bold mb-3">Отменить последнее действие?</h5>
            <div class="d-flex gap-2">
              <button class="btn btn-light w-100" data-bs-dismiss="modal">Нет</button>
              <a href="/undo/${escapeHtml(room.slug)}" class="btn btn-dark w-100">Да, отменить</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function toggleSidebar() {
            const sb = document.getElementById('sidebar');
            sb.classList.toggle('collapsed');
            const icon = document.getElementById('toggle-icon');
            if (sb.classList.contains('collapsed')) {
                icon.className = 'bi bi-chevron-double-right';
            } else {
                icon.className = 'bi bi-chevron-double-left';
            }
        }

        function initSidebar() {
            const sb = document.getElementById('sidebar');
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                sb.classList.add('collapsed');
                document.getElementById('toggle-icon').className = 'bi bi-chevron-double-right';
            } else {
                sb.classList.remove('collapsed');
                document.getElementById('toggle-icon').className = 'bi bi-chevron-double-left';
            }
        }

        document.addEventListener('DOMContentLoaded', initSidebar);

        function toggleSubmenu(id) {
            const menu = document.getElementById(id);
            const isVisible = (menu.style.display === 'flex');
            document.querySelectorAll('.submenu-settings').forEach(m => m.style.display = 'none');
            menu.style.display = isVisible ? 'none' : 'flex';
        }

        function switchMainTab(tab) {
            document.getElementById('view-vvod').style.display = tab === 'vvod' ? 'block' : 'none';
            document.getElementById('view-igra').style.display = tab === 'igra' ? 'block' : 'none';
            document.getElementById('tab-vvod').classList.toggle('active', tab === 'vvod');
            document.getElementById('tab-igra').classList.toggle('active', tab === 'igra');
        }

        function selectExercise(el, name) {
            const unit = el.getAttribute('data-unit');
            const input = document.getElementById('exercise-value');
            
            if (unit === 'time') {
                input.placeholder = "Напр: 20 или 1:30";
                input.pattern = "^(\\d+|\\d+:\\d+)$";
                input.title = "Введите число (секунды) или формат ММ:СС";
            } else {
                input.placeholder = "Напр: 20";
                input.pattern = "^[0-9]+$";
                input.title = "Введите только число";
            }

            document.querySelectorAll('.btn-check-custom').forEach(b => b.classList.remove('selected-ex'));
            el.classList.add('selected-ex');
            document.getElementById('selected-ex-name').value = name;
            document.getElementById('vvod-controls').style.display = 'block';
        }

        document.querySelectorAll('.btn-del-tiny').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const url = this.getAttribute('data-url');
                const name = this.getAttribute('data-name');
                document.getElementById('delItemName').innerText = name;
                document.getElementById('confirmDelLink').href = url + "?slug=${escapeHtml(room.slug)}";
                let myModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
                myModal.show();
            });
        });

        function updateGameValPlaceholder(selectElement) {
            var selectedOption = selectElement.options[selectElement.selectedIndex];
            var unit = selectedOption.getAttribute('data-unit');
            var inputField = document.getElementById('game_val_input');
            if (unit === 'time') {
                inputField.placeholder = "Кол-во или ММ:СС (1:30)";
                inputField.pattern = ".*\\S.*";
                inputField.title = "";
            } else {
                inputField.placeholder = "Только число (например, 50)";
                inputField.pattern = "^[0-9]+$";
                inputField.title = "Введите только число";
            }
        }
    </script>
</body>
</html>`
}

// ==================== МАРШРУТЫ ====================

app.get('/', (c) => c.html(renderCreateRoomPage()))

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0) return c.text('Комната не найдена', 404)

  const room = rooms[0]
  const roomId = room.room_id

  const profiles = (await c.env.DB.prepare('SELECT * FROM profiles WHERE room_id = ?').bind(roomId).all()).results
  const exTypes = (await c.env.DB.prepare('SELECT * FROM exercise_types WHERE room_id = ?').bind(roomId).all()).results
  const games = (await c.env.DB.prepare('SELECT * FROM games_presets WHERE room_id = ?').bind(roomId).all()).results
  const logs = (await c.env.DB.prepare("SELECT wl.*, p.name as profile_name FROM workout_logs wl LEFT JOIN profiles p ON wl.profile_id = p.id WHERE wl.room_id = ? ORDER BY wl.created_at DESC").bind(roomId).all()).results

  const idToName = {}
  profiles.forEach(p => idToName[p.id] = p.name)
  const exMap = {}
  exTypes.forEach(e => exMap[e.name] = e.unit_type)
  const exIcons = {}
  exTypes.forEach(e => exIcons[e.name] = e.unit_type === 'time' ? '🕒' : '💪')

  const hof = {}
  logs.forEach(l => {
    if (l.exercise_type === '🏆 Победа') {
      const name = idToName[l.profile_id] || l.profile_name
      hof[name] = (hof[name] || 0) + 1
    }
  })
  const hallOfFame = Object.entries(hof).map(([name, wins]) => ({ name, wins })).sort((a, b) => b.wins - a.wins)

  const summary = {}
  profiles.forEach(p => summary[p.name] = {})
  logs.forEach(l => {
    if (l.exercise_type === '🏆 Победа') return
    const name = idToName[l.profile_id] || l.profile_name
    if (summary[name] !== undefined) {
      summary[name][l.exercise_type] = (summary[name][l.exercise_type] || 0) + l.amount
    }
  })

  const cookie = c.req.header('Cookie') || ''
  const isAdmin = cookie.includes(`auth_${roomId}=1`)

  const lastLog = logs[0]
  const lastActionText = lastLog ? `Последнее: ${idToName[lastLog.profile_id] || lastLog.profile_name} - ${lastLog.exercise_type}` : ''

  return c.html(renderRoomPage(room, profiles, exTypes, games, logs, summary, hallOfFame, isAdmin, lastActionText, exIcons, exMap))
})

app.post('/create_room', async (c) => {
  const body = await c.req.parseBody()
  const { title, slug, password, tg_id } = body
  if (!title || !slug) return c.html(renderCreateRoomPage('Заполните все обязательные поля'))
  try {
    await c.env.DB.prepare('INSERT INTO rooms (slug, title, password, tg_chat_id) VALUES (?, ?, ?, ?)')
      .bind(slug, title, password, tg_id || null).run()
    const { results: roomRows } = await c.env.DB.prepare('SELECT room_id FROM rooms WHERE slug = ?').bind(slug).all()
    const roomId = roomRows[0].room_id
    await c.env.DB.prepare("INSERT OR IGNORE INTO exercise_types (room_id, name, unit_type) VALUES (?, '🏆 Победа', 'amount')").bind(roomId).run()
    return c.redirect(`/${slug}`)
  } catch (e) {
    return c.html(renderCreateRoomPage('Адрес уже занят или произошла ошибка'))
  }
})

app.post('/login', async (c) => {
  const body = await c.req.parseBody()
  const { slug, password } = body
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length > 0 && rooms[0].password === password) {
    c.header('Set-Cookie', `auth_${rooms[0].room_id}=1; Path=/; HttpOnly; SameSite=Lax`)
  }
  return c.redirect(`/${slug}`)
})

app.post('/logout', async (c) => {
  const slug = c.req.query('slug') || ''
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length > 0) {
    c.header('Set-Cookie', `auth_${rooms[0].room_id}=; Path=/; Max-Age=0; HttpOnly`)
  }
  return c.redirect(`/${slug}`)
})

app.post('/add_profile', async (c) => {
  const body = await c.req.parseBody()
  const { slug, name, password } = body
  if (!name || !name.trim()) return c.redirect(`/${slug}`)
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0 || !await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  const trimmedName = name.trim()
  const exists = await c.env.DB.prepare('SELECT 1 FROM profiles WHERE room_id = ? AND name = ?').bind(rooms[0].room_id, trimmedName).all()
  if (exists.results.length === 0) {
    await c.env.DB.prepare('INSERT INTO profiles (room_id, name) VALUES (?, ?)').bind(rooms[0].room_id, trimmedName).run()
  }
  return c.redirect(`/${slug}`)
})

app.post('/add_exercise', async (c) => {
  const body = await c.req.parseBody()
  const { slug, name, unit_type, password } = body
  if (!name || !name.trim() || name.trim() === '🏆 Победа') return c.redirect(`/${slug}`)
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0 || !await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  const trimmedName = name.trim()
  await c.env.DB.prepare('INSERT OR IGNORE INTO exercise_types (room_id, name, unit_type) VALUES (?, ?, ?)').bind(rooms[0].room_id, trimmedName, unit_type || 'amount').run()
  return c.redirect(`/${slug}`)
})

app.post('/add_game', async (c) => {
  const body = await c.req.parseBody()
  const { slug, name, ex_name, val, password } = body
  if (!name || !ex_name || !val) return c.redirect(`/${slug}`)
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0 || !await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  const numericVal = timeToSeconds(val)
  if (numericVal === null) return c.redirect(`/${slug}`)
  const unitType = (await c.env.DB.prepare('SELECT unit_type FROM exercise_types WHERE name = ? AND room_id = ?').bind(ex_name, rooms[0].room_id).all()).results[0]?.unit_type || 'amount'
  await c.env.DB.prepare('INSERT OR IGNORE INTO games_presets (room_id, game_name, ex_name, val, unit_type) VALUES (?, ?, ?, ?, ?)').bind(rooms[0].room_id, name.trim(), ex_name, numericVal, unitType).run()
  return c.redirect(`/${slug}`)
})

app.post('/add_log', async (c) => {
  const body = await c.req.parseBody()
  const { slug, profile_id, ex_name, value, action_type, password } = body
  if (!profile_id || !ex_name || !value) return c.redirect(`/${slug}`)
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0 || !await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  const numericVal = timeToSeconds(value)
  if (numericVal === null) return c.redirect(`/${slug}`)
  const amount = action_type === 'writeoff' ? -numericVal : numericVal
  await c.env.DB.prepare('INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, ?, ?, ?)').bind(profile_id, ex_name, amount, rooms[0].room_id).run()

  const pName = (await c.env.DB.prepare('SELECT name FROM profiles WHERE id = ?').bind(profile_id).all()).results[0]?.name || 'Кто-то'
  const actionTxt = action_type === 'writeoff' ? 'списал(а)' : 'получил(а) долг'
  await sendTgNotification(c.env, rooms[0], `⚖️ ${pName} ${actionTxt}: ${ex_name} (${value})`)

  return c.redirect(`/${slug}`)
})

app.post('/play_game', async (c) => {
  const body = await c.req.parseBody()
  const { slug, game_name, winner_ids, password } = body
  if (!game_name || !winner_ids || (Array.isArray(winner_ids) && winner_ids.length === 0)) return c.redirect(`/${slug}`)
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0 || !await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  const roomId = rooms[0].room_id
  const { results: games } = await c.env.DB.prepare('SELECT * FROM games_presets WHERE room_id = ? AND game_name = ?').bind(roomId, game_name).all()
  if (games.length === 0) return c.redirect(`/${slug}`)
  const game = games[0]
  const winnerList = Array.isArray(winner_ids) ? winner_ids : [winner_ids]
  const { results: allProfiles } = await c.env.DB.prepare('SELECT id, name FROM profiles WHERE room_id = ?').bind(roomId).all()
  const losers = []
  for (const p of allProfiles) {
    if (winnerList.includes(String(p.id))) {
      await c.env.DB.prepare("INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, '🏆 Победа', 1, ?)").bind(p.id, roomId).run()
    } else {
      await c.env.DB.prepare('INSERT INTO workout_logs (profile_id, exercise_type, amount, room_id) VALUES (?, ?, ?, ?)').bind(p.id, game.ex_name, game.val, roomId).run()
      losers.push(p.name)
    }
  }
  if (losers.length > 0) {
    const valDisplay = game.unit_type === 'time' ? formatTime(game.val) : game.val
    const msg = `🎮 Игра: ${game_name}\n💀 Проиграли: ${losers.join(', ')} (+${valDisplay} ${game.ex_name})`
    await sendTgNotification(c.env, rooms[0], msg)
  }
  return c.redirect(`/${slug}`)
})

app.get('/undo/:slug', async (c) => {
  const slug = c.req.param('slug')
  const { results: rooms } = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(slug).all()
  if (rooms.length === 0) return c.redirect('/')
  const password = c.req.query('password') || ''
  if (!await checkAdmin(c, slug, password)) return c.redirect(`/${slug}`)
  await c.env.DB.prepare("DELETE FROM workout_logs WHERE id = (SELECT id FROM workout_logs WHERE room_id = ? ORDER BY created_at DESC LIMIT 1)").bind(rooms[0].room_id).run()
  return c.redirect(`/${slug}`)
})

app.onError((err, c) => {
  console.error(`Ошибка: ${err.message}`)
  return c.text('Внутренняя ошибка сервера', 500)
})

export default {
  fetch: app.fetch
}
