@echo off
chcp 65001 >nul
title Atualizador - Controle de Estoque Amazon Aco
color 0B

echo ============================================================
echo      ATUALIZADOR AUTOMATICO - CONTROLE DE ESTOQUE
echo                     AMAZON ACO
echo ============================================================
echo.

set "TARGET_DIR=C:\Antigravity\Controle de Estoque"

if not exist "%TARGET_DIR%" (
    echo [AVISO] Pasta %TARGET_DIR% nao encontrada. Verificando pasta alternativa...
    set "TARGET_DIR=C:\Antigravity\Painel de Controle de Estoque"
)

if not exist "%TARGET_DIR%" (
    echo [ERRO] Nenhuma pasta do projeto foi encontrada em C:\Antigravity!
    echo Verifique o caminho e tente novamente.
    echo.
    pause
    exit /b 1
)

cd /d "%TARGET_DIR%"
echo [*] Diretorio ativo: %TARGET_DIR%
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
    powershell -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('O projeto Controle de Estoque foi sincronizado com sucesso com o GitHub!', 'Amazon Aco - Atualizacao Concluida', 0, 64)" >nul 2>&1
) else (
    echo.
    echo [ERRO] Ocorreu uma falha ao aplicar os arquivos.
    echo.
    pause
    exit /b 1
)

echo Esta janela fechara automaticamente em 5 segundos...
timeout /t 5 >nul
