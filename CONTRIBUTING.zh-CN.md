# 参与贡献

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

欢迎提交 Issue 和 Pull Request。

1. 从 `main` 创建分支。
2. 使用 `npm install` 安装依赖。
3. 请勿将学习者数据、录音、凭据、受版权保护的题库或生成的安装程序提交到仓库。
4. 开启 Pull Request 前运行相关检查：

```bash
npm run test:review-parser
npm run test:answer-policy
npm run test:voice-end
npm run test:review-controls
npm run test:desktop-flow
npm run test:mcp
```

提交贡献即表示你同意以 MIT 许可证授权该贡献。
