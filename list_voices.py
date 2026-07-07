"""
Step 1: List all ElevenLabs voices, filter for Indian English
Step 2: Generate audio with chosen Indian voice at slow cinematic pace
Step 3: Output per-sentence timing so CAPS can be matched exactly
"""
import urllib.request, urllib.error, json, os, shutil

API_KEY = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"
HEADERS = {"xi-api-key": API_KEY, "Content-Type": "application/json", "Accept": "application/json"}

def api_get(path):
    req = urllib.request.Request(f"https://api.elevenlabs.io/v1/{path}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# Fetch all voices
print("Fetching ElevenLabs voices...")
data = api_get("voices")
voices = data.get("voices", [])

# Print Indian / South Asian voices
print(f"\nTotal voices: {len(voices)}")
print("\n--- Searching for Indian/South Asian voices ---")
indian = []
for v in voices:
    name = v.get("name","")
    labels = v.get("labels", {})
    accent = labels.get("accent","").lower()
    desc   = str(labels).lower()
    cat    = v.get("category","")
    if any(k in accent+desc+name.lower() for k in ["indian","south asian","hindi","rishi","raj","arjun","ananya","priya","dev","aarav"]):
        print(f"  ✓ [{cat}] {name} | ID: {v['voice_id']} | labels: {labels}")
        indian.append(v)

print(f"\n--- All premade/cloned voices (sample) ---")
for v in voices[:30]:
    name = v.get("name","")
    labels = v.get("labels", {})
    print(f"  [{v.get('category','')}] {name:25s} | accent={labels.get('accent','-'):20s} | {v['voice_id']}")
