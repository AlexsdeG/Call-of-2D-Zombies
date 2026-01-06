## 1. Project Overview & Philosophy

### 1.1 Project Identity
**Project Name:** Call of 2D Zombies (Top-Down Survival Shooter)
**Genre:** 2D Top-Down Shooter / Tower Defense / Sandbox
**Core Inspiration:** Call of Duty: Zombies (Round-based survival, perks, pack-a-punch, easter eggs).
**Platform:** Web Browser (Desktop optimized).

### 1.2 Development Philosophy
*   **Iterative Robustness:** The project must be built in small, distinct phases. Each phase must be fully functional, playable, and tested before moving to the next.
    *   *Example:* Do not build the "Perk System" until the "Base Player Health & Damage System" is flawless.
*   **Configuration First:** All magic numbers (speed, damage, fog density, color values) must be extracted into central configuration files (`/src/config/`) or easily accessible TypeScript constants to allow for rapid tweaking and balancing.
*   **Security & Performance:** Code must be strictly typed, memory-efficient (object pooling for bullets/zombies), and secure against XSS (especially in map data loading).

### 1.3 Game Idea

Top down 2d zomby
- multiple wepoans
- wall buys
- chest, with random possitions, bear
- mulitple weapons
- zombies drop stuff, like max ammo, 2x points, insta kill, fix all baricates/windows
- pack a punch
- many perks and machiens to buy them
- waves that get harder
- with positions where zombies spawn, which can be barikad/windows be closed like in zombies
- buy doors, or so to expand map and get to new areas
- mulitplayer using peerjs
- full robust efficent secure game
- different type of zombies, eg also boss zombies. dog rounds - with comprehensice npc and enemy ai
- move wasd, reload r, switch weapons with mouse wheel, look around with mouse.
- add a view cone which enemys, players, pickups, vending machienes are shown. walls are always visible
- profiles, saved in local storage (also with save, export and improt feature to save it to harddrive)
- profile: xp, level, unlocks, weapon levels and attachments to unlock, weapon skins
- all settings and attributes and const to set should be easy accessable, eg the cone settings so i can adjust the fog of war and cone to my needs. - game setup settings
- good and unique weapon feeling, differnet settings, recoil, sway, accuracy, distance, damage, fire mods, and more so weapon feel unique. - simple weapon editor inbetween rounds, saved in profile
- director ai Like Left 4 Dead, monitor player stress. If players are doing too well, spawn a boss. If they are dying, drop a "Max Ammo." - extra setting in game setup settings
- safe game settings, load safe them in local storage and to harddrive
editor:
- map builder, tile based. allow adding new tiles, objects, perks with icons, zoomby spawn point, also eg stairs (here also fully customazable with ability to create custom ones. here set custom icon uplaod one. set some stats and ability to add custom code). here also good textures like 
- full map and gamemode edior. here ditor with square tiles to create maps with all objects placeable and a nice insepctor to set settings, transformaion, link with js scripts, set type and set eg visibilty (if only visible in view cone, when locking at it). here like a mini game engine in the zombies game

---

## 2. Technology Stack

### 2.1 Core Frameworks
*   **Language:** **TypeScript** (Strict Mode enabled).
*   **Build Tool:** **Vite** (for HMR and optimized production builds).
*   **Package Manager:** **pnpm**.
*   **Game Engine:** **Phaser 3**.
    *   *Role:* Rendering (WebGL), Input handling, Arcade Physics, Audio, Asset management.
*   **UI Overlay:** **React**.
    *   *Role:* HUD, Main Menus, Inventory, Map Editor UI. React renders *on top* of the Phaser Canvas DOM element.
*   **State Management:** **Zustand**.
    *   *Role:* Bridging data between Phaser (Game Logic) and React (UI). Stores Global State (Score, Round, Health).

### 2.2 Libraries & Utilities
*   **Networking:** **PeerJS** (WebRTC wrapper).
    *   *Role:* P2P multiplayer. Avoids dedicated servers. Host-Authoritative architecture.
*   **Pathfinding:** **EasyStar.js** or **Phaser-NavMesh**.
    *   *Role:* A* pathfinding for Zombie AI to navigate complex user-created maps.
*   **Lighting/Vision:** **phaser-raycaster**.
    *   *Role:* Real-time 2D visibility polygons, Fog of War, Flashlight cones.
*   **Storage:** **localForage**.
    *   *Role:* Async wrapper for IndexedDB/LocalStorage for saving profiles and maps.
*   **Validation:** **Zod**.
    *   *Role:* Validating imported map JSON files to prevent crashes/exploits.


### 2.3 Attention
*   Import Phaser always like this otherwise error: import * as Phaser from 'phaser';

---

## 3. Core Systems & Architecture

### 3.1 The "Director" AI (Game Pacing)
Inspired by *Left 4 Dead*, this system runs on the Host machine and dynamically adjusts difficulty.
*   **Stress Meter:** A calculated value (0.0 to 1.0) based on:
    *   Player Health average.
    *   Ammo reserves.
    *   Time since last damage taken.
*   **Budget System:** Each round has a "Spawn Budget" (e.g., Round 10 = 500 points).
    *   Zombie: 10 pts.
    *   Dog: 25 pts.
    *   Boss: 150 pts.
*   **Dynamic Response:**
    *   *High Stress:* Reduce spawn rate temporarily, prioritize dropping "Max Ammo" or "Nuke" on next kill.
    *   *Low Stress (Boredom):* Spawn special enemies, increase spawn rate, trigger "Fog" weather event.

### 3.2 Weapon Mechanics (The "Feel")
Weapons are defined by scriptable objects (Interfaces), not hardcoded classes.
*   **WeaponAttributes Interface:**
    *   `fireMode`: 'AUTO' | 'SEMI' | 'BURST'.
    *   `fireRate`: Milliseconds between shots.
    *   `damage`: Base damage.
    *   `accuracy`: Base spread angle (in degrees).
    *   `recoil`: Visual kickback distance (pushes camera/gun sprite back).
    *   `sway`: Passive cursor movement (Perlin noise) when aiming.
    *   `range`: Max distance for raycast.
    *   `penetration`: How many enemies one bullet can pass through.
*   **Visuals:**
    *   **Muzzle Flash:** Dynamic light source and sprite at gun tip.
    *   **Casings:** Eject shell casings (physics particles) that linger on the floor.
    *   **Tracers:** Line rendering for bullet path.

### 3.3 The Map System & Editor
*   **Data Structure (JSON):**
    *   `tiles`: 2D array of tile IDs.
    *   `collision`: 2D array of boolean values.
    *   `objects`: Array of entities `{ type: "wallBuy", x: 10, y: 5, meta: { weapon: "ak47", cost: 1200 } }`.
    *   `scripts`: Event-driven logic (see 3.6).
*   **Editor Features:**
    *   **Tile Painting:** Brush tool for floors/walls.
    *   **Entity Placer:** Drag-and-drop Logic blocks, Zombie Spawns, Doors.
    *   **Inspector:** React sidebar to edit properties of the selected object.

### 3.4 Vision & Lighting
*   **View Cone:**
    *   A raycasted polygon originating from the player.
    *   **Settings:**
        *   `coneAngle`: Width of vision (e.g., 90 degrees for flashlight, 360 for ambient).
        *   `rayCount`: Resolution of the shadows.
*   **Fog of War:** Areas not currently in the View Cone are covered by a semi-transparent black overlay. Hidden enemies are not rendered (for performance and fairness).

### 3.5 Zombie AI
*   **States:** `IDLE` -> `PATHING` -> `CHASING` -> `ATTACKING`.
*   **Pathing:** Uses EasyStar.js.
    *   *Optimization:* Pathfinding is distributed. Do not calculate paths for all 50 zombies in one frame. Calculate 2-3 paths per frame in a queue system.
*   **Barricade Interaction:** If a path is blocked by a "Window" object, the Zombie enters `ATTACKING_BARRIER` state until the object is destroyed.

### 3.6 Scripting System (Secure)
To prevent `eval()` security risks, use a **Trigger-Action** system in JSON.
*   **Triggers:** `OnZoneEnter`, `OnRoundStart`, `OnInteract`, `OnPowerOn`.
*   **Actions:** `SpawnZombie(type, count, loc)`, `OpenDoor(id)`, `PlaySound(id)`, `ShowText(str)`.
*   **Implementation:** A `ScriptEngine` class maps JSON strings to internal TypeScript functions.

---

## 4. Multiplayer Architecture (PeerJS)

*   **Topology:** Host-Client (Star Topology).
    *   Player 1 is both a Client (renderer) and the Server (logic).
*   **Synchronization:**
    *   **Inputs:** Clients send `InputPacket` (WASD state, Mouse Angle, Click) to Host.
    *   **State:** Host processes inputs, runs physics, and sends `WorldState` (Entity positions, Health, Score) to Clients (20Hz or 30Hz).
*   **Interpolation:**
    *   Clients render entities by interpolating between the last two received `WorldState` snapshots to ensure smooth movement even if network packets jitter.
*   **Prediction:**
    *   Client-side prediction is used for the Local Player to prevent "input lag." The client moves immediately, and corrects position if the Host sends a divergent coordinate.

---

## 5. Data Persistence & File I/O

### 5.1 Local Storage
*   **Profiles:** XP, Unlocks, Stats. Stored in IndexedDB via `localForage`.
*   **Auto-Saves:** Maps currently being edited are auto-saved every 60 seconds.

### 5.2 File System (Import/Export)
*   **Export:** Convert Map Object to JSON string -> Create `Blob` -> Trigger Browser Download (`mapname.json`).
*   **Import:** HTML5 File Input -> FileReader API -> JSON.parse -> Zod Schema Validation -> Load into Game.

---

## 6. Implementation Stages (Roadmap)

### Phase 1: The Engine Core
*   Setup Vite/Phaser/React.
*   Implement configurable `PlayerController` (Movement + Aim).
*   Implement `WeaponSystem` (Raycasting, Recoil, Ammo, Reloading).
*   *Outcome:* A player moving and shooting at dummy targets with satisfying gunfeel.

### Phase 2: The Enemy & Map
*   Implement `TileMapManager` (Load JSON maps).
*   Implement `ZombieAI` (Pathfinding + State Machine).
*   Implement `HealthSystem` (Player damage, regeneration, death).
*   *Outcome:* Survival in a basic room against chasing enemies.

### Phase 3: The Game Loop
*   Implement `WaveManager` and `DirectorAI`.
*   Implement `Economy` (Points on hit, buying items).
*   Implement `Interactables` (Wall Buys, Doors, Barricades).
*   *Outcome:* A full single-player "Zombies" match loop.

### Phase 4: The Editor
*   Create React overlay for Tile/Object selection.
*   Implement Grid visualizer and placement logic.
*   Implement JSON Save/Load.
*   *Outcome:* Ability to create and play custom maps.

### Phase 5: Multiplayer & Polish
*   Implement `NetworkManager` (PeerJS).
*   Synchronize Game State.
*   Add Visual Polish (Lighting, Particles, UI animations).
*   *Outcome:* 4-Player Co-op.

---

## 7. Security & Best Practices
1.  **Input Sanitization:** Never trust the Client (in Multiplayer) or the Map File (in Editor). Always validate types and bounds.
2.  **Asset Safety:** Allow users to use custom images by converting them to Base64 strings within the Map JSON, or referencing safe URLs only.
3.  **State Isolation:** The UI (React) should not directly mutate Game (Phaser) objects. Use the `Zustand` store or an Event Bus as the intermediary.