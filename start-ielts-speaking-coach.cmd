@echo off
setlocal EnableExtensions

rem One-click Windows launcher for IELTS Speaking Coach.
rem The runtime directory is kept outside Git through .gitignore.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required but was not found on PATH.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Dependencies are not installed. Installing them now...
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed. Please run npm install manually to see the full error.
    pause
    exit /b 1
  )
)

if not exist ".runtime\electron-user-data" mkdir ".runtime\electron-user-data"
set "ELECTRON_ENABLE_LOGGING=1"
echo Starting IELTS Speaking Coach...
call node_modules\.bin\electron.cmd --disable-gpu --user-data-dir="%CD%\.runtime\electron-user-data" desktop\main.mjs
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo IELTS Speaking Coach exited with code %EXIT_CODE%.
  echo If the window did not open, keep this console visible and share the error output when asking for help.
  pause
)
exit /b %EXIT_CODE%
