# Changelog

All notable changes to this project will be documented in this file.

## [0.1.17] - Phase 3 Step 3.2 (Economy & Items)
### Added
- **Economy System**:
    - `src/game/entities/WallBuy.ts`: Interactable wall weapon purchase.
    - `src/game/entities/MysteryBox.ts`: Random weapon chest with moving logic (Teddy Bear).
    - `src/game/constants.ts`: Added `SHOTGUN` and `SNIPER` weapon definitions.
- **Player Updates**:
    - Points system integration (+10 hit, +100 kill).
    - `equipWeapon(key)` support in `Player.ts`.
- **Map**:
    - Updated `defaultMap.ts` with WallBuys (Spawn) and MysteryBoxes (All 3 rooms).
    - Updated `MapManager.ts` to parse economy objects.
- **Assets**:
    - Added procedural textures for `wallbuy` and `mysterybox` in `BootScene`.
- **Tests**:
    - `src/tests/economyMapTest.ts`: Verification script for economy map objects.

## [0.1.16] - Phase 3 Step 3.1 (Wave Manager & Director AI)
### Added
- **Systems**:
    - `src/game/systems/WaveManager.ts`: Manages round progression, zombie counts, and spawn timers.
    - `src/game/systems/DirectorAI.ts`: Monitors player stress (health/ammo) and adjusts spawn pacing.
- **Integration**:
    - Initialized `WaveManager` and `DirectorAI` in `MainGameScene`.
    - Refactored `Spawner.ts` to be controlled by `WaveManager`.

## [0.1.15] - Phase 2 Step 2.3 (Interactables & Barriers)
### Added
- **Interaction System**:
    - `src/game/interfaces/IInteractable.ts`: Interface for entities that respond to 'F' key.
    - Updated `Player.ts` to scan for nearest interactable and trigger interaction logic.
- **Entities**:
    - `src/game/entities/Door.ts`: Buyable obstacle. Removes itself and updates pathfinding grid when bought.
    - `src/game/entities/Barricade.ts`: Repairable window. Zombies attack it; Players repair it.
- **AI Logic**:
    - Updated `Zombie.ts` to handle `ATTACK_BARRIER` state. Zombies switch targets to barricades upon collision.
- **Systems**:
    - Updated `PathfindingManager.ts` to support dynamic tile updates (making a tile walkable after door purchase).
    - Updated `MapManager.ts` to parse `door` and `barricade` objects from map data.
- **Assets**:
    - Added procedural textures for `door` (Gray Metal) and `barricade` (Wood Planks) in `BootScene`.
- **Map**:
    - Updated `defaultMap.ts` to include a test Door (Cost: 500) and Barricade.
- **Tests**:
    - `src/tests/interactionTests.ts`: Verifies Door purchasing and Barricade repair logic.

## [0.1.14] - Phase 2 Step 2.2 (Zombie AI & Pathfinding)
### Added
- **AI System**:
    - `src/game/systems/PathfindingManager.ts`: Wrapper around `easystarjs`. Handles grid generation from Tilemaps and manages a path calculation queue to prevent frame drops.
- **Entities**:
    - `src/game/entities/Zombie.ts`: Intelligent enemy class with State Machine (`IDLE`, `PATHING`, `CHASE`, `ATTACK`).
    - Implemented "Soft Collision" for zombies (they push each other slightly to avoid stacking).
- **Assets**:
    - Added procedural `zombie` texture (Green/Red/Black) in `BootScene`.
- **Tests**:
    - `src/tests/zombieTests.ts`: Verifies pathfinding grid generation and zombie movement logic.

### Changed
- **MainGameScene**:
    - Initialized `PathfindingManager` with map data.
    - Added "Obstacle Baking": Crate positions are now marked as non-walkable in the pathfinding grid.
    - Added `zombieGroup` physics group.
    - Implemented Zombie spawning loop (Spawns 10 zombies for testing).
    - Added full collision matrix:
        - Zombies vs Walls (Slide)
        - Zombies vs Obstacles (Slide)
        - Zombies vs Bullets (Damage/Death)
        - Zombies vs Player (Push/Attack)

## [0.1.13] - Phase 2 Step 2.1 (Map Data & Validation)
### Added
- **Map System**:
    - `src/schemas/mapSchema.ts`: Zod schema for validating Map JSON (Layers, Objects, Metadata).
    - `src/game/systems/MapManager.ts`: Handles map validation, loading, and Tilemap generation.
    - `src/config/defaultMap.ts`: A debug map layout (20x20) with walls and a room structure.
- **Assets**:
    - Added procedural `tileset` generation in `BootScene` (Index 0: Floor, Index 1: Wall).
- **Tests**:
    - `src/tests/mapTests.ts`: Verifies schema validation (success/failure cases) and Tilemap layer creation.

### Changed
- **MainGameScene**:
    - Removed procedural "Random Obstacles" generation.
    - Integrated `MapManager` to load the default map.
    - Updated physics collisions to use the Map's Wall Layer instead of the `obstacleGroup`.

## [0.1.12] - Phase 1 Step 1.4 (Juice & VFX)
### Added
- **Visual Effects**:
    - **Projectile System**: Replaced instant raycasting with physical `Projectile` sprites that travel at high velocity (2000px/s). Bullets are recycled via Object Pooling for performance.
    - **Muzzle Flash**: Added a dynamic flash sprite at the gun tip that appears briefly when firing.
    - **Impact Sparks**: Added particle effects (yellow flares) when bullets collide with walls, crates, or enemies.
- **Assets**: Programmatically generated textures for `bullet`, `muzzleflash`, and `flare` in `BootScene`.

### Changed
- **Weapon System**: Refactored `WeaponSystem` to utilize `Physics.Arcade.Group` for bullet management instead of internal graphics drawing. Collisions are now handled in `MainGameScene`.