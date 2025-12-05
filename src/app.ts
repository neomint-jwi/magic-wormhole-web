/**
 * Wormhole Web - Frontend TypeScript
 */

// Import utility functions
import {
  escapeHtml,
  formatBytes,
  isEncryptedText,
  TEXT_MAX_LENGTH,
  THEME_KEY,
} from "./utils";

// Import crypto functions
import {
  encryptText,
  decryptText,
  encryptFile,
  decryptFile,
} from "./crypto";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

type Theme = "light" | "dark";

type StatusType =
  | "idle"
  | "files-selected"
  | "text-selected"
  | "sending"
  | "code-entered"
  | "receiving"
  | "success"
  | "error"
  | "text-received"
  | "password-required";

type SendMode = "file" | "text";
type TabType = "send" | "receive";

interface FileWithPath {
  readonly file: File;
  readonly path: string;
}

interface ProgressInfo {
  readonly percent: number;
  readonly transferred: string;
  readonly total: string;
}

interface SendState {
  status: StatusType;
  files: FileWithPath[];
  textMessage: string;
  sendMode: SendMode;
  transferId: string | null;
  code: string | null;
  transferPhase: "waiting" | "complete" | null;
  progress: ProgressInfo | null;
  error: string | null;
  encrypt: boolean;
  password: string;
  showPassword: boolean;
}

interface ReceiveState {
  status: StatusType;
  code: string;
  transferId: string | null;
  progress: ProgressInfo | null;
  filename: string | null;
  textContent: string | null;
  downloadPath: string | null;
  error: string | null;
  needsPassword: boolean;
  encryptedData: string | null;
  decryptPassword: string;
  showDecryptPassword: boolean;
  fileSize?: number;
}

interface AppState {
  tab: TabType;
  send: SendState;
  receive: ReceiveState;
}

interface TransferStatusResponse {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly code?: string;
  readonly filename?: string;
  readonly progress: number;
  readonly transferred: number;
  readonly total: number;
  readonly error?: string;
  readonly textContent?: string;
  readonly downloadPath?: string;
}

interface SendResponse {
  readonly id: string;
}

// Extended Window interface for File System Access API
interface SaveFilePickerOptions {
  readonly suggestedName?: string;
}

interface WindowWithFilePicker extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

// ============================================================
// CONSTANTS
// ============================================================

interface StatusConstants {
  readonly IDLE: "idle";
  readonly FILES_SELECTED: "files-selected";
  readonly TEXT_SELECTED: "text-selected";
  readonly SENDING: "sending";
  readonly CODE_ENTERED: "code-entered";
  readonly RECEIVING: "receiving";
  readonly SUCCESS: "success";
  readonly ERROR: "error";
  readonly TEXT_RECEIVED: "text-received";
  readonly PASSWORD_REQUIRED: "password-required";
}

const STATUS: StatusConstants = {
  IDLE: "idle",
  FILES_SELECTED: "files-selected",
  TEXT_SELECTED: "text-selected",
  SENDING: "sending",
  CODE_ENTERED: "code-entered",
  RECEIVING: "receiving",
  SUCCESS: "success",
  ERROR: "error",
  TEXT_RECEIVED: "text-received",
  PASSWORD_REQUIRED: "password-required",
};

const ICONS: Record<string, string> = {
  upload:
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  download:
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  check:
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error:
    '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  download16:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  lockLarge:
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  eyeOpen:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeClosed:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
};

// ============================================================
// STATE
// ============================================================

const state: AppState = {
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
    showPassword: false,
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
    showDecryptPassword: false,
  },
};

let sendContainer: HTMLElement | null = null;
let receiveContainer: HTMLElement | null = null;
let activeWebSocket: WebSocket | null = null;

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// ============================================================
// THEME MANAGEMENT
// ============================================================

function getPreferredTheme(): Theme {
  const stored: string | null = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme(): void {
  const current: string | null =
    document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}

// Apply theme immediately
setTheme(getPreferredTheme());

// ============================================================
// STATE MANAGEMENT
// ============================================================

function setSendState(updates: Partial<SendState>, skipRender: boolean = false): void {
  state.send = { ...state.send, ...updates };
  if (!skipRender) {
    renderSend();
  }
}

function setReceiveState(updates: Partial<ReceiveState>, skipRender: boolean = false): void {
  state.receive = { ...state.receive, ...updates };
  if (!skipRender) {
    renderReceive();
  }
}

// ============================================================
// WEBSOCKET MANAGEMENT
// ============================================================

function getWebSocketUrl(transferId: string): string {
  const protocol: string =
    window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws?id=${transferId}`;
}

function closeActiveWebSocket(): void {
  if (activeWebSocket !== null) {
    activeWebSocket.close();
    activeWebSocket = null;
  }
}

function startSendWebSocket(transferId: string): void {
  closeActiveWebSocket();

  const ws: WebSocket = new WebSocket(getWebSocketUrl(transferId));
  activeWebSocket = ws;

  ws.onmessage = (event: MessageEvent<string>): void => {
    const status: TransferStatusResponse = JSON.parse(
      event.data
    ) as TransferStatusResponse;

    if (
      status.status === "waiting" &&
      state.send.status !== STATUS.SUCCESS
    ) {
      const particleContainer: HTMLElement | null = $("particleContainer");
      if (particleContainer !== null) {
        window.transitionToDrift(particleContainer);
      }
      setSendState(
        {
          status: STATUS.SUCCESS,
          code: status.code ?? null,
          transferPhase: "waiting",
        },
        true
      );

      const statusTextEl: Element | null =
        document.querySelector(".status-text");
      if (statusTextEl !== null) {
        statusTextEl.textContent = "Waiting for receiver";
      }
      const codeDisplay: HTMLElement | null = $("codeDisplay");
      if (codeDisplay !== null) {
        codeDisplay.textContent = status.code ?? "";
        codeDisplay.classList.remove("skeleton");
      }
      const copyBtn: HTMLElement | null = $("copyBtn");
      if (copyBtn !== null) {
        copyBtn.classList.remove("disabled");
        if (copyBtn instanceof HTMLButtonElement) {
          copyBtn.disabled = false;
        }
        copyBtn.addEventListener("click", (): void => {
          void navigator.clipboard.writeText(status.code ?? "");
          const span: HTMLSpanElement | null = copyBtn.querySelector("span");
          if (span !== null) {
            span.textContent = "Copied!";
            setTimeout((): void => {
              span.textContent = "Copy code";
            }, 2000);
          }
        });
      }
      const resetBtn: HTMLElement | null = $("resetSendBtn");
      if (resetBtn !== null) {
        resetBtn.classList.remove("invisible");
        resetBtn.addEventListener("click", clearSend);
      }
      if (state.send.encrypt) {
        const successBox: Element | null =
          document.querySelector(".success-box");
        if (
          successBox !== null &&
          successBox.querySelector(".encrypt-note") === null
        ) {
          const note: HTMLDivElement = document.createElement("div");
          note.className = "encrypt-note";
          const lockIcon: string | undefined = ICONS["lock"];
          note.innerHTML = `${lockIcon ?? ""} Password protected - share the password separately`;
          successBox.appendChild(note);
        }
      }
    } else if (status.status === "complete") {
      state.send.transferPhase = "complete";
      const particleContainer: HTMLElement | null = $("particleContainer");
      if (particleContainer !== null) {
        window.morphParticlesToCheck(particleContainer);
      }
      const statusText: Element | null =
        document.querySelector(".status-text");
      if (statusText !== null) {
        statusText.textContent = "Transfer complete";
      }
      ws.close();
    } else if (status.status === "error") {
      setSendState({
        status: STATUS.ERROR,
        error: status.error ?? "Unknown error",
      });
      ws.close();
    }
  };

  ws.onerror = (): void => {
    setSendState({
      status: STATUS.ERROR,
      error: "Connection lost",
    });
  };
}

function startReceiveWebSocket(transferId: string): void {
  closeActiveWebSocket();

  const ws: WebSocket = new WebSocket(getWebSocketUrl(transferId));
  activeWebSocket = ws;

  ws.onmessage = (event: MessageEvent<string>): void => {
    const status: TransferStatusResponse = JSON.parse(
      event.data
    ) as TransferStatusResponse;

    if (status.status === "complete") {
      const particleContainer: HTMLElement | null = $("particleContainer");
      const shouldTransition: boolean =
        particleContainer !== null &&
        state.receive.status === STATUS.RECEIVING;

      if (status.textContent !== undefined) {
        if (isEncryptedText(status.textContent)) {
          setReceiveState({
            status: STATUS.PASSWORD_REQUIRED,
            encryptedData: status.textContent,
            needsPassword: true,
            decryptPassword: "",
          });
          const newContainer: HTMLElement | null = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.TEXT_RECEIVED,
            textContent: status.textContent,
          });
          const newContainer: HTMLElement | null = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer, (): void => {
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
            decryptPassword: "",
          });
          const newContainer: HTMLElement | null = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer);
          }
        } else {
          setReceiveState({
            status: STATUS.SUCCESS,
            filename: status.filename ?? null,
            downloadPath: status.downloadPath ?? null,
          });
          const newContainer: HTMLElement | null = $("particleContainer");
          if (newContainer !== null && shouldTransition) {
            window.initParticles(newContainer, "down");
            window.transitionToDrift(newContainer, (): void => {
              window.morphParticlesToCheck(newContainer);
            });
          }
        }
      }
      ws.close();
    } else if (status.status === "error") {
      setReceiveState({
        status: STATUS.ERROR,
        error: status.error ?? "Unknown error",
      });
      ws.close();
    } else if (status.progress > 0) {
      state.receive.fileSize = status.total;

      const progressFill: Element | null = document.querySelector(
        ".received-file-box .progress-fill"
      );
      const progressText: Element | null = document.querySelector(
        ".received-file-name"
      );
      const progressDetail: Element | null = document.querySelector(
        ".received-file-size"
      );

      if (
        progressFill !== null &&
        progressText !== null &&
        progressDetail !== null &&
        progressFill instanceof HTMLElement
      ) {
        const percent: number = Math.round(status.progress);
        progressFill.style.width = String(percent) + "%";
        progressText.textContent = `Receiving ${String(percent)}%`;
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

  ws.onerror = (): void => {
    setReceiveState({
      status: STATUS.ERROR,
      error: "Connection lost",
    });
  };
}

// ============================================================
// SEND FUNCTIONS
// ============================================================

async function handleSendText(): Promise<void> {
  let text: string = state.send.textMessage.trim();
  if (text === "") {
    return;
  }

  setSendState({ status: STATUS.SENDING });

  try {
    if (state.send.encrypt && state.send.password !== "") {
      text = await encryptText(text, state.send.password);
    }

    const res: Response = await fetch("/api/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const error: string = await res.text();
      throw new Error(error);
    }

    const data: SendResponse = (await res.json()) as SendResponse;
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e: unknown) {
    const errorMessage: string =
      e instanceof Error ? e.message : "Unknown error";
    setSendState({
      status: STATUS.ERROR,
      error: errorMessage,
    });
  }
}

async function handleSendFile(): Promise<void> {
  let filesWithPaths: FileWithPath[] = state.send.files;
  if (filesWithPaths.length === 0) {
    return;
  }

  setSendState({ status: STATUS.SENDING });

  try {
    const formData: FormData = new FormData();

    if (state.send.encrypt && state.send.password !== "") {
      const encryptedFiles: FileWithPath[] = [];
      for (const { file, path } of filesWithPaths) {
        const encryptedFile: File = await encryptFile(file, state.send.password);
        encryptedFiles.push({ file: encryptedFile, path: path + ".encrypted" });
      }
      filesWithPaths = encryptedFiles;
    }

    const firstFile: FileWithPath | undefined = filesWithPaths[0];
    if (
      filesWithPaths.length === 1 &&
      firstFile !== undefined &&
      !firstFile.path.includes("/")
    ) {
      formData.append("file", firstFile.file);
    } else {
      const paths: string[] = [];
      for (const { file, path } of filesWithPaths) {
        formData.append("files", file);
        paths.push(path);
      }
      formData.append("paths", JSON.stringify(paths));
    }

    const res: Response = await fetch("/api/send/file", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const error: string = await res.text();
      throw new Error(error);
    }

    const data: SendResponse = (await res.json()) as SendResponse;
    state.send.transferId = data.id;
    startSendWebSocket(data.id);
  } catch (e: unknown) {
    const errorMessage: string =
      e instanceof Error ? e.message : "Unknown error";
    setSendState({
      status: STATUS.ERROR,
      error: errorMessage,
    });
  }
}

function handleSend(): void {
  if (state.send.sendMode === "text") {
    void handleSendText();
  } else {
    void handleSendFile();
  }
}

function clearSend(): void {
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
    showPassword: false,
  });
}

function addFiles(fileList: FileList | File[], filePaths: string[] | null = null): void {
  const files: File[] = Array.from(fileList);
  if (files.length === 0) {
    return;
  }

  const filesWithPaths: FileWithPath[] = files.map(
    (file: File, i: number): FileWithPath => ({
      file,
      path: filePaths?.[i] ?? file.name,
    })
  );

  setSendState({
    status: STATUS.FILES_SELECTED,
    files: filesWithPaths,
    sendMode: "file",
    textMessage: "",
  });
}

// ============================================================
// DRAG AND DROP HANDLING
// ============================================================

async function handleDrop(e: DragEvent): Promise<void> {
  e.preventDefault();

  const items: DataTransferItemList | undefined = e.dataTransfer?.items;
  if (items === undefined || items.length === 0) {
    if (
      e.dataTransfer !== null &&
      e.dataTransfer.files.length > 0
    ) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }

  const files: File[] = [];
  const paths: string[] = [];

  interface WebKitEntry {
    readonly isFile: boolean;
    readonly isDirectory: boolean;
    readonly name: string;
    file(successCallback: (file: File) => void, errorCallback?: () => void): void;
    createReader(): WebKitDirectoryReader;
  }

  interface WebKitDirectoryReader {
    readEntries(
      successCallback: (entries: WebKitEntry[]) => void,
      errorCallback?: () => void
    ): void;
  }

  const entries: WebKitEntry[] = [];
  for (let i: number = 0; i < items.length; i++) {
    const item: DataTransferItem | undefined = items[i];
    if (item === undefined) {
      continue;
    }
    // webkitGetAsEntry exists on DataTransferItem but may return null
    const entryResult: FileSystemEntry | null = item.webkitGetAsEntry();
    if (entryResult !== null) {
      // Cast to our WebKitEntry interface for the file() method
      const entry: WebKitEntry = entryResult as unknown as WebKitEntry;
      entries.push(entry);
    }
  }

  if (entries.length === 0) {
    if (
      e.dataTransfer !== null &&
      e.dataTransfer.files.length > 0
    ) {
      addFiles(e.dataTransfer.files);
    }
    return;
  }

  async function readEntry(entry: WebKitEntry, basePath: string = ""): Promise<void> {
    if (entry.isFile) {
      return new Promise<void>((resolve: () => void): void => {
        entry.file(
          (file: File): void => {
            const path: string =
              basePath !== "" ? `${basePath}/${entry.name}` : entry.name;
            files.push(file);
            paths.push(path);
            resolve();
          },
          (): void => {
            resolve();
          }
        );
      });
    } else if (entry.isDirectory) {
      const dirPath: string =
        basePath !== "" ? `${basePath}/${entry.name}` : entry.name;
      const reader: WebKitDirectoryReader = entry.createReader();

      const readAllEntries: () => Promise<WebKitEntry[]> = (): Promise<WebKitEntry[]> => {
        return new Promise<WebKitEntry[]>(
          (resolve: (entries: WebKitEntry[]) => void): void => {
            const allEntries: WebKitEntry[] = [];
            const readBatch: () => void = (): void => {
              reader.readEntries(
                (batchEntries: WebKitEntry[]): void => {
                  if (batchEntries.length === 0) {
                    resolve(allEntries);
                  } else {
                    allEntries.push(...batchEntries);
                    readBatch();
                  }
                },
                (): void => {
                  resolve(allEntries);
                }
              );
            };
            readBatch();
          }
        );
      };

      const childEntries: WebKitEntry[] = await readAllEntries();
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

function setTextMessage(text: string): void {
  const trimmed: string = text.slice(0, TEXT_MAX_LENGTH);
  const wasIdle: boolean = state.send.status === STATUS.IDLE;

  state.send.textMessage = trimmed;
  state.send.sendMode = "text";
  state.send.files = [];

  if (trimmed.length > 0) {
    state.send.status = STATUS.TEXT_SELECTED;
    if (wasIdle) {
      renderSend();
      const textInput: HTMLElement | null = $("textInput");
      if (textInput !== null && textInput instanceof HTMLTextAreaElement) {
        textInput.focus();
        textInput.selectionStart = textInput.value.length;
        textInput.selectionEnd = textInput.value.length;
      }
    } else {
      const charCounter: Element | null =
        document.querySelector(".char-counter");
      if (charCounter !== null) {
        charCounter.textContent = `${trimmed.length.toLocaleString()} / ${TEXT_MAX_LENGTH.toLocaleString()}`;
      }
      const sendBtn: HTMLElement | null = $("sendBtn");
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

// ============================================================
// SEND HTML GENERATION
// ============================================================

function getEncryptRowHTML(s: SendState): string {
  const passwordVisible: string = s.showPassword ? "text" : "password";
  const eyeIcon: string = s.showPassword
    ? (ICONS["eyeClosed"] ?? "")
    : (ICONS["eyeOpen"] ?? "");

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

function getSendHTML(s: SendState): string {
  const canSend: boolean =
    (s.status === STATUS.FILES_SELECTED && s.files.length > 0) ||
    (s.status === STATUS.TEXT_SELECTED && s.textMessage.trim().length > 0);

  const needsPassword: boolean = s.encrypt && s.password.trim() === "";

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
      const charCount: number = s.textMessage.length;
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
      const fileCount: number = s.files.length;
      const totalSize: number = s.files.reduce(
        (sum: number, f: FileWithPath): number => sum + f.file.size,
        0
      );
      const fileLabel: string = fileCount === 1 ? "1 file" : `${String(fileCount)} files`;

      const fileListHtml: string = s.files
        .map(
          ({ file, path }: FileWithPath): string => `
        <div class="file-item">
          <div class="file-item-info">
            <span class="file-item-name" title="${escapeHtml(path)}">${escapeHtml(path.includes("/") ? path : file.name)}</span>
            <span class="file-item-size">${formatBytes(file.size)}</span>
          </div>
        </div>
      `
        )
        .join("");

      const willZip: boolean =
        fileCount > 1 || s.files.some((f: FileWithPath): boolean => f.path.includes("/"));

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
      const encryptNote: string = s.encrypt
        ? `<div class="encrypt-note">${ICONS["lock"] ?? ""} Password protected - share the password separately</div>`
        : "";
      const statusText: string =
        s.transferPhase === "complete"
          ? "Transfer complete"
          : "Waiting for receiver";

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

    // These status types are not used in send context
    case STATUS.CODE_ENTERED:
    case STATUS.RECEIVING:
    case STATUS.TEXT_RECEIVED:
    case STATUS.PASSWORD_REQUIRED:
      return "";
  }
}

// ============================================================
// SEND EVENT LISTENERS
// ============================================================

function attachSendListeners(_s: SendState): void {
  const dropzone: HTMLElement | null = $("dropzone");
  const dropArea: HTMLElement | null = $("dropArea");
  const fileInput: HTMLElement | null = $("fileInput");
  const folderInput: HTMLElement | null = $("folderInput");
  const browseBtn: HTMLElement | null = $("browseBtn");
  const browseFolderBtn: HTMLElement | null = $("browseFolderBtn");
  const textInput: HTMLElement | null = $("textInput");

  if (dropArea !== null && dropzone !== null) {
    dropArea.addEventListener("dragover", (e: Event): void => {
      e.preventDefault();
      dropzone.classList.add("unified-input-hover");
    });
    dropArea.addEventListener("dragleave", (e: Event): void => {
      e.preventDefault();
      dropzone.classList.remove("unified-input-hover");
    });
    dropArea.addEventListener("drop", (e: Event): void => {
      dropzone.classList.remove("unified-input-hover");
      void handleDrop(e as DragEvent);
    });
    dropArea.addEventListener("click", (e: Event): void => {
      const target: EventTarget | null = e.target;
      if (
        target === dropArea ||
        (target instanceof Element &&
          (target.closest(".dropzone-icon") !== null ||
            target.classList.contains("dropzone-text")))
      ) {
        if (fileInput !== null && fileInput instanceof HTMLInputElement) {
          fileInput.click();
        }
      }
    });
  }

  if (browseBtn !== null && fileInput !== null) {
    browseBtn.addEventListener("click", (e: Event): void => {
      e.stopPropagation();
      if (fileInput instanceof HTMLInputElement) {
        fileInput.click();
      }
    });
  }

  if (browseFolderBtn !== null && folderInput !== null) {
    browseFolderBtn.addEventListener("click", (e: Event): void => {
      e.stopPropagation();
      if (folderInput instanceof HTMLInputElement) {
        folderInput.click();
      }
    });
  }

  if (fileInput !== null && fileInput instanceof HTMLInputElement) {
    fileInput.addEventListener("change", (): void => {
      if (fileInput.files !== null && fileInput.files.length > 0) {
        addFiles(fileInput.files);
      }
    });
  }

  if (folderInput !== null && folderInput instanceof HTMLInputElement) {
    folderInput.addEventListener("change", (): void => {
      if (folderInput.files !== null && folderInput.files.length > 0) {
        const files: File[] = Array.from(folderInput.files);
        const paths: string[] = files.map((f: File): string => {
          // webkitRelativePath is available on File when using webkitdirectory
          const relativePath: string = f.webkitRelativePath;
          return relativePath !== "" ? relativePath : f.name;
        });
        addFiles(files, paths);
      }
    });
  }

  if (textInput !== null && textInput instanceof HTMLTextAreaElement) {
    textInput.addEventListener("input", (): void => {
      setTextMessage(textInput.value);
    });
    textInput.addEventListener("input", (): void => {
      textInput.classList.remove("has-overflow");
      textInput.style.height = "auto";
      const newHeight: number = Math.min(textInput.scrollHeight, 250);
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

  const encryptCheckbox: HTMLElement | null = $("encryptCheckbox");
  const encryptPassword: HTMLElement | null = $("encryptPassword");
  const togglePasswordBtn: HTMLElement | null = $("togglePasswordBtn");
  const passwordWrapper: HTMLElement | null = $("passwordWrapper");

  if (encryptCheckbox !== null && encryptCheckbox instanceof HTMLInputElement) {
    encryptCheckbox.addEventListener("change", (): void => {
      state.send.encrypt = encryptCheckbox.checked;
      if (passwordWrapper !== null) {
        passwordWrapper.classList.toggle("hidden", !encryptCheckbox.checked);
      }
      if (
        encryptCheckbox.checked &&
        encryptPassword !== null &&
        encryptPassword instanceof HTMLInputElement
      ) {
        encryptPassword.focus();
      }
      const sendBtn: HTMLElement | null = $("sendBtn");
      if (sendBtn !== null && sendBtn instanceof HTMLButtonElement) {
        const needsPassword: boolean =
          state.send.encrypt && state.send.password.trim() === "";
        sendBtn.disabled = needsPassword;
      }
    });
  }

  if (encryptPassword !== null && encryptPassword instanceof HTMLInputElement) {
    encryptPassword.addEventListener("input", (): void => {
      state.send.password = encryptPassword.value;
      const sendBtn: HTMLElement | null = $("sendBtn");
      if (sendBtn !== null && sendBtn instanceof HTMLButtonElement) {
        const needsPassword: boolean =
          state.send.encrypt && state.send.password.trim() === "";
        sendBtn.disabled = needsPassword;
      }
    });
  }

  if (togglePasswordBtn !== null) {
    togglePasswordBtn.addEventListener("click", (): void => {
      state.send.showPassword = !state.send.showPassword;
      if (encryptPassword !== null && encryptPassword instanceof HTMLInputElement) {
        encryptPassword.type = state.send.showPassword ? "text" : "password";
      }
      togglePasswordBtn.innerHTML = state.send.showPassword
        ? (ICONS["eyeClosed"] ?? "")
        : (ICONS["eyeOpen"] ?? "");
    });
  }

  const copyBtn: HTMLElement | null = $("copyBtn");
  const codeDisplay: HTMLElement | null = $("codeDisplay");
  if (copyBtn !== null && codeDisplay !== null) {
    copyBtn.addEventListener("click", (): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      void navigator.clipboard.writeText(codeDisplay.textContent ?? "");
      const span: HTMLSpanElement | null = copyBtn.querySelector("span");
      if (span !== null) {
        span.textContent = "Copied!";
        setTimeout((): void => {
          span.textContent = "Copy code";
        }, 2000);
      }
    });
  }
}

// ============================================================
// RENDER SEND
// ============================================================

function renderSend(): void {
  if (sendContainer === null) {
    return;
  }
  sendContainer.innerHTML = getSendHTML(state.send);
  attachSendListeners(state.send);

  const particleContainer: HTMLElement | null = $("particleContainer");
  if (particleContainer !== null) {
    if (state.send.status === STATUS.SENDING) {
      window.initParticles(particleContainer, "up");
    } else if (state.send.status === STATUS.SUCCESS) {
      if (state.send.transferPhase === "complete") {
        window.initParticles(particleContainer, "drift");
        setTimeout((): void => {
          window.morphParticlesToCheck(particleContainer);
        }, 100);
      } else {
        window.initParticles(particleContainer, "drift");
      }
    }
  }
}

// ============================================================
// RECEIVE FUNCTIONS
// ============================================================

async function handleReceive(): Promise<void> {
  const code: string = state.receive.code.trim();
  if (code === "") {
    return;
  }

  setReceiveState({ status: STATUS.RECEIVING, progress: null });

  try {
    const res: Response = await fetch("/api/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const error: string = await res.text();
      throw new Error(error);
    }

    const data: SendResponse = (await res.json()) as SendResponse;
    state.receive.transferId = data.id;
    startReceiveWebSocket(data.id);
  } catch (e: unknown) {
    const errorMessage: string =
      e instanceof Error ? e.message : "Unknown error";
    setReceiveState({
      status: STATUS.ERROR,
      error: errorMessage,
    });
  }
}

function clearReceive(): void {
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
    showDecryptPassword: false,
  });
}

function setReceiveCode(code: string): void {
  state.receive.status = code !== "" ? STATUS.CODE_ENTERED : STATUS.IDLE;
  state.receive.code = code;

  const receiveBtn: HTMLElement | null = $("receiveBtn");
  if (receiveBtn !== null && receiveBtn instanceof HTMLButtonElement) {
    receiveBtn.disabled = code === "";
  }
}

// ============================================================
// RECEIVE HTML GENERATION
// ============================================================

function getReceiveHTML(s: ReceiveState): string {
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
      const fileSize: string =
        s.fileSize !== undefined ? formatBytes(s.fileSize) : "";
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
      const isFile: boolean = s.downloadPath !== null;
      const itemType: string = isFile ? "file" : "message";
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

    // These status types are not used in receive context
    case STATUS.FILES_SELECTED:
    case STATUS.TEXT_SELECTED:
    case STATUS.SENDING:
      return "";
  }
}

// ============================================================
// DECRYPT HANDLING
// ============================================================

async function handleDecrypt(): Promise<void> {
  const password: string = state.receive.decryptPassword;
  if (password === "") {
    return;
  }

  const decryptError: HTMLElement | null = $("decryptError");
  const decryptBtn: HTMLElement | null = $("decryptBtn");

  try {
    if (decryptBtn !== null && decryptBtn instanceof HTMLButtonElement) {
      decryptBtn.disabled = true;
      decryptBtn.textContent = "Decrypting...";
    }

    if (state.receive.encryptedData !== null) {
      const decryptedText: string = await decryptText(
        state.receive.encryptedData,
        password
      );
      setReceiveState({
        status: STATUS.TEXT_RECEIVED,
        textContent: decryptedText,
        needsPassword: false,
        encryptedData: null,
      });
      const newContainer: HTMLElement | null = $("particleContainer");
      if (newContainer !== null) {
        window.initParticles(newContainer, "drift");
        setTimeout((): void => {
          window.morphParticlesToCheck(newContainer);
        }, 100);
      }
    } else if (state.receive.downloadPath !== null) {
      const response: Response = await fetch(state.receive.downloadPath);
      const blob: Blob = await response.blob();
      const encryptedFile: File = new File(
        [blob],
        state.receive.filename ?? "encrypted.encrypted"
      );
      const decryptedFile: File = await decryptFile(encryptedFile, password);

      const url: string = URL.createObjectURL(decryptedFile);
      setReceiveState({
        status: STATUS.SUCCESS,
        filename: decryptedFile.name,
        downloadPath: url,
        needsPassword: false,
      });
      const newContainer: HTMLElement | null = $("particleContainer");
      if (newContainer !== null) {
        window.initParticles(newContainer, "drift");
        setTimeout((): void => {
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

// ============================================================
// DOWNLOAD FILE HANDLING
// ============================================================

async function handleDownloadFile(): Promise<void> {
  const { filename, downloadPath }: { filename: string | null; downloadPath: string | null } = state.receive;
  if (downloadPath === null) {
    return;
  }

  try {
    const response: Response = await fetch(downloadPath);
    const blob: Blob = await response.blob();

    const windowWithPicker: WindowWithFilePicker = window as WindowWithFilePicker;
    if (windowWithPicker.showSaveFilePicker !== undefined) {
      try {
        const handle: FileSystemFileHandle = await windowWithPicker.showSaveFilePicker({
          suggestedName: filename ?? "download",
        });
        const writable: FileSystemWritableFileStream = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
      }
    }

    const url: string = URL.createObjectURL(blob);
    const a: HTMLAnchorElement = document.createElement("a");
    a.href = url;
    a.download = filename ?? "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e: unknown) {
    console.error("Download failed:", e);
  }
}

// ============================================================
// RECEIVE EVENT LISTENERS
// ============================================================

function attachReceiveListeners(_s: ReceiveState): void {
  const codeInput: HTMLElement | null = $("codeInput");
  const receiveBtn: HTMLElement | null = $("receiveBtn");

  if (codeInput !== null && codeInput instanceof HTMLInputElement) {
    codeInput.addEventListener("input", (): void => {
      setReceiveCode(codeInput.value.trim());
    });
    codeInput.addEventListener("keydown", (e: Event): void => {
      if (
        e instanceof KeyboardEvent &&
        e.key === "Enter" &&
        codeInput.value.trim() !== ""
      ) {
        void handleReceive();
      }
    });
  }

  receiveBtn?.addEventListener("click", (): void => {
    void handleReceive();
  });
  $("resetReceiveBtn")?.addEventListener("click", clearReceive);
  $("cancelReceiveBtn")?.addEventListener("click", clearReceive);
  $("downloadFileBtn")?.addEventListener("click", (): void => {
    void handleDownloadFile();
  });

  const decryptPasswordInput: HTMLElement | null = $("decryptPasswordInput");
  const toggleDecryptPasswordBtn: HTMLElement | null = $(
    "toggleDecryptPasswordBtn"
  );
  const decryptBtn: HTMLElement | null = $("decryptBtn");
  const decryptError: HTMLElement | null = $("decryptError");

  if (
    decryptPasswordInput !== null &&
    decryptPasswordInput instanceof HTMLInputElement
  ) {
    decryptPasswordInput.addEventListener("input", (): void => {
      state.receive.decryptPassword = decryptPasswordInput.value;
      if (decryptError !== null) {
        decryptError.classList.add("hidden");
      }
    });
    decryptPasswordInput.addEventListener("keydown", (e: Event): void => {
      if (
        e instanceof KeyboardEvent &&
        e.key === "Enter" &&
        decryptPasswordInput.value !== ""
      ) {
        void handleDecrypt();
      }
    });
  }

  if (toggleDecryptPasswordBtn !== null && decryptPasswordInput !== null) {
    toggleDecryptPasswordBtn.addEventListener("click", (): void => {
      if (decryptPasswordInput instanceof HTMLInputElement) {
        const isPassword: boolean = decryptPasswordInput.type === "password";
        decryptPasswordInput.type = isPassword ? "text" : "password";
        toggleDecryptPasswordBtn.innerHTML = isPassword
          ? (ICONS["eyeClosed"] ?? "")
          : (ICONS["eyeOpen"] ?? "");
      }
    });
  }

  decryptBtn?.addEventListener("click", (): void => {
    void handleDecrypt();
  });

  const copyTextBtn: HTMLElement | null = $("copyTextBtn");
  const textContent: HTMLElement | null = $("textMessageContent");
  if (copyTextBtn !== null && textContent !== null) {
    copyTextBtn.addEventListener("click", (): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      void navigator.clipboard.writeText(textContent.textContent ?? "");
      const span: HTMLSpanElement | null = copyTextBtn.querySelector("span");
      if (span !== null) {
        span.textContent = "Copied!";
        setTimeout((): void => {
          span.textContent = "Copy message";
        }, 2000);
      }
    });
  }
}

// ============================================================
// RENDER RECEIVE
// ============================================================

function renderReceive(): void {
  if (receiveContainer === null) {
    return;
  }
  receiveContainer.innerHTML = getReceiveHTML(state.receive);
  attachReceiveListeners(state.receive);

  const particleContainer: HTMLElement | null = $("particleContainer");
  if (particleContainer !== null) {
    if (state.receive.status === STATUS.RECEIVING) {
      window.initParticles(particleContainer, "down");
    } else if (
      state.receive.status === STATUS.SUCCESS ||
      state.receive.status === STATUS.TEXT_RECEIVED
    ) {
      window.initParticles(particleContainer, "drift");
      setTimeout((): void => {
        window.morphParticlesToCheck(particleContainer);
      }, 100);
    } else if (state.receive.status === STATUS.PASSWORD_REQUIRED) {
      window.initParticles(particleContainer, "drift");
    }
  }
}

// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tab: TabType): void {
  state.tab = tab;

  const tabSend: HTMLElement | null = $("tabSend");
  const tabReceive: HTMLElement | null = $("tabReceive");
  const contentSend: HTMLElement | null = $("contentSend");
  const contentReceive: HTMLElement | null = $("contentReceive");

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

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", (): void => {
  sendContainer = $("contentSend");
  receiveContainer = $("contentReceive");

  $("tabSend")?.addEventListener("click", (): void => {
    switchTab("send");
  });
  $("tabReceive")?.addEventListener("click", (): void => {
    switchTab("receive");
  });
  $("themeToggle")?.addEventListener("click", toggleTheme);

  document.addEventListener("dragover", (e: Event): void => {
    e.preventDefault();
  });
  document.addEventListener("drop", (e: Event): void => {
    e.preventDefault();
  });

  renderSend();
  renderReceive();
});
