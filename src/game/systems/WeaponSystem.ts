import Phaser from 'phaser';
import { WeaponAttributes, WeaponState } from '../types/WeaponTypes';
import { EventBus } from '../EventBus';
import { WEAPON_DEFS } from '../../config/constants';
import { SoundManager } from './SoundManager';
import { Projectile } from '../entities/Projectile';

interface WeaponEntry {
    key: keyof typeof WEAPON_DEFS;
    attributes: WeaponAttributes;
    state: WeaponState;
}

export class WeaponSystem {
    private scene: Phaser.Scene;
    private owner: Phaser.Physics.Arcade.Sprite; 
    
    // Inventory
    private inventory: (WeaponEntry | null)[] = [null, null, null]; // Slot 0, 1, 2
    private activeSlot: number = 0;

    // Visuals
    private recoilOffset: number = 0;
    private swayOffset: number = 0;
    
    // Components
    private bulletGroup: Phaser.Physics.Arcade.Group;
    private muzzleFlash: Phaser.GameObjects.Sprite;
    
    // Environment
    private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private checkLine: Phaser.Geom.Line = new Phaser.Geom.Line(); 

    constructor(scene: Phaser.Scene, owner: Phaser.Physics.Arcade.Sprite, bulletGroup: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.owner = owner;
        this.bulletGroup = bulletGroup;
        
        // Initialize Muzzle Flash
        this.muzzleFlash = this.scene.add.sprite(0, 0, 'muzzleflash');
        this.muzzleFlash.setVisible(false);
        this.muzzleFlash.setDepth(15);
        this.muzzleFlash.setOrigin(0, 0.5);
        this.muzzleFlash.setScale(0.5);
    }
    
    public initDefault(weaponKey: keyof typeof WEAPON_DEFS) {
        // Default pistol goes to Slot 3 (Index 2)
        this.equip(weaponKey, 2); 
    }

    public equip(weaponKey: keyof typeof WEAPON_DEFS, forcedSlot?: number) {
        const def = WEAPON_DEFS[weaponKey];
        if (!def) {
             console.warn(`Weapon key ${weaponKey} not found.`);
             return;
        }

        const newEntry: WeaponEntry = {
            key: weaponKey,
            attributes: { ...def },
            state: {
                currentAmmo: def.magSize,
                totalAmmo: def.magSize * 4,
                lastFired: 0,
                isReloading: false,
                reloadStartTime: 0
            }
        };

        let targetSlot = -1;

        // 1. Forced Slot (e.g. init)
        if (forcedSlot !== undefined) {
             targetSlot = forcedSlot;
        } 
        else {
            // 2. Auto-Logic
            // Rule: Slot 3 (Index 2) is SMALL only.
            // Rule: Slot 1 & 2 (Index 0 & 1) are ANY.
            
            // 2a. Check if we already have it? (Simpler: Just Ammo refill? - Skipping for now as requested "equip")
            
            // 2b. Try to fill EMPTY slot first
            if (def.type === 'SMALL' && this.inventory[2] === null) targetSlot = 2; // Pref small slot
            else if (this.inventory[0] === null) targetSlot = 0;
            else if (this.inventory[1] === null) targetSlot = 1;
            
            // 2c. If no empty, replace ACTIVE if valid
            if (targetSlot === -1) {
                 const current = this.inventory[this.activeSlot];
                 
                 // Can we put it here?
                 // If active is Slot 3 (2), and new is LARGE, we CANNOT.
                 // Otherwise we can.
                 if (this.activeSlot === 2 && def.type === 'LARGE') {
                     // Fallback: Swap with Slot 1 (0) 
                     targetSlot = 0;
                 } else {
                     targetSlot = this.activeSlot;
                 }
            }
        }
        
        // Equip
        this.inventory[targetSlot] = newEntry;
        
        // Switch to it immediately
        this.switchWeapon(targetSlot);
        
        // UI Feedback
        EventBus.emit('weapon-switch', def.name);
    }

    public switchWeapon(slotIndex: number) {
        if (slotIndex < 0 || slotIndex > 2) return;
        
        const entry = this.inventory[slotIndex];
        if (!entry) return; // Cannot switch to empty hand
        
        // Cancel reload of previous if any?
        const prev = this.getActiveEntry();
        if (prev && prev.state.isReloading) {
            prev.state.isReloading = false; // Cancel reload
        }

        this.activeSlot = slotIndex;
        
        // Play Swap Sound?
        // SoundManager.play(this.scene, 'draw');
        
        // UI Feedback
        EventBus.emit('weapon-switch', entry.attributes.name);
        this.emitStats();
    }
    
    public cycleWeapon(delta: number) {
        // delta > 0 (Up) -> Next, delta < 0 (Down) -> Prev
        const direction = delta > 0 ? 1 : -1;
        
        // Find next non-null slot
        let nextSlot = this.activeSlot;
        let attempts = 0;
        
        do {
            nextSlot = (nextSlot + direction + 3) % 3; // +3 handles negative mod
            attempts++;
        } while (this.inventory[nextSlot] === null && attempts < 3);
        
        if (nextSlot !== this.activeSlot && this.inventory[nextSlot] !== null) {
            this.switchWeapon(nextSlot);
        }
    }

    private getActiveEntry(): WeaponEntry | null {
        return this.inventory[this.activeSlot];
    }
    
    public getActiveWeaponStats(): WeaponAttributes | null {
        return this.getActiveEntry()?.attributes || null;
    }

    public hasWeapon(key: string): boolean {
        return this.inventory.some(entry => entry && entry.key === key);
    }

    public refillAmmo(key: string) {
        const entry = this.inventory.find(e => e && e.key === key);
        if (entry) {
            entry.state.currentAmmo = entry.attributes.magSize;
            entry.state.totalAmmo = entry.attributes.magSize * 4; // Max Reserve
            entry.state.isReloading = false;
            this.emitStats();
        }
    }
    
    public setWalls(wallLayer: Phaser.Tilemaps.TilemapLayer) {
        this.wallLayer = wallLayer;
    }

    public update(time: number, delta: number) {
        const entry = this.getActiveEntry();
        if(!entry) return;

        // 1. Handle Reload
        if (entry.state.isReloading) {
            if (time >= entry.state.reloadStartTime + entry.attributes.reloadTime) {
                this.finishReload(entry);
            }
        }

        // 2. Recover Recoil
        if (this.recoilOffset > 0) {
            this.recoilOffset = Phaser.Math.Linear(this.recoilOffset, 0, 0.1);
        }

        // 3. Calculate Sway
        const isMoving = this.owner.body?.velocity.length() ?? 0 > 0;
        const swaySpeed = isMoving ? 0.01 : 0.002;
        const swayAmount = isMoving ? 0.1 : 0.02; 
        this.swayOffset = Math.sin(time * swaySpeed) * swayAmount;

        // 4. Update Muzzle Flash Position
        const gunLength = entry.attributes.barrelLength - this.recoilOffset;
        const flashX = this.owner.x + Math.cos(this.owner.rotation) * gunLength;
        const flashY = this.owner.y + Math.sin(this.owner.rotation) * gunLength;
        
        this.muzzleFlash.setPosition(flashX, flashY);
        this.muzzleFlash.setRotation(this.owner.rotation);
    }

    public trigger(time: number) {
        const entry = this.getActiveEntry();
        if(!entry) return;

        if (entry.state.isReloading) return;
        
        if (time < entry.state.lastFired + entry.attributes.fireRate) return;

        if (entry.state.currentAmmo <= 0) {
            SoundManager.play(this.scene, 'click', { volume: 0.5 }); 
            if (entry.state.totalAmmo > 0) this.reload(time);
            return;
        }

        this.fire(time, entry);
    }

    public reload(time: number) {
        const entry = this.getActiveEntry();
        if (!entry) return;

        if (entry.state.isReloading || entry.state.currentAmmo === entry.attributes.magSize) return;
        if (entry.state.totalAmmo <= 0) return;

        entry.state.isReloading = true;
        entry.state.reloadStartTime = time;
        
        // Dynamic sound based on category?
        let sound = 'weapon_pistol_reload';
        if (entry.attributes.category === 'RIFLE') sound = 'weapon_rifle_reload';
        // Add more...
        
        SoundManager.play(this.scene, sound, { volume: 0.6 });
        this.emitStats();
    }

    private finishReload(entry: WeaponEntry) {
        const needed = entry.attributes.magSize - entry.state.currentAmmo;
        const toTake = Math.min(needed, entry.state.totalAmmo);
        
        entry.state.currentAmmo += toTake;
        entry.state.totalAmmo -= toTake;
        entry.state.isReloading = false;
        
        this.emitStats();
    }

    private fire(time: number, entry: WeaponEntry) {
        entry.state.currentAmmo--;
        entry.state.lastFired = time;

        let sound = 'weapon_pistol_fire';
        if (entry.attributes.category === 'RIFLE') sound = 'weapon_rifle_fire';
         // Add more...
        SoundManager.play(this.scene, sound, { volume: 0.8 });

        // Recoil
        this.recoilOffset = entry.attributes.recoil;
        this.scene.cameras.main.shake(50, 0.002);

        // Muzzle Flash
        this.muzzleFlash.setVisible(true);
        this.muzzleFlash.setAlpha(1);
        this.muzzleFlash.setFlipY(Math.random() > 0.5);
        this.scene.time.delayedCall(50, () => {
            this.muzzleFlash.setVisible(false);
        });

        // Ballistics Loop
        const count = entry.attributes.bulletCount || 1;
        
        // Reuse physics checks
        const baseAngle = this.owner.rotation;
        
        for (let i = 0; i < count; i++) {
             const spreadRad = Phaser.Math.DegToRad((Math.random() - 0.5) * entry.attributes.spread);
             const finalAngle = baseAngle + this.swayOffset + spreadRad;
             
             let gunTipX = this.owner.x + Math.cos(baseAngle) * entry.attributes.barrelLength;
             let gunTipY = this.owner.y + Math.sin(baseAngle) * entry.attributes.barrelLength;

             // Wall check (simplified)
              if (this.wallLayer) {
                const tile = this.wallLayer.getTileAtWorldXY(gunTipX, gunTipY);
                if (tile && (tile.canCollide || tile.index > 0)) {
                    gunTipX = this.owner.x;
                    gunTipY = this.owner.y;
                }
             }

             const bullet = this.bulletGroup.get(gunTipX, gunTipY) as Projectile;
             if (bullet) {
                bullet.fire(gunTipX, gunTipY, finalAngle, entry.attributes.bulletSpeed, entry.attributes, this.wallLayer);
             }
        }

        this.emitStats();
    }

    public emitStats() {
        const entry = this.getActiveEntry();
        if (!entry) {
             EventBus.emit('weapon-update', {
                ammo: 0, maxAmmo: 0, isReloading: false
             });
             return;
        }
        
        EventBus.emit('weapon-update', {
            ammo: entry.state.currentAmmo,
            maxAmmo: entry.state.totalAmmo,
            isReloading: entry.state.isReloading
        });
    }
}