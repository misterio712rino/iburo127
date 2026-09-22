"use strict";

const { app, BrowserWindow, dialog, Menu, shell, session } = require("electron");
const path = require("node:path");

const APP_URL = "https://iburo127.online/app";
const APP_ORIGIN = new URL(APP_URL).origin;
let mainWindow;

function externalHttpsOnly(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.origin !== APP_ORIGIN) {
      void shell.openExternal(url.href);
    }
  } catch {
    // Never pass malformed or non-HTTPS URLs to the OS.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "iБюро",
    width: 1280,
    height: 850,
    minWidth: 840,
    minHeight: 580,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#102340",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    externalHttpsOnly(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, value) => {
    try {
      if (new URL(value).origin === APP_ORIGIN) return;
    } catch {
      // Treat invalid URLs as external.
    }
    event.preventDefault();
    externalHttpsOnly(value);
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 || !validatedURL.startsWith(APP_ORIGIN)) return;
    void dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "iБюро — нет соединения",
      message: "Не удалось открыть личный кабинет. Проверьте подключение к интернету.",
      detail: String(description || "Ошибка сети"),
      buttons: ["Повторить", "Закрыть"],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0 && mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(APP_URL);
      if (response === 1 && mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
    });
  });
  void mainWindow.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId("ru.iburo.desktop");
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "iБюро", submenu: [
        { label: "Обновить", role: "reload" },
        { label: "Назад", accelerator: "Alt+Left", click: () => mainWindow?.webContents.goBack() },
        { type: "separator" },
        { label: "Закрыть", role: "quit" },
      ] },
    ]));
    createWindow();
  });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
