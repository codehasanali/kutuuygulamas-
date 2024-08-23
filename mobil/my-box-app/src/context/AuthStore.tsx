import create from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

interface AuthState {
  token: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string | null) => void; 
  setError: (error: string | null) => void; 
  checkAuth: () => Promise<void>; 
}


export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  error: null,

  login: async (email, password) => {
    try {
      const response = await axios.post('https://0d92-88-232-168-154.ngrok-free.app/login', { email, password });
      const token = response.data.token;
      await AsyncStorage.setItem('token', token);
      set({ token, error: null });
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Login failed';
      set({ error: errorMsg });
    }
  },

  register: async (username, email, password) => {
    try {
      await axios.post('https://0d92-88-232-168-154.ngrok-free.app/register', { username, email, password });
      set({ error: null });
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed';
      set({ error: errorMsg });
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ token: null, error: null });
  },

  setToken: (token) => set({ token }),
  setError: (error) => set({ error }),

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        set({ token, error: null });
      } else {
        set({ token: null, error: null });
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
      set({ token: null, error: 'Failed to check authentication' });
    }
  },
}));
