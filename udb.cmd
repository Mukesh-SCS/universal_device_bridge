@echo off
setlocal

REM Resolve project root (directory of this file)
set ROOT=%~dp0

REM Run the CLI via node
node "%ROOT%cli\src\udb.js" %*

endlocal
