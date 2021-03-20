const {ipcRenderer} = require('electron');
const Timer = require('timer.js');
window.$ = window.jQuery = require('jquery');

/** 通过秒数，获取时钟，小时分钟秒，如果小时为0就不返回小时 */
function getClockTime(second) {
    let ss = Math.floor(second % 60);
    let mm = Math.floor(second / 60);
    let hh = Math.floor(second / 3600);
    return ((hh === 0) ? "" : hh.toString().padStart(2, '0') + ":") + mm.toString().padStart(2, '0') + ":" + ss.toString().padStart(2, '0');
}

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
const colorInputSelector = "#color-input";
/** 显示颜色提示 */
const colorShowSelector = "#color-show";
/** 显示标题的元素 */
const titleDivSelector = ".title";
/** 显示倒计时的元素 */
const timerDivSelector = ".timer";

/** 工作时间，单位：秒 */
let workTime = 10;
/** 休息时间，单位：秒 */
let restTime = 5;
/** 背景颜色 */
let background;
/** 通知图标 */
let logoIcon = './img/logo.png';
/** 通知标题 */
let appName = '番茄时钟';

let timer = null;
/** 是否已经开始任务 */
let isClocking = false;
let isPause = false;

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
    isClocking = false;
}

function startTimer(second) {
    if (timer != null) timer.start(second);
    isClocking = true;
}

function run(type) {
    timer = new Timer({
        onstart: () => start(type),
        ontick: (ms) => $(timerDivSelector).html(getClockTime(Math.round(ms / 1000))),
        onend: () => end(type)
    });

    if (!isClocking) {
        $(firstFrameSelector).css("display", 'none');
        $(secondFrameSelector).css("display", 'block');
        isClocking = true;
        if (type === 'work') {
            $(timerDivSelector).html(getClockTime(workTime));
            startTimer(workTime);
        } else if (type === 'rest') {
            $(timerDivSelector).html(getClockTime(restTime));
            startTimer(restTime);
        }
    }
}

/**
 * 开始计时调用执行
 */
function start(type) {
    $(taskBtnSelector).css("display", 'none');
    $(pauseBtnSelector).css("display", 'block');
    $(pauseBtnSelector).html('暂停');

    if (type === 'work') {
        $(taskBtnSelector).html("休息");
        $(titleDivSelector).html("Working");
        ipcRenderer.send('start-work', "开始工作! 倒计时：" + getClockTime(workTime));
    } else if (type === 'rest') {
        $(taskBtnSelector).html("工作");
        $(titleDivSelector).html("Resting");
        ipcRenderer.send('start-rest', restTime);
        $(pauseBtnSelector).css("display", "none");
    }
}

/**
 * 计时结束调用执行
 */
function end(type) {
    $(pauseBtnSelector).css("display", 'none');
    $(taskBtnSelector).css("display", 'block');
    $(titleDivSelector).html('');

    if (type === 'work') {
        $(timerDivSelector).html('工作完成!');
        ipcRenderer.send('work-to-rest');
    } else if (type === 'rest') {
        let notification = "休息完成!";
        $(timerDivSelector).html(notification);
        ipcRenderer.send("end-rest", notification);
    }
    clearTimer();
}

function main() {
    $(settingBtnSelector).click(() => $(settingFrameSelector).fadeToggle("fast"));

    $(settingBtnSelector).mousedown(() => false);

    $(colorInputSelector).keyup(() => $(colorShowSelector).css("background-color", $(colorInputSelector).val()));

    $(saveBtnSelector).click(() => {
        updateData({
            workHours: $(workInputSelector).val(),
            restHours: $(restInputSelector).val(),
            backgroundColor: $(colorInputSelector).val()
        });
        $(settingBtnSelector).click();
    });

    $(cancelBtnSelector).click(() => $(settingBtnSelector).click());

    $(workBtnSelector).on("click", () => run('work'));

    $(restBtnSelector).click(() => run('rest'));

    ipcRenderer.on('start-work-main', () => $(workBtnSelector).click());

    ipcRenderer.on('start-rest-main', () => $(restBtnSelector).click());

    $(homeBtnSelector).click(() => {
        if ($(firstFrameSelector).css("display") === 'none') {
            if (isClocking) {
                let reply = ipcRenderer.sendSync('synchronous-message', 'quit-timer');
                if (reply === 'yes') {
                    clearTimer();
                    $(firstFrameSelector).css("display", "block");
                    $(secondFrameSelector).css("display", "none");
                }
            } else {
                clearTimer();
                $(firstFrameSelector).css("display", "block");
                $(secondFrameSelector).css("display", "none");
            }
        }
    });

    $(pauseBtnSelector).click(() => {
        if (timer != null) {
            if (isPause) {
                timer.start();
                $(pauseBtnSelector).html("暂停");
                isPause = false;
            } else {
                timer.pause();
                $(pauseBtnSelector).html("继续");
                isPause = true;
            }
        }
    });

    $(taskBtnSelector).click(() => {
        clearTimer();
        $(taskBtnSelector).css("display", "none");
        $(pauseBtnSelector).css("display", "block");
        if ($(taskBtnSelector).text().trim() === '工作') {
            run('work');
        } else if ($(taskBtnSelector).text().trim() === '休息') {
            run('rest');
        }
    });
}

/**
 * 初始化数据
 */
function initData() {
    let storage = window.localStorage;

    let workHours = storage.getItem('work');
    let restHours = storage.getItem('rest');
    let backgroundColor = storage.getItem('background');

    if (workHours == null && restHours == null && backgroundColor == null) {
        updateData({workHours: 10, restHours: 5, backgroundColor: '#87CEEB'});
        return;
    }

    if (workHours == null) updateData({workHours: 10});
    else workTime = workHours;

    if (restHours == null) updateData({restHours: 5});
    else restTime = restHours;

    if (backgroundColor == null) updateData({backgroundColor: '#87CEEB'});
    else background = backgroundColor;

    $('html').css("background-color", background);
    $(colorShowSelector).css("background-color", background);
    $(colorInputSelector).val(background);

    $(workInputSelector).val(workTime);
    $(restInputSelector).val(restTime);
}

/**
 * 更新数据
 */
function updateData({workHours, restHours, backgroundColor}) {
    let storage = window.localStorage;

    if (workHours != null) {
        storage.setItem('work', workHours.toString());
        $(workInputSelector).val(workTime);
        workTime = workHours;
    }

    if (restHours != null) {
        storage.setItem('rest', restHours.toString());
        $(restInputSelector).val(restTime);
        restTime = restHours;
    }

    if (backgroundColor != null) {
        storage.setItem('background', backgroundColor);
        $('html').css("background-color", backgroundColor);
        $(colorShowSelector).css("background-color", backgroundColor);
        $(colorInputSelector).val(backgroundColor);
        background = backgroundColor;
    }
}