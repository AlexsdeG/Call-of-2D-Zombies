# Call of 2D Zombies

A top-down CoD: Zombies clone running in the browser using Phaser 3, React, and PeerJS.

## Sound System
The game uses a folder-based sound architecture. Place audio files in `public/sounds/`.

| Category | Filename | Path | Description |
|----------|----------|------|-------------|
| **UI** | `click.mp3` | `/sounds/ui/click.mp3` | Button clicks or dry fire |
| **Weapon** | `fire.mp3` | `/sounds/weapons/{weapon_name}/fire.mp3` | Gunshot |
| **Weapon** | `reload.mp3` | `/sounds/weapons/{weapon_name}/reload.mp3` | Reload sound |
| **Player** | `step.mp3` | `/sounds/player/step.mp3` | Footsteps |

*Note: The `SoundManager` handles missing files gracefully. If a specific weapon sound is missing, it attempts to play from `/sounds/weapons/DEFAULT/`.*
