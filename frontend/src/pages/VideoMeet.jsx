import { useEffect, useRef, useState } from "react";
import { TextField, Button, IconButton, Badge } from "@mui/material";
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  CallEnd,
  ScreenShare,
  StopScreenShare,
  Chat,
} from "@mui/icons-material";
import { io } from "socket.io-client";
import "../styles/VideoMeet.css";

// ===============================
// 🌐 Global Configurations
// ===============================
const SERVER_URL = "http://localhost:8080";
let connections = {}; // Store all RTCPeerConnections
const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// ===============================
// 🎥 Main Component
// ===============================
export default function VideoMeet() {
  // 🔗 Refs
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const videoRef = useRef([]);

  // 🎚️ States
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [showModel, setShowModel] = useState(false);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [videos, setVideos] = useState([]);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const chatMessagesRef = useRef(null);

  // ===============================
  // 🔒 Request Permissions
  // ===============================
  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      setVideoAvailable(!!videoPermission);

      const audioPermission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioAvailable(!!audioPermission);

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);

      if (videoPermission || audioPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        window.localStream = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play();
        }
      }
    } catch (err) {
      console.error("Permission error:", err.message);
    }
  };

  useEffect(() => {
    getPermissions();
  }, []);

  // ===============================
  // 🎥 Start/Stop User Media
  // ===============================
  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video, audio })
        .then((stream) => {
          window.localStream = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch((err) => console.error(err));
          }
          console.log("Local stream started ✅");
        })
        .catch((err) => console.error("Error:", err.message));
    } else {
      const tracks = localVideoRef.current?.srcObject?.getTracks();
      tracks?.forEach((track) => track.stop());
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) getUserMedia();
  }, [audio, video]);

  // ===============================
  // 📩 Handle Incoming Socket Signals
  // ===============================
  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId === socketIdRef.current) return;

    // Create connection if not exists
    if (!connections[fromId]) {
      connections[fromId] = new RTCPeerConnection(peerConfigConnections);

      // ICE candidates
      connections[fromId].onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit(
            "signal",
            fromId,
            JSON.stringify({ ice: event.candidate })
          );
        }
      };

      // Remote stream
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

      // Add local tracks
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => {
          connections[fromId].addTrack(track, window.localStream);
        });
      }
    }

    // Handle SDP
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

    // Handle ICE
    if (signal.ice) {
      connections[fromId]
        .addIceCandidate(new RTCIceCandidate(signal.ice))
        .catch(console.error);
    }
  };

  // ===============================
  // 🔌 Connect to Socket.IO Server
  // ===============================
  const connectToSocketServer = () => {
    socketRef.current = io(SERVER_URL, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      console.log("Connected to signaling server ✅");

      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      // Chat messages from server
      socketRef.current.on("chat-message", (message, sender, senderId) => {
        const msg = {
          content: message,
          sender,
          senderId,
          isSelf: senderId === socketIdRef.current,
        };
        setMessages((prev) => [...prev, msg]);

        if (!showModel) {
          setUnreadCount((n) => n + 1);
        }

        // Auto-scroll
        setTimeout(() => {
          if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop =
              chatMessagesRef.current.scrollHeight;
          }
        }, 50);
      });

      socketRef.current.on("user-left", (id) => {
        setVideos((prev) => prev.filter((v) => v.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
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
            window.localStream.getTracks().forEach((track) => {
              connections[id].addTrack(track, window.localStream);
            });
          }
        }

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

  // ===============================
  // ▶️ Join Meeting
  // ===============================
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
      connectToSocketServer();
    } catch (err) {
      console.error("Media error:", err);
    }
  };

  const connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  // ===============================
  // 🖥️ Screen Sharing
  // ===============================
  const getDisplayMediaSuccess = (stream) => {
    try {
      // Stop any previous camera tracks
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.error("Error stopping old tracks:", e);
    }

    // Set new local stream to screen share
    window.localStream = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    // Replace the outgoing video track in all peer connections
    Object.keys(connections).forEach((id) => {
      const sender = connections[id]
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");

      if (sender && stream.getVideoTracks().length > 0) {
        sender
          .replaceTrack(stream.getVideoTracks()[0])
          .then(() => console.log(`✅ Replaced video track for ${id}`))
          .catch((err) => console.error("replaceTrack error:", err));
      }
    });

    // When the user stops screen sharing
    stream.getTracks().forEach((track) => {
      track.onended = async () => {
        console.log("🛑 Screen sharing stopped — reverting to camera");
        setScreen(false);

        try {
          // Get normal camera+mic again
          const newStream = await navigator.mediaDevices.getUserMedia({
            video,
            audio,
          });
          window.localStream = newStream;

          // Update local video
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = newStream;
          }

          // Replace video tracks for all connected peers
          Object.keys(connections).forEach((id) => {
            const sender = connections[id]
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");

            if (sender && newStream.getVideoTracks().length > 0) {
              sender.replaceTrack(newStream.getVideoTracks()[0]);
            }
          });

          // 💡 Force remote videos to refresh visually
          setVideos((prev) =>
            prev.map((v) => {
              if (v.stream && v.stream.getVideoTracks().length > 0) {
                return { ...v, stream: new MediaStream(v.stream.getTracks()) };
              }
              return v;
            })
          );
        } catch (err) {
          console.error("Error reverting to camera:", err);
        }
      };
    });
  };

  const getDisplayMedia = () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true })
        .then(getDisplayMediaSuccess)
        .catch((e) => console.error("Screen share error:", e));
    }
  };

  useEffect(() => {
    if (screen !== undefined) getDisplayMedia();
  }, [screen]);

  // Toggle screen sharing: start when `screen` is false, stop and revert to camera when true
  const toggleScreenShare = async () => {
    if (!screen) {
      setScreen(true);
      // start screen sharing (effect will call getDisplayMedia), but call directly to be explicit
      getDisplayMedia();
      return;
    }

    // Stop screen sharing and revert to camera
    setScreen(false);
    try {
      // Stop current tracks (likely screen tracks)
      try {
        window.localStream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }

      // Get camera+mic again
      const newStream = await navigator.mediaDevices.getUserMedia({
        video,
        audio,
      });
      window.localStream = newStream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }

      // Replace outgoing video track for all peer connections
      Object.keys(connections).forEach((id) => {
        try {
          const sender = connections[id]
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");

          if (sender && newStream.getVideoTracks().length > 0) {
            sender.replaceTrack(newStream.getVideoTracks()[0]);
          }
        } catch (err) {
          console.error("Error replacing track for", id, err);
        }
      });

      // Force remote video refresh
      setVideos((prev) =>
        prev.map((v) => {
          if (v.stream && v.stream.getVideoTracks().length > 0) {
            return { ...v, stream: new MediaStream(v.stream.getTracks()) };
          }
          return v;
        })
      );
    } catch (err) {
      console.error("Error reverting to camera after screen share:", err);
    }
  };

  // ===============================
  // 🖼️ UI Layout
  // ===============================
  return (
    <div className="videomeet-container text-center">
      {askForUsername ? (
        // 🏠 Lobby
        <div className="lobby">
          <h2>Enter the Lobby</h2>
          <TextField
            required
            id="outlined-basic"
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="username-input"
            InputProps={{ style: { color: "white" } }}
            InputLabelProps={{ style: { color: "#ccc" } }}
          />
          <Button variant="contained" onClick={connect} className="connect-btn">
            Connect
          </Button>
          <div className="lobby-video-wrapper">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="lobby-video"
            />
          </div>
        </div>
      ) : (
        // 📞 Meeting Room
        <div className="meetVideoContainer">
          {/* Chat Section */}

          {showModel && (
            <div className="chatRoom shadow">
              <div className="chatHeader">
                <h5 className="mb-0">Group Chat</h5>
                <IconButton
                  size="small"
                  onClick={() => {
                    setShowModel(false);
                    setUnreadCount(0);
                  }}
                >
                  <i className="fa-solid fa-xmark text-light"></i>
                </IconButton>
              </div>

              <div className="chatMessages" ref={chatMessagesRef}>
                {messages.length === 0 ? (
                  <div className="chatMessage">
                    <span className="sender">System</span>
                    <p>No messages yet. Say hello 👋</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`chatMessage ${msg.isSelf ? "self" : ""}`}
                    >
                      <span className="sender">
                        {msg.isSelf ? "You" : msg.sender}
                      </span>
                      <p>{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="chatInputBox">
                <input
                  type="text"
                  className="chatInput"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && newMessage.trim()) {
                      socketRef.current.emit(
                        "chat-message",
                        newMessage.trim(),
                        username || "Anonymous"
                      );
                      setNewMessage("");
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  className="sendBtn"
                  onClick={() => {
                    if (newMessage.trim()) {
                      socketRef.current.emit(
                        "chat-message",
                        newMessage.trim(),
                        username || "Anonymous"
                      );
                      setNewMessage("");
                    }
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          )}

          <div className="buttonContainer">
            <IconButton
              className="control-btn"
              onClick={() => setVideo(!video)}
            >
              {video ? <Videocam /> : <VideocamOff />}
            </IconButton>

            <IconButton className="control-btn end-call">
              <CallEnd />
            </IconButton>

            <IconButton
              className="control-btn"
              onClick={() => setAudio(!audio)}
            >
              {audio ? <Mic /> : <MicOff />}
            </IconButton>

            <IconButton className="control-btn" onClick={toggleScreenShare}>
              {screen ? <StopScreenShare /> : <ScreenShare />}
            </IconButton>

            <Badge badgeContent={unreadCount} color="warning" max={999}>
              <IconButton
                className="control-btn"
                onClick={() => {
                  setShowModel(!showModel);
                  setUnreadCount(0);
                }}
              >
                <Chat />
              </IconButton>
            </Badge>
          </div>

          {/* Local Video */}
          <video
            className="meetUserVideo"
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
          />

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
