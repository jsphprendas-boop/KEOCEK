import { io } from "socket.io-client";

export const socket = io();

export const socketEvents = {
  DB_UPDATE: "db:update",
  NOTIFICATION: "notification",
  JOIN_DELEGATION: "join:delegation",
};
