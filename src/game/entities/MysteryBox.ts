import * as Phaser from 'phaser';

import { IInteractable } from '../interfaces/IInteractable';
import { Player } from './Player';
import { WEAPON_DEFS } from '../../config/constants';
import { SoundManager } from '../systems/SoundManager';

export class MysteryBox extends Phaser.Physics.Arcade.Sprite implements IInteractable {
    private static allBoxes: MysteryBox[] = [];
    private static activeBoxIndex: number = -1;

    private isActiveBox: boolean = false;
    private isRolling: boolean = false;
    private isPresenting: boolean = false; // "Ready to pickup" state
    
    // Config
    private cost: number = 950;
    private isFirst: boolean = false; 
    
    // Roll Logic
    private rollEvent?: Phaser.Time.TimerEvent;
    private weaponSprite: Phaser.GameObjects.Sprite;
    private lidSprite: Phaser.GameObjects.Sprite;
    
    private selectedWeaponKey: string | null = null;
    
    // Timer for pickup
    private pickupTimer?: Phaser.Time.TimerEvent;

    constructor(scene: Phaser.Scene, x: number, y: number, rotationDeg: number = 0, isFirst: boolean = false) {
        super(scene, x, y, 'mysterybox');
        
        scene.add.existing(this);
        scene.physics.add.existing(this, true); 
        
        this.isFirst = isFirst;
        
        // Static tracking
        MysteryBox.allBoxes.push(this);

        // Rotation
        this.setAngle(rotationDeg);
        
        // Fix Physics Body Size for Rotation (90 or 270 degrees)
        // Note: setAngle/setRotation does NOT rotate the arcade body. We must swap dimensions.
        if (Math.abs(rotationDeg) % 180 === 90) {
             this.body!.setSize(this.height, this.width);
             // Center offset adjustment if needed, but usually default origin (0.5) handles it if square.
             // If not square, we might need offset. Assuming 32x32 for now so no change needed?
             // Actually MysteryBox sprite might be non-square? Default 'mysterybox' logic.
        }

        // Calculate offsets based on rotation for "Top" items (Lid/Weapon)
        // 0 deg: Top is y-10
        // 90 deg: Top is x+10
        // 180 deg: Top is y+10
        // 270 deg: Top is x-10
        
        // Calculate offsets based on rotation for "Top" direction (Hinge)
        // Adjusting for 90 degree rotation to ensuring hinge is on the correct side (Left)
        // If rotation is 90 (Facing Right), Top/Back is Left (-X).
        // If rotation is 0 (Facing Down), Top/Back is Up (-Y).
        
        // We will compute vectors explicitly
        const rad = Phaser.Math.DegToRad(rotationDeg);
        
        const lidOffset = new Phaser.Math.Vector2(0, -10).rotate(rad);
        const weaponOffset = new Phaser.Math.Vector2(0, -20).rotate(rad);
        
        // Lid
        this.lidSprite = scene.add.sprite(x + lidOffset.x, y + lidOffset.y, 'mysterybox_lid');
        this.lidSprite.setDepth(this.depth + 1);
        this.lidSprite.setAngle(rotationDeg);
        
        // Weapon Preview Sprite (Hidden initially)
        this.weaponSprite = scene.add.sprite(x + weaponOffset.x, y + weaponOffset.y, 'pixel'); 
        this.weaponSprite.setTexture('wallbuy_texture');
        this.weaponSprite.setVisible(false);
        this.weaponSprite.setDepth(this.depth + 100); 
        this.weaponSprite.setAngle(rotationDeg);
        
        // Init State
        this.isActiveBox = false;
        this.updateVisuals();
    }
    
    public static initSystem() {
        if (MysteryBox.allBoxes.length > 0) {
            // Check for Priority Box
            const firstIndex = MysteryBox.allBoxes.findIndex(b => b.isFirst);
            
            if (firstIndex !== -1) {
                 MysteryBox.setActiveBox(firstIndex);
            } else {
                 if (MysteryBox.activeBoxIndex === -1) {
                    MysteryBox.setActiveBox(Phaser.Math.Between(0, MysteryBox.allBoxes.length - 1));
                 } else {
                     MysteryBox.updateAllBoxes();
                 }
            }
        }
    }
    
    public static reset() {
        MysteryBox.allBoxes = [];
        MysteryBox.activeBoxIndex = -1;
    }

    private static setActiveBox(index: number) {
        MysteryBox.activeBoxIndex = index;
        MysteryBox.updateAllBoxes();
    }

    private static updateAllBoxes() {
        MysteryBox.allBoxes.forEach((box, index) => {
            box.setActivity(index === MysteryBox.activeBoxIndex);
        });
    }

    public setActivity(active: boolean) {
        this.isActiveBox = active;
        this.updateVisuals();
    }

    private updateVisuals() {
        if (this.isActiveBox) {
            this.setTint(0xffffff); // Normal
            this.lidSprite.setFrame(0); // If valid? Or just set Y
            // Reset position to closed state
            this.resetLidPosition();
        } else {
            this.setTint(0x555555); // Dark/Inactive
        }
    }
    
    private resetLidPosition() {
        const rad = Phaser.Math.DegToRad(this.angle);
        const closedOffset = new Phaser.Math.Vector2(0, -10).rotate(rad);
        this.lidSprite.setPosition(this.x + closedOffset.x, this.y + closedOffset.y);
    }

    public interact(player: Player, delta?: number) {
        if (!this.isActiveBox) return; // "Teddy bear moved"
        
        if (this.isRolling) return; // Busy
        
        if (this.isPresenting) {
            // PICK UP PHASE
            this.equipReward(player);
            return;
        }

        // BUY PHASE
        if (player.spendPoints(this.cost)) {
            this.startRoll(player);
        } else {
            SoundManager.play(this.scene, 'click', { volume: 0.5 });
        }
    }

    private startRoll(player: Player) {
        this.isRolling = true;
        
        // Calculate Open Position relative to rotation
        // "Open" means moving the lid further "up" (local Y) aka Backwards
        const rad = Phaser.Math.DegToRad(this.angle);
        const openOffset = new Phaser.Math.Vector2(0, -40).rotate(rad);
        
        // Open Lid
        this.scene.tweens.add({
            targets: this.lidSprite,
            x: this.x + openOffset.x,
            y: this.y + openOffset.y,
            duration: 500,
            ease: 'Back.out'
        });
        
        // Mock Roll Visualization: Flash generic sprite weapon
        this.weaponSprite.setVisible(true);
        this.weaponSprite.setAlpha(1);
        
        let switchCount = 0;
        const maxSwitches = 20; // 2 seconds approx
        
        this.rollEvent = this.scene.time.addEvent({
            delay: 100,
            repeat: maxSwitches,
            callback: () => {
                switchCount++;
                SoundManager.play(this.scene, 'click', { volume: 0.3, rate: 1.0 + (switchCount/10) });
                this.weaponSprite.setFlipX(!this.weaponSprite.flipX);
                
                if (switchCount >= maxSwitches) {
                    this.finishRoll(player);
                }
            }
        });
    }

    private finishRoll(player: Player) {
        this.isRolling = false;
        
        // Teddy Bear Check (If multiple boxes exist)
        if (MysteryBox.allBoxes.length > 1 && Math.random() < 0.2) {
             // MOVE BOX
             this.handleTeddyBear(player);
             return;
        }

        // Select Weapon
        const keys = Object.keys(WEAPON_DEFS) as (keyof typeof WEAPON_DEFS)[];
        const randomKey = Phaser.Utils.Array.GetRandom(keys);
        
        this.selectedWeaponKey = randomKey;
        const def = WEAPON_DEFS[randomKey];
        
        // Present
        this.isPresenting = true;
        
        // Set distinct visual for weapon
        this.weaponSprite.setTint(0x00ff00); // Green glow?
        
        // Slow Close Animation (Timer Visual)
        // Lid slowly closes over 5 seconds
        const rad = Phaser.Math.DegToRad(this.angle);
        const closedOffset = new Phaser.Math.Vector2(0, -10).rotate(rad);
        
        this.scene.tweens.add({
            targets: this.lidSprite,
            x: this.x + closedOffset.x,
            y: this.y + closedOffset.y,
            duration: 5000,
            ease: 'Linear'
        });

        // Start Pickup Timer (5s)
        this.pickupTimer = this.scene.time.delayedCall(5000, () => {
             this.resetToIdle();
        });
    }
    
    private isTeddyBear: boolean = false;

    private handleTeddyBear(player: Player) {
        // Visuals...
        this.weaponSprite.setTint(0xff0000); // Red
        SoundManager.play(this.scene, 'click'); // Replace with laugh?
        
        // Refund Cost
        player.addPoints(this.cost);
        
        this.isTeddyBear = true;
        
        this.scene.time.delayedCall(1000, () => {
            // Find new index
            let newIndex = MysteryBox.activeBoxIndex;
            while (newIndex === MysteryBox.activeBoxIndex) {
                newIndex = Phaser.Math.Between(0, MysteryBox.allBoxes.length - 1);
            }
            
            MysteryBox.setActiveBox(newIndex);
            this.resetToIdle();
        });
    }
    
    // ... equipReward ...
    private equipReward(player: Player) {
        if (this.selectedWeaponKey) {
            // Max Ammo Check
            if (player.weaponSystem.hasWeapon(this.selectedWeaponKey)) {
                player.weaponSystem.refillAmmo(this.selectedWeaponKey);
                SoundManager.play(this.scene, 'weapon_pickup'); 
            } else {
                player.equipWeapon(this.selectedWeaponKey);
                SoundManager.play(this.scene, 'weapon_pistol_reload'); 
            }
        }
        this.resetToIdle();
    }
    
    private resetToIdle() {
        this.isPresenting = false;
        this.isTeddyBear = false;
        this.selectedWeaponKey = null;
        this.weaponSprite.setVisible(false);
        this.weaponSprite.clearTint();
        
        // Close Lid (Return to base offset)
        const rad = Phaser.Math.DegToRad(this.angle);
        const closedOffset = new Phaser.Math.Vector2(0, -10).rotate(rad);

        this.scene.tweens.add({
            targets: this.lidSprite,
            x: this.x + closedOffset.x,
            y: this.y + closedOffset.y,
            duration: 500,
            ease: 'Bounce.out'
        });
        if (this.pickupTimer) this.pickupTimer.remove(false);
    }

    public getInteractionPrompt(player: Player): { text: string; enabled: boolean } | string {
        if (!this.isActiveBox) {
            // Technically shouldn't be called if not closest/canInteract, but for robust UI
            return { text: 'Box Moved', enabled: false };
        }
        
        if (this.isTeddyBear) {
             return { text: 'Teddy Bear', enabled: false };
        }
        
        if (this.isRolling) {
             return { text: 'Rolling...', enabled: false };
        }
        
        if (this.isPresenting && this.selectedWeaponKey) {
            const def = WEAPON_DEFS[this.selectedWeaponKey as keyof typeof WEAPON_DEFS];
            return { text: `Press F to take ${def.name}`, enabled: true };
        }
        
        const canAfford = player.points >= this.cost;
        return { 
            text: `Press F for Mystery Box [${this.cost}]`, 
            enabled: canAfford 
        };
    }

    public canInteract(player: Player): boolean {
        // Always "can interact" (be candidate for prompt) if active and not rolling
        // unless presenting (pickup)
        // Logic handles affordance check inside getInteractionPrompt (UI) and interact (Action)
        if (!this.isActiveBox) return false;
        if (this.isRolling) return false; // Hide prompt while rolling
        if (this.isTeddyBear) return false; // Hide prompt (or show disabled: user wanted disabled prompt?)
        // User said: "if teddy bear show teddy bear text prompt... use text prompt disabled"
        // So we MUST return true here to let Player.ts ask for prompt.
        if (this.isTeddyBear) return true;
        
        return true; 
    }
}
