/**
 * editor.js
 * Основной движок веб-редактора карт Swipetava (.swmap)
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
    // Специальные реверс-ноты из pizdydal.swmap и тизера редактора
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
      desc: 'Меняет цвет фона карты: при duration = 0 мгновенно, при duration > 0 плавно переливает к выбранному цвету (используется в 10 картах Swipetava OST)'
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
      id: 'FX_ENDING',
      cat: 'fx',
      label: 'FX_ENDING (Кинематографичный финал / интро)',
      short: 'FX_ENDING',
      color: '#818cf8',
      hasDuration: true,
      defaultDuration: 4.8,
      desc: 'Эффект интро/концовки с кинематографичными полосами и виньеткой (из pizdydal.swmap)'
    }
  ];

  const EVENT_MAP = {};
  for (const ed of EVENT_DEFS) EVENT_MAP[ed.id] = ed;

  // --- Состояние проекта ---
  const OST_PRESETS = {"11 lifes":{"meta":{"title":"11 lifes","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":100,"noteTravelTime":1000,"gridOffset":0.343,"timing":[{"time":0.343,"bpm":100}],"notes":[{"time":0.193,"type":"UP"},{"time":0.793,"type":"DOWN"},{"time":1.393,"type":"UP"},{"time":1.993,"type":"DOWN"},{"time":2.593,"type":"UP"},{"time":3.193,"type":"DOWN"},{"time":3.793,"type":"UP"},{"time":4.393,"type":"DOWN"},{"time":4.993,"type":"RIGHT"},{"time":5.593,"type":"LEFT"},{"time":6.193,"type":"RIGHT"},{"time":6.793,"type":"LEFT"},{"time":7.393,"type":"UP"},{"time":7.993,"type":"DOWN"},{"time":8.593,"type":"UP"},{"time":9.193,"type":"DOWN"},{"time":9.793,"type":"LEFT"},{"time":10.393,"type":"RIGHT"},{"time":10.993,"type":"LEFT"},{"time":11.593,"type":"RIGHT"},{"time":12.193,"type":"LEFT"},{"time":12.793,"type":"RIGHT"},{"time":13.393,"type":"LEFT"},{"time":13.993,"type":"RIGHT"},{"time":14.593,"type":"UP"},{"time":15.193,"type":"DOWN"},{"time":15.793,"type":"LEFT"},{"time":16.393,"type":"RIGHT"},{"time":16.993,"type":"UP"},{"time":17.593,"type":"DOWN"},{"time":18.193,"type":"UP"},{"time":18.793,"type":"DOWN"},{"time":19.093,"type":"RIGHT"},{"time":19.693,"type":"LEFT"},{"time":20.293,"type":"RIGHT"},{"time":20.893,"type":"LEFT"},{"time":21.493,"type":"RIGHT"},{"time":22.093,"type":"UP"},{"time":22.693,"type":"DOWN"},{"time":23.293,"type":"UP"},{"time":23.593,"type":"DOWN"},{"time":23.893,"type":"RIGHT"},{"time":24.493,"type":"UP"},{"time":25.093,"type":"DOWN"},{"time":25.693,"type":"UP"},{"time":26.293,"type":"DOWN"},{"time":26.893,"type":"RIGHT"},{"time":27.493,"type":"LEFT"},{"time":28.093,"type":"LEFT"},{"time":28.393,"type":"RIGHT"},{"time":28.693,"type":"LEFT"},{"time":29.293,"type":"LEFT"},{"time":29.893,"type":"RIGHT"},{"time":30.493,"type":"UP"},{"time":31.093,"type":"DOWN"},{"time":31.693,"type":"UP"},{"time":31.993,"type":"DOWN"},{"time":32.293,"type":"RIGHT"},{"time":32.893,"type":"UP"},{"time":33.493,"type":"DOWN"},{"time":34.093,"type":"UP"},{"time":34.693,"type":"DOWN"},{"time":35.293,"type":"RIGHT"},{"time":35.893,"type":"LEFT"},{"time":36.493,"type":"RIGHT"},{"time":36.793,"type":"LEFT"},{"time":37.093,"type":"RIGHT"},{"time":37.393,"type":"UP"},{"time":37.693,"type":"DOWN"},{"time":37.993,"type":"UP"},{"time":38.893,"type":"UP"},{"time":40.093,"type":"DOWN"},{"time":41.293,"type":"RIGHT"},{"time":42.493,"type":"LEFT"},{"time":43.693,"type":"DOWN"},{"time":44.893,"type":"UP"},{"time":46.093,"type":"LEFT"},{"time":47.293,"type":"RIGHT"},{"time":48.493,"type":"UP"},{"time":49.693,"type":"DOWN"},{"time":50.893,"type":"RIGHT"},{"time":52.093,"type":"LEFT"},{"time":53.293,"type":"DOWN"},{"time":54.493,"type":"UP"},{"time":55.693,"type":"LEFT"},{"time":56.893,"type":"RIGHT"},{"time":57.493,"type":"UP"},{"time":58.093,"type":"UP"},{"time":58.693,"type":"DOWN"},{"time":59.293,"type":"DOWN"},{"time":59.893,"type":"UP"},{"time":60.493,"type":"UP"},{"time":61.093,"type":"DOWN"},{"time":61.693,"type":"DOWN"},{"time":62.293,"type":"LEFT"},{"time":62.893,"type":"LEFT"},{"time":63.493,"type":"RIGHT"},{"time":64.093,"type":"RIGHT"},{"time":64.693,"type":"LEFT"},{"time":65.293,"type":"LEFT"},{"time":65.893,"type":"RIGHT"},{"time":66.493,"type":"RIGHT"},{"time":67.093,"type":"RIGHT"},{"time":67.693,"type":"LEFT"},{"time":68.293,"type":"RIGHT"},{"time":68.893,"type":"LEFT"},{"time":69.493,"type":"RIGHT"},{"time":70.093,"type":"UP"},{"time":70.693,"type":"DOWN"},{"time":71.293,"type":"UP"},{"time":71.593,"type":"DOWN"},{"time":71.893,"type":"RIGHT"},{"time":72.493,"type":"UP"},{"time":73.093,"type":"DOWN"},{"time":73.693,"type":"UP"},{"time":74.293,"type":"DOWN"},{"time":74.893,"type":"RIGHT"},{"time":75.493,"type":"LEFT"},{"time":76.093,"type":"LEFT"},{"time":76.393,"type":"RIGHT"},{"time":76.693,"type":"LEFT"},{"time":77.293,"type":"LEFT"},{"time":77.893,"type":"RIGHT"},{"time":78.493,"type":"UP"},{"time":79.093,"type":"DOWN"},{"time":79.693,"type":"UP"},{"time":79.993,"type":"DOWN"},{"time":80.293,"type":"RIGHT"},{"time":80.893,"type":"UP"},{"time":81.493,"type":"DOWN"},{"time":82.093,"type":"UP"},{"time":82.693,"type":"DOWN"},{"time":83.293,"type":"RIGHT"},{"time":83.893,"type":"LEFT"},{"time":84.493,"type":"RIGHT"},{"time":84.793,"type":"LEFT"},{"time":85.093,"type":"RIGHT"},{"time":85.393,"type":"UP"},{"time":85.693,"type":"DOWN"},{"time":85.993,"type":"UP"},{"time":86.293,"type":"UP"},{"time":86.893,"type":"UP"},{"time":88.093,"type":"DOWN"},{"time":89.293,"type":"RIGHT"},{"time":90.493,"type":"LEFT"},{"time":91.693,"type":"DOWN"},{"time":92.893,"type":"UP"},{"time":94.093,"type":"LEFT"},{"time":95.293,"type":"RIGHT"},{"time":96.493,"type":"UP"},{"time":97.693,"type":"DOWN"},{"time":98.893,"type":"RIGHT"},{"time":100.093,"type":"LEFT"},{"time":101.293,"type":"DOWN"},{"time":102.493,"type":"UP"},{"time":103.693,"type":"LEFT"},{"time":104.893,"type":"RIGHT"}],"events":[{"time":3.793,"type":"FLASH","duration":0.9},{"time":8.593,"type":"FLASH","duration":0.9},{"time":13.393,"type":"FLASH","duration":0.9},{"time":14.593,"type":"BG_COLOR","duration":4.5,"color":"#000928"},{"time":18.343,"type":"FLASH","duration":0.9},{"time":19.243,"type":"CAMERA_BOB_ON"},{"time":21.943,"type":"FLASH","duration":2.1},{"time":37.393,"type":"FLASH","duration":0.6},{"time":37.993,"type":"BG_COLOR","color":"#000928"},{"time":37.993,"type":"BG_COLOR","duration":5.1,"color":"#62a0ea"},{"time":41.143,"type":"FLASH","duration":1.95},{"time":43.093,"type":"BG_COLOR","color":"#000928"},{"time":43.093,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":45.943,"type":"FLASH","duration":1.95},{"time":47.893,"type":"BG_COLOR","color":"#000928"},{"time":47.893,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":50.743,"type":"FLASH","duration":1.95},{"time":52.693,"type":"BG_COLOR","color":"#000928"},{"time":52.693,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":55.543,"type":"FLASH","duration":1.95},{"time":57.493,"type":"BG_COLOR","color":"#000928"},{"time":57.943,"type":"BG_COLOR","duration":7.2,"color":"#62a0ea"},{"time":65.143,"type":"BG_COLOR","duration":7.2,"color":"#000928"},{"time":72.343,"type":"BG_COLOR","duration":7.2,"color":"#62a0ea"},{"time":79.543,"type":"BG_COLOR","duration":6.75,"color":"#000928"},{"time":85.243,"type":"FLASH","duration":1.05},{"time":86.293,"type":"BG_COLOR","color":"#000928"},{"time":86.293,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":89.743,"type":"FLASH","duration":1.35},{"time":91.093,"type":"BG_COLOR","color":"#000928"},{"time":91.093,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":94.543,"type":"FLASH","duration":1.35},{"time":95.893,"type":"BG_COLOR","color":"#000928"},{"time":95.893,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":99.343,"type":"FLASH","duration":1.35},{"time":100.693,"type":"BG_COLOR","color":"#000928"},{"time":100.693,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":104.443,"type":"FLASH","duration":1.05},{"time":105.493,"type":"BG_COLOR","duration":4.8,"color":"#62a0ea"},{"time":105.493,"type":"BG_COLOR","color":"#000928"}],"audioFile":"track.ogg","audioFormat":"ogg"}},"CPAMOTA":{"meta":{"title":"CPAMOTA","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":140,"noteTravelTime":1000,"notes":[{"time":0.014,"type":"UP"},{"time":0.443,"type":"DOWN"},{"time":0.871,"type":"UP"},{"time":1.3,"type":"DOWN"},{"time":1.728,"type":"RIGHT"},{"time":2.157,"type":"LEFT"},{"time":2.585,"type":"RIGHT"},{"time":3.014,"type":"LEFT"},{"time":3.443,"type":"UP"},{"time":3.872,"type":"DOWN"},{"time":4.3,"type":"UP"},{"time":4.729,"type":"DOWN"},{"time":5.157,"type":"RIGHT"},{"time":5.586,"type":"LEFT"},{"time":6.014,"type":"RIGHT"},{"time":6.443,"type":"LEFT"},{"time":6.871,"type":"UP"},{"time":7.3,"type":"UP"},{"time":7.728,"type":"UP"},{"time":8.157,"type":"UP"},{"time":8.585,"type":"UP"},{"time":9.014,"type":"DOWN"},{"time":9.657,"type":"DOWN"},{"time":10.3,"type":"DOWN"},{"time":10.943,"type":"DOWN"},{"time":11.3,"type":"DOWN"},{"time":12.014,"type":"DOWN"},{"time":13.3,"type":"UP"},{"time":13.514,"type":"UP"},{"time":13.728,"type":"UP"},{"time":13.943,"type":"RIGHT"},{"time":14.157,"type":"DOWN"},{"time":14.371,"type":"RIGHT"},{"time":14.585,"type":"UP"},{"time":14.8,"type":"DOWN"},{"time":15.014,"type":"RIGHT"},{"time":15.228,"type":"UP"},{"time":15.443,"type":"DOWN"},{"time":15.657,"type":"UP"},{"time":15.871,"type":"DOWN"},{"time":16.085,"type":"UP"},{"time":16.3,"type":"DOWN"},{"time":16.514,"type":"UP"},{"time":16.728,"type":"RIGHT"},{"time":16.943,"type":"LEFT"},{"time":17.157,"type":"UP"},{"time":17.371,"type":"UP_RIGHT"},{"time":17.585,"type":"DOWN"},{"time":17.8,"type":"DOWN_RIGHT"},{"time":18.014,"type":"UP"},{"time":18.228,"type":"UP_RIGHT"},{"time":18.442,"type":"DOWN"},{"time":18.657,"type":"DOWN_RIGHT"},{"time":18.871,"type":"UP"},{"time":19.085,"type":"DOWN"},{"time":19.3,"type":"LEFT"},{"time":19.514,"type":"RIGHT"},{"time":19.728,"type":"UP"},{"time":19.943,"type":"UP"},{"time":20.157,"type":"DOWN"},{"time":20.371,"type":"DOWN"},{"time":20.585,"type":"REVERSE"},{"time":20.8,"type":"UP"},{"time":21.015,"type":"RIGHT"},{"time":21.229,"type":"DOWN"},{"time":21.443,"type":"RIGHT"},{"time":21.657,"type":"UP"},{"time":21.872,"type":"DOWN"},{"time":22.086,"type":"RIGHT"},{"time":22.3,"type":"UP"},{"time":22.515,"type":"DOWN"},{"time":22.729,"type":"UP"},{"time":22.943,"type":"DOWN"},{"time":23.157,"type":"UP"},{"time":23.372,"type":"DOWN"},{"time":23.586,"type":"UP"},{"time":23.8,"type":"RIGHT"},{"time":24.015,"type":"LEFT"},{"time":24.229,"type":"UP"},{"time":24.443,"type":"UP_RIGHT"},{"time":24.657,"type":"DOWN"},{"time":24.872,"type":"DOWN_RIGHT"},{"time":25.086,"type":"UP"},{"time":25.3,"type":"UP_RIGHT"},{"time":25.514,"type":"DOWN"},{"time":25.729,"type":"DOWN_RIGHT"},{"time":25.943,"type":"UP"},{"time":26.157,"type":"DOWN"},{"time":26.372,"type":"LEFT"},{"time":26.586,"type":"RIGHT"},{"time":26.8,"type":"UP"},{"time":27.015,"type":"UP"},{"time":27.229,"type":"DOWN"},{"time":27.443,"type":"REVERSE_BACK"},{"time":27.657,"type":"UP"},{"time":27.872,"type":"RIGHT"},{"time":28.086,"type":"DOWN"},{"time":28.3,"type":"RIGHT"},{"time":28.514,"type":"UP"},{"time":28.729,"type":"DOWN"},{"time":28.943,"type":"RIGHT"},{"time":29.157,"type":"UP"},{"time":29.372,"type":"DOWN"},{"time":29.586,"type":"UP"},{"time":29.8,"type":"DOWN"},{"time":30.014,"type":"UP"},{"time":30.229,"type":"DOWN"},{"time":30.443,"type":"UP"},{"time":30.657,"type":"RIGHT"},{"time":30.872,"type":"LEFT"},{"time":31.086,"type":"UP"},{"time":31.3,"type":"UP_RIGHT"},{"time":31.514,"type":"DOWN"},{"time":31.729,"type":"DOWN_RIGHT"},{"time":31.943,"type":"UP"},{"time":32.157,"type":"UP_RIGHT"},{"time":32.371,"type":"DOWN"},{"time":32.586,"type":"DOWN_RIGHT"},{"time":32.8,"type":"UP"},{"time":33.014,"type":"DOWN"},{"time":33.229,"type":"LEFT"},{"time":33.443,"type":"RIGHT"},{"time":33.657,"type":"UP"},{"time":33.872,"type":"UP"},{"time":34.086,"type":"DOWN"},{"time":34.3,"type":"REVERSE"},{"time":34.514,"type":"UP"},{"time":34.728,"type":"DOWN"},{"time":34.942,"type":"RIGHT"},{"time":35.156,"type":"UP"},{"time":35.371,"type":"DOWN"},{"time":35.585,"type":"RIGHT"},{"time":35.799,"type":"UP"},{"time":36.014,"type":"DOWN"},{"time":36.228,"type":"UP"},{"time":36.442,"type":"DOWN"},{"time":36.656,"type":"UP"},{"time":36.871,"type":"DOWN"},{"time":37.085,"type":"UP"},{"time":37.299,"type":"RIGHT"},{"time":37.514,"type":"LEFT"},{"time":37.728,"type":"UP"},{"time":37.942,"type":"UP_RIGHT"},{"time":38.156,"type":"DOWN"},{"time":38.371,"type":"DOWN_RIGHT"},{"time":38.585,"type":"UP"},{"time":38.799,"type":"UP_RIGHT"},{"time":39.013,"type":"DOWN"},{"time":39.228,"type":"DOWN_RIGHT"},{"time":39.442,"type":"UP"},{"time":39.656,"type":"DOWN"},{"time":39.871,"type":"LEFT"},{"time":40.085,"type":"RIGHT"},{"time":40.299,"type":"UP"},{"time":40.514,"type":"UP"},{"time":40.728,"type":"DOWN"},{"time":40.942,"type":"DOWN"},{"time":41.157,"type":"UP"},{"time":41.585,"type":"RIGHT"},{"time":42.014,"type":"DOWN"},{"time":42.443,"type":"LEFT"},{"time":42.871,"type":"UP"},{"time":43.3,"type":"UP"},{"time":43.728,"type":"LEFT"},{"time":44.157,"type":"UP"},{"time":44.585,"type":"UP"},{"time":45.014,"type":"RIGHT"},{"time":45.443,"type":"DOWN"},{"time":45.871,"type":"RIGHT"},{"time":46.3,"type":"UP"},{"time":46.728,"type":"LEFT"},{"time":47.157,"type":"UP"},{"time":47.585,"type":"RIGHT"},{"time":48.014,"type":"UP"},{"time":48.443,"type":"RIGHT"},{"time":48.871,"type":"UP"},{"time":49.3,"type":"LEFT"},{"time":49.728,"type":"DOWN"},{"time":50.157,"type":"RIGHT"},{"time":50.585,"type":"DOWN"},{"time":51.014,"type":"LEFT"},{"time":51.434,"type":"REVERSE_BACK"},{"time":53.157,"type":"DOWN"},{"time":54.443,"type":"UP"},{"time":54.657,"type":"DOWN"},{"time":54.871,"type":"UP"},{"time":55.085,"type":"UP"},{"time":55.3,"type":"RIGHT"},{"time":55.514,"type":"DOWN"},{"time":55.728,"type":"RIGHT"},{"time":55.942,"type":"UP"},{"time":56.157,"type":"DOWN"},{"time":56.371,"type":"RIGHT"},{"time":56.585,"type":"UP"},{"time":56.8,"type":"DOWN"},{"time":57.014,"type":"UP"},{"time":57.228,"type":"DOWN"},{"time":57.442,"type":"UP"},{"time":57.657,"type":"DOWN"},{"time":57.871,"type":"UP"},{"time":58.085,"type":"RIGHT"},{"time":58.3,"type":"LEFT"},{"time":58.514,"type":"UP"},{"time":58.728,"type":"UP_RIGHT"},{"time":58.942,"type":"DOWN"},{"time":59.157,"type":"DOWN_RIGHT"},{"time":59.371,"type":"UP"},{"time":59.585,"type":"UP_RIGHT"},{"time":59.799,"type":"DOWN"},{"time":60.014,"type":"DOWN_RIGHT"},{"time":60.228,"type":"UP"},{"time":60.442,"type":"DOWN"},{"time":60.657,"type":"LEFT"},{"time":60.871,"type":"RIGHT"},{"time":61.085,"type":"UP"},{"time":61.3,"type":"UP"},{"time":61.514,"type":"DOWN"},{"time":61.728,"type":"DOWN"},{"time":61.942,"type":"REVERSE"},{"time":62.157,"type":"UP"},{"time":62.372,"type":"RIGHT"},{"time":62.586,"type":"DOWN"},{"time":62.8,"type":"RIGHT"},{"time":63.014,"type":"UP"},{"time":63.229,"type":"DOWN"},{"time":63.443,"type":"RIGHT"},{"time":63.657,"type":"UP"},{"time":63.872,"type":"DOWN"},{"time":64.086,"type":"UP"},{"time":64.3,"type":"DOWN"},{"time":64.514,"type":"UP"},{"time":64.729,"type":"DOWN"},{"time":64.943,"type":"UP"},{"time":65.157,"type":"RIGHT"},{"time":65.372,"type":"LEFT"},{"time":65.586,"type":"UP"},{"time":65.8,"type":"UP_RIGHT"},{"time":66.014,"type":"DOWN"},{"time":66.229,"type":"DOWN_RIGHT"},{"time":66.443,"type":"UP"},{"time":66.657,"type":"UP_RIGHT"},{"time":66.871,"type":"DOWN"},{"time":67.086,"type":"DOWN_RIGHT"},{"time":67.3,"type":"UP"},{"time":67.514,"type":"DOWN"},{"time":67.729,"type":"LEFT"},{"time":67.943,"type":"RIGHT"},{"time":68.157,"type":"UP"},{"time":68.372,"type":"UP"},{"time":68.585,"type":"REVERSE_BACK"},{"time":68.8,"type":"UP"},{"time":69.014,"type":"DOWN"},{"time":69.228,"type":"RIGHT"},{"time":69.442,"type":"UP"},{"time":69.657,"type":"DOWN"},{"time":69.871,"type":"RIGHT"},{"time":70.085,"type":"UP"},{"time":70.3,"type":"DOWN"},{"time":70.514,"type":"UP"},{"time":70.728,"type":"DOWN"},{"time":70.942,"type":"UP"},{"time":71.157,"type":"DOWN"},{"time":71.371,"type":"UP"},{"time":71.585,"type":"RIGHT"},{"time":71.8,"type":"LEFT"},{"time":72.014,"type":"UP"},{"time":72.228,"type":"UP_RIGHT"},{"time":72.442,"type":"DOWN"},{"time":72.657,"type":"DOWN_RIGHT"},{"time":72.871,"type":"UP"},{"time":73.085,"type":"UP_RIGHT"},{"time":73.299,"type":"DOWN"},{"time":73.514,"type":"DOWN_RIGHT"},{"time":73.728,"type":"UP"},{"time":73.942,"type":"DOWN"},{"time":74.157,"type":"LEFT"},{"time":74.371,"type":"RIGHT"},{"time":74.585,"type":"UP"},{"time":74.8,"type":"UP"},{"time":75.014,"type":"DOWN"},{"time":75.228,"type":"DOWN"},{"time":75.442,"type":"REVERSE"},{"time":75.657,"type":"UP"},{"time":75.872,"type":"RIGHT"},{"time":76.086,"type":"DOWN"},{"time":76.3,"type":"RIGHT"},{"time":76.514,"type":"UP"},{"time":76.729,"type":"DOWN"},{"time":76.943,"type":"RIGHT"},{"time":77.157,"type":"UP"},{"time":77.372,"type":"DOWN"},{"time":77.586,"type":"UP"},{"time":77.8,"type":"DOWN"},{"time":78.014,"type":"UP"},{"time":78.229,"type":"DOWN"},{"time":78.443,"type":"UP"},{"time":78.657,"type":"RIGHT"},{"time":78.872,"type":"LEFT"},{"time":79.086,"type":"UP"},{"time":79.3,"type":"UP_RIGHT"},{"time":79.514,"type":"DOWN"},{"time":79.729,"type":"DOWN_RIGHT"},{"time":79.943,"type":"UP"},{"time":80.157,"type":"UP_RIGHT"},{"time":80.371,"type":"DOWN"},{"time":80.586,"type":"DOWN_RIGHT"},{"time":80.8,"type":"UP"},{"time":81.014,"type":"DOWN"},{"time":81.229,"type":"LEFT"},{"time":81.443,"type":"RIGHT"},{"time":81.657,"type":"UP"},{"time":81.872,"type":"UP"},{"time":82.086,"type":"DOWN"},{"time":82.3,"type":"REVERSE_BACK"},{"time":82.728,"type":"UP"},{"time":83.156,"type":"UP"},{"time":83.585,"type":"DOWN"},{"time":84.013,"type":"UP"},{"time":84.442,"type":"RIGHT"},{"time":84.871,"type":"DOWN"},{"time":85.299,"type":"DOWN"},{"time":85.728,"type":"DOWN"},{"time":86.156,"type":"RIGHT"},{"time":86.585,"type":"UP"},{"time":87.013,"type":"DOWN"},{"time":87.442,"type":"UP"},{"time":87.657,"type":"UP_RIGHT"},{"time":87.87,"type":"DOWN"},{"time":88.085,"type":"DOWN_RIGHT"},{"time":88.299,"type":"UP"},{"time":88.513,"type":"DOWN"},{"time":88.728,"type":"LEFT"},{"time":88.943,"type":"DOWN"},{"time":89.156,"type":"UP"},{"time":89.585,"type":"DOWN"},{"time":90.013,"type":"REVERSE"},{"time":90.443,"type":"RIGHT"},{"time":90.657,"type":"DOWN"},{"time":90.871,"type":"RIGHT"},{"time":91.3,"type":"DOWN"},{"time":91.728,"type":"UP"},{"time":91.943,"type":"DOWN"},{"time":92.157,"type":"UP"},{"time":92.585,"type":"UP"},{"time":93.014,"type":"UP"},{"time":93.228,"type":"RIGHT"},{"time":93.443,"type":"LEFT"},{"time":93.657,"type":"UP"},{"time":93.871,"type":"DOWN"},{"time":94.085,"type":"REVERSE_BACK"},{"time":96.014,"type":"DOWN"},{"time":96.443,"type":"UP"},{"time":96.871,"type":"UP_RIGHT"},{"time":97.3,"type":"RIGHT"},{"time":97.728,"type":"DOWN_RIGHT"},{"time":98.157,"type":"UP"},{"time":98.585,"type":"DOWN"},{"time":99.014,"type":"LEFT"},{"time":99.443,"type":"UP_LEFT"},{"time":99.871,"type":"LEFT"},{"time":100.3,"type":"DOWN_LEFT"},{"time":100.728,"type":"DOWN"},{"time":101.157,"type":"UP"},{"time":101.585,"type":"DOWN"},{"time":102.014,"type":"UP"},{"time":102.443,"type":"DOWN"},{"time":102.871,"type":"LEFT"},{"time":103.3,"type":"UP"},{"time":103.728,"type":"RIGHT"},{"time":104.157,"type":"UP"},{"time":104.585,"type":"LEFT"},{"time":105.014,"type":"UP_RIGHT"},{"time":105.443,"type":"RIGHT"},{"time":105.871,"type":"DOWN_RIGHT"},{"time":106.3,"type":"RIGHT"},{"time":107.157,"type":"RIGHT"},{"time":108.014,"type":"LEFT"},{"time":108.871,"type":"LEFT"},{"time":109.728,"type":"DOWN"},{"time":110.157,"type":"UP"},{"time":110.585,"type":"UP_RIGHT"},{"time":111.014,"type":"RIGHT"},{"time":111.442,"type":"DOWN_RIGHT"},{"time":111.871,"type":"UP"},{"time":112.299,"type":"DOWN"},{"time":112.728,"type":"LEFT"},{"time":113.157,"type":"UP_LEFT"},{"time":113.585,"type":"LEFT"},{"time":114.014,"type":"DOWN_LEFT"},{"time":114.442,"type":"DOWN"},{"time":114.871,"type":"UP"},{"time":115.299,"type":"DOWN"},{"time":115.728,"type":"UP"},{"time":116.157,"type":"DOWN"},{"time":116.585,"type":"LEFT"},{"time":117.014,"type":"UP"},{"time":117.442,"type":"RIGHT"},{"time":117.871,"type":"UP"},{"time":118.299,"type":"LEFT"},{"time":118.728,"type":"UP_RIGHT"},{"time":119.157,"type":"RIGHT"},{"time":119.585,"type":"DOWN_RIGHT"},{"time":120.014,"type":"RIGHT"},{"time":120.871,"type":"RIGHT"},{"time":121.728,"type":"LEFT"},{"time":122.585,"type":"LEFT"},{"time":123.443,"type":"UP"},{"time":124.3,"type":"DOWN"},{"time":125.157,"type":"UP"},{"time":126.014,"type":"LEFT"},{"time":126.871,"type":"RIGHT"},{"time":127.728,"type":"LEFT"},{"time":128.585,"type":"UP"},{"time":129.443,"type":"DOWN"},{"time":130.3,"type":"UP"},{"time":131.157,"type":"LEFT"},{"time":132.014,"type":"RIGHT"},{"time":132.871,"type":"LEFT"},{"time":133.728,"type":"UP"},{"time":135.443,"type":"UP"},{"time":136.3,"type":"DOWN"},{"time":136.728,"type":"DOWN"},{"time":137.157,"type":"DOWN"},{"time":138.014,"type":"UP"},{"time":138.871,"type":"RIGHT"},{"time":139.728,"type":"DOWN"},{"time":140.585,"type":"UP"},{"time":141.442,"type":"RIGHT"},{"time":142.299,"type":"DOWN"}],"events":[{"time":0.014,"type":"NOTE_SPEED","speed":1.5},{"time":7.157,"type":"NOTE_SPEED","speed":1.25},{"time":8.657,"type":"NOTE_SPEED","speed":1},{"time":12.085,"type":"NOTE_SPEED","speed":1.5},{"time":13.3,"type":"FLASH"},{"time":13.3,"type":"BG_COLOR","color":"#1a5fb4"},{"time":13.514,"type":"FLASH"},{"time":13.514,"type":"BG_COLOR","color":"#000b5e"},{"time":13.728,"type":"FLASH"},{"time":13.728,"type":"BG_COLOR","color":"#00102e"},{"time":15.871,"type":"FLASH"},{"time":17.157,"type":"FLASH"},{"time":19.3,"type":"FLASH"},{"time":20.157,"type":"FLASH"},{"time":20.585,"type":"NOTES_FLOW_RIGHT"},{"time":20.585,"type":"FX_INVERT","duration":6.858},{"time":20.585,"type":"FLASH"},{"time":22.728,"type":"FLASH"},{"time":24.014,"type":"FLASH"},{"time":26.157,"type":"FLASH"},{"time":27.014,"type":"FLASH"},{"time":27.443,"type":"NOTES_FLOW_LEFT"},{"time":27.443,"type":"FLASH"},{"time":29.8,"type":"FLASH"},{"time":30.871,"type":"FLASH"},{"time":33.014,"type":"FLASH"},{"time":33.871,"type":"FLASH"},{"time":34.3,"type":"NOTES_FLOW_RIGHT"},{"time":34.3,"type":"FLASH"},{"time":34.3,"type":"FX_INVERT","duration":17.143},{"time":36.443,"type":"FLASH"},{"time":37.728,"type":"FLASH"},{"time":39.871,"type":"FLASH"},{"time":40.728,"type":"FLASH"},{"time":41.014,"type":"NOTE_SPEED","speed":1},{"time":41.157,"type":"FLASH"},{"time":43.3,"type":"FLASH"},{"time":44.585,"type":"FLASH"},{"time":46.728,"type":"FLASH"},{"time":47.585,"type":"FLASH"},{"time":48.014,"type":"FLASH"},{"time":50.157,"type":"FLASH"},{"time":51.434,"type":"NOTES_FLOW_LEFT"},{"time":51.443,"type":"HUD_HIDE"},{"time":53.228,"type":"NOTE_SPEED","speed":1.5},{"time":54.443,"type":"FLASH"},{"time":54.443,"type":"BG_COLOR","color":"#1c71d8"},{"time":54.657,"type":"FLASH"},{"time":54.657,"type":"BG_COLOR","color":"#62a0ea"},{"time":54.871,"type":"HUD_SHOW"},{"time":54.871,"type":"FLASH"},{"time":54.871,"type":"BG_COLOR","color":"#000610"},{"time":54.871,"type":"FX_OLD_TV","duration":39.214},{"time":55.728,"type":"FLASH"},{"time":56.157,"type":"FLASH"},{"time":57.014,"type":"FLASH"},{"time":58.3,"type":"FLASH"},{"time":59.157,"type":"FLASH"},{"time":59.585,"type":"FLASH"},{"time":60.443,"type":"FLASH"},{"time":61.728,"type":"FLASH"},{"time":61.942,"type":"NOTES_FLOW_RIGHT"},{"time":62.585,"type":"FLASH"},{"time":63.014,"type":"FLASH"},{"time":63.871,"type":"FLASH"},{"time":65.157,"type":"FLASH"},{"time":65.8,"type":"FLASH"},{"time":66.443,"type":"FLASH"},{"time":67.3,"type":"FLASH"},{"time":68.585,"type":"NOTES_FLOW_LEFT"},{"time":68.585,"type":"FLASH"},{"time":69.443,"type":"FLASH"},{"time":70.085,"type":"FLASH"},{"time":70.871,"type":"FLASH"},{"time":72.014,"type":"FLASH"},{"time":72.657,"type":"FLASH"},{"time":73.3,"type":"FLASH"},{"time":74.157,"type":"FLASH"},{"time":75.442,"type":"NOTES_FLOW_RIGHT"},{"time":75.443,"type":"FLASH"},{"time":76.085,"type":"FLASH"},{"time":76.728,"type":"FLASH"},{"time":77.585,"type":"FLASH"},{"time":78.871,"type":"FLASH"},{"time":79.514,"type":"FLASH"},{"time":80.157,"type":"FLASH"},{"time":81.014,"type":"FLASH"},{"time":82.3,"type":"NOTES_FLOW_LEFT"},{"time":90.013,"type":"NOTES_FLOW_RIGHT"},{"time":94.085,"type":"NOTES_FLOW_LEFT"},{"time":94.085,"type":"BLACKOUT","duration":1.5},{"time":94.3,"type":"NOTE_SPEED","speed":1},{"time":123.371,"type":"BG_COLOR","duration":24,"color":"#62a0ea"}],"audioFile":"track.ogg","audioFormat":"ogg"}},"Ew.mp3":{"meta":{"title":"l","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":137,"noteTravelTime":2000,"gridOffset":0.228,"timing":[{"time":0.228,"bpm":137}],"title":"l","notes":[{"time":0.228,"type":"UP"},{"time":0.666,"type":"DOWN"},{"time":1.104,"type":"UP"},{"time":1.542,"type":"DOWN"},{"time":1.98,"type":"UP"},{"time":2.418,"type":"DOWN"},{"time":2.856,"type":"UP"},{"time":3.294,"type":"DOWN"},{"time":3.842,"type":"LEFT"},{"time":4.28,"type":"RIGHT"},{"time":4.718,"type":"LEFT"},{"time":5.156,"type":"RIGHT"},{"time":5.593,"type":"LEFT"},{"time":6.14,"type":"UP"},{"time":6.578,"type":"DOWN"},{"time":7.016,"type":"UP"},{"time":7.454,"type":"DOWN"},{"time":7.892,"type":"RIGHT"},{"time":8.33,"type":"UP"},{"time":8.768,"type":"DOWN"},{"time":9.206,"type":"UP"},{"time":9.644,"type":"LEFT"},{"time":10.082,"type":"UP"},{"time":10.52,"type":"DOWN"},{"time":11.068,"type":"LEFT"},{"time":11.506,"type":"RIGHT"},{"time":11.944,"type":"LEFT"},{"time":12.382,"type":"RIGHT"},{"time":12.819,"type":"LEFT"},{"time":13.366,"type":"UP"},{"time":13.804,"type":"DOWN"},{"time":14.242,"type":"UP"},{"time":15.994,"type":"UP"},{"time":17.746,"type":"DOWN"},{"time":19.608,"type":"UP"},{"time":21.359,"type":"DOWN"},{"time":23.111,"type":"RIGHT"},{"time":24.863,"type":"LEFT"},{"time":26.615,"type":"RIGHT"},{"time":28.476,"type":"UP"},{"time":30.228,"type":"DOWN"},{"time":31.98,"type":"UP"},{"time":33.732,"type":"DOWN"},{"time":35.483,"type":"UP"},{"time":36.469,"type":"DOWN"},{"time":37.345,"type":"UP"},{"time":38.221,"type":"DOWN"},{"time":39.097,"type":"UP"},{"time":39.535,"type":"DOWN"},{"time":39.973,"type":"UP"},{"time":40.41,"type":"DOWN"},{"time":40.848,"type":"UP"},{"time":41.286,"type":"DOWN"},{"time":41.724,"type":"UP"},{"time":42.162,"type":"DOWN"},{"time":42.6,"type":"UP"},{"time":44.462,"type":"UP"},{"time":44.9,"type":"RIGHT"},{"time":45.337,"type":"RIGHT"},{"time":45.775,"type":"UP"},{"time":46.213,"type":"DOWN"},{"time":46.651,"type":"DOWN"},{"time":47.089,"type":"UP"},{"time":47.308,"type":"RIGHT"},{"time":47.527,"type":"UP"},{"time":47.746,"type":"DOWN"},{"time":47.965,"type":"RIGHT"},{"time":48.403,"type":"UP"},{"time":48.841,"type":"DOWN"},{"time":49.279,"type":"RIGHT"},{"time":49.827,"type":"DOWN"},{"time":50.265,"type":"UP"},{"time":50.703,"type":"DOWN"},{"time":51.141,"type":"UP"},{"time":51.579,"type":"RIGHT"},{"time":52.017,"type":"RIGHT"},{"time":52.455,"type":"LEFT"},{"time":52.893,"type":"UP"},{"time":53.33,"type":"UP"},{"time":53.549,"type":"RIGHT"},{"time":53.768,"type":"UP"},{"time":53.987,"type":"DOWN"},{"time":54.206,"type":"RIGHT"},{"time":54.425,"type":"LEFT"},{"time":54.644,"type":"RIGHT"},{"time":54.863,"type":"UP"},{"time":55.192,"type":"RIGHT"},{"time":55.63,"type":"UP"},{"time":56.068,"type":"LEFT"},{"time":56.506,"type":"DOWN"},{"time":56.944,"type":"UP"},{"time":57.382,"type":"UP"},{"time":57.82,"type":"DOWN"},{"time":58.258,"type":"RIGHT"},{"time":58.586,"type":"LEFT"},{"time":59.571,"type":"LEFT"},{"time":60.447,"type":"RIGHT"},{"time":61.323,"type":"UP"},{"time":61.542,"type":"RIGHT"},{"time":61.761,"type":"UP"},{"time":61.98,"type":"DOWN"},{"time":62.199,"type":"RIGHT"},{"time":63.075,"type":"LEFT"},{"time":63.951,"type":"RIGHT"},{"time":64.827,"type":"UP"},{"time":65.046,"type":"RIGHT"},{"time":65.265,"type":"UP"},{"time":65.484,"type":"DOWN"},{"time":65.703,"type":"RIGHT"},{"time":66.688,"type":"UP_RIGHT"},{"time":67.564,"type":"DOWN_RIGHT"},{"time":68.44,"type":"UP"},{"time":68.659,"type":"RIGHT"},{"time":68.878,"type":"UP"},{"time":69.097,"type":"DOWN"},{"time":69.316,"type":"RIGHT"},{"time":70.301,"type":"DOWN_RIGHT"},{"time":71.177,"type":"UP_RIGHT"},{"time":72.053,"type":"DOWN"},{"time":72.491,"type":"UP"},{"time":72.929,"type":"DOWN"},{"time":74.243,"type":"UP"},{"time":74.681,"type":"UP"},{"time":75.994,"type":"UP"},{"time":76.432,"type":"DOWN"},{"time":77.746,"type":"UP"},{"time":78.184,"type":"UP"},{"time":79.06,"type":"LEFT"},{"time":79.498,"type":"RIGHT"},{"time":79.936,"type":"DOWN"},{"time":81.25,"type":"UP"},{"time":81.688,"type":"UP"},{"time":82.783,"type":"DOWN"},{"time":83.221,"type":"UP"},{"time":84.316,"type":"UP"},{"time":84.754,"type":"UP"},{"time":85.41,"type":"LEFT"},{"time":85.739,"type":"RIGHT"},{"time":86.067,"type":"UP"},{"time":86.396,"type":"DOWN"},{"time":86.724,"type":"RIGHT"},{"time":87.053,"type":"RIGHT"},{"time":87.381,"type":"LEFT"},{"time":87.71,"type":"RIGHT"},{"time":88.038,"type":"UP"},{"time":88.257,"type":"DOWN"},{"time":88.476,"type":"UP"},{"time":88.805,"type":"RIGHT"},{"time":89.133,"type":"DOWN"},{"time":89.462,"type":"UP"},{"time":89.79,"type":"LEFT"},{"time":90.119,"type":"DOWN"},{"time":90.447,"type":"UP"},{"time":90.775,"type":"UP"},{"time":90.994,"type":"DOWN"},{"time":91.213,"type":"UP"},{"time":91.432,"type":"DOWN"},{"time":91.761,"type":"RIGHT"},{"time":92.089,"type":"RIGHT"},{"time":92.418,"type":"LEFT"},{"time":92.747,"type":"RIGHT"},{"time":93.075,"type":"LEFT"},{"time":93.294,"type":"UP"},{"time":93.513,"type":"DOWN"},{"time":93.732,"type":"UP"},{"time":93.951,"type":"RIGHT"},{"time":94.17,"type":"RIGHT"},{"time":94.389,"type":"UP"},{"time":94.717,"type":"LEFT"},{"time":95.046,"type":"DOWN"},{"time":95.374,"type":"UP"},{"time":95.702,"type":"UP"},{"time":96.031,"type":"DOWN"},{"time":96.359,"type":"REVERSE"},{"time":96.688,"type":"DOWN"},{"time":97.016,"type":"RIGHT"},{"time":97.345,"type":"LEFT"},{"time":97.673,"type":"RIGHT"},{"time":98.002,"type":"LEFT"},{"time":98.33,"type":"UP"},{"time":98.659,"type":"DOWN"},{"time":98.878,"type":"UP"},{"time":99.097,"type":"DOWN"},{"time":99.425,"type":"LEFT"},{"time":99.754,"type":"RIGHT"},{"time":100.082,"type":"UP"},{"time":100.41,"type":"RIGHT"},{"time":100.739,"type":"LEFT"},{"time":101.067,"type":"UP"},{"time":101.396,"type":"DOWN"},{"time":101.724,"type":"UP"},{"time":102.053,"type":"DOWN"},{"time":102.381,"type":"RIGHT"},{"time":102.71,"type":"LEFT"},{"time":103.038,"type":"UP"},{"time":103.367,"type":"DOWN"},{"time":103.695,"type":"UP"},{"time":104.024,"type":"DOWN"},{"time":104.243,"type":"RIGHT"},{"time":104.462,"type":"LEFT"},{"time":104.79,"type":"RIGHT"},{"time":105.119,"type":"LEFT"},{"time":105.447,"type":"UP"},{"time":105.775,"type":"DOWN"},{"time":106.104,"type":"UP"},{"time":106.432,"type":"UP"},{"time":106.761,"type":"UP"},{"time":107.089,"type":"DOWN"},{"time":107.418,"type":"UP"}],"events":[{"time":0,"type":"NOTES_SPIN_ON"},{"time":0.009,"type":"NOTE_SPEED","speed":1.25},{"time":0.775,"type":"BG_COLOR","duration":2.957,"color":"#1a5fb4"},{"time":2.856,"type":"FLASH","duration":0.657},{"time":3.732,"type":"BG_COLOR","duration":3.284,"color":"#99c1f1"},{"time":5.921,"type":"FLASH","duration":0.214},{"time":6.359,"type":"FLASH","duration":0.219},{"time":6.797,"type":"FLASH","duration":0.219},{"time":7.016,"type":"BG_COLOR","duration":3.504,"color":"#1a5fb4"},{"time":7.126,"type":"NOTE_SPEED","speed":1.75},{"time":7.454,"type":"SHAKE"},{"time":8.549,"type":"SHAKE"},{"time":9.425,"type":"SHAKE"},{"time":10.301,"type":"SHAKE"},{"time":10.301,"type":"FLASH","duration":0.219},{"time":10.52,"type":"BG_COLOR","duration":3.723,"color":"#99c1f1"},{"time":11.177,"type":"SHAKE"},{"time":12.053,"type":"SHAKE"},{"time":12.929,"type":"SHAKE"},{"time":13.148,"type":"FLASH","duration":0.219},{"time":13.367,"type":"SHAKE"},{"time":13.586,"type":"FLASH","duration":0.219},{"time":13.805,"type":"SHAKE"},{"time":13.914,"type":"NOTES_WAVE_ON"},{"time":14.024,"type":"FLASH","duration":0.219},{"time":14.243,"type":"SHAKE"},{"time":14.352,"type":"NOTE_SPEED","speed":1},{"time":14.352,"type":"BG_COLOR","duration":6.905,"color":"#1a5fb4"},{"time":21.359,"type":"BG_COLOR","duration":7.117,"color":"#99c1f1"},{"time":28.476,"type":"FLASH"},{"time":28.476,"type":"BG_COLOR","duration":14.234,"color":"#1a5fb4"},{"time":30.228,"type":"FLASH"},{"time":30.447,"type":"NOTE_SPEED","speed":1.25},{"time":31.98,"type":"FLASH"},{"time":33.732,"type":"FLASH"},{"time":33.841,"type":"NOTE_SPEED","speed":1.5},{"time":35.483,"type":"FLASH"},{"time":36.469,"type":"FLASH"},{"time":37.345,"type":"FLASH"},{"time":38.221,"type":"FLASH"},{"time":38.987,"type":"FLASH"},{"time":39.425,"type":"FLASH"},{"time":39.863,"type":"FLASH"},{"time":40.301,"type":"FLASH"},{"time":40.739,"type":"FLASH"},{"time":41.177,"type":"FLASH"},{"time":41.615,"type":"FLASH"},{"time":42.053,"type":"FLASH"},{"time":42.6,"type":"NOTE_SPEED","speed":2},{"time":42.71,"type":"BLACKOUT","duration":1.314},{"time":43.476,"type":"NOTES_WAVE_OFF"},{"time":43.695,"type":"NOTES_SPIN_OFF"},{"time":43.914,"type":"NOTE_PUSH_ON"},{"time":43.914,"type":"FLASH","duration":0.219},{"time":44.024,"type":"DISCO","duration":28.916},{"time":44.024,"type":"FX_PIXELATE","duration":28.905},{"time":47.089,"type":"FLASH","duration":0.876},{"time":50.483,"type":"FLASH","duration":0.217},{"time":50.921,"type":"FLASH","duration":0.219},{"time":51.469,"type":"FLASH","duration":0.109},{"time":53.221,"type":"FLASH","duration":1.642},{"time":57.6,"type":"FLASH","duration":0.219},{"time":58.038,"type":"FLASH","duration":0.219},{"time":58.476,"type":"FLASH","duration":0.11},{"time":58.586,"type":"NOTES_SPIN_ON"},{"time":72.929,"type":"CAMERA_BOB_ON"},{"time":72.929,"type":"FLASH"},{"time":72.929,"type":"NOTES_SPIN_OFF"},{"time":72.929,"type":"NOTES_WAVE_ON"},{"time":72.929,"type":"NOTE_PUSH_OFF"},{"time":73.257,"type":"NOTE_SPEED","speed":1.25},{"time":80.046,"type":"NOTE_SPEED","speed":1.5},{"time":83.221,"type":"FLASH","duration":2.846},{"time":85.958,"type":"NOTE_SPEED","speed":2.25},{"time":86.067,"type":"NOTES_WAVE_OFF"},{"time":86.067,"type":"CAMERA_BOB_OFF"},{"time":86.067,"type":"NOTE_PUSH_ON"},{"time":86.067,"type":"FX_PIXELATE","duration":21.351},{"time":86.067,"type":"DISCO","duration":21.351},{"time":86.286,"type":"SHAKE"},{"time":86.505,"type":"SHAKE"},{"time":86.943,"type":"SHAKE"},{"time":87.162,"type":"SHAKE"},{"time":87.491,"type":"SHAKE"},{"time":87.819,"type":"SHAKE"},{"time":88.257,"type":"SHAKE"},{"time":88.476,"type":"SHAKE"},{"time":88.805,"type":"SHAKE"},{"time":89.133,"type":"SHAKE"},{"time":89.571,"type":"SHAKE"},{"time":89.79,"type":"SHAKE"},{"time":90.119,"type":"SHAKE"},{"time":90.447,"type":"SHAKE"},{"time":90.883,"type":"SHAKE"},{"time":91.102,"type":"SHAKE"},{"time":91.431,"type":"SHAKE"},{"time":91.759,"type":"SHAKE"},{"time":92.199,"type":"SHAKE"},{"time":92.418,"type":"SHAKE"},{"time":92.747,"type":"SHAKE"},{"time":93.075,"type":"SHAKE"},{"time":93.511,"type":"SHAKE"},{"time":93.73,"type":"SHAKE"},{"time":94.059,"type":"SHAKE"},{"time":94.387,"type":"SHAKE"},{"time":94.827,"type":"SHAKE"},{"time":95.046,"type":"SHAKE"},{"time":95.375,"type":"SHAKE"},{"time":95.703,"type":"SHAKE"},{"time":96.139,"type":"SHAKE"},{"time":96.358,"type":"SHAKE"},{"time":96.359,"type":"NOTES_FLOW_RIGHT"},{"time":96.359,"type":"FLASH","duration":11.059},{"time":96.687,"type":"SHAKE"},{"time":97.015,"type":"SHAKE"},{"time":97.454,"type":"SHAKE"},{"time":97.673,"type":"SHAKE"},{"time":98.002,"type":"SHAKE"},{"time":98.33,"type":"SHAKE"},{"time":98.766,"type":"SHAKE"},{"time":98.985,"type":"SHAKE"},{"time":99.314,"type":"SHAKE"},{"time":99.642,"type":"SHAKE"},{"time":100.082,"type":"SHAKE"},{"time":100.301,"type":"SHAKE"},{"time":100.63,"type":"SHAKE"},{"time":100.958,"type":"SHAKE"},{"time":101.394,"type":"SHAKE"},{"time":101.613,"type":"SHAKE"},{"time":101.942,"type":"SHAKE"},{"time":102.27,"type":"SHAKE"},{"time":102.71,"type":"SHAKE"},{"time":102.929,"type":"SHAKE"},{"time":103.258,"type":"SHAKE"},{"time":103.586,"type":"SHAKE"},{"time":104.022,"type":"SHAKE"},{"time":104.241,"type":"SHAKE"},{"time":104.57,"type":"SHAKE"},{"time":104.898,"type":"SHAKE"},{"time":105.337,"type":"SHAKE"},{"time":105.556,"type":"SHAKE"},{"time":105.885,"type":"SHAKE"},{"time":106.213,"type":"SHAKE"},{"time":106.649,"type":"SHAKE"},{"time":106.868,"type":"SHAKE"},{"time":107.197,"type":"SHAKE"},{"time":107.418,"type":"SHAKE"},{"time":108.841,"type":"BLACKOUT","duration":2.628}],"audioFile":"track.ogg","audioFormat":"ogg"}},"Hi-Tech":{"meta":{"title":"Hi-Tech","artist":"Arvicheskyy","difficulty":3.5,"menu_color":"#2a0a5e"},"chart":{"bpm":155,"noteTravelTime":1000,"gridOffset":0.054,"timing":[{"time":0.054,"bpm":155}],"title":"Hi-Tech","artist":"Arvicheskyy","notes":[{"time":0.054,"type":"UP"},{"time":1.022,"type":"DOWN"},{"time":1.602,"type":"UP"},{"time":2.57,"type":"DOWN"},{"time":3.151,"type":"UP"},{"time":4.119,"type":"DOWN"},{"time":4.699,"type":"UP"},{"time":5.473,"type":"DOWN"},{"time":5.86,"type":"UP"},{"time":6.248,"type":"LEFT"},{"time":6.635,"type":"RIGHT"},{"time":7.022,"type":"LEFT"},{"time":7.409,"type":"RIGHT"},{"time":7.796,"type":"LEFT"},{"time":8.183,"type":"RIGHT"},{"time":8.57,"type":"LEFT"},{"time":8.957,"type":"RIGHT"},{"time":9.344,"type":"LEFT"},{"time":9.731,"type":"RIGHT"},{"time":10.119,"type":"LEFT"},{"time":10.506,"type":"RIGHT"},{"time":10.893,"type":"LEFT"},{"time":11.28,"type":"RIGHT"},{"time":11.667,"type":"LEFT"},{"time":12.054,"type":"RIGHT"},{"time":12.441,"type":"LEFT"},{"time":13.989,"type":"UP"},{"time":14.377,"type":"RIGHT"},{"time":14.764,"type":"RIGHT"},{"time":15.151,"type":"UP"},{"time":15.538,"type":"LEFT"},{"time":15.925,"type":"UP"},{"time":16.312,"type":"DOWN"},{"time":16.699,"type":"UP"},{"time":17.086,"type":"RIGHT"},{"time":17.473,"type":"RIGHT"},{"time":17.86,"type":"LEFT"},{"time":18.248,"type":"DOWN"},{"time":18.635,"type":"RIGHT"},{"time":19.022,"type":"RIGHT"},{"time":19.409,"type":"UP"},{"time":19.796,"type":"DOWN"},{"time":20.183,"type":"RIGHT"},{"time":20.57,"type":"RIGHT"},{"time":20.957,"type":"LEFT"},{"time":21.344,"type":"UP"},{"time":21.731,"type":"REVERSE"},{"time":22.119,"type":"RIGHT"},{"time":22.506,"type":"DOWN"},{"time":22.893,"type":"RIGHT"},{"time":23.28,"type":"RIGHT"},{"time":23.667,"type":"UP"},{"time":24.054,"type":"DOWN"},{"time":24.441,"type":"UP"},{"time":24.828,"type":"LEFT"},{"time":25.215,"type":"RIGHT"},{"time":25.602,"type":"RIGHT"},{"time":25.989,"type":"UP"},{"time":26.377,"type":"DOWN"},{"time":26.764,"type":"DOWN"},{"time":27.151,"type":"RIGHT"},{"time":27.538,"type":"UP"},{"time":27.925,"type":"DOWN"},{"time":28.312,"type":"REVERSE_BACK"},{"time":28.699,"type":"RIGHT"},{"time":29.086,"type":"LEFT"},{"time":29.473,"type":"UP"},{"time":29.86,"type":"RIGHT"},{"time":30.248,"type":"RIGHT"},{"time":30.635,"type":"DOWN"},{"time":31.022,"type":"UP"},{"time":31.409,"type":"LEFT"},{"time":31.796,"type":"LEFT"},{"time":32.183,"type":"UP"},{"time":32.57,"type":"RIGHT"},{"time":32.957,"type":"UP"},{"time":33.344,"type":"DOWN"},{"time":33.731,"type":"RIGHT"},{"time":34.119,"type":"REVERSE"},{"time":34.506,"type":"REVERSE_BACK"},{"time":34.893,"type":"REVERSE"},{"time":35.28,"type":"REVERSE_BACK"},{"time":35.667,"type":"RIGHT"},{"time":36.054,"type":"RIGHT"},{"time":36.441,"type":"UP"},{"time":36.828,"type":"DOWN"},{"time":37.215,"type":"LEFT"},{"time":37.602,"type":"LEFT"},{"time":37.989,"type":"UP"},{"time":38.377,"type":"RIGHT"},{"time":38.764,"type":"RIGHT"},{"time":39.151,"type":"LEFT"},{"time":39.538,"type":"UP"},{"time":39.925,"type":"DOWN"},{"time":40.312,"type":"RIGHT"},{"time":40.699,"type":"LEFT"},{"time":41.086,"type":"UP"},{"time":41.473,"type":"DOWN"},{"time":41.86,"type":"REVERSE"},{"time":42.248,"type":"LEFT"},{"time":42.635,"type":"UP"},{"time":43.022,"type":"DOWN"},{"time":43.409,"type":"RIGHT"},{"time":43.796,"type":"LEFT"},{"time":44.183,"type":"UP"},{"time":44.57,"type":"DOWN"},{"time":44.957,"type":"REVERSE_BACK"},{"time":45.344,"type":"RIGHT"},{"time":45.731,"type":"DOWN"},{"time":46.119,"type":"UP"},{"time":46.506,"type":"LEFT"},{"time":46.893,"type":"RIGHT"},{"time":47.28,"type":"DOWN"},{"time":47.667,"type":"UP"},{"time":48.054,"type":"REVERSE"},{"time":48.441,"type":"LEFT"},{"time":48.828,"type":"DOWN"},{"time":49.216,"type":"UP"},{"time":49.603,"type":"LEFT"},{"time":49.99,"type":"RIGHT"},{"time":50.377,"type":"DOWN"},{"time":50.764,"type":"UP"},{"time":51.151,"type":"REVERSE_BACK"},{"time":51.925,"type":"UP"},{"time":52.699,"type":"DOWN"},{"time":53.473,"type":"UP"},{"time":53.86,"type":"DOWN"},{"time":54.248,"type":"UP"},{"time":55.022,"type":"DOWN"},{"time":55.796,"type":"UP"},{"time":56.57,"type":"DOWN"},{"time":56.957,"type":"UP"},{"time":57.344,"type":"DOWN"},{"time":57.731,"type":"DOWN"},{"time":58.119,"type":"UP"},{"time":58.506,"type":"UP"},{"time":58.893,"type":"DOWN"},{"time":59.28,"type":"DOWN"},{"time":59.667,"type":"UP"},{"time":60.054,"type":"UP"},{"time":60.441,"type":"DOWN"},{"time":60.828,"type":"DOWN"},{"time":61.216,"type":"UP"},{"time":61.603,"type":"UP"},{"time":61.99,"type":"DOWN"},{"time":62.377,"type":"DOWN"},{"time":62.764,"type":"UP"},{"time":63.151,"type":"UP"},{"time":65.086,"type":"UP"},{"time":65.474,"type":"RIGHT"},{"time":65.861,"type":"RIGHT"},{"time":66.248,"type":"UP"},{"time":66.635,"type":"LEFT"},{"time":67.022,"type":"UP"},{"time":67.409,"type":"DOWN"},{"time":67.796,"type":"UP"},{"time":68.183,"type":"RIGHT"},{"time":68.57,"type":"RIGHT"},{"time":68.957,"type":"LEFT"},{"time":69.345,"type":"DOWN"},{"time":69.732,"type":"RIGHT"},{"time":70.119,"type":"RIGHT"},{"time":70.506,"type":"UP"},{"time":70.893,"type":"DOWN"},{"time":71.28,"type":"RIGHT"},{"time":71.667,"type":"RIGHT"},{"time":72.054,"type":"LEFT"},{"time":72.441,"type":"UP"},{"time":72.828,"type":"REVERSE"},{"time":73.216,"type":"RIGHT"},{"time":73.603,"type":"DOWN"},{"time":73.99,"type":"RIGHT"},{"time":74.377,"type":"RIGHT"},{"time":74.764,"type":"UP"},{"time":75.151,"type":"DOWN"},{"time":75.538,"type":"UP"},{"time":75.925,"type":"LEFT"},{"time":76.312,"type":"RIGHT"},{"time":76.699,"type":"RIGHT"},{"time":77.086,"type":"UP"},{"time":77.474,"type":"DOWN"},{"time":77.861,"type":"DOWN"},{"time":78.248,"type":"RIGHT"},{"time":78.635,"type":"UP"},{"time":79.022,"type":"DOWN"},{"time":79.409,"type":"REVERSE_BACK"},{"time":79.796,"type":"RIGHT"},{"time":80.183,"type":"LEFT"},{"time":80.57,"type":"UP"},{"time":80.957,"type":"RIGHT"},{"time":81.345,"type":"RIGHT"},{"time":81.732,"type":"DOWN"},{"time":82.119,"type":"UP"},{"time":82.506,"type":"LEFT"},{"time":82.893,"type":"LEFT"},{"time":83.28,"type":"UP"},{"time":83.667,"type":"RIGHT"},{"time":84.054,"type":"UP"},{"time":84.441,"type":"DOWN"},{"time":84.828,"type":"RIGHT"},{"time":85.216,"type":"REVERSE"},{"time":85.603,"type":"REVERSE_BACK"},{"time":85.99,"type":"REVERSE"},{"time":86.377,"type":"REVERSE_BACK"},{"time":86.764,"type":"RIGHT"},{"time":87.151,"type":"RIGHT"},{"time":87.538,"type":"UP"},{"time":87.925,"type":"DOWN"},{"time":88.312,"type":"LEFT"},{"time":88.699,"type":"LEFT"},{"time":89.086,"type":"UP"},{"time":89.474,"type":"RIGHT"},{"time":89.861,"type":"RIGHT"}],"events":[{"time":4.699,"type":"FLASH","duration":7.742},{"time":12.441,"type":"HUD_HIDE"},{"time":12.538,"type":"NOTE_SPEED","speed":1.5},{"time":12.731,"type":"TEXT","duration":0.498,"color":"#ffffff","text":"ARE"},{"time":13.215,"type":"TEXT","duration":0.4,"color":"#ffffff","text":"YOU"},{"time":13.602,"type":"TEXT","duration":0.4,"color":"#ffffff","text":"READY?"},{"time":13.941,"type":"NOTE_PUSH_ON"},{"time":13.941,"type":"DISCO","duration":24.822},{"time":13.989,"type":"HUD_SHOW"},{"time":21.731,"type":"NOTES_FLOW_RIGHT"},{"time":28.312,"type":"NOTES_FLOW_LEFT"},{"time":34.119,"type":"NOTES_FLOW_RIGHT"},{"time":34.506,"type":"NOTES_FLOW_LEFT"},{"time":34.893,"type":"NOTES_FLOW_RIGHT"},{"time":35.28,"type":"NOTES_FLOW_LEFT"},{"time":38.764,"type":"NOTE_SPEED","speed":1.25},{"time":38.764,"type":"NOTE_PUSH_OFF"},{"time":38.764,"type":"FX_PIXELATE","duration":26.322},{"time":38.764,"type":"FLASH"},{"time":41.86,"type":"NOTES_FLOW_RIGHT"},{"time":44.957,"type":"NOTES_FLOW_LEFT"},{"time":48.054,"type":"NOTES_FLOW_RIGHT"},{"time":51.151,"type":"NOTES_FLOW_LEFT"},{"time":51.199,"type":"NOTE_SPEED","speed":1},{"time":57.393,"type":"NOTE_SPEED","speed":1.25},{"time":57.393,"type":"FLASH","duration":5.855},{"time":63.199,"type":"NOTE_SPEED","speed":1.5},{"time":63.683,"type":"TEXT","duration":0.498,"color":"#ffffff","text":"ARE"},{"time":64.167,"type":"TEXT","duration":0.4,"color":"#ffffff","text":"YOU"},{"time":64.554,"type":"TEXT","duration":0.435,"color":"#ffffff","text":"READY?;)"},{"time":65.038,"type":"NOTE_PUSH_ON"},{"time":65.038,"type":"DISCO","duration":24.822},{"time":65.086,"type":"FLASH"},{"time":72.828,"type":"NOTES_FLOW_RIGHT"},{"time":76.796,"type":"FLASH","duration":13.064},{"time":77.473,"type":"SHAKE"},{"time":77.473,"type":"FX_PIXELATE","duration":12.387},{"time":77.473,"type":"FLASH"},{"time":77.86,"type":"SHAKE"},{"time":78.248,"type":"SHAKE"},{"time":78.635,"type":"SHAKE"},{"time":79.022,"type":"SHAKE"},{"time":79.409,"type":"NOTES_FLOW_LEFT"},{"time":79.409,"type":"SHAKE"},{"time":79.796,"type":"SHAKE"},{"time":79.989,"type":"SHAKE"},{"time":80.183,"type":"SHAKE"},{"time":80.377,"type":"SHAKE"},{"time":80.57,"type":"SHAKE"},{"time":80.957,"type":"SHAKE"},{"time":81.344,"type":"SHAKE"},{"time":81.731,"type":"SHAKE"},{"time":82.119,"type":"SHAKE"},{"time":82.506,"type":"SHAKE"},{"time":82.893,"type":"SHAKE"},{"time":83.28,"type":"SHAKE"},{"time":83.473,"type":"SHAKE"},{"time":83.667,"type":"SHAKE"},{"time":84.054,"type":"SHAKE"},{"time":84.441,"type":"SHAKE"},{"time":84.828,"type":"SHAKE"},{"time":85.215,"type":"SHAKE"},{"time":85.216,"type":"NOTES_FLOW_RIGHT"},{"time":85.602,"type":"SHAKE"},{"time":85.603,"type":"NOTES_FLOW_LEFT"},{"time":85.989,"type":"SHAKE"},{"time":85.99,"type":"NOTES_FLOW_RIGHT"},{"time":86.183,"type":"SHAKE"},{"time":86.377,"type":"NOTES_FLOW_LEFT"},{"time":86.377,"type":"SHAKE"},{"time":86.57,"type":"SHAKE"},{"time":86.764,"type":"SHAKE"},{"time":87.151,"type":"SHAKE"},{"time":87.538,"type":"SHAKE"},{"time":87.925,"type":"SHAKE"},{"time":88.312,"type":"SHAKE"},{"time":88.699,"type":"SHAKE"},{"time":89.086,"type":"SHAKE"},{"time":89.473,"type":"SHAKE"},{"time":89.86,"type":"SHAKE"},{"time":90.635,"type":"TEXT","duration":2.225,"color":"#c061cb","text":"GG :3"}],"audioFile":"track.ogg","audioFormat":"ogg"}},"N R":{"meta":{"title":"N R","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":110,"noteTravelTime":1000,"notes":[{"time":0.005,"type":"UP"},{"time":0.278,"type":"DOWN"},{"time":0.55,"type":"UP"},{"time":0.823,"type":"RIGHT"},{"time":1.369,"type":"DOWN"},{"time":2.187,"type":"DOWN"},{"time":2.46,"type":"UP"},{"time":2.732,"type":"DOWN"},{"time":3.005,"type":"LEFT"},{"time":3.55,"type":"UP"},{"time":4.369,"type":"LEFT"},{"time":4.641,"type":"RIGHT"},{"time":4.914,"type":"LEFT"},{"time":5.187,"type":"UP"},{"time":5.732,"type":"DOWN"},{"time":6.55,"type":"RIGHT"},{"time":6.823,"type":"LEFT"},{"time":7.096,"type":"RIGHT"},{"time":8.732,"type":"UP"},{"time":9.005,"type":"UP"},{"time":9.278,"type":"UP"},{"time":9.55,"type":"RIGHT"},{"time":10.096,"type":"DOWN"},{"time":10.641,"type":"UP"},{"time":10.914,"type":"RIGHT"},{"time":11.187,"type":"LEFT"},{"time":11.46,"type":"RIGHT"},{"time":11.732,"type":"UP"},{"time":12.005,"type":"DOWN"},{"time":12.55,"type":"RIGHT"},{"time":13.096,"type":"UP"},{"time":13.369,"type":"RIGHT"},{"time":13.641,"type":"UP"},{"time":13.914,"type":"RIGHT"},{"time":14.46,"type":"DOWN"},{"time":15.005,"type":"UP"},{"time":15.278,"type":"RIGHT"},{"time":15.55,"type":"LEFT"},{"time":15.823,"type":"RIGHT"},{"time":16.096,"type":"DOWN"},{"time":16.369,"type":"DOWN"},{"time":16.914,"type":"UP"},{"time":17.46,"type":"REVERSE"},{"time":17.732,"type":"LEFT"},{"time":18.005,"type":"UP"},{"time":18.278,"type":"RIGHT"},{"time":18.823,"type":"DOWN"},{"time":19.369,"type":"UP"},{"time":19.641,"type":"DOWN"},{"time":19.914,"type":"UP"},{"time":20.187,"type":"DOWN"},{"time":20.46,"type":"RIGHT"},{"time":20.732,"type":"LEFT"},{"time":21.278,"type":"RIGHT"},{"time":21.823,"type":"UP_LEFT"},{"time":22.096,"type":"LEFT"},{"time":22.369,"type":"UP_RIGHT"},{"time":22.641,"type":"RIGHT"},{"time":23.187,"type":"DOWN"},{"time":23.732,"type":"UP"},{"time":24.005,"type":"DOWN_RIGHT"},{"time":24.278,"type":"RIGHT"},{"time":24.55,"type":"UP_RIGHT"},{"time":24.823,"type":"UP"},{"time":25.096,"type":"DOWN"},{"time":25.641,"type":"REVERSE_BACK"},{"time":26.187,"type":"UP"},{"time":26.46,"type":"DOWN"},{"time":26.732,"type":"DOWN"},{"time":27.005,"type":"UP"},{"time":27.55,"type":"RIGHT"},{"time":28.369,"type":"UP"},{"time":28.642,"type":"DOWN"},{"time":28.914,"type":"DOWN"},{"time":29.187,"type":"UP"},{"time":29.46,"type":"RIGHT"},{"time":30.55,"type":"UP"},{"time":30.823,"type":"RIGHT"},{"time":31.096,"type":"RIGHT"},{"time":31.369,"type":"LEFT"},{"time":31.641,"type":"LEFT"},{"time":31.914,"type":"UP"},{"time":32.187,"type":"DOWN"},{"time":32.46,"type":"DOWN_RIGHT"},{"time":32.732,"type":"RIGHT"},{"time":33.005,"type":"UP_RIGHT"},{"time":33.278,"type":"LEFT"},{"time":33.55,"type":"RIGHT"},{"time":33.823,"type":"LEFT"},{"time":34.096,"type":"UP"},{"time":34.369,"type":"RIGHT"},{"time":34.641,"type":"UP"},{"time":34.914,"type":"REVERSE"},{"time":35.187,"type":"DOWN"},{"time":35.46,"type":"DOWN"},{"time":35.732,"type":"DOWN_RIGHT"},{"time":36.005,"type":"RIGHT"},{"time":36.278,"type":"UP"},{"time":36.55,"type":"DOWN"},{"time":36.823,"type":"UP"},{"time":37.096,"type":"UP"},{"time":37.369,"type":"LEFT"},{"time":37.641,"type":"UP"},{"time":37.914,"type":"UP"},{"time":38.187,"type":"UP_RIGHT"},{"time":38.46,"type":"UP"},{"time":38.732,"type":"UP_LEFT"},{"time":39.005,"type":"UP"},{"time":39.278,"type":"REVERSE_BACK"},{"time":39.55,"type":"RIGHT"},{"time":39.823,"type":"RIGHT"},{"time":40.096,"type":"LEFT"},{"time":40.368,"type":"LEFT"},{"time":40.641,"type":"UP"},{"time":40.914,"type":"DOWN"},{"time":41.187,"type":"DOWN_RIGHT"},{"time":41.459,"type":"RIGHT"},{"time":41.732,"type":"UP_RIGHT"},{"time":42.005,"type":"LEFT"},{"time":42.277,"type":"RIGHT"},{"time":42.55,"type":"LEFT"},{"time":42.823,"type":"UP"},{"time":43.096,"type":"RIGHT"},{"time":43.368,"type":"UP"},{"time":43.641,"type":"REVERSE"},{"time":43.914,"type":"DOWN"},{"time":44.187,"type":"DOWN"},{"time":44.459,"type":"DOWN_RIGHT"},{"time":44.732,"type":"RIGHT"},{"time":45.005,"type":"UP"},{"time":45.277,"type":"DOWN"},{"time":45.55,"type":"UP"},{"time":45.823,"type":"UP"},{"time":46.096,"type":"LEFT"},{"time":46.368,"type":"UP"},{"time":46.641,"type":"UP"},{"time":46.914,"type":"UP_RIGHT"},{"time":47.187,"type":"UP"},{"time":47.459,"type":"UP_LEFT"},{"time":47.732,"type":"UP"},{"time":48.005,"type":"REVERSE_BACK"},{"time":48.278,"type":"UP"},{"time":48.55,"type":"LEFT"},{"time":49.096,"type":"LEFT"},{"time":49.55,"type":"UP_LEFT"},{"time":50.187,"type":"UP"},{"time":50.46,"type":"DOWN"},{"time":50.732,"type":"UP"},{"time":50.914,"type":"DOWN"},{"time":51.278,"type":"UP"},{"time":51.641,"type":"UP_RIGHT"},{"time":52.369,"type":"UP"},{"time":52.641,"type":"DOWN"},{"time":52.914,"type":"UP"},{"time":53.096,"type":"UP_RIGHT"},{"time":53.46,"type":"LEFT"},{"time":53.914,"type":"LEFT"},{"time":54.55,"type":"RIGHT"},{"time":54.823,"type":"LEFT"},{"time":55.096,"type":"UP"},{"time":55.278,"type":"DOWN"},{"time":55.641,"type":"UP"},{"time":56.096,"type":"RIGHT"},{"time":56.732,"type":"UP"},{"time":57.005,"type":"DOWN"},{"time":57.278,"type":"UP"},{"time":57.46,"type":"RIGHT"},{"time":57.823,"type":"UP"},{"time":58.278,"type":"DOWN"},{"time":58.914,"type":"UP"},{"time":59.187,"type":"DOWN"},{"time":59.46,"type":"UP"},{"time":59.642,"type":"RIGHT"},{"time":60.005,"type":"UP"}],"events":[{"time":0.278,"type":"BG_COLOR","duration":1.91,"color":"#613583"},{"time":7.187,"type":"NOTE_SPEED","speed":1.25},{"time":8.732,"type":"CAMERA_BOB_ON"},{"time":17.46,"type":"NOTES_FLOW_RIGHT"},{"time":25.641,"type":"NOTES_FLOW_LEFT"},{"time":26.187,"type":"CAMERA_BOB_OFF"},{"time":26.187,"type":"FLASH"},{"time":29.46,"type":"FX_GLITCH","duration":1.085},{"time":29.46,"type":"BG_COLOR","duration":1.09,"color":"#000a2b"},{"time":30.55,"type":"FLASH"},{"time":30.55,"type":"CAMERA_BOB_ON"},{"time":34.914,"type":"NOTES_FLOW_RIGHT"},{"time":39.278,"type":"NOTES_FLOW_LEFT"},{"time":43.641,"type":"NOTES_FLOW_RIGHT"},{"time":48.005,"type":"NOTES_FLOW_LEFT"},{"time":60.005,"type":"CAMERA_BOB_OFF"},{"time":60.005,"type":"FLASH"}],"audioFile":"track.ogg","audioFormat":"ogg"}},"Petrichor":{"meta":{"title":"Sha pridymajy","artist":"Arvicheskyy","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":100,"noteTravelTime":1000,"gridOffset":0.105,"timing":[{"time":0.105,"bpm":100}],"title":"Sha pridymajy","artist":"Arvicheskyy","notes":[{"time":0.105,"type":"UP"},{"time":2.805,"type":"DOWN"},{"time":5.205,"type":"UP"},{"time":7.605,"type":"DOWN"},{"time":10.005,"type":"UP"},{"time":12.405,"type":"DOWN"},{"time":14.805,"type":"UP"},{"time":17.205,"type":"DOWN"},{"time":19.305,"type":"UP"},{"time":22.005,"type":"DOWN"},{"time":24.405,"type":"UP"},{"time":24.705,"type":"DOWN"},{"time":25.005,"type":"UP"},{"time":25.305,"type":"DOWN"},{"time":25.605,"type":"UP"},{"time":25.905,"type":"DOWN"},{"time":26.217,"type":"UP"},{"time":26.517,"type":"DOWN"},{"time":26.817,"type":"UP"},{"time":27.117,"type":"DOWN"},{"time":27.417,"type":"UP"},{"time":27.63,"type":"DOWN"},{"time":27.855,"type":"UP"},{"time":28.08,"type":"DOWN"},{"time":28.305,"type":"UP"},{"time":29.505,"type":"UP"},{"time":29.73,"type":"DOWN"},{"time":29.955,"type":"UP"},{"time":30.18,"type":"DOWN"},{"time":30.405,"type":"LEFT"},{"time":30.63,"type":"RIGHT"},{"time":30.855,"type":"LEFT"},{"time":31.08,"type":"RIGHT"},{"time":31.305,"type":"UP"},{"time":31.905,"type":"UP"},{"time":32.13,"type":"DOWN"},{"time":32.355,"type":"UP"},{"time":32.58,"type":"DOWN"},{"time":32.805,"type":"LEFT"},{"time":33.03,"type":"REVERSE"},{"time":33.255,"type":"LEFT"},{"time":33.48,"type":"REVERSE_BACK"},{"time":33.705,"type":"UP"},{"time":34.305,"type":"DOWN"},{"time":34.53,"type":"UP"},{"time":34.755,"type":"DOWN"},{"time":34.98,"type":"UP"},{"time":35.205,"type":"RIGHT"},{"time":35.43,"type":"LEFT"},{"time":35.655,"type":"RIGHT"},{"time":35.88,"type":"LEFT"},{"time":36.105,"type":"UP"},{"time":36.705,"type":"DOWN"},{"time":36.93,"type":"UP"},{"time":37.155,"type":"DOWN"},{"time":37.38,"type":"UP"},{"time":37.605,"type":"RIGHT"},{"time":37.83,"type":"LEFT"},{"time":38.055,"type":"RIGHT"},{"time":38.28,"type":"LEFT"},{"time":38.505,"type":"UP"},{"time":39.105,"type":"UP"},{"time":39.33,"type":"DOWN"},{"time":39.555,"type":"UP"},{"time":39.78,"type":"DOWN"},{"time":40.005,"type":"LEFT"},{"time":40.23,"type":"RIGHT"},{"time":40.455,"type":"LEFT"},{"time":40.68,"type":"RIGHT"},{"time":40.905,"type":"UP"},{"time":41.505,"type":"UP"},{"time":41.73,"type":"DOWN"},{"time":41.955,"type":"UP"},{"time":42.18,"type":"DOWN"},{"time":42.405,"type":"LEFT"},{"time":42.63,"type":"REVERSE"},{"time":42.855,"type":"LEFT"},{"time":43.08,"type":"REVERSE_BACK"},{"time":43.305,"type":"UP"},{"time":43.918,"type":"DOWN"},{"time":44.143,"type":"UP"},{"time":44.368,"type":"DOWN"},{"time":44.593,"type":"UP"},{"time":44.818,"type":"RIGHT"},{"time":45.043,"type":"LEFT"},{"time":45.268,"type":"RIGHT"},{"time":45.493,"type":"LEFT"},{"time":45.718,"type":"UP"},{"time":46.305,"type":"UP"},{"time":46.53,"type":"DOWN"},{"time":46.755,"type":"UP"},{"time":46.98,"type":"DOWN"},{"time":47.205,"type":"LEFT"},{"time":47.43,"type":"RIGHT"},{"time":47.655,"type":"LEFT"},{"time":47.88,"type":"RIGHT"},{"time":48.105,"type":"UP"},{"time":48.705,"type":"DOWN"},{"time":48.93,"type":"UP"},{"time":49.155,"type":"DOWN"},{"time":49.38,"type":"UP"},{"time":49.605,"type":"RIGHT"},{"time":49.83,"type":"LEFT"},{"time":50.055,"type":"RIGHT"},{"time":50.28,"type":"LEFT"},{"time":50.505,"type":"UP"},{"time":51.105,"type":"UP"},{"time":51.33,"type":"DOWN"},{"time":51.555,"type":"UP"},{"time":51.78,"type":"DOWN"},{"time":52.005,"type":"LEFT"},{"time":52.23,"type":"REVERSE"},{"time":52.455,"type":"LEFT"},{"time":52.68,"type":"REVERSE_BACK"},{"time":52.905,"type":"UP"},{"time":53.505,"type":"DOWN"},{"time":53.73,"type":"UP"},{"time":53.955,"type":"DOWN"},{"time":54.18,"type":"UP"},{"time":54.405,"type":"RIGHT"},{"time":54.63,"type":"LEFT"},{"time":54.855,"type":"RIGHT"},{"time":55.08,"type":"LEFT"},{"time":55.305,"type":"UP"},{"time":55.905,"type":"UP"},{"time":56.13,"type":"DOWN"},{"time":56.355,"type":"UP"},{"time":56.58,"type":"DOWN"},{"time":56.805,"type":"LEFT"},{"time":57.03,"type":"RIGHT"},{"time":57.255,"type":"LEFT"},{"time":57.48,"type":"RIGHT"},{"time":57.705,"type":"UP"},{"time":58.305,"type":"DOWN"},{"time":58.53,"type":"UP"},{"time":58.755,"type":"DOWN"},{"time":58.98,"type":"UP"},{"time":59.205,"type":"RIGHT"},{"time":59.43,"type":"LEFT"},{"time":59.655,"type":"RIGHT"},{"time":59.88,"type":"LEFT"},{"time":60.105,"type":"UP"},{"time":60.705,"type":"UP"},{"time":60.93,"type":"DOWN"},{"time":61.155,"type":"UP"},{"time":61.38,"type":"DOWN"},{"time":61.605,"type":"LEFT"},{"time":61.83,"type":"REVERSE"},{"time":62.055,"type":"LEFT"},{"time":62.28,"type":"REVERSE_BACK"},{"time":62.505,"type":"UP"},{"time":63.105,"type":"UP"},{"time":63.33,"type":"DOWN"},{"time":63.555,"type":"UP"},{"time":63.78,"type":"DOWN"},{"time":64.005,"type":"LEFT"},{"time":64.23,"type":"RIGHT"},{"time":64.455,"type":"LEFT"},{"time":64.68,"type":"RIGHT"},{"time":64.905,"type":"UP"},{"time":65.505,"type":"DOWN"},{"time":65.73,"type":"UP"},{"time":65.955,"type":"DOWN"},{"time":66.18,"type":"UP"},{"time":66.405,"type":"RIGHT"},{"time":66.63,"type":"LEFT"},{"time":66.855,"type":"RIGHT"},{"time":67.08,"type":"LEFT"},{"time":67.305,"type":"UP"},{"time":67.83,"type":"UP"},{"time":68.43,"type":"DOWN"},{"time":69.03,"type":"UP"},{"time":69.63,"type":"DOWN"},{"time":70.23,"type":"RIGHT"},{"time":70.83,"type":"LEFT"},{"time":71.43,"type":"RIGHT"},{"time":72.03,"type":"LEFT"},{"time":72.63,"type":"UP"},{"time":73.23,"type":"DOWN"},{"time":73.83,"type":"UP"},{"time":74.43,"type":"DOWN"},{"time":75.03,"type":"LEFT"},{"time":75.63,"type":"RIGHT"},{"time":76.23,"type":"LEFT"},{"time":76.83,"type":"REVERSE"},{"time":77.43,"type":"UP"},{"time":78.03,"type":"DOWN"},{"time":78.63,"type":"UP"},{"time":79.23,"type":"DOWN"},{"time":79.83,"type":"RIGHT"},{"time":80.43,"type":"LEFT"},{"time":81.03,"type":"RIGHT"},{"time":81.63,"type":"LEFT"},{"time":82.23,"type":"UP"},{"time":82.83,"type":"DOWN"},{"time":83.43,"type":"UP"},{"time":84.03,"type":"DOWN"},{"time":84.63,"type":"LEFT"},{"time":85.23,"type":"RIGHT"},{"time":85.83,"type":"LEFT"},{"time":86.43,"type":"REVERSE_BACK"},{"time":87.105,"type":"UP"},{"time":87.405,"type":"DOWN"},{"time":87.705,"type":"UP"},{"time":88.005,"type":"DOWN"},{"time":88.305,"type":"UP"},{"time":88.605,"type":"DOWN"},{"time":89.505,"type":"LEFT"},{"time":89.805,"type":"RIGHT"},{"time":90.105,"type":"LEFT"},{"time":90.405,"type":"RIGHT"},{"time":90.705,"type":"LEFT"},{"time":91.005,"type":"RIGHT"},{"time":91.905,"type":"UP"},{"time":92.205,"type":"DOWN"},{"time":92.505,"type":"UP"},{"time":92.805,"type":"DOWN"},{"time":93.105,"type":"UP"},{"time":93.405,"type":"DOWN"},{"time":94.305,"type":"LEFT"},{"time":94.605,"type":"RIGHT"},{"time":94.83,"type":"LEFT"},{"time":95.055,"type":"RIGHT"},{"time":95.28,"type":"LEFT"},{"time":95.505,"type":"RIGHT"},{"time":95.73,"type":"LEFT"},{"time":96.705,"type":"UP"},{"time":96.93,"type":"DOWN"},{"time":97.155,"type":"UP"},{"time":97.38,"type":"DOWN"},{"time":97.605,"type":"LEFT"},{"time":97.83,"type":"RIGHT"},{"time":98.055,"type":"LEFT"},{"time":98.28,"type":"RIGHT"},{"time":98.505,"type":"UP"},{"time":99.105,"type":"UP"},{"time":99.33,"type":"DOWN"},{"time":99.555,"type":"UP"},{"time":99.78,"type":"DOWN"},{"time":100.005,"type":"LEFT"},{"time":100.23,"type":"REVERSE"},{"time":100.455,"type":"LEFT"},{"time":100.68,"type":"REVERSE_BACK"},{"time":100.905,"type":"UP"},{"time":101.505,"type":"DOWN"},{"time":101.73,"type":"UP"},{"time":101.955,"type":"DOWN"},{"time":102.18,"type":"UP"},{"time":102.405,"type":"RIGHT"},{"time":102.63,"type":"LEFT"},{"time":102.855,"type":"RIGHT"},{"time":103.08,"type":"LEFT"},{"time":103.305,"type":"UP"},{"time":103.905,"type":"DOWN"},{"time":104.13,"type":"UP"},{"time":104.355,"type":"DOWN"},{"time":104.58,"type":"UP"},{"time":104.805,"type":"RIGHT"},{"time":105.03,"type":"LEFT"},{"time":105.255,"type":"RIGHT"},{"time":105.48,"type":"LEFT"},{"time":105.705,"type":"UP"},{"time":106.305,"type":"UP"},{"time":106.53,"type":"DOWN"},{"time":106.755,"type":"UP"},{"time":106.98,"type":"DOWN"},{"time":107.205,"type":"LEFT"},{"time":107.43,"type":"RIGHT"},{"time":107.655,"type":"LEFT"},{"time":107.88,"type":"RIGHT"},{"time":108.105,"type":"UP"},{"time":108.705,"type":"UP"},{"time":108.93,"type":"DOWN"},{"time":109.155,"type":"UP"},{"time":109.38,"type":"DOWN"},{"time":109.605,"type":"LEFT"},{"time":109.83,"type":"REVERSE"},{"time":110.055,"type":"LEFT"},{"time":110.28,"type":"REVERSE_BACK"},{"time":110.505,"type":"UP"},{"time":111.118,"type":"DOWN"},{"time":111.343,"type":"UP"},{"time":111.568,"type":"DOWN"},{"time":111.793,"type":"UP"},{"time":112.018,"type":"RIGHT"},{"time":112.243,"type":"LEFT"},{"time":112.468,"type":"RIGHT"},{"time":112.693,"type":"LEFT"},{"time":112.918,"type":"UP"},{"time":113.505,"type":"UP"},{"time":113.73,"type":"DOWN"},{"time":113.955,"type":"UP"},{"time":114.18,"type":"DOWN"},{"time":114.405,"type":"LEFT"},{"time":114.63,"type":"RIGHT"},{"time":114.855,"type":"LEFT"},{"time":115.08,"type":"RIGHT"},{"time":115.305,"type":"UP"},{"time":115.905,"type":"DOWN"},{"time":116.13,"type":"UP"},{"time":116.355,"type":"DOWN"},{"time":116.58,"type":"UP"},{"time":116.805,"type":"RIGHT"},{"time":117.03,"type":"LEFT"},{"time":117.255,"type":"RIGHT"},{"time":117.48,"type":"LEFT"},{"time":117.705,"type":"UP"},{"time":118.305,"type":"UP"},{"time":118.53,"type":"DOWN"},{"time":118.755,"type":"UP"},{"time":118.98,"type":"DOWN"},{"time":119.205,"type":"LEFT"},{"time":119.43,"type":"REVERSE"},{"time":119.655,"type":"LEFT"},{"time":119.88,"type":"REVERSE_BACK"},{"time":120.105,"type":"UP"},{"time":120.705,"type":"UP"},{"time":120.93,"type":"DOWN"},{"time":121.155,"type":"UP"},{"time":121.38,"type":"DOWN"},{"time":121.605,"type":"LEFT"},{"time":121.83,"type":"RIGHT"},{"time":122.055,"type":"LEFT"},{"time":122.28,"type":"RIGHT"},{"time":122.505,"type":"UP"},{"time":123.105,"type":"DOWN"},{"time":123.33,"type":"UP"},{"time":123.555,"type":"DOWN"},{"time":123.78,"type":"UP"},{"time":124.005,"type":"RIGHT"},{"time":124.23,"type":"LEFT"},{"time":124.455,"type":"RIGHT"},{"time":124.68,"type":"LEFT"},{"time":124.905,"type":"UP"},{"time":125.505,"type":"DOWN"},{"time":125.73,"type":"UP"},{"time":125.955,"type":"DOWN"},{"time":126.18,"type":"UP"},{"time":126.405,"type":"RIGHT"},{"time":126.63,"type":"LEFT"},{"time":126.855,"type":"RIGHT"},{"time":127.08,"type":"LEFT"},{"time":127.305,"type":"UP"},{"time":127.905,"type":"UP"},{"time":128.13,"type":"DOWN"},{"time":128.355,"type":"UP"},{"time":128.58,"type":"DOWN"},{"time":128.805,"type":"LEFT"},{"time":129.03,"type":"REVERSE"},{"time":129.255,"type":"LEFT"},{"time":129.48,"type":"REVERSE_BACK"},{"time":129.705,"type":"UP"},{"time":130.305,"type":"DOWN"},{"time":130.53,"type":"UP"},{"time":130.755,"type":"DOWN"},{"time":130.98,"type":"UP"},{"time":131.205,"type":"RIGHT"},{"time":131.43,"type":"LEFT"},{"time":131.655,"type":"RIGHT"},{"time":131.88,"type":"LEFT"},{"time":132.105,"type":"UP"},{"time":132.692,"type":"UP"},{"time":132.917,"type":"DOWN"},{"time":133.142,"type":"UP"},{"time":133.367,"type":"DOWN"},{"time":133.592,"type":"LEFT"},{"time":133.817,"type":"RIGHT"},{"time":134.042,"type":"LEFT"},{"time":134.267,"type":"RIGHT"},{"time":134.492,"type":"UP"},{"time":135.105,"type":"UP"},{"time":135.705,"type":"UP"},{"time":136.305,"type":"UP"},{"time":136.905,"type":"UP"}],"events":[{"time":0,"type":"FLASH","duration":28.755},{"time":0.255,"type":"BG_COLOR","duration":28.2,"color":"#330035"},{"time":22.005,"type":"CAMERA_BOB_ON"},{"time":25.38,"type":"NOTE_SPEED","speed":1.25},{"time":26.73,"type":"NOTE_SPEED","speed":1.5},{"time":28.005,"type":"NOTE_SPEED","speed":1.75},{"time":28.305,"type":"BLACKOUT","duration":0.6},{"time":28.905,"type":"FLASH"},{"time":28.905,"type":"SHAKE"},{"time":30.705,"type":"FLASH","duration":0.6},{"time":31.305,"type":"SHAKE"},{"time":33.03,"type":"FX_GLITCH","duration":0.375},{"time":33.03,"type":"NOTES_FLOW_RIGHT"},{"time":33.03,"type":"SHAKE"},{"time":33.03,"type":"DISCO","duration":0.675},{"time":33.105,"type":"FX_PIXELATE","duration":0.6},{"time":33.18,"type":"FX_INVERT","duration":0.45},{"time":33.255,"type":"SHAKE"},{"time":33.405,"type":"FLASH","duration":0.3},{"time":33.48,"type":"NOTES_FLOW_LEFT"},{"time":33.48,"type":"SHAKE"},{"time":33.705,"type":"SHAKE"},{"time":35.505,"type":"FLASH","duration":0.6},{"time":36.105,"type":"SHAKE"},{"time":38.205,"type":"FLASH","duration":0.3},{"time":38.505,"type":"SHAKE"},{"time":40.305,"type":"FLASH","duration":0.6},{"time":40.905,"type":"SHAKE"},{"time":42.63,"type":"NOTES_FLOW_RIGHT"},{"time":42.63,"type":"FX_GLITCH","duration":0.375},{"time":42.63,"type":"SHAKE"},{"time":42.63,"type":"DISCO","duration":0.675},{"time":42.705,"type":"FX_PIXELATE","duration":0.6},{"time":42.78,"type":"FX_INVERT","duration":0.45},{"time":42.855,"type":"SHAKE"},{"time":43.005,"type":"FLASH","duration":0.3},{"time":43.08,"type":"NOTES_FLOW_LEFT"},{"time":43.08,"type":"SHAKE"},{"time":43.305,"type":"SHAKE"},{"time":45.418,"type":"FLASH","duration":0.3},{"time":45.705,"type":"SHAKE"},{"time":47.505,"type":"FLASH","duration":0.6},{"time":47.505,"type":"SHAKE"},{"time":47.505,"type":"FX_GLITCH","duration":0.225},{"time":48.105,"type":"SHAKE"},{"time":50.205,"type":"FLASH","duration":0.3},{"time":50.505,"type":"SHAKE"},{"time":52.23,"type":"NOTES_FLOW_RIGHT"},{"time":52.23,"type":"FX_GLITCH","duration":0.375},{"time":52.23,"type":"SHAKE"},{"time":52.23,"type":"DISCO","duration":0.675},{"time":52.305,"type":"FX_PIXELATE","duration":0.6},{"time":52.38,"type":"FX_INVERT","duration":0.45},{"time":52.455,"type":"SHAKE"},{"time":52.605,"type":"FLASH","duration":0.3},{"time":52.68,"type":"NOTES_FLOW_LEFT"},{"time":52.68,"type":"SHAKE"},{"time":52.905,"type":"SHAKE"},{"time":55.005,"type":"FLASH","duration":0.3},{"time":55.305,"type":"SHAKE"},{"time":57.105,"type":"FLASH","duration":0.6},{"time":57.705,"type":"SHAKE"},{"time":59.805,"type":"FLASH","duration":0.3},{"time":60.105,"type":"SHAKE"},{"time":61.83,"type":"NOTES_FLOW_RIGHT"},{"time":61.83,"type":"FX_GLITCH","duration":0.375},{"time":61.83,"type":"SHAKE"},{"time":61.83,"type":"DISCO","duration":0.675},{"time":61.905,"type":"FX_PIXELATE","duration":0.6},{"time":61.98,"type":"FX_INVERT","duration":0.45},{"time":62.055,"type":"SHAKE"},{"time":62.205,"type":"FLASH","duration":0.3},{"time":62.28,"type":"NOTES_FLOW_LEFT"},{"time":62.28,"type":"SHAKE"},{"time":62.505,"type":"SHAKE"},{"time":64.305,"type":"FLASH","duration":0.6},{"time":64.905,"type":"SHAKE"},{"time":67.005,"type":"FLASH","duration":0.3},{"time":67.305,"type":"CAMERA_BOB_OFF"},{"time":67.305,"type":"SHAKE"},{"time":67.305,"type":"BG_COLOR","color":"#62a0ea"},{"time":67.38,"type":"NOTE_SPEED","speed":1.25},{"time":67.83,"type":"FLASH","duration":1.8},{"time":69.63,"type":"SHAKE"},{"time":70.23,"type":"FLASH","duration":1.8},{"time":72.03,"type":"SHAKE"},{"time":72.63,"type":"FLASH","duration":1.8},{"time":74.43,"type":"SHAKE"},{"time":75.03,"type":"FLASH","duration":1.8},{"time":76.83,"type":"NOTES_FLOW_RIGHT"},{"time":76.83,"type":"CAMERA_BOB_ON"},{"time":76.83,"type":"SHAKE"},{"time":77.43,"type":"FLASH","duration":1.8},{"time":79.23,"type":"SHAKE"},{"time":79.83,"type":"FLASH","duration":1.8},{"time":81.63,"type":"SHAKE"},{"time":82.23,"type":"FLASH","duration":1.8},{"time":84.03,"type":"SHAKE"},{"time":84.63,"type":"FLASH","duration":1.8},{"time":86.43,"type":"CAMERA_BOB_OFF"},{"time":86.43,"type":"NOTES_FLOW_LEFT"},{"time":86.43,"type":"SHAKE"},{"time":90.405,"type":"FLASH","duration":5.7},{"time":91.08,"type":"NOTE_SPEED","speed":1.5},{"time":95.805,"type":"NOTE_SPEED","speed":1.75},{"time":96.105,"type":"CAMERA_BOB_ON"},{"time":96.105,"type":"BG_COLOR","color":"#330035"},{"time":96.105,"type":"SHAKE"},{"time":97.905,"type":"FLASH","duration":0.6},{"time":98.505,"type":"SHAKE"},{"time":100.23,"type":"NOTES_FLOW_RIGHT"},{"time":100.23,"type":"FX_GLITCH","duration":0.375},{"time":100.23,"type":"SHAKE"},{"time":100.23,"type":"DISCO","duration":0.675},{"time":100.305,"type":"FX_PIXELATE","duration":0.6},{"time":100.38,"type":"FX_INVERT","duration":0.45},{"time":100.455,"type":"SHAKE"},{"time":100.605,"type":"FLASH","duration":0.3},{"time":100.68,"type":"NOTES_FLOW_LEFT"},{"time":100.68,"type":"SHAKE"},{"time":100.905,"type":"SHAKE"},{"time":102.705,"type":"FLASH","duration":0.6},{"time":103.305,"type":"SHAKE"},{"time":105.405,"type":"FLASH","duration":0.3},{"time":105.705,"type":"SHAKE"},{"time":107.505,"type":"FLASH","duration":0.6},{"time":108.105,"type":"SHAKE"},{"time":109.83,"type":"NOTES_FLOW_RIGHT"},{"time":109.83,"type":"FX_GLITCH","duration":0.375},{"time":109.83,"type":"SHAKE"},{"time":109.83,"type":"DISCO","duration":0.675},{"time":109.905,"type":"FX_PIXELATE","duration":0.6},{"time":109.98,"type":"FX_INVERT","duration":0.45},{"time":110.055,"type":"SHAKE"},{"time":110.205,"type":"FLASH","duration":0.3},{"time":110.28,"type":"NOTES_FLOW_LEFT"},{"time":110.28,"type":"SHAKE"},{"time":110.505,"type":"SHAKE"},{"time":112.618,"type":"FLASH","duration":0.3},{"time":112.905,"type":"SHAKE"},{"time":114.705,"type":"FLASH","duration":0.6},{"time":114.705,"type":"SHAKE"},{"time":114.705,"type":"FX_GLITCH","duration":0.225},{"time":115.305,"type":"SHAKE"},{"time":117.405,"type":"FLASH","duration":0.3},{"time":117.705,"type":"SHAKE"},{"time":119.43,"type":"NOTES_FLOW_RIGHT"},{"time":119.43,"type":"FX_GLITCH","duration":0.375},{"time":119.43,"type":"SHAKE"},{"time":119.43,"type":"DISCO","duration":0.675},{"time":119.505,"type":"FX_PIXELATE","duration":0.6},{"time":119.58,"type":"FX_INVERT","duration":0.45},{"time":119.655,"type":"SHAKE"},{"time":119.805,"type":"FLASH","duration":0.3},{"time":119.88,"type":"NOTES_FLOW_LEFT"},{"time":119.88,"type":"SHAKE"},{"time":120.105,"type":"SHAKE"},{"time":121.905,"type":"FLASH","duration":0.6},{"time":122.505,"type":"SHAKE"},{"time":124.305,"type":"FLASH","duration":0.6},{"time":124.905,"type":"SHAKE"},{"time":127.005,"type":"FLASH","duration":0.3},{"time":127.305,"type":"SHAKE"},{"time":129.03,"type":"NOTES_FLOW_RIGHT"},{"time":129.03,"type":"FX_GLITCH","duration":0.375},{"time":129.03,"type":"SHAKE"},{"time":129.03,"type":"DISCO","duration":0.675},{"time":129.105,"type":"FX_PIXELATE","duration":0.6},{"time":129.18,"type":"FX_INVERT","duration":0.45},{"time":129.255,"type":"SHAKE"},{"time":129.405,"type":"FLASH","duration":0.3},{"time":129.48,"type":"NOTES_FLOW_LEFT"},{"time":129.48,"type":"SHAKE"},{"time":129.705,"type":"SHAKE"},{"time":131.805,"type":"FLASH","duration":0.3},{"time":132.105,"type":"FLASH","duration":2.4},{"time":132.105,"type":"SHAKE"},{"time":134.505,"type":"CAMERA_BOB_OFF"},{"time":134.505,"type":"SHAKE"},{"time":136.83,"type":"FX_GLITCH","duration":0.2},{"time":136.98,"type":"BLACKOUT","duration":2.25}],"audioFile":"track.mp3","audioFormat":"mp3","coverFile":"Cover.png"}},"SwipeTrava":{"meta":{"title":"SwipeTrava","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":170,"noteTravelTime":2000,"gridOffset":0.042,"timing":[{"time":0.042,"bpm":170}],"notes":[{"time":0.042,"type":"UP"},{"time":1.101,"type":"UP"},{"time":1.454,"type":"DOWN"},{"time":2.513,"type":"RIGHT"},{"time":2.866,"type":"LEFT"},{"time":3.924,"type":"RIGHT"},{"time":4.277,"type":"LEFT"},{"time":5.336,"type":"UP"},{"time":5.689,"type":"DOWN"},{"time":6.748,"type":"UP"},{"time":7.101,"type":"DOWN"},{"time":8.16,"type":"RIGHT"},{"time":8.513,"type":"LEFT"},{"time":9.571,"type":"LEFT"},{"time":9.924,"type":"RIGHT"},{"time":10.983,"type":"UP"},{"time":11.336,"type":"DOWN"},{"time":12.395,"type":"UP"},{"time":12.748,"type":"DOWN"},{"time":13.807,"type":"RIGHT"},{"time":14.16,"type":"LEFT"},{"time":15.218,"type":"RIGHT"},{"time":15.571,"type":"LEFT"},{"time":16.63,"type":"UP"},{"time":16.983,"type":"DOWN"},{"time":18.042,"type":"UP"},{"time":18.395,"type":"DOWN"},{"time":19.454,"type":"RIGHT"},{"time":19.807,"type":"LEFT"},{"time":20.865,"type":"LEFT"},{"time":21.218,"type":"RIGHT"},{"time":22.277,"type":"UP"},{"time":22.63,"type":"REVERSE"},{"time":23.689,"type":"DOWN"},{"time":24.042,"type":"UP"},{"time":25.101,"type":"LEFT"},{"time":25.454,"type":"RIGHT"},{"time":26.513,"type":"DOWN"},{"time":26.866,"type":"UP"},{"time":27.924,"type":"LEFT"},{"time":28.277,"type":"RIGHT"},{"time":29.336,"type":"UP_LEFT"},{"time":29.689,"type":"UP_RIGHT"},{"time":30.748,"type":"DOWN_LEFT"},{"time":31.101,"type":"DOWN_RIGHT"},{"time":32.16,"type":"UP_LEFT"},{"time":32.513,"type":"UP_RIGHT"},{"time":33.572,"type":"DOWN_LEFT"},{"time":33.924,"type":"REVERSE_BACK"},{"time":34.983,"type":"DOWN"},{"time":35.336,"type":"UP"},{"time":36.395,"type":"DOWN"},{"time":36.748,"type":"UP"},{"time":37.807,"type":"LEFT"},{"time":38.16,"type":"RIGHT"},{"time":39.218,"type":"LEFT"},{"time":39.571,"type":"RIGHT"},{"time":40.63,"type":"DOWN_RIGHT"},{"time":40.983,"type":"RIGHT"},{"time":42.042,"type":"UP_RIGHT"},{"time":42.395,"type":"UP"},{"time":43.454,"type":"UP_LEFT"},{"time":43.807,"type":"LEFT"},{"time":44.866,"type":"DOWN_LEFT"},{"time":45.218,"type":"DOWN"},{"time":45.748,"type":"DOWN"},{"time":46.101,"type":"UP"},{"time":46.63,"type":"DOWN"},{"time":47.16,"type":"RIGHT"},{"time":47.513,"type":"RIGHT"},{"time":48.042,"type":"UP"},{"time":48.571,"type":"LEFT"},{"time":48.924,"type":"LEFT"},{"time":49.454,"type":"DOWN"},{"time":49.983,"type":"RIGHT"},{"time":50.336,"type":"RIGHT"},{"time":50.866,"type":"UP"},{"time":51.395,"type":"LEFT"},{"time":51.748,"type":"LEFT"},{"time":52.278,"type":"DOWN"},{"time":52.807,"type":"RIGHT"},{"time":53.16,"type":"RIGHT"},{"time":53.689,"type":"UP"},{"time":54.218,"type":"DOWN"},{"time":54.571,"type":"DOWN"},{"time":55.101,"type":"RIGHT"},{"time":55.63,"type":"DOWN"},{"time":55.983,"type":"DOWN"},{"time":56.513,"type":"UP"},{"time":57.571,"type":"DOWN"},{"time":57.924,"type":"UP"},{"time":58.983,"type":"DOWN"},{"time":59.336,"type":"UP"},{"time":60.395,"type":"DOWN"},{"time":60.748,"type":"UP"},{"time":61.807,"type":"DOWN"},{"time":62.16,"type":"UP"},{"time":63.218,"type":"DOWN"},{"time":63.571,"type":"UP"},{"time":68.513,"type":"UP"}],"events":[{"time":0,"type":"BG_COLOR","duration":11.336,"color":"#000928"},{"time":0.042,"type":"NOTE_SPEED","speed":1.25},{"time":11.16,"type":"FLASH","duration":0.264},{"time":11.424,"type":"NOTE_SPEED","speed":1.5},{"time":11.424,"type":"NOTES_WAVE_ON"},{"time":11.424,"type":"BG_COLOR","duration":0.618,"color":"#62a0ea"},{"time":22.63,"type":"NOTES_FLOW_RIGHT"},{"time":33.924,"type":"NOTES_FLOW_LEFT"},{"time":34.013,"type":"NOTES_WAVE_OFF"},{"time":34.013,"type":"NOTES_SPIN_ON"},{"time":39.218,"type":"FLASH","duration":0.353},{"time":39.66,"type":"NOTES_SPIN_OFF"},{"time":39.66,"type":"NOTES_WAVE_ON"},{"time":45.307,"type":"NOTES_SPIN_ON"},{"time":53.248,"type":"NOTES_WAVE_OFF"},{"time":53.248,"type":"NOTES_SPIN_OFF"},{"time":55.013,"type":"NOTE_SPEED","speed":1.25},{"time":56.071,"type":"NOTES_WAVE_ON"},{"time":56.513,"type":"BG_COLOR","duration":14.115,"color":"#000928"},{"time":63.66,"type":"NOTE_SPEED","speed":0.5},{"time":63.748,"type":"NOTES_SPIN_ON"}],"audioFile":"track.ogg","audioFormat":"ogg"}},"Tearout":{"meta":{"title":"Tearout","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":140,"noteTravelTime":1000,"gridOffset":0.041,"timing":[{"time":0.041,"bpm":140}],"notes":[{"time":3.47,"type":"UP"},{"time":5.184,"type":"DOWN"},{"time":6.041,"type":"UP"},{"time":6.898,"type":"DOWN"},{"time":8.612,"type":"UP"},{"time":10.327,"type":"UP"},{"time":12.041,"type":"RIGHT"},{"time":12.898,"type":"DOWN"},{"time":13.755,"type":"LEFT"},{"time":14.184,"type":"UP"},{"time":14.612,"type":"DOWN"},{"time":15.041,"type":"UP"},{"time":15.47,"type":"LEFT"},{"time":15.898,"type":"DOWN"},{"time":16.327,"type":"UP"},{"time":16.755,"type":"DOWN"},{"time":17.184,"type":"RIGHT"},{"time":17.612,"type":"UP"},{"time":18.041,"type":"DOWN"},{"time":18.47,"type":"UP"},{"time":18.898,"type":"LEFT"},{"time":19.327,"type":"UP"},{"time":19.755,"type":"RIGHT"},{"time":20.184,"type":"DOWN"},{"time":20.612,"type":"LEFT"},{"time":21.041,"type":"UP"},{"time":21.469,"type":"DOWN"},{"time":21.898,"type":"UP"},{"time":22.327,"type":"LEFT"},{"time":22.755,"type":"DOWN"},{"time":23.184,"type":"UP"},{"time":23.612,"type":"DOWN"},{"time":24.041,"type":"RIGHT"},{"time":24.469,"type":"UP"},{"time":24.898,"type":"DOWN"},{"time":25.327,"type":"UP"},{"time":25.755,"type":"LEFT"},{"time":26.184,"type":"UP"},{"time":26.612,"type":"RIGHT"},{"time":27.041,"type":"DOWN"},{"time":27.469,"type":"LEFT"},{"time":30.898,"type":"LEFT"},{"time":34.327,"type":"LEFT"},{"time":36.041,"type":"RIGHT"},{"time":37.755,"type":"RIGHT"},{"time":38.612,"type":"LEFT"},{"time":39.47,"type":"RIGHT"},{"time":39.898,"type":"LEFT"},{"time":40.327,"type":"RIGHT"},{"time":40.755,"type":"LEFT"},{"time":41.184,"type":"UP"},{"time":42.041,"type":"DOWN"},{"time":42.47,"type":"UP"},{"time":42.684,"type":"DOWN"},{"time":42.898,"type":"UP"},{"time":43.327,"type":"UP"},{"time":43.755,"type":"UP"},{"time":44.184,"type":"UP"},{"time":44.612,"type":"UP"},{"time":44.827,"type":"DOWN"},{"time":45.041,"type":"UP"},{"time":45.255,"type":"DOWN"},{"time":45.47,"type":"RIGHT"},{"time":45.898,"type":"DOWN"},{"time":46.112,"type":"UP"},{"time":46.327,"type":"DOWN"},{"time":46.541,"type":"DOWN"},{"time":46.755,"type":"UP"},{"time":46.97,"type":"UP"},{"time":47.184,"type":"LEFT"},{"time":47.612,"type":"LEFT"},{"time":47.827,"type":"RIGHT"},{"time":48.041,"type":"LEFT"},{"time":48.256,"type":"RIGHT"},{"time":48.47,"type":"LEFT"},{"time":48.685,"type":"RIGHT"},{"time":48.898,"type":"UP"},{"time":49.327,"type":"UP"},{"time":49.541,"type":"RIGHT"},{"time":49.755,"type":"UP"},{"time":49.969,"type":"RIGHT"},{"time":50.184,"type":"DOWN"},{"time":50.398,"type":"RIGHT"},{"time":50.612,"type":"DOWN"},{"time":51.041,"type":"UP"},{"time":51.255,"type":"RIGHT"},{"time":51.47,"type":"DOWN"},{"time":51.684,"type":"RIGHT"},{"time":51.898,"type":"UP"},{"time":52.112,"type":"RIGHT"},{"time":52.327,"type":"DOWN"},{"time":52.755,"type":"UP"},{"time":52.969,"type":"RIGHT"},{"time":53.184,"type":"DOWN"},{"time":53.398,"type":"UP"},{"time":53.612,"type":"RIGHT"},{"time":53.827,"type":"DOWN"},{"time":54.041,"type":"UP"},{"time":54.47,"type":"UP"},{"time":54.684,"type":"UP_RIGHT"},{"time":54.898,"type":"UP"},{"time":55.112,"type":"UP_LEFT"},{"time":55.327,"type":"UP"},{"time":55.541,"type":"UP_RIGHT"},{"time":55.755,"type":"UP"},{"time":56.184,"type":"UP"},{"time":56.398,"type":"UP"},{"time":56.612,"type":"DOWN"},{"time":56.827,"type":"DOWN"},{"time":57.041,"type":"UP"},{"time":57.255,"type":"UP"},{"time":57.47,"type":"DOWN"},{"time":57.898,"type":"LEFT"},{"time":58.112,"type":"LEFT"},{"time":58.327,"type":"LEFT"},{"time":58.541,"type":"RIGHT"},{"time":58.755,"type":"RIGHT"},{"time":58.97,"type":"RIGHT"},{"time":59.184,"type":"REVERSE"},{"time":59.612,"type":"DOWN"},{"time":59.826,"type":"UP"},{"time":60.041,"type":"DOWN"},{"time":60.255,"type":"DOWN"},{"time":60.469,"type":"UP"},{"time":60.684,"type":"UP"},{"time":60.898,"type":"LEFT"},{"time":61.326,"type":"LEFT"},{"time":61.541,"type":"RIGHT"},{"time":61.755,"type":"LEFT"},{"time":61.97,"type":"RIGHT"},{"time":62.184,"type":"LEFT"},{"time":62.399,"type":"RIGHT"},{"time":62.612,"type":"UP"},{"time":63.041,"type":"UP"},{"time":63.255,"type":"RIGHT"},{"time":63.469,"type":"UP"},{"time":63.683,"type":"RIGHT"},{"time":63.898,"type":"DOWN"},{"time":64.112,"type":"RIGHT"},{"time":64.326,"type":"DOWN"},{"time":64.755,"type":"UP"},{"time":64.969,"type":"RIGHT"},{"time":65.184,"type":"DOWN"},{"time":65.398,"type":"RIGHT"},{"time":65.612,"type":"UP"},{"time":65.826,"type":"RIGHT"},{"time":66.041,"type":"DOWN"},{"time":66.469,"type":"UP"},{"time":66.683,"type":"RIGHT"},{"time":66.898,"type":"DOWN"},{"time":67.112,"type":"UP"},{"time":67.326,"type":"RIGHT"},{"time":67.541,"type":"DOWN"},{"time":67.755,"type":"UP"},{"time":68.184,"type":"UP"},{"time":68.398,"type":"UP_RIGHT"},{"time":68.612,"type":"UP"},{"time":68.826,"type":"UP_LEFT"},{"time":69.041,"type":"UP"},{"time":69.255,"type":"UP_RIGHT"},{"time":69.469,"type":"UP"},{"time":69.898,"type":"UP"},{"time":70.112,"type":"UP"},{"time":70.326,"type":"DOWN"},{"time":70.541,"type":"DOWN"},{"time":70.755,"type":"UP"},{"time":70.969,"type":"UP"},{"time":71.184,"type":"DOWN"},{"time":71.612,"type":"LEFT"},{"time":71.826,"type":"LEFT"},{"time":72.041,"type":"REVERSE_BACK"},{"time":72.47,"type":"REVERSE"},{"time":72.898,"type":"REVERSE_BACK"},{"time":73.327,"type":"UP"},{"time":73.541,"type":"UP"},{"time":73.755,"type":"UP"},{"time":74.184,"type":"DOWN"},{"time":74.398,"type":"DOWN"},{"time":74.612,"type":"UP"},{"time":75.041,"type":"RIGHT"},{"time":75.255,"type":"LEFT"},{"time":75.47,"type":"RIGHT"},{"time":75.898,"type":"LEFT"},{"time":76.112,"type":"UP"},{"time":76.327,"type":"RIGHT"},{"time":76.755,"type":"RIGHT"},{"time":76.97,"type":"UP"},{"time":77.184,"type":"LEFT"},{"time":77.612,"type":"REVERSE"},{"time":77.827,"type":"UP"},{"time":78.041,"type":"RIGHT"},{"time":78.47,"type":"LEFT"},{"time":78.684,"type":"UP"},{"time":78.898,"type":"LEFT"},{"time":79.327,"type":"UP"},{"time":79.541,"type":"LEFT"},{"time":79.755,"type":"UP"},{"time":80.184,"type":"UP"},{"time":80.398,"type":"RIGHT"},{"time":80.612,"type":"UP"},{"time":81.041,"type":"RIGHT"},{"time":81.255,"type":"DOWN"},{"time":81.47,"type":"RIGHT"},{"time":81.898,"type":"DOWN"},{"time":82.112,"type":"LEFT"},{"time":82.327,"type":"DOWN"},{"time":82.755,"type":"UP"},{"time":82.97,"type":"DOWN"},{"time":83.184,"type":"UP"},{"time":83.612,"type":"UP_LEFT"},{"time":83.827,"type":"UP"},{"time":84.041,"type":"UP_RIGHT"},{"time":84.47,"type":"UP_RIGHT"},{"time":84.684,"type":"UP"},{"time":84.898,"type":"UP_LEFT"},{"time":85.327,"type":"REVERSE_BACK"},{"time":85.541,"type":"RIGHT"},{"time":85.755,"type":"LEFT"},{"time":86.184,"type":"DOWN"},{"time":86.398,"type":"UP"},{"time":86.612,"type":"RIGHT"},{"time":87.041,"type":"LEFT"},{"time":87.255,"type":"UP"},{"time":87.469,"type":"LEFT"},{"time":87.898,"type":"UP"},{"time":88.112,"type":"LEFT"},{"time":88.326,"type":"UP"},{"time":88.755,"type":"UP"},{"time":88.969,"type":"RIGHT"},{"time":89.183,"type":"UP"},{"time":89.612,"type":"RIGHT"},{"time":89.826,"type":"DOWN"},{"time":90.041,"type":"RIGHT"},{"time":90.469,"type":"DOWN"},{"time":90.683,"type":"LEFT"},{"time":90.898,"type":"DOWN"},{"time":91.326,"type":"UP"},{"time":91.541,"type":"DOWN"},{"time":91.755,"type":"UP"},{"time":92.183,"type":"UP_LEFT"},{"time":92.398,"type":"UP"},{"time":92.612,"type":"UP_RIGHT"},{"time":93.041,"type":"UP_RIGHT"},{"time":93.255,"type":"UP"},{"time":93.469,"type":"UP_LEFT"},{"time":93.898,"type":"LEFT"},{"time":94.112,"type":"RIGHT"},{"time":94.326,"type":"LEFT"},{"time":94.755,"type":"UP"},{"time":94.97,"type":"DOWN"},{"time":95.184,"type":"UP"},{"time":95.612,"type":"DOWN"},{"time":95.827,"type":"UP"},{"time":96.041,"type":"DOWN"},{"time":96.47,"type":"RIGHT"},{"time":96.684,"type":"LEFT"},{"time":96.899,"type":"RIGHT"},{"time":97.327,"type":"LEFT"},{"time":97.541,"type":"UP"},{"time":97.756,"type":"RIGHT"},{"time":98.184,"type":"RIGHT"},{"time":98.399,"type":"UP"},{"time":98.613,"type":"LEFT"},{"time":99.041,"type":"RIGHT"},{"time":99.255,"type":"DOWN"},{"time":99.47,"type":"RIGHT"},{"time":99.684,"type":"UP"},{"time":99.898,"type":"DOWN"},{"time":100.112,"type":"UP"},{"time":100.327,"type":"DOWN"}],"events":[{"time":0.577,"type":"BG_COLOR","duration":2.893,"color":"#000c22"},{"time":6.898,"type":"BG_COLOR","duration":6.75,"color":"#62a0ea"},{"time":12.952,"type":"NOTES_BOUNCE_ON"},{"time":13.648,"type":"NOTE_PUSH_ON"},{"time":13.755,"type":"FLASH"},{"time":13.755,"type":"BG_COLOR","color":"#ff00f7"},{"time":27.255,"type":"BG_COLOR","duration":13.875,"color":"#320037"},{"time":27.47,"type":"FLASH"},{"time":27.47,"type":"NOTES_BOUNCE_OFF"},{"time":41.184,"type":"NOTE_SPEED","speed":1.5},{"time":43.755,"type":"BG_COLOR","duration":0.857,"color":"#ffffff"},{"time":44.612,"type":"FLASH"},{"time":44.612,"type":"BG_COLOR","color":"#000000"},{"time":44.612,"type":"FX_RGB_SPLIT","duration":55.715},{"time":45.47,"type":"FLASH"},{"time":45.47,"type":"SHAKE"},{"time":46.327,"type":"SHAKE"},{"time":47.184,"type":"SHAKE"},{"time":47.184,"type":"FLASH"},{"time":48.041,"type":"SHAKE"},{"time":48.898,"type":"FLASH"},{"time":48.898,"type":"SHAKE"},{"time":49.755,"type":"SHAKE"},{"time":50.612,"type":"SHAKE"},{"time":50.612,"type":"FLASH"},{"time":51.47,"type":"SHAKE"},{"time":52.327,"type":"FLASH"},{"time":52.327,"type":"SHAKE"},{"time":53.184,"type":"SHAKE"},{"time":54.042,"type":"FLASH"},{"time":54.042,"type":"SHAKE"},{"time":54.899,"type":"SHAKE"},{"time":55.756,"type":"SHAKE"},{"time":55.756,"type":"FLASH"},{"time":56.613,"type":"SHAKE"},{"time":57.47,"type":"FLASH"},{"time":57.47,"type":"SHAKE"},{"time":58.327,"type":"SHAKE"},{"time":59.184,"type":"NOTES_FLOW_RIGHT"},{"time":59.184,"type":"SHAKE"},{"time":59.184,"type":"FLASH"},{"time":60.042,"type":"SHAKE"},{"time":60.899,"type":"FLASH"},{"time":60.899,"type":"SHAKE"},{"time":61.756,"type":"SHAKE"},{"time":62.613,"type":"FLASH"},{"time":62.613,"type":"SHAKE"},{"time":63.47,"type":"FLASH"},{"time":63.47,"type":"SHAKE"},{"time":64.327,"type":"SHAKE"},{"time":65.184,"type":"SHAKE"},{"time":65.184,"type":"FLASH"},{"time":66.041,"type":"SHAKE"},{"time":66.898,"type":"FLASH"},{"time":66.898,"type":"SHAKE"},{"time":67.755,"type":"SHAKE"},{"time":68.612,"type":"SHAKE"},{"time":68.612,"type":"FLASH"},{"time":69.47,"type":"SHAKE"},{"time":70.327,"type":"FLASH"},{"time":70.327,"type":"SHAKE"},{"time":71.184,"type":"SHAKE"},{"time":72.041,"type":"NOTES_FLOW_LEFT"},{"time":72.041,"type":"FLASH"},{"time":72.041,"type":"SHAKE"},{"time":72.47,"type":"NOTES_FLOW_RIGHT"},{"time":72.898,"type":"NOTES_FLOW_LEFT"},{"time":73.755,"type":"FLASH"},{"time":73.755,"type":"SHAKE"},{"time":74.612,"type":"SHAKE"},{"time":75.469,"type":"SHAKE"},{"time":75.469,"type":"FLASH"},{"time":76.326,"type":"SHAKE"},{"time":77.183,"type":"FLASH"},{"time":77.183,"type":"SHAKE"},{"time":77.612,"type":"NOTES_FLOW_RIGHT"},{"time":78.04,"type":"SHAKE"},{"time":78.897,"type":"SHAKE"},{"time":78.897,"type":"FLASH"},{"time":79.755,"type":"SHAKE"},{"time":80.612,"type":"FLASH"},{"time":80.612,"type":"SHAKE"},{"time":81.469,"type":"SHAKE"},{"time":82.326,"type":"FLASH"},{"time":82.326,"type":"SHAKE"},{"time":83.184,"type":"FLASH"},{"time":83.184,"type":"SHAKE"},{"time":84.041,"type":"SHAKE"},{"time":84.898,"type":"SHAKE"},{"time":84.898,"type":"FLASH"},{"time":85.327,"type":"NOTES_FLOW_LEFT"},{"time":85.755,"type":"SHAKE"},{"time":86.612,"type":"FLASH"},{"time":86.612,"type":"SHAKE"},{"time":87.469,"type":"SHAKE"},{"time":88.326,"type":"SHAKE"},{"time":88.326,"type":"FLASH"},{"time":89.184,"type":"SHAKE"},{"time":90.041,"type":"FLASH"},{"time":90.041,"type":"SHAKE"},{"time":90.898,"type":"SHAKE"},{"time":91.755,"type":"FLASH"},{"time":91.755,"type":"SHAKE"},{"time":92.559,"type":"FLASH"},{"time":92.559,"type":"SHAKE"},{"time":93.416,"type":"SHAKE"},{"time":94.273,"type":"SHAKE"},{"time":94.273,"type":"FLASH"},{"time":95.13,"type":"SHAKE"},{"time":95.987,"type":"FLASH"},{"time":95.987,"type":"SHAKE"},{"time":96.844,"type":"SHAKE"},{"time":97.701,"type":"SHAKE"},{"time":97.701,"type":"FLASH"},{"time":98.559,"type":"SHAKE"},{"time":99.416,"type":"FLASH"},{"time":99.416,"type":"SHAKE"},{"time":99.898,"type":"FX_GLITCH","duration":0.429},{"time":100.273,"type":"SHAKE"},{"time":100.327,"type":"BLACKOUT","duration":5.143}],"audioFile":"track.mp3","audioFormat":"mp3"}},"ne khochu cheta":{"meta":{"title":"ne khochu cheta","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":160,"noteTravelTime":1000,"notes":[{"time":0.014,"type":"UP"},{"time":0.483,"type":"RIGHT"},{"time":0.952,"type":"UP"},{"time":1.514,"type":"RIGHT"},{"time":1.983,"type":"UP"},{"time":2.452,"type":"RIGHT"},{"time":2.92,"type":"UP"},{"time":3.483,"type":"RIGHT"},{"time":3.952,"type":"UP"},{"time":4.514,"type":"RIGHT"},{"time":4.983,"type":"UP"},{"time":5.452,"type":"RIGHT"},{"time":6.014,"type":"UP"},{"time":6.483,"type":"RIGHT"},{"time":6.952,"type":"UP"},{"time":7.42,"type":"RIGHT"},{"time":7.702,"type":"UP"},{"time":7.983,"type":"DOWN"},{"time":9.014,"type":"UP"},{"time":9.483,"type":"RIGHT"},{"time":9.952,"type":"DOWN"},{"time":11.077,"type":"LEFT"},{"time":12.014,"type":"RIGHT"},{"time":12.483,"type":"LEFT"},{"time":12.952,"type":"UP"},{"time":13.42,"type":"DOWN"},{"time":13.889,"type":"UP"},{"time":14.17,"type":"UP"},{"time":14.452,"type":"DOWN"},{"time":14.733,"type":"DOWN"},{"time":15.014,"type":"RIGHT"},{"time":15.483,"type":"LEFT"},{"time":15.952,"type":"UP"},{"time":16.233,"type":"RIGHT"},{"time":16.516,"type":"UP"},{"time":16.798,"type":"RIGHT"},{"time":17.08,"type":"UP"},{"time":17.361,"type":"DOWN"},{"time":17.643,"type":"RIGHT"},{"time":17.827,"type":"DOWN"},{"time":18.014,"type":"RIGHT"},{"time":18.202,"type":"UP"},{"time":18.389,"type":"DOWN"},{"time":18.577,"type":"RIGHT"},{"time":18.864,"type":"UP"},{"time":19.146,"type":"RIGHT"},{"time":19.428,"type":"DOWN"},{"time":19.709,"type":"UP"},{"time":19.991,"type":"RIGHT"},{"time":20.273,"type":"DOWN"},{"time":20.555,"type":"RIGHT"},{"time":20.837,"type":"UP"},{"time":21.118,"type":"RIGHT"},{"time":21.4,"type":"DOWN"},{"time":21.682,"type":"RIGHT"},{"time":21.964,"type":"UP"},{"time":22.245,"type":"LEFT"},{"time":22.527,"type":"DOWN"},{"time":22.809,"type":"LEFT"},{"time":23.091,"type":"UP"},{"time":23.373,"type":"LEFT"},{"time":23.654,"type":"DOWN"},{"time":23.936,"type":"RIGHT"},{"time":24.218,"type":"DOWN"},{"time":24.5,"type":"RIGHT"},{"time":24.782,"type":"UP"},{"time":25.063,"type":"RIGHT"},{"time":25.345,"type":"DOWN"},{"time":25.627,"type":"RIGHT"},{"time":25.909,"type":"UP"},{"time":26.19,"type":"LEFT"},{"time":26.472,"type":"DOWN"},{"time":26.754,"type":"LEFT"},{"time":27.036,"type":"UP"},{"time":27.318,"type":"LEFT"},{"time":27.599,"type":"DOWN"},{"time":27.881,"type":"RIGHT"},{"time":28.163,"type":"DOWN"},{"time":28.445,"type":"RIGHT"},{"time":28.727,"type":"UP"},{"time":29.008,"type":"RIGHT"},{"time":29.29,"type":"DOWN"},{"time":29.572,"type":"RIGHT"},{"time":29.854,"type":"UP"},{"time":30.135,"type":"LEFT"},{"time":30.417,"type":"DOWN"},{"time":30.699,"type":"LEFT"},{"time":30.981,"type":"UP"},{"time":31.263,"type":"LEFT"},{"time":31.544,"type":"DOWN"},{"time":31.826,"type":"UP"},{"time":32.108,"type":"UP"},{"time":32.39,"type":"UP"},{"time":32.671,"type":"DOWN"},{"time":32.953,"type":"DOWN"},{"time":33.235,"type":"DOWN"},{"time":33.517,"type":"LEFT"},{"time":33.798,"type":"RIGHT"},{"time":34.08,"type":"UP"},{"time":34.362,"type":"DOWN"},{"time":34.644,"type":"UP"},{"time":34.926,"type":"RIGHT"},{"time":35.207,"type":"LEFT"},{"time":35.489,"type":"RIGHT"},{"time":35.771,"type":"UP"},{"time":36.053,"type":"LEFT"},{"time":36.334,"type":"UP"},{"time":36.616,"type":"RIGHT"},{"time":36.898,"type":"UP"},{"time":37.18,"type":"LEFT"},{"time":37.462,"type":"DOWN"},{"time":37.743,"type":"RIGHT"},{"time":38.025,"type":"UP"},{"time":38.307,"type":"DOWN"},{"time":38.589,"type":"UP"},{"time":38.87,"type":"DOWN"},{"time":39.152,"type":"LEFT"},{"time":39.434,"type":"RIGHT"},{"time":39.722,"type":"LEFT"},{"time":40.004,"type":"RIGHT"},{"time":40.185,"type":"UP"},{"time":40.373,"type":"RIGHT"},{"time":40.561,"type":"UP"},{"time":40.749,"type":"RIGHT"},{"time":40.937,"type":"UP"},{"time":41.125,"type":"RIGHT"},{"time":41.313,"type":"UP"},{"time":41.501,"type":"RIGHT"},{"time":41.688,"type":"UP"},{"time":41.876,"type":"RIGHT"},{"time":42.064,"type":"DOWN"},{"time":42.252,"type":"RIGHT"},{"time":42.44,"type":"DOWN"},{"time":42.628,"type":"RIGHT"},{"time":42.815,"type":"DOWN"},{"time":43.003,"type":"RIGHT"},{"time":43.191,"type":"DOWN"},{"time":43.379,"type":"RIGHT"},{"time":43.567,"type":"DOWN"},{"time":43.755,"type":"RIGHT"},{"time":43.942,"type":"DOWN"},{"time":44.13,"type":"RIGHT"},{"time":44.318,"type":"UP"},{"time":44.506,"type":"RIGHT"},{"time":44.694,"type":"UP"},{"time":44.882,"type":"RIGHT"},{"time":45.07,"type":"UP"},{"time":45.257,"type":"RIGHT"},{"time":45.445,"type":"UP"},{"time":45.633,"type":"RIGHT"},{"time":45.821,"type":"UP"},{"time":47.981,"type":"UP"},{"time":48.263,"type":"RIGHT"},{"time":48.733,"type":"RIGHT"},{"time":48.921,"type":"DOWN"},{"time":49.108,"type":"RIGHT"},{"time":49.296,"type":"DOWN"},{"time":49.484,"type":"UP"},{"time":49.672,"type":"RIGHT"},{"time":49.86,"type":"UP"},{"time":50.048,"type":"RIGHT"},{"time":50.329,"type":"DOWN"},{"time":50.705,"type":"RIGHT"},{"time":50.987,"type":"UP_RIGHT"},{"time":51.269,"type":"RIGHT"},{"time":51.55,"type":"DOWN_RIGHT"},{"time":51.832,"type":"UP"},{"time":52.114,"type":"REVERSE"},{"time":52.584,"type":"REVERSE_BACK"},{"time":53.053,"type":"REVERSE"},{"time":53.617,"type":"REVERSE_BACK"},{"time":53.993,"type":"REVERSE"},{"time":54.18,"type":"UP"},{"time":54.462,"type":"DOWN"},{"time":54.744,"type":"RIGHT"},{"time":55.026,"type":"UP"},{"time":55.307,"type":"UP"},{"time":55.495,"type":"DOWN"},{"time":55.683,"type":"RIGHT"},{"time":55.871,"type":"REVERSE_BACK"},{"time":56.153,"type":"RIGHT"},{"time":56.623,"type":"RIGHT"},{"time":56.811,"type":"DOWN"},{"time":56.998,"type":"RIGHT"},{"time":57.186,"type":"DOWN"},{"time":57.374,"type":"UP"},{"time":57.562,"type":"RIGHT"},{"time":57.75,"type":"UP"},{"time":57.938,"type":"RIGHT"},{"time":58.219,"type":"DOWN"},{"time":58.595,"type":"RIGHT"},{"time":58.877,"type":"UP_RIGHT"},{"time":59.159,"type":"RIGHT"},{"time":59.44,"type":"DOWN_RIGHT"},{"time":59.722,"type":"REVERSE"},{"time":60.379,"type":"REVERSE_BACK"},{"time":60.943,"type":"REVERSE"},{"time":61.507,"type":"REVERSE_BACK"},{"time":61.976,"type":"UP"},{"time":62.164,"type":"UP"},{"time":62.446,"type":"DOWN"},{"time":62.728,"type":"RIGHT"},{"time":63.01,"type":"UP"},{"time":63.291,"type":"UP"},{"time":63.479,"type":"DOWN"},{"time":63.667,"type":"RIGHT"},{"time":63.855,"type":"REVERSE"},{"time":64.043,"type":"DOWN"},{"time":64.325,"type":"RIGHT"},{"time":64.794,"type":"LEFT"},{"time":64.982,"type":"UP"},{"time":65.17,"type":"RIGHT"},{"time":65.358,"type":"UP"},{"time":65.545,"type":"DOWN"},{"time":65.733,"type":"LEFT"},{"time":65.921,"type":"DOWN"},{"time":66.11,"type":"RIGHT"},{"time":66.391,"type":"UP"},{"time":66.766,"type":"LEFT"},{"time":67.049,"type":"UP_RIGHT"},{"time":67.331,"type":"RIGHT"},{"time":67.612,"type":"DOWN_RIGHT"},{"time":67.8,"type":"DOWN"},{"time":67.988,"type":"REVERSE_BACK"},{"time":68.551,"type":"REVERSE"},{"time":69.021,"type":"REVERSE_BACK"},{"time":69.49,"type":"REVERSE"},{"time":70.054,"type":"REVERSE_BACK"},{"time":70.242,"type":"UP"},{"time":70.524,"type":"UP"},{"time":70.805,"type":"DOWN"},{"time":71.087,"type":"RIGHT"},{"time":71.369,"type":"DOWN"},{"time":71.651,"type":"LEFT"},{"time":71.932,"type":"DOWN"},{"time":72.308,"type":"RIGHT"},{"time":72.778,"type":"RIGHT"},{"time":72.966,"type":"DOWN"},{"time":73.153,"type":"RIGHT"},{"time":73.341,"type":"DOWN"},{"time":73.529,"type":"UP"},{"time":73.717,"type":"RIGHT"},{"time":73.905,"type":"UP"},{"time":74.093,"type":"RIGHT"},{"time":74.374,"type":"DOWN"},{"time":74.75,"type":"RIGHT"},{"time":75.032,"type":"UP_RIGHT"},{"time":75.314,"type":"RIGHT"},{"time":75.595,"type":"DOWN_RIGHT"},{"time":75.877,"type":"UP"},{"time":76.065,"type":"REVERSE"},{"time":76.535,"type":"REVERSE_BACK"},{"time":77.004,"type":"REVERSE"},{"time":77.568,"type":"REVERSE_BACK"},{"time":78.038,"type":"DOWN"},{"time":78.319,"type":"RIGHT"},{"time":78.601,"type":"RIGHT"},{"time":78.883,"type":"DOWN"},{"time":79.165,"type":"UP"},{"time":79.446,"type":"DOWN"},{"time":80.01,"type":"UP"},{"time":80.574,"type":"RIGHT"},{"time":81.043,"type":"DOWN"},{"time":81.513,"type":"DOWN"},{"time":81.982,"type":"UP"},{"time":82.452,"type":"RIGHT"},{"time":82.922,"type":"DOWN"},{"time":83.485,"type":"LEFT"},{"time":84.049,"type":"RIGHT"},{"time":84.519,"type":"LEFT"},{"time":84.988,"type":"RIGHT"},{"time":85.458,"type":"LEFT"},{"time":85.927,"type":"DOWN"},{"time":86.209,"type":"RIGHT"},{"time":86.491,"type":"UP"},{"time":86.773,"type":"LEFT"},{"time":87.055,"type":"DOWN"},{"time":87.524,"type":"UP"},{"time":88.088,"type":"RIGHT"},{"time":88.557,"type":"DOWN"},{"time":89.027,"type":"DOWN"},{"time":89.496,"type":"UP"},{"time":89.966,"type":"RIGHT"},{"time":90.436,"type":"DOWN"},{"time":90.999,"type":"LEFT"},{"time":91.563,"type":"RIGHT"},{"time":92.033,"type":"LEFT"},{"time":92.502,"type":"RIGHT"},{"time":92.972,"type":"LEFT"},{"time":93.441,"type":"DOWN"},{"time":93.723,"type":"RIGHT"},{"time":94.005,"type":"UP"},{"time":94.287,"type":"LEFT"},{"time":94.569,"type":"DOWN"},{"time":95.038,"type":"UP"},{"time":95.508,"type":"DOWN"}],"events":[{"time":0,"type":"HUD_HIDE"},{"time":15.967,"type":"FLASH"},{"time":15.967,"type":"NOTE_SPEED","speed":1.5},{"time":15.967,"type":"HUD_SHOW"},{"time":15.967,"type":"BG_COLOR","color":"#000000"},{"time":15.967,"type":"FX_OLD_TV","duration":64.125},{"time":39.967,"type":"FLASH"},{"time":41.842,"type":"FLASH"},{"time":44.092,"type":"FLASH"},{"time":45.873,"type":"BLACKOUT","duration":1.875},{"time":47.743,"type":"CAMERA_BOB_ON"},{"time":52.114,"type":"NOTES_FLOW_RIGHT"},{"time":52.584,"type":"NOTES_FLOW_LEFT"},{"time":53.053,"type":"NOTES_FLOW_RIGHT"},{"time":53.617,"type":"NOTES_FLOW_LEFT"},{"time":53.993,"type":"NOTES_FLOW_RIGHT"},{"time":55.871,"type":"NOTES_FLOW_LEFT"},{"time":55.904,"type":"FLASH"},{"time":55.904,"type":"FX_INVERT","duration":7.969},{"time":59.722,"type":"NOTES_FLOW_RIGHT"},{"time":60.379,"type":"NOTES_FLOW_LEFT"},{"time":60.943,"type":"NOTES_FLOW_RIGHT"},{"time":61.507,"type":"NOTES_FLOW_LEFT"},{"time":63.855,"type":"NOTES_FLOW_RIGHT"},{"time":63.873,"type":"FLASH"},{"time":67.988,"type":"NOTES_FLOW_LEFT"},{"time":68.551,"type":"NOTES_FLOW_RIGHT"},{"time":69.021,"type":"NOTES_FLOW_LEFT"},{"time":69.49,"type":"NOTES_FLOW_RIGHT"},{"time":70.054,"type":"NOTES_FLOW_LEFT"},{"time":71.976,"type":"FLASH"},{"time":71.976,"type":"FX_INVERT","duration":8.078},{"time":76.065,"type":"NOTES_FLOW_RIGHT"},{"time":76.535,"type":"NOTES_FLOW_LEFT"},{"time":77.004,"type":"NOTES_FLOW_RIGHT"},{"time":77.568,"type":"NOTES_FLOW_LEFT"},{"time":79.584,"type":"NOTE_SPEED","speed":0.75},{"time":80.054,"type":"FLASH"},{"time":80.054,"type":"CAMERA_BOB_OFF"},{"time":80.092,"type":"BG_COLOR","duration":15.945,"color":"#62a0ea"},{"time":96.021,"type":"BLACKOUT","duration":2.161}],"audioFile":"track.ogg","audioFormat":"ogg"}},"sardelka":{"meta":{"title":"sardelka","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":160,"noteTravelTime":1000,"gridOffset":0.044,"timing":[{"time":0.044,"bpm":160}],"notes":[{"time":3.044,"type":"UP"},{"time":6.034,"type":"DOWN"},{"time":9.044,"type":"UP"},{"time":12.044,"type":"UP"},{"time":13.544,"type":"RIGHT"},{"time":15.044,"type":"DOWN"},{"time":16.544,"type":"LEFT"},{"time":18.044,"type":"UP"},{"time":18.419,"type":"DOWN"},{"time":18.794,"type":"UP"},{"time":19.169,"type":"DOWN"},{"time":19.544,"type":"UP"},{"time":19.919,"type":"DOWN"},{"time":20.294,"type":"UP"},{"time":20.669,"type":"DOWN"},{"time":21.044,"type":"UP"},{"time":21.419,"type":"DOWN"},{"time":21.794,"type":"UP"},{"time":22.169,"type":"DOWN"},{"time":22.544,"type":"UP"},{"time":22.919,"type":"DOWN"},{"time":23.294,"type":"UP"},{"time":23.669,"type":"DOWN"},{"time":24.044,"type":"UP"},{"time":24.402,"type":"UP"},{"time":24.794,"type":"UP"},{"time":25.169,"type":"UP"},{"time":25.544,"type":"UP"},{"time":25.919,"type":"RIGHT"},{"time":26.294,"type":"UP"},{"time":26.669,"type":"UP_RIGHT"},{"time":27.044,"type":"UP"},{"time":27.419,"type":"UP_LEFT"},{"time":27.794,"type":"UP"},{"time":27.962,"type":"UP"},{"time":28.169,"type":"DOWN"},{"time":28.294,"type":"UP"},{"time":28.544,"type":"DOWN"},{"time":28.919,"type":"LEFT"},{"time":29.294,"type":"UP"},{"time":29.669,"type":"RIGHT"},{"time":30.044,"type":"DOWN"},{"time":30.419,"type":"LEFT"},{"time":30.794,"type":"RIGHT"},{"time":31.169,"type":"DOWN"},{"time":31.544,"type":"REVERSE"},{"time":31.919,"type":"RIGHT"},{"time":32.294,"type":"UP"},{"time":32.669,"type":"DOWN"},{"time":33.044,"type":"LEFT"},{"time":33.419,"type":"RIGHT"},{"time":33.794,"type":"UP"},{"time":34.169,"type":"DOWN"},{"time":34.544,"type":"UP"},{"time":34.919,"type":"RIGHT"},{"time":35.294,"type":"LEFT"},{"time":35.669,"type":"UP"},{"time":36.044,"type":"LEFT"},{"time":36.419,"type":"RIGHT"},{"time":36.794,"type":"UP"},{"time":37.169,"type":"DOWN"},{"time":37.544,"type":"REVERSE_BACK"},{"time":38.107,"type":"UP"},{"time":38.669,"type":"DOWN"},{"time":39.044,"type":"RIGHT"},{"time":39.419,"type":"UP"},{"time":39.794,"type":"DOWN"},{"time":40.169,"type":"UP"},{"time":40.544,"type":"REVERSE"},{"time":41.107,"type":"UP"},{"time":41.669,"type":"RIGHT"},{"time":42.044,"type":"UP"},{"time":42.419,"type":"DOWN"},{"time":42.794,"type":"UP"},{"time":43.169,"type":"DOWN"},{"time":43.544,"type":"REVERSE_BACK"},{"time":44.107,"type":"UP"},{"time":44.669,"type":"RIGHT"},{"time":45.044,"type":"LEFT"},{"time":45.419,"type":"UP_RIGHT"},{"time":45.794,"type":"UP"},{"time":46.169,"type":"DOWN"},{"time":46.544,"type":"RIGHT"},{"time":47.107,"type":"RIGHT"},{"time":47.669,"type":"UP"},{"time":48.044,"type":"DOWN"},{"time":48.419,"type":"UP_LEFT"},{"time":48.794,"type":"UP_RIGHT"},{"time":49.169,"type":"UP"},{"time":49.544,"type":"UP"},{"time":49.919,"type":"DOWN"},{"time":50.294,"type":"UP"},{"time":50.669,"type":"DOWN"},{"time":51.044,"type":"RIGHT"},{"time":51.419,"type":"LEFT"},{"time":51.794,"type":"RIGHT"},{"time":52.169,"type":"LEFT"},{"time":52.544,"type":"UP"},{"time":52.919,"type":"DOWN"},{"time":53.294,"type":"UP"},{"time":53.669,"type":"DOWN"},{"time":54.044,"type":"REVERSE"},{"time":54.419,"type":"LEFT"},{"time":54.794,"type":"RIGHT"},{"time":55.169,"type":"LEFT"},{"time":55.544,"type":"UP_RIGHT"},{"time":55.919,"type":"UP_LEFT"},{"time":56.294,"type":"UP_RIGHT"},{"time":56.669,"type":"UP_LEFT"},{"time":57.044,"type":"DOWN_LEFT"},{"time":57.419,"type":"DOWN_RIGHT"},{"time":57.794,"type":"DOWN_LEFT"},{"time":58.169,"type":"DOWN_RIGHT"},{"time":58.544,"type":"LEFT"},{"time":58.919,"type":"UP"},{"time":59.294,"type":"RIGHT"},{"time":59.669,"type":"UP"},{"time":60.044,"type":"LEFT"},{"time":60.419,"type":"UP"},{"time":60.794,"type":"RIGHT"},{"time":61.169,"type":"UP"},{"time":61.544,"type":"REVERSE_BACK"},{"time":61.919,"type":"UP"},{"time":62.294,"type":"DOWN"},{"time":62.669,"type":"UP"},{"time":63.044,"type":"RIGHT"},{"time":63.419,"type":"LEFT"},{"time":63.794,"type":"RIGHT"},{"time":64.169,"type":"LEFT"},{"time":64.544,"type":"UP"},{"time":64.919,"type":"DOWN"},{"time":65.294,"type":"UP"},{"time":65.669,"type":"DOWN"},{"time":66.044,"type":"RIGHT"},{"time":66.419,"type":"LEFT"},{"time":66.794,"type":"RIGHT"},{"time":67.169,"type":"LEFT"},{"time":67.544,"type":"UP_RIGHT"},{"time":67.919,"type":"UP_LEFT"},{"time":68.294,"type":"UP_RIGHT"},{"time":68.669,"type":"UP_LEFT"},{"time":69.044,"type":"DOWN_LEFT"},{"time":69.544,"type":"DOWN_RIGHT"},{"time":69.982,"type":"DOWN_LEFT"},{"time":70.419,"type":"DOWN_RIGHT"},{"time":70.919,"type":"DOWN"},{"time":71.419,"type":"UP"},{"time":71.919,"type":"DOWN"},{"time":72.419,"type":"UP"},{"time":73.044,"type":"DOWN"},{"time":73.544,"type":"UP"},{"time":74.044,"type":"DOWN"},{"time":74.544,"type":"UP"},{"time":75.044,"type":"DOWN"},{"time":75.669,"type":"UP"},{"time":76.294,"type":"RIGHT"},{"time":76.857,"type":"RIGHT"},{"time":77.419,"type":"DOWN"},{"time":78.107,"type":"RIGHT"},{"time":78.669,"type":"UP"},{"time":79.243,"type":"UP"},{"time":79.544,"type":"DOWN"},{"time":79.919,"type":"REVERSE"},{"time":80.482,"type":"UP"},{"time":80.982,"type":"LEFT"},{"time":81.544,"type":"DOWN"},{"time":81.794,"type":"UP"},{"time":82.044,"type":"DOWN"},{"time":82.919,"type":"UP"},{"time":83.232,"type":"UP"},{"time":83.482,"type":"DOWN"},{"time":84.044,"type":"LEFT"},{"time":84.357,"type":"RIGHT"},{"time":84.669,"type":"LEFT"},{"time":85.294,"type":"UP"},{"time":85.919,"type":"DOWN"},{"time":86.419,"type":"LEFT"},{"time":87.044,"type":"UP"},{"time":87.669,"type":"DOWN"},{"time":88.232,"type":"RIGHT"},{"time":88.794,"type":"UP"},{"time":89.107,"type":"UP"},{"time":89.482,"type":"DOWN"},{"time":90.044,"type":"UP_RIGHT"},{"time":90.669,"type":"DOWN_RIGHT"},{"time":91.169,"type":"REVERSE_BACK"},{"time":91.419,"type":"REVERSE"},{"time":91.732,"type":"REVERSE_BACK"},{"time":92.294,"type":"REVERSE"},{"time":92.669,"type":"REVERSE_BACK"},{"time":93.044,"type":"UP"},{"time":93.669,"type":"REVERSE"},{"time":93.919,"type":"REVERSE_BACK"},{"time":94.357,"type":"UP"},{"time":94.919,"type":"UP_RIGHT"},{"time":95.482,"type":"RIGHT"},{"time":96.107,"type":"DOWN_RIGHT"},{"time":96.669,"type":"UP_RIGHT"},{"time":97.232,"type":"UP"},{"time":97.919,"type":"DOWN"},{"time":98.419,"type":"UP"},{"time":98.732,"type":"DOWN"},{"time":99.044,"type":"REVERSE"},{"time":99.607,"type":"LEFT"},{"time":100.232,"type":"UP"},{"time":100.794,"type":"UP_RIGHT"},{"time":101.107,"type":"UP_LEFT"},{"time":101.44,"type":"DOWN"},{"time":102.044,"type":"DOWN_LEFT"},{"time":102.357,"type":"DOWN_RIGHT"},{"time":102.669,"type":"DOWN"},{"time":103.232,"type":"UP"},{"time":103.482,"type":"DOWN"},{"time":103.794,"type":"REVERSE_BACK"},{"time":104.482,"type":"UP_RIGHT"},{"time":105.044,"type":"RIGHT"},{"time":105.607,"type":"DOWN_RIGHT"},{"time":106.357,"type":"UP_RIGHT"},{"time":106.919,"type":"UP"},{"time":107.482,"type":"DOWN"},{"time":108.044,"type":"UP"},{"time":108.419,"type":"UP_RIGHT"},{"time":108.794,"type":"LEFT"},{"time":109.357,"type":"RIGHT"},{"time":109.919,"type":"UP"},{"time":110.294,"type":"DOWN"},{"time":110.544,"type":"UP"},{"time":110.794,"type":"DOWN"},{"time":111.607,"type":"UP"},{"time":111.982,"type":"RIGHT"},{"time":112.357,"type":"DOWN"},{"time":112.857,"type":"UP"},{"time":113.107,"type":"DOWN"},{"time":113.357,"type":"UP"},{"time":114.044,"type":"UP"},{"time":114.607,"type":"UP"},{"time":115.169,"type":"UP"},{"time":115.919,"type":"UP"}],"events":[{"time":0,"type":"BG_COLOR","duration":25.544,"color":"#99c1f1"},{"time":12.044,"type":"FLASH"},{"time":16.669,"type":"NOTE_SPEED","speed":1.5},{"time":24.044,"type":"FLASH"},{"time":24.044,"type":"SHAKE"},{"time":25.544,"type":"FLASH"},{"time":25.544,"type":"CAMERA_BOB_ON"},{"time":27.044,"type":"FLASH"},{"time":28.544,"type":"FLASH"},{"time":30.044,"type":"FLASH"},{"time":31.169,"type":"FLASH"},{"time":31.544,"type":"FLASH"},{"time":31.544,"type":"NOTES_FLOW_RIGHT"},{"time":33.794,"type":"FLASH"},{"time":34.169,"type":"FLASH"},{"time":34.544,"type":"FLASH"},{"time":37.544,"type":"FLASH"},{"time":37.544,"type":"CAMERA_BOB_OFF"},{"time":37.544,"type":"NOTES_FLOW_LEFT"},{"time":37.544,"type":"BG_COLOR","color":"#1c71d8"},{"time":40.544,"type":"NOTES_FLOW_RIGHT"},{"time":43.544,"type":"NOTES_FLOW_LEFT"},{"time":49.294,"type":"FLASH"},{"time":49.294,"type":"HUD_HIDE"},{"time":49.294,"type":"BG_COLOR","color":"#813d9c"},{"time":49.419,"type":"NOTES_BOUNCE_ON"},{"time":49.544,"type":"NOTE_SPEED","speed":1},{"time":49.794,"type":"NOTES_BOUNCE_ON"},{"time":50.544,"type":"FLASH"},{"time":52.169,"type":"FLASH"},{"time":53.669,"type":"FLASH"},{"time":54.044,"type":"NOTES_FLOW_RIGHT"},{"time":55.169,"type":"FLASH"},{"time":56.669,"type":"FLASH"},{"time":58.169,"type":"FLASH"},{"time":59.669,"type":"FLASH"},{"time":61.169,"type":"FLASH"},{"time":61.544,"type":"NOTES_FLOW_LEFT"},{"time":61.544,"type":"FLASH"},{"time":61.544,"type":"CAMERA_BOB_ON"},{"time":69.044,"type":"NOTE_SPEED","speed":0.75},{"time":69.044,"type":"BG_COLOR","duration":6,"color":"#241f31"},{"time":70.915,"type":"NOTE_SPEED","speed":0.5},{"time":70.915,"type":"CAMERA_BOB_OFF"},{"time":70.915,"type":"HUD_SHOW"},{"time":70.919,"type":"FLASH"},{"time":70.919,"type":"NOTES_BOUNCE_OFF"},{"time":75.044,"type":"FLASH"},{"time":75.044,"type":"FX_GLITCH","duration":18.875},{"time":75.169,"type":"NOTE_SPEED","speed":1.5},{"time":79.294,"type":"FX_INVERT","duration":14.625},{"time":79.919,"type":"NOTES_FLOW_RIGHT"},{"time":91.169,"type":"NOTES_FLOW_LEFT"},{"time":91.419,"type":"NOTES_FLOW_RIGHT"},{"time":91.732,"type":"NOTES_FLOW_LEFT"},{"time":92.294,"type":"NOTES_FLOW_RIGHT"},{"time":92.669,"type":"NOTES_FLOW_LEFT"},{"time":93.669,"type":"NOTES_FLOW_RIGHT"},{"time":93.919,"type":"NOTES_FLOW_LEFT"},{"time":93.919,"type":"FLASH"},{"time":93.919,"type":"CAMERA_BOB_ON"},{"time":98.419,"type":"FLASH"},{"time":98.732,"type":"FLASH"},{"time":99.044,"type":"NOTES_FLOW_RIGHT"},{"time":103.732,"type":"FLASH"},{"time":103.794,"type":"NOTES_FLOW_LEFT"},{"time":108.794,"type":"FLASH"},{"time":110.794,"type":"HUD_HIDE"},{"time":110.794,"type":"CAMERA_BOB_OFF"},{"time":110.794,"type":"FLASH"}],"audioFile":"track.mp3","audioFormat":"mp3"}},"swtv":{"meta":{"title":"swtv","artist":"Swipetava OST","difficulty":5,"menu_color":"#2a0a5e"},"chart":{"bpm":90,"noteTravelTime":1000,"gridOffset":0.033,"timing":[{"time":0.033,"bpm":90}],"notes":[{"time":0.033,"type":"RIGHT"},{"time":3.589,"type":"UP"},{"time":7.144,"type":"LEFT"},{"time":10.7,"type":"DOWN"},{"time":14.255,"type":"UP"},{"time":16.033,"type":"DOWN"},{"time":17.811,"type":"UP"},{"time":19.589,"type":"RIGHT"},{"time":21.366,"type":"DOWN"},{"time":22.255,"type":"UP"},{"time":23.144,"type":"DOWN"},{"time":24.033,"type":"UP"},{"time":24.922,"type":"DOWN"},{"time":25.366,"type":"UP"},{"time":25.811,"type":"DOWN"},{"time":26.255,"type":"UP"},{"time":26.7,"type":"DOWN"},{"time":27.033,"type":"UP"},{"time":27.366,"type":"DOWN"},{"time":27.699,"type":"UP"},{"time":28.033,"type":"DOWN"},{"time":30.255,"type":"UP"},{"time":30.7,"type":"RIGHT"},{"time":31.144,"type":"UP"},{"time":31.589,"type":"LEFT"},{"time":32.033,"type":"DOWN"},{"time":32.477,"type":"UP"},{"time":32.922,"type":"RIGHT"},{"time":33.366,"type":"UP"},{"time":33.811,"type":"DOWN"},{"time":34.255,"type":"LEFT"},{"time":34.7,"type":"UP"},{"time":35.144,"type":"RIGHT"},{"time":35.589,"type":"DOWN"},{"time":36.033,"type":"UP"},{"time":36.477,"type":"RIGHT"},{"time":36.922,"type":"LEFT"},{"time":37.366,"type":"UP"},{"time":37.811,"type":"RIGHT"},{"time":38.255,"type":"UP"},{"time":38.7,"type":"LEFT"},{"time":39.144,"type":"DOWN"},{"time":39.588,"type":"UP"},{"time":40.033,"type":"RIGHT"},{"time":40.477,"type":"UP"},{"time":40.922,"type":"DOWN"},{"time":41.366,"type":"LEFT"},{"time":41.811,"type":"UP"},{"time":42.255,"type":"RIGHT"},{"time":42.7,"type":"DOWN"},{"time":43.144,"type":"UP"},{"time":43.588,"type":"RIGHT"},{"time":44.033,"type":"LEFT"},{"time":44.477,"type":"REVERSE"},{"time":44.922,"type":"LEFT"},{"time":45.366,"type":"DOWN"},{"time":45.811,"type":"RIGHT"},{"time":46.255,"type":"UP"},{"time":46.7,"type":"DOWN"},{"time":47.144,"type":"LEFT"},{"time":47.589,"type":"DOWN"},{"time":48.033,"type":"UP"},{"time":48.477,"type":"RIGHT"},{"time":48.922,"type":"DOWN"},{"time":49.366,"type":"LEFT"},{"time":49.811,"type":"UP"},{"time":50.255,"type":"DOWN"},{"time":50.7,"type":"LEFT"},{"time":51.144,"type":"RIGHT"},{"time":51.589,"type":"DOWN"},{"time":52.033,"type":"LEFT"},{"time":52.477,"type":"DOWN"},{"time":52.922,"type":"RIGHT"},{"time":53.366,"type":"UP"},{"time":53.811,"type":"DOWN"},{"time":54.255,"type":"LEFT"},{"time":54.7,"type":"DOWN"},{"time":55.144,"type":"UP"},{"time":55.589,"type":"RIGHT"},{"time":56.033,"type":"DOWN"},{"time":56.477,"type":"LEFT"},{"time":56.922,"type":"UP"},{"time":57.366,"type":"DOWN"},{"time":57.811,"type":"LEFT"},{"time":58.255,"type":"RIGHT"}],"events":[{"time":0.033,"type":"BG_COLOR","color":"#00031a"},{"time":1.144,"type":"BG_COLOR","duration":29.111,"color":"#62a0ea"},{"time":28.144,"type":"BLACKOUT","duration":1.889},{"time":30.255,"type":"CAMERA_BOB_ON"},{"time":30.255,"type":"FLASH"},{"time":30.258,"type":"FX_AQUA","duration":27.525},{"time":36.477,"type":"FLASH"},{"time":36.922,"type":"FLASH"},{"time":37.366,"type":"FLASH"},{"time":43.589,"type":"FLASH"},{"time":44.033,"type":"FLASH"},{"time":44.477,"type":"NOTES_FLOW_RIGHT"},{"time":44.477,"type":"FLASH"},{"time":50.7,"type":"FLASH"},{"time":51.144,"type":"FLASH"},{"time":51.589,"type":"FLASH"},{"time":57.783,"type":"FLASH"},{"time":58.255,"type":"FLASH"},{"time":58.7,"type":"BLACKOUT","duration":5.336}],"audioFile":"track.mp3","audioFormat":"mp3"}}};


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
    selectedItem: null, // { kind: 'note' | 'event', item: obj }
    draggingItem: null,
    isScrubbing: false,
    timelineTouchMode: 'scroll',
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

  function snapTime(timeSec) {
    const div = state.snapDivisor;
    if (!div || div <= 0) return roundTime(timeSec);
    const tp = getActiveTimingAt(timeSec);
    const beatSec = 60 / tp.bpm;
    const stepSec = beatSec / div;
    const rel = timeSec - tp.time;
    const snappedRel = Math.round(rel / stepSec) * stepSec;
    return roundTime(Math.max(0, tp.time + snappedRel));
  }

  function stepBySnap(dir) {
    const tp = getActiveTimingAt(state.currentTime);
    const div = state.snapDivisor || 4;
    const stepSec = (60 / tp.bpm) / div;
    setCurrentTime(snapTime(state.currentTime + dir * stepSec));
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
    let flowLeft = false;
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
          break;
        case 'NOTES_FLOW_RIGHT':
          flowLeft = false;
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

    // Считаем комбо (число нот до текущего момента)
    let combo = 0;
    let lastHitNote = null;
    const notes = state.chart.notes;
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].time <= t) {
        combo++;
        if (t - notes[i].time <= 0.35) {
          lastHitNote = notes[i];
        }
      } else {
        break;
      }
    }

    return {
      speed,
      flowLeft,
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

    // Вертикальная линия удара и приёмник (рецептор)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(judgeX, laneY - 68);
    ctx.lineTo(judgeX, laneY + 68);
    ctx.stroke();

    // Кольцо-рецептор
    const recRadius = 24 + (st.lastHitNote ? Math.max(0, 1 - (t - st.lastHitNote.time) / 0.18) * 6 : 0);
    ctx.beginPath();
    ctx.arc(judgeX, laneY, recRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. Отрисовка летящих нот с учётом noteTravelTime и динамического NOTE_SPEED
    const baseTravelSec = Math.max(0.15, (Number(state.chart.noteTravelTime) || 1000) / 1000);
    const effectiveTravelSec = baseTravelSec / st.speed;
    const pushOffsetPx = st.push ? Math.sin(beatPhase * Math.PI * 2) * 18 * beatPulse : 0;

    const notes = state.chart.notes;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const timeUntilHit = n.time - t;
      if (timeUntilHit < -0.12) continue;
      if (timeUntilHit > effectiveTravelSec * 1.15) break;

      // progress = 0 в точке спавна, 1 на линии удара
      const progress = 1 - (timeUntilHit / effectiveTravelSec);
      let nx = spawnX + (judgeX - spawnX) * progress + (st.flowLeft ? -pushOffsetPx : pushOffsetPx);
      let ny = laneY;

      if (st.bounce) {
        ny += Math.sin((t * 11) + n.time * 9) * 20;
      }
      if (st.noteWave) {
        ny += Math.sin((n.time - t) * 8.5 + t * 5.5) * 22;
      }
      if (st.activeFx.FX_WAVE || st.activeFx.FX_AQUA) {
        ny += Math.sin(nx * 0.035 + t * 12) * 10;
      }

      const extraSpin = st.spin ? (t * 7.5 + n.time * 4.0) : 0;
      const alpha = timeUntilHit < 0 ? Math.max(0, 1 + timeUntilHit / 0.12) : 1;
      const isSelected = state.selectedItem && state.selectedItem.kind === 'note' && state.selectedItem.item === n;
      drawSwipeNote(ctx, nx, ny, 21, n.type, alpha, isSelected, extraSpin);
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

  // --- Отрисовка многодорожечного таймлайна ---
  function getTimelineTrackLayout(H) {
    return {
      rulerBottom: 24,
      waveTop: 24,
      waveBottom: 76,
      notesTop: 76,
      notesBottom: 148,
      textSpeedTop: 148,
      textSpeedBottom: 196,
      fxTop: 196,
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
    const W = canvas.width;
    const H = canvas.height;
    const labelW = 118;
    const layout = getTimelineTrackLayout(H);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);

    // Полосы дорожек
    const bands = [
      { y1: layout.waveTop, y2: layout.waveBottom, bg: '#0f172a', title: 'АУДИО / БИТЫ' },
      { y1: layout.notesTop, y2: layout.notesBottom, bg: '#111827', title: 'НОТЫ (СВАЙПЫ)' },
      { y1: layout.textSpeedTop, y2: layout.textSpeedBottom, bg: '#0f172a', title: 'TEXT / SPEED' },
      { y1: layout.fxTop, y2: layout.fxBottom, bg: '#111827', title: 'ЭФФЕКТЫ / FX' }
    ];

    for (const b of bands) {
      ctx.fillStyle = b.bg;
      ctx.fillRect(labelW, b.y1, W - labelW, b.y2 - b.y1);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, b.y2);
      ctx.lineTo(W, b.y2);
      ctx.stroke();
    }

    const startTime = Math.max(0, xToTime(labelW, labelW));
    const endTime = xToTime(W, labelW);

    // 1. Сетка долей и поддолей (BPM + gridOffset)
    const tp = getActiveTimingAt(startTime);
    const beatSec = 60 / tp.bpm;
    const div = state.snapDivisor || 4;
    const stepSec = beatSec / div;

    if (stepSec * state.zoomPxPerSec >= 5) {
      const firstIndex = Math.floor((startTime - tp.time) / stepSec);
      const lastIndex = Math.ceil((endTime - tp.time) / stepSec);

      for (let idx = firstIndex; idx <= lastIndex; idx++) {
        const bt = tp.time + idx * stepSec;
        if (bt < 0) continue;
        const x = timeToX(bt, labelW);
        if (x < labelW || x > W) continue;

        const isMeasure = idx % (div * 4) === 0;
        const isBeat = idx % div === 0;

        ctx.beginPath();
        ctx.moveTo(x, layout.rulerBottom);
        ctx.lineTo(x, H);
        if (isMeasure) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
          ctx.lineWidth = 1.4;
        } else if (isBeat) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();

        if (isBeat && (beatSec * state.zoomPxPerSec >= 26 || isMeasure)) {
          ctx.fillStyle = isMeasure ? '#e2e8f0' : '#64748b';
          ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(bt.toFixed(2) + 's', x + 3, 15);
        }
      }
    }

    // 2. Звуковая волна (Waveform)
    if (state.waveformPeaks && state.waveformPeaks.length > 0 && state.duration > 0) {
      const peaks = state.waveformPeaks;
      const midY = (layout.waveTop + layout.waveBottom) / 2;
      const halfH = (layout.waveBottom - layout.waveTop) * 0.44;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = labelW; px < W; px += 2) {
        const t = xToTime(px, labelW);
        if (t < 0 || t > state.duration) continue;
        const pIdx = Math.min(peaks.length - 1, Math.floor((t / state.duration) * peaks.length));
        const amp = peaks[pIdx] || 0;
        ctx.moveTo(px, midY - amp * halfH);
        ctx.lineTo(px, midY + amp * halfH);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#475569';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Загрузи .swmap или аудиофайл (.ogg/.mp3/.wav) для отображения звуковой волны', labelW + 14, (layout.waveTop + layout.waveBottom) / 2 + 4);
    }

    // Точки темпа (timing) на дорожке волны
    if (Array.isArray(state.chart.timing)) {
      for (const tpt of state.chart.timing) {
        const tx = timeToX(tpt.time, labelW);
        if (tx < labelW || tx > W) continue;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(tx - 1, layout.waveTop, 2, layout.waveBottom - layout.waveTop);
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.fillText(`${tpt.bpm} BPM`, tx + 4, layout.waveTop + 12);
      }
    }

    // 3. Дорожка нот
    const notesMidY = (layout.notesTop + layout.notesBottom) / 2;
    const notes = state.chart.notes;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.time < startTime - 0.5) continue;
      if (n.time > endTime + 0.5) break;
      const nx = timeToX(n.time, labelW);
      const isSel = state.selectedItem && state.selectedItem.kind === 'note' && state.selectedItem.item === n;
      drawSwipeNote(ctx, nx, notesMidY, 16, n.type, 1, isSel);
    }

    // 4. Дорожки событий (TEXT / NOTE_SPEED и остальные эффекты)
    const events = state.chart.events;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const dur = Number(ev.duration) > 0 ? Number(ev.duration) : 0;
      if (ev.time + dur < startTime - 0.5) continue;
      if (ev.time > endTime + 0.5) break;

      const def = EVENT_MAP[ev.type] || { short: ev.type, color: '#94a3b8' };
      const isTextOrSpeed = ev.type === 'TEXT' || ev.type === 'NOTE_SPEED';
      const bandTop = isTextOrSpeed ? layout.textSpeedTop : layout.fxTop;
      const bandBottom = isTextOrSpeed ? layout.textSpeedBottom : layout.fxBottom;

      // Разносим события по высоте внутри дорожки, чтобы не слипались в один ряд
      const laneIdx = isTextOrSpeed
        ? (ev.type === 'TEXT' ? 0 : 1)
        : (Math.abs(hashCode(ev.type)) % 2);
      const pillH = 19;
      const py = bandTop + 5 + laneIdx * 21;
      const px = timeToX(ev.time, labelW);
      const pw = Math.max(24, dur > 0 ? dur * state.zoomPxPerSec : 54);

      const isSel = state.selectedItem && state.selectedItem.kind === 'event' && state.selectedItem.item === ev;

      ctx.save();
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(px, py, pw, pillH);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSel ? '#ffffff' : def.color;
      ctx.lineWidth = isSel ? 2.2 : 1.2;
      ctx.strokeRect(px, py, pw, pillH);

      // Левый маркер момента срабатывания
      ctx.fillStyle = def.color;
      ctx.fillRect(px, py, 4, pillH);

      let tag = def.short || ev.type;
      if (ev.type === 'TEXT') {
        tag = `TEXT: "${ev.text || ''}"`;
      } else if (ev.type === 'NOTE_SPEED') {
        tag = `SPEED ${ev.speed}x`;
      } else if (dur > 0) {
        tag = `${def.short} (${dur}s)`;
      }

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, px + 7, py + pillH / 2);
      ctx.restore();
    }

    // 5. Левая колонка подписей дорожек
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, labelW, H);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(labelW, 0);
    ctx.lineTo(labelW, H);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ТАЙМКОД / СЕТКА', 10, 12);
    for (const b of bands) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(b.title, 10, (b.y1 + b.y2) / 2);
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, b.y2);
      ctx.lineTo(labelW, b.y2);
      ctx.stroke();
    }

    // 6. Курсор воспроизведения (Playhead)
    const playX = timeToX(state.currentTime, labelW);
    if (playX >= labelW && playX <= W) {
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, H);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(playX - 7, 0);
      ctx.lineTo(playX + 7, 0);
      ctx.lineTo(playX, 11);
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

  // --- Поиск элемента под курсором на таймлайне ---
  function hitTestTimeline(mx, my) {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return null;
    const labelW = 118;
    if (mx < labelW) return null;
    const layout = getTimelineTrackLayout(canvas.height);

    // Проверяем ноты
    if (my >= layout.notesTop && my <= layout.notesBottom) {
      const notesMidY = (layout.notesTop + layout.notesBottom) / 2;
      for (let i = state.chart.notes.length - 1; i >= 0; i--) {
        const n = state.chart.notes[i];
        const nx = timeToX(n.time, labelW);
        if (Math.hypot(mx - nx, my - notesMidY) <= 18) {
          return { kind: 'note', item: n };
        }
      }
      return { kind: 'empty_note_lane' };
    }

    // Проверяем события
    if (my >= layout.textSpeedTop) {
      const isTextOrSpeedLane = my < layout.textSpeedBottom;
      for (let i = state.chart.events.length - 1; i >= 0; i--) {
        const ev = state.chart.events[i];
        const isTS = ev.type === 'TEXT' || ev.type === 'NOTE_SPEED';
        if (isTS !== isTextOrSpeedLane) continue;

        const bandTop = isTS ? layout.textSpeedTop : layout.fxTop;
        const laneIdx = isTS ? (ev.type === 'TEXT' ? 0 : 1) : (Math.abs(hashCode(ev.type)) % 2);
        const py = bandTop + 5 + laneIdx * 21;
        const pillH = 19;
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

  // --- Операции с нотами и событиями ---
  function addOrReplaceNoteAt(timeSec, noteType) {
    pushUndo();
    const t = roundTime(timeSec);
    // На одной временной точке в pizdydal могут стоять сдвоенные ноты (если зажат Alt), иначе заменяем
    const existingIdx = state.chart.notes.findIndex(n => Math.abs(n.time - t) < 0.008);
    let noteObj;
    if (existingIdx !== -1) {
      state.chart.notes[existingIdx].type = noteType;
      noteObj = state.chart.notes[existingIdx];
    } else {
      noteObj = { time: t, type: noteType };
      state.chart.notes.push(noteObj);
    }

    // Автоматическая привязка REVERSE -> NOTES_FLOW_RIGHT и REVERSE_BACK -> NOTES_FLOW_LEFT (как в pizdydal.swmap)
    const autoFlowCheck = document.getElementById('reverse-autoflow-check');
    if (autoFlowCheck && autoFlowCheck.checked && (noteType === 'REVERSE' || noteType === 'REVERSE_BACK')) {
      const targetFlow = noteType === 'REVERSE' ? 'NOTES_FLOW_RIGHT' : 'NOTES_FLOW_LEFT';
      const hasFlow = state.chart.events.some(
        e => Math.abs(e.time - t) < 0.008 && (e.type === 'NOTES_FLOW_RIGHT' || e.type === 'NOTES_FLOW_LEFT')
      );
      if (!hasFlow) {
        state.chart.events.push({ time: t, type: targetFlow });
      }
    }

    sortChart();
    state.selectedItem = { kind: 'note', item: noteObj };
    refreshAllViews();
    if (state.hitsoundEnabled) playTick(1200, 0.15, 0.03, 'triangle');
    setStatus(`Нота ${noteType} поставлена на ${t.toFixed(3)} сек`);
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
          <div class="insp-actions">
            <button type="button" class="btn btn-danger" id="insp-delete-btn">Удалить ноту</button>
          </div>
        </div>
      `;
      document.getElementById('insp-note-time').addEventListener('change', (e) => {
        pushUndo();
        item.time = roundTime(Number(e.target.value) || 0);
        sortChart();
        refreshAllViews();
      });
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

  function refreshAllViews() {
    renderPreviewCanvas();
    renderTimelineCanvas();
    renderInspector();
    renderEventsList();
    renderTimingTable();
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
    state.meta.difficulty = Math.min(10, Math.max(1, Number(getVal('meta-difficulty')) || 5));
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
      if (mx < labelW) return;

      const hit = hitTestTimeline(mx, my);

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

      // Двойной или обычный клик по дорожке нот — ставим активную ноту
      if (hit && hit.kind === 'empty_note_lane' && e.detail >= 2) {
        const clickedTime = snapTime(xToTime(mx, labelW));
        addOrReplaceNoteAt(clickedTime, state.activeNoteType);
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
        state.draggingItem.item.time = newT;
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

    // 8. Пресеты всех 11 карт официального плейлиста Swipetava OST (из charts.zip)
    const ostSelect = document.getElementById('select-ost-preset');
    const btnLoadOst = document.getElementById('btn-load-ost-preset');
    if (ostSelect && typeof OST_PRESETS === 'object') {
      const keys = Object.keys(OST_PRESETS);
      ostSelect.innerHTML = keys.map((k) => {
        const p = OST_PRESETS[k];
        const nLen = (p.chart && p.chart.notes) ? p.chart.notes.length : 0;
        const eLen = (p.chart && p.chart.events) ? p.chart.events.length : 0;
        const bpm = (p.chart && p.chart.bpm) ? p.chart.bpm : 120;
        return `<option value="${escapeHtml(k)}" ${k === 'Hi-Tech' ? 'selected' : ''}>${escapeHtml(k)} (${bpm} BPM · ${nLen} нот · ${eLen} ивентов)</option>`;
      }).join('');
    }
    function loadOstPreset(key) {
      if (!OST_PRESETS || !OST_PRESETS[key]) return;
      pushUndo();
      const copy = JSON.parse(JSON.stringify(OST_PRESETS[key]));
      state.meta = Object.assign({
        title: key,
        artist: 'Swipetava OST',
        difficulty: 5,
        menu_color: '#2a0a5e'
      }, copy.meta || {});
      const ch = copy.chart || {};
      state.chart = {
        bpm: Number(ch.bpm) || 120,
        noteTravelTime: Number(ch.noteTravelTime) || 1000,
        gridOffset: Number(ch.gridOffset) || 0,
        timing: Array.isArray(ch.timing) && ch.timing.length ? ch.timing : [{ time: Number(ch.gridOffset) || 0, bpm: Number(ch.bpm) || 120 }],
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
      if (!state.audioBuffer) state.duration = maxT + 5;
      state.selectedItem = null;
      state.timelineScrollX = 0;
      syncMetaAndChartInputs();
      setCurrentTime(0);
      refreshAllViews();
      setStatus(`Загружена официальная карта OST «${key}» (${state.chart.notes.length} нот, ${state.chart.events.length} событий)`);
    }
    if (btnLoadOst && ostSelect) {
      btnLoadOst.addEventListener('click', () => loadOstPreset(ostSelect.value));
    }

    // 9. Автономный конвертер файлов Godot 4 (.ctex -> .png, .oggvorbisstr -> .ogg) для Android / ПК
    const inputGodotConv = document.getElementById('input-godot-converter');
    const godotConvStatus = document.getElementById('godot-converter-status');
    const checkGodotApply = document.getElementById('check-godot-apply-map');
    if (inputGodotConv) {
      inputGodotConv.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const applyToMap = checkGodotApply ? checkGodotApply.checked : true;
        const logs = [];
        for (const f of files) {
          try {
            const buf = await f.arrayBuffer();
            const lower = f.name.toLowerCase();
            if (lower.endsWith('.ctex') || lower.endsWith('.stex')) {
              const outName = f.name.replace(/\.(ctex|stex)$/i, '') + '.png';
              const conv = await window.SwmapZip.convertGodotTexture(buf, outName);
              downloadBlob(new Blob([conv.bytes], { type: 'image/png' }), conv.fileName);
              if (applyToMap) {
                const targetKind = /bg|background/i.test(f.name) ? 'bg' : 'cover';
                await loadImageFromBytes(conv.bytes, targetKind, targetKind === 'bg' ? 'bg.png' : 'Cover.png');
                syncMetaAndChartInputs();
              }
              logs.push(`${f.name} → ${conv.fileName} (${conv.sourceFormat} ${conv.width}×${conv.height})`);
            } else if (lower.endsWith('.oggvorbisstr') || lower.endsWith('.oggstr')) {
              const outName = f.name.replace(/\.(oggvorbisstr|oggstr)$/i, '') + '.ogg';
              const conv = window.SwmapZip.convertGodotOggVorbis(buf, outName);
              downloadBlob(new Blob([conv.bytes], { type: 'audio/ogg' }), conv.fileName);
              if (applyToMap) {
                await loadAudioFromBytes(conv.bytes, 'track.ogg', 'audio/ogg');
                syncMetaAndChartInputs();
              }
              logs.push(`${f.name} → ${conv.fileName} (${conv.packetsCount} пакетов, ${conv.sampleRate} Гц)`);
            } else {
              logs.push(`${f.name}: выбери файл .ctex или .oggvorbisstr`);
            }
          } catch (err) {
            logs.push(`Ошибка ${f.name}: ${err.message}`);
          }
        }
        const msg = logs.join(' | ');
        if (godotConvStatus) godotConvStatus.textContent = msg;
        setStatus(msg);
        inputGodotConv.value = '';
      });
    }

    // 10. Тач-управление таймлайном на телефонах (режимы Скролл / Карандаш / Ластик + Пинч-зум 2 пальцами)
    document.querySelectorAll('[data-touch-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.timelineTouchMode = btn.getAttribute('data-touch-mode') || 'scroll';
        document.querySelectorAll('[data-touch-mode]').forEach((b) => b.classList.toggle('active', b === btn));
        const titles = {
          scroll: 'Прокрутка и курсор (1 палец — двигать, 2 пальца — масштаб)',
          draw: 'Карандаш (тап по дорожке ставит ноту/ивент, перетаскивание двигает)',
          erase: 'Ластик (тап по ноте или событию удаляет его)'
        };
        setStatus(`Тач-режим таймлайна: ${titles[state.timelineTouchMode] || state.timelineTouchMode}`);
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
        if (mx < labelW) return;

        const hit = hitTestTimeline(mx, my);
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
            addOrReplaceNoteAt(tappedTime, state.activeNoteType);
            setCurrentTime(tappedTime);
          } else if (hit && hit.kind === 'empty_event_lane') {
            addEventFromForm(tappedTime);
            setCurrentTime(tappedTime);
          } else {
            setCurrentTime(tappedTime);
          }
          return;
        }

        // Режим 'scroll': если нажали по верхней линейке (my < 28) — двигаем курсор, иначе скроллим таймлайн
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
          state.draggingItem.item.time = snapTime(xToTime(mx, labelW));
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

    // 11. Сенсорный Свайп-Пад для телефонов (свайп пальцем в 8 сторон ставит ноту как в самой игре)
    const swipePad = document.getElementById('touch-swipe-pad');
    const swipeStatus = document.getElementById('touch-swipe-status');
    const checkSwipeStep = document.getElementById('check-swipe-autoadvance');
    if (swipePad) {
      let swipeStart = null;

      const vectorToSwipeDir = (dx, dy) => {
        if (Math.hypot(dx, dy) < 18) return null;
        const deg = Math.atan2(dy, dx) * (180 / Math.PI);
        if (deg >= -22.5 && deg < 22.5) return 'RIGHT';
        if (deg >= 22.5 && deg < 67.5) return 'DOWN_RIGHT';
        if (deg >= 67.5 && deg < 112.5) return 'DOWN';
        if (deg >= 112.5 && deg < 157.5) return 'DOWN_LEFT';
        if (deg >= -67.5 && deg < -22.5) return 'UP_RIGHT';
        if (deg >= -112.5 && deg < -67.5) return 'UP';
        if (deg >= -157.5 && deg < -112.5) return 'UP_LEFT';
        return 'LEFT';
      };

      const highlightSwipeDir = (dir) => {
        swipePad.querySelectorAll('[data-swipe-sector]').forEach((el) => {
          el.classList.toggle('active', el.getAttribute('data-swipe-sector') === dir);
        });
        if (swipeStatus) {
          if (dir && NOTE_MAP[dir]) {
            swipeStatus.textContent = `${NOTE_MAP[dir].short} ${dir}`;
            swipeStatus.style.color = NOTE_MAP[dir].color;
          } else {
            swipeStatus.textContent = 'Свайпни пальцем в любую из 8 сторон';
            swipeStatus.style.color = '';
          }
        }
      };

      const triggerSwipeNote = (dir) => {
        if (!dir || !NOTE_MAP[dir]) return;
        state.activeNoteType = dir;
        document.querySelectorAll('[data-note-type]').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-note-type') === dir);
          b.classList.toggle('active-pill', b.getAttribute('data-note-type') === dir);
        });
        const targetTime = state.isPlaying ? state.currentTime : snapTime(state.currentTime);
        addOrReplaceNoteAt(targetTime, dir);
        if (checkSwipeStep && checkSwipeStep.checked && !state.isPlaying) {
          stepBySnap(1);
        }
        highlightSwipeDir(dir);
        setTimeout(() => highlightSwipeDir(null), 220);
      };

      let lastSwipeCommitMs = 0;
      const commitOnce = (dir) => {
        const now = performance.now();
        if (now - lastSwipeCommitMs < 60) return;
        lastSwipeCommitMs = now;
        triggerSwipeNote(dir);
      };

      swipePad.addEventListener('pointerdown', (e) => {
        const startSector = (e.target && e.target.closest) ? e.target.closest('[data-swipe-sector]') : null;
        swipeStart = {
          x: e.clientX,
          y: e.clientY,
          sectorDir: startSector ? startSector.getAttribute('data-swipe-sector') : null
        };
      });

      swipePad.addEventListener('pointermove', (e) => {
        if (!swipeStart) return;
        const dir = vectorToSwipeDir(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
        highlightSwipeDir(dir);
      });

      swipePad.addEventListener('pointerup', (e) => {
        if (!swipeStart) return;
        let dir = vectorToSwipeDir(e.clientX - swipeStart.x, e.clientY - swipeStart.y);
        if (!dir && swipeStart.sectorDir) {
          dir = swipeStart.sectorDir;
        }
        swipeStart = null;
        if (dir) commitOnce(dir);
        else highlightSwipeDir(null);
      });

      swipePad.querySelectorAll('[data-swipe-sector]').forEach((sec) => {
        sec.addEventListener('click', () => {
          const dir = sec.getAttribute('data-swipe-sector');
          if (dir) commitOnce(dir);
        });
      });

      const btnTouchRev = document.getElementById('btn-touch-rev');
      const btnTouchRevBack = document.getElementById('btn-touch-rev-back');
      const btnTouchDel = document.getElementById('btn-touch-del');
      if (btnTouchRev) btnTouchRev.addEventListener('click', () => triggerSwipeNote('REVERSE'));
      if (btnTouchRevBack) btnTouchRevBack.addEventListener('click', () => triggerSwipeNote('REVERSE_BACK'));
      if (btnTouchDel) {
        btnTouchDel.addEventListener('click', () => {
          const t = snapTime(state.currentTime);
          const idx = state.chart.notes.findIndex((n) => Math.abs(n.time - t) < 0.015);
          if (idx !== -1) {
            pushUndo();
            const removed = state.chart.notes.splice(idx, 1)[0];
            refreshAllViews();
            setStatus(`Удалена нота ${removed.type} на ${t.toFixed(3)} сек`);
          } else {
            deleteSelectedItem();
          }
        });
      }
    }

    // 12. Переключатель мобильных вкладок на узких экранах
    document.querySelectorAll('[data-mob-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-mob-tab') || 'all';
        document.querySelectorAll('[data-mob-tab]').forEach((b) => b.classList.toggle('active', b === btn));
        document.body.setAttribute('data-mob-view', tab);
        setTimeout(resizeTimeline, 20);
      });
    });

    // Подгонка размеров канваса таймлайна под ширину окна
    const resizeTimeline = () => {
      const wrap = document.getElementById('timeline-wrap');
      if (wrap && tlCanvas) {
        tlCanvas.width = Math.max(360, wrap.clientWidth);
        renderTimelineCanvas();
      }
    };
    window.addEventListener('resize', resizeTimeline);
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

    // Шанс 1 из 50 при обновлении страницы
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
