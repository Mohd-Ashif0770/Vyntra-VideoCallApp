import { Server } from "socket.io";

const connections = {};
const messages = {};
const timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ A client connected:", socket.id);

    // --- Join call ---
    socket.on("join-call", (path) => {
      if (!connections[path]) {
        connections[path] = [];
      }

      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      // Notify existing users about new join
      for (let i = 0; i < connections[path].length; i++) {
        io.to(connections[path][i]).emit("user-joined", socket.id, connections[path]);
      }

      // Send existing messages to the new user
      if (messages[path]) {
        for (let i = 0; i < messages[path].length; i++) {
          io.to(socket.id).emit(
            "chat-message",
            messages[path][i].data,
            messages[path][i].sender,
            messages[path][i]["socket-id-sender"]
          );
        }
      }
    });

    // --- Handle signaling (WebRTC) ---
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // --- Handle chat messages ---
    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false]
      );

      if (found) {
        if (!messages[matchingRoom]) {
          messages[matchingRoom] = [];
        }

        messages[matchingRoom].push({
          sender,
          data,
          "socket-id-sender": socket.id,
        });

        console.log("💬 Message in room", matchingRoom, ":", sender, data);

        connections[matchingRoom].forEach((element) => {
          io.to(element).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // --- Handle disconnect ---
    socket.on("disconnect", () => {
      const diffTime = Math.abs(new Date() - timeOnline[socket.id]);
      console.log(`❌ ${socket.id} disconnected after ${diffTime} ms`);

      for (const [key, value] of Object.entries(connections)) {
        if (value.includes(socket.id)) {
          // Notify others user left
          value.forEach((id) => {
            io.to(id).emit("user-left", socket.id);
          });

          // Remove from connection list
          connections[key] = value.filter((id) => id !== socket.id);

          if (connections[key].length === 0) {
            delete connections[key];
          }
          break;
        }
      }

      delete timeOnline[socket.id];
    });
  });

  return io;
};
