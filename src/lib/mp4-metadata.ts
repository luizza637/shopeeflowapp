// Limpeza real dos metadados gravados DENTRO do container MP4/MOV.
//
// O que fazemos, sem reencodar nem cortar nada:
//  - removemos as caixas "udta" (tags do app/celular), "meta" e "free"
//  - zeramos creation_time / modification_time em mvhd, tkhd e mdhd
//
// O stream de vídeo/áudio (mdat) fica intacto: mesma duração, resolução e
// qualidade. Só sai a informação sobre o arquivo.

const CONTAINERS = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "udta",
  "moof",
  "traf",
  "mvex",
]);

const STRIP = new Set(["udta", "meta", "free", "skip", "uuid"]);

function readType(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function zeroTimes(view: DataView, start: number, size: number, type: string) {
  // start = início da box; payload começa em start + 8
  const p = start + 8;
  if (p + 4 > start + size) return;
  const version = view.getUint8(p);
  const t = p + 4; // após version(1) + flags(3)
  if (version === 1) {
    if (t + 16 > start + size) return;
    view.setBigUint64(t, 0n);
    view.setBigUint64(t + 8, 0n);
  } else {
    if (t + 8 > start + size) return;
    view.setUint32(t, 0);
    view.setUint32(t + 4, 0);
  }
  void type;
}

type Segment = { start: number; end: number };

/**
 * Reescreve o MP4 removendo caixas de metadados e zerando timestamps.
 * Retorna null quando o arquivo não é um MP4/MOV reconhecível (aí mantemos
 * o arquivo original como está).
 */
export function stripMp4Metadata(buffer: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(buffer);
  const total = buffer.byteLength;
  if (total < 16) return null;
  if (readType(view, 4) !== "ftyp") return null;

  const removals: Segment[] = [];
  // Ajustes de tamanho a aplicar em containers pais (offset da box -> delta)
  const parents: { start: number; type: string }[] = [];

  const walk = (start: number, end: number, depth: number): boolean => {
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset);
      const type = readType(view, offset + 4);
      let headerSize = 8;
      if (size === 1) {
        if (offset + 16 > end) return false;
        const big = view.getBigUint64(offset + 8);
        if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        size = Number(big);
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset;
      }
      if (size < headerSize || offset + size > end) return false;

      if (STRIP.has(type) && depth > 0) {
        removals.push({ start: offset, end: offset + size });
      } else {
        if (type === "mvhd" || type === "tkhd" || type === "mdhd") {
          zeroTimes(view, offset, size, type);
        }
        if (CONTAINERS.has(type)) {
          parents.push({ start: offset, type });
          if (!walk(offset + headerSize, offset + size, depth + 1)) return false;
        }
      }
      offset += size;
    }
    return true;
  };

  if (!walk(0, total, 0)) return null;
  if (!removals.length) {
    // Nada para remover, mas os timestamps já foram zerados no buffer.
    return buffer;
  }

  // Reduz o tamanho declarado de cada container pai que engloba um trecho removido.
  for (const parent of parents) {
    const size = view.getUint32(parent.start);
    if (size === 1 || size === 0) continue;
    const end = parent.start + size;
    let removed = 0;
    for (const r of removals) {
      if (r.start > parent.start && r.end <= end) removed += r.end - r.start;
    }
    if (removed) view.setUint32(parent.start, size - removed);
  }

  removals.sort((a, b) => a.start - b.start);
  const keep: Segment[] = [];
  let cursor = 0;
  for (const r of removals) {
    if (r.start > cursor) keep.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < total) keep.push({ start: cursor, end: total });

  const outSize = keep.reduce((acc, s) => acc + (s.end - s.start), 0);
  const out = new Uint8Array(outSize);
  const src = new Uint8Array(buffer);
  let pos = 0;
  for (const s of keep) {
    out.set(src.subarray(s.start, s.end), pos);
    pos += s.end - s.start;
  }
  return out.buffer;
}
