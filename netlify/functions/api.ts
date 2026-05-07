import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getStore } from '@netlify/blobs';

const JWT_SECRET = process.env.JWT_SECRET || "super_secure_random_secret";

const jsonResponse = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
  },
  body: JSON.stringify(body),
});

// Helper for Blobs with resilient fallback for local development
let memoryStore: Record<string, any> = {};

async function getData(key: string, fallback: any = []) {
  try {
    const store = getStore('padelbuddy-data');
    const value = await store.get(key, { type: 'json', consistency: 'strong' });
    return value || fallback;
  } catch (error: any) {
    if (error.name === 'MissingBlobsEnvironmentError') {
      return memoryStore[key] || fallback;
    }
    console.error(`Failed to read blob ${key}:`, error);
    return fallback;
  }
}

async function setData(key: string, value: any) {
  try {
    const store = getStore('padelbuddy-data');
    await store.setJSON(key, value);
  } catch (error: any) {
    if (error.name === 'MissingBlobsEnvironmentError') {
      memoryStore[key] = value;
      return;
    }
    console.error(`Failed to write blob ${key}:`, error);
    throw error;
  }
}

const DEFAULT_CLUBS = [
  { id: '1', name: 'Elite Padel Club', location: { city: 'Budapest' }, rating: 4.8, courts: 12 },
  { id: '2', name: 'Padel Palace', location: { city: 'Budapest' }, rating: 4.5, courts: 8 }
];

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { message: "OK" });
  }

  try {
    const { httpMethod: method, body } = event;
    const rawPath = event.path || '';
    const path = rawPath.replace('/.netlify/functions/api', '').replace('/api', '');
    
    const segments = path.split('/').filter(Boolean);
    const action = segments[0] || '';
    const itemId = segments[1] || '';
    const subAction = segments[2] || '';

    // Health check
    if (path === "/health" && method === "GET") {
      return jsonResponse(200, { success: true, message: "API is running" });
    }

    // CLUBS (Seed if needed)
    if (action === "clubs" && method === "GET") {
      let storedClubs = await getData('clubs', null);
      if (!storedClubs) {
        await setData('clubs', DEFAULT_CLUBS);
        storedClubs = DEFAULT_CLUBS;
      }
      return jsonResponse(200, { success: true, data: storedClubs });
    }

    // Shared loading logic
    const getUsers = () => getData('users');
    const getGames = () => getData('games');
    const getGroups = () => getData('groups');
    const getNotifications = () => getData('notifications');
    const getFriendRequests = () => getData('friendRequests');

    // Auth Helper
    const verifyAuth = async (tokenString?: string) => {
      if (!tokenString) return null;
      try {
        const decoded: any = jwt.verify(tokenString, JWT_SECRET);
        const users = await getUsers();
        return users.find((u: any) => u.id === decoded.userId || u.email === decoded.email) || null;
      } catch {
        return null;
      }
    };

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const tokenString = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;
    const authUser = await verifyAuth(tokenString);

    // AUTH: Register
    if (path === "/register" && method === "POST") {
      const userData = JSON.parse(body || "{}");
      const { name, email, password } = userData;
      if (!name || !email || !password || password.length < 6) {
        return jsonResponse(400, { success: false, message: "Invalid input data" });
      }

      const users = await getUsers();
      const normalizedEmail = email.toLowerCase().trim();
      if (users.find((u: any) => u.email === normalizedEmail)) {
        return jsonResponse(400, { success: false, message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = Math.random().toString(36).substr(2, 9);
      
      const newUser = {
        ...userData,
        id: userId,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        friendIds: [],
        blockedUserIds: [],
        favoritePlayerIds: [],
        requests: [],
        notificationSettings: userData.notificationSettings || {
          nearGames: true,
          reminders: true,
          groups: true,
          marketing: false
        },
        privacySettings: userData.privacySettings || {
          publicProfile: true,
          showMatchHistory: true,
          showSocialLinks: true
        }
      };

      users.push(newUser);
      await setData('users', users);

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...safeUser } = newUser;

      return jsonResponse(201, { success: true, token, user: safeUser, data: safeUser });
    }

    // AUTH: Login
    if (path === "/login" && method === "POST") {
      const { email, password } = JSON.parse(body || "{}");
      const users = await getUsers();
      const user = users.find((u: any) => u.email === (email || "").toLowerCase().trim());

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return jsonResponse(401, { success: false, message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...safeUser } = user;
      return jsonResponse(200, { success: true, token, user: safeUser, data: safeUser });
    }

    // AUTH: Me
    if (path === "/me" && method === "GET") {
      if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
      const { password: _, ...safeUser } = authUser;
      return jsonResponse(200, { success: true, user: safeUser, data: safeUser });
    }

    // USERS
    if (action === "users") {
      const users = await getUsers();
      const safeUsers = users.map(({ password, ...u }: any) => u);

      if (path === "/users" && method === "GET") {
        return jsonResponse(200, { success: true, data: safeUsers });
      }

      if (itemId && method === "GET") {
        const user = safeUsers.find((u: any) => u.id === itemId);
        if (!user) return jsonResponse(404, { success: false, message: "User not found" });
        return jsonResponse(200, { success: true, user, data: user });
      }

      if (itemId && method === "PUT") {
        if (!authUser || authUser.id !== itemId) return jsonResponse(403, { success: false, message: "Forbidden" });
        const payload = JSON.parse(body || "{}");
        const idx = users.findIndex((u: any) => u.id === itemId);
        if (idx === -1) return jsonResponse(404, { success: false, message: "User not found" });
        
        users[idx] = { ...users[idx], ...payload, id: itemId }; // Protect ID
        await setData('users', users);
        const { password: _, ...safeUser } = users[idx];
        return jsonResponse(200, { success: true, data: safeUser, user: safeUser });
      }

      // Block/Favorite
      if (itemId && method === "POST") {
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        const payload = JSON.parse(body || "{}");
        const userIdx = users.findIndex((u: any) => u.id === authUser.id);
        
        if (subAction === "block") {
          const targetId = segments[1]; // itemId is target
          if (!users[userIdx].blockedUserIds) users[userIdx].blockedUserIds = [];
          if (users[userIdx].blockedUserIds.includes(targetId)) {
            users[userIdx].blockedUserIds = users[userIdx].blockedUserIds.filter((id: string) => id !== targetId);
          } else {
            users[userIdx].blockedUserIds.push(targetId);
          }
          await setData('users', users);
          const { password: _, ...safe } = users[userIdx];
          return jsonResponse(200, { success: true, data: safe, user: safe });
        }

        if (subAction === "favorite") {
          // POST /api/users/:myId/favorite with body { targetUserId }
          const targetUserId = payload.targetUserId;
          if (!users[userIdx].favoritePlayerIds) users[userIdx].favoritePlayerIds = [];
          if (users[userIdx].favoritePlayerIds.includes(targetUserId)) {
            users[userIdx].favoritePlayerIds = users[userIdx].favoritePlayerIds.filter((id: string) => id !== targetUserId);
          } else {
            users[userIdx].favoritePlayerIds.push(targetUserId);
          }
          await setData('users', users);
          const { password: _, ...safe } = users[userIdx];
          return jsonResponse(200, { success: true, data: safe, user: safe });
        }
      }
    }

    // FRIENDS
    if (action === "friends") {
      if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
      const requests = await getFriendRequests();
      const users = await getUsers();

      if (subAction === "request" && method === "POST") {
        const { toUserId } = JSON.parse(body || "{}");
        const newReq = {
          id: Math.random().toString(36).substr(2, 9),
          fromUserId: authUser.id,
          toUserId,
          status: "pending",
          createdAt: new Date().toISOString()
        };
        requests.push(newReq);
        await setData('friendRequests', requests);
        return jsonResponse(201, { success: true, data: newReq });
      }

      if (subAction === "respond" && method === "POST") {
        const { requestId, status } = JSON.parse(body || "{}");
        const reqIdx = requests.findIndex((r: any) => r.id === requestId);
        if (reqIdx === -1) return jsonResponse(404, { success: false, message: "Request not found" });

        const req = requests[reqIdx];
        if (status === "accepted") {
          const u1 = users.findIndex((u: any) => u.id === req.fromUserId);
          const u2 = users.findIndex((u: any) => u.id === req.toUserId);
          if (u1 !== -1 && u2 !== -1) {
            if (!users[u1].friendIds) users[u1].friendIds = [];
            if (!users[u2].friendIds) users[u2].friendIds = [];
            if (!users[u1].friendIds.includes(req.toUserId)) users[u1].friendIds.push(req.toUserId);
            if (!users[u2].friendIds.includes(req.fromUserId)) users[u2].friendIds.push(req.fromUserId);
            await setData('users', users);
          }
        }
        requests[reqIdx].status = status;
        await setData('friendRequests', requests);
        const { password: _, ...safe } = users.find((u: any) => u.id === authUser.id);
        return jsonResponse(200, { success: true, data: safe, user: safe });
      }
    }

    // GAMES
    if (action === "games") {
      const games = await getGames();

      if (path === "/games" && method === "GET") {
        return jsonResponse(200, { success: true, data: games });
      }

      if (itemId && method === "GET") {
        const game = games.find((g: any) => g.id === itemId);
        if (!game) return jsonResponse(404, { success: false, message: "Game not found" });
        return jsonResponse(200, { success: true, data: game, game });
      }

      if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });

      if (method === "POST") {
        const payload = JSON.parse(body || "{}");
        if (!itemId) { // Create
          const newGame = {
            ...payload,
            id: Math.random().toString(36).substr(2, 9),
            creatorId: authUser.id,
            joinedPlayers: [authUser.id],
            requests: [],
            chat: [],
            createdAt: new Date().toISOString()
          };
          games.push(newGame);
          await setData('games', games);
          return jsonResponse(201, { success: true, data: newGame });
        } else {
          const idx = games.findIndex((g: any) => g.id === itemId);
          if (idx === -1) return jsonResponse(404, { success: false, message: "Game not found" });

          if (subAction === "request") {
            if (!games[idx].requests) games[idx].requests = [];
            if (!games[idx].requests.find((r: any) => r.userId === authUser.id)) {
              games[idx].requests.push({
                userId: authUser.id,
                userName: authUser.name,
                status: 'pending',
                timestamp: new Date().toISOString()
              });
            }
          } else if (subAction === "approve") {
            const { userId, approve } = payload;
            const rIdx = games[idx].requests?.findIndex((r: any) => r.userId === userId);
            if (rIdx !== -1) {
              games[idx].requests[rIdx].status = approve ? 'approved' : 'rejected';
              if (approve && !games[idx].joinedPlayers.includes(userId)) {
                games[idx].joinedPlayers.push(userId);
              }
            }
          } else if (subAction === "chat") {
            if (!games[idx].chat) games[idx].chat = [];
            games[idx].chat.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: authUser.id,
              userName: authUser.name,
              text: payload.text,
              timestamp: new Date().toISOString()
            });
          } else if (subAction === "attendance") {
            games[idx].attendance = payload.attendanceRecords;
          } else if (subAction === "result") {
            games[idx].result = payload;
          }
          await setData('games', games);
          return jsonResponse(200, { success: true, data: games[idx] });
        }
      }

      if (method === "PUT" && itemId) {
        const idx = games.findIndex((g: any) => g.id === itemId);
        if (idx === -1) return jsonResponse(404, { success: false, message: "Game not found" });
        const payload = JSON.parse(body || "{}");
        games[idx] = { ...games[idx], ...payload, id: itemId };
        await setData('games', games);
        return jsonResponse(200, { success: true, data: games[idx] });
      }

      if (method === "DELETE" && itemId) {
        const filtered = games.filter((g: any) => g.id !== itemId);
        await setData('games', filtered);
        return jsonResponse(200, { success: true });
      }
    }

    // GROUPS
    if (action === "groups") {
      const groups = await getGroups();
      if (path === "/groups" && method === "GET") {
        return jsonResponse(200, { success: true, data: groups });
      }

      if (itemId && method === "GET") {
        const group = groups.find((g: any) => g.id === itemId);
        if (!group) return jsonResponse(404, { success: false, message: "Group not found" });
        return jsonResponse(200, { success: true, data: group, group });
      }

      if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });

      if (method === "POST") {
        const payload = JSON.parse(body || "{}");
        if (!itemId) { // Create
          const newGroup = {
            ...payload,
            id: Math.random().toString(36).substr(2, 9),
            adminId: authUser.id,
            memberIds: [authUser.id],
            chat: [],
            invitedUserIds: [],
            createdAt: new Date().toISOString()
          };
          groups.push(newGroup);
          await setData('groups', groups);
          return jsonResponse(201, { success: true, data: newGroup });
        } else {
          const idx = groups.findIndex((g: any) => g.id === itemId);
          if (idx === -1) return jsonResponse(404, { success: false, message: "Group not found" });

          if (subAction === "join") {
            if (!groups[idx].memberIds.includes(authUser.id)) groups[idx].memberIds.push(authUser.id);
          } else if (subAction === "invite") {
            const { invitedUserId } = payload;
            if (!groups[idx].invitedUserIds) groups[idx].invitedUserIds = [];
            if (!groups[idx].invitedUserIds.includes(invitedUserId)) groups[idx].invitedUserIds.push(invitedUserId);
          } else if (subAction === "chat") {
            if (!groups[idx].chat) groups[idx].chat = [];
            groups[idx].chat.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: authUser.id,
              userName: authUser.name,
              text: payload.text,
              timestamp: new Date().toISOString()
            });
          }
          await setData('groups', groups);
          return jsonResponse(200, { success: true, data: groups[idx] });
        }
      }
    }

    // NOTIFICATIONS
    if (action === "notifications" || path === "/notifications/me") {
      const notifications = await getNotifications();
      const targetUserId = (itemId === 'me' || path === '/notifications/me') ? authUser?.id : itemId;
      if (!targetUserId) return jsonResponse(200, { success: true, data: [] });
      const filtered = notifications.filter((n: any) => n.userId === targetUserId);
      return jsonResponse(200, { success: true, data: filtered });
    }

    return jsonResponse(404, { success: false, message: "Route not found", path });

  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
