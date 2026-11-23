# Whisper transcription

Adds a `transcribe_audio` tool that runs a local faster-whisper model on the GPU and turns an
audio or video file into text. Nothing leaves the machine: the model, the audio and the transcript
stay local.

## Use it

Ask the agent to transcribe a file, for example:

> 把 `g:\download\meeting.mp3` 转成文字，并给我一份 srt。

The tool takes an absolute file path, an optional language code, and an optional `save` switch.
It returns the transcript text, the detected language, duration and segment count. With `save`
left on (the default) it also writes `<name>.transcript.txt` and `<name>.srt` next to the source
file, or into `outputDir` when that is set.

## Configuration

| Field | Meaning |
|---|---|
| `pythonPath` | Interpreter that has `faster-whisper` installed. |
| `modelPath` | Local CTranslate2 model directory, such as a converted `large-v3-turbo`. |
| `device` | `cuda` or `cpu`. |
| `computeType` | `float16` on GPU, `int8` is a good CPU fallback. |
| `language` | Default language code; empty detects it per file. |
| `outputDir` | Where transcripts are written; empty means beside the source file. |
| `nvidiaDir` | Optional `site-packages\nvidia` directory, used to prepend the cuBLAS and cuDNN DLL folders for the worker. Leave it empty when the system `PATH` already exports them. |
| `timeoutMs` | Per-call ceiling; the default is 30 minutes. |

## Limits

- Long files take a while on the first call, because the model loads before decoding starts.
- `.amr` and other legacy containers are decoded through `ffmpeg` when PyAV cannot open them, so
  `ffmpeg` must be on `PATH` for those formats.
- The tool only transcribes; it does not translate, diarize speakers, or stream partial results.