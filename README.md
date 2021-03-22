## Electron-Tomato
> 番茄时钟， 一个小Demo应用。使用 [Electron](https://www.electronjs.org/) 构建，Electron [官方文档](https://www.electronjs.org/docs)。

#### 构建
1. 安装依赖 `npm install`
2. 打包（二选一）
   1. [Electron Packager](https://github.com/electron/electron-packager) 打包
        ```
        npm run package
        ```
        输出的目录为当前目录的 `out` 文件夹下。
   
   2. [Electron Builder](https://www.electron.build/) 打包
        ```
        npm run dist
        ```
        输出的目录为当前目录的 `dist` 文件夹下。