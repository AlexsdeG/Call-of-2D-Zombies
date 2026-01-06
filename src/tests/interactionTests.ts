import { GameTest, TestRunner } from './testRunner';
import Phaser from 'phaser';
import { Player } from '../game/entities/Player';
import { Door } from '../game/entities/Door';
import { Barricade } from '../game/entities/Barricade';
import { useGameStore } from '../store/useGameStore';
import { PathfindingManager } from '../game/systems/PathfindingManager';

const DoorPurchaseTest: GameTest = {
    name: 'Door Purchase Logic',
    run: async (scene: Phaser.Scene) => {
        // Setup
        const pf = new PathfindingManager(scene);
        // Arguments: scene, x, y, cost, zone, pathfindingManager
        const door = new Door(scene, 0, 0, 500, -1, pf);
        const player = new Player(scene, 10, 10, scene.physics.add.group());
        
        // 1. Not enough points
        useGameStore.getState().updatePlayerStats({ points: 0 });
        door.interact(player);
        
        if (!door.active) {
            console.error("Door opened with 0 points");
            return false;
        }

        // 2. Enough points
        useGameStore.getState().updatePlayerStats({ points: 1000 });
        door.interact(player);

        if (door.body?.enable) {
            console.error("Door physics still enabled after purchase");
            return false;
        }

        if (useGameStore.getState().playerStats.points !== 500) {
            console.error("Points not deducted correctly");
            return false;
        }

        door.destroy();
        player.destroy();
        return true;
    }
};

const BarricadeRepairTest: GameTest = {
    name: 'Barricade Repair Logic',
    run: async (scene: Phaser.Scene) => {
        const bar = new Barricade(scene, 0, 0);
        const player = new Player(scene, 0, 0, scene.physics.add.group());

        // Barricade starts with 10 panels (Full)
        // Simulate damage: Remove 3 panels
        bar.removePanel();
        bar.removePanel();
        bar.removePanel();
        
        const panelsAfterDamage = (bar as any).panels;
        
        if (panelsAfterDamage !== 7) {
            console.error("Panel damage (removePanel) not applied correctly");
            return false;
        }

        // Repair
        // Repair logic requires `delta` accumulation. Default REPAIR_TIME_PER_PANEL is 900ms.
        // We simulate a long hold frame of 1000ms
        bar.interact(player, 1000);
        
        const panelsAfterRepair = (bar as any).panels;

        if (panelsAfterRepair <= 7) {
             console.error("Repair did not increase panels");
             return false;
        }

        bar.destroy();
        player.destroy();
        return true;
    }
};

TestRunner.register(DoorPurchaseTest);
TestRunner.register(BarricadeRepairTest);