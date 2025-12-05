// src/app.ts
var THEME_KEY = "wormhole-theme";
var TEXT_MAX_LENGTH = 1e4;
var ENCRYPTION_MARKER = "WORMHOLE_ENCRYPTED_V1:";
var STATUS = {
  IDLE: "idle",
  FILES_SELECTED: "files-selected",
  TEXT_SELECTED: "text-selected",
  SENDING: "sending",
  CODE_ENTERED: "code-entered",
  RECEIVING: "receiving",
  SUCCESS: "success",
  ERROR: "error",
  TEXT_RECEIVED: "text-received",
  PASSWORD_REQUIRED: "password-required"
};
var ICONS = {
  upload: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  check: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  download16: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  lockLarge: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eyeOpen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeClosed: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
};
var state = {
  tab: "send",
  send: {
    status: STATUS.IDLE,
    files: [],
    textMessage: "",
    sendMode: "file",
    transferId: null,
    code: null,
    transferPhase: null,
    progress: null,
    error: null,
    encrypt: false,
    password: "",
    showPassword: false
  },
  receive: {
    status: STATUS.IDLE,
    code: "",
    transferId: null,
    progress: null,
    filename: null,
    textContent: null,
    downloadPath: null,
    error: null,
    needsPassword: false,
    encryptedData: null,
    decryptPassword: "",
    showDecryptPassword: false
  }
};
var sendContainer = null;
var receiveContainer = null;
var activeWebSocket = null;
function $(id) {
  return document.getElementById(id);
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = sizes[i];
  if (size === undefined) {
    return "0 B";
  }
  return String(parseFloat((bytes / Math.pow(k, i)).toFixed(1))) + " " + size;
}
function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}
setTheme(getPreferredTheme());
async function deriveKey(password, salt) {
  const enc = new TextEncoder;
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt.buffer, iterations: 1e5, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv.buffer }, key, data.buffer);
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);
  return result;
}
async function decryptData(encryptedData, password) {
  const salt = encryptedData.slice(0, 16);
  const iv = encryptedData.slice(16, 28);
  const data = encryptedData.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv.buffer }, key, data.buffer);
  return new Uint8Array(decrypted);
}
async function encryptText(text, password) {
  const enc = new TextEncoder;
  const encrypted = await encryptData(enc.encode(text), password);
  return ENCRYPTION_MARKER + btoa(String.fromCharCode(...encrypted));
}
async function decryptText(encryptedText, password) {
  if (!encryptedText.startsWith(ENCRYPTION_MARKER)) {
    throw new Error("Not encrypted");
  }
  const base64 = encryptedText.slice(ENCRYPTION_MARKER.length);
  const encrypted = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const decrypted = await decryptData(encrypted, password);
  return new TextDecoder().decode(decrypted);
}
async function encryptFile(file, password) {
  const arrayBuffer = await file.arrayBuffer();
  const encrypted = await encryptData(new Uint8Array(arrayBuffer), password);
  const metadata = { name: file.name, type: file.type };
  const metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
  const metaLen = new Uint32Array([metaBytes.length]);
  const result = new Uint8Array(4 + metaBytes.length + encrypted.length);
  result.set(new Uint8Array(metaLen.buffer), 0);
  result.set(metaBytes, 4);
  result.set(encrypted, 4 + metaBytes.length);
  return new File([result.buffer], file.name + ".encrypted", {
    type: "application/octet-stream"
  });
}
async function decryptFile(encryptedFile, password) {
  const arrayBuffer = await encryptedFile.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const metaLenArray = new Uint32Array(data.slice(0, 4).buffer);
  const metaLen = metaLenArray[0];
  if (metaLen === undefined) {
    throw new Error("Invalid encrypted file format");
  }
  const metaBytes = data.slice(4, 4 + metaLen);
  const metadata = JSON.parse(new TextDecoder().decode(metaBytes));
  const encrypted = data.slice(4 + metaLen);
  const decrypted = await decryptData(encrypted, password);
  return new File([decrypted.buffer], metadata.name, { type: metadata.type });
}
function isEncryptedText(text) {
  return text?.startsWith(ENCRYPTION_MARKER) ?? false;
}
function setSendState(updates, skipRender = false) {
  state.send = { ...state.send, ...updates };
  if (!skipRender) {
    renderSend();
  }
}
function setReceiveState(updates, skipRender = false) {
  state.receive = { ...state.receive, ...updates };
  if (!skipRender) {
    renderReceive();
  }
}
function getWebSocketUrl(transferId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws?id=${transferId}`;
}
function closeActiveWebSocket() {
  if (activeWebSocket !== null) {
    activeWebSocket.close();
    activeWebSocket = null;
  }
}
function startSendWebSocket(transferId) {
  closeActiveWebSocket();
  const ws = new WebSocket(getWebSocketUrl(transferId));
  activeWebSocket = ws;
  ws.onmessage = (event) => {
    const status = JSON.parse(event.data);
    if (status.status === "waiting" && state.send.status !== STATUS.SUCCESS) {
      const particleContainer = $("particleContainer");
      if (particleContainer !== null) {
        window.transitionToDrift(particleContainer);
      }
      setSendState({
        status: STATUS.SUCCESS,
        code: status.code ?? null,
        transferPhase: "waiting"
      }, true);
      const statusTextEl = document.querySelector(".status-text");
      if (statusTextEl !== null) {
        statusTextEl.textContent = "Waiting for receiver";
      }
      const codeDisplay = $("codeDisplay");
      if (codeDisplay !== null) {
        codeDisplay.textContent = status.code ?? "";
        codeDisplay.classList.remove("skeleton");
      }
      const copyBtn = $("copyBtn");
      if (copyBtn !== null) {
        copyBtn.classList.remove("disabled");
        if (copyBtn instanceof HTMLButtonElement) {
          copyBtn.disabled = false;
        }
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(status.code ?? "");
          const span = copyBtn.querySelector("span");
          if (span !== null) {
            span.textContent = "Copied!";
            setTimeout(() => {
              span.textContent = "Copy code";
            }, 2000);
          }
        });
      }
      const resetBtn = $("resetSendBtn");
      if (resetBtn !== null) {
        resetBtn.classList.remove("invisible");
        resetBtn.addEventListener("click", clearSend);
      }
      if (state.send.encrypt) {
        const successBox = document.querySelector(".success-box");
        if (successBox !== null && successBox.querySelector(".encrypt-note") === null) {
          const note = document.createElement("div");
          note.className = "encrypt-note";
          const lockIcon = ICONS["lock"];
          note.innerHTML = `${lockIcon ?? ""} Password protected - share the password separately`;
          successBox.appendChild(note);
        }
      }
    } else if (status.status === "complete") {
      state.send.transferPhase = "complete";
      const particleContainer = $("particleContainer");
      if (particleContainer !== null) {
        window.morphParticlesToCheck(particleContainer);
      }
      const statusText = document.querySelector(".status-text");
      if (statusText !== null) {
        statusText.textContent = "Transfer complete";
      }
      ws.close();
    } else if (status.status === "error") {
      setSendState({
        status: STATUS.ERROR,
        error: status.error ?? "Unknown error"
      });
      ws.close();
    }
  };
  ws.onerror = () => {
    setSendState({
      status: STATUS.ERROR,
      error: "Connection lost"
    });
  };
}
function startReceiveWebSocket(transferId) {
  closeActiveWebSocket();
  const ws = new WebSocket(getWebSocketUrl(transferId));
  activeWebSocket = ws;
  ws.onmessage = (event) => {
    const status = JSON.parse(event.data);
    if (status.status === "complete") {
      const particleContainer = $("particleContainer");
      const shouldTransition = particleContainer !== null && state.receive.status === STATUS.RECEIVING;
      if (status.textContent !== undefined) {
        if (isEncryptedText(status.textContent)) {
          setReceiveState({
            status: STATUS.PASSWORD_REQUIRED,
            encryptedData: status.textContent,
            needsPassword: true,
            decryptPassword: ""
          });
          const newContainer = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.TEXT_RECEIVED,
            textContent: status.textContent
          });
          const newContainer = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer, () => {
              window.morphParticlesToCheck(newContainer);
            });
          }
        }
      } else {
        if (status.filename?.endsWith(".encrypted") ?? false) {
          setReceiveState({
            status: STATUS.PASSWORD_REQUIRED,
            filename: status.filename,
            downloadPath: status.downloadPath ?? null,
            needsPassword: true,
            decryptPassword: ""
          });
          const newContainer = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.SUCCESS,
            filename: status.filename ?? null,
            downloadPath: status.downloadPath ?? null
          });
          const newContainer = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer, () => {
              window.morphParticlesToCheck(newContainer);
            });
          }
        }
      }
      ws.close();
    } else if (status.status === "error") {
      setReceiveState({
        status: STATUS.ERROR,
        error: status.error ?? "Unknown error"
      });
      ws.close();
    } else if (status.progress > 0) {
      state.receive.fileSize = status.total;
      const progressFill = document.querySelector(".received-file-box .progress-fill");
      const progressText = document.querySelector(".received-file-name");
      const progressDetail = document.querySelector(".received-file-size");
      if (progressFill !== null && progressText !== null && progressDetail !== null && progressFill instanceof HTMLElement) {
        const percent = Math.round(status.progress);
        progressFill.style.width = String(percent) + "%";
        progressText.textContent = `Receiving ${String(percent)}%`;
        progressDetail.textContent = `${formatBytes(status.transferred)} / ${formatBytes(status.total)}`;
      } else {
        setReceiveState({
          progress: {
            percent: Math.round(status.progress),
            transferred: formatBytes(status.transferred),
            total: formatBytes(status.total)
          }
        });
      }
    }
  };
  ws.onerror = () => {
    setReceiveState({
      status: STATUS.ERROR,
      error: "Connection lost"
    });
  };
}
async function handleSendText() {
  let text = state.send.textMessage.trim();
  if (text === "") {
    return;
  }
  setSendState({ status: STATUS.SENDING });
  try {
    if (state.send.encrypt && state.send.password !== "") {
      text = await encryptText(text, state.send.password);
    }
    const res = await fetch("/api/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    const data = await res.json();
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    setSendState({
      status: STATUS.ERROR,
      error: errorMessage
    });
  }
}
async function handleSendFile() {
  let filesWithPaths = state.send.files;
  if (filesWithPaths.length === 0) {
    return;
  }
  setSendState({ status: STATUS.SENDING });
  try {
    const formData = new FormData;
    if (state.send.encrypt && state.send.password !== "") {
      const encryptedFiles = [];
      for (const { file, path } of filesWithPaths) {
        const encryptedFile = await encryptFile(file, state.send.password);
        encryptedFiles.push({ file: encryptedFile, path: path + ".encrypted" });
      }
      filesWithPaths = encryptedFiles;
    }
    const firstFile = filesWithPaths[0];
    if (filesWithPaths.length === 1 && firstFile !== undefined && !firstFile.path.includes("/")) {
      formData.append("file", firstFile.file);
    } else {
      const paths = [];
      for (const { file, path } of filesWithPaths) {
        formData.append("files", file);
        paths.push(path);
      }
      formData.append("paths", JSON.stringify(paths));
    }
    const res = await fetch("/api/send/file", {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    const data = await res.json();
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    setSendState({
      status: STATUS.ERROR,
      error: errorMessage
    });
  }
}
function handleSend() {
  if (state.send.sendMode === "text") {
    handleSendText();
  } else {
    handleSendFile();
  }
}
function clearSend() {
  closeActiveWebSocket();
  setSendState({
    status: STATUS.IDLE,
    files: [],
    textMessage: "",
    sendMode: "file",
    transferId: null,
    code: null,
    transferPhase: null,
    progress: null,
    error: null,
    encrypt: false,
    password: "",
    showPassword: false
  });
}
function addFiles(fileList, filePaths = null) {
  const files = Array.from(fileList);
  if (files.length === 0) {
    return;
  }
  const filesWithPaths = files.map((file, i) => ({
    file,
    path: filePaths?.[i] ?? file.name
  }));
  setSendState({
    status: STATUS.FILES_SELECTED,
    files: filesWithPaths,
    sendMode: "file",
    textMessage: ""
  });
}
async function handleDrop(e) {
  e.preventDefault();
  const items = e.dataTransfer?.items;
  if (items === undefined || items.length === 0) {
    if (e.dataTransfer !== null && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }
  const files = [];
  const paths = [];
  const entries = [];
  for (let i = 0;i < items.length; i++) {
    const item = items[i];
    if (item === undefined) {
      continue;
    }
    const entryResult = item.webkitGetAsEntry();
    if (entryResult !== null) {
      const entry = entryResult;
      entries.push(entry);
    }
  }
  if (entries.length === 0) {
    if (e.dataTransfer !== null && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }
  async function readEntry(entry, basePath = "") {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          const path = basePath !== "" ? `${basePath}/${entry.name}` : entry.name;
          files.push(file);
          paths.push(path);
          resolve();
        }, () => {
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const dirPath = basePath !== "" ? `${basePath}/${entry.name}` : entry.name;
      const reader = entry.createReader();
      const readAllEntries = () => {
        return new Promise((resolve) => {
          const allEntries = [];
          const readBatch = () => {
            reader.readEntries((batchEntries) => {
              if (batchEntries.length === 0) {
                resolve(allEntries);
              } else {
                allEntries.push(...batchEntries);
                readBatch();
              }
            }, () => {
              resolve(allEntries);
            });
          };
          readBatch();
        });
      };
      const childEntries = await readAllEntries();
      for (const childEntry of childEntries) {
        await readEntry(childEntry, dirPath);
      }
    }
  }
  for (const entry of entries) {
    await readEntry(entry);
  }
  if (files.length > 0) {
    addFiles(files, paths);
  }
}
function setTextMessage(text) {
  const trimmed = text.slice(0, TEXT_MAX_LENGTH);
  const wasIdle = state.send.status === STATUS.IDLE;
  state.send.textMessage = trimmed;
  state.send.sendMode = "text";
  state.send.files = [];
  if (trimmed.length > 0) {
    state.send.status = STATUS.TEXT_SELECTED;
    if (wasIdle) {
      renderSend();
      const textInput = $("textInput");
      if (textInput !== null && textInput instanceof HTMLTextAreaElement) {
        textInput.focus();
        textInput.selectionStart = textInput.value.length;
        textInput.selectionEnd = textInput.value.length;
      }
    } else {
      const charCounter = document.querySelector(".char-counter");
      if (charCounter !== null) {
        charCounter.textContent = `${trimmed.length.toLocaleString()} / ${TEXT_MAX_LENGTH.toLocaleString()}`;
      }
      const sendBtn = $("sendBtn");
      if (sendBtn !== null && sendBtn instanceof HTMLButtonElement) {
        sendBtn.disabled = trimmed.trim().length === 0;
      }
    }
  } else {
    state.send.status = STATUS.IDLE;
    state.send.sendMode = "file";
    if (!wasIdle) {
      renderSend();
    }
  }
}
function getEncryptRowHTML(s) {
  const passwordVisible = s.showPassword ? "text" : "password";
  const eyeIcon = s.showPassword ? ICONS["eyeClosed"] ?? "" : ICONS["eyeOpen"] ?? "";
  return `
    <div class="encrypt-row">
      <label class="encrypt-toggle">
        <input type="checkbox" class="encrypt-checkbox" id="encryptCheckbox" ${s.encrypt ? "checked" : ""}>
        <span class="encrypt-label">${ICONS["lock"] ?? ""} Encrypt with password</span>
      </label>
      <div class="password-wrapper ${s.encrypt ? "" : "hidden"}" id="passwordWrapper">
        <input type="${passwordVisible}" class="encrypt-password" id="encryptPassword" placeholder="Enter password" value="${escapeHtml(s.password)}">
        <button type="button" class="password-toggle" id="togglePasswordBtn">${eyeIcon}</button>
      </div>
    </div>`;
}
function getSendHTML(s) {
  const canSend = s.status === STATUS.FILES_SELECTED && s.files.length > 0 || s.status === STATUS.TEXT_SELECTED && s.textMessage.trim().length > 0;
  const needsPassword = s.encrypt && s.password.trim() === "";
  switch (s.status) {
    case STATUS.IDLE:
      return `
        <div class="unified-input" id="dropzone">
          <div class="unified-drop-area" id="dropArea">
            <div class="dropzone-icon">${ICONS["upload"] ?? ""}</div>
            <p class="dropzone-text">Drop files or folders here to send</p>
            <p class="dropzone-subtext">or <button class="link-btn" id="browseBtn">browse files</button> / <button class="link-btn" id="browseFolderBtn">folders</button></p>
            <input type="file" class="file-input-hidden" id="fileInput" multiple>
            <input type="file" class="file-input-hidden" id="folderInput" webkitdirectory>
          </div>
          <div class="unified-divider"><span>or</span></div>
          <textarea id="textInput" class="unified-text-input" placeholder="Type or paste a message..." rows="1"></textarea>
        </div>
        <button class="btn btn-primary" id="sendBtn" disabled>Send</button>`;
    case STATUS.TEXT_SELECTED: {
      const charCount = s.textMessage.length;
      return `
        <div class="unified-text-active">
          <div class="unified-text-header">
            <span class="unified-text-label">Message</span>
            <button class="clear-all-btn" id="clearTextBtn">Clear</button>
          </div>
          <textarea id="textInput" class="unified-text-input unified-text-expanded">${escapeHtml(s.textMessage)}</textarea>
          <div class="unified-text-footer">
            <span class="char-counter">${charCount.toLocaleString()} / ${TEXT_MAX_LENGTH.toLocaleString()}</span>
          </div>
        </div>
        ${getEncryptRowHTML(s)}
        <button class="btn btn-primary" id="sendBtn" ${canSend && !needsPassword ? "" : "disabled"}>Send</button>`;
    }
    case STATUS.FILES_SELECTED: {
      const fileCount = s.files.length;
      const totalSize = s.files.reduce((sum, f) => sum + f.file.size, 0);
      const fileLabel = fileCount === 1 ? "1 file" : `${String(fileCount)} files`;
      const fileListHtml = s.files.map(({ file, path }) => `
        <div class="file-item">
          <div class="file-item-info">
            <span class="file-item-name" title="${escapeHtml(path)}">${escapeHtml(path.includes("/") ? path : file.name)}</span>
            <span class="file-item-size">${formatBytes(file.size)}</span>
          </div>
        </div>
      `).join("");
      const willZip = fileCount > 1 || s.files.some((f) => f.path.includes("/"));
      return `
        <div class="file-list-container">
          <div class="file-list-header">
            <span>${fileLabel}${willZip ? " (will be zipped)" : ""} - ${formatBytes(totalSize)}</span>
            <button class="clear-all-btn" id="clearAllBtn">Clear</button>
          </div>
          <div class="file-list">
            ${fileListHtml}
          </div>
        </div>
        ${getEncryptRowHTML(s)}
        <button class="btn btn-primary" id="sendBtn" ${needsPassword ? "disabled" : ""}>Send</button>`;
    }
    case STATUS.SENDING:
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="status-text">Preparing transfer...</p>
          <p class="code-display skeleton" id="codeDisplay"></p>
          <button class="btn btn-ghost disabled" id="copyBtn" disabled>${ICONS["copy"] ?? ""}<span>Copy code</span></button>
          <button class="btn btn-primary invisible" id="resetSendBtn">Send more</button>
        </div>`;
    case STATUS.SUCCESS: {
      const encryptNote = s.encrypt ? `<div class="encrypt-note">${ICONS["lock"] ?? ""} Password protected - share the password separately</div>` : "";
      const statusText = s.transferPhase === "complete" ? "Transfer complete" : "Waiting for receiver";
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="status-text">${statusText}</p>
          <p class="code-display" id="codeDisplay">${s.code ?? ""}</p>
          <button class="btn btn-ghost" id="copyBtn">${ICONS["copy"] ?? ""}<span>Copy code</span></button>
          ${encryptNote}
          <button class="btn btn-primary" id="resetSendBtn">Send more</button>
        </div>`;
    }
    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS["error"] ?? ""}</div>
          <p class="error-message">${escapeHtml(s.error ?? "Unknown error")}</p>
        </div>
        <button class="btn btn-primary" id="resetSendBtn">Try again</button>`;
    case STATUS.CODE_ENTERED:
    case STATUS.RECEIVING:
    case STATUS.TEXT_RECEIVED:
    case STATUS.PASSWORD_REQUIRED:
      return "";
  }
}
function attachSendListeners(_s) {
  const dropzone = $("dropzone");
  const dropArea = $("dropArea");
  const fileInput = $("fileInput");
  const folderInput = $("folderInput");
  const browseBtn = $("browseBtn");
  const browseFolderBtn = $("browseFolderBtn");
  const textInput = $("textInput");
  if (dropArea !== null && dropzone !== null) {
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("unified-input-hover");
    });
    dropArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dropzone.classList.remove("unified-input-hover");
    });
    dropArea.addEventListener("drop", (e) => {
      dropzone.classList.remove("unified-input-hover");
      handleDrop(e);
    });
    dropArea.addEventListener("click", (e) => {
      const target = e.target;
      if (target === dropArea || target instanceof Element && (target.closest(".dropzone-icon") !== null || target.classList.contains("dropzone-text"))) {
        if (fileInput !== null && fileInput instanceof HTMLInputElement) {
          fileInput.click();
        }
      }
    });
  }
  if (browseBtn !== null && fileInput !== null) {
    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (fileInput instanceof HTMLInputElement) {
        fileInput.click();
      }
    });
  }
  if (browseFolderBtn !== null && folderInput !== null) {
    browseFolderBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (folderInput instanceof HTMLInputElement) {
        folderInput.click();
      }
    });
  }
  if (fileInput !== null && fileInput instanceof HTMLInputElement) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files !== null && fileInput.files.length > 0) {
        addFiles(fileInput.files);
      }
    });
  }
  if (folderInput !== null && folderInput instanceof HTMLInputElement) {
    folderInput.addEventListener("change", () => {
      if (folderInput.files !== null && folderInput.files.length > 0) {
        const files = Array.from(folderInput.files);
        const paths = files.map((f) => {
          const relativePath = f.webkitRelativePath;
          return relativePath !== "" ? relativePath : f.name;
        });
        addFiles(files, paths);
      }
    });
  }
  if (textInput !== null && textInput instanceof HTMLTextAreaElement) {
    textInput.addEventListener("input", () => {
      setTextMessage(textInput.value);
    });
    textInput.addEventListener("input", () => {
      textInput.classList.remove("has-overflow");
      textInput.style.height = "auto";
      const newHeight = Math.min(textInput.scrollHeight, 250);
      textInput.style.height = String(newHeight) + "px";
      if (textInput.scrollHeight > 250) {
        textInput.classList.add("has-overflow");
      }
    });
  }
  $("sendBtn")?.addEventListener("click", handleSend);
  $("resetSendBtn")?.addEventListener("click", clearSend);
  $("clearAllBtn")?.addEventListener("click", clearSend);
  $("clearTextBtn")?.addEventListener("click", clearSend);
  const encryptCheckbox = $("encryptCheckbox");
  const encryptPassword = $("encryptPassword");
  const togglePasswordBtn = $("togglePasswordBtn");
  const passwordWrapper = $("passwordWrapper");
  if (encryptCheckbox !== null && encryptCheckbox instanceof HTMLInputElement) {
    encryptCheckbox.addEventListener("change", () => {
      state.send.encrypt = encryptCheckbox.checked;
      if (passwordWrapper !== null) {
        passwordWrapper.classList.toggle("hidden", !encryptCheckbox.checked);
      }
      if (encryptCheckbox.checked && encryptPassword !== null && encryptPassword instanceof HTMLInputElement) {
        encryptPassword.focus();
      }
      const sendBtn = $("sendBtn");
      if (sendBtn !== null && sendBtn instanceof HTMLButtonElement) {
        const needsPassword = state.send.encrypt && state.send.password.trim() === "";
        sendBtn.disabled = needsPassword;
      }
    });
  }
  if (encryptPassword !== null && encryptPassword instanceof HTMLInputElement) {
    encryptPassword.addEventListener("input", () => {
      state.send.password = encryptPassword.value;
      const sendBtn = $("sendBtn");
      if (sendBtn !== null && sendBtn instanceof HTMLButtonElement) {
        const needsPassword = state.send.encrypt && state.send.password.trim() === "";
        sendBtn.disabled = needsPassword;
      }
    });
  }
  if (togglePasswordBtn !== null) {
    togglePasswordBtn.addEventListener("click", () => {
      state.send.showPassword = !state.send.showPassword;
      if (encryptPassword !== null && encryptPassword instanceof HTMLInputElement) {
        encryptPassword.type = state.send.showPassword ? "text" : "password";
      }
      togglePasswordBtn.innerHTML = state.send.showPassword ? ICONS["eyeClosed"] ?? "" : ICONS["eyeOpen"] ?? "";
    });
  }
  const copyBtn = $("copyBtn");
  const codeDisplay = $("codeDisplay");
  if (copyBtn !== null && codeDisplay !== null) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(codeDisplay.textContent ?? "");
      const span = copyBtn.querySelector("span");
      if (span !== null) {
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = "Copy code";
        }, 2000);
      }
    });
  }
}
function renderSend() {
  if (sendContainer === null) {
    return;
  }
  sendContainer.innerHTML = getSendHTML(state.send);
  attachSendListeners(state.send);
  const particleContainer = $("particleContainer");
  if (particleContainer !== null) {
    if (state.send.status === STATUS.SENDING) {
      window.initParticles(particleContainer, "up");
    } else if (state.send.status === STATUS.SUCCESS) {
      if (state.send.transferPhase === "complete") {
        window.initParticles(particleContainer, "drift");
        setTimeout(() => {
          window.morphParticlesToCheck(particleContainer);
        }, 100);
      } else {
        window.initParticles(particleContainer, "drift");
      }
    }
  }
}
async function handleReceive() {
  const code = state.receive.code.trim();
  if (code === "") {
    return;
  }
  setReceiveState({ status: STATUS.RECEIVING, progress: null });
  try {
    const res = await fetch("/api/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }
    const data = await res.json();
    state.receive.transferId = data.id;
    startReceiveWebSocket(data.id);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    setReceiveState({
      status: STATUS.ERROR,
      error: errorMessage
    });
  }
}
function clearReceive() {
  closeActiveWebSocket();
  setReceiveState({
    status: STATUS.IDLE,
    code: "",
    transferId: null,
    progress: null,
    filename: null,
    textContent: null,
    downloadPath: null,
    error: null,
    needsPassword: false,
    encryptedData: null,
    decryptPassword: "",
    showDecryptPassword: false
  });
}
function setReceiveCode(code) {
  state.receive.status = code !== "" ? STATUS.CODE_ENTERED : STATUS.IDLE;
  state.receive.code = code;
  const receiveBtn = $("receiveBtn");
  if (receiveBtn !== null && receiveBtn instanceof HTMLButtonElement) {
    receiveBtn.disabled = code === "";
  }
}
function getReceiveHTML(s) {
  switch (s.status) {
    case STATUS.IDLE:
    case STATUS.CODE_ENTERED:
      return `
        <div class="receive-box">
          <div class="receive-icon">${ICONS["download"] ?? ""}</div>
          <p class="receive-text">Receive a file or message</p>
          <div class="receive-input-wrapper">
            <input type="text" class="input" id="codeInput" placeholder="Enter code" value="${escapeHtml(s.code)}">
          </div>
          <button class="btn btn-primary" id="receiveBtn" ${s.status === STATUS.IDLE ? "disabled" : ""}>Receive</button>
        </div>`;
    case STATUS.RECEIVING:
      if (s.progress !== null && s.progress.percent > 0) {
        return `
          <div class="success-box">
            <div class="particle-container" id="particleContainer"></div>
            <div class="received-file-box skeleton">
              <div class="received-file-info">
                <span class="received-file-name">Receiving ${String(s.progress.percent)}%</span>
                <span class="received-file-size">${s.progress.transferred} / ${s.progress.total}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${String(s.progress.percent)}%"></div></div>
            </div>
            <button class="btn btn-ghost" id="cancelReceiveBtn">Cancel</button>
            <button class="btn btn-primary invisible" id="resetReceiveBtn">Receive more</button>
          </div>`;
      }
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <div class="received-file-box skeleton">
            <div class="received-file-info">
              <span class="received-file-name">Connecting...</span>
              <span class="received-file-size">&nbsp;</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
          </div>
          <button class="btn btn-ghost" id="cancelReceiveBtn">Cancel</button>
          <button class="btn btn-primary invisible" id="resetReceiveBtn">Receive more</button>
        </div>`;
    case STATUS.SUCCESS: {
      const fileSize = s.fileSize !== undefined ? formatBytes(s.fileSize) : "";
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <div class="received-file-box">
            <div class="received-file-info">
              <span class="received-file-name">${escapeHtml(s.filename ?? "File")}</span>
              ${fileSize !== "" ? `<span class="received-file-size">${fileSize}</span>` : ""}
            </div>
          </div>
          <button class="btn btn-ghost" id="downloadFileBtn">${ICONS["download16"] ?? ""}<span>Save file</span></button>
          <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>
        </div>`;
    }
    case STATUS.TEXT_RECEIVED:
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="success-label">Message received</p>
          <div class="text-message-display">
            <pre class="text-message-content" id="textMessageContent">${escapeHtml(s.textContent ?? "")}</pre>
          </div>
          <button class="btn btn-ghost" id="copyTextBtn">${ICONS["copy"] ?? ""}<span>Copy message</span></button>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>`;
    case STATUS.PASSWORD_REQUIRED: {
      const isFile = s.downloadPath !== null;
      const itemType = isFile ? "file" : "message";
      return `
        <div class="password-prompt">
          <div class="particle-container" id="particleContainer"></div>
          <p class="password-prompt-title">Encrypted ${itemType}</p>
          <p class="password-prompt-text">Enter the password to decrypt</p>
          <div class="password-prompt-input">
            <input type="password" class="input" id="decryptPasswordInput" placeholder="Enter password">
            <button type="button" class="password-toggle" id="toggleDecryptPasswordBtn">${ICONS["eyeOpen"] ?? ""}</button>
          </div>
          <div class="password-prompt-error hidden" id="decryptError">Incorrect password</div>
          <button class="btn btn-purple" id="decryptBtn">Decrypt</button>
        </div>
        <button class="btn btn-secondary" id="resetReceiveBtn">Cancel</button>`;
    }
    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS["error"] ?? ""}</div>
          <p class="error-message">${escapeHtml(s.error ?? "Unknown error")}</p>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Try again</button>`;
    case STATUS.FILES_SELECTED:
    case STATUS.TEXT_SELECTED:
    case STATUS.SENDING:
      return "";
  }
}
async function handleDecrypt() {
  const password = state.receive.decryptPassword;
  if (password === "") {
    return;
  }
  const decryptError = $("decryptError");
  const decryptBtn = $("decryptBtn");
  try {
    if (decryptBtn !== null && decryptBtn instanceof HTMLButtonElement) {
      decryptBtn.disabled = true;
      decryptBtn.textContent = "Decrypting...";
    }
    if (state.receive.encryptedData !== null) {
      const decryptedText = await decryptText(state.receive.encryptedData, password);
      setReceiveState({
        status: STATUS.TEXT_RECEIVED,
        textContent: decryptedText,
        needsPassword: false,
        encryptedData: null
      });
      const newContainer = $("particleContainer");
      if (newContainer !== null) {
        window.initParticles(newContainer, "drift");
        setTimeout(() => {
          window.morphParticlesToCheck(newContainer);
        }, 100);
      }
    } else if (state.receive.downloadPath !== null) {
      const response = await fetch(state.receive.downloadPath);
      const blob = await response.blob();
      const encryptedFile = new File([blob], state.receive.filename ?? "encrypted.encrypted");
      const decryptedFile = await decryptFile(encryptedFile, password);
      const url = URL.createObjectURL(decryptedFile);
      setReceiveState({
        status: STATUS.SUCCESS,
        filename: decryptedFile.name,
        downloadPath: url,
        needsPassword: false
      });
      const newContainer = $("particleContainer");
      if (newContainer !== null) {
        window.initParticles(newContainer, "drift");
        setTimeout(() => {
          window.morphParticlesToCheck(newContainer);
        }, 100);
      }
    }
  } catch {
    if (decryptError !== null) {
      decryptError.classList.remove("hidden");
    }
    if (decryptBtn !== null && decryptBtn instanceof HTMLButtonElement) {
      decryptBtn.disabled = false;
      decryptBtn.textContent = "Decrypt";
    }
  }
}
async function handleDownloadFile() {
  const { filename, downloadPath } = state.receive;
  if (downloadPath === null) {
    return;
  }
  try {
    const response = await fetch(downloadPath);
    const blob = await response.blob();
    const windowWithPicker = window;
    if (windowWithPicker.showSaveFilePicker !== undefined) {
      try {
        const handle = await windowWithPicker.showSaveFilePicker({
          suggestedName: filename ?? "download"
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Download failed:", e);
  }
}
function attachReceiveListeners(_s) {
  const codeInput = $("codeInput");
  const receiveBtn = $("receiveBtn");
  if (codeInput !== null && codeInput instanceof HTMLInputElement) {
    codeInput.addEventListener("input", () => {
      setReceiveCode(codeInput.value.trim());
    });
    codeInput.addEventListener("keydown", (e) => {
      if (e instanceof KeyboardEvent && e.key === "Enter" && codeInput.value.trim() !== "") {
        handleReceive();
      }
    });
  }
  receiveBtn?.addEventListener("click", () => {
    handleReceive();
  });
  $("resetReceiveBtn")?.addEventListener("click", clearReceive);
  $("cancelReceiveBtn")?.addEventListener("click", clearReceive);
  $("downloadFileBtn")?.addEventListener("click", () => {
    handleDownloadFile();
  });
  const decryptPasswordInput = $("decryptPasswordInput");
  const toggleDecryptPasswordBtn = $("toggleDecryptPasswordBtn");
  const decryptBtn = $("decryptBtn");
  const decryptError = $("decryptError");
  if (decryptPasswordInput !== null && decryptPasswordInput instanceof HTMLInputElement) {
    decryptPasswordInput.addEventListener("input", () => {
      state.receive.decryptPassword = decryptPasswordInput.value;
      if (decryptError !== null) {
        decryptError.classList.add("hidden");
      }
    });
    decryptPasswordInput.addEventListener("keydown", (e) => {
      if (e instanceof KeyboardEvent && e.key === "Enter" && decryptPasswordInput.value !== "") {
        handleDecrypt();
      }
    });
  }
  if (toggleDecryptPasswordBtn !== null && decryptPasswordInput !== null) {
    toggleDecryptPasswordBtn.addEventListener("click", () => {
      if (decryptPasswordInput instanceof HTMLInputElement) {
        const isPassword = decryptPasswordInput.type === "password";
        decryptPasswordInput.type = isPassword ? "text" : "password";
        toggleDecryptPasswordBtn.innerHTML = isPassword ? ICONS["eyeClosed"] ?? "" : ICONS["eyeOpen"] ?? "";
      }
    });
  }
  decryptBtn?.addEventListener("click", () => {
    handleDecrypt();
  });
  const copyTextBtn = $("copyTextBtn");
  const textContent = $("textMessageContent");
  if (copyTextBtn !== null && textContent !== null) {
    copyTextBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(textContent.textContent ?? "");
      const span = copyTextBtn.querySelector("span");
      if (span !== null) {
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = "Copy message";
        }, 2000);
      }
    });
  }
}
function renderReceive() {
  if (receiveContainer === null) {
    return;
  }
  receiveContainer.innerHTML = getReceiveHTML(state.receive);
  attachReceiveListeners(state.receive);
  const particleContainer = $("particleContainer");
  if (particleContainer !== null) {
    if (state.receive.status === STATUS.RECEIVING) {
      window.initParticles(particleContainer, "down");
    } else if (state.receive.status === STATUS.SUCCESS || state.receive.status === STATUS.TEXT_RECEIVED) {
      window.initParticles(particleContainer, "drift");
      setTimeout(() => {
        window.morphParticlesToCheck(particleContainer);
      }, 100);
    } else if (state.receive.status === STATUS.PASSWORD_REQUIRED) {
      window.initParticles(particleContainer, "drift");
    }
  }
}
function switchTab(tab) {
  state.tab = tab;
  const tabSend = $("tabSend");
  const tabReceive = $("tabReceive");
  const contentSend = $("contentSend");
  const contentReceive = $("contentReceive");
  tabSend?.classList.toggle("active", tab === "send");
  tabReceive?.classList.toggle("active", tab === "receive");
  contentSend?.classList.toggle("hidden", tab !== "send");
  contentReceive?.classList.toggle("hidden", tab !== "receive");
  if (tab === "send") {
    renderSend();
  } else {
    renderReceive();
  }
}
document.addEventListener("DOMContentLoaded", () => {
  sendContainer = $("contentSend");
  receiveContainer = $("contentReceive");
  $("tabSend")?.addEventListener("click", () => {
    switchTab("send");
  });
  $("tabReceive")?.addEventListener("click", () => {
    switchTab("receive");
  });
  $("themeToggle")?.addEventListener("click", toggleTheme);
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
  });
  renderSend();
  renderReceive();
});
