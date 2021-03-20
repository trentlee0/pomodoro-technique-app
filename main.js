const {app, BrowserWindow, ipcMain, dialog, Menu, Tray, globalShortcut, Notification} = require('electron');
const path = require('path');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'img/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    win.loadFile('index.html');

    Menu.setApplicationMenu(null);

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
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

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

app.whenReady().then(() => {
    //全局快捷键
    globalShortcut.register('CommandOrControl+Shift+T', () => {
        win.isVisible() ? win.hide() : win.show();
    });
}).then(createWindow);

//系统托盘
let tray = null;
app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'img/icon_min.ico'));
    const trayMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            accelerator: 'Ctrl+Shift+T',
            click: () => win.show()
        },
        {
            label: '隐藏窗口',
            accelerator: 'Ctrl+Shift+T',
            click: () => win.hide()
        },
        {
            label: '开发者模式',
            click: () => {
                if (win.isVisible()) {
                    if (win.isDevToolsOpened()) {
                        win.webContents.closeDevTools();
                    } else {
                        win.webContents.openDevTools();
                    }
                }
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
});

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
        } else {
            event.returnValue = 'no';
        }
    }
});

ipcMain.on("work-to-rest", ((event, args) => {
    let msg = '已经工作一段时间了，休息一下吧！';
    let notification = new Notification({
        icon: path.join(__dirname, 'img/icon.ico'),
        title: "番茄时钟",
        body: msg,
        timeoutType: "never"
    });
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
                notification.close();
            } else if (promise.response === 0) {
                win.setAlwaysOnTop(false);
                notification.close();
            }
        });
    }, 3000);
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
    win.hide();
    let notification = new Notification({
        icon: path.join(__dirname, 'img/icon.ico'),
        title: "番茄时钟",
        body: msg,
        silent: true
    });
    notification.show();
    setTimeout(() => {
        notification.close();
    }, 2000);
});

ipcMain.on("end-rest", (sys, msg) => {
    let notification = new Notification({
        icon: path.join(__dirname, "img/icon.ico"),
        title: "番茄时钟",
        body: msg
    });

    notification.show();

    setTimeout(() => {
        notification.close();
    }, 3000);
});

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
