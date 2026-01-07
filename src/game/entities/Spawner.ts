import Phaser from 'phaser';
import { EventBus } from '../EventBus';
import { Zombie } from './Zombie';
import { PathfindingManager } from '../systems/PathfindingManager';
import { Player } from './Player';

export class Spawner {
    private scene: Phaser.Scene;
    private x: number;
    private y: number;
    private zoneId: number;
    private _isActive: boolean;

    public get isActive(): boolean {
        return this._isActive;
    }
    
    private barricadeGroup: Phaser.Physics.Arcade.StaticGroup;
    private player: Player;
    private pathfindingManager: PathfindingManager;
    private wallLayer?: Phaser.Tilemaps.TilemapLayer;
    private targetLayer?: Phaser.GameObjects.Layer;

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        zoneId: number, 
        zombieGroup: Phaser.Physics.Arcade.Group,
        barricadeGroup: Phaser.Physics.Arcade.StaticGroup,
        player: Player,
        pathfindingManager: PathfindingManager,
        wallLayer?: Phaser.Tilemaps.TilemapLayer,
        targetLayer?: Phaser.GameObjects.Layer
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.zoneId = zoneId;
        this.zombieGroup = zombieGroup;
        this.barricadeGroup = barricadeGroup;
        this.player = player;
        this.pathfindingManager = pathfindingManager;
        this.wallLayer = wallLayer;
        this.targetLayer = targetLayer;
        
        // Zone 0 is active by default
        this._isActive = (zoneId === 0);

        // Listen for activation
        EventBus.on('activate-zone', (id: number) => {
            if (id === this.zoneId) {
                this._isActive = true;
            }
        });
    }

    public update(time: number) {
        // Controlled by WaveManager now
    }

    public spawn(group: Phaser.Physics.Arcade.Group) {
        if (!this.isActive || !this.scene.sys.isActive()) return;
        
        const zombie = new Zombie(
            this.scene, 
            this.x, 
            this.y, 
            this.player, 
            this.pathfindingManager, 
            this.barricadeGroup,
            this.wallLayer,
            this.targetLayer
        );
        group.add(zombie);
    }
}