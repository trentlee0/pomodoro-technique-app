const {app, globalShortcut, ipcMain, dialog, shell, BrowserWindow, Menu, Tray, Notification} = require('electron');
const ioHook = require('iohook');
const path = require('path');
const dataStore = require('./js/datastore');
const db = dataStore.getDb(app)['db'];
const confFile = dataStore.getDb(app)['confFile'];

const icon = "img/icon.ico";
const trayIcon = "img/icon_tray.ico";
const trayWorkIcon = "img/icon_tray_work.ico";

let win;
let tray;
let isResting = false;
let isWorking = false;
let leaveTimer = null;

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

    if (db.read().get('profile.mode').value() === 'auto') {
        autoMode();
    }

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
        if (process.argv.indexOf("--openAsHidden") > 0) {
            win.webContents.send('start-work-main');
            win.hide();
        } else {
            if (db.read().get('profile.mode').value() === 'auto') {
                win.webContents.send('start-work-main');
            } else {
                win.show();
            }
        }
    });
}

function autoMode() {
    ioHook.start();
    ioHook.on('mousemove', () => pauseClocking());
    ioHook.on('keydown', () => pauseClocking());
}

function pauseClocking() {
    if (!isWorking) {
        win.webContents.send('pause-work');
    }
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
        win.webContents.send('pause-work');
        tray.setImage(path.join(__dirname, trayIcon));
        tray.setToolTip("番茄时钟");
        isWorking = false;
    }, 1000 * 10);
}

/**
 * 初始化设置
 */
function initSettings() {
    Menu.setApplicationMenu(null);

    app.setLoginItemSettings({
        openAtLogin: app.isPackaged ? db.read().get('profile.boot').value() : false,
        path: process.execPath,
        args: ["--openAsHidden"]
    });

    //全局快捷键
    globalShortcut.register(db.read().get('profile.showWindowShortcut').value(), () => {
        showOrHideMainWindow();
    });
}

function showOrHideMainWindow() {
    if (!isResting) {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    }
}

function createTray() {
    tray = new Tray(path.join(__dirname, trayIcon));
    const trayMenu = Menu.buildFromTemplate([
        {
            label: '显示/隐藏窗口',
            accelerator: db.read().get('profile.showWindowShortcut').value(),
            click: () => {
                if (!isResting) {
                    win.isVisible() ? win.hide() : win.show()
                }
            }
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
            label: '配置文件',
            click: () => {
                shell.showItemInFolder(confFile);
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
            accelerator: "Ctrl+W",
            click: () => quitHandler()
        }
    ]);

    tray.setToolTip('番茄时钟');
    tray.setContextMenu(trayMenu);
    tray.on('click', () => showOrHideMainWindow());
}

function quitHandler() {
    if (isWorking || isResting) {
        console.log("rest: " + isResting);
        console.log("work: " + isWorking);
        dialog.showMessageBox(win, {
            type: 'question',
            buttons: ['退出', '取消'],
            title: '提示',
            message: '当前正在倒计时，确定退出吗？',
            defaultId: 1,
            cancelId: 0
        }).then((promise) => {
            if (promise.response === 0) {
                win.destroy();
            }
        });
    } else {
        win.destroy();
    }
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
                isResting = false;
                isWorking = false;
                handleResting(isResting);

                tray.setImage(path.join(__dirname, trayIcon));
                tray.setToolTip("番茄时钟");
            } else {
                event.returnValue = 'no';
            }
        }
    });


    /************ 异步 ************/

    ipcMain.on("end-work", ((event, args) => {
        let msg = '已经工作一段时间了，休息一下吧！';
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: msg,
            timeoutType: "never"
        });

        tray.setImage(path.join(__dirname, trayIcon));
        tray.setToolTip("番茄时钟");
        isWorking = false;

        notification.show();
        notification.on('click', () => {
            if (!win.isVisible()) {
                win.show();
                win.focus();
            }
        });

        setTimeout(() => {
            win.show();
            win.focus();
            win.setAlwaysOnTop(true);
            dialog.showMessageBox(win, {
                type: 'question',
                buttons: ['休息一下', '取消'],
                title: '提示',
                message: msg,
                defaultId: 0,
                cancelId: 0
            }).then((promise) => {
                if (promise.response === 0) {
                    win.webContents.send('start-rest-main');
                } else if (promise.response === 1) {
                    win.setAlwaysOnTop(false);
                }
                notification.close();
            });
        }, 1500);
    }));

    ipcMain.on("end-rest", (event, args) => {
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: args
        });

        notification.show();
        win.focus();

        setTimeout(() => {
            notification.close();
        }, 3000);
    });

    ipcMain.on('start-work', (event, args) => {
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: args,
            silent: true
        });

        tray.setImage(path.join(__dirname, trayWorkIcon));
        tray.setToolTip("💻 Working...");
        isWorking = true;

        if (db.read().get('profile.startWorkNotification').value()) {
            notification.show();

            setTimeout(() => {
                notification.close();
            }, 2000);
        }
    });

    ipcMain.on('start-rest', (event, args) => {
        let rest = parseInt(args);
        isResting = true;
        handleResting(isResting);

        setTimeout(() => {
            isResting = false;
            handleResting(isResting);
        }, (rest - 1) * 1000);
    });

    ipcMain.on('quit-app', (event, args) => quitHandler());
}

function handleResting(isResting) {
    win.setAlwaysOnTop(isResting);
    win.setMovable(!isResting);
    win.setMinimizable(!isResting);
    win.setClosable(!isResting);
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
