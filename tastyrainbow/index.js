import CodeFlask from "https://cdn.jsdelivr.net/npm/codeflask@1.4.1/+esm";
import hljs from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/highlight.min.js";
import js from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/javascript.min.js";
import erlang from "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/es/languages/erlang.min.js";
import lz from "https://cdn.jsdelivr.net/npm/lz-string@1.5.0/+esm";

globalThis.CodeFlask = CodeFlask;
globalThis.hljs = hljs;

hljs.registerLanguage("javascript", js);
hljs.registerLanguage("erlang", erlang);

const outputEl = document.querySelector("#output");
const compiledJavascriptEl = document.querySelector("#compiled-javascript");
const compiledErlangEl = document.querySelector("#compiled-erlang");
const initialCode = document.querySelector("#code").innerHTML;

const prismGrammar = {
  comment: {
    pattern: /\/\/.*/,
    greedy: true,
  },
  function: /([a-z_][a-z0-9_]+)(?=\()/,
  keyword:
    /\b(use|case|if|@external|@deprecated|fn|import|let|assert|try|pub|type|opaque|const|panic|todo|as|echo)\b/,
  symbol: {
    pattern: /([A-Z][A-Za-z0-9_]+)/,
    greedy: true,
  },
  operator: {
    pattern:
      /(<<|>>|<-|->|\|>|<>|\.\.|<=\.?|>=\.?|==\.?|!=\.?|<\.?|>\.?|&&|\|\||\+\.?|-\.?|\/\.?|\*\.?|%\.?|=)/,
    greedy: true,
  },
  string: {
    pattern: /"((?:[^"\\]|\\.)*)"/,
    greedy: true,
  },
  module: {
    pattern: /([a-z][a-z0-9_]*)\./,
    inside: {
      punctuation: /\./,
    },
    alias: "keyword",
  },
  punctuation: /[.\\:,{}()]/,
  number:
    /\b(?:0b[0-1]+|0o[0-7]+|[[:digit:]][[:digit:]_]*(\\.[[:digit:]]*)?|0x[[:xdigit:]]+)\b/,
};

function clearElement(target) {
  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }
}

function appendCode(target, content, className) {
  if (!content) return;
  const escapedContent = escapeHtml(content);
  const formattedContent = highlightEchoPath(escapedContent);
  const element = document.createElement("pre");
  const code = document.createElement("code");
  code.innerHTML = formattedContent;
  element.appendChild(code);
  element.className = className;
  target.appendChild(element);
}

function escapeHtml(content) {
  const div = document.createElement("div");
  div.textContent = content;
  return div.innerHTML;
}

function highlightEchoPath(content) {
  if (typeof content !== "string") return content;
  const pathRegex = /(^src\/main.gleam:\d+$)/gm;
  const newContent = content.replace(
    pathRegex,
    '<span class="echo-path">$1</span>',
  );
  return newContent;
}

function highlightOutput(target, childClassName) {
  // Disable annoying warnings from hljs
  const warn = console.warn;
  console.warn = () => {};
  target.querySelectorAll(`.${childClassName}`).forEach((element) => {
    hljs.highlightElement(element);
  });
  console.warn = warn;
}

const editor = new CodeFlask("#editor-target", {
  language: "gleam",
  defaultTheme: false,
});
editor.addLanguage("gleam", prismGrammar);
editor.updateCode(initialCode);

// --- Type-based coloring -----------------------------------------------------
//
// After each successful compile, the worker returns highlight tokens
// `{start, end, marker}` plus a `customs` pool. `marker` is `0..10` for
// built-in kinds (in the order below) or `>= 11` for user-defined types,
// where `customs[marker - 11]` is a `"module:name"` identity. The compiler
// makes no palette decisions, so we choose here whether to alias.
//
// If the editor's content has changed since the compile started, we skip --
// stale tokens are worse than no tokens. The next compile will catch up.

// --- Type → colour --------------------------------------------------------
//
// Stable per-identity colour assignment. We turn each token into a string
// identity (`"gleamInt"`, `"gleamFloat"`, ..., or for user-defined types
// the raw `"module:name"`) and map that to a colour, assigning in first-seen
// order. The map lives for the page's lifetime so colours stay stable across
// compiles.
//
// Tier 1: Reserved Catppuccin Mocha colours for the six "core" identities.
// Tier 2: Remaining Catppuccin Mocha colours, handed out in first-seen
//   order to other identities.
// Tier 3: Deterministic vivid HSL fallback (hash of the identity name) for
//   anything past tier 2, so colours remain stable per identity.

const BUILTIN_IDENTITIES = [
  "gleamInt",       // 0
  "gleamFloat",     // 1
  "gleamString",    // 2
  "gleamBool",      // 3
  "gleamNil",       // 4
  "gleamList",      // 5
  "gleamResult",    // 6
  "gleamBitArray",  // 7
  "gleamTuple",     // 8
  "gleamFunction",  // 9
  "gleamUnknown",   // 10
];

const FIXED_COLORS = {
  gleamString: "#50fa7b",          // vivid green
  gleamInt: "#f1fa8c",             // saturated yellow
  gleamFloat: "#ffb86c",           // orange
  gleamBool: "#bd93f9",            // vivid purple
  gleamNil: "#ff79c6",             // pink
  gleamResult: "#ff5555",          // true red
  "gleam/option:Option": "#8be9fd", // cyan
};

// Catppuccin Mocha colours not reserved above.
const SECONDARY_PALETTE = [
  "#f5e0dc", // Rosewater
  "#f2cdcd", // Flamingo
  "#f5c2e7", // Pink
  "#eba0ac", // Maroon
  "#94e2d5", // Teal
  "#89dceb", // Sky
  "#89b4fa", // Blue
  "#b4befe", // Lavender
];

const _typeColor = new Map(); // identity → hex/HSL string
let _secondaryUsed = 0;

function fallbackColorForName(name) {
  // FNV-1a 32-bit so the colour is deterministic per identity.
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h = (h ^ name.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const hue = h % 360;
  const sat = 60 + ((h >>> 8) % 30);   // 60–89%
  const light = 65 + ((h >>> 16) % 15); // 65–79%
  return `hsl(${hue}deg, ${sat}%, ${light}%)`;
}

function colorForIdentity(name) {
  let c = _typeColor.get(name);
  if (c !== undefined) return c;
  if (FIXED_COLORS[name] !== undefined) {
    c = FIXED_COLORS[name];
  } else if (_secondaryUsed < SECONDARY_PALETTE.length) {
    c = SECONDARY_PALETTE[_secondaryUsed++];
  } else {
    c = fallbackColorForName(name);
  }
  _typeColor.set(name, c);
  return c;
}

function identityFor(marker, customs) {
  if (marker < BUILTIN_IDENTITIES.length) return BUILTIN_IDENTITIES[marker];
  const i = marker - BUILTIN_IDENTITIES.length;
  return (customs && customs[i]) || `_b${marker}`;
}

// Track the most recent successful tokens. We re-apply them whenever
// CodeFlask re-renders (every keystroke), as long as the source still
// matches.
let lastCompile = null; // { code, tokens, customs }

function utf8ByteIndex(str) {
  // Map character index -> byte offset (Gleam tokens are byte-based).
  // Returns Uint32Array where charIdx -> byteOffset; final entry is total bytes.
  const enc = new TextEncoder();
  const out = new Uint32Array(str.length + 1);
  let byte = 0;
  for (let i = 0; i < str.length; i++) {
    out[i] = byte;
    const code = str.charCodeAt(i);
    if (code < 0x80) byte += 1;
    else if (code < 0x800) byte += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // high surrogate, paired
      byte += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      // low surrogate, already counted by the high one
    } else byte += 3;
  }
  out[str.length] = byte;
  return out;
}

function escapeHtmlForCode(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderTypeColors(code, tokens, customs) {
  // Convert byte offsets in tokens back to char offsets, then build HTML.
  // The mapping is small (re-built once per render) and editor sources are
  // tiny, so we keep this simple.
  const charToByte = utf8ByteIndex(code);
  // Inverse: walk char indices and find the largest charIdx whose byte
  // offset is <= target. Linear pass since tokens come pre-sorted.
  const byteToChar = (byte) => {
    // Binary search.
    let lo = 0, hi = charToByte.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (charToByte[mid] < byte) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  let html = "";
  let cursor = 0;
  for (const t of tokens) {
    const startChar = byteToChar(t.start);
    const endChar = byteToChar(t.end);
    if (startChar < cursor) continue; // overlap, skip
    if (startChar > cursor) {
      html += escapeHtmlForCode(code.slice(cursor, startChar));
    }
    const piece = escapeHtmlForCode(code.slice(startChar, endChar));
    const colour = colorForIdentity(identityFor(t.marker, customs));
    html += `<span style="color:${colour}">${piece}</span>`;
    cursor = endChar;
  }
  if (cursor < code.length) {
    html += escapeHtmlForCode(code.slice(cursor));
  }
  return html;
}

function commonPrefixCharLen(a, b) {
  const m = Math.min(a.length, b.length);
  let i = 0;
  while (i < m && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function commonSuffixCharLen(a, b, capPrefix) {
  const m = Math.min(a.length - capPrefix, b.length - capPrefix);
  let i = 0;
  while (i < m && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) i++;
  return i;
}

function utf8ByteLen(str, fromChar, toChar) {
  let bytes = 0;
  for (let i = fromChar; i < toChar; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) bytes += 4;
    else if (code >= 0xdc00 && code <= 0xdfff) {/* paired with high surrogate */}
    else bytes += 3;
  }
  return bytes;
}

function applyTypeColors() {
  if (!lastCompile) return;
  const codeEl = document.querySelector("#editor-target .codeflask__code");
  if (!codeEl) return;
  const liveCode = editor.getCode();
  if (liveCode === lastCompile.code) {
    codeEl.innerHTML = renderTypeColors(lastCompile.code, lastCompile.tokens, lastCompile.customs);
    document.documentElement.classList.add("tokens-ready");
    return;
  }
  // Code changed since last successful compile (e.g. user is mid-edit and
  // the compile is failing). Re-apply tokens that still fall entirely in
  // the unchanged prefix/suffix bytes; shift suffix tokens by the byte
  // delta. Tokens straddling the edited region are dropped — that span
  // simply renders without colour rather than reverting to Prism.
  const oldCode = lastCompile.code;
  const pChars = commonPrefixCharLen(oldCode, liveCode);
  const sChars = commonSuffixCharLen(oldCode, liveCode, pChars);
  const pBytes = utf8ByteLen(oldCode, 0, pChars);
  const oldByteLen = utf8ByteLen(oldCode, 0, oldCode.length);
  const newByteLen = utf8ByteLen(liveCode, 0, liveCode.length);
  const sBytes = utf8ByteLen(oldCode, oldCode.length - sChars, oldCode.length);
  const oldSuffixStart = oldByteLen - sBytes;
  const delta = newByteLen - oldByteLen;
  const adjusted = [];
  for (const t of lastCompile.tokens) {
    if (t.end <= pBytes) {
      adjusted.push(t);
    } else if (t.start >= oldSuffixStart) {
      adjusted.push({ start: t.start + delta, end: t.end + delta, marker: t.marker });
    }
  }
  codeEl.innerHTML = renderTypeColors(liveCode, adjusted, lastCompile.customs);
  document.documentElement.classList.add("tokens-ready");
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Whether the worker is currently working or not, used to avoid sending
// multiple messages to the worker at once.
// This will be true when the worker is compiling and executing the code, but
// this first time it is as the worker is initialising.
let workerWorking = true;
let queuedWork = undefined;
const worker = new Worker("worker.js", { type: "module" });

function sendToWorker(code) {
  if (workerWorking) {
    queuedWork = code;
    return;
  }
  workerWorking = true;
  worker.postMessage(code);
}

worker.onmessage = (event) => {
  // Handle the result of the compilation and execution
  const result = event.data;
  clearElement(outputEl);
  clearElement(compiledJavascriptEl);
  clearElement(compiledErlangEl);
  if (result.log) {
    appendCode(outputEl, result.log, "log");
  }
  if (result.error) {
    appendCode(outputEl, result.error, "error");
  }
  if (result.js) {
    appendCode(compiledJavascriptEl, result.js, "javascript");
  }
  if (result.erlang) {
    appendCode(compiledErlangEl, result.erlang, "erlang");
  }
  for (const warning of result.warnings || []) {
    appendCode(outputEl, warning, "warning");
  }

  highlightOutput(compiledJavascriptEl, "javascript");
  highlightOutput(compiledErlangEl, "erlang");

  if (result.tokens && result.tokens.length && typeof result.code === "string") {
    lastCompile = {
      code: result.code,
      tokens: result.tokens,
      customs: result.customs || [],
    };
    applyTypeColors();
  }

  // Deal with any queued work
  workerWorking = false;
  if (queuedWork) sendToWorker(queuedWork);
  queuedWork = undefined;
};

// Re-paint type colours after every CodeFlask re-render (each keystroke).
// applyTypeColors is a no-op if the editor's content has changed since the
// last successful compile.
editor.onUpdate(
  debounce((code) => {
    sendToWorker(code);
  }, 200),
);

const _origHighlight = editor.highlight.bind(editor);
editor.highlight = function () {
  _origHighlight();
  applyTypeColors();
};

/**
 * Hashed object format:
 * {
 *   version: 1,
 *   content: "code"
 * }
 */
function makeV1Hash(code) {
  return lz.compressToBase64(
    JSON.stringify({
      version: 1,
      content: code,
    }),
  );
}

function parseV1Hash(obj) {
  if (obj.version !== 1) {
    throw new Error("Unsupported version");
  }
  return obj.content;
}

function parseHash(hash) {
  let obj;
  try {
    obj = JSON.parse(lz.decompressFromBase64(hash));
  } catch (e) {
    return null;
  }
  if (!obj) {
    return null;
  }
  switch (obj.version) {
    case 1:
      return parseV1Hash(obj);
  }
  return null;
}

if (window.location.hash) {
  const hash = window.location.hash.slice(1);
  const code = parseHash(hash);
  if (code) {
    editor.updateCode(code);
  }
}

const shareButton = document.querySelector("#share-button");

function share() {
  const code = editor.getCode();
  const compressed = makeV1Hash(code);
  const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
  navigator.clipboard.writeText(url);
  const before = shareButton.textContent;
  shareButton.textContent = "Link copied!";
  setTimeout(() => {
    shareButton.textContent = before;
  }, 1000);
}
shareButton.addEventListener("click", share);
