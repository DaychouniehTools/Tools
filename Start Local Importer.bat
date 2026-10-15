@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0admin-import.html" (
  echo Cannot find admin-import.html beside this launcher.
  echo Restore the local-only importer to the project folder, then try again.
  pause
  exit /b 1
)

powershell -NoProfile -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
if not errorlevel 1 (
  echo The local importer server is already running. Opening the importer...
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

echo Starting the local importer server...
start "Daychounieh Tools Local Importer" /D "%~dp0" cmd /k "py -3 inventory-sync\pos_importer.py"

powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(30); do { $client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); $client.Dispose(); exit 0 } catch { $client.Dispose(); Start-Sleep -Milliseconds 500 } } while ((Get-Date) -lt $deadline); exit 1" >nul 2>&1
if errorlevel 1 (
  echo The local importer server did not start. Check its Command Prompt window for an error.
  pause
  exit /b 1
)

echo Local importer is ready. Opening it in your browser...
start "" "http://127.0.0.1:8765/"
