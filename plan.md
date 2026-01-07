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
    *   Implement `ObjectPlacer`: Drag entities (Spawners, Machines) onto the grid.
    *   Implement `PropertyInspector`: When an object is clicked, show a Form to edit its JSON properties (e.g., `DoorCost`, `WeaponID`).

*   **Step 4.3: Visual Scripting System**
    *   Design the "Trigger/Action" JSON format.
    *   Implement `ScriptEditor` UI: Add simple logic blocks (e.g., `IF PlayerEntersZone(A) THEN SpawnZombie(Boss)`).
    *   Implement `ScriptEngine`: The runtime interpreter that executes these scripts during the game.

*   **Step 4.4: File I/O**
    *   Implement "Save Project": Serialize map to JSON -> Store in `localForage`.
    *   Implement "Export/Import": Download/Upload `.json` files (validated by Zod).

---

## Phase 5: Profiles & Persistence
**Goal:** Long-term player progression.

*   **Step 5.1: Profile Manager**
    *   Define `ProfileSchema` (XP, WeaponLevels, Unlocks).
    *   Implement `ProfileService`: Save/Load logic using `localForage`.
    *   Implement "End of Game" logic: Calculate XP gained and update profile. show player and weapon stats and seperated xp for weapon and player. weapon xp is used to level up the weapon, like new attachments/skins

*   **Step 5.2: Customization UI**
    *   Create Main Menu "Loadout" screen.
    *   Implement Weapon Kits: Select attachments/skins unlocked via Profile level.
    *   Implement "Game Settings": Custom difficulty, Fog settings (adjust cone angle), Director intensity. which are shown directly before game to setup game.

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