export type AttachmentType = 'SCOPE' | 'MUZZLE' | 'GRIP' | 'MAGAZINE';

export interface AttachmentStats {
    damageMult?: number;
    rangeMult?: number;
    spreadMult?: number;
    recoilMult?: number;
    fireRateMult?: number;
    magSizeMult?: number;
    reloadTimeMult?: number;
    speedMult?: number; // Movement speed
}

export interface AttachmentDef {
    id: string;
    name: string;
    type: AttachmentType;
    description: string;
    stats: AttachmentStats;
    cost: number; // Unlock cost (XP or Points, logic TBD)
    icon?: string; // Asset key
}

export const ATTACHMENTS: Record<string, AttachmentDef> = {
    // --- SCOPES ---
    'red_dot': {
        id: 'red_dot',
        name: 'Red Dot Sight',
        type: 'SCOPE',
        description: 'Precision sight. Improves accuracy.',
        stats: { spreadMult: 0.8 },
        cost: 500
    },
    'holo': {
        id: 'holo',
        name: 'Holographic Sight',
        type: 'SCOPE',
        description: 'Better target acquisition.',
        stats: { spreadMult: 0.85, rangeMult: 1.1 },
        cost: 750
    },
    'sniper_scope': {
        id: 'sniper_scope',
        name: 'Sniper Scope',
        type: 'SCOPE',
        description: 'High magnification for long range.',
        stats: { spreadMult: 0.1, rangeMult: 2.0, speedMult: 0.9 },
        cost: 1500
    },

    // --- MUZZLES ---
    'suppressor': {
        id: 'suppressor',
        name: 'Suppressor',
        type: 'MUZZLE',
        description: 'Reduces noise and muzzle flash. Slightly reduces range.',
        stats: { rangeMult: 0.9, recoilMult: 0.9 },
        cost: 1000
    },
    'compensator': {
        id: 'compensator',
        name: 'Compensator',
        type: 'MUZZLE',
        description: 'Reduces vertical recoil.',
        stats: { recoilMult: 0.8, spreadMult: 0.95 },
        cost: 800
    },
    'long_barrel': {
        id: 'long_barrel',
        name: 'Long Barrel',
        type: 'MUZZLE',
        description: 'Increases range and bullet velocity.',
        stats: { rangeMult: 1.25, damageMult: 1.05 },
        cost: 1200
    },

    // --- GRIPS ---
    'foregrip': {
        id: 'foregrip',
        name: 'Vertical Foregrip',
        type: 'GRIP',
        description: 'Reduces recoil.',
        stats: { recoilMult: 0.75 },
        cost: 600
    },
    'angled_grip': {
        id: 'angled_grip',
        name: 'Angled Grip',
        type: 'GRIP',
        description: 'Improves handling and aim speed.',
        stats: { spreadMult: 0.85, reloadTimeMult: 0.95 },
        cost: 600
    },

    // --- MAGAZINES ---
    'ext_mag': {
        id: 'ext_mag',
        name: 'Extended Mag',
        type: 'MAGAZINE',
        description: 'Increased ammo capacity.',
        stats: { magSizeMult: 1.5, reloadTimeMult: 1.1 },
        cost: 900
    },
    'fast_mag': {
        id: 'fast_mag',
        name: 'Fast Mag',
        type: 'MAGAZINE',
        description: 'Faster reloads.',
        stats: { reloadTimeMult: 0.6 },
        cost: 900
    },
};

export const ATTACHMENT_SLOTS: AttachmentType[] = ['SCOPE', 'MUZZLE', 'GRIP', 'MAGAZINE'];
