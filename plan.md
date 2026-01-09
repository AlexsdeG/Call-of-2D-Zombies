## Phase 0: Infrastructure & Configuration (The Bedrock)
**Goal:** Initialize the project with a secure, type-safe foundation and central configuration management.

*   **Step 0.1: Project scaffolding**
    *   Initialize `pnpm create vite` (React + TypeScript).
    *   Install core dependencies: `phaser`, `zustand`, `peerjs`, `localforage`, `zod`, `phaser-raycaster`, `easystarjs`.
    *   Set up `sass` or `tailwind` for the UI overlay.
    *   Configure `tsconfig.json` (Strict Mode).

*   **Step 0.2: Configuration System (Config-First Approach)**
    *   Create `/src/config/` directory.
    *   Create `gameConfig.ts`: Canvas size, renderer type, debug flags.
    *   Create `constants.ts`: Global magic numbers (Default Walking Speed, Max Zombies Limit, Interaction Radius).
    *   Create `controls.ts`: Key mappings (WASD, R, F, Mouse).
    *   **AI Instruction:** Ensure all subsequent code references these files, never hardcoded numbers.

*   **Step 0.3: State Management & Bridge**
    *   Create `useGameStore.ts` (Zustand) to manage: `gameState` (MENU/GAME/EDITOR), `playerStats` (Health, Ammo), `networkState`.
    *   Create `PhaserGame.tsx`: The React component acting as the container for the Phaser Canvas.
    *   Implement the `EventBus`: A singleton emitter to pass signals between Phaser Scenes and React Components (e.g., `emit('weaponChanged')`).

---

## Phase 1: Core Mechanics & "Game Feel" (The Prototype)
**Goal:** A player moving in a dark environment with a flashlight, shooting dummy targets with satisfying feedback.

*   **Step 1.1: Player Controller & Physics**
    *   Create `Player.ts`. Implement WASD movement logic.
    *   Implement "Look at Mouse" rotation.
    *   Implement `StaminaSystem`: Sprinting with Shift (depletes stamina bar).

*   **Step 1.2: Advanced Vision System (Fog of War)**
    *   Initialize `phaser-raycaster` plugin.
    *   Create `VisionManager.ts`.
    *   Implement the **View Cone**:
        *   Attach a light source to the player.
        *   Read `coneAngle` and `rayCount` from config.
        *   Implement "Fog": Create a dark graphics layer and mask it using the raycast polygon. Entities outside the polygon are hidden.

*   **Step 1.3: The Weapon Architecture**
    *   Create `WeaponAttribute` interface (recoil, sway, damage, penetration, fireMode).
    *   Create `WeaponSystem.ts`.
    *   Implement **Sway**: Use 1D Perlin noise to slightly offset the crosshair when idle/moving.
    *   Implement **Recoil**: Push the camera and the gun sprite backwards on shoot.
    *   Implement **Ballistics**:
        *   Raycast (Hitscan) for Snipers.
        *   Physics Body (Projectile) for Rocket Launchers.
    *   **Test:** Create a "Shooting Range" scene with dummy targets.

---

## Phase 2: The Enemy & Environment (Survival Basics)
**Goal:** A playable map where zombies spawn, chase via pathfinding, and attack barriers.

*   **Step 2.1: Map Data & Validation**
    *   Define the Map Schema in **Zod** (`src/schemas/mapSchema.ts`).
    *   Create `MapManager.ts`: Load JSON maps.
    *   Implement Tile Layers: `Floor` (Walkable), `Walls` (Collidable/Opaque to Raycaster).

*   **Step 2.2: Zombie AI & Pathfinding**
    *   Initialize `EasyStar.js` instance using the Tilemap grid.
    *   Create `ZombieBase.ts` class.
    *   Implement State Machine:
        *   `SPAWN`: Animation (rise from ground).
        *   `PATHING`: Request A* path to Player.
        *   `CHASE`: Direct movement if line-of-sight exists.
        *   `ATTACK`: Deal damage if in range.
    *   **Optimization:** Implement a "Path Request Queue" so only 2-3 zombies calculate paths per tick.

*   **Step 2.3: Interactables & Barriers**
    *   Create `Barricade` entity (Window in wall or thorugh floor), both can be patched up with F
    *   Logic: Zombies stop to attack it. Player holds 'F' to repair.
    *   Create `Door` entity. Purchase with points to remove collision and recalculate NavMesh.

---

## Phase 3: The "Zombies" Loop (Systems & Logic)
**Goal:** Full implementation of rounds, economy, perks, and the Director AI.

*   **Step 3.1: Wave Manager & Director AI**
    *   Create `DirectorSystem.ts`.
    *   Implement `StressMeter`: Monitor player HP/Ammo history.
    *   Implement `SpawnBudget`: Logic to convert Round Number -> Point Pool.
    *   Implement "Dynamic Events": If Stress is low, spawn "Dog Round" or "Boss Zombie".

*   **Step 3.2: Economy & Items**
    *   Implement `PointsSystem`: +10 on hit, +100 on kill.
    *   Implement `WallBuy`: Interact to swap weapon/buy ammo.
    *   Implement `MysteryBox`:
        *   Logic: Randomize from weighted weapon list.
        *   "Teddy Bear": If rolled, trigger move animation to new spawn point.

*   **Step 3.3: Perks & Upgrades**
    *   Create `PerkMachine` class (Juggernog, Speed Cola, etc.).
    *   Implement `PackAPunch`: UI to upgrade held weapon (changes stats, skin, projectile color).
    *   Implement `PowerUps`: Zombies drop icons (Nuke, Max Ammo, 2x, insta kill, hammer (hammer makes all barricades max panels)) that apply global effects.

---

## Phase 4: The Map Editor (Creative Suite)
**Goal:** A full in-browser editor allowing users to build and script maps.

*   **Step 4.1: Editor UI & Interaction**
    *   Create `EditorScene.ts` (Paused physics, grid overlay).
    *   Create React Sidebar: Tabs for "Tiles", "Objects", "Settings".
    *   Implement `TilePainter`: Click to place floor/wall tiles.

*   **Step 4.2: Object Placement & Configuration**
    *   Implement `ObjectPlacer`: Drag entities (Spawners, Machines, Perks, Baricades, Doors, Mystery Box, PackAPunch, WallBuy) onto the grid.
    *   Implement `PropertyInspector`: When an object is clicked, show a Form to edit its JSON properties (e.g., `DoorCost`, `WeaponID`).
    *   custom rotation for objects, move them pixel wise (free movement and snap to grid + in editor transform options) + add inspector to set rotation,position, scale, scripts (later), attribtues, hook and more (eg set layer, target layer or world layer). inspector shows current select entity object and allows to edit it.

    *   **Step 4.3: Scripting System**
    *   Design the "Trigger/Action" JSON format.
    *   Implement `ScriptEditor` UI: Add simple code editor (e.g., `IF PlayerEntersZone(A) THEN SpawnZombie(Boss)`). + here allow to write in simple text editor to create custom logic eg in simple programing language or javascript. high security with analyzer for malicious code, high security robust.
    *   allow to attach scirpts to spawners, machines, perks, barricades, doors, mystery box, packapunch, wallbuy, zombies, players, etc. all objects + add in inspector to set scripts.
    *   add some hooks to entites to allow some interaction with code. write here full documentaion into readme what hooks and functions can be called (eg setter/getter and otehr stuff, hooks to add new skripts at init, start in game loop)
    *   section for general scirpts + section for gamemode to create a custom gamemode file
    *   implement into code also the trigger zone to allow listens on enter and leave events
    *   also add interactoin in code to use oher objects in the scene, eg maniplulate other objects, use other objects, list obects in sceen, get them by name or id, etc. set paramters, positoin velocity and more.
    *   Implement `ScriptEngine`: The runtime interpreter that executes these scripts during the game.

*   **Step 4.4: File I/O**
    *   Implement "Save Project": Serialize map to JSON -> Store in `localForage`.
    *   Implement "Export/Import": Download/Upload `.json` files (validated by Zod). create export and improter which read the files and use the internal logic to use the game engine to use the created assets in game, to translate the editor map to a real game map, similar to defaultmap, here needs good translator.
    *   Implement "Load Project": Deserialize map from JSON -> Load into EditorScene. + high security with analyzer for malicious code, high security robust. load also all textures and assets, eg for custom objects.
    *   Implement "Preview": here load the map data into a real game to test everything, with esc menu or death, add option return to editor agian. here add preview button to top menu bar. this button will render the game using the ingame renderer but uses map data of the editor as map. to play preview, map has to be saved first. and validated.
    *   Implement also bedite Preview a Validation button this checks the mapp data for errors, checks all scripts and runs also the process to translate the editor map to a real game map, similar to defaultmap, here needs good translator. this will show also errors and warnings in a extra modal window.

*   **Step 5: History Undo/Redo**
    *   Implement "History": Implement undo/redo functionality for map changes. this allows all new updates while editing to be undone and redone. dont save or export history, only keep it in memory.
    *   Implement "History" UI: Show history in a sidebar as new tab. allow to select a specific history entry and apply it to the map. + add forward and backward buttons to navigate through history into the top menu bar perfectly in the middle, inbetween the Beta Label and save button.
    
---

## Phase 5: Profiles & Persistence
**Goal:** Long-term player progression.

*   **Step 5.1: Profile Manager**
    *   Define `ProfileSchema` (XP, WeaponLevels, Unlocks).
    *   Implement `ProfileService`: Save/Load logic using `localForage`.
    *   Implement "End of Game" logic: Calculate XP gained and update profile. show player and weapon stats and seperated xp for weapon and player. weapon xp is used to level up the weapon, like new attachments/skins

*   **Step 5.2: Customization UI**
    *   Create Main Menu "Loadout" screen.
    *   safe full profile in localstorage. and be able to import/export from filesystem
    *   Implement Weapon Kits: Select attachments/skins unlocked via Profile level.
    *   Implement "Game Settings": Custom difficulty, Fog settings (adjust cone angle), Director intensity. which are shown directly before game to setup game.
    *   Implement "Game Settings": Custom difficulty, Fog settings (adjust cone angle), Director intensity. which are shown directly before game to setup game.
    *   Implement "Game Settings": load custom maps, preloaded ones already in system and from files system. as well as map selector of pre build maps.

---

## Phase 6: Multiplayer (Network Layer)
**Goal:** Transform the single-player engine into a Host-Authoritative P2P game.

*   **Step 6.1: Networking Core**
    *   Refactor `InputManager`: Decouple local input from execution.
    *   Create `NetworkManager` (PeerJS).
    *   Implement `ConnectionLobby`: Host generates Room Code, Clients join.

*   **Step 6.2: Replication (Host)**
    *   The Host runs the `WaveManager`, `DirectorAI`, and `Physics`.
    *   Serialize `WorldState` (Positions, Health, Door States) -> Broadcast to clients (20-30Hz).
    *   send all game settings and data to clients. also send map data to clients. in lobby preload map data if custom map is selected, for seamless play.

*   **Step 6.3: Client Simulation**
    *   Implement `InputPacket`: Send Key presses/Mouse Angle to Host.
    *   Implement `StateInterpolation`: Smoothly animate entities between server snapshots.
    *   Implement `Prediction`: Move local player immediately, correct if Host disagrees (Reconciliation).

---

## Phase 7: Polish & Finalization
**Goal:** Security checks, audio, and visual juice.

*   **Step 7.1: Audio & Atmosphere**
    *   Implement `SoundManager` with spatial audio (panning based on position).
    *   Add Ambient Sounds (Wind, distant screams).
    *   Add Feedback Sounds (Headshot crunch, Cash register chaching).

*   **Step 7.2: Visual Effects (Juice)**
    *   Add Particles: Blood splatters (permanent decals option), Muzzle flash, Shell casings.
    *   Add "Screen Shake" on explosions.
    *   Add "Weapon Bob" animation while walking.

*   **Step 7.3: Security & Optimization**
    *   **Security:** Audit the `MapManager` to ensure custom scripts cannot execute arbitrary JS (sandbox the logic).
    *   **Performance:** Implement Object Pooling for Bullets and Zombies to prevent Garbage Collection stutters.
    *   **Testing:** Verify Map Import/Export limits and Multiplayer latency handling.