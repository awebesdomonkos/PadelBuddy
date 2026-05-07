import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "super_secure_random_secret";
const IS_DEV = process.env.NODE_ENV === 'development' || !process.env.NETLIFY;

// Local store fallback for development environment consistency
const getLocalStore = (name: string) => {
  const dataDir = path.resolve(process.cwd(), '.netlify-blobs');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, `${name}.json`);

  const readData = () => {
    if (!fs.existsSync(filePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return {};
    }
  };

  const writeData = (data: any) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  return {
    get: async (key: string, options?: { type: string }) => {
      const data = readData();
      const val = data[key];
      if (val === undefined) return null;
      if (options?.type === 'json' && typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    },
    set: async (key: string, value: string) => {
      const data = readData();
      data[key] = value;
      writeData(data);
    }
  };
};

const getStoreInstance = (name: string) => {
  return IS_DEV ? getLocalStore(name) : getStore(name);
};

const getCollection = async (name: string) => {
  try {
    const store = getStoreInstance(name);
    const list = await store.get("list", { type: "json" });
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error(`Error getting collection ${name}:`, err);
    return [];
  }
};

const saveCollection = async (name: string, data: any[]) => {
  try {
    const store = getStoreInstance(name);
    await store.set("list", JSON.stringify(data));
  } catch (err) {
    console.error(`Error saving collection ${name}:`, err);
  }
};

const jsonResponse = (statusCode: number, body: any) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  try {
    console.log('API invoked:', event.httpMethod, event.path);

    if (!process.env.JWT_SECRET && !IS_DEV) {
      return jsonResponse(500, { success: false, message: "JWT_SECRET is not configured" });
    }

    const { httpMethod, path: eventPath, body } = event;
    const userStore = getStoreInstance("users");

    // Route Parsing
    const cleanPath = eventPath.replace('/.netlify/functions/api', '').replace('/api', '');
    const segments = cleanPath.split('/').filter(Boolean);
    
    const action = segments[0] || '';
    const itemId = segments[1] || '';
    const subAction = segments[2] || '';

    // Health check
    if (httpMethod === "GET" && action === "health") {
      return jsonResponse(200, { success: true, message: "API is running" });
    }

    // AUTH: Register
    if (httpMethod === "POST" && action === "register") {
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
      const existingUser = await userStore.get(normalizedEmail, { type: "json" });
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

      await userStore.set(normalizedEmail, JSON.stringify(newUser));
      
      // Update meta list for public player browsing
      const usersList = await getCollection("users_meta");
      usersList.push({ 
        id: userId, 
        name, 
        email: normalizedEmail, 
        username: userData.username || normalizedEmail.split('@')[0],
        location: userData.location || { city: 'Unknown' },
        avatarUrl: userData.avatarUrl || '',
        skillLevel: userData.skillLevel || 'Bronze'
      });
      await saveCollection("users_meta", usersList);

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = newUser;

      return jsonResponse(201, { success: true, token, user: userWithoutPassword });
    }

    // AUTH: Login
    if (httpMethod === "POST" && action === "login") {
      let loginData;
      try {
        loginData = JSON.parse(body || "{}");
      } catch {
        return jsonResponse(400, { success: false, message: "Invalid JSON body" });
      }

      const { email, password } = loginData;
      const normalizedEmail = (email || "").toLowerCase().trim();

      const user: any = await userStore.get(normalizedEmail, { type: "json" });
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
    if (httpMethod === "GET" && action === "me") {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse(401, { success: false, message: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user: any = await userStore.get(decoded.email, { type: "json" });
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
      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        return await userStore.get(decoded.email, { type: "json" });
      } catch {
        return null;
      }
    };

    // GAMES
    if (action === "games") {
      const games = await getCollection("games");
      
      if (httpMethod === "GET") {
        return jsonResponse(200, games);
      }
      
      if (httpMethod === "POST") {
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
          await saveCollection("games", games);
          return jsonResponse(201, newGame);
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
            await saveCollection("games", games);
            return jsonResponse(200, games[gIdx]);
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
            await saveCollection("games", games);
            return jsonResponse(200, games[gIdx]);
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
            await saveCollection("games", games);
            return jsonResponse(200, games[gIdx]);
          }

          if (subAction === "attendance") {
            games[gIdx].attendance = payload.attendanceRecords;
            await saveCollection("games", games);
            return jsonResponse(200, games[gIdx]);
          }

          if (subAction === "result") {
            games[gIdx].result = payload;
            await saveCollection("games", games);
            return jsonResponse(200, games[gIdx]);
          }
        }
      }

      if (httpMethod === "PUT" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });

        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        const gIdx = games.findIndex(g => g.id === itemId);
        if (gIdx === -1) return jsonResponse(404, { success: false, message: "Game not found" });

        games[gIdx] = { ...games[gIdx], ...payload };
        await saveCollection("games", games);
        return jsonResponse(200, games[gIdx]);
      }

      if (httpMethod === "DELETE" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        const remaining = games.filter(g => g.id !== itemId);
        await saveCollection("games", remaining);
        return jsonResponse(200, { success: true });
      }
    }

    // USERS (Browsing and Profiles)
    if (action === "users") {
      if (httpMethod === "GET") {
        const usersList = await getCollection("users_meta");
        return jsonResponse(200, usersList);
      }
      
      if (httpMethod === "PUT" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser || authUser.id !== itemId) return jsonResponse(403, { success: false, message: "Forbidden" });

        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        const updatedUser = { ...authUser, ...payload };
        // Do not update password via this route
        updatedUser.password = authUser.password; 
        
        await userStore.set(updatedUser.email.toLowerCase().trim(), JSON.stringify(updatedUser));

        // Update meta
        const usersList = await getCollection("users_meta");
        const mIdx = usersList.findIndex(u => u.id === itemId);
        if (mIdx !== -1) {
          usersList[mIdx] = {
            ...usersList[mIdx],
            name: updatedUser.name,
            location: updatedUser.location,
            avatarUrl: updatedUser.avatarUrl,
            username: updatedUser.username,
            skillLevel: updatedUser.skillLevel
          };
          await saveCollection("users_meta", usersList);
        }
        
        const { password: _, ...userWithoutPassword } = updatedUser;
        return jsonResponse(200, userWithoutPassword);
      }

      if (httpMethod === "POST" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        if (subAction === "block") {
          authUser.blockedUserIds = authUser.blockedUserIds || [];
          if (authUser.blockedUserIds.includes(itemId)) {
            authUser.blockedUserIds = authUser.blockedUserIds.filter((id: string) => id !== itemId);
          } else {
            authUser.blockedUserIds.push(itemId);
          }
          await userStore.set(authUser.email.toLowerCase().trim(), JSON.stringify(authUser));
          return jsonResponse(200, { success: true, user: authUser });
        }

        if (subAction === "favorite") {
          authUser.favoritePlayerIds = authUser.favoritePlayerIds || [];
          const targetId = payload.targetUserId;
          if (authUser.favoritePlayerIds.includes(targetId)) {
            authUser.favoritePlayerIds = authUser.favoritePlayerIds.filter((id: string) => id !== targetId);
          } else {
            authUser.favoritePlayerIds.push(targetId);
          }
          await userStore.set(authUser.email.toLowerCase().trim(), JSON.stringify(authUser));
          return jsonResponse(200, { success: true, user: authUser });
        }
      }
    }

    // CLUBS
    if (action === "clubs") {
      if (httpMethod === "GET") {
        const clubs = await getCollection("clubs");
        if (clubs.length === 0) {
           const defaultClubs = [
             { id: '1', name: 'Elite Padel Club', location: { city: 'Budapest' }, rating: 4.8, courts: 12 },
             { id: '2', name: 'Padel Palace', location: { city: 'Budapest' }, rating: 4.5, courts: 8 }
           ];
           await saveCollection("clubs", defaultClubs);
           return jsonResponse(200, defaultClubs);
        }
        return jsonResponse(200, clubs);
      }
    }

    // GROUPS
    if (action === "groups") {
      const groups = await getCollection("groups");
      if (httpMethod === "GET") return jsonResponse(200, groups);
      
      if (httpMethod === "POST") {
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
          await saveCollection("groups", groups);
          return jsonResponse(201, newGroup);
        } else {
          const gIdx = groups.findIndex(g => g.id === itemId);
          if (gIdx === -1) return jsonResponse(404, { success: false, message: "Group not found" });

          if (subAction === "join") {
            if (!groups[gIdx].memberIds.includes(payload.userId)) {
              groups[gIdx].memberIds.push(payload.userId);
            }
            await saveCollection("groups", groups);
            return jsonResponse(200, groups[gIdx]);
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
            await saveCollection("groups", groups);
            return jsonResponse(201, msg);
          }

          if (subAction === "invite") {
            groups[gIdx].invitedUserIds = groups[gIdx].invitedUserIds || [];
            if (!groups[gIdx].invitedUserIds.includes(payload.invitedUserId)) {
              groups[gIdx].invitedUserIds.push(payload.invitedUserId);
            }
            // Add notification
            const notifications = await getCollection("notifications");
            notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.invitedUserId,
              type: 'group_invite',
              title: 'Group Invitation',
              message: `You were invited to join ${groups[gIdx].name}`,
              data: { groupId: itemId },
              read: false,
              timestamp: new Date().toISOString()
            });
            await saveCollection("notifications", notifications);
            await saveCollection("groups", groups);
            return jsonResponse(200, groups[gIdx]);
          }
        }
      }
    }

    // NOTIFICATIONS
    if (action === "notifications") {
      const notifications = await getCollection("notifications");
      if (httpMethod === "GET") {
        const authUser = await getAuthUser();
        // Fallback for specific userId or 'me'
        let targetUserId = itemId;
        if (itemId === 'me') {
          targetUserId = authUser?.id || null;
        }
        
        if (!targetUserId) {
          // If it's a guest or session not found, just return empty list
          return jsonResponse(200, []);
        }
        const filtered = notifications.filter(n => n.userId === targetUserId);
        return jsonResponse(200, filtered);
      }
    }

    // FRIENDS (Legacy logic from server.ts)
    if (action === "friends") {
      if (httpMethod === "POST") {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { success: false, message: "Unauthorized" });
        let payload;
        try { payload = JSON.parse(body || "{}"); } catch { return jsonResponse(400, { success: false, message: "Invalid JSON" }); }

        if (itemId === "request") {
          const notifications = await getCollection("notifications");
          notifications.push({
            id: Math.random().toString(36).substr(2, 9),
            userId: payload.toUserId,
            type: 'friend_request',
            title: 'Friend Request',
            message: `Someone wants to be your friend`,
            data: { fromUserId: payload.fromUserId },
            read: false,
            timestamp: new Date().toISOString()
          });
          await saveCollection("notifications", notifications);
          return jsonResponse(200, { success: true });
        }
        
        if (itemId === "respond") {
          const { requestId, status } = payload;
          const notifications = await getCollection("notifications");
          const nIdx = notifications.findIndex(n => n.id === requestId);
          if (nIdx !== -1) {
            const notif = notifications[nIdx];
            if (status === 'accepted') {
              const fromUserId = notif.data.fromUserId;
              const toUserId = notif.userId;
              
              const usersMeta = await getCollection("users_meta");
              const fromUserMeta = usersMeta.find(u => u.id === fromUserId);
              const toUserMeta = usersMeta.find(u => u.id === toUserId);
              
              if (fromUserMeta && toUserMeta) {
                const fromUserObj = await userStore.get(fromUserMeta.email, { type: "json" });
                const toUserObj = await userStore.get(toUserMeta.email, { type: "json" });
                
                fromUserObj.friendIds = fromUserObj.friendIds || [];
                toUserObj.friendIds = toUserObj.friendIds || [];
                
                if (!fromUserObj.friendIds.includes(toUserId)) fromUserObj.friendIds.push(toUserId);
                if (!toUserObj.friendIds.includes(fromUserId)) toUserObj.friendIds.push(fromUserId);
                
                await userStore.set(fromUserMeta.email, JSON.stringify(fromUserObj));
                await userStore.set(toUserMeta.email, JSON.stringify(toUserObj));
              }
            }
            notifications[nIdx].read = true;
            await saveCollection("notifications", notifications);
          }
          return jsonResponse(200, { success: true });
        }
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
