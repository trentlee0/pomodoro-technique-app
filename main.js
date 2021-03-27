const {app, globalShortcut, ipcMain, dialog, BrowserWindow, Menu, Tray, Notification} = require('electron');

const fs = require('fs');
const path = require('path');

const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const appDataPath = app.getPath("appData");
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath);
}
const adapter = new FileSync(path.join(appDataPath, 'tomato/settings.json'));
const db = lowdb(adapter);

db.defaults({
    profile: {
        work: 10,
        rest: 5,
        background: "#87CEAA",
        showWindowShortcut: 'CmdOrCtrl+Shift+T',
        boot: false,
        startWorkNotification: true,
        startWorkHideWindow: true
    }
}).write();

const icon = "img/icon.ico";
const trayIcon = "img/icon_tray.ico";
const trayWorkIcon = "img/icon_tray_work.ico";

let win;
let tray;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        //__dirname 总是指向被执行 js 文件的绝对路径
        icon: path.join(__dirname, icon),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

    win.loadFile('index.html');

    initSettings();
    createTray();
    handler();

    win.on('closed', (event) => {
        win = null;
    });

    win.on('close', (event) => {
        win.hide();
        event.preventDefault();
    });

    win.on('show', () => {
        win.setSkipTaskbar(false);
    });

    win.on('hide', () => {
        win.setSkipTaskbar(true);
    });

    win.once('ready-to-show', () => {
        if (process.argv.indexOf("--openAsHidden") > 0)
            win.hide();
        else
            win.show();
    });
}

/**
 * 初始化设置
 */
function initSettings() {
    Menu.setApplicationMenu(null);

    app.setLoginItemSettings({
        openAtLogin: db.read().get('profile.boot').value(),
        path: process.execPath,
        args: ["--openAsHidden"]
    });

    //全局快捷键
    globalShortcut.register(db.read().get('profile.showWindowShortcut').value(), () => {
        win.isVisible() ? win.hide() : win.show();
    });
}

function createTray() {
    tray = new Tray(path.join(__dirname, trayIcon));
    const trayMenu = Menu.buildFromTemplate([
        {
            label: '显示/隐藏窗口',
            accelerator: db.read().get('profile.showWindowShortcut').value(),
            click: () => win.isVisible() ? win.hide() : win.show()

        },
        {
            label: '开发者模式',
            click: () => {
                if (win.isDevToolsOpened()) {
                    win.webContents.closeDevTools();
                } else {
                    win.webContents.openDevTools();
                }
            }
        },
        {
            type: 'checkbox',
            label: '开机启动',
            checked: db.read().get('profile.boot').value(),
            click: function () {
                let boot = !db.read().get('profile.boot').value();
                app.setLoginItemSettings({
                    openAtLogin: boot,
                    path: process.execPath,
                    args: [
                        "--openAsHidden"
                    ]
                });
                db.set('profile.boot', boot).write();
            }
        },
        {
            label: '工作',
            click: () => {
                win.webContents.send('start-work-main');
                win.show();
            }
        },
        {
            label: '休息',
            click: () => {
                win.webContents.send('start-rest-main');
                win.show();
            }
        },
        {
            label: '退出',
            click: () => win.destroy()
        }
    ]);

    tray.setToolTip('番茄时钟');
    tray.setContextMenu(trayMenu);
    tray.on('click', () => {
        win.isVisible() ? win.hide() : win.show();
    });
}

function handler() {
    ipcMain.on('synchronous-message', (event, arg) => {
        if (arg === 'quit-timer') {
            let index = dialog.showMessageBoxSync(win, {
                type: 'question',
                buttons: ['确定', '取消'],
                title: '提示',
                message: '退出倒计时？',
                defaultId: 1,
                cancelId: 1
            });
            if (index === 0) {
                event.returnValue = 'yes';

                tray.setImage(path.join(__dirname, trayIcon));
                tray.setToolTip("番茄时钟");
            } else {
                event.returnValue = 'no';
            }
        }
    });

    ipcMain.on("work-to-rest", ((event, args) => {
        let msg = '已经工作一段时间了，休息一下吧！';
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: msg,
            timeoutType: "never"
        });

        tray.setImage(path.join(__dirname, trayIcon));
        tray.setToolTip("番茄时钟");

        notification.show();
        notification.on('click', () => {
            if (!win.isVisible()) win.show();
        });

        setTimeout(() => {
            win.show();
            win.setAlwaysOnTop(true);
            dialog.showMessageBox(win, {
                type: 'question',
                buttons: ['取消', '休息一下'],
                title: '提示',
                message: msg,
                defaultId: 1,
                cancelId: 0
            }).then((promise) => {
                if (promise.response === 1) {
                    win.webContents.send('start-rest-main');
                } else if (promise.response === 0) {
                    win.setAlwaysOnTop(false);
                }
                notification.close();
            });
        }, 1500);
    }));

    ipcMain.on('start-rest', (event, arg) => {
        let rest = parseInt(arg);
        win.setAlwaysOnTop(true);
        win.setMovable(false);
        win.setMinimizable(false);

        setTimeout(() => {
            win.setAlwaysOnTop(false);
            win.setMovable(true);
            win.setMinimizable(true);
        }, (rest - 1) * 1000);
    });

    ipcMain.on('start-work', (sys, msg) => {
        console.log()
        if (db.read().get('profile.startWorkHideWindow').value())
            win.hide();
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: msg,
            silent: true
        });

        tray.setImage(path.join(__dirname, trayWorkIcon));
        tray.setToolTip("💻Working...");

        if (db.read().get('profile.startWorkNotification').value()) {
            notification.show();

            setTimeout(() => {
                notification.close();
            }, 2000);
        }
    });

    ipcMain.on("end-rest", (sys, msg) => {
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: msg
        });

        notification.show();

        setTimeout(() => {
            notification.close();
        }, 3000);
    });
}

if (!app.requestSingleInstanceLock()) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // 当运行第二个实例时,将会聚焦到win这个窗口
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
            win.show();
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
