/**
 * Input Key Mappings
 * Maps logical actions to physical keys.
 */

export const CONTROLS = {
  // Movement
  MOVE_UP: 'W',
  MOVE_DOWN: 'S',
  MOVE_LEFT: 'A',
  MOVE_RIGHT: 'D',
  
  // Actions
  SPRINT: 'SHIFT',
  INTERACT: 'F',
  RELOAD: 'R',
  DROP_ITEM: 'G',
  
  // UI / Meta
  PAUSE: 'ESC',
  INVENTORY: 'TAB',
  SCOREBOARD: 'CAPS_LOCK',
  
  // Mouse (Handled via Pointer events, defined here for reference)
  FIRE: 'POINTER_LEFT',
  AIM: 'POINTER_RIGHT',
} as const;

export type ControlKey = keyof typeof CONTROLS;
