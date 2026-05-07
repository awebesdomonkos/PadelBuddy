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

const getCollection = async (name: string) => {
  const store = IS_DEV ? getLocalStore(name) : getStore(name);
  const list = await store.get("list", { type: "json" });
  return (list as any[]) || [];
};

const saveCollection = async (name: string, data: any[]) => {
  const store = IS_DEV ? getLocalStore(name) : getStore(name);
  await store.set("list", JSON.stringify(data));
};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  const { httpMethod, path: eventPath, body } = event;
  const userStore = IS_DEV ? getLocalStore("users") : getStore("users");

  // Improved path parsing
  let action = '';
  let itemId = '';

  if (eventPath.includes('/api/')) {
    const parts = eventPath.split('/api/')[1].split('/');
    action = parts[0];
    itemId = parts[1];
  } else {
    // Netlify functions native path
    const segments = eventPath.split("/").filter(Boolean);
    const authIdx = segments.indexOf("auth");
    if (authIdx !== -1) {
      const subPath = segments.slice(authIdx + 1);
      action = subPath[0];
      itemId = subPath[1];
    }
  }

  try {
    // AUTH ENDPOINTS
    if (httpMethod === "POST" && action === "register") {
      const userData = JSON.parse(body || "{}");
      const { name, email, password } = userData;

      if (!name || !email || !password || password.length < 6) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid input data" }) };
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await userStore.get(normalizedEmail, { type: "json" });
      if (existingUser) {
        return { statusCode: 400, body: JSON.stringify({ error: "Email already exists" }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = Math.random().toString(36).substr(2, 9);
      
      const newUser = {
        ...userData,
        id: userId,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        friendIds: [],
        blockedUserIds: []
      };

      await userStore.set(normalizedEmail, JSON.stringify(newUser));
      
      // Also add to users list for GET /api/users
      const usersList = await getCollection("users_meta");
      usersList.push({ id: userId, name, email: normalizedEmail, location: userData.location || { city: 'Unknown' } });
      await saveCollection("users_meta", usersList);

      const token = jwt.sign({ userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = newUser;

      return {
        statusCode: 201,
        body: JSON.stringify({ success: true, token, user: userWithoutPassword }),
      };
    }

    if (httpMethod === "POST" && action === "login") {
      const { email, password } = JSON.parse(body || "{}");
      const normalizedEmail = email.toLowerCase().trim();

      const user: any = await userStore.get(normalizedEmail, { type: "json" });
      if (!user) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid credentials" }) };
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid credentials" }) };
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _, ...userWithoutPassword } = user;

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token, user: userWithoutPassword }),
      };
    }

    if (httpMethod === "GET" && action === "me") {
      const authHeader = event.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user: any = await userStore.get(decoded.email, { type: "json" });
        if (!user) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };

        const { password: _, ...userWithoutPassword } = user;
        return { statusCode: 200, body: JSON.stringify(userWithoutPassword) };
      } catch {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
      }
    }

    // DATA ENDPOINTS
    if (action === "games") {
      const games = await getCollection("games");
      if (httpMethod === "GET") {
        return { statusCode: 200, body: JSON.stringify(games) };
      }
      if (httpMethod === "POST") {
        const newGame = JSON.parse(body || "{}");
        newGame.id = Math.random().toString(36).substr(2, 9);
        games.push(newGame);
        await saveCollection("games", games);
        return { statusCode: 201, body: JSON.stringify(newGame) };
      }
    }

    if (action === "users") {
      if (httpMethod === "GET") {
        const usersList = await getCollection("users_meta");
        return { statusCode: 200, body: JSON.stringify(usersList) };
      }
    }

    if (action === "groups") {
      const groups = await getCollection("groups");
      if (httpMethod === "GET") return { statusCode: 200, body: JSON.stringify(groups) };
      if (httpMethod === "POST") {
        const newGroup = JSON.parse(body || "{}");
        newGroup.id = Math.random().toString(36).substr(2, 9);
        groups.push(newGroup);
        await saveCollection("groups", groups);
        return { statusCode: 201, body: JSON.stringify(newGroup) };
      }
    }

    if (action === "clubs") {
      if (httpMethod === "GET") {
         const clubs = await getCollection("clubs");
         return { statusCode: 200, body: JSON.stringify(clubs) };
      }
    }

    if (action === "notifications") {
       const notifications = await getCollection("notifications");
       return { statusCode: 200, body: JSON.stringify(notifications) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found", action, path }) };
  } catch (error) {
    console.error("Function error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};

