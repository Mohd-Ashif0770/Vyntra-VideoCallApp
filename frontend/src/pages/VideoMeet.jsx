import { useEffect, useRef, useState } from "react";
import { TextField, Button } from "@mui/material";
import { io } from "socket.io-client";

// =========================
// 🌐 Global Configurations
// =========================
const SERVER_URL = "http://localhost:8080"; // Backend signaling server
let connections = {}; // Stores all active RTCPeerConnections

// WebRTC ICE (STUN) server setup
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// =========================
// 🎥 Main VideoMeet Component
// =========================
export default function VideoMeet() {
  // 🔗 Refs
  const socketRef = useRef(); // Socket.io instance
  const socketIdRef = useRef(); // Stores unique socket ID
  const localVideoRef = useRef(); // Local video DOM element
  const videoRef = useRef([]); // Tracks all remote video refs

  // 🎚️ State Variables
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [videos, setVideos] = useState([]); // All remote participants
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  // ==================================================
  // 🔒 Request Camera, Mic, and Screen Permissions
  // ==================================================
  const getPermissions = async () => {
    try {
      // Request camera access
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setVideoAvailable(!!videoPermission);

      // Request microphone access
      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioAvailable(!!audioPermission);

      // Check for screen sharing API
      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

      // Initialize local stream
      if (videoPermission || audioPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        window.localStream = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch((err) =>
            console.error("Autoplay error:", err)
          );
        }
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
            localVideoRef.current
              .play()
              .catch((err) => console.error("Autoplay error:", err));
          }
          console.log("Local stream started ✅");
        })
        .catch((err) => console.error("Error:", err.message));
    } else {
      // Stop all tracks
      try {
        const tracks = localVideoRef.current?.srcObject?.getTracks();
        tracks?.forEach((track) => track.stop());
      } catch (err) {
        console.error("Error stopping tracks:", err.message);
      }
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) getUserMedia();
  }, [audio, video]);

  // ==================================================
  // 📩 Handle Incoming Socket Signals
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
    socketRef.current = io(SERVER_URL, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server ✅");

      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      // When a user leaves
      socketRef.current.on("user-left", (id) => {
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
      });

      // When a new user joins
      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          // Create PeerConnection for each participant
          connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

          // Handle ICE candidates
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          // Handle remote video stream
          connections[socketListId].onaddstream = (event) => {
            const videoExists = videoRef.current.find(
              (v) => v.socketId === socketListId
            );

            if (videoExists) {
              setVideos((prev) =>
                prev.map((v) =>
                  v.socketId === socketListId
                    ? { ...v, stream: event.stream }
                    : v
                )
              );
            } else {
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

          // Add local stream to the connection
          if (window.localStream) {
            connections[socketListId].addStream(window.localStream);
          }
        });

        // If current user joined, send offers to all
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
  // ▶️ Entry Point: Join Meeting
  // ==================================================
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      window.localStream = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }

      connectToSocketServer(); // Connect only after stream ready
    } catch (err) {
      console.error("Media error:", err);
    }
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  // ==================================================
  // 🖼️ UI Layout
  // ==================================================
  return (
    <div
      className="videomeet-container"
      style={{
        textAlign: "center",
        padding: "2rem",
        background: "#f9f9f9",
        minHeight: "100vh",
      }}
    >
      {askForUsername ? (
        // 🏠 Lobby
        <div className="lobby">
          <h2>Enter the Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginBottom: "1rem" }}
          />
          <br />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>

          <div style={{ marginTop: "2rem" }}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "400px",
                height: "300px",
                backgroundColor: "black",
                borderRadius: "10px",
              }}
            />
          </div>
        </div>
      ) : (
        // 📞 Meeting Room
        <div>
          <h3>Meeting in progress...</h3>

          {/* Local Video */}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "400px",
              height: "300px",
              backgroundColor: "black",
              borderRadius: "10px",
              marginBottom: "1rem",
            }}
          />

          {/* Remote Participants */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "1rem",
            }}
          >
            {videos.map((video) => (
              <div key={video.socketId}>
                <h4>{video.socketId}</h4>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) ref.srcObject = video.stream;
                  }}
                  autoPlay
                  playsInline
                  style={{
                    width: "400px",
                    height: "300px",
                    backgroundColor: "black",
                    borderRadius: "10px",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
