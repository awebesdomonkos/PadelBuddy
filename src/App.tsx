import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  MapPin, 
  Calendar, 
  Search, 
  User as UserIcon, 
  LogOut,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Edit2,
  Heart,
  Target,
  Image as ImageIcon,
  Check,
  CheckCircle2,
  X,
  Upload,
  Clock,
  ArrowLeft,
  Send,
  MessageSquare,
  AlertCircle,
  Shield,
  Trash2,
  Instagram,
  Facebook,
  Globe,
  Award,
  BookOpen,
  Eye,
  EyeOff,
  History,
  Smartphone,
  Smartphone as Phone
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useI18n } from './hooks/useI18n.ts';
import { useAuth } from './context/AuthContext.tsx';
import { 
  SkillLevel, 
  User, 
  Game, 
  GameType, 
  LFGStatus, 
  PlayTime, 
  Club, 
  Group, 
  Notification as PadelNotification,
  PadelExperience,
  Language
} from './types.ts';

export default function App() {
  const { currentUser, token, login, register, logout, authError, setAuthError, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'games' | 'players' | 'profile' | 'create' | 'groups' | 'mygames'>('games');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<User[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [notifications, setNotifications] = useState<PadelNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [gameFilter, setGameFilter] = useState<'all' | 'today' | 'tomorrow' | 'weekend' | 'lastminute'>('all');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'active' | 'lfg' | 'friends'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals / Overlays
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedGameDetail, setSelectedGameDetail] = useState<Game | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGroupChatOpen, setIsGroupChatOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isLevelTutorialOpen, setIsLevelTutorialOpen] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<Game | null>(null);
  const [gameIdToDelete, setGameIdToDelete] = useState<string | null>(null);
  const { t, lang, setLang } = useI18n('hu');

  // Registration/Auth state
  const [authForm, setAuthForm] = useState({ username: '', name: '', email: '', password: '', phone: '' });
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register'>('landing');
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);

  const safeFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned invalid JSON response from ${url}`);
    }
    if (!response.ok) {
      throw new Error(data?.message || data?.error || `Request to ${url} failed`);
    }
    return data;
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const results = await Promise.all([
        safeFetch('/api/games', { headers }),
        safeFetch('/api/users', { headers }),
        safeFetch('/api/groups', { headers }),
        safeFetch('/api/clubs', { headers }),
        safeFetch(`/api/notifications/${currentUser?.id || 'me'}`, { headers })
      ]);
      
      const [gamesData, playersData, groupsData, clubsData, notifsData] = results;

      setGames(Array.isArray(gamesData) ? gamesData : []);
      setPlayers(Array.isArray(playersData) ? playersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setClubs(Array.isArray(clubsData) ? clubsData : []);
      setNotifications(Array.isArray(notifsData) ? notifsData : []);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, currentUser?.id]);

  useEffect(() => {
    if (currentUser?.languagePreference) {
      setLang(currentUser.languagePreference);
    } else {
      setLang('hu');
    }
  }, [currentUser?.languagePreference, setLang]);

  useEffect(() => {
    if (currentUser?.id) {
      fetchData();
      if (!currentUser.bio || !currentUser.location?.city) {
        setIsCompletingProfile(true);
      } else {
        setIsCompletingProfile(false);
      }
    } else if (!authLoading) {
      setAuthMode('landing');
      fetchData();
    }
  }, [currentUser, authLoading, fetchData]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(authForm);
      setAuthMode('landing');
      setIsCompletingProfile(true);
    } catch (err) {
      // Error handled by context
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(authForm.email.toLowerCase().trim(), authForm.password);
      setAuthMode('landing');
    } catch (err) {
      // Error handled by context
    }
  };

  const handleProfileComplete = async (data: Partial<User>) => {
    if (!currentUser) return;
    try {
      const updatedUser = await safeFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const storedUser = localStorage.getItem('padel_user');
      if (storedUser) {
         localStorage.setItem('padel_user', JSON.stringify(updatedUser));
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    setAuthMode('landing');
  };


  const handleJoinGame = async (gameId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/games/${gameId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name })
      });
      fetchData(); // Refresh to see "Pending"
    } catch (err) {
      console.error("Failed to request joining game", err);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await safeFetch(`/api/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
      setGameIdToDelete(null);
      if (selectedGame?.id === gameId) {
        setSelectedGame(null);
        setIsChatOpen(false);
      }
    } catch (err) {
      console.error("Failed to delete game", err);
    }
  };

  const handleToggleBlock = async (targetId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/users/${targetId}/block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      fetchData();
      
      // If the blocked player was selected, maybe close the profile
      if (selectedPlayer?.id === targetId) {
        setSelectedPlayer(null);
      }
    } catch (err) {
      console.error("Failed to toggle block", err);
    }
  };

  const handleApproveRequest = async (gameId: string, userId: string, approve: boolean) => {
    try {
      await safeFetch(`/api/games/${gameId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, approve })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (gameId: string, text: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/games/${gameId}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name, text })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (targetUserId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/users/${currentUser.id}/favorite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRepeatGame = (game: Game) => {
    localStorage.setItem('padel_repeat_game', JSON.stringify(game));
    setActiveTab('create');
  };

  const handleConfirmAttendance = async (gameId: string, records: Record<string, "appeared" | "missed">) => {
    try {
      await safeFetch(`/api/games/${gameId}/attendance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ attendanceRecords: records })
      });
      fetchData();
      setIsAttendanceOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendGroupMessage = async (text: string) => {
    if (!currentUser || !selectedGroup) return;
    try {
      const newMessage = await safeFetch(`/api/groups/${selectedGroup.id}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name, text })
      });
      // Optimistic update
      const updatedGroups = groups.map(g => {
        if (g.id === selectedGroup.id) {
          return { ...g, chat: [...(g.chat || []), newMessage] };
        }
        return g;
      });
      setGroups(updatedGroups);
      setSelectedGroup({ ...selectedGroup, chat: [...(selectedGroup.chat || []), newMessage] });
    } catch (err) {
      console.error("Failed to send group message", err);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/groups/${groupId}/join`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      fetchData();
    } catch (err) {
      console.error("Failed to join group", err);
    }
  };

  const handleRecordResult = async (gameId: string, result: { score: string, sets: { team1: number, team2: number }[] }) => {
    try {
      await safeFetch(`/api/games/${gameId}/result`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(result)
      });
      fetchData();
      setIsResultModalOpen(false);
    } catch (err) {
      console.error("Failed to record result", err);
    }
  };

  const handleSendFriendRequest = async (toUserId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch('/api/friends/request', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fromUserId: currentUser.id, toUserId })
      });
      fetchData();
    } catch (err) {
      console.error("Failed to send friend request", err);
    }
  };

  const handleFriendResponse = async (requestId: string, status: 'accepted' | 'rejected') => {
    try {
      await safeFetch('/api/friends/respond', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, status })
      });
      fetchData();
    } catch (err) {
      console.error("Failed to respond to friend request", err);
    }
  };

  const handleCreateGroup = async (groupData: Partial<Group>) => {
    if (!currentUser) return;
    try {
      await safeFetch('/api/groups', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...groupData, adminId: currentUser.id })
      });
      fetchData();
      setActiveTab('groups');
    } catch (err) {
      console.error("Failed to create group", err);
    }
  };

  const handleInviteToGroup = async (groupId: string, invitedUserId: string) => {
    if (!currentUser) return;
    try {
      await safeFetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invitedUserId, invitedByUserId: currentUser.id })
      });
      fetchData();
    } catch (err) {
      console.error("Failed to invite to group", err);
    }
  };

  const handleUpdateUser = async (updatedData: Partial<User>) => {
    if (!currentUser) return;
    try {
      const savedUser = await safeFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...currentUser, ...updatedData })
      });
      fetchData();
      setIsEditingProfile(false);
    } catch (err) {
      console.error("Failed to update user", err);
    }
  };

  const handleUpdateLanguage = async (newLang: Language) => {
    if (!currentUser) return;
    setLang(newLang);
    handleUpdateUser({ languagePreference: newLang });
  };

  if (!currentUser) {
    if (authMode === 'register') {
      return (
        <RegistrationForm 
          formData={authForm}
          setFormData={setAuthForm}
          onSubmit={handleRegister}
          error={authError}
          onCancel={() => {
            setAuthMode('landing');
            setAuthError(null);
          }}
          t={t}
        />
      );
    }
    if (authMode === 'login') {
      return (
        <LoginForm 
          formData={authForm}
          setFormData={setAuthForm}
          onSubmit={handleLogin}
          error={authError}
          onCancel={() => {
            setAuthMode('landing');
            setAuthError(null);
          }}
          t={t}
        />
      );
    }
    return (
      <AuthScreen 
        onSelectMode={(mode) => {
          setAuthError(null);
          setAuthMode(mode);
        }} 
        t={t} 
      />
    );
  }

  if (isCompletingProfile && currentUser) {
    return (
      <div className="min-h-screen bg-[#F8F8F5] p-4 md:p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto w-full">
          <div className="mb-10 text-center sm:text-left">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-2">{t('auth.completeProfileTitle')}</h1>
            <p className="text-[#141414]/60 font-medium">{t('auth.completeProfileSub')}</p>
          </div>
          <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl shadow-black/5">
            <ProfileEdit 
              user={currentUser} 
              onSave={handleProfileComplete} 
              onCancel={() => {}} 
              onShowTutorial={() => setIsLevelTutorialOpen(true)}
            />
          </div>
        </div>
        
        {isLevelTutorialOpen && (
          <LevelTutorial onClose={() => setIsLevelTutorialOpen(false)} t={t} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-[#E2FF3B]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-[#141414]/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('games')}>
              <div className="w-8 h-8 bg-[#141414] rounded-full flex items-center justify-center">
                <TrendingUp className="text-[#E2FF3B] w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight">FindYour PadelBuddy</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => setActiveTab('games')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'games' ? 'text-[#141414] bg-[#E2FF3B]' : 'text-[#141414]/40 hover:text-[#141414]'}`}
              >
                {t('nav.games')}
              </button>
              <button 
                onClick={() => setActiveTab('players')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'players' ? 'text-[#141414] bg-[#E2FF3B]' : 'text-[#141414]/40 hover:text-[#141414]'}`}
              >
                {t('nav.players')}
              </button>
              <button 
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'groups' ? 'text-[#141414] bg-[#E2FF3B]' : 'text-[#141414]/40 hover:text-[#141414]'}`}
              >
                {t('nav.groups')}
              </button>
              <button 
                onClick={() => setActiveTab('mygames')}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'mygames' ? 'text-[#141414] bg-[#E2FF3B]' : 'text-[#141414]/40 hover:text-[#141414]'}`}
              >
                {t('nav.myGames') || 'Saját meccsek'}
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsNotificationsOpen(true)}
              className="w-10 h-10 rounded-full bg-[#141414]/5 flex items-center justify-center relative hover:bg-[#141414]/10 transition-colors"
            >
              <AlertCircle className="w-5 h-5 opacity-60" />
              {notifications.some(n => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 p-1 pr-3 rounded-full border transition-all ${activeTab === 'profile' ? 'bg-[#E2FF3B] border-[#141414]/10' : 'bg-[#141414]/5 border-transparent hover:border-[#141414]/10'}`}
            >
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden">
                {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold hidden sm:block">{currentUser.name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-32 md:pb-12 pt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'games' && (
            <motion.div
              key="games"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter">{t('games.findGame')}</h2>
                  <p className="text-xs sm:text-sm opacity-60">{t('games.findGameSub')}</p>
                </div>
                <button 
                  onClick={() => setActiveTab('create')}
                  className="bg-[#141414] text-[#E2FF3B] p-3 rounded-full hover:rotate-90 transition-transform duration-300"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              {/* Game Filters */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'today', 'tomorrow', 'weekend', 'lastminute'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setGameFilter(f)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      gameFilter === f ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/40'
                    }`}
                  >
                    {t(`games.filters.${f}`)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {isLoading ? (
                  <div className="md:col-span-2 lg:col-span-3 py-20 text-center font-mono text-xs opacity-50 uppercase tracking-widest">{t('common.scanning')}</div>
                ) : (
                  (() => {
                    const filteredGames = (games || []).filter(g => {
                      if (currentUser.blockedUserIds?.includes(g.creatorId)) return false;

                      // Visibility controls
                      if (g.visibility === 'group-only' && g.groupId) {
                        const group = (groups || []).find(gr => gr.id === g.groupId);
                        if (!group?.memberIds.includes(currentUser.id) && g.creatorId !== currentUser.id) return false;
                      }
                      
                      if (g.visibility === 'invite-only') {
                        if (!g.invitedUserIds?.includes(currentUser.id) && g.creatorId !== currentUser.id) return false;
                      }

                      const date = new Date(g.datetime);
                      const now = new Date();
                      
                      if (gameFilter === 'lastminute') {
                        const diffHours = (date.getTime() - now.getTime()) / 3600000;
                        const slotsLeft = (g.requiredPlayers + 1) - g.joinedPlayers.length;
                        return diffHours > 0 && diffHours <= 3 && slotsLeft > 0;
                      }

                      if (gameFilter === 'today') return date.toDateString() === now.toDateString();
                      if (gameFilter === 'tomorrow') {
                        const tomorrow = new Date(now);
                        tomorrow.setDate(now.getDate() + 1);
                        return date.toDateString() === tomorrow.toDateString();
                      }
                      if (gameFilter === 'weekend') {
                        const day = date.getDay();
                        return day === 0 || day === 6;
                      }
                      return true;
                    });

                    // Sort by date (nearest first)
                    filteredGames.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

                    return filteredGames.length > 0 ? (
                      filteredGames.map(game => {
                        const myRequest = game.requests?.find(r => r.userId === currentUser.id);
                        return (
                          <GameCard 
                            key={game.id} 
                            game={game} 
                            t={t}
                            isJoined={game.joinedPlayers.includes(currentUser.id)}
                            requestStatus={myRequest?.status}
                            onJoin={() => handleJoinGame(game.id)}
                            onOpenChat={() => {
                              setSelectedGame(game);
                              setIsChatOpen(true);
                            }}
                            onEdit={() => {
                              setGameToEdit(game);
                              setActiveTab('create');
                            }}
                            isOwner={game.creatorId === currentUser.id}
                            onLeave={() => handleLeaveGame(game.id)}
                            onDelete={() => setGameIdToDelete(game.id)}
                            onRepeat={() => handleRepeatGame(game)}
                            onConfirmAttendance={() => {
                              setSelectedGame(game);
                              setIsAttendanceOpen(true);
                            }}
                            onRecordResult={() => {
                              setSelectedGame(game);
                              setIsResultModalOpen(true);
                            }}
                            onShowDetails={() => setSelectedGameDetail(game)}
                          />
                        );
                      })
                    ) : (
                      <div className="md:col-span-2 lg:col-span-3 py-20 text-center border-2 border-dashed border-[#141414]/10 rounded-3xl">
                        <p className="text-sm opacity-40">{t('common.noMatchesFound')}</p>
                      </div>
                    );
                  })()
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'players' && (
            <motion.div
              key="players"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter">{t('nav.players')}</h2>
                <p className="text-xs sm:text-sm opacity-60">{t('players.subTitle')}</p>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input 
                    type="text" 
                    placeholder={t('common.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none"
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {(['all', 'active', 'lfg', 'friends'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPlayerFilter(f)}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        playerFilter === f ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/40'
                      }`}
                    >
                      {f === 'lfg' ? t('profile.status') : f === 'friends' ? t('profile.friends') : t(`common.${f}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(players || [])
                  .filter(p => p.id !== currentUser.id)
                  .filter(p => !currentUser.blockedUserIds?.includes(p.id))
                  .filter(p => {
                    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     p.location.city.toLowerCase().includes(searchQuery.toLowerCase());
                    if (!matchSearch) return false;
                    
                    if (playerFilter === 'active') {
                      if (!p.lastActive) return false;
                      const lastActive = new Date(p.lastActive);
                      const anHourAgo = new Date(Date.now() - 3600000);
                      return lastActive > anHourAgo;
                    }
                    if (playerFilter === 'lfg') return p.lfgStatus && p.lfgStatus !== LFGStatus.None;
                    if (playerFilter === 'friends') return currentUser.friendIds?.includes(p.id);
                    
                    return true;
                  })
                  .map(player => (
                    <PlayerCard 
                      key={player.id} 
                      player={player} 
                      isFavorite={currentUser.favoritePlayerIds?.includes(player.id)}
                      onToggleFavorite={() => handleToggleFavorite(player.id)}
                      onOpenProfile={(p) => setSelectedPlayer(p)}
                    />
                  ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'groups' && (
            <motion.div
              key="groups"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <GroupsTab 
                groups={groups} 
                currentUser={currentUser!}
                onJoin={handleJoinGroup} 
                onOpenChat={(group) => {
                  setSelectedGroup(group);
                  setIsGroupChatOpen(true);
                }} 
                onCreateClick={() => setIsCreateGroupModalOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[40px] p-8 shadow-sm border border-[#141414]/5"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight mb-8">{t('games.createGame')}</h2>
              <CreateGameForm 
                creatorId={currentUser.id} 
                groups={(groups || []).filter(g => g.memberIds.includes(currentUser.id))}
                allUsers={players || []}
                t={t}
                lang={lang}
                gameToEdit={gameToEdit}
                onSuccess={() => {
                  fetchData();
                  setGameToEdit(null);
                  setActiveTab('games');
                }} 
                onShowTutorial={() => setIsLevelTutorialOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'mygames' && (
            <motion.div
              key="mygames"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tighter">{t('nav.myGames') || 'Saját meccsek'}</h2>
                  <p className="text-xs sm:text-sm opacity-60">{t('profile.matchHistory')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {(games || []).filter(g => g.creatorId === currentUser?.id || g.joinedPlayers.includes(currentUser?.id || '')).length > 0 ? (
                  (games || [])
                    .filter(g => g.creatorId === currentUser?.id || g.joinedPlayers.includes(currentUser?.id || ''))
                    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
                    .map(game => (
                      <GameCard 
                        key={game.id} 
                        game={game}
                        isJoined={game.joinedPlayers.includes(currentUser?.id || '')}
                        requestStatus={game.requests?.find(r => r.userId === currentUser?.id)?.status}
                        isOwner={game.creatorId === currentUser?.id}
                        t={t}
                        onShowDetails={() => setSelectedGameDetail(game)}
                        onJoin={() => handleJoinGame(game.id)}
                        onOpenChat={() => {
                          setSelectedGame(game);
                          setIsChatOpen(true);
                        }}
                        onEdit={() => {
                          setGameToEdit(game);
                          setActiveTab('create');
                        }}
                        onDelete={() => setGameIdToDelete(game.id)}
                        onLeave={() => handleLeaveGame(game.id)}
                        onRepeat={() => {
                          const newGame = { ...game, id: undefined, datetime: new Date(Date.now() + 86400000).toISOString(), joinedPlayers: [currentUser!.id], requests: [], chat: [] };
                          setGameToEdit(newGame as any);
                          setActiveTab('create');
                        }}
                        onConfirmAttendance={() => {
                          setSelectedGame(game);
                          setIsAttendanceOpen(true);
                        }}
                        onRecordResult={() => {
                          setSelectedGame(game);
                          setIsResultModalOpen(true);
                        }}
                      />
                    ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-white rounded-[40px] border border-[#141414]/5 shadow-sm">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold opacity-40 uppercase tracking-widest">{t('common.noData')}</p>
                    <button 
                      onClick={() => setActiveTab('games')}
                      className="mt-4 px-6 py-2 bg-[#141414] text-[#E2FF3B] rounded-xl text-xs font-black uppercase tracking-widest"
                    >
                      {t('games.findGame')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {!isEditingProfile ? (
                 <div className="space-y-8">
                  <div className="flex flex-col items-center py-6 text-center relative">
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="absolute top-0 right-0 p-3 bg-white shadow-sm border border-[#141414]/5 rounded-2xl hover:scale-105 transition-transform"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <div className="w-24 h-24 bg-[#141414] text-[#E2FF3B] rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-xl overflow-hidden">
                      {currentUser.avatarUrl ? (
                         <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-12 h-12" />
                      )}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">{currentUser.name}</h2>
                    <div className="flex gap-2 mt-2 flex-wrap justify-center">
                      <span className="px-3 py-1 bg-[#141414] text-[#E2FF3B] rounded-full text-xs font-bold uppercase tracking-widest">{currentUser.skillLevel}</span>
                      <span className="px-3 py-1 bg-[#141414]/5 rounded-full text-xs font-medium uppercase tracking-widest flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {currentUser.location.city}
                      </span>
                      {currentUser.lfgStatus && currentUser.lfgStatus !== LFGStatus.None && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {currentUser.lfgStatus ? t(`profile.lfg.${currentUser.lfgStatus}`) : t('profile.lfg.None')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 bg-white rounded-3xl p-6 shadow-sm border border-[#141414]/5">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#141414]/5">
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{t('profile.playStyle')}</h3>
                        <p className="text-sm font-bold">{currentUser.playStyle ? t(`profile.playStyles.${currentUser.playStyle}`) : t('profile.playStyles.Casual')}</p>
                      </div>
                      <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">{t('profile.reliability')}</h3>
                        <div className="flex flex-col">
                           <p className={`text-sm font-bold ${
                             currentUser.reliabilityStatus === 'Unreliable' ? 'text-red-500' : 
                             currentUser.reliabilityStatus === 'Very Reliable' ? 'text-green-600' : 'text-blue-600'
                           }`}>
                             {t(`profile.reliabilityStatus.${currentUser.reliabilityStatus || 'New Player'}`)}
                           </p>
                           {currentUser.completedGamesCount !== undefined && (
                             <span className="text-[9px] opacity-40 font-bold uppercase">{currentUser.attendedGamesCount || 0} / {currentUser.completedGamesCount} {t('profile.gamesAttended')}</span>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 py-4 border-b border-[#141414]/5">
                      <div className="text-center p-2 bg-[#141414]/5 rounded-2xl">
                        <p className="text-[8px] font-black uppercase opacity-40">{t('profile.playedGames')}</p>
                        <p className="text-xl font-black">{currentUser.attendedGamesCount || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-[#141414]/5 rounded-2xl">
                        <p className="text-[8px] font-black uppercase opacity-40">{t('nav.groups')}</p>
                        <p className="text-xl font-black">{(groups || []).filter(g => g.memberIds.includes(currentUser.id)).length}</p>
                      </div>
                      <div className="text-center p-2 bg-[#141414]/5 rounded-2xl">
                        <p className="text-[8px] font-black uppercase opacity-40">{t('profile.friends')}</p>
                        <p className="text-xl font-black">{currentUser.friendIds?.length || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-[#141414]/5 rounded-2xl">
                        <p className="text-[8px] font-black uppercase opacity-40">{t('profile.skillLevel')}</p>
                        <p className="text-xl font-black truncate">{currentUser.skillLevel}</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#141414]/5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                          <Users className="w-3 h-3" /> {t('profile.friends')}
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {(players || []).filter(p => currentUser.friendIds?.includes(p.id)).map(friend => (
                          <div key={friend.id} className="flex items-center justify-between p-3 bg-[#141414]/5 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#141414] overflow-hidden flex items-center justify-center">
                                {friend.avatarUrl ? <img src={friend.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-[#E2FF3B]" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{friend.name}</p>
                                <p className="text-[10px] opacity-40 font-bold uppercase">{friend.skillLevel} • {friend.location.city}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setActiveTab('create');
                              }}
                              className="px-3 py-1.5 bg-[#E2FF3B] text-[#141414] rounded-lg text-[10px] font-black uppercase tracking-widest"
                            >
                              {t('groups.invite')}
                            </button>
                          </div>
                        ))}
                        {(!currentUser.friendIds || currentUser.friendIds.length === 0) && (
                          <p className="text-xs opacity-40 italic text-center py-4">{t('profile.noFriends')}</p>
                        )}
                      </div>
                    </div>

                    <div className="pb-4 border-b border-[#141414]/5">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">{t('profile.playTimes')}</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentUser.playTime && currentUser.playTime.length > 0 ? (
                          currentUser.playTime.map(t => (
                            <span key={t} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">{t}</span>
                          ))
                        ) : (
                          <p className="text-xs opacity-40 italic">{t('common.noData')}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">{t('profile.bio')}</h3>
                      <p className="text-sm leading-relaxed">{currentUser.bio || t('common.noData')}</p>
                    </div>

                    {(currentUser.interests && currentUser.interests.length > 0) && (
                      <div className="pt-4 border-t border-[#141414]/5">
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3 flex items-center gap-2">
                          <Target className="w-3 h-3" /> {t('profile.interests')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {currentUser.interests.map(interest => (
                            <span key={interest} className="px-3 py-1.5 bg-[#141414]/5 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                              {t(`profile.interestsList.${interest}`) || interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(currentUser.favoriteClubs && currentUser.favoriteClubs.length > 0) && (
                      <div className="pt-4 border-t border-[#141414]/5">
                        <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-3 flex items-center gap-2">
                          <Heart className="w-3 h-3" /> {t('profile.favoriteClubs')}
                        </h3>
                        <div className="space-y-2">
                          {currentUser.favoriteClubs.map(club => (
                            <div key={club} className="flex items-center gap-2 text-sm font-medium">
                              <div className="w-1.5 h-1.5 bg-[#E2FF3B] rounded-full" />
                              {club}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-[#141414]/5">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                          <History className="w-3 h-3" /> {t('profile.matchHistory')}
                        </h3>
                      </div>
                      <MatchHistory games={(games || []).filter(g => g.joinedPlayers.includes(currentUser.id))} />
                    </div>

                    <div className="pt-6 border-t border-[#141414]/5">
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold hover:bg-red-100 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> {t('common.signOut')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <ProfileEdit 
                  user={currentUser} 
                  onSave={handleUpdateUser} 
                  onCancel={() => setIsEditingProfile(false)} 
                  onShowTutorial={() => setIsLevelTutorialOpen(true)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {gameIdToDelete && (
          <ConfirmDialog 
            title={t('games.deleteConfirmTitle') || 'Játék törlése?'}
            message={t('games.deleteConfirmMessage') || 'Biztosan törölni szeretnéd ezt a játékot? Ez a művelet nem vonható vissza.'}
            confirmLabel={t('common.delete') || 'Törlés'}
            cancelLabel={t('common.cancel') || 'Mégse'}
            onConfirm={() => handleDeleteGame(gameIdToDelete)}
            onCancel={() => setGameIdToDelete(null)}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-[#141414]/5 pb-[env(safe-area-inset-bottom,24px)]">
        <div className="flex justify-around items-center px-2 pt-3 pb-1">
          <NavBtn 
            active={activeTab === 'games'} 
            onClick={() => setActiveTab('games')} 
            icon={<MapPin className="w-5 h-5" />} 
            label={t('nav.games')} 
          />
          <NavBtn 
            active={activeTab === 'players'} 
            onClick={() => setActiveTab('players')} 
            icon={<Users className="w-5 h-5" />} 
            label={t('nav.players')} 
          />
          <NavBtn 
            active={activeTab === 'create' || !!gameToEdit} 
            onClick={() => {
              if (activeTab !== 'create') {
                setGameToEdit(null);
                setActiveTab('create');
              }
            }} 
            isSpecial={true}
            icon={
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'create' ? 'bg-[#E2FF3B] text-[#141414] shadow-lg shadow-[#E2FF3B]/30 scale-110' : 'bg-[#141414] text-white shadow-md hover:bg-[#252525]'}`}>
                {gameToEdit ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </div>
            } 
            label={gameToEdit ? t('common.edit') || 'Edit' : t('games.createGameShort') || 'Új Játék'} 
          />
          <NavBtn 
            active={activeTab === 'groups'} 
            onClick={() => setActiveTab('groups')} 
            icon={<MessageSquare className="w-5 h-5" />} 
            label={t('nav.groups')} 
          />
          <NavBtn 
            active={activeTab === 'mygames'} 
            onClick={() => setActiveTab('mygames')} 
            icon={<Calendar className="w-5 h-5" />} 
            label={t('nav.myGames') || 'Saját meccsek'} 
          />
          <NavBtn 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
            icon={<UserIcon className="w-5 h-5" />} 
            label={t('nav.profile')} 
          />
        </div>
      </nav>

      {/* Overlays */}
      <AnimatePresence>
        {isChatOpen && selectedGame && (
          <ChatDrawer 
            game={selectedGame} 
            currentUser={currentUser}
            t={t}
            onClose={() => setIsChatOpen(false)}
            onSendMessage={(text) => handleSendMessage(selectedGame.id, text)}
            onApprove={(uid, apr) => handleApproveRequest(selectedGame.id, uid, apr)}
          />
        )}
        {isGroupChatOpen && selectedGroup && (
          <GroupChatDrawer 
            group={selectedGroup} 
            currentUser={currentUser!}
            t={t}
            onClose={() => setIsGroupChatOpen(false)}
            onSendMessage={(text) => handleSendGroupMessage(text)}
          />
        )}
        {isAttendanceOpen && selectedGame && (
          <AttendanceModal 
            game={selectedGame}
            players={players}
            t={t}
            onClose={() => setIsAttendanceOpen(false)}
            onConfirm={(recs) => handleConfirmAttendance(selectedGame.id, recs)}
          />
        )}
        {isNotificationsOpen && (
          <NotificationsDrawer 
            notifications={notifications}
            t={t}
            onFriendResponse={handleFriendResponse}
            onRead={(id) => {
              // Mark as read locally or call API
              setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
            }}
            onClose={() => setIsNotificationsOpen(false)}
          />
        )}
        {selectedGameDetail && (
          <GameDetailDrawer 
            game={selectedGameDetail}
            players={players}
            currentUser={currentUser!}
            t={t}
            onClose={() => setSelectedGameDetail(null)}
            onJoin={() => handleJoinGame(selectedGameDetail.id)}
            onOpenChat={() => {
              setSelectedGame(selectedGameDetail);
              setSelectedGameDetail(null);
              setIsChatOpen(true);
            }}
          />
        )}
        {selectedPlayer && (
          <ProfileDrawer 
            user={selectedPlayer} 
            currentUser={currentUser}
            games={games}
            groups={groups}
            onClose={() => setSelectedPlayer(null)}
            onFavorite={handleToggleFavorite}
            onSendFriendRequest={handleSendFriendRequest}
            onBlock={handleToggleBlock}
          />
        )}
        {isResultModalOpen && selectedGame && (
          <ResultModal 
            game={selectedGame}
            onSave={(res) => handleRecordResult(selectedGame.id, res)}
            onClose={() => setIsResultModalOpen(false)}
          />
        )}
        {isCreateGroupModalOpen && (
          <CreateGroupModal 
            currentUser={currentUser!}
            onClose={() => setIsCreateGroupModalOpen(false)}
            onSave={handleCreateGroup}
          />
        )}
        {isLevelTutorialOpen && (
          <LevelTutorial onClose={() => setIsLevelTutorialOpen(false)} t={t} />
        )}
      </AnimatePresence>

      {/* Bottom Nav (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-[#141414]/10 flex justify-around items-center px-4 py-3 md:hidden">
        <button 
          onClick={() => setActiveTab('games')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'games' ? 'text-[#141414]' : 'text-[#141414]/30'}`}
        >
          <TrendingUp className={`w-5 h-5 ${activeTab === 'games' ? 'text-[#141414]' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t('nav.games')}</span>
        </button>
        <button 
          onClick={() => setActiveTab('players')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'players' ? 'text-[#141414]' : 'text-[#141414]/30'}`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'players' ? 'text-[#141414]' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t('nav.players')}</span>
        </button>
        <button 
          onClick={() => {
            setGameToEdit(null);
            setActiveTab('create');
          }}
          className="flex flex-col items-center -mt-8"
        >
          <div className="w-12 h-12 bg-[#141414] rounded-[18px] flex items-center justify-center shadow-xl shadow-black/20 transform rotate-45 group active:scale-90 transition-all border border-[#E2FF3B]/20">
            <Plus className="w-6 h-6 text-[#E2FF3B] -rotate-45" />
          </div>
        </button>
        <button 
          onClick={() => setActiveTab('groups')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'groups' ? 'text-[#141414]' : 'text-[#141414]/30'}`}
        >
          <MessageSquare className={`w-5 h-5 ${activeTab === 'groups' ? 'text-[#141414]' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t('nav.groups')}</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-[#141414]' : 'text-[#141414]/30'}`}
        >
          <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'text-[#141414]' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">{t('nav.profile')}</span>
        </button>
      </nav>
    </div>
  );
}

const handleLeaveGame = async (gameId: string) => {
  // Logic to leave game (optional for this turn, can add if needed)
};

function GameCard({ 
  game, 
  onJoin, 
  isJoined, 
  requestStatus, 
  onOpenChat, 
  onEdit,
  isOwner,
  onLeave,
  onDelete,
  onRepeat,
  onConfirmAttendance,
  onRecordResult,
  onShowDetails,
  t
}: { 
  key?: string, 
  game: Game, 
  onJoin: () => Promise<void> | void, 
  isJoined: boolean,
  requestStatus?: 'pending' | 'accepted' | 'rejected',
  onOpenChat: () => void,
  onEdit?: () => void,
  isOwner: boolean,
  onLeave: () => void,
  onDelete?: () => void,
  onRepeat: () => void,
  onConfirmAttendance: () => void,
  onRecordResult: () => void,
  onShowDetails: () => void,
  t: (key: string) => string
}) {
  const date = new Date(game.datetime);
  const now = new Date();
  const isPast = date < now;
  const isLastMinute = !isPast && (date.getTime() - now.getTime()) / 3600000 <= 3;
  
  const slotsLeft = (game.requiredPlayers + 1) - game.joinedPlayers.length;
  const isFull = slotsLeft <= 0;

  return (
    <div 
      onClick={onShowDetails}
      className={`bg-white rounded-3xl p-5 border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer ${isPast ? 'opacity-70 grayscale-[0.5]' : 'border-[#141414]/5'}`}
    >
      {isOwner && !isPast && (
        <div className="absolute top-4 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="p-2 bg-white/80 backdrop-blur-md rounded-xl border border-[#141414]/5 shadow-sm hover:bg-[#E2FF3B] hover:border-[#141414]/10"
            title="Edit Game"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="p-2 bg-white/80 backdrop-blur-md rounded-xl border border-[#141414]/5 shadow-sm hover:bg-red-500 hover:text-white hover:border-red-600"
            title="Cancel Game"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {isLastMinute && !isFull && !isPast && (
        <div className="absolute top-0 left-0 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-br-xl z-20 animate-pulse">
          {t('notifications.lastMinute')} 🔥
        </div>
      )}
      {requestStatus === 'pending' && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-[#141414] text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl z-20">
          {t('common.requested')}
        </div>
      )}
      {isJoined && (
        <div className="absolute top-0 right-0 bg-[#E2FF3B] text-[#141414] text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl z-10">
          {t('common.joined')}
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-6 h-6 bg-[#141414]/5 rounded-full flex items-center justify-center overflow-hidden">
              {game.creator?.avatarUrl ? (
                <img src={game.creator.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 opacity-40" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight">{game.creator?.name || 'Player'}</span>
              {game.creator?.reliabilityStatus && (
                <span className="text-[10px] uppercase tracking-tighter font-black opacity-30">{t(`profile.reliabilityStatus.${game.creator.reliabilityStatus}`)}</span>
              )}
            </div>
          </div>
          <h3 className="font-bold text-lg leading-tight">{game.location}</h3>
          <div className="flex gap-2 flex-wrap pt-1">
            {game.recommendedLevel && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black uppercase">{t(`profile.levels.${game.recommendedLevel}`)} {t('groups.recommendedLevel')}</span>
            )}
            {game.gameType && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase ${game.gameType === 'Competitive' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {t(`games.gameTypes.${game.gameType}`)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-tighter opacity-40">{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
          <p className="text-lg font-black">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {game.note && (
        <p className="text-xs opacity-50 mb-4 line-clamp-2 italic">{game.note}</p>
      )}

      <div className="flex items-center justify-between mt-6">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {game.joinedPlayers.map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-[#141414] border-2 border-white flex items-center justify-center shadow-sm text-[10px] text-white">
                {i === 0 ? <TrendingUp className="w-3 h-3 text-[#E2FF3B]" /> : <UserIcon className="w-3 h-3" />}
              </div>
            ))}
            {Array.from({ length: Math.max(0, slotsLeft) }).map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-[#F5F5F0] border-2 border-white border-dashed flex items-center justify-center">
                <Plus className="w-3 h-3 opacity-20" />
              </div>
            ))}
          </div>
          {(isJoined || isOwner) && (
            <button 
              onClick={onOpenChat}
              className="w-10 h-10 rounded-full bg-[#141414]/5 flex items-center justify-center hover:bg-[#141414]/10 transition-colors relative"
            >
              <MessageSquare className="w-5 h-5" />
              {(game.chat && game.chat.length > 0) && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
              )}
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          {isPast ? (
            <>
              {isOwner && !game.attendanceConfirmed && (
                <button 
                  onClick={onConfirmAttendance}
                  className="px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-orange-500 text-white hover:scale-105 active:scale-95 transition-all"
                >
                  {t('common.verify')}
                </button>
              )}
              {isOwner && game.attendanceConfirmed && !game.isCompleted && (
                 <button 
                  onClick={onRecordResult}
                  className="px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-500 text-white hover:scale-105 active:scale-95 transition-all"
                >
                  {t('common.score')}
                </button>
              )}
              <button 
                onClick={onRepeat}
                className="px-6 py-3 rounded-2xl text-sm font-bold bg-[#141414] text-[#E2FF3B] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t('common.repeat')}
              </button>
            </>
          ) : (
            <button 
              disabled={isFull || isJoined || requestStatus === 'pending'}
              onClick={onJoin}
              className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
                isJoined || requestStatus === 'accepted'
                  ? 'bg-[#141414] text-[#E2FF3B]' 
                  : requestStatus === 'pending'
                    ? 'bg-yellow-100 text-yellow-700 cursor-default'
                    : isFull 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-[#E2FF3B] text-[#141414] hover:scale-105 active:scale-95 shadow-lg shadow-[#E2FF3B]/20'
              }`}
            >
              {isJoined ? t('common.joined') : requestStatus === 'pending' ? t('common.requested') : isFull ? t('common.full') : t('common.joinMatch')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({ 
  game, 
  players, 
  onClose, 
  onConfirm,
  t
}: { 
  game: Game, 
  players: User[], 
  onClose: () => void, 
  onConfirm: (records: Record<string, "appeared" | "missed">) => void,
  t: (key: string) => string
}) {
  const [records, setRecords] = useState<Record<string, "appeared" | "missed">>(
    game.joinedPlayers.reduce((acc, uid) => ({ ...acc, [uid]: "appeared" }), {})
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[40px] w-full max-w-sm p-8 space-y-6 shadow-2xl"
      >
        <div className="text-center space-y-2">
          <ShieldCheck className="w-12 h-12 text-orange-500 mx-auto" />
          <h2 className="text-2xl font-black uppercase tracking-tight">{t('games.attendanceTitle')}</h2>
          <p className="text-xs opacity-50 uppercase font-black tracking-widest">{t('games.attendanceSub')}</p>
        </div>

        <div className="space-y-3">
          {game.joinedPlayers.map(uid => {
            const player = players.find(p => p.id === uid);
            return (
              <div key={uid} className="flex items-center justify-between p-3 bg-[#141414]/5 rounded-2xl">
                <span className="text-sm font-bold">{player?.name || 'Player'}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setRecords({ ...records, [uid]: "missed" })}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${records[uid] === 'missed' ? 'bg-red-500 text-white' : 'bg-white text-red-500 opacity-40'}`}
                  >
                    {t('games.missed')}
                  </button>
                  <button 
                    onClick={() => setRecords({ ...records, [uid]: "appeared" })}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${records[uid] === 'appeared' ? 'bg-green-500 text-white' : 'bg-white text-green-500 opacity-40'}`}
                  >
                    {t('games.appeared')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-sm font-bold uppercase tracking-widest opacity-40"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(records)}
            className="flex-1 py-4 bg-[#141414] text-[#E2FF3B] rounded-2xl text-sm font-black uppercase tracking-widest"
          >
            Confirm
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PlayerCard({ 
  player, 
  isFavorite, 
  onToggleFavorite,
  onOpenProfile
}: { 
  key?: string,
  player: User, 
  isFavorite?: boolean, 
  onToggleFavorite: () => void,
  onOpenProfile: (p: User) => void
}) {
  const { t } = useI18n('hu');
  const isOnline = player.lastActive && (new Date(player.lastActive) > new Date(Date.now() - 3600000));

  return (
    <div 
      onClick={() => onOpenProfile(player)}
      className="bg-white rounded-3xl p-4 flex items-center gap-4 border border-[#141414]/5 shadow-sm hover:border-[#E2FF3B] hover:shadow-md transition-all group relative cursor-pointer"
    >
      <div className="w-14 h-14 bg-[#141414] text-[#E2FF3B] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden relative">
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="w-6 h-6" />
        )}
        {isOnline && (
          <div className="absolute bottom-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#141414]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold truncate">{player.name}</h3>
          {(player.lfgStatus && player.lfgStatus !== LFGStatus.None) && (
             <span className="text-[8px] sm:text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase whitespace-nowrap">
               LFG: {t(`profile.lfg.${player.lfgStatus}`)}
             </span>
          )}
        </div>
        <div className="flex gap-2 items-center mt-1">
          <span className="text-[10px] font-black uppercase tracking-widest bg-[#141414]/5 px-2 py-0.5 rounded italic">{t(`profile.levels.${player.skillLevel}`)}</span>
          <span className="text-[10px] opacity-40 flex items-center gap-0.5 truncate max-w-[100px]"><MapPin className="w-2 h-2 shrink-0" /> {player.location.city}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={`p-3 rounded-2xl transition-colors ${isFavorite ? 'text-red-500 bg-red-50' : 'bg-[#141414]/5 text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
        <button className="p-3 rounded-2xl bg-[#141414]/5 hover:bg-[#E2FF3B] transition-colors group/btn">
          <ChevronRight className="w-5 h-5 opacity-40 group-hover/btn:opacity-100" />
        </button>
      </div>
    </div>
  );
}

function CreateGameForm({ 
  creatorId, 
  groups,
  allUsers,
  onSuccess,
  t,
  lang,
  onShowTutorial,
  gameToEdit
}: { 
  creatorId: string, 
  groups: Group[],
  allUsers: User[],
  onSuccess: () => void,
  t: (key: string) => string,
  lang: string,
  onShowTutorial?: () => void,
  gameToEdit?: Game | null
}) {
  const [formData, setFormData] = useState({
    location: '',
    datetime: '',
    requiredPlayers: '3',
    recommendedLevel: SkillLevel.Silver,
    gameType: GameType.Friendly,
    note: '',
    recurrence: 'none',
    groupId: '',
    visibility: 'public' as 'public' | 'group-only' | 'invite-only',
    invitedUserIds: [] as string[]
  });

  const [inviteSearch, setInviteSearch] = useState('');

  useEffect(() => {
    if (gameToEdit) {
      setFormData({
        location: gameToEdit.location,
        datetime: gameToEdit.datetime.split(':').slice(0, 2).join(':'), // Format for datetime-local input
        requiredPlayers: String(gameToEdit.requiredPlayers),
        recommendedLevel: gameToEdit.recommendedLevel || SkillLevel.Silver,
        gameType: gameToEdit.gameType || GameType.Friendly,
        note: gameToEdit.note || '',
        recurrence: gameToEdit.isRecurring ? 'weekly' : 'none',
        groupId: gameToEdit.groupId || '',
        visibility: gameToEdit.visibility || 'public',
        invitedUserIds: gameToEdit.invitedUserIds || []
      });
    } else {
      const repeatData = localStorage.getItem('padel_repeat_game');
      if (repeatData) {
        const g = JSON.parse(repeatData) as Game;
        setFormData({
          location: g.location,
          datetime: '', // Keep time empty to force new time selection
          requiredPlayers: String(g.requiredPlayers),
          recommendedLevel: g.recommendedLevel || SkillLevel.Silver,
          gameType: g.gameType || GameType.Friendly,
          note: g.note || '',
          recurrence: 'none',
          groupId: '',
          visibility: 'public',
          invitedUserIds: []
        });
        localStorage.removeItem('padel_repeat_game');
      }
    }
  }, [gameToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = gameToEdit ? `/api/games/${gameToEdit.id}` : '/api/games';
      const method = gameToEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, creator_id: creatorId })
      });
      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleInvite = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      invitedUserIds: prev.invitedUserIds.includes(userId)
        ? prev.invitedUserIds.filter(id => id !== userId)
        : [...prev.invitedUserIds, userId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-3xl border border-[#141414]/5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.location')}</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input 
              type="text" 
              required
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Club Padel World"
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('notifications.reminders')}</label>
          <div className="relative">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <select 
              value={formData.recurrence}
              onChange={e => setFormData({ ...formData, recurrence: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none appearance-none"
            >
              <option value="none">{lang === 'hu' ? 'Egyszeri alkalom' : 'One-time game'}</option>
              <option value="weekly">{lang === 'hu' ? 'Minden héten' : 'Every Week'}</option>
              <option value="biweekly">{lang === 'hu' ? '2 hetente' : 'Every 2 Weeks'}</option>
              <option value="monthly">{lang === 'hu' ? 'Havonta' : 'Every Month'}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('common.datetime')}</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="datetime-local" 
                  required
                  value={formData.datetime}
                  onChange={e => setFormData({ ...formData, datetime: e.target.value })}
                  className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.type')}</label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <select 
                  value={formData.gameType}
                  onChange={e => setFormData({ ...formData, gameType: e.target.value as GameType })}
                  className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none appearance-none"
                >
                  <option value={GameType.Friendly}>{t('games.gameTypes.Friendly')}</option>
                  <option value={GameType.Competitive}>{t('games.gameTypes.Competitive')}</option>
                  <option value={GameType.Training}>{t('games.gameTypes.Training')}</option>
                </select>
              </div>
            </div>
          </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40">{t('games.level')}</label>
            <button 
              type="button" 
              onClick={onShowTutorial}
              className="p-1 hover:bg-[#141414]/5 rounded-lg transition-colors"
            >
              <Award className="w-3.5 h-3.5 opacity-40" />
            </button>
          </div>
          <div className="relative">
            <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <select 
              value={formData.recommendedLevel}
              onChange={e => setFormData({ ...formData, recommendedLevel: e.target.value as SkillLevel })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none appearance-none"
            >
              {Object.values(SkillLevel).map(lvl => <option key={lvl} value={lvl}>{t(`profile.levels.${lvl}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.required')}</label>
          <div className="relative">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <select 
              value={formData.requiredPlayers}
              onChange={e => setFormData({ ...formData, requiredPlayers: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none appearance-none"
            >
              <option value="1">1 {t('players.members') || 'Player'}</option>
              <option value="2">2 {t('players.members') || 'Players'}</option>
              <option value="3">3 {t('players.members') || 'Players'}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.note')}</label>
        <textarea 
          value={formData.note}
          onChange={e => setFormData({ ...formData, note: e.target.value })}
          placeholder={lang === 'hu' ? 'Pl. Balos játékos kerestetik, meccs után kávézunk!' : 'e.g. Left player needed, coffee after match!'}
          className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none min-h-[100px]"
        />
      </div>

      <div className="pt-4 border-t border-[#141414]/5 space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.visibility')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['public', 'group-only', 'invite-only'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFormData({ ...formData, visibility: v })}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.visibility === v ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/40'
                  }`}
                >
                  {v === 'public' ? t('games.public') : v === 'group-only' ? t('games.groupOnly') : t('games.inviteOnly')}
                </button>
              ))}
            </div>
          </div>

        {formData.visibility === 'group-only' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40 px-1">{t('games.selectGroup')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {groups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, groupId: g.id })}
                  className={`p-4 rounded-2xl text-left border transition-all ${
                    formData.groupId === g.id 
                    ? 'border-[#E2FF3B] bg-[#E2FF3B]/5 ring-1 ring-[#E2FF3B]' 
                    : 'border-[#141414]/5 bg-[#141414]/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#141414] flex items-center justify-center text-[#E2FF3B] font-black italic">
                      {g.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{g.name}</p>
                      <p className="text-[10px] opacity-40 uppercase font-black">{g.memberIds.length} {t('groups.members')}</p>
                    </div>
                  </div>
                </button>
              ))}
              {groups.length === 0 && <p className="text-xs opacity-40 italic">{t('games.noGroups')}</p>}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold uppercase tracking-widest opacity-40">{t('games.inviteFriends') || 'Invite People'}</label>
            <div className="relative w-32 sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30" />
              <input 
                type="text"
                value={inviteSearch}
                onChange={e => setInviteSearch(e.target.value)}
                placeholder={t('common.search')}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-2 pl-8 pr-3 text-[10px] focus:ring-1 focus:ring-[#E2FF3B] outline-none"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-none">
            {(() => {
              const currentUser = allUsers.find(u => u.id === creatorId);
              const friendIds = currentUser?.friendIds || [];
              const groupMemberIds = formData.groupId ? (groups.find(g => g.id === formData.groupId)?.memberIds || []) : [];
              
              const potentialInvitees = allUsers.filter(u => 
                u.id !== creatorId && 
                (
                  friendIds.includes(u.id) || 
                  groupMemberIds.includes(u.id) ||
                  formData.invitedUserIds.includes(u.id)
                )
              );

              const filteredInvitees = potentialInvitees.filter(u => 
                u.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
                u.username.toLowerCase().includes(inviteSearch.toLowerCase())
              );

              if (filteredInvitees.length === 0) {
                return <p className="text-xs opacity-40 italic text-center py-4">{t('common.noData')}</p>;
              }

              return filteredInvitees.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    const ids = formData.invitedUserIds.includes(f.id)
                      ? formData.invitedUserIds.filter(id => id !== f.id)
                      : [...formData.invitedUserIds, f.id];
                    setFormData({ ...formData, invitedUserIds: ids });
                  }}
                  className={`w-full p-3 rounded-2xl text-left flex items-center justify-between border transition-all ${
                    formData.invitedUserIds.includes(f.id)
                    ? 'border-[#E2FF3B] bg-[#E2FF3B]/5 ring-1 ring-[#E2FF3B]' 
                    : 'border-[#141414]/5 bg-[#141414]/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#141414] overflow-hidden flex items-center justify-center border-2 border-white shadow-sm">
                      {f.avatarUrl ? <img src={f.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-[#E2FF3B]" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{f.name}</p>
                      <div className="flex gap-1">
                        {friendIds.includes(f.id) && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-md">Friend</span>}
                        {groupMemberIds.includes(f.id) && <span className="text-[8px] uppercase font-black px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-md">Group</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${formData.invitedUserIds.includes(f.id) ? 'bg-green-500 text-white' : 'bg-white/50 text-white/0'}`}>
                    <Check className="w-4 h-4" />
                  </div>
                </button>
              ));
            })()}
          </div>
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-[#141414] text-[#E2FF3B] py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all shadow-xl shadow-black/10"
      >
        {t('games.createGame')}
      </button>
    </form>
  );
}

function AuthScreen({ onSelectMode, t }: { onSelectMode: (mode: 'login' | 'register') => void, t: any }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col p-6 overflow-hidden relative">
      <div className="absolute top-[10%] right-[-10%] w-[80%] h-[50%] bg-[#E2FF3B]/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[20%] left-[-5%] w-[60%] h-[40%] bg-[#E2FF3B]/5 blur-[100px] rounded-full" />
      
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full relative z-10 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-[#E2FF3B] rounded-[24px] flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(226,255,59,0.2)]">
            <Target className="w-8 h-8 text-[#141414]" />
          </div>
          <h1 className="text-5xl sm:text-7xl font-black uppercase italic leading-[0.8] tracking-tighter mb-4 text-white">
            Padel<br />Buddy
          </h1>
          <p className="text-sm font-bold opacity-60 uppercase tracking-widest text-[#E2FF3B]">
            {t('auth.subTitle')}
          </p>
        </motion.div>
        
        <div className="w-full space-y-4">
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => onSelectMode('register')}
            className="w-full bg-[#E2FF3B] text-[#141414] py-5 rounded-2xl font-black uppercase tracking-tighter text-sm shadow-[0_10px_30px_rgba(226,255,59,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {t('auth.register')}
          </motion.button>
          
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => onSelectMode('login')}
            className="w-full bg-white/5 text-white py-5 rounded-2xl font-black uppercase tracking-tighter text-sm hover:bg-white/10 transition-all border border-white/10"
          >
            {t('auth.login')}
          </motion.button>
        </div>
        
        <div className="mt-16 flex items-center gap-2 opacity-30">
          <ShieldCheck className="w-4 h-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">{t('auth.secure')}</p>
        </div>
      </div>
    </div>
  );
}

function RegistrationForm({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel,
  error,
  t 
}: { 
  formData: any,
  setFormData: (data: any) => void,
  onSubmit: (e: React.FormEvent) => void,
  onCancel: () => void,
  error: string | null,
  t: any
}) {
  return (
    <div className="min-h-screen bg-[#F8F8F5] flex flex-col p-6 font-sans overflow-y-auto">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col py-8">
        <motion.button 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onCancel} 
          className="self-start mb-12 p-3 bg-white rounded-2xl shadow-sm border border-black/5 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#141414]" />
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none mb-4 text-[#141414]">{t('auth.register')}</h2>
          <p className="text-sm opacity-50 font-bold text-[#141414]">{t('auth.subTitle')}</p>
        </motion.div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={onSubmit} 
          className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] space-y-6"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.usernameLabel')}</label>
            <input 
              required
              type="text" 
              placeholder={t('auth.usernamePlaceholder')}
              value={formData.username}
              onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.nameLabel')}</label>
            <input 
              required
              type="text" 
              placeholder={t('auth.namePlaceholder')}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.emailLabel')}</label>
            <input 
              required
              type="email" 
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.phoneLabel')}</label>
            <input 
              required
              type="tel" 
              placeholder={t('auth.phonePlaceholder')}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.passwordLabel')}</label>
            <input 
              required
              minLength={6}
              type="password" 
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#141414] text-[#E2FF3B] py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 mt-4"
          >
            {t('auth.register')}
          </button>
        </motion.form>
      </div>
    </div>
  );
}

function LoginForm({ 
  formData, 
  setFormData, 
  onSubmit, 
  onCancel,
  error,
  t 
}: { 
  formData: any,
  setFormData: (data: any) => void,
  onSubmit: (e: React.FormEvent) => void,
  onCancel: () => void,
  error: string | null,
  t: any
}) {
  return (
    <div className="min-h-screen bg-[#F8F8F5] flex flex-col p-6 font-sans overflow-y-auto">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col py-8 justify-center">
        <motion.button 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={onCancel} 
          className="self-start mb-12 p-3 bg-white rounded-2xl shadow-sm border border-black/5 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#141414]" />
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <h2 className="text-4xl sm:text-5xl font-black uppercase italic tracking-tighter leading-none mb-4 text-[#141414]">{t('auth.login')}</h2>
          <p className="text-sm opacity-50 font-bold text-[#141414]">{t('auth.subTitle')}</p>
        </motion.div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-3"
          >
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
            {error}
          </motion.div>
        )}

        <motion.form 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={onSubmit} 
          className="bg-white p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] space-y-6"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.emailLabel')}</label>
            <input 
              required
              type="email" 
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest px-1 opacity-40 text-[#141414]">{t('auth.passwordLabel')}</label>
            <input 
              required
              type="password" 
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-[#E2FF3B] outline-none font-bold text-[#141414]"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-[#141414] text-[#E2FF3B] py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 mt-4"
          >
            {t('auth.login')}
          </button>
        </motion.form>
      </div>
    </div>
  );
}

function ProfileEdit({ user, onSave, onCancel, onShowTutorial }: { user: User, onSave: (data: Partial<User>) => void, onCancel: () => void, onShowTutorial?: () => void }) {
  const { t } = useI18n(user.languagePreference || 'hu');
  const [formData, setFormData] = useState({
    name: user.name,
    skillLevel: user.skillLevel,
    city: user.location.city,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || '',
    interests: [...(user.interests || [])],
    favoriteClubs: [...(user.favoriteClubs || [])],
    lfgStatus: user.lfgStatus || LFGStatus.None,
    playStyle: user.playStyle || 'Casual',
    playTime: [...(user.playTime || [])],
    experience: user.experience || PadelExperience.Less6Months,
    languages: [...(user.languages || [])],
    languagePreference: user.languagePreference || 'hu',
    socialLinks: { ...(user.socialLinks || {}) },
    privacySettings: user.privacySettings || { publicProfile: true, showMatchHistory: true, showSocialLinks: true },
    notifications: user.notificationSettings || {
      nearGames: true,
      reminders: true,
      groups: true,
      lastMinute: true
    }
  });

  const [newClub, setNewClub] = useState('');
  const [customInterest, setCustomInterest] = useState('');

  const PREDEFINED_INTERESTS = ['Competitive', 'Social Padel', 'Morning Matches', 'Evening Matches', 'Mixed Matches', 'Tournaments', 'Coaching'];

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'image/*': [] },
    multiple: false 
  } as any);

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest) 
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const togglePlayTime = (time: PlayTime) => {
    setFormData(prev => ({
      ...prev,
      playTime: prev.playTime.includes(time)
        ? prev.playTime.filter(t => t !== time)
        : [...prev.playTime, time]
    }));
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !formData.interests.includes(customInterest.trim())) {
      setFormData(prev => ({
        ...prev,
        interests: [...prev.interests, customInterest.trim()]
      }));
      setCustomInterest('');
    }
  };

  const addClub = () => {
    if (newClub.trim() && !formData.favoriteClubs.includes(newClub.trim())) {
      setFormData(prev => ({
        ...prev,
        favoriteClubs: [...prev.favoriteClubs, newClub.trim()]
      }));
      setNewClub('');
    }
  };

  const removeClub = (club: string) => {
    setFormData(prev => ({
      ...prev,
      favoriteClubs: prev.favoriteClubs.filter(c => c !== club)
    }));
  };

  const handleSave = () => {
    onSave({
      name: formData.name,
      skillLevel: formData.skillLevel,
      location: { ...user.location, city: formData.city },
      bio: formData.bio,
      avatarUrl: formData.avatarUrl,
      interests: formData.interests,
      favoriteClubs: formData.favoriteClubs,
      lfgStatus: formData.lfgStatus,
      playStyle: formData.playStyle,
      playTime: formData.playTime,
      notificationSettings: formData.notifications,
      experience: formData.experience,
      languagePreference: formData.languagePreference,
      languages: formData.languages,
      socialLinks: formData.socialLinks,
      privacySettings: formData.privacySettings
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter">{t('profile.editTitle')}</h2>
        <button onClick={onCancel} className="p-2 hover:bg-[#141414]/5 rounded-xl transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#141414]/5 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">@{t('auth.usernameLabel')}</label>
              <input 
                type="text" 
                disabled
                value={user.username || ''}
                className="w-full bg-[#141414]/5 border-none rounded-2xl py-4 px-6 text-sm outline-none font-bold text-[#141414]/30"
              />
            </div>
            <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Avatar</label>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-[#141414] rounded-2xl flex items-center justify-center shrink-0 overflow-hidden border-2 border-white shadow-md">
                 {formData.avatarUrl ? (
                   <img src={formData.avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                 ) : (
                  <ImageIcon className="w-8 h-8 text-[#E2FF3B]/40" />
                 )}
              </div>
              
              <div {...getRootProps()} className={`flex-1 border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-[#E2FF3B] bg-[#E2FF3B]/5' : 'border-[#141414]/10 hover:border-[#141414]/20'}`}>
                <input {...getInputProps()} />
                <Upload className="w-4 h-4 mb-2 opacity-40" />
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 text-center">
                  {isDragActive ? 'Engedd el!' : 'Kattints vagy húzd ide a képet'}
                </p>
              </div>
            </div>
            {formData.avatarUrl && (
              <button 
                onClick={() => setFormData({ ...formData, avatarUrl: '' })}
                className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
              >
                {t('common.delete')} kép
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.name')}</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.location')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-30" />
                <input 
                  type="text" 
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-[#141414]/5 border-none rounded-xl py-3 pl-8 pr-4 text-sm font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.skillLevel')}</label>
              <button 
                type="button" 
                onClick={onShowTutorial}
                className="p-1 hover:bg-[#141414]/5 rounded-lg transition-colors"
                title="Level Info"
              >
                <Award className="w-3.5 h-3.5 opacity-40" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(SkillLevel).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setFormData({ ...formData, skillLevel: lvl })}
                  className={`py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                    formData.skillLevel === lvl 
                    ? 'bg-[#141414] text-[#E2FF3B]' 
                    : 'bg-[#141414]/5 text-[#141414]/30'
                  }`}
                >
                  {t(`profile.levels.${lvl}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.bio')}</label>
            <textarea 
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-[#E2FF3B] outline-none min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.status')}</label>
              <select 
                value={formData.lfgStatus}
                onChange={e => setFormData({ ...formData, lfgStatus: e.target.value as LFGStatus })}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none appearance-none"
              >
                {Object.values(LFGStatus).map(s => <option key={s} value={s}>{t(`profile.lfg.${s}`)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.playStyle')}</label>
              <div className="flex gap-1">
                {(['Casual', 'Competitive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFormData({ ...formData, playStyle: s })}
                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      formData.playStyle === s ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/40'
                    }`}
                  >
                    {t(`profile.playStyles.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.appLanguage')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: 'hu', label: 'Magyar' },
                { code: 'en', label: 'English' },
                { code: 'de', label: 'Deutsch' },
                { code: 'es', label: 'Español' },
                { code: 'fr', label: 'Français' },
                { code: 'uk', label: 'Українська' },
                { code: 'ru', label: 'Русский' }
              ].map(langOption => (
                <button
                  key={langOption.code}
                  onClick={() => setFormData({ ...formData, languagePreference: langOption.code as Language })}
                  className={`py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                    formData.languagePreference === langOption.code 
                    ? 'bg-[#141414] text-[#E2FF3B]' 
                    : 'bg-[#141414]/5 text-[#141414]/30'
                  }`}
                >
                  {langOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.padelExperience')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(PadelExperience).map(exp => (
                <button
                  key={exp}
                  onClick={() => setFormData({ ...formData, experience: exp })}
                  className={`py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                    formData.experience === exp 
                    ? 'bg-[#141414] text-[#E2FF3B]' 
                    : 'bg-[#141414]/5 text-[#141414]/30'
                  }`}
                >
                  {t(`profile.experienceLevels.${exp}`) || exp}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.languages')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {['Hungarian', 'English', 'Spanish', 'German', 'French', 'Italian'].map(lang_val => (
                <button
                  key={lang_val}
                  onClick={() => {
                    const next = formData.languages.includes(lang_val)
                      ? formData.languages.filter(l => l !== lang_val)
                      : [...formData.languages, lang_val];
                    setFormData({ ...formData, languages: next });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    formData.languages.includes(lang_val)
                      ? 'bg-white border-[#141414] text-[#141414]'
                      : 'bg-transparent border-[#141414]/10 text-[#141414]/40'
                  }`}
                >
                  {t(`profile.languageList.${lang_val}`) || lang_val}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#141414]/5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 opacity-40" />
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{t('profile.socialLinks')}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-[#141414]/5 rounded-xl px-3 group focus-within:ring-1 focus-within:ring-[#E2FF3B]">
                <Instagram className="w-4 h-4 opacity-30" />
                <input 
                  type="text" 
                  placeholder={t('profile.instagramPlaceholder') || 'Instagram felhasználónév'}
                  value={formData.socialLinks.instagram || ''}
                  onChange={e => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, instagram: e.target.value } })}
                  className="flex-1 bg-transparent border-none py-3 text-xs font-bold outline-none"
                />
              </div>
              <div className="flex items-center gap-3 bg-[#141414]/5 rounded-xl px-3 group focus-within:ring-1 focus-within:ring-[#E2FF3B]">
                <Facebook className="w-4 h-4 opacity-30" />
                <input 
                  type="text" 
                  placeholder={t('profile.facebookPlaceholder') || 'Facebook profil vagy név'}
                  value={formData.socialLinks.facebook || ''}
                  onChange={e => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, facebook: e.target.value } })}
                  className="flex-1 bg-transparent border-none py-3 text-xs font-bold outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#141414]/5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 opacity-40" />
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{t('profile.privacy')}</h3>
            </div>
            <div className="space-y-3">
              {[
                { id: 'publicProfile', label: t('profile.publicProfile') },
                { id: 'showMatchHistory', label: t('profile.showMatchHistory') },
                { id: 'showSocialLinks', label: t('profile.showSocialLinks') }
              ].map(item => (
                <label key={item.id} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity">{item.label}</span>
                  <input 
                    type="checkbox" 
                    checked={formData.privacySettings[item.id as keyof typeof formData.privacySettings]}
                    onChange={e => setFormData({
                      ...formData,
                      privacySettings: { ...formData.privacySettings, [item.id]: e.target.checked }
                    })}
                    className="w-5 h-5 accent-[#E2FF3B] rounded-lg"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('profile.playTimes')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(PlayTime).map(t_val => (
                <button
                  key={t_val}
                  onClick={() => togglePlayTime(t_val)}
                  className={`py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.playTime.includes(t_val) ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/30'
                  }`}
                >
                  {t(`profile.playTimesList.${t_val}`) || t_val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-4 pt-4 border-t border-[#141414]/5">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 opacity-40" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{t('profile.interests')}</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_INTERESTS.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                  formData.interests.includes(interest)
                  ? 'bg-[#E2FF3B] text-[#141414]'
                  : 'bg-[#141414]/5 text-[#141414]/50 hover:bg-[#141414]/10'
                }`}
              >
                {t(`profile.interestsList.${interest}`) || interest}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t('profile.addInterest')}
              value={customInterest}
              onChange={e => setCustomInterest(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addCustomInterest()}
              className="flex-1 bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-xs focus:ring-1 focus:ring-[#E2FF3B] outline-none"
            />
            <button 
              onClick={addCustomInterest}
              className="p-3 bg-[#141414] text-[#E2FF3B] rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {formData.interests.filter(i => !PREDEFINED_INTERESTS.includes(i)).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
               {formData.interests.filter(i => !PREDEFINED_INTERESTS.includes(i)).map(interest => (
                <span key={interest} className="flex items-center gap-1 px-3 py-1.5 bg-[#141414] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider">
                  {interest}
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-[#E2FF3B]" 
                    onClick={() => toggleInterest(interest)}
                  />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clubs */}
        <div className="space-y-4 pt-4 border-t border-[#141414]/5">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 opacity-40" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{t('profile.favoriteClubs')}</h3>
          </div>

          <div className="space-y-3">
            {formData.favoriteClubs.map(club => (
              <div key={club} className="flex items-center justify-between bg-[#141414]/5 rounded-xl py-3 px-4">
                <span className="text-sm font-medium">{club}</span>
                <X className="w-4 h-4 opacity-30 cursor-pointer hover:text-red-500" onClick={() => removeClub(club)} />
              </div>
            ))}
            
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder={t('profile.addClub')}
                value={newClub}
                onChange={e => setNewClub(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && addClub()}
                className="flex-1 bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-xs focus:ring-1 focus:ring-[#E2FF3B] outline-none"
              />
              <button 
                onClick={addClub}
                className="p-3 bg-[#141414] text-[#E2FF3B] rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 pt-4 border-t border-[#141414]/5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 opacity-40" />
            <h3 className="text-xs font-bold uppercase tracking-widest opacity-40">{t('profile.notifications')}</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { id: 'nearGames', label: t('notifications.nearbyGames') },
              { id: 'reminders', label: t('notifications.reminders') },
              { id: 'groups', label: t('notifications.groupUpdates') },
              { id: 'lastMinute', label: t('notifications.lastMinute') }
            ].map(pref => (
              <label key={pref.id} className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-medium opacity-60 group-hover:opacity-100 transition-opacity">{pref.label}</span>
                <input 
                  type="checkbox" 
                  checked={formData.notifications[pref.id as keyof typeof formData.notifications]}
                  onChange={e => setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, [pref.id]: e.target.checked }
                  })}
                  className="w-5 h-5 accent-[#E2FF3B] rounded-lg cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-[#141414]/5 flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 bg-[#141414]/5 text-[#141414] rounded-2xl font-bold text-sm hover:bg-[#141414]/10 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button 
            onClick={handleSave}
            className="flex-2 py-4 bg-[#141414] text-[#E2FF3B] rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-xl transition-all"
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatDrawer({ 
  game, 
  currentUser, 
  onClose, 
  onSendMessage,
  onApprove,
  t
}: { 
  game: Game, 
  currentUser: User, 
  onClose: () => void, 
  onSendMessage: (text: string) => void,
  onApprove: (uid: string, apr: boolean) => void,
  t: (key: string) => string
}) {
  const [msg, setMsg] = useState('');
  const isOwner = game.creatorId === currentUser.id;
  const pendingRequests = game.requests?.filter(r => r.status === 'pending') || [];

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#F5F5F0] z-[60] shadow-2xl border-l border-[#141414]/10 flex flex-col"
    >
      <div className="p-4 bg-white border-b border-[#141414]/10 flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-black uppercase tracking-tight leading-none">{game.location}</h3>
          <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest mt-1">{t('games.chat')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isOwner && pendingRequests.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Join Requests</h4>
            {pendingRequests.map(req => (
              <div key={req.userId} className="bg-white p-3 rounded-2xl border border-[#141414]/5 flex items-center justify-between shadow-sm">
                <span className="text-sm font-bold">{req.userName}</span>
                <div className="flex gap-1">
                  <button 
                    onClick={() => onApprove(req.userId, false)}
                    className="p-2 bg-red-50 text-red-500 rounded-xl"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onApprove(req.userId, true)}
                    className="p-2 bg-green-50 text-green-500 rounded-xl"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {game.chat?.length === 0 && (
             <div className="py-10 text-center opacity-30">
               <MessageSquare className="w-8 h-8 mx-auto mb-2" />
               <p className="text-xs font-bold uppercase tracking-widest">No messages yet</p>
             </div>
          )}
          {game.chat?.map(c => (
            <div key={c.id} className={`flex flex-col ${c.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline gap-2 mb-1 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{c.userName}</span>
                <span className="text-[8px] opacity-20">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                c.userId === currentUser.id 
                  ? 'bg-[#141414] text-white rounded-tr-none' 
                  : 'bg-white rounded-tl-none border border-[#141414]/5'
              }`}>
                {c.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-[#141414]/10">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder={t('common.typeMessage')}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && (onSendMessage(msg), setMsg(''))}
            className="flex-1 bg-[#141414]/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-[#E2FF3B] outline-none"
          />
          <button 
            disabled={!msg.trim()}
            onClick={() => {
              onSendMessage(msg);
              setMsg('');
            }}
            className="w-12 h-12 bg-[#141414] text-[#E2FF3B] rounded-2xl flex items-center justify-center disabled:opacity-30"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {['Ott vagyok!', 'Kések 10 percet', 'Még aktuális?'].map(txt => (
            <button 
              key={txt}
              onClick={() => onSendMessage(txt)}
              className="shrink-0 px-3 py-1.5 bg-[#141414]/5 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E2FF3B] transition-colors"
            >
              {txt}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function NotificationsDrawer({ 
  notifications, 
  onClose, 
  onRead,
  onFriendResponse,
  t
}: { 
  notifications: PadelNotification[], 
  onClose: () => void,
  onRead: (id: string) => void,
  onFriendResponse?: (requestId: string, status: 'accepted' | 'rejected') => void,
  t: (key: string) => string
}) {
  return (
    <div className="fixed inset-0 z-[130] flex justify-end">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col p-6"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tight">{t('notifications.title')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12 opacity-30">
              <AlertCircle className="w-12 h-12 mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">{t('notifications.allCaughtUp')}</p>
            </div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => onRead(n.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${n.read ? 'bg-white border-[#141414]/5' : 'bg-[#E2FF3B]/5 border-[#E2FF3B]/30 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                    {new Date(n.timestamp).toLocaleDateString()}
                  </p>
                  {n.type === 'new_request' && !n.read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                </div>
                <h4 className="font-bold text-sm mb-1">{n.title}</h4>
                <p className="text-xs opacity-60 leading-relaxed mb-3">{n.message}</p>
                
                {n.type === 'new_request' && n.friendRequestId && !n.read && (
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFriendResponse?.(n.friendRequestId!, 'accepted');
                      }}
                      className="flex-1 py-2 bg-[#141414] text-[#E2FF3B] rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      {t('common.accept')}
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onFriendResponse?.(n.friendRequestId!, 'rejected');
                      }}
                      className="flex-1 py-2 bg-[#141414]/5 text-[#141414]/40 rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      {t('common.decline')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

function GroupChatDrawer({ 
  group, 
  currentUser, 
  onClose, 
  onSendMessage,
  t
}: { 
  group: Group, 
  currentUser: User, 
  onClose: () => void, 
  onSendMessage: (text: string) => void,
  t: (key: string) => string
}) {
  const [msg, setMsg] = useState('');

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-y-0 right-0 w-full max-w-sm bg-[#F5F5F0] z-[110] shadow-2xl border-l border-[#141414]/10 flex flex-col"
    >
      <div className="p-4 bg-white border-b border-[#141414]/10 flex items-center gap-4">
        <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-xl">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="font-black uppercase tracking-tight leading-none">{group.name}</h3>
          <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest mt-1">{t('games.groupChat')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          {group.chat?.length === 0 && (
             <div className="py-10 text-center opacity-30">
               <MessageSquare className="w-8 h-8 mx-auto mb-2" />
               <p className="text-xs font-bold uppercase tracking-widest">{t('common.noMessages')}</p>
             </div>
          )}
          {group.chat?.map(c => (
            <div key={c.id} className={`flex flex-col ${c.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline gap-2 mb-1 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-30">{c.userName}</span>
                <span className="text-[8px] opacity-20">{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                c.userId === currentUser.id 
                  ? 'bg-[#141414] text-white rounded-tr-none' 
                  : 'bg-white rounded-tl-none border border-[#141414]/5'
              }`}>
                {c.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-white border-t border-[#141414]/10">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder={t('common.typeMessage')}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && msg.trim() && (onSendMessage(msg), setMsg(''))}
            className="flex-1 bg-[#141414]/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-[#E2FF3B] outline-none"
          />
          <button 
            disabled={!msg.trim()}
            onClick={() => {
              onSendMessage(msg);
              setMsg('');
            }}
            className="w-12 h-12 bg-[#141414] text-[#E2FF3B] rounded-2xl flex items-center justify-center disabled:opacity-30"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function GroupsTab({ 
  groups, 
  currentUser, 
  onJoin, 
  onOpenChat,
  onCreateClick
}: { 
  groups: Group[], 
  currentUser: User, 
  onJoin: (id: string) => void,
  onOpenChat: (group: Group) => void,
  onCreateClick: () => void
}) {
  const { t } = useI18n(currentUser.languagePreference || 'hu');
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">{t('groups.title')}</h2>
          <p className="text-xs opacity-40 font-bold uppercase tracking-widest">{t('groups.subTitle')}</p>
        </div>
        <button 
          onClick={onCreateClick}
          className="w-12 h-12 bg-[#141414] text-[#E2FF3B] rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-black/10"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(group => {
          const isMember = group.memberIds.includes(currentUser.id);
          return (
            <div key={group.id} className="bg-white p-5 rounded-3xl border border-[#141414]/5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold">{group.name}</h3>
                  <div className="flex items-center gap-1 opacity-40 text-[10px] font-black uppercase tracking-widest">
                    <MapPin className="w-3 h-3" /> {group.city}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {group.recommendedLevel && (
                    <span className="px-3 py-1 bg-[#141414] text-[#E2FF3B] rounded-full text-[10px] font-black uppercase tracking-widest">
                      {t(`profile.levels.${group.recommendedLevel}`)}
                    </span>
                  )}
                  <span className="text-[9px] font-black uppercase opacity-30 tracking-widest">
                    {group.visibility === 'public' ? t('groups.public') : t('groups.private')}
                  </span>
                </div>
              </div>
              <p className="text-xs opacity-60 leading-relaxed mb-4 line-clamp-2">{group.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {group.memberIds.slice(0, 3).map(mid => (
                      <div key={mid} className="w-8 h-8 rounded-full border-2 border-white bg-[#141414]/10 overflow-hidden flex items-center justify-center">
                        <UserIcon className="w-4 h-4 opacity-40" />
                      </div>
                    ))}
                    {group.memberIds.length > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-[#141414] flex items-center justify-center text-[10px] font-black text-[#E2FF3B]">
                        +{group.memberIds.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold opacity-30 uppercase">{group.memberIds.length} {t('groups.members')}</span>
                </div>
                {isMember ? (
                  <button 
                    onClick={() => onOpenChat(group)}
                    className="px-6 py-2.5 bg-[#141414] text-[#E2FF3B] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {t('games.chatShort') || 'Chat'}
                  </button>
                ) : (
                  <button 
                    onClick={() => onJoin(group.id)}
                    className="px-6 py-2.5 bg-[#E2FF3B] text-[#141414] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                  >
                    {t('common.join')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchHistory({ games = [] }: { games: Game[] }) {
  const { t } = useI18n('hu');
  const completedGames = (games || []).filter(g => g.isCompleted).sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  if (completedGames.length === 0) {
    return (
      <div className="py-8 text-center opacity-30">
        <History className="w-8 h-8 mx-auto mb-2" />
        <p className="text-xs font-black uppercase tracking-widest">{t('profile.noMatchHistory') || 'Nincs meccselőzmény'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {completedGames.map(game => (
        <div key={game.id} className="bg-white p-4 rounded-2xl border border-[#141414]/5 flex justify-between items-center group hover:border-[#E2FF3B]/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${game.status === 'played' ? 'bg-[#E2FF3B]/10 text-[#141414]' : 'bg-red-50/50 text-red-500'}`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest opacity-40">
                  {new Date(game.datetime).toLocaleDateString('hu-HU')}
                </p>
                <span className="text-[10px] px-2 py-0.5 bg-[#141414]/5 rounded-full font-bold opacity-60 capitalize">
                  {game.gameType || 'Friendly'}
                </span>
              </div>
              <h4 className="font-bold text-sm truncate max-w-[150px]">{game.location}</h4>
              <p className="text-[10px] font-bold text-[#E2FF3B] bg-[#141414] inline-block px-1.5 rounded mt-1">
                {game.result?.score || 'No score recorded'}
              </p>
            </div>
          </div>
          <div className="flex -space-x-1.5 translate-x-1">
            {game.joinedPlayers.slice(0, 3).map((pid, i) => (
              <div key={i} className="w-6 h-6 rounded-full border border-white bg-gray-100 overflow-hidden ring-1 ring-black/5">
                <UserIcon className="w-3 h-3 m-auto mt-1.5 opacity-20" />
              </div>
            ))}
            {game.joinedPlayers.length > 3 && (
              <div className="w-6 h-6 rounded-full border border-white bg-[#141414] flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-black/5">
                +{game.joinedPlayers.length - 3}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultModal({ game, onSave, onClose }: { game: Game, onSave: (res: any) => void, onClose: () => void }) {
  const [sets, setSets] = useState([{ team1: 0, team2: 0 }, { team1: 0, team2: 0 }]);
  
  const handleSave = () => {
    const score = sets.map(s => `${s.team1}-${s.team2}`).join(', ');
    onSave({ score, sets });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black uppercase tracking-tight italic">Record Result</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-full"><X className="w-5 h-5"/></button>
        </div>

        <div className="space-y-6">
          {sets.map((set, idx) => (
            <div key={idx} className="bg-[#141414]/5 p-4 rounded-3xl">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3 text-center">Set {idx + 1}</p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold opacity-30">Team 1</span>
                  <input 
                    type="number" 
                    value={set.team1} 
                    onChange={e => {
                      const newSets = [...sets];
                      newSets[idx].team1 = parseInt(e.target.value) || 0;
                      setSets(newSets);
                    }}
                    className="w-16 h-16 bg-white rounded-2xl text-center text-2xl font-black focus:ring-2 focus:ring-[#E2FF3B] outline-none"
                  />
                </div>
                <div className="font-black opacity-20 text-2xl">:</div>
                <div className="flex-1 flex flex-col items-center gap-2">
                   <span className="text-[10px] font-bold opacity-30">Team 2</span>
                  <input 
                    type="number" 
                    value={set.team2} 
                    onChange={e => {
                      const newSets = [...sets];
                      newSets[idx].team2 = parseInt(e.target.value) || 0;
                      setSets(newSets);
                    }}
                    className="w-16 h-16 bg-white rounded-2xl text-center text-2xl font-black focus:ring-2 focus:ring-[#E2FF3B] outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
          
          <button 
            onClick={() => setSets([...sets, { team1: 0, team2: 0 }])}
            className="w-full py-3 border-2 border-dashed border-[#141414]/10 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 hover:border-[#E2FF3B] transition-all"
          >
            + Add Set
          </button>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-[#E2FF3B] text-[#141414] py-4 rounded-2xl mt-8 font-black uppercase tracking-widest shadow-lg shadow-[#E2FF3B]/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          Save Result
        </button>
      </motion.div>
    </div>
  );
}

function ProfileDrawer({ 
  user, 
  currentUser,
  games = [],
  groups = [],
  onClose,
  onFavorite,
  onSendFriendRequest,
  onBlock
}: { 
  user: User, 
  currentUser: User,
  games: Game[],
  groups: Group[],
  onClose: () => void,
  onFavorite: (id: string) => void,
  onSendFriendRequest: (id: string) => void,
  onBlock: (id: string) => void
}) {
  const { t, lang } = useI18n(currentUser.languagePreference || 'hu');
  const userGames = (games || []).filter(g => g.joinedPlayers.includes(user.id));
  const isFriend = currentUser.friendIds?.includes(user.id);
  const isBlocked = currentUser.blockedUserIds?.includes(user.id);
  
  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <motion.div 
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        className="relative w-full max-w-sm bg-[#F5F5F0] h-full shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="relative h-64">
           {user.avatarUrl ? (
            <img src={user.avatarUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-[#141414] flex items-center justify-center">
              <UserIcon className="w-20 h-20 text-[#E2FF3B] opacity-20" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-[#F5F5F0] via-[#F5F5F0]/80 to-transparent">
             <div className="flex justify-between items-end flex-wrap gap-4">
               <div>
                 <span className="px-2 py-0.5 bg-[#E2FF3B] text-[#141414] rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 inline-block shadow-sm">
                   {t(`profile.levels.${user.skillLevel}`)}
                 </span>
                 <h2 className="text-2xl sm:text-3xl font-black uppercase leading-none italic">{user.name}</h2>
                 {user.username && <p className="text-[10px] font-black opacity-30 lowercase mt-0.5">@{user.username}</p>}
                 <p className="text-xs font-bold opacity-40 uppercase tracking-widest flex items-center gap-1 mt-2">
                   <MapPin className="w-3 h-3" /> {user.location.city}
                 </p>
               </div>
               <div className="flex gap-2">
                 <button 
                   onClick={() => onFavorite(user.id)}
                   className="w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center border border-[#141414]/5 hover:scale-110 active:scale-95 transition-all"
                 >
                   <Heart className={`w-5 h-5 ${currentUser.favoritePlayerIds?.includes(user.id) ? 'fill-red-500 text-red-500' : 'text-[#141414]/20'}`} />
                 </button>
                 {!isFriend && !isBlocked && (
                   <button 
                     onClick={() => onSendFriendRequest(user.id)}
                     className="px-4 py-2 bg-[#141414] text-[#E2FF3B] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                   >
                     {t('profile.addFriend')}
                   </button>
                 )}
                 {isFriend && (
                   <div className="px-4 py-2 bg-[#E2FF3B] text-[#141414] rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                     <Check className="w-3 h-3" /> {t('profile.friends')}
                   </div>
                 )}
               </div>
             </div>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-black/20 backdrop-blur-md text-white rounded-full flex items-center justify-center"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-12">
          {/* Block Action */}
          <div className="flex gap-2">
            <button 
              onClick={() => onBlock(user.id)}
              className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                isBlocked 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                : 'bg-white border border-[#141414]/5 text-[#141414]/40 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              {isBlocked ? (
                <>
                  <Eye className="w-3 h-3" />
                  {t('profile.unblock')}
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  {t('profile.block')}
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
             {[
               { icon: History, label: t('profile.playedGames'), value: user.attendedGamesCount || 0 },
               { icon: Award, label: t('groups.members'), value: (groups || []).filter(g => g.memberIds.includes(user.id)).length },
               { icon: Users, label: t('profile.friends'), value: user.friendIds?.length || 0 },
               { icon: Award, label: t('profile.skillLevel'), value: t(`profile.levels.${user.skillLevel}`) }
             ].map((stat, i) => (
               <div key={i} className="bg-white p-3 rounded-2xl border border-[#141414]/5 text-center flex flex-col items-center justify-center shadow-sm min-h-[90px]">
                 <div className="text-[8px] font-black uppercase opacity-40 mb-1 leading-tight h-6 flex items-center justify-center text-center">
                    {stat.label}
                 </div>
                 <p className="text-sm font-black truncate w-full">{stat.value}</p>
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm">
                <p className="text-[10px] font-black uppercase opacity-40 mb-2">{t('profile.playStyle')}</p>
                <div className="flex items-center gap-2">
                   <Target className="w-4 h-4 text-[#141414]" />
                   <span className="text-sm font-black">{user.playStyle ? t(`profile.playStyles.${user.playStyle}`) : t('profile.playStyles.Casual')}</span>
                </div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm">
                <p className="text-[10px] font-black uppercase opacity-40 mb-2">{t('profile.reliability')}</p>
                <div className="flex items-center gap-2">
                   <Shield className="w-4 h-4 text-blue-500" />
                   <span className="text-sm font-black text-blue-600">{user.reliabilityStatus ? t(`profile.reliabilityStatus.${user.reliabilityStatus}`) : t('profile.reliabilityStatus.New Player')}</span>
                </div>
             </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40">{t('profile.bio')}</h3>
            <p className="text-sm opacity-70 leading-relaxed font-medium bg-white/50 p-4 rounded-2xl italic border border-[#141414]/5">
              "{user.bio || (lang === 'hu' ? 'Ez a játékos még nem írt bemutatkozást.' : 'This player hasn\'t written a bio yet.')}"
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> {t('profile.languages')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.languages?.length ? user.languages.map(lang_val => (
                   <span key={lang_val} className="px-3 py-1 bg-white border border-[#141414]/5 rounded-xl text-[10px] font-bold">{t(`profile.languageList.${lang_val}`) || lang_val}</span>
                )) : <span className="text-[10px] opacity-30 italic">{t('common.noData')}</span>}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                <Smartphone className="w-3 h-3" /> {t('profile.socialLinks')}
              </h3>
              <div className="flex gap-3">
                {(!user.privacySettings || user.privacySettings.showSocialLinks) ? (
                  <>
                    {user.socialLinks?.instagram && (
                      <a href={`https://instagram.com/${user.socialLinks.instagram}`} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-400 to-pink-500 flex items-center justify-center text-white shadow-md">
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                    {user.socialLinks?.facebook && (
                      <a href="#" className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center text-white shadow-md">
                        <Facebook className="w-4 h-4" />
                      </a>
                    )}
                    {!user.socialLinks?.instagram && !user.socialLinks?.facebook && (
                      <span className="text-[10px] opacity-30 italic">{t('profile.privacy')}</span>
                    )}
                  </>
                ) : (
                   <div className="flex items-center gap-1 opacity-20">
                     <EyeOff className="w-3 h-3" />
                     <span className="text-[10px] font-bold uppercase">{t('profile.privacy')}</span>
                   </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
               <Target className="w-3 h-3" /> {t('profile.interests')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {user.interests?.length ? user.interests.map(interest => (
                 <span key={interest} className="px-3 py-1.5 bg-white border border-[#141414]/5 rounded-xl text-[10px] font-bold uppercase tracking-wider">
                   {t(`profile.interestsList.${interest}`) || interest}
                 </span>
              )) : <span className="text-[10px] opacity-30 italic">{t('common.noData')}</span>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest opacity-40">{t('profile.matchHistory')}</h3>
              <History className="w-4 h-4 opacity-20" />
            </div>
            {(!user.privacySettings || user.privacySettings.showMatchHistory) ? (
              <MatchHistory games={userGames} />
            ) : (
              <div className="p-8 text-center bg-[#141414]/5 rounded-[32px] border border-dashed border-[#141414]/10">
                <EyeOff className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30">{lang === 'hu' ? 'Ez az előzmény privát' : 'This history is private'}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
function ConfirmDialog({ 
  title, 
  message, 
  confirmLabel, 
  cancelLabel, 
  onConfirm, 
  onCancel 
}: { 
  title: string, 
  message: string, 
  confirmLabel: string, 
  cancelLabel: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-white/20"
      >
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>
        
        <h3 className="text-2xl font-black uppercase tracking-tight text-[#141414] mb-2">{title}</h3>
        <p className="text-sm text-[#141414]/60 leading-relaxed mb-8">{message}</p>
        
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 px-6 rounded-2xl font-bold bg-[#141414]/5 text-[#141414] hover:bg-[#141414]/10 transition-colors"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-4 px-6 rounded-2xl font-bold bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NavBtn({ active, icon, label, onClick, isSpecial = false }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void, isSpecial?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 relative py-1 focus:outline-none group`}
    >
      <div className={`transition-all duration-300 ${active && !isSpecial ? 'scale-110 opacity-100 text-[#141414]' : 'opacity-40 text-[#141414] group-hover:opacity-60'}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 truncate w-full text-center transition-all ${active ? 'text-[#141414] opacity-100' : 'text-[#141414] opacity-30'}`}>{label}</span>
      {active && !isSpecial && (
        <motion.div 
          layoutId="activeNavIndicator"
          className="absolute -bottom-1 w-6 h-0.5 bg-[#141414] rounded-full"
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        />
      )}
    </button>
  );
}

function LevelTutorial({ onClose, t }: { onClose: () => void, t: (key: string) => string }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#141414]/90 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-[#141414]/5 rounded-xl hover:bg-[#141414]/10 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-[#E2FF3B] rounded-2xl flex items-center justify-center">
              <Award className="w-6 h-6 text-[#141414]" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">{t('profile.levelTutorialTitle')}</h2>
              <p className="text-xs opacity-50 font-bold uppercase tracking-widest">{t('profile.levelTutorialSub')}</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
            {Object.values(SkillLevel).map(lvl => (
              <div key={lvl} className="p-4 bg-[#141414]/5 rounded-2xl border border-transparent hover:border-[#E2FF3B]/50 transition-all group">
                <div className="flex justify-between items-center mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    lvl === SkillLevel.Bronze ? 'bg-orange-100 text-orange-700' :
                    lvl === SkillLevel.Silver ? 'bg-slate-100 text-slate-700' :
                    lvl === SkillLevel.Gold ? 'bg-yellow-100 text-yellow-700' :
                    lvl === SkillLevel.Platinum ? 'bg-cyan-100 text-cyan-700' :
                    lvl === SkillLevel.Diamond ? 'bg-blue-100 text-blue-700' :
                    'bg-[#E2FF3B] text-[#141414]'
                  }`}>
                    {t(`profile.levels.${lvl}`)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                  {t(`profile.levelDescriptions.${lvl}`)}
                </p>
              </div>
            ))}
          </div>

          <button 
            onClick={onClose}
            className="w-full mt-8 bg-[#141414] text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-[#252525] transition-colors"
          >
            {t('common.gotIt')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreateGroupModal({ 
  currentUser, 
  onClose, 
  onSave 
}: { 
  currentUser: User, 
  onClose: () => void, 
  onSave: (data: Partial<Group>) => void 
}) {
  const { t } = useI18n(currentUser.languagePreference || 'hu');
  const [formData, setFormData] = useState<Partial<Group>>({
    name: '',
    description: '',
    city: currentUser.location.city,
    recommendedLevel: SkillLevel.Bronze,
    visibility: 'public'
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-md bg-[#F5F5F0] rounded-[40px] p-8 shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black uppercase italic tracking-tighter">{t('groups.createGroup')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#141414]/5 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.name')}</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none"
                placeholder={t('groups.namePlaceholder')}
              />
            </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.description')}</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-sm focus:ring-1 focus:ring-[#E2FF3B] outline-none min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.location')}</label>
              <input 
                type="text" 
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.recommendedLevel')}</label>
              <select 
                value={formData.recommendedLevel}
                onChange={e => setFormData({ ...formData, recommendedLevel: e.target.value as SkillLevel })}
                className="w-full bg-[#141414]/5 border-none rounded-xl py-3 px-4 text-xs font-bold focus:ring-1 focus:ring-[#E2FF3B] outline-none appearance-none"
              >
                {Object.values(SkillLevel).map(lvl => <option key={lvl} value={lvl}>{t(`profile.levels.${lvl}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">{t('groups.visibility')}</label>
            <div className="flex gap-2">
              {(['public', 'private'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setFormData({ ...formData, visibility: v })}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    formData.visibility === v ? 'bg-[#141414] text-[#E2FF3B]' : 'bg-[#141414]/5 text-[#141414]/30'
                  }`}
                >
                  {v === 'public' ? t('games.public') : t('profile.privacy')}
                </button>
              ))}
            </div>
          </div>

          <button 
            disabled={!formData.name}
            onClick={() => {
              onSave(formData);
              onClose();
            }}
            className="w-full py-4 bg-[#141414] text-[#E2FF3B] rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-xl transition-all mt-4 disabled:opacity-30"
          >
            {t('groups.createGroup')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function GameDetailDrawer({ 
  game, 
  players, 
  currentUser,
  t,
  onClose,
  onJoin,
  onOpenChat
}: { 
  game: Game, 
  players: User[],
  currentUser: User,
  t: (key: string) => string,
  onClose: () => void,
  onJoin: () => void,
  onOpenChat: () => void
}) {
  const date = new Date(game.datetime);
  const slotsLeft = (game.requiredPlayers + 1) - game.joinedPlayers.length;
  const isJoined = game.joinedPlayers.includes(currentUser.id);
  const isOwner = game.creatorId === currentUser.id;
  const isFull = slotsLeft <= 0;
  
  const joinedUsers = game.joinedPlayers.map(id => (players || []).find(p => p.id === id)).filter(Boolean) as User[];
  const myRequest = game.requests?.find(r => r.userId === currentUser.id);

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose} 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '100%' }}
        className="relative w-full max-w-md bg-[#F5F5F0] h-full shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 flex justify-between items-center bg-white border-b border-[#141414]/5">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-[#141414]/5 rounded-full"><ArrowLeft className="w-5 h-5"/></button>
          <h3 className="text-xl font-black uppercase tracking-tight italic">{t('games.title')}</h3>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Header Info */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase italic leading-none">{game.location}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-black uppercase">
                    {t(`profile.levels.${game.recommendedLevel}`)} {t('groups.recommendedLevel')}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${game.gameType === 'Competitive' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {t(`games.gameTypes.${game.gameType}`)}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-xs font-bold opacity-40 uppercase tracking-widest">
                  <Calendar className="w-3 h-3" />
                  {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="text-2xl font-black mt-1">
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {game.note && (
              <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm italic text-sm opacity-70">
                "{game.note}"
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{t('games.admin') || 'Organizer'}</h4>
            <div className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#141414]/5 flex items-center justify-center overflow-hidden">
                  {game.creator?.avatarUrl ? (
                    <img src={game.creator.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 opacity-40" />
                  )}
                </div>
                <div>
                  <p className="font-bold">{game.creator?.name || 'Player'}</p>
                  <p className="text-[10px] font-black uppercase opacity-30">
                    {game.creator?.reliabilityStatus ? t(`profile.reliabilityStatus.${game.creator.reliabilityStatus}`) : ''}
                  </p>
                </div>
              </div>
              <TrendingUp className="w-4 h-4 text-[#E2FF3B] fill-current" />
            </div>
          </div>

          {/* Players List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{t('groups.members')}</h4>
              <span className="text-[10px] font-black px-2 py-0.5 bg-[#141414] text-[#E2FF3B] rounded-full">
                {game.joinedPlayers.length} / {game.requiredPlayers + 1}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {joinedUsers.map(user => (
                <div key={user.id} className="bg-white p-4 rounded-2xl border border-[#141414]/5 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#141414]/5 flex items-center justify-center overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-5 h-5 opacity-40" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{user.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase opacity-40 bg-[#141414]/5 px-1.5 rounded">{t(`profile.levels.${user.skillLevel}`)}</span>
                        {user.reliabilityStatus && (
                          <span className="text-[10px] font-bold text-blue-500 uppercase">{t(`profile.reliabilityStatus.${user.reliabilityStatus}`)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {user.id === game.creatorId && (
                    <div className="px-2 py-0.5 bg-[#E2FF3B] text-[#141414] text-[8px] font-black uppercase rounded shadow-sm italic">Host</div>
                  )}
                </div>
              ))}
              
              {Array.from({ length: Math.max(0, slotsLeft) }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-[#141414]/5 border border-dashed border-[#141414]/10 rounded-2xl p-4 flex items-center gap-3 opacity-40">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest">{t('common.noData')}...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          {(game.chat && game.chat.length > 0) && (
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{t('notifications.title') || 'Recent Activity'}</h4>
              <div className="bg-[#141414] rounded-3xl p-6 shadow-xl space-y-4">
                {game.chat.slice(-2).map((msg, i) => (
                  <div key={msg.id || i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <UserIcon className="w-4 h-4 text-[#E2FF3B]" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#E2FF3B] uppercase">{msg.userName}</span>
                        <span className="text-[8px] text-white/30 uppercase font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed font-bold">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <button 
                  onClick={onOpenChat}
                  className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-[#E2FF3B] bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  {t('common.enter') || 'View all messages'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-6 bg-white border-t border-[#141414]/5 space-y-3">
          {(isJoined || isOwner) ? (
            <button 
              onClick={onOpenChat}
              className="w-full py-4 bg-[#141414] text-[#E2FF3B] rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-xl shadow-black/10"
            >
              <MessageSquare className="w-5 h-5" />
              {t('games.chat')}
            </button>
          ) : (
            <button 
              disabled={isFull || myRequest?.status === 'pending'}
              onClick={onJoin}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl transition-all ${
                myRequest?.status === 'pending' 
                  ? 'bg-yellow-400 text-[#141414]' 
                  : isFull 
                    ? 'bg-[#141414]/10 text-[#141414]/40 scale-95' 
                    : 'bg-[#E2FF3B] text-[#141414] hover:scale-[1.02] active:scale-95 shadow-[#E2FF3B]/30'
              }`}
            >
              {myRequest?.status === 'pending' ? t('common.requested') : isFull ? t('common.full') : t('common.joinMatch')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
