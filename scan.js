// lib/invoice-scan-packet.ts
var SUPPLIER_HINTS = [
  "wing sing",
  "\u6C38\u76DB",
  "db do boxes",
  "do boxes",
  "hy seafood",
  "\u6D77\u6E90",
  "friends development",
  "koon phong",
  "\u51A0\u4E30",
  "\u51A0\u8C50",
  "galaxy global",
  "woo kee",
  "swan enterprise",
  "southern california food",
  "rivera",
  "\u5929\u8349",
  "cathay",
  "\u56FD\u6CF0",
  "\u570B\u6CF0",
  "a-farms",
  "\u826F\u7530",
  "lacausa",
  "kim nguan"
];
function unitConfidence(n) {
  if (!Number.isFinite(n)) return 0;
  const v = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(0, v));
}
function cleanWords(words) {
  return words.map((word) => ({
    ...word,
    text: word.text.replace(/\s+/g, " ").trim(),
    confidence: unitConfidence(word.confidence)
  })).filter((word) => word.text.length > 0);
}
function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
function clusterLines(words) {
  const cleaned = cleanWords(words);
  if (!cleaned.length) return [];
  const heights = cleaned.map((word) => Math.max(1, word.y1 - word.y0));
  const medianH = median(heights) || 12;
  const items = cleaned.map((word) => ({ ...word, cy: (word.y0 + word.y1) / 2 })).sort((a, b) => a.cy - b.cy || a.x0 - b.x0);
  const groups = [];
  for (const word of items) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([word]);
      continue;
    }
    const lastCy = last.reduce((sum, item) => sum + item.cy, 0) / last.length;
    if (Math.abs(word.cy - lastCy) <= medianH * 0.55) last.push(word);
    else groups.push([word]);
  }
  return groups.map((group) => {
    const line = [...group].sort((a, b) => a.x0 - b.x0);
    const charWidths = line.map(
      (word) => Math.max(1, (word.x1 - word.x0) / Math.max(1, [...word.text].length))
    );
    const medianChar = median(charWidths) || 8;
    const cells = [];
    let buf = "";
    for (let i = 0; i < line.length; i++) {
      const word = line[i];
      if (!word) continue;
      if (i === 0) {
        buf = word.text;
        continue;
      }
      const prev = line[i - 1];
      const gap = prev ? word.x0 - prev.x1 : 0;
      if (gap >= medianChar * 1.8) {
        if (buf) cells.push(buf);
        buf = word.text;
      } else if (gap <= medianChar * 0.45) {
        buf += word.text;
      } else {
        buf += buf ? ` ${word.text}` : word.text;
      }
    }
    if (buf) cells.push(buf);
    return {
      text: cells.join("	"),
      confidence: Math.min(...line.map((word) => word.confidence)),
      cells
    };
  });
}
function flat(line) {
  return line.text.replace(/\t/g, " ");
}
function firstMatch(lines, re, min = 0.6) {
  for (const line of lines) {
    if (line.confidence < min) continue;
    const match = flat(line).match(re);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}
function sniffInvoiceNo(lines) {
  return firstMatch(
    lines,
    /(?:发票号码|发票号|發票號碼|Invoice\s*(?:No\.?|Number|#)?|INV(?:OICE)?\s*#?)\s*[:：#]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,})/i
  );
}
function sniffDate(lines) {
  return firstMatch(
    lines,
    /(?:^|[^\u4e00-\u9fffA-Za-z])(?:发票日期|日期|Date)\s*[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i
  );
}
function sniffTotal(lines) {
  return firstMatch(
    lines,
    /(?:单据总额|發票總額|总额|總額|Amount\s*Due|Invoice\s*Total|Grand\s*Total|Balance\s*Due)\s*[:：]?\s*\$?\s*([0-9][0-9,]*(?:\.\d{2})?)/i
  );
}
function sniffPayment(lines) {
  const hits = [];
  const re = /(?:\bC\.?\s*O\.?\s*D\.?\b|\bNet\s*\d+\b|\bDue\s+on\s+Receipt\b|支票|到付)/i;
  for (const line of lines) {
    if (line.confidence < 0.6) continue;
    const text = flat(line);
    if (re.test(text) && !hits.includes(text)) hits.push(text);
  }
  return hits.join("\uFF1B");
}
function sniffSupplier(lines) {
  const hits = [];
  for (const line of lines) {
    if (line.confidence < 0.6) continue;
    const text = flat(line);
    const lower = text.toLowerCase();
    if (SUPPLIER_HINTS.some((hint) => lower.includes(hint)) && !hits.includes(text)) {
      hits.push(text);
    }
  }
  return hits.join("\uFF1B");
}
function lengthWeightedConfidence(words) {
  const cleaned = cleanWords(words);
  const weight = cleaned.reduce((sum, word) => sum + [...word.text].length, 0);
  if (!weight) return 0;
  const score = cleaned.reduce(
    (sum, word) => sum + word.confidence * [...word.text].length,
    0
  );
  return score / weight;
}
function draftPage(page) {
  const words = cleanWords(page.words);
  const lines = clusterLines(page.words);
  const confidence = lengthWeightedConfidence(page.words);
  const lowCount = words.filter((word) => word.confidence < 0.5).length;
  const reasons = [];
  const readError = page.readError?.trim() || "";
  if (readError) reasons.push("\u8FD9\u5F20\u56FE\u6253\u4E0D\u5F00");
  if (!readError && words.length === 0) reasons.push("\u6CA1\u6709\u8BA4\u51FA\u6587\u5B57");
  if (words.length > 0 && confidence < 0.7) reasons.push("\u6574\u9875\u7F6E\u4FE1\u4F4E");
  if (words.length > 0 && lowCount / words.length > 0.3) reasons.push("\u4F4E\u7F6E\u4FE1\u7684\u5B57\u592A\u591A");
  return {
    fileName: page.fileName.replace(/[\r\n\t]/g, " ").trim() || "\u672A\u547D\u540D",
    fileTime: page.fileTime?.trim() || "",
    confidence,
    needsPhoto: reasons.length > 0,
    reasons,
    supplierRaw: sniffSupplier(lines),
    invoiceNo: sniffInvoiceNo(lines),
    invoiceDate: sniffDate(lines),
    totalRaw: sniffTotal(lines),
    paymentRaw: sniffPayment(lines),
    lines,
    readError
  };
}
function field(label, value) {
  return value ? `${label}: ${value}` : `${label}:`;
}
function formatConfidence(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
function formatLine(line) {
  const mark = line.confidence < 0.55 ? "\u3014\u4F4E\u3015" : "";
  return `${line.text}	\u7F6E\u4FE1${formatConfidence(line.confidence)}${mark}`;
}
function buildScanPacket(pages, batchAt2) {
  const drafts = pages.map(draftPage);
  const blocks = drafts.map((draft, index) => {
    const body = draft.lines.length ? draft.lines.map(formatLine).join("\n") : "\uFF08\u6CA1\u6709\u8BA4\u51FA\u6587\u5B57\uFF09";
    return [
      `## ${index + 1}. ${draft.fileName}`,
      field("\u6587\u4EF6\u65F6\u95F4", draft.fileTime),
      field("\u6574\u9875\u7F6E\u4FE1", wordsOf(draft) ? formatConfidence(draft.confidence) : ""),
      field("\u8981\u770B\u539F\u56FE", draft.needsPhoto ? "\u662F" : "\u5426"),
      field("\u539F\u56E0", draft.reasons.join("\uFF1B")),
      field("\u8BA4\u5B57\u5931\u8D25", draft.readError),
      field("\u4F9B\u5E94\u5546\u539F\u6587", draft.supplierRaw),
      field("\u53D1\u7968\u53F7\u7801", draft.invoiceNo),
      field("\u53D1\u7968\u65E5\u671F", draft.invoiceDate),
      field("\u5355\u636E\u603B\u989D", draft.totalRaw),
      field("\u4ED8\u6B3E\u5B57\u6837", draft.paymentRaw),
      "\u6309\u884C\u539F\u6587\uFF08\u5217\u4E0E\u5217\u4E4B\u95F4\u662F\u5236\u8868\u7B26\uFF1B\u884C\u672B\u300C\u7F6E\u4FE1\u300D\u662F\u8BA4\u5B57\u628A\u63E1\uFF0C\u4E0D\u662F\u6570\u91CF\u3001\u5355\u4EF7\u6216\u91D1\u989D\uFF09:",
      body
    ].join("\n");
  });
  return [
    "\u5165\u8D27\u626B\u63CF\u5305",
    field("\u6279\u6B21\u65F6\u95F4", batchAt2.trim()),
    field("\u5F20\u6570", String(drafts.length)),
    "\u4EA4\u63A5: \u539F\u6587\u7167\u5F55\u3002\u4E0D\u6620\u5C04\u5546\u54C1\u6807\u51C6\u540D\u3002\u7A7A\u767D\u4E0D\u662F\u96F6\uFF0C\u4E0D\u8981\u8865 0\u3002\u4E0D\u5199\u5165\u8FDB\u8D27\u5355\uFF0C\u4E5F\u4E0D\u6539\u5165\u8CA8\u55AE\u6574\u7406\u8868\u3002\u672C\u6D88\u606F\u4E0D\u542B\u56FE\u7247\u3002\u539F\u56FE\u8BF7\u53E6\u5B58\uFF0C\u6587\u4EF6\u540D\u4E0E\u4E0B\u9762\u4E00\u81F4\u3002\u53EA\u6709\u67D0\u4E00\u5F20\u5199\u660E\u8981\u770B\u539F\u56FE\u4E3A\u662F\u65F6\uFF0C\u624D\u53E6\u9644\u90A3\u4E00\u5F20\u7167\u7247\u3002",
    "",
    blocks.join("\n\n"),
    ""
  ].join("\n");
}
function wordsOf(draft) {
  return draft.lines.length > 0 || draft.confidence > 0;
}

// tools/invoice-scan-public/main.ts
var MAX_EDGE = 1800;
var TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm";
var jobs = [];
var batchAt = "";
var busy = false;
var worker = null;
var statusEl = document.querySelector("#status");
var noticeEl = document.querySelector("#notice");
var listEl = document.querySelector("#list");
var emptyEl = document.querySelector("#empty");
var packetEl = document.querySelector("#packet");
var actionsEl = document.querySelector("#out");
var albumEl = document.querySelector("#album");
var cameraEl = document.querySelector("#camera");
function uniqueName(name, used) {
  const clean = name.replace(/[\r\n\t]/g, " ").trim() || "photo.jpg";
  if (!used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const dot = clean.lastIndexOf(".");
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  let n = 2;
  while (used.has(`${stem}-${n}${ext}`)) n += 1;
  const next = `${stem}-${n}${ext}`;
  used.add(next);
  return next;
}
function fileTimeOf(file, now) {
  if (!file.lastModified || Math.abs(now - file.lastModified) < 5 * 60 * 1e3) return "";
  const date = new Date(file.lastModified);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("\u6253\u4E0D\u5F00"));
    image.src = url;
  });
}
async function imageForOcr(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("\u6253\u4E0D\u5F00");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function makeWorker(onStatus) {
  const dynamicImport = new Function("url", "return import(url)");
  const { createWorker } = await dynamicImport(TESS_URL);
  return createWorker("chi_sim+eng", 1, {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.1/dist/worker.min.js",
    logger: (message) => {
      const status = message.status || "";
      const progress = typeof message.progress === "number" ? ` ${Math.round(message.progress * 100)}%` : "";
      onStatus(`${status}${progress}`.trim());
    }
  });
}
function packetText() {
  return jobs.length && batchAt ? buildScanPacket(jobs, batchAt) : "";
}
function needsPhoto(job) {
  return draftPage({
    fileName: job.name,
    fileTime: job.fileTime,
    words: job.words,
    readError: job.readError
  }).needsPhoto;
}
function setNotice(text) {
  noticeEl.textContent = text;
  noticeEl.hidden = !text;
}
function render() {
  const packet = packetText();
  statusEl.hidden = !statusEl.textContent;
  emptyEl.hidden = jobs.length > 0;
  listEl.innerHTML = "";
  for (const job of jobs) {
    const eye = needsPhoto(job);
    const li = document.createElement("li");
    li.className = eye ? "iscan-card eye" : "iscan-card";
    const strong = document.createElement("strong");
    strong.textContent = job.name;
    li.append(strong);
    if (eye) {
      const badge = document.createElement("span");
      badge.className = "iscan-badge";
      badge.innerHTML = `<span class="bi-cn">\u8981\u770B\u539F\u56FE</span><span class="bi-en">Review photo</span>`;
      li.append(badge);
    }
    const p = document.createElement("p");
    p.textContent = job.readError || job.words.slice(0, 8).map((item) => item.text).join(" ");
    li.append(p);
    listEl.append(li);
  }
  packetEl.value = packet;
  packetEl.hidden = !packet;
  actionsEl.hidden = !packet;
  const weak = document.querySelector("#share-weak");
  if (weak) weak.hidden = !jobs.some(needsPhoto);
  document.querySelectorAll(".iscan-primary, .iscan-secondary").forEach((button) => {
    if (button.dataset.keep !== "out") button.disabled = busy;
  });
}
async function run(list) {
  const incoming = [...list].filter(
    (file) => file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)
  );
  if (!incoming.length) return;
  jobs.splice(0, jobs.length);
  batchAt = "";
  busy = true;
  setNotice("");
  render();
  const now = Date.now();
  const used = /* @__PURE__ */ new Set();
  try {
    if (!worker) {
      statusEl.textContent = "\u6B63\u5728\u51C6\u5907\u4E2D\u6587\u8BC6\u522B Preparing Chinese OCR";
      render();
      worker = await makeWorker((text) => {
        statusEl.textContent = text;
        render();
      });
    }
    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      if (!file) continue;
      const name = uniqueName(file.name, used);
      statusEl.textContent = `\u6B63\u5728\u8BA4\u5B57 Reading ${i + 1}/${incoming.length} ${name}`;
      render();
      try {
        const canvas = await imageForOcr(file);
        const result = await worker.recognize(canvas);
        const words = (result.data?.words ?? []).filter((item) => item.text?.trim() && item.bbox).map((item) => ({
          text: item.text || "",
          confidence: item.confidence ?? 0,
          x0: item.bbox?.x0 ?? 0,
          y0: item.bbox?.y0 ?? 0,
          x1: item.bbox?.x1 ?? 0,
          y1: item.bbox?.y1 ?? 0
        }));
        jobs.push({ file, name, words, fileTime: fileTimeOf(file, now) });
      } catch (err) {
        jobs.push({
          file,
          name,
          words: [],
          fileTime: fileTimeOf(file, now),
          readError: err instanceof Error ? err.message : "\u6253\u4E0D\u5F00"
        });
      }
      render();
    }
    const stamp = new Date(now);
    const pad = (n) => String(n).padStart(2, "0");
    batchAt = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "";
    setNotice(err instanceof Error ? err.message : "\u8BC6\u522B\u6CA1\u6709\u542F\u52A8");
  } finally {
    busy = false;
    render();
  }
}
async function share(files, title) {
  const payload = files.map((file, index) => {
    const job = jobs.find((item) => item.file === file);
    const name = job?.name || file.name || `photo-${index + 1}.jpg`;
    return new File([file], name, { type: file.type || "image/jpeg", lastModified: file.lastModified });
  });
  if (!navigator.canShare?.({ files: payload })) {
    setNotice("\u8FD9\u53F0\u6D4F\u89C8\u5668\u4E0D\u80FD\u4E00\u6B21\u5206\u4EAB\u591A\u5F20\u56FE\u3002\u6587\u5B57\u5305\u53EF\u4EE5\u590D\u5236\uFF0C\u539F\u56FE\u4ECD\u5728\u76F8\u518C\u91CC\u3002 This browser cannot share many photos at once. Copy the text; photos stay in the library.");
    return;
  }
  await navigator.share({ files: payload, title });
  setNotice("\u539F\u56FE\u5DF2\u4EA4\u7ED9\u7CFB\u7EDF\u5206\u4EAB\u3002\u4E0D\u8981\u628A\u5B83\u4EEC\u8D34\u8FDB Grok \u5BF9\u8BDD\u3002 Photos handed to the share sheet. Do not paste them into Grok.");
}
function downloadText() {
  const packet = packetText();
  const blob = new Blob([packet], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `\u5165\u8D27\u626B\u63CF\u5305-${batchAt.replace(/[: ]/g, "") || "scan"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
document.querySelector("#pick")?.addEventListener("click", () => albumEl.click());
document.querySelector("#camera")?.addEventListener("click", () => cameraEl.click());
albumEl.addEventListener("change", () => {
  if (albumEl.files?.length) void run(albumEl.files);
  albumEl.value = "";
});
cameraEl.addEventListener("change", () => {
  if (cameraEl.files?.length) void run(cameraEl.files);
  cameraEl.value = "";
});
document.querySelector("#copy")?.addEventListener("click", () => {
  const packet = packetText();
  void navigator.clipboard.writeText(packet).then(
    () => setNotice("\u5DF2\u590D\u5236\u3002\u8D34\u7ED9 Grok \u65F6\u4E0D\u8981\u5E26\u4E0A\u539F\u56FE\u3002 Copied. Paste to Grok without the photos."),
    () => setNotice("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u957F\u6309\u6587\u5B57\u5305\u624B\u52A8\u590D\u5236\u3002")
  );
});
document.querySelector("#download")?.addEventListener("click", downloadText);
document.querySelector("#share-all")?.addEventListener("click", () => {
  void share(jobs.map((job) => job.file), "\u539F\u56FE");
});
document.querySelector("#share-weak")?.addEventListener("click", () => {
  void share(jobs.filter(needsPhoto).map((job) => job.file), "\u8981\u770B\u539F\u56FE");
});
render();
