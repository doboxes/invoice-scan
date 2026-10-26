// tools/invoice-scan-public/inbox.ts
var GIST_DESC = "invoice-scan-inbox";
var GIST_FILE = "scans.txt";
var KEEP_DAYS = 7;
var API = "https://api.github.com";
var BLOCK_HEAD = "==== \u626B\u63CFID: ";
function stamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function rawLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.startsWith("====") || line.startsWith("----") ? ` ${line}` : line);
}
function photoSection(photo, index) {
  const head = `---- \u7167\u7247 ${index + 1}: ${photo.name} | \u7167\u7247\u65F6\u95F4: ${photo.fileTime || "\u6587\u4EF6\u6CA1\u5E26"} ----`;
  if (photo.readError) return [head, `\uFF08\u8FD9\u5F20\u6CA1\u8BA4\u51FA\u5B57\uFF1A${photo.readError}\uFF09`];
  const lines = rawLines(photo.text);
  return [head, ...lines.length ? lines : ["\uFF08\u8FD9\u5F20\u6CA1\u8BA4\u51FA\u5B57\uFF09"]];
}
async function scanId(batchAt2, photos) {
  const body = JSON.stringify(photos.map((p) => [p.name, p.fileTime, p.text, p.readError || ""]));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${batchAt2.replace(/-/g, "").replace(" ", "-").replace(":", "")}-${hex.slice(0, 6)}`;
}
function buildBlock(id, batchAt2, photos) {
  return [
    `${BLOCK_HEAD}${id} ====`,
    `\u626B\u63CF\u65F6\u95F4: ${batchAt2}`,
    `\u7167\u7247\u5F20\u6570: ${photos.length}`,
    ...photos.flatMap(photoSection),
    `==== \u5B8C ${id} ====`
  ].join("\n");
}
function inboxHeader(updatedAt) {
  return [
    "\u5165\u8D27\u626B\u63CF\u6536\u4EF6 Invoice scan inbox",
    `\u53EA\u6709\u8BA4\u5B57\u539F\u6587\uFF0C\u6CA1\u6709\u7167\u7247\uFF0C\u4E5F\u6CA1\u6709\u5728\u624B\u673A\u4E0A\u62C6\u5B57\u6BB5\u3002\u6309\u626B\u63CF\u65F6\u95F4\u4ECE\u65E7\u5230\u65B0\u6392\uFF0C\u53EA\u7559\u6700\u8FD1 ${KEEP_DAYS} \u5929\u3002`,
    "\u7ED9 Grok\uFF1A",
    "1. \u53EA\u5904\u7406\u6BD4\u4F60\u4E0A\u6B21\u5904\u7406\u8FC7\u7684\u300C\u626B\u63CFID\u300D\u66F4\u665A\u7684\u5757\u3002\u626B\u63CFID \u4EE5 \u5E74\u6708\u65E5-\u65F6\u5206 \u5F00\u5934\uFF0C\u53EF\u4EE5\u76F4\u63A5\u6BD4\u5148\u540E\u3002",
    "2. \u6BCF\u5757\u91CC\u300C---- \u7167\u7247 N ----\u300D\u4E0B\u9762\u662F\u90A3\u5F20\u7167\u7247\u8BFB\u51FA\u7684\u539F\u6587\uFF0C\u4E00\u884C\u4E00\u4E32\uFF0C\u987A\u5E8F\u7167\u8BFB\u51FA\u6765\u7684\u6392\u3002\u54EA\u4E32\u662F\u4F9B\u5E94\u5546\u3001\u5355\u53F7\u3001\u65E5\u671F\u3001\u54C1\u540D\u3001\u6570\u91CF\u3001\u91D1\u989D\uFF0C\u7531\u4F60\u5206\u6E05\u3002",
    "3. \u7A7A\u767D\u4E0D\u662F 0\u3002\u8BFB\u4E0D\u51FA\u7684\u4E0D\u8981\u731C\u3002",
    "4. \u5165\u300A\u5165\u8CA8\u55AE\u6574\u7406\u8868\u300B\u524D\u6309\u300C\u53D1\u7968\u53F7\u7801\uFF0B\u53D1\u7968\u65E5\u671F\u300D\u67E5\u91CD\uFF0C\u540C\u4E00\u5F20\u5355\u53EA\u5165\u4E00\u6B21\u3002",
    "5. \u54C1\u540D\u5BF9\u4E0D\u4E0A\u5546\u54C1\u8868\u6807\u51C6\u540D\u3001\u91D1\u989D\u5BF9\u4E0D\u4E0A\uFF0C\u5148\u95EE\u8001\u677F\uFF0C\u4E0D\u8981\u81EA\u884C\u5165\u8868\u3002",
    "6. \u5199\u7740\u300C\u6CA1\u8BA4\u51FA\u5B57\u300D\u6216\u4F60\u770B\u4E0D\u6E05\u7684\u90A3\u5F20\uFF0C\u8BF7\u8001\u677F\u8865\u53D1\u90A3\u4E00\u5F20\u7167\u7247\u3002",
    `\u6700\u540E\u66F4\u65B0: ${updatedAt}`,
    ""
  ].join("\n");
}
function keptBlocks(content, cutoff) {
  return content.split(/\n(?===== 扫描ID: )/).filter((part) => part.startsWith(BLOCK_HEAD)).filter((part) => part.slice(BLOCK_HEAD.length, BLOCK_HEAD.length + 8) >= cutoff).map((part) => part.trimEnd());
}
function mergeInbox(old, block2, id, now) {
  const cutoff = stamp(new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1e3)).slice(0, 10).replace(/-/g, "");
  const blocks = keptBlocks(old, cutoff).filter((part) => !part.startsWith(`${BLOCK_HEAD}${id} `));
  blocks.push(block2.trimEnd());
  return `${inboxHeader(stamp(now))}
${blocks.join("\n\n")}
`;
}
function keyFromHash(hash) {
  const body = hash.replace(/^#/, "");
  if (!/(^|&)key=/.test(body)) return null;
  return new URLSearchParams(body).get("key")?.trim() || "";
}
function rawUrl(gist) {
  const owner = gist.owner?.login || "";
  return owner ? `https://gist.githubusercontent.com/${owner}/${gist.id}/raw/${GIST_FILE}` : "";
}
var InboxError = class extends Error {
  constructor(kind, status = 0) {
    super(
      kind === "rejected" ? "\u6536\u4EF6\u94A5\u5319\u4E0D\u5BF9\u6216\u5DF2\u5931\u6548 Inbox key rejected" : kind === "network" ? "\u6CA1\u8FDE\u4E0A\u7F51 No network" : `GitHub \u51FA\u9519 ${status} GitHub error`
    );
    this.kind = kind;
    this.status = status;
  }
};
async function gh(ctx2, path, init) {
  let res;
  try {
    res = await ctx2.fetchFn(`${API}${path}`, {
      method: init?.method || "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${ctx2.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...init?.body ? { "Content-Type": "application/json" } : {}
      },
      body: init?.body ? JSON.stringify(init.body) : void 0
    });
  } catch {
    throw new InboxError("network");
  }
  if (res.status === 401) throw new InboxError("rejected", 401);
  if (!res.ok) throw new InboxError("github", res.status);
  return await res.json();
}
async function findInbox(ctx2, cachedId, now) {
  if (cachedId) {
    try {
      return await gh(ctx2, `/gists/${cachedId}`);
    } catch (err) {
      if (err instanceof InboxError && err.kind !== "github") throw err;
    }
  }
  for (let page = 1; page <= 10; page++) {
    const list = await gh(ctx2, `/gists?per_page=100&page=${page}`);
    const hit = list.find((item) => item.description === GIST_DESC);
    if (hit) return gh(ctx2, `/gists/${hit.id}`);
    if (list.length < 100) break;
  }
  return gh(ctx2, "/gists", {
    method: "POST",
    body: { description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: inboxHeader(stamp(now)) } } }
  });
}
async function gistContent(ctx2, gist) {
  const file = gist.files?.[GIST_FILE];
  if (!file) return "";
  if (!file.truncated) return file.content || "";
  const res = await ctx2.fetchFn(file.raw_url || "");
  return res.ok ? res.text() : "";
}
var PHOTO_HEAD = /^-{4}\s*照片\s*\d*\s*[:：]\s*(.*?)\s*\|\s*照片时间\s*[:：]\s*(.*?)\s*-{4}\s*$/;
var SHORTCUT_HEAD = /^照片\s*[:：]?\s*(\S+)\s+时间\s*[:：]?\s*(.*)$/;
var NO_TIME = "\u6587\u4EF6\u6CA1\u5E26";
function parseShortcutText(text) {
  const photos = [];
  let current = null;
  const body = [];
  const flush = () => {
    if (current) photos.push({ ...current, text: body.join("\n") });
    body.length = 0;
  };
  for (const line of text.split(/\r?\n/)) {
    const head = PHOTO_HEAD.exec(line.trim()) || SHORTCUT_HEAD.exec(line.trim());
    if (head) {
      flush();
      const time = (head[2] || "").trim();
      current = { name: (head[1] || "").trim() || "\u672A\u547D\u540D", fileTime: time === NO_TIME ? "" : time, text: "" };
    } else if (current) {
      body.push(line);
    }
  }
  flush();
  return photos;
}
function fnv(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function photoDedupeKey(photo) {
  if (photo.fileTime) return `${photo.name}|${photo.fileTime}`;
  return `${photo.name}|#${fnv(photoSection(photo, 0).slice(1).join("\n"))}`;
}
function storedPhotoKeys(content) {
  const keys = /* @__PURE__ */ new Set();
  for (const block2 of keptBlocks(content, "00000000")) {
    for (const photo of parseShortcutText(block2)) {
      const lines = photo.text.split("\n").filter((line) => !line.startsWith("==== \u5B8C "));
      keys.add(photoDedupeKey({ ...photo, text: lines.join("\n").replace(/^（这张没认出字）$/, "") }));
    }
  }
  return keys;
}
async function saveShortcutText(ctx2, cachedId, text, now) {
  const photos = parseShortcutText(text);
  const gist = await findInbox(ctx2, cachedId, now);
  const old = await gistContent(ctx2, gist);
  const stored = storedPhotoKeys(old);
  const seen = /* @__PURE__ */ new Set();
  const fresh = photos.filter((photo) => {
    const key = photoDedupeKey(photo);
    if (stored.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!fresh.length) return { gist, id: "", saved: 0, skipped: photos.length };
  const batchAt2 = stamp(now);
  const id = await scanId(batchAt2, fresh);
  const content = mergeInbox(old, buildBlock(id, batchAt2, fresh), id, now);
  await gh(ctx2, `/gists/${gist.id}`, { method: "PATCH", body: { files: { [GIST_FILE]: { content } } } });
  return { gist, id, saved: fresh.length, skipped: photos.length - fresh.length };
}
async function saveBlock(ctx2, cachedId, block2, id, now) {
  const gist = await findInbox(ctx2, cachedId, now);
  const content = mergeInbox(await gistContent(ctx2, gist), block2, id, now);
  await gh(ctx2, `/gists/${gist.id}`, { method: "PATCH", body: { files: { [GIST_FILE]: { content } } } });
  return gist;
}

// tools/invoice-scan-public/main.ts
var MAX_EDGE = 1800;
var TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm";
var TOKEN_KEY = "iscan-gist-token";
var GIST_KEY = "iscan-gist-id";
var SENT_KEY = "iscan-sent-photos";
var SENT_MAX = 3e3;
var KEY_LOG = "iscan-key-log";
var jobs = [];
var batchAt = "";
var block = "";
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
  const clean = name.replace(/[\r\n\t|]/g, " ").trim() || "photo.jpg";
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
  return stamp(new Date(file.lastModified));
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
    const ctx2 = canvas.getContext("2d");
    if (!ctx2) throw new Error("\u6253\u4E0D\u5F00");
    ctx2.drawImage(image, 0, 0, canvas.width, canvas.height);
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
function photoKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}
function sentKeys() {
  try {
    const list = JSON.parse(localStorage.getItem(SENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}
function markSent(files) {
  const list = sentKeys();
  const have = new Set(list);
  for (const file of files) {
    const key = photoKey(file);
    if (!have.has(key)) {
      list.push(key);
      have.add(key);
    }
  }
  localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-SENT_MAX)));
}
function ctx() {
  return { fetchFn: (url, init) => fetch(url, init), token: gistToken() };
}
function gistToken() {
  return localStorage.getItem(TOKEN_KEY)?.trim() || "";
}
function keyText(state) {
  switch (state.kind) {
    case "ok":
      return { cn: "\u94A5\u5319\u5DF2\u88C5\u597D\u3002\u9009\u5B8C\u7167\u7247\u4F1A\u81EA\u52A8\u5B58\u5230\u6536\u4EF6\u5904\u3002", en: "Key installed. Photos you pick are saved to the inbox.", tone: "ok" };
    case "checking":
      return { cn: "\u6B63\u5728\u68C0\u67E5\u94A5\u5319\u2026\u2026", en: "Checking key\u2026", tone: "warn" };
    case "rejected":
      return { cn: "\u94A5\u5319\u4E0D\u5BF9\u6216\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u626B\u7535\u8111\u4E0A\u7684\u4E8C\u7EF4\u7801\u3002", en: "Key rejected. Scan a new QR code.", tone: "bad" };
    case "network":
      return { cn: "\u6CA1\u8FDE\u4E0A\u7F51\u3002\u94A5\u5319\u8FD8\u5728\uFF0C\u8054\u7F51\u540E\u518D\u6253\u5F00\u8FD9\u4E00\u9875\u3002", en: "No network. The key is kept; reopen this page online.", tone: "warn" };
    case "github":
      return { cn: `GitHub \u51FA\u9519\uFF08${state.status}\uFF09\u3002\u94A5\u5319\u8FD8\u5728\uFF0C\u8FC7\u4E00\u4F1A\u518D\u6253\u5F00\u8FD9\u4E00\u9875\u3002`, en: `GitHub error ${state.status}. The key is kept; try later.`, tone: "warn" };
    case "nostore":
      return { cn: "\u8FD9\u4E2A\u6D4F\u89C8\u5668\u5B58\u4E0D\u4F4F\u94A5\u5319\uFF08\u53EF\u80FD\u662F\u65E0\u75D5\u6A21\u5F0F\uFF09\u3002\u8BF7\u7528 Safari \u666E\u901A\u7A97\u53E3\u6253\u5F00\u626B\u7801\u94FE\u63A5\u3002", en: "This browser cannot keep the key. Open the link in normal Safari.", tone: "bad" };
    default: {
      const log = keyLog();
      if (log?.kind === "rejected") {
        return {
          cn: `\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u7684\u94A5\u5319\u5728 ${log.at} \u88AB GitHub \u62D2\u6536\uFF0C\u5DF2\u5220\u6389\u3002\u8BF7\u91CD\u65B0\u626B\u7535\u8111\u4E0A\u7684\u4E8C\u7EF4\u7801\u3002`,
          en: `The key here was rejected by GitHub at ${log.at} and removed. Scan a new QR code.`,
          tone: "bad"
        };
      }
      return {
        cn: "\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u6CA1\u6709\u94A5\u5319\u3002\u94A5\u5319\u53EA\u5B58\u5728\u626B\u7801\u65F6\u6253\u5F00\u7684\u90A3\u4E2A Safari \u666E\u901A\u7A97\u53E3\u91CC\uFF1B\u65E0\u75D5\u6D4F\u89C8\u3001\u522B\u7684\u6D4F\u89C8\u5668\u3001\u4E3B\u5C4F\u5E55\u4E0A\u7684\u7F51\u9875\u56FE\u6807\u90FD\u770B\u4E0D\u5230\u3002\u8BF7\u5728 Safari \u666E\u901A\u7A97\u53E3\u6253\u5F00\u8FD9\u4E00\u9875\uFF0C\u6216\u91CD\u65B0\u626B\u7535\u8111\u4E0A\u7684\u4E8C\u7EF4\u7801\u3002",
        en: "No key in this browser. It lives only in the normal Safari window that opened the QR code, not in private tabs, other browsers or Home Screen web icons.",
        tone: "bad"
      };
    }
  }
}
function keyLog() {
  try {
    const log = JSON.parse(localStorage.getItem(KEY_LOG) || "null");
    return log && (log.kind === "installed" || log.kind === "rejected") && typeof log.at === "string" ? log : null;
  } catch {
    return null;
  }
}
function writeKeyLog(kind) {
  try {
    localStorage.setItem(KEY_LOG, JSON.stringify({ kind, at: stamp(/* @__PURE__ */ new Date()) }));
  } catch {
  }
}
function setBi(el, cn, en) {
  el.innerHTML = "";
  const wrap = document.createElement("span");
  wrap.className = "bi-inline";
  const a = document.createElement("span");
  a.className = "bi-cn";
  a.textContent = cn;
  const b = document.createElement("span");
  b.className = "bi-en";
  b.textContent = en;
  wrap.append(a, b);
  el.append(wrap);
}
function showKeyState(state, big = false) {
  const text = keyText(state);
  for (const id of ["#key-status", "#setup-state"]) {
    const el = document.querySelector(id);
    if (!el) continue;
    setBi(el, text.cn, text.en);
    el.dataset.tone = text.tone;
    el.hidden = false;
  }
  document.querySelector("#key-status")?.classList.toggle("big", big);
  const keyKept = state.kind === "ok" || state.kind === "checking" || state.kind === "network" || state.kind === "github";
  const row = document.querySelector("#key-row");
  if (row) row.hidden = keyKept;
  const url = state.kind === "ok" ? state.url : "";
  const urlEl = document.querySelector("#inbox-url");
  if (urlEl) {
    urlEl.textContent = url;
    urlEl.hidden = !url;
  }
  const copy = document.querySelector("#copy-url");
  if (copy) copy.hidden = !url;
  if (!keyKept) openSetup();
}
function inboxOk(gist, big = false) {
  localStorage.setItem(GIST_KEY, gist.id);
  if (keyLog()?.kind !== "installed") writeKeyLog("installed");
  showKeyState({ kind: "ok", url: rawUrl(gist) }, big);
}
function inboxFailed(err, big = false) {
  if (err instanceof InboxError && err.kind === "rejected") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(GIST_KEY);
    writeKeyLog("rejected");
    showKeyState({ kind: "rejected" }, big);
  } else if (err instanceof InboxError && err.kind === "github") {
    showKeyState({ kind: "github", status: err.status }, big);
  } else {
    showKeyState({ kind: "network" }, big);
  }
}
function checkKey(cachedId, big = false) {
  showKeyState({ kind: "checking" }, big);
  void findInbox(ctx(), cachedId, /* @__PURE__ */ new Date()).then(
    (gist) => inboxOk(gist, big),
    (err) => inboxFailed(err, big)
  );
}
function storeKey(value) {
  try {
    localStorage.setItem(TOKEN_KEY, value);
    localStorage.removeItem(GIST_KEY);
  } catch {
    return false;
  }
  return localStorage.getItem(TOKEN_KEY) === value;
}
function setNotice(text) {
  noticeEl.textContent = text;
  noticeEl.hidden = !text;
}
function openSetup() {
  const setup = document.querySelector("#setup");
  if (setup) setup.open = true;
}
function render() {
  statusEl.hidden = !statusEl.textContent;
  emptyEl.hidden = jobs.length > 0;
  listEl.innerHTML = "";
  for (const job of jobs) {
    const li = document.createElement("li");
    li.className = "iscan-card";
    const strong = document.createElement("strong");
    strong.textContent = job.name;
    li.append(strong);
    const p = document.createElement("p");
    p.textContent = job.readError || job.text.replace(/\s+/g, " ").trim().slice(0, 80) || "\uFF08\u6CA1\u8BA4\u51FA\u5B57\uFF09";
    li.append(p);
    listEl.append(li);
  }
  packetEl.value = block;
  packetEl.hidden = !block;
  actionsEl.hidden = !block;
  document.querySelectorAll(".iscan-primary, .iscan-secondary").forEach((button) => {
    if (button.dataset.keep !== "out") button.disabled = busy;
  });
}
async function run(list) {
  const images = [...list].filter(
    (file) => file.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)
  );
  if (!images.length) return;
  const sent = new Set(sentKeys());
  const incoming = images.filter((file) => !sent.has(photoKey(file)));
  const skipped = images.length - incoming.length;
  const skipNote = skipped ? `${skipped} \u5F20\u4E4B\u524D\u5DF2\u5B58\u8FC7\uFF0C\u5DF2\u8DF3\u8FC7\u3002 ${skipped} already sent, skipped. ` : "";
  if (!incoming.length) {
    setNotice(skipNote.trim());
    return;
  }
  jobs.splice(0, jobs.length);
  batchAt = "";
  block = "";
  busy = true;
  setNotice(skipNote.trim());
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
      const fileTime = fileTimeOf(file, now);
      statusEl.textContent = `\u6B63\u5728\u8BA4\u5B57 Reading ${i + 1}/${incoming.length} ${name}`;
      render();
      try {
        const canvas = await imageForOcr(file);
        const result = await worker.recognize(canvas);
        jobs.push({ file, name, fileTime, text: result.data?.text || "" });
      } catch (err) {
        jobs.push({ file, name, fileTime, text: "", readError: err instanceof Error ? err.message : "\u6253\u4E0D\u5F00" });
      }
      render();
    }
    batchAt = stamp(new Date(now));
    const id = await scanId(batchAt, jobs);
    block = buildBlock(id, batchAt, jobs);
    statusEl.textContent = "";
    if (!gistToken()) {
      showKeyState({ kind: "none" });
      setNotice(`${skipNote}\u8FD8\u6CA1\u88C5\u94A5\u5319\uFF0C\u8FD9\u6279\u6587\u5B57\u6CA1\u6709\u5B58\u3002\u8BF7\u5148\u626B\u7535\u8111\u4E0A\u7684\u4E8C\u7EF4\u7801\u3002 No key yet; this batch was not saved.`);
    } else {
      statusEl.textContent = "\u6B63\u5728\u5B58\u5230\u6536\u4EF6\u5904 Saving to inbox";
      render();
      try {
        const gist = await saveBlock(ctx(), localStorage.getItem(GIST_KEY) || "", block, id, /* @__PURE__ */ new Date());
        markSent(jobs.map((job) => job.file));
        inboxOk(gist);
        setNotice(`${skipNote}\u5DF2\u5B58\u5230\u6536\u4EF6\u5904\uFF0C\u4E0D\u7528\u518D\u505A\u4EC0\u4E48\u3002\u626B\u63CFID ${id}\u3002 Saved to the inbox.`);
      } catch (err) {
        inboxFailed(err);
        setNotice(`${skipNote}\u6CA1\u5B58\u4E0A\uFF1A${err instanceof Error ? err.message : "\u6536\u4EF6\u5904\u51FA\u9519"}\u3002\u53EF\u4EE5\u7A0D\u540E\u518D\u9009\u4E00\u6B21\u8FD9\u6279\u7167\u7247\u91CD\u8BD5\u3002`);
      } finally {
        statusEl.textContent = "";
      }
    }
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
    setNotice("\u8FD9\u53F0\u6D4F\u89C8\u5668\u4E0D\u80FD\u4E00\u6B21\u5206\u4EAB\u591A\u5F20\u56FE\u3002\u539F\u56FE\u4ECD\u5728\u76F8\u518C\u91CC\u3002 This browser cannot share many photos at once. Photos stay in the library.");
    return;
  }
  await navigator.share({ files: payload, title });
  setNotice("\u539F\u56FE\u5DF2\u4EA4\u7ED9\u7CFB\u7EDF\u5206\u4EAB\u3002\u4E0D\u8981\u628A\u5B83\u4EEC\u8D34\u8FDB Grok \u5BF9\u8BDD\u3002 Photos handed to the share sheet. Do not paste them into Grok.");
}
function packetFileName() {
  return `\u5165\u8D27\u626B\u63CF\u5305-${batchAt.replace(/[: ]/g, "") || "scan"}.txt`;
}
function downloadText() {
  const blob = new Blob([block], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = packetFileName();
  link.click();
  URL.revokeObjectURL(url);
}
async function dropOneDrive() {
  const name = packetFileName();
  const file = new File([block], name, { type: "text/plain" });
  const saved = "\u8BF7\u628A\u8FD9\u4E2A\u6587\u5B57\u6587\u4EF6\u5B58\u8FDB OneDrive/2026/\u5165\u8D27\u626B\u63CF\u6536\u4EF6/inbox\u3002\u4E0D\u8981\u653E\u539F\u56FE\u3002 Save this text file into OneDrive/2026/\u5165\u8D27\u626B\u63CF\u6536\u4EF6/inbox. Do not add photos.";
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name, text: saved });
  } else {
    downloadText();
  }
  setNotice(saved);
}
document.querySelector("#save-token")?.addEventListener("click", () => {
  const input = document.querySelector("#token");
  const value = input?.value.trim() || "";
  if (!value) return;
  if (input) input.value = "";
  if (!storeKey(value)) {
    showKeyState({ kind: "nostore" });
    return;
  }
  checkKey("");
});
document.querySelector("#copy-url")?.addEventListener("click", () => {
  const url = document.querySelector("#inbox-url")?.textContent || "";
  void navigator.clipboard.writeText(url).then(
    () => setNotice("\u6536\u4EF6\u7F51\u5740\u5DF2\u590D\u5236\u3002\u53EA\u4EA4\u7ED9 Grok\uFF0C\u4E0D\u8981\u53D1\u5230\u7FA4\u91CC\u3002 Inbox link copied. Give it only to Grok."),
    () => setNotice("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u957F\u6309\u7F51\u5740\u624B\u52A8\u590D\u5236\u3002")
  );
});
function setPasteResult(cn, en, tone) {
  const el = document.querySelector("#paste-result");
  if (!el) return;
  setBi(el, cn, en);
  el.dataset.tone = tone;
  el.classList.add("big");
  el.hidden = false;
}
async function saveFromClipboard() {
  const button = document.querySelector("#paste-save");
  if (button) button.disabled = true;
  try {
    if (!gistToken()) {
      showKeyState({ kind: "none" });
      setPasteResult("\u6CA1\u5B58\uFF1A\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\u6CA1\u6709\u94A5\u5319\uFF0C\u89C1\u4E0A\u9762\u7EA2\u5B57\u3002", "Not saved: no key in this browser.", "bad");
      return;
    }
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setPasteResult("\u6CA1\u8BFB\u5230\u526A\u8D34\u677F\u3002\u8BF7\u518D\u70B9\u4E00\u6B21\u5927\u6309\u94AE\uFF0C\u624B\u673A\u95EE\u300C\u7C98\u8D34\u300D\u65F6\u70B9\u5B83\u3002", "Could not read the clipboard. Tap again and choose \u7C98\u8D34.", "bad");
      return;
    }
    const photos = parseShortcutText(text);
    if (!photos.length) {
      setPasteResult("\u526A\u8D34\u677F\u91CC\u4E0D\u662F\u8BA4\u5B57\u7ED3\u679C\u3002\u8BF7\u91CD\u65B0\u8FD0\u884C\u300C\u5165\u8D27\u8BA4\u5B57\u300D\u5FEB\u6377\u6307\u4EE4\u3002", "The clipboard has no scan result. Run the \u5165\u8D27\u8BA4\u5B57 shortcut again.", "bad");
      return;
    }
    setPasteResult(`\u6B63\u5728\u5B58 ${photos.length} \u5F20\u2026\u2026`, `Saving ${photos.length} photos\u2026`, "warn");
    const result = await saveShortcutText(ctx(), localStorage.getItem(GIST_KEY) || "", text, /* @__PURE__ */ new Date());
    inboxOk(result.gist);
    if (!result.saved) {
      setPasteResult(`\u8FD9 ${result.skipped} \u5F20\u4E4B\u524D\u90FD\u5B58\u8FC7\u4E86\uFF0C\u6CA1\u6709\u91CD\u590D\u5B58\u3002`, `All ${result.skipped} were saved before; nothing duplicated.`, "ok");
    } else {
      const skip = result.skipped ? `\uFF1B${result.skipped} \u5F20\u4E4B\u524D\u5B58\u8FC7\uFF0C\u8DF3\u8FC7` : "";
      setPasteResult(
        `\u5DF2\u5B58\u8FDB\u6536\u4EF6\u5904 ${result.saved} \u5F20${skip}\u3002\u626B\u63CFID ${result.id}`,
        `Saved ${result.saved} to the inbox${result.skipped ? `, skipped ${result.skipped}` : ""}.`,
        "ok"
      );
    }
  } catch (err) {
    inboxFailed(err);
    const why = err instanceof Error ? err.message : "\u6536\u4EF6\u5904\u51FA\u9519";
    setPasteResult(`\u6CA1\u5B58\u4E0A\uFF1A${why}\u3002\u6587\u5B57\u8FD8\u5728\u526A\u8D34\u677F\u91CC\uFF0C\u7A0D\u540E\u518D\u70B9\u4E00\u6B21\u3002`, "Not saved. The text is still on the clipboard; try again later.", "bad");
  } finally {
    if (button) button.disabled = false;
  }
}
document.querySelector("#paste-save")?.addEventListener("click", () => {
  void saveFromClipboard();
});
function takePasteHash() {
  if (location.hash !== "#paste") return false;
  history.replaceState(null, "", location.pathname + location.search);
  setPasteResult("\u5FEB\u6377\u6307\u4EE4\u5DF2\u8BA4\u5B8C\u5B57\u3002\u70B9\u4E0A\u9762\u7684\u300C\u5B58\u8FDB\u6536\u4EF6\u5904\u300D\u3002", "The shortcut finished. Tap \u5B58\u8FDB\u6536\u4EF6\u5904 above.", "warn");
  document.querySelector("#paste-panel")?.scrollIntoView({ block: "center" });
  return true;
}
function takeLinkKey() {
  if (takePasteHash()) return false;
  const linkKey = keyFromHash(location.hash);
  if (linkKey === null) return false;
  history.replaceState(null, "", location.pathname + location.search);
  if (!linkKey) showKeyState({ kind: "rejected" }, true);
  else if (storeKey(linkKey)) checkKey("", true);
  else showKeyState({ kind: "nostore" }, true);
  window.scrollTo(0, 0);
  return true;
}
window.addEventListener("hashchange", () => {
  takeLinkKey();
});
if (takeLinkKey()) {
} else if (gistToken()) {
  checkKey(localStorage.getItem(GIST_KEY) || "");
} else {
  showKeyState({ kind: "none" });
}
document.querySelector("#pick")?.addEventListener("click", () => albumEl.click());
document.querySelector("#take")?.addEventListener("click", () => cameraEl.click());
albumEl.addEventListener("change", () => {
  if (albumEl.files?.length) void run(albumEl.files);
  albumEl.value = "";
});
cameraEl.addEventListener("change", () => {
  if (cameraEl.files?.length) void run(cameraEl.files);
  cameraEl.value = "";
});
document.querySelector("#copy")?.addEventListener("click", () => {
  void navigator.clipboard.writeText(block).then(
    () => setNotice("\u5DF2\u590D\u5236\u3002\u8D34\u7ED9 Grok \u65F6\u4E0D\u8981\u5E26\u4E0A\u539F\u56FE\u3002 Copied. Paste to Grok without the photos."),
    () => setNotice("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u957F\u6309\u6587\u5B57\u624B\u52A8\u590D\u5236\u3002")
  );
});
document.querySelector("#download")?.addEventListener("click", downloadText);
document.querySelector("#inbox")?.addEventListener("click", () => {
  void dropOneDrive();
});
document.querySelector("#share-all")?.addEventListener("click", () => {
  void share(jobs.map((job) => job.file), "\u539F\u56FE");
});
render();
