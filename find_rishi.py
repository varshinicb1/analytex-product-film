import urllib.request, json

API_KEY = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"

# Search shared voice library for various Indian terms
searches = ["rishi", "indian", "hindi", "raj", "arjun", "dev", "aarav", "ananya", "priya"]

found = {}
for term in searches:
    url = f"https://api.elevenlabs.io/v1/shared-voices?search={term}&page_size=15"
    req = urllib.request.Request(url, headers={"xi-api-key": API_KEY})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=15).read())
        for v in data.get("voices", []):
            vid    = v.get("voice_id", "")
            if vid in found:
                continue
            name   = v.get("name", "")
            labels = v.get("labels", {})
            accent = labels.get("accent", "-").lower()
            gender = labels.get("gender", "-")
            lang   = labels.get("language", "-")
            # Filter out Tamil accent
            if "tamil" in accent or "ta-" in accent or "chennai" in accent:
                continue
            found[vid] = (name, accent, gender, lang)
    except Exception as e:
        print(f"Error for {term}: {e}")

print(f"\nIndian voices available (excluding Tamil accent):\n")
for vid, (name, accent, gender, lang) in found.items():
    print(f"  {name:30s} | {vid} | accent={accent:25s} | gender={gender} | lang={lang}")
