/**
 * main.mjs — Electron main process for Project Tracker.
 *
 * Architecture
 * ────────────
 * • The bundled Express API server (api/index.mjs) is imported in-process so
 *   no child process or CMD window appears.
 * • The API starts on a fixed internal port (8765) and also serves the built
 *   React SPA as static files.
 * • A system-tray icon lets the user show/quit the app.
 * • electron-updater checks GitHub Releases on startup and prompts for updates.
 *
 * Environment variables set before the API import:
 *   PORT            → 8765
 *   NODE_ENV        → production
 *   SQLITE_PATH     → <AppData>/Project Tracker/local.db
 *   STATIC_DIR      → <resources>/public  (served by Express)
 *   ELECTRON_PACKAGED → 1  (skips drizzle-kit CLI; uses CREATE TABLE IF NOT EXISTS)
 */

import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  dialog,
} from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = 8765;

let mainWindow = null;
let tray = null;
let isQuitting = false;

// ─── Wait for Express to respond ──────────────────────────────────────────
async function waitForApi(maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://localhost:${API_PORT}/api/healthz`);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  throw new Error(`API server did not respond within ${maxMs / 1000}s`);
}

// ─── Seed tickets on first launch ─────────────────────────────────────────
async function seedIfEmpty() {
  try {
    const r = await fetch(`http://localhost:${API_PORT}/api/tickets`);
    if (!r.ok) return;
    const tickets = await r.json();
    if (Array.isArray(tickets) && tickets.length > 0) return;

    const seedPath = app.isPackaged
      ? path.join(process.resourcesPath, "seeds", "tickets.json")
      : path.join(__dirname, "../../seeds/tickets.json");

    if (!existsSync(seedPath)) return;

    const seedData = JSON.parse(readFileSync(seedPath, "utf8"));

    const headers = [
      "title", "description", "state", "submitter", "category",
      "status", "priority", "submitted_at", "completed_at",
    ];
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [headers.join(",")];
    for (const t of seedData) {
      rows.push([
        t.title, t.description ?? "", t.state,
        t.submitter ?? "", t.category ?? "",
        t.status ?? "todo", t.priority ?? "medium",
        t.submitted_at ?? "", t.completed_at ?? "",
      ].map(esc).join(","));
    }

    await fetch(`http://localhost:${API_PORT}/api/tickets/import-csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: rows.join("\n") }),
    });
  } catch {
    // Non-fatal — user can add tickets manually
  }
}

// ─── Browser window ────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: { contextIsolation: true },
    title: "Project Tracker",
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${API_PORT}`);
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Hide to tray instead of closing
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ─── System tray ───────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "build", "icon.ico");
  const icon = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip("Project Tracker");

  const menu = Menu.buildFromTemplate([
    {
      label: "Open Project Tracker",
      click() {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click() {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ─── Auto-updater (GitHub Releases) ────────────────────────────────────────
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-downloaded", async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Ready",
      message: "A new version of Project Tracker has been downloaded.",
      detail: "Restart the app now to apply the update.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
    });
    if (response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", () => {
    // Silently ignore update errors — non-fatal
  });
}

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const userData = app.getPath("userData");

  // Paths differ between packaged app and dev run
  const publicDir = app.isPackaged
    ? path.join(process.resourcesPath, "public")
    : path.join(__dirname, "../../project-tracker/dist/public");

  // Set env vars BEFORE importing the API (it reads them at module load)
  process.env.PORT = String(API_PORT);
  process.env.NODE_ENV = "production";
  process.env.SQLITE_PATH = path.join(userData, "local.db");
  process.env.STATIC_DIR = publicDir;
  process.env.ELECTRON_PACKAGED = "1";

  // Start the embedded Express API (side-effect import)
  const apiEntry = app.isPackaged
    ? pathToFileURL(path.join(__dirname, "api", "index.mjs")).href
    : pathToFileURL(path.join(__dirname, "../../api-server/dist/index.mjs")).href;

  try {
    await import(apiEntry);
  } catch (err) {
    dialog.showErrorBox(
      "Startup Error",
      `Failed to load the application server:\n\n${err.message}`
    );
    app.quit();
    return;
  }

  // Wait for Express to be ready
  try {
    await waitForApi();
  } catch (err) {
    dialog.showErrorBox(
      "Startup Error",
      `The application server failed to start:\n\n${err.message}`
    );
    app.quit();
    return;
  }

  // Seed tickets on first launch
  await seedIfEmpty();

  createWindow();
  createTray();
  setupAutoUpdater();
});

// Keep running in tray when all windows are closed
app.on("window-all-closed", () => {
  // intentionally do nothing — user quits via tray
});

app.on("activate", () => {
  mainWindow?.show();
  mainWindow?.focus();
});

app.on("before-quit", () => {
  isQuitting = true;
});
