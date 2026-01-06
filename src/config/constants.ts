/**
 * Global Magic Numbers and Constants
 * Reference this file instead of hardcoding values.
 */

export const PLAYER = {
  DEFAULT_SPEED: 160, // pixels per second
  SPRINT_SPEED_MULTIPLIER: 1.5,
  MAX_HEALTH: 100,
  MAX_STAMINA: 100,
  MIN_STAMINA_TO_SPRINT: 15, // Hysteresis threshold
  STAMINA_REGEN_RATE: 10, // per second
  STAMINA_DRAIN_RATE: 25, // per second
  INTERACTION_RADIUS: 60, // pixels
  DEFAULT_FOV: 90, // Degrees for flashlight
  BASE_RADIUS: 16, // Collision radius
} as const;

export const ZOMBIE = {
  DEFAULT_SPEED: 90,
  RUN_SPEED: 140,
  AGGRO_RADIUS: 400,
  ATTACK_RANGE: 35,
  DAMAGE: 20,
  ATTACK_COOLDOWN: 1000, // ms
  MAX_LIMIT: 50, // Max active zombies (optimization)
} as const;

export const WORLD = {
  TILE_SIZE: 32,
  DEFAULT_ZOOM: 1.5,
  GRAVITY: { x: 0, y: 0 }, // Top-down
} as const;

export const VISION = {
    CONE_ANGLE: 90, // Degrees
    CONE_RANGE: 400, // Pixels
    RAY_COUNT: 100, // Resolution of shadows
    FOG_ALPHA: 0.65, // 65% darkness for obstacles/background
    FOG_COLOR: 0x000000,
    SOFT_SHADOWS: true,
} as const;

export const WEAPON = {
  DEFAULT_RECOIL_DURATION: 50, // ms
  DEFAULT_RELOAD_TIME: 2000, // ms
} as const;

export const WEAPON_DEFS = {
    PISTOL: {
        name: 'M1911',
        damage: 25,
        fireRate: 400, // ms
        magSize: 8,
        reloadTime: 1500, // ms
        minRange: 150, // Close range penalty starts here
        range: 600, // Optimal range ends here
        spread: 2, // degrees
        recoil: 5, // pixels kickback
        bulletSpeed: 1600,
        critChance: 0.1, // 10% chance
        barrelLength: 30,
    },
    RIFLE: {
        name: 'AK-47',
        damage: 35,
        fireRate: 100,
        magSize: 30,
        reloadTime: 2500,
        minRange: 250, // Harder to use very close
        range: 900, // Better range
        spread: 5,
        recoil: 3,
        bulletSpeed: 2200, // Faster bullets
        critChance: 0.05, // Lower crit chance due to spray
        barrelLength: 45,
    }
} as const;

export const UI = {
  COLORS: {
    HEALTH: 0xd9534f, // Phaser Hex Red
    STAMINA: 0x5cb85c, // Phaser Hex Green
    AMMO: 0xf0ad4e,    // Phaser Hex Orange
    TEXT_MAIN: '#ffffff',
    TEXT_MUTED: '#888888',
  },
  FONTS: {
    MAIN: 'monospace',
  }
} as const;

export const DEBUG = {
  SHOW_COLLIDERS: (import.meta as any).env?.DEV ?? false,
  SHOW_PATHFINDING: false,
} as const;