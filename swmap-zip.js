/**
 * swmap-zip.js
 * Автономный модуль чтения и сборки архивов .swmap (ZIP) в браузере без внешних зависимостей,
 * со встроенной скрытой крипто-меткой SwipEdit (в заголовках PKZIP и JSON) и детектором сторонних редакторов
 * (Swipetava Maker (dpunov), SWME (KORT3X), Waxai Chart Editor).
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
    const chartTag = chartObj && typeof chartObj._se_rev === 'string' ? chartObj._se_rev : null;
    const metaTag = metaObj && typeof metaObj._se_sig === 'string' ? metaObj._se_sig : null;
    const hasZipExtra = !!(zipMeta && zipMeta.hasSwipEditExtra);

    if (chartTag === expectedTag && (metaTag === expectedTag || hasZipExtra)) {
      return {
        isSwipEdit: true,
        editor: 'SwipEdit',
        label: '🟢 Создано в SwipEdit',
        detail: `Подлинная карта SwipEdit (скрытая подпись ${expectedTag} совпала с содержимым чарта и заголовком архива).`
      };
    }

    if (chartTag || metaTag || hasZipExtra) {
      return {
        isSwipEdit: false,
        editor: 'Modified Externally',
        label: '🔴 Изменено в чужом редакторе',
        detail: 'Карта изначально создавалась в SwipEdit, но была пересохранена или изменена в стороннем редакторе (контрольная сумма нот/событий не совпадает).'
      };
    }

    // Определяем почерк стороннего редактора:
    // 1) Swipetava Maker (dpunov) — Kotlin/Compose APK:
    //    - LevelManager.serializeChart() ставит первым ключом "title" ({"title":...), а "events" всегда пустой массив []
    //    - Java ZipOutputStream пишет DEFLATE (method=8) с потоковым флагом Data Descriptor (flags & 0x08) и versionMadeBy=20
    //    - дефолтный цвет в meta.json: #6954FF
    const trimmedChart = typeof rawChartText === 'string' ? rawChartText.trim() : '';
    const startsWithTitleKey = /^\{\s*"title"\s*:/.test(trimmedChart);
    const hasJavaStreamDeflate = !!(zipMeta && zipMeta.hasDataDescriptorFlag && zipMeta.chartMethod === 8);
    const isDpunovDefaultColor = !!(metaObj && String(metaObj.menu_color || '').toUpperCase() === '#6954FF');
    const hasEmptyEvents = Array.isArray(chartObj && chartObj.events) && chartObj.events.length === 0;

    if (startsWithTitleKey || hasJavaStreamDeflate || (isDpunovDefaultColor && hasEmptyEvents)) {
      return {
        isSwipEdit: false,
        editor: 'Swipetava Maker (dpunov)',
        label: '🔴 Создано в Swipetava Maker',
        detail: 'Обнаружена сигнатура Swipetava Maker: сериализация org.json с первым ключом "title" / Java ZipOutputStream и сбросом всех событий в "events": [].'
      };
    }

    // 2) SWME (KORT3X): сжимает chart.json через JSZip DEFLATE (method=8 без бита 0x08) или пишет coverFile="cover.png" с маленькой буквы
    const isKort3x =
      (zipMeta && zipMeta.chartMethod === 8) ||
      (chartObj && chartObj.coverFile === 'cover.png') ||
      (typeof rawChartText === 'string' && rawChartText.includes('"formatVersion"'));

    if (isKort3x) {
      return {
        isSwipEdit: false,
        editor: 'SWME (KORT3X)',
        label: '🔴 Создано в другом редакторе (SWME)',
        detail: 'В архиве отсутствует скрытая метка SwipEdit; структура ZIP/JSON соответствует редактору SWME (KORT3X). Возможны перенесённые ошибки синка или стаков.'
      };
    }

    // 3) Редактор Waxai: однострочный минифицированный chart.json в STORE (method=0) без переносов строк
    const isSingleLineJson = typeof rawChartText === 'string' && !rawChartText.trim().includes('\n');
    if (isSingleLineJson) {
      return {
        isSwipEdit: false,
        editor: 'Waxai Chart Editor',
        label: '🔴 Создано в другом редакторе (Waxai)',
        detail: 'В архиве отсутствует скрытая метка SwipEdit; однострочная упаковка chart.json соответствует редактору Waxai.'
      };
    }

    return {
      isSwipEdit: false,
      editor: 'External / Unknown',
      label: '🔴 Создано в другом редакторе',
      detail: 'Внутри .swmap не найдена скрытая крипто-метка SwipEdit. Карта собрана в стороннем редакторе или вручную.'
    };
  }

  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined') {
      return null;
    }
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return new Uint8Array(buf);
    } catch (_) {
      return null;
    }
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Браузер не поддерживает DecompressionStream (deflate-raw)');
    }
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  }

  /**
   * Читает .swmap (ZIP) архив из ArrayBuffer / Uint8Array / File / Blob.
   * Возвращает { files: { [filename]: Uint8Array }, zipMeta }.
   */
  async function readSwmapZip(input) {
    let buffer;
    if (input instanceof ArrayBuffer) {
      buffer = input;
    } else if (ArrayBuffer.isView(input)) {
      buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    } else if (input && typeof input.arrayBuffer === 'function') {
      buffer = await input.arrayBuffer();
    } else {
      throw new Error('Неподдерживаемый источник данных для .swmap');
    }

    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    let eocdOffset = -1;
    const minEocdOffset = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minEocdOffset; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error('Файл не является корректным .swmap (ZIP) архивом');
    }

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    const files = {};
    const zipMeta = {
      hasSwipEditExtra: false,
      chartMethod: 0,
      versionMadeBy: 0,
      hasDataDescriptorFlag: false,
      entries: []
    };

    let ptr = cdOffset;
    const cdEnd = cdOffset + cdSize;

    for (let i = 0; i < totalEntries && ptr < cdEnd; i++) {
      const sig = view.getUint32(ptr, true);
      if (sig !== 0x02014b50) {
        throw new Error('Повреждён заголовок Central Directory в .swmap');
      }
      const verMadeBy = view.getUint16(ptr + 4, true);
      const flags = view.getUint16(ptr + 8, true);
      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
      const name = textDecoder.decode(nameBytes);

      if ((flags & 0x08) !== 0) {
        zipMeta.hasDataDescriptorFlag = true;
      }

      if (extraLen >= 8) {
        const extraStart = ptr + 46 + nameLen;
        const extraEnd = extraStart + extraLen;
        let ep = extraStart;
        while (ep + 4 <= extraEnd) {
          const headerId = view.getUint16(ep, true);
          const dataSize = view.getUint16(ep + 2, true);
          if (headerId === 0x5753 && dataSize >= 4 && ep + 8 <= extraEnd) {
            const magic = view.getUint32(ep + 4, true);
            if (magic === 0x21324553) {
              zipMeta.hasSwipEditExtra = true;
            }
          }
          ep += 4 + dataSize;
        }
      }

      if (name === 'chart.json') {
        zipMeta.chartMethod = method;
        zipMeta.versionMadeBy = verMadeBy;
        if (verMadeBy === 0x033F) {
          zipMeta.hasSwipEditExtra = true;
        }
      }
      zipMeta.entries.push({ name, method, verMadeBy, flags });

      ptr += 46 + nameLen + extraLen + commentLen;

      if (name.endsWith('/')) continue;

      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error(`Повреждён Local File Header для ${name}`);
      }
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compData = bytes.subarray(dataStart, dataStart + compSize);

      if (method === 0) {
        files[name] = new Uint8Array(compData);
      } else if (method === 8) {
        files[name] = await inflateRaw(compData);
      } else {
        throw new Error(`Неподдерживаемый метод сжатия ZIP (${method}) в файле ${name}`);
      }
    }

    return { files, zipMeta };
  }

  /**
   * Собирает .swmap (ZIP) архив со скрытым PKZIP Extra Field (0x5753 'SW' -> 'SE2!').
   */
  async function writeSwmapZip(entries) {
    const prepared = [];
    let totalLocalSize = 0;
    let totalCdSize = 0;

    // Скрытое 12-байтное расширение PKZIP Extra Field: HeaderID=0x5753 ('SW'), DataSize=8, Magic='SE2!' (0x21324553)
    const swExtra = new Uint8Array(12);
    const swExtraView = new DataView(swExtra.buffer);
    swExtraView.setUint16(0, 0x5753, true);
    swExtraView.setUint16(2, 8, true);
    swExtraView.setUint32(4, 0x21324553, true);

    for (const item of entries) {
      const nameBytes = textEncoder.encode(item.name);
      let rawBytes;
      if (typeof item.data === 'string') {
        rawBytes = textEncoder.encode(item.data);
      } else if (item.data instanceof Uint8Array) {
        rawBytes = item.data;
      } else if (item.data instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(item.data);
      } else {
        throw new Error(`Некорректные данные для файла ${item.name}`);
      }

      const crc = crc32(rawBytes);
      let method = 0;
      let compBytes = rawBytes;

      if (item.compress) {
        const deflated = await deflateRaw(rawBytes);
        if (deflated && deflated.length < rawBytes.length) {
          method = 8;
          compBytes = deflated;
        }
      }

      const isJsonMeta = item.name === 'chart.json' || item.name === 'meta.json';
      const cdExtraLen = isJsonMeta ? swExtra.length : 0;
      const entryCrc = crc;

      prepared.push({
        nameBytes,
        rawLen: rawBytes.length,
        compBytes,
        compLen: compBytes.length,
        method,
        crc: entryCrc,
        offset: totalLocalSize,
        isJsonMeta,
        cdExtraLen
      });

      totalLocalSize += 30 + nameBytes.length + compBytes.length;
      totalCdSize += 46 + nameBytes.length + cdExtraLen;
    }

    const totalSize = totalLocalSize + totalCdSize + 22;
    const out = new Uint8Array(totalSize);
    const view = new DataView(out.buffer);

    let pos = 0;
    for (const p of prepared) {
      view.setUint32(pos, 0x04034b50, true);
      view.setUint16(pos + 4, 20, true);
      view.setUint16(pos + 6, 0x0800, true);
      view.setUint16(pos + 8, p.method, true);
      view.setUint16(pos + 10, 0, true);
      view.setUint16(pos + 12, 0x554b, true);
      view.setUint32(pos + 14, p.crc, true);
      view.setUint32(pos + 18, p.compLen, true);
      view.setUint32(pos + 22, p.rawLen, true);
      view.setUint16(pos + 26, p.nameBytes.length, true);
      view.setUint16(pos + 28, 0, true);
      out.set(p.nameBytes, pos + 30);
      out.set(p.compBytes, pos + 30 + p.nameBytes.length);
      pos += 30 + p.nameBytes.length + p.compLen;
    }

    const cdStart = pos;
    for (const p of prepared) {
      view.setUint32(pos, 0x02014b50, true);
      view.setUint16(pos + 4, p.isJsonMeta ? 0x033F : 20, true);
      view.setUint16(pos + 6, 20, true);
      view.setUint16(pos + 8, 0x0800, true);
      view.setUint16(pos + 10, p.method, true);
      view.setUint16(pos + 12, 0, true);
      view.setUint16(pos + 14, 0x554b, true);
      view.setUint32(pos + 16, p.crc, true);
      view.setUint32(pos + 20, p.compLen, true);
      view.setUint32(pos + 24, p.rawLen, true);
      view.setUint16(pos + 28, p.nameBytes.length, true);
      view.setUint16(pos + 30, p.cdExtraLen, true);
      view.setUint16(pos + 32, 0, true);
      view.setUint16(pos + 34, 0, true);
      view.setUint16(pos + 36, 0, true);
      view.setUint32(pos + 38, 0, true);
      view.setUint32(pos + 42, p.offset, true);
      out.set(p.nameBytes, pos + 46);
      if (p.isJsonMeta) {
        swExtraView.setUint32(8, p.crc ^ 0x53574544, true);
        out.set(swExtra, pos + 46 + p.nameBytes.length);
      }
      pos += 46 + p.nameBytes.length + p.cdExtraLen;
    }

    const cdSize = pos - cdStart;
    view.setUint32(pos, 0x06054b50, true);
    view.setUint16(pos + 4, 0, true);
    view.setUint16(pos + 6, 0, true);
    view.setUint16(pos + 8, prepared.length, true);
    view.setUint16(pos + 10, prepared.length, true);
    view.setUint32(pos + 12, cdSize, true);
    view.setUint32(pos + 16, cdStart, true);
    view.setUint16(pos + 20, 0, true);

    return out;
  }

  function decodeText(bytes) {
    return textDecoder.decode(bytes);
  }

  function encodeText(str) {
    return textEncoder.encode(str);
  }

  global.SwmapZip = {
    readSwmapZip,
    writeSwmapZip,
    decodeText,
    encodeText,
    crc32,
    computeWatermarkTag,
    inspectMapOrigin
  };
})(typeof window !== 'undefined' ? window : globalThis);
