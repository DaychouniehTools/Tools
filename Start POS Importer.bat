@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
if not errorlevel 1 (
  echo The local POS connector is already running. Opening the importer...
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

echo Starting the local POS connector...
start "Daychounieh Tools POS Connector" /D "%~dp0" cmd /k py -3-32 inventory-sync\pos_importer.py

powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(30); do { $client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); $client.Dispose(); exit 0 } catch { $client.Dispose(); Start-Sleep -Milliseconds 500 } } while ((Get-Date) -lt $deadline); exit 1" >nul 2>&1
if errorlevel 1 (
  echo The connector did not start. Check the connector window for an error.
  pause
  exit /b 1
)

echo Connector is ready. Opening the importer...
start "" "http://127.0.0.1:8765/"
