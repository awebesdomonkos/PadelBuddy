export enum SkillLevel {
  Bronze = "Bronze",
  Silver = "Silver",
  Gold = "Gold",
  Platinum = "Platinum",
  Diamond = "Diamond",
  Pro = "Pro",
}

export enum GameType {
  Friendly = "Friendly",
  Competitive = "Competitive",
  Training = "Training",
}

export enum PlayTime {
  Morning = "Morning",
  Day = "Day",
  Evening = "Evening",
}

export enum LFGStatus {
  None = "None",
  Now = "Now",
  Today = "Today",
  ThisWeek = "This Week",
}

export enum PadelExperience {
  Less6Months = "Less than 6 months",
  Months6To12 = "6-12 months",
  Years1To2 = "1-2 years",
  Years2Plus = "2+ years",
}

export type Language = 'hu' | 'en' | 'de' | 'es' | 'fr' | 'uk' | 'ru';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  skillLevel: SkillLevel;
  location: {
    lat: number;
    lng: number;
    city: string;
  };
  bio?: string;
  avatarUrl?: string;
  favoriteClubs?: string[];
  interests?: string[];
  playTime?: PlayTime[];
  playStyle?: "Casual" | "Competitive";
  lfgStatus?: LFGStatus;
  lastActive?: string;
  favoritePlayerIds?: string[];
  completedGamesCount?: number;
  attendedGamesCount?: number;
  missedGamesCount?: number;
  reliabilityStatus?: "Very Reliable" | "Regularly Appears" | "New Player" | "Unreliable";
  experience?: PadelExperience;
  languagePreference?: Language;
  languages?: string[];
  friendIds: string[];
  friendRequests?: string[]; // IDs of FriendRequest
  blockedUserIds: string[];
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    website?: string;
  };
  privacySettings?: {
    publicProfile: boolean;
    showMatchHistory: boolean;
    showSocialLinks: boolean;
  };
  notificationSettings?: {
    nearGames: boolean;
    reminders: boolean;
    requests: boolean;
    friends: boolean;
    groups: boolean;
  };
}

export interface Club {
  id: string;
  name: string;
  address: string;
  city: string;
  location: { lat: number; lng: number };
  website?: string;
  phone?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  adminIds: string[]; // Changed from adminId to supporting multiple
  memberIds: string[];
  city: string;
  visibility: 'public' | 'private';
  recommendedLevel?: SkillLevel;
  chat?: ChatMessage[];
  createdAt: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  invitedUserId: string;
  invitedByUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: "game_near" | "player_needed" | "reminder" | "request_status" | "new_request";
  title: string;
  message: string;
  gameId?: string;
  friendRequestId?: string;
  timestamp: string;
  read: boolean;
}

export interface GameRequest {
  userId: string;
  userName: string;
  status: "pending" | "accepted" | "rejected";
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Game {
  id: string;
  creatorId: string;
  creator?: User;
  datetime: string;
  location: string;
  clubId?: string;
  requiredPlayers: number;
  joinedPlayers: string[];
  recommendedLevel?: SkillLevel;
  gameType?: GameType;
  note?: string;
  requests?: GameRequest[];
  chat?: ChatMessage[];
  attendanceConfirmed?: boolean;
  attendanceRecords?: Record<string, "appeared" | "missed" | "unknown">;
  isRecurring?: boolean;
  recurrenceId?: string;
  isCompleted?: boolean;
  status: "scheduled" | "played" | "cancelled";
  result?: {
    score: string;
    sets: { team1: number; team2: number }[];
  };
  groupId?: string;
  visibility: 'public' | 'group-only' | 'invite-only';
  invitedUserIds?: string[];
}
