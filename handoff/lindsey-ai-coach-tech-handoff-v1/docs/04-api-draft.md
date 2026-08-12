# 04｜API 接口草案

## 第一批接口

```text
GET    /api/me
GET    /api/courses
GET    /api/courses/{courseId}
POST   /api/sessions
GET    /api/sessions/{sessionId}
PATCH  /api/sessions/{sessionId}/progress
POST   /api/sessions/{sessionId}/turns
POST   /api/sessions/{sessionId}/pause
POST   /api/sessions/{sessionId}/complete
```

## AI 服务适配层

后端内部建议先统一为：

```text
transcribeAudio(audio)
generateCoachReply(context)
synthesizeSpeech(text)
```

第一阶段允许 `generateCoachReply` 返回模拟数据，但 API 返回结构应保持稳定。

## 提交一轮回答

请求：

```json
{
  "inputType": "text",
  "text": "Big cities offer more job opportunities.",
  "stepKey": "placeholder",
  "clientRequestId": "request_001"
}
```

响应：

```json
{
  "turnId": "turn_001",
  "transcript": "Big cities offer more job opportunities.",
  "coachReply": "很好，我们继续下一步。",
  "feedback": {},
  "nextStepKey": "placeholder-next",
  "sessionStatus": "active"
}
```

## 接口要求

- 所有写接口必须验证当前用户对课程和会话的所有权。
- `clientRequestId` 用于防止重复提交。
- 后端不得相信前端传入的 `userId`。
- 接口错误应返回稳定的错误码和用户可理解的信息。
- 音频上传建议使用预签名上传或独立上传接口，不要把大型音频直接塞进 JSON。

