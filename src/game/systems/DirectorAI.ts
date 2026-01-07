import { Player } from '../entities/Player';
import { PowerUp } from '../entities/PowerUp';
import { PowerUpType } from '../types/PerkTypes';

export class DirectorAI {
    private stress: number = 0; // 0.0 to 1.0
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    public update(time: number, delta: number) {
        // Calculate Stress
        this.calculateStress();
        
        // Random "Pity" PowerUp if stress is high
        if (this.stress > 0.8 && Math.random() < 0.0005) { // very rare per frame
             this.spawnPowerUpNearPlayer();
        }
    }

    private calculateStress() {
        if (!this.player || !this.player.active) return;

        // Factor 1: Health (Low health = High Stress)
        const healthPct = this.player.health / this.player.maxHealth;
        const healthStress = 1.0 - healthPct;

        // Factor 2: Ammo (Low ammo = Moderate Stress)
        // (Placeholder until we have easy access to total ammo reserves)
        const ammoStress = 0; 

        // Combine (Weighted)
        this.stress = (healthStress * 0.8) + (ammoStress * 0.2);
        
        // Clamp
        this.stress = Math.min(Math.max(this.stress, 0), 1);
    }

    public getStress(): number {
        return this.stress;
    }

    public getSpawnDelayModifier(): number {
        // High stress = Slower spawns (give player a break)
        // Low stress = Normal or Faster spawns
        if (this.stress > 0.8) return 1.5; // 50% slower
        if (this.stress > 0.5) return 1.2; // 20% slower
        return 1.0;
    }
    private spawnPowerUpNearPlayer() {
        if (!this.player || !this.player.active || !this.player.scene) return;
        
        // Spawn randomly around player
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 100;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        
        const types = Object.values(PowerUpType);
        const randomType = types[Math.floor(Math.random() * types.length)];
        
        new PowerUp(this.player.scene, x, y, randomType);
    }
}
