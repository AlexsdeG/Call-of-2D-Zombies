import { Player } from '../entities/Player';

export class DirectorAI {
    private stress: number = 0; // 0.0 to 1.0
    private player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    public update(time: number, delta: number) {
        // Calculate Stress
        this.calculateStress();
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
}
