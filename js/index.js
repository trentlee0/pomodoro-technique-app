const {ipcRenderer, remote, shell} = require('electron');
const fs = require('fs');
const path = require('path');
window.$ = window.jQuery = require('jquery');
const dataStore = require('./js/datastore');
const array = dataStore.getDb(remote.app);
const db = array['db'];
const targetThemeDir = array['targetThemeDir'];
const ReinforceTimer = require('./js/reinforce-timer');

$.extend(window, {
    //第一个界面
    firstFrame: ".first",
    //第二个界面
    secondFrame: ".second",
    //休息按钮
    restBtn: ".rest-btn",
    //工作按钮
    workBtn: ".work-btn",
    //下一个任务按钮
    taskBtn: ".task-btn",
    //暂停按钮
    pauseBtn: ".pause-btn",
    //保存设置按钮
    saveBtn: ".save-btn",
    //取消保存设置按钮
    cancelBtn: ".cancel-btn",
    //设置按钮
    settingBtn: ".setting-btn",
    //返回主页按钮
    homeBtn: ".home-btn",
    //设置面板
    settingFrame: ".setting-frame",
    //输入工作时间的文本框
    workInput: "#work-input",
    //输入休息时间的文本框
    restInput: "#rest-input",
    //输入背景颜色的文本框
    themeInput: "#theme-input",
    //显示标题的元素
    titleDiv: ".title",
    //显示倒计时的元素
    timerDiv: ".timer",
    //手动模式单选按钮
    manualModeRadio: "#manual-mode",
    //自动模式单选按钮
    autoModeRadio: "#auto-mode",
    //打开主题文件按钮
    openThemeFileBtn: "#open-theme-file",
    //工作时，提示的文字
    workTipDiv: "#work-tip",
    //显示总番茄数的元素
    tomatoTotalCountSpan: "#tomato-all-count",
    //显示今日番茄数的元素
    tomatoTodayCountSpan: "#tomato-today-count"
});


/** 计时类型*/
const work = 'work';
const rest = 'rest';

/** 计时器 */
let timer = null;

/** 总番茄数 */
let tomatoTotalCount = 0;
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

window.onload = () => {
    //获取主题目录下的主题
    let dirs = getDirs(targetThemeDir);
    for (let i = 0; i < dirs.length; i++) {
        let op = document.createElement("option");
        op.value = dirs[i];
        op.innerText = dirs[i];
        $(themeInput).append(op);
    }
    initData();
    main();
};

function run(type) {
    if (timer && timer.getStatus() !== 'stopped') return;

    let tips = [''];

    let workTips = db.read().get('workTips').value();
    let restTips = db.read().get('restTips').value();
    let tipChangeSecond = 20;
    let workTipTimer = null;
    timer = new ReinforceTimer({
        name: type,
        onstart: () => {
            if (type === work) {
                tips = workTips;
                ipcRenderer.send('start-work', "开始工作! 倒计时：" + ReinforceTimer.formatTime(workTime));
            } else if (type === rest) {
                tips = restTips;
                ipcRenderer.send('start-rest', restTime);
            }

            if (workTipTimer != null) {
                clearInterval(workTipTimer);
                workTipTimer = null;
            }

            let ranIndex = Math.floor(Math.random() * tips.length);
            if (isShow(workTipDiv)) {
                $(workTipDiv).hide();
                $(workTipDiv).html(tips[ranIndex]);
                $(workTipDiv).fadeIn('slow');
            } else {
                $(workTipDiv).html(tips[ranIndex]);
            }

            workTipTimer = setInterval(() => {
                if (tips.length > 1) {
                    $(workTipDiv).hide();
                    ranIndex = (ranIndex + 1) % tips.length;
                    $(workTipDiv).html(tips[ranIndex]);
                    $(workTipDiv).fadeIn('slow');
                }
            }, tipChangeSecond * 1000);
        },
        ontick: (s) => $(timerDiv).html(ReinforceTimer.formatTime((s))),
        onpause: () => {
            ipcRenderer.send('pause-timer', type, ReinforceTimer.formatTime(timer.getDuration()));
        },
        onend: () => {
            view({type: type, end: true});
            $(workTipDiv).hide();
            if (type === work) {
                tomatoTotalCount++;
                db.set('tomatoCount.total', tomatoTotalCount).write();
                $(tomatoTotalCountSpan).html(tomatoTotalCount);

                if (today()) {
                    tomatoTodayCount++;
                    db.set('tomatoCount.today', tomatoTodayCount).write();
                    db.set('tomatoCount.todayUpdateDate', getNowDate()).write();
                    $(tomatoTodayCountSpan).html(tomatoTodayCount);
                }

                $(workTipDiv).html('休息一下吧!');
                $(workTipDiv).fadeIn('slow');
                ipcRenderer.send('end-work');
            } else if (type === rest) {
                $(workTipDiv).html('继续工作吧!');
                $(workTipDiv).fadeIn('slow');
                ipcRenderer.send("end-rest", "休息完成!");
            }

            timer.stop();
        },
        onstop: () => {
            if (workTipTimer) {
                clearInterval(workTipTimer);
                workTipTimer = null;
            }
        }
    });

    view({type: type, start: true});
    view({type: 'second'});
    if (type === work) {
        timer.start(workTime);
    } else if (type === rest) {
        timer.start(restTime);
    }
}

function main() {

    $(openThemeFileBtn).on('click', () => {
        shell.showItemInFolder(path.join(targetThemeDir, theme));
    });

    $(settingBtn).click((event) => {
        $(settingFrame).fadeToggle("fast");
        event.stopPropagation();
    });

    $(settingBtn).mousedown(() => false);

    $(saveBtn).click(() => {
        updateData({
            workHours: parseFloat($(workInput).val()) * 60,
            restHours: parseFloat($(restInput).val()) * 60,
            themePath: $(themeInput).val(),
            runMode: $("input[name='mode']:checked").val()
        });
        $(settingBtn).click();
    });

    $(cancelBtn).click(() => $(settingBtn).click());

    $(workBtn).on("click", () => run(work));

    ipcRenderer.on('pause-work-main', () => {
        if (timer && timer.getStatus() !== 'stopped' && timer.getName() === work) {
            timer.pause();
        }
    });

    ipcRenderer.on('continue-work-main', () => {
        if (timer && timer.getStatus() === 'paused' && timer.getName() === work) {
            timer.continue();
        }
    });

    $(document).on("keydown", (e) => {
        if (isShow(firstFrame)) {
            // 空格
            if (e.keyCode === 32) {
                run(work);
            }
        } else {
            if (timer.getStatus() === 'stopped') {
                if (e.keyCode === 32) {
                    $(taskBtn).click();
                }
            }
        }
        // Ctrl + W
        if (e.ctrlKey && e.keyCode === 87) {
            ipcRenderer.send("hide-app");
        }
    });

    $(restBtn).click(() => run(rest));

    ipcRenderer.on('start-work-main', () => run(work));

    ipcRenderer.on('start-rest-main', () => run(rest));

    $(homeBtn).click(() => {
        if (!isShow(firstFrame)) {
            if (timer.getStatus() !== 'stopped') {
                let reply = ipcRenderer.sendSync('synchronous-message', 'quit-timer');
                if (reply === 'yes') {
                    timer.stop();
                    view({type: 'first'});
                }
            } else {
                view({type: 'first'});
            }
        }
    });

    $(document).on('click', () => {
        $(settingFrame).fadeOut();
        updateViewData();
    });

    $(settingFrame).on('click', (event) => {
        event.stopPropagation();
    });

    $(pauseBtn).click(() => {
        pauseHandle();
    });

    $(taskBtn).click(() => {
        timer.stop();
        if ($(taskBtn).text().trim() === '工作') {
            run(work);
        } else if ($(taskBtn).text().trim() === '休息') {
            run(rest);
        }
    });
}

function pauseHandle() {
    if (timer != null) {
        if (timer.getStatus() === 'paused') {
            timer.continue();
            view({type: 'continue'});
        } else {
            view({type: 'pause'});
            timer.pause();
        }
    }
}

function isShow(selector) {
    return $(selector).css('display') === 'block';
}

function view({type, start, end}) {
    if (type === work || type === rest) {
        if (start) {
            $(taskBtn).hide();
            $(pauseBtn).html('暂停');
            if (type === work) {
                $(timerDiv).html(ReinforceTimer.formatTime(workTime));
                if (mode === 'auto') {
                    $(pauseBtn).hide();
                } else {
                    $(pauseBtn).show();
                }
                $(taskBtn).html("休息");
                $(titleDiv).html("Working");
            } else if (type === rest) {
                $(timerDiv).html(ReinforceTimer.formatTime(restTime));
                $(pauseBtn).hide();
                $(taskBtn).html("工作");
                $(titleDiv).html("Resting");
            }
        } else if (end) {
            $(pauseBtn).hide();
            $(taskBtn).show();
            $(titleDiv).html('');
            if (type === work) {
                $(timerDiv).html('工作完成!');
            } else if (type === rest) {
                $(timerDiv).html("休息完成!");
            }
        }
    } else if (type === 'pause') {
        $(pauseBtn).html("继续");
    } else if (type === 'continue') {
        $(pauseBtn).html("暂停");
    } else if (type === 'first') {
        $(secondFrame).fadeOut();
        $(firstFrame).fadeIn();
    } else if (type === 'second') {
        $(firstFrame).fadeOut();
        $(secondFrame).fadeIn();
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
    tomatoTotalCount = db.get('tomatoCount.total').value();

    tomatoTodayCount = db.get('tomatoCount.today').value();
    if (!today()) {
        tomatoTodayCount = db.set('tomatoCount.today', 0).write();
        tomatoTodayCount = 0;
    }

    updateViewData();
}

/**
 * 判断更新今天番茄数是否是同一天
 */
function today() {
    return getNowDate() ===
        db.read().get('tomatoCount.todayUpdateDate').value();
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
        workHours = Math.floor(workHours);
        db.set('profile.work', workHours).write();
        workTime = workHours;
    }

    if (restHours != null && restHours > 0) {
        restHours = Math.floor(restHours);
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
    $("#theme").attr("href", path.join(targetThemeDir, theme, theme + ".css"));

    $(themeInput).val(theme);
    $(workInput).val(workTime / 60);
    $(restInput).val(restTime / 60);
    $(tomatoTotalCountSpan).html(tomatoTotalCount);
    $(tomatoTodayCountSpan).html(tomatoTodayCount);

    if (mode === 'manual') {
        $(manualModeRadio).attr('checked', 'checked');
    } else if (mode === 'auto') {
        $(autoModeRadio).attr('checked', 'checked');
    }
}