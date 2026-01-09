import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EventBus } from '../EventBus';
import { WORLD, WEAPON_DEFS } from '../../config/constants';
import { VisionManager } from '../systems/VisionManager';
import { Projectile } from '../entities/Projectile';
import { WeaponAttributes } from '../types/WeaponTypes';
import { MapManager } from '../systems/MapManager';
import { DEBUG_MAP } from '../../config/defaultMap';
import { PathfindingManager } from '../systems/PathfindingManager';
import { Zombie } from '../entities/Zombie';
import { Barricade } from '../entities/Barricade';
import { Door } from '../entities/Door';
import { Spawner } from '../entities/Spawner';
import { WallBuy } from '../entities/WallBuy';
import { MysteryBox } from '../entities/MysteryBox';
import { PerkMachine } from '../entities/PerkMachine';
import { PackAPunch } from '../entities/PackAPunch';
import { PowerUp } from '../entities/PowerUp';
import { PowerUpType } from '../types/PerkTypes';
import { useGameStore } from '../../store/useGameStore';
import { IGameMode } from '../gamemodes/IGameMode';
import { SurvivalMode } from '../gamemodes/SurvivalMode';
import { ScriptEngine } from '../systems/ScriptEngine';
import { TriggerType } from '../../schemas/scriptSchema';

export class MainGameScene extends Phaser.Scene {
  private player!: Player;
  private visionManager!: VisionManager;
  private mapManager!: MapManager;
  private pathfindingManager!: PathfindingManager;
  public scriptEngine!: ScriptEngine;
  private gameMode!: IGameMode;
  
  private crates: Phaser.GameObjects.Sprite[] = [];
  private targets: Phaser.GameObjects.Sprite[] = [];
  private customWalls: Phaser.GameObjects.Sprite[] = [];
  private spawners: Spawner[] = [];
  
  // Physics Groups
  private bulletGroup!: Phaser.Physics.Arcade.Group;
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private targetGroup!: Phaser.Physics.Arcade.StaticGroup;
  private zombieGroup!: Phaser.Physics.Arcade.Group;
  private customWallGroup!: Phaser.Physics.Arcade.StaticGroup;
  
  // New Groups for Phase 2.3
  private doorGroup!: Phaser.Physics.Arcade.StaticGroup;
  private barricadeGroup!: Phaser.Physics.Arcade.StaticGroup;
  private wallBuyGroup!: Phaser.Physics.Arcade.StaticGroup;
  private mysteryBoxGroup!: Phaser.Physics.Arcade.StaticGroup;
  private perkMachineGroup!: Phaser.Physics.Arcade.StaticGroup;
  private packAPunchGroup!: Phaser.Physics.Arcade.StaticGroup;
  private powerUpGroup!: Phaser.Physics.Arcade.Group;
  
  // Interactable Group - Normal Group (Not Physics) to store references for Player interaction
  private interactableGroup!: Phaser.GameObjects.Group;

  private wallLayer?: Phaser.Tilemaps.TilemapLayer;
  private targetLayer!: Phaser.GameObjects.Layer;

  // Effects
  private particleManager!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodManager!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crosshair!: Phaser.GameObjects.Graphics;

  private isGameOver: boolean = false;
  private fpsEvent?: Phaser.Time.TimerEvent;

  // Event Handlers
  private onExitGame: () => void;
  private onRestartGame: () => void;
  private onGameOver: () => void;

  constructor() {
    super({ key: 'MainGameScene' });
    
    this.onExitGame = () => {
        this.scene.stop();
        this.scene.start('MenuScene');
        this.input.setDefaultCursor('default');
    };

    this.onRestartGame = () => {
        // Full stop and start to ensure clean slate
        this.scene.stop();
        this.scene.start('MainGameScene');
    };

    this.onGameOver = () => {
        this.isGameOver = true;
        this.physics.pause();
        this.input.setDefaultCursor('default');
        
        // Update Game Over Stats in Store
        if (this.gameMode) {
             const roundsSurvived = this.gameMode.getCurrentRound();
             const message = this.gameMode.getGameOverMessage ? this.gameMode.getGameOverMessage() : "GAME OVER";
             
             // Access store directly (since we are outside React)
             useGameStore.getState().setGameOverStats({
                 roundsSurvived,
                 message
             });
        }
    };
  }

  create() {
    console.log('MainGameScene: Created');
    this.isGameOver = false;
    this.physics.resume(); 
    this.input.setDefaultCursor('none');
    
    // Clear any previous spawners
    this.spawners = [];

    // Events Cleanup & Setup
    this.events.off('shutdown');
    this.events.on('shutdown', this.shutdown, this);

    // Remove specific listeners if they exist (safety check)
    EventBus.off('exit-game', this.onExitGame);
    EventBus.off('restart-game', this.onRestartGame);
    EventBus.off('game-over', this.onGameOver);

    // Add Listeners
    EventBus.on('exit-game', this.onExitGame);
    EventBus.on('restart-game', this.onRestartGame);
    EventBus.on('game-over', this.onGameOver);

    // Pause/Resume Handlers to prevent Black Screen / Loss of Context
    EventBus.on('pause-game', () => {
        if (!this.scene.isActive()) return;
        this.physics.pause();
        // this.scene.pause(); // Do NOT pause the scene, just physics. Pausing scene stops updates which might cause black screen on resume if not handled perfectly.
        // Instead, we just pause physics and maybe inputs.
        this.input.setDefaultCursor('default');
    });

    EventBus.on('resume-game', () => {
        if (!this.scene.isActive()) return;
        this.physics.resume();
        // this.scene.resume();
        this.input.setDefaultCursor('none');
    });
    
    // PowerUp Listener
    EventBus.on('spawn-powerup', (data: {x: number, y: number, type: PowerUpType}) => {
        if (!this.scene.isActive()) return;
        const pu = new PowerUp(this, data.x, data.y, data.type);
        this.powerUpGroup.add(pu);
    });

    // Global PowerUp Effects
    EventBus.on('trigger-carpenter', () => {
        if (!this.scene.isActive()) return;
        let fixedCount = 0;
        this.barricadeGroup.children.each(b => {
            const bar = b as Barricade;
            if (bar.active) {
                bar.fullyRepair();
                fixedCount++;
            }
            return true;
        });
        
        // Bonus Points
        this.player.addPoints(200);
        EventBus.emit('show-notification', "Carpenter! Barricades Fixed!");
    });

    EventBus.on('trigger-nuke', () => {
        if (!this.scene.isActive()) return;
        this.zombieGroup.children.each(z => {
            const zombie = z as Zombie;
            if (zombie.active) {
                zombie.takeDamage(10000); // Massive damage
            }
            return true;
        });
        
        this.player.addPoints(400); 
        EventBus.emit('show-notification', "Kaboom! Nuke!");
    });

    EventBus.on('trigger-firesale', () => {
        if (!this.scene.isActive()) return;
        MysteryBox.startFireSale(this);
        EventBus.emit('show-notification', "FIRE SALE ACTIVE!");
    });

    // --- DEBUG: Spawn PowerUps for Testing ---
    // User requested spawning them for the debug map to test at tile 12,12
    this.time.delayedCall(2000, () => {
        const debugX = 12 * 32; // Tile 12 -> 384
        const debugY = 12 * 32; // Tile 12 -> 384
        
        const types = [
            PowerUpType.MAX_AMMO, 
            PowerUpType.NUKE, 
            PowerUpType.INSTA_KILL, 
            PowerUpType.DOUBLE_POINTS, 
            PowerUpType.CARPENTER,
            PowerUpType.FIRE_SALE
        ];
        
        types.forEach((type, index) => {
            // Spacing them out horizontally by 40px
            const pu = new PowerUp(this, debugX + (index * 40), debugY, type);
            this.powerUpGroup.add(pu);
        });
        
        console.log("DEBUG: Spawning PowerUps at", debugX, debugY);
    });

    // 0. Setup Physics Groups
    this.bulletGroup = this.physics.add.group({ classType: Projectile, runChildUpdate: true, maxSize: 100 });
    this.obstacleGroup = this.physics.add.staticGroup();
    this.targetGroup = this.physics.add.staticGroup();
    this.customWallGroup = this.physics.add.staticGroup();
    this.zombieGroup = this.physics.add.group({ classType: Zombie, runChildUpdate: true, collideWorldBounds: false }); 
    
    // Interactables
    this.doorGroup = this.physics.add.staticGroup({ classType: Door });
    this.barricadeGroup = this.physics.add.staticGroup({ classType: Barricade });
    // Economy
    this.wallBuyGroup = this.physics.add.staticGroup({ classType: WallBuy });
    this.mysteryBoxGroup = this.physics.add.staticGroup({
        classType: MysteryBox
    });
    this.perkMachineGroup = this.physics.add.staticGroup({ classType: PerkMachine });
    this.packAPunchGroup = this.physics.add.staticGroup({ classType: PackAPunch });
    
    // Dynamic group for PowerUps
    this.powerUpGroup = this.physics.add.group({ classType: PowerUp, runChildUpdate: true });
    
    this.interactableGroup = this.add.group(); 

    // 1. Map & Pathfinding Init
    this.pathfindingManager = new PathfindingManager(this);
    this.mapManager = new MapManager(this, this.pathfindingManager);
    this.scriptEngine = new ScriptEngine(this);

    // 1.5 Textures
    this.createBackground();
    this.createCrateTexture();
    this.createTargetTexture();
    this.createCustomWallTexture();

    // 2. Create Player First
    this.player = new Player(this, 100, 100, this.bulletGroup);
    this.player.setInteractables(this.interactableGroup); 
    this.player.setZombieGroup(this.zombieGroup); 
    // Inject ScriptEngine into Player for OnInteract triggers (if needed later) or handled via Scene
    
    // 3. Load Map
    const valid = this.mapManager.validate(DEBUG_MAP);
    if (valid.success && valid.data) {
        const layers = this.mapManager.createLevel(valid.data);
        this.wallLayer = layers.walls;
        
        if (this.wallLayer) this.player.weaponSystem.setWalls(this.wallLayer);

        if (this.wallLayer) this.player.weaponSystem.setWalls(this.wallLayer);

        // Preload Custom Textures
        const customObjects = valid.data.objects?.filter(o => o.type === 'CustomObject' && o.properties?.texture) || [];
        
        const loadTexture = (obj: any): Promise<void> => {
            return new Promise((resolve) => {
                const key = `custom-tex-${obj.id}`;
                // Check if already exists?
                if (this.textures.exists(key)) {
                    resolve();
                    return;
                }
                
                this.textures.addBase64(key, obj.properties.texture);
                this.textures.once('onload', () => {
                   resolve();
                });
                // Fallback timeout?
                setTimeout(resolve, 1000); 
            });
        };

        Promise.all(customObjects.map(loadTexture)).then(() => {
             // Create Objects AFTER textures are ready
             if (this.scene.isActive()) {
                 this.mapManager.createObjects(
                    valid.data!, 
                    this.doorGroup, 
                    this.barricadeGroup, 
                    this.spawners, 
                    this.zombieGroup, 
                    this.player,
                    this.targetLayer,
                    this.wallBuyGroup,
                    this.mysteryBoxGroup,
                    this.perkMachineGroup,
                    this.packAPunchGroup,
                    this.customWallGroup // Pass custom walls!
                );
             }
        });
        
        // Register Scripts
        if (valid.data.scripts) {
            this.scriptEngine.registerScripts(valid.data.scripts);
        }
        
        // Trigger Map Start
        this.scriptEngine.trigger(TriggerType.ON_GAME_START);
    }
    
    this.doorGroup.children.each(d => { this.interactableGroup.add(d); return true; });
    this.barricadeGroup.children.each(b => { this.interactableGroup.add(b); return true; });
    this.wallBuyGroup.children.each(wb => { this.interactableGroup.add(wb); return true; });
    this.mysteryBoxGroup.children.each(mb => { 
        this.interactableGroup.add(mb); 
        // Verify Collision
        this.physics.add.collider(this.player, mb);
        return true; 
    });
    this.perkMachineGroup.children.each(pm => { this.interactableGroup.add(pm); this.physics.add.collider(this.player, pm); return true; });
    this.packAPunchGroup.children.each(pap => { this.interactableGroup.add(pap); this.physics.add.collider(this.player, pap); return true; });
    
    // Collisions for MysteryBox (WallBuy is visual only on walls)
    this.physics.add.collider(this.zombieGroup, this.mysteryBoxGroup);
    this.physics.add.collider(this.zombieGroup, this.perkMachineGroup);
    this.physics.add.collider(this.zombieGroup, this.packAPunchGroup);
    
    this.physics.add.collider(this.bulletGroup, this.mysteryBoxGroup, (b, box) => {
        (b as Projectile).disableBody(true, true);
    });
    this.physics.add.collider(this.bulletGroup, this.perkMachineGroup, (b, box) => { (b as Projectile).disableBody(true, true); });
    this.physics.add.collider(this.bulletGroup, this.packAPunchGroup, (b, box) => { (b as Projectile).disableBody(true, true); });



// ... in create() ...
    // 4. Game Mode
    this.gameMode = new SurvivalMode(this, this.player, this.spawners, this.zombieGroup);
    this.gameMode.init();

    // 3. Bake Pathfinding
    if (this.mapManager['map']) {
         const allObstacles = [
             ...this.crates,
             ...this.targets,
             ...this.customWalls,
             ...this.doorGroup.getChildren() as Phaser.GameObjects.Sprite[],
             ...this.barricadeGroup.getChildren() as Phaser.GameObjects.Sprite[]
         ];
         this.pathfindingManager.buildGrid(this.mapManager['map'], allObstacles);
    }

    // 7. Setup Vision
    const visionObstacles = [
        ...this.crates, 
        ...this.customWalls,
        ...this.doorGroup.getChildren() as Phaser.GameObjects.Sprite[]
    ];
    this.visionManager = new VisionManager(this);
    this.visionManager.setup(this.player, visionObstacles);
    this.visionManager.setTargetLayer(this.targetLayer);

    // 8. Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(WORLD.DEFAULT_ZOOM);
    this.cameras.main.setBounds(0, 0, 3000, 3000);
    this.physics.world.setBounds(-500, -500, 3000, 3000); 

    // 9. Effects
    this.createEffects();
    this.crosshair = this.add.graphics();
    this.crosshair.setDepth(2000);

    // 11. Collisions
    this.setupCollisions();

    // Events
      this.events.on('bullet-hit-wall', (coords: {x: number, y: number}) => {
        if (!this.scene.isActive()) return;
        const emitter = this.data.get('sparkEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
        if (emitter) emitter.explode(5, coords.x, coords.y);
    });

    this.events.on('show-damage-text', (data: {x: number, y: number, amount: number}) => {
        this.showDamageText(data.x, data.y, data.amount, 'normal');
    });

    // 12. UI Components
    // React handles WeaponToast via EventBus 'weapon-switch'

    this.fpsEvent = this.time.addEvent({
      delay: 500, loop: true,
      callback: () => { EventBus.emit('debug-fps', Math.round(this.game.loop.actualFps)); }
    });

    EventBus.emit('scene-created', this);
    EventBus.emit('scene-active', 'MainGameScene');
    
    // Explicitly notify that we are ready to hide loading screen
    // Small delay to ensure render
    this.time.delayedCall(100, () => {
        EventBus.emit('scene-ready');
    });
  }

  shutdown() {
      // Clean up SPECIFIC listeners only
      EventBus.off('exit-game', this.onExitGame);
      EventBus.off('restart-game', this.onRestartGame);
      this.events.off('game-over', this.onGameOver);
      
      this.events.off('bullet-hit-wall');
      this.events.off('show-damage-text');
      EventBus.off('weapon-switch');
      EventBus.off('spawn-powerup');
      EventBus.off('trigger-carpenter');
      EventBus.off('trigger-carpenter');
      EventBus.off('trigger-nuke');
      EventBus.off('trigger-firesale');
      EventBus.off('pause-game');
      EventBus.off('resume-game');
      
      // Stop all Timers and Tweens to prevent "accessing property of undefined" errors
      this.time.removeAllEvents();
      this.tweens.killAll();
      
      if (this.fpsEvent) this.fpsEvent.destroy();
      
      // Destroy Systems & Entities explicitly
      if (this.player) {
          this.player.destroy();
      }
      if (this.visionManager && typeof this.visionManager.destroy === 'function') {
          this.visionManager.destroy();
      }
      if (this.crosshair) {
          this.crosshair.destroy();
      }

      // Clear data managers
      this.spawners = [];
      if (this.interactableGroup) this.interactableGroup.clear(true, true);
      if (this.zombieGroup) this.zombieGroup.clear(true, true);
      if (this.bulletGroup) this.bulletGroup.clear(true, true);
      if (this.powerUpGroup) this.powerUpGroup.clear(true, true);
      
      MysteryBox.reset();

      this.input.setDefaultCursor('default');
      console.log('MainGameScene: Shutdown complete');
  }

  update(time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.player) {
      this.player.update(time, delta);
      if (this.visionManager) this.visionManager.update(this.player);
      this.updateCrosshair();
    }

    
    // Update Systems
    // Update Game Mode
    if (this.gameMode) this.gameMode.update(time, delta);
    
    // Update Spawners (mainly for activation status if needed)
    this.spawners.forEach(s => s.update(time));
  }

  private updateCrosshair() {
      if (this.isGameOver) return;
      
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.crosshair.clear();
      
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
      const stats = this.player.weaponSystem.getActiveWeaponStats();
      
      if (!stats) return; 

      let color = 0xffffff; 
      let isCross = false; 
      
      // Calculate Thresholds
      const deadzone = stats.barrelLength;
      const tooClose = stats.minRange * 0.5;
      const closeWarning = stats.minRange;
      const farWarning = stats.range - (stats.minRange * 0.5); // Symmetric margin
      const maxRange = stats.range;

      if (dist < deadzone) {
          // Deadzone (Red X) - Gun is inside/behind player
          color = 0xff0000;
          isCross = true;
      } else if (dist < tooClose) {
          // Too Close (Red X)
          color = 0xff0000; 
          isCross = true; 
      } else if (dist < closeWarning) {
          // Close Warning (Orange Circle)
          color = 0xffa500; 
      } else if (dist <= farWarning) {
          // Optimal (White Circle)
          color = 0xffffff; 
      } else if (dist <= maxRange) {
          // Far Warning (Orange Circle)
          color = 0xffa500;
      } else {
          // Out of Range (Red X)
          color = 0xff0000; 
          isCross = true; 
      }

      this.crosshair.lineStyle(2, color, 1);
      if (isCross) {
          const s = 10;
          this.crosshair.lineStyle(3, color, 1);
          this.crosshair.beginPath();
          this.crosshair.moveTo(worldPoint.x - s, worldPoint.y - s);
          this.crosshair.lineTo(worldPoint.x + s, worldPoint.y + s);
          this.crosshair.moveTo(worldPoint.x + s, worldPoint.y - s);
          this.crosshair.lineTo(worldPoint.x - s, worldPoint.y + s);
          this.crosshair.strokePath();
      } else {
          this.crosshair.strokeCircle(worldPoint.x, worldPoint.y, 10);
      }
  }

  private createEffects() {
      this.particleManager = this.add.particles(0, 0, 'flare', {
          speed: { min: 50, max: 150 }, scale: { start: 0.4, end: 0 },
          tint: 0xffaa00, blendMode: 'ADD', lifespan: 200, emitting: false
      });
      this.particleManager.setDepth(20);
      this.data.set('sparkEmitter', this.particleManager);

      this.bloodManager = this.add.particles(0, 0, 'flare', {
          speed: { min: 30, max: 100 }, scale: { start: 0.5, end: 0 },
          tint: 0xaa0000, lifespan: 400, emitting: false
      });
      this.bloodManager.setDepth(15); 
      this.data.set('bloodEmitter', this.bloodManager);
  }

  private setupCollisions() {
      // Walls
      if (this.wallLayer) {
        this.physics.add.collider(this.player, this.wallLayer);
        this.physics.add.collider(this.zombieGroup, this.wallLayer);
        this.physics.add.collider(this.bulletGroup, this.wallLayer, (bullet, wallTile) => {
             if (wallTile instanceof Phaser.Tilemaps.Tile) this.handleBulletImpact(bullet as Projectile);
        });
      }

      // Static Groups
      const statics = [this.customWallGroup, this.obstacleGroup, this.targetGroup];
      statics.forEach(grp => {
          this.physics.add.collider(this.player, grp);
          this.physics.add.collider(this.zombieGroup, grp);
          this.physics.add.collider(this.bulletGroup, grp, (b, o) => this.handleBulletImpact(b as Projectile, o as Phaser.GameObjects.Sprite));
      });

      // Target Group Overlap for Bullets
      this.physics.add.overlap(this.bulletGroup, this.targetGroup, (b, t) => {
          this.handleBulletEntityHit(b as Projectile, t as Phaser.Physics.Arcade.Sprite);
      });

      // Entities
      this.physics.add.collider(this.zombieGroup, this.zombieGroup);
      this.physics.add.collider(this.zombieGroup, this.player);
      this.physics.add.overlap(this.bulletGroup, this.zombieGroup, (b, z) => {
          this.handleBulletEntityHit(b as Projectile, z as Phaser.Physics.Arcade.Sprite);
      });

      // Interactables Collisions
      this.physics.add.collider(this.player, this.doorGroup);
      this.physics.add.collider(this.player, this.doorGroup);
      this.physics.add.collider(this.player, this.barricadeGroup);

      // PowerUp Pickup - Use Overlap!
      this.physics.add.overlap(this.player, this.powerUpGroup, (p, pu) => {
          (pu as PowerUp).collect(p as Player);
      });
      
      this.physics.add.collider(this.bulletGroup, this.doorGroup, (b, d) => this.handleBulletImpact(b as Projectile));
      // this.physics.add.collider(this.bulletGroup, this.barricadeGroup, (b, bar) => this.handleBulletImpact(b as Projectile)); // Removed to allow bullets to pass through

      this.physics.add.collider(this.zombieGroup, this.doorGroup);
      
      this.physics.add.collider(this.zombieGroup, this.barricadeGroup, (z, b) => {
          const zombie = z as Zombie;
          const barricade = b as Barricade;
          zombie.handleCollisionWithBarricade(barricade);
      }, (z, b) => {
          const barricade = b as Barricade;
          return barricade.hasPanels();
      });
      
      this.physics.add.overlap(this.zombieGroup, this.barricadeGroup, (z, b) => {
           const barricade = b as Barricade;
           if (!barricade.hasPanels()) {
               (z as Zombie).applySlow();
           }
      });

      this.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
          if (body.gameObject instanceof Projectile) body.gameObject.disableBody(true, true);
      });
  }

  private handleBulletImpact(bullet: Projectile, object?: Phaser.GameObjects.Sprite) {
      if (!this.scene.isActive()) return;
      const emitter = this.data.get('sparkEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
      if(emitter) emitter.explode(5, bullet.x, bullet.y);
      bullet.disableBody(true, true);
  }

  private handleBulletEntityHit(bullet: Projectile, target: Phaser.Physics.Arcade.Sprite) {
      if (!this.scene.isActive()) return;
      
      // Calculate Distance for Damage Drop-off
      // We calculate from Player position because recoil/sway moves the bullet start point
      // checking from "shooter" is standard game logic.
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      const stats = bullet.getData('stats') as WeaponAttributes;
      let damage = stats.damage || 10;

      // Calculate Thresholds (Must match Crosshair)
      const deadzone = stats.barrelLength;
      const tooClose = stats.minRange * 0.5;
      const farWarning = stats.range - (stats.minRange * 0.5);

      if (dist < deadzone) {
          // Deadzone (Red X): 5% Damage
          damage = Math.floor(damage * 0.05);
      } else if (dist < tooClose) {
          // Too Close (Red X): 5% Damage
          damage = Math.floor(damage * 0.05);
      } else if (dist > stats.range) {
           // Too Far (Red X): 5% Damage
           damage = Math.floor(damage * 0.05);
      } else if (dist > farWarning) {
          // Far Warning (Orange): 50% Damage
          damage = Math.floor(damage * 0.5);
      } else if (dist < stats.minRange) {
          // Close Warning (Orange): 50% Damage
          damage = Math.floor(damage * 0.5);
      }
      // Else: Optimal (White): 100% Damage

      const emitter = this.data.get('bloodEmitter') as Phaser.GameObjects.Particles.ParticleEmitter;
      if(emitter) emitter.explode(10, bullet.x, bullet.y);

      if (target instanceof Zombie) {
          this.player.addPoints(10);
          target.takeDamage(damage);
      } else {
          // Target Box Damage Logic
          target.setTint(0xff0000);
          const ch = target.getData('health') || 100;
          const nh = ch - damage;
          target.setData('health', nh);
          
          this.time.delayedCall(100, () => { 
             if(target.active) target.clearTint(); 
          });

          if (nh <= 0) {
              target.destroy();
          }
      }
      
      this.showDamageText(target.x, target.y - 20, damage, 'normal');
      bullet.disableBody(true, true);
  }

  private showDamageText(x: number, y: number, amount: number, type: string) {
      if (!this.scene.isActive()) return;
      const txt = this.add.text(x, y, amount.toString(), {
          fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
      });
      txt.setOrigin(0.5, 0.5);
      txt.setDepth(2100);
      this.tweens.add({ targets: txt, y: y - 40, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
  }

  private createBackground() { /* ... */ 
    const gridSize = WORLD.TILE_SIZE;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.lineStyle(1, 0x333333);
    graphics.strokeRect(0, 0, gridSize, gridSize);
    graphics.generateTexture('grid', gridSize, gridSize);
    graphics.destroy();
    const bg = this.add.tileSprite(1000, 1000, 3000, 3000, 'grid'); 
    bg.setDepth(-100);
  }
  private createCrateTexture() { /* ... */
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x8B4513, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0x5D2906, 1);
    graphics.strokeRect(0, 0, 32, 32);
    graphics.generateTexture('crate', 32, 32);
    graphics.destroy();
   }
  private createTargetTexture() { /* ... */
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeRect(0, 0, 32, 32);
    graphics.generateTexture('target', 32, 32);
    graphics.destroy();
   }
  private createCustomWallTexture() { /* ... */ 
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x555555, 1); // Dark Gray
    graphics.fillRect(0, 0, 16, 16);
    graphics.lineStyle(1, 0x333333);
    graphics.strokeRect(0, 0, 16, 16);
    graphics.generateTexture('wall_custom', 16, 16);
    graphics.destroy();
  }
}