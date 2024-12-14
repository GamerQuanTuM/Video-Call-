import io from "socket.io-client";

// Create a singleton socket instance
let socket;

const url = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';

export const initiateSocketConnection = () => {
  socket = io(url, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Connected to Socket.IO server");
  });

  socket.on("connect_error", (error) => {
    console.log("Socket connection error:", error);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error(
      "Socket not initialized. Call initiateSocketConnection first."
    );
  }
  return socket;
};
