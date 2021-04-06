const {app, globalShortcut, ipcMain, dialog, shell, BrowserWindow, Menu, Tray, Notification} = require('electron');
const ioHook = require('iohook');
const path = require('path');
const dataStore = require('./js/datastore');
const array = dataStore.getDb(app);
const db = array['db'];
const confFile = array['confFile'];

const icon = "img/icon.ico";
const trayIcon = "img/icon_tray.ico";
const trayWorkIcon = "img/icon_tray_work.ico";
const trayRestIcon = "img/icon_tray_rest.ico";
const trayPauseIcon = "img/icon_tray_pause.ico";

let win;
let tray;
let isResting = false;
/** 在工作倒计时中都是为true，包括在暂停后 */
let isWorking = false;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        icon: path.join(__dirname, icon),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

    initSettings();
    createTray();
    handler();

    win.loadFile('index.html').then(() => {
        if (db.read().get('profile.mode').value() === 'auto') {
            autoModeHandle();
        }
    });

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

function autoModeHandle() {
    let isWorkingPaused = false;
    let leaveTime = Date.now();

    ioHook.start();

    let leaveIntervalSecond = 20;
    setInterval(() => {
        if (isWorking && (Date.now() - leaveTime) >= leaveIntervalSecond * 1000) {
            leaveTime = Date.now();
            console.log("暂停计时");
            win.webContents.send('pause-work-main');
            isWorkingPaused = true;
        }
    }, 500);

    let updateLeaveTime = () => {
        leaveTime = Date.now();
        if (isWorking) {
            if (isWorkingPaused) {
                console.log("继续计时");
                win.webContents.send('continue-work-main');
                isWorkingPaused = false;
            }
        }
    };

    ioHook.on('mousemove', () => updateLeaveTime());
    ioHook.on('keydown', () => updateLeaveTime());
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
            label: '显示/隐藏',
            click: () => {
                if (!isResting) {
                    win.isVisible() ? win.hide() : win.show()
                }
            }
        },
        {
            label: '关于',
            click: () => {
                dialog.showMessageBox({
                    type: 'info',
                    title: '关于',
                    message: 'Tomato\n\nAuthor: Trent0\nGitHub: https://github.com/trentlee0/Electron-Tomato',
                    buttons: ['OK'],
                    icon: path.join(__dirname, 'img/logo.png')
                })
            }
        },
        {
            type: 'separator'
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
            label: '设置',
            submenu: [

                {
                    label: '配置文件',
                    click: () => {
                        shell.showItemInFolder(confFile);
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
                }
            ]
        },
        {
            label: '开始',
            submenu: [
                {
                    label: '开始工作',
                    click: () => {
                        win.webContents.send('start-work-main');
                        win.show();
                    }
                },
                {
                    label: '休息一下',
                    click: () => {
                        win.webContents.send('start-rest-main');
                        win.show();
                    }
                }
            ]
        },
        {
            type: 'separator'
        },
        {
            label: '退出',
            click: () => quitHandle()
        }
    ]);

    tray.setToolTip('番茄时钟');
    tray.setContextMenu(trayMenu);
    tray.on('click', () => showOrHideMainWindow());
}

function quitHandle() {
    if (isWorking || isResting) {
        dialog.showMessageBox(win, {
            type: 'question',
            buttons: ['取消', '退出'],
            title: '提示',
            message: '当前正在倒计时，确定退出吗？',
            defaultId: 0,
            cancelId: 0
        }).then((promise) => {
            if (promise.response === 1) {
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
                buttons: ['取消', '确定'],
                title: '提示',
                message: '退出倒计时？',
                defaultId: 0,
                cancelId: 0
            });
            if (index === 1) {
                event.returnValue = 'yes';
                isResting = false;
                isWorking = false;
                handleResting(isResting);

                resetTray();
            } else {
                event.returnValue = 'no';
            }
        }
    });


    /************ 异步 ************/

    ipcMain.on("pause-timer", ((event, type, duration) => {
        tray.setToolTip('🍷 ' + (type === 'work' ? '工作' : '休息') + '暂停中...... 还剩：' + duration);
        tray.setImage(path.join(__dirname, trayPauseIcon));
    }));

    ipcMain.on("end-work", ((event, args) => {
        let msg = '已经工作一段时间了，休息一下吧！';
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: msg,
            timeoutType: "never"
        });

        resetTray();
        isWorking = false;

        notification.show();
        notification.on('click', () => {
            if (!win.isVisible()) {
                win.show();
                win.focus();
            }
        });

        win.show();
        win.focus();
        win.setAlwaysOnTop(true);
        dialog.showMessageBox(win, {
            type: 'question',
            buttons: ['取消', '休息一下'],
            title: '提示',
            message: msg,
            cancelId: 0,
            defaultId: 1
        }).then((promise) => {
            if (promise.response === 1) {
                win.webContents.send('start-rest-main');
            } else if (promise.response === 0) {
                win.setAlwaysOnTop(false);
            }
            notification.close();
        });
    }));

    ipcMain.on("end-rest", (event, args) => {
        let notification = new Notification({
            icon: path.join(__dirname, icon),
            title: "番茄时钟",
            body: args
        });

        notification.show();
        win.focus();
        resetTray();

        isResting = false;
        handleResting(isResting);

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
        tray.setToolTip("💻 工作中......");
        isWorking = true;

        if (db.read().get('profile.startWorkNotification').value()) {
            notification.show();

            setTimeout(() => {
                notification.close();
            }, 2000);
        }
    });

    ipcMain.on('start-rest', (event, args) => {
        tray.setImage(path.join(__dirname, trayRestIcon));
        tray.setToolTip("🍹 休息中......");
        isResting = true;
        handleResting(isResting);
    });

    ipcMain.on('hide-app', (event, args) => {
        if (!isResting) {
            win.hide()
        }
    });
}

function resetTray() {
    tray.setImage(path.join(__dirname, trayIcon));
    tray.setToolTip("番茄时钟");
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
