import { GameTest, TestRunner } from './testRunner';
import Phaser from 'phaser';
import { MapManager } from '../game/systems/MapManager';
import { DEBUG_MAP } from '../config/defaultMap';
import { MapData } from '../schemas/mapSchema';

const MapSchemaValidationTest: GameTest = {
    name: 'Map Schema Validation',
    run: async (scene: Phaser.Scene) => {
        const manager = new MapManager(scene);

        // 1. Valid Map
        const validResult = manager.validate(DEBUG_MAP);
        if (!validResult.success) {
            console.error("Valid map failed validation", validResult.error);
            return false;
        }

        // 2. Invalid Map (Missing width)
        const invalidMap = { ...DEBUG_MAP, width: undefined };
        const invalidResult = manager.validate(invalidMap);
        if (invalidResult.success) {
            console.error("Invalid map passed validation!");
            return false;
        }

        // 3. Invalid Tile Data (Negative integer)
        const badTileMap = JSON.parse(JSON.stringify(DEBUG_MAP));
        badTileMap.layers.walls[0][0] = -5;
        const badTileResult = manager.validate(badTileMap);
        if (badTileResult.success) {
            console.error("Negative tile ID passed validation!");
            return false;
        }

        return true;
    }
};

const MapGenerationTest: GameTest = {
    name: 'Map Tilemap Generation',
    run: async (scene: Phaser.Scene) => {
        const manager = new MapManager(scene);
        const layers = manager.createLevel(DEBUG_MAP);

        if (!layers.floor || !layers.walls) {
            console.error("MapManager did not return layers");
            return false;
        }

        if (layers.walls.layer.width !== DEBUG_MAP.width) {
             console.error(`Layer width mismatch. Expected ${DEBUG_MAP.width}, got ${layers.walls.layer.width}`);
             return false;
        }

        // Check if collision is set (Tile ID 1)
        // Phaser stores collision info in `layer.collideIndexes` usually, or checks specific tiles
        // We verify that setCollision was called by checking a known wall tile
        const tileAt00 = layers.walls.getTileAt(0, 0);
        if (tileAt00 && !tileAt00.collides) {
            console.error("Wall tile (0,0) does not have collision enabled.");
            return false;
        }

        return true;
    }
};

TestRunner.register(MapSchemaValidationTest);
TestRunner.register(MapGenerationTest);