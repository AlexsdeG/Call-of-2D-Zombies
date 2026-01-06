import { create } from 'zustand';
import { GameState, PlayerStats } from '../types';
import { PLAYER } from '../config/constants';

interface GameStore {
  gameState: GameState;
  playerStats: PlayerStats;
  
  // Actions
  setGameState: (state: GameState) => void;
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  resetPlayerStats: () => void;
}

const initialPlayerStats: PlayerStats = {
  health: PLAYER.MAX_HEALTH,
  maxHealth: PLAYER.MAX_HEALTH,
  stamina: PLAYER.MAX_STAMINA,
  maxStamina: PLAYER.MAX_STAMINA,
  ammo: 0,
  maxAmmo: 0,
  points: 500, // Default starting points
};

export const useGameStore = create<GameStore>((set) => ({
  gameState: GameState.MENU,
  playerStats: initialPlayerStats,

  setGameState: (state) => set({ gameState: state }),
  
  updatePlayerStats: (stats) =>
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats },
    })),
    
  resetPlayerStats: () => set({ playerStats: initialPlayerStats }),
}));
