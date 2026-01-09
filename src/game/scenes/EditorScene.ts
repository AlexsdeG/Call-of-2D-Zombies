import * as Phaser from 'phaser';
import { EventBus } from '../EventBus';

interface EditorObject {
    id: string;
    type: string;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
    sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;
    properties: Record<string, any>;
    scripts?: any[]; // using any[] to avoid strict type deps in this file for now, or import Script
}

export class EditorScene extends Phaser.Scene {
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private cursorGraphics!: Phaser.GameObjects.Graphics;
  private isDrawing: boolean = false;
  
  // Tools
  private currentTool: 'paint' | 'erase' | 'select' | 'place_object' = 'paint';
  private currentTileIndex: number = 1; 
  private currentObjectType: string = 'Spawner'; // Default object to place

  // Objects
  private editorObjects: Map<string, EditorObject> = new Map();
  private selectedObject: EditorObject | null = null;
  private isDraggingObject: boolean = false;

  // Grid config
  private TILE_SIZE = 32;
  private readonly GRID_COLOR = 0x444444;
  private gridSize: number = 32; // Default snap size

  private readonly GRID_ALPHA = 0.5;

  private tiles: Map<string, Phaser.GameObjects.Image> = new Map();
  private mapWidth: number = 50; // default 50x50
  private mapHeight: number = 50;

  private brushSettings: { shape: 'square' | 'circle', width: number, height: number } = { shape: 'square', width: 1, height: 1 };
  
  private isPanning: boolean = false;
  private lastPanPoint: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

  constructor() {
    super({ key: 'EditorScene' });
  }

  create() {
    this.cameras.main.setBackgroundColor('#111111');
    
    // 0. Generate Editor Resources
    this.createEditorTextures();

    // 1. Grid Visualization
    this.createGrid();

    // 1.5 Cursor Graphics
    this.cursorGraphics = this.add.graphics();
    this.cursorGraphics.setDepth(1000); // High depth

    // 2. Camera Controls
    this.input.mouse!.disableContextMenu(); // Prevent right click menu
    
    // Create WASD keys
    const keys = this.input.keyboard!.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    }) as any;

    const controlConfig = {
        camera: this.cameras.main,
        left: keys.left,
        right: keys.right,
        up: keys.up,
        down: keys.down,
        zoomIn: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
        zoomOut: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        acceleration: 0.06,
        drag: 0.0005,
        maxSpeed: 1.0
    };
    this.controls = new Phaser.Cameras.Controls.SmoothedKeyControl(controlConfig);
    
    // Center camera initially
    this.cameras.main.centerOn(this.mapWidth * this.TILE_SIZE / 2, this.mapHeight * this.TILE_SIZE / 2);

    // 3. Input Handling
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointermove', this.handlePointerMove, this);

    // Tests
    // if (import.meta.env.DEV) {
    //     mapEditorTests();
    //     TestRunner.setScene(this);
    //     TestRunner.runAll();
    // }
    
    // Zoom with mouse wheel
    this.input.on('wheel', (_u: unknown, _g: unknown, _x: number, deltaY: number, _z: number) => {
        const newZoom = this.cameras.main.zoom - deltaY * 0.001;
        this.cameras.main.setZoom(Phaser.Math.Clamp(newZoom, 0.1, 4));
    });

    // 4. Event Listeners
    EventBus.on('editor-tool-change', this.handleToolChange, this);
    EventBus.on('editor-map-resize', this.handleMapResize, this);
    EventBus.on('editor-brush-update', this.handleBrushUpdate, this);
    EventBus.on('editor-object-select', this.handleObjectSelect, this);
    EventBus.on('editor-object-delete', this.handleObjectDelete, this);
    EventBus.on('editor-object-update-prop', this.handleObjectUpdateProp, this);
    EventBus.on('editor-grid-update', this.handleGridSizeUpdate, this);
    EventBus.on('editor-object-add-script', this.handleAddScript, this);
    EventBus.on('editor-script-update', this.handleScriptUpdate, this);
    EventBus.on('editor-script-delete', this.handleScriptDelete, this);
    
    // Input Focus Handling
    EventBus.on('editor-input-focus', this.handleInputFocus, this);
    EventBus.on('editor-input-blur', this.handleInputBlur, this);

    // Focus Game on click
    this.input.on('pointerdown', () => {
        this.game.canvas.focus();
        window.focus();
    });

    // Notify UI we are ready
    this.time.delayedCall(100, () => {
        EventBus.emit('scene-ready', { scene: 'EditorScene' });
        // Enforce Default Tool sync
        EventBus.emit('editor-tool-change-internal', { tool: 'paint', tileIndex: 1 });
    });

    // Exit Listener
    EventBus.on('exit-game', () => {
        this.scene.start('MenuScene');
    }, this);
    
    // Default Tool: Paint Wall
    this.currentTool = 'paint';
    this.currentTileIndex = 1;

    // Globals
    this.mapGlobalVariables = [];
    this.mapGlobalScripts = [];
    EventBus.on('editor-update-globals', this.handleGlobalUpdate, this);
  }

  // Global State
  private mapGlobalVariables: any[] = []; // GlobalVariable[]
  private mapGlobalScripts: any[] = []; // Script[]

  private handleGlobalUpdate(data: { variables: any[], scripts: any[] }) {
      this.mapGlobalVariables = data.variables;
      this.mapGlobalScripts = data.scripts;
  }

  private handleInputFocus() {
      this.controlsEnabled = false;
      if (this.input.keyboard) {
          this.input.keyboard.enabled = false;
          // Clear captures to let browser handle the keys (like typing in textarea)
          this.input.keyboard.clearCaptures();
      }
  }

  private handleInputBlur() {
      this.controlsEnabled = true;
      if (this.input.keyboard) {
          this.input.keyboard.enabled = true;
          // Re-enable captures for game controls if needed
          // WASDQE are handled by this.controls (SmoothedKeyControl) which uses Key objects.
          // We might want to re-add captures just in case, but usually enabled=true is enough if keys exist.
      }
  }
  
  private controlsEnabled: boolean = true;

  update(time: number, delta: number) {
      if (!this.controlsEnabled) return;

      this.controls.update(delta);
  }

  shutdown() {
      // ... (existing cleanup)
      EventBus.off('editor-tool-change', this.handleToolChange, this);
      EventBus.off('editor-map-resize', this.handleMapResize, this);
      EventBus.off('editor-brush-update', this.handleBrushUpdate, this);
      EventBus.off('editor-object-select', this.handleObjectSelect, this);
      EventBus.off('editor-object-delete', this.handleObjectDelete, this);
      EventBus.off('editor-object-update-prop', this.handleObjectUpdateProp, this);
      EventBus.off('editor-grid-update', this.handleGridSizeUpdate, this);
      EventBus.off('editor-object-add-script', this.handleAddScript, this);
      EventBus.off('editor-script-update', this.handleScriptUpdate, this);
      EventBus.off('editor-script-delete', this.handleScriptDelete, this);
      EventBus.off('editor-update-globals', this.handleGlobalUpdate, this);
      EventBus.off('editor-input-focus', this.handleInputFocus, this);
      EventBus.off('editor-input-blur', this.handleInputBlur, this);
      EventBus.off('exit-game');
      this.tiles.clear();
      if (this.cursorGraphics) this.cursorGraphics.clear();
  }
  
  private createEditorTextures() {
      // Wall (Light Brown with Brown X)
      if (!this.textures.exists('editor_wall')) {
          const g = this.make.graphics({x:0, y:0});
          g.fillStyle(0x8B5A2B); // Light Brown
          g.fillRect(0,0,32,32);
          g.lineStyle(2, 0x3E2723); // Dark Brown
          g.strokeRect(0,0,32,32);
          // X pattern
          g.lineStyle(2, 0x3E2723);
          g.moveTo(0,0); g.lineTo(32,32);
          g.moveTo(32,0); g.lineTo(0,32);
          g.generateTexture('editor_wall', 32, 32);
          g.destroy();
      }

      // Floor (Dark Tile)
      if (!this.textures.exists('editor_floor')) {
          const g = this.make.graphics({x:0, y:0});
          g.fillStyle(0x222222);
          g.fillRect(0,0,32,32);
          g.lineStyle(1, 0x333333); // Faint border
          g.strokeRect(0,0,32,32);
          g.generateTexture('editor_floor', 32, 32);
          g.destroy();
      }

      // Water (Blue with details)
      if (!this.textures.exists('editor_water')) {
          const g = this.make.graphics({x:0, y:0});
          g.fillStyle(0x004488); // Deep Blue
          g.fillRect(0,0,32,32);
          
          g.fillStyle(0x0088BB, 0.6); // Light Blue details
          g.fillCircle(8, 8, 4);
          g.fillCircle(24, 24, 6);
          g.fillCircle(24, 8, 2);
          
          // Wave line
          g.lineStyle(1, 0x0088BB, 0.8);
          g.beginPath();
          g.moveTo(5, 20);
          g.lineTo(10, 25);
          g.lineTo(15, 20);
          g.strokePath();

          g.generateTexture('editor_water', 32, 32);
          g.destroy();
      }

      // Grass (Green)
      if (!this.textures.exists('editor_grass')) {
          const g = this.make.graphics({x:0, y:0});
          g.fillStyle(0x114411);
          g.fillRect(0,0,32,32);
          g.fillStyle(0x226622); // Specs
          g.fillRect(5,5,2,2); g.fillRect(20,10,2,2); g.fillRect(10,25,2,2);
          g.generateTexture('editor_grass', 32, 32);
          g.destroy();
      }
  }

  private createGrid() {
    if (this.gridGraphics) this.gridGraphics.destroy();
    
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.lineStyle(1, this.GRID_COLOR, this.GRID_ALPHA);

    // World size based on tiles
    const widthPx = this.mapWidth * this.TILE_SIZE;
    const heightPx = this.mapHeight * this.TILE_SIZE;
    
    // Vertical lines
    for (let x = 0; x <= widthPx; x += this.TILE_SIZE) {
      this.gridGraphics.moveTo(x, 0);
      this.gridGraphics.lineTo(x, heightPx);
    }

    // Horizontal lines
    for (let y = 0; y <= heightPx; y += this.TILE_SIZE) {
      this.gridGraphics.moveTo(0, y);
      this.gridGraphics.lineTo(widthPx, y);
    }

    this.gridGraphics.strokePath();
    this.gridGraphics.setDepth(100); // Grid on top
  }

  private handleMapResize(data: { width: number, height: number }) {
      this.mapWidth = data.width;
      this.mapHeight = data.height;
      this.createGrid();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (pointer.middleButtonDown()) {
        this.isPanning = true;
        this.lastPanPoint.set(pointer.x, pointer.y);
        this.game.canvas.style.cursor = 'grabbing';
        return;
    }

    if (!pointer.primaryDown) return;

    // Focus game
    this.game.canvas.focus();
    window.focus();

    if (this.currentTool === 'place_object') {
        this.placeObject(pointer);
    } else if (this.currentTool === 'select') {
        this.selectObject(pointer);
    } else {
        // Paint/Erase
        this.isDrawing = true;
        this.paintTile(pointer);
    }
    this.updateCursor(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
      if (this.isPanning) {
          const dx = (pointer.x - this.lastPanPoint.x) / this.cameras.main.zoom;
          const dy = (pointer.y - this.lastPanPoint.y) / this.cameras.main.zoom;
          
          this.cameras.main.scrollX -= dx;
          this.cameras.main.scrollY -= dy;
          
          this.lastPanPoint.set(pointer.x, pointer.y);
          return;
      }

      if (this.currentTool === 'select' && this.isDraggingObject && this.selectedObject) {
          const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
          
          let gx = Math.round(worldPoint.x / this.gridSize) * this.gridSize;
          let gy = Math.round(worldPoint.y / this.gridSize) * this.gridSize;
          
          // Apply offsets if needed (for standard 32x32, we add 16. For MysteryBox 64x32, we add 0 for X, 16 for Y)
          const type = this.selectedObject.type;
          
          if (type === 'MysteryBox') {
               const rot = this.selectedObject.rotation || 0;
               // 0 or 180 (Horizontal): W=64, H=32. Center X on grid (0), Center Y on tile (16)
               // 90 or 270 (Vertical): W=32, H=64. Center X on tile (16), Center Y on grid (0)
               
               if (Math.abs(rot) === 90 || Math.abs(rot) === 270) {
                   gx += 16;
                   gy += 0;
               } else {
                   gx += 0;
                   gy += 16;
               }
          } else {
               gx += 16;
               gy += 16;
          }

          this.selectedObject.x = gx;
          this.selectedObject.y = gy;
          
          if (this.selectedObject.sprite instanceof Phaser.GameObjects.Container) {
             this.selectedObject.sprite.setPosition(this.selectedObject.x, this.selectedObject.y);
          } else {
             this.selectedObject.sprite.setPosition(this.selectedObject.x, this.selectedObject.y);
          }
          
          EventBus.emit('editor-object-selected', {
              id: this.selectedObject.id,
              type: this.selectedObject.type,
              x: this.selectedObject.x,
              y: this.selectedObject.y,
              properties: this.selectedObject.properties
          });
      } else if (this.isDrawing) {
          this.paintTile(pointer);
      }
      this.updateCursor(pointer);
  }

  private handlePointerUp() {
      if (this.isPanning) {
          this.isPanning = false;
          this.game.canvas.style.cursor = 'default';
      }
      this.isDrawing = false;
      this.isDraggingObject = false;
  }

  private handleBrushUpdate(data: { shape: 'square' | 'circle', width: number, height: number }) {
      this.brushSettings = data;
  }
  
  private handleGridSizeUpdate(size: number) {
      this.gridSize = size;
  }

  private paintTile(pointer: Phaser.Input.Pointer) {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      const centerX = Math.floor(worldPoint.x / this.TILE_SIZE);
      const centerY = Math.floor(worldPoint.y / this.TILE_SIZE);
      
      const width = this.brushSettings.width;
      const height = this.brushSettings.height;
      const shape = this.brushSettings.shape;

      const startX = centerX - Math.floor((width - 1) / 2);
      const startY = centerY - Math.floor((height - 1) / 2);
      
      for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
              const tileX = startX + x;
              const tileY = startY + y;
              if (tileX < 0 || tileY < 0 || tileX >= this.mapWidth || tileY >= this.mapHeight) continue;
              
              if (shape === 'circle') {
                  const bcx = (width - 1) / 2;
                  const bcy = (height - 1) / 2;
                  const a = width / 2;
                  const b = height / 2;
                  if ((Math.pow((x - bcx)/a, 2) + Math.pow((y - bcy)/b, 2)) > 1.0) continue; 
              }
              this.applyTileAction(tileX, tileY);
          }
      }
  }

  private applyTileAction(tileX: number, tileY: number) {
      const key = `${tileX},${tileY}`;
      if (this.currentTool === 'erase') {
          if (this.tiles.has(key)) {
              this.tiles.get(key)!.destroy();
              this.tiles.delete(key);
          }
      } else {
          const existing = this.tiles.get(key);
          const texture = this.getTextureKey(this.currentTileIndex);
          if (existing) {
              if (existing.texture.key === texture) return;
              existing.destroy();
          }
          const tile = this.add.image(tileX * this.TILE_SIZE + 16, tileY * this.TILE_SIZE + 16, texture);
          this.tiles.set(key, tile);
      }
  }

  private getTextureKey(index: number): string {
      switch(index) {
          case 0: return 'editor_floor';
          case 1: return 'editor_wall';
          case 2: return 'editor_water';
          case 3: return 'editor_grass';
          default: return 'editor_floor';
      }
  }

  private updateCursor(pointer: Phaser.Input.Pointer) {
      this.cursorGraphics.clear();
      
      // Draw Selection Outline (Blue) with Rotation support
      if (this.selectedObject) {
          this.cursorGraphics.lineStyle(2, 0x00ffff, 1);
          
          const obj = this.selectedObject;
          const cx = obj.x;
          const cy = obj.y;
          const w = obj.width;
          const h = obj.height;
          const rot = Phaser.Math.DegToRad(obj.rotation || 0);
          
          // Calculate corners
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          
          const halfW = w / 2;
          const halfH = h / 2;
          
          const points = [
              { x: -halfW, y: -halfH },
              { x: halfW, y: -halfH },
              { x: halfW, y: halfH },
              { x: -halfW, y: halfH }
          ].map(p => ({
              x: cx + (p.x * c - p.y * s),
              y: cy + (p.x * s + p.y * c)
          }));
          
          this.cursorGraphics.strokePoints(points, true, true);
      }

      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;

      // If dragging, we are done
      if (this.currentTool === 'select' && this.isDraggingObject) return;
      
      if (this.currentTool === 'place_object') {
           // Show Preview of Object placement
           let w = 32; let h = 32;
           // Adjust for type
           if (this.currentObjectType === 'MysteryBox') { w = 64; h = 32; }
           
           // Alignment Logic
           let x = Math.round(worldPoint.x / this.gridSize) * this.gridSize;
           let y = Math.round(worldPoint.y / this.gridSize) * this.gridSize;
           
           if (this.currentObjectType === 'MysteryBox') {
               // 0 offset X, 16 offset Y
               y += 16;
           } else if (this.currentObjectType === 'SpawnPoint') {
               // Standard center offset
                x += 16;
                y += 16;
                this.cursorGraphics.lineStyle(2, 0x00ffff, 0.8); // Cyan for SpawnPoint
                this.cursorGraphics.strokeRect(x - w/2, y - h/2, w, h);
                return;
           } else {
               x += 16;
               y += 16;
           }

           this.cursorGraphics.lineStyle(2, 0x00ff00, 0.8);
           this.cursorGraphics.strokeRect(x - w/2, y - h/2, w, h);
           return;
      }
      
      // Normal Tile Cursor
      const centerX = Math.floor(worldPoint.x / this.TILE_SIZE);
      const centerY = Math.floor(worldPoint.y / this.TILE_SIZE);
  
      const width = this.brushSettings.width;
      const height = this.brushSettings.height;
      const shape = this.brushSettings.shape;

      // Calculate Range (Centered)
      const startX = centerX - Math.floor((width - 1) / 2);
      const startY = centerY - Math.floor((height - 1) / 2);

      const pxX = startX * this.TILE_SIZE;
      const pxY = startY * this.TILE_SIZE;
      const pxW = width * this.TILE_SIZE;
      const pxH = height * this.TILE_SIZE;

      if (this.currentTool === 'erase') {
          this.cursorGraphics.lineStyle(2, 0xff0000, 0.8);
      } else {
          this.cursorGraphics.lineStyle(2, 0xaaaaaa, 0.8);
      }

      if (shape === 'square') {
          this.cursorGraphics.strokeRect(pxX, pxY, pxW, pxH);
      } else {
          this.cursorGraphics.strokeEllipse(pxX + pxW/2, pxY + pxH/2, pxW, pxH);
      }
  }

  // Correct placeObject logic for alignment and rotation
  private placeObject(pointer: Phaser.Input.Pointer) {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      
      const type = this.currentObjectType;
      let width = 32;
      let height = 32;
      
      if (type === 'MysteryBox') {
          width = 64; 
          height = 32;
      }
      
      // Snap Logic
      let x = Math.round(worldPoint.x / this.gridSize) * this.gridSize;
      let y = Math.round(worldPoint.y / this.gridSize) * this.gridSize;

      if (type === 'MysteryBox') {
          // No offset for X (Center on grid line means splitting 2 tiles perfectly i.e. 32 -> 0..64)
          // Add 16 for Y (Center on tile center)
          y += 16;
      } else if (type === 'SpawnPoint') {
          // Validation: Cannot place on Wall
          // We check the center or corners. Let's check the center tile.
          const tileX = Math.floor(x / this.TILE_SIZE);
          const tileY = Math.floor(y / this.TILE_SIZE);
          
          if (this.tiles.has(`${tileX},${tileY}`)) {
              const tile = this.tiles.get(`${tileX},${tileY}`);
              if (tile && tile.texture.key === 'editor_wall') {
                  // It's a wall! Fail.
                  // Ideally show a toast/notification, but for now just return.
                  console.warn("Cannot place SpawnPoint on a Wall");
                  return;
              }
          }
          
          // Also check Grid edges if 32x32? 
          // Editor logic: Objects are placed at grid snaps. 
          // If we are placing a 32x32 object at x,y (center), it occupies exactly one tile if aligned.
          // x,y are snapped.
          
          x += 16;
          y += 16;
      } else {
          x += 16;
          y += 16;
      }

      // 1. Overlap Check (Replace existing)
      const existingIdsToDelete: string[] = [];
      for (const obj of this.editorObjects.values()) {
           if (Math.abs(obj.x - x) < 5 && Math.abs(obj.y - y) < 5) {
               existingIdsToDelete.push(obj.id);
           }
      }

      // Enforce Single Spawn Point
      if (type === 'SpawnPoint') {
          for (const obj of this.editorObjects.values()) {
              if (obj.type === 'SpawnPoint') {
                  existingIdsToDelete.push(obj.id);
              }
          }
      }

      existingIdsToDelete.forEach(id => {
          this.editorObjects.get(id)?.sprite.destroy();
          this.editorObjects.delete(id);
      });

      const id = Phaser.Utils.String.UUID();
      const properties: any = {};

      if (type === 'MysteryBox') {
          properties.cost = 950;
          properties.rotation = 0;
      } else if (type === 'PackAPunch') {
          properties.cost = 5000;
      } else if (type === 'Door') {
           properties.cost = 500;
           properties.zone = 0;
           this.replaceTileUnderObject(x, y);
      } else if (type === 'Barricade') {
           this.replaceTileUnderObject(x, y);
      } else if (type === 'PerkMachine') {
           properties.cost = 1000;
           properties.perk = 'JUGGERNOG';
      } else if (type === 'WallBuy') {
           properties.cost = 500;
           properties.weapon = 'PISTOL';
      }

      // Visuals
      const container = this.add.container(x, y);
      const gfx = this.add.graphics();
      
      if (type === 'TriggerZone') {
          gfx.lineStyle(2, 0xffff00, 1);
          gfx.fillStyle(0xffff00, 0.2); // Transparent Yellow
          // Default radius 32
          const radius = properties.radius || 32;
          gfx.strokeCircle(0, 0, radius);
          gfx.fillCircle(0, 0, radius);
          // Set body size for selection (approximate box)
          width = radius * 2;
          height = radius * 2;
      } else if (type === 'CustomObject') {
          const color = parseInt((properties.color || '#888888').replace('#', '0x'));
          gfx.lineStyle(2, 0xffffff, 1);
          gfx.fillStyle(color, 0.8);
          width = properties.width || 32;
          height = properties.height || 32;
          gfx.strokeRect(-width/2, -height/2, width, height);
          gfx.fillRect(-width/2, -height/2, width, height);
      } else if (type === 'Spawner') gfx.fillStyle(0xff0000, 0.7);
      else if (type === 'SpawnPoint') gfx.fillStyle(0x00ffff, 0.7); // Cyan
      else if (type === 'Barricade') gfx.fillStyle(0x8B4513, 0.7);
      else if (type === 'Door') gfx.fillStyle(0x888888, 0.7);
      else if (type === 'MysteryBox') gfx.fillStyle(0x0000ff, 0.7);
      else if (type === 'PerkMachine') gfx.fillStyle(0x00ff00, 0.7);
      else gfx.fillStyle(0xaaaaaa, 0.7);
      
      gfx.fillRect(-width/2, -height/2, width, height);
      
      // Face indicator for rotation
      gfx.fillStyle(0xffffff, 0.8);
      gfx.fillRect((width/2) - 4, -2, 4, 4); // Little notch on right

      const label = properties.name || type.substring(0, 4);
      const text = this.add.text(0, 0, label, { fontSize: '10px', color: '#ffffff' });
      text.setOrigin(0.5);
      
      container.add([gfx, text]);
      container.setSize(width, height);
      
      const obj: EditorObject = {
          id,
          type,
          x,
          y,
          rotation: 0,
          width,
          height,
          sprite: container,
          properties
      };

      this.editorObjects.set(id, obj);
      this.selectedObject = obj;
      EventBus.emit('editor-object-selected', { ...obj, sprite: undefined, scripts: [] });
  }

  private handleAddScript(data: { id: string, script: any }) {
    const obj = this.editorObjects.get(data.id);
    if (!obj) return;
    
    if (!obj.scripts) obj.scripts = [];
    obj.scripts.push(data.script);
    
    // Refresh selection to show new script
    if (this.selectedObject && this.selectedObject.id === data.id) {
         EventBus.emit('editor-object-selected', {
            id: obj.id,
            type: obj.type,
            x: obj.x,
            y: obj.y,
            properties: obj.properties,
            scripts: obj.scripts
        });
    }
  }
  
  private handleScriptUpdate(data: { id: string, index: number, script: any }) {
      const obj = this.editorObjects.get(data.id);
      if (!obj || !obj.scripts) return;
      
      obj.scripts[data.index] = data.script;
      
      if (this.selectedObject && this.selectedObject.id === data.id) {
          EventBus.emit('editor-object-selected', { ...obj, sprite: undefined });
      }
  }

  private handleScriptDelete(data: { id: string, index: number }) {
      const obj = this.editorObjects.get(data.id);
      if (!obj || !obj.scripts) return;
      
      obj.scripts.splice(data.index, 1);
      
      if (this.selectedObject && this.selectedObject.id === data.id) {
          EventBus.emit('editor-object-selected', { ...obj, sprite: undefined });
      }
  }
  
  private replaceTileUnderObject(x: number, y: number) {
      // Convert world x/y to tile coordinates
      const tileX = Math.floor(x / this.TILE_SIZE);
      const tileY = Math.floor(y / this.TILE_SIZE);
      
      // Set to Floor (0)
      const prevTool = this.currentTool;
      const prevIndex = this.currentTileIndex;
      
      this.currentTileIndex = 0; // Temp switch to floor
      this.currentTool = 'paint'; // Ensure applyTileAction treats it as paint
      
      if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
           this.applyTileAction(tileX, tileY);
      }
      
      this.currentTool = prevTool;
      this.currentTileIndex = prevIndex;
  }

  private selectObject(pointer: Phaser.Input.Pointer) {
      const worldPoint = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      
      // Simple reverse check (topmost first)
      let found: EditorObject | null = null;
      for (const obj of this.editorObjects.values()) {
          // AABB check
          if (
              worldPoint.x >= obj.x - obj.width/2 &&
              worldPoint.x <= obj.x + obj.width/2 &&
              worldPoint.y >= obj.y - obj.height/2 &&
              worldPoint.y <= obj.y + obj.height/2
          ) {
              found = obj;
              // Don't break immediately if we want z-indexing, but map is usually flat.
          }
      }

      this.selectedObject = found;
      
      if (found) {
          this.isDraggingObject = true;
          EventBus.emit('editor-object-selected', {
              id: found.id,
              type: found.type,
              x: found.x,
              y: found.y,
              properties: found.properties,
              scripts: found.scripts || []
          });
      } else {
          EventBus.emit('editor-object-deselected');
      }
  }

  private handleObjectSelect(data: { type: string }) {
      this.currentObjectType = data.type;
      this.currentTool = 'place_object';
  }

  private handleObjectDelete() {
      if (this.selectedObject) {
          this.selectedObject.sprite.destroy();
          this.editorObjects.delete(this.selectedObject.id);
          this.selectedObject = null;
          EventBus.emit('editor-object-deselected');
      }
  }

  private handleObjectUpdateProp(data: { id: string, key: string, value: any }) {
      const obj = this.editorObjects.get(data.id);
      if (!obj) return;
      
      obj.properties[data.key] = data.value;

      // Handle Container-based Objects (Visuals + Text)
      // obj.sprite is a Container containing [Graphics, Text]
      const container = obj.sprite as Phaser.GameObjects.Container;
      
      // Update Name Label
      if (data.key === 'name') {
          const text = container.getAt(1) as Phaser.GameObjects.Text;
          if (text) {
              text.setText(data.value || obj.type.substring(0, 4));
          }
      }
      
      // Handle Position Updates (X/Y)
      if (data.key === 'x' || data.key === 'y') {
          if (data.key === 'x') obj.x = data.value;
          if (data.key === 'y') obj.y = data.value;
          
          if (obj.type === 'CustomObject' || obj.type === 'TriggerZone' || obj.type === 'SpawnPoint') {
               // Container based
               container.setPosition(obj.x, obj.y);
          } else {
               // Sprite based (potentially) - Wait, do all use containers now?
               // placeObject uses container for Custom/Trigger/Visuals? 
               // Standard objects (Door, etc) use `this.add.image` or `sprite`.
               // Let's check `placeObject`. Standard objects use `this.add.image`.
               // Only Custom/Trigger/Visuals use Container logic in my recent edit.
               // Actually, `handleObjectUpdateProp` early on casts `obj.sprite as Container`.
               // This is risky if standard objects are Images.
               // FIX: Check type before casting.
          }
           
          // Universal move
          if (obj.sprite instanceof Phaser.GameObjects.Container || obj.sprite instanceof Phaser.GameObjects.Sprite || obj.sprite instanceof Phaser.GameObjects.Image) {
              obj.sprite.setPosition(obj.x, obj.y);
          }
      }

      // Handle Redraws for Custom Visuals
      if (['width', 'height', 'color', 'radius'].includes(data.key)) {
          const gfx = container.getAt(0) as Phaser.GameObjects.Graphics;
          if (gfx) {
              gfx.clear();

              if (obj.type === 'CustomObject') {
                  const w = obj.properties.width || 32;
                  const h = obj.properties.height || 32;
                  // Update logical dimensions for selection
                  obj.width = w;
                  obj.height = h;

                  const color = parseInt((obj.properties.color || '#888888').replace('#', '0x'));
                  
                  gfx.lineStyle(2, 0xffffff, 1);
                  gfx.fillStyle(color, 0.8);
                  gfx.strokeRect(-w/2, -h/2, w, h);
                  gfx.fillRect(-w/2, -h/2, w, h);
                  
                  // Update Physics body
                  const body = container.body as Phaser.Physics.Arcade.Body;
                  if (body) {
                      body.setSize(w, h);
                      body.setOffset(-w/2, -h/2);
                  }
              } else if (obj.type === 'TriggerZone') {
                  const r = obj.properties.radius || 32;
                  
                  // Update logical dimensions for selection
                  obj.width = r * 2;
                  obj.height = r * 2;

                  gfx.lineStyle(2, 0xffff00, 1);
                  gfx.fillStyle(0xffff00, 0.2);
                  gfx.strokeCircle(0, 0, r);
                  gfx.fillCircle(0, 0, r);
                  
                  const body = container.body as Phaser.Physics.Arcade.Body;
                  if (body) {
                      body.setSize(r * 2, r * 2);
                      body.setOffset(-r, -r);
                  }
              }
          }
      }
      
      // Handle Rotation
      if (data.key === 'rotation') {
           const rot = data.value;
           obj.rotation = rot;
           
           // Rotate the container
           container.setAngle(rot);
           
           // MysteryBox Snap Logic (90 degree turns need offset shift)
           if (obj.type === 'MysteryBox') {
               let gx = Math.round(obj.x / this.gridSize) * this.gridSize;
               let gy = Math.round(obj.y / this.gridSize) * this.gridSize;
               
               if (Math.abs(rot) === 90 || Math.abs(rot) === 270) {
                   // Vertical: Center on Grid Y, Offset X
                   obj.x = gx + 16;
                   obj.y = gy; 
               } else {
                   // Horizontal: Center on Grid X, Offset Y
                   obj.x = gx;
                   obj.y = gy + 16;
               }
               container.setPosition(obj.x, obj.y);
           }
      }
      
      // Update Selection Highlight
      if (this.selectedObject && this.selectedObject.id === obj.id) {
          EventBus.emit('editor-object-selected', {
             id: obj.id, 
             type: obj.type, 
             x: obj.x, 
             y: obj.y, 
             properties: obj.properties 
          });
      }
  }

  private handleToolChange(data: { tool: 'paint' | 'erase' | 'select' | 'place_object', tileIndex: number }) {
      this.currentTool = data.tool;
      this.currentTileIndex = data.tileIndex;
      // If switching away from select/place, deselect
      if (data.tool === 'paint' || data.tool === 'erase') {
          this.selectedObject = null;
          EventBus.emit('editor-object-deselected');
      }
  }
}
