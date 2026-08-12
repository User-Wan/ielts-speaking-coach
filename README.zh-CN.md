# IELTS Speaking Coach（雅思口语教练）

[English](README.md) | [简体中文](README.zh-CN.md)

这是一个可发布到 GitHub 的雅思口语桌面应用、Codex 插件和本地 MCP 工作流。它可以：

- 从 Windows 或 macOS 桌面仪表盘启动 ChatGPT Voice；
- 发送已保存的雅思考官指令并捕获可见对话；
- 导入雅思口语题库，选择 Part 1、Part 2、Part 3 或完整模拟；
- 创建 7 天、14 天或 30 天的学习计划；
- 每次练习后生成统一结构的复盘；
- 回看练习记录、反复出现的问题、词汇、可选复训目标和进度。

## 中英双语文档

仓库的 README、贡献指南和安全政策都提供中英文入口。本文档是简体中文版；产品的实际界面语言与功能保持原有实现，不在本次文档改动范围内。

## 隐私与题库内容

学习者的对话记录、录音、复盘和登录状态只保存在本机，不会提交到这个仓库。仓库只提供一小份原创示例题库，方便克隆后运行。请通过导入流程使用自己拥有授权的雅思题库；本项目不会收录第三方或 OCR 提取的商业题库。

IELTS 是其权利人的商标。本独立项目与 IELTS 考试合作方没有从属或授权关系。ChatGPT 是 OpenAI 的商标；本项目不是 OpenAI 官方产品。

## 桌面应用

本地运行：

```powershell
npm install
npm run desktop
```

仪表盘会在桌面窗口中打开。首次使用时点击“打开 ChatGPT”，在弹出的窗口中登录自己的账号；登录会保存在 Electron 的持久化浏览器分区中。接着选择一道雅思题并点击“保存并一键启动 Voice”。在 ChatGPT 中结束 Voice 后，桌面桥接会自动生成并缓存复盘；点击“同步复盘报告”即可将它保存到本地学习记录。如未自动生成，可点击“补生成复盘报告”后再同步。

桌面桥接会在保存复盘后立即更新最新报告、练习记录、问题档案、词汇档案与可选复训目标，无需重载整个仪表盘。

它会尝试识别 ChatGPT 当前网页上的控件。若 ChatGPT 更新了页面，练习指令仍然可用，但在选择器更新前，学习者可能需要手动点击 Voice。

打包 Windows 安装程序：

```powershell
npm run package:win
```

在 Mac 上打包 macOS 安装程序：

```bash
npm run package:mac
```

macOS 构建会分别生成 Intel（`x64`）和 Apple 芯片（`arm64`）的 DMG 与 ZIP。Windows `.exe` 无法在 macOS 上运行；macOS 安装包必须在 macOS 上构建和测试。公开分发还需要 Apple Developer ID 签名与公证，未签名的本地构建可能会被 Gatekeeper 拦截。

## 升级页面

仪表盘训练导航下方有醒目的“功能升级”入口。在 `mcp/upgrade-page.json` 中设置个人网站地址：

```json
{
  "websiteUrl": "https://your-domain.example/ielts-speaking-coach"
}
```

只接受 HTTPS 地址。在已打包的桌面应用中，此页面会在学习者的默认浏览器中打开，因此产品介绍、下单和交付信息可独立于本地仪表盘更新。

插件包含一个本地 STDIO MCP 服务。它会在学习者的电脑上保存选题、复盘、历史记录和复训目标，不需要托管后端。

## 本地 MCP

安装依赖：

```powershell
npm install
```

运行 MCP 冒烟测试：

```powershell
npm run test:mcp
```

默认情况下，学习数据存放在 Windows 的 `%LOCALAPPDATA%\IELTS Speaking Coach`，或 macOS 的 Electron 应用数据目录。录音默认关闭；学习者明确开启后，只录制麦克风音频并保存在本地 `recordings` 文件夹，可在仪表盘中播放或删除。

## 按钮式练习

让 Codex 执行 `打开雅思口语仪表盘`。`open_dashboard` 工具会在学习者的浏览器中打开 `http://127.0.0.1:43127`。学习者可选择练习路线、Part、具体题目、时长和可选的单一目标；在桌面应用中，通过按钮启动与结束完整流程。

## 原型边界

Skill 和 MCP 本身不会新增 Voice 功能。可选的桌面桥接控制的是可见的 ChatGPT 网页界面，因此依赖学习者自己的 ChatGPT 访问权限和当前网页结构。除非学习者主动开启本地录音开关，否则不会保存音频。

## 试用仪表盘

直接在浏览器打开 `demo/dashboard.html`，即可查看示例数据与完整流程：选题、查看复盘、进入单目标复训，以及浏览历史、问题状态和词汇。

## 插件结构

可安装的 Skill 位于 `skills/ielts-speaking-coach/`，插件清单位于 `.codex-plugin/plugin.json`。
