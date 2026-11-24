@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python belum terpasang. Pasang Python 3 lalu jalankan lagi.
  pause
  exit /b 1
)
python start.py
pause
