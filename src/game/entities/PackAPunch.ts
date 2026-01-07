import Phaser from 'phaser';
import { Player } from './Player';
import { IInteractable } from '../interfaces/IInteractable';
import { EventBus } from '../EventBus';

export class PackAPunch extends Phaser.Physics.Arcade.Sprite implements IInteractable {
    private cost: number = 5000;
    private label: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'pack_a_punch'); // Need texture
        
        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Visuals
        this.setTint(0x9900ff); // Purple
        this.setDepth(10);
        this.setScale(1.2);

        // Floating Label
        this.label = scene.add.text(x, y - 40, 'Pack-a-Punch', {
            fontSize: '14px',
            color: '#cc99ff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5);
    }

    canInteract(player: Player): boolean {
        // Can only interact if holding a weapon that is NOT already upgraded?
        // Since we don't have isUpgraded flag on generic weapon stats yet, 
        // we'll assume we can always upgradde for now, or check generic name.
        const weapon = player.weaponSystem.getActiveWeaponStats();
        if (!weapon) return false;
        
        return !weapon.name.includes('(PaP)');
    }

    interact(player: Player, delta: number): void {
        const currentPoints = player.points;
        if (currentPoints >= this.cost) {
            if (player.spendPoints(this.cost)) {
                const weapon = player.weaponSystem.getActiveWeaponStats();
                if (weapon) {
                    player.weaponSystem.upgradeCurrentWeapon();
                    EventBus.emit('show-notification', `Upgraded ${weapon.name}!`);
                }
            }
        } else {
             EventBus.emit('show-notification', `Need ${this.cost} points!`);
        }
    }

    getInteractionPrompt(player: Player): string {
        return `Press F to Pack-a-Punch [${this.cost}]`;
    }
}
