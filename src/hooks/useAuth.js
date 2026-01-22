import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' });
      
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setError(null);
      } else if (res.status === 401) {
        setUser(null);
        setError(null);
      } else if (res.status === 403) {
        const data = await res.json();
        setUser(null);
        setError({ type: 'access_denied', email: data.email });
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      setUser(null);
      setError({ type: 'network_error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    window.location.href = '/auth/logout';
  }, []);

  const login = useCallback(() => {
    window.location.href = '/auth/google';
  }, []);

  return { user, loading, error, login, logout, checkAuth };
}
