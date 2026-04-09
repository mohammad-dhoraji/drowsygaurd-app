import { create } from 'zustand';

interface DriverState {
  status: 'active' | 'inactive' | 'drowsy';
  drowsinessLevel: number;
  location: { lat: number; lng: number } | null;
  setStatus: (status: DriverState['status']) => void;
  setDrowsinessLevel: (level: number) => void;
  setLocation: (location: { lat: number; lng: number }) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  status: 'inactive',
  drowsinessLevel: 0,
  location: null,
  setStatus: (status) => set({ status }),
  setDrowsinessLevel: (level) => set({ drowsinessLevel: level }),
  setLocation: (location) => set({ location }),
}));

