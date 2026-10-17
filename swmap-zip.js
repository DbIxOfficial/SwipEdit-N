/**
 * swmap-zip.js
 * Автономный модуль чтения и сборки архивов .swmap (ZIP) в браузере без внешних зависимостей,
 * а также конвертер ресурсов Godot 4 / 3 (.oggvorbisstr / .oggstr -> .ogg и .ctex / .stex -> .png).
 */
(function (global) {
  'use strict';

  // Таблица стандартного CRC32 (IEEE 802.3, LSB-first) для ZIP
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

  // Таблица Ogg CRC32 (полином 0x04C11DB7, MSB-first, init 0) для сборки .ogg из .oggvorbisstr
  const OGG_CRC_TABLE = (function () {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = (i << 24) >>> 0;
      for (let k = 0; k < 8; k++) {
        if (r & 0x80000000) {
          r = (((r << 1) >>> 0) ^ 0x04C11DB7) >>> 0;
        } else {
          r = (r << 1) >>> 0;
        }
      }
      table[i] = r >>> 0;
    }
    return table;
  })();

  function oggCrc32(headerBytes, bodyBytes) {
    let crc = 0;
    for (let i = 0; i < headerBytes.length; i++) {
      crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ headerBytes[i]) & 0xFF]) >>> 0;
    }
    for (let i = 0; i < bodyBytes.length; i++) {
      crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ bodyBytes[i]) & 0xFF]) >>> 0;
    }
    return crc >>> 0;
  }

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder('utf-8');

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
   * Возвращает объект { files: { [name]: Uint8Array }, methods: { [name]: number } }
   */
  async function readSwmapArchive(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Ищем End of Central Directory (EOCD) с конца файла
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
    let ptr = cdOffset;

    for (let i = 0; i < totalEntries; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) {
        throw new Error('Поврежден заголовок Central Directory в .swmap');
      }
      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const uncompSize = view.getUint32(ptr + 24, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);

      const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
      const fileName = textDecoder.decode(nameBytes);

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
    }

    return { files, methods };
  }

  /**
   * Собирает архив .swmap (ZIP) из переданного списка записей:
   * entries: Array<{ name: string, data: Uint8Array | string, compress?: boolean }>
   * Возвращает Promise<Blob>
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

      const localHeader = new Uint8Array(30 + nameBytes.length);
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
      lhView.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const chView = new DataView(centralHeader.buffer);
      chView.setUint32(0, 0x02014b50, true);
      chView.setUint16(4, 20, true);
      chView.setUint16(6, 20, true);
      chView.setUint16(8, 0x0800, true); // UTF-8
      chView.setUint16(10, method, true);
      chView.setUint16(12, dosTime, true);
      chView.setUint16(14, dosDate, true);
      chView.setUint32(16, crc, true);
      chView.setUint32(20, storedData.byteLength, true);
      chView.setUint32(24, rawData.byteLength, true);
      chView.setUint16(28, nameBytes.length, true);
      chView.setUint16(30, 0, true);
      chView.setUint16(32, 0, true);
      chView.setUint16(34, 0, true);
      chView.setUint16(36, 0, true);
      chView.setUint32(38, 0, true);
      chView.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

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

  /**
   * Вспомогательная конвертация WebP-байтов или сырых RGBA-байтов в PNG Uint8Array через Canvas
   */
  async function imageBytesToPng(imgBytes, mimeType) {
    if (typeof document === 'undefined') return imgBytes;
    const blob = new Blob([imgBytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Не удалось декодировать изображение из текстуры Godot'));
        el.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 512;
      canvas.height = img.naturalHeight || img.height || 512;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      return new Uint8Array(await pngBlob.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Конвертирует текстуру Godot 4 (.ctex, заголовок GST2) или Godot 3 (.stex, заголовок GDST)
   * в стандартный PNG (Uint8Array).
   * Возвращает Promise<{ bytes: Uint8Array, width: number, height: number, format: string }>
   */
  async function convertGodotTexture(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length < 16) {
      throw new Error('Файл слишком мал для текстуры Godot (.ctex / .stex)');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // 1. Проверка Godot 4 CompressedTexture2D ('GST2')
    if (bytes[0] === 0x47 && bytes[1] === 0x53 && bytes[2] === 0x54 && bytes[3] === 0x32) {
      const width = view.getUint32(8, true);
      const height = view.getUint32(12, true);
      const dataFormat = view.getUint32(36, true); // 0=IMAGE, 1=PNG, 2=WEBP, 3=BASIS
      const w16 = view.getUint16(40, true) || width;
      const h16 = view.getUint16(42, true) || height;
      const imgFormat = view.getUint32(48, true);

      if (dataFormat === 1 || dataFormat === 2) {
        const size = view.getUint32(52, true);
        if (56 + size > bytes.length) {
          throw new Error('Поврежден блок данных внутри .ctex (выход за пределы файла)');
        }
        const embedded = bytes.slice(56, 56 + size);
        if (dataFormat === 1) {
          return { bytes: embedded, width: width || w16, height: height || h16, format: 'PNG (из GST2 .ctex)' };
        } else {
          const pngBytes = await imageBytesToPng(embedded, 'image/webp');
          return { bytes: pngBytes, width: width || w16, height: height || h16, format: 'WebP → PNG (из GST2 .ctex)' };
        }
      } else if (dataFormat === 0 && typeof document !== 'undefined') {
        // Сырые пиксели (RGB8 = 4, RGBA8 = 5, L8 = 0, LA8 = 1)
        const rawStart = 52;
        const canvas = document.createElement('canvas');
        canvas.width = w16;
        canvas.height = h16;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(w16, h16);
        const dst = imgData.data;
        const pixelCount = w16 * h16;
        if (imgFormat === 5 && rawStart + pixelCount * 4 <= bytes.length) {
          dst.set(bytes.subarray(rawStart, rawStart + pixelCount * 4));
        } else if (imgFormat === 4 && rawStart + pixelCount * 3 <= bytes.length) {
          for (let i = 0; i < pixelCount; i++) {
            dst[i * 4] = bytes[rawStart + i * 3];
            dst[i * 4 + 1] = bytes[rawStart + i * 3 + 1];
            dst[i * 4 + 2] = bytes[rawStart + i * 3 + 2];
            dst[i * 4 + 3] = 255;
          }
        } else {
          throw new Error(`Сырой формат пикселей Godot Image::Format=${imgFormat} не поддерживается напрямую`);
        }
        ctx.putImageData(imgData, 0, 0);
        const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        return {
          bytes: new Uint8Array(await pngBlob.arrayBuffer()),
          width: w16,
          height: h16,
          format: 'RAW → PNG (из GST2 .ctex)'
        };
      } else if (dataFormat === 3) {
        throw new Error('Текстура .ctex сжата в GPU-формат Basis Universal / VRAM — переконвертируй через GDRE Tools');
      }
    }

    // 2. Fallback-поиск сигнатуры PNG (89 50 4E 47 0D 0A 1A 0A) или WebP (RIFF....WEBP) в первых 256 байтах (.stex / .ctex)
    const scanLimit = Math.min(bytes.length - 12, 256);
    for (let i = 0; i <= scanLimit; i++) {
      // PNG
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4E &&
        bytes[i + 3] === 0x47 &&
        bytes[i + 4] === 0x0D &&
        bytes[i + 5] === 0x0A &&
        bytes[i + 6] === 0x1A &&
        bytes[i + 7] === 0x0A
      ) {
        const slice = bytes.slice(i);
        return { bytes: slice, width: 0, height: 0, format: 'PNG (извлечено из контейнера Godot)' };
      }
      // WebP ('RIFF' .... 'WEBP')
      if (
        bytes[i] === 0x52 &&
        bytes[i + 1] === 0x49 &&
        bytes[i + 2] === 0x46 &&
        bytes[i + 3] === 0x46 &&
        bytes[i + 8] === 0x57 &&
        bytes[i + 9] === 0x45 &&
        bytes[i + 10] === 0x42 &&
        bytes[i + 11] === 0x50
      ) {
        const riffSize = view.getUint32(i + 4, true) + 8;
        const webpSlice = bytes.slice(i, Math.min(bytes.length, i + riffSize));
        const pngBytes = await imageBytesToPng(webpSlice, 'image/webp');
        return { bytes: pngBytes, width: 0, height: 0, format: 'WebP → PNG (из контейнера Godot)' };
      }
    }

    throw new Error('В файле .ctex/.stex не найден встроенный PNG или WebP (возможно, используется VRAM-сжатие ETC2/ASTC)');
  }

  /**
   * Собирает валидный .ogg поток из массива страниц Godot OggPacketSequence (pages, granules)
   */
  function buildOggFromPacketSequence(pages, granules, serialNo) {
    const outChunks = [];
    let pageSeqNo = 0;
    const streamSerial = serialNo || 0x53574950; // 'SWIP'

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const packets = pages[pIdx];
      const gran = granules[pIdx] || [0, 0]; // [low32, high32]
      const isFirstGodotPage = pIdx === 0;
      const isLastGodotPage = pIdx === pages.length - 1;

      // Разбиваем пакеты страницы на сегменты Ogg (по 255 байт)
      const segments = [];
      for (let k = 0; k < packets.length; k++) {
        const pkt = packets[k];
        let offset = 0;
        let rem = pkt.length;
        while (rem >= 255) {
          segments.push({ data: pkt.subarray(offset, offset + 255), len: 255, endsPacket: false });
          offset += 255;
          rem -= 255;
        }
        segments.push({ data: pkt.subarray(offset, offset + rem), len: rem, endsPacket: true });
      }

      // Группируем сегменты в физические страницы Ogg (не более 255 сегментов на страницу)
      let segCursor = 0;
      let continuedFromPrevPage = false;

      while (segCursor < segments.length) {
        const count = Math.min(255, segments.length - segCursor);
        const isLastPhysicalPage = segCursor + count === segments.length;

        let headerType = 0;
        if (continuedFromPrevPage) headerType |= 0x01;
        if (isFirstGodotPage && segCursor === 0) headerType |= 0x02; // BOS
        if (isLastGodotPage && isLastPhysicalPage) headerType |= 0x04; // EOS

        let bodyLen = 0;
        for (let s = 0; s < count; s++) bodyLen += segments[segCursor + s].len;

        const header = new Uint8Array(27 + count);
        const hView = new DataView(header.buffer);
        // 'OggS'
        header[0] = 0x4F;
        header[1] = 0x67;
        header[2] = 0x67;
        header[3] = 0x53;
        header[4] = 0x00; // version 0
        header[5] = headerType;

        if (isLastPhysicalPage) {
          hView.setUint32(6, gran[0] >>> 0, true);
          hView.setUint32(10, gran[1] >>> 0, true);
        } else {
          // -1 для промежуточной физической страницы
          hView.setUint32(6, 0xFFFFFFFF, true);
          hView.setUint32(10, 0xFFFFFFFF, true);
        }

        hView.setUint32(14, streamSerial >>> 0, true);
        hView.setUint32(18, pageSeqNo >>> 0, true);
        hView.setUint32(22, 0, true); // CRC32 заполним после расчета
        header[26] = count;

        const body = new Uint8Array(bodyLen);
        let bOff = 0;
        for (let s = 0; s < count; s++) {
          const seg = segments[segCursor + s];
          header[27 + s] = seg.len;
          if (seg.len > 0) {
            body.set(seg.data, bOff);
            bOff += seg.len;
          }
        }

        const crc = oggCrc32(header, body);
        hView.setUint32(22, crc, true);

        outChunks.push(header, body);
        pageSeqNo++;

        const lastSeg = segments[segCursor + count - 1];
        continuedFromPrevPage = !lastSeg.endsPacket;
        segCursor += count;
      }
    }

    let totalLen = 0;
    for (const chunk of outChunks) totalLen += chunk.byteLength;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of outChunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  /**
   * Конвертирует аудиоресурс Godot 4 (.oggvorbisstr) или Godot 3 (.oggstr)
   * обратно в стандартный звуковой файл .ogg (Uint8Array).
   */
  function convertGodotOggVorbis(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length < 32) {
      throw new Error('Файл слишком мал для .oggvorbisstr');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // 1. Если это уже обычный .ogg (начинается с 'OggS')
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return { bytes, pageCount: 0, packetCount: 0, format: 'Ogg Vorbis (оригинал)' };
    }

    // 2. Проверка на Godot 3 .oggstr, где внутри RSRC лежит цельный массив байт с 'OggS'
    for (let i = 4; i < Math.min(bytes.length - 64, 4096); i++) {
      if (
        bytes[i] === 0x4F &&
        bytes[i + 1] === 0x67 &&
        bytes[i + 2] === 0x67 &&
        bytes[i + 3] === 0x53 &&
        bytes[i + 4] === 0x00 &&
        bytes[i + 5] === 0x02
      ) {
        const possibleLen = view.getUint32(i - 4, true);
        const end = (possibleLen > 0 && i + possibleLen <= bytes.length) ? (i + possibleLen) : bytes.length;
        return {
          bytes: bytes.slice(i, end),
          pageCount: 0,
          packetCount: 0,
          format: 'Ogg Vorbis (из Godot 3 .oggstr)'
        };
      }
    }

    // 3. Godot 4 .oggvorbisstr (бинарный ресурс RSRC с OggPacketSequence)
    // Ищем первый пакет заголовка Vorbis: "\x01vorbis" (01 76 6F 72 62 69 73),
    // перед которым в RSRC всегда идет структура:
    // [pos-24]: u32(30) VARIANT_ARRAY, [pos-20]: u32(num_pages)
    // [pos-16]: u32(30) VARIANT_ARRAY, [pos-12]: u32(num_pkts_page0)
    // [pos-8]:  u32(31) VARIANT_PACKED_BYTE_ARRAY, [pos-4]: u32(pkt0_len)
    let vorbisHeaderPos = -1;
    for (let i = 24; i < bytes.length - 16; i++) {
      if (
        bytes[i] === 0x01 &&
        bytes[i + 1] === 0x76 && // 'v'
        bytes[i + 2] === 0x6F && // 'o'
        bytes[i + 3] === 0x72 && // 'r'
        bytes[i + 4] === 0x62 && // 'b'
        bytes[i + 5] === 0x69 && // 'i'
        bytes[i + 6] === 0x73    // 's'
      ) {
        const varByteArr = view.getUint32(i - 8, true);
        const varInnerArr = view.getUint32(i - 16, true);
        const varOuterArr = view.getUint32(i - 24, true);
        if (varByteArr === 31 && varInnerArr === 30 && varOuterArr === 30) {
          vorbisHeaderPos = i;
          break;
        }
      }
    }

    if (vorbisHeaderPos === -1) {
      throw new Error('Не найдена структура OggPacketSequence (\\x01vorbis) внутри .oggvorbisstr');
    }

    let cursor = vorbisHeaderPos - 24;
    const outerType = view.getUint32(cursor, true);
    const numPages = view.getUint32(cursor + 4, true) & 0x7FFFFFFF;
    cursor += 8;

    if (outerType !== 30 || numPages === 0 || numPages > 500000) {
      throw new Error(`Некорректное число страниц в OggPacketSequence: ${numPages}`);
    }

    const pages = [];
    let totalPackets = 0;

    for (let p = 0; p < numPages; p++) {
      if (cursor + 8 > bytes.length) {
        throw new Error(`Неожиданный конец .oggvorbisstr на странице ${p}/${numPages}`);
      }
      const pageArrType = view.getUint32(cursor, true);
      const numPkts = view.getUint32(cursor + 4, true) & 0x7FFFFFFF;
      cursor += 8;
      if (pageArrType !== 30 || numPkts > 100000) {
        throw new Error(`Ошибка чтения страницы ${p} в .oggvorbisstr (type=${pageArrType})`);
      }

      const pagePackets = [];
      for (let k = 0; k < numPkts; k++) {
        const pktVarType = view.getUint32(cursor, true);
        const pktLen = view.getUint32(cursor + 4, true);
        cursor += 8;
        if (pktVarType !== 31 || cursor + pktLen > bytes.length) {
          throw new Error(`Ошибка чтения пакета ${k} на странице ${p} в .oggvorbisstr`);
        }
        pagePackets.push(bytes.subarray(cursor, cursor + pktLen));
        cursor += pktLen;
        const pad = (4 - (pktLen % 4)) % 4;
        cursor += pad;
        totalPackets++;
      }
      pages.push(pagePackets);
    }

    // Ищем массив granule_positions: VARIANT_PACKED_INT64_ARRAY (type=48) длины numPages
    let granules = null;
    const searchOrder = [];
    // Сначала проверяем область сразу после packet_data
    for (let pos = cursor; pos <= Math.min(bytes.length - 8 - numPages * 8, cursor + 256); pos += 4) {
      searchOrder.push(pos);
    }
    // Если вдруг свойство granule_positions шло ДО packet_data, проверяем весь файл
    for (let pos = 0; pos <= bytes.length - 8 - numPages * 8; pos++) {
      searchOrder.push(pos);
    }

    for (const pos of searchOrder) {
      if (
        view.getUint32(pos, true) === 48 &&
        view.getUint32(pos + 4, true) === numPages &&
        pos + 8 + numPages * 8 <= bytes.length
      ) {
        granules = [];
        let gPtr = pos + 8;
        for (let p = 0; p < numPages; p++) {
          const low = view.getUint32(gPtr, true);
          const high = view.getUint32(gPtr + 4, true);
          granules.push([low, high]);
          gPtr += 8;
        }
        break;
      }
    }

    if (!granules) {
      // Fallback: если granule_positions не найден, оцениваем по 1024 сэмпла на пакет
      granules = [];
      let acc = 0;
      for (let p = 0; p < numPages; p++) {
        if (p > 0) acc += pages[p].length * 1024;
        granules.push([acc >>> 0, Math.floor(acc / 4294967296) >>> 0]);
      }
    }

    const oggBytes = buildOggFromPacketSequence(pages, granules, 0x53574950);
    return {
      bytes: oggBytes,
      pageCount: numPages,
      packetCount: totalPackets,
      format: `Ogg Vorbis (собрано из .oggvorbisstr: ${numPages} стр., ${totalPackets} пак.)`
    };
  }

  function decodeText(bytes) {
    return textDecoder.decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  function encodeText(str) {
    return textEncoder.encode(String(str));
  }

  async function readSwmapZip(fileOrBuffer) {
    const buf = (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function')
      ? await fileOrBuffer.arrayBuffer()
      : fileOrBuffer;
    return readSwmapArchive(buf);
  }

  async function writeSwmapZip(entries) {
    const blob = await writeSwmapArchive(entries);
    return new Uint8Array(await blob.arrayBuffer());
  }

  global.SwmapZip = {
    crc32,
    oggCrc32,
    decodeText,
    encodeText,
    readSwmapArchive,
    writeSwmapArchive,
    readSwmapZip,
    writeSwmapZip,
    convertGodotTexture,
    convertGodotOggVorbis
  };
})(typeof window !== 'undefined' ? window : globalThis);
