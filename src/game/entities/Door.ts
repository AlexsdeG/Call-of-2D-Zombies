import Phaser from 'phaser';
import { IInteractable } from '../interfaces/IInteractable';
import { Player } from './Player';
import { useGameStore } from '../../store/useGameStore';
import { PathfindingManager } from '../systems/PathfindingManager';
import { EventBus } from '../EventBus';

export class Door extends Phaser.Physics.Arcade.Sprite implements IInteractable {
    private cost: number;
    private zoneToActivate: number;
    private pathfindingManager: PathfindingManager;

    constructor(scene: Phaser.Scene, x: number, y: number, cost: number, zoneToActivate: number, pathfindingManager: PathfindingManager) {
        super(scene, x, y, 'door');
        this.cost = cost;
        this.zoneToActivate = zoneToActivate;
        this.pathfindingManager = pathfindingManager;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // Static body
        this.setImmovable(true);
    }

    interact(player: Player): void {
        if (!player.isInteractJustDown()) return;
        
        const currentPoints = useGameStore.getState().playerStats.points;
        
        if (currentPoints >= this.cost) {
            // Deduct Points
            useGameStore.getState().updatePlayerStats({ points: currentPoints - this.cost });
            
            // Open Door
            this.open();
        } else {
            // TODO: Play "Deny" sound
        }
    }

    private open() {
        this.disableBody(true, true);
        this.pathfindingManager.setTileWalkable(this.x, this.y, true);
        
        // Emit activation event for Spawners
        if (this.zoneToActivate !== -1) {
            EventBus.emit('activate-zone', this.zoneToActivate);
            // console.log(`Door opened. Activating Zone ${this.zoneToActivate}`);
        }

        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.destroy();
            }
        });
    }

    getInteractionPrompt(): string {
        return `Press F to Open [${this.cost}]`;
    }

    canInteract(player: Player): boolean {
        return this.active && this.visible;
    }
}