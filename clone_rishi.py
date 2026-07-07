import urllib.request
import json
import os
import mimetypes

API_KEY = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"
PREVIEW_URL = "https://storage.googleapis.com/eleven-public-prod/database/user/GMFDwPHMLCNtsjvfVtvLnMr4XN82/voices/TwVfO3Tp8Ew7ccYKzBYI/6928542d-0ffa-4b20-bdfc-596f55dd48a9.mp3"

def build_multipart_formdata(fields, files):
    boundary = b'Boundary-%d' % int(time.time())
    crlf = b'\r\n'
    lines = []
    
    for name, value in fields.items():
        lines.append(b'--' + boundary)
        lines.append(f'Content-Disposition: form-data; name="{name}"'.encode('utf-8'))
        lines.append(crlf)
        lines.append(str(value).encode('utf-8'))
        
    for name, filename, file_bytes in files:
        lines.append(b'--' + boundary)
        lines.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode('utf-8'))
        lines.append(f'Content-Type: {mimetypes.guess_type(filename)[0] or "application/octet-stream"}'.encode('utf-8'))
        lines.append(crlf)
        lines.append(file_bytes)
        
    lines.append(b'--' + boundary + b'--')
    lines.append(b'')
    
    body = crlf.join(lines)
    content_type = f'multipart/form-data; boundary={boundary.decode("utf-8")}'
    return body, content_type

import time

def main():
    temp_sample = "rishi_preview.mp3"
    print(f"Downloading Rishi preview from: {PREVIEW_URL}...")
    try:
        urllib.request.urlretrieve(PREVIEW_URL, temp_sample)
        print("Download successful.")
    except Exception as e:
        print(f"Error downloading: {e}")
        return
        
    with open(temp_sample, "rb") as f:
        file_bytes = f.read()
        
    fields = {
        "name": "Rishi",
        "description": "Instant Voice Clone of Rishi's neutral South Asian accent.",
    }
    # ElevenLabs expects key 'files' or 'files[]' for audio samples
    files = [("files", temp_sample, file_bytes)]
    
    body, content_type = build_multipart_formdata(fields, files)
    
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/voices/add",
        data=body,
        headers={
            "xi-api-key": API_KEY,
            "Content-Type": content_type
        },
        method="POST"
    )
    
    print("Uploading to ElevenLabs as an Instant Voice Clone (free-tier compatible)...")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res_json = json.loads(resp.read().decode('utf-8'))
            new_voice_id = res_json.get("voice_id")
            print(f"\nSUCCESS! Voice cloned successfully.")
            print(f"New Voice ID in your Voice Lab: {new_voice_id}")
            
            # Clean up preview file
            if os.path.exists(temp_sample):
                os.remove(temp_sample)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error cloning voice: {e}")

if __name__ == "__main__":
    main()
