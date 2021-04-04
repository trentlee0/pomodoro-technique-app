const {ipcRenderer, remote, shell} = require('electron');
const fs = require('fs');
const path = require('path');
const Timer = require('timer.js');
window.$ = window.jQuery = require('jquery');
const dataStore = require('./js/datastore');
const db = dataStore.getDb(remote.app)['db'];


/** 第一个界面 */
const firstFrameSelector = ".first";
/** 第二个界面 */
const secondFrameSelector = ".second";
/** 休息按钮 */
const restBtnSelector = ".rest-btn";
/** 工作按钮 */
const workBtnSelector = ".work-btn";
/** 下一个任务按钮 */
const taskBtnSelector = ".task-btn";
/** 暂停按钮 */
const pauseBtnSelector = ".pause-btn";
/** 保存设置按钮 */
const saveBtnSelector = ".save-btn";
/** 取消保存设置按钮 */
const cancelBtnSelector = ".cancel-btn";
/** 设置按钮 */
const settingBtnSelector = ".setting-btn";
/** 返回主页按钮 */
const homeBtnSelector = ".home-btn";
/** 设置面板 */
const settingFrameSelector = ".setting-frame";
/** 输入工作时间的文本框 */
const workInputSelector = "#work-input";
/** 输入休息时间的文本框 */
const restInputSelector = "#rest-input";
/** 输入背景颜色的文本框 */
const themeInputSelector = "#theme-input";
/** 显示标题的元素 */
const titleDivSelector = ".title";
/** 显示倒计时的元素 */
const timerDivSelector = ".timer";
/** 手动模式单选按钮 */
const manualModeSelector = "#manual-mode";
/** 自动模式单选按钮 */
const autoModeSelector = "#auto-mode";
const openThemeFileSelector = "#open-theme-file";
/** 工作时，提示的文字 */
const workTipSelector = "#work-tip";
/** 显示总番茄数的元素 */
const tomatoAllCountSelector = "#tomato-all-count";
/** 显示今日番茄数的元素 */
const tomatoTodayCountSelector = "#tomato-today-count";

/** 总番茄数 */
let tomatoAllCount = 0;
/** 今日番茄数 */
let tomatoTodayCount = 0;
/** 工作时间，单位：秒 */
let workTime = 2700;
/** 休息时间，单位：秒 */
let restTime = 300;
/** 主题 */
let theme = 'default';
/** 手动/自动模式 */
let mode = 'manual';
/** 计时器 */
let timer = null;
/** 是否已经开始任务 */
let isClocking = false;
/** 是否暂停 */
let isPause = false;
let workTipTimer = null;

window.onload = () => {
    initData();
    main();
};

function clearTimer() {
    if (timer != null) {
        timer.stop();
        timer.off();
        timer = null;
    }
    if (workTipTimer != null) {
        clearInterval(workTipTimer);
        workTipTimer = null;
    }
    isClocking = false;
}

function startTimer(second) {
    if (timer != null) timer.start(second);
    isClocking = true;
}

function run(type) {
    if (isClocking) return;

    timer = new Timer({
        onstart: () => {
            if (type === 'work') {
                ipcRenderer.send('start-work', "开始工作! 倒计时：" + getClockTime(workTime));
            } else if (type === 'rest') {
                ipcRenderer.send('start-rest', restTime);
            }

            if (workTipTimer != null) {
                clearInterval(workTipTimer);
                workTipTimer = null;
            }

            let workTips = db.read().get('workTips').value();
            let ranIndex = Math.floor(Math.random() * workTips.length);
            $(workTipSelector).html(workTips[ranIndex]);
            workTipTimer = setInterval(() => {
                $(workTipSelector).hide();
                ranIndex = (ranIndex + 1) % workTips.length;
                $(workTipSelector).html(workTips[ranIndex]);
                $(workTipSelector).fadeIn('slow');
            }, 10 * 1000);
        },
        ontick: (ms) => $(timerDivSelector).html(getClockTime(Math.round(ms / 1000))),
        onend: () => {
            view({type: type, end: true});
            if (type === 'work') {
                tomatoAllCount++;
                db.set('tomatoCount.total', tomatoAllCount).write();
                $(tomatoAllCountSelector).html(tomatoAllCount);

                if (isSameDay()) {
                    tomatoTodayCount++;
                    db.set('tomatoCount.today', tomatoTodayCount).write();
                    db.set('tomatoCount.todayUpdateTime', getNowDate()).write();
                    $(tomatoTodayCountSelector).html(tomatoTodayCount);
                }

                ipcRenderer.send('end-work');
            } else if (type === 'rest') {
                ipcRenderer.send("end-rest", "休息完成!");
            }

            clearTimer();
        }
    });

    view({type: type, start: true});
    view({type: 'second'});
    if (type === 'work') {
        startTimer(workTime);
    } else if (type === 'rest') {
        startTimer(restTime);
    }
}

function main() {
    //获取主题目录下的主题
    let dirs = getDirs(path.join(__dirname, 'css/theme/'));
    for (let i = 0; i < dirs.length; i++) {
        let op = document.createElement("option");
        op.value = dirs[i];
        op.innerText = dirs[i];
        $(themeInputSelector).append(op);
    }

    $(openThemeFileSelector).on('click', () => {
        console.log(__dirname);
        if (remote.app.isPackaged) {
            shell.showItemInFolder(path.join(__dirname + ".unpacked", "css/theme/", theme));
        } else {
            shell.showItemInFolder(path.join(__dirname, "css/theme/", theme));
        }
    });

    $(settingBtnSelector).click((event) => {
        $(settingFrameSelector).fadeToggle("fast");
        event.stopPropagation();
    });

    $(settingBtnSelector).mousedown(() => false);

    $(saveBtnSelector).click(() => {
        updateData({
            workHours: parseInt($(workInputSelector).val()) * 60,
            restHours: parseInt($(restInputSelector).val()) * 60,
            themePath: $(themeInputSelector).val(),
            runMode: $("input[name='mode']:checked").val()
        });
        $(settingBtnSelector).click();
    });

    $(cancelBtnSelector).click(() => $(settingBtnSelector).click());

    $(workBtnSelector).on("click", () => run('work'));

    $(document).on("keydown", (e) => {
        if (isFirstFrame()) {
            // 空格
            if (e.keyCode === 32) {
                $(workBtnSelector).click();
            }
        } else {
            if (!isClocking) {
                if (e.keyCode === 32) {
                    $(taskBtnSelector).click();
                }
            }
        }
        // Ctrl + W
        if (e.ctrlKey && e.keyCode === 87) {
            ipcRenderer.send("quit-app");
        }
    });

    $(restBtnSelector).click(() => run('rest'));

    ipcRenderer.on('start-work-main', () => $(workBtnSelector).click());

    ipcRenderer.on('start-rest-main', () => $(restBtnSelector).click());

    ipcRenderer.on('pause-work', () => pauseHandler());

    $(homeBtnSelector).click(() => {
        if (!isFirstFrame()) {
            if (isClocking) {
                let reply = ipcRenderer.sendSync('synchronous-message', 'quit-timer');
                if (reply === 'yes') {
                    clearTimer();
                    view({type: 'first'});
                }
            } else {
                clearTimer();
                view({type: 'first'});
            }
        }
    });

    $(document).on('click', () => {
        $(settingFrameSelector).fadeOut();
        updateViewData();
    });

    $(settingFrameSelector).on('click', (event) => {
        event.stopPropagation();
    });

    $(pauseBtnSelector).click(() => {
        pauseHandler();
    });

    $(taskBtnSelector).click(() => {
        clearTimer();
        if ($(taskBtnSelector).text().trim() === '工作') {
            run('work');
        } else if ($(taskBtnSelector).text().trim() === '休息') {
            run('rest');
        }
    });
}

function pauseHandler() {
    if (timer != null) {
        if (isPause) {
            timer.start();
            view({type: 'continue'});
            isPause = false;
        } else {
            view({type: 'pause'});
            timer.pause();
            isPause = true;
        }
    }
}

/**
 *  通过秒数，获取时钟，小时分钟秒，如果小时为0就不返回小时
 */
function getClockTime(second) {
    let ss = Math.floor(second % 60);
    let mm = Math.floor(second / 60);
    let hh = Math.floor(second / 3600);
    return ((hh === 0) ? "" : hh.toString().padStart(2, '0') + ":") + mm.toString().padStart(2, '0') + ":" + ss.toString().padStart(2, '0');
}


function isFirstFrame() {
    return $(firstFrameSelector).css('display') === 'block';
}

function view({type, start, end}) {
    if (type === 'work' || type === 'rest') {
        if (start) {
            $(taskBtnSelector).hide();
            $(pauseBtnSelector).html('暂停');
            if (type === 'work') {
                $(timerDivSelector).html(getClockTime(workTime));
                if (mode === 'auto') {
                    $(pauseBtnSelector).hide();
                } else {
                    $(pauseBtnSelector).show();
                }
                $(taskBtnSelector).html("休息");
                $(titleDivSelector).html("Working");
            } else if (type === 'rest') {
                $(timerDivSelector).html(getClockTime(restTime));
                $(pauseBtnSelector).hide();
                $(taskBtnSelector).html("工作");
                $(titleDivSelector).html("Resting");
            }
        } else if (end) {
            $(pauseBtnSelector).hide();
            $(taskBtnSelector).show();
            $(titleDivSelector).html('');
            if (type === 'work') {
                $(timerDivSelector).html('工作完成!');
            } else if (type === 'rest') {
                $(timerDivSelector).html("休息完成!");
            }
        }
    } else if (type === 'pause') {
        $(pauseBtnSelector).html("继续");
    } else if (type === 'continue') {
        $(pauseBtnSelector).html("暂停");
    } else if (type === 'first') {
        $(secondFrameSelector).fadeOut();
        $(firstFrameSelector).fadeIn();
    } else if (type === 'second') {
        $(firstFrameSelector).fadeOut();
        $(secondFrameSelector).fadeIn();
    }
}

function getDirs(filePath) {
    let dirs = [];
    let files = fs.readdirSync(filePath);
    for (let i = 0; i < files.length; i++) {
        if (fs.lstatSync(path.join(filePath, files[i])).isDirectory()) {
            dirs.push(files[i]);
        }
    }
    return dirs;
}

/**
 * 初始化数据
 */
function initData() {
    workTime = db.get('profile.work').value();
    restTime = db.get('profile.rest').value();
    theme = db.get('profile.theme').value();
    mode = db.get('profile.mode').value();
    tomatoAllCount = db.get('tomatoCount.total').value();

    tomatoTodayCount = db.get('tomatoCount.today').value();
    if (!isSameDay()) {
        tomatoTodayCount = db.set('tomatoCount.today', 0).write();
        tomatoTodayCount = 0;
    }

    updateViewData();
}

/**
 * 是否是同一天
 */
function isSameDay() {
    return getNowDate() ===
        db.read().get('tomatoCount.todayUpdateTime').value();
}

function getNowDate() {
    let now = new Date();
    let twoNum = function (num) {
        return num < 10 ? "0" + num : "" + num;
    };
    return now.getFullYear() + "-" + twoNum(now.getMonth() + 1) + "-" + twoNum(now.getDate());
}

/**
 * 更新数据
 */
function updateData({workHours, restHours, themePath, runMode}) {
    if (workHours != null && workHours > 0) {
        db.set('profile.work', workHours).write();
        workTime = workHours;
    }

    if (restHours != null && restHours > 0) {
        db.set('profile.rest', restHours).write();
        restTime = restHours;
    }

    if (themePath != null && themePath !== "") {
        db.set('profile.theme', themePath).write();
        theme = themePath;
    }

    if (runMode != null) {
        db.set('profile.mode', runMode).write();
        mode = runMode;
    }

    updateViewData();
}

/**
 * 更新视图数据
 */
function updateViewData() {
    $("#theme").attr("href", "./css/theme/" + theme + "/" + theme + ".css");
    $(themeInputSelector).val(theme);
    $(workInputSelector).val(workTime / 60);
    $(restInputSelector).val(restTime / 60);
    $(tomatoAllCountSelector).html(tomatoAllCount);
    $(tomatoTodayCountSelector).html(tomatoTodayCount);

    if (mode === 'manual') {
        $(manualModeSelector).attr('checked', 'checked');
    } else if (mode === 'auto') {
        $(autoModeSelector).attr('checked', 'checked');
    }
}