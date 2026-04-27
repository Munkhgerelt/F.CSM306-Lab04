import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const gatewayPort = Number(process.env.GATEWAY_PORT || 8000);
const servers = {
  A: {
    name: "A",
    port: 8001,
    url: "http://localhost:8001"
  },
  B: {
    name: "B",
    port: 8002,
    url: "http://localhost:8002"
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.use(express.static(publicDir));

app.get("/route", async (request, response) => {
  const clientId = Number(request.query.clientId);
  if (!Number.isInteger(clientId) || clientId < 0) {
    response.status(400).json({
      error: "clientId must be a non-negative integer"
    });
    return;
  }

  const preferred = clientId % 2 === 0 ? servers.A : servers.B;
  const fallback = preferred.name === "A" ? servers.B : servers.A;
  const preferredHealth = await checkHealth(preferred);

  if (preferredHealth.ok) {
    response.json({
      clientId,
      selected: preferred.name,
      url: preferred.url,
      reason: preferred.name === "A" ? "even client ID" : "odd client ID",
      servers: await getStatus()
    });
    return;
  }

  const fallbackHealth = await checkHealth(fallback);
  if (fallbackHealth.ok) {
    response.json({
      clientId,
      selected: fallback.name,
      url: fallback.url,
      reason: `${preferred.name} unavailable; routed to ${fallback.name}`,
      servers: await getStatus()
    });
    return;
  }

  response.status(503).json({
    error: "No chat server is available",
    servers: await getStatus()
  });
});

app.get("/status", async (_request, response) => {
  response.json(await getStatus());
});

async function getStatus() {
  const [a, b] = await Promise.all([checkHealth(servers.A), checkHealth(servers.B)]);
  return {
    A: a,
    B: b
  };
}

function checkHealth(server) {
  return new Promise((resolve) => {
    const request = http.get(`${server.url}/health`, { timeout: 600 }, (response) => {
      let body = "";

      response.on("data", (chunk) => {
        body += chunk;
      });

      response.on("end", () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          resolve({
            name: server.name,
            url: server.url,
            ok: false
          });
          return;
        }

        try {
          resolve({
            name: server.name,
            url: server.url,
            ok: true,
            details: JSON.parse(body)
          });
        } catch {
          resolve({
            name: server.name,
            url: server.url,
            ok: true
          });
        }
      });
    });

    request.on("timeout", () => {
      request.destroy();
      resolve({
        name: server.name,
        url: server.url,
        ok: false
      });
    });

    request.on("error", () => {
      resolve({
        name: server.name,
        url: server.url,
        ok: false
      });
    });
  });
}

app.listen(gatewayPort, () => {
  console.log(`[gateway] listening on http://localhost:${gatewayPort}`);
});
