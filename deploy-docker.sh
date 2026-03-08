#!/bin/bash

echo "================================"
echo "MedCare Docker 部署"
echo "================================"
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "[错误] 未检测到 Docker，请先安装 Docker"
    echo "下载地址: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "[错误] Docker 未运行，请先启动 Docker"
    exit 1
fi

echo "[1/3] 构建镜像..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "[错误] 构建失败"
    exit 1
fi

echo
echo "[2/3] 启动容器..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "[错误] 启动失败"
    exit 1
fi

echo
echo "[3/3] 等待服务就绪..."
sleep 10

echo
echo "================================"
echo "部署完成！"
echo "================================"
echo
echo "访问地址: http://localhost:3000"
echo "默认账户: admin / 123456"
echo
echo "管理命令:"
echo "  查看日志:   docker-compose logs -f"
echo "  停止服务:   docker-compose down"
echo "  重启服务:   docker-compose restart"
echo
