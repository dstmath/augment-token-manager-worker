# 部署指南 (Deployment Guide)

本文档提供详细的部署步骤，帮助您将 Augment Token Manager 从 Cloudflare Worker 迁移到自己的服务器。

## 📋 部署前准备

### 1. 服务器要求

- **操作系统**: Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- **内存**: 最低 1GB，推荐 2GB+
- **CPU**: 最低 1 核，推荐 2 核+
- **存储**: 最低 10GB
- **Node.js**: 18.0.0+
- **MySQL**: 8.0+

### 2. 安装必要软件

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 MySQL
sudo apt install -y mysql-server

# 安装 PM2
sudo npm install -g pm2

# 安装 Git
sudo apt install -y git
```

### 3. 配置 MySQL

```bash
# 启动 MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全配置
sudo mysql_secure_installation

# 登录 MySQL
sudo mysql -u root -p

# 创建数据库和用户
CREATE DATABASE augment_info CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'augment_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON augment_info.* TO 'augment_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 🚀 部署步骤

### 步骤 1: 克隆项目

```bash
# 克隆项目到服务器
cd /var/www
sudo git clone https://github.com/your-repo/augment-token-manager-worker.git
cd augment-token-manager-worker/manager-server

# 设置权限
sudo chown -R $USER:$USER /var/www/augment-token-manager-worker
```

### 步骤 2: 安装依赖

```bash
npm install
```

### 步骤 3: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

配置示例：

```env
# 数据库配置
DATABASE_URL="mysql://augment_user:your_secure_password@localhost:3306/augment_info"

# 服务器配置
PORT=3000
NODE_ENV=production

# 会话配置
SESSION_SECRET=your-very-long-random-secret-key-change-this
SESSION_EXPIRY_HOURS=24

# 用户凭据
USER_CREDENTIALS="admin:your_admin_password"

# CORS 配置（前端域名）
CORS_ORIGIN=https://your-frontend-domain.com

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 步骤 4: 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate:prod
```

### 步骤 5: 数据迁移（可选）

如果您有 Cloudflare KV 中的现有数据：

```bash
# 在 .env 中添加 Cloudflare 配置
nano .env
```

添加以下配置：

```env
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_TOKENS_KV_NAMESPACE_ID=your-tokens-kv-namespace-id
CF_SESSIONS_KV_NAMESPACE_ID=your-sessions-kv-namespace-id
CF_API_TOKEN=your-cloudflare-api-token
```

运行迁移：

```bash
npm run db:migrate-from-kv
```

### 步骤 6: 构建项目

```bash
npm run build
```

### 步骤 7: 启动服务

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.cjs --env production

# 保存 PM2 进程列表
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行命令
```

### 步骤 8: 配置 Nginx 反向代理（推荐）

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/augtoken-manager
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    # 日志
    access_log /var/log/nginx/augtoken-manager-access.log;
    error_log /var/log/nginx/augtoken-manager-error.log;

    # 反向代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/augtoken-manager /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 步骤 9: 配置 SSL（推荐）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-api-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 🔧 前端配置更新

### 更新前端 API 地址

编辑 `manager-vue/src/config/api.ts` 或相关配置文件：

```typescript
// 开发环境
const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:3000'
  : 'https://your-api-domain.com';

export default API_BASE_URL;
```

或者在 `manager-vue/.env.production` 中：

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

### 重新构建前端

```bash
cd ../manager-vue
npm run build
```

## 📊 监控和维护

### 查看服务状态

```bash
# PM2 状态
pm2 status

# 查看日志
pm2 logs augtoken-manager-server

# 实时监控
pm2 monit
```

### 数据库备份

```bash
# 创建备份脚本
nano /home/$USER/backup-db.sh
```

脚本内容：

```bash
#!/bin/bash
BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u augment_user -p'your_secure_password' augment_info > $BACKUP_DIR/augment_info_$DATE.sql

# 保留最近 7 天的备份
find $BACKUP_DIR -name "augment_info_*.sql" -mtime +7 -delete
```

设置定时任务：

```bash
chmod +x /home/$USER/backup-db.sh

# 添加到 crontab（每天凌晨 2 点备份）
crontab -e
# 添加：
0 2 * * * /home/$USER/backup-db.sh
```

### 日志管理

```bash
# 创建日志目录
mkdir -p /var/www/augment-token-manager-worker/manager-server/logs

# 配置日志轮转
sudo nano /etc/logrotate.d/augtoken-manager
```

配置内容：

```
/var/www/augment-token-manager-worker/manager-server/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🔄 更新部署

```bash
# 拉取最新代码
cd /var/www/augment-token-manager-worker
git pull

# 更新后端
cd manager-server
npm install
npm run build
npm run prisma:migrate:prod
pm2 restart augtoken-manager-server

# 更新前端
cd ../manager-vue
npm install
npm run build
```

## 🐛 故障排查

### 服务无法启动

```bash
# 查看详细日志
pm2 logs augtoken-manager-server --lines 100

# 检查端口占用
sudo netstat -tulpn | grep 3000

# 检查数据库连接
mysql -u augment_user -p augment_info
```

### 数据库连接失败

```bash
# 检查 MySQL 状态
sudo systemctl status mysql

# 检查用户权限
mysql -u root -p
SHOW GRANTS FOR 'augment_user'@'localhost';
```

### 内存不足

```bash
# 查看内存使用
free -h

# 调整 PM2 实例数量
# 编辑 ecosystem.config.cjs
# 将 instances: 'max' 改为 instances: 1
pm2 restart augtoken-manager-server
```

## 📞 技术支持

如遇到问题，请检查：
1. 日志文件：`pm2 logs`
2. Nginx 日志：`/var/log/nginx/`
3. MySQL 日志：`/var/log/mysql/`
4. 系统日志：`journalctl -xe`

## ✅ 部署检查清单

- [ ] MySQL 数据库已创建并配置
- [ ] 环境变量已正确配置
- [ ] 数据库迁移已完成
- [ ] 服务已启动并运行
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已安装
- [ ] 前端 API 地址已更新
- [ ] 数据备份脚本已设置
- [ ] 日志轮转已配置
- [ ] 防火墙规则已设置
- [ ] PM2 开机自启已配置

恭喜！您已成功将 Augment Token Manager 部署到自己的服务器！🎉

