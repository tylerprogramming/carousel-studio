#!/usr/bin/env python3
"""Generate a 4:5 background image for carousel slides via Kie.ai."""
import sys, json, os, time, base64, mimetypes, subprocess, tempfile, urllib.request, urllib.error
from pathlib import Path

API_BASE       = "https://api.kie.ai/api/v1"
CREATE_URL     = f"{API_BASE}/jobs/createTask"
POLL_URL       = f"{API_BASE}/jobs/recordInfo"
UPLOAD_URL     = "https://kieai.redpandaai.co/api/file-base64-upload"

def get_api_key():
    """A .env in the project root is the normal case; ~/.claude/.env is also read
    so the app works inside a Claude Code setup without duplicating keys."""
    key = os.environ.get("KIE_API_KEY")
    if key:
        return key
    for env in (Path(__file__).parent / ".env", Path.home() / ".claude" / ".env"):
        if not env.exists():
            continue
        for line in env.read_text().splitlines():
            if line.strip().startswith("KIE_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None

def api_post(url, payload, api_key):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type":  "application/json",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def api_get(url, api_key):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def upload_reference_image(path, api_key):
    """Upload a local image to Kie.ai, return its CDN URL."""
    p = Path(path)
    if not p.exists():
        print(f"  Warning: reference image not found: {path}", flush=True)
        return None
    mime  = mimetypes.guess_type(str(p))[0] or "image/png"
    b64   = base64.b64encode(p.read_bytes()).decode()
    payload = json.dumps({"base64Data": f"data:{mime};base64,{b64}", "uploadPath": "carousel/references", "fileName": p.name})
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        tmp.write(payload)
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            ["curl", "-sS", "-X", "POST", UPLOAD_URL,
             "-H", f"Authorization: Bearer {api_key}",
             "-H", "Content-Type: application/json",
             "-d", f"@{tmp_path}"],
            capture_output=True, text=True, timeout=30,
        )
        data = json.loads(result.stdout)
        # Kie.ai returns the URL in "downloadUrl" field
        return data.get("data", {}).get("downloadUrl") or data.get("data", {}).get("url") or data.get("url")
    finally:
        os.unlink(tmp_path)

# Kie.ai image models. "seedance" is the video line; the image line is Seedream.
MODELS = {
    "nano-banana-2":   "nano-banana-2",
    "nano-banana-pro": "nano-banana-pro",
    "seedream-4.5":    "seedream/4.5-text-to-image",
    "seedream-5-lite": "seedream/5-lite-text-to-image",
}


def resolve_model(name, has_reference):
    """Explicit choice wins. Otherwise keep the old behaviour: reference images
    imply nano-banana-pro for better likeness, everything else nano-banana-2."""
    if name and name in MODELS:
        return MODELS[name]
    if name and "/" in name:
        return name                     # already a full Kie model id
    return "nano-banana-pro" if has_reference else "nano-banana-2"


def create_task(prompt, api_key, reference_images=None, model_name=None):
    image_input = []
    if reference_images:
        for path in reference_images:
            url = upload_reference_image(path, api_key)
            if url:
                image_input.append(url)
                print(f"  Reference uploaded: {Path(path).name}", flush=True)
    model = resolve_model(model_name, bool(image_input))
    print(f"  Model: {model}", flush=True)
    payload = {
        "model": model,
        "input": {
            "prompt":        prompt,
            "image_input":   image_input,
            "aspect_ratio":  "4:5",
            "google_search": False,
            "resolution":    "1K",
            "output_format": "png",
        },
    }
    resp = api_post(CREATE_URL, payload, api_key)
    task_id = resp.get("data", {}).get("taskId")
    if not task_id:
        raise RuntimeError(f"No taskId in response: {resp}")
    return task_id

def poll(task_id, api_key, max_wait=360, interval=4):
    url   = f"{POLL_URL}?taskId={task_id}"
    start = time.time()
    last_state = None
    while time.time() - start < max_wait:
        try:
            resp  = api_get(url, api_key)
        except Exception as e:
            print(f"  Poll error: {e} — retrying...", flush=True)
            time.sleep(interval)
            continue
        data  = resp.get("data", {})
        state = data.get("state", "")
        if state != last_state:
            print(f"  State: {state}", flush=True)
            last_state = state
        # Accept both "success" and "completed" in case API varies
        if state in ("success", "completed", "done"):
            result = data.get("resultJson", "{}")
            if isinstance(result, str):
                try:
                    result = json.loads(result)
                except Exception:
                    result = {}
            urls = result.get("resultUrls", [])
            if not urls:
                # Some responses nest differently
                urls = result.get("images", []) or result.get("urls", [])
            return urls[0] if urls else None
        elif state in ("fail", "failed", "error"):
            raise RuntimeError(f"Generation failed: {data.get('failMsg') or data.get('message', 'unknown error')}")
        time.sleep(interval)
    raise RuntimeError(f"Timed out after {max_wait}s waiting for task {task_id}")

def download(url, output_path):
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            Path(output_path).write_bytes(r.read())
    except Exception:
        import subprocess
        subprocess.run(["curl", "-sL", "-o", str(output_path), url], check=True)

def generate(prompt, output_path, reference_images=None, model_name=None):
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("KIE_API_KEY not found. Add it to .env in the project root.")
    print(f"Creating Kie.ai task...", flush=True)
    task_id   = create_task(prompt, api_key, reference_images=reference_images, model_name=model_name)
    print(f"Task {task_id} created — polling...", flush=True)
    image_url = poll(task_id, api_key)
    if not image_url:
        raise RuntimeError("No image URL in response")
    print(f"Downloading...", flush=True)
    download(image_url, output_path)
    print(f"Saved: {output_path}", flush=True)
    return output_path

if __name__ == "__main__":
    data             = json.loads(sys.argv[1])
    prompt           = data["prompt"]
    output_path      = data["output"]
    reference_images = data.get("referenceImages", [])
    result           = generate(prompt, output_path,
                                reference_images=reference_images or None,
                                model_name=data.get("model"))
    print(json.dumps({"path": result}), flush=True)
