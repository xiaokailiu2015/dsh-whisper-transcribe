# DSH Whisper Transcribe

Local speech-to-text for DeepSeek Harness: a `transcribe_audio` tool plus a settings page, backed by a
faster-whisper model running on your own GPU.

[中文](#中文) · [English](#english)

---

## 中文

把本地音视频转成文字，全程不联网：模型、音频、转写结果都留在你这台机器上。

### 功能

- Agent 工具 `transcribe_audio`，直接说「转写 <文件路径>」即可
- 生成纯文本 `.transcript.txt` 与带时间戳的 `.srt` 字幕
- 自动识别语言，也可以强制指定（如 `zh`、`en`）
- CUDA 加速；CPU 也能跑，只是慢
- 设置入口在 **Ctrl+, → 语音转写**，与插件行的 Configure 共用同一份配置

### 环境要求

- DeepSeek Harness（桌面版或 Web 版）
- Python 3.10+，并安装 `faster-whisper`
- 一个 CTranslate2 格式的模型目录（含 `model.bin`），例如 `faster-whisper-large-v3-turbo`
- GPU 使用时需要 CUDA 12 的 cuBLAS 与 cuDNN 9
- 遇到 `.amr` 等冷门容器时，需要 `ffmpeg` 在 `PATH` 上

```powershell
python -m pip install faster-whisper
python -m pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"
```

> 注意：faster-whisper 1.2 与 PyAV 19 不兼容（`metadata_errors` 参数已被移除）。如果遇到
> `TypeError: open() got an unexpected keyword argument 'metadata_errors'`，把 PyAV 降到 19 以下：
> `python -m pip install "av<19"`。本插件本身会在需要时改用 ffmpeg 解码，不受这个坑影响。

### 安装

```powershell
# 从本地目录安装
dsh plugin --profile desktop add C:\path\to\dsh-whisper-transcribe
```

也可以在 DSH 的 **插件 → Add plugin** 里填本目录路径。

### 配置

| 字段 | 说明 |
|---|---|
| 模型目录 | CTranslate2 模型目录，必须含 `model.bin` |
| Python 解释器 | 装了 `faster-whisper` 的 `python.exe` 绝对路径 |
| 运行设备 | `cuda` 或 `cpu`，下拉选择 |
| 计算精度 | 跟随设备自动决定：GPU 用 `float16`，CPU 用 `int8`（只读） |
| 默认语言 | 留空自动识别；可填 `zh`、`en` 等 |
| 输出目录 | 留空则写在音频文件旁 |
| CUDA 库目录 | `site-packages\nvidia`；系统 PATH 已配置时可留空 |
| 超时（毫秒） | 单次转写上限，默认 30 分钟 |

### 使用

在对话里说：

> 转写 C:\Users\me\recording.amr

工具会返回语言、时长、分段数，以及 `.txt` / `.srt` 的路径。

### 隐私

音频与转写文本不会离开本机；插件只调用本地 Python 进程。唯一的网络访问发生在你自己
安装 Python 依赖时。

---

## English

Turn local audio and video into text without leaving the machine: the model, the audio, and the
transcript all stay on your computer.

### Features

- A `transcribe_audio` tool the agent can call: just say "transcribe <path>"
- Writes a plain-text `.transcript.txt` and timestamped `.srt` subtitles
- Detects the language automatically, or takes an explicit one such as `zh` or `en`
- CUDA acceleration, with a slower CPU fallback
- Settings live under **Ctrl+, → Speech transcription**, sharing one configuration with the
  plugin row's Configure page

### Requirements

- DeepSeek Harness (desktop or web)
- Python 3.10+ with `faster-whisper` installed
- A CTranslate2 model directory containing `model.bin`, such as `faster-whisper-large-v3-turbo`
- For GPU use: CUDA 12 cuBLAS and cuDNN 9
- `ffmpeg` on `PATH` when decoding containers such as `.amr`

```powershell
python -m pip install faster-whisper
python -m pip install nvidia-cublas-cu12 "nvidia-cudnn-cu12==9.*"
```

> faster-whisper 1.2 is incompatible with PyAV 19, which removed the `metadata_errors` argument.
> If you hit `TypeError: open() got an unexpected keyword argument 'metadata_errors'`, pin
> `python -m pip install "av<19"`. The plugin also falls back to ffmpeg decoding, so it works either way.

### Install

```powershell
dsh plugin --profile desktop add C:\path\to\dsh-whisper-transcribe
```

You can also enter the directory path in DSH's **Plugins → Add plugin**.

### Configuration

| Field | Meaning |
|---|---|
| Model directory | CTranslate2 model directory containing `model.bin` |
| Python interpreter | Absolute path to a `python.exe` with `faster-whisper` installed |
| Device | `cuda` or `cpu`, chosen from a dropdown |
| Compute type | Derived from the device: `float16` on GPU, `int8` on CPU (read-only) |
| Default language | Empty detects per file; or set `zh`, `en`, and so on |
| Output directory | Empty writes beside the source file |
| CUDA library directory | `site-packages\nvidia`; leave empty when `PATH` already has it |
| Timeout (ms) | Per-call ceiling, 30 minutes by default |

### Usage

Ask in chat:

> transcribe C:\Users\me\recording.amr

The tool returns the language, duration, segment count, and the paths it wrote.

### Privacy

Audio and transcripts never leave the machine. The plugin only spawns a local Python process; the
only network access is your own dependency installation.

---

## License

MIT. See [LICENSE](LICENSE).

<p align="center"><sub>Powered by DeepSeek V4.1 Flash 1017 · built with DeepSeek Harness</sub></p>