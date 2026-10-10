@echo off
chcp 65001 >nul
title Twin MVP 3D
cd /d %~dp0
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python ne nayden. Ustanovi s python.org ^(galka Add to PATH^).
  pause
  exit /b 1
)
echo === Twin MVP 3D ===
echo Otkrivay http://localhost:8080  ^(HQ: http://localhost:8080/?hq=1^)
echo Ostanovi: Ctrl+C
python -m http.server 8080
pause
