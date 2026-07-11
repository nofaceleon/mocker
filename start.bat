@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PID_FILE=%CD%\.mocker.pid"

goto :main

:usage
echo Usage: %~nx0 {start [-d]^|stop^|restart [-d]^|status}
echo   start          foreground (default)
echo   start -d       daemon (background)
echo   stop           stop service
echo   restart [-d]   restart
echo   status         check status
goto :eof

:is_running
if not exist "%PID_FILE%" exit /b 1
set /p _ir_pid=<"%PID_FILE%" 2>nul
if not defined _ir_pid exit /b 1
tasklist /fi "PID eq %_ir_pid%" 2>nul | findstr "%_ir_pid%" >nul 2>nul
exit /b %errorlevel%

:main
set "_cmd=%~1"
if "%_cmd%"=="" set "_cmd=start"

if "%_cmd%"=="start" goto :cmd_start
if "%_cmd%"=="stop" goto :cmd_stop
if "%_cmd%"=="restart" goto :cmd_restart
if "%_cmd%"=="status" goto :cmd_status
if "%_cmd%"=="-h" goto :cmd_help
if "%_cmd%"=="--help" goto :cmd_help
if "%_cmd%"=="help" goto :cmd_help

call :usage
exit /b 1

:cmd_start
set "_daemon=false"
shift
:loop_start
if "%1"=="" goto :do_start_now
if "%1"=="-d" set "_daemon=true" & shift & goto :loop_start
if "%1"=="--daemon" set "_daemon=true" & shift & goto :loop_start
if "%1"=="-h" call :usage & exit /b 0
if "%1"=="--help" call :usage & exit /b 0
echo Unknown option: %1
call :usage
exit /b 1

:do_start_now
call :do_start %_daemon%
exit /b %errorlevel%

:do_start
set "_ds_daemon=%~1"

call :is_running
if not errorlevel 1 (
    set /p _ds_pid=<"%PID_FILE%"
    echo Already running [PID: !_ds_pid!]
    exit /b 0
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pnpm not found
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed
        pause
        exit /b 1
    )
)

if exist "%PID_FILE%" del /f "%PID_FILE%"

echo ========================================
echo   MockHub - Mock Service Platform
echo ========================================
echo Starting...
call pnpm dev
exit /b %errorlevel%

:cmd_stop
call :do_stop
exit /b %errorlevel%

:do_stop
call :is_running
if not errorlevel 1 (
    set /p _pid=<"%PID_FILE%"
    echo Stopping [PID: !_pid!]...
    taskkill /pid !_pid! 2>nul
    for /l %%i in (1,1,5) do (
        tasklist /fi "PID eq !_pid!" 2>nul | findstr "!_pid!" >nul 2>nul
        if errorlevel 1 goto :_sd
        timeout /t 1 /nobreak >nul
    )
    :_sd
    tasklist /fi "PID eq !_pid!" 2>nul | findstr "!_pid!" >nul 2>nul
    if not errorlevel 1 (
        echo Force kill...
        taskkill /f /t /pid !_pid! 2>nul
    )
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do taskkill /f /pid %%a 2>nul >nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " 2^>nul') do taskkill /f /pid %%a 2>nul >nul
if exist "%PID_FILE%" del /f "%PID_FILE%"
echo Stopped
goto :eof

:cmd_restart
call :do_stop
call :do_start
exit /b %errorlevel%

:cmd_status
call :do_status
exit /b 0

:do_status
if not exist "%PID_FILE%" (
    echo Not running
    goto :eof
)
set /p _pid=<"%PID_FILE%"
tasklist /fi "PID eq %_pid%" 2>nul | findstr "%_pid%" >nul 2>nul
if errorlevel 1 (
    echo Not running
    if exist "%PID_FILE%" del /f "%PID_FILE%"
) else (
    echo Running [PID: %_pid%]
)
goto :eof

:cmd_help
call :usage
exit /b 0
