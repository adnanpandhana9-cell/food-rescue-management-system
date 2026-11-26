import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getStoredToken, setStoredToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!getStoredToken()) {
      setUnreadCount(0);
      return;
    }
    try {
      const data = await api.getNotifications();
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // ignore transient errors
    }
  }, []);

  const loadSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user);
      await refreshUnreadCount();
    } catch {
      setStoredToken('');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(() => {
      refreshUnreadCount();
    }, 15000);
    return () => clearInterval(timer);
  }, [user, refreshUnreadCount]);

  const login = async (identifier, password) => {
    const data = await api.login({ identifier, password });
    setStoredToken(data.token);
    setUser(data.user);
    await refreshUnreadCount();
    return data.user;
  };

  const register = async (payload) => {
    const data = await api.register(payload);
    setStoredToken(data.token);
    setUser(data.user);
    setUnreadCount(0);
    return data.user;
  };

  const logout = async () => {
    try {
      if (getStoredToken()) await api.logout();
    } catch {
      // ignore if token already expired
    }
    setStoredToken('');
    setUser(null);
    setUnreadCount(0);
  };

  const updateUserState = (nextUser) => {
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        unreadCount,
        login,
        register,
        logout,
        updateUserState,
        refreshUnreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
