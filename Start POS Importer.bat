@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
if not errorlevel 1 (
  echo The local POS connector is already running. Opening the importer...
  echo Keep the connector Command Prompt window open while using POS.
  echo Click "Read stock from QuickBooks POS" in the importer when ready.
  start "" "http://127.0.0.1:8765/"
  exit /b 0
)

echo Starting the local POS connector...
start "Daychounieh Tools POS Connector" /D "%~dp0" cmd /k "echo QuickBooks POS must be open and logged in. & echo Keep this window open while using the importer; closing it stops the local connection. & echo In the browser, click Read stock from QuickBooks POS, review the counts, then click Update local catalog with POS stock. & echo Only confirm if the removal counts look right. This updates a local catalog only; it does not publish online. & echo. & py -3-32 inventory-sync\pos_importer.py"

powershell -NoProfile -Command "$deadline = (Get-Date).AddSeconds(30); do { $client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 8765); $client.Dispose(); exit 0 } catch { $client.Dispose(); Start-Sleep -Milliseconds 500 } } while ((Get-Date) -lt $deadline); exit 1" >nul 2>&1
if errorlevel 1 (
  echo The connector did not start. Check the connector window for an error.
  pause
  exit /b 1
)

echo Connector is ready. Opening the importer...
start "" "http://127.0.0.1:8765/"
