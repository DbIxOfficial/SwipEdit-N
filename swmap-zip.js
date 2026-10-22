/**
 * swmap-zip.js
 * Автономный модуль чтения и сборки архивов .swmap (ZIP) в браузере без внешних зависимостей,
 * со встроенной скрытой крипто-меткой SwipEdit (в заголовках PKZIP и JSON) и детектором сторонних редакторов.
 */
(function (global) {
  'use strict';

  const CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder('utf-8');

  /**
   * Вычисляет детерминированный скрытый отпечаток содержимого карты для проверки подлинности SwipEdit.
   */
  function computeWatermarkTag(chartObj, metaObj) {
    const c = chartObj || {};
    const m = metaObj || {};
    const notes = Array.isArray(c.notes) ? c.notes : [];
    const events = Array.isArray(c.events) ? c.events : [];

    const parts = [
      'SWIPEDIT_V2_SALT_9F3A',
      String(Number(c.bpm) || 120),
      String(Number(c.noteTravelTime) || 1000),
      String(Math.round((Number(c.gridOffset) || 0) * 1000)),
      String(m.title || c.title || '').trim(),
      String(m.artist || c.artist || '').trim(),
      String(Number(m.difficulty !== undefined ? m.difficulty : 5)),
      String(notes.length),
      String(events.length)
    ];

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      parts.push(`${Math.round((Number(n.time) || 0) * 1000)}:${n.type || ''}`);
    }
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      parts.push(
        `${Math.round((Number(ev.time) || 0) * 1000)}:${ev.type || ''}:${
          ev.duration !== undefined ? Math.round(Number(ev.duration) * 1000) : ''
        }:${ev.speed !== undefined ? Number(ev.speed) : ''}:${ev.text || ''}`
      );
    }

    const rawBytes = textEncoder.encode(parts.join('|'));
    const h1 = crc32(rawBytes) >>> 0;
    const h2 = ((h1 ^ 0x53574544) >>> 0).toString(16).padStart(8, '0');
    return `se2:${h2}`;
  }

  /**
   * Анализирует распакованную карту и метаданные ZIP-архива:
   * возвращает { isSwipEdit, editor, label, detail }
   */
  function inspectMapOrigin(chartObj, metaObj, zipMeta, rawChartText) {
    const expectedTag = computeWatermarkTag(chartObj, metaObj);
    const chartTag = chartObj && typeof chartObj._se_rev === 'string' ? chartObj._se_rev : '';
    const metaTag = metaObj && typeof metaObj._se_sig === 'string' ? metaObj._se_sig : '';
    const hasZipExtra = !!(zipMeta && zipMeta.hasSwipEditExtra);

    if (chartTag === expectedTag && (!metaObj || !metaTag || metaTag === expectedTag)) {
      return {
        isSwipEdit: true,
        editor: 'SwipEdit',
        label: '🟢 Создано в SwipEdit',
        detail: hasZipExtra
          ? 'Подпись SwipEdit (внутри chart.json, meta.json и заголовков ZIP) полностью совпала.'
          : 'Подпись SwipEdit внутри JSON совпала с содержимым чарта.'
      };
    }

    if (chartTag || metaTag || hasZipExtra) {
      return {
        isSwipEdit: false,
        editor: 'Modified External',
        label: '🔴 Пересохранено в другом редакторе',
        detail:
          'В файле остались следы SwipEdit, но ноты или структура были перезаписаны сторонним редактором — возможны перенесённые баги.'
      };
    }

    // Эвристика для определения конкретного конкурента
    const methods = (zipMeta && zipMeta.methods) || {};
    const versions = (zipMeta && zipMeta.versionsMadeBy) || {};
    const rawStr = String(rawChartText || '');

    if (
      methods['chart.json'] === 8 ||
      (chartObj && chartObj.coverFile === 'cover.png') ||
      (rawStr.startsWith('{"bpm":') && rawStr.indexOf('"noteTravelTime"') > rawStr.indexOf('"events"'))
    ) {
      return {
        isSwipEdit: false,
        editor: 'SWME (KORT3X)',
        label: '🔴 Создано в другом редакторе (SWME)',
        detail:
          'Карта создана в редакторе SWME (JSZip Deflate). Могут быть перенесены ошибки синка, задержки звука или реверсов.'
      };
    }

    if (
      methods['chart.json'] === 0 &&
      versions['chart.json'] === 20 &&
      rawStr.length > 0 &&
      !rawStr.includes('\n')
    ) {
      return {
        isSwipEdit: false,
        editor: 'Waxai Editor',
        label: '🔴 Создано в другом редакторе (Waxai)',
        detail:
          'Карта создана в редакторе от Waxai (STORE без подписи SwipEdit). Могут быть перенесены ошибки из стороннего редактора.'
      };
    }

    return {
      isSwipEdit: false,
      editor: 'External',
      label: '🔴 Создано в другом редакторе',
      detail:
        'Внутри .swmap нет скрытой метки SwipEdit — карта создана в стороннем редакторе, из-за чего могут быть перенесены чужие ошибки.'
    };
  }

  async function inflateRaw(compressedBytes, uncompressedSize) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Браузер не поддерживает DecompressionStream для распаковки DEFLATE');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedBytes);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    const out = new Uint8Array(uncompressedSize || total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  async function deflateRaw(rawBytes) {
    if (typeof CompressionStream === 'undefined') {
      return null;
    }
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();

      const reader = cs.readable.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return out;
    } catch (_) {
      return null;
    }
  }

  /**
   * Читает архив .swmap (ZIP) из ArrayBuffer или Uint8Array.
   * Возвращает { files, methods, zipMeta }
   */
  async function readSwmapArchive(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    let eocdOffset = -1;
    const minEocdOffset = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minEocdOffset; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Файл не является корректным ZIP / .swmap архивом (не найден EOCD)');
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    const files = {};
    const methods = {};
    const versionsMadeBy = {};
    const entryOrder = [];
    let hasSwipEditExtra = false;
    let ptr = cdOffset;

    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) {
        throw new Error('Поврежден заголовок Central Directory в .swmap');
      }
      const versionMadeBy = view.getUint16(ptr + 4, true);
      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const uncompSize = view.getUint32(ptr + 24, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
      const fileName = textDecoder.decode(nameBytes);

      // Проверяем скрытое extra-поле 0x5753 ('SW') в Central Directory
      if (extraLen >= 12) {
        const extraStart = ptr + 46 + nameLen;
        const extraId = view.getUint16(extraStart, true);
        const extraDataLen = view.getUint16(extraStart + 2, true);
        if (extraId === 0x5753 && extraDataLen === 8) {
          const sig0 = view.getUint32(extraStart + 4, true);
          if (sig0 === 0x21324553) { // 'SE2!'
            hasSwipEditExtra = true;
          }
        }
      }

      ptr += 46 + nameLen + extraLen + commentLen;

      if (fileName.endsWith('/')) continue;

      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(`Поврежден Local File Header для ${fileName}`);
      }
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const rawSlice = bytes.subarray(dataStart, dataStart + compSize);

      if (method === 0) {
        files[fileName] = new Uint8Array(rawSlice);
      } else if (method === 8) {
        files[fileName] = await inflateRaw(rawSlice, uncompSize);
      } else {
        throw new Error(`Неподдерживаемый метод сжатия ZIP (${method}) в файле ${fileName}`);
      }
      methods[fileName] = method;
      versionsMadeBy[fileName] = versionMadeBy;
      entryOrder.push(fileName);
    }

    return {
      files,
      methods,
      zipMeta: {
        methods,
        versionsMadeBy,
        entryOrder,
        hasSwipEditExtra
      }
    };
  }

  /**
   * Собирает архив .swmap (ZIP) со скрытой PKZIP-меткой SwipEdit в Central Directory.
   */
  async function writeSwmapArchive(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    const now = new Date();
    const dosTime =
      ((now.getHours() & 0x1F) << 11) |
      ((now.getMinutes() & 0x3F) << 5) |
      ((now.getSeconds() >> 1) & 0x1F);
    const dosDate =
      (((now.getFullYear() - 1980) & 0x7F) << 9) |
      (((now.getMonth() + 1) & 0x0F) << 5) |
      (now.getDate() & 0x1F);

    for (const entry of entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const rawData =
        typeof entry.data === 'string'
          ? textEncoder.encode(entry.data)
          : entry.data instanceof Uint8Array
          ? entry.data
          : new Uint8Array(entry.data);

      const crc = crc32(rawData);
      let method = 0;
      let storedData = rawData;

      if (entry.compress) {
        const deflated = await deflateRaw(rawData);
        if (deflated && deflated.byteLength < rawData.byteLength) {
          method = 8;
          storedData = deflated;
        }
      }

      // Для chart.json и meta.json встраиваем 12-байтное PKZIP Extra Field (0x5753 = 'SW')
      const isSignedJson = entry.name === 'chart.json' || entry.name === 'meta.json';
      const extraBytes = isSignedJson ? new Uint8Array(12) : new Uint8Array(0);
      if (isSignedJson) {
        const exView = new DataView(extraBytes.buffer);
        exView.setUint16(0, 0x5753, true); // 'SW'
        exView.setUint16(2, 8, true);      // 8 bytes payload
        exView.setUint32(4, 0x21324553, true); // 'SE2!'
        exView.setUint32(8, (crc ^ 0x53574544) >>> 0, true);
      }

      const localHeader = new Uint8Array(30 + nameBytes.length + extraBytes.length);
      const lhView = new DataView(localHeader.buffer);
      lhView.setUint32(0, 0x04034b50, true);
      lhView.setUint16(4, 20, true);
      lhView.setUint16(6, 0x0800, true); // UTF-8
      lhView.setUint16(8, method, true);
      lhView.setUint16(10, dosTime, true);
      lhView.setUint16(12, dosDate, true);
      lhView.setUint32(14, crc, true);
      lhView.setUint32(18, storedData.byteLength, true);
      lhView.setUint32(22, rawData.byteLength, true);
      lhView.setUint16(26, nameBytes.length, true);
      lhView.setUint16(28, extraBytes.length, true);
      localHeader.set(nameBytes, 30);
      if (extraBytes.length) localHeader.set(extraBytes, 30 + nameBytes.length);

      const centralHeader = new Uint8Array(46 + nameBytes.length + extraBytes.length);
      const chView = new DataView(centralHeader.buffer);
      chView.setUint32(0, 0x02014b50, true);
      chView.setUint16(4, 0x033F, true); // SwipEdit versionMadeBy marker
      chView.setUint16(6, 20, true);
      chView.setUint16(8, 0x0800, true); // UTF-8
      chView.setUint16(10, method, true);
      chView.setUint16(12, dosTime, true);
      chView.setUint16(14, dosDate, true);
      chView.setUint32(16, crc, true);
      chView.setUint32(20, storedData.byteLength, true);
      chView.setUint32(24, rawData.byteLength, true);
      chView.setUint16(28, nameBytes.length, true);
      chView.setUint16(30, extraBytes.length, true);
      chView.setUint16(32, 0, true);
      chView.setUint16(34, 0, true);
      chView.setUint16(36, 0, true);
      chView.setUint32(38, 0, true);
      chView.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);
      if (extraBytes.length) centralHeader.set(extraBytes, 46 + nameBytes.length);

      localParts.push(localHeader, storedData);
      centralParts.push(centralHeader);
      offset += localHeader.byteLength + storedData.byteLength;
    }

    let cdSize = 0;
    for (const part of centralParts) cdSize += part.byteLength;

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, entries.length, true);
    eocdView.setUint16(10, entries.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, eocd], {
      type: 'application/octet-stream'
    });
  }

  async function readSwmapZip(input) {
    let buf;
    if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
      buf = input;
    } else if (input && typeof input.arrayBuffer === 'function') {
      buf = await input.arrayBuffer();
    } else {
      throw new Error('Неподдерживаемый источник для readSwmapZip');
    }
    return readSwmapArchive(buf);
  }

  async function writeSwmapZip(filesMap, compressMap) {
    if (Array.isArray(filesMap)) {
      return writeSwmapArchive(filesMap);
    }
    const cMap = compressMap || {};
    const orderedKeys = ['Cover.png', 'bg.png', 'chart.json', 'meta.json', 'track.ogg'];
    const allKeys = Object.keys(filesMap);
    const sortedKeys = [];

    for (const k of orderedKeys) {
      if (Object.prototype.hasOwnProperty.call(filesMap, k)) {
        sortedKeys.push(k);
      }
    }
    for (const k of allKeys) {
      if (!sortedKeys.includes(k)) {
        sortedKeys.push(k);
      }
    }

    const entries = sortedKeys.map((name) => ({
      name,
      data: filesMap[name],
      compress: Boolean(cMap[name])
    }));
    return writeSwmapArchive(entries);
  }

  global.SwmapZip = {
    readSwmapArchive,
    writeSwmapArchive,
    readSwmapZip,
    writeSwmapZip,
    computeWatermarkTag,
    inspectMapOrigin,
    encodeText: (str) => textEncoder.encode(str),
    decodeText: (bytes) => textDecoder.decode(bytes),
    crc32
  };
})(window);
