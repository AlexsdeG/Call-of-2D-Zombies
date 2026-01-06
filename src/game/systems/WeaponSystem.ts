import Phaser from 'phaser';
import { WeaponAttributes, WeaponState } from '../types/WeaponTypes';
import { EventBus } from '../EventBus';
import { WEAPON_DEFS, PLAYER } from '../../config/constants';
import { SoundManager } from './SoundManager';
import { Projectile } from '../entities/Projectile';

export class WeaponSystem {
    private scene: Phaser.Scene;
    private owner: Phaser.Physics.Arcade.Sprite; 
    
    // Config & State
    private attributes: WeaponAttributes;
    private state: WeaponState;

    // Visuals
    private recoilOffset: number = 0;
    private swayOffset: number = 0;
    
    // Components
    private bulletGroup: Phaser.Physics.Arcade.Group;
    private muzzleFlash: Phaser.GameObjects.Sprite;
    
    // Environment
    private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    private checkLine: Phaser.Geom.Line = new Phaser.Geom.Line(); // Reuse for GC

    constructor(scene: Phaser.Scene, owner: Phaser.Physics.Arcade.Sprite, bulletGroup: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.owner = owner;
        this.bulletGroup = bulletGroup;
        
        // Default to Pistol
        this.attributes = { ...WEAPON_DEFS.PISTOL };
        this.state = {
            currentAmmo: this.attributes.magSize,
            totalAmmo: 100, 
            lastFired: 0,
            isReloading: false,
            reloadStartTime: 0
        };

        // Initialize Muzzle Flash
        this.muzzleFlash = this.scene.add.sprite(0, 0, 'muzzleflash');
        this.muzzleFlash.setVisible(false);
        this.muzzleFlash.setDepth(15); // Above player, below UI
        this.muzzleFlash.setOrigin(0, 0.5); // Pivot at left center so we can rotate it easily
        this.muzzleFlash.setScale(0.5);

        // Sync Initial UI State
        this.scene.time.delayedCall(100, () => this.emitStats());
    }
    
    public setWalls(wallLayer: Phaser.Tilemaps.TilemapLayer) {
        this.wallLayer = wallLayer;
    }

    public update(time: number, delta: number) {
        // 1. Handle Reload
        if (this.state.isReloading) {
            if (time >= this.state.reloadStartTime + this.attributes.reloadTime) {
                this.finishReload();
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
        const gunLength = this.attributes.barrelLength - this.recoilOffset;
        const flashX = this.owner.x + Math.cos(this.owner.rotation) * gunLength;
        const flashY = this.owner.y + Math.sin(this.owner.rotation) * gunLength;
        
        this.muzzleFlash.setPosition(flashX, flashY);
        this.muzzleFlash.setRotation(this.owner.rotation);
    }

    public trigger(time: number) {
        if (this.state.isReloading) return;
        
        if (time < this.state.lastFired + this.attributes.fireRate) return;

        if (this.state.currentAmmo <= 0) {
            SoundManager.play(this.scene, 'click', { volume: 0.5 }); 
            if (this.state.totalAmmo > 0) this.reload(time);
            return;
        }

        this.fire(time);
    }

    public reload(time: number) {
        if (this.state.isReloading || this.state.currentAmmo === this.attributes.magSize) return;
        if (this.state.totalAmmo <= 0) return;

        this.state.isReloading = true;
        this.state.reloadStartTime = time;
        
        SoundManager.play(this.scene, 'weapon_pistol_reload', { volume: 0.6 });
        this.emitStats();
    }

    private finishReload() {
        const needed = this.attributes.magSize - this.state.currentAmmo;
        const toTake = Math.min(needed, this.state.totalAmmo);
        
        this.state.currentAmmo += toTake;
        this.state.totalAmmo -= toTake;
        this.state.isReloading = false;
        
        this.emitStats();
    }

    private fire(time: number) {
        this.state.currentAmmo--;
        this.state.lastFired = time;

        SoundManager.play(this.scene, 'weapon_pistol_fire', { volume: 0.8 });

        // Recoil
        this.recoilOffset = this.attributes.recoil;
        this.scene.cameras.main.shake(50, 0.002);

        // Muzzle Flash Effect
        this.muzzleFlash.setVisible(true);
        this.muzzleFlash.setAlpha(1);
        this.muzzleFlash.setFlipY(Math.random() > 0.5);
        this.scene.time.delayedCall(50, () => {
            this.muzzleFlash.setVisible(false);
        });

        // Ballistics (Projectile)
        const baseAngle = this.owner.rotation;
        const spreadRad = Phaser.Math.DegToRad((Math.random() - 0.5) * this.attributes.spread);
        const finalAngle = baseAngle + this.swayOffset + spreadRad;

        // Calculate theoretical muzzle position
        let gunTipX = this.owner.x + Math.cos(baseAngle) * this.attributes.barrelLength;
        let gunTipY = this.owner.y + Math.sin(baseAngle) * this.attributes.barrelLength;

        // Check for Wall Intersection (Anti-Tunneling)
        // If the muzzle is inside a wall, we need to retract it to the collision point
        // or effectively spawn it just before the wall.
        if (this.wallLayer) {
            // Check if the gun tip is physically inside a wall tile
            const tile = this.wallLayer.getTileAtWorldXY(gunTipX, gunTipY);
            if (tile && (tile.canCollide || tile.index > 0)) {
                // Gun is inside wall. Raycast from Center to Tip to find impact.
                this.checkLine.setTo(this.owner.x, this.owner.y, gunTipX, gunTipY);
                const tiles = this.wallLayer.getTilesWithinShape(this.checkLine);
                
                // Find first collision
                for (const t of tiles) {
                    if (t.canCollide || t.index > 0) {
                        // Found wall. Set spawn point slightly back
                        // A rough approximation is centered on tile, but let's just 
                        // spawn it AT the player center but still give it velocity.
                        // Arcade physics will then handle collision on next frame.
                        // Or better: Spawn it at the edge. 
                        
                        // Simple robust fix: If muzzle in wall, spawn at player center.
                        // The Projectile CCD will then instantly hit the wall on the first frame update.
                        gunTipX = this.owner.x;
                        gunTipY = this.owner.y;
                        break;
                    }
                }
            }
        }

        const bullet = this.bulletGroup.get(gunTipX, gunTipY) as Projectile;
        
        if (bullet) {
            // Pass full attributes to projectile for damage calc on impact
            // Also pass wall layer for CCD
            bullet.fire(gunTipX, gunTipY, finalAngle, this.attributes.bulletSpeed, this.attributes, this.wallLayer);
        }

        this.emitStats();
    }

    public emitStats() {
        EventBus.emit('weapon-update', {
            ammo: this.state.currentAmmo,
            maxAmmo: this.state.totalAmmo,
            isReloading: this.state.isReloading
        });
    }

    public getActiveWeaponStats(): WeaponAttributes {
        return this.attributes;
    }
}