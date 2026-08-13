@echo off
setlocal EnableExtensions

rem One-click launcher for the fictional, read-only public demo.
rem It does not read or write the learner's private state.json.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

echo Building and opening the fictional read-only demo...
node scripts\serve-public-demo.mjs
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo The public demo exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
