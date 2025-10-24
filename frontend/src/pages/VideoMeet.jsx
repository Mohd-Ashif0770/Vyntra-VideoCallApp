import { useEffect, useRef, useState } from "react";
import { TextField, Button, IconButton, Badge } from "@mui/material";
import { Videocam, VideocamOff, Mic, MicOff, CallEnd, ScreenShare, StopScreenShare, Chat } from "@mui/icons-material";

import { io } from "socket.io-client";
import "../styles/VideoMeet.css";

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
  const [newMessage, setNewMessage] = useState(20);
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
          await localVideoRef.current
            .play()
            .catch((err) => console.error("Autoplay error:", err));
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
  // Ensure a RTCPeerConnection exists for the remote peer before using it.
  // This lets a joining client respond to offers even if it hasn't created
  // a connection object yet.
  // ==================================================
  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);

    // Ignore own messages
    if (fromId === socketIdRef.current) return;

    // Lazily create a connection object for this peer if it doesn't exist
    if (!connections[fromId]) {
      connections[fromId] = new RTCPeerConnection(peerConfigConnections);

      // forward ICE candidates to the remote peer
      connections[fromId].onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit(
            "signal",
            fromId,
            JSON.stringify({ ice: event.candidate })
          );
        }
      };

      // modern ontrack handler (use streams[0])
      connections[fromId].ontrack = (event) => {
        const remoteStream = event.streams && event.streams[0];
        if (!remoteStream) return;

        const videoExists = videoRef.current.find((v) => v.socketId === fromId);
        if (videoExists) {
          setVideos((prev) =>
            prev.map((v) =>
              v.socketId === fromId ? { ...v, stream: remoteStream } : v
            )
          );
        } else {
          const newVideo = {
            socketId: fromId,
            stream: remoteStream,
            autoPlay: true,
            playsInline: true,
          };
          setVideos((prev) => [...prev, newVideo]);
          videoRef.current.push(newVideo);
        }
      };

      // add local tracks if available
      if (window.localStream) {
        try {
          window.localStream.getTracks().forEach((track) => {
            connections[fromId].addTrack(track, window.localStream);
          });
        } catch (err) {
          console.error("Error adding local tracks:", err);
        }
      }
    }

    // Handle SDP (offer/answer)
    if (signal.sdp) {
      connections[fromId]
        .setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => {
          if (signal.sdp.type === "offer") {
            connections[fromId]
              .createAnswer()
              .then((description) =>
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
                  })
              )
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

      // When a new user joins: existing peers should create an offer to the
      // new peer. The server sends `id` (the new user's socket id) and the
      // full clients list.
      socketRef.current.on("user-joined", (id, clients) => {
        // Create (or reuse) a connection object for the joining peer
        if (!connections[id]) {
          connections[id] = new RTCPeerConnection(peerConfigConnections);

          connections[id].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          connections[id].ontrack = (event) => {
            const remoteStream = event.streams && event.streams[0];
            if (!remoteStream) return;

            const videoExists = videoRef.current.find((v) => v.socketId === id);
            if (videoExists) {
              setVideos((prev) =>
                prev.map((v) =>
                  v.socketId === id ? { ...v, stream: remoteStream } : v
                )
              );
            } else {
              const newVideo = {
                socketId: id,
                stream: remoteStream,
                autoPlay: true,
                playsInline: true,
              };
              setVideos((prev) => [...prev, newVideo]);
              videoRef.current.push(newVideo);
            }
          };

          if (window.localStream) {
            try {
              window.localStream.getTracks().forEach((track) => {
                connections[id].addTrack(track, window.localStream);
              });
            } catch (err) {
              console.error("Error adding local tracks:", err);
            }
          }
        }

        // If I'm an existing peer, create an offer to the newly joined client
        if (socketIdRef.current && socketIdRef.current !== id) {
          connections[id]
            .createOffer()
            .then((description) =>
              connections[id].setLocalDescription(description)
            )
            .then(() => {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              );
            })
            .catch(console.error);
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
  <div className="videomeet-container text-center">
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
          className="username-input"
        />

        <Button variant="contained" onClick={connect} className="connect-btn">
          Connect
        </Button>

        <div className="lobby-video-wrapper">
          <video ref={localVideoRef} autoPlay muted playsInline className="lobby-video" />
          
        </div>
      </div>
    ) : (
      // 📞 Meeting Room
      <div className="meetVideoContainer">
        <div className="buttonContainer">
          <IconButton className="control-btn" onClick={() => setVideo(!video)}>
            {video ? <Videocam /> : <VideocamOff />}
          </IconButton>

          <IconButton className="control-btn end-call">
            <CallEnd />
          </IconButton>

          <IconButton className="control-btn" onClick={() => setAudio(!audio)}>
            {audio ? <Mic /> : <MicOff />}
          </IconButton>

          <IconButton className="control-btn">
            {screen ? <ScreenShare /> : <StopScreenShare />}
          </IconButton>

          <Badge badgeContent={newMessage} color="warning" max={999}>
            <IconButton className="control-btn">
              <Chat />
            </IconButton>
          </Badge>
        </div>

        {/* Local Video */}
        <video className="meetUserVideo" ref={localVideoRef} autoPlay muted playsInline />
        

        {/* Remote Participants */}
        <div className="remoteVideosContainer">
          {videos.map((video) => (
            <div key={video.socketId}>
              <video
                data-socket={video.socketId}
                ref={(ref) => {
                  if (ref && video.stream) ref.srcObject = video.stream;
                }}
                autoPlay
                playsInline
                className="remoteVideo"
              />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

}
