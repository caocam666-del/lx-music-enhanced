# v2.13.1 — 修复自动更新

> 发布日期：2026-10-18

v2.13.0 漏掉了自动更新配置：`electron-builder` 只在"发布模式"下才会生成 `resources/app-update.yml`，本地出包时该文件缺失，导致 `electron-updater` 一启动就报 `ENOENT`、检查更新永久失败（表现为"这一版没有自动更新"）。

本版把该配置显式打进安装包，并给 Release 补上 `latest.yml`，自动更新恢复正常。

---

## 🔧 修复

| 项目 | 说明 |
|---|---|
| 自动更新失效 | 打包时显式注入 `resources/app-update.yml`（GitHub provider / owner / repo / 缓存目录），安装版与便携版均生效 |
| 更新源索引缺失 | Release 现在包含 `latest.yml` 与 `.blockmap`，旧版本（如 v2.12.5）启动时即可正确发现新版本 |

## ✅ 如何确认已恢复

1. 安装本版后，等到应用启动约 10 秒，或手动点「关于与更新 → 检查更新」；
2. 若有更新，会弹出下载提示；
3. 日志（`data2/logs/main.log`）里不再出现 `ENOENT ... app-update.yml`。

> 说明：**已经装了 v2.13.0 的用户需要手动重装这一次**（那一版的更新模块自身是坏的，无法自我修复）；装上 v2.13.1 之后自动更新就会一直正常工作。

---

## 📦 下载

| 类型 | 文件 |
|---|---|
| 安装版 | `lx-music-desktop-v2.13.1-x64-Setup.exe` |
| 便携版 | `lx-music-desktop-v2.13.1-x64-portable.exe` |

功能内容与 v2.13.0 一致（歌词灵动岛 + 任务栏歌词增强 + 播放稳定性修复），详见 [v2.13.0 说明](https://github.com/caocam666-del/lx-music-enhanced/releases/tag/v2.13.0)。
