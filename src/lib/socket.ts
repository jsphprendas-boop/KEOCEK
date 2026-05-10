import { io } from "socket.io-client";

export const socket = io({
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 45000
});

export const socketEvents = {
  DB_UPDATE: "db:update",
  NOTIFICATION: "notification",
  JOIN_DELEGATION: "join:delegation",
};
