import Phaser from 'phaser';
import { Player } from './Player';
import { PowerUpType } from '../types/PerkTypes';
import { POWERUP } from '../../config/constants';
import { EventBus } from '../EventBus';

export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    private powerUpType: PowerUpType;
    private duration: number = POWERUP.DURATION;
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, type: PowerUpType) {
        super(scene, x, y, 'powerup_base'); // Needs texture logic
        this.powerUpType = type;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDepth(20);
        this.setScale(1);
        
        // Color Code
        this.setTint(this.getColor(type));

        // Floating Animation
        scene.tweens.add({
            targets: this,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Rotation
        scene.tweens.add({
            targets: this,
            angle: 360,
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
        });

        // Expiration Logic
        // 1. Total duration 20s
        // 2. Start blinking at 15s (5s remaining)
        // 3. Destroy at 20s
        
        const LIFETIME = 20000;
        const BLINK_START = 15000;
        
        // Blink Trigger
        scene.time.delayedCall(BLINK_START, () => {
             if (!this.active) return;
             // Blinking Tween
             scene.tweens.add({
                 targets: [this, this.label],
                 alpha: 0.2, // Fade out significantly
                 duration: 200,
                 yoyo: true,
                 repeat: -1
             });
        });
        
        // Disable/Destroy Trigger
        scene.time.delayedCall(LIFETIME, () => {
             if (this.active) {
                 // Disappear Effect (Shrink)
                 scene.tweens.add({
                     targets: [this, this.label],
                     scale: 0,
                     alpha: 0,
                     duration: 500,
                     onComplete: () => this.destroy()
                 });
             }
        });

        // Add Label
        this.label = scene.add.text(x, y - 20, this.getLabelText(type), {
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.label.setOrigin(0.5);
        this.label.setDepth(21);
    }
    
    // Removed duplicate getLabelText

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (this.label) {
            this.label.setPosition(this.x, this.y - 25);
            this.label.setAlpha(this.alpha); // Fade out with sprite
        }
        
        // Timer Logic
        // We use Scene Timer for destruction, but we can check elapsed for visual effects manually 
        // OR rely on a separate timer callback for the blink start.
        // Let's use the delayedCall we already have, but optimize it.
    }
    
    destroy(fromScene?: boolean) {
        if (this.label) this.label.destroy();
        super.destroy(fromScene);
    }

    private getColor(type: PowerUpType): number {
        switch (type) {
            case PowerUpType.MAX_AMMO: return 0x00ff00; // Green
            case PowerUpType.NUKE: return 0xffff00; // Yellow
            case PowerUpType.INSTA_KILL: return 0xff0000; // Red
            case PowerUpType.DOUBLE_POINTS: return 0x0000ff; // Blue
            case PowerUpType.CARPENTER: return 0x808080; // Gray
            case PowerUpType.FIRE_SALE: return 0xffaaaa; // Light Red/Pink
            default: return 0xffffff;
        }
    }
    
    private getLabelText(type: PowerUpType): string {
        switch(type) {
            case PowerUpType.MAX_AMMO: return "MAX AMMO";
            case PowerUpType.NUKE: return "NUKE";
            case PowerUpType.INSTA_KILL: return "INSTA-KILL";
            case PowerUpType.DOUBLE_POINTS: return "DOUBLE POINTS";
            case PowerUpType.CARPENTER: return "CARPENTER";
            case PowerUpType.FIRE_SALE: return "FIRE SALE";
            default: return "";
        }
    }

    public collect(player: Player) {
        // Global Effect
        switch (this.powerUpType) {
            case PowerUpType.NUKE:
                EventBus.emit('trigger-nuke');
                break;
            case PowerUpType.CARPENTER:
                EventBus.emit('trigger-carpenter');
                break;
            case PowerUpType.FIRE_SALE:
                EventBus.emit('trigger-firesale');
                // Give visual timer to player as well
                player.activatePowerUp(PowerUpType.FIRE_SALE, 60000);
                break;
            default:
                // Timed Logic
                player.activatePowerUp(this.powerUpType, this.duration);
                break;
        }

         EventBus.emit('show-notification', `Pick up ${this.getLabelText(this.powerUpType)}!`);
         
         // Collect Effect (Pop)
         this.scene.tweens.add({
             targets: [this, this.label],
             scale: 1.5,
             alpha: 0,
             duration: 200,
             onComplete: () => {
                 this.destroy();
             }
         });
    }
}
