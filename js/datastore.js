const fs = require('fs');
const path = require('path');

const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

exports.getDb = function (APP) {
    const userDataPath = APP.getPath("userData");
    if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath);
    }

    let targetThemeDir = path.join(userDataPath, 'theme');
    if (!fs.existsSync(targetThemeDir)) {
        fs.mkdirSync(targetThemeDir);
    }


    const copy = function (dir, outDir, name) {
        let file = path.join(dir, name);
        if (fs.statSync(file).isDirectory()) {
            let outFile = path.join(outDir, name);
            if (name && !fs.existsSync(outFile)) {
                fs.mkdirSync(outFile);
            }
            fs.readdirSync(file).forEach((item) => {
                copy(file, outFile, item);
            });
        } else {
            let outFile = path.join(outDir, name);
            if (!fs.existsSync(outFile)) {
                let pathFormat = path.parse(outFile);
                let newFilePath = path.format(pathFormat);
                fs.writeFileSync(newFilePath, fs.readFileSync(file));
            }
        }
    };

    let sourceThemeDir;
    if (APP.isPackaged) {
        sourceThemeDir = path.join(__dirname.substr(0, __dirname.indexOf("\\js")) + ".unpacked", "css/theme/");
    } else {
        sourceThemeDir = "./css/theme/";
    }

    copy(sourceThemeDir, targetThemeDir, "");

    const confFile = path.join(userDataPath, '/settings.json');
    const adapter = new FileSync(confFile);
    const db = lowdb(adapter);
    let now = new Date();
    let twoNum = function (num) {
        return num < 10 ? "0" + num : "" + num;
    };
    let getNowDate = function () {
        return now.getFullYear() + "-" + twoNum(now.getMonth() + 1) + "-" + twoNum(now.getDate());
    };
    db.defaults({
        profile: {
            work: 2700,
            rest: 300,
            theme: "default",
            mode: "manual",
            showWindowShortcut: "CmdOrCtrl+Shift+T",
            boot: false,
            startWorkNotification: false
        },
        workTips: [
            "明日复明日，明日何其多，我生待明日，万事成蹉跎。——文嘉《明日歌》",
            "盛年不重来，一日难再晨。及时当勉励，岁月不待人。——陶渊明",
            "一个人越知道时间的价值，越倍觉失时的痛苦！——但丁",
            "时间就像海绵里的水，只要愿挤，总还是有的。——鲁迅",
            "在今天和明天之间，有一段很长的时间；趁你还有精神的时候，学习迅速办事。——歌德",
            "光景不待人，须叟发成丝。——李白"
        ],
        startDateTime: getNowDate() + " " + twoNum(now.getHours()) + ":" + twoNum(now.getMinutes()),
        tomatoCount: {
            todayUpdateTime: getNowDate(),
            today: 0,
            week: 0,
            month: 0,
            year: 0,
            total: 0
        }
    }).write();
    return {db: db, confFile: confFile, targetThemeDir: targetThemeDir};
};