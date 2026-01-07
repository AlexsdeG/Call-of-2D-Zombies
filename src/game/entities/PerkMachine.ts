import Phaser from 'phaser';
import { Player } from './Player';
import { IInteractable } from '../interfaces/IInteractable';
import { PerkType } from '../types/PerkTypes';
import { PERK } from '../../config/constants';
import { EventBus } from '../EventBus';

export class PerkMachine extends Phaser.Physics.Arcade.Sprite implements IInteractable {
    private perkType: PerkType;
    private cost: number;
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number, perkType: PerkType) {
        // Map perk type to texture/color in BootScene later. For now use a tinted box or placeholder.
        super(scene, x, y, 'perk_machine_base'); 
        
        this.perkType = perkType;
        this.cost = this.getCost(perkType);

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // Static body

        // Visuals
        this.setTint(this.getColor(perkType));
        this.setDepth(10);
        this.setScale(1.2);

        // Floating Label
        this.label = scene.add.text(x, y - 40, this.getPerkName(perkType), {
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
    }

    private getCost(type: PerkType): number {
        switch (type) {
            case PerkType.JUGGERNOG: return PERK.JUGGERNOG_COST;
            case PerkType.SPEED_COLA: return PERK.SPEED_COLA_COST;
            case PerkType.DOUBLE_TAP: return PERK.DOUBLE_TAP_COST;
            case PerkType.STAMIN_UP: return PERK.STAMIN_UP_COST;
            default: return 0;
        }
    }

    private getColor(type: PerkType): number {
        switch (type) {
            case PerkType.JUGGERNOG: return 0xff0000; // Red
            case PerkType.SPEED_COLA: return 0x00ff00; // Green
            case PerkType.DOUBLE_TAP: return 0xffaa00; // Orange
            case PerkType.STAMIN_UP: return 0xffff00; // Yellow
            default: return 0xffffff;
        }
    }

    private getPerkName(type: PerkType): string {
        switch (type) {
            case PerkType.JUGGERNOG: return 'Juggernog';
            case PerkType.SPEED_COLA: return 'Speed Cola';
            case PerkType.DOUBLE_TAP: return 'Double Tap';
            case PerkType.STAMIN_UP: return 'Stamin-Up';
            default: return 'Perk';
        }
    }

    // IInteractable Implementation
    canInteract(player: Player): boolean {
        // Cannot buy if already has it
        return !player.hasPerk(this.perkType);
    }

    interact(player: Player, delta: number): void {
        const currentPoints = player.points;
        if (currentPoints >= this.cost) {
            if (player.spendPoints(this.cost)) {
                player.addPerk(this.perkType);
                EventBus.emit('show-notification', `Bought ${this.getPerkName(this.perkType)}!`);
            }
        } else {
             EventBus.emit('show-notification', `Need ${this.cost} points!`);
        }
    }

    getInteractionPrompt(player: Player): string {
        if (player.hasPerk(this.perkType)) {
            return ''; // Should filter out in canInteract, but safety
        }
        return `Press F to buy ${this.getPerkName(this.perkType)} [${this.cost}]`;
    }
}
