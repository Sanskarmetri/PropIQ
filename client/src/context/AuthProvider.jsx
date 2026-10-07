import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginUser, registerUser as registerRequest } from '../services/api.js';
import { clearStoredToken, getStoredToken, storeToken } from '../services/token.js';
import { AuthContext } from './AuthContext.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus('anonymous');
      return undefined;
    }

    let cancelled = false;

    getCurrentUser()
      .then((payload) => {
        if (cancelled) return;
        setUser(payload.data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredToken();
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const payload = await loginUser(credentials);
    storeToken(payload.data.token);
    setUser(payload.data.user);
    setStatus('authenticated');
    return payload.data.user;
  }, []);

  const register = useCallback((details) => registerRequest(details), []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      role: user?.role || null,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
    }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
