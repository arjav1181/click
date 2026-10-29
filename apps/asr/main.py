"""Click ASR service.

A small FastAPI wrapper around faster-whisper. The web app posts an audio file
and gets timestamped segments back. No audio leaves the host.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

app = FastAPI(title="Click ASR", version="0.1.0")

MODEL_NAME = os.getenv("ASR_MODEL", "small")
DEVICE = os.getenv("ASR_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("ASR_COMPUTE_TYPE", "int8")
DOWNLOAD_ROOT = os.getenv("ASR_MODEL_DIR", "/models")
MAX_BYTES = int(os.getenv("ASR_MAX_UPLOAD_MB", "500")) * 1024 * 1024
ALLOWED_SUFFIXES = {".mp3", ".wav", ".webm", ".ogg", ".m4a", ".mp4", ".mov", ".flac"}

_models: dict[str, WhisperModel] = {}
_lock = Lock()


def get_model(name: str) -> WhisperModel:
    with _lock:
        if name not in _models:
            Path(DOWNLOAD_ROOT).mkdir(parents=True, exist_ok=True)
            _models[name] = WhisperModel(
                name,
                device=DEVICE,
                compute_type=COMPUTE_TYPE,
                download_root=DOWNLOAD_ROOT,
            )
        return _models[name]


@app.get("/healthz")
def healthz() -> dict[str, object]:
    return {
        "ok": True,
        "service": "click-asr",
        "model": MODEL_NAME,
        "device": DEVICE,
        "loaded": list(_models.keys()),
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
    model: str = Form(default=MODEL_NAME),
) -> dict[str, object]:
    suffix = Path(file.filename or "audio.bin").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported audio or video format")

    total = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_BYTES:
                handle.close()
                os.unlink(handle.name)
                raise HTTPException(status_code=413, detail="File exceeds ASR_MAX_UPLOAD_MB")
            handle.write(chunk)
        path = handle.name

    try:
        whisper = get_model(model)
        segments, info = whisper.transcribe(
            path,
            language=language or None,
            vad_filter=True,
            beam_size=int(os.getenv("ASR_BEAM_SIZE", "5")),
            condition_on_previous_text=False,
        )
        payload = [
            {
                "start_ms": int(segment.start * 1000),
                "end_ms": int(segment.end * 1000),
                "text": segment.text.strip(),
                "confidence": None,
                "speaker": None,
            }
            for segment in segments
            if segment.text.strip()
        ]
        return {
            "language": info.language,
            "duration_ms": int(info.duration * 1000),
            "segments": payload,
            "model": model,
            "provider": "faster-whisper",
        }
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
