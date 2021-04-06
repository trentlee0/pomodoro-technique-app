## Electron-Tomato
> 番茄时钟， 一个 Windows 桌面小应用。使用 [Electron](https://www.electronjs.org/) 开发。

#### 构建
1. 安装依赖 `npm install`
2. 打包（二选一）
   - [Electron Packager](https://github.com/electron/electron-packager) 打包
        ```
        npm run package
        ```
        输出的目录为，当前项目根目录的 `out` 文件夹下。
   
   - [Electron Builder](https://www.electron.build/) 打包
        ```
        npm run dist
        ```
        输出的目录为，当前项目根目录的 `dist` 文件夹下。
        
#### 注意
如果构建失败，先执行以下命令（使用 Bash 终端运行，如：Windows 上的 [Cygwin](http://www.cygwin.com/)），再构建。命令：

```
wget https://github.com/wilix-team/iohook/releases/download/v0.7.2/iohook-v0.7.2-electron-v85-win32-x64.tar.gz -O iohook-v0.7.2.tar.gz && mkdir -p ./node_modules/iohook/builds/electron-v85-win32-x64/ && tar -zxvf iohook-v0.7.2.tar.gz -C ./node_modules/iohook/builds/electron-v85-win32-x64/ && rm -rf ./iohook-v0.7.2.tar.gz && chmod +x ./node_modules/iohook/builds/electron-v85-win32-x64/build/Release/*iohook*
```
或
```
wget https://github.com/wilix-team/iohook/releases/download/v0.7.2/iohook-v0.7.2-electron-v85-win32-x64.tar.gz -O iohook-v0.7.2.tar.gz
mkdir -p ./node_modules/iohook/builds/electron-v85-win32-x64/
tar -zxvf iohook-v0.7.2.tar.gz -C ./node_modules/iohook/builds/electron-v85-win32-x64/
rm -rf ./iohook-v0.7.2.tar.gz
chmod +x ./node_modules/iohook/builds/electron-v85-win32-x64/build/Release/*iohook*
```

[使用图标来源](https://www.iconfont.cn/collections/detail?spm=a313x.7781069.0.da5a778a4&cid=1997)