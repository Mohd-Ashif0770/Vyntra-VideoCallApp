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

    // --- Join a call room ---
    socket.on("join-call", (path) => {
      if (!connections[path]) connections[path] = [];

      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      console.log(`📞 ${socket.id} joined room: ${path}`);

      // Notify all *other* users in this room
      for (let i = 0; i < connections[path].length; i++) {
        const clientId = connections[path][i];
        if (clientId !== socket.id) {
          io.to(clientId).emit("user-joined", socket.id, connections[path]);
        }
      }

      // Send previous chat messages (if any)
      if (Array.isArray(messages[path])) {
        messages[path].forEach((msg) => {
          io.to(socket.id).emit(
            "chat-message",
            msg.data,
            msg.sender,
            msg["socket-id-sender"]
          );
        });
      }
    });

    // --- Handle WebRTC signaling messages ---
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // --- Handle chat messages ---
    socket.on("chat-message", (data, sender) => {
      // Find which room the sender belongs to
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
        if (!messages[matchingRoom]) messages[matchingRoom] = [];

        messages[matchingRoom].push({
          sender,
          data,
          "socket-id-sender": socket.id,
        });

        console.log("💬", sender, "->", matchingRoom, ":", data);

        // Broadcast message to all clients in room
        connections[matchingRoom].forEach((id) => {
          io.to(id).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // --- Handle disconnection ---
    socket.on("disconnect", () => {
      const diffTime = Math.abs(new Date() - (timeOnline[socket.id] || 0));
      console.log(`❌ ${socket.id} disconnected after ${diffTime}ms`);

      for (const [room, users] of Object.entries(connections)) {
        if (users.includes(socket.id)) {
          // Notify others that user left
          users.forEach((id) => {
            io.to(id).emit("user-left", socket.id);
          });

          // Remove from connection list
          connections[room] = users.filter((id) => id !== socket.id);

          if (connections[room].length === 0) {
            delete connections[room];
          }
          break;
        }
      }

      delete timeOnline[socket.id];
    });
  });

  return io;
};
