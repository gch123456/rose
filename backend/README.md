# 转转积木相册服务

Java 21、Spring Boot 4.1.2、Maven 3.6.3+。独立服务，只保存已解锁模型与账号会话；游客存档由客户端维护。

## 本机运行

```sh
cd backend
# 只在当前终端设置已安装的 JDK 21 路径。
export JAVA_HOME=/your/jdk-21/Contents/Home
export WECHAT_APP_ID='your-mini-game-app-id'
export WECHAT_APP_SECRET='your-server-only-app-secret'
mvn test
mvn spring-boot:run
# 或 mvn package，再 java -jar target/album-backend-0.1.0.jar
```

默认仅监听 `127.0.0.1:8080`。`GET /api/health` 不需要微信配置；缺少配置时真实登录返回 503，没有模拟身份入口。测试仅在测试环境替换微信网关。

可配置：`PORT`、`ROSE_BIND_ADDRESS`、`ROSE_DATABASE_URL`、`ROSE_DATABASE_USER`、`ROSE_DATABASE_PASSWORD`、`ROSE_SESSION_TTL_SECONDS`（默认 604800，即 7 天，允许 1–2592000 秒）。默认 H2 文件库 `jdbc:h2:file:./data/album;DB_CLOSE_ON_EXIT=FALSE` 相对服务启动目录；请始终从 backend 启动，备份 data 目录。测试使用内存库及独立临时文件库。数据库与 `.env` 均不入库。

## 协议

请求/响应均为 JSON，时间为服务器 UTC ISO 8601 字符串。

| 方法 | 地址 | 请求 | 响应 |
|---|---|---|---|
| POST | `/api/auth/wechat` | `{"code":"wx.login 返回的一次性 code"}` | `{"token":"随机凭据","expiresAt":"…Z","user":{"id":"不透明 UUID"}}` |
| GET | `/api/album` | — | `{"version":1,"entries":[{"levelId":1,"unlockedAt":"…Z"}]}` |
| POST | `/api/album/complete` | `{"levelId":1}` | 同上；重复完成不改首次时间 |
| POST | `/api/album/merge` | `{"levelIds":[1,2]}` | 同上；集合并集，不覆盖已有时间 |
| POST | `/api/auth/logout` | — | 204，撤销当前会话 |
| GET | `/api/health` | — | `{"status":"ok"}` |

相册和注销必须携带 `Authorization: Bearer <token>`。不接受客户端指定账号，数据按会话身份隔离；只接受整数关卡 ID 1–10，非法合并整体失败，空数组合法。返回相册按 levelId 排序。登录成功后客户端提交游客 ID 并集；合并只使用服务器时间，游客时间不上传。

错误仅包含 `{"error":"错误码"}`：400 `invalid_request`；401 `unauthorized` / `wechat_login_failed`；503 `wechat_unavailable`。未配置微信、网络超时、上游不可用均不创建登录会话。请勿把请求头、登录 code、微信响应和服务端环境变量写入应用日志。

## 数据与安全边界

`album_users(id, wechat_openid)` 将微信 openid 映射为客户端可见 UUID；openid 唯一。`sessions(token_hash,user_id,expires_at)` 只保存 256 位随机 bearer 的 SHA-256 摘要，会话绝对过期、注销删除；`album_entries(user_id,level_id,unlocked_at)` 以账号/关卡作复合主键，数据库检查 ID 范围。相册更新锁定对应账号，在事务内完成，因此并发重复完成与合并不会覆盖首次时间。

真实微信代码只调用固定官方 HTTPS 地址 `https://api.weixin.qq.com/sns/jscode2session`，参数 appid/secret/js_code/grant_type=authorization_code；服务端只使用 openid，不持久化或返回 session_key。浏览器试玩无法生成真实微信小游戏 `wx.login` code，应继续游客模式；没有浏览器假登录接口。

当前交付没有公开部署、HTTPS 域名或真实微信凭据，未做微信真机验证。部署需要微信后台配置合法请求域名、HTTPS 反向代理和持久化磁盘，并在入口配置请求体大小与登录频率限制、适当访问控制和备份。H2 为单实例原型存储，无跨进程多副本协调；不声称完成生产容量或安全审计。客户端提交完成只是收藏解锁，不提供竞技防作弊证明。过期会话在后续登录时清理，不提供刷新令牌。数据删除与账号管理界面尚未实现。

## 核对资料

- [Spring Boot 4.1.2 系统要求](https://docs.spring.io/spring-boot/system-requirements.html)：Java 17–27、Maven 3.6.3+；本服务使用 Java 21。
- [微信小游戏登录](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/login.html)
- [微信 code2Session](https://developers.weixin.qq.com/minigame/dev/api-backend/open-api/login/auth.code2Session.html)；此次环境访问文档页返回 404；协议另外核对了[腾讯官方 Wafer2 SDK 的固定版本源码](https://github.com/tencentyun/wafer2-node-sdk/blob/57ae82782b8e96d681753ff96a30243f03d9878d/lib/auth/index.js#L169-L188)，包含请求参数及 openid/session_key/errcode 字段。真实有效 code 兑换仍需账号配置与真机验证。

## 本次验证（2026-11-16）

`mvn package`：12 项测试通过，0 失败/错误/跳过；生成可执行 jar。包括登录与摘要存储、未登录/过期/注销、账号隔离、合并/重复完成/非法 ID 整体拒绝、网关异常与敏感字段边界、H2 文件重开保留数据以及 12 次并发合并。测试依赖初始化会提示 Java 动态测试代理警告，不影响结果，正式服务不需要测试代理。

实际运行打包 jar、使用内存数据库及明确空微信配置后，HTTP 验证健康检查 200、未登录相册 401、登录未配置 503、空 code 400；服务随后停止。没有使用真实微信 code、访问真实用户账号或公开部署。
