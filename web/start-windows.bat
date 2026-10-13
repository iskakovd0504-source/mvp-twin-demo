@echo off
chcp 65001 >nul
title MVP Twin Demo
cd /d %~dp0
echo === MVP Twin Demo ===
echo Otkrivay http://localhost:8080
echo Ostanovi: Ctrl+C
where python3 >nul 2>nul
if not errorlevel 1 (
  python3 -m http.server 8080
  goto :end
)
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python ne nayden. Ustanovi s python.org ^(galka Add to PATH^).
  pause
  exit /b 1
)
python -m http.server 8080
:end
pause
