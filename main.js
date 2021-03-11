const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, globalShortcut } = require('electron');
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

    win.loadFile('index.html')
    win.webContents.openDevTools();

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
    globalShortcut.register('CommandOrControl+Shift+P', () => {
        win.isVisible() ? win.hide() : win.show();
    });
}).then(createWindow);



//系统托盘
let tray = null;
app.whenReady().then(() => {
    tray = new Tray(path.join(__dirname, 'img/icon.ico'));
    const trayMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            accelerator: 'Ctrl+Shift+P',
            click: () => win.show()
        },
        {
            label: '隐藏窗口',
            accelerator: 'Ctrl+Shift+P',
            click: () => win.hide()
        },
        {
            label: '工作',
            click: () => {
                win.webContents.send('start-work');
                win.show();
            }
        },
        {
            label: '休息',
            click: () => {
                win.webContents.send('start-rest');
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
    if (arg == 'quit-timer') {
        let index = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['确定', '取消'],
            title: '提示',
            message: '退出倒计时？',
            defaultId: 1,
            cancelId: 1
        });

        if (index == 0) {
            event.returnValue = 'yes';
        } else {
            event.returnValue = 'no';
        }
    } else if (arg == 'rest') {
        win.show();
        win.setAlwaysOnTop(true);
        let index = dialog.showMessageBoxSync(win, {
            type: 'question',
            buttons: ['取消', '休息一下'],
            title: '提示',
            message: '已经工作一段时间了，休息一下吧！',
            defaultId: 1,
            cancelId: 0
        });
        if (index == 1) {
            win.webContents.send('start-rest');
            event.returnValue = 'start-rest';
        } else if (index == 0) {
            win.setAlwaysOnTop(false);
            event.returnValue = '';
        }
    }
});

ipcMain.on('alway-show-window', (event, arg) => {
    console.log(arg);
    let rest = parseInt(arg);
    win.setAlwaysOnTop(true);
    win.setMovable(false);
    win.setMinimizable(false);

    setTimeout(() => {
        win.setAlwaysOnTop(false);
        win.setMovable(true);
        win.setMinimizable(true);
    }, (rest - 2) * 1000);
});

ipcMain.on('hide-window', () => {
    win.hide();
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
