const connectForm = document.querySelector("#connect-form");
const clientIdInput = document.querySelector("#client-id");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const clientList = document.querySelector("#client-list");
const currentServer = document.querySelector("#current-server");
const routeReason = document.querySelector("#route-reason");
const connectionState = document.querySelector("#connection-state");
const serverA = document.querySelector("#server-a");
const serverB = document.querySelector("#server-b");
const refreshStatus = document.querySelector("#refresh-status");

const state = {
  clientId: null,
  socket: null,
  socketIoLoaded: false,
  route: null,
  failoverTimer: null
};

connectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.clientId = clientIdInput.value;
  await connectWithRouting();
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || !state.socket?.connected) {
    return;
  }

  state.socket.emit("chat:message", { text });
  messageInput.value = "";
  messageInput.focus();
});

refreshStatus.addEventListener("click", updateStatus);

async function connectWithRouting() {
  clearTimeout(state.failoverTimer);
  setConnectionState("Routing...");

  try {
    const route = await fetchRoute(state.clientId);
    state.route = route;
    updateServerStatus(route.servers);
    currentServer.textContent = `Server ${route.selected}`;
    routeReason.textContent = route.reason;

    await loadSocketIo(route.url);
    connectSocket(route);
  } catch (error) {
    setConnectionState(error.message);
    disableChat();
  }
}

async function fetchRoute(clientId) {
  const response = await fetch(`/route?clientId=${encodeURIComponent(clientId)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Routing failed");
  }
  return data;
}

function connectSocket(route) {
  if (state.socket) {
    state.socket.removeAllListeners();
    state.socket.disconnect();
  }

  const socket = window.io(route.url, {
    auth: {
      role: "client",
      clientId: state.clientId
    },
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 700
  });

  state.socket = socket;

  socket.on("connect", () => {
    setConnectionState(`Connected as client ${state.clientId}`);
    enableChat();
  });

  socket.on("server:assigned", (payload) => {
    currentServer.textContent = `Server ${payload.server}`;
  });

  socket.on("clients:update", (payload) => {
    renderClients(payload.clients || []);
  });

  socket.on("chat:broadcast", (message) => {
    appendMessage(message);
  });

  socket.on("disconnect", (reason) => {
    disableChat();
    setConnectionState(`Disconnected: ${reason}`);
    if (reason !== "io client disconnect") {
      scheduleFailover();
    }
  });

  socket.on("connect_error", () => {
    disableChat();
    setConnectionState("Connection failed; checking fallback");
    scheduleFailover();
  });
}

function scheduleFailover() {
  clearTimeout(state.failoverTimer);
  state.failoverTimer = setTimeout(() => {
    if (state.clientId !== null) {
      connectWithRouting();
    }
  }, 1000);
}

function enableChat() {
  messageInput.disabled = false;
  sendButton.disabled = false;
}

function disableChat() {
  messageInput.disabled = true;
  sendButton.disabled = true;
}

function setConnectionState(text) {
  connectionState.textContent = text;
}

async function updateStatus() {
  try {
    const response = await fetch("/status");
    updateServerStatus(await response.json());
  } catch {
    serverA.textContent = "unknown";
    serverB.textContent = "unknown";
  }
}

function updateServerStatus(status) {
  serverA.textContent = status?.A?.ok ? "online" : "offline";
  serverB.textContent = status?.B?.ok ? "online" : "offline";
}

function renderClients(clients) {
  clientList.replaceChildren();

  if (!clients.length) {
    const item = document.createElement("li");
    item.textContent = "No local clients";
    clientList.append(item);
    return;
  }

  clients.forEach((clientId) => {
    const item = document.createElement("li");
    item.textContent = `Client ${clientId}`;
    clientList.append(item);
  });
}

function appendMessage(message) {
  const item = document.createElement("article");
  const isOwnMessage = String(message.fromClientId) === String(state.clientId);
  item.className = `message ${isOwnMessage ? "message--own" : "message--other"}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `${isOwnMessage ? "You" : `Client ${message.fromClientId}`} via Server ${message.fromServer}`;

  const text = document.createElement("p");
  text.textContent = message.text;

  item.append(meta, text);
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
}

function loadSocketIo(serverUrl) {
  if (state.socketIoLoaded && window.io) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${serverUrl}/socket.io/socket.io.js`;
    script.onload = () => {
      state.socketIoLoaded = true;
      resolve();
    };
    script.onerror = () => {
      reject(new Error("Could not load Socket.IO client"));
    };
    document.body.append(script);
  });
}

updateStatus();
