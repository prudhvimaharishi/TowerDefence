/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BattleState,
  Faction,
  BuildingType,
  UnitType,
  Lane,
} from './src/game/types';
import {
  createInitialGameState,
  placeBuilding,
  upgradeBuilding,
  demolishBuilding,
  deployUnit,
  upgradeTroopTier,
  stepBattleSimulation,
  stepBotAI,
  commandUnitsMove,
  setBarracksConfig,
} from './src/game/rules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// JSON body parser
app.use(express.json());

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Room State Management
interface RoomSession {
  roomId: string;
  state: BattleState;
  clients: Map<WebSocket, Faction>;
  intervalId: NodeJS.Timeout | null;
}

const rooms = new Map<string, RoomSession>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastRoom(room: RoomSession, message: object) {
  const data = JSON.stringify(message);
  for (const [client] of room.clients.entries()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function startRoomLoop(room: RoomSession) {
  if (room.intervalId) return;

  const dt = 0.05; // 20 Hz
  room.intervalId = setInterval(() => {
    if (room.state.status === 'playing') {
      stepBattleSimulation(room.state, dt);
      if (room.state.mode === 'ai') {
        stepBotAI(room.state, dt);
      }
    }
    broadcastRoom(room, {
      type: 'state:update',
      state: room.state,
    });
  }, 50);
}

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentFaction: Faction = 'royal';

  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'room:create') {
        const mode = msg.mode === 'ai' ? 'ai' : 'multiplayer';
        const code = generateRoomCode();
        const state = createInitialGameState(code, mode, msg.mapId || 'ironhold_chasm');
        currentRoomId = code;
        currentFaction = 'royal';

        const roomSession: RoomSession = {
          roomId: code,
          state,
          clients: new Map([[ws, 'royal']]),
          intervalId: null,
        };

        rooms.set(code, roomSession);
        startRoomLoop(roomSession);

        ws.send(JSON.stringify({
          type: 'room:joined',
          roomId: code,
          faction: 'royal',
          state,
        }));
      } else if (msg.type === 'room:join') {
        const code = (msg.roomId || '').toUpperCase();
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Room "${code}" not found.`,
          }));
          return;
        }

        currentRoomId = code;
        // If room has < 2 clients, assign infernal
        currentFaction = 'infernal';
        room.clients.set(ws, 'infernal');
        room.state.players.infernal.connected = true;

        ws.send(JSON.stringify({
          type: 'room:joined',
          roomId: code,
          faction: 'infernal',
          state: room.state,
        }));

        broadcastRoom(room, {
          type: 'player:connected',
          faction: 'infernal',
        });
      } else if (msg.type === 'action:build') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = placeBuilding(room.state, currentFaction, msg.buildingType as BuildingType, msg.gridX, msg.gridZ);
        if (res.success) {
          broadcastRoom(room, { type: 'event:built', building: res.building });
        } else {
          ws.send(JSON.stringify({ type: 'action:rejected', reason: res.reason }));
        }
      } else if (msg.type === 'action:upgrade') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = upgradeBuilding(room.state, currentFaction, msg.buildingId);
        if (res.success) {
          broadcastRoom(room, { type: 'event:upgraded', buildingId: msg.buildingId });
        } else {
          ws.send(JSON.stringify({ type: 'action:rejected', reason: res.reason }));
        }
      } else if (msg.type === 'action:demolish') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = demolishBuilding(room.state, currentFaction, msg.buildingId);
        if (res.success) {
          broadcastRoom(room, { type: 'event:demolished', buildingId: msg.buildingId, refund: res.refund });
        }
      } else if (msg.type === 'action:deploy') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = deployUnit(
          room.state,
          currentFaction,
          msg.unitType as UnitType,
          msg.lane as Lane,
          msg.spawnX,
          msg.spawnZ
        );
        if (res.success) {
          broadcastRoom(room, { type: 'event:deployed', unit: res.unit });
          broadcastRoom(room, { type: 'state:update', state: room.state });
        } else {
          ws.send(JSON.stringify({ type: 'action:rejected', reason: res.reason }));
        }
      } else if (msg.type === 'action:upgrade_tech') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = upgradeTroopTier(room.state, currentFaction, msg.unitType as UnitType);
        if (res.success) {
          broadcastRoom(room, { type: 'event:tech_upgraded', unitType: msg.unitType });
        }
      } else if (msg.type === 'action:move_units') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = commandUnitsMove(
          room.state,
          currentFaction,
          Array.isArray(msg.unitIds) ? msg.unitIds : [],
          Number(msg.destX),
          Number(msg.destZ)
        );
        if (res.success) {
          broadcastRoom(room, { type: 'state:update', state: room.state });
        }
      } else if (msg.type === 'action:barracks_config') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        const res = setBarracksConfig(
          room.state,
          currentFaction,
          msg.buildingId,
          msg.producingUnitType,
          msg.rallyX,
          msg.rallyZ
        );
        if (res.success) {
          broadcastRoom(room, { type: 'state:update', state: room.state });
        }
      } else if (msg.type === 'action:rematch') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;

        room.state = createInitialGameState(room.roomId, room.state.mode, room.state.mapId);
        broadcastRoom(room, { type: 'state:update', state: room.state });
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.clients.delete(ws);
        if (room.clients.size === 0) {
          if (room.intervalId) clearInterval(room.intervalId);
          rooms.delete(currentRoomId);
        } else {
          broadcastRoom(room, { type: 'player:disconnected', faction: currentFaction });
        }
      }
    }
  });
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Crown & Cinder Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
