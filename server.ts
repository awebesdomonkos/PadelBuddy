import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { FriendRequest, GroupInvitation, Game } from "./src/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // In-memory "database"
  const users: any[] = [
    { 
      id: "1", 
      name: "Marc", 
      email: "marc@padel.com",
      password: "password123",
      phone: "+34 600 000 001",
      skillLevel: "Gold", 
      location: { lat: 41.3851, lng: 2.1734, city: "Barcelona" }, 
      bio: "Aggressive left player.",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
      favoriteClubs: ["Padel Indoor Barcelona", "Real Club de Tenis Barcelona"],
      interests: ["Tournaments", "Morning Games", "Coaching"],
      lfgStatus: "Today",
      lastActive: new Date().toISOString(),
      favoritePlayerIds: [],
      completedGamesCount: 15,
      attendedGamesCount: 15,
      missedGamesCount: 0,
      reliabilityStatus: "Very Reliable",
      experience: "2+ years",
      languages: ["Catalan", "Spanish", "English"],
      friendIds: [],
      blockedUserIds: [],
      socialLinks: { instagram: "marc_padel", website: "https://marc.com" },
      privacySettings: { publicProfile: true, showMatchHistory: true, showSocialLinks: true }
    },
    { 
      id: "2", 
      name: "Ana", 
      email: "ana@padel.com",
      password: "password123",
      phone: "+34 600 000 002",
      skillLevel: "Silver", 
      location: { lat: 41.3879, lng: 2.1699, city: "Barcelona" }, 
      bio: "Defensive right player.",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      favoriteClubs: ["Fairplay Padel Club"],
      interests: ["Casual Games", "Mixed Matches"],
      lfgStatus: "Now",
      lastActive: new Date().toISOString(),
      favoritePlayerIds: [],
      completedGamesCount: 8,
      attendedGamesCount: 7,
      missedGamesCount: 1,
      reliabilityStatus: "Regularly Appears",
      experience: "1-2 years",
      languages: ["Spanish", "English"],
      friendIds: [],
      blockedUserIds: [],
      privacySettings: { publicProfile: true, showMatchHistory: true, showSocialLinks: false }
    },
    { 
      id: "3", 
      name: "Joan", 
      email: "joan@padel.com",
      password: "password123",
      phone: "+34 600 000 003",
      skillLevel: "Bronze", 
      location: { lat: 41.3947, lng: 2.1488, city: "Barcelona" }, 
      bio: "Looking for fun games.",
      interests: ["Social Padel"],
      lastActive: new Date().toISOString(),
      favoritePlayerIds: [],
      completedGamesCount: 2,
      attendedGamesCount: 2,
      missedGamesCount: 0,
      reliabilityStatus: "New Player",
      experience: "Less than 6 months",
      languages: ["Catalan", "Spanish"],
      friendIds: [],
      blockedUserIds: [],
      privacySettings: { publicProfile: true, showMatchHistory: false, showSocialLinks: false }
    },
  ];

  const clubs = [
    {
      id: "c1",
      name: "Padel Indoor Barcelona",
      address: "Carrer de Veneçuela, 78",
      city: "Barcelona",
      location: { lat: 41.4087, lng: 2.1988 },
      website: "https://padelindoorbarcelona.com",
      phone: "+34 931 234 567"
    },
    {
      id: "c2",
      name: "Fairplay Padel Club",
      address: "Carrer de Pollentia, 6",
      city: "Barcelona",
      location: { lat: 41.3654, lng: 2.1456 },
      website: "https://fairplaypadel.com"
    }
  ];

  const groups = [
    {
      id: "gr1",
      name: "Morning Warriors",
      description: "Aggressive morning matches for Gold/Silver players.",
      adminIds: ["1"],
      memberIds: ["1", "2"],
      city: "Barcelona",
      visibility: "public",
      recommendedLevel: "Gold",
      chat: [],
      createdAt: new Date().toISOString()
    }
  ];

  const games: any[] = [
    {
      id: "g1",
      creatorId: "1",
      datetime: new Date(Date.now() + 86400000).toISOString(),
      location: "Padel Indoor Barcelona",
      clubId: "c1",
      requiredPlayers: 3,
      joinedPlayers: ["1"],
      recommendedLevel: "Gold",
      gameType: "Competitive",
      note: "Looking for high level game",
      requests: [],
      chat: [],
      attendanceConfirmed: false,
      attendanceRecords: {},
      status: "scheduled",
      isCompleted: false,
      visibility: "public",
      invitedUserIds: []
    },
    {
      id: "g2",
      creatorId: "2",
      datetime: new Date(Date.now() + 172800000).toISOString(),
      location: "Fairplay Padel Club",
      clubId: "c2",
      requiredPlayers: 2,
      joinedPlayers: ["2", "3"],
      recommendedLevel: "Silver",
      gameType: "Friendly",
      requests: [],
      chat: [
        { id: "c1", userId: "2", userName: "Ana", text: "Ready for some fun!", timestamp: new Date().toISOString() }
      ],
      attendanceConfirmed: false,
      attendanceRecords: {},
      status: "scheduled",
      isCompleted: false,
      visibility: "public",
      invitedUserIds: []
    },
    {
      id: "g-past-1",
      creatorId: "1",
      datetime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      location: "Padel Indoor Barcelona",
      clubId: "c1",
      requiredPlayers: 0,
      joinedPlayers: ["1", "2", "3"],
      recommendedLevel: "Silver",
      gameType: "Friendly",
      status: "played" as const,
      isCompleted: true,
      result: {
        score: "6-4, 6-3",
        sets: [{ team1: 6, team2: 4 }, { team1: 6, team2: 3 }]
      },
      requests: [],
      chat: [],
      attendanceConfirmed: true,
      attendanceRecords: { "1": "appeared", "2": "appeared", "3": "appeared" },
      visibility: "public",
      invitedUserIds: []
    }
  ];

  const friendRequests: FriendRequest[] = [];
  const groupInvitations: GroupInvitation[] = [];
  const notifications: any[] = [
    {
      id: "n1",
      userId: "1",
      type: "game_near",
      title: "Match Nearby!",
      message: "A Gold level match is starting at Padel Indoor in 2 hours.",
      gameId: "g3",
      timestamp: new Date().toISOString(),
      read: false
    }
  ];

  // API Routes
  app.post("/api/friends/request", (req, res) => {
    const { fromUserId, toUserId } = req.body;
    const fromUser = users.find(u => u.id === fromUserId);
    const toUser = users.find(u => u.id === toUserId);

    if (!fromUser || !toUser) return res.status(404).json({ error: "User not found" });

    const request = {
      id: Math.random().toString(36).substr(2, 9),
      fromUserId,
      toUserId,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    };

    friendRequests.push(request);
    res.json(request);
  });

  app.post("/api/friends/respond", (req, res) => {
    const { requestId, status } = req.body;
    const request = friendRequests.find(r => r.id === requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    request.status = status;

    if (status === 'accepted') {
      const u1 = users.find(u => u.id === request.fromUserId);
      const u2 = users.find(u => u.id === request.toUserId);
      if (u1 && u2) {
        if (!u1.friendIds) u1.friendIds = [];
        if (!u2.friendIds) u2.friendIds = [];
        if (!u1.friendIds.includes(u2.id)) u1.friendIds.push(u2.id);
        if (!u2.friendIds.includes(u1.id)) u2.friendIds.push(u1.id);
      }
    }

    res.json(request);
  });

  app.post("/api/register", (req, res) => {
    const { name, email, phone, password } = req.body;
    
    // Check if user already exists with this email or phone (simple check for demo)
    const existing = users.find(u => u.email === email || u.phone === phone);
    if (existing) {
      return res.status(400).json({ error: "User already exists with this email or phone" });
    }

    const newUser: any = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      phone,
      password,
      skillLevel: "Bronze", // Default
      location: { lat: 41.3851, lng: 2.1734, city: "Barcelona" }, // Default
      bio: "",
      friendIds: [],
      blockedUserIds: [],
      privacySettings: { publicProfile: true, showMatchHistory: true, showSocialLinks: false },
      lastActive: new Date().toISOString()
    };

    users.push(newUser);
    res.status(201).json(newUser);
  });

  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    // Don't send password back
    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });
  
  app.post("/api/users/:targetId/block", (req, res) => {
    const { targetId } = req.params;
    const { userId } = req.body;
    
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: "User not found" });
    
    const user = users[userIndex];
    if (!user.blockedUserIds) user.blockedUserIds = [];
    
    if (user.blockedUserIds.includes(targetId)) {
      // Unblock
      user.blockedUserIds = user.blockedUserIds.filter(id => id !== targetId);
    } else {
      // Block
      user.blockedUserIds.push(targetId);
      // Remove from friends if they were friends
      user.friendIds = user.friendIds.filter(id => id !== targetId);
      
      // Also remove current user from target's friends
      const targetIndex = users.findIndex(u => u.id === targetId);
      if (targetIndex !== -1) {
        users[targetIndex].friendIds = users[targetIndex].friendIds.filter(id => id !== userId);
      }
    }
    
    res.json(user);
  });

  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const userData = req.body;
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      const existingMe = users.find(u => u.id === id);
      if (existingMe) {
        Object.assign(existingMe, userData, { lastActive: new Date().toISOString() });
        return res.json(existingMe);
      } else {
        const newUser = { id, ...userData, lastActive: new Date().toISOString() };
        users.push(newUser);
        return res.json(newUser);
      }
    }
    
    users[userIndex] = { ...users[userIndex], ...userData, lastActive: new Date().toISOString() };
    res.json(users[userIndex]);
  });

  app.post("/api/users/:id/favorite", (req, res) => {
    const { id } = req.params;
    const { targetUserId } = req.body;
    const user = users.find(u => u.id === id);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (!user.favoritePlayerIds) user.favoritePlayerIds = [];
    
    const index = user.favoritePlayerIds.indexOf(targetUserId);
    if (index > -1) {
      user.favoritePlayerIds.splice(index, 1);
    } else {
      user.favoritePlayerIds.push(targetUserId);
    }
    res.json(user);
  });

  app.get("/api/games", (req, res) => {
    const enrichedGames = games.map(game => {
      const creator = users.find(u => u.id === game.creatorId);
      return { ...game, creator };
    });
    res.json(enrichedGames);
  });

  app.post("/api/games", (req, res) => {
    const { creator_id, datetime, location, clubId, requiredPlayers, recommendedLevel, gameType, note, recurrence } = req.body;
    
    const createGame = (dt: string, rid?: string) => ({
      id: Math.random().toString(36).substr(2, 9),
      creatorId: creator_id,
      datetime: dt,
      location,
      clubId,
      requiredPlayers: Number(requiredPlayers),
      recommendedLevel,
      gameType,
      note,
      joinedPlayers: [creator_id],
      requests: [],
      chat: [],
      attendanceConfirmed: false,
      attendanceRecords: {},
      isRecurring: !!recurrence,
      recurrenceId: rid,
      status: "scheduled",
      isCompleted: false,
      visibility: req.body.visibility || 'public',
      groupId: req.body.groupId,
      invitedUserIds: req.body.invitedUserIds || []
    });

    const baseGame = createGame(datetime);
    games.push(baseGame);

    // Send invitations
    if (baseGame.invitedUserIds && baseGame.invitedUserIds.length > 0) {
      baseGame.invitedUserIds.forEach(uid => {
        notifications.push({
          id: Math.random().toString(36).substr(2, 9),
          userId: uid,
          type: "new_request",
          title: "Match Invitation!",
          message: `You have been invited to a match at ${location}.`,
          gameId: baseGame.id,
          timestamp: new Date().toISOString(),
          read: false
        });
      });
    }

    if (recurrence && recurrence !== 'none') {
      const rid = baseGame.id;
      baseGame.recurrenceId = rid;
      
      // Create 3 future instances for the MVP demo
      const startDate = new Date(datetime);
      for (let i = 1; i <= 3; i++) {
        const nextDate = new Date(startDate);
        if (recurrence === 'weekly') nextDate.setDate(startDate.getDate() + (i * 7));
        else if (recurrence === 'biweekly') nextDate.setDate(startDate.getDate() + (i * 14));
        else if (recurrence === 'monthly') nextDate.setMonth(startDate.getMonth() + i);
        
        games.push(createGame(nextDate.toISOString(), rid));
      }
    }

    res.status(201).json(baseGame);
  });

  app.get("/api/notifications/:userId", (req, res) => {
    const { userId } = req.params;
    const userNotifications = notifications.filter(n => n.userId === userId || n.userId === 'all');
    res.json(userNotifications);
  });

  app.get("/api/groups", (req, res) => {
    res.json(groups);
  });

  app.get("/api/clubs", (req, res) => {
    res.json(clubs);
  });

  app.post("/api/games/:id/request", (req, res) => {
    const { userId, userName } = req.body;
    const gameId = req.params.id;
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (game.joinedPlayers.includes(userId)) return res.status(400).json({ error: "Already joined" });
    
    if (!game.requests) game.requests = [];
    if (game.requests.find(r => r.userId === userId)) return res.status(400).json({ error: "Request already sent" });

    game.requests.push({ userId, userName, status: "pending" });
    res.json(game);
  });

  app.post("/api/games/:id/approve", (req, res) => {
    const { userId, approve } = req.body;
    const gameId = req.params.id;
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    
    const request = game.requests?.find(r => r.userId === userId);
    if (!request) return res.status(404).json({ error: "Request not found" });

    if (approve) {
      request.status = "accepted";
      game.joinedPlayers.push(userId);
    } else {
      request.status = "rejected";
    }
    res.json(game);
  });

  app.post("/api/games/:id/chat", (req, res) => {
    const { userId, userName, text } = req.body;
    const gameId = req.params.id;
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (!game.joinedPlayers.includes(userId)) return res.status(403).json({ error: "Must be a participant to chat" });

    const message = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      userName,
      text,
      timestamp: new Date().toISOString()
    };
    
    if (!game.chat) game.chat = [];
    game.chat.push(message);
    res.json(message);
  });

  app.post("/api/games/:id/leave", (req, res) => {
    const { userId } = req.body;
    const gameId = req.params.id;
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    
    game.joinedPlayers = game.joinedPlayers.filter(id => id !== userId);
    res.json(game);
  });

  app.get("/api/clubs", (req, res) => {
    res.json(clubs);
  });

  app.get("/api/groups", (req, res) => {
    res.json(groups);
  });

  app.post("/api/groups", (req, res) => {
    const { name, description, city, adminId, recommendedLevel, visibility } = req.body;
    const newGroup = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      description,
      city,
      adminIds: [adminId],
      memberIds: [adminId],
      recommendedLevel,
      visibility: visibility || 'public',
      chat: [],
      createdAt: new Date().toISOString()
    };
    groups.push(newGroup);
    res.status(201).json(newGroup);
  });

  app.post("/api/groups/:id/chat", (req, res) => {
    const { userId, userName, text } = req.body;
    const groupId = req.params.id;
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!group.memberIds.includes(userId)) return res.status(403).json({ error: "Must be a member to chat" });

    const message = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      userName,
      text,
      timestamp: new Date().toISOString()
    };
    
    if (!group.chat) group.chat = [];
    group.chat.push(message);
    res.json(message);
  });

  app.post("/api/groups/:id/invite", (req, res) => {
    const { invitedUserId, invitedByUserId } = req.body;
    const groupId = req.params.id;

    const invitation = {
      id: Math.random().toString(36).substr(2, 9),
      groupId,
      invitedUserId,
      invitedByUserId,
      status: 'pending' as const,
      createdAt: new Date().toISOString()
    };

    groupInvitations.push(invitation);
    res.json(invitation);
  });

  app.post("/api/groups/:id/join", (req, res) => {
    const { userId } = req.body;
    const groupId = req.params.id;
    const group = groups.find(g => g.id === groupId);
    
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.memberIds.includes(userId)) return res.json(group);

    group.memberIds.push(userId);
    res.json(group);
  });

  app.post("/api/games/:id/result", (req, res) => {
    const gameId = req.params.id;
    const { score, sets } = req.body;
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    
    game.isCompleted = true;
    game.status = "played";
    game.result = { score, sets };
    
    res.json(game);
  });

  app.post("/api/games/:id/attendance", (req, res) => {
    const gameId = req.params.id;
    const { attendanceRecords } = req.body; // Map of userId -> "appeared" | "missed"
    const game = games.find(g => g.id === gameId);
    
    if (!game) return res.status(404).json({ error: "Game not found" });
    
    game.attendanceConfirmed = true;
    game.attendanceRecords = attendanceRecords;

    // Update user stats
    Object.entries(attendanceRecords).forEach(([uid, status]) => {
      const user = users.find(u => u.id === uid);
      if (user) {
        user.completedGamesCount = (user.completedGamesCount || 0) + 1;
        if (status === "appeared") {
          user.attendedGamesCount = (user.attendedGamesCount || 0) + 1;
        } else if (status === "missed") {
          user.missedGamesCount = (user.missedGamesCount || 0) + 1;
        }
        
        // Simple reliability logic
        const total = user.completedGamesCount;
        const attended = user.attendedGamesCount || 0;
        const ratio = attended / total;
        
        if (total < 3) user.reliabilityStatus = "New Player";
        else if (ratio > 0.9) user.reliabilityStatus = "Very Reliable";
        else if (ratio > 0.7) user.reliabilityStatus = "Regularly Appears";
        else user.reliabilityStatus = "Unreliable";
      }
    });

    res.json(game);
  });

  app.put("/api/games/:id", (req, res) => {
    const { id } = req.params;
    const gameIndex = games.findIndex(g => g.id === id);
    if (gameIndex === -1) return res.status(404).json({ error: "Game not found" });

    const oldInvited = games[gameIndex].invitedUserIds || [];
    const newInvited = req.body.invitedUserIds || [];
    const newlyInvited = newInvited.filter((uid: string) => !oldInvited.includes(uid));

    // Update existing game
    games[gameIndex] = { 
      ...games[gameIndex], 
      ...req.body,
      // Ensure specific fields are correctly formatted if necessary
      requiredPlayers: Number(req.body.requiredPlayers || games[gameIndex].requiredPlayers),
      invitedUserIds: newInvited
    };

    // Send notifications for newly invited players
    newlyInvited.forEach((uid: string) => {
      notifications.push({
        id: Math.random().toString(36).substr(2, 9),
        userId: uid,
        type: "new_request",
        title: "Match Invitation!",
        message: `You have been invited to a match at ${games[gameIndex].location}.`,
        gameId: id,
        timestamp: new Date().toISOString(),
        read: false
      });
    });

    res.json(games[gameIndex]);
  });

  app.delete("/api/games/:id", (req, res) => {
    const { id } = req.params;
    const gameIndex = games.findIndex(g => g.id === id);
    if (gameIndex === -1) return res.status(404).json({ error: "Game not found" });
    
    games.splice(gameIndex, 1);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
