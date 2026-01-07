import Phaser from 'phaser';
import { MapDataSchema, MapData } from '../../schemas/mapSchema';
import { WORLD } from '../../config/constants';
import { PathfindingManager } from './PathfindingManager';
import { Door } from '../entities/Door';
import { Barricade } from '../entities/Barricade';
import { Spawner } from '../entities/Spawner';
import { Player } from '../entities/Player';
import { WallBuy } from '../entities/WallBuy';
import { MysteryBox } from '../entities/MysteryBox';
import { PerkMachine } from '../entities/PerkMachine';
import { PackAPunch } from '../entities/PackAPunch';
import { PerkType } from '../types/PerkTypes';

export class MapManager {
    private scene: Phaser.Scene;
    private currentMap: MapData | null = null;
    private pathfindingManager?: PathfindingManager;
    
    // Phaser Tilemap components
    private map?: Phaser.Tilemaps.Tilemap;
    private tileset?: Phaser.Tilemaps.Tileset;
    private floorLayer?: Phaser.Tilemaps.TilemapLayer;
    private wallLayer?: Phaser.Tilemaps.TilemapLayer;

    constructor(scene: Phaser.Scene, pathfindingManager?: PathfindingManager) {
        this.scene = scene;
        this.pathfindingManager = pathfindingManager;
    }

    public validate(json: unknown): { success: boolean; data?: MapData; error?: any } {
        const result = MapDataSchema.safeParse(json);
        if (result.success) {
            return { success: true, data: result.data };
        } else {
            console.error("Map Validation Failed:", result.error);
            return { success: false, error: result.error };
        }
    }

    public createLevel(mapData: MapData): { floor?: Phaser.Tilemaps.TilemapLayer, walls?: Phaser.Tilemaps.TilemapLayer } {
        this.currentMap = mapData;
        this.map = this.scene.make.tilemap({
            tileWidth: mapData.tileSize,
            tileHeight: mapData.tileSize,
            width: mapData.width,
            height: mapData.height,
        });

        this.tileset = this.map.addTilesetImage('tileset', undefined, 32, 32, 0, 0)!;

        if (!this.tileset) {
            console.error("Failed to load tileset 'tileset'");
            return {};
        }

        this.floorLayer = this.map.createBlankLayer('Floor', this.tileset)!;
        if (this.floorLayer) {
             this.populateLayer(this.floorLayer, mapData.layers.floor);
             this.floorLayer.setDepth(-10); 
        }

        this.wallLayer = this.map.createBlankLayer('Walls', this.tileset)!;
        if (this.wallLayer) {
            this.populateLayer(this.wallLayer, mapData.layers.walls);
            this.wallLayer.setDepth(1); 
            this.wallLayer.setCollision(1);
        }

        return {
            floor: this.floorLayer || undefined,
            walls: this.wallLayer || undefined
        };
    }
    
    public createObjects(
        mapData: MapData, 
        doorGroup: Phaser.Physics.Arcade.StaticGroup, 
        barricadeGroup: Phaser.Physics.Arcade.StaticGroup,
        spawners: Spawner[],
        zombieGroup: Phaser.Physics.Arcade.Group,
        player: Player,
        targetLayer?: Phaser.GameObjects.Layer,
        wallBuyGroup?: Phaser.Physics.Arcade.StaticGroup,
        mysteryBoxGroup?: Phaser.Physics.Arcade.StaticGroup,
        perkMachineGroup?: Phaser.Physics.Arcade.StaticGroup,
        packAPunchGroup?: Phaser.Physics.Arcade.StaticGroup
    ) {
        if (!mapData.objects || !this.pathfindingManager) return;
        
        // Ensure groups exist if passed as optional
        if (wallBuyGroup && mysteryBoxGroup && perkMachineGroup && packAPunchGroup) {
             // Logic proceeds
        } else {
            console.warn("Missing groups for items");
        }
        
        mapData.objects.forEach(obj => {
             if (obj.type === 'door') {
                const cost = obj.properties?.cost || 1000;
                const zone = obj.properties?.zone !== undefined ? obj.properties.zone : -1;
                const door = new Door(this.scene, obj.x, obj.y, cost, zone, this.pathfindingManager!);
                doorGroup.add(door);
             } else if (obj.type === 'barricade') {
                // Tiled Objects seem to be already centered or correctly positioned for the sprite origin.
                // Using obj.x / obj.y directly.
                const cx = obj.x;
                const cy = obj.y;
                
                const bar = new Barricade(this.scene, cx, cy, this.pathfindingManager);
                
                // Rotation Logic: Check neighbors to determine orientation
                // Default is Horizontal (Left-to-Right)
                if (this.wallLayer) {
                    const isWall = (x: number, y: number) => {
                        const tile = this.wallLayer?.getTileAtWorldXY(x, y);
                        // Check for index !== -1 (Wall tiles are 1)
                        // With the new fix, walls are strictly 1.
                        return tile && tile.index !== -1;
                    };

                    const top = isWall(cx, cy - 32);
                    const bottom = isWall(cx, cy + 32);
                    const left = isWall(cx - 32, cy);
                    const right = isWall(cx + 32, cy);
                    
                    // Rotate vertical ONLY if walls are Top & Bottom AND NOT Left & Right
                    if (top && bottom && !left && !right) {
                        bar.setAngle(90);
                        // Do NOT call updateFromGameObject() here. 
                        // It causes the AABB to misalign for rotated static bodies in some Phaser versions/configs.
                        // The body is already 32x32 and centered from constructor.
                    }
                }
                
                barricadeGroup.add(bar);

                // Add to interactable group so player can interact
                // Note: The loop in MainGameScene does this, but if we want to be safe...
                // MainGameScene.ts lines 137-140 iterates the group. So we are good.
             } else if (obj.type === 'spawner') {
                 const zone = obj.properties?.zone || 0;
                 const spawner = new Spawner(
                     this.scene, 
                     obj.x, 
                     obj.y, 
                     zone, 
                     zombieGroup, 
                     barricadeGroup, 
                     player, 
                     this.pathfindingManager!,
                     this.wallLayer,
                     targetLayer
                 );
                 spawners.push(spawner);
             } else if (obj.type === 'spawn') {
                 // Move player to spawn
                 player.setPosition(obj.x, obj.y);
             } else if (obj.type === 'wall_buy') {
                 if (wallBuyGroup) {
                     const weapon = this.getProperty(obj, 'weapon', 'PISTOL');
                     const cost = this.getProperty(obj, 'cost', 500);
                     
                     const w = obj.width || 32;
                     const h = obj.height || 32;
                     
                     const wb = new WallBuy(this.scene, obj.x, obj.y, w, h, weapon, cost);
                     wallBuyGroup.add(wb);
                 }
             } else if (obj.type === 'mystery_box') {
                 if (mysteryBoxGroup) {
                    const rotation = this.getProperty(obj, 'rotation', 0);
                    const isFirst = this.getProperty(obj, 'first', false);

                    const box = new MysteryBox(this.scene, obj.x, obj.y, rotation, isFirst);
                    mysteryBoxGroup.add(box);
                 }
             } else if (obj.type === 'perk_machine') {
                 if (perkMachineGroup) {
                     const perkStr = this.getProperty(obj, 'perk', 'JUGGERNOG');
                     // Convert string to Enum
                     const perkType = Object.values(PerkType).find(p => p === perkStr) || PerkType.JUGGERNOG;
                     
                     const machine = new PerkMachine(this.scene, obj.x, obj.y, perkType as PerkType);
                     perkMachineGroup.add(machine);
                 }
             } else if (obj.type === 'pack_a_punch') {
                 if (packAPunchGroup) {
                     const pap = new PackAPunch(this.scene, obj.x, obj.y);
                     packAPunchGroup.add(pap);
                 }
             }
        });
        
        // Init MysteryBox system (ensure one is active)
        MysteryBox.initSystem();
    }
    
    // Helper to safely extract properties from Tiled Objects (Array or Dictionary)
    private getProperty(obj: any, key: string, defaultValue: any): any {
        if (!obj.properties) return defaultValue;
        
        // Case 1: Array of objects (Tiled JSON standard) -> [{name: "key", value: "val"}, ...]
        if (Array.isArray(obj.properties)) {
            const prop = obj.properties.find((p: any) => p.name === key);
            return prop ? prop.value : defaultValue;
        } 
        
        // Case 2: Dictionary/Object (Phaser often converts to this, or manual map data) -> { key: "val" }
        if (obj.properties.hasOwnProperty(key)) {
            return obj.properties[key];
        }
        
        return defaultValue;
    }
    
    private populateLayer(layer: Phaser.Tilemaps.TilemapLayer, data: number[][]) {
        for (let y = 0; y < data.length; y++) {
            for (let x = 0; x < data[0].length; x++) {
                if (layer.layer.data[y] && layer.layer.data[y][x]) {
                     const tileId = data[y][x];
                     
                     // Improve: Only skip 0 for 'Walls' layer to prevent invisible collisions.
                     // Allow 0 for other layers (like Floor) if 0 represents a valid tile.
                     if (tileId !== 0 || layer.layer.name !== 'Walls') {
                        layer.putTileAt(tileId, x, y);
                     }
                }
            }
        }
    }
}