/**
 * editor.js
 * Основной движок SwipEdit
 */
(function () {
  'use strict';

  // --- Справочник направлений нот ---
  const NOTE_TYPES = [
    { id: 'UP',         label: 'UP',         short: '↑', angle: -Math.PI / 2,      color: '#38bdf8', key: 'W / ↑' },
    { id: 'DOWN',       label: 'DOWN',       short: '↓', angle: Math.PI / 2,       color: '#f43f5e', key: 'S / ↓' },
    { id: 'LEFT',       label: 'LEFT',       short: '←', angle: Math.PI,           color: '#a855f7', key: 'A / ←' },
    { id: 'RIGHT',      label: 'RIGHT',      short: '→', angle: 0,                 color: '#22c55e', key: 'D / →' },
    { id: 'UP_LEFT',    label: 'UP_LEFT',    short: '↖', angle: -3 * Math.PI / 4,  color: '#06b6d4', key: 'Q' },
    { id: 'UP_RIGHT',   label: 'UP_RIGHT',   short: '↗', angle: -Math.PI / 4,      color: '#10b981', key: 'E' },
    { id: 'DOWN_LEFT',  label: 'DOWN_LEFT',  short: '↙', angle: 3 * Math.PI / 4,   color: '#ec4899', key: 'Z' },
    { id: 'DOWN_RIGHT', label: 'DOWN_RIGHT', short: '↘', angle: Math.PI / 4,       color: '#eab308', key: 'C' },
    // Реверс-ноты
    { id: 'REVERSE',      label: 'REVERSE',      short: '↻', angle: null, spin: 1,  color: '#f97316', key: 'R' },
    { id: 'REVERSE_BACK', label: 'REVERSE_BACK', short: '↺', angle: null, spin: -1, color: '#fb7185', key: 'F' }
  ];

  const NOTE_MAP = {};
  for (const nt of NOTE_TYPES) NOTE_MAP[nt.id] = nt;

  const MIRROR_H = {
    LEFT: 'RIGHT', RIGHT: 'LEFT',
    UP_LEFT: 'UP_RIGHT', UP_RIGHT: 'UP_LEFT',
    DOWN_LEFT: 'DOWN_RIGHT', DOWN_RIGHT: 'DOWN_LEFT',
    REVERSE: 'REVERSE_BACK', REVERSE_BACK: 'REVERSE'
  };
  const MIRROR_V = {
    UP: 'DOWN', DOWN: 'UP',
    UP_LEFT: 'DOWN_LEFT', DOWN_LEFT: 'UP_LEFT',
    UP_RIGHT: 'DOWN_RIGHT', DOWN_RIGHT: 'UP_RIGHT'
  };

  // --- Справочник всех 22 типов событий из chart.json ---
  const EVENT_DEFS = [
    // Надписи и скорость скролла
    {
      id: 'TEXT',
      cat: 'text_speed',
      label: 'TEXT (Надпись вместо комбо)',
      short: 'TEXT',
      color: '#facc15',
      hasDuration: true,
      defaultDuration: 2.0,
      hasText: true,
      defaultText: 'HI-TECH!',
      hasColor: true,
      defaultColor: '#ffffff',
      desc: 'Выводит кастомную надпись в зоне комбо/оценки (как на карте Hi-Tech и в интро)'
    },
    {
      id: 'NOTE_SPEED',
      cat: 'text_speed',
      label: 'NOTE_SPEED (Скорость скролла)',
      short: 'SPEED',
      color: '#38bdf8',
      hasSpeed: true,
      defaultSpeed: 1.5,
      desc: 'Меняет множитель скорости полёта нот (1 = базовая, 1.25 / 1.5 / 2 = быстрее)'
    },
    {
      id: 'HUD_HIDE',
      cat: 'text_speed',
      label: 'HUD_HIDE (Скрыть комбо / HUD)',
      short: 'HUD HIDE',
      color: '#f472b6',
      pairOff: 'HUD_SHOW',
      desc: 'Скрывает счётчик комбо и интерфейс перед появлением кастомных надписей TEXT (как на карте Hi-Tech)'
    },
    {
      id: 'HUD_SHOW',
      cat: 'text_speed',
      label: 'HUD_SHOW (Показать комбо / HUD)',
      short: 'HUD SHOW',
      color: '#34d399',
      desc: 'Возвращает счётчик комбо и интерфейс после серии надписей TEXT (как на карте Hi-Tech)'
    },
    {
      id: 'BG_COLOR',
      cat: 'text_speed',
      label: 'BG_COLOR (Смена цвета фона)',
      short: 'BG_COLOR',
      color: '#62a0ea',
      hasDuration: true,
      optionalDuration: true,
      defaultDuration: 2.0,
      hasColor: true,
      defaultColor: '#62a0ea',
      desc: 'Меняет цвет фона карты: при duration = 0 мгновенно, при duration > 0 плавно переливает к выбранному цвету'
    },
    // Поведение нот и камеры
    {
      id: 'NOTES_FLOW_RIGHT',
      cat: 'flow_cam',
      label: 'NOTES_FLOW_RIGHT (Поток вправо →)',
      short: 'FLOW →',
      color: '#22c55e',
      desc: 'Стандартное направление: ноты летят слева направо к линии удара'
    },
    {
      id: 'NOTES_FLOW_LEFT',
      cat: 'flow_cam',
      label: 'NOTES_FLOW_LEFT (Поток влево ←)',
      short: 'FLOW ←',
      color: '#14b8a6',
      desc: 'Реверс дорожки: линия удара переезжает влево, ноты летят справа налево'
    },
    {
      id: 'NOTES_BOUNCE_ON',
      cat: 'flow_cam',
      label: 'NOTES_BOUNCE_ON (Прыжки нот ВКЛ)',
      short: 'BOUNCE ON',
      color: '#a855f7',
      pairOff: 'NOTES_BOUNCE_OFF',
      desc: 'Ноты начинают прыгать вверх-вниз по синусоиде в такт биту'
    },
    {
      id: 'NOTES_BOUNCE_OFF',
      cat: 'flow_cam',
      label: 'NOTES_BOUNCE_OFF (Прыжки нот ВЫКЛ)',
      short: 'BOUNCE OFF',
      color: '#6b7280',
      desc: 'Выключает вертикальные прыжки нот'
    },
    {
      id: 'NOTES_SPIN_ON',
      cat: 'flow_cam',
      label: 'NOTES_SPIN_ON (Вращение нот ВКЛ)',
      short: 'SPIN ON',
      color: '#38bdf8',
      pairOff: 'NOTES_SPIN_OFF',
      desc: 'Ноты непрерывно вращаются вокруг своей оси во время полёта (из карт SwipeTrava и Ew.mp3)'
    },
    {
      id: 'NOTES_SPIN_OFF',
      cat: 'flow_cam',
      label: 'NOTES_SPIN_OFF (Вращение нот ВЫКЛ)',
      short: 'SPIN OFF',
      color: '#6b7280',
      desc: 'Выключает вращение нот'
    },
    {
      id: 'NOTES_WAVE_ON',
      cat: 'flow_cam',
      label: 'NOTES_WAVE_ON (Волна нот ВКЛ)',
      short: 'WAVE ON',
      color: '#06b6d4',
      pairOff: 'NOTES_WAVE_OFF',
      desc: 'Поток летящих нот изгибается плавной синусоидальной волной (из карт SwipeTrava и Ew.mp3)'
    },
    {
      id: 'NOTES_WAVE_OFF',
      cat: 'flow_cam',
      label: 'NOTES_WAVE_OFF (Волна нот ВЫКЛ)',
      short: 'WAVE OFF',
      color: '#6b7280',
      desc: 'Выключает волновое движение нот'
    },
    {
      id: 'NOTE_PUSH_ON',
      cat: 'flow_cam',
      label: 'NOTE_PUSH_ON (Толчок нот ВКЛ)',
      short: 'PUSH ON',
      color: '#ec4899',
      pairOff: 'NOTE_PUSH_OFF',
      desc: 'Импульсное подёргивание дорожки нот на каждую долю'
    },
    {
      id: 'NOTE_PUSH_OFF',
      cat: 'flow_cam',
      label: 'NOTE_PUSH_OFF (Толчок нот ВЫКЛ)',
      short: 'PUSH OFF',
      color: '#6b7280',
      desc: 'Выключает импульсный толчок нот'
    },
    {
      id: 'CAMERA_BOB_ON',
      cat: 'flow_cam',
      label: 'CAMERA_BOB_ON (Качание камеры ВКЛ)',
      short: 'CAM BOB ON',
      color: '#f97316',
      pairOff: 'CAMERA_BOB_OFF',
      desc: 'Камера ритмично покачивается и пульсирует в такт BPM'
    },
    {
      id: 'CAMERA_BOB_OFF',
      cat: 'flow_cam',
      label: 'CAMERA_BOB_OFF (Качание камеры ВЫКЛ)',
      short: 'CAM BOB OFF',
      color: '#6b7280',
      desc: 'Останавливает покачивание камеры'
    },
    {
      id: 'SHAKE',
      cat: 'flow_cam',
      label: 'SHAKE (Тряска экрана)',
      short: 'SHAKE',
      color: '#ef4444',
      desc: 'Резкий ударный шейк камеры'
    },
    {
      id: 'FLASH',
      cat: 'flow_cam',
      label: 'FLASH (Вспышка мгновенная / долгая)',
      short: 'FLASH',
      color: '#fde047',
      hasDuration: true,
      optionalDuration: true,
      defaultDuration: 0,
      desc: 'Яркая вспышка: при duration = 0 — короткая ударная, при duration > 0 — долгая плавная (как на Hi-Tech)'
    },
    {
      id: 'DISCO',
      cat: 'flow_cam',
      label: 'DISCO (Неоновая диско-подсветка)',
      short: 'DISCO',
      color: '#e879f9',
      hasDuration: true,
      defaultDuration: 12.0,
      desc: 'Ритмичное переливание неоновых цветов и прожекторов в такт биту на время duration (из карты Hi-Tech)'
    },
    {
      id: 'BLACKOUT',
      cat: 'flow_cam',
      label: 'BLACKOUT (Затемнение)',
      short: 'BLACKOUT',
      color: '#94a3b8',
      hasDuration: true,
      defaultDuration: 3.0,
      desc: 'Погружает экран в темноту на указанное время (duration)'
    },
    // Шейдерные эффекты FX_*
    {
      id: 'FX_PIXELATE',
      cat: 'fx',
      label: 'FX_PIXELATE (Пикселизация)',
      short: 'FX_PIXELATE',
      color: '#a3e635',
      hasDuration: true,
      defaultDuration: 8.0,
      desc: 'Ретро-пикселизация изображения на время duration (из карты Hi-Tech)'
    },
    {
      id: 'FX_GLITCH',
      cat: 'fx',
      label: 'FX_GLITCH (Глитч полосами)',
      short: 'FX_GLITCH',
      color: '#f43f5e',
      hasDuration: true,
      defaultDuration: 0.5,
      desc: 'Цифровой глитч с разрывом полос и сдвигом сканлайнов'
    },
    {
      id: 'FX_RGB_SPLIT',
      cat: 'fx',
      label: 'FX_RGB_SPLIT (Хроматический RGB-раскол)',
      short: 'FX_RGB_SPLIT',
      color: '#fb7185',
      hasDuration: true,
      defaultDuration: 4.0,
      desc: 'Сильное расслоение RGB-каналов экрана на время duration (из карты Tearout)'
    },
    {
      id: 'FX_AQUA',
      cat: 'fx',
      label: 'FX_AQUA (Подводный аква-шейдер)',
      short: 'FX_AQUA',
      color: '#22d3ee',
      hasDuration: true,
      defaultDuration: 8.0,
      desc: 'Подводное преломление с мягкими аква-волнами и бликами (из карты swtv)'
    },
    {
      id: 'FX_INVERT',
      cat: 'fx',
      label: 'FX_INVERT (Инверсия цветов)',
      short: 'FX_INVERT',
      color: '#e879f9',
      hasDuration: true,
      defaultDuration: 0.5,
      desc: 'Негатив экрана на время duration'
    },
    {
      id: 'FX_BW',
      cat: 'fx',
      label: 'FX_BW (Чёрно-белый)',
      short: 'FX_BW',
      color: '#cbd5e1',
      hasDuration: true,
      defaultDuration: 0.5,
      desc: 'Обесцвечивание с повышенным контрастом'
    },
    {
      id: 'FX_DUOTONE',
      cat: 'fx',
      label: 'FX_DUOTONE (Дуотон)',
      short: 'FX_DUOTONE',
      color: '#c084fc',
      hasDuration: true,
      defaultDuration: 0.8,
      desc: 'Двухцветный контрастный градиент'
    },
    {
      id: 'FX_HALFTONE',
      cat: 'fx',
      label: 'FX_HALFTONE (Полутоновый растр)',
      short: 'FX_HALFTONE',
      color: '#34d399',
      hasDuration: true,
      defaultDuration: 0.5,
      desc: 'Комиксный точечный растр поверх сцены'
    },
    {
      id: 'FX_OLD_TV',
      cat: 'fx',
      label: 'FX_OLD_TV (Старый ТВ / CRT)',
      short: 'FX_OLD_TV',
      color: '#60a5fa',
      hasDuration: true,
      defaultDuration: 0.5,
      desc: 'Эффект старого телевизора со сканлайнами и помехами'
    },
    {
      id: 'FX_POSTERIZE',
      cat: 'fx',
      label: 'FX_POSTERIZE (Постеризация)',
      short: 'FX_POSTERIZE',
      color: '#fbbf24',
      hasDuration: true,
      defaultDuration: 0.8,
      desc: 'Резкое квантование палитры цветов'
    },
    {
      id: 'FX_WAVE',
      cat: 'fx',
      label: 'FX_WAVE (Волновое искажение)',
      short: 'FX_WAVE',
      color: '#2dd4bf',
      hasDuration: true,
      defaultDuration: 0.8,
      desc: 'Синусоидальное искривление экрана'
    },
    {
      id: 'FX_ZOOM_BLUR',
      cat: 'fx',
      label: 'FX_ZOOM_BLUR (Зум-блюр)',
      short: 'FX_ZOOM_BLUR',
      color: '#fb7185',
      hasDuration: true,
      defaultDuration: 0.6,
      desc: 'Радиальное размытие и зум к центру'
    },
    {
      id: 'FX_ASH_WIND',
      cat: 'fx',
      label: 'FX_ASH_WIND (Пепельный ветер)',
      short: 'FX_ASH_WIND',
      color: '#d6d3d1',
      hasDuration: true,
      defaultDuration: 4.0,
      desc: 'Трёхслойный пепел на ветру, горячее марево и тёплый пепельный грейд'
    },
    {
      id: 'FX_DREAD',
      cat: 'fx',
      label: 'FX_DREAD (Тени с краёв / Dread)',
      short: 'FX_DREAD',
      color: '#ef4444',
      hasDuration: true,
      defaultDuration: 4.0,
      desc: 'Пульсирующие тени с краёв экрана с хроматическим сдвигом и зерном'
    },
    {
      id: 'FX_ENDING',
      cat: 'fx',
      label: 'FX_ENDING (Кинематографичный финал / интро)',
      short: 'FX_ENDING',
      color: '#818cf8',
      hasDuration: true,
      defaultDuration: 4.8,
      desc: 'Эффект интро/концовки с кинематографичными полосами и виньеткой'
    }
  ];

  const EVENT_MAP = {};
  for (const ed of EVENT_DEFS) EVENT_MAP[ed.id] = ed;

  // --- Состояние проекта ---
  const PLAYLISTS_BUNDLE = {"coverBank": {"cov_210644cf5f": "data:image/webp;base64,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", "cov_f85a5f3e4b": "data:image/webp;base64,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", "cov_beda754125": "data:image/webp;base64,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", "cov_48150a8034": "data:image/webp;base64,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", "bg_1d59c2f79a": "data:image/webp;base64,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"}, "playlists": {"SWIPETAVA OST": {"id": "SWIPETAVA OST", "title": "Swipetava OST", "author": "Antonballls & [SWC]rew", "songs": {"BATKA": {"folder": "BATKA", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/BATKA/track.ogg", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "11 lifes", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 2.0, "menu_color": "#00008B"}, "chart": {"bpm": 100, "noteTravelTime": 1000, "gridOffset": 0.343, "timing": [{"time": 0.343, "bpm": 100}], "notes": [{"time": 0.193, "type": "UP"}, {"time": 0.793, "type": "DOWN"}, {"time": 1.393, "type": "UP"}, {"time": 1.993, "type": "DOWN"}, {"time": 2.593, "type": "UP"}, {"time": 3.193, "type": "DOWN"}, {"time": 3.793, "type": "UP"}, {"time": 4.393, "type": "DOWN"}, {"time": 4.993, "type": "RIGHT"}, {"time": 5.593, "type": "LEFT"}, {"time": 6.193, "type": "RIGHT"}, {"time": 6.793, "type": "LEFT"}, {"time": 7.393, "type": "UP"}, {"time": 7.993, "type": "DOWN"}, {"time": 8.593, "type": "UP"}, {"time": 9.193, "type": "DOWN"}, {"time": 9.793, "type": "LEFT"}, {"time": 10.393, "type": "RIGHT"}, {"time": 10.993, "type": "LEFT"}, {"time": 11.593, "type": "RIGHT"}, {"time": 12.193, "type": "LEFT"}, {"time": 12.793, "type": "RIGHT"}, {"time": 13.393, "type": "LEFT"}, {"time": 13.993, "type": "RIGHT"}, {"time": 14.593, "type": "UP"}, {"time": 15.193, "type": "DOWN"}, {"time": 15.793, "type": "LEFT"}, {"time": 16.393, "type": "RIGHT"}, {"time": 16.993, "type": "UP"}, {"time": 17.593, "type": "DOWN"}, {"time": 18.193, "type": "UP"}, {"time": 18.793, "type": "DOWN"}, {"time": 19.093, "type": "RIGHT"}, {"time": 19.693, "type": "LEFT"}, {"time": 20.293, "type": "RIGHT"}, {"time": 20.893, "type": "LEFT"}, {"time": 21.493, "type": "RIGHT"}, {"time": 22.093, "type": "UP"}, {"time": 22.693, "type": "DOWN"}, {"time": 23.293, "type": "UP"}, {"time": 23.593, "type": "DOWN"}, {"time": 23.893, "type": "RIGHT"}, {"time": 24.493, "type": "UP"}, {"time": 25.093, "type": "DOWN"}, {"time": 25.693, "type": "UP"}, {"time": 26.293, "type": "DOWN"}, {"time": 26.893, "type": "RIGHT"}, {"time": 27.493, "type": "LEFT"}, {"time": 28.093, "type": "LEFT"}, {"time": 28.393, "type": "RIGHT"}, {"time": 28.693, "type": "LEFT"}, {"time": 29.293, "type": "LEFT"}, {"time": 29.893, "type": "RIGHT"}, {"time": 30.493, "type": "UP"}, {"time": 31.093, "type": "DOWN"}, {"time": 31.693, "type": "UP"}, {"time": 31.993, "type": "DOWN"}, {"time": 32.293, "type": "RIGHT"}, {"time": 32.893, "type": "UP"}, {"time": 33.493, "type": "DOWN"}, {"time": 34.093, "type": "UP"}, {"time": 34.693, "type": "DOWN"}, {"time": 35.293, "type": "RIGHT"}, {"time": 35.893, "type": "LEFT"}, {"time": 36.493, "type": "RIGHT"}, {"time": 36.793, "type": "LEFT"}, {"time": 37.093, "type": "RIGHT"}, {"time": 37.393, "type": "UP"}, {"time": 37.693, "type": "DOWN"}, {"time": 37.993, "type": "UP"}, {"time": 38.893, "type": "UP"}, {"time": 40.093, "type": "DOWN"}, {"time": 41.293, "type": "RIGHT"}, {"time": 42.493, "type": "LEFT"}, {"time": 43.693, "type": "DOWN"}, {"time": 44.893, "type": "UP"}, {"time": 46.093, "type": "LEFT"}, {"time": 47.293, "type": "RIGHT"}, {"time": 48.493, "type": "UP"}, {"time": 49.693, "type": "DOWN"}, {"time": 50.893, "type": "RIGHT"}, {"time": 52.093, "type": "LEFT"}, {"time": 53.293, "type": "DOWN"}, {"time": 54.493, "type": "UP"}, {"time": 55.693, "type": "LEFT"}, {"time": 56.893, "type": "RIGHT"}, {"time": 57.493, "type": "UP"}, {"time": 58.093, "type": "UP"}, {"time": 58.693, "type": "DOWN"}, {"time": 59.293, "type": "DOWN"}, {"time": 59.893, "type": "UP"}, {"time": 60.493, "type": "UP"}, {"time": 61.093, "type": "DOWN"}, {"time": 61.693, "type": "DOWN"}, {"time": 62.293, "type": "LEFT"}, {"time": 62.893, "type": "LEFT"}, {"time": 63.493, "type": "RIGHT"}, {"time": 64.093, "type": "RIGHT"}, {"time": 64.693, "type": "LEFT"}, {"time": 65.293, "type": "LEFT"}, {"time": 65.893, "type": "RIGHT"}, {"time": 66.493, "type": "RIGHT"}, {"time": 67.093, "type": "RIGHT"}, {"time": 67.693, "type": "LEFT"}, {"time": 68.293, "type": "RIGHT"}, {"time": 68.893, "type": "LEFT"}, {"time": 69.493, "type": "RIGHT"}, {"time": 70.093, "type": "UP"}, {"time": 70.693, "type": "DOWN"}, {"time": 71.293, "type": "UP"}, {"time": 71.593, "type": "DOWN"}, {"time": 71.893, "type": "RIGHT"}, {"time": 72.493, "type": "UP"}, {"time": 73.093, "type": "DOWN"}, {"time": 73.693, "type": "UP"}, {"time": 74.293, "type": "DOWN"}, {"time": 74.893, "type": "RIGHT"}, {"time": 75.493, "type": "LEFT"}, {"time": 76.093, "type": "LEFT"}, {"time": 76.393, "type": "RIGHT"}, {"time": 76.693, "type": "LEFT"}, {"time": 77.293, "type": "LEFT"}, {"time": 77.893, "type": "RIGHT"}, {"time": 78.493, "type": "UP"}, {"time": 79.093, "type": "DOWN"}, {"time": 79.693, "type": "UP"}, {"time": 79.993, "type": "DOWN"}, {"time": 80.293, "type": "RIGHT"}, {"time": 80.893, "type": "UP"}, {"time": 81.493, "type": "DOWN"}, {"time": 82.093, "type": "UP"}, {"time": 82.693, "type": "DOWN"}, {"time": 83.293, "type": "RIGHT"}, {"time": 83.893, "type": "LEFT"}, {"time": 84.493, "type": "RIGHT"}, {"time": 84.793, "type": "LEFT"}, {"time": 85.093, "type": "RIGHT"}, {"time": 85.393, "type": "UP"}, {"time": 85.693, "type": "DOWN"}, {"time": 85.993, "type": "UP"}, {"time": 86.293, "type": "UP"}, {"time": 86.893, "type": "UP"}, {"time": 88.093, "type": "DOWN"}, {"time": 89.293, "type": "RIGHT"}, {"time": 90.493, "type": "LEFT"}, {"time": 91.693, "type": "DOWN"}, {"time": 92.893, "type": "UP"}, {"time": 94.093, "type": "LEFT"}, {"time": 95.293, "type": "RIGHT"}, {"time": 96.493, "type": "UP"}, {"time": 97.693, "type": "DOWN"}, {"time": 98.893, "type": "RIGHT"}, {"time": 100.093, "type": "LEFT"}, {"time": 101.293, "type": "DOWN"}, {"time": 102.493, "type": "UP"}, {"time": 103.693, "type": "LEFT"}, {"time": 104.893, "type": "RIGHT"}], "events": [{"time": 3.793, "type": "FLASH", "duration": 0.9}, {"time": 8.593, "type": "FLASH", "duration": 0.9}, {"time": 13.393, "type": "FLASH", "duration": 0.9}, {"time": 14.593, "type": "BG_COLOR", "duration": 4.5, "color": "#000928"}, {"time": 18.343, "type": "FLASH", "duration": 0.9}, {"time": 19.243, "type": "CAMERA_BOB_ON"}, {"time": 21.943, "type": "FLASH", "duration": 2.1}, {"time": 37.393, "type": "FLASH", "duration": 0.6}, {"time": 37.993, "type": "BG_COLOR", "color": "#000928"}, {"time": 37.993, "type": "BG_COLOR", "duration": 5.1, "color": "#62a0ea"}, {"time": 41.143, "type": "FLASH", "duration": 1.95}, {"time": 43.093, "type": "BG_COLOR", "color": "#000928"}, {"time": 43.093, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 45.943, "type": "FLASH", "duration": 1.95}, {"time": 47.893, "type": "BG_COLOR", "color": "#000928"}, {"time": 47.893, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 50.743, "type": "FLASH", "duration": 1.95}, {"time": 52.693, "type": "BG_COLOR", "color": "#000928"}, {"time": 52.693, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 55.543, "type": "FLASH", "duration": 1.95}, {"time": 57.493, "type": "BG_COLOR", "color": "#000928"}, {"time": 57.943, "type": "BG_COLOR", "duration": 7.2, "color": "#62a0ea"}, {"time": 65.143, "type": "BG_COLOR", "duration": 7.2, "color": "#000928"}, {"time": 72.343, "type": "BG_COLOR", "duration": 7.2, "color": "#62a0ea"}, {"time": 79.543, "type": "BG_COLOR", "duration": 6.75, "color": "#000928"}, {"time": 85.243, "type": "FLASH", "duration": 1.05}, {"time": 86.293, "type": "BG_COLOR", "color": "#000928"}, {"time": 86.293, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 89.743, "type": "FLASH", "duration": 1.35}, {"time": 91.093, "type": "BG_COLOR", "color": "#000928"}, {"time": 91.093, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 94.543, "type": "FLASH", "duration": 1.35}, {"time": 95.893, "type": "BG_COLOR", "color": "#000928"}, {"time": 95.893, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 99.343, "type": "FLASH", "duration": 1.35}, {"time": 100.693, "type": "BG_COLOR", "color": "#000928"}, {"time": 100.693, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 104.443, "type": "FLASH", "duration": 1.05}, {"time": 105.493, "type": "BG_COLOR", "duration": 4.8, "color": "#62a0ea"}, {"time": 105.493, "type": "BG_COLOR", "color": "#000928"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "CPAMOTA": {"folder": "CPAMOTA", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/CPAMOTA/track.ogg", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "CPAMOTA", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 9.0, "menu_color": "#ffffff"}, "chart": {"bpm": 140, "noteTravelTime": 1000, "notes": [{"time": 0.014, "type": "UP"}, {"time": 0.443, "type": "DOWN"}, {"time": 0.871, "type": "UP"}, {"time": 1.3, "type": "DOWN"}, {"time": 1.728, "type": "RIGHT"}, {"time": 2.157, "type": "LEFT"}, {"time": 2.585, "type": "RIGHT"}, {"time": 3.014, "type": "LEFT"}, {"time": 3.443, "type": "UP"}, {"time": 3.872, "type": "DOWN"}, {"time": 4.3, "type": "UP"}, {"time": 4.729, "type": "DOWN"}, {"time": 5.157, "type": "RIGHT"}, {"time": 5.586, "type": "LEFT"}, {"time": 6.014, "type": "RIGHT"}, {"time": 6.443, "type": "LEFT"}, {"time": 6.871, "type": "UP"}, {"time": 7.3, "type": "UP"}, {"time": 7.728, "type": "UP"}, {"time": 8.157, "type": "UP"}, {"time": 8.585, "type": "UP"}, {"time": 9.014, "type": "DOWN"}, {"time": 9.657, "type": "DOWN"}, {"time": 10.3, "type": "DOWN"}, {"time": 10.943, "type": "DOWN"}, {"time": 11.3, "type": "DOWN"}, {"time": 12.014, "type": "DOWN"}, {"time": 13.3, "type": "UP"}, {"time": 13.514, "type": "UP"}, {"time": 13.728, "type": "UP"}, {"time": 13.943, "type": "RIGHT"}, {"time": 14.157, "type": "DOWN"}, {"time": 14.371, "type": "RIGHT"}, {"time": 14.585, "type": "UP"}, {"time": 14.8, "type": "DOWN"}, {"time": 15.014, "type": "RIGHT"}, {"time": 15.228, "type": "UP"}, {"time": 15.443, "type": "DOWN"}, {"time": 15.657, "type": "UP"}, {"time": 15.871, "type": "DOWN"}, {"time": 16.085, "type": "UP"}, {"time": 16.3, "type": "DOWN"}, {"time": 16.514, "type": "UP"}, {"time": 16.728, "type": "RIGHT"}, {"time": 16.943, "type": "LEFT"}, {"time": 17.157, "type": "UP"}, {"time": 17.371, "type": "UP_RIGHT"}, {"time": 17.585, "type": "DOWN"}, {"time": 17.8, "type": "DOWN_RIGHT"}, {"time": 18.014, "type": "UP"}, {"time": 18.228, "type": "UP_RIGHT"}, {"time": 18.442, "type": "DOWN"}, {"time": 18.657, "type": "DOWN_RIGHT"}, {"time": 18.871, "type": "UP"}, {"time": 19.085, "type": "DOWN"}, {"time": 19.3, "type": "LEFT"}, {"time": 19.514, "type": "RIGHT"}, {"time": 19.728, "type": "UP"}, {"time": 19.943, "type": "UP"}, {"time": 20.157, "type": "DOWN"}, {"time": 20.371, "type": "DOWN"}, {"time": 20.585, "type": "REVERSE"}, {"time": 20.8, "type": "UP"}, {"time": 21.015, "type": "RIGHT"}, {"time": 21.229, "type": "DOWN"}, {"time": 21.443, "type": "RIGHT"}, {"time": 21.657, "type": "UP"}, {"time": 21.872, "type": "DOWN"}, {"time": 22.086, "type": "RIGHT"}, {"time": 22.3, "type": "UP"}, {"time": 22.515, "type": "DOWN"}, {"time": 22.729, "type": "UP"}, {"time": 22.943, "type": "DOWN"}, {"time": 23.157, "type": "UP"}, {"time": 23.372, "type": "DOWN"}, {"time": 23.586, "type": "UP"}, {"time": 23.8, "type": "RIGHT"}, {"time": 24.015, "type": "LEFT"}, {"time": 24.229, "type": "UP"}, {"time": 24.443, "type": "UP_RIGHT"}, {"time": 24.657, "type": "DOWN"}, {"time": 24.872, "type": "DOWN_RIGHT"}, {"time": 25.086, "type": "UP"}, {"time": 25.3, "type": "UP_RIGHT"}, {"time": 25.514, "type": "DOWN"}, {"time": 25.729, "type": "DOWN_RIGHT"}, {"time": 25.943, "type": "UP"}, {"time": 26.157, "type": "DOWN"}, {"time": 26.372, "type": "LEFT"}, {"time": 26.586, "type": "RIGHT"}, {"time": 26.8, "type": "UP"}, {"time": 27.015, "type": "UP"}, {"time": 27.229, "type": "DOWN"}, {"time": 27.443, "type": "REVERSE_BACK"}, {"time": 27.657, "type": "UP"}, {"time": 27.872, "type": "RIGHT"}, {"time": 28.086, "type": "DOWN"}, {"time": 28.3, "type": "RIGHT"}, {"time": 28.514, "type": "UP"}, {"time": 28.729, "type": "DOWN"}, {"time": 28.943, "type": "RIGHT"}, {"time": 29.157, "type": "UP"}, {"time": 29.372, "type": "DOWN"}, {"time": 29.586, "type": "UP"}, {"time": 29.8, "type": "DOWN"}, {"time": 30.014, "type": "UP"}, {"time": 30.229, "type": "DOWN"}, {"time": 30.443, "type": "UP"}, {"time": 30.657, "type": "RIGHT"}, {"time": 30.872, "type": "LEFT"}, {"time": 31.086, "type": "UP"}, {"time": 31.3, "type": "UP_RIGHT"}, {"time": 31.514, "type": "DOWN"}, {"time": 31.729, "type": "DOWN_RIGHT"}, {"time": 31.943, "type": "UP"}, {"time": 32.157, "type": "UP_RIGHT"}, {"time": 32.371, "type": "DOWN"}, {"time": 32.586, "type": "DOWN_RIGHT"}, {"time": 32.8, "type": "UP"}, {"time": 33.014, "type": "DOWN"}, {"time": 33.229, "type": "LEFT"}, {"time": 33.443, "type": "RIGHT"}, {"time": 33.657, "type": "UP"}, {"time": 33.872, "type": "UP"}, {"time": 34.086, "type": "DOWN"}, {"time": 34.3, "type": "REVERSE"}, {"time": 34.514, "type": "UP"}, {"time": 34.728, "type": "DOWN"}, {"time": 34.942, "type": "RIGHT"}, {"time": 35.156, "type": "UP"}, {"time": 35.371, "type": "DOWN"}, {"time": 35.585, "type": "RIGHT"}, {"time": 35.799, "type": "UP"}, {"time": 36.014, "type": "DOWN"}, {"time": 36.228, "type": "UP"}, {"time": 36.442, "type": "DOWN"}, {"time": 36.656, "type": "UP"}, {"time": 36.871, "type": "DOWN"}, {"time": 37.085, "type": "UP"}, {"time": 37.299, "type": "RIGHT"}, {"time": 37.514, "type": "LEFT"}, {"time": 37.728, "type": "UP"}, {"time": 37.942, "type": "UP_RIGHT"}, {"time": 38.156, "type": "DOWN"}, {"time": 38.371, "type": "DOWN_RIGHT"}, {"time": 38.585, "type": "UP"}, {"time": 38.799, "type": "UP_RIGHT"}, {"time": 39.013, "type": "DOWN"}, {"time": 39.228, "type": "DOWN_RIGHT"}, {"time": 39.442, "type": "UP"}, {"time": 39.656, "type": "DOWN"}, {"time": 39.871, "type": "LEFT"}, {"time": 40.085, "type": "RIGHT"}, {"time": 40.299, "type": "UP"}, {"time": 40.514, "type": "UP"}, {"time": 40.728, "type": "DOWN"}, {"time": 40.942, "type": "DOWN"}, {"time": 41.157, "type": "UP"}, {"time": 41.585, "type": "RIGHT"}, {"time": 42.014, "type": "DOWN"}, {"time": 42.443, "type": "LEFT"}, {"time": 42.871, "type": "UP"}, {"time": 43.3, "type": "UP"}, {"time": 43.728, "type": "LEFT"}, {"time": 44.157, "type": "UP"}, {"time": 44.585, "type": "UP"}, {"time": 45.014, "type": "RIGHT"}, {"time": 45.443, "type": "DOWN"}, {"time": 45.871, "type": "RIGHT"}, {"time": 46.3, "type": "UP"}, {"time": 46.728, "type": "LEFT"}, {"time": 47.157, "type": "UP"}, {"time": 47.585, "type": "RIGHT"}, {"time": 48.014, "type": "UP"}, {"time": 48.443, "type": "RIGHT"}, {"time": 48.871, "type": "UP"}, {"time": 49.3, "type": "LEFT"}, {"time": 49.728, "type": "DOWN"}, {"time": 50.157, "type": "RIGHT"}, {"time": 50.585, "type": "DOWN"}, {"time": 51.014, "type": "LEFT"}, {"time": 51.434, "type": "REVERSE_BACK"}, {"time": 53.157, "type": "DOWN"}, {"time": 54.443, "type": "UP"}, {"time": 54.657, "type": "DOWN"}, {"time": 54.871, "type": "UP"}, {"time": 55.085, "type": "UP"}, {"time": 55.3, "type": "RIGHT"}, {"time": 55.514, "type": "DOWN"}, {"time": 55.728, "type": "RIGHT"}, {"time": 55.942, "type": "UP"}, {"time": 56.157, "type": "DOWN"}, {"time": 56.371, "type": "RIGHT"}, {"time": 56.585, "type": "UP"}, {"time": 56.8, "type": "DOWN"}, {"time": 57.014, "type": "UP"}, {"time": 57.228, "type": "DOWN"}, {"time": 57.442, "type": "UP"}, {"time": 57.657, "type": "DOWN"}, {"time": 57.871, "type": "UP"}, {"time": 58.085, "type": "RIGHT"}, {"time": 58.3, "type": "LEFT"}, {"time": 58.514, "type": "UP"}, {"time": 58.728, "type": "UP_RIGHT"}, {"time": 58.942, "type": "DOWN"}, {"time": 59.157, "type": "DOWN_RIGHT"}, {"time": 59.371, "type": "UP"}, {"time": 59.585, "type": "UP_RIGHT"}, {"time": 59.799, "type": "DOWN"}, {"time": 60.014, "type": "DOWN_RIGHT"}, {"time": 60.228, "type": "UP"}, {"time": 60.442, "type": "DOWN"}, {"time": 60.657, "type": "LEFT"}, {"time": 60.871, "type": "RIGHT"}, {"time": 61.085, "type": "UP"}, {"time": 61.3, "type": "UP"}, {"time": 61.514, "type": "DOWN"}, {"time": 61.728, "type": "DOWN"}, {"time": 61.942, "type": "REVERSE"}, {"time": 62.157, "type": "UP"}, {"time": 62.372, "type": "RIGHT"}, {"time": 62.586, "type": "DOWN"}, {"time": 62.8, "type": "RIGHT"}, {"time": 63.014, "type": "UP"}, {"time": 63.229, "type": "DOWN"}, {"time": 63.443, "type": "RIGHT"}, {"time": 63.657, "type": "UP"}, {"time": 63.872, "type": "DOWN"}, {"time": 64.086, "type": "UP"}, {"time": 64.3, "type": "DOWN"}, {"time": 64.514, "type": "UP"}, {"time": 64.729, "type": "DOWN"}, {"time": 64.943, "type": "UP"}, {"time": 65.157, "type": "RIGHT"}, {"time": 65.372, "type": "LEFT"}, {"time": 65.586, "type": "UP"}, {"time": 65.8, "type": "UP_RIGHT"}, {"time": 66.014, "type": "DOWN"}, {"time": 66.229, "type": "DOWN_RIGHT"}, {"time": 66.443, "type": "UP"}, {"time": 66.657, "type": "UP_RIGHT"}, {"time": 66.871, "type": "DOWN"}, {"time": 67.086, "type": "DOWN_RIGHT"}, {"time": 67.3, "type": "UP"}, {"time": 67.514, "type": "DOWN"}, {"time": 67.729, "type": "LEFT"}, {"time": 67.943, "type": "RIGHT"}, {"time": 68.157, "type": "UP"}, {"time": 68.372, "type": "UP"}, {"time": 68.585, "type": "REVERSE_BACK"}, {"time": 68.8, "type": "UP"}, {"time": 69.014, "type": "DOWN"}, {"time": 69.228, "type": "RIGHT"}, {"time": 69.442, "type": "UP"}, {"time": 69.657, "type": "DOWN"}, {"time": 69.871, "type": "RIGHT"}, {"time": 70.085, "type": "UP"}, {"time": 70.3, "type": "DOWN"}, {"time": 70.514, "type": "UP"}, {"time": 70.728, "type": "DOWN"}, {"time": 70.942, "type": "UP"}, {"time": 71.157, "type": "DOWN"}, {"time": 71.371, "type": "UP"}, {"time": 71.585, "type": "RIGHT"}, {"time": 71.8, "type": "LEFT"}, {"time": 72.014, "type": "UP"}, {"time": 72.228, "type": "UP_RIGHT"}, {"time": 72.442, "type": "DOWN"}, {"time": 72.657, "type": "DOWN_RIGHT"}, {"time": 72.871, "type": "UP"}, {"time": 73.085, "type": "UP_RIGHT"}, {"time": 73.299, "type": "DOWN"}, {"time": 73.514, "type": "DOWN_RIGHT"}, {"time": 73.728, "type": "UP"}, {"time": 73.942, "type": "DOWN"}, {"time": 74.157, "type": "LEFT"}, {"time": 74.371, "type": "RIGHT"}, {"time": 74.585, "type": "UP"}, {"time": 74.8, "type": "UP"}, {"time": 75.014, "type": "DOWN"}, {"time": 75.228, "type": "DOWN"}, {"time": 75.442, "type": "REVERSE"}, {"time": 75.657, "type": "UP"}, {"time": 75.872, "type": "RIGHT"}, {"time": 76.086, "type": "DOWN"}, {"time": 76.3, "type": "RIGHT"}, {"time": 76.514, "type": "UP"}, {"time": 76.729, "type": "DOWN"}, {"time": 76.943, "type": "RIGHT"}, {"time": 77.157, "type": "UP"}, {"time": 77.372, "type": "DOWN"}, {"time": 77.586, "type": "UP"}, {"time": 77.8, "type": "DOWN"}, {"time": 78.014, "type": "UP"}, {"time": 78.229, "type": "DOWN"}, {"time": 78.443, "type": "UP"}, {"time": 78.657, "type": "RIGHT"}, {"time": 78.872, "type": "LEFT"}, {"time": 79.086, "type": "UP"}, {"time": 79.3, "type": "UP_RIGHT"}, {"time": 79.514, "type": "DOWN"}, {"time": 79.729, "type": "DOWN_RIGHT"}, {"time": 79.943, "type": "UP"}, {"time": 80.157, "type": "UP_RIGHT"}, {"time": 80.371, "type": "DOWN"}, {"time": 80.586, "type": "DOWN_RIGHT"}, {"time": 80.8, "type": "UP"}, {"time": 81.014, "type": "DOWN"}, {"time": 81.229, "type": "LEFT"}, {"time": 81.443, "type": "RIGHT"}, {"time": 81.657, "type": "UP"}, {"time": 81.872, "type": "UP"}, {"time": 82.086, "type": "DOWN"}, {"time": 82.3, "type": "REVERSE_BACK"}, {"time": 82.728, "type": "UP"}, {"time": 83.156, "type": "UP"}, {"time": 83.585, "type": "DOWN"}, {"time": 84.013, "type": "UP"}, {"time": 84.442, "type": "RIGHT"}, {"time": 84.871, "type": "DOWN"}, {"time": 85.299, "type": "DOWN"}, {"time": 85.728, "type": "DOWN"}, {"time": 86.156, "type": "RIGHT"}, {"time": 86.585, "type": "UP"}, {"time": 87.013, "type": "DOWN"}, {"time": 87.442, "type": "UP"}, {"time": 87.657, "type": "UP_RIGHT"}, {"time": 87.87, "type": "DOWN"}, {"time": 88.085, "type": "DOWN_RIGHT"}, {"time": 88.299, "type": "UP"}, {"time": 88.513, "type": "DOWN"}, {"time": 88.728, "type": "LEFT"}, {"time": 88.943, "type": "DOWN"}, {"time": 89.156, "type": "UP"}, {"time": 89.585, "type": "DOWN"}, {"time": 90.013, "type": "REVERSE"}, {"time": 90.443, "type": "RIGHT"}, {"time": 90.657, "type": "DOWN"}, {"time": 90.871, "type": "RIGHT"}, {"time": 91.3, "type": "DOWN"}, {"time": 91.728, "type": "UP"}, {"time": 91.943, "type": "DOWN"}, {"time": 92.157, "type": "UP"}, {"time": 92.585, "type": "UP"}, {"time": 93.014, "type": "UP"}, {"time": 93.228, "type": "RIGHT"}, {"time": 93.443, "type": "LEFT"}, {"time": 93.657, "type": "UP"}, {"time": 93.871, "type": "DOWN"}, {"time": 94.085, "type": "REVERSE_BACK"}, {"time": 96.014, "type": "DOWN"}, {"time": 96.443, "type": "UP"}, {"time": 96.871, "type": "UP_RIGHT"}, {"time": 97.3, "type": "RIGHT"}, {"time": 97.728, "type": "DOWN_RIGHT"}, {"time": 98.157, "type": "UP"}, {"time": 98.585, "type": "DOWN"}, {"time": 99.014, "type": "LEFT"}, {"time": 99.443, "type": "UP_LEFT"}, {"time": 99.871, "type": "LEFT"}, {"time": 100.3, "type": "DOWN_LEFT"}, {"time": 100.728, "type": "DOWN"}, {"time": 101.157, "type": "UP"}, {"time": 101.585, "type": "DOWN"}, {"time": 102.014, "type": "UP"}, {"time": 102.443, "type": "DOWN"}, {"time": 102.871, "type": "LEFT"}, {"time": 103.3, "type": "UP"}, {"time": 103.728, "type": "RIGHT"}, {"time": 104.157, "type": "UP"}, {"time": 104.585, "type": "LEFT"}, {"time": 105.014, "type": "UP_RIGHT"}, {"time": 105.443, "type": "RIGHT"}, {"time": 105.871, "type": "DOWN_RIGHT"}, {"time": 106.3, "type": "RIGHT"}, {"time": 107.157, "type": "RIGHT"}, {"time": 108.014, "type": "LEFT"}, {"time": 108.871, "type": "LEFT"}, {"time": 109.728, "type": "DOWN"}, {"time": 110.157, "type": "UP"}, {"time": 110.585, "type": "UP_RIGHT"}, {"time": 111.014, "type": "RIGHT"}, {"time": 111.442, "type": "DOWN_RIGHT"}, {"time": 111.871, "type": "UP"}, {"time": 112.299, "type": "DOWN"}, {"time": 112.728, "type": "LEFT"}, {"time": 113.157, "type": "UP_LEFT"}, {"time": 113.585, "type": "LEFT"}, {"time": 114.014, "type": "DOWN_LEFT"}, {"time": 114.442, "type": "DOWN"}, {"time": 114.871, "type": "UP"}, {"time": 115.299, "type": "DOWN"}, {"time": 115.728, "type": "UP"}, {"time": 116.157, "type": "DOWN"}, {"time": 116.585, "type": "LEFT"}, {"time": 117.014, "type": "UP"}, {"time": 117.442, "type": "RIGHT"}, {"time": 117.871, "type": "UP"}, {"time": 118.299, "type": "LEFT"}, {"time": 118.728, "type": "UP_RIGHT"}, {"time": 119.157, "type": "RIGHT"}, {"time": 119.585, "type": "DOWN_RIGHT"}, {"time": 120.014, "type": "RIGHT"}, {"time": 120.871, "type": "RIGHT"}, {"time": 121.728, "type": "LEFT"}, {"time": 122.585, "type": "LEFT"}, {"time": 123.443, "type": "UP"}, {"time": 124.3, "type": "DOWN"}, {"time": 125.157, "type": "UP"}, {"time": 126.014, "type": "LEFT"}, {"time": 126.871, "type": "RIGHT"}, {"time": 127.728, "type": "LEFT"}, {"time": 128.585, "type": "UP"}, {"time": 129.443, "type": "DOWN"}, {"time": 130.3, "type": "UP"}, {"time": 131.157, "type": "LEFT"}, {"time": 132.014, "type": "RIGHT"}, {"time": 132.871, "type": "LEFT"}, {"time": 133.728, "type": "UP"}, {"time": 135.443, "type": "UP"}, {"time": 136.3, "type": "DOWN"}, {"time": 136.728, "type": "DOWN"}, {"time": 137.157, "type": "DOWN"}, {"time": 138.014, "type": "UP"}, {"time": 138.871, "type": "RIGHT"}, {"time": 139.728, "type": "DOWN"}, {"time": 140.585, "type": "UP"}, {"time": 141.442, "type": "RIGHT"}, {"time": 142.299, "type": "DOWN"}], "events": [{"time": 0.014, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 7.157, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 8.657, "type": "NOTE_SPEED", "speed": 1}, {"time": 12.085, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 13.3, "type": "FLASH"}, {"time": 13.3, "type": "BG_COLOR", "color": "#1a5fb4"}, {"time": 13.514, "type": "FLASH"}, {"time": 13.514, "type": "BG_COLOR", "color": "#000b5e"}, {"time": 13.728, "type": "FLASH"}, {"time": 13.728, "type": "BG_COLOR", "color": "#00102e"}, {"time": 15.871, "type": "FLASH"}, {"time": 17.157, "type": "FLASH"}, {"time": 19.3, "type": "FLASH"}, {"time": 20.157, "type": "FLASH"}, {"time": 20.585, "type": "NOTES_FLOW_RIGHT"}, {"time": 20.585, "type": "FX_INVERT", "duration": 6.858}, {"time": 20.585, "type": "FLASH"}, {"time": 22.728, "type": "FLASH"}, {"time": 24.014, "type": "FLASH"}, {"time": 26.157, "type": "FLASH"}, {"time": 27.014, "type": "FLASH"}, {"time": 27.443, "type": "NOTES_FLOW_LEFT"}, {"time": 27.443, "type": "FLASH"}, {"time": 29.8, "type": "FLASH"}, {"time": 30.871, "type": "FLASH"}, {"time": 33.014, "type": "FLASH"}, {"time": 33.871, "type": "FLASH"}, {"time": 34.3, "type": "NOTES_FLOW_RIGHT"}, {"time": 34.3, "type": "FLASH"}, {"time": 34.3, "type": "FX_INVERT", "duration": 17.143}, {"time": 36.443, "type": "FLASH"}, {"time": 37.728, "type": "FLASH"}, {"time": 39.871, "type": "FLASH"}, {"time": 40.728, "type": "FLASH"}, {"time": 41.014, "type": "NOTE_SPEED", "speed": 1}, {"time": 41.157, "type": "FLASH"}, {"time": 43.3, "type": "FLASH"}, {"time": 44.585, "type": "FLASH"}, {"time": 46.728, "type": "FLASH"}, {"time": 47.585, "type": "FLASH"}, {"time": 48.014, "type": "FLASH"}, {"time": 50.157, "type": "FLASH"}, {"time": 51.434, "type": "NOTES_FLOW_LEFT"}, {"time": 51.443, "type": "HUD_HIDE"}, {"time": 53.228, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 54.443, "type": "FLASH"}, {"time": 54.443, "type": "BG_COLOR", "color": "#1c71d8"}, {"time": 54.657, "type": "FLASH"}, {"time": 54.657, "type": "BG_COLOR", "color": "#62a0ea"}, {"time": 54.871, "type": "HUD_SHOW"}, {"time": 54.871, "type": "FLASH"}, {"time": 54.871, "type": "BG_COLOR", "color": "#000610"}, {"time": 54.871, "type": "FX_OLD_TV", "duration": 39.214}, {"time": 55.728, "type": "FLASH"}, {"time": 56.157, "type": "FLASH"}, {"time": 57.014, "type": "FLASH"}, {"time": 58.3, "type": "FLASH"}, {"time": 59.157, "type": "FLASH"}, {"time": 59.585, "type": "FLASH"}, {"time": 60.443, "type": "FLASH"}, {"time": 61.728, "type": "FLASH"}, {"time": 61.942, "type": "NOTES_FLOW_RIGHT"}, {"time": 62.585, "type": "FLASH"}, {"time": 63.014, "type": "FLASH"}, {"time": 63.871, "type": "FLASH"}, {"time": 65.157, "type": "FLASH"}, {"time": 65.8, "type": "FLASH"}, {"time": 66.443, "type": "FLASH"}, {"time": 67.3, "type": "FLASH"}, {"time": 68.585, "type": "NOTES_FLOW_LEFT"}, {"time": 68.585, "type": "FLASH"}, {"time": 69.443, "type": "FLASH"}, {"time": 70.085, "type": "FLASH"}, {"time": 70.871, "type": "FLASH"}, {"time": 72.014, "type": "FLASH"}, {"time": 72.657, "type": "FLASH"}, {"time": 73.3, "type": "FLASH"}, {"time": 74.157, "type": "FLASH"}, {"time": 75.442, "type": "NOTES_FLOW_RIGHT"}, {"time": 75.443, "type": "FLASH"}, {"time": 76.085, "type": "FLASH"}, {"time": 76.728, "type": "FLASH"}, {"time": 77.585, "type": "FLASH"}, {"time": 78.871, "type": "FLASH"}, {"time": 79.514, "type": "FLASH"}, {"time": 80.157, "type": "FLASH"}, {"time": 81.014, "type": "FLASH"}, {"time": 82.3, "type": "NOTES_FLOW_LEFT"}, {"time": 90.013, "type": "NOTES_FLOW_RIGHT"}, {"time": 94.085, "type": "NOTES_FLOW_LEFT"}, {"time": 94.085, "type": "BLACKOUT", "duration": 1.5}, {"time": 94.3, "type": "NOTE_SPEED", "speed": 1}, {"time": 123.371, "type": "BG_COLOR", "duration": 24, "color": "#62a0ea"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "Ew.mp3": {"folder": "Ew.mp3", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/Ew.mp3/track.ogg", "coverRef": "cov_f85a5f3e4b", "bgRef": null, "meta": {"title": "Ew.mp3", "artist": "Arvicheskyy", "difficulty": 4, "menu_color": "#ff9800"}, "chart": {"bpm": 137, "noteTravelTime": 2000, "gridOffset": 0.228, "timing": [{"time": 0.228, "bpm": 137}], "title": "l", "notes": [{"time": 0.228, "type": "UP"}, {"time": 0.666, "type": "DOWN"}, {"time": 1.104, "type": "UP"}, {"time": 1.542, "type": "DOWN"}, {"time": 1.98, "type": "UP"}, {"time": 2.418, "type": "DOWN"}, {"time": 2.856, "type": "UP"}, {"time": 3.294, "type": "DOWN"}, {"time": 3.842, "type": "LEFT"}, {"time": 4.28, "type": "RIGHT"}, {"time": 4.718, "type": "LEFT"}, {"time": 5.156, "type": "RIGHT"}, {"time": 5.593, "type": "LEFT"}, {"time": 6.14, "type": "UP"}, {"time": 6.578, "type": "DOWN"}, {"time": 7.016, "type": "UP"}, {"time": 7.454, "type": "DOWN"}, {"time": 7.892, "type": "RIGHT"}, {"time": 8.33, "type": "UP"}, {"time": 8.768, "type": "DOWN"}, {"time": 9.206, "type": "UP"}, {"time": 9.644, "type": "LEFT"}, {"time": 10.082, "type": "UP"}, {"time": 10.52, "type": "DOWN"}, {"time": 11.068, "type": "LEFT"}, {"time": 11.506, "type": "RIGHT"}, {"time": 11.944, "type": "LEFT"}, {"time": 12.382, "type": "RIGHT"}, {"time": 12.819, "type": "LEFT"}, {"time": 13.366, "type": "UP"}, {"time": 13.804, "type": "DOWN"}, {"time": 14.242, "type": "UP"}, {"time": 15.994, "type": "UP"}, {"time": 17.746, "type": "DOWN"}, {"time": 19.608, "type": "UP"}, {"time": 21.359, "type": "DOWN"}, {"time": 23.111, "type": "RIGHT"}, {"time": 24.863, "type": "LEFT"}, {"time": 26.615, "type": "RIGHT"}, {"time": 28.476, "type": "UP"}, {"time": 30.228, "type": "DOWN"}, {"time": 31.98, "type": "UP"}, {"time": 33.732, "type": "DOWN"}, {"time": 35.483, "type": "UP"}, {"time": 36.469, "type": "DOWN"}, {"time": 37.345, "type": "UP"}, {"time": 38.221, "type": "DOWN"}, {"time": 39.097, "type": "UP"}, {"time": 39.535, "type": "DOWN"}, {"time": 39.973, "type": "UP"}, {"time": 40.41, "type": "DOWN"}, {"time": 40.848, "type": "UP"}, {"time": 41.286, "type": "DOWN"}, {"time": 41.724, "type": "UP"}, {"time": 42.162, "type": "DOWN"}, {"time": 42.6, "type": "UP"}, {"time": 44.462, "type": "UP"}, {"time": 44.9, "type": "RIGHT"}, {"time": 45.337, "type": "RIGHT"}, {"time": 45.775, "type": "UP"}, {"time": 46.213, "type": "DOWN"}, {"time": 46.651, "type": "DOWN"}, {"time": 47.089, "type": "UP"}, {"time": 47.308, "type": "RIGHT"}, {"time": 47.527, "type": "UP"}, {"time": 47.746, "type": "DOWN"}, {"time": 47.965, "type": "RIGHT"}, {"time": 48.403, "type": "UP"}, {"time": 48.841, "type": "DOWN"}, {"time": 49.279, "type": "RIGHT"}, {"time": 49.827, "type": "DOWN"}, {"time": 50.265, "type": "UP"}, {"time": 50.703, "type": "DOWN"}, {"time": 51.141, "type": "UP"}, {"time": 51.579, "type": "RIGHT"}, {"time": 52.017, "type": "RIGHT"}, {"time": 52.455, "type": "LEFT"}, {"time": 52.893, "type": "UP"}, {"time": 53.33, "type": "UP"}, {"time": 53.549, "type": "RIGHT"}, {"time": 53.768, "type": "UP"}, {"time": 53.987, "type": "DOWN"}, {"time": 54.206, "type": "RIGHT"}, {"time": 54.425, "type": "LEFT"}, {"time": 54.644, "type": "RIGHT"}, {"time": 54.863, "type": "UP"}, {"time": 55.192, "type": "RIGHT"}, {"time": 55.63, "type": "UP"}, {"time": 56.068, "type": "LEFT"}, {"time": 56.506, "type": "DOWN"}, {"time": 56.944, "type": "UP"}, {"time": 57.382, "type": "UP"}, {"time": 57.82, "type": "DOWN"}, {"time": 58.258, "type": "RIGHT"}, {"time": 58.586, "type": "LEFT"}, {"time": 59.571, "type": "LEFT"}, {"time": 60.447, "type": "RIGHT"}, {"time": 61.323, "type": "UP"}, {"time": 61.542, "type": "RIGHT"}, {"time": 61.761, "type": "UP"}, {"time": 61.98, "type": "DOWN"}, {"time": 62.199, "type": "RIGHT"}, {"time": 63.075, "type": "LEFT"}, {"time": 63.951, "type": "RIGHT"}, {"time": 64.827, "type": "UP"}, {"time": 65.046, "type": "RIGHT"}, {"time": 65.265, "type": "UP"}, {"time": 65.484, "type": "DOWN"}, {"time": 65.703, "type": "RIGHT"}, {"time": 66.688, "type": "UP_RIGHT"}, {"time": 67.564, "type": "DOWN_RIGHT"}, {"time": 68.44, "type": "UP"}, {"time": 68.659, "type": "RIGHT"}, {"time": 68.878, "type": "UP"}, {"time": 69.097, "type": "DOWN"}, {"time": 69.316, "type": "RIGHT"}, {"time": 70.301, "type": "DOWN_RIGHT"}, {"time": 71.177, "type": "UP_RIGHT"}, {"time": 72.053, "type": "DOWN"}, {"time": 72.491, "type": "UP"}, {"time": 72.929, "type": "DOWN"}, {"time": 74.243, "type": "UP"}, {"time": 74.681, "type": "UP"}, {"time": 75.994, "type": "UP"}, {"time": 76.432, "type": "DOWN"}, {"time": 77.746, "type": "UP"}, {"time": 78.184, "type": "UP"}, {"time": 79.06, "type": "LEFT"}, {"time": 79.498, "type": "RIGHT"}, {"time": 79.936, "type": "DOWN"}, {"time": 81.25, "type": "UP"}, {"time": 81.688, "type": "UP"}, {"time": 82.783, "type": "DOWN"}, {"time": 83.221, "type": "UP"}, {"time": 84.316, "type": "UP"}, {"time": 84.754, "type": "UP"}, {"time": 85.41, "type": "LEFT"}, {"time": 85.739, "type": "RIGHT"}, {"time": 86.067, "type": "UP"}, {"time": 86.396, "type": "DOWN"}, {"time": 86.724, "type": "RIGHT"}, {"time": 87.053, "type": "RIGHT"}, {"time": 87.381, "type": "LEFT"}, {"time": 87.71, "type": "RIGHT"}, {"time": 88.038, "type": "UP"}, {"time": 88.257, "type": "DOWN"}, {"time": 88.476, "type": "UP"}, {"time": 88.805, "type": "RIGHT"}, {"time": 89.133, "type": "DOWN"}, {"time": 89.462, "type": "UP"}, {"time": 89.79, "type": "LEFT"}, {"time": 90.119, "type": "DOWN"}, {"time": 90.447, "type": "UP"}, {"time": 90.775, "type": "UP"}, {"time": 90.994, "type": "DOWN"}, {"time": 91.213, "type": "UP"}, {"time": 91.432, "type": "DOWN"}, {"time": 91.761, "type": "RIGHT"}, {"time": 92.089, "type": "RIGHT"}, {"time": 92.418, "type": "LEFT"}, {"time": 92.747, "type": "RIGHT"}, {"time": 93.075, "type": "LEFT"}, {"time": 93.294, "type": "UP"}, {"time": 93.513, "type": "DOWN"}, {"time": 93.732, "type": "UP"}, {"time": 93.951, "type": "RIGHT"}, {"time": 94.17, "type": "RIGHT"}, {"time": 94.389, "type": "UP"}, {"time": 94.717, "type": "LEFT"}, {"time": 95.046, "type": "DOWN"}, {"time": 95.374, "type": "UP"}, {"time": 95.702, "type": "UP"}, {"time": 96.031, "type": "DOWN"}, {"time": 96.359, "type": "REVERSE"}, {"time": 96.688, "type": "DOWN"}, {"time": 97.016, "type": "RIGHT"}, {"time": 97.345, "type": "LEFT"}, {"time": 97.673, "type": "RIGHT"}, {"time": 98.002, "type": "LEFT"}, {"time": 98.33, "type": "UP"}, {"time": 98.659, "type": "DOWN"}, {"time": 98.878, "type": "UP"}, {"time": 99.097, "type": "DOWN"}, {"time": 99.425, "type": "LEFT"}, {"time": 99.754, "type": "RIGHT"}, {"time": 100.082, "type": "UP"}, {"time": 100.41, "type": "RIGHT"}, {"time": 100.739, "type": "LEFT"}, {"time": 101.067, "type": "UP"}, {"time": 101.396, "type": "DOWN"}, {"time": 101.724, "type": "UP"}, {"time": 102.053, "type": "DOWN"}, {"time": 102.381, "type": "RIGHT"}, {"time": 102.71, "type": "LEFT"}, {"time": 103.038, "type": "UP"}, {"time": 103.367, "type": "DOWN"}, {"time": 103.695, "type": "UP"}, {"time": 104.024, "type": "DOWN"}, {"time": 104.243, "type": "RIGHT"}, {"time": 104.462, "type": "LEFT"}, {"time": 104.79, "type": "RIGHT"}, {"time": 105.119, "type": "LEFT"}, {"time": 105.447, "type": "UP"}, {"time": 105.775, "type": "DOWN"}, {"time": 106.104, "type": "UP"}, {"time": 106.432, "type": "UP"}, {"time": 106.761, "type": "UP"}, {"time": 107.089, "type": "DOWN"}, {"time": 107.418, "type": "UP"}], "events": [{"time": 0, "type": "NOTES_SPIN_ON"}, {"time": 0.009, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 0.775, "type": "BG_COLOR", "duration": 2.957, "color": "#1a5fb4"}, {"time": 2.856, "type": "FLASH", "duration": 0.657}, {"time": 3.732, "type": "BG_COLOR", "duration": 3.284, "color": "#99c1f1"}, {"time": 5.921, "type": "FLASH", "duration": 0.214}, {"time": 6.359, "type": "FLASH", "duration": 0.219}, {"time": 6.797, "type": "FLASH", "duration": 0.219}, {"time": 7.016, "type": "BG_COLOR", "duration": 3.504, "color": "#1a5fb4"}, {"time": 7.126, "type": "NOTE_SPEED", "speed": 1.75}, {"time": 7.454, "type": "SHAKE"}, {"time": 8.549, "type": "SHAKE"}, {"time": 9.425, "type": "SHAKE"}, {"time": 10.301, "type": "SHAKE"}, {"time": 10.301, "type": "FLASH", "duration": 0.219}, {"time": 10.52, "type": "BG_COLOR", "duration": 3.723, "color": "#99c1f1"}, {"time": 11.177, "type": "SHAKE"}, {"time": 12.053, "type": "SHAKE"}, {"time": 12.929, "type": "SHAKE"}, {"time": 13.148, "type": "FLASH", "duration": 0.219}, {"time": 13.367, "type": "SHAKE"}, {"time": 13.586, "type": "FLASH", "duration": 0.219}, {"time": 13.805, "type": "SHAKE"}, {"time": 13.914, "type": "NOTES_WAVE_ON"}, {"time": 14.024, "type": "FLASH", "duration": 0.219}, {"time": 14.243, "type": "SHAKE"}, {"time": 14.352, "type": "NOTE_SPEED", "speed": 1}, {"time": 14.352, "type": "BG_COLOR", "duration": 6.905, "color": "#1a5fb4"}, {"time": 21.359, "type": "BG_COLOR", "duration": 7.117, "color": "#99c1f1"}, {"time": 28.476, "type": "FLASH"}, {"time": 28.476, "type": "BG_COLOR", "duration": 14.234, "color": "#1a5fb4"}, {"time": 30.228, "type": "FLASH"}, {"time": 30.447, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 31.98, "type": "FLASH"}, {"time": 33.732, "type": "FLASH"}, {"time": 33.841, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 35.483, "type": "FLASH"}, {"time": 36.469, "type": "FLASH"}, {"time": 37.345, "type": "FLASH"}, {"time": 38.221, "type": "FLASH"}, {"time": 38.987, "type": "FLASH"}, {"time": 39.425, "type": "FLASH"}, {"time": 39.863, "type": "FLASH"}, {"time": 40.301, "type": "FLASH"}, {"time": 40.739, "type": "FLASH"}, {"time": 41.177, "type": "FLASH"}, {"time": 41.615, "type": "FLASH"}, {"time": 42.053, "type": "FLASH"}, {"time": 42.6, "type": "NOTE_SPEED", "speed": 2}, {"time": 42.71, "type": "BLACKOUT", "duration": 1.314}, {"time": 43.476, "type": "NOTES_WAVE_OFF"}, {"time": 43.695, "type": "NOTES_SPIN_OFF"}, {"time": 43.914, "type": "NOTE_PUSH_ON"}, {"time": 43.914, "type": "FLASH", "duration": 0.219}, {"time": 44.024, "type": "DISCO", "duration": 28.916}, {"time": 44.024, "type": "FX_PIXELATE", "duration": 28.905}, {"time": 47.089, "type": "FLASH", "duration": 0.876}, {"time": 50.483, "type": "FLASH", "duration": 0.217}, {"time": 50.921, "type": "FLASH", "duration": 0.219}, {"time": 51.469, "type": "FLASH", "duration": 0.109}, {"time": 53.221, "type": "FLASH", "duration": 1.642}, {"time": 57.6, "type": "FLASH", "duration": 0.219}, {"time": 58.038, "type": "FLASH", "duration": 0.219}, {"time": 58.476, "type": "FLASH", "duration": 0.11}, {"time": 58.586, "type": "NOTES_SPIN_ON"}, {"time": 72.929, "type": "CAMERA_BOB_ON"}, {"time": 72.929, "type": "FLASH"}, {"time": 72.929, "type": "NOTES_SPIN_OFF"}, {"time": 72.929, "type": "NOTES_WAVE_ON"}, {"time": 72.929, "type": "NOTE_PUSH_OFF"}, {"time": 73.257, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 80.046, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 83.221, "type": "FLASH", "duration": 2.846}, {"time": 85.958, "type": "NOTE_SPEED", "speed": 2.25}, {"time": 86.067, "type": "NOTES_WAVE_OFF"}, {"time": 86.067, "type": "CAMERA_BOB_OFF"}, {"time": 86.067, "type": "NOTE_PUSH_ON"}, {"time": 86.067, "type": "FX_PIXELATE", "duration": 21.351}, {"time": 86.067, "type": "DISCO", "duration": 21.351}, {"time": 86.286, "type": "SHAKE"}, {"time": 86.505, "type": "SHAKE"}, {"time": 86.943, "type": "SHAKE"}, {"time": 87.162, "type": "SHAKE"}, {"time": 87.491, "type": "SHAKE"}, {"time": 87.819, "type": "SHAKE"}, {"time": 88.257, "type": "SHAKE"}, {"time": 88.476, "type": "SHAKE"}, {"time": 88.805, "type": "SHAKE"}, {"time": 89.133, "type": "SHAKE"}, {"time": 89.571, "type": "SHAKE"}, {"time": 89.79, "type": "SHAKE"}, {"time": 90.119, "type": "SHAKE"}, {"time": 90.447, "type": "SHAKE"}, {"time": 90.883, "type": "SHAKE"}, {"time": 91.102, "type": "SHAKE"}, {"time": 91.431, "type": "SHAKE"}, {"time": 91.759, "type": "SHAKE"}, {"time": 92.199, "type": "SHAKE"}, {"time": 92.418, "type": "SHAKE"}, {"time": 92.747, "type": "SHAKE"}, {"time": 93.075, "type": "SHAKE"}, {"time": 93.511, "type": "SHAKE"}, {"time": 93.73, "type": "SHAKE"}, {"time": 94.059, "type": "SHAKE"}, {"time": 94.387, "type": "SHAKE"}, {"time": 94.827, "type": "SHAKE"}, {"time": 95.046, "type": "SHAKE"}, {"time": 95.375, "type": "SHAKE"}, {"time": 95.703, "type": "SHAKE"}, {"time": 96.139, "type": "SHAKE"}, {"time": 96.358, "type": "SHAKE"}, {"time": 96.359, "type": "NOTES_FLOW_RIGHT"}, {"time": 96.359, "type": "FLASH", "duration": 11.059}, {"time": 96.687, "type": "SHAKE"}, {"time": 97.015, "type": "SHAKE"}, {"time": 97.454, "type": "SHAKE"}, {"time": 97.673, "type": "SHAKE"}, {"time": 98.002, "type": "SHAKE"}, {"time": 98.33, "type": "SHAKE"}, {"time": 98.766, "type": "SHAKE"}, {"time": 98.985, "type": "SHAKE"}, {"time": 99.314, "type": "SHAKE"}, {"time": 99.642, "type": "SHAKE"}, {"time": 100.082, "type": "SHAKE"}, {"time": 100.301, "type": "SHAKE"}, {"time": 100.63, "type": "SHAKE"}, {"time": 100.958, "type": "SHAKE"}, {"time": 101.394, "type": "SHAKE"}, {"time": 101.613, "type": "SHAKE"}, {"time": 101.942, "type": "SHAKE"}, {"time": 102.27, "type": "SHAKE"}, {"time": 102.71, "type": "SHAKE"}, {"time": 102.929, "type": "SHAKE"}, {"time": 103.258, "type": "SHAKE"}, {"time": 103.586, "type": "SHAKE"}, {"time": 104.022, "type": "SHAKE"}, {"time": 104.241, "type": "SHAKE"}, {"time": 104.57, "type": "SHAKE"}, {"time": 104.898, "type": "SHAKE"}, {"time": 105.337, "type": "SHAKE"}, {"time": 105.556, "type": "SHAKE"}, {"time": 105.885, "type": "SHAKE"}, {"time": 106.213, "type": "SHAKE"}, {"time": 106.649, "type": "SHAKE"}, {"time": 106.868, "type": "SHAKE"}, {"time": 107.197, "type": "SHAKE"}, {"time": 107.418, "type": "SHAKE"}, {"time": 108.841, "type": "BLACKOUT", "duration": 2.628}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "Hi-Tech": {"folder": "Hi-Tech", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/Hi-Tech/track.ogg", "coverRef": "cov_f85a5f3e4b", "bgRef": null, "meta": {"title": "Hi-Tech", "artist": "Arvicheskyy", "difficulty": 3.5, "menu_color": "#f6d32d"}, "chart": {"bpm": 155, "noteTravelTime": 1000, "gridOffset": 0.054, "timing": [{"time": 0.054, "bpm": 155}], "title": "Hi-Tech", "artist": "Arvicheskyy", "notes": [{"time": 0.054, "type": "UP"}, {"time": 1.022, "type": "DOWN"}, {"time": 1.602, "type": "UP"}, {"time": 2.57, "type": "DOWN"}, {"time": 3.151, "type": "UP"}, {"time": 4.119, "type": "DOWN"}, {"time": 4.699, "type": "UP"}, {"time": 5.473, "type": "DOWN"}, {"time": 5.86, "type": "UP"}, {"time": 6.248, "type": "LEFT"}, {"time": 6.635, "type": "RIGHT"}, {"time": 7.022, "type": "LEFT"}, {"time": 7.409, "type": "RIGHT"}, {"time": 7.796, "type": "LEFT"}, {"time": 8.183, "type": "RIGHT"}, {"time": 8.57, "type": "LEFT"}, {"time": 8.957, "type": "RIGHT"}, {"time": 9.344, "type": "LEFT"}, {"time": 9.731, "type": "RIGHT"}, {"time": 10.119, "type": "LEFT"}, {"time": 10.506, "type": "RIGHT"}, {"time": 10.893, "type": "LEFT"}, {"time": 11.28, "type": "RIGHT"}, {"time": 11.667, "type": "LEFT"}, {"time": 12.054, "type": "RIGHT"}, {"time": 12.441, "type": "LEFT"}, {"time": 13.989, "type": "UP"}, {"time": 14.377, "type": "RIGHT"}, {"time": 14.764, "type": "RIGHT"}, {"time": 15.151, "type": "UP"}, {"time": 15.538, "type": "LEFT"}, {"time": 15.925, "type": "UP"}, {"time": 16.312, "type": "DOWN"}, {"time": 16.699, "type": "UP"}, {"time": 17.086, "type": "RIGHT"}, {"time": 17.473, "type": "RIGHT"}, {"time": 17.86, "type": "LEFT"}, {"time": 18.248, "type": "DOWN"}, {"time": 18.635, "type": "RIGHT"}, {"time": 19.022, "type": "RIGHT"}, {"time": 19.409, "type": "UP"}, {"time": 19.796, "type": "DOWN"}, {"time": 20.183, "type": "RIGHT"}, {"time": 20.57, "type": "RIGHT"}, {"time": 20.957, "type": "LEFT"}, {"time": 21.344, "type": "UP"}, {"time": 21.731, "type": "REVERSE"}, {"time": 22.119, "type": "RIGHT"}, {"time": 22.506, "type": "DOWN"}, {"time": 22.893, "type": "RIGHT"}, {"time": 23.28, "type": "RIGHT"}, {"time": 23.667, "type": "UP"}, {"time": 24.054, "type": "DOWN"}, {"time": 24.441, "type": "UP"}, {"time": 24.828, "type": "LEFT"}, {"time": 25.215, "type": "RIGHT"}, {"time": 25.602, "type": "RIGHT"}, {"time": 25.989, "type": "UP"}, {"time": 26.377, "type": "DOWN"}, {"time": 26.764, "type": "DOWN"}, {"time": 27.151, "type": "RIGHT"}, {"time": 27.538, "type": "UP"}, {"time": 27.925, "type": "DOWN"}, {"time": 28.312, "type": "REVERSE_BACK"}, {"time": 28.699, "type": "RIGHT"}, {"time": 29.086, "type": "LEFT"}, {"time": 29.473, "type": "UP"}, {"time": 29.86, "type": "RIGHT"}, {"time": 30.248, "type": "RIGHT"}, {"time": 30.635, "type": "DOWN"}, {"time": 31.022, "type": "UP"}, {"time": 31.409, "type": "LEFT"}, {"time": 31.796, "type": "LEFT"}, {"time": 32.183, "type": "UP"}, {"time": 32.57, "type": "RIGHT"}, {"time": 32.957, "type": "UP"}, {"time": 33.344, "type": "DOWN"}, {"time": 33.731, "type": "RIGHT"}, {"time": 34.119, "type": "REVERSE"}, {"time": 34.506, "type": "REVERSE_BACK"}, {"time": 34.893, "type": "REVERSE"}, {"time": 35.28, "type": "REVERSE_BACK"}, {"time": 35.667, "type": "RIGHT"}, {"time": 36.054, "type": "RIGHT"}, {"time": 36.441, "type": "UP"}, {"time": 36.828, "type": "DOWN"}, {"time": 37.215, "type": "LEFT"}, {"time": 37.602, "type": "LEFT"}, {"time": 37.989, "type": "UP"}, {"time": 38.377, "type": "RIGHT"}, {"time": 38.764, "type": "RIGHT"}, {"time": 39.151, "type": "LEFT"}, {"time": 39.538, "type": "UP"}, {"time": 39.925, "type": "DOWN"}, {"time": 40.312, "type": "RIGHT"}, {"time": 40.699, "type": "LEFT"}, {"time": 41.086, "type": "UP"}, {"time": 41.473, "type": "DOWN"}, {"time": 41.86, "type": "REVERSE"}, {"time": 42.248, "type": "LEFT"}, {"time": 42.635, "type": "UP"}, {"time": 43.022, "type": "DOWN"}, {"time": 43.409, "type": "RIGHT"}, {"time": 43.796, "type": "LEFT"}, {"time": 44.183, "type": "UP"}, {"time": 44.57, "type": "DOWN"}, {"time": 44.957, "type": "REVERSE_BACK"}, {"time": 45.344, "type": "RIGHT"}, {"time": 45.731, "type": "DOWN"}, {"time": 46.119, "type": "UP"}, {"time": 46.506, "type": "LEFT"}, {"time": 46.893, "type": "RIGHT"}, {"time": 47.28, "type": "DOWN"}, {"time": 47.667, "type": "UP"}, {"time": 48.054, "type": "REVERSE"}, {"time": 48.441, "type": "LEFT"}, {"time": 48.828, "type": "DOWN"}, {"time": 49.216, "type": "UP"}, {"time": 49.603, "type": "LEFT"}, {"time": 49.99, "type": "RIGHT"}, {"time": 50.377, "type": "DOWN"}, {"time": 50.764, "type": "UP"}, {"time": 51.151, "type": "REVERSE_BACK"}, {"time": 51.925, "type": "UP"}, {"time": 52.699, "type": "DOWN"}, {"time": 53.473, "type": "UP"}, {"time": 53.86, "type": "DOWN"}, {"time": 54.248, "type": "UP"}, {"time": 55.022, "type": "DOWN"}, {"time": 55.796, "type": "UP"}, {"time": 56.57, "type": "DOWN"}, {"time": 56.957, "type": "UP"}, {"time": 57.344, "type": "DOWN"}, {"time": 57.731, "type": "DOWN"}, {"time": 58.119, "type": "UP"}, {"time": 58.506, "type": "UP"}, {"time": 58.893, "type": "DOWN"}, {"time": 59.28, "type": "DOWN"}, {"time": 59.667, "type": "UP"}, {"time": 60.054, "type": "UP"}, {"time": 60.441, "type": "DOWN"}, {"time": 60.828, "type": "DOWN"}, {"time": 61.216, "type": "UP"}, {"time": 61.603, "type": "UP"}, {"time": 61.99, "type": "DOWN"}, {"time": 62.377, "type": "DOWN"}, {"time": 62.764, "type": "UP"}, {"time": 63.151, "type": "UP"}, {"time": 65.086, "type": "UP"}, {"time": 65.474, "type": "RIGHT"}, {"time": 65.861, "type": "RIGHT"}, {"time": 66.248, "type": "UP"}, {"time": 66.635, "type": "LEFT"}, {"time": 67.022, "type": "UP"}, {"time": 67.409, "type": "DOWN"}, {"time": 67.796, "type": "UP"}, {"time": 68.183, "type": "RIGHT"}, {"time": 68.57, "type": "RIGHT"}, {"time": 68.957, "type": "LEFT"}, {"time": 69.345, "type": "DOWN"}, {"time": 69.732, "type": "RIGHT"}, {"time": 70.119, "type": "RIGHT"}, {"time": 70.506, "type": "UP"}, {"time": 70.893, "type": "DOWN"}, {"time": 71.28, "type": "RIGHT"}, {"time": 71.667, "type": "RIGHT"}, {"time": 72.054, "type": "LEFT"}, {"time": 72.441, "type": "UP"}, {"time": 72.828, "type": "REVERSE"}, {"time": 73.216, "type": "RIGHT"}, {"time": 73.603, "type": "DOWN"}, {"time": 73.99, "type": "RIGHT"}, {"time": 74.377, "type": "RIGHT"}, {"time": 74.764, "type": "UP"}, {"time": 75.151, "type": "DOWN"}, {"time": 75.538, "type": "UP"}, {"time": 75.925, "type": "LEFT"}, {"time": 76.312, "type": "RIGHT"}, {"time": 76.699, "type": "RIGHT"}, {"time": 77.086, "type": "UP"}, {"time": 77.474, "type": "DOWN"}, {"time": 77.861, "type": "DOWN"}, {"time": 78.248, "type": "RIGHT"}, {"time": 78.635, "type": "UP"}, {"time": 79.022, "type": "DOWN"}, {"time": 79.409, "type": "REVERSE_BACK"}, {"time": 79.796, "type": "RIGHT"}, {"time": 80.183, "type": "LEFT"}, {"time": 80.57, "type": "UP"}, {"time": 80.957, "type": "RIGHT"}, {"time": 81.345, "type": "RIGHT"}, {"time": 81.732, "type": "DOWN"}, {"time": 82.119, "type": "UP"}, {"time": 82.506, "type": "LEFT"}, {"time": 82.893, "type": "LEFT"}, {"time": 83.28, "type": "UP"}, {"time": 83.667, "type": "RIGHT"}, {"time": 84.054, "type": "UP"}, {"time": 84.441, "type": "DOWN"}, {"time": 84.828, "type": "RIGHT"}, {"time": 85.216, "type": "REVERSE"}, {"time": 85.603, "type": "REVERSE_BACK"}, {"time": 85.99, "type": "REVERSE"}, {"time": 86.377, "type": "REVERSE_BACK"}, {"time": 86.764, "type": "RIGHT"}, {"time": 87.151, "type": "RIGHT"}, {"time": 87.538, "type": "UP"}, {"time": 87.925, "type": "DOWN"}, {"time": 88.312, "type": "LEFT"}, {"time": 88.699, "type": "LEFT"}, {"time": 89.086, "type": "UP"}, {"time": 89.474, "type": "RIGHT"}, {"time": 89.861, "type": "RIGHT"}], "events": [{"time": 4.699, "type": "FLASH", "duration": 7.742}, {"time": 12.441, "type": "HUD_HIDE"}, {"time": 12.538, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 12.731, "type": "TEXT", "duration": 0.498, "color": "#ffffff", "text": "ARE"}, {"time": 13.215, "type": "TEXT", "duration": 0.4, "color": "#ffffff", "text": "YOU"}, {"time": 13.602, "type": "TEXT", "duration": 0.4, "color": "#ffffff", "text": "READY?"}, {"time": 13.941, "type": "NOTE_PUSH_ON"}, {"time": 13.941, "type": "DISCO", "duration": 24.822}, {"time": 13.989, "type": "HUD_SHOW"}, {"time": 21.731, "type": "NOTES_FLOW_RIGHT"}, {"time": 28.312, "type": "NOTES_FLOW_LEFT"}, {"time": 34.119, "type": "NOTES_FLOW_RIGHT"}, {"time": 34.506, "type": "NOTES_FLOW_LEFT"}, {"time": 34.893, "type": "NOTES_FLOW_RIGHT"}, {"time": 35.28, "type": "NOTES_FLOW_LEFT"}, {"time": 38.764, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 38.764, "type": "NOTE_PUSH_OFF"}, {"time": 38.764, "type": "FX_PIXELATE", "duration": 26.322}, {"time": 38.764, "type": "FLASH"}, {"time": 41.86, "type": "NOTES_FLOW_RIGHT"}, {"time": 44.957, "type": "NOTES_FLOW_LEFT"}, {"time": 48.054, "type": "NOTES_FLOW_RIGHT"}, {"time": 51.151, "type": "NOTES_FLOW_LEFT"}, {"time": 51.199, "type": "NOTE_SPEED", "speed": 1}, {"time": 57.393, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 57.393, "type": "FLASH", "duration": 5.855}, {"time": 63.199, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 63.683, "type": "TEXT", "duration": 0.498, "color": "#ffffff", "text": "ARE"}, {"time": 64.167, "type": "TEXT", "duration": 0.4, "color": "#ffffff", "text": "YOU"}, {"time": 64.554, "type": "TEXT", "duration": 0.435, "color": "#ffffff", "text": "READY?;)"}, {"time": 65.038, "type": "NOTE_PUSH_ON"}, {"time": 65.038, "type": "DISCO", "duration": 24.822}, {"time": 65.086, "type": "FLASH"}, {"time": 72.828, "type": "NOTES_FLOW_RIGHT"}, {"time": 76.796, "type": "FLASH", "duration": 13.064}, {"time": 77.473, "type": "SHAKE"}, {"time": 77.473, "type": "FX_PIXELATE", "duration": 12.387}, {"time": 77.473, "type": "FLASH"}, {"time": 77.86, "type": "SHAKE"}, {"time": 78.248, "type": "SHAKE"}, {"time": 78.635, "type": "SHAKE"}, {"time": 79.022, "type": "SHAKE"}, {"time": 79.409, "type": "NOTES_FLOW_LEFT"}, {"time": 79.409, "type": "SHAKE"}, {"time": 79.796, "type": "SHAKE"}, {"time": 79.989, "type": "SHAKE"}, {"time": 80.183, "type": "SHAKE"}, {"time": 80.377, "type": "SHAKE"}, {"time": 80.57, "type": "SHAKE"}, {"time": 80.957, "type": "SHAKE"}, {"time": 81.344, "type": "SHAKE"}, {"time": 81.731, "type": "SHAKE"}, {"time": 82.119, "type": "SHAKE"}, {"time": 82.506, "type": "SHAKE"}, {"time": 82.893, "type": "SHAKE"}, {"time": 83.28, "type": "SHAKE"}, {"time": 83.473, "type": "SHAKE"}, {"time": 83.667, "type": "SHAKE"}, {"time": 84.054, "type": "SHAKE"}, {"time": 84.441, "type": "SHAKE"}, {"time": 84.828, "type": "SHAKE"}, {"time": 85.215, "type": "SHAKE"}, {"time": 85.216, "type": "NOTES_FLOW_RIGHT"}, {"time": 85.602, "type": "SHAKE"}, {"time": 85.603, "type": "NOTES_FLOW_LEFT"}, {"time": 85.989, "type": "SHAKE"}, {"time": 85.99, "type": "NOTES_FLOW_RIGHT"}, {"time": 86.183, "type": "SHAKE"}, {"time": 86.377, "type": "NOTES_FLOW_LEFT"}, {"time": 86.377, "type": "SHAKE"}, {"time": 86.57, "type": "SHAKE"}, {"time": 86.764, "type": "SHAKE"}, {"time": 87.151, "type": "SHAKE"}, {"time": 87.538, "type": "SHAKE"}, {"time": 87.925, "type": "SHAKE"}, {"time": 88.312, "type": "SHAKE"}, {"time": 88.699, "type": "SHAKE"}, {"time": 89.086, "type": "SHAKE"}, {"time": 89.473, "type": "SHAKE"}, {"time": 89.86, "type": "SHAKE"}, {"time": 90.635, "type": "TEXT", "duration": 2.225, "color": "#c061cb", "text": "GG :3"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "N R": {"folder": "N R", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/N R/track.ogg", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "N R", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 5.0, "menu_color": "#00025e"}, "chart": {"bpm": 110, "noteTravelTime": 1000, "notes": [{"time": 0.005, "type": "UP"}, {"time": 0.278, "type": "DOWN"}, {"time": 0.55, "type": "UP"}, {"time": 0.823, "type": "RIGHT"}, {"time": 1.369, "type": "DOWN"}, {"time": 2.187, "type": "DOWN"}, {"time": 2.46, "type": "UP"}, {"time": 2.732, "type": "DOWN"}, {"time": 3.005, "type": "LEFT"}, {"time": 3.55, "type": "UP"}, {"time": 4.369, "type": "LEFT"}, {"time": 4.641, "type": "RIGHT"}, {"time": 4.914, "type": "LEFT"}, {"time": 5.187, "type": "UP"}, {"time": 5.732, "type": "DOWN"}, {"time": 6.55, "type": "RIGHT"}, {"time": 6.823, "type": "LEFT"}, {"time": 7.096, "type": "RIGHT"}, {"time": 8.732, "type": "UP"}, {"time": 9.005, "type": "UP"}, {"time": 9.278, "type": "UP"}, {"time": 9.55, "type": "RIGHT"}, {"time": 10.096, "type": "DOWN"}, {"time": 10.641, "type": "UP"}, {"time": 10.914, "type": "RIGHT"}, {"time": 11.187, "type": "LEFT"}, {"time": 11.46, "type": "RIGHT"}, {"time": 11.732, "type": "UP"}, {"time": 12.005, "type": "DOWN"}, {"time": 12.55, "type": "RIGHT"}, {"time": 13.096, "type": "UP"}, {"time": 13.369, "type": "RIGHT"}, {"time": 13.641, "type": "UP"}, {"time": 13.914, "type": "RIGHT"}, {"time": 14.46, "type": "DOWN"}, {"time": 15.005, "type": "UP"}, {"time": 15.278, "type": "RIGHT"}, {"time": 15.55, "type": "LEFT"}, {"time": 15.823, "type": "RIGHT"}, {"time": 16.096, "type": "DOWN"}, {"time": 16.369, "type": "DOWN"}, {"time": 16.914, "type": "UP"}, {"time": 17.46, "type": "REVERSE"}, {"time": 17.732, "type": "LEFT"}, {"time": 18.005, "type": "UP"}, {"time": 18.278, "type": "RIGHT"}, {"time": 18.823, "type": "DOWN"}, {"time": 19.369, "type": "UP"}, {"time": 19.641, "type": "DOWN"}, {"time": 19.914, "type": "UP"}, {"time": 20.187, "type": "DOWN"}, {"time": 20.46, "type": "RIGHT"}, {"time": 20.732, "type": "LEFT"}, {"time": 21.278, "type": "RIGHT"}, {"time": 21.823, "type": "UP_LEFT"}, {"time": 22.096, "type": "LEFT"}, {"time": 22.369, "type": "UP_RIGHT"}, {"time": 22.641, "type": "RIGHT"}, {"time": 23.187, "type": "DOWN"}, {"time": 23.732, "type": "UP"}, {"time": 24.005, "type": "DOWN_RIGHT"}, {"time": 24.278, "type": "RIGHT"}, {"time": 24.55, "type": "UP_RIGHT"}, {"time": 24.823, "type": "UP"}, {"time": 25.096, "type": "DOWN"}, {"time": 25.641, "type": "REVERSE_BACK"}, {"time": 26.187, "type": "UP"}, {"time": 26.46, "type": "DOWN"}, {"time": 26.732, "type": "DOWN"}, {"time": 27.005, "type": "UP"}, {"time": 27.55, "type": "RIGHT"}, {"time": 28.369, "type": "UP"}, {"time": 28.642, "type": "DOWN"}, {"time": 28.914, "type": "DOWN"}, {"time": 29.187, "type": "UP"}, {"time": 29.46, "type": "RIGHT"}, {"time": 30.55, "type": "UP"}, {"time": 30.823, "type": "RIGHT"}, {"time": 31.096, "type": "RIGHT"}, {"time": 31.369, "type": "LEFT"}, {"time": 31.641, "type": "LEFT"}, {"time": 31.914, "type": "UP"}, {"time": 32.187, "type": "DOWN"}, {"time": 32.46, "type": "DOWN_RIGHT"}, {"time": 32.732, "type": "RIGHT"}, {"time": 33.005, "type": "UP_RIGHT"}, {"time": 33.278, "type": "LEFT"}, {"time": 33.55, "type": "RIGHT"}, {"time": 33.823, "type": "LEFT"}, {"time": 34.096, "type": "UP"}, {"time": 34.369, "type": "RIGHT"}, {"time": 34.641, "type": "UP"}, {"time": 34.914, "type": "REVERSE"}, {"time": 35.187, "type": "DOWN"}, {"time": 35.46, "type": "DOWN"}, {"time": 35.732, "type": "DOWN_RIGHT"}, {"time": 36.005, "type": "RIGHT"}, {"time": 36.278, "type": "UP"}, {"time": 36.55, "type": "DOWN"}, {"time": 36.823, "type": "UP"}, {"time": 37.096, "type": "UP"}, {"time": 37.369, "type": "LEFT"}, {"time": 37.641, "type": "UP"}, {"time": 37.914, "type": "UP"}, {"time": 38.187, "type": "UP_RIGHT"}, {"time": 38.46, "type": "UP"}, {"time": 38.732, "type": "UP_LEFT"}, {"time": 39.005, "type": "UP"}, {"time": 39.278, "type": "REVERSE_BACK"}, {"time": 39.55, "type": "RIGHT"}, {"time": 39.823, "type": "RIGHT"}, {"time": 40.096, "type": "LEFT"}, {"time": 40.368, "type": "LEFT"}, {"time": 40.641, "type": "UP"}, {"time": 40.914, "type": "DOWN"}, {"time": 41.187, "type": "DOWN_RIGHT"}, {"time": 41.459, "type": "RIGHT"}, {"time": 41.732, "type": "UP_RIGHT"}, {"time": 42.005, "type": "LEFT"}, {"time": 42.277, "type": "RIGHT"}, {"time": 42.55, "type": "LEFT"}, {"time": 42.823, "type": "UP"}, {"time": 43.096, "type": "RIGHT"}, {"time": 43.368, "type": "UP"}, {"time": 43.641, "type": "REVERSE"}, {"time": 43.914, "type": "DOWN"}, {"time": 44.187, "type": "DOWN"}, {"time": 44.459, "type": "DOWN_RIGHT"}, {"time": 44.732, "type": "RIGHT"}, {"time": 45.005, "type": "UP"}, {"time": 45.277, "type": "DOWN"}, {"time": 45.55, "type": "UP"}, {"time": 45.823, "type": "UP"}, {"time": 46.096, "type": "LEFT"}, {"time": 46.368, "type": "UP"}, {"time": 46.641, "type": "UP"}, {"time": 46.914, "type": "UP_RIGHT"}, {"time": 47.187, "type": "UP"}, {"time": 47.459, "type": "UP_LEFT"}, {"time": 47.732, "type": "UP"}, {"time": 48.005, "type": "REVERSE_BACK"}, {"time": 48.278, "type": "UP"}, {"time": 48.55, "type": "LEFT"}, {"time": 49.096, "type": "LEFT"}, {"time": 49.55, "type": "UP_LEFT"}, {"time": 50.187, "type": "UP"}, {"time": 50.46, "type": "DOWN"}, {"time": 50.732, "type": "UP"}, {"time": 50.914, "type": "DOWN"}, {"time": 51.278, "type": "UP"}, {"time": 51.641, "type": "UP_RIGHT"}, {"time": 52.369, "type": "UP"}, {"time": 52.641, "type": "DOWN"}, {"time": 52.914, "type": "UP"}, {"time": 53.096, "type": "UP_RIGHT"}, {"time": 53.46, "type": "LEFT"}, {"time": 53.914, "type": "LEFT"}, {"time": 54.55, "type": "RIGHT"}, {"time": 54.823, "type": "LEFT"}, {"time": 55.096, "type": "UP"}, {"time": 55.278, "type": "DOWN"}, {"time": 55.641, "type": "UP"}, {"time": 56.096, "type": "RIGHT"}, {"time": 56.732, "type": "UP"}, {"time": 57.005, "type": "DOWN"}, {"time": 57.278, "type": "UP"}, {"time": 57.46, "type": "RIGHT"}, {"time": 57.823, "type": "UP"}, {"time": 58.278, "type": "DOWN"}, {"time": 58.914, "type": "UP"}, {"time": 59.187, "type": "DOWN"}, {"time": 59.46, "type": "UP"}, {"time": 59.642, "type": "RIGHT"}, {"time": 60.005, "type": "UP"}], "events": [{"time": 0.278, "type": "BG_COLOR", "duration": 1.91, "color": "#613583"}, {"time": 7.187, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 8.732, "type": "CAMERA_BOB_ON"}, {"time": 17.46, "type": "NOTES_FLOW_RIGHT"}, {"time": 25.641, "type": "NOTES_FLOW_LEFT"}, {"time": 26.187, "type": "CAMERA_BOB_OFF"}, {"time": 26.187, "type": "FLASH"}, {"time": 29.46, "type": "FX_GLITCH", "duration": 1.085}, {"time": 29.46, "type": "BG_COLOR", "duration": 1.09, "color": "#000a2b"}, {"time": 30.55, "type": "FLASH"}, {"time": 30.55, "type": "CAMERA_BOB_ON"}, {"time": 34.914, "type": "NOTES_FLOW_RIGHT"}, {"time": 39.278, "type": "NOTES_FLOW_LEFT"}, {"time": 43.641, "type": "NOTES_FLOW_RIGHT"}, {"time": 48.005, "type": "NOTES_FLOW_LEFT"}, {"time": 60.005, "type": "CAMERA_BOB_OFF"}, {"time": 60.005, "type": "FLASH"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "Petrichor": {"folder": "Petrichor", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/Petrichor/track.mp3", "coverRef": "cov_f85a5f3e4b", "bgRef": null, "meta": {"title": "Petrichor", "artist": "Arvicheskyy", "difficulty": 4.5, "menu_color": "#330035"}, "chart": {"bpm": 100, "noteTravelTime": 1000, "gridOffset": 0.105, "timing": [{"time": 0.105, "bpm": 100}], "title": "Sha pridymajy", "artist": "Arvicheskyy", "notes": [{"time": 0.105, "type": "UP"}, {"time": 2.805, "type": "DOWN"}, {"time": 5.205, "type": "UP"}, {"time": 7.605, "type": "DOWN"}, {"time": 10.005, "type": "UP"}, {"time": 12.405, "type": "DOWN"}, {"time": 14.805, "type": "UP"}, {"time": 17.205, "type": "DOWN"}, {"time": 19.305, "type": "UP"}, {"time": 22.005, "type": "DOWN"}, {"time": 24.405, "type": "UP"}, {"time": 24.705, "type": "DOWN"}, {"time": 25.005, "type": "UP"}, {"time": 25.305, "type": "DOWN"}, {"time": 25.605, "type": "UP"}, {"time": 25.905, "type": "DOWN"}, {"time": 26.217, "type": "UP"}, {"time": 26.517, "type": "DOWN"}, {"time": 26.817, "type": "UP"}, {"time": 27.117, "type": "DOWN"}, {"time": 27.417, "type": "UP"}, {"time": 27.63, "type": "DOWN"}, {"time": 27.855, "type": "UP"}, {"time": 28.08, "type": "DOWN"}, {"time": 28.305, "type": "UP"}, {"time": 29.505, "type": "UP"}, {"time": 29.73, "type": "DOWN"}, {"time": 29.955, "type": "UP"}, {"time": 30.18, "type": "DOWN"}, {"time": 30.405, "type": "LEFT"}, {"time": 30.63, "type": "RIGHT"}, {"time": 30.855, "type": "LEFT"}, {"time": 31.08, "type": "RIGHT"}, {"time": 31.305, "type": "UP"}, {"time": 31.905, "type": "UP"}, {"time": 32.13, "type": "DOWN"}, {"time": 32.355, "type": "UP"}, {"time": 32.58, "type": "DOWN"}, {"time": 32.805, "type": "LEFT"}, {"time": 33.03, "type": "REVERSE"}, {"time": 33.255, "type": "LEFT"}, {"time": 33.48, "type": "REVERSE_BACK"}, {"time": 33.705, "type": "UP"}, {"time": 34.305, "type": "DOWN"}, {"time": 34.53, "type": "UP"}, {"time": 34.755, "type": "DOWN"}, {"time": 34.98, "type": "UP"}, {"time": 35.205, "type": "RIGHT"}, {"time": 35.43, "type": "LEFT"}, {"time": 35.655, "type": "RIGHT"}, {"time": 35.88, "type": "LEFT"}, {"time": 36.105, "type": "UP"}, {"time": 36.705, "type": "DOWN"}, {"time": 36.93, "type": "UP"}, {"time": 37.155, "type": "DOWN"}, {"time": 37.38, "type": "UP"}, {"time": 37.605, "type": "RIGHT"}, {"time": 37.83, "type": "LEFT"}, {"time": 38.055, "type": "RIGHT"}, {"time": 38.28, "type": "LEFT"}, {"time": 38.505, "type": "UP"}, {"time": 39.105, "type": "UP"}, {"time": 39.33, "type": "DOWN"}, {"time": 39.555, "type": "UP"}, {"time": 39.78, "type": "DOWN"}, {"time": 40.005, "type": "LEFT"}, {"time": 40.23, "type": "RIGHT"}, {"time": 40.455, "type": "LEFT"}, {"time": 40.68, "type": "RIGHT"}, {"time": 40.905, "type": "UP"}, {"time": 41.505, "type": "UP"}, {"time": 41.73, "type": "DOWN"}, {"time": 41.955, "type": "UP"}, {"time": 42.18, "type": "DOWN"}, {"time": 42.405, "type": "LEFT"}, {"time": 42.63, "type": "REVERSE"}, {"time": 42.855, "type": "LEFT"}, {"time": 43.08, "type": "REVERSE_BACK"}, {"time": 43.305, "type": "UP"}, {"time": 43.918, "type": "DOWN"}, {"time": 44.143, "type": "UP"}, {"time": 44.368, "type": "DOWN"}, {"time": 44.593, "type": "UP"}, {"time": 44.818, "type": "RIGHT"}, {"time": 45.043, "type": "LEFT"}, {"time": 45.268, "type": "RIGHT"}, {"time": 45.493, "type": "LEFT"}, {"time": 45.718, "type": "UP"}, {"time": 46.305, "type": "UP"}, {"time": 46.53, "type": "DOWN"}, {"time": 46.755, "type": "UP"}, {"time": 46.98, "type": "DOWN"}, {"time": 47.205, "type": "LEFT"}, {"time": 47.43, "type": "RIGHT"}, {"time": 47.655, "type": "LEFT"}, {"time": 47.88, "type": "RIGHT"}, {"time": 48.105, "type": "UP"}, {"time": 48.705, "type": "DOWN"}, {"time": 48.93, "type": "UP"}, {"time": 49.155, "type": "DOWN"}, {"time": 49.38, "type": "UP"}, {"time": 49.605, "type": "RIGHT"}, {"time": 49.83, "type": "LEFT"}, {"time": 50.055, "type": "RIGHT"}, {"time": 50.28, "type": "LEFT"}, {"time": 50.505, "type": "UP"}, {"time": 51.105, "type": "UP"}, {"time": 51.33, "type": "DOWN"}, {"time": 51.555, "type": "UP"}, {"time": 51.78, "type": "DOWN"}, {"time": 52.005, "type": "LEFT"}, {"time": 52.23, "type": "REVERSE"}, {"time": 52.455, "type": "LEFT"}, {"time": 52.68, "type": "REVERSE_BACK"}, {"time": 52.905, "type": "UP"}, {"time": 53.505, "type": "DOWN"}, {"time": 53.73, "type": "UP"}, {"time": 53.955, "type": "DOWN"}, {"time": 54.18, "type": "UP"}, {"time": 54.405, "type": "RIGHT"}, {"time": 54.63, "type": "LEFT"}, {"time": 54.855, "type": "RIGHT"}, {"time": 55.08, "type": "LEFT"}, {"time": 55.305, "type": "UP"}, {"time": 55.905, "type": "UP"}, {"time": 56.13, "type": "DOWN"}, {"time": 56.355, "type": "UP"}, {"time": 56.58, "type": "DOWN"}, {"time": 56.805, "type": "LEFT"}, {"time": 57.03, "type": "RIGHT"}, {"time": 57.255, "type": "LEFT"}, {"time": 57.48, "type": "RIGHT"}, {"time": 57.705, "type": "UP"}, {"time": 58.305, "type": "DOWN"}, {"time": 58.53, "type": "UP"}, {"time": 58.755, "type": "DOWN"}, {"time": 58.98, "type": "UP"}, {"time": 59.205, "type": "RIGHT"}, {"time": 59.43, "type": "LEFT"}, {"time": 59.655, "type": "RIGHT"}, {"time": 59.88, "type": "LEFT"}, {"time": 60.105, "type": "UP"}, {"time": 60.705, "type": "UP"}, {"time": 60.93, "type": "DOWN"}, {"time": 61.155, "type": "UP"}, {"time": 61.38, "type": "DOWN"}, {"time": 61.605, "type": "LEFT"}, {"time": 61.83, "type": "REVERSE"}, {"time": 62.055, "type": "LEFT"}, {"time": 62.28, "type": "REVERSE_BACK"}, {"time": 62.505, "type": "UP"}, {"time": 63.105, "type": "UP"}, {"time": 63.33, "type": "DOWN"}, {"time": 63.555, "type": "UP"}, {"time": 63.78, "type": "DOWN"}, {"time": 64.005, "type": "LEFT"}, {"time": 64.23, "type": "RIGHT"}, {"time": 64.455, "type": "LEFT"}, {"time": 64.68, "type": "RIGHT"}, {"time": 64.905, "type": "UP"}, {"time": 65.505, "type": "DOWN"}, {"time": 65.73, "type": "UP"}, {"time": 65.955, "type": "DOWN"}, {"time": 66.18, "type": "UP"}, {"time": 66.405, "type": "RIGHT"}, {"time": 66.63, "type": "LEFT"}, {"time": 66.855, "type": "RIGHT"}, {"time": 67.08, "type": "LEFT"}, {"time": 67.305, "type": "UP"}, {"time": 67.83, "type": "UP"}, {"time": 68.43, "type": "DOWN"}, {"time": 69.03, "type": "UP"}, {"time": 69.63, "type": "DOWN"}, {"time": 70.23, "type": "RIGHT"}, {"time": 70.83, "type": "LEFT"}, {"time": 71.43, "type": "RIGHT"}, {"time": 72.03, "type": "LEFT"}, {"time": 72.63, "type": "UP"}, {"time": 73.23, "type": "DOWN"}, {"time": 73.83, "type": "UP"}, {"time": 74.43, "type": "DOWN"}, {"time": 75.03, "type": "LEFT"}, {"time": 75.63, "type": "RIGHT"}, {"time": 76.23, "type": "LEFT"}, {"time": 76.83, "type": "REVERSE"}, {"time": 77.43, "type": "UP"}, {"time": 78.03, "type": "DOWN"}, {"time": 78.63, "type": "UP"}, {"time": 79.23, "type": "DOWN"}, {"time": 79.83, "type": "RIGHT"}, {"time": 80.43, "type": "LEFT"}, {"time": 81.03, "type": "RIGHT"}, {"time": 81.63, "type": "LEFT"}, {"time": 82.23, "type": "UP"}, {"time": 82.83, "type": "DOWN"}, {"time": 83.43, "type": "UP"}, {"time": 84.03, "type": "DOWN"}, {"time": 84.63, "type": "LEFT"}, {"time": 85.23, "type": "RIGHT"}, {"time": 85.83, "type": "LEFT"}, {"time": 86.43, "type": "REVERSE_BACK"}, {"time": 87.105, "type": "UP"}, {"time": 87.405, "type": "DOWN"}, {"time": 87.705, "type": "UP"}, {"time": 88.005, "type": "DOWN"}, {"time": 88.305, "type": "UP"}, {"time": 88.605, "type": "DOWN"}, {"time": 89.505, "type": "LEFT"}, {"time": 89.805, "type": "RIGHT"}, {"time": 90.105, "type": "LEFT"}, {"time": 90.405, "type": "RIGHT"}, {"time": 90.705, "type": "LEFT"}, {"time": 91.005, "type": "RIGHT"}, {"time": 91.905, "type": "UP"}, {"time": 92.205, "type": "DOWN"}, {"time": 92.505, "type": "UP"}, {"time": 92.805, "type": "DOWN"}, {"time": 93.105, "type": "UP"}, {"time": 93.405, "type": "DOWN"}, {"time": 94.305, "type": "LEFT"}, {"time": 94.605, "type": "RIGHT"}, {"time": 94.83, "type": "LEFT"}, {"time": 95.055, "type": "RIGHT"}, {"time": 95.28, "type": "LEFT"}, {"time": 95.505, "type": "RIGHT"}, {"time": 95.73, "type": "LEFT"}, {"time": 96.705, "type": "UP"}, {"time": 96.93, "type": "DOWN"}, {"time": 97.155, "type": "UP"}, {"time": 97.38, "type": "DOWN"}, {"time": 97.605, "type": "LEFT"}, {"time": 97.83, "type": "RIGHT"}, {"time": 98.055, "type": "LEFT"}, {"time": 98.28, "type": "RIGHT"}, {"time": 98.505, "type": "UP"}, {"time": 99.105, "type": "UP"}, {"time": 99.33, "type": "DOWN"}, {"time": 99.555, "type": "UP"}, {"time": 99.78, "type": "DOWN"}, {"time": 100.005, "type": "LEFT"}, {"time": 100.23, "type": "REVERSE"}, {"time": 100.455, "type": "LEFT"}, {"time": 100.68, "type": "REVERSE_BACK"}, {"time": 100.905, "type": "UP"}, {"time": 101.505, "type": "DOWN"}, {"time": 101.73, "type": "UP"}, {"time": 101.955, "type": "DOWN"}, {"time": 102.18, "type": "UP"}, {"time": 102.405, "type": "RIGHT"}, {"time": 102.63, "type": "LEFT"}, {"time": 102.855, "type": "RIGHT"}, {"time": 103.08, "type": "LEFT"}, {"time": 103.305, "type": "UP"}, {"time": 103.905, "type": "DOWN"}, {"time": 104.13, "type": "UP"}, {"time": 104.355, "type": "DOWN"}, {"time": 104.58, "type": "UP"}, {"time": 104.805, "type": "RIGHT"}, {"time": 105.03, "type": "LEFT"}, {"time": 105.255, "type": "RIGHT"}, {"time": 105.48, "type": "LEFT"}, {"time": 105.705, "type": "UP"}, {"time": 106.305, "type": "UP"}, {"time": 106.53, "type": "DOWN"}, {"time": 106.755, "type": "UP"}, {"time": 106.98, "type": "DOWN"}, {"time": 107.205, "type": "LEFT"}, {"time": 107.43, "type": "RIGHT"}, {"time": 107.655, "type": "LEFT"}, {"time": 107.88, "type": "RIGHT"}, {"time": 108.105, "type": "UP"}, {"time": 108.705, "type": "UP"}, {"time": 108.93, "type": "DOWN"}, {"time": 109.155, "type": "UP"}, {"time": 109.38, "type": "DOWN"}, {"time": 109.605, "type": "LEFT"}, {"time": 109.83, "type": "REVERSE"}, {"time": 110.055, "type": "LEFT"}, {"time": 110.28, "type": "REVERSE_BACK"}, {"time": 110.505, "type": "UP"}, {"time": 111.118, "type": "DOWN"}, {"time": 111.343, "type": "UP"}, {"time": 111.568, "type": "DOWN"}, {"time": 111.793, "type": "UP"}, {"time": 112.018, "type": "RIGHT"}, {"time": 112.243, "type": "LEFT"}, {"time": 112.468, "type": "RIGHT"}, {"time": 112.693, "type": "LEFT"}, {"time": 112.918, "type": "UP"}, {"time": 113.505, "type": "UP"}, {"time": 113.73, "type": "DOWN"}, {"time": 113.955, "type": "UP"}, {"time": 114.18, "type": "DOWN"}, {"time": 114.405, "type": "LEFT"}, {"time": 114.63, "type": "RIGHT"}, {"time": 114.855, "type": "LEFT"}, {"time": 115.08, "type": "RIGHT"}, {"time": 115.305, "type": "UP"}, {"time": 115.905, "type": "DOWN"}, {"time": 116.13, "type": "UP"}, {"time": 116.355, "type": "DOWN"}, {"time": 116.58, "type": "UP"}, {"time": 116.805, "type": "RIGHT"}, {"time": 117.03, "type": "LEFT"}, {"time": 117.255, "type": "RIGHT"}, {"time": 117.48, "type": "LEFT"}, {"time": 117.705, "type": "UP"}, {"time": 118.305, "type": "UP"}, {"time": 118.53, "type": "DOWN"}, {"time": 118.755, "type": "UP"}, {"time": 118.98, "type": "DOWN"}, {"time": 119.205, "type": "LEFT"}, {"time": 119.43, "type": "REVERSE"}, {"time": 119.655, "type": "LEFT"}, {"time": 119.88, "type": "REVERSE_BACK"}, {"time": 120.105, "type": "UP"}, {"time": 120.705, "type": "UP"}, {"time": 120.93, "type": "DOWN"}, {"time": 121.155, "type": "UP"}, {"time": 121.38, "type": "DOWN"}, {"time": 121.605, "type": "LEFT"}, {"time": 121.83, "type": "RIGHT"}, {"time": 122.055, "type": "LEFT"}, {"time": 122.28, "type": "RIGHT"}, {"time": 122.505, "type": "UP"}, {"time": 123.105, "type": "DOWN"}, {"time": 123.33, "type": "UP"}, {"time": 123.555, "type": "DOWN"}, {"time": 123.78, "type": "UP"}, {"time": 124.005, "type": "RIGHT"}, {"time": 124.23, "type": "LEFT"}, {"time": 124.455, "type": "RIGHT"}, {"time": 124.68, "type": "LEFT"}, {"time": 124.905, "type": "UP"}, {"time": 125.505, "type": "DOWN"}, {"time": 125.73, "type": "UP"}, {"time": 125.955, "type": "DOWN"}, {"time": 126.18, "type": "UP"}, {"time": 126.405, "type": "RIGHT"}, {"time": 126.63, "type": "LEFT"}, {"time": 126.855, "type": "RIGHT"}, {"time": 127.08, "type": "LEFT"}, {"time": 127.305, "type": "UP"}, {"time": 127.905, "type": "UP"}, {"time": 128.13, "type": "DOWN"}, {"time": 128.355, "type": "UP"}, {"time": 128.58, "type": "DOWN"}, {"time": 128.805, "type": "LEFT"}, {"time": 129.03, "type": "REVERSE"}, {"time": 129.255, "type": "LEFT"}, {"time": 129.48, "type": "REVERSE_BACK"}, {"time": 129.705, "type": "UP"}, {"time": 130.305, "type": "DOWN"}, {"time": 130.53, "type": "UP"}, {"time": 130.755, "type": "DOWN"}, {"time": 130.98, "type": "UP"}, {"time": 131.205, "type": "RIGHT"}, {"time": 131.43, "type": "LEFT"}, {"time": 131.655, "type": "RIGHT"}, {"time": 131.88, "type": "LEFT"}, {"time": 132.105, "type": "UP"}, {"time": 132.692, "type": "UP"}, {"time": 132.917, "type": "DOWN"}, {"time": 133.142, "type": "UP"}, {"time": 133.367, "type": "DOWN"}, {"time": 133.592, "type": "LEFT"}, {"time": 133.817, "type": "RIGHT"}, {"time": 134.042, "type": "LEFT"}, {"time": 134.267, "type": "RIGHT"}, {"time": 134.492, "type": "UP"}, {"time": 135.105, "type": "UP"}, {"time": 135.705, "type": "UP"}, {"time": 136.305, "type": "UP"}, {"time": 136.905, "type": "UP"}], "events": [{"time": 0, "type": "FLASH", "duration": 28.755}, {"time": 0.255, "type": "BG_COLOR", "duration": 28.2, "color": "#330035"}, {"time": 22.005, "type": "CAMERA_BOB_ON"}, {"time": 25.38, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 26.73, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 28.005, "type": "NOTE_SPEED", "speed": 1.75}, {"time": 28.305, "type": "BLACKOUT", "duration": 0.6}, {"time": 28.905, "type": "FLASH"}, {"time": 28.905, "type": "SHAKE"}, {"time": 30.705, "type": "FLASH", "duration": 0.6}, {"time": 31.305, "type": "SHAKE"}, {"time": 33.03, "type": "FX_GLITCH", "duration": 0.375}, {"time": 33.03, "type": "NOTES_FLOW_RIGHT"}, {"time": 33.03, "type": "SHAKE"}, {"time": 33.03, "type": "DISCO", "duration": 0.675}, {"time": 33.105, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 33.18, "type": "FX_INVERT", "duration": 0.45}, {"time": 33.255, "type": "SHAKE"}, {"time": 33.405, "type": "FLASH", "duration": 0.3}, {"time": 33.48, "type": "NOTES_FLOW_LEFT"}, {"time": 33.48, "type": "SHAKE"}, {"time": 33.705, "type": "SHAKE"}, {"time": 35.505, "type": "FLASH", "duration": 0.6}, {"time": 36.105, "type": "SHAKE"}, {"time": 38.205, "type": "FLASH", "duration": 0.3}, {"time": 38.505, "type": "SHAKE"}, {"time": 40.305, "type": "FLASH", "duration": 0.6}, {"time": 40.905, "type": "SHAKE"}, {"time": 42.63, "type": "NOTES_FLOW_RIGHT"}, {"time": 42.63, "type": "FX_GLITCH", "duration": 0.375}, {"time": 42.63, "type": "SHAKE"}, {"time": 42.63, "type": "DISCO", "duration": 0.675}, {"time": 42.705, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 42.78, "type": "FX_INVERT", "duration": 0.45}, {"time": 42.855, "type": "SHAKE"}, {"time": 43.005, "type": "FLASH", "duration": 0.3}, {"time": 43.08, "type": "NOTES_FLOW_LEFT"}, {"time": 43.08, "type": "SHAKE"}, {"time": 43.305, "type": "SHAKE"}, {"time": 45.418, "type": "FLASH", "duration": 0.3}, {"time": 45.705, "type": "SHAKE"}, {"time": 47.505, "type": "FLASH", "duration": 0.6}, {"time": 47.505, "type": "SHAKE"}, {"time": 47.505, "type": "FX_GLITCH", "duration": 0.225}, {"time": 48.105, "type": "SHAKE"}, {"time": 50.205, "type": "FLASH", "duration": 0.3}, {"time": 50.505, "type": "SHAKE"}, {"time": 52.23, "type": "NOTES_FLOW_RIGHT"}, {"time": 52.23, "type": "FX_GLITCH", "duration": 0.375}, {"time": 52.23, "type": "SHAKE"}, {"time": 52.23, "type": "DISCO", "duration": 0.675}, {"time": 52.305, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 52.38, "type": "FX_INVERT", "duration": 0.45}, {"time": 52.455, "type": "SHAKE"}, {"time": 52.605, "type": "FLASH", "duration": 0.3}, {"time": 52.68, "type": "NOTES_FLOW_LEFT"}, {"time": 52.68, "type": "SHAKE"}, {"time": 52.905, "type": "SHAKE"}, {"time": 55.005, "type": "FLASH", "duration": 0.3}, {"time": 55.305, "type": "SHAKE"}, {"time": 57.105, "type": "FLASH", "duration": 0.6}, {"time": 57.705, "type": "SHAKE"}, {"time": 59.805, "type": "FLASH", "duration": 0.3}, {"time": 60.105, "type": "SHAKE"}, {"time": 61.83, "type": "NOTES_FLOW_RIGHT"}, {"time": 61.83, "type": "FX_GLITCH", "duration": 0.375}, {"time": 61.83, "type": "SHAKE"}, {"time": 61.83, "type": "DISCO", "duration": 0.675}, {"time": 61.905, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 61.98, "type": "FX_INVERT", "duration": 0.45}, {"time": 62.055, "type": "SHAKE"}, {"time": 62.205, "type": "FLASH", "duration": 0.3}, {"time": 62.28, "type": "NOTES_FLOW_LEFT"}, {"time": 62.28, "type": "SHAKE"}, {"time": 62.505, "type": "SHAKE"}, {"time": 64.305, "type": "FLASH", "duration": 0.6}, {"time": 64.905, "type": "SHAKE"}, {"time": 67.005, "type": "FLASH", "duration": 0.3}, {"time": 67.305, "type": "CAMERA_BOB_OFF"}, {"time": 67.305, "type": "SHAKE"}, {"time": 67.305, "type": "BG_COLOR", "color": "#62a0ea"}, {"time": 67.38, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 67.83, "type": "FLASH", "duration": 1.8}, {"time": 69.63, "type": "SHAKE"}, {"time": 70.23, "type": "FLASH", "duration": 1.8}, {"time": 72.03, "type": "SHAKE"}, {"time": 72.63, "type": "FLASH", "duration": 1.8}, {"time": 74.43, "type": "SHAKE"}, {"time": 75.03, "type": "FLASH", "duration": 1.8}, {"time": 76.83, "type": "NOTES_FLOW_RIGHT"}, {"time": 76.83, "type": "CAMERA_BOB_ON"}, {"time": 76.83, "type": "SHAKE"}, {"time": 77.43, "type": "FLASH", "duration": 1.8}, {"time": 79.23, "type": "SHAKE"}, {"time": 79.83, "type": "FLASH", "duration": 1.8}, {"time": 81.63, "type": "SHAKE"}, {"time": 82.23, "type": "FLASH", "duration": 1.8}, {"time": 84.03, "type": "SHAKE"}, {"time": 84.63, "type": "FLASH", "duration": 1.8}, {"time": 86.43, "type": "CAMERA_BOB_OFF"}, {"time": 86.43, "type": "NOTES_FLOW_LEFT"}, {"time": 86.43, "type": "SHAKE"}, {"time": 90.405, "type": "FLASH", "duration": 5.7}, {"time": 91.08, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 95.805, "type": "NOTE_SPEED", "speed": 1.75}, {"time": 96.105, "type": "CAMERA_BOB_ON"}, {"time": 96.105, "type": "BG_COLOR", "color": "#330035"}, {"time": 96.105, "type": "SHAKE"}, {"time": 97.905, "type": "FLASH", "duration": 0.6}, {"time": 98.505, "type": "SHAKE"}, {"time": 100.23, "type": "NOTES_FLOW_RIGHT"}, {"time": 100.23, "type": "FX_GLITCH", "duration": 0.375}, {"time": 100.23, "type": "SHAKE"}, {"time": 100.23, "type": "DISCO", "duration": 0.675}, {"time": 100.305, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 100.38, "type": "FX_INVERT", "duration": 0.45}, {"time": 100.455, "type": "SHAKE"}, {"time": 100.605, "type": "FLASH", "duration": 0.3}, {"time": 100.68, "type": "NOTES_FLOW_LEFT"}, {"time": 100.68, "type": "SHAKE"}, {"time": 100.905, "type": "SHAKE"}, {"time": 102.705, "type": "FLASH", "duration": 0.6}, {"time": 103.305, "type": "SHAKE"}, {"time": 105.405, "type": "FLASH", "duration": 0.3}, {"time": 105.705, "type": "SHAKE"}, {"time": 107.505, "type": "FLASH", "duration": 0.6}, {"time": 108.105, "type": "SHAKE"}, {"time": 109.83, "type": "NOTES_FLOW_RIGHT"}, {"time": 109.83, "type": "FX_GLITCH", "duration": 0.375}, {"time": 109.83, "type": "SHAKE"}, {"time": 109.83, "type": "DISCO", "duration": 0.675}, {"time": 109.905, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 109.98, "type": "FX_INVERT", "duration": 0.45}, {"time": 110.055, "type": "SHAKE"}, {"time": 110.205, "type": "FLASH", "duration": 0.3}, {"time": 110.28, "type": "NOTES_FLOW_LEFT"}, {"time": 110.28, "type": "SHAKE"}, {"time": 110.505, "type": "SHAKE"}, {"time": 112.618, "type": "FLASH", "duration": 0.3}, {"time": 112.905, "type": "SHAKE"}, {"time": 114.705, "type": "FLASH", "duration": 0.6}, {"time": 114.705, "type": "SHAKE"}, {"time": 114.705, "type": "FX_GLITCH", "duration": 0.225}, {"time": 115.305, "type": "SHAKE"}, {"time": 117.405, "type": "FLASH", "duration": 0.3}, {"time": 117.705, "type": "SHAKE"}, {"time": 119.43, "type": "NOTES_FLOW_RIGHT"}, {"time": 119.43, "type": "FX_GLITCH", "duration": 0.375}, {"time": 119.43, "type": "SHAKE"}, {"time": 119.43, "type": "DISCO", "duration": 0.675}, {"time": 119.505, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 119.58, "type": "FX_INVERT", "duration": 0.45}, {"time": 119.655, "type": "SHAKE"}, {"time": 119.805, "type": "FLASH", "duration": 0.3}, {"time": 119.88, "type": "NOTES_FLOW_LEFT"}, {"time": 119.88, "type": "SHAKE"}, {"time": 120.105, "type": "SHAKE"}, {"time": 121.905, "type": "FLASH", "duration": 0.6}, {"time": 122.505, "type": "SHAKE"}, {"time": 124.305, "type": "FLASH", "duration": 0.6}, {"time": 124.905, "type": "SHAKE"}, {"time": 127.005, "type": "FLASH", "duration": 0.3}, {"time": 127.305, "type": "SHAKE"}, {"time": 129.03, "type": "NOTES_FLOW_RIGHT"}, {"time": 129.03, "type": "FX_GLITCH", "duration": 0.375}, {"time": 129.03, "type": "SHAKE"}, {"time": 129.03, "type": "DISCO", "duration": 0.675}, {"time": 129.105, "type": "FX_PIXELATE", "duration": 0.6}, {"time": 129.18, "type": "FX_INVERT", "duration": 0.45}, {"time": 129.255, "type": "SHAKE"}, {"time": 129.405, "type": "FLASH", "duration": 0.3}, {"time": 129.48, "type": "NOTES_FLOW_LEFT"}, {"time": 129.48, "type": "SHAKE"}, {"time": 129.705, "type": "SHAKE"}, {"time": 131.805, "type": "FLASH", "duration": 0.3}, {"time": 132.105, "type": "FLASH", "duration": 2.4}, {"time": 132.105, "type": "SHAKE"}, {"time": 134.505, "type": "CAMERA_BOB_OFF"}, {"time": 134.505, "type": "SHAKE"}, {"time": 136.83, "type": "FX_GLITCH", "duration": 0.2}, {"time": 136.98, "type": "BLACKOUT", "duration": 2.25}], "audioFile": "track.mp3", "audioFormat": "mp3", "coverFile": "Cover.png"}}, "SwipeTrava": {"folder": "SwipeTrava", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/SwipeTrava/track.ogg", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "SwipeTrava", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 2.5, "menu_color": "#00ffd5"}, "chart": {"bpm": 170, "noteTravelTime": 2000, "gridOffset": 0.042, "timing": [{"time": 0.042, "bpm": 170}], "notes": [{"time": 0.042, "type": "UP"}, {"time": 1.101, "type": "UP"}, {"time": 1.454, "type": "DOWN"}, {"time": 2.513, "type": "RIGHT"}, {"time": 2.866, "type": "LEFT"}, {"time": 3.924, "type": "RIGHT"}, {"time": 4.277, "type": "LEFT"}, {"time": 5.336, "type": "UP"}, {"time": 5.689, "type": "DOWN"}, {"time": 6.748, "type": "UP"}, {"time": 7.101, "type": "DOWN"}, {"time": 8.16, "type": "RIGHT"}, {"time": 8.513, "type": "LEFT"}, {"time": 9.571, "type": "LEFT"}, {"time": 9.924, "type": "RIGHT"}, {"time": 10.983, "type": "UP"}, {"time": 11.336, "type": "DOWN"}, {"time": 12.395, "type": "UP"}, {"time": 12.748, "type": "DOWN"}, {"time": 13.807, "type": "RIGHT"}, {"time": 14.16, "type": "LEFT"}, {"time": 15.218, "type": "RIGHT"}, {"time": 15.571, "type": "LEFT"}, {"time": 16.63, "type": "UP"}, {"time": 16.983, "type": "DOWN"}, {"time": 18.042, "type": "UP"}, {"time": 18.395, "type": "DOWN"}, {"time": 19.454, "type": "RIGHT"}, {"time": 19.807, "type": "LEFT"}, {"time": 20.865, "type": "LEFT"}, {"time": 21.218, "type": "RIGHT"}, {"time": 22.277, "type": "UP"}, {"time": 22.63, "type": "REVERSE"}, {"time": 23.689, "type": "DOWN"}, {"time": 24.042, "type": "UP"}, {"time": 25.101, "type": "LEFT"}, {"time": 25.454, "type": "RIGHT"}, {"time": 26.513, "type": "DOWN"}, {"time": 26.866, "type": "UP"}, {"time": 27.924, "type": "LEFT"}, {"time": 28.277, "type": "RIGHT"}, {"time": 29.336, "type": "UP_LEFT"}, {"time": 29.689, "type": "UP_RIGHT"}, {"time": 30.748, "type": "DOWN_LEFT"}, {"time": 31.101, "type": "DOWN_RIGHT"}, {"time": 32.16, "type": "UP_LEFT"}, {"time": 32.513, "type": "UP_RIGHT"}, {"time": 33.572, "type": "DOWN_LEFT"}, {"time": 33.924, "type": "REVERSE_BACK"}, {"time": 34.983, "type": "DOWN"}, {"time": 35.336, "type": "UP"}, {"time": 36.395, "type": "DOWN"}, {"time": 36.748, "type": "UP"}, {"time": 37.807, "type": "LEFT"}, {"time": 38.16, "type": "RIGHT"}, {"time": 39.218, "type": "LEFT"}, {"time": 39.571, "type": "RIGHT"}, {"time": 40.63, "type": "DOWN_RIGHT"}, {"time": 40.983, "type": "RIGHT"}, {"time": 42.042, "type": "UP_RIGHT"}, {"time": 42.395, "type": "UP"}, {"time": 43.454, "type": "UP_LEFT"}, {"time": 43.807, "type": "LEFT"}, {"time": 44.866, "type": "DOWN_LEFT"}, {"time": 45.218, "type": "DOWN"}, {"time": 45.748, "type": "DOWN"}, {"time": 46.101, "type": "UP"}, {"time": 46.63, "type": "DOWN"}, {"time": 47.16, "type": "RIGHT"}, {"time": 47.513, "type": "RIGHT"}, {"time": 48.042, "type": "UP"}, {"time": 48.571, "type": "LEFT"}, {"time": 48.924, "type": "LEFT"}, {"time": 49.454, "type": "DOWN"}, {"time": 49.983, "type": "RIGHT"}, {"time": 50.336, "type": "RIGHT"}, {"time": 50.866, "type": "UP"}, {"time": 51.395, "type": "LEFT"}, {"time": 51.748, "type": "LEFT"}, {"time": 52.278, "type": "DOWN"}, {"time": 52.807, "type": "RIGHT"}, {"time": 53.16, "type": "RIGHT"}, {"time": 53.689, "type": "UP"}, {"time": 54.218, "type": "DOWN"}, {"time": 54.571, "type": "DOWN"}, {"time": 55.101, "type": "RIGHT"}, {"time": 55.63, "type": "DOWN"}, {"time": 55.983, "type": "DOWN"}, {"time": 56.513, "type": "UP"}, {"time": 57.571, "type": "DOWN"}, {"time": 57.924, "type": "UP"}, {"time": 58.983, "type": "DOWN"}, {"time": 59.336, "type": "UP"}, {"time": 60.395, "type": "DOWN"}, {"time": 60.748, "type": "UP"}, {"time": 61.807, "type": "DOWN"}, {"time": 62.16, "type": "UP"}, {"time": 63.218, "type": "DOWN"}, {"time": 63.571, "type": "UP"}, {"time": 68.513, "type": "UP"}], "events": [{"time": 0, "type": "BG_COLOR", "duration": 11.336, "color": "#000928"}, {"time": 0.042, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 11.16, "type": "FLASH", "duration": 0.264}, {"time": 11.424, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 11.424, "type": "NOTES_WAVE_ON"}, {"time": 11.424, "type": "BG_COLOR", "duration": 0.618, "color": "#62a0ea"}, {"time": 22.63, "type": "NOTES_FLOW_RIGHT"}, {"time": 33.924, "type": "NOTES_FLOW_LEFT"}, {"time": 34.013, "type": "NOTES_WAVE_OFF"}, {"time": 34.013, "type": "NOTES_SPIN_ON"}, {"time": 39.218, "type": "FLASH", "duration": 0.353}, {"time": 39.66, "type": "NOTES_SPIN_OFF"}, {"time": 39.66, "type": "NOTES_WAVE_ON"}, {"time": 45.307, "type": "NOTES_SPIN_ON"}, {"time": 53.248, "type": "NOTES_WAVE_OFF"}, {"time": 53.248, "type": "NOTES_SPIN_OFF"}, {"time": 55.013, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 56.071, "type": "NOTES_WAVE_ON"}, {"time": 56.513, "type": "BG_COLOR", "duration": 14.115, "color": "#000928"}, {"time": 63.66, "type": "NOTE_SPEED", "speed": 0.5}, {"time": 63.748, "type": "NOTES_SPIN_ON"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "Tearout": {"folder": "Tearout", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/Tearout/track.mp3", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "Tearout", "artist": "Arvicheskyy", "difficulty": 5.5, "menu_color": "#00ffd5"}, "chart": {"bpm": 140, "noteTravelTime": 1000, "gridOffset": 0.041, "timing": [{"time": 0.041, "bpm": 140}], "notes": [{"time": 3.47, "type": "UP"}, {"time": 5.184, "type": "DOWN"}, {"time": 6.041, "type": "UP"}, {"time": 6.898, "type": "DOWN"}, {"time": 8.612, "type": "UP"}, {"time": 10.327, "type": "UP"}, {"time": 12.041, "type": "RIGHT"}, {"time": 12.898, "type": "DOWN"}, {"time": 13.755, "type": "LEFT"}, {"time": 14.184, "type": "UP"}, {"time": 14.612, "type": "DOWN"}, {"time": 15.041, "type": "UP"}, {"time": 15.47, "type": "LEFT"}, {"time": 15.898, "type": "DOWN"}, {"time": 16.327, "type": "UP"}, {"time": 16.755, "type": "DOWN"}, {"time": 17.184, "type": "RIGHT"}, {"time": 17.612, "type": "UP"}, {"time": 18.041, "type": "DOWN"}, {"time": 18.47, "type": "UP"}, {"time": 18.898, "type": "LEFT"}, {"time": 19.327, "type": "UP"}, {"time": 19.755, "type": "RIGHT"}, {"time": 20.184, "type": "DOWN"}, {"time": 20.612, "type": "LEFT"}, {"time": 21.041, "type": "UP"}, {"time": 21.469, "type": "DOWN"}, {"time": 21.898, "type": "UP"}, {"time": 22.327, "type": "LEFT"}, {"time": 22.755, "type": "DOWN"}, {"time": 23.184, "type": "UP"}, {"time": 23.612, "type": "DOWN"}, {"time": 24.041, "type": "RIGHT"}, {"time": 24.469, "type": "UP"}, {"time": 24.898, "type": "DOWN"}, {"time": 25.327, "type": "UP"}, {"time": 25.755, "type": "LEFT"}, {"time": 26.184, "type": "UP"}, {"time": 26.612, "type": "RIGHT"}, {"time": 27.041, "type": "DOWN"}, {"time": 27.469, "type": "LEFT"}, {"time": 30.898, "type": "LEFT"}, {"time": 34.327, "type": "LEFT"}, {"time": 36.041, "type": "RIGHT"}, {"time": 37.755, "type": "RIGHT"}, {"time": 38.612, "type": "LEFT"}, {"time": 39.47, "type": "RIGHT"}, {"time": 39.898, "type": "LEFT"}, {"time": 40.327, "type": "RIGHT"}, {"time": 40.755, "type": "LEFT"}, {"time": 41.184, "type": "UP"}, {"time": 42.041, "type": "DOWN"}, {"time": 42.47, "type": "UP"}, {"time": 42.684, "type": "DOWN"}, {"time": 42.898, "type": "UP"}, {"time": 43.327, "type": "UP"}, {"time": 43.755, "type": "UP"}, {"time": 44.184, "type": "UP"}, {"time": 44.612, "type": "UP"}, {"time": 44.827, "type": "DOWN"}, {"time": 45.041, "type": "UP"}, {"time": 45.255, "type": "DOWN"}, {"time": 45.47, "type": "RIGHT"}, {"time": 45.898, "type": "DOWN"}, {"time": 46.112, "type": "UP"}, {"time": 46.327, "type": "DOWN"}, {"time": 46.541, "type": "DOWN"}, {"time": 46.755, "type": "UP"}, {"time": 46.97, "type": "UP"}, {"time": 47.184, "type": "LEFT"}, {"time": 47.612, "type": "LEFT"}, {"time": 47.827, "type": "RIGHT"}, {"time": 48.041, "type": "LEFT"}, {"time": 48.256, "type": "RIGHT"}, {"time": 48.47, "type": "LEFT"}, {"time": 48.685, "type": "RIGHT"}, {"time": 48.898, "type": "UP"}, {"time": 49.327, "type": "UP"}, {"time": 49.541, "type": "RIGHT"}, {"time": 49.755, "type": "UP"}, {"time": 49.969, "type": "RIGHT"}, {"time": 50.184, "type": "DOWN"}, {"time": 50.398, "type": "RIGHT"}, {"time": 50.612, "type": "DOWN"}, {"time": 51.041, "type": "UP"}, {"time": 51.255, "type": "RIGHT"}, {"time": 51.47, "type": "DOWN"}, {"time": 51.684, "type": "RIGHT"}, {"time": 51.898, "type": "UP"}, {"time": 52.112, "type": "RIGHT"}, {"time": 52.327, "type": "DOWN"}, {"time": 52.755, "type": "UP"}, {"time": 52.969, "type": "RIGHT"}, {"time": 53.184, "type": "DOWN"}, {"time": 53.398, "type": "UP"}, {"time": 53.612, "type": "RIGHT"}, {"time": 53.827, "type": "DOWN"}, {"time": 54.041, "type": "UP"}, {"time": 54.47, "type": "UP"}, {"time": 54.684, "type": "UP_RIGHT"}, {"time": 54.898, "type": "UP"}, {"time": 55.112, "type": "UP_LEFT"}, {"time": 55.327, "type": "UP"}, {"time": 55.541, "type": "UP_RIGHT"}, {"time": 55.755, "type": "UP"}, {"time": 56.184, "type": "UP"}, {"time": 56.398, "type": "UP"}, {"time": 56.612, "type": "DOWN"}, {"time": 56.827, "type": "DOWN"}, {"time": 57.041, "type": "UP"}, {"time": 57.255, "type": "UP"}, {"time": 57.47, "type": "DOWN"}, {"time": 57.898, "type": "LEFT"}, {"time": 58.112, "type": "LEFT"}, {"time": 58.327, "type": "LEFT"}, {"time": 58.541, "type": "RIGHT"}, {"time": 58.755, "type": "RIGHT"}, {"time": 58.97, "type": "RIGHT"}, {"time": 59.184, "type": "REVERSE"}, {"time": 59.612, "type": "DOWN"}, {"time": 59.826, "type": "UP"}, {"time": 60.041, "type": "DOWN"}, {"time": 60.255, "type": "DOWN"}, {"time": 60.469, "type": "UP"}, {"time": 60.684, "type": "UP"}, {"time": 60.898, "type": "LEFT"}, {"time": 61.326, "type": "LEFT"}, {"time": 61.541, "type": "RIGHT"}, {"time": 61.755, "type": "LEFT"}, {"time": 61.97, "type": "RIGHT"}, {"time": 62.184, "type": "LEFT"}, {"time": 62.399, "type": "RIGHT"}, {"time": 62.612, "type": "UP"}, {"time": 63.041, "type": "UP"}, {"time": 63.255, "type": "RIGHT"}, {"time": 63.469, "type": "UP"}, {"time": 63.683, "type": "RIGHT"}, {"time": 63.898, "type": "DOWN"}, {"time": 64.112, "type": "RIGHT"}, {"time": 64.326, "type": "DOWN"}, {"time": 64.755, "type": "UP"}, {"time": 64.969, "type": "RIGHT"}, {"time": 65.184, "type": "DOWN"}, {"time": 65.398, "type": "RIGHT"}, {"time": 65.612, "type": "UP"}, {"time": 65.826, "type": "RIGHT"}, {"time": 66.041, "type": "DOWN"}, {"time": 66.469, "type": "UP"}, {"time": 66.683, "type": "RIGHT"}, {"time": 66.898, "type": "DOWN"}, {"time": 67.112, "type": "UP"}, {"time": 67.326, "type": "RIGHT"}, {"time": 67.541, "type": "DOWN"}, {"time": 67.755, "type": "UP"}, {"time": 68.184, "type": "UP"}, {"time": 68.398, "type": "UP_RIGHT"}, {"time": 68.612, "type": "UP"}, {"time": 68.826, "type": "UP_LEFT"}, {"time": 69.041, "type": "UP"}, {"time": 69.255, "type": "UP_RIGHT"}, {"time": 69.469, "type": "UP"}, {"time": 69.898, "type": "UP"}, {"time": 70.112, "type": "UP"}, {"time": 70.326, "type": "DOWN"}, {"time": 70.541, "type": "DOWN"}, {"time": 70.755, "type": "UP"}, {"time": 70.969, "type": "UP"}, {"time": 71.184, "type": "DOWN"}, {"time": 71.612, "type": "LEFT"}, {"time": 71.826, "type": "LEFT"}, {"time": 72.041, "type": "REVERSE_BACK"}, {"time": 72.47, "type": "REVERSE"}, {"time": 72.898, "type": "REVERSE_BACK"}, {"time": 73.327, "type": "UP"}, {"time": 73.541, "type": "UP"}, {"time": 73.755, "type": "UP"}, {"time": 74.184, "type": "DOWN"}, {"time": 74.398, "type": "DOWN"}, {"time": 74.612, "type": "UP"}, {"time": 75.041, "type": "RIGHT"}, {"time": 75.255, "type": "LEFT"}, {"time": 75.47, "type": "RIGHT"}, {"time": 75.898, "type": "LEFT"}, {"time": 76.112, "type": "UP"}, {"time": 76.327, "type": "RIGHT"}, {"time": 76.755, "type": "RIGHT"}, {"time": 76.97, "type": "UP"}, {"time": 77.184, "type": "LEFT"}, {"time": 77.612, "type": "REVERSE"}, {"time": 77.827, "type": "UP"}, {"time": 78.041, "type": "RIGHT"}, {"time": 78.47, "type": "LEFT"}, {"time": 78.684, "type": "UP"}, {"time": 78.898, "type": "LEFT"}, {"time": 79.327, "type": "UP"}, {"time": 79.541, "type": "LEFT"}, {"time": 79.755, "type": "UP"}, {"time": 80.184, "type": "UP"}, {"time": 80.398, "type": "RIGHT"}, {"time": 80.612, "type": "UP"}, {"time": 81.041, "type": "RIGHT"}, {"time": 81.255, "type": "DOWN"}, {"time": 81.47, "type": "RIGHT"}, {"time": 81.898, "type": "DOWN"}, {"time": 82.112, "type": "LEFT"}, {"time": 82.327, "type": "DOWN"}, {"time": 82.755, "type": "UP"}, {"time": 82.97, "type": "DOWN"}, {"time": 83.184, "type": "UP"}, {"time": 83.612, "type": "UP_LEFT"}, {"time": 83.827, "type": "UP"}, {"time": 84.041, "type": "UP_RIGHT"}, {"time": 84.47, "type": "UP_RIGHT"}, {"time": 84.684, "type": "UP"}, {"time": 84.898, "type": "UP_LEFT"}, {"time": 85.327, "type": "REVERSE_BACK"}, {"time": 85.541, "type": "RIGHT"}, {"time": 85.755, "type": "LEFT"}, {"time": 86.184, "type": "DOWN"}, {"time": 86.398, "type": "UP"}, {"time": 86.612, "type": "RIGHT"}, {"time": 87.041, "type": "LEFT"}, {"time": 87.255, "type": "UP"}, {"time": 87.469, "type": "LEFT"}, {"time": 87.898, "type": "UP"}, {"time": 88.112, "type": "LEFT"}, {"time": 88.326, "type": "UP"}, {"time": 88.755, "type": "UP"}, {"time": 88.969, "type": "RIGHT"}, {"time": 89.183, "type": "UP"}, {"time": 89.612, "type": "RIGHT"}, {"time": 89.826, "type": "DOWN"}, {"time": 90.041, "type": "RIGHT"}, {"time": 90.469, "type": "DOWN"}, {"time": 90.683, "type": "LEFT"}, {"time": 90.898, "type": "DOWN"}, {"time": 91.326, "type": "UP"}, {"time": 91.541, "type": "DOWN"}, {"time": 91.755, "type": "UP"}, {"time": 92.183, "type": "UP_LEFT"}, {"time": 92.398, "type": "UP"}, {"time": 92.612, "type": "UP_RIGHT"}, {"time": 93.041, "type": "UP_RIGHT"}, {"time": 93.255, "type": "UP"}, {"time": 93.469, "type": "UP_LEFT"}, {"time": 93.898, "type": "LEFT"}, {"time": 94.112, "type": "RIGHT"}, {"time": 94.326, "type": "LEFT"}, {"time": 94.755, "type": "UP"}, {"time": 94.97, "type": "DOWN"}, {"time": 95.184, "type": "UP"}, {"time": 95.612, "type": "DOWN"}, {"time": 95.827, "type": "UP"}, {"time": 96.041, "type": "DOWN"}, {"time": 96.47, "type": "RIGHT"}, {"time": 96.684, "type": "LEFT"}, {"time": 96.899, "type": "RIGHT"}, {"time": 97.327, "type": "LEFT"}, {"time": 97.541, "type": "UP"}, {"time": 97.756, "type": "RIGHT"}, {"time": 98.184, "type": "RIGHT"}, {"time": 98.399, "type": "UP"}, {"time": 98.613, "type": "LEFT"}, {"time": 99.041, "type": "RIGHT"}, {"time": 99.255, "type": "DOWN"}, {"time": 99.47, "type": "RIGHT"}, {"time": 99.684, "type": "UP"}, {"time": 99.898, "type": "DOWN"}, {"time": 100.112, "type": "UP"}, {"time": 100.327, "type": "DOWN"}], "events": [{"time": 0.577, "type": "BG_COLOR", "duration": 2.893, "color": "#000c22"}, {"time": 6.898, "type": "BG_COLOR", "duration": 6.75, "color": "#62a0ea"}, {"time": 12.952, "type": "NOTES_BOUNCE_ON"}, {"time": 13.648, "type": "NOTE_PUSH_ON"}, {"time": 13.755, "type": "FLASH"}, {"time": 13.755, "type": "BG_COLOR", "color": "#ff00f7"}, {"time": 27.255, "type": "BG_COLOR", "duration": 13.875, "color": "#320037"}, {"time": 27.47, "type": "FLASH"}, {"time": 27.47, "type": "NOTES_BOUNCE_OFF"}, {"time": 41.184, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 43.755, "type": "BG_COLOR", "duration": 0.857, "color": "#ffffff"}, {"time": 44.612, "type": "FLASH"}, {"time": 44.612, "type": "BG_COLOR", "color": "#000000"}, {"time": 44.612, "type": "FX_RGB_SPLIT", "duration": 55.715}, {"time": 45.47, "type": "FLASH"}, {"time": 45.47, "type": "SHAKE"}, {"time": 46.327, "type": "SHAKE"}, {"time": 47.184, "type": "SHAKE"}, {"time": 47.184, "type": "FLASH"}, {"time": 48.041, "type": "SHAKE"}, {"time": 48.898, "type": "FLASH"}, {"time": 48.898, "type": "SHAKE"}, {"time": 49.755, "type": "SHAKE"}, {"time": 50.612, "type": "SHAKE"}, {"time": 50.612, "type": "FLASH"}, {"time": 51.47, "type": "SHAKE"}, {"time": 52.327, "type": "FLASH"}, {"time": 52.327, "type": "SHAKE"}, {"time": 53.184, "type": "SHAKE"}, {"time": 54.042, "type": "FLASH"}, {"time": 54.042, "type": "SHAKE"}, {"time": 54.899, "type": "SHAKE"}, {"time": 55.756, "type": "SHAKE"}, {"time": 55.756, "type": "FLASH"}, {"time": 56.613, "type": "SHAKE"}, {"time": 57.47, "type": "FLASH"}, {"time": 57.47, "type": "SHAKE"}, {"time": 58.327, "type": "SHAKE"}, {"time": 59.184, "type": "NOTES_FLOW_RIGHT"}, {"time": 59.184, "type": "SHAKE"}, {"time": 59.184, "type": "FLASH"}, {"time": 60.042, "type": "SHAKE"}, {"time": 60.899, "type": "FLASH"}, {"time": 60.899, "type": "SHAKE"}, {"time": 61.756, "type": "SHAKE"}, {"time": 62.613, "type": "FLASH"}, {"time": 62.613, "type": "SHAKE"}, {"time": 63.47, "type": "FLASH"}, {"time": 63.47, "type": "SHAKE"}, {"time": 64.327, "type": "SHAKE"}, {"time": 65.184, "type": "SHAKE"}, {"time": 65.184, "type": "FLASH"}, {"time": 66.041, "type": "SHAKE"}, {"time": 66.898, "type": "FLASH"}, {"time": 66.898, "type": "SHAKE"}, {"time": 67.755, "type": "SHAKE"}, {"time": 68.612, "type": "SHAKE"}, {"time": 68.612, "type": "FLASH"}, {"time": 69.47, "type": "SHAKE"}, {"time": 70.327, "type": "FLASH"}, {"time": 70.327, "type": "SHAKE"}, {"time": 71.184, "type": "SHAKE"}, {"time": 72.041, "type": "NOTES_FLOW_LEFT"}, {"time": 72.041, "type": "FLASH"}, {"time": 72.041, "type": "SHAKE"}, {"time": 72.47, "type": "NOTES_FLOW_RIGHT"}, {"time": 72.898, "type": "NOTES_FLOW_LEFT"}, {"time": 73.755, "type": "FLASH"}, {"time": 73.755, "type": "SHAKE"}, {"time": 74.612, "type": "SHAKE"}, {"time": 75.469, "type": "SHAKE"}, {"time": 75.469, "type": "FLASH"}, {"time": 76.326, "type": "SHAKE"}, {"time": 77.183, "type": "FLASH"}, {"time": 77.183, "type": "SHAKE"}, {"time": 77.612, "type": "NOTES_FLOW_RIGHT"}, {"time": 78.04, "type": "SHAKE"}, {"time": 78.897, "type": "SHAKE"}, {"time": 78.897, "type": "FLASH"}, {"time": 79.755, "type": "SHAKE"}, {"time": 80.612, "type": "FLASH"}, {"time": 80.612, "type": "SHAKE"}, {"time": 81.469, "type": "SHAKE"}, {"time": 82.326, "type": "FLASH"}, {"time": 82.326, "type": "SHAKE"}, {"time": 83.184, "type": "FLASH"}, {"time": 83.184, "type": "SHAKE"}, {"time": 84.041, "type": "SHAKE"}, {"time": 84.898, "type": "SHAKE"}, {"time": 84.898, "type": "FLASH"}, {"time": 85.327, "type": "NOTES_FLOW_LEFT"}, {"time": 85.755, "type": "SHAKE"}, {"time": 86.612, "type": "FLASH"}, {"time": 86.612, "type": "SHAKE"}, {"time": 87.469, "type": "SHAKE"}, {"time": 88.326, "type": "SHAKE"}, {"time": 88.326, "type": "FLASH"}, {"time": 89.184, "type": "SHAKE"}, {"time": 90.041, "type": "FLASH"}, {"time": 90.041, "type": "SHAKE"}, {"time": 90.898, "type": "SHAKE"}, {"time": 91.755, "type": "FLASH"}, {"time": 91.755, "type": "SHAKE"}, {"time": 92.559, "type": "FLASH"}, {"time": 92.559, "type": "SHAKE"}, {"time": 93.416, "type": "SHAKE"}, {"time": 94.273, "type": "SHAKE"}, {"time": 94.273, "type": "FLASH"}, {"time": 95.13, "type": "SHAKE"}, {"time": 95.987, "type": "FLASH"}, {"time": 95.987, "type": "SHAKE"}, {"time": 96.844, "type": "SHAKE"}, {"time": 97.701, "type": "SHAKE"}, {"time": 97.701, "type": "FLASH"}, {"time": 98.559, "type": "SHAKE"}, {"time": 99.416, "type": "FLASH"}, {"time": 99.416, "type": "SHAKE"}, {"time": 99.898, "type": "FX_GLITCH", "duration": 0.429}, {"time": 100.273, "type": "SHAKE"}, {"time": 100.327, "type": "BLACKOUT", "duration": 5.143}], "audioFile": "track.mp3", "audioFormat": "mp3"}}, "ne khochu cheta": {"folder": "ne khochu cheta", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/ne khochu cheta/track.ogg", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "nkc", "artist": "cranchee", "difficulty": 7.0, "menu_color": "#7a2dbf"}, "chart": {"bpm": 160, "noteTravelTime": 1000, "notes": [{"time": 0.014, "type": "UP"}, {"time": 0.483, "type": "RIGHT"}, {"time": 0.952, "type": "UP"}, {"time": 1.514, "type": "RIGHT"}, {"time": 1.983, "type": "UP"}, {"time": 2.452, "type": "RIGHT"}, {"time": 2.92, "type": "UP"}, {"time": 3.483, "type": "RIGHT"}, {"time": 3.952, "type": "UP"}, {"time": 4.514, "type": "RIGHT"}, {"time": 4.983, "type": "UP"}, {"time": 5.452, "type": "RIGHT"}, {"time": 6.014, "type": "UP"}, {"time": 6.483, "type": "RIGHT"}, {"time": 6.952, "type": "UP"}, {"time": 7.42, "type": "RIGHT"}, {"time": 7.702, "type": "UP"}, {"time": 7.983, "type": "DOWN"}, {"time": 9.014, "type": "UP"}, {"time": 9.483, "type": "RIGHT"}, {"time": 9.952, "type": "DOWN"}, {"time": 11.077, "type": "LEFT"}, {"time": 12.014, "type": "RIGHT"}, {"time": 12.483, "type": "LEFT"}, {"time": 12.952, "type": "UP"}, {"time": 13.42, "type": "DOWN"}, {"time": 13.889, "type": "UP"}, {"time": 14.17, "type": "UP"}, {"time": 14.452, "type": "DOWN"}, {"time": 14.733, "type": "DOWN"}, {"time": 15.014, "type": "RIGHT"}, {"time": 15.483, "type": "LEFT"}, {"time": 15.952, "type": "UP"}, {"time": 16.233, "type": "RIGHT"}, {"time": 16.516, "type": "UP"}, {"time": 16.798, "type": "RIGHT"}, {"time": 17.08, "type": "UP"}, {"time": 17.361, "type": "DOWN"}, {"time": 17.643, "type": "RIGHT"}, {"time": 17.827, "type": "DOWN"}, {"time": 18.014, "type": "RIGHT"}, {"time": 18.202, "type": "UP"}, {"time": 18.389, "type": "DOWN"}, {"time": 18.577, "type": "RIGHT"}, {"time": 18.864, "type": "UP"}, {"time": 19.146, "type": "RIGHT"}, {"time": 19.428, "type": "DOWN"}, {"time": 19.709, "type": "UP"}, {"time": 19.991, "type": "RIGHT"}, {"time": 20.273, "type": "DOWN"}, {"time": 20.555, "type": "RIGHT"}, {"time": 20.837, "type": "UP"}, {"time": 21.118, "type": "RIGHT"}, {"time": 21.4, "type": "DOWN"}, {"time": 21.682, "type": "RIGHT"}, {"time": 21.964, "type": "UP"}, {"time": 22.245, "type": "LEFT"}, {"time": 22.527, "type": "DOWN"}, {"time": 22.809, "type": "LEFT"}, {"time": 23.091, "type": "UP"}, {"time": 23.373, "type": "LEFT"}, {"time": 23.654, "type": "DOWN"}, {"time": 23.936, "type": "RIGHT"}, {"time": 24.218, "type": "DOWN"}, {"time": 24.5, "type": "RIGHT"}, {"time": 24.782, "type": "UP"}, {"time": 25.063, "type": "RIGHT"}, {"time": 25.345, "type": "DOWN"}, {"time": 25.627, "type": "RIGHT"}, {"time": 25.909, "type": "UP"}, {"time": 26.19, "type": "LEFT"}, {"time": 26.472, "type": "DOWN"}, {"time": 26.754, "type": "LEFT"}, {"time": 27.036, "type": "UP"}, {"time": 27.318, "type": "LEFT"}, {"time": 27.599, "type": "DOWN"}, {"time": 27.881, "type": "RIGHT"}, {"time": 28.163, "type": "DOWN"}, {"time": 28.445, "type": "RIGHT"}, {"time": 28.727, "type": "UP"}, {"time": 29.008, "type": "RIGHT"}, {"time": 29.29, "type": "DOWN"}, {"time": 29.572, "type": "RIGHT"}, {"time": 29.854, "type": "UP"}, {"time": 30.135, "type": "LEFT"}, {"time": 30.417, "type": "DOWN"}, {"time": 30.699, "type": "LEFT"}, {"time": 30.981, "type": "UP"}, {"time": 31.263, "type": "LEFT"}, {"time": 31.544, "type": "DOWN"}, {"time": 31.826, "type": "UP"}, {"time": 32.108, "type": "UP"}, {"time": 32.39, "type": "UP"}, {"time": 32.671, "type": "DOWN"}, {"time": 32.953, "type": "DOWN"}, {"time": 33.235, "type": "DOWN"}, {"time": 33.517, "type": "LEFT"}, {"time": 33.798, "type": "RIGHT"}, {"time": 34.08, "type": "UP"}, {"time": 34.362, "type": "DOWN"}, {"time": 34.644, "type": "UP"}, {"time": 34.926, "type": "RIGHT"}, {"time": 35.207, "type": "LEFT"}, {"time": 35.489, "type": "RIGHT"}, {"time": 35.771, "type": "UP"}, {"time": 36.053, "type": "LEFT"}, {"time": 36.334, "type": "UP"}, {"time": 36.616, "type": "RIGHT"}, {"time": 36.898, "type": "UP"}, {"time": 37.18, "type": "LEFT"}, {"time": 37.462, "type": "DOWN"}, {"time": 37.743, "type": "RIGHT"}, {"time": 38.025, "type": "UP"}, {"time": 38.307, "type": "DOWN"}, {"time": 38.589, "type": "UP"}, {"time": 38.87, "type": "DOWN"}, {"time": 39.152, "type": "LEFT"}, {"time": 39.434, "type": "RIGHT"}, {"time": 39.722, "type": "LEFT"}, {"time": 40.004, "type": "RIGHT"}, {"time": 40.185, "type": "UP"}, {"time": 40.373, "type": "RIGHT"}, {"time": 40.561, "type": "UP"}, {"time": 40.749, "type": "RIGHT"}, {"time": 40.937, "type": "UP"}, {"time": 41.125, "type": "RIGHT"}, {"time": 41.313, "type": "UP"}, {"time": 41.501, "type": "RIGHT"}, {"time": 41.688, "type": "UP"}, {"time": 41.876, "type": "RIGHT"}, {"time": 42.064, "type": "DOWN"}, {"time": 42.252, "type": "RIGHT"}, {"time": 42.44, "type": "DOWN"}, {"time": 42.628, "type": "RIGHT"}, {"time": 42.815, "type": "DOWN"}, {"time": 43.003, "type": "RIGHT"}, {"time": 43.191, "type": "DOWN"}, {"time": 43.379, "type": "RIGHT"}, {"time": 43.567, "type": "DOWN"}, {"time": 43.755, "type": "RIGHT"}, {"time": 43.942, "type": "DOWN"}, {"time": 44.13, "type": "RIGHT"}, {"time": 44.318, "type": "UP"}, {"time": 44.506, "type": "RIGHT"}, {"time": 44.694, "type": "UP"}, {"time": 44.882, "type": "RIGHT"}, {"time": 45.07, "type": "UP"}, {"time": 45.257, "type": "RIGHT"}, {"time": 45.445, "type": "UP"}, {"time": 45.633, "type": "RIGHT"}, {"time": 45.821, "type": "UP"}, {"time": 47.981, "type": "UP"}, {"time": 48.263, "type": "RIGHT"}, {"time": 48.733, "type": "RIGHT"}, {"time": 48.921, "type": "DOWN"}, {"time": 49.108, "type": "RIGHT"}, {"time": 49.296, "type": "DOWN"}, {"time": 49.484, "type": "UP"}, {"time": 49.672, "type": "RIGHT"}, {"time": 49.86, "type": "UP"}, {"time": 50.048, "type": "RIGHT"}, {"time": 50.329, "type": "DOWN"}, {"time": 50.705, "type": "RIGHT"}, {"time": 50.987, "type": "UP_RIGHT"}, {"time": 51.269, "type": "RIGHT"}, {"time": 51.55, "type": "DOWN_RIGHT"}, {"time": 51.832, "type": "UP"}, {"time": 52.114, "type": "REVERSE"}, {"time": 52.584, "type": "REVERSE_BACK"}, {"time": 53.053, "type": "REVERSE"}, {"time": 53.617, "type": "REVERSE_BACK"}, {"time": 53.993, "type": "REVERSE"}, {"time": 54.18, "type": "UP"}, {"time": 54.462, "type": "DOWN"}, {"time": 54.744, "type": "RIGHT"}, {"time": 55.026, "type": "UP"}, {"time": 55.307, "type": "UP"}, {"time": 55.495, "type": "DOWN"}, {"time": 55.683, "type": "RIGHT"}, {"time": 55.871, "type": "REVERSE_BACK"}, {"time": 56.153, "type": "RIGHT"}, {"time": 56.623, "type": "RIGHT"}, {"time": 56.811, "type": "DOWN"}, {"time": 56.998, "type": "RIGHT"}, {"time": 57.186, "type": "DOWN"}, {"time": 57.374, "type": "UP"}, {"time": 57.562, "type": "RIGHT"}, {"time": 57.75, "type": "UP"}, {"time": 57.938, "type": "RIGHT"}, {"time": 58.219, "type": "DOWN"}, {"time": 58.595, "type": "RIGHT"}, {"time": 58.877, "type": "UP_RIGHT"}, {"time": 59.159, "type": "RIGHT"}, {"time": 59.44, "type": "DOWN_RIGHT"}, {"time": 59.722, "type": "REVERSE"}, {"time": 60.379, "type": "REVERSE_BACK"}, {"time": 60.943, "type": "REVERSE"}, {"time": 61.507, "type": "REVERSE_BACK"}, {"time": 61.976, "type": "UP"}, {"time": 62.164, "type": "UP"}, {"time": 62.446, "type": "DOWN"}, {"time": 62.728, "type": "RIGHT"}, {"time": 63.01, "type": "UP"}, {"time": 63.291, "type": "UP"}, {"time": 63.479, "type": "DOWN"}, {"time": 63.667, "type": "RIGHT"}, {"time": 63.855, "type": "REVERSE"}, {"time": 64.043, "type": "DOWN"}, {"time": 64.325, "type": "RIGHT"}, {"time": 64.794, "type": "LEFT"}, {"time": 64.982, "type": "UP"}, {"time": 65.17, "type": "RIGHT"}, {"time": 65.358, "type": "UP"}, {"time": 65.545, "type": "DOWN"}, {"time": 65.733, "type": "LEFT"}, {"time": 65.921, "type": "DOWN"}, {"time": 66.11, "type": "RIGHT"}, {"time": 66.391, "type": "UP"}, {"time": 66.766, "type": "LEFT"}, {"time": 67.049, "type": "UP_RIGHT"}, {"time": 67.331, "type": "RIGHT"}, {"time": 67.612, "type": "DOWN_RIGHT"}, {"time": 67.8, "type": "DOWN"}, {"time": 67.988, "type": "REVERSE_BACK"}, {"time": 68.551, "type": "REVERSE"}, {"time": 69.021, "type": "REVERSE_BACK"}, {"time": 69.49, "type": "REVERSE"}, {"time": 70.054, "type": "REVERSE_BACK"}, {"time": 70.242, "type": "UP"}, {"time": 70.524, "type": "UP"}, {"time": 70.805, "type": "DOWN"}, {"time": 71.087, "type": "RIGHT"}, {"time": 71.369, "type": "DOWN"}, {"time": 71.651, "type": "LEFT"}, {"time": 71.932, "type": "DOWN"}, {"time": 72.308, "type": "RIGHT"}, {"time": 72.778, "type": "RIGHT"}, {"time": 72.966, "type": "DOWN"}, {"time": 73.153, "type": "RIGHT"}, {"time": 73.341, "type": "DOWN"}, {"time": 73.529, "type": "UP"}, {"time": 73.717, "type": "RIGHT"}, {"time": 73.905, "type": "UP"}, {"time": 74.093, "type": "RIGHT"}, {"time": 74.374, "type": "DOWN"}, {"time": 74.75, "type": "RIGHT"}, {"time": 75.032, "type": "UP_RIGHT"}, {"time": 75.314, "type": "RIGHT"}, {"time": 75.595, "type": "DOWN_RIGHT"}, {"time": 75.877, "type": "UP"}, {"time": 76.065, "type": "REVERSE"}, {"time": 76.535, "type": "REVERSE_BACK"}, {"time": 77.004, "type": "REVERSE"}, {"time": 77.568, "type": "REVERSE_BACK"}, {"time": 78.038, "type": "DOWN"}, {"time": 78.319, "type": "RIGHT"}, {"time": 78.601, "type": "RIGHT"}, {"time": 78.883, "type": "DOWN"}, {"time": 79.165, "type": "UP"}, {"time": 79.446, "type": "DOWN"}, {"time": 80.01, "type": "UP"}, {"time": 80.574, "type": "RIGHT"}, {"time": 81.043, "type": "DOWN"}, {"time": 81.513, "type": "DOWN"}, {"time": 81.982, "type": "UP"}, {"time": 82.452, "type": "RIGHT"}, {"time": 82.922, "type": "DOWN"}, {"time": 83.485, "type": "LEFT"}, {"time": 84.049, "type": "RIGHT"}, {"time": 84.519, "type": "LEFT"}, {"time": 84.988, "type": "RIGHT"}, {"time": 85.458, "type": "LEFT"}, {"time": 85.927, "type": "DOWN"}, {"time": 86.209, "type": "RIGHT"}, {"time": 86.491, "type": "UP"}, {"time": 86.773, "type": "LEFT"}, {"time": 87.055, "type": "DOWN"}, {"time": 87.524, "type": "UP"}, {"time": 88.088, "type": "RIGHT"}, {"time": 88.557, "type": "DOWN"}, {"time": 89.027, "type": "DOWN"}, {"time": 89.496, "type": "UP"}, {"time": 89.966, "type": "RIGHT"}, {"time": 90.436, "type": "DOWN"}, {"time": 90.999, "type": "LEFT"}, {"time": 91.563, "type": "RIGHT"}, {"time": 92.033, "type": "LEFT"}, {"time": 92.502, "type": "RIGHT"}, {"time": 92.972, "type": "LEFT"}, {"time": 93.441, "type": "DOWN"}, {"time": 93.723, "type": "RIGHT"}, {"time": 94.005, "type": "UP"}, {"time": 94.287, "type": "LEFT"}, {"time": 94.569, "type": "DOWN"}, {"time": 95.038, "type": "UP"}, {"time": 95.508, "type": "DOWN"}], "events": [{"time": 0, "type": "HUD_HIDE"}, {"time": 15.967, "type": "FLASH"}, {"time": 15.967, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 15.967, "type": "HUD_SHOW"}, {"time": 15.967, "type": "BG_COLOR", "color": "#000000"}, {"time": 15.967, "type": "FX_OLD_TV", "duration": 64.125}, {"time": 39.967, "type": "FLASH"}, {"time": 41.842, "type": "FLASH"}, {"time": 44.092, "type": "FLASH"}, {"time": 45.873, "type": "BLACKOUT", "duration": 1.875}, {"time": 47.743, "type": "CAMERA_BOB_ON"}, {"time": 52.114, "type": "NOTES_FLOW_RIGHT"}, {"time": 52.584, "type": "NOTES_FLOW_LEFT"}, {"time": 53.053, "type": "NOTES_FLOW_RIGHT"}, {"time": 53.617, "type": "NOTES_FLOW_LEFT"}, {"time": 53.993, "type": "NOTES_FLOW_RIGHT"}, {"time": 55.871, "type": "NOTES_FLOW_LEFT"}, {"time": 55.904, "type": "FLASH"}, {"time": 55.904, "type": "FX_INVERT", "duration": 7.969}, {"time": 59.722, "type": "NOTES_FLOW_RIGHT"}, {"time": 60.379, "type": "NOTES_FLOW_LEFT"}, {"time": 60.943, "type": "NOTES_FLOW_RIGHT"}, {"time": 61.507, "type": "NOTES_FLOW_LEFT"}, {"time": 63.855, "type": "NOTES_FLOW_RIGHT"}, {"time": 63.873, "type": "FLASH"}, {"time": 67.988, "type": "NOTES_FLOW_LEFT"}, {"time": 68.551, "type": "NOTES_FLOW_RIGHT"}, {"time": 69.021, "type": "NOTES_FLOW_LEFT"}, {"time": 69.49, "type": "NOTES_FLOW_RIGHT"}, {"time": 70.054, "type": "NOTES_FLOW_LEFT"}, {"time": 71.976, "type": "FLASH"}, {"time": 71.976, "type": "FX_INVERT", "duration": 8.078}, {"time": 76.065, "type": "NOTES_FLOW_RIGHT"}, {"time": 76.535, "type": "NOTES_FLOW_LEFT"}, {"time": 77.004, "type": "NOTES_FLOW_RIGHT"}, {"time": 77.568, "type": "NOTES_FLOW_LEFT"}, {"time": 79.584, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 80.054, "type": "FLASH"}, {"time": 80.054, "type": "CAMERA_BOB_OFF"}, {"time": 80.092, "type": "BG_COLOR", "duration": 15.945, "color": "#62a0ea"}, {"time": 96.021, "type": "BLACKOUT", "duration": 2.161}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "sardelka": {"folder": "sardelka", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/sardelka/track.mp3", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "sardelka", "artist": "Arvicheskyy", "difficulty": 4.0, "menu_color": "#00ffd5"}, "chart": {"bpm": 160, "noteTravelTime": 1000, "gridOffset": 0.044, "timing": [{"time": 0.044, "bpm": 160}], "notes": [{"time": 3.044, "type": "UP"}, {"time": 6.034, "type": "DOWN"}, {"time": 9.044, "type": "UP"}, {"time": 12.044, "type": "UP"}, {"time": 13.544, "type": "RIGHT"}, {"time": 15.044, "type": "DOWN"}, {"time": 16.544, "type": "LEFT"}, {"time": 18.044, "type": "UP"}, {"time": 18.419, "type": "DOWN"}, {"time": 18.794, "type": "UP"}, {"time": 19.169, "type": "DOWN"}, {"time": 19.544, "type": "UP"}, {"time": 19.919, "type": "DOWN"}, {"time": 20.294, "type": "UP"}, {"time": 20.669, "type": "DOWN"}, {"time": 21.044, "type": "UP"}, {"time": 21.419, "type": "DOWN"}, {"time": 21.794, "type": "UP"}, {"time": 22.169, "type": "DOWN"}, {"time": 22.544, "type": "UP"}, {"time": 22.919, "type": "DOWN"}, {"time": 23.294, "type": "UP"}, {"time": 23.669, "type": "DOWN"}, {"time": 24.044, "type": "UP"}, {"time": 24.402, "type": "UP"}, {"time": 24.794, "type": "UP"}, {"time": 25.169, "type": "UP"}, {"time": 25.544, "type": "UP"}, {"time": 25.919, "type": "RIGHT"}, {"time": 26.294, "type": "UP"}, {"time": 26.669, "type": "UP_RIGHT"}, {"time": 27.044, "type": "UP"}, {"time": 27.419, "type": "UP_LEFT"}, {"time": 27.794, "type": "UP"}, {"time": 27.962, "type": "UP"}, {"time": 28.169, "type": "DOWN"}, {"time": 28.294, "type": "UP"}, {"time": 28.544, "type": "DOWN"}, {"time": 28.919, "type": "LEFT"}, {"time": 29.294, "type": "UP"}, {"time": 29.669, "type": "RIGHT"}, {"time": 30.044, "type": "DOWN"}, {"time": 30.419, "type": "LEFT"}, {"time": 30.794, "type": "RIGHT"}, {"time": 31.169, "type": "DOWN"}, {"time": 31.544, "type": "REVERSE"}, {"time": 31.919, "type": "RIGHT"}, {"time": 32.294, "type": "UP"}, {"time": 32.669, "type": "DOWN"}, {"time": 33.044, "type": "LEFT"}, {"time": 33.419, "type": "RIGHT"}, {"time": 33.794, "type": "UP"}, {"time": 34.169, "type": "DOWN"}, {"time": 34.544, "type": "UP"}, {"time": 34.919, "type": "RIGHT"}, {"time": 35.294, "type": "LEFT"}, {"time": 35.669, "type": "UP"}, {"time": 36.044, "type": "LEFT"}, {"time": 36.419, "type": "RIGHT"}, {"time": 36.794, "type": "UP"}, {"time": 37.169, "type": "DOWN"}, {"time": 37.544, "type": "REVERSE_BACK"}, {"time": 38.107, "type": "UP"}, {"time": 38.669, "type": "DOWN"}, {"time": 39.044, "type": "RIGHT"}, {"time": 39.419, "type": "UP"}, {"time": 39.794, "type": "DOWN"}, {"time": 40.169, "type": "UP"}, {"time": 40.544, "type": "REVERSE"}, {"time": 41.107, "type": "UP"}, {"time": 41.669, "type": "RIGHT"}, {"time": 42.044, "type": "UP"}, {"time": 42.419, "type": "DOWN"}, {"time": 42.794, "type": "UP"}, {"time": 43.169, "type": "DOWN"}, {"time": 43.544, "type": "REVERSE_BACK"}, {"time": 44.107, "type": "UP"}, {"time": 44.669, "type": "RIGHT"}, {"time": 45.044, "type": "LEFT"}, {"time": 45.419, "type": "UP_RIGHT"}, {"time": 45.794, "type": "UP"}, {"time": 46.169, "type": "DOWN"}, {"time": 46.544, "type": "RIGHT"}, {"time": 47.107, "type": "RIGHT"}, {"time": 47.669, "type": "UP"}, {"time": 48.044, "type": "DOWN"}, {"time": 48.419, "type": "UP_LEFT"}, {"time": 48.794, "type": "UP_RIGHT"}, {"time": 49.169, "type": "UP"}, {"time": 49.544, "type": "UP"}, {"time": 49.919, "type": "DOWN"}, {"time": 50.294, "type": "UP"}, {"time": 50.669, "type": "DOWN"}, {"time": 51.044, "type": "RIGHT"}, {"time": 51.419, "type": "LEFT"}, {"time": 51.794, "type": "RIGHT"}, {"time": 52.169, "type": "LEFT"}, {"time": 52.544, "type": "UP"}, {"time": 52.919, "type": "DOWN"}, {"time": 53.294, "type": "UP"}, {"time": 53.669, "type": "DOWN"}, {"time": 54.044, "type": "REVERSE"}, {"time": 54.419, "type": "LEFT"}, {"time": 54.794, "type": "RIGHT"}, {"time": 55.169, "type": "LEFT"}, {"time": 55.544, "type": "UP_RIGHT"}, {"time": 55.919, "type": "UP_LEFT"}, {"time": 56.294, "type": "UP_RIGHT"}, {"time": 56.669, "type": "UP_LEFT"}, {"time": 57.044, "type": "DOWN_LEFT"}, {"time": 57.419, "type": "DOWN_RIGHT"}, {"time": 57.794, "type": "DOWN_LEFT"}, {"time": 58.169, "type": "DOWN_RIGHT"}, {"time": 58.544, "type": "LEFT"}, {"time": 58.919, "type": "UP"}, {"time": 59.294, "type": "RIGHT"}, {"time": 59.669, "type": "UP"}, {"time": 60.044, "type": "LEFT"}, {"time": 60.419, "type": "UP"}, {"time": 60.794, "type": "RIGHT"}, {"time": 61.169, "type": "UP"}, {"time": 61.544, "type": "REVERSE_BACK"}, {"time": 61.919, "type": "UP"}, {"time": 62.294, "type": "DOWN"}, {"time": 62.669, "type": "UP"}, {"time": 63.044, "type": "RIGHT"}, {"time": 63.419, "type": "LEFT"}, {"time": 63.794, "type": "RIGHT"}, {"time": 64.169, "type": "LEFT"}, {"time": 64.544, "type": "UP"}, {"time": 64.919, "type": "DOWN"}, {"time": 65.294, "type": "UP"}, {"time": 65.669, "type": "DOWN"}, {"time": 66.044, "type": "RIGHT"}, {"time": 66.419, "type": "LEFT"}, {"time": 66.794, "type": "RIGHT"}, {"time": 67.169, "type": "LEFT"}, {"time": 67.544, "type": "UP_RIGHT"}, {"time": 67.919, "type": "UP_LEFT"}, {"time": 68.294, "type": "UP_RIGHT"}, {"time": 68.669, "type": "UP_LEFT"}, {"time": 69.044, "type": "DOWN_LEFT"}, {"time": 69.544, "type": "DOWN_RIGHT"}, {"time": 69.982, "type": "DOWN_LEFT"}, {"time": 70.419, "type": "DOWN_RIGHT"}, {"time": 70.919, "type": "DOWN"}, {"time": 71.419, "type": "UP"}, {"time": 71.919, "type": "DOWN"}, {"time": 72.419, "type": "UP"}, {"time": 73.044, "type": "DOWN"}, {"time": 73.544, "type": "UP"}, {"time": 74.044, "type": "DOWN"}, {"time": 74.544, "type": "UP"}, {"time": 75.044, "type": "DOWN"}, {"time": 75.669, "type": "UP"}, {"time": 76.294, "type": "RIGHT"}, {"time": 76.857, "type": "RIGHT"}, {"time": 77.419, "type": "DOWN"}, {"time": 78.107, "type": "RIGHT"}, {"time": 78.669, "type": "UP"}, {"time": 79.243, "type": "UP"}, {"time": 79.544, "type": "DOWN"}, {"time": 79.919, "type": "REVERSE"}, {"time": 80.482, "type": "UP"}, {"time": 80.982, "type": "LEFT"}, {"time": 81.544, "type": "DOWN"}, {"time": 81.794, "type": "UP"}, {"time": 82.044, "type": "DOWN"}, {"time": 82.919, "type": "UP"}, {"time": 83.232, "type": "UP"}, {"time": 83.482, "type": "DOWN"}, {"time": 84.044, "type": "LEFT"}, {"time": 84.357, "type": "RIGHT"}, {"time": 84.669, "type": "LEFT"}, {"time": 85.294, "type": "UP"}, {"time": 85.919, "type": "DOWN"}, {"time": 86.419, "type": "LEFT"}, {"time": 87.044, "type": "UP"}, {"time": 87.669, "type": "DOWN"}, {"time": 88.232, "type": "RIGHT"}, {"time": 88.794, "type": "UP"}, {"time": 89.107, "type": "UP"}, {"time": 89.482, "type": "DOWN"}, {"time": 90.044, "type": "UP_RIGHT"}, {"time": 90.669, "type": "DOWN_RIGHT"}, {"time": 91.169, "type": "REVERSE_BACK"}, {"time": 91.419, "type": "REVERSE"}, {"time": 91.732, "type": "REVERSE_BACK"}, {"time": 92.294, "type": "REVERSE"}, {"time": 92.669, "type": "REVERSE_BACK"}, {"time": 93.044, "type": "UP"}, {"time": 93.669, "type": "REVERSE"}, {"time": 93.919, "type": "REVERSE_BACK"}, {"time": 94.357, "type": "UP"}, {"time": 94.919, "type": "UP_RIGHT"}, {"time": 95.482, "type": "RIGHT"}, {"time": 96.107, "type": "DOWN_RIGHT"}, {"time": 96.669, "type": "UP_RIGHT"}, {"time": 97.232, "type": "UP"}, {"time": 97.919, "type": "DOWN"}, {"time": 98.419, "type": "UP"}, {"time": 98.732, "type": "DOWN"}, {"time": 99.044, "type": "REVERSE"}, {"time": 99.607, "type": "LEFT"}, {"time": 100.232, "type": "UP"}, {"time": 100.794, "type": "UP_RIGHT"}, {"time": 101.107, "type": "UP_LEFT"}, {"time": 101.44, "type": "DOWN"}, {"time": 102.044, "type": "DOWN_LEFT"}, {"time": 102.357, "type": "DOWN_RIGHT"}, {"time": 102.669, "type": "DOWN"}, {"time": 103.232, "type": "UP"}, {"time": 103.482, "type": "DOWN"}, {"time": 103.794, "type": "REVERSE_BACK"}, {"time": 104.482, "type": "UP_RIGHT"}, {"time": 105.044, "type": "RIGHT"}, {"time": 105.607, "type": "DOWN_RIGHT"}, {"time": 106.357, "type": "UP_RIGHT"}, {"time": 106.919, "type": "UP"}, {"time": 107.482, "type": "DOWN"}, {"time": 108.044, "type": "UP"}, {"time": 108.419, "type": "UP_RIGHT"}, {"time": 108.794, "type": "LEFT"}, {"time": 109.357, "type": "RIGHT"}, {"time": 109.919, "type": "UP"}, {"time": 110.294, "type": "DOWN"}, {"time": 110.544, "type": "UP"}, {"time": 110.794, "type": "DOWN"}, {"time": 111.607, "type": "UP"}, {"time": 111.982, "type": "RIGHT"}, {"time": 112.357, "type": "DOWN"}, {"time": 112.857, "type": "UP"}, {"time": 113.107, "type": "DOWN"}, {"time": 113.357, "type": "UP"}, {"time": 114.044, "type": "UP"}, {"time": 114.607, "type": "UP"}, {"time": 115.169, "type": "UP"}, {"time": 115.919, "type": "UP"}], "events": [{"time": 0, "type": "BG_COLOR", "duration": 25.544, "color": "#99c1f1"}, {"time": 12.044, "type": "FLASH"}, {"time": 16.669, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 24.044, "type": "FLASH"}, {"time": 24.044, "type": "SHAKE"}, {"time": 25.544, "type": "FLASH"}, {"time": 25.544, "type": "CAMERA_BOB_ON"}, {"time": 27.044, "type": "FLASH"}, {"time": 28.544, "type": "FLASH"}, {"time": 30.044, "type": "FLASH"}, {"time": 31.169, "type": "FLASH"}, {"time": 31.544, "type": "FLASH"}, {"time": 31.544, "type": "NOTES_FLOW_RIGHT"}, {"time": 33.794, "type": "FLASH"}, {"time": 34.169, "type": "FLASH"}, {"time": 34.544, "type": "FLASH"}, {"time": 37.544, "type": "FLASH"}, {"time": 37.544, "type": "CAMERA_BOB_OFF"}, {"time": 37.544, "type": "NOTES_FLOW_LEFT"}, {"time": 37.544, "type": "BG_COLOR", "color": "#1c71d8"}, {"time": 40.544, "type": "NOTES_FLOW_RIGHT"}, {"time": 43.544, "type": "NOTES_FLOW_LEFT"}, {"time": 49.294, "type": "FLASH"}, {"time": 49.294, "type": "HUD_HIDE"}, {"time": 49.294, "type": "BG_COLOR", "color": "#813d9c"}, {"time": 49.419, "type": "NOTES_BOUNCE_ON"}, {"time": 49.544, "type": "NOTE_SPEED", "speed": 1}, {"time": 49.794, "type": "NOTES_BOUNCE_ON"}, {"time": 50.544, "type": "FLASH"}, {"time": 52.169, "type": "FLASH"}, {"time": 53.669, "type": "FLASH"}, {"time": 54.044, "type": "NOTES_FLOW_RIGHT"}, {"time": 55.169, "type": "FLASH"}, {"time": 56.669, "type": "FLASH"}, {"time": 58.169, "type": "FLASH"}, {"time": 59.669, "type": "FLASH"}, {"time": 61.169, "type": "FLASH"}, {"time": 61.544, "type": "NOTES_FLOW_LEFT"}, {"time": 61.544, "type": "FLASH"}, {"time": 61.544, "type": "CAMERA_BOB_ON"}, {"time": 69.044, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 69.044, "type": "BG_COLOR", "duration": 6, "color": "#241f31"}, {"time": 70.915, "type": "NOTE_SPEED", "speed": 0.5}, {"time": 70.915, "type": "CAMERA_BOB_OFF"}, {"time": 70.915, "type": "HUD_SHOW"}, {"time": 70.919, "type": "FLASH"}, {"time": 70.919, "type": "NOTES_BOUNCE_OFF"}, {"time": 75.044, "type": "FLASH"}, {"time": 75.044, "type": "FX_GLITCH", "duration": 18.875}, {"time": 75.169, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 79.294, "type": "FX_INVERT", "duration": 14.625}, {"time": 79.919, "type": "NOTES_FLOW_RIGHT"}, {"time": 91.169, "type": "NOTES_FLOW_LEFT"}, {"time": 91.419, "type": "NOTES_FLOW_RIGHT"}, {"time": 91.732, "type": "NOTES_FLOW_LEFT"}, {"time": 92.294, "type": "NOTES_FLOW_RIGHT"}, {"time": 92.669, "type": "NOTES_FLOW_LEFT"}, {"time": 93.669, "type": "NOTES_FLOW_RIGHT"}, {"time": 93.919, "type": "NOTES_FLOW_LEFT"}, {"time": 93.919, "type": "FLASH"}, {"time": 93.919, "type": "CAMERA_BOB_ON"}, {"time": 98.419, "type": "FLASH"}, {"time": 98.732, "type": "FLASH"}, {"time": 99.044, "type": "NOTES_FLOW_RIGHT"}, {"time": 103.732, "type": "FLASH"}, {"time": 103.794, "type": "NOTES_FLOW_LEFT"}, {"time": 108.794, "type": "FLASH"}, {"time": 110.794, "type": "HUD_HIDE"}, {"time": 110.794, "type": "CAMERA_BOB_OFF"}, {"time": 110.794, "type": "FLASH"}], "audioFile": "track.mp3", "audioFormat": "mp3"}}, "swtv": {"folder": "swtv", "playlistFolder": "SWIPETAVA OST", "audioPath": "./charts/SWIPETAVA OST/swtv/track.mp3", "coverRef": "cov_210644cf5f", "bgRef": null, "meta": {"title": "swtv", "artist": "Arvicheskyy", "difficulty": 2.0, "menu_color": "#0048ff"}, "chart": {"bpm": 90, "noteTravelTime": 1000, "gridOffset": 0.033, "timing": [{"time": 0.033, "bpm": 90}], "notes": [{"time": 0.033, "type": "RIGHT"}, {"time": 3.589, "type": "UP"}, {"time": 7.144, "type": "LEFT"}, {"time": 10.7, "type": "DOWN"}, {"time": 14.255, "type": "UP"}, {"time": 16.033, "type": "DOWN"}, {"time": 17.811, "type": "UP"}, {"time": 19.589, "type": "RIGHT"}, {"time": 21.366, "type": "DOWN"}, {"time": 22.255, "type": "UP"}, {"time": 23.144, "type": "DOWN"}, {"time": 24.033, "type": "UP"}, {"time": 24.922, "type": "DOWN"}, {"time": 25.366, "type": "UP"}, {"time": 25.811, "type": "DOWN"}, {"time": 26.255, "type": "UP"}, {"time": 26.7, "type": "DOWN"}, {"time": 27.033, "type": "UP"}, {"time": 27.366, "type": "DOWN"}, {"time": 27.699, "type": "UP"}, {"time": 28.033, "type": "DOWN"}, {"time": 30.255, "type": "UP"}, {"time": 30.7, "type": "RIGHT"}, {"time": 31.144, "type": "UP"}, {"time": 31.589, "type": "LEFT"}, {"time": 32.033, "type": "DOWN"}, {"time": 32.477, "type": "UP"}, {"time": 32.922, "type": "RIGHT"}, {"time": 33.366, "type": "UP"}, {"time": 33.811, "type": "DOWN"}, {"time": 34.255, "type": "LEFT"}, {"time": 34.7, "type": "UP"}, {"time": 35.144, "type": "RIGHT"}, {"time": 35.589, "type": "DOWN"}, {"time": 36.033, "type": "UP"}, {"time": 36.477, "type": "RIGHT"}, {"time": 36.922, "type": "LEFT"}, {"time": 37.366, "type": "UP"}, {"time": 37.811, "type": "RIGHT"}, {"time": 38.255, "type": "UP"}, {"time": 38.7, "type": "LEFT"}, {"time": 39.144, "type": "DOWN"}, {"time": 39.588, "type": "UP"}, {"time": 40.033, "type": "RIGHT"}, {"time": 40.477, "type": "UP"}, {"time": 40.922, "type": "DOWN"}, {"time": 41.366, "type": "LEFT"}, {"time": 41.811, "type": "UP"}, {"time": 42.255, "type": "RIGHT"}, {"time": 42.7, "type": "DOWN"}, {"time": 43.144, "type": "UP"}, {"time": 43.588, "type": "RIGHT"}, {"time": 44.033, "type": "LEFT"}, {"time": 44.477, "type": "REVERSE"}, {"time": 44.922, "type": "LEFT"}, {"time": 45.366, "type": "DOWN"}, {"time": 45.811, "type": "RIGHT"}, {"time": 46.255, "type": "UP"}, {"time": 46.7, "type": "DOWN"}, {"time": 47.144, "type": "LEFT"}, {"time": 47.589, "type": "DOWN"}, {"time": 48.033, "type": "UP"}, {"time": 48.477, "type": "RIGHT"}, {"time": 48.922, "type": "DOWN"}, {"time": 49.366, "type": "LEFT"}, {"time": 49.811, "type": "UP"}, {"time": 50.255, "type": "DOWN"}, {"time": 50.7, "type": "LEFT"}, {"time": 51.144, "type": "RIGHT"}, {"time": 51.589, "type": "DOWN"}, {"time": 52.033, "type": "LEFT"}, {"time": 52.477, "type": "DOWN"}, {"time": 52.922, "type": "RIGHT"}, {"time": 53.366, "type": "UP"}, {"time": 53.811, "type": "DOWN"}, {"time": 54.255, "type": "LEFT"}, {"time": 54.7, "type": "DOWN"}, {"time": 55.144, "type": "UP"}, {"time": 55.589, "type": "RIGHT"}, {"time": 56.033, "type": "DOWN"}, {"time": 56.477, "type": "LEFT"}, {"time": 56.922, "type": "UP"}, {"time": 57.366, "type": "DOWN"}, {"time": 57.811, "type": "LEFT"}, {"time": 58.255, "type": "RIGHT"}], "events": [{"time": 0.033, "type": "BG_COLOR", "color": "#00031a"}, {"time": 1.144, "type": "BG_COLOR", "duration": 29.111, "color": "#62a0ea"}, {"time": 28.144, "type": "BLACKOUT", "duration": 1.889}, {"time": 30.255, "type": "CAMERA_BOB_ON"}, {"time": 30.255, "type": "FLASH"}, {"time": 30.258, "type": "FX_AQUA", "duration": 27.525}, {"time": 36.477, "type": "FLASH"}, {"time": 36.922, "type": "FLASH"}, {"time": 37.366, "type": "FLASH"}, {"time": 43.589, "type": "FLASH"}, {"time": 44.033, "type": "FLASH"}, {"time": 44.477, "type": "NOTES_FLOW_RIGHT"}, {"time": 44.477, "type": "FLASH"}, {"time": 50.7, "type": "FLASH"}, {"time": 51.144, "type": "FLASH"}, {"time": 51.589, "type": "FLASH"}, {"time": 57.783, "type": "FLASH"}, {"time": 58.255, "type": "FLASH"}, {"time": 58.7, "type": "BLACKOUT", "duration": 5.336}], "audioFile": "track.mp3", "audioFormat": "mp3"}}}}, "RCGD VERS OST": {"id": "RCGD VERS OST", "title": "RCGD VERS OST (Vol. 1)", "author": "Arvicheskyy, cranchee, ᴛᴠxᴏᴅᴀ", "songs": {"Atthistime": {"folder": "Atthistime", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/Atthistime/track.ogg", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "At this time", "artist": "cranchee", "difficulty": 2.0, "menu_color": "#7a2dbf"}, "chart": {"bpm": 93.3, "noteTravelTime": 1000, "gridOffset": 0.22, "timing": [{"time": 0.22, "bpm": 93.3}], "title": "аыыы", "artist": "аыыыы", "notes": [{"time": 0.22, "type": "DOWN"}, {"time": 1.747, "type": "RIGHT"}, {"time": 3.435, "type": "UP"}, {"time": 4.32, "type": "RIGHT"}, {"time": 5.124, "type": "LEFT"}, {"time": 6.008, "type": "RIGHT"}, {"time": 6.41, "type": "DOWN"}, {"time": 6.891, "type": "UP"}, {"time": 7.937, "type": "DOWN"}, {"time": 8.58, "type": "RIGHT"}, {"time": 10.268, "type": "UP"}, {"time": 11.152, "type": "RIGHT"}, {"time": 12.054, "type": "LEFT"}, {"time": 12.841, "type": "LEFT"}, {"time": 13.323, "type": "DOWN"}, {"time": 13.805, "type": "REVERSE"}, {"time": 14.368, "type": "RIGHT"}, {"time": 15.011, "type": "UP"}, {"time": 15.413, "type": "RIGHT"}, {"time": 15.895, "type": "DOWN"}, {"time": 16.297, "type": "RIGHT"}, {"time": 16.699, "type": "UP"}, {"time": 17.181, "type": "RIGHT"}, {"time": 18.468, "type": "DOWN"}, {"time": 18.87, "type": "RIGHT"}, {"time": 19.271, "type": "UP"}, {"time": 19.754, "type": "RIGHT"}, {"time": 20.156, "type": "LEFT"}, {"time": 20.558, "type": "DOWN"}, {"time": 21.04, "type": "RIGHT"}, {"time": 21.442, "type": "LEFT"}, {"time": 21.844, "type": "RIGHT"}, {"time": 22.246, "type": "UP"}, {"time": 22.728, "type": "RIGHT"}, {"time": 23.13, "type": "DOWN"}, {"time": 23.612, "type": "RIGHT"}, {"time": 24.014, "type": "DOWN"}, {"time": 24.416, "type": "RIGHT"}, {"time": 24.898, "type": "UP"}, {"time": 25.3, "type": "RIGHT"}, {"time": 25.702, "type": "LEFT"}, {"time": 26.185, "type": "UP"}, {"time": 26.587, "type": "DOWN"}, {"time": 26.988, "type": "UP"}, {"time": 27.39, "type": "REVERSE_BACK"}, {"time": 28.757, "type": "DOWN"}, {"time": 29.163, "type": "RIGHT"}, {"time": 29.561, "type": "UP"}, {"time": 29.963, "type": "RIGHT"}, {"time": 30.445, "type": "DOWN"}, {"time": 30.847, "type": "RIGHT"}, {"time": 32.133, "type": "DOWN"}, {"time": 32.535, "type": "LEFT"}, {"time": 33.017, "type": "RIGHT"}, {"time": 33.419, "type": "UP"}, {"time": 33.821, "type": "LEFT"}, {"time": 34.304, "type": "DOWN"}, {"time": 34.706, "type": "RIGHT"}, {"time": 35.107, "type": "DOWN"}, {"time": 35.59, "type": "LEFT"}, {"time": 35.992, "type": "DOWN"}, {"time": 36.474, "type": "RIGHT"}, {"time": 36.876, "type": "DOWN"}, {"time": 37.278, "type": "RIGHT"}, {"time": 37.76, "type": "UP"}, {"time": 38.162, "type": "RIGHT"}, {"time": 38.644, "type": "UP"}, {"time": 39.046, "type": "RIGHT"}, {"time": 39.448, "type": "UP"}, {"time": 39.931, "type": "LEFT"}, {"time": 40.333, "type": "DOWN"}, {"time": 40.757, "type": "RIGHT"}, {"time": 41.206, "type": "REVERSE"}, {"time": 42.905, "type": "RIGHT"}, {"time": 44.593, "type": "UP"}, {"time": 44.999, "type": "RIGHT"}, {"time": 45.425, "type": "DOWN"}, {"time": 45.905, "type": "RIGHT"}, {"time": 46.311, "type": "LEFT"}, {"time": 46.705, "type": "UP"}, {"time": 47.111, "type": "RIGHT"}, {"time": 47.559, "type": "DOWN"}, {"time": 47.969, "type": "REVERSE_BACK"}, {"time": 49.095, "type": "RIGHT"}, {"time": 49.738, "type": "DOWN"}, {"time": 51.024, "type": "RIGHT"}, {"time": 51.426, "type": "UP"}, {"time": 51.828, "type": "RIGHT"}, {"time": 52.23, "type": "LEFT"}, {"time": 52.712, "type": "DOWN"}, {"time": 53.114, "type": "DOWN"}, {"time": 53.516, "type": "RIGHT"}, {"time": 53.998, "type": "LEFT"}, {"time": 54.4, "type": "DOWN"}, {"time": 54.882, "type": "UP"}, {"time": 56.57, "type": "DOWN"}, {"time": 58.339, "type": "UP"}, {"time": 60.027, "type": "RIGHT"}, {"time": 61.715, "type": "DOWN"}, {"time": 63.484, "type": "LEFT"}, {"time": 65.172, "type": "RIGHT"}, {"time": 66.86, "type": "DOWN"}, {"time": 67.342, "type": "RIGHT"}, {"time": 67.744, "type": "UP"}, {"time": 68.146, "type": "RIGHT"}, {"time": 68.548, "type": "DOWN"}, {"time": 70.316, "type": "RIGHT"}], "events": [{"time": 0.182, "type": "FLASH"}, {"time": 0.185, "type": "BG_COLOR", "color": "#c061cb"}, {"time": 6.878, "type": "FLASH"}, {"time": 13.789, "type": "FLASH"}, {"time": 13.793, "type": "BG_COLOR", "color": "#b5835a"}, {"time": 13.805, "type": "NOTES_FLOW_RIGHT"}, {"time": 27.39, "type": "NOTES_FLOW_LEFT"}, {"time": 41.206, "type": "NOTES_FLOW_RIGHT"}, {"time": 47.969, "type": "NOTES_FLOW_LEFT"}, {"time": 54.865, "type": "FLASH"}, {"time": 54.875, "type": "BG_COLOR", "color": "#9141ac"}], "audioFile": "track.ogg", "audioFormat": "ogg", "coverFile": "Cover.png"}}, "bigplan": {"folder": "bigplan", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/bigplan/track.ogg", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "Big plan", "artist": "cranchee", "difficulty": 1.0, "menu_color": "#0d4c73"}, "chart": {"bpm": 160, "noteTravelTime": 1000, "gridOffset": 0.263, "timing": [{"time": 0.263, "bpm": 160}], "title": "аыыы", "artist": "аыыыы", "notes": [{"time": 0, "type": "UP"}, {"time": 2.044, "type": "RIGHT"}, {"time": 4.013, "type": "DOWN"}, {"time": 6.076, "type": "LEFT"}, {"time": 7.013, "type": "RIGHT"}, {"time": 7.951, "type": "UP"}, {"time": 10.013, "type": "DOWN"}, {"time": 12.029, "type": "LEFT"}, {"time": 13.951, "type": "UP"}, {"time": 15.029, "type": "RIGHT"}, {"time": 16.013, "type": "DOWN"}, {"time": 18.029, "type": "RIGHT"}, {"time": 19.951, "type": "DOWN"}, {"time": 22.013, "type": "UP"}, {"time": 22.997, "type": "RIGHT"}, {"time": 24.029, "type": "DOWN"}, {"time": 25.997, "type": "RIGHT"}, {"time": 28.013, "type": "UP"}, {"time": 30.076, "type": "RIGHT"}, {"time": 31.013, "type": "DOWN"}, {"time": 31.947, "type": "RIGHT"}, {"time": 32.513, "type": "UP"}, {"time": 32.794, "type": "RIGHT"}, {"time": 33.497, "type": "UP"}, {"time": 34.482, "type": "DOWN"}, {"time": 34.763, "type": "RIGHT"}, {"time": 35.522, "type": "DOWN"}, {"time": 36.497, "type": "RIGHT"}, {"time": 36.779, "type": "UP"}, {"time": 37.482, "type": "LEFT"}, {"time": 37.996, "type": "RIGHT"}, {"time": 38.513, "type": "DOWN"}, {"time": 38.747, "type": "RIGHT"}, {"time": 38.982, "type": "UP"}, {"time": 39.563, "type": "RIGHT"}, {"time": 40.013, "type": "UP"}, {"time": 40.482, "type": "RIGHT"}, {"time": 40.763, "type": "DOWN"}, {"time": 41.513, "type": "RIGHT"}, {"time": 42.076, "type": "UP"}, {"time": 42.496, "type": "RIGHT"}, {"time": 42.742, "type": "DOWN"}, {"time": 43.482, "type": "RIGHT"}, {"time": 43.951, "type": "UP"}, {"time": 44.491, "type": "RIGHT"}, {"time": 44.779, "type": "DOWN"}, {"time": 45.263, "type": "RIGHT"}, {"time": 45.995, "type": "UP"}, {"time": 46.997, "type": "RIGHT"}, {"time": 47.982, "type": "DOWN"}, {"time": 48.491, "type": "UP"}, {"time": 48.779, "type": "RIGHT"}, {"time": 49.482, "type": "DOWN"}, {"time": 49.997, "type": "RIGHT"}, {"time": 50.466, "type": "LEFT"}, {"time": 50.747, "type": "RIGHT"}, {"time": 51.497, "type": "UP"}, {"time": 52.013, "type": "RIGHT"}, {"time": 52.502, "type": "DOWN"}, {"time": 52.779, "type": "RIGHT"}, {"time": 53.513, "type": "UP"}, {"time": 54.076, "type": "RIGHT"}, {"time": 55.013, "type": "LEFT"}, {"time": 55.997, "type": "RIGHT"}, {"time": 56.513, "type": "UP"}, {"time": 56.794, "type": "RIGHT"}, {"time": 57.497, "type": "DOWN"}, {"time": 58.013, "type": "RIGHT"}, {"time": 58.464, "type": "UP"}, {"time": 58.763, "type": "RIGHT"}, {"time": 59.513, "type": "DOWN"}, {"time": 60.029, "type": "RIGHT"}, {"time": 60.48, "type": "UP"}, {"time": 60.736, "type": "RIGHT"}, {"time": 61.482, "type": "DOWN"}, {"time": 62.044, "type": "LEFT"}, {"time": 62.982, "type": "RIGHT"}, {"time": 64.013, "type": "UP"}, {"time": 66.029, "type": "DOWN"}, {"time": 67.997, "type": "RIGHT"}, {"time": 70.013, "type": "UP"}, {"time": 71.044, "type": "LEFT"}, {"time": 71.982, "type": "RIGHT"}, {"time": 73.997, "type": "UP"}, {"time": 76.013, "type": "DOWN"}, {"time": 77.982, "type": "RIGHT"}, {"time": 79.013, "type": "UP"}, {"time": 79.482, "type": "UP_RIGHT"}, {"time": 79.763, "type": "DOWN_RIGHT"}], "events": [{"time": 31.951, "type": "CAMERA_BOB_ON"}, {"time": 31.951, "type": "FLASH"}, {"time": 31.997, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 47.982, "type": "FLASH"}, {"time": 63.966, "type": "CAMERA_BOB_OFF"}, {"time": 64.013, "type": "FLASH"}], "audioFile": "track.ogg", "audioFormat": "ogg", "coverFile": "Cover.png"}}, "justchil": {"folder": "justchil", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/justchil/track.ogg", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "Just chilll", "artist": "Arvicheskyy", "difficulty": 0.5, "menu_color": "#b32222"}, "chart": {"bpm": 90, "noteTravelTime": 1000, "title": "test", "artist": "test", "notes": [{"time": 0.392, "type": "RIGHT"}, {"time": 2.686, "type": "RIGHT"}, {"time": 5.416, "type": "RIGHT"}, {"time": 7.998, "type": "UP"}, {"time": 10.686, "type": "RIGHT"}, {"time": 11.352, "type": "UP"}, {"time": 12.019, "type": "RIGHT"}, {"time": 12.686, "type": "DOWN"}, {"time": 13.352, "type": "RIGHT"}, {"time": 14.019, "type": "UP"}, {"time": 14.686, "type": "RIGHT"}, {"time": 15.352, "type": "LEFT"}, {"time": 16.019, "type": "DOWN"}, {"time": 16.686, "type": "RIGHT"}, {"time": 17.352, "type": "UP"}, {"time": 18.019, "type": "RIGHT"}, {"time": 18.686, "type": "UP"}, {"time": 19.352, "type": "RIGHT"}, {"time": 20.019, "type": "RIGHT"}, {"time": 20.686, "type": "DOWN"}, {"time": 21.352, "type": "RIGHT"}, {"time": 22.019, "type": "UP"}, {"time": 22.686, "type": "RIGHT"}, {"time": 23.352, "type": "DOWN"}, {"time": 24.019, "type": "LEFT"}, {"time": 24.686, "type": "RIGHT"}, {"time": 25.352, "type": "UP"}, {"time": 26.019, "type": "RIGHT"}, {"time": 26.686, "type": "LEFT"}, {"time": 27.352, "type": "DOWN"}, {"time": 28.019, "type": "RIGHT"}, {"time": 28.686, "type": "UP"}, {"time": 29.352, "type": "LEFT"}, {"time": 30.019, "type": "DOWN"}, {"time": 30.686, "type": "RIGHT"}, {"time": 31.352, "type": "UP"}, {"time": 32.019, "type": "RIGHT"}, {"time": 32.766, "type": "DOWN"}, {"time": 33.374, "type": "RIGHT"}, {"time": 34.003, "type": "UP"}, {"time": 34.654, "type": "DOWN"}, {"time": 35.358, "type": "UP"}, {"time": 35.987, "type": "RIGHT"}, {"time": 36.691, "type": "DOWN"}, {"time": 37.427, "type": "DOWN"}, {"time": 38.163, "type": "RIGHT"}, {"time": 38.76, "type": "UP"}, {"time": 39.454, "type": "RIGHT"}, {"time": 40.094, "type": "LEFT"}, {"time": 40.787, "type": "RIGHT"}, {"time": 41.438, "type": "DOWN"}, {"time": 42.056, "type": "RIGHT"}, {"time": 42.707, "type": "UP"}, {"time": 43.464, "type": "RIGHT"}, {"time": 44.094, "type": "DOWN"}, {"time": 44.798, "type": "DOWN"}, {"time": 45.448, "type": "LEFT"}, {"time": 46.142, "type": "UP"}, {"time": 46.75, "type": "UP"}, {"time": 47.379, "type": "UP"}, {"time": 48.083, "type": "RIGHT"}, {"time": 48.83, "type": "DOWN"}, {"time": 49.416, "type": "DOWN"}, {"time": 50.046, "type": "DOWN"}, {"time": 50.632, "type": "RIGHT"}, {"time": 51.368, "type": "UP"}, {"time": 52.008, "type": "LEFT"}, {"time": 52.766, "type": "DOWN"}, {"time": 53.448, "type": "UP"}, {"time": 54.019, "type": "RIGHT"}, {"time": 54.686, "type": "UP"}, {"time": 55.352, "type": "RIGHT"}, {"time": 56.019, "type": "DOWN"}, {"time": 56.686, "type": "LEFT"}, {"time": 57.352, "type": "LEFT"}, {"time": 58.019, "type": "LEFT"}, {"time": 58.686, "type": "UP"}, {"time": 59.352, "type": "RIGHT"}, {"time": 60.019, "type": "RIGHT"}, {"time": 60.686, "type": "RIGHT"}, {"time": 61.342, "type": "DOWN"}, {"time": 62.019, "type": "LEFT"}, {"time": 62.686, "type": "LEFT"}, {"time": 63.352, "type": "LEFT"}, {"time": 64.019, "type": "UP"}, {"time": 64.691, "type": "RIGHT"}, {"time": 65.352, "type": "RIGHT"}, {"time": 65.992, "type": "RIGHT"}, {"time": 66.686, "type": "DOWN"}, {"time": 67.368, "type": "RIGHT"}, {"time": 67.976, "type": "RIGHT"}, {"time": 68.686, "type": "RIGHT"}, {"time": 69.352, "type": "LEFT"}, {"time": 70.024, "type": "UP"}, {"time": 70.686, "type": "UP"}, {"time": 71.352, "type": "UP"}, {"time": 72.019, "type": "DOWN"}, {"time": 72.686, "type": "RIGHT"}, {"time": 73.352, "type": "RIGHT"}, {"time": 74.019, "type": "RIGHT"}, {"time": 74.686, "type": "UP"}, {"time": 75.368, "type": "RIGHT"}, {"time": 75.966, "type": "DOWN"}, {"time": 76.627, "type": "RIGHT"}, {"time": 77.338, "type": "UP_LEFT"}, {"time": 78.11, "type": "LEFT"}, {"time": 78.76, "type": "DOWN"}, {"time": 79.422, "type": "RIGHT"}, {"time": 80.106, "type": "DOWN_RIGHT"}, {"time": 80.808, "type": "LEFT"}, {"time": 81.406, "type": "UP"}, {"time": 82.056, "type": "RIGHT"}, {"time": 82.707, "type": "RIGHT"}, {"time": 83.454, "type": "DOWN"}, {"time": 84.008, "type": "LEFT"}, {"time": 84.659, "type": "UP"}, {"time": 85.352, "type": "RIGHT"}, {"time": 86.019, "type": "DOWN"}, {"time": 86.686, "type": "RIGHT"}, {"time": 87.371, "type": "DOWN"}, {"time": 88.019, "type": "UP"}, {"time": 88.686, "type": "RIGHT"}, {"time": 89.352, "type": "DOWN"}, {"time": 90.019, "type": "LEFT"}, {"time": 90.686, "type": "UP_RIGHT"}, {"time": 91.352, "type": "RIGHT"}, {"time": 92.019, "type": "UP"}, {"time": 92.686, "type": "RIGHT"}, {"time": 93.352, "type": "DOWN"}, {"time": 94.019, "type": "RIGHT"}, {"time": 94.686, "type": "RIGHT"}, {"time": 95.352, "type": "DOWN"}, {"time": 96.019, "type": "RIGHT"}, {"time": 96.686, "type": "RIGHT"}, {"time": 97.352, "type": "RIGHT"}, {"time": 98.019, "type": "RIGHT"}, {"time": 98.686, "type": "DOWN"}, {"time": 99.352, "type": "LEFT"}, {"time": 100.019, "type": "LEFT"}, {"time": 100.686, "type": "LEFT"}, {"time": 101.352, "type": "UP"}, {"time": 102.019, "type": "DOWN"}, {"time": 102.686, "type": "UP"}, {"time": 103.352, "type": "RIGHT"}, {"time": 104.019, "type": "DOWN"}, {"time": 104.686, "type": "UP"}, {"time": 105.352, "type": "DOWN"}, {"time": 106.019, "type": "UP"}], "events": [{"time": 0, "type": "FX_DUOTONE", "duration": 10.852}, {"time": 10.669, "type": "CAMERA_BOB_ON"}, {"time": 10.727, "type": "FLASH"}, {"time": 32.092, "type": "FLASH"}, {"time": 34.596, "type": "FLASH"}, {"time": 37.352, "type": "FLASH"}, {"time": 40.019, "type": "FLASH"}, {"time": 42.686, "type": "FLASH"}, {"time": 45.352, "type": "FLASH"}, {"time": 48.019, "type": "FLASH"}, {"time": 50.686, "type": "FLASH"}, {"time": 53.352, "type": "FLASH"}, {"time": 53.352, "type": "CAMERA_BOB_OFF"}, {"time": 53.43, "type": "FX_BW", "duration": 32}, {"time": 58.596, "type": "FLASH"}, {"time": 58.675, "type": "CAMERA_BOB_ON"}, {"time": 85.263, "type": "CAMERA_BOB_OFF"}, {"time": 85.352, "type": "FLASH"}], "audioFile": "track.ogg", "audioFormat": "ogg", "coverFile": "cover.png"}}, "nelisexe": {"folder": "nelisexe", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/nelisexe/track.mp3", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "Nelis exe", "artist": "Arvicheskyy", "difficulty": 3.5, "menu_color": "#b32222"}, "chart": {"bpm": 175, "noteTravelTime": 1000, "title": "test", "artist": "test", "notes": [{"time": 0.177, "type": "RIGHT"}, {"time": 1.617, "type": "LEFT"}, {"time": 2.929, "type": "RIGHT"}, {"time": 4.284, "type": "LEFT"}, {"time": 5.639, "type": "RIGHT"}, {"time": 6.033, "type": "UP"}, {"time": 6.417, "type": "RIGHT"}, {"time": 6.769, "type": "DOWN"}, {"time": 7.143, "type": "RIGHT"}, {"time": 7.495, "type": "DOWN"}, {"time": 7.825, "type": "RIGHT"}, {"time": 8.156, "type": "DOWN"}, {"time": 8.508, "type": "RIGHT"}, {"time": 8.849, "type": "UP"}, {"time": 9.223, "type": "RIGHT"}, {"time": 9.543, "type": "UP"}, {"time": 9.916, "type": "RIGHT"}, {"time": 10.268, "type": "UP"}, {"time": 10.641, "type": "RIGHT"}, {"time": 10.94, "type": "UP"}, {"time": 11.26, "type": "RIGHT"}, {"time": 11.569, "type": "DOWN"}, {"time": 11.975, "type": "RIGHT"}, {"time": 12.295, "type": "DOWN"}, {"time": 12.647, "type": "RIGHT"}, {"time": 12.977, "type": "DOWN"}, {"time": 13.297, "type": "RIGHT"}, {"time": 13.639, "type": "DOWN"}, {"time": 13.991, "type": "RIGHT"}, {"time": 14.321, "type": "UP"}, {"time": 14.663, "type": "RIGHT"}, {"time": 15.015, "type": "DOWN"}, {"time": 15.356, "type": "RIGHT"}, {"time": 15.708, "type": "UP"}, {"time": 16.081, "type": "RIGHT"}, {"time": 16.38, "type": "DOWN"}, {"time": 16.635, "type": "RIGHT"}, {"time": 17.009, "type": "LEFT"}, {"time": 17.383, "type": "UP"}, {"time": 17.724, "type": "RIGHT"}, {"time": 18.076, "type": "DOWN"}, {"time": 18.449, "type": "RIGHT"}, {"time": 18.791, "type": "DOWN"}, {"time": 19.164, "type": "RIGHT"}, {"time": 19.484, "type": "DOWN"}, {"time": 19.815, "type": "LEFT"}, {"time": 20.135, "type": "RIGHT"}, {"time": 20.444, "type": "DOWN"}, {"time": 20.817, "type": "LEFT"}, {"time": 21.148, "type": "RIGHT"}, {"time": 21.468, "type": "DOWN"}, {"time": 21.831, "type": "RIGHT"}, {"time": 22.161, "type": "DOWN"}, {"time": 22.492, "type": "LEFT"}, {"time": 22.801, "type": "DOWN"}, {"time": 23.153, "type": "RIGHT"}, {"time": 23.516, "type": "LEFT"}, {"time": 23.868, "type": "DOWN"}, {"time": 24.241, "type": "RIGHT"}, {"time": 24.593, "type": "DOWN"}, {"time": 24.913, "type": "LEFT"}, {"time": 25.265, "type": "DOWN"}, {"time": 25.596, "type": "RIGHT"}, {"time": 25.948, "type": "LEFT"}, {"time": 26.3, "type": "DOWN"}, {"time": 26.641, "type": "RIGHT"}, {"time": 26.951, "type": "DOWN"}, {"time": 27.303, "type": "RIGHT"}, {"time": 27.623, "type": "UP"}, {"time": 27.985, "type": "RIGHT"}, {"time": 28.348, "type": "DOWN"}, {"time": 28.721, "type": "RIGHT"}, {"time": 29.073, "type": "UP"}, {"time": 29.404, "type": "RIGHT"}, {"time": 29.735, "type": "DOWN"}, {"time": 30.108, "type": "RIGHT"}, {"time": 30.396, "type": "UP"}, {"time": 30.737, "type": "RIGHT"}, {"time": 31.036, "type": "DOWN"}, {"time": 31.409, "type": "RIGHT"}, {"time": 31.719, "type": "UP"}, {"time": 32.092, "type": "RIGHT"}, {"time": 32.444, "type": "DOWN"}, {"time": 32.775, "type": "RIGHT"}, {"time": 33.105, "type": "DOWN"}, {"time": 33.479, "type": "LEFT"}, {"time": 33.788, "type": "DOWN"}, {"time": 34.087, "type": "RIGHT"}, {"time": 34.449, "type": "DOWN"}, {"time": 34.759, "type": "LEFT"}, {"time": 35.079, "type": "DOWN"}, {"time": 35.409, "type": "RIGHT"}, {"time": 35.761, "type": "LEFT"}, {"time": 36.113, "type": "DOWN"}, {"time": 36.497, "type": "RIGHT"}, {"time": 36.913, "type": "RIGHT"}, {"time": 37.255, "type": "DOWN"}, {"time": 37.564, "type": "LEFT"}, {"time": 37.873, "type": "DOWN"}, {"time": 38.218, "type": "REVERSE"}, {"time": 44.049, "type": "RIGHT"}, {"time": 44.391, "type": "LEFT"}, {"time": 44.764, "type": "RIGHT"}, {"time": 45.073, "type": "LEFT"}, {"time": 45.415, "type": "RIGHT"}, {"time": 45.756, "type": "LEFT"}, {"time": 46.119, "type": "RIGHT"}, {"time": 46.439, "type": "LEFT"}, {"time": 46.439, "type": "RIGHT"}, {"time": 46.769, "type": "RIGHT"}, {"time": 47.121, "type": "LEFT"}, {"time": 47.121, "type": "RIGHT"}, {"time": 47.42, "type": "RIGHT"}, {"time": 47.783, "type": "LEFT"}, {"time": 47.783, "type": "RIGHT"}, {"time": 48.135, "type": "RIGHT"}, {"time": 48.476, "type": "LEFT"}, {"time": 48.476, "type": "RIGHT"}, {"time": 48.849, "type": "RIGHT"}, {"time": 49.201, "type": "LEFT"}, {"time": 49.201, "type": "RIGHT"}, {"time": 49.544, "type": "RIGHT"}, {"time": 49.896, "type": "DOWN"}, {"time": 50.259, "type": "RIGHT"}, {"time": 50.59, "type": "DOWN"}, {"time": 50.931, "type": "RIGHT"}, {"time": 51.272, "type": "DOWN"}, {"time": 51.624, "type": "RIGHT"}, {"time": 51.955, "type": "DOWN"}, {"time": 52.275, "type": "RIGHT"}, {"time": 52.648, "type": "DOWN"}, {"time": 52.958, "type": "RIGHT"}, {"time": 53.299, "type": "DOWN"}, {"time": 53.64, "type": "RIGHT"}, {"time": 53.95, "type": "DOWN"}, {"time": 54.291, "type": "RIGHT"}, {"time": 54.643, "type": "DOWN"}, {"time": 54.995, "type": "RIGHT"}, {"time": 55.283, "type": "DOWN"}, {"time": 55.667, "type": "RIGHT"}, {"time": 55.987, "type": "DOWN"}, {"time": 56.367, "type": "UP"}, {"time": 56.639, "type": "RIGHT"}, {"time": 56.852, "type": "UP"}, {"time": 57.204, "type": "RIGHT"}, {"time": 57.556, "type": "UP"}, {"time": 57.94, "type": "RIGHT"}, {"time": 58.271, "type": "UP"}, {"time": 58.591, "type": "RIGHT"}, {"time": 58.954, "type": "UP"}, {"time": 59.274, "type": "RIGHT"}, {"time": 59.583, "type": "UP"}, {"time": 59.892, "type": "RIGHT"}, {"time": 60.255, "type": "UP"}, {"time": 60.575, "type": "RIGHT"}, {"time": 60.927, "type": "UP"}, {"time": 61.258, "type": "RIGHT"}, {"time": 61.556, "type": "LEFT"}, {"time": 61.908, "type": "RIGHT"}, {"time": 62.228, "type": "LEFT"}, {"time": 62.57, "type": "RIGHT"}, {"time": 62.911, "type": "DOWN"}, {"time": 63.242, "type": "RIGHT"}, {"time": 63.572, "type": "DOWN"}, {"time": 63.914, "type": "RIGHT"}, {"time": 64.255, "type": "DOWN"}, {"time": 64.607, "type": "RIGHT"}, {"time": 64.906, "type": "DOWN"}, {"time": 65.279, "type": "RIGHT"}, {"time": 65.578, "type": "DOWN"}, {"time": 66.004, "type": "UP"}, {"time": 66.303, "type": "RIGHT"}, {"time": 66.676, "type": "UP"}, {"time": 67.018, "type": "RIGHT"}, {"time": 67.316, "type": "UP"}, {"time": 67.7, "type": "RIGHT"}, {"time": 67.999, "type": "UP"}, {"time": 68.308, "type": "RIGHT"}, {"time": 68.692, "type": "UP"}, {"time": 69.044, "type": "RIGHT"}, {"time": 69.375, "type": "UP"}, {"time": 69.77, "type": "RIGHT"}, {"time": 70.068, "type": "UP"}, {"time": 70.399, "type": "RIGHT"}, {"time": 70.751, "type": "UP"}, {"time": 71.082, "type": "RIGHT"}, {"time": 71.681, "type": "REVERSE_BACK"}, {"time": 72.188, "type": "RIGHT"}, {"time": 72.828, "type": "DOWN"}, {"time": 73.436, "type": "LEFT"}, {"time": 74.183, "type": "RIGHT"}, {"time": 74.812, "type": "DOWN"}, {"time": 75.473, "type": "RIGHT"}, {"time": 76.06, "type": "DOWN"}, {"time": 76.828, "type": "UP"}, {"time": 77.511, "type": "LEFT"}, {"time": 78.183, "type": "DOWN"}, {"time": 78.876, "type": "RIGHT"}, {"time": 79.548, "type": "UP"}, {"time": 80.263, "type": "LEFT"}, {"time": 80.999, "type": "DOWN"}, {"time": 81.681, "type": "RIGHT"}, {"time": 82.364, "type": "UP"}], "events": [{"time": 5.588, "type": "NOTES_BOUNCE_ON"}, {"time": 16.53, "type": "FLASH"}, {"time": 16.532, "type": "BG_COLOR", "color": "#a51d2d"}, {"time": 16.533, "type": "FX_ZOOM_BLUR", "duration": 21.848}, {"time": 16.535, "type": "NOTES_BOUNCE_OFF"}, {"time": 38.218, "type": "NOTES_FLOW_RIGHT"}, {"time": 38.39, "type": "SHAKE"}, {"time": 44.03, "type": "FLASH"}, {"time": 44.048, "type": "CAMERA_BOB_ON"}, {"time": 49.399, "type": "FLASH"}, {"time": 49.445, "type": "FX_ZOOM_BLUR", "duration": 22.067}, {"time": 71.509, "type": "FLASH"}, {"time": 71.514, "type": "CAMERA_BOB_OFF"}, {"time": 71.526, "type": "NOTES_BOUNCE_ON"}, {"time": 71.681, "type": "NOTES_FLOW_LEFT"}, {"time": 82.311, "type": "FLASH"}, {"time": 82.311, "type": "SHAKE"}, {"time": 82.311, "type": "BG_COLOR", "color": "#3584e4"}], "audioFile": "track.mp3", "audioFormat": "mp3", "coverFile": "cover.png"}}, "ostanovka": {"folder": "ostanovka", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/ostanovka/track.ogg", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "ostanovka", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 2.5, "menu_color": "#2e2e2e"}, "chart": {"bpm": 90, "noteTravelTime": 1000, "gridOffset": 0.041, "timing": [{"time": 0.041, "bpm": 90}], "notes": [{"time": 0.032, "type": "UP"}, {"time": 0.699, "type": "RIGHT"}, {"time": 1.365, "type": "UP"}, {"time": 2.032, "type": "RIGHT"}, {"time": 2.699, "type": "UP"}, {"time": 3.365, "type": "RIGHT"}, {"time": 4.032, "type": "UP"}, {"time": 4.699, "type": "RIGHT"}, {"time": 5.365, "type": "DOWN"}, {"time": 6.032, "type": "LEFT"}, {"time": 6.699, "type": "UP"}, {"time": 7.365, "type": "UP"}, {"time": 8.032, "type": "RIGHT"}, {"time": 8.699, "type": "UP_RIGHT"}, {"time": 9.365, "type": "UP"}, {"time": 10.032, "type": "UP"}, {"time": 10.699, "type": "DOWN_RIGHT"}, {"time": 11.365, "type": "RIGHT"}, {"time": 12.032, "type": "DOWN_RIGHT"}, {"time": 12.699, "type": "RIGHT"}, {"time": 13.365, "type": "UP_RIGHT"}, {"time": 14.032, "type": "UP"}, {"time": 14.699, "type": "UP_RIGHT"}, {"time": 15.365, "type": "UP"}, {"time": 16.032, "type": "UP_RIGHT"}, {"time": 16.699, "type": "DOWN"}, {"time": 17.365, "type": "DOWN"}, {"time": 18.032, "type": "UP"}, {"time": 18.699, "type": "UP"}, {"time": 19.365, "type": "RIGHT"}, {"time": 20.032, "type": "RIGHT"}, {"time": 20.699, "type": "UP_RIGHT"}, {"time": 21.365, "type": "RIGHT"}, {"time": 22.032, "type": "UP"}, {"time": 22.365, "type": "UP"}, {"time": 23.032, "type": "UP"}, {"time": 23.532, "type": "RIGHT"}, {"time": 23.865, "type": "DOWN"}, {"time": 24.199, "type": "LEFT"}, {"time": 24.532, "type": "UP"}, {"time": 25.032, "type": "LEFT"}, {"time": 25.365, "type": "UP"}, {"time": 25.699, "type": "UP"}, {"time": 26.032, "type": "UP"}, {"time": 26.365, "type": "RIGHT"}, {"time": 26.699, "type": "DOWN"}, {"time": 27.365, "type": "RIGHT"}, {"time": 27.865, "type": "RIGHT"}, {"time": 28.365, "type": "UP"}, {"time": 28.865, "type": "UP_RIGHT"}, {"time": 29.199, "type": "UP"}, {"time": 29.532, "type": "DOWN"}, {"time": 29.865, "type": "RIGHT"}, {"time": 30.365, "type": "RIGHT"}, {"time": 30.699, "type": "LEFT"}, {"time": 31.032, "type": "RIGHT"}, {"time": 31.365, "type": "UP"}, {"time": 31.698, "type": "DOWN"}, {"time": 32.032, "type": "UP"}, {"time": 32.532, "type": "UP"}, {"time": 33.032, "type": "UP"}, {"time": 33.532, "type": "RIGHT"}, {"time": 34.032, "type": "RIGHT"}, {"time": 34.365, "type": "DOWN"}, {"time": 35.199, "type": "UP"}, {"time": 35.699, "type": "UP"}, {"time": 36.032, "type": "UP_RIGHT"}, {"time": 36.365, "type": "UP_LEFT"}, {"time": 36.699, "type": "UP_RIGHT"}, {"time": 37.032, "type": "UP_LEFT"}, {"time": 37.365, "type": "REVERSE"}, {"time": 37.865, "type": "LEFT"}, {"time": 38.365, "type": "LEFT"}, {"time": 38.865, "type": "LEFT"}, {"time": 39.365, "type": "UP_LEFT"}, {"time": 39.699, "type": "UP"}, {"time": 40.199, "type": "UP_RIGHT"}, {"time": 40.699, "type": "RIGHT"}, {"time": 41.199, "type": "DOWN_RIGHT"}, {"time": 41.532, "type": "UP"}, {"time": 41.865, "type": "DOWN"}, {"time": 42.199, "type": "UP"}, {"time": 42.699, "type": "REVERSE_BACK"}, {"time": 43.532, "type": "RIGHT"}, {"time": 44.032, "type": "DOWN"}, {"time": 44.532, "type": "LEFT"}, {"time": 45.199, "type": "REVERSE"}, {"time": 46.032, "type": "UP_LEFT"}, {"time": 46.699, "type": "DOWN_LEFT"}, {"time": 47.365, "type": "DOWN_RIGHT"}, {"time": 48.032, "type": "REVERSE_BACK"}, {"time": 48.699, "type": "UP"}, {"time": 49.365, "type": "DOWN"}, {"time": 50.032, "type": "UP"}, {"time": 50.032, "type": "DOWN"}, {"time": 50.699, "type": "UP"}, {"time": 51.032, "type": "RIGHT"}, {"time": 51.365, "type": "DOWN"}, {"time": 51.699, "type": "RIGHT"}, {"time": 52.032, "type": "UP"}, {"time": 52.365, "type": "RIGHT"}, {"time": 52.699, "type": "DOWN"}, {"time": 53.032, "type": "RIGHT"}, {"time": 53.365, "type": "UP"}, {"time": 53.699, "type": "DOWN_RIGHT"}, {"time": 54.032, "type": "RIGHT"}, {"time": 54.365, "type": "UP_RIGHT"}, {"time": 54.699, "type": "RIGHT"}, {"time": 55.032, "type": "DOWN_RIGHT"}, {"time": 55.365, "type": "RIGHT"}, {"time": 55.699, "type": "UP_RIGHT"}, {"time": 56.032, "type": "REVERSE"}, {"time": 56.365, "type": "RIGHT"}, {"time": 56.699, "type": "LEFT"}, {"time": 57.032, "type": "RIGHT"}, {"time": 57.365, "type": "LEFT"}, {"time": 57.699, "type": "RIGHT"}, {"time": 58.032, "type": "LEFT"}, {"time": 58.365, "type": "RIGHT"}, {"time": 58.699, "type": "LEFT"}, {"time": 59.032, "type": "UP"}, {"time": 59.365, "type": "DOWN"}, {"time": 59.699, "type": "UP"}, {"time": 60.032, "type": "DOWN"}, {"time": 60.365, "type": "UP"}, {"time": 60.699, "type": "DOWN"}, {"time": 61.032, "type": "UP"}, {"time": 61.365, "type": "DOWN"}, {"time": 61.699, "type": "RIGHT"}, {"time": 62.032, "type": "UP"}, {"time": 62.365, "type": "RIGHT"}, {"time": 62.699, "type": "DOWN"}, {"time": 63.032, "type": "RIGHT"}, {"time": 63.365, "type": "UP"}, {"time": 63.699, "type": "RIGHT"}, {"time": 64.032, "type": "REVERSE_BACK"}, {"time": 65.365, "type": "UP"}, {"time": 66.032, "type": "DOWN"}, {"time": 66.699, "type": "UP"}, {"time": 68.032, "type": "RIGHT"}, {"time": 68.699, "type": "LEFT"}, {"time": 69.365, "type": "RIGHT"}, {"time": 70.699, "type": "UP"}, {"time": 71.365, "type": "RIGHT"}, {"time": 72.032, "type": "DOWN"}, {"time": 73.365, "type": "DOWN_RIGHT"}, {"time": 74.032, "type": "DOWN"}, {"time": 74.699, "type": "DOWN_LEFT"}, {"time": 76.032, "type": "UP"}, {"time": 76.699, "type": "DOWN"}, {"time": 77.365, "type": "UP"}, {"time": 78.699, "type": "DOWN"}, {"time": 79.365, "type": "DOWN"}, {"time": 80.032, "type": "UP"}], "events": [{"time": 0.032, "type": "NOTE_SPEED", "speed": 0.5}, {"time": 2.532, "type": "BG_COLOR", "duration": 18.833, "color": "#00021a"}, {"time": 21.345, "type": "FX_ASH_WIND", "duration": 42.667}, {"time": 21.365, "type": "FLASH"}, {"time": 21.365, "type": "BG_COLOR", "color": "#000000"}, {"time": 21.365, "type": "CAMERA_BOB_ON"}, {"time": 21.532, "type": "NOTE_SPEED", "speed": 1}, {"time": 32.032, "type": "FLASH"}, {"time": 34.365, "type": "BLACKOUT", "duration": 0.5}, {"time": 37.365, "type": "NOTES_FLOW_RIGHT"}, {"time": 37.365, "type": "FLASH"}, {"time": 42.699, "type": "NOTES_FLOW_LEFT"}, {"time": 42.699, "type": "FLASH"}, {"time": 42.699, "type": "SHAKE"}, {"time": 42.865, "type": "NOTE_SPEED", "speed": 2}, {"time": 45.199, "type": "NOTES_FLOW_RIGHT"}, {"time": 45.199, "type": "FLASH"}, {"time": 48.032, "type": "NOTES_FLOW_LEFT"}, {"time": 48.032, "type": "FLASH"}, {"time": 50.699, "type": "FLASH"}, {"time": 53.365, "type": "FLASH"}, {"time": 56.032, "type": "NOTES_FLOW_RIGHT"}, {"time": 64.032, "type": "FLASH"}, {"time": 64.032, "type": "NOTES_FLOW_LEFT"}, {"time": 64.032, "type": "CAMERA_BOB_OFF"}, {"time": 64.199, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 64.365, "type": "BG_COLOR", "duration": 21.001, "color": "#62a0ea"}, {"time": 66.699, "type": "FLASH"}, {"time": 69.365, "type": "FLASH"}, {"time": 72.032, "type": "FLASH"}, {"time": 74.699, "type": "FLASH"}, {"time": 80.032, "type": "FLASH"}, {"time": 85.365, "type": "BLACKOUT", "duration": 2.667}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "strelkaveks": {"folder": "strelkaveks", "playlistFolder": "RCGD VERS OST", "audioPath": "./charts/RCGD VERS OST/strelkaveks/track.mp3", "coverRef": "cov_beda754125", "bgRef": null, "meta": {"title": "S.V", "artist": "Arvicheskyy", "difficulty": 3.5, "menu_color": "#b32222"}, "chart": {"bpm": 175, "noteTravelTime": 1000, "notes": [{"time": 0.284, "type": "UP"}, {"time": 0.97, "type": "DOWN"}, {"time": 1.656, "type": "UP"}, {"time": 2.256, "type": "DOWN"}, {"time": 2.941, "type": "UP"}, {"time": 3.627, "type": "DOWN"}, {"time": 4.227, "type": "UP"}, {"time": 4.913, "type": "DOWN"}, {"time": 5.598, "type": "UP"}, {"time": 6.284, "type": "DOWN"}, {"time": 6.97, "type": "UP"}, {"time": 7.656, "type": "DOWN"}, {"time": 8.256, "type": "UP"}, {"time": 9.027, "type": "DOWN"}, {"time": 9.713, "type": "UP"}, {"time": 10.398, "type": "DOWN"}, {"time": 11.084, "type": "RIGHT"}, {"time": 11.598, "type": "RIGHT"}, {"time": 12.37, "type": "DOWN"}, {"time": 12.713, "type": "DOWN"}, {"time": 13.056, "type": "DOWN"}, {"time": 13.656, "type": "RIGHT"}, {"time": 13.998, "type": "RIGHT"}, {"time": 14.513, "type": "UP_RIGHT"}, {"time": 15.113, "type": "DOWN"}, {"time": 15.456, "type": "DOWN"}, {"time": 15.798, "type": "DOWN"}, {"time": 16.398, "type": "RIGHT"}, {"time": 16.741, "type": "RIGHT"}, {"time": 17.256, "type": "UP_RIGHT"}, {"time": 17.856, "type": "RIGHT"}, {"time": 18.198, "type": "LEFT"}, {"time": 18.541, "type": "UP_RIGHT"}, {"time": 19.056, "type": "DOWN"}, {"time": 19.398, "type": "UP_RIGHT"}, {"time": 19.913, "type": "DOWN"}, {"time": 20.598, "type": "UP"}, {"time": 20.941, "type": "UP"}, {"time": 21.284, "type": "UP"}, {"time": 21.627, "type": "UP"}, {"time": 21.97, "type": "RIGHT"}, {"time": 22.227, "type": "UP_RIGHT"}, {"time": 22.656, "type": "DOWN"}, {"time": 22.827, "type": "UP_LEFT"}, {"time": 23.341, "type": "DOWN"}, {"time": 23.684, "type": "UP"}, {"time": 23.941, "type": "DOWN"}, {"time": 24.113, "type": "UP_RIGHT"}, {"time": 24.713, "type": "RIGHT"}, {"time": 24.97, "type": "UP_RIGHT"}, {"time": 25.399, "type": "DOWN"}, {"time": 25.57, "type": "UP_LEFT"}, {"time": 26.084, "type": "DOWN"}, {"time": 26.427, "type": "UP"}, {"time": 26.684, "type": "DOWN"}, {"time": 26.864, "type": "REVERSE"}, {"time": 27.456, "type": "RIGHT"}, {"time": 27.713, "type": "UP_RIGHT"}, {"time": 28.142, "type": "DOWN"}, {"time": 28.313, "type": "UP_LEFT"}, {"time": 28.827, "type": "DOWN"}, {"time": 29.17, "type": "UP"}, {"time": 29.427, "type": "DOWN"}, {"time": 29.599, "type": "UP_RIGHT"}, {"time": 30.284, "type": "RIGHT"}, {"time": 30.541, "type": "UP_RIGHT"}, {"time": 30.97, "type": "DOWN"}, {"time": 31.141, "type": "UP_LEFT"}, {"time": 31.655, "type": "DOWN"}, {"time": 31.998, "type": "UP"}, {"time": 32.255, "type": "DOWN"}, {"time": 32.434, "type": "REVERSE_BACK"}, {"time": 32.941, "type": "RIGHT"}, {"time": 33.198, "type": "UP_RIGHT"}, {"time": 33.627, "type": "DOWN"}, {"time": 33.798, "type": "UP_LEFT"}, {"time": 34.312, "type": "DOWN"}, {"time": 34.655, "type": "UP"}, {"time": 34.912, "type": "DOWN"}, {"time": 35.084, "type": "UP_RIGHT"}, {"time": 35.702, "type": "RIGHT"}, {"time": 35.959, "type": "UP_RIGHT"}, {"time": 36.388, "type": "DOWN"}, {"time": 36.559, "type": "UP_LEFT"}, {"time": 37.073, "type": "DOWN"}, {"time": 37.416, "type": "UP"}, {"time": 37.673, "type": "DOWN"}, {"time": 37.863, "type": "REVERSE"}, {"time": 38.408, "type": "RIGHT"}, {"time": 38.665, "type": "UP_RIGHT"}, {"time": 39.094, "type": "DOWN"}, {"time": 39.265, "type": "UP_LEFT"}, {"time": 39.775, "type": "UP"}, {"time": 40.121, "type": "DOWN"}, {"time": 40.383, "type": "UP"}, {"time": 40.557, "type": "REVERSE_BACK"}, {"time": 41.164, "type": "RIGHT"}, {"time": 41.421, "type": "UP_RIGHT"}, {"time": 41.85, "type": "DOWN"}, {"time": 42.027, "type": "UP_RIGHT"}, {"time": 42.535, "type": "DOWN"}, {"time": 42.878, "type": "UP"}, {"time": 43.135, "type": "DOWN"}, {"time": 43.307, "type": "UP_RIGHT"}, {"time": 43.913, "type": "UP"}, {"time": 44.598, "type": "DOWN"}, {"time": 45.026, "type": "RIGHT"}, {"time": 46.141, "type": "RIGHT"}, {"time": 46.141, "type": "LEFT"}, {"time": 46.741, "type": "UP_LEFT"}, {"time": 47.426, "type": "UP"}, {"time": 47.769, "type": "UP_RIGHT"}, {"time": 48.798, "type": "DOWN_RIGHT"}, {"time": 49.569, "type": "UP_RIGHT"}, {"time": 50.169, "type": "RIGHT"}, {"time": 50.512, "type": "UP_RIGHT"}, {"time": 51.456, "type": "UP"}, {"time": 51.456, "type": "DOWN"}, {"time": 52.141, "type": "DOWN_LEFT"}, {"time": 52.827, "type": "UP_RIGHT"}, {"time": 53.256, "type": "DOWN_LEFT"}, {"time": 54.284, "type": "RIGHT"}, {"time": 54.97, "type": "LEFT"}, {"time": 55.227, "type": "DOWN_LEFT"}, {"time": 55.656, "type": "UP"}, {"time": 55.827, "type": "UP_RIGHT"}, {"time": 56.342, "type": "UP"}, {"time": 56.684, "type": "DOWN"}, {"time": 56.942, "type": "UP"}, {"time": 57.113, "type": "REVERSE"}, {"time": 57.713, "type": "LEFT"}, {"time": 57.97, "type": "DOWN_LEFT"}, {"time": 58.399, "type": "UP"}, {"time": 58.57, "type": "UP_RIGHT"}, {"time": 59.085, "type": "UP"}, {"time": 59.427, "type": "DOWN"}, {"time": 59.685, "type": "UP"}, {"time": 59.856, "type": "REVERSE_BACK"}, {"time": 60.456, "type": "LEFT"}, {"time": 60.713, "type": "DOWN_LEFT"}, {"time": 61.142, "type": "UP"}, {"time": 61.313, "type": "UP_RIGHT"}, {"time": 61.828, "type": "UP"}, {"time": 62.17, "type": "DOWN"}, {"time": 62.428, "type": "UP"}, {"time": 62.599, "type": "REVERSE"}, {"time": 63.199, "type": "LEFT"}, {"time": 63.456, "type": "DOWN_LEFT"}, {"time": 63.885, "type": "UP"}, {"time": 64.056, "type": "UP_RIGHT"}, {"time": 64.571, "type": "UP"}, {"time": 64.913, "type": "DOWN"}, {"time": 65.171, "type": "UP"}, {"time": 65.342, "type": "REVERSE_BACK"}, {"time": 65.941, "type": "LEFT"}, {"time": 66.198, "type": "DOWN_LEFT"}, {"time": 66.627, "type": "UP"}, {"time": 66.798, "type": "UP_RIGHT"}, {"time": 67.313, "type": "UP"}, {"time": 67.655, "type": "DOWN"}, {"time": 67.913, "type": "UP"}, {"time": 68.084, "type": "REVERSE"}, {"time": 68.684, "type": "LEFT"}, {"time": 68.941, "type": "DOWN_LEFT"}, {"time": 69.37, "type": "UP"}, {"time": 69.541, "type": "UP_RIGHT"}, {"time": 70.056, "type": "UP"}, {"time": 70.398, "type": "DOWN"}, {"time": 70.656, "type": "UP"}, {"time": 70.827, "type": "REVERSE_BACK"}, {"time": 71.427, "type": "UP"}, {"time": 72.113, "type": "RIGHT"}, {"time": 72.713, "type": "RIGHT"}, {"time": 73.056, "type": "DOWN"}, {"time": 73.398, "type": "UP"}, {"time": 73.827, "type": "UP"}, {"time": 74.17, "type": "UP"}, {"time": 74.684, "type": "RIGHT"}, {"time": 75.456, "type": "RIGHT"}, {"time": 75.798, "type": "DOWN"}, {"time": 76.227, "type": "LEFT"}, {"time": 76.656, "type": "LEFT"}, {"time": 77.084, "type": "UP"}], "events": [{"time": 20.598, "type": "BG_COLOR", "color": "#deddda"}, {"time": 20.598, "type": "FLASH"}, {"time": 20.941, "type": "BG_COLOR", "color": "#2ec27e"}, {"time": 20.941, "type": "FLASH"}, {"time": 21.284, "type": "BG_COLOR", "color": "#813d9c"}, {"time": 21.284, "type": "FLASH"}, {"time": 21.627, "type": "FLASH"}, {"time": 21.627, "type": "BG_COLOR", "color": "#ff0000"}, {"time": 21.627, "type": "FLASH"}, {"time": 21.97, "type": "FLASH"}, {"time": 21.97, "type": "CAMERA_BOB_ON"}, {"time": 21.97, "type": "FX_PIXELATE", "duration": 21.943}, {"time": 26.864, "type": "NOTES_FLOW_RIGHT"}, {"time": 32.434, "type": "NOTES_FLOW_LEFT"}, {"time": 37.863, "type": "NOTES_FLOW_RIGHT"}, {"time": 40.557, "type": "NOTES_FLOW_LEFT"}, {"time": 43.913, "type": "FLASH"}, {"time": 43.913, "type": "BG_COLOR", "color": "#3584e4"}, {"time": 43.913, "type": "CAMERA_BOB_OFF"}, {"time": 44.598, "type": "FLASH"}, {"time": 46.141, "type": "FLASH"}, {"time": 47.427, "type": "FLASH"}, {"time": 48.798, "type": "FLASH"}, {"time": 50.084, "type": "FLASH"}, {"time": 51.456, "type": "FLASH"}, {"time": 52.827, "type": "FLASH"}, {"time": 54.284, "type": "FLASH"}, {"time": 54.97, "type": "FLASH"}, {"time": 54.97, "type": "CAMERA_BOB_ON"}, {"time": 54.97, "type": "BG_COLOR", "color": "#ff0000"}, {"time": 54.97, "type": "FX_PIXELATE", "duration": 16.457}, {"time": 57.113, "type": "NOTES_FLOW_RIGHT"}, {"time": 59.856, "type": "NOTES_FLOW_LEFT"}, {"time": 62.599, "type": "NOTES_FLOW_RIGHT"}, {"time": 65.342, "type": "NOTES_FLOW_LEFT"}, {"time": 68.084, "type": "NOTES_FLOW_RIGHT"}, {"time": 70.827, "type": "NOTES_FLOW_LEFT"}, {"time": 71.427, "type": "CAMERA_BOB_OFF"}, {"time": 71.427, "type": "FLASH"}], "audioFile": "track.mp3", "audioFormat": "mp3"}}}}, "RCGD VERSE, Vol. 2": {"id": "RCGD VERSE, Vol. 2", "title": "RCGD VERSE, Vol. 2", "author": "Arvicheskyy, ᴛᴠxᴏᴅᴀ", "songs": {"ICNWKIC": {"folder": "ICNWKIC", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/ICNWKIC/track.mp3", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "ICNWKIC", "artist": "Arvicheskyy", "difficulty": 3.5, "menu_color": "#b32222"}, "chart": {"bpm": 100, "noteTravelTime": 1000, "notes": [{"time": 0.03, "type": "RIGHT"}, {"time": 0.33, "type": "UP"}, {"time": 0.63, "type": "RIGHT"}, {"time": 0.93, "type": "DOWN"}, {"time": 1.23, "type": "RIGHT"}, {"time": 2.43, "type": "LEFT"}, {"time": 2.73, "type": "DOWN"}, {"time": 3.03, "type": "RIGHT"}, {"time": 3.33, "type": "UP"}, {"time": 3.63, "type": "RIGHT"}, {"time": 3.93, "type": "UP"}, {"time": 4.23, "type": "RIGHT"}, {"time": 4.53, "type": "DOWN"}, {"time": 4.83, "type": "RIGHT"}, {"time": 5.13, "type": "UP_RIGHT"}, {"time": 5.43, "type": "UP"}, {"time": 5.73, "type": "UP_LEFT"}, {"time": 6.03, "type": "LEFT"}, {"time": 7.23, "type": "UP"}, {"time": 7.53, "type": "DOWN"}, {"time": 7.83, "type": "UP"}, {"time": 8.13, "type": "DOWN"}, {"time": 8.43, "type": "RIGHT"}, {"time": 8.73, "type": "DOWN"}, {"time": 9.03, "type": "RIGHT"}, {"time": 9.33, "type": "UP"}, {"time": 9.63, "type": "RIGHT"}, {"time": 9.93, "type": "DOWN"}, {"time": 10.23, "type": "LEFT"}, {"time": 10.53, "type": "UP"}, {"time": 10.83, "type": "RIGHT"}, {"time": 12.03, "type": "UP"}, {"time": 12.33, "type": "UP"}, {"time": 12.63, "type": "UP"}, {"time": 12.93, "type": "DOWN"}, {"time": 13.23, "type": "DOWN"}, {"time": 13.53, "type": "DOWN"}, {"time": 13.83, "type": "RIGHT"}, {"time": 14.13, "type": "RIGHT"}, {"time": 14.43, "type": "UP"}, {"time": 14.73, "type": "RIGHT"}, {"time": 15.03, "type": "UP"}, {"time": 15.33, "type": "RIGHT"}, {"time": 15.63, "type": "UP_RIGHT"}, {"time": 16.83, "type": "UP"}, {"time": 17.13, "type": "RIGHT"}, {"time": 17.43, "type": "UP_RIGHT"}, {"time": 17.73, "type": "UP_RIGHT"}, {"time": 18.03, "type": "RIGHT"}, {"time": 18.33, "type": "RIGHT"}, {"time": 18.63, "type": "DOWN_RIGHT"}, {"time": 18.93, "type": "DOWN_RIGHT"}, {"time": 19.237, "type": "LEFT"}, {"time": 19.537, "type": "DOWN"}, {"time": 19.837, "type": "RIGHT"}, {"time": 20.137, "type": "UP"}, {"time": 20.437, "type": "RIGHT"}, {"time": 20.437, "type": "LEFT"}, {"time": 21.63, "type": "UP_RIGHT"}, {"time": 21.93, "type": "UP_RIGHT"}, {"time": 22.23, "type": "RIGHT"}, {"time": 22.53, "type": "RIGHT"}, {"time": 22.83, "type": "DOWN"}, {"time": 23.13, "type": "UP"}, {"time": 23.43, "type": "DOWN"}, {"time": 23.73, "type": "UP"}, {"time": 24.025, "type": "LEFT"}, {"time": 24.33, "type": "RIGHT"}, {"time": 24.625, "type": "RIGHT"}, {"time": 24.93, "type": "UP"}, {"time": 25.23, "type": "DOWN"}, {"time": 26.43, "type": "UP"}, {"time": 26.73, "type": "UP"}, {"time": 27.03, "type": "UP"}, {"time": 27.33, "type": "DOWN"}, {"time": 27.63, "type": "DOWN"}, {"time": 27.93, "type": "DOWN"}, {"time": 28.23, "type": "RIGHT"}, {"time": 28.53, "type": "DOWN"}, {"time": 28.83, "type": "RIGHT"}, {"time": 29.13, "type": "DOWN"}, {"time": 29.43, "type": "UP"}, {"time": 29.73, "type": "UP_RIGHT"}, {"time": 30.03, "type": "REVERSE"}, {"time": 31.23, "type": "RIGHT"}, {"time": 31.53, "type": "LEFT"}, {"time": 31.83, "type": "UP"}, {"time": 32.13, "type": "RIGHT"}, {"time": 32.43, "type": "LEFT"}, {"time": 32.73, "type": "UP"}, {"time": 33.03, "type": "DOWN"}, {"time": 33.33, "type": "UP"}, {"time": 33.63, "type": "UP_RIGHT"}, {"time": 33.93, "type": "UP_LEFT"}, {"time": 34.23, "type": "UP_RIGHT"}, {"time": 34.53, "type": "UP_LEFT"}, {"time": 34.83, "type": "UP_RIGHT"}, {"time": 35.73, "type": "DOWN_RIGHT"}, {"time": 36.03, "type": "DOWN_LEFT"}, {"time": 36.33, "type": "DOWN_RIGHT"}, {"time": 36.63, "type": "DOWN_LEFT"}, {"time": 36.93, "type": "DOWN_RIGHT"}, {"time": 37.23, "type": "DOWN_LEFT"}, {"time": 37.53, "type": "UP"}, {"time": 37.83, "type": "DOWN"}, {"time": 38.13, "type": "UP"}, {"time": 38.43, "type": "LEFT"}, {"time": 38.73, "type": "RIGHT"}, {"time": 39.06, "type": "LEFT"}, {"time": 39.36, "type": "RIGHT"}, {"time": 39.63, "type": "UP"}, {"time": 40.83, "type": "DOWN"}, {"time": 41.13, "type": "RIGHT"}, {"time": 41.436, "type": "DOWN"}, {"time": 41.736, "type": "RIGHT"}, {"time": 42.03, "type": "DOWN"}, {"time": 42.33, "type": "UP"}, {"time": 42.628, "type": "DOWN"}, {"time": 42.928, "type": "UP"}, {"time": 43.23, "type": "UP"}, {"time": 43.53, "type": "UP_RIGHT"}, {"time": 43.83, "type": "RIGHT"}, {"time": 44.13, "type": "DOWN_RIGHT"}, {"time": 44.43, "type": "DOWN"}, {"time": 45.63, "type": "UP"}, {"time": 45.93, "type": "UP_RIGHT"}, {"time": 46.23, "type": "RIGHT"}, {"time": 46.53, "type": "DOWN_RIGHT"}, {"time": 46.83, "type": "DOWN"}, {"time": 47.13, "type": "RIGHT"}, {"time": 47.43, "type": "DOWN"}, {"time": 47.73, "type": "RIGHT"}, {"time": 48.03, "type": "DOWN"}, {"time": 48.33, "type": "DOWN_LEFT"}, {"time": 48.63, "type": "LEFT"}, {"time": 48.93, "type": "UP_LEFT"}, {"time": 49.23, "type": "REVERSE_BACK"}, {"time": 50.43, "type": "LEFT"}, {"time": 50.73, "type": "DOWN"}, {"time": 51.03, "type": "RIGHT"}, {"time": 51.33, "type": "UP"}, {"time": 51.63, "type": "RIGHT"}, {"time": 51.93, "type": "UP"}, {"time": 52.23, "type": "RIGHT"}, {"time": 52.53, "type": "DOWN"}, {"time": 52.83, "type": "RIGHT"}, {"time": 53.13, "type": "UP_RIGHT"}, {"time": 53.43, "type": "UP"}, {"time": 53.73, "type": "UP_LEFT"}, {"time": 54.03, "type": "LEFT"}, {"time": 55.23, "type": "UP"}, {"time": 55.53, "type": "DOWN"}, {"time": 55.83, "type": "UP"}, {"time": 56.13, "type": "DOWN"}, {"time": 56.43, "type": "RIGHT"}, {"time": 56.73, "type": "DOWN"}, {"time": 57.03, "type": "RIGHT"}, {"time": 57.33, "type": "UP"}, {"time": 57.63, "type": "RIGHT"}, {"time": 57.93, "type": "DOWN"}, {"time": 58.23, "type": "LEFT"}, {"time": 58.53, "type": "UP"}, {"time": 58.83, "type": "RIGHT"}, {"time": 60.63, "type": "RIGHT"}, {"time": 61.23, "type": "UP"}, {"time": 61.83, "type": "LEFT"}, {"time": 62.43, "type": "UP"}, {"time": 63.03, "type": "LEFT"}, {"time": 63.63, "type": "REVERSE"}, {"time": 65.43, "type": "RIGHT"}, {"time": 66.63, "type": "UP"}, {"time": 67.83, "type": "DOWN"}, {"time": 70.23, "type": "LEFT"}, {"time": 70.83, "type": "UP"}, {"time": 71.43, "type": "RIGHT"}, {"time": 72.03, "type": "DOWN"}, {"time": 72.63, "type": "UP"}, {"time": 73.23, "type": "REVERSE_BACK"}, {"time": 75.03, "type": "UP"}, {"time": 76.23, "type": "UP"}, {"time": 76.83, "type": "UP"}], "events": [{"time": 1.23, "type": "BLACKOUT", "duration": 0.9}, {"time": 6.03, "type": "BLACKOUT", "duration": 0.9}, {"time": 9.63, "type": "FLASH"}, {"time": 10.83, "type": "BLACKOUT", "duration": 0.9}, {"time": 15.63, "type": "BLACKOUT", "duration": 0.9}, {"time": 19.23, "type": "FLASH"}, {"time": 19.23, "type": "SHAKE"}, {"time": 19.23, "type": "NOTES_BOUNCE_ON"}, {"time": 20.43, "type": "BLACKOUT", "duration": 0.6}, {"time": 21.03, "type": "FLASH"}, {"time": 25.23, "type": "BLACKOUT", "duration": 0.6}, {"time": 25.83, "type": "FLASH"}, {"time": 30.03, "type": "BLACKOUT", "duration": 0.6}, {"time": 30.03, "type": "NOTES_FLOW_RIGHT"}, {"time": 30.63, "type": "FLASH"}, {"time": 34.83, "type": "BLACKOUT", "duration": 0.6}, {"time": 35.43, "type": "FLASH"}, {"time": 39.63, "type": "BLACKOUT", "duration": 0.75}, {"time": 40.38, "type": "FLASH"}, {"time": 44.43, "type": "BLACKOUT", "duration": 0.6}, {"time": 45.03, "type": "FLASH"}, {"time": 49.23, "type": "NOTES_FLOW_LEFT"}, {"time": 49.23, "type": "BLACKOUT", "duration": 0.6}, {"time": 49.83, "type": "FLASH"}, {"time": 54.03, "type": "BLACKOUT", "duration": 0.6}, {"time": 54.63, "type": "FLASH"}, {"time": 58.83, "type": "BLACKOUT", "duration": 1.2}, {"time": 63.63, "type": "NOTES_FLOW_RIGHT"}, {"time": 63.63, "type": "BLACKOUT", "duration": 1.2}, {"time": 63.78, "type": "NOTE_SPEED", "speed": 0.5}, {"time": 68.43, "type": "BLACKOUT", "duration": 1.2}, {"time": 73.23, "type": "BLACKOUT", "duration": 1.2}, {"time": 73.23, "type": "NOTES_FLOW_LEFT"}, {"time": 76.83, "type": "FLASH"}, {"time": 76.83, "type": "SHAKE"}, {"time": 79.23, "type": "BLACKOUT", "duration": 2.4}], "audioFile": "track.mp3", "audioFormat": "mp3"}}, "Just Chill 2": {"folder": "Just Chill 2", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/Just Chill 2/track.mp3", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "Just Chill 2", "artist": "Arvicheskyy", "difficulty": 2.0, "menu_color": "#b32222"}, "chart": {"bpm": 100, "noteTravelTime": 1000, "notes": [{"time": 2.443, "type": "UP"}, {"time": 2.743, "type": "DOWN"}, {"time": 3.043, "type": "UP"}, {"time": 3.343, "type": "RIGHT"}, {"time": 4.843, "type": "RIGHT"}, {"time": 5.143, "type": "DOWN_RIGHT"}, {"time": 5.443, "type": "RIGHT"}, {"time": 5.743, "type": "UP_RIGHT"}, {"time": 7.243, "type": "DOWN"}, {"time": 7.543, "type": "UP"}, {"time": 7.843, "type": "DOWN"}, {"time": 8.143, "type": "UP"}, {"time": 9.643, "type": "UP"}, {"time": 9.943, "type": "UP_RIGHT"}, {"time": 10.243, "type": "RIGHT"}, {"time": 10.543, "type": "DOWN_RIGHT"}, {"time": 12.043, "type": "DOWN_RIGHT"}, {"time": 12.343, "type": "RIGHT"}, {"time": 12.643, "type": "UP_RIGHT"}, {"time": 12.943, "type": "UP"}, {"time": 14.443, "type": "UP"}, {"time": 14.743, "type": "UP_LEFT"}, {"time": 15.043, "type": "LEFT"}, {"time": 15.343, "type": "DOWN_LEFT"}, {"time": 16.843, "type": "DOWN"}, {"time": 17.143, "type": "DOWN_RIGHT"}, {"time": 17.443, "type": "RIGHT"}, {"time": 17.743, "type": "UP_RIGHT"}, {"time": 19.243, "type": "UP"}, {"time": 19.543, "type": "UP_LEFT"}, {"time": 19.843, "type": "LEFT"}, {"time": 20.143, "type": "DOWN_LEFT"}, {"time": 21.643, "type": "DOWN"}, {"time": 21.943, "type": "DOWN_RIGHT"}, {"time": 22.243, "type": "RIGHT"}, {"time": 22.543, "type": "UP_RIGHT"}, {"time": 24.043, "type": "UP"}, {"time": 24.343, "type": "UP_LEFT"}, {"time": 24.643, "type": "LEFT"}, {"time": 24.943, "type": "DOWN_LEFT"}, {"time": 26.443, "type": "DOWN"}, {"time": 26.743, "type": "DOWN_RIGHT"}, {"time": 27.043, "type": "RIGHT"}, {"time": 27.343, "type": "UP_RIGHT"}, {"time": 28.843, "type": "UP"}, {"time": 29.143, "type": "UP_LEFT"}, {"time": 29.443, "type": "LEFT"}, {"time": 29.743, "type": "DOWN_LEFT"}, {"time": 31.243, "type": "DOWN"}, {"time": 31.543, "type": "DOWN_RIGHT"}, {"time": 31.843, "type": "RIGHT"}, {"time": 32.143, "type": "UP_RIGHT"}, {"time": 33.643, "type": "UP"}, {"time": 33.943, "type": "UP_LEFT"}, {"time": 34.243, "type": "LEFT"}, {"time": 34.543, "type": "DOWN_LEFT"}, {"time": 36.043, "type": "UP"}, {"time": 36.643, "type": "UP"}, {"time": 37.243, "type": "RIGHT"}, {"time": 37.843, "type": "DOWN"}, {"time": 38.443, "type": "UP"}, {"time": 39.043, "type": "RIGHT"}, {"time": 39.643, "type": "UP"}, {"time": 40.243, "type": "UP_LEFT"}, {"time": 40.843, "type": "UP"}, {"time": 41.443, "type": "UP_LEFT"}, {"time": 42.043, "type": "UP"}, {"time": 42.643, "type": "UP_RIGHT"}, {"time": 43.243, "type": "UP"}, {"time": 43.843, "type": "UP_LEFT"}, {"time": 44.443, "type": "LEFT"}, {"time": 45.043, "type": "UP_LEFT"}, {"time": 45.643, "type": "LEFT"}, {"time": 46.243, "type": "DOWN_LEFT"}, {"time": 46.843, "type": "DOWN"}, {"time": 47.443, "type": "DOWN_RIGHT"}, {"time": 48.043, "type": "UP"}, {"time": 48.643, "type": "UP_LEFT"}, {"time": 49.243, "type": "LEFT"}, {"time": 49.843, "type": "UP_LEFT"}, {"time": 50.443, "type": "UP"}, {"time": 51.043, "type": "UP_RIGHT"}, {"time": 51.643, "type": "RIGHT"}, {"time": 52.243, "type": "DOWN_RIGHT"}, {"time": 52.843, "type": "RIGHT"}, {"time": 53.443, "type": "UP_RIGHT"}, {"time": 54.043, "type": "UP"}, {"time": 54.643, "type": "UP_LEFT"}, {"time": 55.243, "type": "UP"}, {"time": 55.843, "type": "UP_RIGHT"}, {"time": 56.443, "type": "UP"}, {"time": 57.043, "type": "UP_LEFT"}, {"time": 57.643, "type": "DOWN"}, {"time": 58.243, "type": "DOWN_RIGHT"}, {"time": 58.843, "type": "RIGHT"}, {"time": 59.443, "type": "DOWN_RIGHT"}, {"time": 60.043, "type": "DOWN"}, {"time": 60.643, "type": "DOWN_LEFT"}, {"time": 61.243, "type": "LEFT"}, {"time": 61.843, "type": "DOWN_LEFT"}, {"time": 62.443, "type": "DOWN"}, {"time": 63.043, "type": "DOWN_RIGHT"}, {"time": 63.643, "type": "RIGHT"}, {"time": 64.243, "type": "DOWN"}, {"time": 64.843, "type": "UP"}, {"time": 65.443, "type": "LEFT"}, {"time": 66.043, "type": "RIGHT"}, {"time": 66.643, "type": "DOWN"}, {"time": 67.243, "type": "UP"}, {"time": 67.843, "type": "UP_RIGHT"}, {"time": 68.443, "type": "RIGHT"}, {"time": 69.043, "type": "UP_RIGHT"}, {"time": 69.643, "type": "UP"}, {"time": 70.243, "type": "UP_LEFT"}, {"time": 70.843, "type": "LEFT"}, {"time": 71.443, "type": "UP_LEFT"}, {"time": 72.043, "type": "UP"}, {"time": 72.643, "type": "UP_RIGHT"}, {"time": 73.243, "type": "RIGHT"}, {"time": 73.843, "type": "RIGHT"}, {"time": 74.443, "type": "DOWN"}, {"time": 75.043, "type": "UP"}, {"time": 75.643, "type": "DOWN"}, {"time": 76.243, "type": "UP"}, {"time": 76.843, "type": "RIGHT"}, {"time": 77.443, "type": "RIGHT"}, {"time": 78.043, "type": "UP"}, {"time": 78.643, "type": "UP"}, {"time": 79.243, "type": "DOWN"}, {"time": 79.843, "type": "DOWN"}, {"time": 80.443, "type": "LEFT"}, {"time": 81.043, "type": "LEFT"}, {"time": 81.643, "type": "UP"}, {"time": 82.243, "type": "UP"}, {"time": 82.843, "type": "RIGHT"}, {"time": 83.443, "type": "RIGHT"}, {"time": 84.043, "type": "UP_RIGHT"}, {"time": 84.643, "type": "UP_RIGHT"}, {"time": 85.243, "type": "DOWN_RIGHT"}, {"time": 85.843, "type": "DOWN_RIGHT"}, {"time": 86.443, "type": "DOWN_LEFT"}, {"time": 87.043, "type": "DOWN_LEFT"}, {"time": 87.643, "type": "UP_LEFT"}, {"time": 88.243, "type": "UP_LEFT"}, {"time": 88.843, "type": "UP"}, {"time": 89.443, "type": "UP"}, {"time": 90.043, "type": "DOWN"}, {"time": 90.643, "type": "DOWN"}, {"time": 91.243, "type": "LEFT"}, {"time": 91.843, "type": "RIGHT"}, {"time": 92.443, "type": "LEFT"}, {"time": 93.043, "type": "RIGHT"}, {"time": 93.643, "type": "UP"}, {"time": 94.243, "type": "DOWN"}, {"time": 94.843, "type": "UP"}, {"time": 95.443, "type": "DOWN"}, {"time": 96.043, "type": "REVERSE"}, {"time": 96.601, "type": "RIGHT"}, {"time": 97.201, "type": "UP"}, {"time": 97.801, "type": "UP_LEFT"}, {"time": 98.401, "type": "UP"}, {"time": 99.001, "type": "UP_LEFT"}, {"time": 99.601, "type": "UP"}, {"time": 100.201, "type": "UP_RIGHT"}, {"time": 100.801, "type": "UP"}, {"time": 101.401, "type": "UP_LEFT"}, {"time": 102.001, "type": "LEFT"}, {"time": 102.601, "type": "UP_LEFT"}, {"time": 103.201, "type": "LEFT"}, {"time": 103.801, "type": "DOWN_LEFT"}, {"time": 104.401, "type": "DOWN"}, {"time": 105.001, "type": "DOWN_RIGHT"}, {"time": 105.601, "type": "UP"}, {"time": 106.201, "type": "UP_LEFT"}, {"time": 106.801, "type": "LEFT"}, {"time": 107.401, "type": "UP_LEFT"}, {"time": 108.001, "type": "UP"}, {"time": 108.601, "type": "UP_RIGHT"}, {"time": 109.201, "type": "RIGHT"}, {"time": 109.801, "type": "DOWN_RIGHT"}, {"time": 110.401, "type": "RIGHT"}, {"time": 111.001, "type": "UP_RIGHT"}, {"time": 111.601, "type": "UP"}, {"time": 112.201, "type": "UP_LEFT"}, {"time": 112.801, "type": "UP"}, {"time": 113.401, "type": "UP_RIGHT"}, {"time": 114.001, "type": "UP"}, {"time": 114.601, "type": "UP_LEFT"}, {"time": 115.201, "type": "DOWN"}, {"time": 115.801, "type": "DOWN_RIGHT"}, {"time": 116.401, "type": "RIGHT"}, {"time": 117.001, "type": "DOWN_RIGHT"}, {"time": 117.601, "type": "DOWN"}, {"time": 118.201, "type": "DOWN_LEFT"}, {"time": 118.801, "type": "LEFT"}, {"time": 119.401, "type": "DOWN_LEFT"}, {"time": 120.001, "type": "DOWN"}, {"time": 120.601, "type": "DOWN_RIGHT"}, {"time": 121.201, "type": "RIGHT"}, {"time": 121.801, "type": "DOWN"}, {"time": 122.401, "type": "UP"}, {"time": 123.001, "type": "LEFT"}, {"time": 123.601, "type": "RIGHT"}, {"time": 124.201, "type": "DOWN"}, {"time": 124.801, "type": "UP"}, {"time": 125.401, "type": "UP_RIGHT"}, {"time": 126.001, "type": "RIGHT"}, {"time": 126.601, "type": "UP_RIGHT"}, {"time": 127.201, "type": "UP"}, {"time": 127.801, "type": "UP_LEFT"}, {"time": 128.401, "type": "LEFT"}, {"time": 129.001, "type": "UP_LEFT"}, {"time": 129.601, "type": "UP"}, {"time": 130.201, "type": "UP_RIGHT"}, {"time": 130.801, "type": "RIGHT"}, {"time": 131.401, "type": "RIGHT"}, {"time": 132.001, "type": "DOWN"}, {"time": 132.601, "type": "UP"}, {"time": 133.201, "type": "DOWN"}, {"time": 133.801, "type": "UP"}, {"time": 134.401, "type": "RIGHT"}], "events": [{"time": 0, "type": "BG_COLOR", "color": "#000000"}, {"time": 0.193, "type": "BG_COLOR", "duration": 38.55, "color": "#62a0ea"}, {"time": 36.043, "type": "FLASH"}, {"time": 36.643, "type": "FLASH"}, {"time": 37.243, "type": "FLASH"}, {"time": 37.843, "type": "FLASH"}, {"time": 38.443, "type": "CAMERA_BOB_ON"}, {"time": 38.443, "type": "FLASH"}, {"time": 48.043, "type": "FLASH"}, {"time": 57.643, "type": "FLASH"}, {"time": 66.643, "type": "FLASH"}, {"time": 76.843, "type": "FLASH"}, {"time": 76.843, "type": "CAMERA_BOB_OFF"}, {"time": 76.843, "type": "BG_COLOR", "color": "#241f31"}, {"time": 79.243, "type": "FLASH"}, {"time": 81.643, "type": "FLASH"}, {"time": 84.043, "type": "FLASH"}, {"time": 86.443, "type": "FLASH"}, {"time": 88.843, "type": "FLASH"}, {"time": 91.243, "type": "FLASH"}, {"time": 93.643, "type": "HUD_HIDE"}, {"time": 93.643, "type": "FLASH"}, {"time": 94.243, "type": "FLASH"}, {"time": 94.843, "type": "FLASH"}, {"time": 95.443, "type": "FLASH"}, {"time": 96.043, "type": "FLASH"}, {"time": 96.043, "type": "HUD_SHOW"}, {"time": 96.043, "type": "NOTES_FLOW_RIGHT"}, {"time": 96.043, "type": "CAMERA_BOB_ON"}, {"time": 96.043, "type": "BG_COLOR", "color": "#62a0ea"}, {"time": 96.193, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 105.643, "type": "FLASH"}, {"time": 115.243, "type": "FLASH"}, {"time": 124.843, "type": "FLASH"}, {"time": 132.043, "type": "CAMERA_BOB_OFF"}, {"time": 132.043, "type": "FLASH"}, {"time": 132.043, "type": "HUD_HIDE"}, {"time": 136.843, "type": "BLACKOUT", "duration": 2.4}], "audioFile": "track.mp3", "audioFormat": "mp3"}}, "Nelis exe V2": {"folder": "Nelis exe V2", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/Nelis exe V2/track.mp3", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "Nelis exe V2", "artist": "Arvicheskyy", "difficulty": 4, "menu_color": "#630000"}, "chart": {"bpm": 140, "noteTravelTime": 1000, "gridOffset": 0.05, "timing": [{"time": 0.05, "bpm": 140}], "title": "Nelis exe V2", "artist": "Arvicheskyy", "notes": [{"time": 0.05, "type": "UP"}, {"time": 0.907, "type": "DOWN"}, {"time": 1.336, "type": "UP"}, {"time": 1.764, "type": "DOWN"}, {"time": 2.621, "type": "UP"}, {"time": 3.05, "type": "DOWN"}, {"time": 3.479, "type": "UP"}, {"time": 4.336, "type": "DOWN"}, {"time": 4.765, "type": "UP"}, {"time": 5.193, "type": "DOWN"}, {"time": 6.05, "type": "UP"}, {"time": 6.479, "type": "DOWN"}, {"time": 6.908, "type": "UP"}, {"time": 7.764, "type": "DOWN"}, {"time": 8.193, "type": "UP"}, {"time": 8.621, "type": "DOWN"}, {"time": 9.478, "type": "UP"}, {"time": 9.907, "type": "DOWN"}, {"time": 10.336, "type": "UP"}, {"time": 11.193, "type": "DOWN"}, {"time": 11.622, "type": "UP"}, {"time": 12.05, "type": "DOWN"}, {"time": 12.907, "type": "UP"}, {"time": 13.336, "type": "DOWN"}, {"time": 13.765, "type": "UP"}, {"time": 14.621, "type": "DOWN"}, {"time": 15.05, "type": "UP"}, {"time": 15.478, "type": "DOWN"}, {"time": 16.335, "type": "UP"}, {"time": 16.764, "type": "DOWN"}, {"time": 17.193, "type": "UP"}, {"time": 18.05, "type": "DOWN"}, {"time": 18.479, "type": "UP"}, {"time": 18.907, "type": "DOWN"}, {"time": 19.764, "type": "UP"}, {"time": 20.193, "type": "DOWN"}, {"time": 20.622, "type": "UP"}, {"time": 21.479, "type": "DOWN"}, {"time": 21.908, "type": "UP"}, {"time": 22.336, "type": "DOWN"}, {"time": 23.193, "type": "UP"}, {"time": 23.622, "type": "DOWN"}, {"time": 24.051, "type": "UP"}, {"time": 24.907, "type": "UP"}, {"time": 25.764, "type": "UP"}, {"time": 26.621, "type": "UP"}, {"time": 27.479, "type": "UP"}, {"time": 27.907, "type": "RIGHT"}, {"time": 28.121, "type": "RIGHT"}, {"time": 28.336, "type": "RIGHT"}, {"time": 28.764, "type": "UP"}, {"time": 28.979, "type": "UP"}, {"time": 29.193, "type": "DOWN"}, {"time": 29.621, "type": "DOWN"}, {"time": 29.836, "type": "DOWN"}, {"time": 30.05, "type": "RIGHT"}, {"time": 30.264, "type": "UP"}, {"time": 30.479, "type": "DOWN"}, {"time": 30.693, "type": "UP"}, {"time": 30.907, "type": "UP"}, {"time": 31.336, "type": "UP"}, {"time": 31.55, "type": "DOWN"}, {"time": 31.764, "type": "UP"}, {"time": 32.193, "type": "LEFT"}, {"time": 32.407, "type": "RIGHT"}, {"time": 32.621, "type": "LEFT"}, {"time": 33.05, "type": "LEFT"}, {"time": 33.264, "type": "LEFT"}, {"time": 33.479, "type": "UP"}, {"time": 33.693, "type": "DOWN"}, {"time": 33.907, "type": "UP"}, {"time": 34.121, "type": "RIGHT"}, {"time": 34.336, "type": "RIGHT"}, {"time": 34.764, "type": "UP"}, {"time": 34.979, "type": "DOWN"}, {"time": 35.193, "type": "UP"}, {"time": 35.621, "type": "UP"}, {"time": 35.836, "type": "UP"}, {"time": 36.05, "type": "RIGHT"}, {"time": 36.479, "type": "LEFT"}, {"time": 36.693, "type": "LEFT"}, {"time": 36.907, "type": "UP"}, {"time": 37.121, "type": "UP"}, {"time": 37.336, "type": "DOWN"}, {"time": 37.55, "type": "UP"}, {"time": 37.764, "type": "RIGHT"}, {"time": 38.193, "type": "RIGHT"}, {"time": 38.407, "type": "LEFT"}, {"time": 38.621, "type": "RIGHT"}, {"time": 39.05, "type": "UP"}, {"time": 39.264, "type": "RIGHT"}, {"time": 39.479, "type": "DOWN"}, {"time": 39.907, "type": "LEFT"}, {"time": 40.121, "type": "LEFT"}, {"time": 40.336, "type": "UP"}, {"time": 40.55, "type": "RIGHT"}, {"time": 40.764, "type": "DOWN"}, {"time": 40.979, "type": "UP"}, {"time": 41.193, "type": "RIGHT"}, {"time": 41.621, "type": "RIGHT"}, {"time": 42.05, "type": "LEFT"}, {"time": 42.479, "type": "RIGHT"}, {"time": 42.907, "type": "LEFT"}, {"time": 43.336, "type": "UP"}, {"time": 43.764, "type": "DOWN"}, {"time": 44.193, "type": "UP"}, {"time": 44.621, "type": "REVERSE"}, {"time": 45.05, "type": "RIGHT"}, {"time": 45.479, "type": "LEFT"}, {"time": 45.908, "type": "RIGHT"}, {"time": 46.336, "type": "LEFT"}, {"time": 46.765, "type": "UP"}, {"time": 47.193, "type": "DOWN"}, {"time": 47.622, "type": "UP"}, {"time": 48.05, "type": "REVERSE_BACK"}, {"time": 48.479, "type": "UP_RIGHT"}, {"time": 48.907, "type": "UP_LEFT"}, {"time": 49.336, "type": "UP_RIGHT"}, {"time": 49.764, "type": "UP_LEFT"}, {"time": 50.193, "type": "DOWN_RIGHT"}, {"time": 50.621, "type": "DOWN_LEFT"}, {"time": 51.05, "type": "DOWN_RIGHT"}, {"time": 51.479, "type": "REVERSE"}, {"time": 51.908, "type": "UP_RIGHT"}, {"time": 52.336, "type": "UP_LEFT"}, {"time": 52.765, "type": "UP_RIGHT"}, {"time": 53.193, "type": "UP_LEFT"}, {"time": 53.622, "type": "DOWN_RIGHT"}, {"time": 54.05, "type": "DOWN_LEFT"}, {"time": 54.479, "type": "DOWN_RIGHT"}, {"time": 54.907, "type": "REVERSE_BACK"}, {"time": 55.764, "type": "UP"}, {"time": 56.621, "type": "DOWN"}, {"time": 57.479, "type": "UP"}, {"time": 57.693, "type": "DOWN"}, {"time": 57.907, "type": "UP"}, {"time": 58.336, "type": "LEFT"}, {"time": 59.193, "type": "RIGHT"}, {"time": 60.05, "type": "LEFT"}, {"time": 60.907, "type": "RIGHT"}, {"time": 61.121, "type": "LEFT"}, {"time": 61.336, "type": "RIGHT"}, {"time": 61.764, "type": "LEFT"}, {"time": 62.621, "type": "UP"}, {"time": 63.478, "type": "DOWN"}, {"time": 64.336, "type": "UP"}, {"time": 64.55, "type": "DOWN"}, {"time": 64.764, "type": "UP"}, {"time": 65.193, "type": "LEFT"}, {"time": 66.05, "type": "RIGHT"}, {"time": 66.907, "type": "LEFT"}, {"time": 67.764, "type": "RIGHT"}, {"time": 67.978, "type": "LEFT"}, {"time": 68.193, "type": "RIGHT"}, {"time": 68.621, "type": "LEFT"}, {"time": 69.05, "type": "REVERSE"}, {"time": 69.264, "type": "DOWN"}, {"time": 69.479, "type": "REVERSE_BACK"}, {"time": 69.907, "type": "RIGHT"}, {"time": 70.336, "type": "LEFT"}, {"time": 70.764, "type": "REVERSE"}, {"time": 70.979, "type": "UP"}, {"time": 71.193, "type": "REVERSE_BACK"}, {"time": 71.621, "type": "UP"}, {"time": 72.05, "type": "DOWN"}, {"time": 72.479, "type": "REVERSE"}, {"time": 72.693, "type": "DOWN"}, {"time": 72.908, "type": "REVERSE_BACK"}, {"time": 73.336, "type": "RIGHT"}, {"time": 73.765, "type": "LEFT"}, {"time": 74.193, "type": "REVERSE"}, {"time": 74.408, "type": "UP"}, {"time": 74.622, "type": "REVERSE_BACK"}, {"time": 75.05, "type": "UP"}, {"time": 75.479, "type": "DOWN"}, {"time": 75.907, "type": "REVERSE"}, {"time": 76.121, "type": "DOWN"}, {"time": 76.336, "type": "REVERSE_BACK"}, {"time": 76.764, "type": "RIGHT"}, {"time": 77.193, "type": "LEFT"}, {"time": 77.621, "type": "REVERSE"}, {"time": 77.836, "type": "UP"}, {"time": 78.05, "type": "REVERSE_BACK"}, {"time": 78.478, "type": "UP"}, {"time": 78.907, "type": "DOWN"}, {"time": 79.336, "type": "REVERSE"}, {"time": 79.55, "type": "DOWN"}, {"time": 79.765, "type": "REVERSE_BACK"}, {"time": 80.193, "type": "RIGHT"}, {"time": 80.622, "type": "LEFT"}, {"time": 81.05, "type": "REVERSE"}, {"time": 81.265, "type": "UP"}, {"time": 81.479, "type": "REVERSE_BACK"}, {"time": 81.907, "type": "UP"}, {"time": 82.336, "type": "DOWN"}, {"time": 82.764, "type": "RIGHT"}, {"time": 82.978, "type": "RIGHT"}, {"time": 83.193, "type": "RIGHT"}, {"time": 83.621, "type": "UP"}, {"time": 83.836, "type": "UP"}, {"time": 84.05, "type": "DOWN"}, {"time": 84.478, "type": "DOWN"}, {"time": 84.693, "type": "DOWN"}, {"time": 84.907, "type": "RIGHT"}, {"time": 85.121, "type": "UP"}, {"time": 85.336, "type": "DOWN"}, {"time": 85.55, "type": "UP"}, {"time": 85.764, "type": "UP"}, {"time": 86.193, "type": "UP"}, {"time": 86.407, "type": "DOWN"}, {"time": 86.621, "type": "UP"}, {"time": 87.05, "type": "LEFT"}, {"time": 87.264, "type": "RIGHT"}, {"time": 87.478, "type": "LEFT"}, {"time": 87.907, "type": "LEFT"}, {"time": 88.121, "type": "LEFT"}, {"time": 88.336, "type": "UP"}, {"time": 88.55, "type": "DOWN"}, {"time": 88.764, "type": "UP"}, {"time": 88.978, "type": "RIGHT"}, {"time": 89.193, "type": "RIGHT"}, {"time": 89.621, "type": "UP"}, {"time": 89.836, "type": "DOWN"}, {"time": 90.05, "type": "UP"}, {"time": 90.478, "type": "UP"}, {"time": 90.693, "type": "UP"}, {"time": 90.907, "type": "RIGHT"}, {"time": 91.336, "type": "LEFT"}, {"time": 91.55, "type": "LEFT"}, {"time": 91.764, "type": "UP"}, {"time": 91.978, "type": "UP"}, {"time": 92.193, "type": "DOWN"}, {"time": 92.407, "type": "UP"}, {"time": 92.621, "type": "RIGHT"}, {"time": 93.05, "type": "RIGHT"}, {"time": 93.264, "type": "LEFT"}, {"time": 93.478, "type": "RIGHT"}, {"time": 93.907, "type": "UP"}, {"time": 94.121, "type": "RIGHT"}, {"time": 94.336, "type": "DOWN"}, {"time": 94.764, "type": "LEFT"}, {"time": 94.978, "type": "LEFT"}, {"time": 95.193, "type": "UP"}, {"time": 95.407, "type": "RIGHT"}, {"time": 95.621, "type": "DOWN"}, {"time": 95.836, "type": "UP"}], "events": [{"time": 6.907, "type": "FLASH"}, {"time": 10.336, "type": "FLASH"}, {"time": 13.764, "type": "FLASH"}, {"time": 15.479, "type": "FLASH"}, {"time": 17.193, "type": "FLASH"}, {"time": 18.854, "type": "FLASH"}, {"time": 20.621, "type": "FLASH"}, {"time": 22.336, "type": "FLASH"}, {"time": 24.05, "type": "FLASH", "duration": 3.429}, {"time": 27.479, "type": "CAMERA_BOB_ON"}, {"time": 27.479, "type": "BG_COLOR", "color": "#630000"}, {"time": 27.479, "type": "FX_RGB_SPLIT", "duration": 27.428}, {"time": 27.532, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 41.139, "type": "NOTE_PUSH_ON"}, {"time": 41.139, "type": "DISCO", "duration": 13.765}, {"time": 41.193, "type": "FLASH"}, {"time": 41.246, "type": "FLASH", "duration": 3.372}, {"time": 44.621, "type": "NOTES_FLOW_RIGHT"}, {"time": 44.621, "type": "FLASH", "duration": 3.427}, {"time": 48.05, "type": "NOTES_FLOW_LEFT"}, {"time": 48.05, "type": "FLASH", "duration": 3.431}, {"time": 48.104, "type": "NOTE_SPEED", "speed": 1.75}, {"time": 51.479, "type": "NOTES_FLOW_RIGHT"}, {"time": 51.479, "type": "FLASH", "duration": 3.377}, {"time": 54.907, "type": "NOTES_FLOW_LEFT"}, {"time": 54.907, "type": "CAMERA_BOB_OFF"}, {"time": 54.907, "type": "BG_COLOR", "color": "#000000"}, {"time": 54.907, "type": "FX_OLD_TV", "duration": 27.429}, {"time": 54.961, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 55.764, "type": "SHAKE"}, {"time": 56.621, "type": "SHAKE"}, {"time": 57.479, "type": "SHAKE"}, {"time": 58.336, "type": "SHAKE"}, {"time": 59.193, "type": "SHAKE"}, {"time": 60.05, "type": "SHAKE"}, {"time": 60.907, "type": "SHAKE"}, {"time": 61.764, "type": "SHAKE"}, {"time": 62.621, "type": "SHAKE"}, {"time": 63.479, "type": "SHAKE"}, {"time": 64.336, "type": "SHAKE"}, {"time": 65.193, "type": "SHAKE"}, {"time": 66.05, "type": "SHAKE"}, {"time": 66.907, "type": "SHAKE"}, {"time": 67.764, "type": "SHAKE"}, {"time": 68.621, "type": "SHAKE"}, {"time": 69.05, "type": "NOTES_FLOW_RIGHT"}, {"time": 69.05, "type": "SHAKE"}, {"time": 69.05, "type": "FLASH", "duration": 0.427}, {"time": 69.05, "type": "FX_GLITCH", "duration": 0.427}, {"time": 69.05, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 69.05, "type": "DISCO", "duration": 0.5}, {"time": 69.264, "type": "SHAKE"}, {"time": 69.479, "type": "NOTES_FLOW_LEFT"}, {"time": 69.479, "type": "SHAKE"}, {"time": 70.336, "type": "SHAKE"}, {"time": 70.764, "type": "NOTES_FLOW_RIGHT"}, {"time": 70.764, "type": "SHAKE"}, {"time": 70.764, "type": "FLASH", "duration": 0.427}, {"time": 70.764, "type": "FX_GLITCH", "duration": 0.427}, {"time": 70.764, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 70.764, "type": "DISCO", "duration": 0.5}, {"time": 70.978, "type": "SHAKE"}, {"time": 71.193, "type": "NOTES_FLOW_LEFT"}, {"time": 71.193, "type": "SHAKE"}, {"time": 72.05, "type": "SHAKE"}, {"time": 72.479, "type": "NOTES_FLOW_RIGHT"}, {"time": 72.479, "type": "SHAKE"}, {"time": 72.479, "type": "FLASH", "duration": 0.427}, {"time": 72.479, "type": "FX_GLITCH", "duration": 0.427}, {"time": 72.479, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 72.479, "type": "DISCO", "duration": 0.5}, {"time": 72.693, "type": "SHAKE"}, {"time": 72.908, "type": "NOTES_FLOW_LEFT"}, {"time": 72.908, "type": "SHAKE"}, {"time": 73.764, "type": "SHAKE"}, {"time": 74.193, "type": "SHAKE"}, {"time": 74.193, "type": "FLASH", "duration": 0.427}, {"time": 74.193, "type": "FX_GLITCH", "duration": 0.427}, {"time": 74.193, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 74.193, "type": "DISCO", "duration": 0.5}, {"time": 74.193, "type": "NOTES_FLOW_RIGHT"}, {"time": 74.407, "type": "SHAKE"}, {"time": 74.622, "type": "SHAKE"}, {"time": 74.622, "type": "NOTES_FLOW_LEFT"}, {"time": 75.479, "type": "SHAKE"}, {"time": 75.907, "type": "NOTES_FLOW_RIGHT"}, {"time": 75.907, "type": "SHAKE"}, {"time": 75.907, "type": "FLASH", "duration": 0.427}, {"time": 75.907, "type": "FX_GLITCH", "duration": 0.427}, {"time": 75.907, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 75.907, "type": "DISCO", "duration": 0.5}, {"time": 76.121, "type": "SHAKE"}, {"time": 76.336, "type": "NOTES_FLOW_LEFT"}, {"time": 76.336, "type": "SHAKE"}, {"time": 77.193, "type": "SHAKE"}, {"time": 77.621, "type": "NOTES_FLOW_RIGHT"}, {"time": 77.621, "type": "SHAKE"}, {"time": 77.621, "type": "FLASH", "duration": 0.427}, {"time": 77.621, "type": "FX_GLITCH", "duration": 0.427}, {"time": 77.621, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 77.621, "type": "DISCO", "duration": 0.5}, {"time": 77.835, "type": "SHAKE"}, {"time": 78.05, "type": "NOTES_FLOW_LEFT"}, {"time": 78.05, "type": "SHAKE"}, {"time": 78.907, "type": "SHAKE"}, {"time": 79.336, "type": "NOTES_FLOW_RIGHT"}, {"time": 79.336, "type": "SHAKE"}, {"time": 79.336, "type": "FLASH", "duration": 0.427}, {"time": 79.336, "type": "FX_GLITCH", "duration": 0.427}, {"time": 79.336, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 79.336, "type": "DISCO", "duration": 0.5}, {"time": 79.55, "type": "SHAKE"}, {"time": 79.765, "type": "NOTES_FLOW_LEFT"}, {"time": 79.765, "type": "SHAKE"}, {"time": 80.621, "type": "SHAKE"}, {"time": 81.05, "type": "NOTES_FLOW_RIGHT"}, {"time": 81.05, "type": "SHAKE"}, {"time": 81.05, "type": "FLASH", "duration": 0.427}, {"time": 81.05, "type": "FX_GLITCH", "duration": 0.427}, {"time": 81.05, "type": "FX_PIXELATE", "duration": 0.428}, {"time": 81.05, "type": "DISCO", "duration": 0.5}, {"time": 81.264, "type": "SHAKE"}, {"time": 81.479, "type": "NOTES_FLOW_LEFT"}, {"time": 81.479, "type": "SHAKE"}, {"time": 81.907, "type": "SHAKE"}, {"time": 82.121, "type": "FLASH", "duration": 0.208}, {"time": 82.336, "type": "CAMERA_BOB_ON"}, {"time": 82.336, "type": "BG_COLOR", "color": "#630000"}, {"time": 82.336, "type": "FX_RGB_SPLIT", "duration": 13.5}, {"time": 82.389, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 82.764, "type": "SHAKE"}, {"time": 83.193, "type": "SHAKE"}, {"time": 83.621, "type": "SHAKE"}, {"time": 84.05, "type": "SHAKE"}, {"time": 84.479, "type": "SHAKE"}, {"time": 84.908, "type": "SHAKE"}, {"time": 85.336, "type": "SHAKE"}, {"time": 85.765, "type": "SHAKE"}, {"time": 86.193, "type": "SHAKE"}, {"time": 86.622, "type": "SHAKE"}, {"time": 87.05, "type": "SHAKE"}, {"time": 87.479, "type": "SHAKE"}, {"time": 87.908, "type": "SHAKE"}, {"time": 88.337, "type": "SHAKE"}, {"time": 88.765, "type": "SHAKE"}, {"time": 89.194, "type": "SHAKE"}, {"time": 89.621, "type": "SHAKE"}, {"time": 90.05, "type": "SHAKE"}, {"time": 90.478, "type": "SHAKE"}, {"time": 90.907, "type": "SHAKE"}, {"time": 91.336, "type": "SHAKE"}, {"time": 91.765, "type": "SHAKE"}, {"time": 92.193, "type": "SHAKE"}, {"time": 92.622, "type": "SHAKE"}, {"time": 93.05, "type": "SHAKE"}, {"time": 93.479, "type": "SHAKE"}, {"time": 93.907, "type": "SHAKE"}, {"time": 94.336, "type": "SHAKE"}, {"time": 94.764, "type": "FLASH", "duration": 1.072}, {"time": 94.764, "type": "SHAKE"}, {"time": 95.193, "type": "SHAKE"}, {"time": 95.621, "type": "SHAKE"}, {"time": 95.836, "type": "CAMERA_BOB_OFF"}, {"time": 95.836, "type": "BG_COLOR", "duration": 2.948, "color": "#62a0ea"}], "audioFile": "track.mp3", "audioFormat": "mp3", "coverFile": "Cover.png"}}, "Outro": {"folder": "Outro", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/Outro/track.mp3", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "Outro", "artist": "Arvicheskyy", "difficulty": 3.0, "menu_color": "#b32222"}, "chart": {"bpm": 105, "noteTravelTime": 1000, "gridOffset": 0.041, "timing": [{"time": 0.041, "bpm": 105}], "notes": [{"time": 2.327, "type": "UP"}, {"time": 2.612, "type": "DOWN"}, {"time": 2.898, "type": "RIGHT"}, {"time": 3.184, "type": "UP"}, {"time": 4.041, "type": "RIGHT"}, {"time": 4.612, "type": "RIGHT"}, {"time": 4.897, "type": "DOWN"}, {"time": 5.184, "type": "UP"}, {"time": 5.469, "type": "UP"}, {"time": 6.326, "type": "RIGHT"}, {"time": 6.898, "type": "DOWN"}, {"time": 7.184, "type": "UP"}, {"time": 7.469, "type": "RIGHT"}, {"time": 7.755, "type": "UP"}, {"time": 8.612, "type": "RIGHT"}, {"time": 9.184, "type": "LEFT"}, {"time": 9.47, "type": "UP"}, {"time": 9.755, "type": "DOWN"}, {"time": 10.041, "type": "RIGHT"}, {"time": 10.898, "type": "DOWN"}, {"time": 11.47, "type": "UP"}, {"time": 11.755, "type": "DOWN"}, {"time": 12.041, "type": "RIGHT"}, {"time": 12.327, "type": "UP"}, {"time": 13.184, "type": "RIGHT"}, {"time": 13.755, "type": "UP_LEFT"}, {"time": 14.041, "type": "UP_RIGHT"}, {"time": 14.327, "type": "UP_LEFT"}, {"time": 14.612, "type": "UP_RIGHT"}, {"time": 15.47, "type": "UP"}, {"time": 16.041, "type": "DOWN"}, {"time": 16.327, "type": "UP"}, {"time": 16.612, "type": "DOWN"}, {"time": 16.898, "type": "UP"}, {"time": 17.755, "type": "UP_RIGHT"}, {"time": 18.327, "type": "UP"}, {"time": 18.612, "type": "DOWN"}, {"time": 18.898, "type": "RIGHT"}, {"time": 19.184, "type": "UP"}, {"time": 20.041, "type": "RIGHT"}, {"time": 20.612, "type": "RIGHT"}, {"time": 20.897, "type": "DOWN"}, {"time": 21.184, "type": "UP"}, {"time": 21.469, "type": "UP"}, {"time": 22.326, "type": "RIGHT"}, {"time": 22.898, "type": "DOWN"}, {"time": 23.184, "type": "UP"}, {"time": 23.469, "type": "RIGHT"}, {"time": 23.755, "type": "UP"}, {"time": 24.612, "type": "RIGHT"}, {"time": 25.184, "type": "LEFT"}, {"time": 25.47, "type": "UP"}, {"time": 25.755, "type": "DOWN"}, {"time": 26.041, "type": "RIGHT"}, {"time": 26.898, "type": "DOWN"}, {"time": 27.47, "type": "UP"}, {"time": 27.755, "type": "DOWN"}, {"time": 28.041, "type": "RIGHT"}, {"time": 28.327, "type": "UP"}, {"time": 29.184, "type": "RIGHT"}, {"time": 29.755, "type": "UP_LEFT"}, {"time": 30.041, "type": "UP_RIGHT"}, {"time": 30.327, "type": "UP_LEFT"}, {"time": 30.612, "type": "UP_RIGHT"}, {"time": 31.47, "type": "UP"}, {"time": 32.041, "type": "DOWN"}, {"time": 32.327, "type": "UP"}, {"time": 32.612, "type": "DOWN"}, {"time": 32.898, "type": "UP"}, {"time": 33.755, "type": "UP_RIGHT"}, {"time": 34.327, "type": "RIGHT"}, {"time": 34.612, "type": "RIGHT"}, {"time": 34.898, "type": "RIGHT"}, {"time": 35.184, "type": "DOWN"}, {"time": 35.47, "type": "UP"}, {"time": 35.755, "type": "DOWN"}, {"time": 36.041, "type": "UP"}, {"time": 36.327, "type": "RIGHT"}, {"time": 36.612, "type": "UP"}, {"time": 37.184, "type": "RIGHT"}, {"time": 37.755, "type": "UP_LEFT"}, {"time": 38.327, "type": "UP_RIGHT"}, {"time": 38.898, "type": "DOWN"}, {"time": 39.47, "type": "DOWN_RIGHT"}, {"time": 40.041, "type": "RIGHT"}, {"time": 40.612, "type": "UP_RIGHT"}, {"time": 41.184, "type": "UP"}, {"time": 41.755, "type": "UP_RIGHT"}, {"time": 42.327, "type": "RIGHT"}, {"time": 42.898, "type": "DOWN_RIGHT"}, {"time": 43.47, "type": "DOWN"}, {"time": 44.041, "type": "DOWN_RIGHT"}, {"time": 44.612, "type": "RIGHT"}, {"time": 45.184, "type": "UP_RIGHT"}, {"time": 45.755, "type": "UP"}, {"time": 46.327, "type": "UP_LEFT"}, {"time": 46.898, "type": "LEFT"}, {"time": 47.47, "type": "DOWN_LEFT"}, {"time": 48.041, "type": "DOWN"}, {"time": 48.612, "type": "DOWN_LEFT"}, {"time": 49.184, "type": "DOWN"}, {"time": 49.755, "type": "DOWN_RIGHT"}, {"time": 50.327, "type": "UP"}, {"time": 50.898, "type": "UP_RIGHT"}, {"time": 51.47, "type": "UP"}, {"time": 52.041, "type": "UP_LEFT"}, {"time": 52.612, "type": "REVERSE"}, {"time": 53.184, "type": "LEFT"}, {"time": 53.755, "type": "RIGHT"}, {"time": 54.327, "type": "LEFT"}, {"time": 54.898, "type": "UP"}, {"time": 55.47, "type": "DOWN"}, {"time": 56.041, "type": "UP"}, {"time": 56.612, "type": "DOWN"}, {"time": 57.184, "type": "UP"}, {"time": 57.755, "type": "UP_RIGHT"}, {"time": 58.327, "type": "RIGHT"}, {"time": 58.898, "type": "DOWN_RIGHT"}, {"time": 59.47, "type": "DOWN"}, {"time": 60.041, "type": "DOWN_LEFT"}, {"time": 60.612, "type": "LEFT"}, {"time": 61.184, "type": "UP_LEFT"}, {"time": 61.755, "type": "UP"}, {"time": 62.327, "type": "RIGHT"}, {"time": 62.898, "type": "UP"}, {"time": 63.47, "type": "LEFT"}, {"time": 64.041, "type": "UP"}, {"time": 64.612, "type": "RIGHT"}, {"time": 65.184, "type": "DOWN"}, {"time": 65.755, "type": "LEFT"}, {"time": 66.327, "type": "UP"}, {"time": 66.898, "type": "LEFT"}, {"time": 67.47, "type": "DOWN"}, {"time": 68.041, "type": "RIGHT"}, {"time": 68.612, "type": "UP"}, {"time": 69.184, "type": "UP"}, {"time": 69.755, "type": "RIGHT"}, {"time": 70.327, "type": "RIGHT"}, {"time": 70.898, "type": "DOWN"}, {"time": 71.47, "type": "DOWN"}, {"time": 72.041, "type": "LEFT"}, {"time": 72.612, "type": "REVERSE_BACK"}, {"time": 73.184, "type": "UP"}, {"time": 73.47, "type": "DOWN"}, {"time": 73.755, "type": "RIGHT"}, {"time": 74.041, "type": "UP"}, {"time": 74.898, "type": "LEFT"}, {"time": 75.47, "type": "LEFT"}, {"time": 75.755, "type": "RIGHT"}, {"time": 76.041, "type": "LEFT"}, {"time": 76.327, "type": "UP"}, {"time": 77.184, "type": "DOWN"}, {"time": 77.755, "type": "UP"}, {"time": 78.041, "type": "DOWN"}, {"time": 78.326, "type": "RIGHT"}, {"time": 78.612, "type": "UP"}, {"time": 79.469, "type": "LEFT"}, {"time": 80.041, "type": "LEFT"}, {"time": 80.326, "type": "RIGHT"}, {"time": 80.612, "type": "LEFT"}, {"time": 80.898, "type": "UP"}, {"time": 81.755, "type": "DOWN"}, {"time": 82.327, "type": "UP"}, {"time": 82.612, "type": "UP_RIGHT"}, {"time": 82.898, "type": "RIGHT"}, {"time": 83.184, "type": "DOWN_RIGHT"}, {"time": 84.041, "type": "DOWN"}, {"time": 84.612, "type": "DOWN"}, {"time": 84.898, "type": "DOWN_RIGHT"}, {"time": 85.184, "type": "RIGHT"}, {"time": 85.47, "type": "UP_RIGHT"}, {"time": 86.327, "type": "UP"}, {"time": 86.898, "type": "UP"}, {"time": 87.183, "type": "UP_RIGHT"}, {"time": 87.469, "type": "RIGHT"}, {"time": 87.755, "type": "DOWN_RIGHT"}, {"time": 88.612, "type": "DOWN"}, {"time": 89.183, "type": "DOWN"}, {"time": 89.469, "type": "DOWN_RIGHT"}, {"time": 89.755, "type": "RIGHT"}, {"time": 90.041, "type": "UP_RIGHT"}, {"time": 90.898, "type": "UP"}, {"time": 91.47, "type": "UP"}, {"time": 91.755, "type": "UP_LEFT"}, {"time": 92.041, "type": "LEFT"}, {"time": 92.327, "type": "DOWN_LEFT"}, {"time": 93.184, "type": "DOWN"}, {"time": 93.755, "type": "DOWN"}, {"time": 94.041, "type": "DOWN_LEFT"}, {"time": 94.327, "type": "LEFT"}, {"time": 94.612, "type": "UP_LEFT"}, {"time": 95.47, "type": "UP"}, {"time": 96.041, "type": "DOWN"}, {"time": 96.327, "type": "DOWN_RIGHT"}, {"time": 96.613, "type": "RIGHT"}, {"time": 96.899, "type": "UP_RIGHT"}, {"time": 97.756, "type": "UP"}, {"time": 98.328, "type": "UP"}, {"time": 98.613, "type": "UP_LEFT"}, {"time": 98.899, "type": "LEFT"}, {"time": 99.185, "type": "DOWN_LEFT"}, {"time": 100.042, "type": "DOWN"}, {"time": 100.613, "type": "DOWN"}, {"time": 100.899, "type": "DOWN_LEFT"}, {"time": 101.185, "type": "LEFT"}, {"time": 101.47, "type": "UP_LEFT"}, {"time": 102.328, "type": "UP"}, {"time": 102.898, "type": "UP_RIGHT"}, {"time": 103.184, "type": "UP_LEFT"}, {"time": 103.47, "type": "LEFT"}, {"time": 103.755, "type": "RIGHT"}, {"time": 104.612, "type": "DOWN"}, {"time": 105.184, "type": "DOWN_RIGHT"}, {"time": 105.47, "type": "DOWN_LEFT"}, {"time": 105.755, "type": "DOWN_RIGHT"}, {"time": 106.041, "type": "DOWN_LEFT"}, {"time": 106.898, "type": "UP"}, {"time": 107.47, "type": "UP"}, {"time": 107.755, "type": "DOWN"}, {"time": 108.041, "type": "UP"}, {"time": 108.327, "type": "DOWN"}, {"time": 108.612, "type": "UP"}, {"time": 108.898, "type": "RIGHT"}, {"time": 109.184, "type": "RIGHT"}, {"time": 109.47, "type": "UP"}, {"time": 109.755, "type": "UP"}, {"time": 110.326, "type": "UP"}, {"time": 110.898, "type": "RIGHT"}, {"time": 111.469, "type": "UP_LEFT"}, {"time": 112.041, "type": "UP_RIGHT"}, {"time": 112.612, "type": "DOWN"}, {"time": 113.184, "type": "DOWN_RIGHT"}, {"time": 113.755, "type": "RIGHT"}, {"time": 114.326, "type": "UP_RIGHT"}, {"time": 114.898, "type": "UP"}, {"time": 115.469, "type": "UP_RIGHT"}, {"time": 116.041, "type": "RIGHT"}, {"time": 116.612, "type": "DOWN_RIGHT"}, {"time": 117.184, "type": "DOWN"}, {"time": 117.755, "type": "DOWN_RIGHT"}, {"time": 118.326, "type": "RIGHT"}, {"time": 118.898, "type": "UP_RIGHT"}, {"time": 119.469, "type": "UP"}, {"time": 120.041, "type": "UP_LEFT"}, {"time": 120.612, "type": "LEFT"}, {"time": 121.184, "type": "DOWN_LEFT"}, {"time": 121.755, "type": "DOWN"}, {"time": 122.326, "type": "DOWN_LEFT"}, {"time": 122.898, "type": "DOWN"}, {"time": 123.469, "type": "DOWN_RIGHT"}, {"time": 124.041, "type": "UP"}, {"time": 124.612, "type": "UP_RIGHT"}, {"time": 125.184, "type": "UP"}, {"time": 125.755, "type": "UP_LEFT"}, {"time": 126.326, "type": "REVERSE"}, {"time": 126.898, "type": "LEFT"}, {"time": 127.469, "type": "RIGHT"}, {"time": 128.041, "type": "LEFT"}, {"time": 128.612, "type": "UP"}, {"time": 129.184, "type": "DOWN"}, {"time": 129.755, "type": "UP"}, {"time": 130.326, "type": "DOWN"}, {"time": 130.898, "type": "UP"}, {"time": 131.469, "type": "UP_RIGHT"}, {"time": 132.041, "type": "RIGHT"}, {"time": 132.612, "type": "DOWN_RIGHT"}, {"time": 133.184, "type": "DOWN"}, {"time": 133.755, "type": "DOWN_LEFT"}, {"time": 134.326, "type": "LEFT"}, {"time": 134.898, "type": "UP_LEFT"}, {"time": 135.469, "type": "UP"}, {"time": 136.041, "type": "RIGHT"}, {"time": 136.612, "type": "UP"}, {"time": 137.184, "type": "LEFT"}, {"time": 137.755, "type": "UP"}, {"time": 138.326, "type": "RIGHT"}, {"time": 138.898, "type": "DOWN"}, {"time": 139.469, "type": "LEFT"}, {"time": 140.041, "type": "UP"}, {"time": 140.612, "type": "LEFT"}, {"time": 141.184, "type": "DOWN"}, {"time": 141.755, "type": "RIGHT"}, {"time": 142.326, "type": "UP"}, {"time": 142.898, "type": "UP"}, {"time": 143.469, "type": "RIGHT"}, {"time": 144.041, "type": "RIGHT"}, {"time": 144.612, "type": "DOWN"}, {"time": 145.184, "type": "DOWN"}, {"time": 145.755, "type": "LEFT"}, {"time": 146.327, "type": "REVERSE_BACK"}, {"time": 146.613, "type": "DOWN"}, {"time": 146.898, "type": "RIGHT"}, {"time": 147.184, "type": "UP"}, {"time": 148.041, "type": "LEFT"}, {"time": 148.613, "type": "LEFT"}, {"time": 148.898, "type": "RIGHT"}, {"time": 149.184, "type": "LEFT"}, {"time": 149.47, "type": "UP"}, {"time": 150.327, "type": "DOWN"}, {"time": 150.898, "type": "UP"}, {"time": 151.184, "type": "DOWN"}, {"time": 151.469, "type": "RIGHT"}, {"time": 151.755, "type": "UP"}, {"time": 152.612, "type": "LEFT"}, {"time": 153.184, "type": "LEFT"}, {"time": 153.469, "type": "RIGHT"}, {"time": 153.755, "type": "LEFT"}, {"time": 154.041, "type": "UP"}, {"time": 154.898, "type": "DOWN"}, {"time": 155.47, "type": "UP"}, {"time": 155.755, "type": "UP_RIGHT"}, {"time": 156.041, "type": "RIGHT"}, {"time": 156.327, "type": "DOWN_RIGHT"}, {"time": 157.184, "type": "UP"}, {"time": 157.755, "type": "UP"}, {"time": 158.04, "type": "DOWN"}, {"time": 158.326, "type": "RIGHT"}, {"time": 158.612, "type": "UP"}, {"time": 159.469, "type": "RIGHT"}, {"time": 160.04, "type": "RIGHT"}, {"time": 160.325, "type": "DOWN"}, {"time": 160.612, "type": "UP"}, {"time": 160.897, "type": "UP"}, {"time": 161.754, "type": "RIGHT"}, {"time": 162.326, "type": "DOWN"}, {"time": 162.612, "type": "UP"}, {"time": 162.897, "type": "RIGHT"}, {"time": 163.183, "type": "UP"}, {"time": 164.04, "type": "RIGHT"}, {"time": 164.612, "type": "DOWN"}], "events": [{"time": 2.041, "type": "BG_COLOR", "duration": 34.715, "color": "#400e0e"}, {"time": 36.112, "type": "FX_ENDING", "duration": 37.072}, {"time": 36.184, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 36.612, "type": "FLASH"}, {"time": 36.612, "type": "CAMERA_BOB_ON"}, {"time": 38.898, "type": "FLASH"}, {"time": 41.184, "type": "FLASH"}, {"time": 43.47, "type": "FLASH"}, {"time": 45.755, "type": "FLASH"}, {"time": 48.041, "type": "FLASH"}, {"time": 50.327, "type": "FLASH"}, {"time": 52.612, "type": "FLASH"}, {"time": 52.612, "type": "NOTES_FLOW_RIGHT"}, {"time": 54.898, "type": "FLASH"}, {"time": 57.184, "type": "FLASH"}, {"time": 59.47, "type": "FLASH"}, {"time": 61.755, "type": "FLASH"}, {"time": 64.041, "type": "FLASH"}, {"time": 66.327, "type": "FLASH"}, {"time": 68.612, "type": "FLASH"}, {"time": 72.612, "type": "NOTES_FLOW_LEFT"}, {"time": 72.612, "type": "FLASH"}, {"time": 72.755, "type": "NOTE_SPEED", "speed": 1}, {"time": 73.184, "type": "FLASH"}, {"time": 73.184, "type": "CAMERA_BOB_OFF"}, {"time": 73.184, "type": "HUD_HIDE"}, {"time": 82.327, "type": "FLASH"}, {"time": 84.612, "type": "FLASH"}, {"time": 86.898, "type": "FLASH"}, {"time": 89.184, "type": "FLASH"}, {"time": 91.47, "type": "FLASH"}, {"time": 93.755, "type": "FLASH"}, {"time": 96.041, "type": "FLASH"}, {"time": 98.327, "type": "FLASH"}, {"time": 100.041, "type": "FLASH"}, {"time": 100.612, "type": "FLASH"}, {"time": 102.327, "type": "FLASH"}, {"time": 102.898, "type": "FLASH"}, {"time": 104.612, "type": "FLASH"}, {"time": 105.184, "type": "FLASH"}, {"time": 106.898, "type": "FLASH"}, {"time": 107.47, "type": "FLASH"}, {"time": 108.612, "type": "HUD_SHOW"}, {"time": 109.755, "type": "FLASH"}, {"time": 109.755, "type": "CAMERA_BOB_ON"}, {"time": 109.755, "type": "FX_ENDING", "duration": 36.572}, {"time": 109.898, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 112.041, "type": "FLASH"}, {"time": 114.327, "type": "FLASH"}, {"time": 116.612, "type": "FLASH"}, {"time": 117.755, "type": "FLASH"}, {"time": 118.327, "type": "FLASH"}, {"time": 118.898, "type": "FLASH"}, {"time": 121.184, "type": "FLASH"}, {"time": 123.47, "type": "FLASH"}, {"time": 125.755, "type": "FLASH"}, {"time": 126.326, "type": "NOTES_FLOW_RIGHT"}, {"time": 128.041, "type": "FLASH"}, {"time": 130.327, "type": "FLASH"}, {"time": 132.612, "type": "FLASH"}, {"time": 134.898, "type": "FLASH"}, {"time": 136.041, "type": "FLASH"}, {"time": 136.612, "type": "FLASH"}, {"time": 137.184, "type": "FLASH"}, {"time": 139.47, "type": "FLASH"}, {"time": 141.755, "type": "FLASH"}, {"time": 144.041, "type": "FLASH"}, {"time": 144.612, "type": "FLASH"}, {"time": 145.184, "type": "FLASH"}, {"time": 145.755, "type": "FLASH"}, {"time": 146.327, "type": "NOTES_FLOW_LEFT"}, {"time": 146.327, "type": "HUD_HIDE"}, {"time": 146.327, "type": "FLASH"}, {"time": 146.327, "type": "CAMERA_BOB_OFF"}, {"time": 146.47, "type": "NOTE_SPEED", "speed": 1}, {"time": 146.47, "type": "BG_COLOR", "duration": 18.148, "color": "#3584e4"}], "audioFile": "track.mp3", "audioFormat": "mp3"}}, "Shifter": {"folder": "Shifter", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/Shifter/track.ogg", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "Shifter", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 3.0, "menu_color": "#b32222"}, "chart": {"bpm": 92, "noteTravelTime": 1000, "gridOffset": 0.65, "timing": [{"time": 0.65, "bpm": 92}], "notes": [{"time": 0.088, "type": "UP"}, {"time": 0.846, "type": "DOWN"}, {"time": 1.632, "type": "UP"}, {"time": 2.531, "type": "DOWN"}, {"time": 3.43, "type": "UP"}, {"time": 4.321, "type": "DOWN"}, {"time": 6.014, "type": "UP"}, {"time": 6.239, "type": "DOWN"}, {"time": 6.464, "type": "UP"}, {"time": 6.688, "type": "DOWN"}, {"time": 6.913, "type": "UP"}, {"time": 7.25, "type": "RIGHT"}, {"time": 7.7, "type": "DOWN"}, {"time": 8.149, "type": "RIGHT"}, {"time": 8.599, "type": "DOWN"}, {"time": 9.048, "type": "UP"}, {"time": 9.497, "type": "DOWN"}, {"time": 9.891, "type": "RIGHT"}, {"time": 10.284, "type": "LEFT"}, {"time": 10.733, "type": "UP_LEFT"}, {"time": 11.183, "type": "UP_RIGHT"}, {"time": 11.632, "type": "RIGHT"}, {"time": 11.997, "type": "DOWN"}, {"time": 12.419, "type": "UP"}, {"time": 12.868, "type": "DOWN"}, {"time": 13.318, "type": "RIGHT"}, {"time": 13.767, "type": "LEFT"}, {"time": 14.188, "type": "RIGHT"}, {"time": 14.61, "type": "LEFT"}, {"time": 15.031, "type": "UP"}, {"time": 15.452, "type": "LEFT"}, {"time": 15.902, "type": "REVERSE"}, {"time": 16.351, "type": "DOWN"}, {"time": 16.801, "type": "RIGHT"}, {"time": 17.222, "type": "DOWN"}, {"time": 17.559, "type": "UP"}, {"time": 18.037, "type": "DOWN"}, {"time": 18.486, "type": "RIGHT"}, {"time": 18.908, "type": "LEFT"}, {"time": 19.329, "type": "UP_LEFT"}, {"time": 19.75, "type": "UP_RIGHT"}, {"time": 20.172, "type": "RIGHT"}, {"time": 20.621, "type": "DOWN"}, {"time": 21.014, "type": "UP"}, {"time": 21.436, "type": "DOWN"}, {"time": 21.857, "type": "RIGHT"}, {"time": 22.278, "type": "LEFT"}, {"time": 22.7, "type": "RIGHT"}, {"time": 23.121, "type": "LEFT"}, {"time": 23.542, "type": "UP"}, {"time": 23.964, "type": "DOWN"}, {"time": 24.385, "type": "REVERSE_BACK"}, {"time": 24.806, "type": "UP"}, {"time": 25.228, "type": "RIGHT"}, {"time": 25.649, "type": "UP"}, {"time": 26.137, "type": "LEFT"}, {"time": 26.626, "type": "LEFT"}, {"time": 27.034, "type": "DOWN"}, {"time": 27.442, "type": "RIGHT"}, {"time": 27.849, "type": "UP"}, {"time": 28.257, "type": "UP_RIGHT"}, {"time": 28.664, "type": "RIGHT"}, {"time": 29.154, "type": "DOWN_RIGHT"}, {"time": 29.561, "type": "RIGHT"}, {"time": 29.969, "type": "UP_RIGHT"}, {"time": 30.376, "type": "UP"}, {"time": 30.866, "type": "DOWN"}, {"time": 31.273, "type": "UP"}, {"time": 31.681, "type": "DOWN"}, {"time": 32.088, "type": "UP"}, {"time": 32.496, "type": "DOWN"}, {"time": 32.904, "type": "UP"}, {"time": 33.311, "type": "DOWN"}, {"time": 33.8, "type": "RIGHT"}, {"time": 34.289, "type": "DOWN"}, {"time": 35.105, "type": "UP"}, {"time": 36.001, "type": "DOWN"}, {"time": 36.898, "type": "RIGHT"}, {"time": 37.713, "type": "LEFT"}, {"time": 38.61, "type": "UP_LEFT"}, {"time": 42.034, "type": "UP_RIGHT"}, {"time": 42.605, "type": "RIGHT"}, {"time": 42.849, "type": "DOWN"}, {"time": 43.257, "type": "UP"}, {"time": 43.664, "type": "DOWN"}, {"time": 44.561, "type": "RIGHT"}, {"time": 45.458, "type": "LEFT"}, {"time": 46.029, "type": "RIGHT"}, {"time": 46.273, "type": "LEFT"}, {"time": 46.681, "type": "UP"}, {"time": 47.088, "type": "DOWN"}, {"time": 47.985, "type": "UP"}, {"time": 48.8, "type": "DOWN"}, {"time": 49.453, "type": "UP"}, {"time": 49.697, "type": "DOWN"}, {"time": 50.186, "type": "UP"}, {"time": 50.594, "type": "RIGHT"}, {"time": 51.409, "type": "UP"}, {"time": 52.224, "type": "DOWN"}, {"time": 52.876, "type": "DOWN"}, {"time": 53.121, "type": "RIGHT"}, {"time": 53.529, "type": "UP"}, {"time": 54.018, "type": "UP_RIGHT"}, {"time": 54.914, "type": "LEFT"}, {"time": 56.463, "type": "DOWN"}, {"time": 58.42, "type": "UP"}, {"time": 59.969, "type": "RIGHT"}, {"time": 61.681, "type": "DOWN"}, {"time": 63.311, "type": "UP"}, {"time": 65.268, "type": "DOWN"}, {"time": 65.838, "type": "UP"}], "events": [{"time": 0.0, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 4.497, "type": "NOTE_SPEED", "speed": 1.25}, {"time": 6.675, "type": "BG_COLOR", "color": "#53007a"}, {"time": 6.675, "type": "FLASH"}, {"time": 6.675, "type": "CAMERA_BOB_ON"}, {"time": 13.738, "type": "FLASH"}, {"time": 13.738, "type": "FX_INVERT", "duration": 6.894}, {"time": 15.902, "type": "NOTES_FLOW_RIGHT"}, {"time": 20.632, "type": "FLASH"}, {"time": 24.385, "type": "NOTES_FLOW_LEFT"}, {"time": 27.36, "type": "FX_WAVE", "duration": 6.929}, {"time": 27.442, "type": "FLASH"}, {"time": 27.442, "type": "FX_INVERT", "duration": 6.847}, {"time": 34.085, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 34.289, "type": "FLASH"}, {"time": 38.625, "type": "BLACKOUT", "duration": 2.355}, {"time": 38.794, "type": "NOTE_SPEED", "speed": 1.75}, {"time": 40.98, "type": "FX_WAVE", "duration": 13.934}, {"time": 53.76, "type": "NOTE_SPEED", "speed": 1}, {"time": 54.914, "type": "FLASH"}], "audioFile": "track.ogg", "audioFormat": "ogg"}}, "Triple swipe": {"folder": "Triple swipe", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/Triple swipe/track.ogg", "coverRef": "cov_48150a8034", "bgRef": "bg_1d59c2f79a", "meta": {"title": "Triple swipe", "artist": "ᴛᴠxᴏᴅᴀ", "difficulty": 3.0, "menu_color": "#b32222"}, "chart": {"bpm": 160, "noteTravelTime": 1000, "gridOffset": 0.054, "timing": [{"time": 0.054, "bpm": 160}], "notes": [{"time": 1.984, "type": "LEFT"}, {"time": 2.171, "type": "UP"}, {"time": 2.64, "type": "UP"}, {"time": 2.828, "type": "RIGHT"}, {"time": 3.203, "type": "UP"}, {"time": 3.484, "type": "LEFT"}, {"time": 3.765, "type": "DOWN"}, {"time": 4.703, "type": "LEFT"}, {"time": 4.89, "type": "UP"}, {"time": 5.453, "type": "UP"}, {"time": 5.64, "type": "RIGHT"}, {"time": 6.015, "type": "UP"}, {"time": 6.296, "type": "LEFT"}, {"time": 6.577, "type": "DOWN"}, {"time": 7.89, "type": "DOWN"}, {"time": 8.078, "type": "RIGHT"}, {"time": 8.546, "type": "RIGHT"}, {"time": 8.734, "type": "UP"}, {"time": 9.015, "type": "UP"}, {"time": 9.296, "type": "LEFT"}, {"time": 9.577, "type": "DOWN"}, {"time": 10.89, "type": "UP"}, {"time": 11.078, "type": "UP_RIGHT"}, {"time": 11.546, "type": "UP_RIGHT"}, {"time": 11.734, "type": "RIGHT"}, {"time": 12.765, "type": "UP"}, {"time": 13.14, "type": "RIGHT"}, {"time": 13.515, "type": "DOWN"}, {"time": 13.89, "type": "LEFT"}, {"time": 15.765, "type": "LEFT"}, {"time": 16.14, "type": "DOWN"}, {"time": 16.515, "type": "RIGHT"}, {"time": 16.89, "type": "UP"}, {"time": 18.765, "type": "LEFT"}, {"time": 19.14, "type": "RIGHT"}, {"time": 19.515, "type": "LEFT"}, {"time": 19.89, "type": "RIGHT"}, {"time": 21.765, "type": "UP"}, {"time": 22.14, "type": "DOWN"}, {"time": 22.515, "type": "UP"}, {"time": 22.89, "type": "DOWN"}, {"time": 24.765, "type": "LEFT"}, {"time": 25.14, "type": "UP_LEFT"}, {"time": 25.515, "type": "UP"}, {"time": 25.89, "type": "UP_RIGHT"}, {"time": 27.765, "type": "DOWN"}, {"time": 28.14, "type": "DOWN_RIGHT"}, {"time": 28.515, "type": "RIGHT"}, {"time": 28.89, "type": "UP_RIGHT"}, {"time": 30.765, "type": "UP"}, {"time": 31.14, "type": "UP_LEFT"}, {"time": 31.515, "type": "LEFT"}, {"time": 31.89, "type": "DOWN_LEFT"}, {"time": 33.765, "type": "UP"}, {"time": 34.14, "type": "UP_RIGHT"}, {"time": 34.515, "type": "UP"}, {"time": 34.89, "type": "UP_LEFT"}, {"time": 36.015, "type": "UP"}, {"time": 36.39, "type": "RIGHT"}, {"time": 36.765, "type": "LEFT"}, {"time": 37.14, "type": "DOWN"}, {"time": 37.515, "type": "DOWN"}, {"time": 37.89, "type": "UP"}, {"time": 38.265, "type": "DOWN"}, {"time": 38.64, "type": "RIGHT"}, {"time": 39.015, "type": "UP"}, {"time": 39.39, "type": "DOWN"}, {"time": 40.14, "type": "UP"}, {"time": 40.515, "type": "RIGHT"}, {"time": 40.703, "type": "LEFT"}, {"time": 40.89, "type": "RIGHT"}, {"time": 41.257, "type": "UP"}, {"time": 41.632, "type": "DOWN"}, {"time": 42.015, "type": "UP"}, {"time": 42.39, "type": "DOWN"}, {"time": 42.765, "type": "RIGHT"}, {"time": 42.765, "type": "LEFT"}, {"time": 43.14, "type": "UP"}, {"time": 43.515, "type": "RIGHT"}, {"time": 43.89, "type": "DOWN"}, {"time": 44.265, "type": "RIGHT"}, {"time": 44.64, "type": "UP"}, {"time": 45.015, "type": "UP"}, {"time": 45.39, "type": "DOWN"}, {"time": 45.765, "type": "UP"}, {"time": 46.14, "type": "RIGHT"}, {"time": 46.507, "type": "DOWN"}, {"time": 46.89, "type": "DOWN"}, {"time": 47.07, "type": "UP"}, {"time": 47.257, "type": "DOWN"}, {"time": 47.64, "type": "UP"}, {"time": 48.015, "type": "REVERSE"}, {"time": 48.39, "type": "DOWN"}, {"time": 48.765, "type": "UP"}, {"time": 49.14, "type": "RIGHT"}, {"time": 49.515, "type": "DOWN"}, {"time": 49.89, "type": "RIGHT"}, {"time": 50.265, "type": "UP"}, {"time": 50.64, "type": "LEFT"}, {"time": 51.015, "type": "DOWN"}, {"time": 51.39, "type": "RIGHT"}, {"time": 52.14, "type": "UP"}, {"time": 52.515, "type": "LEFT"}, {"time": 52.703, "type": "UP"}, {"time": 52.89, "type": "LEFT"}, {"time": 53.265, "type": "DOWN"}, {"time": 53.64, "type": "UP"}, {"time": 54.015, "type": "RIGHT"}, {"time": 54.39, "type": "LEFT"}, {"time": 54.765, "type": "RIGHT"}, {"time": 55.132, "type": "UP"}, {"time": 55.507, "type": "DOWN"}, {"time": 55.882, "type": "UP"}, {"time": 56.257, "type": "DOWN"}, {"time": 56.632, "type": "UP"}, {"time": 57.015, "type": "UP"}, {"time": 57.39, "type": "UP_LEFT"}, {"time": 57.765, "type": "LEFT"}, {"time": 58.14, "type": "DOWN_LEFT"}, {"time": 58.515, "type": "DOWN"}, {"time": 58.882, "type": "LEFT"}, {"time": 59.078, "type": "RIGHT"}, {"time": 59.257, "type": "LEFT"}, {"time": 59.64, "type": "UP"}, {"time": 60.015, "type": "REVERSE_BACK"}, {"time": 60.39, "type": "RIGHT"}, {"time": 60.765, "type": "LEFT"}, {"time": 61.14, "type": "UP"}, {"time": 61.515, "type": "DOWN"}, {"time": 61.89, "type": "DOWN"}, {"time": 62.265, "type": "RIGHT"}, {"time": 62.64, "type": "UP"}, {"time": 63.015, "type": "DOWN"}, {"time": 63.39, "type": "UP"}, {"time": 64.14, "type": "UP"}, {"time": 64.515, "type": "DOWN"}, {"time": 64.702, "type": "UP"}, {"time": 64.89, "type": "DOWN"}, {"time": 65.265, "type": "RIGHT"}, {"time": 65.64, "type": "UP_RIGHT"}, {"time": 66.015, "type": "UP"}, {"time": 66.39, "type": "DOWN"}, {"time": 66.765, "type": "RIGHT"}, {"time": 67.14, "type": "UP"}, {"time": 67.515, "type": "DOWN"}, {"time": 67.89, "type": "LEFT"}, {"time": 68.265, "type": "DOWN"}, {"time": 68.64, "type": "UP"}, {"time": 69.015, "type": "RIGHT"}, {"time": 69.39, "type": "RIGHT"}, {"time": 69.765, "type": "RIGHT"}, {"time": 70.14, "type": "RIGHT"}, {"time": 70.515, "type": "UP"}, {"time": 70.89, "type": "DOWN"}, {"time": 71.078, "type": "UP"}, {"time": 71.265, "type": "DOWN"}, {"time": 71.64, "type": "REVERSE"}, {"time": 72.015, "type": "UP"}, {"time": 72.39, "type": "DOWN_RIGHT"}, {"time": 72.765, "type": "DOWN_LEFT"}, {"time": 73.14, "type": "UP_LEFT"}, {"time": 73.515, "type": "UP_RIGHT"}, {"time": 73.89, "type": "DOWN_LEFT"}, {"time": 74.265, "type": "DOWN_RIGHT"}, {"time": 74.64, "type": "UP"}, {"time": 75.015, "type": "DOWN"}, {"time": 75.39, "type": "DOWN"}, {"time": 76.14, "type": "UP"}, {"time": 76.507, "type": "DOWN"}, {"time": 76.695, "type": "UP"}, {"time": 76.882, "type": "DOWN"}, {"time": 77.265, "type": "DOWN"}, {"time": 77.64, "type": "UP"}, {"time": 78.015, "type": "DOWN"}, {"time": 78.39, "type": "RIGHT"}, {"time": 78.765, "type": "DOWN"}, {"time": 79.14, "type": "LEFT"}, {"time": 79.515, "type": "UP"}, {"time": 79.89, "type": "LEFT"}, {"time": 80.265, "type": "UP"}, {"time": 80.64, "type": "RIGHT"}, {"time": 81.015, "type": "UP"}, {"time": 81.39, "type": "RIGHT"}, {"time": 81.765, "type": "DOWN"}, {"time": 82.14, "type": "DOWN_LEFT"}, {"time": 82.515, "type": "LEFT"}, {"time": 82.882, "type": "RIGHT"}, {"time": 83.07, "type": "LEFT"}, {"time": 83.257, "type": "RIGHT"}, {"time": 83.64, "type": "RIGHT"}, {"time": 84.015, "type": "REVERSE_BACK"}, {"time": 85.984, "type": "LEFT"}, {"time": 86.171, "type": "UP"}, {"time": 86.64, "type": "UP"}, {"time": 86.828, "type": "RIGHT"}, {"time": 87.148, "type": "UP"}, {"time": 87.429, "type": "LEFT"}, {"time": 87.71, "type": "DOWN"}, {"time": 88.703, "type": "LEFT"}, {"time": 88.89, "type": "UP"}, {"time": 89.453, "type": "UP"}, {"time": 89.64, "type": "RIGHT"}, {"time": 90.015, "type": "UP"}, {"time": 90.296, "type": "LEFT"}, {"time": 90.577, "type": "DOWN"}, {"time": 91.89, "type": "DOWN"}, {"time": 92.078, "type": "RIGHT"}, {"time": 92.546, "type": "RIGHT"}, {"time": 92.734, "type": "UP"}, {"time": 93.015, "type": "UP"}, {"time": 93.296, "type": "LEFT"}, {"time": 93.577, "type": "DOWN"}, {"time": 94.89, "type": "UP"}, {"time": 95.078, "type": "UP_RIGHT"}, {"time": 95.546, "type": "UP_RIGHT"}, {"time": 95.734, "type": "RIGHT"}, {"time": 96.101, "type": "UP"}, {"time": 96.382, "type": "LEFT"}, {"time": 96.663, "type": "DOWN"}, {"time": 97.882, "type": "LEFT"}, {"time": 98.069, "type": "UP"}, {"time": 98.538, "type": "UP"}, {"time": 98.726, "type": "RIGHT"}, {"time": 99.054, "type": "UP"}, {"time": 99.335, "type": "LEFT"}, {"time": 99.616, "type": "DOWN"}, {"time": 100.695, "type": "LEFT"}, {"time": 100.882, "type": "UP"}, {"time": 101.445, "type": "UP"}, {"time": 101.632, "type": "RIGHT"}, {"time": 102.007, "type": "UP"}, {"time": 102.288, "type": "LEFT"}, {"time": 102.569, "type": "DOWN"}, {"time": 103.89, "type": "DOWN"}, {"time": 104.078, "type": "RIGHT"}, {"time": 104.546, "type": "RIGHT"}, {"time": 104.734, "type": "UP"}, {"time": 105.015, "type": "UP"}, {"time": 105.296, "type": "LEFT"}, {"time": 105.577, "type": "DOWN"}, {"time": 106.89, "type": "UP"}, {"time": 107.078, "type": "UP_RIGHT"}, {"time": 107.546, "type": "UP_RIGHT"}, {"time": 107.734, "type": "RIGHT"}], "events": [{"time": 12.109, "type": "FLASH"}, {"time": 15.015, "type": "FLASH"}, {"time": 17.453, "type": "FLASH"}, {"time": 18.015, "type": "FLASH"}, {"time": 19.89, "type": "FLASH"}, {"time": 21.015, "type": "FLASH"}, {"time": 23.453, "type": "FLASH"}, {"time": 24.015, "type": "FLASH"}, {"time": 25.89, "type": "FLASH"}, {"time": 27.015, "type": "FLASH"}, {"time": 29.265, "type": "FLASH"}, {"time": 30.015, "type": "FLASH"}, {"time": 31.89, "type": "FLASH"}, {"time": 33.015, "type": "FLASH"}, {"time": 35.265, "type": "FLASH"}, {"time": 36.015, "type": "FLASH"}, {"time": 36.015, "type": "CAMERA_BOB_ON"}, {"time": 36.015, "type": "FX_PIXELATE", "duration": 48.004}, {"time": 36.015, "type": "BG_COLOR", "color": "#9a9996"}, {"time": 48.015, "type": "FLASH"}, {"time": 48.015, "type": "NOTES_FLOW_RIGHT"}, {"time": 60.015, "type": "FLASH"}, {"time": 60.015, "type": "NOTES_FLOW_LEFT"}, {"time": 71.64, "type": "NOTES_FLOW_RIGHT"}, {"time": 78.015, "type": "FLASH"}, {"time": 83.921, "type": "CAMERA_BOB_OFF"}, {"time": 84.015, "type": "FLASH"}, {"time": 84.015, "type": "BG_COLOR", "color": "#000000"}, {"time": 84.015, "type": "NOTES_FLOW_LEFT"}], "audioFile": "track.ogg", "audioFormat": "ogg", "coverFile": "Cover.png", "backgroundFile": "bg.png"}}, "strelkatusha": {"folder": "strelkatusha", "playlistFolder": "RCGD VERSE, Vol. 2", "audioPath": "./charts/RCGD VERSE, Vol. 2/strelkatusha/track.mp3", "coverRef": "cov_48150a8034", "bgRef": null, "meta": {"title": "S.T", "artist": "Arvicheskyy", "difficulty": 5.0, "menu_color": "#b32222"}, "chart": {"bpm": 140, "noteTravelTime": 1000, "gridOffset": 0.041, "timing": [{"time": 0.041, "bpm": 140}], "notes": [{"time": 0, "type": "UP"}, {"time": 3.47, "type": "DOWN"}, {"time": 6.898, "type": "LEFT"}, {"time": 10.327, "type": "RIGHT"}, {"time": 13.755, "type": "LEFT"}, {"time": 17.184, "type": "UP"}, {"time": 20.612, "type": "RIGHT"}, {"time": 21.47, "type": "DOWN"}, {"time": 22.327, "type": "LEFT"}, {"time": 23.184, "type": "UP"}, {"time": 24.041, "type": "RIGHT"}, {"time": 24.47, "type": "LEFT"}, {"time": 24.898, "type": "RIGHT"}, {"time": 25.327, "type": "LEFT"}, {"time": 25.755, "type": "UP"}, {"time": 25.97, "type": "DOWN"}, {"time": 26.184, "type": "UP"}, {"time": 26.398, "type": "DOWN"}, {"time": 26.612, "type": "UP"}, {"time": 26.827, "type": "DOWN"}, {"time": 27.041, "type": "UP"}, {"time": 27.47, "type": "UP"}, {"time": 27.898, "type": "RIGHT"}, {"time": 28.327, "type": "DOWN"}, {"time": 28.755, "type": "DOWN"}, {"time": 29.184, "type": "RIGHT"}, {"time": 29.612, "type": "UP"}, {"time": 30.041, "type": "DOWN"}, {"time": 30.255, "type": "UP"}, {"time": 30.47, "type": "DOWN"}, {"time": 30.684, "type": "UP"}, {"time": 30.898, "type": "RIGHT"}, {"time": 31.327, "type": "RIGHT"}, {"time": 31.755, "type": "LEFT"}, {"time": 31.97, "type": "UP"}, {"time": 32.184, "type": "DOWN"}, {"time": 32.398, "type": "UP"}, {"time": 32.612, "type": "RIGHT"}, {"time": 33.041, "type": "RIGHT"}, {"time": 33.47, "type": "UP"}, {"time": 33.845, "type": "LEFT"}, {"time": 34.059, "type": "RIGHT"}, {"time": 34.273, "type": "LEFT"}, {"time": 34.755, "type": "UP"}, {"time": 35.184, "type": "RIGHT"}, {"time": 35.612, "type": "UP"}, {"time": 36.041, "type": "RIGHT"}, {"time": 36.47, "type": "DOWN"}, {"time": 36.898, "type": "LEFT"}, {"time": 37.327, "type": "UP"}, {"time": 37.755, "type": "RIGHT"}, {"time": 38.184, "type": "UP_RIGHT"}, {"time": 38.612, "type": "UP_LEFT"}, {"time": 39.041, "type": "DOWN_RIGHT"}, {"time": 39.47, "type": "DOWN_LEFT"}, {"time": 39.898, "type": "UP"}, {"time": 40.327, "type": "DOWN"}, {"time": 40.541, "type": "LEFT"}, {"time": 40.755, "type": "RIGHT"}, {"time": 40.97, "type": "LEFT"}, {"time": 41.184, "type": "UP"}, {"time": 41.612, "type": "UP"}, {"time": 42.041, "type": "DOWN"}, {"time": 42.47, "type": "DOWN"}, {"time": 42.898, "type": "RIGHT"}, {"time": 43.327, "type": "UP_RIGHT"}, {"time": 43.755, "type": "UP"}, {"time": 44.184, "type": "DOWN"}, {"time": 44.612, "type": "UP"}, {"time": 45.041, "type": "RIGHT"}, {"time": 45.47, "type": "UP_RIGHT"}, {"time": 45.898, "type": "DOWN_RIGHT"}, {"time": 46.327, "type": "UP_RIGHT"}, {"time": 46.755, "type": "RIGHT"}, {"time": 47.184, "type": "UP"}, {"time": 47.612, "type": "RIGHT"}, {"time": 47.827, "type": "LEFT"}, {"time": 48.041, "type": "RIGHT"}, {"time": 48.47, "type": "UP_RIGHT"}, {"time": 48.898, "type": "UP"}, {"time": 49.327, "type": "DOWN"}, {"time": 49.755, "type": "DOWN"}, {"time": 50.184, "type": "UP"}, {"time": 50.612, "type": "RIGHT"}, {"time": 51.041, "type": "DOWN_RIGHT"}, {"time": 51.47, "type": "DOWN"}, {"time": 51.898, "type": "DOWN_LEFT"}, {"time": 52.327, "type": "UP"}, {"time": 52.755, "type": "RIGHT"}, {"time": 53.184, "type": "DOWN"}, {"time": 54.898, "type": "UP"}, {"time": 55.327, "type": "UP"}, {"time": 55.755, "type": "RIGHT"}, {"time": 56.184, "type": "RIGHT"}, {"time": 56.612, "type": "DOWN"}, {"time": 57.041, "type": "DOWN"}, {"time": 57.47, "type": "LEFT"}, {"time": 57.898, "type": "LEFT"}, {"time": 58.112, "type": "RIGHT"}, {"time": 58.327, "type": "LEFT"}, {"time": 58.755, "type": "UP"}, {"time": 59.184, "type": "DOWN"}, {"time": 59.612, "type": "UP"}, {"time": 60.041, "type": "DOWN"}, {"time": 60.255, "type": "DOWN"}, {"time": 60.47, "type": "UP"}, {"time": 60.898, "type": "UP"}, {"time": 61.112, "type": "UP"}, {"time": 61.327, "type": "UP"}, {"time": 61.541, "type": "DOWN"}, {"time": 61.755, "type": "DOWN"}, {"time": 62.184, "type": "DOWN"}, {"time": 62.612, "type": "LEFT"}, {"time": 63.041, "type": "LEFT"}, {"time": 63.47, "type": "UP"}, {"time": 63.898, "type": "UP"}, {"time": 64.327, "type": "RIGHT"}, {"time": 64.755, "type": "RIGHT"}, {"time": 64.97, "type": "LEFT"}, {"time": 65.184, "type": "RIGHT"}, {"time": 65.612, "type": "DOWN"}, {"time": 66.041, "type": "UP"}, {"time": 66.47, "type": "DOWN"}, {"time": 66.898, "type": "UP"}, {"time": 67.112, "type": "UP"}, {"time": 67.327, "type": "DOWN"}, {"time": 67.755, "type": "DOWN"}, {"time": 67.97, "type": "DOWN"}, {"time": 68.184, "type": "DOWN"}, {"time": 68.398, "type": "UP"}, {"time": 68.612, "type": "REVERSE"}, {"time": 69.041, "type": "UP"}, {"time": 69.469, "type": "RIGHT"}, {"time": 69.898, "type": "RIGHT"}, {"time": 70.326, "type": "DOWN"}, {"time": 70.755, "type": "DOWN"}, {"time": 71.184, "type": "LEFT"}, {"time": 71.612, "type": "LEFT"}, {"time": 71.826, "type": "RIGHT"}, {"time": 72.041, "type": "LEFT"}, {"time": 72.469, "type": "UP"}, {"time": 72.898, "type": "DOWN"}, {"time": 73.326, "type": "UP"}, {"time": 73.755, "type": "DOWN"}, {"time": 73.969, "type": "DOWN"}, {"time": 74.184, "type": "UP"}, {"time": 74.612, "type": "UP"}, {"time": 74.826, "type": "UP"}, {"time": 75.041, "type": "UP"}, {"time": 75.255, "type": "DOWN"}, {"time": 75.469, "type": "DOWN"}, {"time": 75.898, "type": "DOWN"}, {"time": 76.326, "type": "LEFT"}, {"time": 76.755, "type": "LEFT"}, {"time": 77.184, "type": "UP"}, {"time": 77.612, "type": "UP"}, {"time": 78.041, "type": "RIGHT"}, {"time": 78.469, "type": "RIGHT"}, {"time": 78.684, "type": "LEFT"}, {"time": 78.898, "type": "RIGHT"}, {"time": 79.326, "type": "DOWN"}, {"time": 79.755, "type": "UP"}, {"time": 80.184, "type": "DOWN"}, {"time": 80.612, "type": "UP"}, {"time": 88.327, "type": "UP"}, {"time": 88.541, "type": "DOWN"}, {"time": 88.755, "type": "UP"}, {"time": 88.965, "type": "DOWN"}, {"time": 89.184, "type": "UP"}, {"time": 89.612, "type": "RIGHT"}, {"time": 90.041, "type": "DOWN"}, {"time": 90.469, "type": "DOWN"}, {"time": 90.898, "type": "RIGHT"}, {"time": 91.326, "type": "UP"}, {"time": 91.755, "type": "DOWN"}, {"time": 91.969, "type": "UP"}, {"time": 92.184, "type": "DOWN"}, {"time": 92.398, "type": "UP"}, {"time": 92.612, "type": "RIGHT"}, {"time": 93.041, "type": "RIGHT"}, {"time": 93.469, "type": "LEFT"}, {"time": 93.684, "type": "UP"}, {"time": 93.898, "type": "DOWN"}, {"time": 94.112, "type": "UP"}, {"time": 94.326, "type": "RIGHT"}, {"time": 94.755, "type": "RIGHT"}, {"time": 95.184, "type": "UP"}, {"time": 95.398, "type": "LEFT"}, {"time": 95.612, "type": "RIGHT"}, {"time": 95.826, "type": "LEFT"}, {"time": 96.041, "type": "DOWN"}, {"time": 96.469, "type": "UP"}, {"time": 96.898, "type": "RIGHT"}, {"time": 97.326, "type": "UP"}, {"time": 97.755, "type": "RIGHT"}, {"time": 98.184, "type": "DOWN"}, {"time": 98.612, "type": "LEFT"}, {"time": 99.041, "type": "UP"}, {"time": 99.469, "type": "RIGHT"}, {"time": 99.898, "type": "UP_RIGHT"}, {"time": 100.326, "type": "UP_LEFT"}, {"time": 100.541, "type": "UP"}, {"time": 100.755, "type": "DOWN"}, {"time": 100.97, "type": "UP"}, {"time": 101.184, "type": "DOWN"}, {"time": 101.612, "type": "UP"}, {"time": 102.041, "type": "DOWN"}, {"time": 102.255, "type": "LEFT"}, {"time": 102.469, "type": "RIGHT"}, {"time": 102.684, "type": "LEFT"}, {"time": 102.898, "type": "UP"}, {"time": 103.326, "type": "UP"}, {"time": 103.755, "type": "DOWN"}, {"time": 104.184, "type": "DOWN"}, {"time": 104.612, "type": "RIGHT"}, {"time": 105.041, "type": "UP_RIGHT"}, {"time": 105.469, "type": "UP"}, {"time": 105.898, "type": "DOWN"}, {"time": 106.326, "type": "UP"}, {"time": 106.755, "type": "RIGHT"}, {"time": 107.184, "type": "UP_RIGHT"}, {"time": 107.612, "type": "DOWN_RIGHT"}, {"time": 108.041, "type": "UP_RIGHT"}, {"time": 108.469, "type": "RIGHT"}, {"time": 108.898, "type": "UP"}, {"time": 109.326, "type": "RIGHT"}, {"time": 109.541, "type": "LEFT"}, {"time": 109.755, "type": "RIGHT"}, {"time": 110.184, "type": "UP_RIGHT"}, {"time": 110.612, "type": "UP"}, {"time": 111.041, "type": "DOWN"}, {"time": 111.469, "type": "DOWN"}, {"time": 111.898, "type": "UP"}, {"time": 112.326, "type": "RIGHT"}, {"time": 112.755, "type": "DOWN_RIGHT"}, {"time": 113.184, "type": "DOWN"}, {"time": 113.612, "type": "DOWN_LEFT"}, {"time": 114.041, "type": "UP"}, {"time": 114.469, "type": "RIGHT"}, {"time": 114.898, "type": "DOWN"}, {"time": 115.327, "type": "UP"}, {"time": 115.755, "type": "RIGHT"}, {"time": 116.184, "type": "RIGHT"}, {"time": 116.398, "type": "UP"}, {"time": 116.612, "type": "DOWN"}, {"time": 123.47, "type": "UP"}, {"time": 123.898, "type": "UP"}, {"time": 124.327, "type": "UP"}, {"time": 124.755, "type": "DOWN"}, {"time": 125.184, "type": "DOWN"}, {"time": 125.612, "type": "DOWN"}, {"time": 126.041, "type": "RIGHT"}, {"time": 126.47, "type": "RIGHT"}, {"time": 126.898, "type": "RIGHT"}, {"time": 127.327, "type": "LEFT"}, {"time": 127.755, "type": "LEFT"}, {"time": 128.184, "type": "LEFT"}, {"time": 128.612, "type": "UP"}, {"time": 129.041, "type": "UP"}, {"time": 129.47, "type": "UP"}, {"time": 129.898, "type": "DOWN"}, {"time": 130.327, "type": "DOWN"}], "events": [{"time": 27.47, "type": "FLASH"}, {"time": 27.47, "type": "SHAKE"}, {"time": 27.47, "type": "CAMERA_BOB_ON"}, {"time": 27.47, "type": "BG_COLOR", "color": "#000000"}, {"time": 27.577, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 31.97, "type": "FX_INVERT", "duration": 0.535}, {"time": 31.97, "type": "FLASH"}, {"time": 32.505, "type": "FLASH"}, {"time": 33.791, "type": "FX_INVERT", "duration": 0.482}, {"time": 33.791, "type": "FLASH"}, {"time": 34.273, "type": "FLASH"}, {"time": 40.541, "type": "FLASH"}, {"time": 40.541, "type": "FX_INVERT", "duration": 0.536}, {"time": 41.077, "type": "FLASH"}, {"time": 47.612, "type": "FLASH"}, {"time": 47.612, "type": "FX_INVERT", "duration": 0.429}, {"time": 48.041, "type": "FLASH"}, {"time": 53.184, "type": "HUD_HIDE"}, {"time": 53.184, "type": "FLASH"}, {"time": 53.184, "type": "CAMERA_BOB_OFF"}, {"time": 53.291, "type": "NOTE_SPEED", "speed": 1}, {"time": 53.612, "type": "FLASH"}, {"time": 54.041, "type": "FLASH"}, {"time": 54.47, "type": "FLASH"}, {"time": 54.898, "type": "FLASH"}, {"time": 54.898, "type": "CAMERA_BOB_ON"}, {"time": 60.041, "type": "FLASH"}, {"time": 60.255, "type": "FLASH"}, {"time": 60.47, "type": "FLASH"}, {"time": 60.898, "type": "FLASH"}, {"time": 61.112, "type": "FLASH"}, {"time": 61.327, "type": "FLASH"}, {"time": 61.541, "type": "FLASH"}, {"time": 61.755, "type": "FLASH"}, {"time": 66.898, "type": "FLASH"}, {"time": 67.112, "type": "FLASH"}, {"time": 67.327, "type": "FLASH"}, {"time": 67.755, "type": "FLASH"}, {"time": 67.97, "type": "FLASH"}, {"time": 68.184, "type": "FLASH"}, {"time": 68.398, "type": "FLASH"}, {"time": 68.612, "type": "FLASH"}, {"time": 68.612, "type": "FX_INVERT", "duration": 12.108}, {"time": 68.612, "type": "NOTES_FLOW_RIGHT"}, {"time": 80.72, "type": "FLASH"}, {"time": 82.327, "type": "BLACKOUT", "duration": 5.464}, {"time": 82.97, "type": "HUD_SHOW"}, {"time": 85.327, "type": "NOTE_SPEED", "speed": 1.5}, {"time": 87.791, "type": "FLASH"}, {"time": 87.791, "type": "CAMERA_BOB_OFF"}, {"time": 88.755, "type": "FLASH", "duration": 0.429}, {"time": 89.184, "type": "CAMERA_BOB_ON"}, {"time": 93.684, "type": "FLASH"}, {"time": 93.684, "type": "FX_INVERT", "duration": 0.536}, {"time": 94.22, "type": "FLASH"}, {"time": 95.398, "type": "FX_INVERT", "duration": 0.643}, {"time": 95.398, "type": "FLASH"}, {"time": 96.041, "type": "FLASH"}, {"time": 100.541, "type": "FLASH"}, {"time": 100.541, "type": "FX_INVERT", "duration": 0.536}, {"time": 101.077, "type": "FLASH"}, {"time": 102.255, "type": "FLASH"}, {"time": 102.255, "type": "FX_INVERT", "duration": 0.643}, {"time": 102.898, "type": "FLASH"}, {"time": 109.22, "type": "FX_INVERT", "duration": 0.535}, {"time": 109.22, "type": "FLASH"}, {"time": 109.755, "type": "FLASH"}, {"time": 116.291, "type": "FLASH"}, {"time": 116.291, "type": "FX_INVERT", "duration": 0.535}, {"time": 116.827, "type": "FLASH"}, {"time": 116.827, "type": "CAMERA_BOB_OFF"}, {"time": 116.827, "type": "BG_COLOR", "duration": 6.643, "color": "#3584e4"}, {"time": 116.934, "type": "NOTE_SPEED", "speed": 0.75}, {"time": 123.47, "type": "FLASH"}, {"time": 130.327, "type": "SHAKE"}, {"time": 130.327, "type": "FLASH"}, {"time": 132.148, "type": "BLACKOUT", "duration": 1.607}], "audioFile": "track.mp3", "audioFormat": "mp3"}}}}}};


  // --- Встроенные ресурсы для иконки 1/50 и кнопки cubeface ---
  const ROBTOP_ICON_DATA_URI = "data:image/png;base64,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";
  const CUBEFACE_IMG_DATA_URI = "data:image/png;base64,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";
  const VERNAM_AUDIO_DATA_URI = "data:audio/ogg;base64,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";

  const state = {
    meta: {
      title: 'Hi-Tech (Custom Mix)',
      artist: 'Swipetava Crew',
      difficulty: 7,
      menu_color: '#2a0a5e'
    },
    chart: {
      bpm: 165,
      noteTravelTime: 1000,
      gridOffset: 0.09,
      timing: [{ time: 0.09, bpm: 165 }],
      title: 'Hi-Tech (Custom Mix)',
      artist: 'Swipetava Crew',
      notes: [],
      events: [],
      audioFile: 'track.ogg',
      audioFormat: 'ogg',
      coverFile: 'Cover.png',
      backgroundFile: 'bg.png'
    },
    // Сырые бинарные файлы для упаковки в .swmap
    assets: {
      audioBytes: null,
      audioMime: 'audio/ogg',
      coverBytes: null,
      bgBytes: null,
      extraFiles: {} // прочие файлы из архива, если были
    },
    // Объекты для предпросмотра
    coverImage: null,
    bgImage: null,
    // Аудио и воспроизведение
    audioCtx: null,
    audioBuffer: null,
    audioEl: new Audio(),
    audioObjectUrl: null,
    waveformPeaks: null,
    duration: 120,
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1.0,
    hitsoundEnabled: true,
    metronomeEnabled: false,
    liveRecordNotes: false,
    tlTouchMode: 'scroll', // 'scroll' | 'draw' | 'erase'
    // Настройки редактора и таймлайна
    activeNoteType: 'RIGHT',
    activeEventType: 'TEXT',
    snapDivisor: 4, // 1/4 доли
    zoomPxPerSec: 180,
    timelineScrollX: 0,
    timelineViewMode: 'pianoroll', // 'pianoroll' (10 рядов) | 'compact' (1 ряд)
    timelineTouchMode: 'draw',     // 'draw' (Правка) | 'scroll' (Прокрутка) | 'erase' (Ластик)
    stackMode: true,              // Стак-режим (+нота на тот же таймкод)
    recMode: false,                // Живая запись нот на лету под музыку
    onsetEnv: null,                // Огибающая аудио-волны для привязки к удару (Onset)
    onsetSr: 200,
    lastStats: null,               // Кеш расчёта NPS и баллов сложности (SDP)
    selectedItem: null, // { kind: 'note' | 'event', item: obj }
    draggingItem: null,
    isScrubbing: false,
    // Стек Undo / Redo
    undoStack: [],
    redoStack: [],
    // Для озвучки нот в реальном времени
    lastAudioTime: 0
  };

  state.audioEl.preload = 'auto';

  // --- Вспомогательные функции ---
  function roundTime(t) {
    return Math.max(0, Math.round(t * 1000) / 1000);
  }

  function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  function getActiveTimingAt(timeSec) {
    const list = state.chart.timing && state.chart.timing.length
      ? state.chart.timing
      : [{ time: state.chart.gridOffset || 0, bpm: state.chart.bpm || 120 }];
    let active = list[0];
    for (let i = 0; i < list.length; i++) {
      if (list[i].time <= timeSec + 1e-4) {
        active = list[i];
      } else {
        break;
      }
    }
    return {
      time: Number(active.time) || 0,
      bpm: Math.max(10, Number(active.bpm) || state.chart.bpm || 120)
    };
  }

  function snapToOnsetPeak(timeSec, windowSec = 0.045) {
    const env = state.onsetEnv;
    const sr = state.onsetSr || 200;
    if (!env || !env.length) return null;
    const i0 = Math.max(1, Math.floor((timeSec - windowSec) * sr));
    const i1 = Math.min(env.length - 2, Math.ceil((timeSec + windowSec) * sr));
    if (i1 <= i0) return null;
    let bestI = -1;
    let bestV = 0;
    for (let i = i0; i <= i1; i++) {
      const v = env[i];
      if (v >= env[i - 1] && v >= env[i + 1] && v > bestV) {
        bestV = v;
        bestI = i;
      }
    }
    if (bestI < 0) return null;
    let localSum = 0;
    const w0 = Math.max(0, bestI - 15);
    const w1 = Math.min(env.length - 1, bestI + 15);
    for (let i = w0; i <= w1; i++) localSum += env[i];
    const localMean = localSum / Math.max(1, w1 - w0 + 1);
    if (bestV < localMean * 1.35 || bestV < 0.04) return null;
    const a = env[bestI - 1], b = env[bestI], c = env[bestI + 1];
    const denom = a - 2 * b + c;
    const frac = Math.abs(denom) > 1e-7 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / denom)) : 0;
    return roundTime(Math.max(0, (bestI + frac) / sr));
  }

  function snapTime(timeSec) {
    if (!state.snapDivisor || state.snapDivisor === 0) return roundTime(timeSec);
    if (state.snapDivisor === -1) {
      const p = snapToOnsetPeak(timeSec, 0.045);
      return p !== null ? p : roundTime(timeSec);
    }
    const div = state.snapDivisor === -2 ? 4 : state.snapDivisor;
    const tp = getActiveTimingAt(timeSec);
    const beatSec = 60 / tp.bpm;
    const stepSec = beatSec / div;
    const rel = timeSec - tp.time;
    const gridT = roundTime(Math.max(0, tp.time + Math.round(rel / stepSec) * stepSec));
    if (state.snapDivisor === -2) {
      const p = snapToOnsetPeak(gridT, Math.min(0.024, stepSec * 0.35));
      return p !== null ? p : gridT;
    }
    return gridT;
  }

  function stepBySnap(dir) {
    const div = (state.snapDivisor && state.snapDivisor > 0) ? state.snapDivisor : 4;
    const tp = getActiveTimingAt(state.currentTime);
    const stepSec = (60 / tp.bpm) / div;
    setCurrentTime(roundTime(Math.max(0, state.currentTime + dir * stepSec)));
  }

  function sortChart() {
    state.chart.notes.sort((a, b) => a.time - b.time);
    state.chart.events.sort((a, b) => a.time - b.time);
    if (Array.isArray(state.chart.timing)) {
      state.chart.timing.sort((a, b) => a.time - b.time);
    }
  }

  function pushUndo() {
    const snapshot = JSON.stringify({
      meta: state.meta,
      chart: state.chart
    });
    if (state.undoStack.length > 0 && state.undoStack[state.undoStack.length - 1] === snapshot) {
      return;
    }
    state.undoStack.push(snapshot);
    if (state.undoStack.length > 60) state.undoStack.shift();
    state.redoStack.length = 0;
    updateUndoRedoButtons();
  }

  function undo() {
    if (!state.undoStack.length) return;
    const current = JSON.stringify({ meta: state.meta, chart: state.chart });
    state.redoStack.push(current);
    const prev = JSON.parse(state.undoStack.pop());
    state.meta = prev.meta;
    state.chart = prev.chart;
    state.selectedItem = null;
    syncMetaAndChartInputs();
    refreshAllViews();
    updateUndoRedoButtons();
    setStatus('Отменено последнее действие');
  }

  function redo() {
    if (!state.redoStack.length) return;
    const current = JSON.stringify({ meta: state.meta, chart: state.chart });
    state.undoStack.push(current);
    const next = JSON.parse(state.redoStack.pop());
    state.meta = next.meta;
    state.chart = next.chart;
    state.selectedItem = null;
    syncMetaAndChartInputs();
    refreshAllViews();
    updateUndoRedoButtons();
    setStatus('Повторено отменённое действие');
  }

  function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = state.undoStack.length === 0;
    if (btnRedo) btnRedo.disabled = state.redoStack.length === 0;
  }

  function setStatus(msg) {
    const el = document.getElementById('status-text');
    if (el) el.textContent = msg;
  }

  // --- Звуковой синтезатор (хитсаунд и метроном) ---
  function ensureAudioCtx() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) state.audioCtx = new Ctx();
    }
    if (state.audioCtx && state.audioCtx.state === 'suspended') {
      state.audioCtx.resume().catch(() => {});
    }
    return state.audioCtx;
  }

  function playTick(freq = 1100, gainVal = 0.16, duration = 0.035, type = 'triangle') {
    try {
      const ctx = ensureAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, ctx.currentTime + duration);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (_) {}
  }

  function parseHexRgb(hex) {
    const h = String(hex || '#2a0a5e').replace('#', '').trim();
    if (h.length === 3) {
      return [parseInt(h[0]+h[0],16)||0, parseInt(h[1]+h[1],16)||0, parseInt(h[2]+h[2],16)||0];
    }
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return [42, 10, 94];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpHexColor(c1, c2, p) {
    const k = Math.max(0, Math.min(1, p));
    const [r1, g1, b1] = parseHexRgb(c1);
    const [r2, g2, b2] = parseHexRgb(c2);
    const r = Math.round(r1 + (r2 - r1) * k);
    const g = Math.round(g1 + (g2 - g1) * k);
    const b = Math.round(b1 + (b2 - b1) * k);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // --- Расчёт состояния карты в момент времени t ---
  function evaluateStateAt(t) {
    let speed = 1.0;
    let flowLeft = true; // В игре (field_mirror.gd) со старта приёмник слева, поток летит справа налево (NOTES_FLOW_LEFT)
    let lastFlowEventTime = -1;
    let earlyReverseWarning = false;
    let bounce = false;
    let spin = false;
    let noteWave = false;
    let push = false;
    let camBob = false;
    let hudHidden = false;
    let bgColor = state.meta.menu_color || '#2a0a5e';
    let bgColorActive = false;
    let discoActive = null;
    let activeText = null;
    let blackoutAlpha = 0;
    let flashAlpha = 0;
    let shakeIntensity = 0;
    const activeFx = {};

    const events = state.chart.events;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.time > t) break;
      const dt = t - ev.time;

      switch (ev.type) {
        case 'NOTE_SPEED':
          speed = Math.max(0.1, Number(ev.speed) || 1.0);
          break;
        case 'HUD_HIDE':
          hudHidden = true;
          break;
        case 'HUD_SHOW':
          hudHidden = false;
          break;
        case 'BG_COLOR': {
          const targetCol = ev.color || '#62a0ea';
          const dur = Number(ev.duration) || 0;
          bgColorActive = true;
          if (dur <= 0 || dt >= dur) {
            bgColor = targetCol;
          } else if (dt >= 0) {
            bgColor = lerpHexColor(bgColor, targetCol, dt / dur);
          }
          break;
        }
        case 'NOTES_FLOW_LEFT':
          flowLeft = true;
          lastFlowEventTime = ev.time;
          break;
        case 'NOTES_FLOW_RIGHT':
          flowLeft = false;
          lastFlowEventTime = ev.time;
          if (ev.time > 0.001 && ev.time <= 1.0) earlyReverseWarning = true;
          break;
        case 'NOTES_BOUNCE_ON':
          bounce = true;
          break;
        case 'NOTES_BOUNCE_OFF':
          bounce = false;
          break;
        case 'NOTES_SPIN_ON':
          spin = true;
          break;
        case 'NOTES_SPIN_OFF':
          spin = false;
          break;
        case 'NOTES_WAVE_ON':
          noteWave = true;
          break;
        case 'NOTES_WAVE_OFF':
          noteWave = false;
          break;
        case 'NOTE_PUSH_ON':
          push = true;
          break;
        case 'NOTE_PUSH_OFF':
          push = false;
          break;
        case 'CAMERA_BOB_ON':
          camBob = true;
          break;
        case 'CAMERA_BOB_OFF':
          camBob = false;
          break;
        case 'DISCO': {
          const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 8.0;
          if (dt >= 0 && dt <= dur) {
            discoActive = { progress: dt / dur, duration: dur, dt };
          }
          break;
        }
        case 'TEXT': {
          const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 1.5;
          if (dt >= 0 && dt <= dur) {
            activeText = {
              text: ev.text || '',
              color: ev.color || '#ffffff',
              progress: dt / dur,
              duration: dur,
              time: ev.time
            };
          }
          break;
        }
        case 'BLACKOUT': {
          const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 2.0;
          if (dt >= 0 && dt <= dur) {
            const fade = Math.min(1, Math.min(dt / 0.15, (dur - dt) / 0.25));
            blackoutAlpha = Math.max(blackoutAlpha, Math.max(0, fade));
          }
          break;
        }
        case 'FLASH': {
          const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0.38;
          if (dt >= 0 && dt <= dur) {
            const peak = Number(ev.duration) > 1.0 ? 0.55 : 0.95;
            flashAlpha = Math.max(flashAlpha, peak * (1 - dt / dur));
          }
          break;
        }
        case 'SHAKE': {
          const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0.28;
          if (dt >= 0 && dt <= dur) {
            shakeIntensity = Math.max(shakeIntensity, 1 - dt / dur);
          }
          break;
        }
        default: {
          if (ev.type && ev.type.startsWith('FX_')) {
            const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0.5;
            if (dt >= 0 && dt <= dur) {
              activeFx[ev.type] = {
                progress: dt / dur,
                remaining: dur - dt,
                duration: dur
              };
            }
          }
          break;
        }
      }
    }

    // Учитываем реверс-ноты напрямую (как _heal_missing_reverse_events в chart_manager.gd)
    // и проверяем ловушку EARLY_EVENT_WINDOW = 1.0 сек
    let combo = 0;
    let lastHitNote = null;
    const notes = state.chart.notes;
    for (let i = 0; i < notes.length; i++) {
      const nt = notes[i];
      if ((nt.type === 'REVERSE' || nt.type === 'REVERSE_BACK') && nt.time > 0.001 && nt.time <= 1.0) {
        earlyReverseWarning = true;
      }
      if (nt.time <= t) {
        combo++;
        if (t - nt.time <= 0.35) {
          lastHitNote = nt;
        }
        if ((nt.type === 'REVERSE' || nt.type === 'REVERSE_BACK') && nt.time >= lastFlowEventTime - 0.001) {
          flowLeft = (nt.type === 'REVERSE_BACK');
          lastFlowEventTime = nt.time;
        }
      } else {
        break;
      }
    }

    return {
      speed,
      flowLeft,
      earlyReverseWarning,
      bounce,
      spin,
      noteWave,
      push,
      camBob,
      hudHidden,
      bgColor,
      bgColorActive,
      discoActive,
      activeText,
      blackoutAlpha,
      flashAlpha,
      shakeIntensity,
      activeFx,
      combo,
      lastHitNote
    };
  }

  // --- Отрисовка ноты-стрелки (в точном стиле Swipetava) ---
  function drawSwipeNote(ctx, x, y, radius, typeId, alpha = 1, highlight = false, extraSpinRad = 0) {
    const def = NOTE_MAP[typeId] || { id: typeId, short: '?', angle: 0, color: '#38bdf8' };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (extraSpinRad) ctx.rotate(extraSpinRad);

    if (highlight) {
      ctx.beginPath();
      ctx.arc(0, 0, radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (def.spin) {
      // Круговая нота из редактора
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = def.color;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 1.45);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(radius * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.short, 0, 1);
      ctx.restore();
      return;
    }

    ctx.rotate(def.angle || 0);

    // Внешний контур стрелки (направлена вправо при angle=0)
    const s = radius / 22;
    ctx.beginPath();
    ctx.moveTo(20 * s, 0);
    ctx.lineTo(-4 * s, -17 * s);
    ctx.lineTo(-4 * s, -7 * s);
    ctx.lineTo(-19 * s, -7 * s);
    ctx.lineTo(-19 * s, 7 * s);
    ctx.lineTo(-4 * s, 7 * s);
    ctx.lineTo(-4 * s, 17 * s);
    ctx.closePath();

    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.restore();
  }

  // --- Отрисовка окна живого игрового превью ---
  function renderPreviewCanvas() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const t = state.currentTime;
    const st = evaluateStateAt(t);
    const tp = getActiveTimingAt(t);
    const beatPhase = ((t - tp.time) * (tp.bpm / 60));
    const beatPulse = Math.exp(-((beatPhase - Math.floor(beatPhase)) * 5.5));

    // Собираем CSS-подобные фильтры для шейдеров
    const filters = [];
    if (st.activeFx.FX_INVERT) filters.push('invert(1)');
    if (st.activeFx.FX_BW) filters.push('grayscale(1) contrast(1.35)');
    if (st.activeFx.FX_DUOTONE) filters.push('sepia(0.9) hue-rotate(255deg) saturate(3.2) contrast(1.25)');
    if (st.activeFx.FX_POSTERIZE) filters.push('contrast(2.4) saturate(1.8)');

    ctx.save();
    ctx.filter = filters.length ? filters.join(' ') : 'none';

    // Камера: CAMERA_BOB, SHAKE, FX_ZOOM_BLUR
    ctx.translate(W / 2, H / 2);
    let scale = 1.0;
    let rot = 0;
    let offX = 0;
    let offY = 0;

    if (st.camBob) {
      scale += 0.035 * beatPulse;
      rot += Math.sin(beatPhase * Math.PI) * 0.022;
    }
    if (st.activeFx.FX_ZOOM_BLUR) {
      scale += 0.09 * Math.sin(st.activeFx.FX_ZOOM_BLUR.progress * Math.PI);
    }
    if (st.shakeIntensity > 0) {
      const amp = 14 * st.shakeIntensity;
      offX += Math.sin(t * 95) * amp;
      offY += Math.cos(t * 113) * amp;
    }
    if (st.activeFx.FX_WAVE) {
      offX += Math.sin(t * 14) * 8;
      rot += Math.cos(t * 10) * 0.015;
    }

    ctx.scale(scale, scale);
    ctx.rotate(rot);
    ctx.translate(-W / 2 + offX, -H / 2 + offY);

    // 1. Фон карты
    if (state.bgImage) {
      const iw = state.bgImage.width || W;
      const ih = state.bgImage.height || H;
      const r = Math.max(W / iw, H / ih);
      const dw = iw * r;
      const dh = ih * r;
      ctx.drawImage(state.bgImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(7, 10, 21, 0.42)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, st.bgColor || state.meta.menu_color || '#2a0a5e');
      grad.addColorStop(1, st.bgColorActive ? lerpHexColor(st.bgColor, '#05070f', 0.55) : '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Сетка на фоне
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, H);
        ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
      }
    }

    // 2. Горизонтальная дорожка нот (как в Swipetava)
    const laneY = H * 0.56;
    const laneH = 88;
    ctx.fillStyle = 'rgba(9, 13, 26, 0.58)';
    ctx.fillRect(0, laneY - laneH / 2, W, laneH);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, laneY - laneH / 2);
    ctx.lineTo(W, laneY - laneH / 2);
    ctx.moveTo(0, laneY + laneH / 2);
    ctx.lineTo(W, laneY + laneH / 2);
    ctx.stroke();

    // Позиция линии удара (справа при NOTES_FLOW_RIGHT, слева при NOTES_FLOW_LEFT)
    const judgeX = st.flowLeft ? W * 0.16 : W * 0.84;
    const spawnX = st.flowLeft ? W + 36 : -36;

    // Светящийся квадрат-приёмник (TargetZone / BeatIndicator как в игре на скриншотах)
    ctx.save();
    const hitPulse = st.lastHitNote ? Math.max(0, 1 - (t - st.lastHitNote.time) / 0.18) : 0;
    const boxSize = 86 + hitPulse * 8;
    ctx.strokeStyle = hitPulse > 0 ? '#67e8f9' : 'rgba(224, 242, 254, 0.88)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14 + hitPulse * 10;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
    ctx.beginPath();
    ctx.roundRect(judgeX - boxSize / 2, laneY - boxSize / 2, boxSize, boxSize, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3. Отрисовка летящих нот и ВЕРТИКАЛЬНЫХ СТАКОВ (_mark_double_notes + _double_note_offset из chart_manager.gd)
    const baseTravelSec = Math.max(0.15, (Number(state.chart.noteTravelTime) || 1000) / 1000);
    const effectiveTravelSec = baseTravelSec / st.speed;
    const pushOffsetPx = st.push ? Math.sin(beatPhase * Math.PI * 2) * 18 * beatPulse : 0;

    const notes = state.chart.notes;
    // Группируем ноты с одинаковым временем (допуск 5 мс, как is_equal_approx в игре) в один вертикальный ряд (стак)
    let idx = 0;
    while (idx < notes.length) {
      let j = idx + 1;
      while (j < notes.length && Math.abs(notes[j].time - notes[idx].time) <= 0.005) {
        j++;
      }
      const groupSize = j - idx;
      const groupTime = notes[idx].time;
      const timeUntilHit = groupTime - t;

      if (timeUntilHit >= -0.12 && timeUntilHit <= effectiveTravelSec * 1.15) {
        const progress = 1 - (timeUntilHit / effectiveTravelSec);
        const nx = spawnX + (judgeX - spawnX) * progress + (st.flowLeft ? -pushOffsetPx : pushOffsetPx);
        let baseNy = laneY;

        if (st.bounce) {
          baseNy += Math.sin((t * 11) + groupTime * 9) * 20;
        }
        if (st.noteWave) {
          baseNy += Math.sin((groupTime - t) * 8.5 + t * 5.5) * 22;
        }
        if (st.activeFx.FX_WAVE || st.activeFx.FX_AQUA) {
          baseNy += Math.sin(nx * 0.035 + t * 12) * 10;
        }

        // В игре double_note_scale = 0.8, а смещение по вертикали = (slot - (groupSize - 1)/2) * spacing
        const noteRadius = groupSize > 1 ? 17.5 : 22;
        const stackSpacing = groupSize <= 1 ? 0 : (groupSize === 2 ? 42 : Math.min(38, 148 / groupSize));
        const alpha = timeUntilHit < 0 ? Math.max(0, 1 + timeUntilHit / 0.12) : 1;

        if (groupSize > 1) {
          const topY = baseNy - ((groupSize - 1) / 2) * stackSpacing;
          const botY = baseNy + ((groupSize - 1) / 2) * stackSpacing;
          ctx.save();
          ctx.globalAlpha = alpha * 0.55;
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(nx, topY);
          ctx.lineTo(nx, botY);
          ctx.stroke();
          ctx.restore();
        }

        for (let k = idx; k < j; k++) {
          const n = notes[k];
          const slot = k - idx;
          const centeredSlot = slot - (groupSize - 1) / 2;
          const ny = baseNy + centeredSlot * stackSpacing;
          const extraSpin = st.spin ? (t * 7.5 + n.time * 4.0) : 0;
          const isSelected = state.selectedItem && state.selectedItem.kind === 'note' && state.selectedItem.item === n;
          drawSwipeNote(ctx, nx, ny, noteRadius, n.type, alpha, isSelected, extraSpin);
        }
      }
      idx = j;
    }

    // 4. Оверлей кастомной надписи вместо комбо (TEXT, как на Hi-Tech) или стандартного комбо (если не активен HUD_HIDE)
    const centerTextY = H * 0.25;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (st.activeText && st.activeText.text) {
      const pop = st.activeText.progress < 0.12 ? (0.85 + (st.activeText.progress / 0.12) * 0.22) : 1.0;
      ctx.translate(W / 2, centerTextY);
      ctx.scale(pop, pop);
      ctx.font = '800 32px system-ui, -apple-system, sans-serif';
      ctx.shadowColor = st.activeText.color || '#ffffff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = st.activeText.color || '#ffffff';
      ctx.fillText(st.activeText.text, 0, 0);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(st.activeText.text, 0, 0);
    } else if (!st.hudHidden) {
      // Стандартная зона комбо и оценки Swipetava
      ctx.font = '800 26px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(`${st.combo}x`, W / 2, centerTextY - 10);
      if (st.lastHitNote) {
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.fillStyle = '#fde047';
        ctx.fillText('PERFECT!', W / 2, centerTextY + 16);
      }
    }
    ctx.restore();

    // 5. Пост-эффекты поверх канваса (DISCO, FX_PIXELATE, FX_GLITCH, FX_HALFTONE, FX_OLD_TV, BLACKOUT, FLASH)
    if (st.discoActive) {
      ctx.save();
      const hue1 = Math.floor((t * 220) % 360);
      const hue2 = (hue1 + 140) % 360;
      const discoGrad = ctx.createLinearGradient(0, 0, W, H);
      const alpha = (0.16 + 0.14 * beatPulse).toFixed(3);
      discoGrad.addColorStop(0, `hsla(${hue1}, 95%, 55%, ${alpha})`);
      discoGrad.addColorStop(1, `hsla(${hue2}, 95%, 55%, ${alpha})`);
      ctx.fillStyle = discoGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (st.activeFx.FX_PIXELATE) {
      ctx.save();
      const step = 12;
      ctx.strokeStyle = 'rgba(163, 230, 53, 0.16)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (st.activeFx.FX_HALFTONE) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      for (let x = 8; x < W; x += 14) {
        for (let y = 8; y < H; y += 14) {
          ctx.beginPath();
          ctx.arc(x, y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    if (st.activeFx.FX_OLD_TV) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      for (let y = 0; y < H; y += 4) {
        ctx.fillRect(0, y, W, 2);
      }
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, W * 0.65);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (st.activeFx.FX_GLITCH) {
      ctx.save();
      for (let k = 0; k < 5; k++) {
        const sy = Math.floor(((Math.sin(t * 70 + k * 19) + 1) * 0.5) * (H - 24));
        const sh = 8 + (k * 5);
        const shift = Math.sin(t * 120 + k * 7) * 18;
        ctx.drawImage(canvas, 0, sy, W, sh, shift, sy, W, sh);
        ctx.fillStyle = k % 2 === 0 ? 'rgba(244, 63, 94, 0.18)' : 'rgba(56, 189, 248, 0.18)';
        ctx.fillRect(0, sy, W, sh);
      }
      ctx.restore();
    }

    if (st.activeFx.FX_RGB_SPLIT) {
      ctx.save();
      const shift = 5 + Math.sin(t * 24) * 3;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(canvas, -shift, 0);
      ctx.drawImage(canvas, shift, 0);
      ctx.fillStyle = 'rgba(251, 113, 133, 0.12)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (st.activeFx.FX_AQUA) {
      ctx.save();
      const aquaGrad = ctx.createLinearGradient(0, 0, 0, H);
      aquaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.24)');
      aquaGrad.addColorStop(1, 'rgba(30, 58, 138, 0.34)');
      ctx.fillStyle = aquaGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.26)';
      ctx.lineWidth = 2;
      for (let wy = 24; wy < H; wy += 36) {
        ctx.beginPath();
        for (let wx = 0; wx <= W; wx += 20) {
          const dy = Math.sin(wx * 0.03 + t * 4.5 + wy) * 6;
          if (wx === 0) ctx.moveTo(wx, wy + dy);
          else ctx.lineTo(wx, wy + dy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // Точный рендер FX_DUOTONE по шейдеру fx_duotone.gdshader (color_dark #170a47 <-> color_light #ffd973)
    if (st.activeFx.FX_DUOTONE) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(72, 42, 148, 0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'screen';
      const duoGrad = ctx.createLinearGradient(0, 0, W, H);
      duoGrad.addColorStop(0, 'rgba(23, 10, 71, 0.65)');
      duoGrad.addColorStop(0.55, 'rgba(168, 85, 247, 0.28)');
      duoGrad.addColorStop(1, 'rgba(255, 217, 115, 0.62)');
      ctx.fillStyle = duoGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = 'rgba(245, 195, 95, 0.52)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Точный рендер FX_ASH_WIND по шейдеру fx_ash_wind.gdshader (3 слоя пепла на ветру + марево + пепельный грейд)
    if (st.activeFx.FX_ASH_WIND) {
      ctx.save();
      ctx.fillStyle = 'rgba(65, 50, 38, 0.26)';
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 42; i++) {
        const layer = i % 3;
        const spd = layer === 0 ? 110 : layer === 1 ? 75 : 45;
        const sz = layer === 0 ? 3.2 : layer === 1 ? 2.2 : 1.4;
        const px = ((i * 97 + t * spd) % (W + 40)) - 20;
        const py = ((i * 53 - t * (spd * 0.45) + Math.sin(t * 3 + i) * 14) % H + H) % H;
        ctx.fillStyle = layer === 0 ? 'rgba(240, 224, 206, 0.78)' : 'rgba(214, 195, 176, 0.48)';
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Точный рендер FX_DREAD по шейдеру fx_dread.gdshader (пульсирующие тени с краёв + хроматический сдвиг)
    if (st.activeFx.FX_DREAD) {
      ctx.save();
      const pulse = 0.55 + 0.25 * Math.sin(t * 9.5) + 0.15 * Math.cos(t * 23.0);
      const dreadGrad = ctx.createRadialGradient(W / 2, H / 2, H * (0.18 * (2 - pulse)), W / 2, H / 2, W * 0.62);
      dreadGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      dreadGrad.addColorStop(0.55, 'rgba(35, 4, 12, 0.48)');
      dreadGrad.addColorStop(1, 'rgba(5, 0, 4, 0.92)');
      ctx.fillStyle = dreadGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.restore();
    }

    if (st.earlyReverseWarning) {
      ctx.save();
      ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('⚠ Реверс на <= 1.0 сек: в игре сработает сразу со старта (EARLY_EVENT_WINDOW)', 14, H - 34);
      ctx.restore();
    }

    if (st.activeFx.FX_ENDING) {
      ctx.save();
      const p = st.activeFx.FX_ENDING.progress;
      const barH = Math.round(H * 0.14 * Math.sin(Math.min(1, p * 2) * Math.PI * 0.5));
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, W, barH);
      ctx.fillRect(0, H - barH, W, barH);
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7);
      vig.addColorStop(0, 'rgba(129, 140, 248, 0.08)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (st.blackoutAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${st.blackoutAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (st.flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${st.flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();

    // 6. Информационный HUD поверх превью (скорость, направление, активные эффекты)
    ctx.save();
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(8, 8, 255, 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const effMs = Math.round((Number(state.chart.noteTravelTime) || 1000) / st.speed);
    ctx.fillText(
      `BPM ${tp.bpm} | SPEED ${st.speed}x (${effMs}мс) | ${st.flowLeft ? '← LEFT' : 'RIGHT →'}`,
      14,
      20
    );

    // Бейджи активных эффектов в правом верхнем углу
    const badges = [];
    if (st.hudHidden) badges.push({ text: 'HUD_HIDDEN', color: '#f472b6' });
    if (st.bgColorActive) badges.push({ text: `BG ${st.bgColor}`, color: st.bgColor });
    if (st.discoActive) badges.push({ text: 'DISCO', color: '#e879f9' });
    if (st.bounce) badges.push({ text: 'BOUNCE', color: '#a855f7' });
    if (st.spin) badges.push({ text: 'SPIN', color: '#38bdf8' });
    if (st.noteWave) badges.push({ text: 'WAVE', color: '#06b6d4' });
    if (st.push) badges.push({ text: 'PUSH', color: '#ec4899' });
    if (st.camBob) badges.push({ text: 'CAM_BOB', color: '#f97316' });
    for (const fxKey of Object.keys(st.activeFx)) {
      const def = EVENT_MAP[fxKey];
      badges.push({ text: fxKey, color: def ? def.color : '#38bdf8' });
    }

    let bx = W - 10;
    for (const b of badges) {
      const tw = ctx.measureText(b.text).width + 12;
      bx -= tw;
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, 8, tw, 20);
      ctx.fillStyle = '#090d16';
      ctx.fillText(b.text, bx + 6, 18);
      bx -= 5;
    }
    ctx.restore();
  }

  // --- Отрисовка многодорожечного таймлайна (10-рядный Пиано-ролл + компактный режим) ---
  function getTimelineTrackLayout(H) {
    const isPiano = state.timelineViewMode === 'pianoroll';
    if (isPiano) {
      const rulerBottom = 24;
      const waveTop = 24;
      const waveBottom = 56;
      const notesTop = 56;
      const notesHeight = Math.max(150, H - 56 - 78);
      const notesBottom = notesTop + notesHeight;
      const textSpeedTop = notesBottom;
      const textSpeedBottom = notesBottom + 38;
      const fxTop = textSpeedBottom;
      const fxBottom = H;
      const laneH = notesHeight / NOTE_TYPES.length;
      return {
        isPiano: true,
        rulerBottom,
        waveTop,
        waveBottom,
        notesTop,
        notesBottom,
        laneH,
        textSpeedTop,
        textSpeedBottom,
        fxTop,
        fxBottom
      };
    }
    return {
      isPiano: false,
      rulerBottom: 26,
      waveTop: 26,
      waveBottom: 74,
      notesTop: 74,
      notesBottom: 136,
      laneH: 62,
      textSpeedTop: 136,
      textSpeedBottom: 184,
      fxTop: 184,
      fxBottom: H
    };
  }

  function timeToX(timeSec, labelWidth) {
    return labelWidth + (timeSec * state.zoomPxPerSec) - state.timelineScrollX;
  }

  function xToTime(x, labelWidth) {
    return Math.max(0, (x - labelWidth + state.timelineScrollX) / state.zoomPxPerSec);
  }

  function renderTimelineCanvas() {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const desiredH = state.timelineViewMode === 'pianoroll' ? 316 : 230;
    if (canvas.height !== desiredH) {
      canvas.height = desiredH;
    }
    const W = canvas.width;
    const H = canvas.height;
    const labelW = 118;
    const layout = getTimelineTrackLayout(H);

    ctx.clearRect(0, 0, W, H);

    // Фон дорожек
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0d1322';
    ctx.fillRect(labelW, layout.waveTop, W - labelW, layout.waveBottom - layout.waveTop);

    ctx.fillStyle = '#111827';
    ctx.fillRect(labelW, layout.notesTop, W - labelW, layout.notesBottom - layout.notesTop);

    if (layout.isPiano) {
      for (let r = 0; r < NOTE_TYPES.length; r++) {
        const ry = layout.notesTop + r * layout.laneH;
        if (r % 2 === 1) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.fillRect(labelW, ry, W - labelW, layout.laneH);
        }
        if (NOTE_TYPES[r].id === state.activeNoteType) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
          ctx.fillRect(labelW, ry, W - labelW, layout.laneH);
        }
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(labelW, ry);
        ctx.lineTo(W, ry);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#0d1322';
    ctx.fillRect(labelW, layout.textSpeedTop, W - labelW, layout.textSpeedBottom - layout.textSpeedTop);

    ctx.fillStyle = '#0a0f1c';
    ctx.fillRect(labelW, layout.fxTop, W - labelW, layout.fxBottom - layout.fxTop);

    // 1. Сетка BPM и линейка времени
    const startSec = Math.max(0, xToTime(labelW, labelW));
    const endSec = xToTime(W, labelW);
    const tp = getActiveTimingAt(startSec);
    const beatSec = 60 / tp.bpm;
    const subDiv = (state.snapDivisor && state.snapDivisor > 0) ? (state.snapDivisor / 4) : 1;
    const stepSec = beatSec / subDiv;

    const firstStepIdx = Math.floor((startSec - tp.time) / stepSec);
    const maxLines = 600;
    let lineCount = 0;

    for (let idx = firstStepIdx; lineCount < maxLines; idx++, lineCount++) {
      const t = tp.time + idx * stepSec;
      if (t > endSec) break;
      if (t < 0) continue;

      const x = timeToX(t, labelW);
      if (x < labelW) continue;

      const isBar = idx % (4 * subDiv) === 0;
      const isBeat = idx % subDiv === 0;

      ctx.beginPath();
      ctx.moveTo(x, layout.rulerBottom);
      ctx.lineTo(x, H);
      if (isBar) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        ctx.lineWidth = 1.2;
      } else if (isBeat) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      if (isBar || (isBeat && state.zoomPxPerSec >= 140)) {
        ctx.fillStyle = isBar ? '#e2e8f0' : '#64748b';
        ctx.font = isBar ? '700 10px ui-monospace, monospace' : '500 9px ui-monospace, monospace';
        ctx.fillText(`${t.toFixed(2)}s`, x + 3, 16);
      }
    }

    // 2. Отрисовка аудио-волны (Waveform)
    const waveMidY = (layout.waveTop + layout.waveBottom) / 2;
    const waveHalfH = (layout.waveBottom - layout.waveTop) * 0.44;
    if (state.waveformPeaks && state.duration > 0) {
      const peaks = state.waveformPeaks;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
      for (let px = labelW; px < W; px += 2) {
        const t = xToTime(px, labelW);
        if (t < 0 || t > state.duration) continue;
        const pIdx = Math.floor((t / state.duration) * peaks.length);
        const amp = peaks[Math.min(peaks.length - 1, Math.max(0, pIdx))] || 0;
        const h = Math.max(1, amp * waveHalfH * 2);
        ctx.fillRect(px, waveMidY - h / 2, 1.5, h);
      }
    } else {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.moveTo(labelW, waveMidY);
      ctx.lineTo(W, waveMidY);
      ctx.stroke();
    }

    // 3. Отрисовка нот и вертикальных стаков на таймлайне
    const notesMidY = (layout.notesTop + layout.notesBottom) / 2;
    const notes = state.chart.notes;
    let gIdx = 0;
    while (gIdx < notes.length) {
      let gj = gIdx + 1;
      while (gj < notes.length && Math.abs(notes[gj].time - notes[gIdx].time) <= 0.005) gj++;
      const gSize = gj - gIdx;
      const gx = timeToX(notes[gIdx].time, labelW);

      if (gx >= labelW - 24 && gx <= W + 24) {
        if (gSize > 1) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(gx, layout.notesTop + 4);
          ctx.lineTo(gx, layout.notesBottom - 4);
          ctx.stroke();
          ctx.restore();
        }
        for (let k = gIdx; k < gj; k++) {
          const n = notes[k];
          const isSel = state.selectedItem && state.selectedItem.kind === 'note' && state.selectedItem.item === n;
          let ny = notesMidY;
          let rad = 14;
          if (layout.isPiano) {
            const rowIdx = Math.max(0, NOTE_TYPES.findIndex(nt => nt.id === n.type));
            ny = layout.notesTop + (rowIdx + 0.5) * layout.laneH;
            rad = Math.min(10.5, layout.laneH * 0.44);
          } else {
            const slotOffset = gSize > 1 ? ((k - gIdx) - (gSize - 1) / 2) * 16 : 0;
            ny = notesMidY + slotOffset;
            rad = gSize > 1 ? 11.5 : 14;
          }
          drawSwipeNote(ctx, gx, ny, rad, n.type, 1, isSel);
        }
      }
      gIdx = gj;
    }

    // 4. Отрисовка событий (TEXT / NOTE_SPEED и FX / Модификаторы)
    const events = state.chart.events;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const x = timeToX(ev.time, labelW);
      const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0;
      const wPx = Math.max(24, dur > 0 ? dur * state.zoomPxPerSec : 54);
      if (x + wPx < labelW || x > W + 20) continue;

      const def = EVENT_MAP[ev.type] || { id: ev.type, short: ev.type, color: '#94a3b8' };
      const isTextOrSpeed = (ev.type === 'TEXT' || ev.type === 'NOTE_SPEED');
      const bandTop = isTextOrSpeed ? layout.textSpeedTop : layout.fxTop;
      const bandH = isTextOrSpeed ? (layout.textSpeedBottom - layout.textSpeedTop) : (layout.fxBottom - layout.fxTop);

      const laneIdx = isTextOrSpeed
        ? (ev.type === 'TEXT' ? 0 : 1)
        : (Math.abs(hashCode(ev.type)) % 2);
      const pillH = Math.min(20, (bandH - 8) / 2);
      const py = bandTop + 4 + laneIdx * (pillH + 3);

      const isSel = state.selectedItem && state.selectedItem.kind === 'event' && state.selectedItem.item === ev;

      ctx.save();
      ctx.fillStyle = def.color + (dur > 0 ? '44' : '88');
      ctx.strokeStyle = isSel ? '#fde047' : def.color;
      ctx.lineWidth = isSel ? 2.2 : 1.2;

      ctx.beginPath();
      ctx.roundRect(x, py, wPx, pillH, 4);
      ctx.fill();
      ctx.stroke();

      let label = def.short || ev.type;
      if (ev.type === 'TEXT') label = `"${ev.text || ''}"`;
      if (ev.type === 'NOTE_SPEED') label = `SPD ${ev.speed}x`;

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 10px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 2, py, wPx - 4, pillH);
      ctx.clip();
      ctx.fillText(label, x + 5, py + pillH / 2 + 0.5);
      ctx.restore();
      ctx.restore();
    }

    // 5. Разделители дорожек и левая панель заголовков
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, labelW, H);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    [layout.rulerBottom, layout.waveBottom, layout.notesBottom, layout.textSpeedBottom].forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(labelW, 0);
    ctx.lineTo(labelW, H);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('ТАКТЫ / СЕК', 10, 16);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('АУДИО ВОЛНА', 10, (layout.waveTop + layout.waveBottom) / 2 + 4);

    if (layout.isPiano) {
      for (let r = 0; r < NOTE_TYPES.length; r++) {
        const nt = NOTE_TYPES[r];
        const ry = layout.notesTop + r * layout.laneH;
        ctx.fillStyle = nt.id === state.activeNoteType ? 'rgba(56, 189, 248, 0.16)' : 'transparent';
        ctx.fillRect(0, ry, labelW - 1, layout.laneH);
        ctx.fillStyle = nt.color;
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.fillText(`${nt.short} ${nt.id}`, 8, ry + layout.laneH / 2 + 3.5);
      }
    } else {
      ctx.fillStyle = '#f43f5e';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText('НОТЫ / СТАКИ', 10, (layout.notesTop + layout.notesBottom) / 2 + 4);
    }

    ctx.fillStyle = '#facc15';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('TEXT / SPEED', 10, (layout.textSpeedTop + layout.textSpeedBottom) / 2 + 4);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('FX / КАМЕРА', 10, (layout.fxTop + layout.fxBottom) / 2 + 4);

    // 6. Красный курсор текущей позиции (Playhead)
    const playheadX = timeToX(state.currentTime, labelW);
    if (playheadX >= labelW && playheadX <= W) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, H);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  // --- Поиск элемента под курсором на таймлайне (с поддержкой 10-рядного Пиано-ролла и стаков) ---
  function hitTestTimeline(mx, my) {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return null;
    const labelW = 118;
    const layout = getTimelineTrackLayout(canvas.height);

    if (mx < labelW) {
      if (layout.isPiano && my >= layout.notesTop && my <= layout.notesBottom) {
        const rIdx = Math.min(NOTE_TYPES.length - 1, Math.max(0, Math.floor((my - layout.notesTop) / layout.laneH)));
        return { kind: 'piano_label', noteType: NOTE_TYPES[rIdx].id };
      }
      return null;
    }

    if (my >= layout.notesTop && my <= layout.notesBottom) {
      const clickedLaneIdx = layout.isPiano
        ? Math.min(NOTE_TYPES.length - 1, Math.max(0, Math.floor((my - layout.notesTop) / layout.laneH)))
        : -1;
      const laneNoteType = clickedLaneIdx >= 0 ? NOTE_TYPES[clickedLaneIdx].id : state.activeNoteType;

      for (let i = state.chart.notes.length - 1; i >= 0; i--) {
        const n = state.chart.notes[i];
        const nx = timeToX(n.time, labelW);
        if (layout.isPiano) {
          const rIdx = Math.max(0, NOTE_TYPES.findIndex(nt => nt.id === n.type));
          const ny = layout.notesTop + (rIdx + 0.5) * layout.laneH;
          if (Math.abs(mx - nx) <= 14 && Math.abs(my - ny) <= layout.laneH * 0.55) {
            return { kind: 'note', item: n, laneNoteType };
          }
        } else {
          const notesMidY = (layout.notesTop + layout.notesBottom) / 2;
          if (Math.hypot(mx - nx, my - notesMidY) <= 18) {
            return { kind: 'note', item: n, laneNoteType };
          }
        }
      }
      return { kind: 'empty_note_lane', laneNoteType };
    }

    if (my >= layout.textSpeedTop) {
      const isTextOrSpeedLane = my < layout.textSpeedBottom;
      for (let i = state.chart.events.length - 1; i >= 0; i--) {
        const ev = state.chart.events[i];
        const isTS = ev.type === 'TEXT' || ev.type === 'NOTE_SPEED';
        if (isTS !== isTextOrSpeedLane) continue;

        const bandTop = isTS ? layout.textSpeedTop : layout.fxTop;
        const bandH = isTS ? (layout.textSpeedBottom - layout.textSpeedTop) : (layout.fxBottom - layout.fxTop);
        const laneIdx = isTS ? (ev.type === 'TEXT' ? 0 : 1) : (Math.abs(hashCode(ev.type)) % 2);
        const pillH = Math.min(20, (bandH - 8) / 2);
        const py = bandTop + 4 + laneIdx * (pillH + 3);
        const px = timeToX(ev.time, labelW);
        const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0;
        const pw = Math.max(24, dur > 0 ? dur * state.zoomPxPerSec : 54);

        if (mx >= px - 4 && mx <= px + pw + 4 && my >= py - 2 && my <= py + pillH + 2) {
          return { kind: 'event', item: ev };
        }
      }
      return { kind: 'empty_event_lane', isTextOrSpeedLane };
    }

    return { kind: 'ruler' };
  }

  // --- Операции с нотами, стаками и синхронизацией реверсов ---
  function syncReverseFlowEvent(oldTime, newTime, noteType, removeOnly = false) {
    // Удаляем старый парный NOTES_FLOW_* на прежнем времени, если там больше нет реверс-нот
    if (oldTime !== null && oldTime !== undefined) {
      const stillHasRevAtOld = state.chart.notes.some(
        n => Math.abs(n.time - oldTime) <= 0.015 && (n.type === 'REVERSE' || n.type === 'REVERSE_BACK')
      );
      if (!stillHasRevAtOld) {
        for (let i = state.chart.events.length - 1; i >= 0; i--) {
          const ev = state.chart.events[i];
          if (Math.abs(ev.time - oldTime) <= 0.05 && (ev.type === 'NOTES_FLOW_RIGHT' || ev.type === 'NOTES_FLOW_LEFT')) {
            state.chart.events.splice(i, 1);
          }
        }
      }
    }
    if (removeOnly) return;

    const autoFlowCheck = document.getElementById('reverse-autoflow-check');
    if (autoFlowCheck && autoFlowCheck.checked && (noteType === 'REVERSE' || noteType === 'REVERSE_BACK')) {
      const targetFlow = noteType === 'REVERSE' ? 'NOTES_FLOW_RIGHT' : 'NOTES_FLOW_LEFT';
      const existingFlow = state.chart.events.find(
        e => Math.abs(e.time - newTime) <= 0.02 && (e.type === 'NOTES_FLOW_RIGHT' || e.type === 'NOTES_FLOW_LEFT')
      );
      if (existingFlow) {
        existingFlow.time = newTime;
        existingFlow.type = targetFlow;
      } else {
        state.chart.events.push({ time: newTime, type: targetFlow });
      }
    }
  }

  function addOrReplaceNoteAt(timeSec, noteType, allowStackOverride = false) {
    pushUndo();
    const t = roundTime(timeSec);
    const stackAllowed = allowStackOverride || state.stackMode;

    // Проверяем, есть ли уже точно такая же нота (того же направления) на этом времени
    const sameTypeIdx = state.chart.notes.findIndex(n => Math.abs(n.time - t) <= 0.005 && n.type === noteType);
    if (sameTypeIdx !== -1 && allowStackOverride) {
      // В режиме Пиано-ролла повторный тап по уже стоящей ноте удаляет её
      const removed = state.chart.notes.splice(sameTypeIdx, 1)[0];
      if (removed.type === 'REVERSE' || removed.type === 'REVERSE_BACK') {
        syncReverseFlowEvent(removed.time, null, removed.type, true);
      }
      state.selectedItem = null;
      sortChart();
      refreshAllViews();
      setStatus(`Убрана нота ${noteType} на ${t.toFixed(3)} сек`);
      return;
    }

    const existingAtTimeIdx = state.chart.notes.findIndex(n => Math.abs(n.time - t) <= 0.005);
    let noteObj;
    if (existingAtTimeIdx !== -1 && !stackAllowed) {
      const prevType = state.chart.notes[existingAtTimeIdx].type;
      state.chart.notes[existingAtTimeIdx].type = noteType;
      state.chart.notes[existingAtTimeIdx].time = t;
      noteObj = state.chart.notes[existingAtTimeIdx];
      if (prevType === 'REVERSE' || prevType === 'REVERSE_BACK') {
        syncReverseFlowEvent(t, t, noteType, !(noteType === 'REVERSE' || noteType === 'REVERSE_BACK'));
      }
    } else if (sameTypeIdx !== -1) {
      noteObj = state.chart.notes[sameTypeIdx];
    } else {
      noteObj = { time: t, type: noteType };
      state.chart.notes.push(noteObj);
    }

    if (noteType === 'REVERSE' || noteType === 'REVERSE_BACK') {
      syncReverseFlowEvent(t, t, noteType, false);
    }

    sortChart();
    state.selectedItem = { kind: 'note', item: noteObj };
    refreshAllViews();
    if (state.hitsoundEnabled) playTick(1200, 0.15, 0.03, 'triangle');
    const stackCount = state.chart.notes.filter(n => Math.abs(n.time - t) <= 0.005).length;
    const earlyWarn = ((noteType === 'REVERSE' || noteType === 'REVERSE_BACK') && t <= 1.0)
      ? ' ⚠ Внимание: реверс на <= 1.0с сработает в игре сразу со старта (EARLY_EVENT_WINDOW)!'
      : '';
    setStatus(`Нота ${noteType} поставлена на ${t.toFixed(3)} сек${stackCount > 1 ? ` (Стак ×${stackCount})` : ''}${earlyWarn}`);
  }

  function addEventFromForm(customTime) {
    const typeSelect = document.getElementById('event-type-select');
    const typeId = typeSelect ? typeSelect.value : state.activeEventType;
    const def = EVENT_MAP[typeId] || { id: typeId };
    const t = roundTime(customTime !== undefined ? customTime : snapTime(state.currentTime));

    pushUndo();
    const ev = { time: t, type: typeId };

    if (def.hasDuration) {
      const durInput = document.getElementById('event-duration-input');
      const rawDur = durInput ? Number(durInput.value) : def.defaultDuration;
      if (def.optionalDuration) {
        if (rawDur > 0) ev.duration = roundTime(rawDur);
      } else {
        ev.duration = Math.max(0.05, rawDur || def.defaultDuration || 0.5);
      }
    }
    if (def.hasSpeed) {
      const speedInput = document.getElementById('event-speed-input');
      ev.speed = Math.max(0.1, Number(speedInput && speedInput.value) || def.defaultSpeed || 1.5);
    }
    if (def.hasText) {
      const textInput = document.getElementById('event-text-input');
      ev.text = (textInput && textInput.value.trim()) ? textInput.value : 'SWIPETAVA';
    }
    if (def.hasColor) {
      const colorInput = document.getElementById('event-color-input');
      ev.color = (colorInput && colorInput.value) ? colorInput.value : (def.defaultColor || '#ffffff');
    }

    state.chart.events.push(ev);

    // Если выбрана опция автоматического добавления парного OFF-события
    const autoPairCheck = document.getElementById('event-autopair-check');
    if (def.pairOff && autoPairCheck && autoPairCheck.checked) {
      const pairDurInput = document.getElementById('event-pair-dur-input');
      const pairDur = Math.max(0.1, Number(pairDurInput && pairDurInput.value) || 4.0);
      state.chart.events.push({
        time: roundTime(t + pairDur),
        type: def.pairOff
      });
    }

    sortChart();
    state.selectedItem = { kind: 'event', item: ev };
    refreshAllViews();
    setStatus(`Событие ${typeId} добавлено на ${t.toFixed(3)} сек`);
  }

  function deleteSelectedItem() {
    if (!state.selectedItem) return;
    pushUndo();
    const { kind, item } = state.selectedItem;
    if (kind === 'note') {
      const idx = state.chart.notes.indexOf(item);
      if (idx !== -1) state.chart.notes.splice(idx, 1);
      if (item.type === 'REVERSE' || item.type === 'REVERSE_BACK') {
        syncReverseFlowEvent(item.time, null, item.type, true);
      }
    } else if (kind === 'event') {
      const idx = state.chart.events.indexOf(item);
      if (idx !== -1) state.chart.events.splice(idx, 1);
    }
    state.selectedItem = null;
    refreshAllViews();
    setStatus('Элемент удалён');
  }

  function mirrorAllNotes(axis) {
    if (!state.chart.notes.length) return;
    pushUndo();
    const map = axis === 'H' ? MIRROR_H : MIRROR_V;
    for (const n of state.chart.notes) {
      if (map[n.type]) n.type = map[n.type];
    }
    refreshAllViews();
    setStatus(axis === 'H' ? 'Все ноты отзеркалены по горизонтали (← ↔ →)' : 'Все ноты отзеркалены по вертикали (↑ ↔ ↓)');
  }

  // --- Генератор ритмичных надписей в стиле карты Hi-Tech ---
  function insertPhraseSequenceByBeats() {
    const rawInput = document.getElementById('hitech-phrase-input');
    const colorInput = document.getElementById('hitech-phrase-color');
    const stepSelect = document.getElementById('hitech-phrase-step');
    if (!rawInput || !rawInput.value.trim()) {
      setStatus('Введи слова через пробел или | для раскидки по битам');
      return;
    }
    const parts = rawInput.value.includes('|')
      ? rawInput.value.split('|').map(s => s.trim()).filter(Boolean)
      : rawInput.value.trim().split(/\s+/).filter(Boolean);

    if (!parts.length) return;
    pushUndo();

    const tp = getActiveTimingAt(state.currentTime);
    const beatSec = 60 / tp.bpm;
    const beatsPerWord = Math.max(0.25, Number(stepSelect && stepSelect.value) || 1);
    const stepSec = beatSec * beatsPerWord;
    const color = (colorInput && colorInput.value) || '#ffffff';
    let t = snapTime(state.currentTime);
    const startT = t;
    const autoHudCheck = document.getElementById('hitech-auto-hud-check');
    if (autoHudCheck && autoHudCheck.checked) {
      state.chart.events.push({
        time: roundTime(Math.max(0, startT - 0.15)),
        type: 'HUD_HIDE'
      });
    }

    for (const word of parts) {
      state.chart.events.push({
        time: roundTime(t),
        type: 'TEXT',
        duration: roundTime(stepSec * 0.92),
        color,
        text: word
      });
      t += stepSec;
    }

    if (autoHudCheck && autoHudCheck.checked) {
      state.chart.events.push({
        time: roundTime(t),
        type: 'HUD_SHOW'
      });
    }
    sortChart();
    refreshAllViews();
    setStatus(`Добавлена серия из ${parts.length} надписей TEXT по битам`);
  }

  // --- Синхронизация инспектора выбранного элемента ---
  function renderInspector() {
    const box = document.getElementById('inspector-content');
    if (!box) return;

    if (!state.selectedItem) {
      box.innerHTML = `<div class="muted-hint">Кликни по любой ноте или событию на таймлайне (или в таблице справа), чтобы изменить его точное время, направление, текст, цвет или скорость. Правый клик или клавиша <code>Delete</code> удаляет элемент.</div>`;
      return;
    }

    const { kind, item } = state.selectedItem;
    if (kind === 'note') {
      const optionsHtml = NOTE_TYPES.map(nt =>
        `<option value="${nt.id}" ${nt.id === item.type ? 'selected' : ''}>${nt.short} ${nt.label}</option>`
      ).join('');
      box.innerHTML = `
        <div class="insp-grid">
          <label>Тип элемента
            <input type="text" value="Нота (Note)" disabled />
          </label>
          <label>Время (сек)
            <input type="number" id="insp-note-time" step="0.001" min="0" value="${item.time}" />
          </label>
          <label>Направление свайпа
            <select id="insp-note-type">${optionsHtml}</select>
          </label>
          <div class="insp-actions" style="flex-wrap:wrap;gap:4px;">
            <button type="button" class="btn btn-sm" id="insp-nudge-m10" title="Сдвинуть на -10 мс">-10мс</button>
            <button type="button" class="btn btn-sm" id="insp-nudge-m1" title="Сдвинуть на -1 мс">-1мс</button>
            <button type="button" class="btn btn-sm" id="insp-nudge-p1" title="Сдвинуть на +1 мс">+1мс</button>
            <button type="button" class="btn btn-sm" id="insp-nudge-p10" title="Сдвинуть на +10 мс">+10мс</button>
            <button type="button" class="btn btn-danger btn-sm" id="insp-delete-btn">Удалить ноту</button>
          </div>
        </div>
      `;
      const updateNoteTimeWithSync = (newT) => {
        pushUndo();
        const prevT = item.time;
        item.time = roundTime(Math.max(0, newT));
        if (item.type === 'REVERSE' || item.type === 'REVERSE_BACK') {
          syncReverseFlowEvent(prevT, item.time, item.type, false);
        }
        sortChart();
        refreshAllViews();
      };
      document.getElementById('insp-note-time').addEventListener('change', (e) => {
        updateNoteTimeWithSync(Number(e.target.value) || 0);
      });
      document.getElementById('insp-nudge-m10').addEventListener('click', () => updateNoteTimeWithSync(item.time - 0.01));
      document.getElementById('insp-nudge-m1').addEventListener('click', () => updateNoteTimeWithSync(item.time - 0.001));
      document.getElementById('insp-nudge-p1').addEventListener('click', () => updateNoteTimeWithSync(item.time + 0.001));
      document.getElementById('insp-nudge-p10').addEventListener('click', () => updateNoteTimeWithSync(item.time + 0.01));
      document.getElementById('insp-note-type').addEventListener('change', (e) => {
        pushUndo();
        item.type = e.target.value;
        refreshAllViews();
      });
      document.getElementById('insp-delete-btn').addEventListener('click', deleteSelectedItem);
      return;
    }

    if (kind === 'event') {
      const def = EVENT_MAP[item.type] || { id: item.type };
      const evOptions = EVENT_DEFS.map(ed =>
        `<option value="${ed.id}" ${ed.id === item.type ? 'selected' : ''}>${ed.label}</option>`
      ).join('');

      let extraFields = '';
      if (def.hasDuration || item.duration !== undefined) {
        extraFields += `
          <label>Длительность duration (сек)
            <input type="number" id="insp-ev-duration" step="0.05" min="0.05" value="${item.duration !== undefined ? item.duration : (def.defaultDuration || 0.5)}" />
          </label>
        `;
      }
      if (def.hasSpeed || item.speed !== undefined) {
        extraFields += `
          <label>Множитель скорости speed
            <input type="number" id="insp-ev-speed" step="0.05" min="0.1" max="10" value="${item.speed !== undefined ? item.speed : 1.5}" />
          </label>
        `;
      }
      if (def.hasText || item.text !== undefined) {
        extraFields += `
          <label>Надпись (text)
            <input type="text" id="insp-ev-text" value="${escapeHtml(item.text || '')}" />
          </label>
        `;
      }
      if (def.hasColor || item.color !== undefined) {
        extraFields += `
          <label>Цвет (color)
            <input type="color" id="insp-ev-color" value="${item.color || def.defaultColor || '#ffffff'}" />
          </label>
        `;
      }

      box.innerHTML = `
        <div class="insp-grid">
          <label>Тип события
            <select id="insp-ev-type">${evOptions}</select>
          </label>
          <label>Время (сек)
            <input type="number" id="insp-ev-time" step="0.001" min="0" value="${item.time}" />
          </label>
          ${extraFields}
          <div class="insp-actions">
            <button type="button" class="btn btn-danger" id="insp-delete-btn">Удалить событие</button>
          </div>
        </div>
      `;

      document.getElementById('insp-ev-type').addEventListener('change', (e) => {
        pushUndo();
        const newType = e.target.value;
        const newDef = EVENT_MAP[newType] || {};
        item.type = newType;
        if (newDef.hasDuration && item.duration === undefined) item.duration = newDef.defaultDuration || 0.5;
        if (!newDef.hasDuration) delete item.duration;
        if (newDef.hasSpeed && item.speed === undefined) item.speed = newDef.defaultSpeed || 1.5;
        if (!newDef.hasSpeed) delete item.speed;
        if (newDef.hasText) {
          if (item.text === undefined) item.text = 'SWIPETAVA';
          if (item.color === undefined) item.color = '#ffffff';
        } else {
          delete item.text;
          delete item.color;
        }
        refreshAllViews();
      });

      document.getElementById('insp-ev-time').addEventListener('change', (e) => {
        pushUndo();
        item.time = roundTime(Number(e.target.value) || 0);
        sortChart();
        refreshAllViews();
      });

      const durEl = document.getElementById('insp-ev-duration');
      if (durEl) {
        durEl.addEventListener('input', (e) => {
          item.duration = Math.max(0.05, Number(e.target.value) || 0.5);
          renderPreviewCanvas();
          renderTimelineCanvas();
          renderEventsList();
        });
      }

      const spdEl = document.getElementById('insp-ev-speed');
      if (spdEl) {
        spdEl.addEventListener('input', (e) => {
          item.speed = Math.max(0.1, Number(e.target.value) || 1.0);
          renderPreviewCanvas();
          renderTimelineCanvas();
          renderEventsList();
        });
      }

      const txtEl = document.getElementById('insp-ev-text');
      if (txtEl) {
        txtEl.addEventListener('input', (e) => {
          item.text = e.target.value;
          renderPreviewCanvas();
          renderTimelineCanvas();
          renderEventsList();
        });
      }

      const colEl = document.getElementById('insp-ev-color');
      if (colEl) {
        colEl.addEventListener('input', (e) => {
          item.color = e.target.value;
          renderPreviewCanvas();
          renderTimelineCanvas();
          renderEventsList();
        });
      }

      document.getElementById('insp-delete-btn').addEventListener('click', deleteSelectedItem);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Таблицы событий, надписей TEXT и точек BPM ---
  function renderEventsList() {
    const filterEl = document.getElementById('event-list-filter');
    const filterVal = filterEl ? filterEl.value : 'ALL';
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    const filtered = state.chart.events.filter(ev => {
      if (filterVal === 'ALL') return true;
      if (filterVal === 'TEXT') return ev.type === 'TEXT';
      if (filterVal === 'NOTE_SPEED') return ev.type === 'NOTE_SPEED';
      if (filterVal === 'FX') return ev.type.startsWith('FX_');
      if (filterVal === 'FLOW_CAM') return !ev.type.startsWith('FX_') && ev.type !== 'TEXT' && ev.type !== 'NOTE_SPEED';
      return true;
    });

    tbody.innerHTML = filtered.map((ev, idx) => {
      const def = EVENT_MAP[ev.type] || { color: '#94a3b8' };
      const isSel = state.selectedItem && state.selectedItem.kind === 'event' && state.selectedItem.item === ev;
      let details = '';
      if (ev.type === 'TEXT') {
        details = `<span style="color:${escapeHtml(ev.color || '#fff')}">"${escapeHtml(ev.text || '')}"</span> (${ev.duration || 0}s)`;
      } else if (ev.type === 'BG_COLOR') {
        details = `<span style="color:${escapeHtml(ev.color || '#62a0ea')}">■ ${escapeHtml(ev.color || '#62a0ea')}</span> ${ev.duration ? `(${ev.duration}s)` : '(мгнов.)'}`;
      } else if (ev.type === 'NOTE_SPEED') {
        details = `speed: <b>${ev.speed}x</b>`;
      } else if (ev.duration !== undefined) {
        details = `duration: ${ev.duration}s`;
      } else {
        details = 'мгновенный / триггер';
      }
      return `
        <tr data-ev-idx="${state.chart.events.indexOf(ev)}" class="${isSel ? 'row-selected' : ''}">
          <td><code>${ev.time.toFixed(3)}s</code></td>
          <td><span class="ev-badge" style="border-color:${def.color};color:${def.color}">${escapeHtml(ev.type)}</span></td>
          <td>${details}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const realIdx = Number(tr.getAttribute('data-ev-idx'));
        const ev = state.chart.events[realIdx];
        if (!ev) return;
        state.selectedItem = { kind: 'event', item: ev };
        setCurrentTime(ev.time);
        refreshAllViews();
      });
    });

    // Счётчики в шапке
    const statNotes = document.getElementById('stat-notes-count');
    const statEvents = document.getElementById('stat-events-count');
    if (statNotes) statNotes.textContent = String(state.chart.notes.length);
    if (statEvents) statEvents.textContent = String(state.chart.events.length);
  }

  function renderTimingTable() {
    const tbody = document.getElementById('timing-table-body');
    if (!tbody) return;
    const list = state.chart.timing || [];
    tbody.innerHTML = list.map((tp, idx) => `
      <tr>
        <td><input type="number" step="0.001" min="0" value="${tp.time}" data-tp-time="${idx}" class="compact-input" /></td>
        <td><input type="number" step="0.1" min="20" max="400" value="${tp.bpm}" data-tp-bpm="${idx}" class="compact-input" /></td>
        <td><button type="button" class="btn btn-sm btn-danger" data-tp-del="${idx}" ${list.length <= 1 ? 'disabled' : ''}>×</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-tp-time]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = Number(inp.getAttribute('data-tp-time'));
        pushUndo();
        state.chart.timing[i].time = roundTime(Number(e.target.value) || 0);
        if (i === 0) state.chart.gridOffset = state.chart.timing[0].time;
        sortChart();
        syncMetaAndChartInputs();
        refreshAllViews();
      });
    });
    tbody.querySelectorAll('[data-tp-bpm]').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const i = Number(inp.getAttribute('data-tp-bpm'));
        pushUndo();
        state.chart.timing[i].bpm = Math.max(20, Number(e.target.value) || 120);
        if (i === 0) state.chart.bpm = state.chart.timing[0].bpm;
        syncMetaAndChartInputs();
        refreshAllViews();
      });
    });
    tbody.querySelectorAll('[data-tp-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.getAttribute('data-tp-del'));
        if (state.chart.timing.length <= 1) return;
        pushUndo();
        state.chart.timing.splice(i, 1);
        refreshAllViews();
      });
    });
  }

  // --- Расчёт среднего/пикового NPS, длины карты и объективной сложности в баллах (SDP без лимита) ---
  const DIR_ANGLES_DEG = {
    RIGHT: 0, DOWN_RIGHT: 45, DOWN: 90, DOWN_LEFT: 135,
    LEFT: 180, UP_LEFT: -135, UP: -90, UP_RIGHT: -45
  };
  const DIAGONAL_SET = new Set(['UP_LEFT', 'UP_RIGHT', 'DOWN_LEFT', 'DOWN_RIGHT']);

  function computeChartDifficultyStats() {
    const notes = state.chart.notes || [];
    const events = state.chart.events || [];
    const baseTravelMs = Math.max(150, Number(state.chart.noteTravelTime) || 1000);

    if (!notes.length) {
      return {
        avgNps: 0, totalNps: 0, activeSpan: 0, totalLength: state.duration || 0,
        peak1s: 0, peak3s: 0, p95Nps: 0,
        sdpPoints: 0, autoStars: 0, lengthMod: 1.0,
        stacksCount: 0, maxStackSize: 1,
        reversesCount: 0, diagPct: 0, sharpTurns: 0,
        maxSpeed: 1.0, minEffTravelMs: baseTravelMs, speedModAvg: 1.0,
        secBins: []
      };
    }

    const tMin = notes[0].time;
    const tMax = notes[notes.length - 1].time;
    const activeSpan = Math.max(1.0, tMax - tMin);
    const totalLength = Math.max(activeSpan, tMax, Number(state.duration) || 0);
    const avgNps = notes.length / activeSpan;
    const totalNps = notes.length / Math.max(1.0, totalLength);

    const groups = [];
    let i = 0;
    let stacksCount = 0;
    let maxStackSize = 1;
    let reversesCount = 0;
    let diagCount = 0;

    while (i < notes.length) {
      let j = i + 1;
      while (j < notes.length && Math.abs(notes[j].time - notes[i].time) <= 0.005) j++;
      const gNotes = notes.slice(i, j);
      if (gNotes.length > 1) {
        stacksCount++;
        if (gNotes.length > maxStackSize) maxStackSize = gNotes.length;
      }
      for (const gn of gNotes) {
        if (gn.type === 'REVERSE' || gn.type === 'REVERSE_BACK') reversesCount++;
        if (DIAGONAL_SET.has(gn.type)) diagCount++;
      }
      groups.push({ time: notes[i].time, notes: gNotes });
      i = j;
    }
    const diagPct = Math.round((diagCount / notes.length) * 100);

    let peak1s = 0;
    let peak3sCount = 0;
    for (let a = 0; a < notes.length; a++) {
      const t0 = notes[a].time;
      let c1 = 0, c3 = 0;
      for (let b = a; b < notes.length; b++) {
        const dt = notes[b].time - t0;
        if (dt <= 1.0001) c1++;
        if (dt <= 3.0001) c3++;
        else break;
      }
      if (c1 > peak1s) peak1s = c1;
      if (c3 > peak3sCount) peak3sCount = c3;
    }
    const peak3s = peak3sCount / 3.0;

    const maxSec = Math.max(1, Math.ceil(Math.max(tMax + 1, state.duration || 1)));
    const secBins = new Array(maxSec).fill(0);
    for (const n of notes) {
      const sIdx = Math.min(maxSec - 1, Math.max(0, Math.floor(n.time)));
      secBins[sIdx]++;
    }
    const nonZeroBins = secBins.filter(v => v > 0).sort((a, b) => a - b);
    const p95Nps = nonZeroBins.length ? nonZeroBins[Math.min(nonZeroBins.length - 1, Math.floor(nonZeroBins.length * 0.95))] : 0;

    let maxSpeed = 1.0;
    for (const ev of events) {
      if (ev.type === 'NOTE_SPEED') {
        const s = Math.max(0.1, Number(ev.speed) || 1.0);
        if (s > maxSpeed) maxSpeed = s;
      }
    }

    const getSpeedAt = (t) => {
      let spd = 1.0;
      for (const ev of events) {
        if (ev.time > t) break;
        if (ev.type === 'NOTE_SPEED') spd = Math.max(0.1, Number(ev.speed) || 1.0);
      }
      return spd;
    };

    const strains = [];
    let prevAngle = null;
    let sharpTurns = 0;
    let speedModSum = 0;

    for (let g = 0; g < groups.length; g++) {
      const grp = groups[g];
      const dt = g > 0 ? Math.max(0.055, grp.time - groups[g - 1].time) : 0.5;
      const k = grp.notes.length;
      const types = grp.notes.map(x => x.type);

      let w = 1.0 + 0.55 * (k - 1);
      if (types.some(tp => DIAGONAL_SET.has(tp))) w += 0.15;
      if (types.some(tp => tp === 'REVERSE' || tp === 'REVERSE_BACK')) w += 0.65;

      let curAngle = null;
      for (const tp of types) {
        if (DIR_ANGLES_DEG[tp] !== undefined) { curAngle = DIR_ANGLES_DEG[tp]; break; }
      }
      if (curAngle !== null && prevAngle !== null && dt < 0.35) {
        let diff = Math.abs(curAngle - prevAngle) % 360;
        if (diff > 180) diff = 360 - diff;
        if (diff >= 90) {
          w += 0.22 * (diff / 180.0);
          sharpTurns++;
        }
      }
      if (curAngle !== null) prevAngle = curAngle;

      const spd = getSpeedAt(grp.time);
      const effTravelMs = baseTravelMs / spd;
      const speedMod = Math.pow(1000.0 / Math.max(180.0, effTravelMs), 0.38);
      speedModSum += speedMod;

      const instStrain = (w * speedMod) / Math.pow(dt, 0.80);
      strains.push(instStrain);
    }

    const sortedStrains = strains.slice().sort((a, b) => a - b);
    const p90Strain = sortedStrains.length ? sortedStrains[Math.min(sortedStrains.length - 1, Math.floor(sortedStrains.length * 0.90))] : 0;
    const meanStrain = strains.reduce((acc, v) => acc + v, 0) / Math.max(1, strains.length);
    const speedModAvg = speedModSum / Math.max(1, groups.length);

    // Фактор общей длины карты и выносливости (Length & Marathon Factor)
    const lengthFactor = Math.pow(Math.min(1.85, Math.max(0.25, activeSpan / 85.0)), 0.45);
    const marathonBonus = 1.0 + 0.34 * Math.max(0.0, (activeSpan - 95.0) / 55.0) + 0.42 * Math.max(0.0, (notes.length - 240) / 180.0);
    const lengthMod = lengthFactor * marathonBonus;

    const rawIntensity = 33.5 * avgNps + 10.8 * peak3s + 6.0 * meanStrain + 3.7 * p90Strain;
    const endurancePts = 35.0 * Math.pow(notes.length / 100.0, 0.75) * Math.pow(activeSpan / 60.0, 0.35);

    const sdpPoints = (rawIntensity * lengthMod) + endurancePts;
    const rawStars = sdpPoints / 65.0;
    const autoStars = Math.round(rawStars * 2) / 2;

    return {
      avgNps,
      totalNps,
      activeSpan,
      totalLength,
      peak1s,
      peak3s,
      p95Nps,
      sdpPoints,
      autoStars,
      lengthMod,
      stacksCount,
      maxStackSize,
      reversesCount,
      diagPct,
      sharpTurns,
      maxSpeed,
      minEffTravelMs: Math.round(baseTravelMs / maxSpeed),
      speedModAvg,
      secBins
    };
  }

  function renderSwipetavaStarsHtml(difficulty) {
    const d = Math.max(0, Number(difficulty) || 0);
    const clamped = Math.min(10, d);
    const overlayRed = Math.max(0, clamped - 5);
    let html = '<span style="display:inline-flex;gap:3px;align-items:center;vertical-align:middle;">';
    for (let i = 0; i < 5; i++) {
      const thresh = i + 1;
      const wFill = clamped >= thresh ? 1 : (clamped >= thresh - 0.5 ? 0.5 : 0);
      const rFill = overlayRed >= thresh ? 1 : (overlayRed >= thresh - 0.5 ? 0.5 : 0);
      const gradId = `swstar_${i}_${Math.round(d * 10)}`;
      let fillStyle = 'rgba(148,163,184,0.22)';
      let strokeCol = '#64748b';
      if (rFill === 1) {
        fillStyle = '#ff3847';
        strokeCol = '#ff8a93';
      } else if (rFill === 0.5) {
        fillStyle = `url(#${gradId}_rw)`;
        strokeCol = '#ff3847';
      } else if (wFill === 1) {
        fillStyle = '#f8fafc';
        strokeCol = '#cbd5e1';
      } else if (wFill === 0.5) {
        fillStyle = `url(#${gradId}_we)`;
        strokeCol = '#f8fafc';
      }
      html += `<svg width="16" height="16" viewBox="0 0 24 24" style="filter:${rFill > 0 ? 'drop-shadow(0 0 4px rgba(255,56,71,0.75))' : 'none'}">
        <defs>
          <linearGradient id="${gradId}_rw" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stop-color="#ff3847" />
            <stop offset="50%" stop-color="#f8fafc" />
          </linearGradient>
          <linearGradient id="${gradId}_we" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stop-color="#f8fafc" />
            <stop offset="50%" stop-color="rgba(148,163,184,0.22)" />
          </linearGradient>
        </defs>
        <polygon points="12,2 15.1,8.3 22,9.3 17,14.1 18.2,21 12,17.7 5.8,21 7,14.1 2,9.3 8.9,8.3" fill="${fillStyle}" stroke="${strokeCol}" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
    }
    if (d > 10) {
      html += `<span style="color:#ff3847;font-size:11px;font-weight:800;margin-left:3px;">+${(d - 10).toFixed(1)}★</span>`;
    }
    html += '</span>';
    return html;
  }

  function renderNpsAnalytics() {
    const st = computeChartDifficultyStats();
    state.lastStats = st;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('stat-avg-nps', st.avgNps.toFixed(2));
    setTxt('stat-peak-nps', String(st.peak1s));
    setTxt('stat-sdp-points', `${st.sdpPoints.toFixed(1)} pts`);
    setTxt('stat-auto-stars', `${st.autoStars.toFixed(1)}★`);

    setTxt('kpi-sdp-points', `${st.sdpPoints.toFixed(1)} pts`);
    setTxt('kpi-sdp-rank', `Длина: ${st.activeSpan.toFixed(1)}с (множитель длины ×${st.lengthMod.toFixed(2)})`);
    const autoStarsEl = document.getElementById('kpi-auto-stars');
    if (autoStarsEl) {
      autoStarsEl.innerHTML = `${st.autoStars.toFixed(1)} ★ ${renderSwipetavaStarsHtml(st.autoStars)}`;
    }
    const manStarsEl = document.getElementById('kpi-manual-stars-cmp');
    if (manStarsEl) {
      manStarsEl.innerHTML = `В meta.json: ${state.meta.difficulty} ★ ${renderSwipetavaStarsHtml(state.meta.difficulty)}`;
    }
    setTxt('kpi-avg-nps', `${st.avgNps.toFixed(2)} н/с`);
    setTxt('kpi-total-nps', `По всему треку (${st.totalLength.toFixed(0)}с): ${st.totalNps.toFixed(2)} н/с`);
    setTxt('kpi-peak-nps', `${st.peak1s} / ${st.peak3s.toFixed(2)}`);
    setTxt('kpi-p95-nps', `95-й перцентиль: ${st.p95Nps.toFixed(1)} н/с`);
    setTxt('kpi-stacks-revs', `${st.stacksCount} (макс ×${st.maxStackSize}) / ${st.reversesCount}`);
    setTxt('kpi-diags-angles', `Диагонали: ${st.diagPct}% · Смены ≥90°: ${st.sharpTurns}`);
    setTxt('kpi-scroll-bpm', `${st.minEffTravelMs} мс (${st.maxSpeed.toFixed(2)}x)`);
    setTxt('kpi-bpm-sub', `BPM: ${state.chart.bpm} · Множитель чтения: ${st.speedModAvg.toFixed(2)}x`);

    const canvas = document.getElementById('nps-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#090d18';
    ctx.fillRect(0, 0, W, H);

    const bins = st.secBins;
    if (!bins || !bins.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Поставь ноты на карту, чтобы увидеть график плотности NPS по секундам', 14, H / 2);
      return;
    }

    const maxBin = Math.max(5, st.peak1s, ...bins);
    const padL = 28, padR = 10, padT = 12, padB = 18;
    const plotW = Math.max(10, W - padL - padR);
    const plotH = Math.max(10, H - padT - padB);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px ui-monospace, monospace';
    [0, Math.round(maxBin / 2), maxBin].forEach(val => {
      const y = padT + plotH - (val / maxBin) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(String(val), 4, y + 3);
    });

    const barW = Math.max(1.5, plotW / bins.length);
    for (let s = 0; s < bins.length; s++) {
      const v = bins[s];
      if (v <= 0) continue;
      const ratio = v / maxBin;
      const bh = ratio * plotH;
      const bx = padL + (s / bins.length) * plotW;
      const by = padT + plotH - bh;

      ctx.fillStyle = ratio > 0.8 ? '#f43f5e' : ratio > 0.5 ? '#f59e0b' : '#38bdf8';
      ctx.fillRect(bx, by, Math.max(1.2, barW - 0.8), bh);
    }

    const avgY = padT + plotH - Math.min(1, st.avgNps / maxBin) * plotH;
    ctx.strokeStyle = '#fde047';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(W - padR, avgY);
    ctx.stroke();
    ctx.setLineDash([]);

    const curX = padL + Math.min(1, Math.max(0, state.currentTime / Math.max(1, bins.length))) * plotW;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, padT);
    ctx.lineTo(curX, padT + plotH);
    ctx.stroke();
  }

  function refreshAllViews() {
    renderPreviewCanvas();
    renderTimelineCanvas();
    renderInspector();
    renderEventsList();
    renderTimingTable();
    renderNpsAnalytics();
    updateTimeReadout();
  }

  function updateTimeReadout() {
    const el = document.getElementById('time-readout');
    if (el) {
      el.textContent = `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`;
    }
  }

  function setCurrentTime(sec, keepPlaying = false) {
    state.currentTime = Math.max(0, Math.min(state.duration || 600, sec));
    if (state.audioEl && state.audioEl.src && !keepPlaying) {
      try {
        state.audioEl.currentTime = state.currentTime;
      } catch (_) {}
    }
    // Автоскролл таймлайна, если курсор вышел за правую/левую границу
    const canvas = document.getElementById('timeline-canvas');
    if (canvas) {
      const labelW = 118;
      const viewW = canvas.width - labelW;
      const playX = state.currentTime * state.zoomPxPerSec - state.timelineScrollX;
      if (playX > viewW * 0.88) {
        state.timelineScrollX = Math.max(0, state.currentTime * state.zoomPxPerSec - viewW * 0.25);
      } else if (playX < 0) {
        state.timelineScrollX = Math.max(0, state.currentTime * state.zoomPxPerSec - viewW * 0.15);
      }
    }
    renderPreviewCanvas();
    renderTimelineCanvas();
    updateTimeReadout();
  }

  // --- Загрузка и декодирование аудио / обложки / фона ---
  async function loadAudioFromBytes(bytes, fileName, mimeType) {
    state.assets.audioBytes = bytes;
    const ext = (fileName.split('.').pop() || 'ogg').toLowerCase();
    state.chart.audioFile = fileName;
    state.chart.audioFormat = ext;
    state.assets.audioMime = mimeType || (ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/ogg');

    if (state.audioObjectUrl) URL.revokeObjectURL(state.audioObjectUrl);
    const blob = new Blob([bytes], { type: state.assets.audioMime });
    state.audioObjectUrl = URL.createObjectURL(blob);
    state.audioEl.src = state.audioObjectUrl;
    state.audioEl.playbackRate = state.playbackRate;

    try {
      const ctx = ensureAudioCtx();
      if (ctx) {
        const copyBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const decoded = await ctx.decodeAudioData(copyBuf);
        state.audioBuffer = decoded;
        state.duration = Math.max(1, decoded.duration);
        state.waveformPeaks = computePeaks(decoded, 3000);
        computeOnsetEnvelope(decoded);
      }
    } catch (err) {
      // Если decodeAudioData не сработал до клика пользователя, берём длительность из HTMLAudioElement
      await new Promise(resolve => {
        state.audioEl.onloadedmetadata = () => {
          if (Number.isFinite(state.audioEl.duration) && state.audioEl.duration > 0) {
            state.duration = state.audioEl.duration;
          }
          resolve();
        };
        state.audioEl.onerror = () => resolve();
      });
    }

    const badge = document.getElementById('asset-audio-status');
    if (badge) badge.textContent = `${fileName} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} МБ)`;
    refreshAllViews();
  }

  function computePeaks(audioBuffer, numBins) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null;
    const total = ch0.length;
    const step = Math.max(1, Math.floor(total / numBins));
    const peaks = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      const start = i * step;
      const end = Math.min(total, start + step);
      let max = 0;
      for (let j = start; j < end; j += 4) {
        const v = ch1 ? (Math.abs(ch0[j]) + Math.abs(ch1[j])) * 0.5 : Math.abs(ch0[j]);
        if (v > max) max = v;
      }
      peaks[i] = Math.min(1, max);
    }
    return peaks;
  }

  // Вычисление огибающей энергии аудио для привязки к пику волны (Onset) и Авто-BPM
  function computeOnsetEnvelope(audioBuffer) {
    try {
      const sr = 200;
      state.onsetSr = sr;
      const ch0 = audioBuffer.getChannelData(0);
      const hop = Math.max(1, Math.floor(audioBuffer.sampleRate / sr));
      const nFrames = Math.floor(ch0.length / hop);
      const env = new Float32Array(nFrames);
      let maxVal = 1e-6;
      for (let i = 0; i < nFrames; i++) {
        let sum = 0;
        const base = i * hop;
        for (let j = 0; j < hop; j += 2) {
          const v = ch0[base + j] || 0;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / Math.max(1, hop / 2));
        env[i] = rms;
        if (rms > maxVal) maxVal = rms;
      }
      for (let i = 0; i < nFrames; i++) env[i] /= maxVal;
      state.onsetEnv = env;
    } catch (_) {
      state.onsetEnv = null;
    }
  }

  function autoDetectBpmAndOffset() {
    if (!state.onsetEnv || state.onsetEnv.length < 200) {
      setStatus('Для Авто-BPM сначала загрузи аудиофайл или выбери карту из плейлиста');
      return;
    }
    const env = state.onsetEnv;
    const sr = state.onsetSr || 200;
    const flux = new Float32Array(env.length);
    for (let i = 1; i < env.length; i++) {
      flux[i] = Math.max(0, env[i] - env[i - 1]);
    }
    let bestBpm = 120;
    let bestScore = -1;
    for (let bpm = 75; bpm <= 195; bpm++) {
      const lag = Math.round((60 / bpm) * sr);
      if (lag <= 2 || lag >= flux.length / 2) continue;
      let s = 0;
      const limit = Math.min(flux.length - lag, sr * 45);
      for (let i = 0; i < limit; i++) {
        s += flux[i] * flux[i + lag];
      }
      if (s > bestScore) {
        bestScore = s;
        bestBpm = bpm;
      }
    }
    // Находим лучшую фазу (gridOffset)
    const period = Math.round((60 / bestBpm) * sr);
    let bestPhase = 0;
    let bestPhaseSum = -1;
    for (let p = 0; p < period; p++) {
      let sum = 0;
      for (let idx = p; idx < flux.length; idx += period) sum += flux[idx];
      if (sum > bestPhaseSum) {
        bestPhaseSum = sum;
        bestPhase = p;
      }
    }
    const offsetSec = roundTime(bestPhase / sr);
    pushUndo();
    state.chart.bpm = bestBpm;
    state.chart.gridOffset = offsetSec;
    if (state.chart.timing && state.chart.timing.length) {
      state.chart.timing[0].bpm = bestBpm;
      state.chart.timing[0].time = offsetSec;
    } else {
      state.chart.timing = [{ time: offsetSec, bpm: bestBpm }];
    }
    syncMetaAndChartInputs();
    refreshAllViews();
    setStatus(`Авто-BPM: определён темп ${bestBpm} BPM, сдвиг сетки ${offsetSec.toFixed(3)} сек`);
  }

  function runChartValidator() {
    const outBox = document.getElementById('chart-validator-output');
    const issues = [];
    const notes = state.chart.notes || [];
    const events = state.chart.events || [];

    // 1. Проверка реверсов в первой секунде (EARLY_EVENT_WINDOW = 1.0)
    for (const n of notes) {
      if ((n.type === 'REVERSE' || n.type === 'REVERSE_BACK') && n.time <= 1.0) {
        issues.push(`⚠ Нота ${n.type} на ${n.time.toFixed(3)}с стоит в первой секунде (<= 1.0с): из-за EARLY_EVENT_WINDOW в игре дорожка развернётся сразу на 0.0с.`);
      }
    }
    for (const ev of events) {
      if (ev.type === 'NOTES_FLOW_RIGHT' && ev.time > 0.001 && ev.time <= 1.0) {
        issues.push(`⚠ Событие NOTES_FLOW_RIGHT на ${ev.time.toFixed(3)}с (<= 1.0с) развернёт поток сразу при старте уровня.`);
      }
    }

    // 2. Проверка дублей одного направления в одну миллисекунду
    for (let i = 1; i < notes.length; i++) {
      if (Math.abs(notes[i].time - notes[i - 1].time) <= 0.005 && notes[i].type === notes[i - 1].type) {
        issues.push(`⚠ Дубликат одинаковой ноты ${notes[i].type} в одном стаке на ${notes[i].time.toFixed(3)}с.`);
      }
    }

    // 3. Проверка реверс-нот без парного NOTES_FLOW_* или осиротевших NOTES_FLOW_*
    for (const n of notes) {
      if (n.type === 'REVERSE' || n.type === 'REVERSE_BACK') {
        const expected = n.type === 'REVERSE' ? 'NOTES_FLOW_RIGHT' : 'NOTES_FLOW_LEFT';
        const hasPair = events.some(e => e.type === expected && Math.abs(e.time - n.time) <= 0.05);
        if (!hasPair) {
          issues.push(`ℹ У ноты ${n.type} на ${n.time.toFixed(3)}с нет явного события ${expected} (игра сама добавит его через _heal_missing_reverse_events).`);
        }
      }
    }

    // 4. Проверка несброшенного NOTE_SPEED
    const speedEvs = events.filter(e => e.type === 'NOTE_SPEED');
    if (speedEvs.length && Number(speedEvs[speedEvs.length - 1].speed) !== 1) {
      issues.push(`ℹ Последний NOTE_SPEED равен ${speedEvs[speedEvs.length - 1].speed}x (не сброшен обратно в 1.0x до конца карты).`);
    }

    if (outBox) {
      outBox.style.display = 'block';
      if (!issues.length) {
        outBox.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        outBox.style.color = '#86efac';
        outBox.innerHTML = `✅ Проблем не найдено! Нот: ${notes.length}, стаков: ${state.lastStats ? state.lastStats.stacksCount : 0}, событий: ${events.length}.`;
      } else {
        outBox.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        outBox.style.color = '#fde68a';
        outBox.innerHTML = issues.map(x => `<div>${escapeHtml(x)}</div>`).join('');
      }
    }
    setStatus(issues.length ? `Проверка карты: найдено ${issues.length} замечаний` : 'Проверка карты: всё чисто!');
  }

  function loadImageFromBytes(bytes, targetKey, fileName) {
    return new Promise((resolve) => {
      const blob = new Blob([bytes], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (targetKey === 'cover') {
          state.assets.coverBytes = bytes;
          state.coverImage = img;
          state.chart.coverFile = fileName || 'Cover.png';
          const thumb = document.getElementById('cover-preview-img');
          if (thumb) {
            thumb.src = url;
            thumb.style.display = 'block';
          }
          const stEl = document.getElementById('asset-cover-status');
          if (stEl) stEl.textContent = `${state.chart.coverFile} (${img.width}×${img.height})`;
        } else {
          state.assets.bgBytes = bytes;
          state.bgImage = img;
          state.chart.backgroundFile = fileName || 'bg.png';
          const stEl = document.getElementById('asset-bg-status');
          if (stEl) stEl.textContent = `${state.chart.backgroundFile} (${img.width}×${img.height})`;
        }
        renderPreviewCanvas();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  // --- Импорт и экспорт архива .swmap ---
  async function importSwmapFile(file) {
    try {
      setStatus(`Распаковка ${file.name}...`);
      const { files } = await window.SwmapZip.readSwmapZip(file);

      if (!files['chart.json']) {
        throw new Error('В архиве .swmap не найден обязательный файл chart.json');
      }

      const chartJson = JSON.parse(window.SwmapZip.decodeText(files['chart.json']));
      const metaJson = files['meta.json']
        ? JSON.parse(window.SwmapZip.decodeText(files['meta.json']))
        : {
            title: chartJson.title || 'Untitled',
            artist: chartJson.artist || 'Unknown',
            difficulty: 5,
            menu_color: '#2a0a5e'
          };

      pushUndo();
      state.meta = {
        title: metaJson.title || chartJson.title || 'Untitled',
        artist: metaJson.artist || chartJson.artist || 'Unknown',
        difficulty: Number(metaJson.difficulty) || 5,
        menu_color: metaJson.menu_color || '#2a0a5e'
      };

      state.chart = {
        bpm: Number(chartJson.bpm) || 120,
        noteTravelTime: Number(chartJson.noteTravelTime) || 1000,
        gridOffset: Number(chartJson.gridOffset) || 0,
        timing: Array.isArray(chartJson.timing) && chartJson.timing.length
          ? chartJson.timing
          : [{ time: Number(chartJson.gridOffset) || 0, bpm: Number(chartJson.bpm) || 120 }],
        title: chartJson.title || state.meta.title,
        artist: chartJson.artist || state.meta.artist,
        notes: Array.isArray(chartJson.notes) ? chartJson.notes : [],
        events: Array.isArray(chartJson.events) ? chartJson.events : [],
        audioFile: chartJson.audioFile || 'track.ogg',
        audioFormat: chartJson.audioFormat || 'ogg',
        coverFile: chartJson.coverFile || 'Cover.png',
        backgroundFile: chartJson.backgroundFile || 'bg.png'
      };

      sortChart();
      state.assets.extraFiles = {};

      // Загружаем аудио, обложку и фон из архива
      const audioName = state.chart.audioFile;
      const coverName = state.chart.coverFile;
      const bgName = state.chart.backgroundFile;

      for (const [name, bytes] of Object.entries(files)) {
        if (name === 'chart.json' || name === 'meta.json') continue;
        if (name === audioName || /\.(ogg|mp3|wav)$/i.test(name)) {
          await loadAudioFromBytes(bytes, name);
        } else if (name === coverName || /^cover\./i.test(name)) {
          await loadImageFromBytes(bytes, 'cover', name);
        } else if (name === bgName || /^bg\./i.test(name)) {
          await loadImageFromBytes(bytes, 'bg', name);
        } else {
          state.assets.extraFiles[name] = bytes;
        }
      }

      // Оцениваем длительность карты, если аудио ещё не декодировано
      let maxChartTime = 30;
      for (const n of state.chart.notes) if (n.time > maxChartTime) maxChartTime = n.time;
      for (const ev of state.chart.events) if ((ev.time + (ev.duration || 0)) > maxChartTime) maxChartTime = ev.time + (ev.duration || 0);
      if (!state.audioBuffer && maxChartTime + 5 > state.duration) {
        state.duration = maxChartTime + 5;
      }

      state.selectedItem = null;
      syncMetaAndChartInputs();
      setCurrentTime(0);
      refreshAllViews();
      setStatus(`Загружена карта "${state.meta.title}" — ${state.chart.notes.length} нот, ${state.chart.events.length} событий`);
    } catch (err) {
      console.error(err);
      setStatus(`Ошибка чтения .swmap: ${err.message}`);
      alert(`Ошибка чтения .swmap:\n${err.message}`);
    }
  }

  async function generatePlaceholderPngBytes(width, height, hexColor, titleText) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, hexColor || '#2a0a5e');
    grad.addColorStop(1, '#090d16');
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);

    if (titleText) {
      g.fillStyle = '#ffffff';
      g.font = `bold ${Math.round(width * 0.08)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(titleText, width / 2, height / 2);
    }

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  function generateSilentWavBytes(durationSec = 5) {
    const sampleRate = 8000;
    const numSamples = Math.max(8000, Math.floor(durationSec * sampleRate));
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);
    return new Uint8Array(buffer);
  }

  async function exportSwmapArchive() {
    try {
      setStatus('Упаковка .swmap архива...');
      readMetaAndChartInputs();
      sortChart();

      const metaOut = {
        title: state.meta.title,
        artist: state.meta.artist,
        difficulty: Number(state.meta.difficulty) || 5,
        menu_color: state.meta.menu_color || '#2a0a5e'
      };

      const chartOut = {
        bpm: Number(state.chart.bpm) || 120,
        noteTravelTime: Number(state.chart.noteTravelTime) || 1000,
        gridOffset: Number(state.chart.gridOffset) || 0,
        timing: state.chart.timing && state.chart.timing.length
          ? state.chart.timing
          : [{ time: Number(state.chart.gridOffset) || 0, bpm: Number(state.chart.bpm) || 120 }],
        title: state.meta.title,
        artist: state.meta.artist,
        notes: state.chart.notes.map(n => ({
          time: roundTime(n.time),
          type: n.type
        })),
        events: state.chart.events.map(ev => {
          const clean = { time: roundTime(ev.time), type: ev.type };
          if (ev.duration !== undefined) clean.duration = Number(ev.duration);
          if (ev.speed !== undefined) clean.speed = Number(ev.speed);
          if (ev.color !== undefined) clean.color = ev.color;
          if (ev.text !== undefined) clean.text = ev.text;
          return clean;
        }),
        audioFile: state.chart.audioFile || 'track.ogg',
        audioFormat: state.chart.audioFormat || 'ogg',
        coverFile: state.chart.coverFile || 'Cover.png',
        backgroundFile: state.chart.backgroundFile || 'bg.png'
      };

      const coverBytes = state.assets.coverBytes || await generatePlaceholderPngBytes(512, 512, state.meta.menu_color, state.meta.title);
      const bgBytes = state.assets.bgBytes || await generatePlaceholderPngBytes(1280, 720, state.meta.menu_color, '');
      const audioBytes = state.assets.audioBytes || generateSilentWavBytes(Math.max(10, state.duration));

      const entries = [
        { name: chartOut.coverFile, data: coverBytes, compress: false },
        { name: chartOut.backgroundFile, data: bgBytes, compress: true },
        { name: 'chart.json', data: JSON.stringify(chartOut, null, 2), compress: false },
        { name: 'meta.json', data: JSON.stringify(metaOut, null, 2), compress: false },
        { name: chartOut.audioFile, data: audioBytes, compress: false }
      ];

      for (const [k, v] of Object.entries(state.assets.extraFiles)) {
        entries.push({ name: k, data: v, compress: false });
      }

      const zipBytes = await window.SwmapZip.writeSwmapZip(entries);
      const safeName = (state.meta.title || 'custom_map')
        .toLowerCase()
        .replace(/[^a-z0-9а-яё_-]+/gi, '_')
        .replace(/^_+|_+$/g, '') || 'custom_map';

      downloadBlob(new Blob([zipBytes], { type: 'application/octet-stream' }), `${safeName}.swmap`);
      setStatus(`Готово! Скачан архив ${safeName}.swmap (${(zipBytes.byteLength / 1024 / 1024).toFixed(2)} МБ)`);
    } catch (err) {
      console.error(err);
      setStatus(`Ошибка сборки .swmap: ${err.message}`);
    }
  }

  function exportJsonOnly() {
    readMetaAndChartInputs();
    sortChart();
    const blob = new Blob([JSON.stringify(state.chart, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'chart.json');
    setStatus('Скачан файл chart.json');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  }

  // --- Синхронизация полей meta.json и chart.json с UI ---
  function syncMetaAndChartInputs() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    setVal('meta-title', state.meta.title);
    setVal('meta-artist', state.meta.artist);
    setVal('meta-difficulty', state.meta.difficulty);
    setVal('meta-difficulty-num', state.meta.difficulty);
    setVal('meta-color', state.meta.menu_color || '#2a0a5e');
    setVal('chart-bpm', state.chart.bpm);
    setVal('chart-travel-time', state.chart.noteTravelTime);
    setVal('chart-grid-offset', state.chart.gridOffset);
    setVal('chart-audio-file', state.chart.audioFile);
    setVal('chart-cover-file', state.chart.coverFile);
    setVal('chart-bg-file', state.chart.backgroundFile);
  }

  function readMetaAndChartInputs() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };
    state.meta.title = getVal('meta-title') || 'Untitled';
    state.meta.artist = getVal('meta-artist') || 'Unknown';
    state.meta.difficulty = Math.max(0.1, Number(getVal('meta-difficulty-num') || getVal('meta-difficulty')) || 5);
    state.meta.menu_color = getVal('meta-color') || '#2a0a5e';

    state.chart.title = state.meta.title;
    state.chart.artist = state.meta.artist;
    state.chart.bpm = Math.max(20, Number(getVal('chart-bpm')) || 120);
    state.chart.noteTravelTime = Math.max(150, Number(getVal('chart-travel-time')) || 1000);
    state.chart.gridOffset = Number(getVal('chart-grid-offset')) || 0;
    state.chart.audioFile = getVal('chart-audio-file') || 'track.ogg';
    state.chart.audioFormat = (state.chart.audioFile.split('.').pop() || 'ogg').toLowerCase();
    state.chart.coverFile = getVal('chart-cover-file') || 'Cover.png';
    state.chart.backgroundFile = getVal('chart-bg-file') || 'bg.png';

    if (!state.chart.timing || !state.chart.timing.length) {
      state.chart.timing = [{ time: state.chart.gridOffset, bpm: state.chart.bpm }];
    } else {
      state.chart.timing[0].time = state.chart.gridOffset;
      state.chart.timing[0].bpm = state.chart.bpm;
    }
  }

  // --- Встроенная демо-карта из demo.swmap (Just chilll — Arvicheskyy) ---
  const DEMO_SWMAP_META = {"title": "Just chilll", "artist": "Arvicheskyy", "difficulty": 0.5, "menu_color": "#b32222"};
  const DEMO_SWMAP_CHART = {"bpm": 90, "noteTravelTime": 1000, "title": "test", "artist": "test", "notes": [{"time": 0.392, "type": "RIGHT"}, {"time": 2.686, "type": "RIGHT"}, {"time": 5.416, "type": "RIGHT"}, {"time": 7.998, "type": "UP"}, {"time": 10.686, "type": "RIGHT"}, {"time": 11.352, "type": "UP"}, {"time": 12.019, "type": "RIGHT"}, {"time": 12.686, "type": "DOWN"}, {"time": 13.352, "type": "RIGHT"}, {"time": 14.019, "type": "UP"}, {"time": 14.686, "type": "RIGHT"}, {"time": 15.352, "type": "LEFT"}, {"time": 16.019, "type": "DOWN"}, {"time": 16.686, "type": "RIGHT"}, {"time": 17.352, "type": "UP"}, {"time": 18.019, "type": "RIGHT"}, {"time": 18.686, "type": "UP"}, {"time": 19.352, "type": "RIGHT"}, {"time": 20.019, "type": "RIGHT"}, {"time": 20.686, "type": "DOWN"}, {"time": 21.352, "type": "RIGHT"}, {"time": 22.019, "type": "UP"}, {"time": 22.686, "type": "RIGHT"}, {"time": 23.352, "type": "DOWN"}, {"time": 24.019, "type": "LEFT"}, {"time": 24.686, "type": "RIGHT"}, {"time": 25.352, "type": "UP"}, {"time": 26.019, "type": "RIGHT"}, {"time": 26.686, "type": "LEFT"}, {"time": 27.352, "type": "DOWN"}, {"time": 28.019, "type": "RIGHT"}, {"time": 28.686, "type": "UP"}, {"time": 29.352, "type": "LEFT"}, {"time": 30.019, "type": "DOWN"}, {"time": 30.686, "type": "RIGHT"}, {"time": 31.352, "type": "UP"}, {"time": 32.019, "type": "RIGHT"}, {"time": 32.766, "type": "DOWN"}, {"time": 33.374, "type": "RIGHT"}, {"time": 34.003, "type": "UP"}, {"time": 34.654, "type": "DOWN"}, {"time": 35.358, "type": "UP"}, {"time": 35.987, "type": "RIGHT"}, {"time": 36.691, "type": "DOWN"}, {"time": 37.427, "type": "DOWN"}, {"time": 38.163, "type": "RIGHT"}, {"time": 38.76, "type": "UP"}, {"time": 39.454, "type": "RIGHT"}, {"time": 40.094, "type": "LEFT"}, {"time": 40.787, "type": "RIGHT"}, {"time": 41.438, "type": "DOWN"}, {"time": 42.056, "type": "RIGHT"}, {"time": 42.707, "type": "UP"}, {"time": 43.464, "type": "RIGHT"}, {"time": 44.094, "type": "DOWN"}, {"time": 44.798, "type": "DOWN"}, {"time": 45.448, "type": "LEFT"}, {"time": 46.142, "type": "UP"}, {"time": 46.75, "type": "UP"}, {"time": 47.379, "type": "UP"}, {"time": 48.083, "type": "RIGHT"}, {"time": 48.83, "type": "DOWN"}, {"time": 49.416, "type": "DOWN"}, {"time": 50.046, "type": "DOWN"}, {"time": 50.632, "type": "RIGHT"}, {"time": 51.368, "type": "UP"}, {"time": 52.008, "type": "LEFT"}, {"time": 52.766, "type": "DOWN"}, {"time": 53.448, "type": "UP"}, {"time": 54.019, "type": "RIGHT"}, {"time": 54.686, "type": "UP"}, {"time": 55.352, "type": "RIGHT"}, {"time": 56.019, "type": "DOWN"}, {"time": 56.686, "type": "LEFT"}, {"time": 57.352, "type": "LEFT"}, {"time": 58.019, "type": "LEFT"}, {"time": 58.686, "type": "UP"}, {"time": 59.352, "type": "RIGHT"}, {"time": 60.019, "type": "RIGHT"}, {"time": 60.686, "type": "RIGHT"}, {"time": 61.342, "type": "DOWN"}, {"time": 62.019, "type": "LEFT"}, {"time": 62.686, "type": "LEFT"}, {"time": 63.352, "type": "LEFT"}, {"time": 64.019, "type": "UP"}, {"time": 64.691, "type": "RIGHT"}, {"time": 65.352, "type": "RIGHT"}, {"time": 65.992, "type": "RIGHT"}, {"time": 66.686, "type": "DOWN"}, {"time": 67.368, "type": "RIGHT"}, {"time": 67.976, "type": "RIGHT"}, {"time": 68.686, "type": "RIGHT"}, {"time": 69.352, "type": "LEFT"}, {"time": 70.024, "type": "UP"}, {"time": 70.686, "type": "UP"}, {"time": 71.352, "type": "UP"}, {"time": 72.019, "type": "DOWN"}, {"time": 72.686, "type": "RIGHT"}, {"time": 73.352, "type": "RIGHT"}, {"time": 74.019, "type": "RIGHT"}, {"time": 74.686, "type": "UP"}, {"time": 75.368, "type": "RIGHT"}, {"time": 75.966, "type": "DOWN"}, {"time": 76.627, "type": "RIGHT"}, {"time": 77.338, "type": "UP_LEFT"}, {"time": 78.11, "type": "LEFT"}, {"time": 78.76, "type": "DOWN"}, {"time": 79.422, "type": "RIGHT"}, {"time": 80.106, "type": "DOWN_RIGHT"}, {"time": 80.808, "type": "LEFT"}, {"time": 81.406, "type": "UP"}, {"time": 82.056, "type": "RIGHT"}, {"time": 82.707, "type": "RIGHT"}, {"time": 83.454, "type": "DOWN"}, {"time": 84.008, "type": "LEFT"}, {"time": 84.659, "type": "UP"}, {"time": 85.352, "type": "RIGHT"}, {"time": 86.019, "type": "DOWN"}, {"time": 86.686, "type": "RIGHT"}, {"time": 87.371, "type": "DOWN"}, {"time": 88.019, "type": "UP"}, {"time": 88.686, "type": "RIGHT"}, {"time": 89.352, "type": "DOWN"}, {"time": 90.019, "type": "LEFT"}, {"time": 90.686, "type": "UP_RIGHT"}, {"time": 91.352, "type": "RIGHT"}, {"time": 92.019, "type": "UP"}, {"time": 92.686, "type": "RIGHT"}, {"time": 93.352, "type": "DOWN"}, {"time": 94.019, "type": "RIGHT"}, {"time": 94.686, "type": "RIGHT"}, {"time": 95.352, "type": "DOWN"}, {"time": 96.019, "type": "RIGHT"}, {"time": 96.686, "type": "RIGHT"}, {"time": 97.352, "type": "RIGHT"}, {"time": 98.019, "type": "RIGHT"}, {"time": 98.686, "type": "DOWN"}, {"time": 99.352, "type": "LEFT"}, {"time": 100.019, "type": "LEFT"}, {"time": 100.686, "type": "LEFT"}, {"time": 101.352, "type": "UP"}, {"time": 102.019, "type": "DOWN"}, {"time": 102.686, "type": "UP"}, {"time": 103.352, "type": "RIGHT"}, {"time": 104.019, "type": "DOWN"}, {"time": 104.686, "type": "UP"}, {"time": 105.352, "type": "DOWN"}, {"time": 106.019, "type": "UP"}], "events": [{"time": 0, "type": "FX_DUOTONE", "duration": 10.852}, {"time": 10.669, "type": "CAMERA_BOB_ON"}, {"time": 10.727, "type": "FLASH"}, {"time": 32.092, "type": "FLASH"}, {"time": 34.596, "type": "FLASH"}, {"time": 37.352, "type": "FLASH"}, {"time": 40.019, "type": "FLASH"}, {"time": 42.686, "type": "FLASH"}, {"time": 45.352, "type": "FLASH"}, {"time": 48.019, "type": "FLASH"}, {"time": 50.686, "type": "FLASH"}, {"time": 53.352, "type": "FLASH"}, {"time": 53.352, "type": "CAMERA_BOB_OFF"}, {"time": 53.43, "type": "FX_BW", "duration": 32}, {"time": 58.596, "type": "FLASH"}, {"time": 58.675, "type": "CAMERA_BOB_ON"}, {"time": 85.263, "type": "CAMERA_BOB_OFF"}, {"time": 85.352, "type": "FLASH"}], "audioFile": "track.ogg", "audioFormat": "ogg", "coverFile": "cover.png"};

  async function loadDemoShowcaseChart() {
    pushUndo();
    const metaCopy = JSON.parse(JSON.stringify(DEMO_SWMAP_META));
    const chartCopy = JSON.parse(JSON.stringify(DEMO_SWMAP_CHART));

    state.meta = {
      title: metaCopy.title || chartCopy.title || 'Just chilll',
      artist: metaCopy.artist || chartCopy.artist || 'Arvicheskyy',
      difficulty: (metaCopy.difficulty !== undefined && metaCopy.difficulty !== null) ? Number(metaCopy.difficulty) : 0.5,
      menu_color: metaCopy.menu_color || '#b32222'
    };

    const bpm = Number(chartCopy.bpm) || 90;
    const offset = Number(chartCopy.gridOffset) || 0;

    state.chart = {
      bpm,
      noteTravelTime: Number(chartCopy.noteTravelTime) || 1000,
      gridOffset: offset,
      timing: Array.isArray(chartCopy.timing) && chartCopy.timing.length
        ? chartCopy.timing
        : [{ time: offset, bpm }],
      title: chartCopy.title || state.meta.title,
      artist: chartCopy.artist || state.meta.artist,
      notes: Array.isArray(chartCopy.notes) ? chartCopy.notes : [],
      events: Array.isArray(chartCopy.events) ? chartCopy.events : [],
      audioFile: chartCopy.audioFile || 'track.ogg',
      audioFormat: chartCopy.audioFormat || 'ogg',
      coverFile: chartCopy.coverFile || 'Cover.png',
      backgroundFile: chartCopy.backgroundFile || 'bg.png'
    };

    sortChart();
    let maxT = 30;
    for (const n of state.chart.notes) if (n.time > maxT) maxT = n.time;
    for (const ev of state.chart.events) if ((ev.time + (ev.duration || 0)) > maxT) maxT = ev.time + (ev.duration || 0);
    if (!state.audioBuffer) state.duration = maxT + 5;

    state.selectedItem = null;
    state.timelineScrollX = 0;
    syncMetaAndChartInputs();
    setCurrentTime(0);
    refreshAllViews();
    setStatus(`Загружена демо-карта «${state.meta.title}» — ${state.meta.artist} (${state.chart.notes.length} нот, ${state.chart.events.length} событий)`);

    // Если рядом лежит demo.swmap и браузер разрешает локальный fetch — подгружаем из него track.ogg и ассеты
    if (window.location && window.location.protocol !== 'file:') {
      try {
        const resp = await fetch('./demo.swmap');
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const { files } = await window.SwmapZip.readSwmapZip(buf);
        const audioName = state.chart.audioFile;
        const coverName = state.chart.coverFile;
        const bgName = state.chart.backgroundFile;
        for (const [name, bytes] of Object.entries(files)) {
          if (name === 'chart.json' || name === 'meta.json') continue;
          if (name === audioName || /\.(ogg|mp3|wav)$/i.test(name)) {
            await loadAudioFromBytes(bytes, name);
          } else if (name === coverName || /^cover\./i.test(name)) {
            await loadImageFromBytes(bytes, 'cover', name);
          } else if (name === bgName || /^bg\./i.test(name)) {
            await loadImageFromBytes(bytes, 'bg', name);
          }
        }
        syncMetaAndChartInputs();
        refreshAllViews();
        }
      } catch (_) {}
    }
  }

  // --- Tap Tempo (определение BPM настукиванием) ---
  const tapTimes = [];
  function handleTapTempo() {
    const now = performance.now();
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2500) {
      tapTimes.length = 0;
    }
    tapTimes.push(now);
    if (tapTimes.length > 8) tapTimes.shift();
    playTick(950, 0.14, 0.03, 'sine');

    if (tapTimes.length >= 2) {
      let sum = 0;
      for (let i = 1; i < tapTimes.length; i++) sum += (tapTimes[i] - tapTimes[i - 1]);
      const avgMs = sum / (tapTimes.length - 1);
      const bpm = Math.round(60000 / avgMs);
      if (bpm >= 30 && bpm <= 360) {
        state.chart.bpm = bpm;
        if (state.chart.timing && state.chart.timing.length) {
          state.chart.timing[0].bpm = bpm;
        }
        syncMetaAndChartInputs();
        refreshAllViews();
        setStatus(`Tap Tempo: ${bpm} BPM (${tapTimes.length} нажатий)`);
      }
    } else {
      setStatus('Tap Tempo: продолжай нажимать в такт...');
    }
  }

  // --- Главный цикл воспроизведения (requestAnimationFrame) ---
  let lastFrameTs = performance.now();
  function animationLoop(nowTs) {
    const dt = Math.min(0.1, (nowTs - lastFrameTs) / 1000);
    lastFrameTs = nowTs;

    if (state.isPlaying) {
      const prevTime = state.currentTime;
      if (state.audioEl && state.audioEl.src && !state.audioEl.paused) {
        state.currentTime = state.audioEl.currentTime;
      } else {
        state.currentTime += dt * state.playbackRate;
      }

      if (state.currentTime >= state.duration) {
        state.currentTime = 0;
        pausePlayback();
      }

      // Проверяем пересечение нот для хитсаунда
      if (state.hitsoundEnabled) {
        const notes = state.chart.notes;
        for (let i = 0; i < notes.length; i++) {
          const nt = notes[i].time;
          if (nt > prevTime && nt <= state.currentTime) {
            playTick(1320, 0.16, 0.032, 'triangle');
            break;
          }
          if (nt > state.currentTime) break;
        }
      }

      // Проверяем пересечение долей для метронома
      if (state.metronomeEnabled) {
        const tp = getActiveTimingAt(state.currentTime);
        const beatSec = 60 / tp.bpm;
        const prevBeat = Math.floor((prevTime - tp.time) / beatSec);
        const curBeat = Math.floor((state.currentTime - tp.time) / beatSec);
        if (curBeat > prevBeat && state.currentTime >= tp.time) {
          const isBar = curBeat % 4 === 0;
          playTick(isBar ? 1560 : 880, 0.14, 0.04, 'sine');
        }
      }

      setCurrentTime(state.currentTime, true);
    }

    requestAnimationFrame(animationLoop);
  }

  function startPlayback() {
    ensureAudioCtx();
    state.isPlaying = true;
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.textContent = '⏸ Пауза';

    if (state.audioEl && state.audioEl.src) {
      state.audioEl.currentTime = state.currentTime;
      state.audioEl.playbackRate = state.playbackRate;
      state.audioEl.play().catch(() => {});
    }
  }

  function pausePlayback() {
    state.isPlaying = false;
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.textContent = '▶ Пуск';
    if (state.audioEl && !state.audioEl.paused) {
      state.audioEl.pause();
    }
  }

  function togglePlayback() {
    if (state.isPlaying) pausePlayback();
    else startPlayback();
  }

  // --- Инициализация интерфейса и обработчиков ---
  function initUI() {
    // 1. Палитра направлений нот (3×3 крестовина + круговые)
    const padContainer = document.getElementById('note-pad-grid');
    if (padContainer) {
      const gridOrder = [
        'UP_LEFT',   'UP',     'UP_RIGHT',
        'LEFT',      'CENTER', 'RIGHT',
        'DOWN_LEFT', 'DOWN',   'DOWN_RIGHT'
      ];
      padContainer.innerHTML = gridOrder.map(id => {
        if (id === 'CENTER') {
          return `<button type="button" class="pad-btn pad-center" id="btn-place-active-note" title="Поставить выбранную ноту на текущий таймкод">Поставить</button>`;
        }
        const nt = NOTE_MAP[id];
        return `
          <button type="button" class="pad-btn ${state.activeNoteType === id ? 'active' : ''}" data-note-type="${id}" style="--note-col:${nt.color}" title="${nt.label} (${nt.key})">
            <span class="pad-arrow">${nt.short}</span>
            <span class="pad-label">${nt.id}</span>
          </button>
        `;
      }).join('');

      const extraContainer = document.getElementById('note-extra-row');
      if (extraContainer) {
        extraContainer.innerHTML = ['REVERSE', 'REVERSE_BACK'].map(id => {
          const nt = NOTE_MAP[id];
          return `
            <button type="button" class="btn btn-sm ${state.activeNoteType === id ? 'active-pill' : ''}" data-note-type="${id}" style="border-color:${nt.color}">
              ${nt.short} ${nt.id} (${nt.key})
            </button>
          `;
        }).join('');
      }

      document.querySelectorAll('[data-note-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tId = btn.getAttribute('data-note-type');
          state.activeNoteType = tId;
          document.querySelectorAll('[data-note-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-note-type') === tId);
            b.classList.toggle('active-pill', b.getAttribute('data-note-type') === tId);
          });
          const placeImmediate = document.getElementById('note-click-places-check');
          if (placeImmediate && placeImmediate.checked) {
            const targetTime = state.isPlaying ? state.currentTime : snapTime(state.currentTime);
            addOrReplaceNoteAt(targetTime, tId);
          }
        });
      });

      const centerBtn = document.getElementById('btn-place-active-note');
      if (centerBtn) {
        centerBtn.addEventListener('click', () => {
          const targetTime = state.isPlaying ? state.currentTime : snapTime(state.currentTime);
          addOrReplaceNoteAt(targetTime, state.activeNoteType);
        });
      }
    }

    // 2. Селектор всех 22 типов событий
    const evSelect = document.getElementById('event-type-select');
    if (evSelect) {
      const groups = [
        { label: 'Надписи вместо комбо и скорость скролла', cat: 'text_speed' },
        { label: 'Движение нот, реверс дорожки и камера', cat: 'flow_cam' },
        { label: 'Шейдерные пост-эффекты (FX_*)', cat: 'fx' }
      ];
      evSelect.innerHTML = groups.map(g => {
        const opts = EVENT_DEFS.filter(e => e.cat === g.cat).map(e =>
          `<option value="${e.id}">${e.label}</option>`
        ).join('');
        return `<optgroup label="${g.label}">${opts}</optgroup>`;
      }).join('');

      const updateEventFormFields = () => {
        const def = EVENT_MAP[evSelect.value] || {};
        state.activeEventType = evSelect.value;
        document.getElementById('field-ev-duration').style.display = def.hasDuration ? 'flex' : 'none';
        document.getElementById('field-ev-speed').style.display = def.hasSpeed ? 'flex' : 'none';
        document.getElementById('field-ev-text').style.display = def.hasText ? 'flex' : 'none';
        document.getElementById('field-ev-color').style.display = def.hasColor ? 'flex' : 'none';
        document.getElementById('field-ev-pair').style.display = def.pairOff ? 'flex' : 'none';
        if (def.hasDuration) {
          document.getElementById('event-duration-input').value = def.defaultDuration || 0.5;
        }
        if (def.hasSpeed) {
          document.getElementById('event-speed-input').value = def.defaultSpeed || 1.5;
        }
        const descEl = document.getElementById('event-type-desc');
        if (descEl) descEl.textContent = def.desc || '';
      };

      evSelect.addEventListener('change', updateEventFormFields);
      updateEventFormFields();
    }

    // Быстрые кнопки добавления событий и пресетов скорости
    document.getElementById('btn-add-event').addEventListener('click', () => addEventFromForm());

    document.querySelectorAll('[data-quick-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const spd = Number(btn.getAttribute('data-quick-speed')) || 1.0;
        const t = roundTime(snapTime(state.currentTime));
        pushUndo();
        const existing = state.chart.events.find(e => e.type === 'NOTE_SPEED' && Math.abs(e.time - t) < 0.008);
        if (existing) {
          existing.speed = spd;
          state.selectedItem = { kind: 'event', item: existing };
        } else {
          const ev = { time: t, type: 'NOTE_SPEED', speed: spd };
          state.chart.events.push(ev);
          sortChart();
          state.selectedItem = { kind: 'event', item: ev };
        }
        refreshAllViews();
        setStatus(`Поставлено событие NOTE_SPEED = ${spd}x на ${t.toFixed(3)} сек`);
      });
    });

    document.querySelectorAll('[data-quick-fx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fxType = btn.getAttribute('data-quick-fx');
        const def = EVENT_MAP[fxType] || {};
        const t = roundTime(snapTime(state.currentTime));
        pushUndo();
        const ev = { time: t, type: fxType };
        if (def.hasDuration) ev.duration = def.defaultDuration || 0.5;
        state.chart.events.push(ev);
        sortChart();
        state.selectedItem = { kind: 'event', item: ev };
        refreshAllViews();
        setStatus(`Добавлен эффект ${fxType} на ${t.toFixed(3)} сек`);
      });
    });

    document.getElementById('btn-insert-hitech-phrases').addEventListener('click', insertPhraseSequenceByBeats);

    // 3. Привязка метаданных и параметров chart.json
    const metaIds = ['meta-title', 'meta-artist', 'meta-difficulty', 'meta-color', 'chart-bpm', 'chart-travel-time', 'chart-grid-offset', 'chart-audio-file', 'chart-cover-file', 'chart-bg-file'];
    for (const id of metaIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('input', () => {
        if (id === 'meta-difficulty') {
          document.getElementById('meta-difficulty-num').value = el.value;
        }
        readMetaAndChartInputs();
        renderPreviewCanvas();
        renderTimelineCanvas();
        renderTimingTable();
      });
    }
    const diffNum = document.getElementById('meta-difficulty-num');
    if (diffNum) {
      diffNum.addEventListener('input', () => {
        document.getElementById('meta-difficulty').value = diffNum.value;
        readMetaAndChartInputs();
      });
    }

    // 4. Загрузка файлов (.swmap, аудио, обложки, фона)
    document.getElementById('input-swmap-file').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importSwmapFile(f);
      e.target.value = '';
    });

    document.getElementById('input-audio-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const buf = await f.arrayBuffer();
      const lower = f.name.toLowerCase();
      if ((lower.endsWith('.oggvorbisstr') || lower.endsWith('.oggstr')) && window.SwmapZip && window.SwmapZip.convertGodotOggVorbis) {
        try {
          const conv = window.SwmapZip.convertGodotOggVorbis(buf, f.name);
          await loadAudioFromBytes(conv.bytes, conv.fileName, conv.mime);
          syncMetaAndChartInputs();
          setStatus(`Сконвертирован Godot ${f.name} → ${conv.fileName} (${conv.packetsCount} пакетов, ${conv.sampleRate} Гц)`);
          return;
        } catch (err) {
          setStatus(`Ошибка конвертации .oggvorbisstr: ${err.message}`);
          return;
        }
      }
      await loadAudioFromBytes(new Uint8Array(buf), f.name, f.type);
      syncMetaAndChartInputs();
      setStatus(`Загружено аудио ${f.name}`);
    });

    document.getElementById('input-cover-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const buf = await f.arrayBuffer();
      if (/\.(ctex|stex)$/i.test(f.name) && window.SwmapZip && window.SwmapZip.convertGodotTexture) {
        try {
          const conv = await window.SwmapZip.convertGodotTexture(buf, 'Cover.png');
          await loadImageFromBytes(conv.bytes, 'cover', 'Cover.png');
          syncMetaAndChartInputs();
          setStatus(`Сконвертирован Godot ${f.name} (${conv.sourceFormat} ${conv.width}×${conv.height}) → Cover.png`);
          return;
        } catch (err) {
          setStatus(`Ошибка конвертации .ctex: ${err.message}`);
          return;
        }
      }
      await loadImageFromBytes(new Uint8Array(buf), 'cover', f.name);
      syncMetaAndChartInputs();
      setStatus(`Загружена обложка ${f.name}`);
    });

    document.getElementById('input-bg-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const buf = await f.arrayBuffer();
      if (/\.(ctex|stex)$/i.test(f.name) && window.SwmapZip && window.SwmapZip.convertGodotTexture) {
        try {
          const conv = await window.SwmapZip.convertGodotTexture(buf, 'bg.png');
          await loadImageFromBytes(conv.bytes, 'bg', 'bg.png');
          syncMetaAndChartInputs();
          setStatus(`Сконвертирован Godot ${f.name} (${conv.sourceFormat} ${conv.width}×${conv.height}) → bg.png`);
          return;
        } catch (err) {
          setStatus(`Ошибка конвертации .ctex: ${err.message}`);
          return;
        }
      }
      await loadImageFromBytes(new Uint8Array(buf), 'bg', f.name);
      syncMetaAndChartInputs();
      setStatus(`Загружен фон ${f.name}`);
    });

    // Поддержка Drag-and-Drop .swmap прямо на окно браузера
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      if (f.name.toLowerCase().endsWith('.swmap') || f.name.toLowerCase().endsWith('.zip')) {
        importSwmapFile(f);
      } else if (/\.(ogg|mp3|wav)$/i.test(f.name)) {
        f.arrayBuffer().then(buf => loadAudioFromBytes(new Uint8Array(buf), f.name, f.type));
      }
    });

    // 5. Кнопки верхней панели и транспорта
    document.getElementById('btn-export-swmap').addEventListener('click', exportSwmapArchive);
    document.getElementById('btn-export-json').addEventListener('click', exportJsonOnly);
    document.getElementById('btn-load-demo').addEventListener('click', loadDemoShowcaseChart);
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    document.getElementById('btn-play-pause').addEventListener('click', togglePlayback);
    document.getElementById('btn-stop').addEventListener('click', () => {
      pausePlayback();
      setCurrentTime(0);
    });
    document.getElementById('btn-step-back').addEventListener('click', () => stepBySnap(-1));
    document.getElementById('btn-step-fwd').addEventListener('click', () => stepBySnap(1));
    document.getElementById('btn-tap-tempo').addEventListener('click', handleTapTempo);

    document.getElementById('snap-select').addEventListener('change', (e) => {
      state.snapDivisor = Number(e.target.value) || 0;
      renderTimelineCanvas();
    });

    document.getElementById('playback-rate-select').addEventListener('change', (e) => {
      state.playbackRate = Number(e.target.value) || 1.0;
      if (state.audioEl) state.audioEl.playbackRate = state.playbackRate;
    });

    document.getElementById('zoom-range').addEventListener('input', (e) => {
      state.zoomPxPerSec = Number(e.target.value) || 180;
      renderTimelineCanvas();
    });

    document.getElementById('check-hitsound').addEventListener('change', (e) => {
      state.hitsoundEnabled = e.target.checked;
    });
    document.getElementById('check-metronome').addEventListener('change', (e) => {
      state.metronomeEnabled = e.target.checked;
    });

    document.getElementById('btn-mirror-h').addEventListener('click', () => mirrorAllNotes('H'));
    document.getElementById('btn-mirror-v').addEventListener('click', () => mirrorAllNotes('V'));
    document.getElementById('btn-clear-notes').addEventListener('click', () => {
      if (!confirm('Очистить все ноты на карте?')) return;
      pushUndo();
      state.chart.notes = [];
      state.selectedItem = null;
      refreshAllViews();
    });

    document.getElementById('btn-add-timing-point').addEventListener('click', () => {
      pushUndo();
      state.chart.timing.push({
        time: roundTime(snapTime(state.currentTime)),
        bpm: state.chart.bpm || 120
      });
      sortChart();
      refreshAllViews();
    });

    document.getElementById('event-list-filter').addEventListener('change', renderEventsList);

    // 6. Взаимодействие с таймлайном мышью
    const tlCanvas = document.getElementById('timeline-canvas');
    tlCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    tlCanvas.addEventListener('mousedown', (e) => {
      const rect = tlCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (tlCanvas.width / rect.width);
      const my = (e.clientY - rect.top) * (tlCanvas.height / rect.height);
      const labelW = 118;
      const hit = hitTestTimeline(mx, my);
      if (hit && hit.kind === 'piano_label') {
        state.activeNoteType = hit.noteType;
        document.querySelectorAll('[data-note-type]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-note-type') === hit.noteType);
          b.classList.toggle('active-pill', b.getAttribute('data-note-type') === hit.noteType);
        });
        renderTimelineCanvas();
        setStatus(`Выбрана дорожка ноты: ${hit.noteType}`);
        return;
      }
      if (mx < labelW) return;

      // Правый клик — удаление ноты или события
      if (e.button === 2) {
        if (hit && (hit.kind === 'note' || hit.kind === 'event')) {
          state.selectedItem = hit;
          deleteSelectedItem();
        }
        return;
      }

      if (hit && (hit.kind === 'note' || hit.kind === 'event')) {
        pushUndo();
        state.selectedItem = hit;
        state.draggingItem = hit;
        setCurrentTime(hit.item.time);
        refreshAllViews();
        return;
      }

      // Одиночный клик в режиме Правки (draw) или двойной клик по дорожке нот — ставим ноту выбранного ряда Пиано-ролла
      if (hit && hit.kind === 'empty_note_lane' && (state.timelineTouchMode === 'draw' || e.detail >= 2)) {
        const clickedTime = e.shiftKey ? roundTime(xToTime(mx, labelW)) : snapTime(xToTime(mx, labelW));
        const targetType = hit.laneNoteType || state.activeNoteType;
        addOrReplaceNoteAt(clickedTime, targetType, state.timelineViewMode === 'pianoroll' || e.altKey || state.stackMode);
        return;
      }

      // Двойной клик по дорожке эффектов — ставим выбранное событие
      if (hit && hit.kind === 'empty_event_lane' && e.detail >= 2) {
        const clickedTime = snapTime(xToTime(mx, labelW));
        addEventFromForm(clickedTime);
        return;
      }

      // Иначе — перемотка курсора времени (Scrubbing)
      state.isScrubbing = true;
      const t = e.shiftKey ? xToTime(mx, labelW) : snapTime(xToTime(mx, labelW));
      setCurrentTime(t);
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.draggingItem && !state.isScrubbing) return;
      const rect = tlCanvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (tlCanvas.width / rect.width);
      const labelW = 118;
      const rawT = xToTime(mx, labelW);
      const newT = e.shiftKey ? roundTime(rawT) : snapTime(rawT);

      if (state.draggingItem) {
        const prevT = state.draggingItem.item.time;
        state.draggingItem.item.time = newT;
        if (state.draggingItem.kind === 'note' && (state.draggingItem.item.type === 'REVERSE' || state.draggingItem.item.type === 'REVERSE_BACK')) {
          syncReverseFlowEvent(prevT, newT, state.draggingItem.item.type, false);
        }
        sortChart();
        renderPreviewCanvas();
        renderTimelineCanvas();
        renderInspector();
        renderEventsList();
      } else if (state.isScrubbing) {
        setCurrentTime(newT);
      }
    });

    window.addEventListener('mouseup', () => {
      state.draggingItem = null;
      state.isScrubbing = false;
    });

    tlCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Зум таймлайна
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        state.zoomPxPerSec = Math.min(600, Math.max(40, Math.round(state.zoomPxPerSec * factor)));
        const zr = document.getElementById('zoom-range');
        if (zr) zr.value = String(state.zoomPxPerSec);
      } else {
        // Горизонтальный скролл
        state.timelineScrollX = Math.max(0, state.timelineScrollX + (e.deltaX || e.deltaY));
      }
      renderTimelineCanvas();
    }, { passive: false });

    // 7. Горячие клавиши клавиатуры
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
        return;
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (state.selectedItem) {
          e.preventDefault();
          deleteSelectedItem();
        }
        return;
      }

      if (e.code === 'BracketLeft') {
        e.preventDefault();
        stepBySnap(-1);
        return;
      }
      if (e.code === 'BracketRight') {
        e.preventDefault();
        stepBySnap(1);
        return;
      }

      // Быстрая расстановка нот с клавиатуры (WASD / стрелки / QEZC)
      const keyMap = {
        KeyW: 'UP', ArrowUp: 'UP',
        KeyS: 'DOWN', ArrowDown: 'DOWN',
        KeyA: 'LEFT', ArrowLeft: 'LEFT',
        KeyD: 'RIGHT', ArrowRight: 'RIGHT',
        KeyQ: 'UP_LEFT',
        KeyE: 'UP_RIGHT',
        KeyZ: 'DOWN_LEFT',
        KeyC: 'DOWN_RIGHT',
        KeyR: 'REVERSE',
        KeyF: 'REVERSE_BACK'
      };

      if (keyMap[e.code]) {
        e.preventDefault();
        const nType = keyMap[e.code];
        state.activeNoteType = nType;
        document.querySelectorAll('[data-note-type]').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-note-type') === nType);
          b.classList.toggle('active-pill', b.getAttribute('data-note-type') === nType);
        });
        const t = state.isPlaying ? state.currentTime : snapTime(state.currentTime);
        addOrReplaceNoteAt(t, nType);
        if (!state.isPlaying && e.shiftKey) {
          stepBySnap(1);
        }
      }
    });

    // 8. Встроенная библиотека всех 24 официальных карт из 3 плейлистов (Swipetava OST, RCGD VERS OST Vol.1 и Vol.2)
    const ostPlaylistFilter = document.getElementById('select-playlist-group') || document.getElementById('ost-playlist-filter');
    const ostSelect = document.getElementById('select-ost-preset') || document.getElementById('ost-preset-select');
    const btnLoadOst = document.getElementById('btn-load-ost-preset');

    const allPlaylistSongs = [];
    if (typeof PLAYLISTS_BUNDLE !== 'undefined' && PLAYLISTS_BUNDLE && PLAYLISTS_BUNDLE.playlists) {
      for (const [plId, plObj] of Object.entries(PLAYLISTS_BUNDLE.playlists)) {
        for (const [songKey, songData] of Object.entries(plObj.songs || {})) {
          allPlaylistSongs.push({
            uid: `${plId}:::${songKey}`,
            playlistId: plId,
            playlistLabel: plObj.label || plId,
            songKey,
            data: songData
          });
        }
      }
    }

    function populatePlaylistSelect() {
      if (!ostSelect) return;
      const filterPl = ostPlaylistFilter ? ostPlaylistFilter.value : 'ALL';
      const filtered = allPlaylistSongs.filter(item => filterPl === 'ALL' || item.playlistId === filterPl);
      ostSelect.innerHTML = filtered.map(item => {
        const m = item.data.meta || {};
        const c = item.data.chart || {};
        const nLen = Array.isArray(c.notes) ? c.notes.length : 0;
        const eLen = Array.isArray(c.events) ? c.events.length : 0;
        const bpm = c.bpm || 120;
        const title = m.title || item.songKey;
        const artist = m.artist || item.playlistId;
        const isHiTech = item.songKey === 'Hi-Tech';
        return `<option value="${escapeHtml(item.uid)}" ${isHiTech ? 'selected' : ''}>[${escapeHtml(item.playlistId)}] ${escapeHtml(title)} — ${escapeHtml(artist)} (${bpm} BPM · ${nLen} нот · ${eLen} ив.)</option>`;
      }).join('');
    }

    if (ostPlaylistFilter) {
      const plIds = Object.keys((PLAYLISTS_BUNDLE && PLAYLISTS_BUNDLE.playlists) || {});
      ostPlaylistFilter.innerHTML = `<option value="ALL">Все 3 плейлиста (${allPlaylistSongs.length} карт)</option>` +
        plIds.map(pid => {
          const plObj = PLAYLISTS_BUNDLE.playlists[pid];
          const cnt = Object.keys((plObj && plObj.songs) || {}).length;
          return `<option value="${escapeHtml(pid)}">${escapeHtml(plObj.label || pid)} (${cnt})</option>`;
        }).join('');
      ostPlaylistFilter.addEventListener('change', populatePlaylistSelect);
    }
    populatePlaylistSelect();

    const btnExportOst = document.getElementById('btn-export-selected-ost');
    if (btnExportOst && ostSelect) {
      btnExportOst.addEventListener('click', async () => {
        await loadOfficialPlaylistSong(ostSelect.value);
        await exportSwmapArchive();
      });
    }

    document.querySelectorAll('[data-nudge-ms]').forEach(btn => {
      btn.addEventListener('click', () => {
        const deltaSec = (Number(btn.getAttribute('data-nudge-ms')) || 0) / 1000;
        if (state.selectedItem && state.selectedItem.item) {
          pushUndo();
          const it = state.selectedItem.item;
          const prevT = it.time;
          it.time = roundTime(Math.max(0, it.time + deltaSec));
          if (state.selectedItem.kind === 'note' && (it.type === 'REVERSE' || it.type === 'REVERSE_BACK')) {
            syncReverseFlowEvent(prevT, it.time, it.type, false);
          }
          sortChart();
          refreshAllViews();
          setStatus(`Сдвиг на ${deltaSec > 0 ? '+' : ''}${(deltaSec * 1000).toFixed(0)} мс -> ${it.time.toFixed(3)} сек`);
        } else {
          setCurrentTime(roundTime(Math.max(0, state.currentTime + deltaSec)));
        }
      });
    });

    const btnMobDel = document.getElementById('btn-mob-del-selected');
    if (btnMobDel) {
      btnMobDel.addEventListener('click', deleteSelectedItem);
    }

    async function dataUriToUint8Array(dataUri) {
      const resp = await fetch(dataUri);
      const buf = await resp.arrayBuffer();
      return new Uint8Array(buf);
    }

    async function loadOfficialPlaylistSong(uid) {
      const entry = allPlaylistSongs.find(x => x.uid === uid) || allPlaylistSongs[0];
      if (!entry) return;
      pushUndo();

      const song = JSON.parse(JSON.stringify(entry.data));
      const m = song.meta || {};
      const ch = song.chart || {};

      state.meta = {
        title: m.title || ch.title || entry.songKey,
        artist: m.artist || ch.artist || entry.playlistId,
        difficulty: (m.difficulty !== undefined && m.difficulty !== null) ? Number(m.difficulty) : 5,
        menu_color: m.menu_color || '#2a0a5e'
      };

      state.chart = {
        bpm: Number(ch.bpm) || 120,
        noteTravelTime: Number(ch.noteTravelTime) || 1000,
        gridOffset: Number(ch.gridOffset) || 0,
        timing: Array.isArray(ch.timing) && ch.timing.length
          ? ch.timing
          : [{ time: Number(ch.gridOffset) || 0, bpm: Number(ch.bpm) || 120 }],
        title: ch.title || state.meta.title,
        artist: ch.artist || state.meta.artist,
        notes: Array.isArray(ch.notes) ? ch.notes : [],
        events: Array.isArray(ch.events) ? ch.events : [],
        audioFile: ch.audioFile || 'track.ogg',
        audioFormat: ch.audioFormat || 'ogg',
        coverFile: ch.coverFile || 'Cover.png',
        backgroundFile: ch.backgroundFile || 'bg.png'
      };

      sortChart();
      let maxT = 30;
      for (const n of state.chart.notes) if (n.time > maxT) maxT = n.time;
      for (const ev of state.chart.events) if ((ev.time + (ev.duration || 0)) > maxT) maxT = ev.time + (ev.duration || 0);
      state.duration = maxT + 5;

      state.selectedItem = null;
      state.timelineScrollX = 0;
      syncMetaAndChartInputs();
      setCurrentTime(0);

      // Подгружаем встроенную обложку и фон из PLAYLISTS_BUNDLE.sharedImages
      const sharedImgs = (PLAYLISTS_BUNDLE && PLAYLISTS_BUNDLE.sharedImages) || {};
      if (song.coverRef && sharedImgs[song.coverRef]) {
        try {
          const covBytes = await dataUriToUint8Array(sharedImgs[song.coverRef]);
          await loadImageFromBytes(covBytes, 'cover', state.chart.coverFile || 'Cover.png');
        } catch (_) {}
      }
      if (song.bgRef && sharedImgs[song.bgRef]) {
        try {
          const bgBytes = await dataUriToUint8Array(sharedImgs[song.bgRef]);
          await loadImageFromBytes(bgBytes, 'bg', state.chart.backgroundFile || 'bg.png');
        } catch (_) {}
      }

      // Пробуем подгрузить аудиофайл песни из папки ./charts/<Плейлист>/<Папка>/<audioFile>
      let audioLoaded = false;
      if (song.audioPath && window.location && window.location.protocol !== 'file:') {
        try {
          const encodedUrl = song.audioPath.split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
          const resp = await fetch(encodedUrl);
          if (resp.ok) {
            const buf = await resp.arrayBuffer();
            await loadAudioFromBytes(new Uint8Array(buf), state.chart.audioFile);
            audioLoaded = true;
          }
        } catch (_) {}
      }

      refreshAllViews();
      setStatus(
        `Загружена карта «${state.meta.title}» (${entry.playlistId}) — ${state.chart.notes.length} нот, ${state.chart.events.length} событий` +
        (audioLoaded ? ', трек загружен!' : '')
      );
    }

    if (btnLoadOst && ostSelect) {
      btnLoadOst.addEventListener('click', () => loadOfficialPlaylistSong(ostSelect.value));
    }

    // 9. Кастомная скорость проигрывания превью (0.25x + произвольный ввод) и кастомный NOTE_SPEED
    const customRateInput = document.getElementById('custom-playback-rate') || document.getElementById('playback-rate-custom');
    const btnApplyCustomRate = document.getElementById('btn-apply-custom-rate');
    const applyCustomPlaybackRate = (val) => {
      const rate = Math.min(4.0, Math.max(0.1, Number(val) || 1.0));
      state.playbackRate = rate;
      if (state.audioEl) state.audioEl.playbackRate = rate;
      if (customRateInput) customRateInput.value = String(rate);
      setStatus(`Скорость проигрывания превью: ${rate}x`);
    };

    const rateSelect = document.getElementById('playback-rate-select');
    if (rateSelect) {
      rateSelect.addEventListener('change', (e) => applyCustomPlaybackRate(e.target.value));
    }
    if (btnApplyCustomRate && customRateInput) {
      btnApplyCustomRate.addEventListener('click', () => applyCustomPlaybackRate(customRateInput.value));
      customRateInput.addEventListener('change', () => applyCustomPlaybackRate(customRateInput.value));
    }

    const btnAddCustomSpeed = document.getElementById('btn-apply-custom-note-speed') || document.getElementById('btn-add-custom-speed');
    const customNoteSpeedVal = document.getElementById('custom-note-speed-input') || document.getElementById('custom-note-speed-val');
    if (btnAddCustomSpeed && customNoteSpeedVal) {
      btnAddCustomSpeed.addEventListener('click', () => {
        const spd = Math.min(10.0, Math.max(0.1, Number(customNoteSpeedVal.value) || 1.0));
        const t = roundTime(snapTime(state.currentTime));
        pushUndo();
        const existing = state.chart.events.find(e => e.type === 'NOTE_SPEED' && Math.abs(e.time - t) < 0.008);
        if (existing) {
          existing.speed = spd;
          state.selectedItem = { kind: 'event', item: existing };
        } else {
          const ev = { time: t, type: 'NOTE_SPEED', speed: spd };
          state.chart.events.push(ev);
          sortChart();
          state.selectedItem = { kind: 'event', item: ev };
        }
        refreshAllViews();
        setStatus(`Поставлен кастомный NOTE_SPEED = ${spd}x на ${t.toFixed(3)} сек`);
      });
    }

    // 10. Кнопки аналитики NPS, Авто-BPM, Валидатора, Стак-режима и Живой записи (REC)
    const btnApplyAutoStars = document.getElementById('btn-apply-auto-difficulty') || document.getElementById('btn-apply-auto-stars');
    if (btnApplyAutoStars) {
      btnApplyAutoStars.addEventListener('click', () => {
        const st = state.lastStats || computeChartDifficultyStats();
        const rounded = Math.max(0.5, Math.round(st.autoStars * 2) / 2);
        pushUndo();
        state.meta.difficulty = rounded;
        syncMetaAndChartInputs();
        refreshAllViews();
        setStatus(`Сложность в meta.json установлена по расчёту плотности: ${rounded} ★ (${st.sdpPoints.toFixed(1)} pts)`);
      });
    }

    const npsCanvas = document.getElementById('nps-chart-canvas');
    if (npsCanvas) {
      npsCanvas.addEventListener('click', (e) => {
        const rect = npsCanvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (npsCanvas.width / rect.width);
        const padL = 28, padR = 10;
        const plotW = Math.max(10, npsCanvas.width - padL - padR);
        const ratio = Math.min(1, Math.max(0, (mx - padL) / plotW));
        const binsLen = (state.lastStats && state.lastStats.secBins && state.lastStats.secBins.length) || state.duration || 60;
        setCurrentTime(roundTime(ratio * binsLen));
      });
    }

    const btnAutoBpm = document.getElementById('btn-auto-bpm');
    if (btnAutoBpm) btnAutoBpm.addEventListener('click', autoDetectBpmAndOffset);

    const btnValidateChart = document.getElementById('btn-validate-chart');
    if (btnValidateChart) btnValidateChart.addEventListener('click', runChartValidator);

    const checkStackMode = document.getElementById('note-stack-mode-check') || document.getElementById('check-stack-mode');
    if (checkStackMode) {
      checkStackMode.addEventListener('change', (e) => {
        state.stackMode = e.target.checked;
        setStatus(state.stackMode
          ? 'Стак-режим включён: новые ноты на том же таймкоде складываются в вертикальный стак'
          : 'Стак-режим выключен: нота на том же таймкоде заменяет предыдущую (в Пиано-ролле стаки доступны всегда)');
      });
    }

    const btnToggleRec = document.getElementById('btn-rec-mode') || document.getElementById('btn-toggle-rec');
    if (btnToggleRec) {
      btnToggleRec.addEventListener('click', () => {
        state.recMode = !state.recMode;
        btnToggleRec.classList.toggle('rec-btn-active', state.recMode);
        btnToggleRec.textContent = state.recMode ? '🔴 ЗАПИСЬ ВКЛ' : '🔴 Запись (REC)';
        setStatus(state.recMode
          ? 'Режим живой записи включён: запусти трек и нажимай кнопки направлений (или клавиши WASD/стрелки) в такт!'
          : 'Режим живой записи выключен');
      });
    }

    // 11. Переключатели режима дорожки (10-рядный Пиано-ролл / Компактный 1 ряд) и Тач-инструментов (Правка / Прокрутка / Ластик)
    document.querySelectorAll('[data-tl-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timelineViewMode = btn.getAttribute('data-tl-view') || 'pianoroll';
        document.querySelectorAll('[data-tl-view]').forEach(b => b.classList.toggle('active', b === btn));
        renderTimelineCanvas();
      });
    });

    document.querySelectorAll('[data-touch-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timelineTouchMode = btn.getAttribute('data-touch-mode') || 'draw';
        document.querySelectorAll('[data-touch-mode]').forEach((b) => b.classList.toggle('active', b === btn));
        const titles = {
          draw: 'Правка (тап по ряду в Пиано-ролле сразу ставит/убирает ноту или собирает стак)',
          scroll: 'Прокрутка (1 палец — двигать дорожку, 2 пальца — зум)',
          erase: 'Ластик (тап по ноте или событию удаляет его)'
        };
        setStatus(`Режим таймлайна: ${titles[state.timelineTouchMode] || state.timelineTouchMode}`);
      });
    });

    if (tlCanvas) {
      let tGesture = {
        mode: null,
        startX: 0,
        startY: 0,
        startScrollX: 0,
        moved: false,
        pinchDist: 0,
        pinchZoom: 180,
        pinchTime: 0
      };

      const touchCanvasCoords = (touch) => {
        const rect = tlCanvas.getBoundingClientRect();
        return {
          mx: (touch.clientX - rect.left) * (tlCanvas.width / rect.width),
          my: (touch.clientY - rect.top) * (tlCanvas.height / rect.height)
        };
      };

      tlCanvas.addEventListener('touchstart', (e) => {
        const labelW = 118;
        if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          tGesture.mode = 'pinch';
          tGesture.pinchDist = Math.hypot(dx, dy) || 1;
          tGesture.pinchZoom = state.zoomPxPerSec;
          const p0 = touchCanvasCoords(e.touches[0]);
          const p1 = touchCanvasCoords(e.touches[1]);
          const midX = (p0.mx + p1.mx) * 0.5;
          tGesture.pinchTime = xToTime(midX, labelW);
          return;
        }
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const { mx, my } = touchCanvasCoords(e.touches[0]);
        tGesture.startX = mx;
        tGesture.startY = my;
        tGesture.startScrollX = state.timelineScrollX;
        tGesture.moved = false;

        const hit = hitTestTimeline(mx, my);
        if (hit && hit.kind === 'piano_label') {
          state.activeNoteType = hit.noteType;
          document.querySelectorAll('[data-note-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-note-type') === hit.noteType);
            b.classList.toggle('active-pill', b.getAttribute('data-note-type') === hit.noteType);
          });
          renderTimelineCanvas();
          return;
        }
        if (mx < labelW) return;

        const tappedTime = snapTime(xToTime(mx, labelW));

        if (state.timelineTouchMode === 'erase') {
          if (hit && (hit.kind === 'note' || hit.kind === 'event')) {
            state.selectedItem = hit;
            deleteSelectedItem();
          }
          return;
        }

        if (state.timelineTouchMode === 'draw') {
          if (hit && (hit.kind === 'note' || hit.kind === 'event')) {
            pushUndo();
            state.selectedItem = hit;
            state.draggingItem = hit;
            setCurrentTime(hit.item.time);
            refreshAllViews();
            tGesture.mode = 'drag_item';
          } else if (hit && hit.kind === 'empty_note_lane') {
            const targetType = hit.laneNoteType || state.activeNoteType;
            addOrReplaceNoteAt(tappedTime, targetType, state.timelineViewMode === 'pianoroll' || state.stackMode);
            setCurrentTime(tappedTime);
          } else if (hit && hit.kind === 'empty_event_lane') {
            addEventFromForm(tappedTime);
            setCurrentTime(tappedTime);
          } else {
            setCurrentTime(tappedTime);
          }
          return;
        }

        if (my < 30) {
          tGesture.mode = 'scrub';
          setCurrentTime(tappedTime);
        } else {
          tGesture.mode = 'pan';
          if (hit && (hit.kind === 'note' || hit.kind === 'event')) {
            state.selectedItem = hit;
            renderInspector();
            renderTimelineCanvas();
          }
        }
      }, { passive: false });

      tlCanvas.addEventListener('touchmove', (e) => {
        const labelW = 118;
        if (tGesture.mode === 'pinch' && e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy) || 1;
          const newZoom = Math.min(600, Math.max(40, Math.round(tGesture.pinchZoom * (dist / tGesture.pinchDist))));
          state.zoomPxPerSec = newZoom;
          const zr = document.getElementById('zoom-range');
          if (zr) zr.value = String(newZoom);
          const p0 = touchCanvasCoords(e.touches[0]);
          const p1 = touchCanvasCoords(e.touches[1]);
          const midX = (p0.mx + p1.mx) * 0.5;
          state.timelineScrollX = Math.max(0, tGesture.pinchTime * newZoom - (midX - labelW));
          renderTimelineCanvas();
          return;
        }
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const { mx } = touchCanvasCoords(e.touches[0]);
        const deltaX = mx - tGesture.startX;
        if (Math.abs(deltaX) > 6) tGesture.moved = true;

        if (tGesture.mode === 'drag_item' && state.draggingItem) {
          const prevT = state.draggingItem.item.time;
          const newT = snapTime(xToTime(mx, labelW));
          state.draggingItem.item.time = newT;
          if (state.draggingItem.kind === 'note' && (state.draggingItem.item.type === 'REVERSE' || state.draggingItem.item.type === 'REVERSE_BACK')) {
            syncReverseFlowEvent(prevT, newT, state.draggingItem.item.type, false);
          }
          sortChart();
          renderPreviewCanvas();
          renderTimelineCanvas();
          renderInspector();
          renderEventsList();
        } else if (tGesture.mode === 'scrub') {
          setCurrentTime(snapTime(xToTime(mx, labelW)));
        } else if (tGesture.mode === 'pan') {
          state.timelineScrollX = Math.max(0, tGesture.startScrollX - deltaX);
          renderTimelineCanvas();
        }
      }, { passive: false });

      tlCanvas.addEventListener('touchend', () => {
        if (tGesture.mode === 'pan' && !tGesture.moved && state.timelineTouchMode === 'scroll') {
          const t = snapTime(xToTime(tGesture.startX, 118));
          setCurrentTime(t);
        }
        tGesture.mode = null;
        state.draggingItem = null;
      });
    }

    // 12. Вкладочный GUI для мобильных браузеров + переключатель «Вкладки / Плитки (ПК)»
    const resizeTimeline = () => {
      const wrap = document.getElementById('timeline-wrap');
      if (wrap && tlCanvas) {
        tlCanvas.width = Math.max(360, wrap.clientWidth);
        renderTimelineCanvas();
      }
      renderNpsAnalytics();
      renderPreviewCanvas();
    };

    document.querySelectorAll('[data-app-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-app-tab') || 'preview';
        document.querySelectorAll('[data-app-tab]').forEach(b => b.classList.toggle('active', b === btn));
        document.body.setAttribute('data-active-tab', tab);
        setTimeout(resizeTimeline, 20);
      });
    });

    const btnToggleLayout = document.getElementById('btn-toggle-layout-mode') || document.getElementById('btn-toggle-layout');
    const applyResponsiveDefaultLayout = () => {
      if (window.innerWidth <= 980) {
        document.body.setAttribute('data-layout-mode', 'tabs');
      }
    };
    if (window.innerWidth <= 980) {
      document.body.setAttribute('data-layout-mode', 'tabs');
    } else {
      document.body.setAttribute('data-layout-mode', 'grid');
    }
    if (!document.body.getAttribute('data-active-tab')) {
      document.body.setAttribute('data-active-tab', 'preview');
    }

    if (btnToggleLayout) {
      const updateLayoutBtnText = () => {
        const isTabs = document.body.getAttribute('data-layout-mode') === 'tabs';
        btnToggleLayout.textContent = isTabs ? '📐 Вид: Вкладки (Мобильный)' : '📐 Вид: Плитки (ПК)';
      };
      updateLayoutBtnText();
      btnToggleLayout.addEventListener('click', () => {
        const cur = document.body.getAttribute('data-layout-mode');
        document.body.setAttribute('data-layout-mode', cur === 'tabs' ? 'grid' : 'tabs');
        updateLayoutBtnText();
        setTimeout(resizeTimeline, 25);
      });
    }

    window.addEventListener('resize', () => {
      applyResponsiveDefaultLayout();
      resizeTimeline();
    });
    setTimeout(resizeTimeline, 30);

    // --- Иконка в шапке с шансом 1/50 при обновлении страницы и окно с кнопкой cubeface ---
    const brandBadge = document.getElementById('brand-badge');
    const cubefaceModal = document.getElementById('cubeface-modal');
    const closeCubefaceBtn = document.getElementById('btn-close-cubeface-modal');
    const cubefaceBtn = document.getElementById('btn-cubeface');
    const cubefaceImg = document.getElementById('cubeface-img');

    if (cubefaceImg && CUBEFACE_IMG_DATA_URI) {
      cubefaceImg.src = CUBEFACE_IMG_DATA_URI;
    }

    let vernamAudio = null;
    const playVernamSound = () => {
      try {
        if (!vernamAudio) {
          vernamAudio = new Audio(VERNAM_AUDIO_DATA_URI || './vernam.ogg');
        }
        vernamAudio.currentTime = 0;
        vernamAudio.play().catch(() => {});
      } catch (_) {}
    };

    const isRobtopRoll = (Math.floor(Math.random() * 50) === 0);
    if (brandBadge && isRobtopRoll) {
      brandBadge.classList.add('robtop-mode');
      brandBadge.innerHTML = `<img src="${ROBTOP_ICON_DATA_URI}" alt="RT" />`;
      brandBadge.addEventListener('click', () => {
        if (cubefaceModal) {
          cubefaceModal.hidden = false;
        }
      });
    }

    if (cubefaceBtn) {
      cubefaceBtn.addEventListener('click', () => {
        cubefaceBtn.classList.add('pressed');
        setTimeout(() => cubefaceBtn.classList.remove('pressed'), 120);
        playVernamSound();
      });
    }

    if (closeCubefaceBtn && cubefaceModal) {
      closeCubefaceBtn.addEventListener('click', () => {
        cubefaceModal.hidden = true;
      });
    }

    if (cubefaceModal) {
      cubefaceModal.addEventListener('click', (e) => {
        if (e.target === cubefaceModal) {
          cubefaceModal.hidden = true;
        }
      });
    }

    // Загружаем стартовый демо-шаблон
    loadDemoShowcaseChart();
    requestAnimationFrame(animationLoop);
  }

  window.addEventListener('DOMContentLoaded', initUI);
})();
