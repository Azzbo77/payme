import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Set up automatic token refresh timer
 * Refreshes every 10 minutes (access token lasts 15 minutes)
 * This ensures we always have a valid access token during active use
 */
async function setupTokenRefreshTimer() {
  // Refresh token every 10 minutes (access token is 15 minutes)
  // This ensures we always have a valid access token
  const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

  const refresh = async () => {
    try {
      await api.auth.refresh();
    } catch {
      // Refresh failed, user will be logged out on next API call
      console.debug("Token refresh failed");
    }
  };

  // Set up periodic refresh
  const interval = setInterval(refresh, REFRESH_INTERVAL);

  return () => clearInterval(interval);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then((user) => {
        setUser(user);
        // Set up token refresh when user is authenticated
        setupTokenRefreshTimer();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const user = await api.auth.login(username, password);
    setUser(user);
    // Set up token refresh after login
    setupTokenRefreshTimer();
  };

  const register = async (username: string, password: string) => {
    await api.auth.register(username, password);
    await login(username, password);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  const updateUsername = (username: string) => {
    if (user) {
      setUser({ ...user, username });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

