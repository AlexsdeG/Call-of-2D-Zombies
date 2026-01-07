import { WAVE } from '../../config/constants';
import { Spawner } from '../entities/Spawner';
import { EventBus } from '../EventBus';
import { DirectorAI } from './DirectorAI';

export enum WaveState {
    INTERMISSION,
    SPAWNING,
    WAITING_FOR_CLEAR
}

export class WaveManager {
    private spawners: Spawner[];
    private zombieGroup: Phaser.Physics.Arcade.Group;
    private director: DirectorAI;

    private currentRound: number = 0;
    private zombiesRemainingToSpawn: number = 0;
    private activeZombies: number = 0;
    private state: WaveState = WaveState.INTERMISSION;

    // Timers
    private intermissionTimer: number = 0;
    private spawnTimer: number = 0;

    constructor(_scene: Phaser.Scene, spawners: Spawner[], zombieGroup: Phaser.Physics.Arcade.Group, director: DirectorAI) {
        this.spawners = spawners;
        this.zombieGroup = zombieGroup;
        this.director = director;
    }

    public start() {
        this.currentRound = 0;
        this.startIntermission();
    }

    public update(_time: number, delta: number) {
        if (this.state === WaveState.INTERMISSION) {
            this.handleIntermission(delta);
        } else if (this.state === WaveState.SPAWNING) {
            this.handleSpawning(delta);
        } else if (this.state === WaveState.WAITING_FOR_CLEAR) {
            this.checkRoundClear();
        }
    }

    private handleIntermission(delta: number) {
        this.intermissionTimer -= delta;
        if (this.intermissionTimer <= 0) {
            this.startNextRound();
        }
    }

    private handleSpawning(delta: number) {
        // Count active zombies accurately
        this.activeZombies = this.zombieGroup.countActive(true);

        if (this.zombiesRemainingToSpawn <= 0) {
            this.state = WaveState.WAITING_FOR_CLEAR;
            console.log('All zombies spawned, waiting for clear...');
            return;
        }

        if (this.activeZombies >= WAVE.MAX_ACTIVE_ZOMBIES) {
            return; // Cap reached
        }

        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnZombie();
            
            // Reset timer with Director adjustment
            const modifier = this.director.getSpawnDelayModifier();
            this.spawnTimer = WAVE.BASE_SPAWN_RATE * modifier;
        }
    }

    private spawnZombie() {
        // Filter for active spawners only
        const activeSpawners = this.spawners.filter(s => s.isActive);

        if (activeSpawners.length === 0) {
            // console.warn('WaveManager: No active spawners found!');
            return;
        }

        // Get random active spawner
        const spawner = Phaser.Utils.Array.GetRandom(activeSpawners) as Spawner;
        
        // Spawn
        spawner.spawn(this.zombieGroup);
        
        this.zombiesRemainingToSpawn--;
        // console.log(`Spawned Zombie! Remaining: ${this.zombiesRemainingToSpawn}`);
    }

    private checkRoundClear() {
        this.activeZombies = this.zombieGroup.countActive(true);
        if (this.activeZombies === 0) {
            console.log(`Round ${this.currentRound} Cleared!`);
            EventBus.emit('round-complete', this.currentRound);
            this.startIntermission();
        }
    }

    private startIntermission() {
        this.state = WaveState.INTERMISSION;
        this.intermissionTimer = WAVE.INTERMISSION_DURATION;
        console.log(`Intermission started. Next round in ${WAVE.INTERMISSION_DURATION/1000}s`);
        EventBus.emit('intermission-start', WAVE.INTERMISSION_DURATION);
    }

    private startNextRound() {
        this.currentRound++;
        this.state = WaveState.SPAWNING;
        
        // Classic Zombies Formula: 24 zombies max initially, increases with rounds
        // Simple linear for demo:
        this.zombiesRemainingToSpawn = Math.floor(this.currentRound * 2) + 5; 
        
        // Use a more robust formula if desired:
        // floor(round * 0.15 * 24) + 24 (starts high)
        // Let's stick to a simpler ramp up for early game testing: 5, 8, 11, 14...
        // this.zombiesRemainingToSpawn = 5 + (this.currentRound - 1) * 3;

        console.log(`Round ${this.currentRound} Started! Zombies: ${this.zombiesRemainingToSpawn}`);
        EventBus.emit('round-start', this.currentRound);
        
        this.spawnTimer = 0; // Spawn immediately
    }
    
    public getCurrentRound(): number {
        return this.currentRound;
    }
}
