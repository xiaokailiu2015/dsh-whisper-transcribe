"""Transcribe one audio file with a local faster-whisper model.

Reads a JSON request on stdin and prints one JSON result line on stdout.
Falls back to decoding through ffmpeg when PyAV cannot open the source file.
"""

import json
import os
import subprocess
import sys
import tempfile


def setup_cuda_dlls():
    """Make pip-installed cuBLAS/cuDNN visible before ctranslate2 loads them."""
    root = os.environ.get("DSH_WHISPER_NVIDIA_DIR") or ""
    if not root:
        return
    for part in (os.path.join("cublas", "bin"), os.path.join("cudnn", "bin")):
        path = os.path.join(root, part)
        if not os.path.isdir(path):
            continue
        try:
            os.add_dll_directory(path)
        except (AttributeError, OSError):
            pass
        os.environ["PATH"] = path + os.pathsep + os.environ.get("PATH", "")


def format_timestamp(seconds):
    total = max(0.0, float(seconds))
    hours, rest = divmod(total, 3600)
    minutes, secs = divmod(rest, 60)
    whole = int(secs)
    millis = int(round((secs - whole) * 1000))
    if millis == 1000:
        whole += 1
        millis = 0
    return f"{int(hours):02d}:{int(minutes):02d}:{whole:02d},{millis:03d}"


def write_outputs(audio, segments, output_dir):
    base = os.path.splitext(os.path.basename(audio))[0]
    target = output_dir or os.path.dirname(os.path.abspath(audio))
    os.makedirs(target, exist_ok=True)
    text_path = os.path.join(target, base + ".transcript.txt")
    srt_path = os.path.join(target, base + ".srt")

    with open(text_path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(seg["text"] for seg in segments))

    with open(srt_path, "w", encoding="utf-8") as handle:
        for index, seg in enumerate(segments, start=1):
            handle.write(f"{index}\n")
            handle.write(f"{format_timestamp(seg['start'])} --> {format_timestamp(seg['end'])}\n")
            handle.write(f"{seg['text']}\n\n")

    return text_path, srt_path


def decode_segments(model, audio, language):
    kwargs = {"vad_filter": True, "beam_size": 5}
    if language:
        kwargs["language"] = language
    try:
        found, info = model.transcribe(audio, **kwargs)
        return list(found), info
    except Exception as first:  # PyAV may lack the container codec; decode via ffmpeg instead.
        handle = tempfile.NamedTemporaryFile(suffix=".f32", delete=False)
        handle.close()
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", audio,
                 "-ac", "1", "-ar", "16000", "-f", "f32le", handle.name],
                check=True,
            )
            import numpy as np

            samples = np.fromfile(handle.name, dtype=np.float32)
            found, info = model.transcribe(samples, **kwargs)
            return list(found), info
        finally:
            try:
                os.unlink(handle.name)
            except OSError:
                pass


def main():
    request = json.load(sys.stdin)
    setup_cuda_dlls()

    from faster_whisper import WhisperModel

    model = WhisperModel(
        request["model"],
        device=request.get("device", "cuda"),
        compute_type=request.get("computeType", "float16"),
    )
    found, info = decode_segments(model, request["audio"], request.get("language") or "")

    segments = [
        {"start": float(seg.start), "end": float(seg.end), "text": seg.text.strip()}
        for seg in found
    ]
    result = {
        "text": "\n".join(seg["text"] for seg in segments),
        "language": str(getattr(info, "language", "") or ""),
        "duration": float(getattr(info, "duration", 0.0) or 0.0),
        "segments": len(segments),
    }
    if request.get("save", True):
        text_path, srt_path = write_outputs(request["audio"], segments, request.get("outputDir") or "")
        result["textPath"] = text_path
        result["srtPath"] = srt_path

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # Report one readable line; the plugin surfaces stderr.
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise