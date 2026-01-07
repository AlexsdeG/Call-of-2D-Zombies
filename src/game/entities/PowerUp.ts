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

        // Expiration
        scene.time.delayedCall(30000, () => {
             if (this.active) {
                 this.destroy();
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
    
    private getLabelText(type: PowerUpType): string {
        switch(type) {
            case PowerUpType.MAX_AMMO: return "MAX AMMO";
            case PowerUpType.NUKE: return "NUKE";
            case PowerUpType.INSTA_KILL: return "INSTA-KILL";
            case PowerUpType.DOUBLE_POINTS: return "DOUBLE POINTS";
            case PowerUpType.CARPENTER: return "CARPENTER";
            default: return "";
        }
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (this.label) {
            this.label.setPosition(this.x, this.y - 25);
            this.label.setAlpha(this.alpha); // Fade out with sprite
        }
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
            default: return 0xffffff;
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
            default:
                // Timed Logic
                player.activatePowerUp(this.powerUpType, this.duration);
                break;
        }

         EventBus.emit('show-notification', `Pick up ${this.powerUpType}!`);
         this.destroy();
    }
}
