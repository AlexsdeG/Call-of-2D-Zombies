import Phaser from 'phaser';
import { IGameMode } from './IGameMode';
import { WaveManager } from '../systems/WaveManager';
import { DirectorAI } from '../systems/DirectorAI';
import { Player } from '../entities/Player';
import { Spawner } from '../entities/Spawner';

export class SurvivalMode implements IGameMode {
    private waveManager: WaveManager;
    private directorAI: DirectorAI;
    
    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        spawners: Spawner[], 
        zombieGroup: Phaser.Physics.Arcade.Group
    ) {
        this.directorAI = new DirectorAI(player);
        this.waveManager = new WaveManager(scene, spawners, zombieGroup, this.directorAI);
    }

    public init() {
        console.log('Survival Mode Initialized');
        this.waveManager.start();
    }

    public update(time: number, delta: number) {
        this.directorAI.update(time, delta);
        this.waveManager.update(time, delta);
    }
    
    public shutdown() {
        console.log('Survival Mode Shutdown');
    }

    public getCurrentRound(): number {
        return this.waveManager.getCurrentRound();
    }

    public getGameOverMessage(): string {
        return "You survived... until now";
    }
}
