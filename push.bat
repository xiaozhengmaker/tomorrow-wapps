@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Push to GitHub

echo.
echo ================================================
echo   tomorrow-wapps  -^> GitHub
echo ================================================
echo.

git add -A
if errorlevel 1 (
  echo [x] git add failed
  pause
  exit /b 1
)

set "MSG=%~1"
if "%MSG%"=="" set /p MSG=Message ^(press Enter for auto^): 
if "%MSG%"=="" set "MSG=update: %DATE% %TIME%"

git commit -m "%MSG%"
if errorlevel 1 echo [i] No new changes, pushing anyway...

echo.
git push
if errorlevel 1 (
  echo.
  echo [x] Push failed. Check network or login first.
  pause
  exit /b 1
)

echo.
echo [ok] https://github.com/xiaozhengmaker/tomorrow-wapps
echo.
pause
