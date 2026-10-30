import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AuthContext } from './authContext.js';
import { API_URL } from '../services/api.js';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('imovies-token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    axios.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (active) setUser(data.data.user); })
      .catch(() => { if (active) { localStorage.removeItem('imovies-token'); setToken(null); setUser(null); } });
    return () => { active = false; };
  }, [token]);

  const value = useMemo(() => ({
    token,
    user,
    signIn(nextToken) { localStorage.setItem('imovies-token', nextToken); setToken(nextToken); },
    signOut() { localStorage.removeItem('imovies-token'); setToken(null); setUser(null); },
  }), [token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
