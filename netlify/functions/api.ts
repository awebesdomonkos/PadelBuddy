import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// STABLE IN-MEMORY STORAGE (Note: Cleared on function cold starts)
const users: any[] = [];
const users_meta: any[] = [];
const games: any[] = [];
const groups: any[] = [];
const clubs: any[] = [
  { id: '1', name: 'Elite Padel Club', location: { city: 'Budapest' }, rating: 4.8, courts: 12 },
  { id: '2', name: 'Padel Palace', location: { city: 'Budapest' }, rating: 4.5, courts: 8 }
];
const notifications: any[] = [];

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

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(200, { message: "OK" });
  }

  try {
    console.log('API invoked:', event.httpMethod, event.path);

    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
      console.warn("JWT_SECRET is not configured in production");
    }

    const { httpMethod, path: eventPath, body } = event;

    const rawPath = event.path || '';
    const method = event.httpMethod || '';

    const path = rawPath
      .replace('/.netlify/functions/api', '')
      .replace('/api', '');

    console.log('Route debug:', {
      rawPath,
      path,
      method,
    });

    const segments = path.split('/').filter(Boolean);
    const action = segments[0] || '';
    const itemId = segments[1] || '';
    const subAction = segments[2] || '';

    // Health check
    if (path === "/health" && method === "GET") {
      return jsonResponse(200, { success: true, message: "API is running" });
    }

    // AUTH: Register
    if (path === "/register" && method === "POST") {
      let userData;
      try {
        userData = JSON.parse(body || "{}");
      } catch {
        return jsonResponse(400, { success: false, message: "Invalid JSON body" });
      }

      const { name, email, password } = userData;
      if (!name || !email || !password || password.length < 6) {
        return jsonResponse(400, { success: false, message: "Invalid input data" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = users.find(u => u.email === normalizedEmail);
      if (existingUser) {
        return jsonResponse(400, { success: false, error: "ALREADY_EXISTS", message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = Math.random().toString(36).substr(2, 9);
      
      const newUser = {
        ...userData,
        id: userId,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        friendIds: userData.friendIds || [],
        blockedUserIds: userData.blockedUserIds || [],
        favoritePlayerIds: userData.favoritePlayerIds || [],
        requests: userData.requests || [],
        languagePreference: userData.languagePreference || 'hu'
      };

      users.push(newUser);
      
      // Update meta list
      users_meta.push({ 
        id: userId, 
        name, 
        email: normalizedEmail, 
        username: userData.username || normalizedEmail.split('@')[0],
        location: userData.location || { city: 'Unknown' },
        avatarUrl: userData.avatarUrl || '',
        skillLevel: userData.skillLevel || 'Bronze'
      });

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = newUser;

      return jsonResponse(201, { success: true, token, user: userWithoutPassword });
    }

    // AUTH: Login
    if (path === "/login" && method === "POST") {
      let loginData;
      try {
        loginData = JSON.parse(body || "{}");
      } catch {
        return jsonResponse(400, { success: false, message: "Invalid JSON body" });
      }

      const { email, password } = loginData;
      const normalizedEmail = (email || "").toLowerCase().trim();

      const user = users.find(u => u.email === normalizedEmail);
      if (!user) {
        return jsonResponse(401, { success: false, error: "INVALID_CREDENTIALS", message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return jsonResponse(401, { success: false, error: "INVALID_CREDENTIALS", message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = user;

      return jsonResponse(200, { success: true, token, user: userWithoutPassword });
    }

    // AUTH: Me
    if (path === "/me" && method === "GET") {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse(401, { success: false, message: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user = users.find(u => u.email === decoded.email);
        if (!user) return jsonResponse(404, { success: false, message: "User not found" });

        const { password: _, ...userWithoutPassword } = user;
        return jsonResponse(200, userWithoutPassword);
      } catch {
        return jsonResponse(401, { success: false, message: "Invalid token" });
      }
    }

    // Protected Route Helper
    const getAuthUser = async () => {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return null;
      const tokenString = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(tokenString, JWT_SECRET);
        return users.find(u => u.email === decoded.email) || null;
      } catch {
        return null;
      }
    };

    // GAMES
    if (action === "games") {
      if (path === "/games" && method === "GET") {
        return jsonResponse(200, { success: true, data: games });
      }
      
      if (method === "POST") {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });

        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        if (!itemId) { // CREATE
          const newGame = {
            ...payload,
            id: Math.random().toString(36).substr(2, 9),
            joinedPlayers: [payload.creatorId],
            requests: [],
            chat: [],
            createdAt: new Date().toISOString()
          };
          games.push(newGame);
          return jsonResponse(201, { success: true, data: newGame });
        } else { // ACTIONS
          const gIdx = games.findIndex(g => g.id === itemId);
          if (gIdx === -1) return jsonResponse(404, { success: false, message: "Game not found" });
          
          if (subAction === "request") {
            const req = {
              userId: payload.userId,
              userName: payload.userName,
              status: 'pending',
              timestamp: new Date().toISOString()
            };
            games[gIdx].requests = games[gIdx].requests || [];
            games[gIdx].requests.push(req);
            return jsonResponse(200, { success: true, data: games[gIdx] });
          }

          if (subAction === "approve") {
            const { userId, approve } = payload;
            const rIdx = games[gIdx].requests?.findIndex((r: any) => r.userId === userId);
            if (rIdx !== -1 && games[gIdx].requests) {
              if (approve) {
                games[gIdx].requests[rIdx].status = 'approved';
                games[gIdx].joinedPlayers.push(userId);
              } else {
                games[gIdx].requests[rIdx].status = 'rejected';
              }
            }
            return jsonResponse(200, { success: true, data: games[gIdx] });
          }

          if (subAction === "chat") {
            const msg = {
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.userId,
              userName: payload.userName,
              text: payload.text,
              timestamp: new Date().toISOString()
            };
            games[gIdx].chat = games[gIdx].chat || [];
            games[gIdx].chat.push(msg);
            return jsonResponse(200, { success: true, data: games[gIdx] });
          }

          if (subAction === "attendance") {
            games[gIdx].attendance = payload.attendanceRecords;
            return jsonResponse(200, { success: true, data: games[gIdx] });
          }

          if (subAction === "result") {
            games[gIdx].result = payload;
            return jsonResponse(200, { success: true, data: games[gIdx] });
          }
        }
      }

      if (method === "PUT" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        const gIdx = games.findIndex(g => g.id === itemId);
        if (gIdx === -1) return jsonResponse(404, { success: false, message: "Game not found" });
        
        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }
        
        games[gIdx] = { ...games[gIdx], ...payload };
        return jsonResponse(200, { success: true, data: games[gIdx] });
      }

      if (method === "DELETE" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        const gIdx = games.findIndex(g => g.id === itemId);
        if (gIdx !== -1) games.splice(gIdx, 1);
        return jsonResponse(200, { success: true });
      }
    }

    // USERS
    if (action === "users") {
      if (path === "/users" && method === "GET") {
        return jsonResponse(200, { success: true, data: users_meta });
      }
      
      if (method === "PUT" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser || authUser.id !== itemId) return jsonResponse(403, { success: false, message: "Forbidden" });

        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        const userIdx = users.findIndex(u => u.id === itemId);
        if (userIdx !== -1) {
          users[userIdx] = { ...users[userIdx], ...payload };
          // Sync meta
          const mIdx = users_meta.findIndex(u => u.id === itemId);
          if (mIdx !== -1) {
            users_meta[mIdx] = {
              ...users_meta[mIdx],
              name: users[userIdx].name,
              location: users[userIdx].location,
              avatarUrl: users[userIdx].avatarUrl,
              username: users[userIdx].username,
              skillLevel: users[userIdx].skillLevel
            };
          }
          const { password: _, ...userWithoutPassword } = users[userIdx];
          return jsonResponse(200, { success: true, data: userWithoutPassword });
        }
        return jsonResponse(404, { success: false, message: "User not found" });
      }
    }

    // GROUPS
    if (action === "groups") {
      if (path === "/groups" && method === "GET") return jsonResponse(200, { success: true, data: groups });
      
      if (method === "POST") {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        if (!itemId) { // CREATE
          const newGroup = {
            ...payload,
            id: Math.random().toString(36).substr(2, 9),
            memberIds: [payload.adminId],
            chat: [],
            invitedUserIds: [],
            createdAt: new Date().toISOString()
          };
          groups.push(newGroup);
          return jsonResponse(201, { success: true, data: newGroup });
        } else {
          const gIdx = groups.findIndex(g => g.id === itemId);
          if (gIdx === -1) return jsonResponse(404, { success: false, message: "Group not found" });

          if (subAction === "join") {
            if (!groups[gIdx].memberIds.includes(payload.userId)) {
              groups[gIdx].memberIds.push(payload.userId);
            }
            return jsonResponse(200, { success: true, data: groups[gIdx] });
          }

          if (subAction === "chat") {
            const msg = {
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.userId,
              userName: payload.userName,
              text: payload.text,
              timestamp: new Date().toISOString()
            };
            groups[gIdx].chat = groups[gIdx].chat || [];
            groups[gIdx].chat.push(msg);
            return jsonResponse(201, { success: true, data: msg });
          }
        }
      }
    }

    // CLUBS
    if (action === "clubs") {
      if (path === "/clubs" && method === "GET") {
        return jsonResponse(200, { success: true, data: clubs });
      }
    }

    // NOTIFICATIONS
    if (action === "notifications" || path === "/notifications/me") {
      if (method === "GET") {
        const authUser = await getAuthUser();
        const targetUserId = (itemId === 'me' || path === '/notifications/me') ? authUser?.id : itemId;
        if (!targetUserId) return jsonResponse(200, { success: true, data: [] });
        const filtered = notifications.filter(n => n.userId === targetUserId);
        return jsonResponse(200, { success: true, data: filtered });
      }
    }

    // Default 404 for unknown routes
    return jsonResponse(404, { success: false, message: "Route not found", action, path: eventPath });

  } catch (error) {
    console.error('CRITICAL API ERROR:', error);
    return jsonResponse(500, {
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
