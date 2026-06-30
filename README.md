# Notion Task Helper

一个本地运行的 Next.js 辅助工具，用来发布任务、分解步骤、指定负责人，并预留 Notion API 同步层。

## 当前框架

- `src/app/page.tsx`: 中文任务工作台，默认面向视频项目，包含发布表单和步骤追踪。
- `src/app/actions.ts`: 表单提交、状态更新、步骤完成切换。
- `src/app/api/tasks/route.ts`: 本地 API，支持 `GET /api/tasks` 和 `POST /api/tasks`。
- `src/app/api/assignees/route.ts`: 从 Notion workspace users 同步真实负责人。
- `src/lib/local-store.ts`: MongoDB 数据存储适配器，保留原文件名以兼容页面层 import。
- `src/lib/notion.ts`: Notion SDK 适配器，使用 lazy init，未配置时自动走本地模式。
- `src/lib/assignees.ts`: 默认负责人列表。
- `src/lib/task-templates.ts`: 视频制作流程模板。

## 视频任务模型

一个视频任务是一个大任务，包含系列、周次、目标发布日期、发布平台和多个阶段化子任务。默认模板：

- 文案生成
- 按照文案分段进行音频录制/AI语音生成
- 按照文案分段进行素材收集
- 视频剪辑
- 平台发布 + 追踪

每个子任务可单独设置负责人和状态：待开始、进行中、阻塞、完成。发布到 Notion 时，会创建：

- 1 条大任务 Task row。
- 5 条子任务 Task rows。

子任务不会再写成大任务页面里的 todolist。当前 Notion database 没有父子关系字段，所以子任务会在页面正文里记录“归属大任务”。如果你在 Notion 里增加 Relation 字段，后续可以改成真正的父子关联。

文案确认自动化：

- 在 Notion 的“文案生成”子任务上把 `Status` 改成 `Done`。
- Notion webhook 请求 `POST /api/notion/webhook`。
- App 读取该 Notion 页面正文里 `>>> 文案开始` 和 `>>> 文案结束` 之间的文案。
- App 自动拆分文案，并更新已有的“音频录制/AI语音生成”和“素材收集”两个子任务页面。
- 团队成员进入每个音频 Segment 子任务，在页面上传区输入 `/upload` 或直接拖入音频文件。
- MongoDB 只保存任务、分段、Notion page id、幂等 hash，不保存音频文件。

删除大任务时：

- 如果任务只存在 MongoDB，会直接从 MongoDB 删除。
- 如果任务已发布到 Notion，会先把 Notion 页面移到回收站，再删除本地任务。
- 如果远程 Notion 删除失败，本地任务会保留，避免两端状态不一致。

更新大任务状态时：

- 如果任务已发布到 Notion，会先更新 Notion 的 `Status` 字段，再更新本地状态。
- 如果远程 Notion 更新失败，本地状态会保留。
- 子任务状态/负责人更新时，如果子任务已发布为 Notion Task row，也会同步更新对应 Notion row。

## 运行

```bash
npm run dev
```

打开 `http://localhost:3000`。

## Notion 配置

复制 `.env.example` 为 `.env.local`，填入：

```bash
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MONGODB_URI=mongodb://127.0.0.1:27017/notion-task-helper
MONGODB_DB=notion_task_helper
MONGODB_SEED_DEMO_TASKS=false
WEBHOOK_ADMIN_SECRET=生成一个长随机字符串
DEFAULT_ASSIGNEE_ID=owner
NOTION_GUEST_USER_IDS=
```

默认会写入这些 Notion database 字段：

- `Name`: title
- `Status`: status
- `Assigned`: people
- `Priority`: select
- `Due Date`: date
- `Steps`: rich text
- `Local Task ID`: rich text

字段名可在 `.env.local` 里用 `NOTION_*_PROPERTY` 调整。

文案自动化相关字段：

- `NOTION_STATUS_PROPERTY`: 默认 `Status`
- `NOTION_SCRIPT_APPROVED_STATUS`: 默认 `Done`

文案生成页正文需要使用这个格式：

```txt
>>> 文案开始

这里写完整文案。

>>> 文案结束
```

部署到 Vercel 后，把 Notion webhook endpoint 配成：

```bash
https://你的域名/api/notion/webhook
```

Notion 验证订阅时，验证令牌会写入 MongoDB。读取最近一次验证令牌需要管理密钥：

```bash
https://你的域名/api/notion/webhook?secret=WEBHOOK_ADMIN_SECRET的值
```

不要把带 `secret` 的 URL 分享给其他人。

负责人下拉框会合并三个来源：

- Notion `users.list` 返回的 workspace members。
- 已有 database 页面里 `Assigned` people 字段出现过的人。
- `.env.local` 里 `NOTION_GUEST_USER_IDS` 手动配置的 guest user ids。

Notion 的 `users.list` 不会列出 guests。要支持 guests，需要先把 `NOTION_DATABASE_ID` 指向任务 database，并确保已有页面的 `Assigned` 字段出现过这些 guests；或者把已知 guest user ids 填到 `NOTION_GUEST_USER_IDS`，用英文逗号分隔。

## 本地 API 示例

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "video",
    "title": "每周塔罗牌新手挑战题视频",
    "summary": "完成本周视频从文案到发布追踪的完整流程。",
    "contentSeries": "塔罗牌新手挑战题",
    "weekLabel": "2026-W27",
    "platforms": ["小红书", "抖音"],
    "priority": "high",
    "assigneeId": "owner"
  }'
```

删除任务：

```bash
curl -X DELETE "http://localhost:3000/api/tasks?id=本地任务ID"
```

更新大任务状态：

```bash
curl -X PATCH http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"本地任务ID","status":"done"}'
```

更新子任务：

```bash
curl -X PATCH http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"id":"本地任务ID","stepId":"本地子任务ID","status":"done","assigneeId":"负责人ID"}'
```
