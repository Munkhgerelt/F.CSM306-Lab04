import express from "express";
import http from "http";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

const serverName = process.argv[2] || "A";
const port = Number(process.argv[3] || (serverName === "A" ? 8001 : 8002));
const peerPort = Number(process.argv[4] || (serverName === "A" ? 8002 : 8001));

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const clients = new Map();
const seenMessages = new Set();
let messageSequence = 0;
let peerSocket = null;

app.get("/", (_request, response) => {
  response.json({
    server: serverName,
    port,
    peerPort,
    clients: Array.from(clients.values()),
    peerConnected: Boolean(peerSocket?.connected)
  });
});

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    server: serverName,
    port,
    clients: clients.size,
    peerConnected: Boolean(peerSocket?.connected)
  });
});

app.get("/clients", (_request, response) => {
  response.json({
    server: serverName,
    clients: Array.from(clients.values())
  });
});

io.on("connection", (socket) => {
  const auth = socket.handshake.auth || {};

  if (auth.role === "server") {
    socket.data.isPeer = true;
    socket.data.serverName = auth.serverName || "unknown";
    console.log(`[${serverName}] peer server connected: ${socket.data.serverName}`);

    socket.on("server:message", (message) => {
      deliverMessage(message, false);
    });

    socket.on("disconnect", () => {
      console.log(`[${serverName}] peer server disconnected: ${socket.data.serverName}`);
    });

    return;
  }

  const clientId = normalizeClientId(auth.clientId);
  socket.data.clientId = clientId;
  clients.set(socket.id, clientId);
  console.log(`[${serverName}] client ${clientId} connected`);
  broadcastClientList();

  socket.emit("server:assigned", {
    server: serverName,
    port,
    clientId
  });

  socket.on("chat:message", (payload = {}) => {
    const text = String(payload.text || "").trim();
    if (!text) {
      return;
    }

    const message = {
      id: `${serverName}-${Date.now()}-${++messageSequence}`,
      fromClientId: clientId,
      fromServer: serverName,
      text,
      timestamp: new Date().toISOString()
    };

    deliverMessage(message, true);
  });

  socket.on("disconnect", () => {
    clients.delete(socket.id);
    console.log(`[${serverName}] client ${clientId} disconnected`);
    broadcastClientList();
  });
});

function normalizeClientId(value) {
  const text = String(value ?? "").trim();
  return text || "anonymous";
}

function deliverMessage(message, relayToPeer) {
  if (!message?.id || seenMessages.has(message.id)) {
    return;
  }

  seenMessages.add(message.id);
  if (seenMessages.size > 1000) {
    const oldest = seenMessages.values().next().value;
    seenMessages.delete(oldest);
  }

  const payload = {
    ...message,
    deliveredBy: serverName
  };

  io.sockets.sockets.forEach((socket) => {
    if (!socket.data.isPeer) {
      socket.emit("chat:broadcast", payload);
    }
  });

  if (relayToPeer && peerSocket?.connected) {
    peerSocket.emit("server:message", message);
  }
}

function broadcastClientList() {
  const payload = {
    server: serverName,
    clients: Array.from(clients.values()),
    count: clients.size
  };

  io.sockets.sockets.forEach((socket) => {
    if (!socket.data.isPeer) {
      socket.emit("clients:update", payload);
    }
  });
}

function connectToPeer() {
  const peerUrl = `http://localhost:${peerPort}`;
  peerSocket = createClient(peerUrl, {
    auth: {
      role: "server",
      serverName
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 1000
  });

  peerSocket.on("connect", () => {
    console.log(`[${serverName}] connected to peer at ${peerUrl}`);
  });

  peerSocket.on("connect_error", () => {
    console.log(`[${serverName}] waiting for peer at ${peerUrl}`);
  });

  peerSocket.on("disconnect", () => {
    console.log(`[${serverName}] lost peer connection to ${peerUrl}`);
  });
}

httpServer.listen(port, () => {
  console.log(`[${serverName}] listening on http://localhost:${port}`);
  connectToPeer();
});
