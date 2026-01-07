import { create } from 'zustand';
import { GameState, PlayerStats } from '../types';
import { PLAYER } from '../config/constants';

interface GameOverStats {
  roundsSurvived: number;
  message: string;
}

interface GameStore {
  gameState: GameState;
  playerStats: PlayerStats;
  gameOverStats: GameOverStats;
  
  // Actions
  setGameState: (state: GameState) => void;
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  resetPlayerStats: () => void;
  setGameOverStats: (stats: GameOverStats) => void;
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
  gameOverStats: { roundsSurvived: 0, message: '' },

  setGameState: (state) => set({ gameState: state }),
  
  updatePlayerStats: (stats) =>
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats },
    })),
    
  resetPlayerStats: () => set({ playerStats: initialPlayerStats }),
  setGameOverStats: (stats) => set({ gameOverStats: stats }),
}));
