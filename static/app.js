/**
 * Wormhole Web - Frontend JavaScript
 */

// Theme Management
const THEME_KEY = 'wormhole-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Apply theme immediately
setTheme(getPreferredTheme());

// Constants
const TEXT_MAX_LENGTH = 10000;

const STATUS = {
  IDLE: 'idle',
  FILES_SELECTED: 'files-selected',
  TEXT_SELECTED: 'text-selected',
  SENDING: 'sending',
  CODE_ENTERED: 'code-entered',
  RECEIVING: 'receiving',
  SUCCESS: 'success',
  ERROR: 'error',
  TEXT_RECEIVED: 'text-received',
  PASSWORD_REQUIRED: 'password-required',
};

const ICONS = {
  upload: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  check: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  download16: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  lockLarge: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eyeOpen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeClosed: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
};

// Encryption marker prefix for encrypted content
const ENCRYPTION_MARKER = 'WORMHOLE_ENCRYPTED_V1:';

// State
let state = {
  tab: 'send',
  send: {
    status: STATUS.IDLE,
    files: [],
    textMessage: '',
    sendMode: 'file',
    transferId: null,
    code: null,
    transferPhase: null,
    progress: null,
    error: null,
    encrypt: false,
    password: '',
    showPassword: false,
  },
  receive: {
    status: STATUS.IDLE,
    code: '',
    transferId: null,
    progress: null,
    filename: null,
    textContent: null,
    downloadPath: null,
    error: null,
    needsPassword: false,
    encryptedData: null,
    decryptPassword: '',
    showDecryptPassword: false,
  },
};

// DOM References
let sendContainer, receiveContainer;

// Utility Functions
function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================
// ENCRYPTION UTILITIES (AES-256-GCM)
// ============================================================

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine salt + iv + encrypted data
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

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return new Uint8Array(decrypted);
}

async function encryptText(text, password) {
  const enc = new TextEncoder();
  const encrypted = await encryptData(enc.encode(text), password);
  return ENCRYPTION_MARKER + btoa(String.fromCharCode(...encrypted));
}

async function decryptText(encryptedText, password) {
  if (!encryptedText.startsWith(ENCRYPTION_MARKER)) {
    throw new Error('Not encrypted');
  }
  const base64 = encryptedText.slice(ENCRYPTION_MARKER.length);
  const encrypted = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const decrypted = await decryptData(encrypted, password);
  return new TextDecoder().decode(decrypted);
}

async function encryptFile(file, password) {
  const arrayBuffer = await file.arrayBuffer();
  const encrypted = await encryptData(new Uint8Array(arrayBuffer), password);

  // Create new file with .encrypted extension and metadata header
  const metadata = JSON.stringify({ name: file.name, type: file.type });
  const metaBytes = new TextEncoder().encode(metadata);
  const metaLen = new Uint32Array([metaBytes.length]);

  const result = new Uint8Array(4 + metaBytes.length + encrypted.length);
  result.set(new Uint8Array(metaLen.buffer), 0);
  result.set(metaBytes, 4);
  result.set(encrypted, 4 + metaBytes.length);

  return new File([result], file.name + '.encrypted', { type: 'application/octet-stream' });
}

async function decryptFile(encryptedFile, password) {
  const arrayBuffer = await encryptedFile.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Read metadata length
  const metaLen = new Uint32Array(data.slice(0, 4).buffer)[0];
  const metaBytes = data.slice(4, 4 + metaLen);
  const metadata = JSON.parse(new TextDecoder().decode(metaBytes));

  // Decrypt file content
  const encrypted = data.slice(4 + metaLen);
  const decrypted = await decryptData(encrypted, password);

  return new File([decrypted], metadata.name, { type: metadata.type });
}

function isEncryptedText(text) {
  return text && text.startsWith(ENCRYPTION_MARKER);
}

// State Management - with render control
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

// Update only the transfer status section without full re-render
function updateTransferStatus(phase) {
  const statusContainer = document.querySelector('.transfer-status');
  if (!statusContainer) return;

  if (phase === 'waiting') {
    statusContainer.className = 'transfer-status transfer-waiting';
    statusContainer.innerHTML = '<span class="pulse-dots"></span> Waiting for receiver';
  } else if (phase === 'complete') {
    statusContainer.className = 'transfer-status transfer-complete';
    statusContainer.innerHTML = `<span>${ICONS.check}</span> Transfer complete`;
  }
}

// WebSocket connection management
let activeWebSocket = null;

function getWebSocketUrl(transferId) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/ws?id=${transferId}`;
}

function closeActiveWebSocket() {
  if (activeWebSocket) {
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

    if (status.status === 'waiting' && state.send.status !== STATUS.SUCCESS) {
      // Transition from sending (up stream) to waiting (drift sphere)
      const particleContainer = $('particleContainer');
      if (particleContainer) {
        transitionToDrift(particleContainer);
      }
      setSendState({
        status: STATUS.SUCCESS,
        code: status.code,
        transferPhase: 'waiting',
      }, true); // skipRender - we just need to update the UI text, not recreate particles

      // Update the UI elements
      const statusTextEl = document.querySelector('.status-text');
      if (statusTextEl) {
        statusTextEl.textContent = 'Waiting for receiver';
      }
      const codeDisplay = $('codeDisplay');
      if (codeDisplay) {
        codeDisplay.textContent = status.code;
        codeDisplay.classList.remove('skeleton');
      }
      const copyBtn = $('copyBtn');
      if (copyBtn) {
        copyBtn.classList.remove('disabled');
        copyBtn.disabled = false;
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(status.code);
          const span = copyBtn.querySelector('span');
          if (span) {
            span.textContent = 'Copied!';
            setTimeout(() => { span.textContent = 'Copy code'; }, 2000);
          }
        });
      }
      // Show the "Send more" button
      const resetBtn = $('resetSendBtn');
      if (resetBtn) {
        resetBtn.classList.remove('invisible');
        resetBtn.addEventListener('click', clearSend);
      }
      // Show encrypt note if applicable
      if (state.send.encrypt) {
        const successBox = document.querySelector('.success-box');
        if (successBox && !successBox.querySelector('.encrypt-note')) {
          const note = document.createElement('div');
          note.className = 'encrypt-note';
          note.innerHTML = `${ICONS.lock} Password protected - share the password separately`;
          successBox.appendChild(note);
        }
      }
    } else if (status.status === 'complete') {
      state.send.transferPhase = 'complete';
      // Morph particles to checkmark and update status text
      const particleContainer = $('particleContainer');
      if (particleContainer) {
        morphParticlesToCheck(particleContainer);
      }
      const statusText = document.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = 'Transfer complete';
      }
      ws.close();
    } else if (status.status === 'error') {
      setSendState({
        status: STATUS.ERROR,
        error: status.error,
      });
      ws.close();
    }
  };

  ws.onerror = () => {
    setSendState({
      status: STATUS.ERROR,
      error: 'Connection lost',
    });
  };
}

function startReceiveWebSocket(transferId) {
  closeActiveWebSocket();

  const ws = new WebSocket(getWebSocketUrl(transferId));
  activeWebSocket = ws;

  ws.onmessage = (event) => {
    const status = JSON.parse(event.data);

    if (status.status === 'complete') {
      // Store particle container reference before state change
      const particleContainer = $('particleContainer');
      const shouldTransition = particleContainer && state.receive.status === STATUS.RECEIVING;

      if (status.textContent) {
        // Check if text is encrypted
        if (isEncryptedText(status.textContent)) {
          setReceiveState({
            status: STATUS.PASSWORD_REQUIRED,
            encryptedData: status.textContent,
            needsPassword: true,
            decryptPassword: '',
          });
          // Transition to drift after render (new particle container)
          const newContainer = $('particleContainer');
          if (newContainer && shouldTransition) {
            initParticles(newContainer, 'down');
            transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.TEXT_RECEIVED,
            textContent: status.textContent,
          });
          // Transition to checkmark after render
          const newContainer = $('particleContainer');
          if (newContainer && shouldTransition) {
            initParticles(newContainer, 'down');
            transitionToDrift(newContainer, () => {
              morphParticlesToCheck(newContainer);
            });
          }
        }
      } else {
        // Check if file is encrypted (ends with .encrypted)
        if (status.filename && status.filename.endsWith('.encrypted')) {
          setReceiveState({
            status: STATUS.PASSWORD_REQUIRED,
            filename: status.filename,
            downloadPath: status.downloadPath,
            needsPassword: true,
            decryptPassword: '',
          });
          // Transition to drift after render
          const newContainer = $('particleContainer');
          if (newContainer && shouldTransition) {
            initParticles(newContainer, 'down');
            transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.SUCCESS,
            filename: status.filename,
            downloadPath: status.downloadPath,
          });
          // Transition to checkmark after render
          const newContainer = $('particleContainer');
          if (newContainer && shouldTransition) {
            initParticles(newContainer, 'down');
            transitionToDrift(newContainer, () => {
              morphParticlesToCheck(newContainer);
            });
          }
        }
      }
      ws.close();
    } else if (status.status === 'error') {
      setReceiveState({
        status: STATUS.ERROR,
        error: status.error,
      });
      ws.close();
    } else if (status.progress > 0) {
      // Store file size for later display
      state.receive.fileSize = status.total;

      // Update progress without full re-render
      const progressFill = document.querySelector('.received-file-box .progress-fill');
      const progressText = document.querySelector('.received-file-name');
      const progressDetail = document.querySelector('.received-file-size');

      if (progressFill && progressText && progressDetail) {
        const percent = Math.round(status.progress);
        progressFill.style.width = percent + '%';
        progressText.textContent = `Receiving ${percent}%`;
        progressDetail.textContent = `${formatBytes(status.transferred)} / ${formatBytes(status.total)}`;
      } else {
        setReceiveState({
          progress: {
            percent: Math.round(status.progress),
            transferred: formatBytes(status.transferred),
            total: formatBytes(status.total),
          },
        });
      }
    }
  };

  ws.onerror = () => {
    setReceiveState({
      status: STATUS.ERROR,
      error: 'Connection lost',
    });
  };
}

// Send Tab Functions
async function handleSendText() {
  let text = state.send.textMessage.trim();
  if (!text) return;

  setSendState({ status: STATUS.SENDING });

  try {
    // Encrypt if enabled
    if (state.send.encrypt && state.send.password) {
      text = await encryptText(text, state.send.password);
    }

    const res = await fetch('/api/send/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const data = await res.json();
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e) {
    setSendState({
      status: STATUS.ERROR,
      error: e.message,
    });
  }
}

async function handleSendFile() {
  let filesWithPaths = state.send.files;
  if (!filesWithPaths || filesWithPaths.length === 0) return;

  setSendState({ status: STATUS.SENDING });

  try {
    const formData = new FormData();

    // Encrypt files if enabled
    if (state.send.encrypt && state.send.password) {
      const encryptedFiles = [];
      for (const { file, path } of filesWithPaths) {
        const encryptedFile = await encryptFile(file, state.send.password);
        encryptedFiles.push({ file: encryptedFile, path: path + '.encrypted' });
      }
      filesWithPaths = encryptedFiles;
    }

    if (filesWithPaths.length === 1 && !filesWithPaths[0].path.includes('/')) {
      // Single file without folder structure - use simple upload
      formData.append('file', filesWithPaths[0].file);
    } else {
      // Multiple files or folder structure - use files[] array with paths
      const paths = [];
      for (const { file, path } of filesWithPaths) {
        formData.append('files', file);
        paths.push(path);
      }
      formData.append('paths', JSON.stringify(paths));
    }

    const res = await fetch('/api/send/file', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const data = await res.json();
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e) {
    setSendState({
      status: STATUS.ERROR,
      error: e.message,
    });
  }
}

function handleSend() {
  if (state.send.sendMode === 'text') {
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
    textMessage: '',
    sendMode: 'file',
    transferId: null,
    code: null,
    transferPhase: null,
    progress: null,
    error: null,
    encrypt: false,
    password: '',
    showPassword: false,
  });
}

function addFiles(fileList, filePaths = null) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  // Store files with their paths for folder structure preservation
  const filesWithPaths = files.map((file, i) => ({
    file,
    path: filePaths ? filePaths[i] : file.name,
  }));

  setSendState({
    status: STATUS.FILES_SELECTED,
    files: filesWithPaths,
    sendMode: 'file',
    textMessage: '',
  });
}

// Handle folder drops using DataTransferItem.webkitGetAsEntry()
async function handleDrop(e) {
  e.preventDefault();

  const items = e.dataTransfer.items;
  if (!items || items.length === 0) {
    // Fallback to files
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }

  const files = [];
  const paths = [];

  // Process all items
  const entries = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    }
  }

  if (entries.length === 0) {
    // Fallback if webkitGetAsEntry not supported
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }

  // Recursively read all entries
  async function readEntry(entry, basePath = '') {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => {
          const path = basePath ? `${basePath}/${entry.name}` : entry.name;
          files.push(file);
          paths.push(path);
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const reader = entry.createReader();

      // Read all entries in directory (may need multiple reads)
      const readAllEntries = () => {
        return new Promise((resolve) => {
          const allEntries = [];
          const readBatch = () => {
            reader.readEntries((entries) => {
              if (entries.length === 0) {
                resolve(allEntries);
              } else {
                allEntries.push(...entries);
                readBatch();
              }
            }, () => resolve(allEntries));
          };
          readBatch();
        });
      };

      const entries = await readAllEntries();
      for (const childEntry of entries) {
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
  const willBeIdle = trimmed.length === 0;

  // Update state without re-render for typing within same status
  state.send.textMessage = trimmed;
  state.send.sendMode = 'text';
  state.send.files = [];

  if (trimmed.length > 0) {
    state.send.status = STATUS.TEXT_SELECTED;
    // Only re-render if transitioning from IDLE (to show text mode UI)
    if (wasIdle) {
      renderSend();
      // Re-focus the textarea after render
      const textInput = $('textInput');
      if (textInput) {
        textInput.focus();
        textInput.selectionStart = textInput.selectionEnd = textInput.value.length;
      }
    } else {
      // Just update the char counter without full re-render
      const charCounter = document.querySelector('.char-counter');
      if (charCounter) {
        charCounter.textContent = `${trimmed.length.toLocaleString()} / ${TEXT_MAX_LENGTH.toLocaleString()}`;
      }
      // Update send button state
      const sendBtn = $('sendBtn');
      if (sendBtn) {
        sendBtn.disabled = trimmed.trim().length === 0;
      }
    }
  } else {
    state.send.status = STATUS.IDLE;
    state.send.sendMode = 'file';
    // Only re-render if transitioning to IDLE
    if (!wasIdle) {
      renderSend();
    }
  }
}

function getEncryptRowHTML(s) {
  const passwordVisible = s.showPassword ? 'text' : 'password';
  const eyeIcon = s.showPassword ? ICONS.eyeClosed : ICONS.eyeOpen;

  return `
    <div class="encrypt-row">
      <label class="encrypt-toggle">
        <input type="checkbox" class="encrypt-checkbox" id="encryptCheckbox" ${s.encrypt ? 'checked' : ''}>
        <span class="encrypt-label">${ICONS.lock} Encrypt with password</span>
      </label>
      <div class="password-wrapper ${s.encrypt ? '' : 'hidden'}" id="passwordWrapper">
        <input type="${passwordVisible}" class="encrypt-password" id="encryptPassword" placeholder="Enter password" value="${escapeHtml(s.password || '')}">
        <button type="button" class="password-toggle" id="togglePasswordBtn">${eyeIcon}</button>
      </div>
    </div>`;
}

function getSendHTML(s) {
  const canSend =
    (s.status === STATUS.FILES_SELECTED && s.files.length > 0) ||
    (s.status === STATUS.TEXT_SELECTED && s.textMessage.trim().length > 0);

  // Check if encryption is enabled but password is empty
  const needsPassword = s.encrypt && !s.password.trim();

  switch (s.status) {
    case STATUS.IDLE:
      return `
        <div class="unified-input" id="dropzone">
          <div class="unified-drop-area" id="dropArea">
            <div class="dropzone-icon">${ICONS.upload}</div>
            <p class="dropzone-text">Drop files or folders here to send</p>
            <p class="dropzone-subtext">or <button class="link-btn" id="browseBtn">browse files</button> / <button class="link-btn" id="browseFolderBtn">folders</button></p>
            <input type="file" class="file-input-hidden" id="fileInput" multiple>
            <input type="file" class="file-input-hidden" id="folderInput" webkitdirectory>
          </div>
          <div class="unified-divider"><span>or</span></div>
          <textarea id="textInput" class="unified-text-input" placeholder="Type or paste a message..." rows="1"></textarea>
        </div>
        <button class="btn btn-primary" id="sendBtn" disabled>Send</button>`;

    case STATUS.TEXT_SELECTED:
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
        <button class="btn btn-primary" id="sendBtn" ${canSend && !needsPassword ? '' : 'disabled'}>Send</button>`;

    case STATUS.FILES_SELECTED:
      const fileCount = s.files.length;
      const totalSize = s.files.reduce((sum, f) => sum + f.file.size, 0);
      const fileLabel = fileCount === 1 ? '1 file' : `${fileCount} files`;

      // Show all files in a scrollable list
      const fileListHtml = s.files.map(({ file, path }) => `
        <div class="file-item">
          <div class="file-item-info">
            <span class="file-item-name" title="${escapeHtml(path)}">${escapeHtml(path.includes('/') ? path : file.name)}</span>
            <span class="file-item-size">${formatBytes(file.size)}</span>
          </div>
        </div>
      `).join('');

      const willZip = fileCount > 1 || s.files.some(f => f.path.includes('/'));

      return `
        <div class="file-list-container">
          <div class="file-list-header">
            <span>${fileLabel}${willZip ? ' (will be zipped)' : ''} - ${formatBytes(totalSize)}</span>
            <button class="clear-all-btn" id="clearAllBtn">Clear</button>
          </div>
          <div class="file-list">
            ${fileListHtml}
          </div>
        </div>
        ${getEncryptRowHTML(s)}
        <button class="btn btn-primary" id="sendBtn" ${needsPassword ? 'disabled' : ''}>Send</button>`;

    case STATUS.SENDING:
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="status-text">Preparing transfer...</p>
          <p class="code-display skeleton" id="codeDisplay"></p>
          <button class="btn btn-ghost disabled" id="copyBtn" disabled>${ICONS.copy}<span>Copy code</span></button>
          <button class="btn btn-primary invisible" id="resetSendBtn">Send more</button>
        </div>`;

    case STATUS.SUCCESS:
      const encryptNote = s.encrypt ? `<div class="encrypt-note">${ICONS.lock} Password protected - share the password separately</div>` : '';
      const statusText = s.transferPhase === 'complete' ? 'Transfer complete' : 'Waiting for receiver';

      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="status-text">${statusText}</p>
          <p class="code-display" id="codeDisplay">${s.code}</p>
          <button class="btn btn-ghost" id="copyBtn">${ICONS.copy}<span>Copy code</span></button>
          ${encryptNote}
          <button class="btn btn-primary" id="resetSendBtn">Send more</button>
        </div>`;

    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS.error}</div>
          <p class="error-message">${escapeHtml(s.error || 'Unknown error')}</p>
        </div>
        <button class="btn btn-primary" id="resetSendBtn">Try again</button>`;

    default:
      return '';
  }
}

function attachSendListeners(s) {
  const dropzone = $('dropzone');
  const dropArea = $('dropArea');
  const fileInput = $('fileInput');
  const folderInput = $('folderInput');
  const browseBtn = $('browseBtn');
  const browseFolderBtn = $('browseFolderBtn');
  const textInput = $('textInput');

  if (dropArea) {
    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('unified-input-hover');
    });
    dropArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('unified-input-hover');
    });
    dropArea.addEventListener('drop', (e) => {
      dropzone.classList.remove('unified-input-hover');
      handleDrop(e);
    });
    dropArea.addEventListener('click', (e) => {
      // Only open file picker if clicking the drop area itself, not any buttons
      if (e.target === dropArea || e.target.closest('.dropzone-icon') || e.target.classList.contains('dropzone-text')) {
        fileInput?.click();
      }
    });
  }

  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (browseFolderBtn && folderInput) {
    browseFolderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      folderInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        addFiles(fileInput.files);
      }
    });
  }

  if (folderInput) {
    folderInput.addEventListener('change', () => {
      if (folderInput.files.length > 0) {
        // webkitdirectory gives us files with webkitRelativePath
        const files = Array.from(folderInput.files);
        const paths = files.map(f => f.webkitRelativePath || f.name);
        addFiles(files, paths);
      }
    });
  }

  if (textInput) {
    textInput.addEventListener('input', () => {
      setTextMessage(textInput.value);
    });
    textInput.addEventListener('input', () => {
      textInput.classList.remove('has-overflow');
      textInput.style.height = 'auto';
      const newHeight = Math.min(textInput.scrollHeight, 250);
      textInput.style.height = newHeight + 'px';
      if (textInput.scrollHeight > 250) {
        textInput.classList.add('has-overflow');
      }
    });
  }

  $('sendBtn')?.addEventListener('click', handleSend);
  $('resetSendBtn')?.addEventListener('click', clearSend);
  $('clearAllBtn')?.addEventListener('click', clearSend);
  $('clearTextBtn')?.addEventListener('click', clearSend);

  // Encryption controls
  const encryptCheckbox = $('encryptCheckbox');
  const encryptPassword = $('encryptPassword');
  const togglePasswordBtn = $('togglePasswordBtn');
  const passwordWrapper = $('passwordWrapper');

  if (encryptCheckbox) {
    encryptCheckbox.addEventListener('change', () => {
      state.send.encrypt = encryptCheckbox.checked;
      if (passwordWrapper) {
        passwordWrapper.classList.toggle('hidden', !encryptCheckbox.checked);
      }
      // Auto-focus password input when enabling encryption
      if (encryptCheckbox.checked && encryptPassword) {
        encryptPassword.focus();
      }
      // Update send button state
      const sendBtn = $('sendBtn');
      if (sendBtn) {
        const needsPassword = state.send.encrypt && !state.send.password.trim();
        sendBtn.disabled = needsPassword;
      }
    });
  }

  if (encryptPassword) {
    encryptPassword.addEventListener('input', () => {
      state.send.password = encryptPassword.value;
      // Update send button state
      const sendBtn = $('sendBtn');
      if (sendBtn) {
        const needsPassword = state.send.encrypt && !state.send.password.trim();
        sendBtn.disabled = needsPassword;
      }
    });
  }

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      state.send.showPassword = !state.send.showPassword;
      if (encryptPassword) {
        encryptPassword.type = state.send.showPassword ? 'text' : 'password';
      }
      togglePasswordBtn.innerHTML = state.send.showPassword ? ICONS.eyeClosed : ICONS.eyeOpen;
    });
  }

  const copyBtn = $('copyBtn');
  const codeDisplay = $('codeDisplay');
  if (copyBtn && codeDisplay) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeDisplay.textContent || '');
      const span = copyBtn.querySelector('span');
      if (span) {
        span.textContent = 'Copied!';
        setTimeout(() => {
          span.textContent = 'Copy code';
        }, 2000);
      }
    });
  }
}

function renderSend() {
  if (!sendContainer) return;
  sendContainer.innerHTML = getSendHTML(state.send);
  attachSendListeners(state.send);

  // Initialize particle animation based on state
  const particleContainer = $('particleContainer');
  if (particleContainer) {
    if (state.send.status === STATUS.SENDING) {
      // Particles flow up while preparing/sending
      initParticles(particleContainer, 'up');
    } else if (state.send.status === STATUS.SUCCESS) {
      // When re-rendering SUCCESS state (e.g., tab switch), show appropriate animation
      if (state.send.transferPhase === 'complete') {
        initParticles(particleContainer, 'drift');
        setTimeout(() => morphParticlesToCheck(particleContainer), 100);
      } else {
        // Waiting for receiver - show drift
        initParticles(particleContainer, 'drift');
      }
    }
  }
}

// Receive Tab Functions
async function handleReceive() {
  const code = state.receive.code.trim();
  if (!code) return;

  setReceiveState({ status: STATUS.RECEIVING, progress: null });

  try {
    const res = await fetch('/api/receive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const data = await res.json();
    state.receive.transferId = data.id;
    startReceiveWebSocket(data.id);
  } catch (e) {
    setReceiveState({
      status: STATUS.ERROR,
      error: e.message,
    });
  }
}

function clearReceive() {
  closeActiveWebSocket();
  setReceiveState({
    status: STATUS.IDLE,
    code: '',
    transferId: null,
    progress: null,
    filename: null,
    textContent: null,
    downloadPath: null,
    error: null,
    needsPassword: false,
    encryptedData: null,
    decryptPassword: '',
    showDecryptPassword: false,
  });
}

function setReceiveCode(code) {
  // Only update state, don't re-render for typing
  state.receive.status = code ? STATUS.CODE_ENTERED : STATUS.IDLE;
  state.receive.code = code || '';

  // Just update button state
  const receiveBtn = $('receiveBtn');
  if (receiveBtn) {
    receiveBtn.disabled = !code;
  }
}

function getReceiveHTML(s) {
  const inputHtml = `<input type="text" class="input" id="codeInput" placeholder="Enter wormhole code" value="${escapeHtml(s.code || '')}">`;

  switch (s.status) {
    case STATUS.IDLE:
    case STATUS.CODE_ENTERED:
      return `
        <div class="receive-box">
          <div class="receive-icon">${ICONS.download}</div>
          <p class="receive-text">Receive a file or message</p>
          <div class="receive-input-wrapper">
            <input type="text" class="input" id="codeInput" placeholder="Enter code" value="${escapeHtml(s.code || '')}">
          </div>
          <button class="btn btn-primary" id="receiveBtn" ${s.status === STATUS.IDLE ? 'disabled' : ''}>Receive</button>
        </div>`;

    case STATUS.RECEIVING:
      if (s.progress && s.progress.percent > 0) {
        return `
          <div class="success-box">
            <div class="particle-container" id="particleContainer"></div>
            <div class="received-file-box skeleton">
              <div class="received-file-info">
                <span class="received-file-name">Receiving ${s.progress.percent}%</span>
                <span class="received-file-size">${s.progress.transferred} / ${s.progress.total}</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width: ${s.progress.percent}%"></div></div>
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

    case STATUS.SUCCESS:
      const fileSize = s.fileSize ? formatBytes(s.fileSize) : '';
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <div class="received-file-box">
            <div class="received-file-info">
              <span class="received-file-name">${escapeHtml(s.filename || 'File')}</span>
              ${fileSize ? `<span class="received-file-size">${fileSize}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-ghost" id="downloadFileBtn">${ICONS.download16}<span>Save file</span></button>
          <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>
        </div>`;

    case STATUS.TEXT_RECEIVED:
      return `
        <div class="success-box">
          <div class="particle-container" id="particleContainer"></div>
          <p class="success-label">Message received</p>
          <div class="text-message-display">
            <pre class="text-message-content" id="textMessageContent">${escapeHtml(s.textContent || '')}</pre>
          </div>
          <button class="btn btn-ghost" id="copyTextBtn">${ICONS.copy}<span>Copy message</span></button>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Receive more</button>`;

    case STATUS.PASSWORD_REQUIRED:
      const isFile = !!s.downloadPath;
      const itemType = isFile ? 'file' : 'message';
      return `
        <div class="password-prompt">
          <div class="particle-container" id="particleContainer"></div>
          <p class="password-prompt-title">Encrypted ${itemType}</p>
          <p class="password-prompt-text">Enter the password to decrypt</p>
          <div class="password-prompt-input">
            <input type="password" class="input" id="decryptPasswordInput" placeholder="Enter password">
            <button type="button" class="password-toggle" id="toggleDecryptPasswordBtn">${ICONS.eyeOpen}</button>
          </div>
          <div class="password-prompt-error hidden" id="decryptError">Incorrect password</div>
          <button class="btn btn-purple" id="decryptBtn">Decrypt</button>
        </div>
        <button class="btn btn-secondary" id="resetReceiveBtn">Cancel</button>`;

    case STATUS.ERROR:
      return `
        <div class="error-box">
          <div class="error-icon">${ICONS.error}</div>
          <p class="error-message">${escapeHtml(s.error || 'Unknown error')}</p>
        </div>
        <button class="btn btn-primary" id="resetReceiveBtn">Try again</button>`;

    default:
      return '';
  }
}

async function handleDecrypt() {
  const password = state.receive.decryptPassword;
  if (!password) return;

  const decryptError = $('decryptError');
  const decryptBtn = $('decryptBtn');

  try {
    if (decryptBtn) {
      decryptBtn.disabled = true;
      decryptBtn.textContent = 'Decrypting...';
    }

    if (state.receive.encryptedData) {
      // Decrypt text
      const decryptedText = await decryptText(state.receive.encryptedData, password);
      setReceiveState({
        status: STATUS.TEXT_RECEIVED,
        textContent: decryptedText,
        needsPassword: false,
        encryptedData: null,
      });
      // Initialize particles and morph to checkmark after render
      const newContainer = $('particleContainer');
      if (newContainer) {
        initParticles(newContainer, 'drift');
        setTimeout(() => morphParticlesToCheck(newContainer), 100);
      }
    } else if (state.receive.downloadPath) {
      // Decrypt file - fetch, decrypt, and create download
      const response = await fetch(state.receive.downloadPath);
      const blob = await response.blob();
      const encryptedFile = new File([blob], state.receive.filename || 'encrypted.encrypted');
      const decryptedFile = await decryptFile(encryptedFile, password);

      // Create download link for decrypted file
      const url = URL.createObjectURL(decryptedFile);
      setReceiveState({
        status: STATUS.SUCCESS,
        filename: decryptedFile.name,
        downloadPath: url,
        needsPassword: false,
      });
      // Initialize particles and morph to checkmark after render
      const newContainer = $('particleContainer');
      if (newContainer) {
        initParticles(newContainer, 'drift');
        setTimeout(() => morphParticlesToCheck(newContainer), 100);
      }
    }
  } catch (e) {
    // Show error but stay on password prompt
    if (decryptError) {
      decryptError.classList.remove('hidden');
    }
    if (decryptBtn) {
      decryptBtn.disabled = false;
      decryptBtn.textContent = 'Decrypt';
    }
  }
}

async function handleDownloadFile() {
  const { filename, downloadPath } = state.receive;
  if (!downloadPath) return;

  try {
    // Fetch the file data
    const response = await fetch(downloadPath);
    const blob = await response.blob();

    // Try to use File System Access API for native save dialog
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename || 'download',
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        // User cancelled or API failed, fall back to regular download
        if (e.name === 'AbortError') return;
      }
    }

    // Fallback: regular download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Download failed:', e);
  }
}

function attachReceiveListeners(s) {
  const codeInput = $('codeInput');
  const receiveBtn = $('receiveBtn');

  if (codeInput) {
    codeInput.addEventListener('input', () => {
      setReceiveCode(codeInput.value.trim());
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && codeInput.value.trim()) {
        handleReceive();
      }
    });
  }

  receiveBtn?.addEventListener('click', handleReceive);
  $('resetReceiveBtn')?.addEventListener('click', clearReceive);
  $('cancelReceiveBtn')?.addEventListener('click', clearReceive);
  $('downloadFileBtn')?.addEventListener('click', handleDownloadFile);

  // Decryption controls
  const decryptPasswordInput = $('decryptPasswordInput');
  const toggleDecryptPasswordBtn = $('toggleDecryptPasswordBtn');
  const decryptBtn = $('decryptBtn');
  const decryptError = $('decryptError');

  if (decryptPasswordInput) {
    decryptPasswordInput.addEventListener('input', () => {
      state.receive.decryptPassword = decryptPasswordInput.value;
      // Hide error when typing
      if (decryptError) {
        decryptError.classList.add('hidden');
      }
    });
    decryptPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && decryptPasswordInput.value) {
        handleDecrypt();
      }
    });
  }

  if (toggleDecryptPasswordBtn && decryptPasswordInput) {
    toggleDecryptPasswordBtn.addEventListener('click', () => {
      const isPassword = decryptPasswordInput.type === 'password';
      decryptPasswordInput.type = isPassword ? 'text' : 'password';
      toggleDecryptPasswordBtn.innerHTML = isPassword ? ICONS.eyeClosed : ICONS.eyeOpen;
    });
  }

  decryptBtn?.addEventListener('click', handleDecrypt);

  const copyTextBtn = $('copyTextBtn');
  const textContent = $('textMessageContent');
  if (copyTextBtn && textContent) {
    copyTextBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(textContent.textContent || '');
      const span = copyTextBtn.querySelector('span');
      if (span) {
        span.textContent = 'Copied!';
        setTimeout(() => {
          span.textContent = 'Copy message';
        }, 2000);
      }
    });
  }
}

function renderReceive() {
  if (!receiveContainer) return;
  receiveContainer.innerHTML = getReceiveHTML(state.receive);
  attachReceiveListeners(state.receive);

  // Initialize particle animation based on state
  const particleContainer = $('particleContainer');
  if (particleContainer) {
    if (state.receive.status === STATUS.RECEIVING) {
      // Particles flow down while receiving
      initParticles(particleContainer, 'down');
    } else if (state.receive.status === STATUS.SUCCESS || state.receive.status === STATUS.TEXT_RECEIVED) {
      // When re-rendering SUCCESS/TEXT_RECEIVED state (e.g., tab switch), show checkmark
      initParticles(particleContainer, 'drift');
      setTimeout(() => morphParticlesToCheck(particleContainer), 100);
    } else if (state.receive.status === STATUS.PASSWORD_REQUIRED) {
      // Waiting for password - show drift
      initParticles(particleContainer, 'drift');
    }
  }
}

// Tab Switching
function switchTab(tab) {
  state.tab = tab;

  const tabSend = $('tabSend');
  const tabReceive = $('tabReceive');
  const contentSend = $('contentSend');
  const contentReceive = $('contentReceive');

  tabSend?.classList.toggle('active', tab === 'send');
  tabReceive?.classList.toggle('active', tab === 'receive');
  contentSend?.classList.toggle('hidden', tab !== 'send');
  contentReceive?.classList.toggle('hidden', tab !== 'receive');

  if (tab === 'send') {
    renderSend();
  } else {
    renderReceive();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  sendContainer = $('contentSend');
  receiveContainer = $('contentReceive');

  $('tabSend')?.addEventListener('click', () => switchTab('send'));
  $('tabReceive')?.addEventListener('click', () => switchTab('receive'));
  $('themeToggle')?.addEventListener('click', toggleTheme);

  // Prevent default drag behavior
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  // Initial render
  renderSend();
  renderReceive();
});
