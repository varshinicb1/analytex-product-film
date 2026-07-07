import subprocess
import json
import os
import shutil
import time

VOICE = "en-IN-PrabhatNeural"  # Professional Indian English Male Voice
RATE  = "-10%"                 # Slowed down for cinematic clarity and authority

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

def get_duration(file_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return float(res.stdout.strip())

def make_silence(duration, output_path):
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", f"{duration:.3f}", "-c:a", "libmp3lame", "-b:a", "128k", output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def generate_voice_edge(text, rate, voice, output_path):
    cmd = [
        "python", "-m", "edge_tts", "--voice", voice, "--rate", rate,
        "--text", text, "--write-media", output_path
    ]
    subprocess.run(cmd)

def main():
    temp_dir = "temp_edge_vo"
    os.makedirs(temp_dir, exist_ok=True)
    concat_list = []
    current_time = 0.0
    
    print("Starting voiceover generation with Edge TTS (PrabhatNeural - Indian Male)...")
    
    for idx, (start_time, end_time, text) in enumerate(CAPS):
        print(f"\nProcessing sentence {idx + 1}/{len(CAPS)}: '{text[:40]}...'")
        
        # 1. Pad with silence if there is a gap before the sentence starts
        if start_time > current_time:
            gap = start_time - current_time
            silence_file = f"{temp_dir}/silence_{idx}.mp3"
            print(f"  Generating silence of {gap:.2f}s before sentence...")
            make_silence(gap, silence_file)
            concat_list.append(silence_file)
            current_time += gap
            
        # 2. Generate sentence audio using edge-tts
        voice_file = f"{temp_dir}/voice_{idx}.mp3"
        print("  Generating voice using edge-tts...")
        generate_voice_edge(text, RATE, VOICE, voice_file)
        
        # Check duration
        dur = get_duration(voice_file)
        print(f"  Speech duration: {dur:.2f}s (target slot size: {end_time - start_time:.2f}s)")
        
        concat_list.append(voice_file)
        current_time += dur
        time.sleep(0.1)

    # Pad final silence to reach 120s
    if current_time < 120.0:
        gap = 120.0 - current_time
        silence_file = f"{temp_dir}/silence_final.mp3"
        print(f"\nGenerating final silence of {gap:.2f}s to reach 120s...")
        make_silence(gap, silence_file)
        concat_list.append(silence_file)
        current_time += gap

    # Create the concat list
    list_path = f"{temp_dir}/concat_list.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for filepath in concat_list:
            clean_path = os.path.abspath(filepath).replace("\\", "/")
            f.write(f"file '{clean_path}'\n")
            
    # Concatenate using ffmpeg
    output_vo = "vo.mp3"
    print("\nConcatenating files with ffmpeg...")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", list_path, "-c:a", "libmp3lame", "-b:a", "128k", output_vo
    ]
    subprocess.run(cmd)
    
    # Check output
    if os.path.exists(output_vo) and os.path.getsize(output_vo) > 0:
        print(f"\nSuccess! Generated timeline-aligned voiceover file: {output_vo} ({os.path.getsize(output_vo)} bytes)")
        print(f"Total voiceover track length: {get_duration(output_vo):.2f}s")
        
        # Copy to vo_v2.mp3 as well for backup
        shutil.copyfile(output_vo, "vo_v2.mp3")
        
        # Clean up
        shutil.rmtree(temp_dir)
        print("Cleaned up temporary files.")
    else:
        print("\nError: Concatenation failed.")

if __name__ == "__main__":
    main()
