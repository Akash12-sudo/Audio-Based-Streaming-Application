import { useState, useRef, useEffect } from "react";

const VoiceStreamingApp = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:8000");

    socketRef.current.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    socketRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("Received from server:", data);

      if (data.type === "audio") {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(data.payload), (c) => c.charCodeAt(0))],
          { type: "audio/mp3" }
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        playAudio(audioUrl);
      } else if (data.type === "text") {
        const cleanedText = data.payload.replace(/[*_`>]/g, ""); // Remove markdown symbols
        streamText(cleanedText);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socketRef.current.onclose = () => console.log("WebSocket closed.");

    return () => {
      socketRef.current.close();
    };
  }, []);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      const reader = new FileReader();

      reader.onloadend = () => {
        const base64Audio = reader.result.split(",")[1];
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({ type: "audio", payload: base64Audio })
          );
          console.log("Sent audio to server");
        } else {
          console.error("WebSocket not connected");
        }
      };

      reader.readAsDataURL(audioBlob);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
    setMessages([]);
    setCurrentMessage(""); // Clear previous messages when new recording starts
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const playAudio = (audioUrl) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    audio.play();
  };

  const streamText = (text) => {
    let index = 0;
    setCurrentMessage("");

    const interval = setInterval(() => {
      if (index < text.length) {
        setCurrentMessage((prev) => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        setMessages((prev) => [...prev, text]); // Store full message after streaming
      }
    }, 50); // Adjust speed as needed
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-4">🎙️ Real-Time Voice Streaming</h1>
      <button
        className={`px-6 py-3 text-lg rounded-lg ${
          isRecording ? "bg-red-500" : "bg-green-500"
        }`}
        onClick={isRecording ? stopRecording : startRecording}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      {/* <div className="mt-4 w-3/4 bg-gray-800 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Messages:</h2>
        {messages.map((msg, index) => (
          <p key={index} className="text-gray-300">
            {msg}
          </p>
        ))}
        {currentMessage && (
          <p className="text-gray-300 animate-pulse">{currentMessage}</p>
        )}
      </div> */}
    </div>
  );
};

export default VoiceStreamingApp;
