# Augment Token Manager

一个极简的Token管理系统，采用Vue.js前端和Cloudflare Worker后端，专注于核心Token管理和OAuth授权功能。

## 项目结构

```
augment-token-manager-worker/
├── manager-vue/         # Vue.js 前端应用
├── manager-worker/      # Cloudflare Worker 后端API
```

## 核心功能

- **会话认证**: 简单的基于会话的用户认证
- **Token管理**: 完整的Token记录CRUD操作
- **OAuth授权**: Augment OAuth流程，支持PKCE
- **Token验证**: 实时Token状态检查和刷新
- **邮箱集成**: CloudMail邮箱服务集成（可选）
- **极简配置**: 最少配置项，大部分参数硬编码
- **KV存储**: Cloudflare KV可扩展数据持久化

## 部署

### GitHub Fork部署（推荐）

1. Fork仓库并克隆
2. 使用Cloudflare worker绑定此项目
3. 等待构建完成后绑定KV命名空间
    1. 创建KV命名空间
    2. 绑定KV命名空间到项目 TOKENS_KV 和 SESSIONS_KV
4. 可选环境变量
    1. EMAIL_API_BASE_URL - CloudMail服务URL
    2. EMAIL_API_TOKEN - CloudMail管理员令牌
    3. EMAIL_DOMAINS - 邮箱域名列表
    4. USER_CREDENTIALS - 管理员用户名和密码

### 手动部署

```bash
git clone https://github.com/your-username/augment-token-manager-worker.git
# 可选 重新构建前端
cd augment-token-manager-worker/manager-vue
npm install
npm run build


# 配置Cloudflare Worker
cd ../manager-worker
npm install
# 配置wrangler.toml
# 创建KV命名空间
# 配置wrangler.toml中的KV命名空间ID  - 必须修改
# 配置可选项 - 可选的配置项，通过环境变量设置

# 然后部署
npm run deploy
```

## 配置说明

### 必需配置
- **KV命名空间**: TOKENS_KV + SESSIONS_KV
- **USER_CREDENTIALS**: 用户凭据（格式：admin:password）

### 可选配置
- **EMAIL_DOMAINS**: 邮箱域名列表
- **EMAIL_API_BASE_URL**: CloudMail服务URL
- **EMAIL_API_TOKEN**: CloudMail管理员令牌

## 许可证

MIT License
