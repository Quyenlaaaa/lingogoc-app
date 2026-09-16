@echo off
chcp 65001 >nul
title LingoGoc AI - Hoc Tieng Anh Cho Nguoi Mat Goc
color 0B

echo =====================================================================
echo           [+] LINGOGOC AI - HOC TIENG ANH CHO NGUOI MAT GOC
echo =====================================================================
echo [*] Dang khoi dong may chu ung dung...
echo [*] Trinh duyet web se tu dong mo tai: http://localhost:5173
echo [*] Hay giu cua so nay mo trong suot qua trinh hoc tap.
echo.
echo     (Nhan Ctrl + C hoac dong cua so khi muon dung chuong trinh)
echo =====================================================================
echo.

cd /d "%~dp0"

:: Tu dong mo trinh duyet web
start "" "http://localhost:5173/"

:: Khoi chay dev server
npm run dev

pause