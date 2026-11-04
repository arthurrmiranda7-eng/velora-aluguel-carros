@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 20 ou superior em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)
if not exist node_modules\json-server\package.json (
  echo Instalando dependencias. Aguarde...
  call npm ci
  if errorlevel 1 (
    echo Nao foi possivel instalar. Confira a conexao e execute npm install.
    pause
    exit /b 1
  )
)
echo Abra http://localhost:3000 no navegador.
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
call npm start
pause
