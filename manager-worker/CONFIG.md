# 配置指南

## 概述

本项目使用包含敏感信息的Cloudflare Workers配置文件。实际配置文件（`wrangler.toml` 和 `wrangler-dev.toml`）出于安全考虑已从版本控制中排除。

## 配置步骤

### 1. 复制示例文件

```bash
cd manager-worker
cp wrangler.toml.example wrangler.toml
cp wrangler-dev.toml.example wrangler-dev.toml
```

### 2. 创建KV命名空间

```bash
# 开发环境（创建2个命名空间）
npm run kv:create:dev

# 生产环境（创建2个命名空间）
npm run kv:create:prod
```

### 3. 配置您的设置

编辑配置文件，填入实际值：

#### 必需配置

- **KV命名空间ID**: 将占位符ID替换为步骤2中生成的实际KV命名空间ID
- **USER_CREDENTIALS**: 设置用户凭据，支持数组格式（推荐）或字符串格式（兼容性）
- **EMAIL_API_BASE_URL**: 您的CloudMail部署的基础URL（API路径已硬编码）
- **EMAIL_API_TOKEN**: CloudMail服务的管理员认证令牌

#### 可选配置

- **EMAIL_DOMAINS**: 可用的邮箱域名列表（数组格式）
- **EMAIL_API_BASE_URL**: CloudMail邮箱服务基础URL
- **EMAIL_API_TOKEN**: CloudMail管理员认证令牌

#### 硬编码配置（无需设置）

- **会话过期时间**: 24小时
- **登录速率限制**: 10次/分钟
- **API速率限制**: 100次/分钟
- **Token验证超时**: 30秒
- **邮箱域名**: 从环境变量读取，未配置时使用示例域名

## 架构说明

- **简化的KV结构**: 仅使用2个KV命名空间（TOKENS_KV, SESSIONS_KV）
- **用户管理**: 通过USER_CREDENTIALS管理用户（无需数据库存储）
- **会话存储**: SESSIONS_KV存储会话、OAuth状态和速率限制数据
- **令牌存储**: TOKENS_KV存储令牌记录

## 安全注意事项

- 永远不要提交实际的 `wrangler.toml` 或 `wrangler-dev.toml` 文件
- 为USER_CREDENTIALS使用强密码
- 定期轮换EMAIL_API_TOKEN
- 保持KV命名空间ID私密

## 配置示例

```toml
# 开发环境示例

# 推荐的数组格式（避免密码中包含逗号的问题）
USER_CREDENTIALS = ["admin:dev-password-123", "user:user-pass", "manager:manager-pass"]

# 兼容的字符串格式
# USER_CREDENTIALS = "admin:dev-password-123,user:user-pass"

EMAIL_DOMAINS = ["mail.example.com","temp.example.com"]
EMAIL_API_BASE_URL = "https://your-cloudmail-domain.com"
EMAIL_API_TOKEN = "your-cloudmail-admin-token"

# 生产环境示例
USER_CREDENTIALS = "admin:secure-prod-password-456"
EMAIL_DOMAINS = ["mail.yourdomain.com","inbox.yourdomain.com"]
EMAIL_API_BASE_URL = "https://mail.yourdomain.com"
EMAIL_API_TOKEN = "prod-cloudmail-admin-token"
```

## CloudMail配置说明

- **EMAIL_DOMAINS**: 您的CloudMail支持的邮箱域名列表
- **EMAIL_API_BASE_URL**: 您部署的CloudMail服务的完整域名
- **EMAIL_API_TOKEN**: 在CloudMail管理界面生成的管理员令牌
- **API路径**: 已硬编码为 `/api/allEmail/list`，无需额外配置

## 故障排除

- 如果遇到KV命名空间错误，请确保已创建命名空间并更新了ID
- 如果认证失败，请检查USER_CREDENTIALS格式
- 如果邮箱服务失败，请验证EMAIL_API_TOKEN和EMAIL_API_BASE_URL
