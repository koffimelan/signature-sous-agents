@echo off
rem Lanceur de la plateforme des contrats des sous-agents (double-cliquer sur ce fichier)
chcp 65001 >nul
title Contrats des sous-agents - AFG Bank CI
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable. Installez-le depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installation des dependances du serveur, patientez...
  call npm install
)

if not exist .env (
  echo Creation du fichier de configuration .env avec une cle secrete aleatoire
  node -e "const c=require('crypto'),f=require('fs');f.writeFileSync('.env',f.readFileSync('.env.example','utf8').replace('remplacer_par_une_longue_chaine_aleatoire',c.randomBytes(48).toString('base64url')))"
)

if not exist data\contrats.sqlite (
  echo Creation de la base de demonstration...
  call npm run seed
)

if not exist ..\frontend\dist\index.html (
  echo Preparation de l'interface, patientez...
  pushd ..\frontend
  if not exist node_modules call npm install
  call npm run build
  popd
)

echo.
echo ============================================================
echo   Plateforme des contrats des sous-agents
echo   Adresse : http://localhost:4100
echo   Le navigateur va s'ouvrir dans quelques secondes.
echo   Pour arreter l'application : fermez cette fenetre.
echo ============================================================
echo.

rem Ouvre le navigateur une fois le serveur demarre
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:4100"

call npm start
pause
