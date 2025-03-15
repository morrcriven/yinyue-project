async function fetchChatHistory() {
    const response = await fetch("/history");
    const data = await response.json();
    const historyContainer = document.getElementById("chatHistory");
    historyContainer.innerHTML = ""; // Clear previous history

    if (data.history.length === 0) {
        historyContainer.innerHTML = "<p>No previous chats yet.</p>";
        return;
    }

    data.history.forEach((entry) => {
        const historyItem = `
            <div>
                <strong>You:</strong> ${entry.user} <br>
                <strong>Bot:</strong> ${entry.bot}
            </div>
            <hr>
        `;
        historyContainer.innerHTML += historyItem;
    });
}

async function sendMessage() {
    const userInput = document.getElementById("userInput").value.trim();

    // Validate input
    if (!userInput) {
        alert("Please enter a message before sending.");
        return;
    }

    try {
        // Send user message to backend
        const response = await fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: userInput }),
        });

        if (!response.ok) {
            throw new Error("Failed to send message. Please try again.");
        }

        const data = await response.json();

        // Update chat display
        const chatDisplay = document.getElementById("chatDisplay");
        const userMessage = `<div class="bot-message" style="background-color:#cde6f7;">${userInput}</div>`;
        const botMessage = `<div class="bot-message">${data.reply}</div>`;
        chatDisplay.innerHTML += userMessage + botMessage;

        // Scroll to the latest message
        chatDisplay.scrollTop = chatDisplay.scrollHeight;

        // Clear input and play audio
        document.getElementById("userInput").value = "";
        const audio = new Audio(data.audio);
        audio.play();

        // Fetch updated chat history
        fetchChatHistory();
    } catch (error) {
        console.error(error);
        alert("An error occurred: " + error.message);
    }
}


function startRecording() {
    alert("Voice recording coming soon! Upload audio to test speech-to-text functionality.");
}

document.addEventListener("DOMContentLoaded", fetchChatHistory);

let mediaRecorder;
let audioChunks = [];

// Start Recording
function startRecording() {
navigator.mediaDevices.getUserMedia({ audio: true })
.then((stream) => {
    // Create a new MediaRecorder instance
    mediaRecorder = new MediaRecorder(stream);

    // Start recording
    mediaRecorder.start();
    document.getElementById("recordingStatus").innerText = "Recording...";

    // Collect audio chunks
    mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
    };

    // Enable the Stop button and disable the Start button
    document.getElementById("startRecording").disabled = true;
    document.getElementById("stopRecording").disabled = false;

    console.log("Recording started...");
})
.catch((error) => {
    console.error("Error accessing microphone:", error);
    alert("Microphone access is required for recording.");
});
}

// Stop Recording
function stopRecording() {
if (!mediaRecorder) {
    alert("No recording in progress.");
    return;
}

// Stop the MediaRecorder
mediaRecorder.stop();
document.getElementById("recordingStatus").innerText = "Processing...";

// Enable the Start button and disable the Stop button
document.getElementById("startRecording").disabled = false;
document.getElementById("stopRecording").disabled = true;

// Handle the recording data once stopped
mediaRecorder.onstop = async () => {
    console.log("Recording stopped.");
    document.getElementById("recordingStatus").innerText = "Recording stopped.";

    // Create a Blob from the collected audio chunks
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

    // Reset the chunks for future recordings
    audioChunks = [];

    // Send the audio to the backend for speech-to-text processing
    const formData = new FormData();
    formData.append("audio", audioBlob, "recorded_audio.wav");

    try {
        const response = await fetch("/speech-to-text", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            throw new Error("Error processing audio on the server.");
        }

        const data = await response.json();
        document.getElementById("recordingStatus").innerText = "Transcription complete.";
        alert("Transcription Result: " + data.text);

        // Optionally add transcribed text to the chat input
        document.getElementById("userInput").value = data.text;
    } catch (error) {
        console.error("Error:", error);
        alert("An error occurred while processing the audio.");
    }
};
}
