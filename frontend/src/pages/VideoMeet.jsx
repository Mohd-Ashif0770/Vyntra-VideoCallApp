import { useEffect, useRef, useState } from "react";
import "../styles/VideoMeet.css";
import { TextField, Button } from "@mui/material";
import { io } from "socket.io-client";

// =========================
// 🔧 Global Configuration
// =========================
const SERVER_URL = "http://localhost:8080"; // Your backend server
let connections = {}; // Stores active peer connections

// WebRTC ICE (STUN) configuration
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// =========================
// 🎥 Main Component
// =========================
export default function VideoMeet() {
  // 🔗 Refs
  const socketRef = useRef(); // Socket instance
  const socketIdRef = useRef(); // Unique socket ID
  const localVideoRef = useRef(); // Local video DOM reference
  const videoRef = useRef([]); // To track all remote videos

  // 🎚️ State Variables
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [videos, setVideos] = useState([]); // All remote video streams
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  // ==================================================
  // 🔒 Get Camera, Mic & Screen Permissions
  // ==================================================
  const getPermissions = async () => {
    try {
      // 🎥 Request camera access
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setVideoAvailable(!!videoPermission);

      // 🎙️ Request microphone access
      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioAvailable(!!audioPermission);

      // 🖥️ Check if screen sharing API is available
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

      // 🎬 Initialize local stream (if permissions granted)
      if (videoPermission || audioPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        window.localStream = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Permission error:", err.message);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  // ==================================================
  // 📡 Get User Media Stream (Start/Stop)
  // ==================================================
  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      // Start camera + mic
      navigator.mediaDevices
        .getUserMedia({ video, audio })
        .then((stream) => {
          window.localStream = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          console.log("Local stream started ✅");
        })
        .catch((err) => console.error("Error:", err.message));
    } else {
      // Stop current tracks
      try {
        const tracks = localVideoRef.current?.srcObject?.getTracks();
        tracks?.forEach((track) => track.stop());
      } catch (err) {
        console.error("Error stopping tracks:", err.message);
      }
    }
  };

  // Re-run when user toggles audio/video
  useEffect(() => {
    if (video !== undefined && audio !== undefined) getUserMedia();
  }, [audio, video]);

  // ==================================================
  // 📩 Handle Incoming Signaling Messages
  // ==================================================
  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);

    // Ignore own messages
    if (fromId !== socketIdRef.current) {
      // Handle SDP (offer/answer)
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            // If remote sent an offer, create an answer
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
                      );
                    });
                })
                .catch(console.error);
            }
          })
          .catch(console.error);
      }

      // Handle ICE candidate
      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch(console.error);
      }
    }
  };

  // ==================================================
  // 🔌 Connect to Socket.IO Server
  // ==================================================
  const connectToSocketServer = () => {
    // Connect to backend
    socketRef.current = io(SERVER_URL, { secure: false });

    // Handle incoming signals
    socketRef.current.on("signal", gotMessageFromServer);

    // On successful connection
    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server ✅");

      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      // Handle user leaving the call
      socketRef.current.on("user-left", (id) => {
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
      });

      // Handle new users joining
      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          // Create peer connection for each client
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

          // ICE candidate handler
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Remote stream handler
          connections[socketListId].onaddstream = (event) => {
            const videoExists = videoRef.current.find(
              (v) => v.socketId === socketListId
            );

            if (videoExists) {
              // Update existing stream
              setVideos((prev) =>
                prev.map((v) =>
                  v.socketId === socketListId
                    ? { ...v, stream: event.stream }
                    : v
                )
              );
            } else {
              // Add new remote stream
              const newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoPlay: true,
                playsInline: true,
              };
              setVideos((prev) => [...prev, newVideo]);
              videoRef.current.push(newVideo);
            }
          };

          // Add local stream
          if (window.localStream) {
            connections[socketListId].addStream(window.localStream);
          }
        });

        // If I’m the one who joined, send offers to others
        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            connections[id2].addStream(window.localStream);
            connections[id2]
              .createOffer()
              .then((description) => {
                connections[id2].setLocalDescription(description);
                socketRef.current.emit(
                  "signal",
                  id2,
                  JSON.stringify({
                    sdp: connections[id2].localDescription,
                  })
                );
              })
              .catch(console.error);
          }
        }
      });
    });
  };

  // ==================================================
  // ▶️ Entry Point (after username entered)
  // ==================================================
  const getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  // ==================================================
  // 🖼️ Render UI
  // ==================================================
  return (
    <div className="videomeet-container">
      {askForUsername ? (
        // 🏠 Lobby screen before joining
        <div className="lobby">
          <h2>Enter to Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginBottom: "1rem" }}
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>

          {/* Preview local camera */}
          <div className="video-preview">
            <video ref={localVideoRef} autoPlay muted />
          </div>
        </div>
      ) : (
        // 📞 Active call screen
        <div className="meeting-room">
          {/* Local video */}
          <video ref={localVideoRef} autoPlay muted className="local-video" />

          {/* Remote videos */}
          {videos.map((video) => (
            <div key={video.socketId} className="remote-video">
              <video
                autoPlay
                playsInline
                ref={(ref) => {
                  if (ref) ref.srcObject = video.stream;
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
