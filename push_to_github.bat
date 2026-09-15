@echo off
chcp 65001 >nul
title Push LingoGoc AI len GitHub
color 0B

echo =====================================================================
echo           🚀 PUSH CODE LINGOGOC AI LÊN GITHUB
echo =====================================================================
echo.
echo Đang kết nối tới kho GitHub: https://github.com/Quyenlaaaa/lingogoc-app.git
echo.

cd /d "%~dp0"

git remote remove origin 2>nul
git remote add origin https://github.com/Quyenlaaaa/lingogoc-app.git
git branch -M main
git push -u origin main

echo.
echo =====================================================================
echo Đã push code thành công! 
echo GitHub Actions sẽ tự động build và deploy lên GitHub Pages.
echo =====================================================================
pause
