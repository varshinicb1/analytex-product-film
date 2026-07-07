import urllib.request
import json
import os
import subprocess
import time
import shutil

API_KEY  = "sk_64d1f0b8c2e9b8856b6f6f5aeced3440b5e8e6012442acb3"
VOICE_ID = "TwVfO3Tp8Ew7ccYKzBYI"  # Rishi - Clear, Versatile & Neutral (Indian)

CAPS = [
  ( 1,  9, "Every year, millions fall ill from what they cannot see."),
  ( 9, 14, "Heavy metals. Formalin. Pesticides. Biomarkers. Hidden threats."),
  (15, 23, "Meet AnalyteX — IP67-rated, handheld, laboratory-grade."),
  (23, 32, "Two-point-eight-inch screen. WiFi. Bluetooth. Differential Pulse Voltammetry. Square Wave. Chronoamperometry. Cyclic Voltammetry."),
  (32, 38, "Built to go anywhere. Designed to detect everything."),
  (38, 46, "The VidyutX cartridge platform — swap the SPE, change the mission."),
  (46, 50, "Same device. Unlimited applications."),
  (50, 59, "The Heavy Metals SPE detects lead, cadmium and arsenic in under ninety seconds."),
  (59, 70, "One drop. DPV sweep. Each voltammetric peak identifies a different metal — quantified in milligrams per litre."),
  (70, 76, "Swap to the Formalin SPE — formaldehyde detection in fish and food products."),
  (76, 80, "Carcinogenic. Illegal. Detectable in under two minutes."),
  (80, 88, "The Pesticide SPE uses enzyme inhibition — AChE-based organophosphate detection on crops."),
  (88, 95, "Real-time MRL compliance against Codex Alimentarius limits, on-site."),
  (95, 104, "The Clinical Health SPE simultaneously quantifies dopamine, uric acid, and creatinine."),
  (104, 112, "Biomarkers for neurological, metabolic, and renal health — at a fraction of lab cost."),
  (112, 120, "AnalyteX. One device. Every threat. Anywhere."),
]

# Settings for a clear, professional, steady tone
VOICE_SETTINGS = {
    "stability": 0.75,
    "similarity_boost": 0.85,
    "style": 0.05,
    "use_speaker_boost": True
}

def get_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return float(res.stdout.strip())

def make_silence(duration, output_path):
    # Generates a silent MP3 file of a specific duration using ffmpeg
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", f"{duration:.3f}", "-c:a", "libmp3lame", "-b:a", "128k", output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def generate_voice(text, output_path):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": VOICE_SETTINGS
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "xi-api-key": API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        audio = resp.read()
    with open(output_path, "wb") as f:
        f.write(audio)

def main():
    os.makedirs("temp_vo", exist_ok=True)
    concat_list = []
    current_time = 0.0
    
    print("Starting voiceover generation with ElevenLabs (Rishi)...")
    
    for idx, (start_time, end_time, text) in enumerate(CAPS):
        print(f"\nProcessing sentence {idx + 1}/{len(CAPS)}: '{text[:40]}...'")
        
        # 1. Pad with silence if there is a gap before the sentence starts
        if start_time > current_time:
            gap = start_time - current_time
            silence_file = f"temp_vo/silence_{idx}.mp3"
            print(f"  Generating silence of {gap:.2f}s before sentence starts...")
            make_silence(gap, silence_file)
            concat_list.append(silence_file)
            current_time += gap
            
        # 2. Generate sentence audio
        voice_file = f"temp_vo/voice_{idx}.mp3"
        print("  Requesting speech from ElevenLabs...")
        generate_voice(text, voice_file)
        
        # Let's check duration of the generated speech
        dur = get_duration(voice_file)
        print(f"  Speech duration: {dur:.2f}s (target slot size: {end_time - start_time:.2f}s)")
        
        # If speech is longer than the subtitle duration, it overflows the timeline gap.
        # But Rishi is generally normal speed. Let's make sure it fits.
        concat_list.append(voice_file)
        current_time += dur
        
        # Rate limiting sleep for ElevenLabs
        time.sleep(0.5)

    # Add final silence to round up to 120s if needed
    if current_time < 120.0:
        gap = 120.0 - current_time
        silence_file = "temp_vo/silence_final.mp3"
        print(f"\nGenerating final silence of {gap:.2f}s to reach 120s...")
        make_silence(gap, silence_file)
        concat_list.append(silence_file)
        current_time += gap

    # Create the concat list text file for ffmpeg
    list_path = "temp_vo/concat_list.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for filepath in concat_list:
            # Need to double backslashes for windows paths or use forward slashes
            clean_path = os.path.abspath(filepath).replace("\\", "/")
            f.write(f"file '{clean_path}'\n")
            
    # Concatenate using ffmpeg
    output_vo = "vo.mp3"
    print("\nConcatenating files with ffmpeg...")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", list_path, "-c", "copy", output_vo
    ]
    subprocess.run(cmd)
    
    # Check output
    if os.path.exists(output_vo) and os.path.getsize(output_vo) > 0:
        print(f"\nSuccess! Generated timeline-aligned voiceover file: {output_vo} ({os.path.getsize(output_vo)} bytes)")
        print(f"Total voiceover track length: {get_duration(output_vo):.2f}s")
        
        # Clean up temp files
        shutil.rmtree("temp_vo")
        print("Cleaned up temporary voice files.")
    else:
        print("\nError: Concatenation failed.")

if __name__ == "__main__":
    main()
