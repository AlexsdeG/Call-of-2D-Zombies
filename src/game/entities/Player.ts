import Phaser from "phaser";
import { PLAYER } from "../../config/constants";
import { CONTROLS } from "../../config/controls";
import { useGameStore } from "../../store/useGameStore";
import { EventBus } from "../EventBus";
import { WeaponSystem } from "../systems/WeaponSystem";
import { GameState } from "../../types";
import { IInteractable } from "../interfaces/IInteractable";

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

  // Optimization
  private moveVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
  private cursorWorldPos: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

  // Interaction (Now a regular Group, not Physics group)
  private interactables: Phaser.GameObjects.Group | null = null;

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
        interact: CONTROLS.INTERACT
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
      }
      super.destroy(fromScene);
  }

  public takeDamage(amount: number) {
      if (!this.scene || !this.isValid || this.isDead) return;

      this.health = Math.max(0, this.health - amount);
      this.setTint(0xff0000);
      
      // Use efficient delayed call with safety
      this.scene.time.delayedCall(200, () => {
          if(this.isValid && !this.isDead) this.clearTint();
      });
      
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
  }

  private handleActions(time: number, delta: number) {
      // Reload
      if (Phaser.Input.Keyboard.JustDown(this.keys.reload)) {
          this.weaponSystem.reload(time);
      }
      
      // Interaction (Hold supported)
      if (this.keys.interact.isDown) {
          this.tryInteract(delta);
      }

      // Continuous Fire
      if (this.scene.input.activePointer.isDown) {
          this.weaponSystem.trigger(time);
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
        this.currentSpeed = PLAYER.DEFAULT_SPEED * PLAYER.SPRINT_SPEED_MULTIPLIER;
        this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_DRAIN_RATE * (delta / 1000));
      } else {
        this.currentSpeed = PLAYER.DEFAULT_SPEED;
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
          const text = (closest as IInteractable).getInteractionPrompt();
          // Always emit if valid, UI component handles deduping/display
          if (text) {
              EventBus.emit('show-interaction-prompt', text);
              return;
          }
      }
      
      // If no interactable or no text, hide
      EventBus.emit('hide-interaction-prompt');
  }
}