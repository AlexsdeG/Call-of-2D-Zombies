import { create } from 'zustand';
import { PlayerStats, GameState } from '../types';
import { PowerUpType } from '../game/types/PerkTypes'; // New import
import { PLAYER } from '../config/constants';

export interface ActivePowerUpState {
    type: PowerUpType;
    endTime: number;
}

interface GameOverStats {
  roundsSurvived: number;
  message: string;
}

interface GameStore {
  gameState: GameState;
  playerStats: PlayerStats;
  gameOverStats: GameOverStats;
  activePowerUps: ActivePowerUpState[]; // New property
  
  // Actions
  setGameState: (state: GameState) => void;
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  resetPlayerStats: () => void;
  setGameOverStats: (stats: GameOverStats) => void;
  setActivePowerUps: (powerups: ActivePowerUpState[]) => void; // New action
}

const INITIAL_PLAYER_STATS: PlayerStats = { // Renamed constant
  health: PLAYER.MAX_HEALTH,
  maxHealth: PLAYER.MAX_HEALTH,
  stamina: PLAYER.MAX_STAMINA,
  maxStamina: PLAYER.MAX_STAMINA,
  ammo: 0,
  maxAmmo: 0,
  points: 15000, // Default starting points
};

export const useGameStore = create<GameStore>((set) => ({
  gameState: GameState.MENU, // Kept original property name, assuming GameState enum is still used
  playerStats: INITIAL_PLAYER_STATS, // Updated reference
  gameOverStats: { roundsSurvived: 0, message: '' },
  activePowerUps: [], // New list for UI

  setGameState: (state) => set({ gameState: state }),
  
  updatePlayerStats: (stats) =>
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats },
    })),
    
  resetPlayerStats: () => set({ playerStats: INITIAL_PLAYER_STATS }), // Updated reference
  setGameOverStats: (stats) => set({ gameOverStats: stats }),
  setActivePowerUps: (powerups: ActivePowerUpState[]) => set({ activePowerUps: powerups }), // New action
}));
