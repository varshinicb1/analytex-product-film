"""Generate the AnalyteX film voiceover and its timing file.

Uses Microsoft Edge neural TTS (edge-tts, no API key). Each line is
synthesised separately, placed at its planned start (or right after the
previous line if that runs long), then concatenated with silence into
vo.mp3. The real start/end of every line is written to timeline.json,
which main.js reads, so captions and scenes always match the audio.

    pip install edge-tts      # ffmpeg/ffprobe must be on PATH
    python tools/gen_vo.py    # run from the repo root
    python tools/gen_vo.py --proxy http://host:port   # behind a proxy
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

VOICE = "en-GB-RyanNeural"
RATE = "-4%"
GAP = 0.45  # minimum breath between lines (s)
TAIL = 7.0  # music-only outro after the last line (s)

# How TTS should pronounce words that it otherwise mangles (caption keeps the real spelling)
SAY = {"Vidyuthlabs": "Vidyuth Labs"}

# (scene, planned_start_s, text)
LINES = [
    ("cold",     1.2, "You can't see lead in water. Or cadmium. Or arsenic."),
    ("cold",     6.4, "Finding them usually means a lab, a courier, and days of waiting."),
    ("reveal",  13.0, "Meet AnalyteX, from Vidyuthlabs."),  # spoken via SAY below
    ("reveal",  16.4, "A portable potentiostat, built around a precision electrochemical front end."),
    ("methods", 23.5, "Cyclic voltammetry. Differential pulse. Square wave. Chronoamperometry. Impedance."),
    ("methods", 31.0, "Five laboratory techniques, controlled from your phone over Bluetooth."),
    ("assay",   38.6, "Insert a screen-printed electrode."),
    ("assay",   41.5, "Add a drop of sample."),
    ("assay",   47.5, "AnalyteX runs the sweep. Each peak is a metal, and its height tells you how much."),
    ("result",  56.0, "Results arrive on your phone, checked against Indian drinking-water limits."),
    ("platform",63.5, "Change the electrode, and you change the test."),
    ("platform",67.5, "Heavy metals come first. Formalin, pesticide and soil-nutrient sensors are in development."),
    ("finale",  76.5, "AnalyteX. Know what's in your water."),
]


def spoken(text):
    for k, v in SAY.items():
        text = text.replace(k, v)
    return text


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=nw=1:nk=1", path], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def silence(seconds, path):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
                    "-t", f"{seconds:.3f}", "-c:a", "pcm_s16le", path], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proxy")
    ap.add_argument("--out", default=".")
    a = ap.parse_args()
    tmp = tempfile.mkdtemp()
    parts, cues, cursor = [], [], 0.0
    try:
        for i, (scene, start, text) in enumerate(LINES):
            mp3 = os.path.join(tmp, f"l{i}.mp3")
            cmd = [sys.executable, "-m", "edge_tts", "--voice", VOICE, f"--rate={RATE}",
                   "--text", spoken(text), "--write-media", mp3]
            if a.proxy:
                cmd += ["--proxy", a.proxy]
            subprocess.run(cmd, check=True, capture_output=True)
            wav = os.path.join(tmp, f"l{i}.wav")
            # trim edge-tts leading/trailing silence so cue times are tight
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-af",
                            "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                            "silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                            "-ar", "24000", "-ac", "1", wav], check=True)
            begin = max(start, cursor + (GAP if cues else 0))
            if begin > cursor:
                s = os.path.join(tmp, f"s{i}.wav")
                silence(begin - cursor, s)
                parts.append(s)
            d = dur(wav)
            parts.append(wav)
            cues.append({"scene": scene, "start": round(begin, 2), "end": round(begin + d, 2), "text": text})
            cursor = begin + d
            print(f"{begin:6.2f}-{begin + d:6.2f}  [{scene}] {text}")
        s = os.path.join(tmp, "tail.wav")
        silence(TAIL, s)
        parts.append(s)
        total = cursor + TAIL
        lst = os.path.join(tmp, "list.txt")
        with open(lst, "w") as f:
            f.writelines(f"file '{p}'\n" for p in parts)
        out_mp3 = os.path.join(a.out, "vo.mp3")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst,
                        "-c:a", "libmp3lame", "-b:a", "96k", "-ac", "1", out_mp3], check=True)
        with open(os.path.join(a.out, "timeline.json"), "w") as f:
            json.dump({"voice": VOICE, "duration": round(total, 2), "cues": cues}, f, indent=1)
        print(f"\nvo.mp3 {dur(out_mp3):.1f}s, timeline.json {len(cues)} cues, film length {total:.1f}s")
    finally:
        shutil.rmtree(tmp)


if __name__ == "__main__":
    main()
