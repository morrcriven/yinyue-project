from flask import Flask, request, jsonify, render_template, session
from gtts import gTTS
import speech_recognition as sr
from openai import OpenAI
import os
from flask_session import Session

app = Flask(__name__, static_folder="project/static", template_folder="project/templates")

# Session configuration for chat history
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# OpenAI GPT API Key
client = OpenAI(
    api_key="Input your secret here",
)

# Helper function for text-to-speech
def text_to_speech(text, filename="response.mp3"):
    tts = gTTS(text)
    tts.save(filename)

# Helper function for speech-to-text
def speech_to_text(audio_file):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(audio_file) as source:
            audio = recognizer.record(source)
        text = recognizer.recognize_google(audio)
        return text
    except sr.UnknownValueError:
        return "Sorry, I couldn't understand the audio."
    except sr.RequestError as e:
        app.logger.error(f"Speech recognition service error: {e}")
        return f"Speech recognition service error: {e}"
    except Exception as e:
        app.logger.error(f"Unexpected error in speech-to-text: {e}")
        return f"Unexpected error occurred: {e}"


# Route for generating GPT response and updating chat history
@app.route("/generate", methods=["POST"])
def generate_response():
    try:
        user_input = request.json.get("text")
        if not user_input:
            return jsonify({"error": "No input text provided"}), 400

        # Get GPT response
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful chatbot."},
                {"role": "user", "content": user_input},
            ],
        )
        reply = response.choices[0].message.content.strip()

        # Store conversation in session history
        if "history" not in session:
            session["history"] = []
        session["history"].append({"user": user_input, "bot": reply})

        # Convert response to speech
        text_to_speech(reply)

        return jsonify({"reply": reply, "audio": "response.mp3", "history": session["history"]})
    
    except Exception as e:
        app.logger.error(f"Error in /generate: {e}")
        return jsonify({"error": "An error occurred on the server."}), 500


# Route for speech-to-text
@app.route("/speech-to-text", methods=["POST"])
def convert_speech():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    try:
        audio_file = request.files["audio"]
        mp4_path = "input_audio.mp4"
        wav_path = "input_audio.wav"

        # Save the uploaded file as MP4
        audio_file.save(mp4_path)
        app.logger.info(f"Audio file saved as {mp4_path}")

        # Convert MP4 to WAV for speech recognition
        from pydub import AudioSegment
        audio = AudioSegment.from_file(mp4_path, format="mp3")
        audio.export(wav_path, format="wav")
        app.logger.info(f"Converted {mp4_path} to {wav_path}")

        # Convert to text
        text = speech_to_text(wav_path)
        return jsonify({"text": text, "mp4_file": mp4_path})

    except Exception as e:
        app.logger.error(f"Error processing audio: {e}")
        return jsonify({"error": "An error occurred while processing the audio."}), 500



# Route to fetch chat history
@app.route("/history", methods=["GET"])
def get_history():
    history = session.get("history", [])
    return jsonify({"history": history})

# Home route for frontend
@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
