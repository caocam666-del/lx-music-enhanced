@echo off
cd /d "E:\NEWLX\lx-music-desktop-master"
echo 删除旧构建目录的锁定残留文件 (app.asar 被系统占用, 重启电脑后运行本脚本即可清除)...
for %%d in (build build-r15 build-rel build-rel2 build-rel3 build-rel4 build-rel5 build-rel6 build-t build-u build-v build-w build-w3 build-x build-x3 build-x4 build-x5 build-y build-z build-full build-new) do (
  if exist "%%d" rmdir /s /q "%%d"
)
echo 完成。
pause
