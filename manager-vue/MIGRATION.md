# 前端迁移指南 (Frontend Migration Guide)

本文档说明如何将前端从 Cloudflare Worker 迁移到自托管服务器。

## 📋 需要修改的内容

### 1. 更新 API 基础 URL

前端需要指向新的后端服务器地址，而不是 Cloudflare Worker。

#### 方法 A: 使用环境变量（推荐）

创建 `.env.production` 文件：

```bash
cd manager-vue
cp .env.example .env.production
```

编辑 `.env.production`：

```env
# 生产环境 API 地址
VITE_API_BASE_URL=https://your-api-domain.com
```

创建 `.env.development` 文件（开发环境）：

```env
# 开发环境 API 地址
VITE_API_BASE_URL=http://localhost:3000
```

#### 方法 B: 直接修改配置文件

编辑 `src/config/api.ts`：

```typescript
export const API_BASE_URL = 'https://your-api-domain.com';
```

### 2. 更新 API 调用

如果您的代码中有硬编码的 API 路径，需要更新为使用 `API_BASE_URL`。

#### 修改前（直接使用相对路径）：

```typescript
const response = await fetch('/api/tokens');
```

#### 修改后（使用配置的 API_BASE_URL）：

```typescript
import API_BASE_URL from '@/config/api';

const response = await fetch(`${API_BASE_URL}/api/tokens`);
```

### 3. 更新 `src/utils/api.ts`

如果您使用了 API 工具函数，需要更新它们以使用新的基础 URL：

```typescript
import API_BASE_URL from '@/config/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

export async function apiGet(url: string): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  return fetch(fullUrl, {
    method: 'GET',
    headers: getAuthHeaders()
  });
}

export async function apiPost(url: string, data?: any): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  return fetch(fullUrl, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined
  });
}

export async function apiPut(url: string, data?: any): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  return fetch(fullUrl, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined
  });
}

export async function apiDelete(url: string): Promise<Response> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  return fetch(fullUrl, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
}
```

## 🔧 CORS 配置

确保后端服务器的 CORS 配置允许前端域名访问。

在后端 `manager-server/.env` 中设置：

```env
# 允许的前端域名
CORS_ORIGIN=https://your-frontend-domain.com
```

如果需要允许多个域名，可以修改 `manager-server/src/middleware/cors.ts`：

```typescript
export const corsOptions = {
  origin: [
    'https://your-frontend-domain.com',
    'https://www.your-frontend-domain.com',
    'http://localhost:5173', // 开发环境
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

## 🚀 构建和部署

### 开发环境测试

```bash
# 启动后端（在 manager-server 目录）
cd manager-server
npm run dev

# 启动前端（在 manager-vue 目录）
cd manager-vue
npm run dev
```

访问 `http://localhost:5173` 测试功能。

### 生产环境构建

```bash
cd manager-vue

# 安装依赖
npm install

# 构建生产版本
npm run build
```

构建完成后，`dist` 目录包含所有静态文件。

### 部署选项

#### 选项 1: Nginx 静态托管

将 `dist` 目录内容复制到 Nginx 服务器：

```bash
# 复制文件到 Nginx 目录
sudo cp -r dist/* /var/www/html/

# 或者创建专门的目录
sudo mkdir -p /var/www/augtoken-manager
sudo cp -r dist/* /var/www/augtoken-manager/
```

Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    root /var/www/augtoken-manager;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 选项 2: 与后端同服务器部署

如果前后端部署在同一服务器，可以让后端服务静态文件：

1. 将前端构建文件复制到后端：

```bash
cp -r manager-vue/dist manager-server/public
```

2. 修改后端 `manager-server/src/index.ts`，添加静态文件服务：

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// SPA 路由支持（放在所有 API 路由之后）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
```

#### 选项 3: CDN 部署

将 `dist` 目录上传到 CDN（如 Cloudflare Pages、Vercel、Netlify）。

## ✅ 迁移检查清单

- [ ] 创建 API 配置文件 `src/config/api.ts`
- [ ] 创建环境变量文件 `.env.production`
- [ ] 更新所有 API 调用使用新的基础 URL
- [ ] 更新 `src/utils/api.ts` 工具函数
- [ ] 配置后端 CORS 允许前端域名
- [ ] 本地测试前后端连接
- [ ] 构建生产版本
- [ ] 部署前端静态文件
- [ ] 配置 Nginx（如果使用）
- [ ] 测试生产环境功能
- [ ] 配置 SSL 证书

## 🐛 常见问题

### 1. CORS 错误

**错误信息**: `Access to fetch at 'https://api.example.com' from origin 'https://frontend.example.com' has been blocked by CORS policy`

**解决方案**: 
- 检查后端 `.env` 中的 `CORS_ORIGIN` 配置
- 确保包含前端的完整域名（包括协议）
- 重启后端服务

### 2. API 请求 404

**错误信息**: `GET https://api.example.com/api/tokens 404 (Not Found)`

**解决方案**:
- 检查 API_BASE_URL 配置是否正确
- 确认后端服务正在运行
- 检查 Nginx 反向代理配置

### 3. 认证失败

**错误信息**: `401 Unauthorized`

**解决方案**:
- 清除浏览器 localStorage
- 重新登录
- 检查 session token 是否正确传递

### 4. 静态资源加载失败

**错误信息**: `Failed to load resource: net::ERR_FILE_NOT_FOUND`

**解决方案**:
- 检查 `vite.config.ts` 中的 `base` 配置
- 确保 Nginx 配置正确
- 检查文件路径大小写

## 📞 技术支持

如遇到问题，请检查：
1. 浏览器控制台错误信息
2. 网络请求详情（Network 标签）
3. 后端日志：`pm2 logs`
4. Nginx 日志：`/var/log/nginx/`

## 🎉 完成

恭喜！您已成功将前端迁移到新的后端服务器！

