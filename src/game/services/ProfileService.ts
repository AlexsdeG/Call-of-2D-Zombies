import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { Profile, ProfileSchema, DEFAULT_PROFILE } from '../../schemas/profileSchema';
import { EventBus } from '../EventBus';
import { ATTACHMENTS, ATTACHMENT_SLOTS, AttachmentDef } from '../../config/attachmentDefs';

const PROFILE_KEY = 'cod2d_profile_v1';

// XP Table: Level N requires XP
// Level 1: 0, Level 2: 500, Level 3: 1200...
// Simple formula: Level^2 * 500
const getXpForLevel = (level: number) => {
    return Math.pow(level, 2) * 500;
};

export class ProfileService {
    private static currentProfile: Profile | null = null;
    private static autoSaveTimer: ReturnType<typeof setInterval> | null = null;

    static async init() {
        console.log('ProfileService: Initializing...');
        await this.loadProfile();
        
        // Start Auto-Save loop based on settings
        this.startAutoSave();
    }

    static getProfile(): Profile {
        if (!this.currentProfile) {
            return { ...DEFAULT_PROFILE, id: uuidv4(), createdAt: Date.now() }; // Fallback
        }
        return this.currentProfile;
    }

    static async createProfile(name: string): Promise<Profile> {
        const newProfile: Profile = {
            ...DEFAULT_PROFILE,
            id: uuidv4(),
            name: name,
            createdAt: Date.now(),
            lastPlayed: Date.now(),
        };
        
        this.currentProfile = newProfile;
        await this.saveProfile();
        return newProfile;
    }

    static async saveProfile() {
        if (!this.currentProfile) return;
        
        try {
            this.currentProfile.lastPlayed = Date.now();
            await localforage.setItem(PROFILE_KEY, this.currentProfile);
            console.log('ProfileService: Role Saved');
            EventBus.emit('profile-saved');
        } catch (err) {
            console.error('ProfileService: Save Failed', err);
        }
    }

    static async loadProfile(): Promise<Profile> {
        try {
            const data = await localforage.getItem(PROFILE_KEY);
            if (data) {
                // Validate schema
                const parsed = ProfileSchema.safeParse(data);
                if (parsed.success) {
                    this.currentProfile = parsed.data;
                    console.log(`ProfileService: Loaded Profile '${this.currentProfile.name}' (Lvl ${this.currentProfile.level})`);
                } else {
                    console.warn('ProfileService: Corrupt Profile Data', parsed.error);
                    // Backup corrupt data?
                    // For now, create new
                    console.log('ProfileService: Creating Default Profile');
                    this.currentProfile = await this.createProfile('Survivor');
                }
            } else {
                 console.log('ProfileService: No Profile Found. Creating Default.');
                 this.currentProfile = await this.createProfile('Survivor');
            }
        } catch (err) {
            console.error('ProfileService: Load Failed', err);
            this.currentProfile = await this.createProfile('Survivor');
        }
        
        EventBus.emit('profile-loaded', this.currentProfile);
        return this.currentProfile!;
    }
    
    // --- EXPORT / IMPORT ---
    
    static async exportProfile() {
        if (!this.currentProfile) return;
        
        const dataStr = JSON.stringify(this.currentProfile, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cod2d_profile_${this.currentProfile.name}_lvl${this.currentProfile.level}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    static async importProfile(file: File): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target?.result as string);
                    const parsed = ProfileSchema.safeParse(json);
                    
                    if (parsed.success) {
                        this.currentProfile = parsed.data;
                        await this.saveProfile();
                        EventBus.emit('profile-loaded', this.currentProfile); // Refresh UI
                        resolve(true);
                    } else {
                        console.error("Profile Import: Invalid Schema", parsed.error);
                        reject("Invalid Profile File");
                    }
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }

    // --- UPDATE PROFILE (Name, Avatar) ---
    
    static async updateProfile(updates: Partial<Profile>) {
        if (!this.currentProfile) return;
        
        // Merge updates
        this.currentProfile = { ...this.currentProfile, ...updates };
        
        // Save
        await this.saveProfile();
        
        // Notify UI
        EventBus.emit('profile-loaded', this.currentProfile);
    }

    // --- GAMEPLAY UPDATES ---

    static updateStats(sessionStats: { kills: number, rounds: number, headshots: number, timePlayed: number }) {
        if (!this.currentProfile) return null; // Update return type

        const p = this.currentProfile;
        
        // Update Globals
        p.stats.totalKills += sessionStats.kills;
        p.stats.gamesPlayed += 1;
        p.stats.totalPlayTime += sessionStats.timePlayed;
        if (sessionStats.rounds > p.stats.highestRound) {
            p.stats.highestRound = sessionStats.rounds;
        }

        // XP Logic (Simple: 10xp per kill, 100 per round)
        const xpGained = (sessionStats.kills * 10) + (sessionStats.rounds * 100);
        const levelInfo = this.addXp(xpGained);
        
        this.saveProfile();
        
        return {
            xpGained,
            ...levelInfo,
            ...sessionStats
        };
    }
    
    static addXp(amount: number) {
        if (!this.currentProfile) return { oldLevel: 1, newLevel: 1, levelUp: false };
        
        const oldLevel = this.currentProfile.level;
        this.currentProfile.xp += amount;
        
        // Check Level Up
        let nextLevelXp = getXpForLevel(this.currentProfile.level);
        while (this.currentProfile.xp >= nextLevelXp) {
            this.currentProfile.level++;
            nextLevelXp = getXpForLevel(this.currentProfile.level); 
        }
        
        return {
            oldLevel,
            newLevel: this.currentProfile.level,
            levelUp: this.currentProfile.level > oldLevel
        };
    }
    
    // --- AUTOSAVE ---
    
    private static startAutoSave() {
        if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
        
        const interval = (this.currentProfile?.settings.autoSaveInterval || 60) * 1000;
        
        this.autoSaveTimer = setInterval(() => {
            this.saveProfile();
        }, interval);
    }
}
