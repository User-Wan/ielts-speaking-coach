# 02｜现阶段稳定的产品合同

以下规则可以作为技术开发的稳定输入：

1. 一个用户可以拥有多门课程。
2. 一门课程可以产生多次训练会话。
3. 一次训练会话包含多轮用户与 AI 对话。
4. 训练步骤数量暂时不固定。
5. 用户必须能够随时保存、退出和恢复。
6. 录音、转写、AI 回复和训练进度需要持久保存。
7. 课程至少支持 `not_started`、`in_progress`、`completed` 状态。
8. 训练会话至少支持 `active`、`paused`、`completed`、`failed` 状态。
9. 前端只能通过后端调用需要密钥的第三方服务。
10. 产品主页可以公开访问；个人课程和训练会话必须进行服务端身份验证。

## 陪练房暂定运行状态

这些状态用于技术占位，不代表最终产品流程已经定稿：

```text
listening
waiting_user
recording
transcribing
evaluating
coaching
paused
completed
error
```

状态名称可以在接口层保留，具体跳转条件由后续的流程配置决定。

