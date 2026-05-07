import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "super_secure_random_secret";
const IS_DEV = process.env.NODE_ENV === 'development' || !process.env.NETLIFY;

// Local store fallback for development
const getLocalStore = (name: string) => {
  const dataDir = path.resolve(process.cwd(), '.netlify-blobs');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const filePath = path.join(dataDir, `${name}.json`);

  return {
    get: async (key: string, options?: { type: string }) => {
      if (!fs.existsSync(filePath)) return null;
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const val = data[key];
      if (val === undefined) return null;
      if (options?.type === 'json' && typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    },
    set: async (key: string, value: string) => {
      const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : {};
      data[key] = value;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
  };
};

const getStoreInstance = (name: string) => {
  return IS_DEV ? getLocalStore(name) : getStore(name);
};

const getCollection = async (name: string) => {
  const store = getStoreInstance(name);
  const list = await store.get("list", { type: "json" });
  return (list as any[]) || [];
};

const saveCollection = async (name: string, data: any[]) => {
  const store = getStoreInstance(name);
  await store.set("list", JSON.stringify(data));
};

const jsonResponse = (statusCode: number, data: any) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (!process.env.JWT_SECRET && !IS_DEV) {
    return jsonResponse(500, { success: false, message: "JWT_SECRET is not configured" });
  }

  const { httpMethod, path: eventPath, body } = event;
  const userStore = getStoreInstance("users");

  // Improved path parsing for both local and Netlify
  let action = '';
  let itemId = '';
  let subAction = '';

  const cleanPath = eventPath.replace('/.netlify/functions/api', '').replace('/api', '');
  const segments = cleanPath.split('/').filter(Boolean);
  
  action = segments[0] || '';
  itemId = segments[1] || '';
  subAction = segments[2] || '';

  try {
    // ---------------------------------------------------------
    // AUTHENTICATION
    // ---------------------------------------------------------
    
    if (httpMethod === "POST" && action === "register") {
      const userData = JSON.parse(body || "{}");
      const { name, email, password } = userData;

      if (!name || !email || !password || password.length < 6) {
        return jsonResponse(400, { success: false, error: "Invalid input data" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await userStore.get(normalizedEmail, { type: "json" });
      if (existingUser) {
        return jsonResponse(400, { success: false, error: "ALREADY_EXISTS" });
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
        requests: []
      };

      await userStore.set(normalizedEmail, JSON.stringify(newUser));
      
      // Update meta list
      const usersList = await getCollection("users_meta");
      usersList.push({ 
        id: userId, 
        name, 
        email: normalizedEmail, 
        username: userData.username || normalizedEmail.split('@')[0],
        location: userData.location || { city: 'Unknown' },
        avatarUrl: userData.avatarUrl || ''
      });
      await saveCollection("users_meta", usersList);

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = newUser;

      return jsonResponse(201, { success: true, token, user: userWithoutPassword });
    }

    if (httpMethod === "POST" && action === "login") {
      const { email, password } = JSON.parse(body || "{}");
      const normalizedEmail = (email || "").toLowerCase().trim();

      const user: any = await userStore.get(normalizedEmail, { type: "json" });
      if (!user) {
        return jsonResponse(401, { success: false, error: "INVALID_CREDENTIALS" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return jsonResponse(401, { success: false, error: "INVALID_CREDENTIALS" });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = user;

      return jsonResponse(200, { success: true, token, user: userWithoutPassword });
    }

    if (httpMethod === "GET" && action === "me") {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return jsonResponse(401, { error: "Unauthorized" });

      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user: any = await userStore.get(decoded.email, { type: "json" });
        if (!user) return jsonResponse(404, { error: "User not found" });

        const { password: _, ...userWithoutPassword } = user;
        return jsonResponse(200, userWithoutPassword);
      } catch {
        return jsonResponse(401, { error: "Invalid token" });
      }
    }

    // ---------------------------------------------------------
    // DATABASE / COLLECTIONS
    // ---------------------------------------------------------

    // Helper for auth-protected read/write
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

    if (action === "games") {
      const games = await getCollection("games");
      
      if (httpMethod === "GET") {
        return jsonResponse(200, games);
      }
      
      if (httpMethod === "POST") {
        if (!itemId) { // CREATE GAME
          const newGame = JSON.parse(body || "{}");
          newGame.id = Math.random().toString(36).substr(2, 9);
          newGame.joinedPlayers = [newGame.creatorId];
          newGame.requests = [];
          newGame.chat = [];
          games.push(newGame);
          await saveCollection("games", games);
          return jsonResponse(201, newGame);
        } else {
          // SUB-ACTIONS for /api/games/:id/...
          const gIdx = games.findIndex(g => g.id === itemId);
          if (gIdx === -1) return jsonResponse(404, { error: "Game not found" });
          
          const game = games[gIdx];
          const payload = JSON.parse(body || "{}");

          if (subAction === "request") {
            const req = {
              userId: payload.userId,
              userName: payload.userName,
              status: 'pending',
              timestamp: new Date().toISOString()
            };
            game.requests = game.requests || [];
            game.requests.push(req);
            await saveCollection("games", games);
            return jsonResponse(200, game);
          }

          if (subAction === "approve") {
            const { userId, approve } = payload;
            const rIdx = game.requests?.findIndex((r: any) => r.userId === userId);
            if (rIdx !== -1 && game.requests) {
              if (approve) {
                game.requests[rIdx].status = 'approved';
                game.joinedPlayers.push(userId);
              } else {
                game.requests[rIdx].status = 'rejected';
              }
            }
            await saveCollection("games", games);
            return jsonResponse(200, game);
          }

          if (subAction === "chat") {
            const msg = {
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.userId,
              userName: payload.userName,
              text: payload.text,
              timestamp: new Date().toISOString()
            };
            game.chat = game.chat || [];
            game.chat.push(msg);
            await saveCollection("games", games);
            return jsonResponse(200, game);
          }

          if (subAction === "attendance") {
            game.attendance = payload.attendanceRecords;
            await saveCollection("games", games);
            return jsonResponse(200, game);
          }

          if (subAction === "result") {
            game.result = payload;
            await saveCollection("games", games);
            return jsonResponse(200, game);
          }
        }
      }

      if (httpMethod === "DELETE" && itemId) {
        const remaining = games.filter(g => g.id !== itemId);
        await saveCollection("games", remaining);
        return jsonResponse(200, { success: true });
      }
    }

    if (action === "users") {
      if (httpMethod === "GET") {
        const usersList = await getCollection("users_meta");
        return jsonResponse(200, usersList);
      }
      
      if (httpMethod === "PUT" && itemId) {
        const payload = JSON.parse(body || "{}");
        const authUser = await getAuthUser();
        if (!authUser || authUser.id !== itemId) return jsonResponse(403, { error: "Forbidden" });

        const updatedUser = { ...authUser, ...payload };
        const normalizedEmail = updatedUser.email.toLowerCase().trim();
        await userStore.set(normalizedEmail, JSON.stringify(updatedUser));

        // Update meta
        const usersList = await getCollection("users_meta");
        const mIdx = usersList.findIndex(u => u.id === itemId);
        if (mIdx !== -1) {
          usersList[mIdx] = {
            ...usersList[mIdx],
            name: updatedUser.name,
            location: updatedUser.location,
            avatarUrl: updatedUser.avatarUrl,
            username: updatedUser.username
          };
          await saveCollection("users_meta", usersList);
        }
        
        const { password: _, ...userWithoutPassword } = updatedUser;
        return jsonResponse(200, userWithoutPassword);
      }

      if (httpMethod === "POST" && itemId) {
        const authUser = await getAuthUser();
        if (!authUser) return jsonResponse(401, { error: "Unauthorized" });
        const payload = JSON.parse(body || "{}");

        if (subAction === "block") {
          authUser.blockedUserIds = authUser.blockedUserIds || [];
          if (authUser.blockedUserIds.includes(itemId)) {
            authUser.blockedUserIds = authUser.blockedUserIds.filter((id: string) => id !== itemId);
          } else {
            authUser.blockedUserIds.push(itemId);
          }
          await userStore.set(authUser.email.toLowerCase().trim(), JSON.stringify(authUser));
          return jsonResponse(200, authUser);
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
          return jsonResponse(200, authUser);
        }
      }
    }

    if (action === "groups") {
      const groups = await getCollection("groups");
      if (httpMethod === "GET") return jsonResponse(200, groups);
      
      if (httpMethod === "POST") {
        if (!itemId) {
          const newGroup = JSON.parse(body || "{}");
          newGroup.id = Math.random().toString(36).substr(2, 9);
          newGroup.memberIds = [newGroup.adminId];
          newGroup.chat = [];
          newGroup.invitedUserIds = [];
          groups.push(newGroup);
          await saveCollection("groups", groups);
          return jsonResponse(201, newGroup);
        } else {
          const gIdx = groups.findIndex(g => g.id === itemId);
          if (gIdx === -1) return jsonResponse(404, { error: "Group not found" });
          const group = groups[gIdx];
          const payload = JSON.parse(body || "{}");

          if (subAction === "join") {
            if (!group.memberIds.includes(payload.userId)) {
              group.memberIds.push(payload.userId);
            }
            await saveCollection("groups", groups);
            return jsonResponse(200, group);
          }

          if (subAction === "chat") {
            const msg = {
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.userId,
              userName: payload.userName,
              text: payload.text,
              timestamp: new Date().toISOString()
            };
            group.chat = group.chat || [];
            group.chat.push(msg);
            await saveCollection("groups", groups);
            return jsonResponse(201, msg);
          }

          if (subAction === "invite") {
            group.invitedUserIds = group.invitedUserIds || [];
            if (!group.invitedUserIds.includes(payload.invitedUserId)) {
              group.invitedUserIds.push(payload.invitedUserId);
            }
            // Add notification
            const notifications = await getCollection("notifications");
            notifications.push({
              id: Math.random().toString(36).substr(2, 9),
              userId: payload.invitedUserId,
              type: 'group_invite',
              title: 'Group Invitation',
              message: `You were invited to join ${group.name}`,
              data: { groupId: itemId },
              read: false,
              timestamp: new Date().toISOString()
            });
            await saveCollection("notifications", notifications);
            await saveCollection("groups", groups);
            return jsonResponse(200, group);
          }
        }
      }
    }

    if (action === "clubs") {
      if (httpMethod === "GET") {
        const clubs = await getCollection("clubs");
        // default clubs if none
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

    if (action === "notifications") {
      const notifications = await getCollection("notifications");
      if (httpMethod === "GET") {
        const userId = itemId === 'me' ? (await getAuthUser())?.id : itemId;
        const filtered = notifications.filter(n => n.userId === userId);
        return jsonResponse(200, filtered);
      }
    }

    if (action === "friends") {
      if (httpMethod === "POST") {
        const payload = JSON.parse(body || "{}");
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
              // Add to both users
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

    return jsonResponse(404, { success: false, error: "Not found", action, path: eventPath });
  } catch (error) {
    console.error("Function error:", error);
    return jsonResponse(500, { 
      success: false, 
      message: "Internal server error", 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};
