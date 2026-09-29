@echo off
setlocal
title Attendance SaaS - Inicio
cd /d "%~dp0"
echo ================================================================
echo       ATTENDANCE SAAS - PIN Y LUEGO FACE ID
echo ================================================================
echo.
if not exist ".env" (
  echo [ERROR] Falta .env. Copia .env.example y configura credenciales.
  goto :error
)
findstr /B /I /C:"ENVIRONMENT=development" .env >nul
if errorlevel 1 (
  echo [ERROR] Configura ENVIRONMENT=development para usar este script.
  goto :error
)
findstr /B /I /C:"ENABLE_BIOMETRICS=true" .env >nul
if errorlevel 1 (
  echo [ERROR] Configura ENABLE_BIOMETRICS=true para habilitar Face ID.
  goto :error
)
echo [1/6] Verificando Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker no esta activo. Inicia Docker Desktop.
  goto :error
)
echo [2/6] Construyendo backend con modelos de Face ID...
docker compose build backend
if errorlevel 1 goto :error
echo [3/6] Iniciando MySQL y Redis...
docker compose up -d mysql redis
if errorlevel 1 goto :error
echo [4/6] Esperando MySQL y Redis saludables...
set /a attempts=0
:wait_dependencies
set /a attempts+=1
docker compose ps --format "{{.Service}} {{.Health}}" | findstr /I /C:"mysql healthy" >nul
if errorlevel 1 goto :wait_more
docker compose ps --format "{{.Service}} {{.Health}}" | findstr /I /C:"redis healthy" >nul
if errorlevel 1 goto :wait_more
goto :migrate
:wait_more
if %attempts% GEQ 30 (
  echo [ERROR] MySQL o Redis no alcanzaron estado saludable.
  docker compose ps
  goto :error
)
timeout /t 3 /nobreak >nul
goto :wait_dependencies
:migrate
echo Aplicando migraciones antes de iniciar la aplicacion...
docker compose run --rm --no-deps backend alembic upgrade head
if errorlevel 1 goto :error
echo [5/6] Construyendo e iniciando la aplicacion...
docker compose up -d --build
if errorlevel 1 goto :error
echo Esperando el backend...
set /a attempts=0
:wait_backend
set /a attempts+=1
docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)" >nul 2>&1
if not errorlevel 1 goto :ready
if %attempts% GEQ 30 (
  echo [ERROR] El backend no respondio a /health.
  docker compose ps
  goto :error
)
timeout /t 3 /nobreak >nul
goto :wait_backend
:ready
echo [6/6] Inicializando empresa y administrador si la base esta vacia...
docker compose exec -T backend python -m app.seed_if_empty
if errorlevel 1 goto :error
echo.
echo Sistema disponible en http://localhost:5175
echo Flujo: PIN -^> enrolamiento inicial o Face ID -^> panel de marcacion.
echo Crea los empleados desde el panel; cada empleado enrola Face ID en su primer acceso.
echo Para detenerlo, ejecuta detener_sistema.bat.
echo.
start "" "http://localhost:5175"
pause
exit /b 0
:error
echo.
echo El sistema no se completo. Revisa el mensaje anterior y la configuracion.
pause
exit /b 1
