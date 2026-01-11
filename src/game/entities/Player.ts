import Phaser from "phaser";
import { PLAYER } from "../../config/constants";
import { CONTROLS } from "../../config/controls";
import { useGameStore } from "../../store/useGameStore";
import { EventBus } from "../EventBus";
import { WeaponSystem } from "../systems/WeaponSystem";
import { GameState } from "../../types";
import { IInteractable } from "../interfaces/IInteractable";
import { Zombie } from "./Zombie";
import { PerkType, PowerUpType } from '../types/PerkTypes';
import { PERK } from '../../config/constants';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private currentSpeed: number = PLAYER.DEFAULT_SPEED;
  private stamina: number = PLAYER.MAX_STAMINA;
  private _health: number = PLAYER.MAX_HEALTH;
  private _maxHealth: number = PLAYER.MAX_HEALTH;
  public isDead: boolean = false;

  // Systems
  public weaponSystem: WeaponSystem;

  // State tracking
  private isSprinting: boolean = false;
  private canSprint: boolean = true;  
  
  // Perks & Powerups
  private perks: Set<PerkType> = new Set();
  private activePowerups: Map<PowerUpType, number> = new Map(); // Type -> EndTime

  // Optimization
  private moveVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
  private cursorWorldPos: Phaser.Math.Vector2 = new Phaser.Math.Vector2();


  // Interaction (Now a regular Group, not Physics group)
  private interactables: Phaser.GameObjects.Group | null = null;
  private zombieGroup: Phaser.Physics.Arcade.Group | null = null;
  private lastMeleeTime: number = 0;
  private readonly MELEE_COOLDOWN = 500;
  private readonly MELEE_RANGE = 80;

  // Sync timers
  public get health(): number {
      return this._health;
  }

  public set health(value: number) {
      this._health = value;
  }

  public get maxHealth(): number {
      return this._maxHealth;
  }

  public get isValid(): boolean {
      return this.scene && this.scene.sys.isActive() && this.body !== undefined;
  }
  private lastStoreSync: number = 0;

  // Session Stats (Local to this player instance, for MP support later)
  public sessionStats = {
      kills: 0,
      headshots: 0,
      weaponUsage: {} as Record<string, { kills: number, headshots: number, timePlayed: number }>
  };

  public recordKill(isHeadshot: boolean, weaponKey?: string) {
      this.sessionStats.kills++;
      if (isHeadshot) this.sessionStats.headshots++;
      
      if (weaponKey) {
          if (!this.sessionStats.weaponUsage[weaponKey]) {
              this.sessionStats.weaponUsage[weaponKey] = { kills: 0, headshots: 0, timePlayed: 0 };
          }
          this.sessionStats.weaponUsage[weaponKey].kills++;
          if (isHeadshot) this.sessionStats.weaponUsage[weaponKey].headshots++;
      }
      
      // Sync to UI Store (Global for now, but supports local player view)
      useGameStore.getState().updatePlayerStats({
          kills: this.sessionStats.kills,
          headshots: this.sessionStats.headshots
      });
  }
  private lastUiSync: number = 0;
  private readonly STORE_SYNC_INTERVAL = 1000;
  private readonly UI_SYNC_INTERVAL = 50; 

  // Input Handler Reference
  private onPointerDown: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, bulletGroup: Phaser.Physics.Arcade.Group) {
    super(scene, x, y, "player");

    // Physics setup
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCircle(PLAYER.BASE_RADIUS, PLAYER.BASE_RADIUS, PLAYER.BASE_RADIUS);
    this.setCollideWorldBounds(true);
    this.setOrigin(0.5, 0.5);
    this.setImmovable(false);
    this.setPushable(false);
    this.setDepth(30); 

    // Systems Init
    this.weaponSystem = new WeaponSystem(scene, this, bulletGroup);
    // Default weapon
    this.weaponSystem.equip('PISTOL'); // Default to Slot 3 (Index 2) handled by WeaponSystem defaults if logic is smart, or we pass valid default
    
    // Input Init
    if (scene.input.keyboard) {
      this.keys = scene.input.keyboard.addKeys({
        up: CONTROLS.MOVE_UP,
        down: CONTROLS.MOVE_DOWN,
        left: CONTROLS.MOVE_LEFT,
        right: CONTROLS.MOVE_RIGHT,
        sprint: CONTROLS.SPRINT,
        reload: CONTROLS.RELOAD,
        pause: CONTROLS.PAUSE,
        interact: CONTROLS.INTERACT,
        melee: CONTROLS.MELEE,
        // Slots
        slot1: CONTROLS.SLOT_1,
        slot2: CONTROLS.SLOT_2,
        slot3: CONTROLS.SLOT_3
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    
    // Mouse Input for Shooting
    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
        // Safety checks for destroyed object
        if (!this.scene || !this.isValid) return;
        
        if (this.scene.scene.isPaused('MainGameScene') || this.isDead) return;
        
        if (pointer.leftButtonDown()) {
            this.weaponSystem.trigger(scene.time.now);
        }
    };
    scene.input.on('pointerdown', this.onPointerDown);
    
    // Mouse Wheel
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number, deltaZ: number) => {
        if (this.scene.scene.isPaused('MainGameScene') || this.isDead) return;
        this.weaponSystem.cycleWeapon(deltaY);
    });

    // Listen to weapon events
    EventBus.on('weapon-update', (data: any) => {
        EventBus.emit("player-stats-update", {
            stamina: this.stamina,
            health: this.health,
            ammo: data.ammo,
            maxAmmo: data.maxAmmo,
            isReloading: data.isReloading
        });
    });

    // Damage Listener
    scene.events.on('player-damaged', (amount: number) => {
        this.takeDamage(amount);
    });
  }

  public destroy(fromScene?: boolean) {
      // Remove Input Listener
      if (this.scene && this.scene.input) {
          this.scene.input.off('pointerdown', this.onPointerDown);
          this.scene.input.off('wheel'); // Clean up wheel
      }
      super.destroy(fromScene);
  }

  public takeDamage(amount: number) {
      if (!this.scene || !this.isValid || this.isDead) return;

      this.health = Math.max(0, this.health - amount);
      this.setTint(0xff0000);
      
      this.scene.time.delayedCall(200, () => {
          if(this.isValid && !this.isDead) this.clearTint();
      });
      
      // Juggernog Regeneration Speed? (Optional, not in prompt but common)
      // For now just standard regen logic in update if implemented later
      
      // Update UI immediately
      EventBus.emit("player-stats-update", { health: this.health });
      
      if (this.health <= 0) {
          this.die();
      }
  }

  private die() {
      if (this.isDead) return;
      this.isDead = true;
      console.log("Player Died");
      
      this.setTint(0x550000);
      this.setVelocity(0,0);
      this.disableBody(true, false); // Disable physics, keep visible for now
      
      EventBus.emit('game-over');
  }

  public setInteractables(group: Phaser.GameObjects.Group) {
      this.interactables = group;
  }

  public setZombieGroup(group: Phaser.Physics.Arcade.Group) {
      this.zombieGroup = group;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;

    // Check Pause
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
        EventBus.emit('toggle-pause');
    }

    this.handleMovement(delta);
    this.handleRotation();
    this.handleActions(time, delta);
    
    // Update Subsystems
    this.weaponSystem.update(time, delta);
    
    // Check for Interaction Prompts
    this.updateInteractionPrompt();

    this.updateGlobalState(time);
    
    // Track Weapon Playtime
    const currentWeapon = this.weaponSystem.getActiveWeaponStats();
    if (currentWeapon && currentWeapon.key) {
        const key = currentWeapon.key;
        if (!this.sessionStats.weaponUsage[key]) {
             this.sessionStats.weaponUsage[key] = { kills: 0, headshots: 0, timePlayed: 0 };
        }
        this.sessionStats.weaponUsage[key].timePlayed += delta; 
    }
  }

  private handleActions(time: number, delta: number) {
      // Reload
      if (Phaser.Input.Keyboard.JustDown(this.keys.reload)) {
          this.weaponSystem.reload(time);
      }
      
      // Slots
      if (Phaser.Input.Keyboard.JustDown(this.keys.slot1)) this.weaponSystem.switchWeapon(0);
      if (Phaser.Input.Keyboard.JustDown(this.keys.slot2)) this.weaponSystem.switchWeapon(1);
      if (Phaser.Input.Keyboard.JustDown(this.keys.slot3)) this.weaponSystem.switchWeapon(2);
      
      // Interaction (Hold supported)
      if (this.keys.interact.isDown) {
          this.tryInteract(delta);
      }
      
      if (Phaser.Input.Keyboard.JustDown(this.keys.melee)) {
          this.handleMelee(time);
      }

      // Continuous Fire
      if (this.scene.input.activePointer.isDown) {
          this.weaponSystem.trigger(time);
      }
  }

  public isInteractJustDown(): boolean {
      return Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  private handleMelee(time: number) {
      if (time < this.lastMeleeTime + this.MELEE_COOLDOWN) return;
      this.lastMeleeTime = time;
      
      // Visual Swipe
      const graphics = this.scene.add.graphics();
      graphics.setDepth(100);
      graphics.lineStyle(4, 0xffffff, 0.8);
      
      const startAngle = this.rotation - Math.PI / 4;
      const endAngle = this.rotation + Math.PI / 4;
      
      graphics.beginPath();
      graphics.arc(this.x, this.y, 40, startAngle, endAngle, false);
      graphics.strokePath();
      
      this.scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 200,
          onComplete: () => graphics.destroy()
      });
      
      // Hit Logic
      if (this.zombieGroup) {
          // Optimization: Check distance first
          this.zombieGroup.children.each((child) => {
               const z = child as Zombie;
               if (!z.active) return true;
               
               const dist = Phaser.Math.Distance.Between(this.x, this.y, z.x, z.y);
               if (dist < this.MELEE_RANGE) {
                   // Check Cone
                   const angleToZombie = Phaser.Math.Angle.Between(this.x, this.y, z.x, z.y);
                   let diff = Phaser.Math.Angle.Wrap(angleToZombie - this.rotation);
                   
                   if (Math.abs(diff) < Math.PI / 3) { // 60 deg cone
                       z.takeDamage(10);
                       // Show Damage Number
                       this.scene.events.emit('show-damage-text', { x: z.x, y: z.y - 20, amount: 10 });
                       
                       // Add points? User said "when a enemy is hit do 10 damage". 
                       // Previous prompt said "add every hit adds 10 points when an enemy is hit with a bullet".
                       // I will stick to damage only unless requested.
                   }
               }
               return true;
          });
      }
  }

  private tryInteract(delta: number) {
      if (!this.interactables) return;

      // Find closest interactable
      let closest: IInteractable | null = null;
      let minDist: number = PLAYER.INTERACTION_RADIUS;

      this.interactables.children.each((child) => {
          const obj = child as unknown as IInteractable;
          const go = child as Phaser.GameObjects.Sprite; // Cast to access x/y safely
          
          if (!obj.canInteract(this)) return true;

          const dist = Phaser.Math.Distance.Between(this.x, this.y, go.x, go.y);
          if (dist < minDist) {
              minDist = dist;
              closest = obj;
          }
          return true;
      });

      if (closest) {
          (closest as IInteractable).interact(this, delta);
      }
  }

  private handleMovement(delta: number) {
    let dx = 0;
    let dy = 0;

    if (this.keys.up.isDown) dy -= 1;
    if (this.keys.down.isDown) dy += 1;
    if (this.keys.left.isDown) dx -= 1;
    if (this.keys.right.isDown) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.moveVector.set(dx, dy).normalize();

      const isSprintKeyPressed = this.keys.sprint.isDown;

      if (this.isSprinting) {
        if (!isSprintKeyPressed || this.stamina <= 0) {
          this.isSprinting = false;
          if (this.stamina <= 0) this.canSprint = false;
        }
      } else {
        if (isSprintKeyPressed && this.canSprint && this.stamina > 0) {
          this.isSprinting = true;
        }
      }

      if (!this.canSprint && this.stamina >= PLAYER.MIN_STAMINA_TO_SPRINT) {
        this.canSprint = true;
      }

      if (this.isSprinting) {
        let speedMult = PLAYER.SPRINT_SPEED_MULTIPLIER;
        let drainRate = PLAYER.STAMINA_DRAIN_RATE;

        if (this.hasPerk(PerkType.STAMIN_UP)) {
            speedMult *= PERK.STAMIN_UP_SPEED_MULTIPLIER;
            drainRate /= PERK.STAMIN_UP_DURATION_MULTIPLIER;
        }

        this.currentSpeed = PLAYER.DEFAULT_SPEED * speedMult;
        this.stamina = Math.max(0, this.stamina - drainRate * (delta / 1000));
      } else {
        this.currentSpeed = PLAYER.DEFAULT_SPEED;
        
        // Stamin-Up increases walk speed too? Usually just duration/sprint speed.
        // Let's keep walk speed standard for now.
      }

      this.setVelocity(
        this.moveVector.x * this.currentSpeed,
        this.moveVector.y * this.currentSpeed
      );
    } else {
      this.setVelocity(0, 0);
      this.isSprinting = false;
      if (this.stamina >= PLAYER.MIN_STAMINA_TO_SPRINT) this.canSprint = true;
    }

    if (!this.isSprinting && this.stamina < PLAYER.MAX_STAMINA) {
      this.stamina = Math.min(PLAYER.MAX_STAMINA, this.stamina + PLAYER.STAMINA_REGEN_RATE * (delta / 1000));
    }
  }

  private handleRotation() {
    const pointer = this.scene.input.activePointer;
    this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y, this.cursorWorldPos);

    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.cursorWorldPos.x,
      this.cursorWorldPos.y
    );
    this.setRotation(angle);
  }

  private updateGlobalState(time: number) {
    if (time > this.lastUiSync + this.UI_SYNC_INTERVAL) {
      EventBus.emit("player-stats-update", {
        stamina: this.stamina,
        health: this.health,
      });
      this.lastUiSync = time;
    }

    if (time > this.lastStoreSync + this.STORE_SYNC_INTERVAL) {
      useGameStore.getState().updatePlayerStats({
        stamina: Math.floor(this.stamina),
      });
      this.lastStoreSync = time;
    }
  }
  
  private updateInteractionPrompt() {
      if (!this.interactables) return;
      
      let closest: IInteractable | null = null;
      let minDist: number = PLAYER.INTERACTION_RADIUS;

      this.interactables.children.each((child) => {
          const obj = child as unknown as IInteractable;
          const go = child as Phaser.GameObjects.Sprite;
          
          if (!obj.canInteract(this)) return true; // continue

          const dist = Phaser.Math.Distance.Between(this.x, this.y, go.x, go.y);
          if (dist < minDist) {
              minDist = dist;
              closest = obj;
          }
          return true;
      });

      if (closest) {
          const text = (closest as IInteractable).getInteractionPrompt(this);
          // Always emit if valid, UI component handles deduping/display
          if (text) {
              EventBus.emit('show-interaction-prompt', text);
              return;
          }
      }
      
      // If no interactable or no text, hide
      EventBus.emit('hide-interaction-prompt');
  }

  public equipWeapon(weaponKey: string) {
      this.weaponSystem.equip(weaponKey as any);
  }

  public addPoints(amount: number) {
    let finalAmount = amount;
    
    // Check for Double Points
    if (this.activePowerups.has(PowerUpType.DOUBLE_POINTS)) {
        finalAmount *= 2;
    }

    const current = useGameStore.getState().playerStats.points;
    useGameStore.getState().updatePlayerStats({ points: current + finalAmount });
    
    // Optional: Floating text for points?
}

  public spendPoints(amount: number): boolean {
      const current = useGameStore.getState().playerStats.points;
      if (current >= amount) {
          useGameStore.getState().updatePlayerStats({ points: current - amount });
          return true;
      }
      return false;
  }

  public get points(): number {
      return useGameStore.getState().playerStats.points;
  }

  // --- PERK SYSTEM ---
  public addPerk(perk: PerkType) {
      if (this.perks.has(perk)) return;
      this.perks.add(perk);
      
      this.applyPerkEffect(perk);
  }

  public hasPerk(perk: PerkType): boolean {
      return this.perks.has(perk);
  }

  private applyPerkEffect(perk: PerkType) {
      switch (perk) {
          case PerkType.JUGGERNOG:
              this._maxHealth = PERK.JUGGERNOG_HEALTH;
              this._health = this._maxHealth; // Heal on buy
              EventBus.emit("player-stats-update", { health: this.health });
              break;
          case PerkType.SPEED_COLA:
          case PerkType.DOUBLE_TAP:
               // WeaponSystem checks player perks, or we notify it
               this.weaponSystem.onPerkAcquired(perk);
               break;
      }
  }

  // --- POWERUP SYSTEM ---
  public activatePowerUp(type: PowerUpType, duration: number) {
      const endTime = this.scene.time.now + duration;
      this.activePowerups.set(type, endTime);
      
      if (type === PowerUpType.MAX_AMMO) {
          this.weaponSystem.refillAllAmmo();
      }
      
      // Schedule removal? Or check in updates? 
      // Usually easier to check hasPowerUp(type) which verifies time.
      this.scene.time.delayedCall(duration, () => {
          this.activePowerups.delete(type);
          EventBus.emit('powerup-end', type);
          this.syncPowerUpsToStore(); // Sync on end
      });
      
      EventBus.emit('powerup-start', { type, duration });
      this.syncPowerUpsToStore(); // Sync on start
  }

  private syncPowerUpsToStore() {
      const list = Array.from(this.activePowerups.entries()).map(([type, endTime]) => ({
          type,
          endTime
      }));
      useGameStore.getState().setActivePowerUps(list);
  }

  public hasPowerUp(type: PowerUpType): boolean {
      if (!this.activePowerups.has(type)) return false;
      const end = this.activePowerups.get(type);
      return end ? end > this.scene.time.now : false;
  }
}