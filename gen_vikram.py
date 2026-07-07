"""
Generate cinematic Indian-accented voiceover using Vikram (ElevenLabs).
Uses slower rate, deeper stability for authoritative narration tone.
Then writes per-sentence timing JSON for exact CAPS alignment.
"""
import urllib.request, json, os, time

API_KEY   = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"
VOICE_ID  = "q7ynHWRxq6HxZXAqqYqs"   # Vikram — Indian accent

# ── Sentences with deliberate pauses written in ──────────────────────────
# We generate each sentence separately to know exact timestamps.
# Silence in between = chapter breathing room.
SENTENCES = [
    # PROLOGUE
    ("Every year... millions fall ill from what they cannot see.",         1.0),
    ("Heavy metals. Formalin. Pesticides. Biomarkers. Hidden threats.",   2.0),
    # DEVICE REVEAL
    ("Meet AnalyteX — IP67-rated, handheld, laboratory-grade.",           3.5),
    ("Two-point-eight-inch screen. WiFi. Bluetooth. DPV. Square Wave. Chronoamperometry. Cyclic Voltammetry.", 2.0),
    ("Built to go anywhere. Designed to detect everything.",              2.0),
    # PLATFORM
    ("The VidyutX cartridge platform — swap the SPE, change the mission.", 2.5),
    ("Same device. Unlimited applications.",                               2.0),
    # HEAVY METALS
    ("The Heavy Metals SPE detects lead, cadmium, and arsenic — in under ninety seconds.", 2.0),
    ("One drop. A DPV sweep. Each voltammetric peak identifies a different metal — quantified in milligrams per litre.", 2.0),
    # FORMALIN
    ("Swap to the Formalin SPE — formaldehyde detection in fish and food products.", 2.0),
    ("Carcinogenic. Illegal. Detectable in under two minutes.",            2.0),
    # PESTICIDE
    ("The Pesticide SPE uses enzyme inhibition — AChE-based organophosphate detection on crops.", 2.0),
    ("Real-time MRL compliance against Codex Alimentarius limits, on-site.", 2.0),
    # HEALTH
    ("The Clinical Health SPE simultaneously quantifies dopamine, uric acid, and creatinine.", 2.0),
    ("Biomarkers for neurological, metabolic, and renal health — at a fraction of lab cost.", 2.0),
    # FINALE
    ("AnalyteX. One device. Every threat. Anywhere.",                      0.0),
]

URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

# Premium cinematic settings for Vikram
SETTINGS = {
    "stability":        0.72,   # controlled, authoritative
    "similarity_boost": 0.82,   # natural to voice character
    "style":            0.18,   # slight expressive lift
    "use_speaker_boost": True,
}

def gen_audio(text):
    payload = json.dumps({
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": SETTINGS
    }).encode("utf-8")
    req = urllib.request.Request(URL, data=payload, method="POST",
        headers={"xi-api-key": API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

# ── Generate each sentence, measure byte size → duration estimate ─────────
# ElevenLabs MP3 at 128kbps = 16000 bytes/sec
BYTES_PER_SEC = 16000

os.makedirs("vo_parts", exist_ok=True)
timeline = []   # [{"text":…, "start":…, "end":…, "file":…}]
cursor = 1.0    # start at t=1

print("Generating sentence-by-sentence audio...")
for i, (text, pause_after) in enumerate(SENTENCES):
    fname = f"vo_parts/s{i:02d}.mp3"
    print(f"  [{i:02d}] {text[:55]}…")
    audio = gen_audio(text)
    with open(fname,"wb") as f: f.write(audio)
    dur = len(audio) / BYTES_PER_SEC
    entry = {"text": text, "start": round(cursor,2), "end": round(cursor+dur,2), "dur": round(dur,2), "file": fname}
    timeline.append(entry)
    print(f"       -> {dur:.1f}s  ({cursor:.1f}s - {cursor+dur:.1f}s)")
    cursor += dur + pause_after
    time.sleep(0.3)   # polite rate-limit

print(f"\nTotal estimated duration: {cursor:.1f}s")
with open("vo_timeline.json","w") as f: json.dump(timeline, f, indent=2)
print("Saved vo_timeline.json")
