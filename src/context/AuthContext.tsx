import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('padel_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const safeFetch = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Server returned invalid JSON response');
    }
    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Request failed');
    }
    return data;
  };

  const fetchMe = async (authToken: string) => {
    try {
      const user = await safeFetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      setCurrentUser(user);
    } catch (err) {
      console.error("Auth verify error:", err);
      localStorage.removeItem('padel_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const data = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('padel_token', data.token);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
      throw err;
    }
  };

  const register = async (userData: any) => {
    setAuthError(null);
    try {
      const data = await safeFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('padel_token', data.token);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = () => {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('padel_token');
  };

  const updateUser = (data: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...data });
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      token,
      loading,
      login,
      register,
      logout,
      updateUser,
      authError,
      setAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
