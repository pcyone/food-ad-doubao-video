# 美食广告成片 Skill

`food-ad-doubao-video` 是一个面向 Codex 的端到端竖屏美食广告 Skill。它可以从菜品名开始，完成分镜提示词、Google Flow 视频生成、豆包连续口播、原声氛围混音、1080×1920 合成，以及 `ffprobe`、黑场、音量和关键帧验收。

本仓库由一次真实完成的「东坡肉 40 秒竖屏广告」流程固化而来。该次运行真实生成了四段 Flow 视频；第五段因 Flow 点数耗尽，使用已披露的本地英雄画面延展完成。Skill 会区分“服务端真实生成”和“本地回退”，不会把回退素材标记为 Flow 生成结果。

## 能力范围

- 从菜品名或已有素材开始工作
- 建立跨镜头连续性设定
- 编写多段 9:16 美食视频提示词
- 通过 Google Flow 逐段生成、提交和回收素材
- 仅以 HTTP 200 作为 Flow 已提交证据
- 调用豆包 TTS 生成一整条连续中文旁白
- 自动测量旁白并在 `0.88–1.18` 范围内轻微变速
- 将素材统一为 1080×1920、24fps
- 压低原视频声音作为氛围声，旁白置于前景
- 输出 MP4、`verification.json` 和 `关键帧检查.jpg`
- 支持对已有 MP4 单独重新执行验收

## 文档

- [完整生成视频中文版教程](docs/完整生成视频中文版教程.md)
- [安装与使用说明](docs/安装与使用说明.md)
- [Google Flow 提交与回收协议](references/flow-generation.md)
- [东坡肉 40 秒黄金样例](references/dongpo-rou-golden-run.md)

## 快速安装

把仓库克隆到 Codex Skills 目录：

```bash
git clone https://github.com/pcyone/food-ad-doubao-video.git \
  "${CODEX_HOME:-$HOME/.codex}/skills/food-ad-doubao-video"
```

准备豆包 TTS 配置：

```bash
cp .env.example /absolute/private/path/food-ad.env.local
export DOUBAO_TTS_ENV_FILE=/absolute/private/path/food-ad.env.local
```

不要把填写后的 `.env` 文件提交到 GitHub。

## 在 Codex 中使用

直接输入：

```text
使用 $food-ad-doubao-video，选择一道新菜，从 Flow 提示词开始生成 40 秒竖屏广告，调用豆包连续口播并完成验收。
```

如果已经有素材：

```text
使用 $food-ad-doubao-video，把这些按顺序排列的视频和最终口播稿合成为 40 秒竖屏广告。
```

## 直接运行成片脚本

```bash
node scripts/new-food-ad-project.mjs \
  --dish "东坡肉" \
  --clips /absolute/path/scene01.mp4,/absolute/path/scene02.mp4 \
  --script /absolute/path/narration.txt \
  --out-dir /absolute/path/project \
  --duration 40

node scripts/make-food-ad-video.mjs --project /absolute/path/project
```

只重新验收已有成片，不重新调用豆包：

```bash
node scripts/make-food-ad-video.mjs \
  --verify-existing /absolute/path/final.mp4 \
  --out-dir /absolute/path/verification-output
```

## 外部依赖

基础成片需要：

- Codex
- Node.js 20 或更高版本
- `ffmpeg` 和 `ffprobe`
- 可用的豆包 TTS 配置

Google Flow 自动生成还需要：

- Google Chrome
- Docker
- 已安装并授权的 `hbg-gemini-flow-suite`
- 可用的 Google Flow 账号和点数

本仓库不包含 Google、Flow 或豆包凭据，也不包含 `hbg-gemini-flow-suite` 本体。

## 安全原则

- 不打印 Cookie、API Key、Bearer Token 或账号凭据
- 不把“点击按钮”当作生成成功，必须看到 HTTP 200
- 服务端生成成功但本地失败时，优先回收同一项目，不重复消耗点数
- Flow 点数耗尽时停止反复提交
- 本地延展、复用或替代素材必须写入 `generation-audit.json`

## 仓库结构

```text
food-ad-doubao-video/
├── SKILL.md
├── README.md
├── .env.example
├── agents/
│   └── openai.yaml
├── docs/
│   ├── 完整生成视频中文版教程.md
│   └── 安装与使用说明.md
├── references/
│   ├── flow-generation.md
│   └── dongpo-rou-golden-run.md
└── scripts/
    ├── new-food-ad-project.mjs
    ├── make-food-ad-video.mjs
    ├── make-hero-extension.mjs
    ├── run-flow-project-task.zsh
    ├── submit-flow-project.py
    └── recover-flow-project.py
```
