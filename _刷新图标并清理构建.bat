@echo off
echo ============================================
echo  LX Music 增强版 - 图标缓存清理 + 旧构建清理
echo ============================================
echo.
echo 1. 删除旧构建目录的锁定残留文件...
cd /d "E:NEWLXlx-music-desktop-master"
for %%d in (build-a2 build-b4 build-c2 build-d1 build-e1 build-e2 build-r15 build-r16 build-rel build-rel2 build-rel3 build-rel4 build-rel5 build-rel6 build-rel12 build-rel13 build-rel14 build-rel15 build-rel16 build-rel17 build-rel18 build-rel19 build-t build-u build-v build-w build-w3 build-x build-x3 build-x4 build-x5 build-y build-y3 build-y4 build-y5 build-y6 build-z build-z3 build-full build-new) do (
  if exist "%%d" rmdir /s /q "%%d"
)
echo 2. 停止 LX Music 进程...
taskkill /f /im lx-music-desktop.exe >nul 2>&1
echo 3. 清理 Windows 图标缓存 (解决任务栏图标不更新)...
ie4uinit.exe -show
taskkill /f /im explorer.exe >nul 2>&1
del /a /q "%localappdata%IconCache.db" >nul 2>&1
del /a /f /q "%localappdata%MicrosoftWindowsExplorericoncache*" >nul 2>&1
start explorer.exe
echo.
echo 完成! 任务栏/桌面图标将显示新设计。
pause
