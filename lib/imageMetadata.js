// ---------------------------------------------------------------------------
// Server-side image metadata stripping (privacy / data minimization).
//
// A phone photo of handwritten work can carry EXIF metadata — GPS coordinates, the
// device model, and capture timestamps — embedded in the file. That image is forwarded
// to a third-party vision model (Groq, in the US) for grading, so the metadata must NOT
// ride along. The client downscales through a <canvas>, which already drops metadata in
// normal browsers; this is the GUARANTEED server backstop that also covers the rare
// no-canvas fallback path (some webviews) where the raw file is sent.
//
// Dependency-free: we rewrite the container, dropping the metadata segments/chunks and
// keeping the pixel data (and color/rendering info) intact. FAIL-OPEN: if the bytes can't
// be safely rewritten (truncated/odd structure), we return the original — the privacy
// improvement is best-effort and must never break grading or corrupt a valid image.
//
// Server-only (uses Buffer). Pure: bytes in, bytes out.
// ---------------------------------------------------------------------------

// JPEG: walk marker segments from SOI; drop APP1 (Exif/XMP — where GPS lives), APP13
// (IPTC/Photoshop), and COM (comments). Keep APP0 (JFIF), APP2 (ICC color), the
// quantization/Huffman tables, and the entropy-coded scan data (copied verbatim from SOS).
function stripJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const DROP = new Set([0xe1 /* APP1 */, 0xed /* APP13 */, 0xfe /* COM */]);
  const out = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 1 < buf.length) {
    if (buf[i] !== 0xff) return buf; // not where a marker should be → bail (fail-open)
    const marker = buf[i + 1];
    if (marker === 0xff) { out.push(buf.subarray(i, i + 1)); i += 1; continue; } // fill byte
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // SOS → copy rest
    if (marker === 0xd9) { out.push(buf.subarray(i, i + 2)); return Buffer.concat(out); } // EOI
    // Standalone markers (no length payload): RSTn (D0–D7), TEM (01).
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > buf.length) return buf;
    const len = (buf[i + 2] << 8) | buf[i + 3]; // includes the 2 length bytes
    const segEnd = i + 2 + len;
    if (len < 2 || segEnd > buf.length) return buf; // malformed → fail-open
    if (!DROP.has(marker)) out.push(buf.subarray(i, segEnd));
    i = segEnd;
  }
  return Buffer.concat(out);
}

// PNG: 8-byte signature + chunks [len(4)][type(4)][data][crc(4)]. Drop ancillary metadata
// chunks (tEXt/zTXt/iTXt text, eXIf, tIME). Keep critical chunks (IHDR/PLTE/IDAT/IEND) and
// all color/rendering chunks (tRNS, gAMA, cHRM, sRGB, iCCP, bKGD, pHYs, sBIT, …).
function stripPng(buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) return buf;
  const DROP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const chunkEnd = i + 12 + len;
    if (chunkEnd > buf.length) return buf; // truncated → fail-open
    if (!DROP.has(type)) out.push(buf.subarray(i, chunkEnd));
    i = chunkEnd;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
}

// WebP (RIFF): "RIFF"<u32 LE size>"WEBP" then chunks [fourCC(4)][u32 LE size][data][pad]. Drop
// the EXIF and XMP chunks; rebuild the RIFF size. Best-effort (a VP8X feature flag may still
// advertise metadata, which renderers tolerate); fail-open on any structural surprise.
function stripWebp(buf) {
  if (buf.length < 12 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return buf;
  const DROP = new Set(["EXIF", "XMP "]);
  const parts = [];
  let i = 12;
  let dropped = false;
  while (i + 8 <= buf.length) {
    const cc = buf.toString("latin1", i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const next = i + 8 + size + (size & 1); // payload + even-padding byte
    if (i + 8 + size > buf.length) return buf; // truncated → fail-open
    if (DROP.has(cc)) dropped = true;
    else parts.push(buf.subarray(i, Math.min(next, buf.length)));
    i = next;
  }
  if (!dropped) return buf; // nothing to strip — leave the bytes (and trailing data) untouched
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "latin1");
  return Buffer.concat([header, body]);
}

// Strip embedded metadata from a base64 image, returning cleaned base64. Dispatches on the
// (already server-sniffed) mime. GIF and anything unrecognized pass through unchanged (GIF
// carries no GPS EXIF in practice). Fail-open on any error.
export function stripImageMetadata(base64, mime) {
  if (typeof base64 !== "string" || !base64) return base64;
  try {
    const buf = Buffer.from(base64, "base64");
    let cleaned;
    if (mime === "image/jpeg") cleaned = stripJpeg(buf);
    else if (mime === "image/png") cleaned = stripPng(buf);
    else if (mime === "image/webp") cleaned = stripWebp(buf);
    else return base64; // image/gif or unknown → unchanged
    // If nothing changed, keep the original base64 string (avoids a needless re-encode).
    if (cleaned === buf || cleaned.length === buf.length) {
      // length-equal could still differ; only re-encode when bytes actually changed.
      if (cleaned.equals(buf)) return base64;
    }
    return cleaned.toString("base64");
  } catch {
    return base64;
  }
}
