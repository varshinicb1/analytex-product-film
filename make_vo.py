import pyttsx3
import os

def main():
    # Read script lines
    if not os.path.exists("vo.txt"):
        print("Error: vo.txt not found")
        return
        
    with open("vo.txt", "r", encoding="utf-8") as f:
        text = f.read().replace("\n", " ").strip()
        
    print("Initializing pyttsx3...")
    engine = pyttsx3.init()
    
    # Configure voice properties
    rate = engine.getProperty('rate')
    engine.setProperty('rate', int(rate * 0.86)) # slightly slower, more premium keynote style
    
    # Use Microsoft David (Male) if available, otherwise default
    voices = engine.getProperty('voices')
    for v in voices:
        if "David" in v.name:
            engine.setProperty('voice', v.id)
            print(f"Selected voice: {v.name}")
            break
            
    output_file = "vo.mp3"
    print(f"Generating voiceover offline -> {output_file}")
    engine.save_to_file(text, output_file)
    engine.runAndWait()
    
    if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
        print(f"Successfully generated {output_file} ({os.path.getsize(output_file)} bytes)")
    else:
        print("Failed to generate file or file is empty.")

if __name__ == "__main__":
    main()
