const { ipcRenderer } = require('electron');

/**
 * 计时器
 */
class Countdown {

    constructor(totalSecond) {
        this.pauseSecond = 0;
        this.totalSecond = 0;
        this.currentSecond = 0;
        this.timer = null;
        /** 在倒计时为0秒时触发的事件 */
        this.onend = null;
        /** 在倒计时期间每一秒会触发的事件 */
        this.ontick = null;
        /** 在倒计时开始触发的事件 */
        this.onstart = null;
        /** 在倒计时暂停时触发的事件 */
        this.reset(totalSecond);
    }

    /** 获取剩余时间 */
    getRemainingSecond() {
        return this.totalSecond - this.currentSecond;
    }

    /** 获取当前计时秒数 */
    getCurrentSecond() {
        return this.currentSecond;
    }

    /** 暂停计时 */
    pause() {
        this.pauseSecond = this.getRemainingSecond();
        this.clear();
        this.isPause = true;
    }

    /** 继续计时 */
    continue() {
        if (this.pauseSecond < 1) return;
        this.reset(this.pauseSecond);
        this.isPause = false;
    }

    /** 清除计时 */
    clear() {
        clearInterval(this.timer);
        this.timer = null;
    }

    /** 重置计时 */
    reset(totalSecond) {
        this.clear();
        this.totalSecond = totalSecond;
        this.currentSecond = 0;
        this.isPause = false;
        this.i = 0;
        this.timer = setInterval(() => {
            if (this.currentSecond + 1 == this.totalSecond) {
                this.clear();
            }
            this.currentSecond++;
            if (this.ontick) {
                this.ontick();
            }
            if (this.i == 0 && this.onstart) {
                this.onstart();
                this.i++;
            }
            if (this.getRemainingSecond() == 0) {
                this.clear();
                if (this.onend) this.onend();
            }
        }, 1000);
    }

    /** 获取显示字符串 */
    getShowString() {
        return Countdown.getRemainingTime(this.getRemainingSecond());
    }

    /** 剩余时间 */
    static getRemainingTime(second) {
        return parseInt(second / 60) + ":" + Countdown.getSecond(second);
    }

    /** 通过秒数，获取两位时钟秒数 */
    static getSecond(second) {
        if (second < 10) return "0" + second;
        else if (second < 60) return second;
        return this.getSecond(parseInt(second % 60));
    }
}

/**
 * 通过元素选择器获取元素
 * @param selector : string
 */
function $(selector) {
    return document.querySelector(selector);
}

/** 工作时间，单位：秒 */
let workTime = 0;
/** 休息时间，单位：秒 */
let restTime = 0;
/** 背景颜色 */
let background = '';
/** 通知图标 */
let logoIcon = './img/logo.png';
/** 通知标题 */
let appName = '番茄时钟';

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

let workFeature = {
    code: 'work',
    title: 'Working',
    nextTaskContent: '休息',
    notification: ' 工作完成!',
    currentTaskTime: workTime,
    nextTaskTime: restTime
};

let restFeature = {
    code: 'rest',
    title: 'Resting',
    nextTaskContent: '工作',
    notification: ' 休息完成!',
    currentTaskTime: restTime,
    nextTaskTime: workTime
};

/** 倒计时器 */
let cd = null;
/** 是否已经开始任务 */
let isStartTask = false;

window.onload = () => {
    main();
};

function main() {
    console.log("主函数开始执行...");
    $(settingFrameSelector).style.display = 'none';

    initData();

    $(settingBtnSelector).onclick = () => {
        if ($(settingFrameSelector).style.display == 'none') {
            initData();
            $(settingFrameSelector).style.display = 'block';
        } else {
            $(settingFrameSelector).style.display = 'none';
        }
    };

    $(colorInputSelector).onkeyup = () => {
        $(colorShowSelector).style.backgroundColor = $(colorInputSelector).value;
    };

    $(settingBtnSelector).onmousedown = () => false;

    $(saveBtnSelector).onclick = () => {
        updateData($(workInputSelector).value, $(restInputSelector).value);
        updateTheme($(colorInputSelector).value);
        initData();
        $(settingBtnSelector).click();
    };

    $(cancelBtnSelector).onclick = () => $(settingBtnSelector).click();

    $(workBtnSelector).onclick = () => startWork();

    $(restBtnSelector).onclick = () => startRest();

    $(homeBtnSelector).onclick = () => {
        if ($(firstFrameSelector).style.display == 'none') {
            let reply = ipcRenderer.sendSync('synchronous-message', 'quit-timer');
            if (reply == 'yes') {
                cd.clear();
                isStartTask = false;
                $(firstFrameSelector).style.display = 'block';
                $(secondFrameSelector).style.display = 'none';
            }
        }
    };

    ipcRenderer.on('start-work', () => startWork());

    ipcRenderer.on('start-rest', () => startRest());
}

/** 开始工作 */
function startWork() {
    if (!isStartTask) {
        $(firstFrameSelector).style.display = 'none';
        $(secondFrameSelector).style.display = 'block';
        isStartTask = true;
        run(workFeature);
    }
}

/** 开始休息 */
function startRest() {
    if (!isStartTask) {
        $(firstFrameSelector).style.display = 'none';
        $(secondFrameSelector).style.display = 'block';
        isStartTask = true;
        run(restFeature);
    }
}

/**
 * 执行不同功能的函数
 * @param feature : workFeature|restFeature
 * @return void
 */
function run(feature) {
    if (feature == null) return;

    $(timerDivSelector).innerHTML = Countdown.getRemainingTime(feature.currentTaskTime);
    $(taskBtnSelector).innerHTML = feature.nextTaskContent;
    $(taskBtnSelector).style.display = 'none';
    $(pauseBtnSelector).style.display = 'block';
    $(pauseBtnSelector).innerHTML = '暂停';
    $(titleDivSelector).innerHTML = feature.title;

    if (feature.code == 'work') {
        new Notification(appName, {
            icon: logoIcon,
            body: "开始工作! 倒计时：" + Countdown.getRemainingTime(feature.currentTaskTime)
        });
    } else if (feature.code == 'rest') {
        $(pauseBtnSelector).style.display = 'none';
    }

    cd = new Countdown(feature.currentTaskTime);

    /***********以下事件会在前台或后台运行***********/

    cd.ontick = () => {
        $(timerDivSelector).innerHTML = cd.getShowString();
    };

    cd.onstart = () => {
        if (feature.code == 'rest') {
            ipcRenderer.send('show-main-message', restTime);
        }
    };

    cd.onend = () => {
        $(pauseBtnSelector).style.display = 'none';
        $(taskBtnSelector).style.display = 'block';
        $(titleDivSelector).innerHTML = '';
        $(timerDivSelector).innerHTML = feature.notification;

        if (feature.code == 'work') {
            let reply = ipcRenderer.sendSync('synchronous-message', 'rest');
            if (reply == 'start-rest') {
                run(restFeature);
            }
        } else if (feature.code == 'rest') {
            new Notification(appName, {
                icon: logoIcon,
                body: feature.notification
            });
        }
    };

    $(taskBtnSelector).onclick = () => {
        if (cd != null) cd.clear();
        $(taskBtnSelector).style.display = 'none';
        $(pauseBtnSelector).style.display = 'block';
        if (feature.code == 'work') {
            run(restFeature);
        } else {
            run(workFeature);
        }
    };

    $(pauseBtnSelector).onclick = () => {
        if (cd.isPause) {
            cd.continue();
            $(pauseBtnSelector).innerHTML = "暂停";
        } else {
            cd.pause();
            $(pauseBtnSelector).innerHTML = "继续";
        }
    };
}

/**
 * 初始化数据
 * @return void
 */
function initData() {
    let storage = window.localStorage;

    let work = storage.getItem('work');
    if (work == null) {
        work = '10';
        storage.setItem('work', work);
    }

    let rest = storage.getItem('rest')
    if (rest == null) {
        rest = '5';
        storage.setItem('rest', rest);
    }

    let color = storage.getItem('background')
    if (color == null) {
        color = '#87CEEB';
        storage.setItem('background', color);
    }

    workTime = parseInt(work);
    restTime = parseInt(rest);
    background = color;

    workFeature.currentTaskTime = workTime;
    workFeature.nextTaskTime = restTime;
    restFeature.currentTaskTime = restTime;
    restFeature.nextTaskTime = workTime;

    $(colorShowSelector).style.backgroundColor = background;
    $('html').style.backgroundColor = background;
    $(colorInputSelector).value = background;
    $(workInputSelector).value = workTime;
    $(restInputSelector).value = restTime;
}

/**
 * 更新工作和休息时间的数据
 * @param newWork : number
 * @param newRest : number
 */
function updateData(newWork, newRest) {
    let storage = window.localStorage;

    storage.setItem('work', newWork);
    storage.setItem('rest', newRest);
}

/**
 * 更改背景主题
 * @param color : string Hexadecimal color code
 */
function updateTheme(color) {
    let storage = window.localStorage;

    storage.setItem('background', color);

    background = color;
    $('html').style.backgroundColor = color;
}