import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('salesradar_token');
    const savedUser = localStorage.getItem('salesradar_user');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verificar se o token ainda é válido
      api.get('/auth/me')
        .then(res => {
          setUser(res.data);
          localStorage.setItem('salesradar_user', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('salesradar_token');
          localStorage.removeItem('salesradar_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data;
    localStorage.setItem('salesradar_token', token);
    localStorage.setItem('salesradar_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('salesradar_token');
    localStorage.removeItem('salesradar_user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('salesradar_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);