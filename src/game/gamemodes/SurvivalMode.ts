import Phaser from 'phaser';
import { IGameMode } from './IGameMode';
import { WaveManager } from '../systems/WaveManager';
import { DirectorAI } from '../systems/DirectorAI';
import { Player } from '../entities/Player';
import { Spawner } from '../entities/Spawner';
import { useGameStore } from '../../store/useGameStore';

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
        
        // Sync Round to Store (Optimized to only set if changed?)
        // The store selector is optimized, but calling set state every frame is bad.
        // We should move this to an event listener in Survival Mode if possible.
        // But for now, let's just do a simple check.
        const r = this.waveManager.getCurrentRound();
        if (useGameStore.getState().currentRound !== r) {
             useGameStore.getState().setCurrentRound(r);
        }
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
