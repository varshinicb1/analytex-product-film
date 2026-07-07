import subprocess, os, shutil, time

VOICE = "en-GB-RyanNeural"   # British, expressive, cinematic
RATE  = "-5%"                # Slight slowdown keeps gravitas

CAPS = [
  ( 1.0,  5.9, "Every year... millions fall ill from what they cannot see."),
  ( 9.0, 18.5, "Heavy metals. Formalin. Pesticides. Biomarkers. Hidden threats."),
  (18.5, 25.3, "Meet AnalyteX — handheld, laboratory-grade electrochemical intelligence."),
  (25.3, 40.9, "Two-point-eight-inch touchscreen. WiFi. Bluetooth. Differential Pulse Voltammetry. Square Wave. Chronoamperometry. Cyclic Voltammetry."),
  (40.9, 46.7, "Built to go anywhere. Designed to detect everything."),
  (46.7, 52.8, "The NanoX cartridge platform — swap the SPE, change the mission."),
  (52.8, 57.7, "Same device. Unlimited applications."),
  (57.7, 65.3, "The Heavy Metals SPE detects lead, cadmium and arsenic in under ninety seconds."),
  (65.3, 76.8, "One drop. DPV sweep. Each voltammetric peak identifies a different metal — quantified in milligrams per litre."),
  (76.8, 84.4, "Swap to the Formalin SPE — formaldehyde detection in fish and food products."),
  (84.4, 91.2, "Carcinogenic. Illegal. Detectable in under two minutes."),
  (91.2, 99.6, "The Pesticide SPE uses enzyme inhibition — AChE-based organophosphate detection on crops."),
  (99.6,106.1, "Real-time MRL compliance against Codex Alimentarius limits, on-site."),
  (106.1,114.1,"The Clinical Health SPE simultaneously quantifies dopamine, uric acid, and creatinine."),
  (114.1,122.2,"Biomarkers for neurological, metabolic, and renal health — at a fraction of lab cost."),
  (122.2,129.6,"AnalyteX. One device. Every threat. Anywhere."),
]

def get_duration(f):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=noprint_wrappers=1:nokey=1",f],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    return float(r.stdout.strip())

def make_silence(dur, out):
    subprocess.run(["ffmpeg","-y","-f","lavfi","-i","anullsrc=r=44100:cl=stereo",
        "-t",f"{dur:.3f}","-c:a","libmp3lame","-b:a","128k",out],
        stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

os.makedirs("temp_ryan", exist_ok=True)
concat_list, cursor = [], 0.0

print(f"Generating voiceover with {VOICE} (cinematic rate {RATE})...")
for idx, (s, e, text) in enumerate(CAPS):
    print(f"  [{idx+1:02d}] {text[:50]}...")
    if s > cursor:
        sf = f"temp_ryan/sil_{idx}.mp3"
        make_silence(s - cursor, sf)
        concat_list.append(sf); cursor = s
    vf = f"temp_ryan/v_{idx}.mp3"
    subprocess.run(["python","-m","edge_tts","--voice",VOICE,"--rate",RATE,"--text",text,"--write-media",vf])
    dur = get_duration(vf)
    print(f"     -> {dur:.2f}s (slot={e-s:.2f}s)")
    concat_list.append(vf); cursor += dur
    time.sleep(0.1)

if cursor < 130:
    sf = "temp_ryan/sil_final.mp3"
    make_silence(130 - cursor, sf)
    concat_list.append(sf)

with open("temp_ryan/list.txt","w",encoding="utf-8") as f:
    for fp in concat_list:
        f.write(f"file '{os.path.abspath(fp).replace(chr(92),'/')}'\n")

print("\nConcatenating...")
subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","temp_ryan/list.txt",
    "-c:a","libmp3lame","-b:a","128k","vo_ryan.mp3"])

dur = get_duration("vo_ryan.mp3")
sz  = os.path.getsize("vo_ryan.mp3")
print(f"\nDone: vo_ryan.mp3 ({sz:,} bytes, {dur:.1f}s)")
shutil.rmtree("temp_ryan")
