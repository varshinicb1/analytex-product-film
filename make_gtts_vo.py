from gtts import gTTS
import os

def main():
    if not os.path.exists("vo.txt"):
        print("Error: vo.txt not found")
        return
        
    with open("vo.txt", "r", encoding="utf-8") as f:
        text = f.read().replace("\n", " ").strip()
        
    print("Generating voiceover using Google TTS (gTTS)...")
    # Using co.uk TLD for a premium, clean British English narration tone
    tts = gTTS(text=text, lang='en', tld='co.uk', slow=False)
    
    output_file = "vo.mp3"
    v2_file = "vo_v2.mp3"
    
    tts.save(output_file)
    print(f"Generated {output_file}")
    
    # Copy to vo_v2.mp3
    import shutil
    shutil.copyfile(output_file, v2_file)
    print(f"Copied to {v2_file}")
    
    if os.path.exists(v2_file) and os.path.getsize(v2_file) > 0:
        print(f"Successfully created voiceover assets. Size: {os.path.getsize(v2_file)} bytes")
    else:
        print("Error: generated files are empty or missing.")

if __name__ == "__main__":
    main()
