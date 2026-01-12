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

interface SessionReport {
  xpGained: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
  kills: number;
  rounds: number;
  timePlayed: number;
  nextState: GameState; // Indicates where to go after stats
  weaponXpInfo?: Record<string, { oldLevel: number, newLevel: number, levelUp: boolean, xpGained: number }>;
}

interface GameStore {
  gameState: GameState;
  playerStats: PlayerStats;
  gameOverStats: { roundsSurvived: number; message: string };
  activePowerUps: ActivePowerUpState[];
  currentRound: number; // New property
  isPreviewing: boolean;
  
  // Profile State
  profile: import('../schemas/profileSchema').Profile | null;
  
  // Post-Game Report
  sessionReport: SessionReport | null;

  // Actions
  setGameState: (state: GameState) => void;
  setIsPreviewing: (val: boolean) => void;
  updatePlayerStats: (stats: Partial<PlayerStats>) => void;
  resetPlayerStats: () => void;
  resetSessionStats: () => void;
  setGameOverStats: (stats: GameOverStats) => void;
  setActivePowerUps: (powerups: ActivePowerUpState[]) => void;
  setCurrentRound: (round: number) => void; // New action
  setProfile: (profile: import('../schemas/profileSchema').Profile) => void;
  setSessionReport: (report: SessionReport | null) => void;
}

const INITIAL_PLAYER_STATS: PlayerStats = { // Renamed constant
  health: PLAYER.MAX_HEALTH,
  maxHealth: PLAYER.MAX_HEALTH,
  stamina: PLAYER.MAX_STAMINA,
  maxStamina: PLAYER.MAX_STAMINA,
  ammo: 0,
  maxAmmo: 0,
  points: 500, // Default starting points
  kills: 0,
  headshots: 0
};

export const useGameStore = create<GameStore>((set) => ({
  gameState: GameState.MENU, // Kept original property name, assuming GameState enum is still used
  playerStats: INITIAL_PLAYER_STATS, // Updated reference
  gameOverStats: { roundsSurvived: 0, message: '' },
  activePowerUps: [], // New list for UI
  currentRound: 1, // NEW: Initial current round
  isPreviewing: false,
  profile: null, // Initial profile
  sessionReport: null,
  
  setGameState: (state) => set({ gameState: state }),
  setIsPreviewing: (val) => set({ isPreviewing: val }),
  
  updatePlayerStats: (stats) =>
    set((state) => ({
      playerStats: { ...state.playerStats, ...stats },
    })),
    
  resetPlayerStats: () => set({ 
    playerStats: INITIAL_PLAYER_STATS,
    activePowerUps: [],
    currentRound: 1, // NEW: Reset current round
    isPreviewing: false,
    sessionReport: null
  }), 
  
  // Explicit session reset (Aliased to resetPlayerStats for now, but semantically clear)
  resetSessionStats: () => set({
     playerStats: INITIAL_PLAYER_STATS,
     activePowerUps: [],
     currentRound: 1,
     sessionReport: null
  }),

  setGameOverStats: (stats) => set({ gameOverStats: stats }),
  setActivePowerUps: (powerups: ActivePowerUpState[]) => set({ activePowerUps: powerups }), // New action
  setCurrentRound: (round: number) => set({ currentRound: round }), // NEW: Action implementation
  setProfile: (profile) => set({ profile }),
  setSessionReport: (report) => set({ sessionReport: report }),
}));
