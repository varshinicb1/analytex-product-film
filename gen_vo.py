import urllib.request
import urllib.error
import json
import os

SCRIPT = """Every year, millions fall ill from what they cannot see. Heavy metals. Formalin. Pesticides. Biomarkers. Hidden threats. Meet AnalyteX — IP67-rated, handheld, laboratory-grade. Two-point-eight-inch screen. WiFi. Bluetooth. Differential Pulse Voltammetry. Square Wave. Chronoamperometry. Cyclic Voltammetry. Built to go anywhere. Designed to detect everything. The VidyutX cartridge platform — swap the SPE, change the mission. Same device. Unlimited applications. The Heavy Metals SPE detects lead, cadmium and arsenic in under ninety seconds. One drop. A DPV sweep. Each voltammetric peak identifies a different metal — quantified in milligrams per litre. Swap to the Formalin SPE — formaldehyde detection in fish and food products. Carcinogenic. Illegal. Detectable in under two minutes. The Pesticide SPE uses enzyme inhibition — AChE-based organophosphate detection on crops. Real-time MRL compliance against Codex Alimentarius limits, on-site. The Clinical Health SPE simultaneously quantifies dopamine, uric acid, and creatinine. Biomarkers for neurological, metabolic, and renal health — at a fraction of lab cost. AnalyteX. One device. Every threat. Anywhere."""

API_KEY = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"

# Use Adam voice - deep, authoritative, cinematic
VOICE_ID = "pNInz6obpgDQGcFmaJgB"
URL = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

payload = {
    "text": SCRIPT,
    "model_id": "eleven_multilingual_v2",
    "voice_settings": {
        "stability": 0.68,
        "similarity_boost": 0.78,
        "style": 0.12,
        "use_speaker_boost": True
    }
}

data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(
    URL,
    data=data,
    headers={
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    },
    method="POST"
)

print("Requesting ElevenLabs TTS...")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        audio = resp.read()
    outfile = "vo.mp3"
    with open(outfile, "wb") as f:
        f.write(audio)
    # Also write as vo_v2
    with open("vo_v2.mp3", "wb") as f:
        f.write(audio)
    print(f"Done! {len(audio)/1024:.0f} KB written to {outfile}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
