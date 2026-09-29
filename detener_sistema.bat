@echo off
title Attendance SaaS - Detener Sistema

cd /d "%~dp0"

echo ================================================================
echo          DETENIENDO SISTEMA DE ASISTENCIA SAAS
echo ================================================================
echo.
echo Deteniendo contenedores de forma segura...
echo (La base de datos y toda la informacion se conservaran intactas)
echo.

docker compose down
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudieron detener correctamente los servicios.
  pause
  exit /b 1
)

echo.
echo ================================================================
echo           EL SISTEMA HA SIDO DETENIDO CON EXITO
echo ================================================================
echo.
pause
exit /b 0
