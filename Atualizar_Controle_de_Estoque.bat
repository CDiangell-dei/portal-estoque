@echo off
chcp 65001 >nul
title Atualizador - Controle de Estoque Amazon Aco
color 0B

echo ============================================================
echo      ATUALIZADOR AUTOMATICO - CONTROLE DE ESTOQUE
echo                     AMAZON ACO
echo ============================================================
echo.

set "REPO_URL=https://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@github.com/CDiangell-dei/portal-estoque.git"
set "DEFAULT_DIR=C:\Antigravity\Controle de Estoque"

:: 1. Se o script estiver sendo executado dentro de uma pasta que ja eh um repositorio Git do projeto, usa ela mesma
if exist "%~dp0.git" (
    set "TARGET_DIR=%~dp0"
) else (
    set "TARGET_DIR=%DEFAULT_DIR%"
)

:: Remove barra final se houver
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

:: 2. Se a pasta padrao nao existir ou nao tiver o repositorio, cria e clona direto do GitHub
if not exist "%TARGET_DIR%\.git" (
    echo [*] Repositorio nao encontrado em "%TARGET_DIR%".
    echo [*] Criando pasta e baixando o projeto completo diretamente do GitHub...
    echo.
    if not exist "C:\Antigravity" mkdir "C:\Antigravity"
    git clone "%REPO_URL%" "%TARGET_DIR%"
    if %errorlevel% neq 0 (
        echo.
        echo [ERRO] Falha ao baixar projeto do GitHub.
        echo Verifique se o computador esta conectado a internet.
        echo.
        pause
        exit /b 1
    )
)

cd /d "%TARGET_DIR%"
echo [*] Pasta de destino: %TARGET_DIR%
echo.

echo [1/3] Conectando ao GitHub para verificar novidades...
git fetch origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao conectar com o GitHub.
    echo Verifique se o computador esta conectado a internet.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Baixando e substituindo arquivos com a versao mais recente...
git reset --hard origin/main
git pull origin main --force

if %errorlevel% equ 0 (
    echo.
    echo [3/3] Sincronizacao finalizada com exito!
    echo ============================================================
    echo  ULTIMO COMMIT APLICADO:
    git log -n 1 --pretty=format:"  Data: %%ad%%n  Autor: %%an%%n  Mensagem: %%s" --date=format:"%%d/%%m/%%Y %%H:%%M:%%S"
    echo.
    echo ============================================================
    echo.
    echo [OK] Todos os arquivos estao 100%% atualizados e sincronizados!
    echo.
    powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('O projeto Controle de Estoque foi sincronizado com sucesso com a versao mais recente do GitHub!', 'Amazon Aco - Atualizacao Concluida', 0, 64)" >nul 2>&1
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao aplicar os arquivos.
    echo.
    pause
    exit /b 1
)

echo Esta janela fechara automaticamente em 5 segundos...
timeout /t 5 >nul
