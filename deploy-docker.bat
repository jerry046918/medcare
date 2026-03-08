@echo off
echo ================================
echo MedCare Docker 部署
echo ================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [错误] Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)

echo [1/3] 构建镜像...
docker-compose build

if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [2/3] 启动容器...
docker-compose up -d

if errorlevel 1 (
    echo [错误] 启动失败
    pause
    exit /b 1
)

echo.
echo [3/3] 等待服务就绪...
timeout /t 10 /nobreak >nul

echo.
echo ================================
echo 部署完成！
echo ================================
echo.
echo 访问地址: http://localhost:3000
echo 默认账户: admin / 123456
echo.
echo 管理命令:
echo   查看日志:   docker-compose logs -f
echo   停止服务:   docker-compose down
echo   重启服务:   docker-compose restart
echo.
pause
