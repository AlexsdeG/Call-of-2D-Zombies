import React, { useState, useEffect, useRef } from 'react';
import { GameState } from './types';
import { useGameStore } from './store/useGameStore';
import { PhaserGame } from './components/PhaserGame';
import { PLAYER } from './config/constants';
import { EventBus } from './game/EventBus';
import { TestRunner } from './tests/testRunner';
import { Loader2 } from 'lucide-react'; 
import './tests/visionTests'; 
import './tests/weaponTests';
import './tests/mapTests';
import './tests/zombieTests';
import './tests/interactionTests'; 
import Phaser from 'phaser';

// --- UI COMPONENTS ---

// --- HELPER HOOKS ---
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

// --- UI COMPONENTS ---

const LoadingOverlay = () => {
    return (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-white z-50 pointer-events-auto">
            <Loader2 className="w-16 h-16 animate-spin text-red-600 mb-4" />
            <h2 className="text-2xl font-bold tracking-widest animate-pulse">LOADING ASSETS</h2>
        </div>
    );
};

const MainMenu = () => {
  const setGameState = useGameStore((state) => state.setGameState);
  const resetPlayerStats = useGameStore((state) => state.resetPlayerStats);
  
  const startGame = () => {
      resetPlayerStats();
      setGameState(GameState.GAME);
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-20 pointer-events-auto">
      <h1 className="text-6xl font-bold mb-4 text-red-600 tracking-wider">CALL OF 2D ZOMBIES</h1>
      <p className="text-gray-400 mb-8">Phase 3.2: Economy & Items</p>
      <div className="flex gap-4">
        <button 
          onClick={startGame}
          className="px-8 py-3 bg-red-700 hover:bg-red-600 rounded font-bold transition"
        >
          PLAY GAME
        </button>
        <button 
          onClick={() => setGameState(GameState.EDITOR)}
          className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded font-bold transition"
        >
          MAP EDITOR
        </button>
      </div>
    </div>
  );
};

const GameOverMenu = () => {
    const setGameState = useGameStore((state) => state.setGameState);
    const resetPlayerStats = useGameStore((state) => state.resetPlayerStats);
    const { roundsSurvived, message } = useGameStore((state) => state.gameOverStats);

    const restart = () => {
        resetPlayerStats();
        // Force restart logic is handled in App effect
        setGameState(GameState.GAME);
    };

    const toMenu = () => {
        setGameState(GameState.MENU);
    };

    return (
        <div className="absolute inset-0 bg-red-900/40 flex flex-col items-center justify-center text-white z-40 pointer-events-auto backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <h1 className="text-8xl font-black mb-2 text-red-600 tracking-tighter drop-shadow-lg">GAME OVER</h1>
            <p className="text-xl mb-6 text-red-200">{message}</p>
            
            {/* Optional Round Stats */}
            {roundsSurvived > 0 && (
                <div className="mb-8 text-2xl font-bold text-yellow-500 animate-pulse">
                    SURVIVED UNTIL ROUND {roundsSurvived}
                </div>
            )}
            
            <div className="flex flex-col gap-4 w-64">
                <button 
                    onClick={restart}
                    className="px-6 py-4 bg-red-600 hover:bg-red-500 rounded font-bold text-xl shadow-lg transition-transform hover:scale-105"
                >
                    TRY AGAIN
                </button>
                <button 
                    onClick={toMenu}
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded font-bold text-gray-300 transition"
                >
                    MAIN MENU
                </button>
            </div>
        </div>
    );
};

/* ... PauseMenu, DebugOverlay ... */
const PauseMenu = () => {
    const setGameState = useGameStore((state) => state.setGameState);

    return (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-30 pointer-events-auto backdrop-blur-sm">
          <h2 className="text-4xl font-bold mb-8">PAUSED</h2>
          <div className="flex flex-col gap-4 w-64">
            <button 
              onClick={() => setGameState(GameState.GAME)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded font-bold transition text-center"
            >
              RESUME
            </button>
            <button 
              onClick={() => setGameState(GameState.MENU)}
              className="px-6 py-3 bg-red-900 hover:bg-red-800 rounded font-bold transition text-center"
            >
              QUIT TO MENU
            </button>
          </div>
        </div>
    );
};

const DebugOverlay = () => {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const handleFps = (currentFps: number) => {
      setFps(currentFps);
    };

    EventBus.on('debug-fps', handleFps);
    return () => {
      EventBus.off('debug-fps', handleFps);
    };
  }, []);

  const runTests = () => {
      TestRunner.runAll();
  };

  return (
    <div className="absolute top-0 right-0 p-2 bg-black/50 text-green-400 font-mono text-xs pointer-events-auto z-50 flex flex-col items-end gap-2">
      <div>FPS: {fps}</div>
      <div>VER: 0.1.16</div>
      <button 
        onClick={runTests}
        className="px-2 py-1 bg-blue-900/50 hover:bg-blue-800 text-blue-200 border border-blue-700 rounded text-[10px]"
      >
        RUN TESTS
      </button>
    </div>
  );
};

const HUD = () => {
  const points = useGameStore((state) => state.playerStats.points);
  const [isReloading, setIsReloading] = useState(false);
  const [wave, setWave] = useState(1);
  const [showWaveClear, setShowWaveClear] = useState(false);
  
  // Refs for direct DOM manipulation (Performance)
  const staminaBarRef = useRef<HTMLDivElement>(null);
  const healthTextRef = useRef<HTMLDivElement>(null);
  const currentAmmoRef = useRef<HTMLSpanElement>(null);
  const maxAmmoRef = useRef<HTMLSpanElement>(null);

  // Refs for state persistence across re-renders (fixes flash of 0)
  const lastAmmo = useRef(0);
  const lastMaxAmmo = useRef(0);

  useEffect(() => {
    const handleStatsUpdate = (data: { stamina?: number; health?: number; ammo?: number; maxAmmo?: number, isReloading?: boolean }) => {
       // Stamina
       if (staminaBarRef.current && data.stamina !== undefined) {
           const percent = (data.stamina / PLAYER.MAX_STAMINA) * 100;
           staminaBarRef.current.style.width = `${percent}%`;
           staminaBarRef.current.style.backgroundColor = percent < PLAYER.MIN_STAMINA_TO_SPRINT ? '#d97706' : '#22c55e';
       }
       
       // Health
       if (healthTextRef.current && data.health !== undefined) {
           healthTextRef.current.innerText = Math.round(data.health).toString();
       }

       // Ammo
       if (data.ammo !== undefined) {
           lastAmmo.current = data.ammo;
           if (currentAmmoRef.current) {
               currentAmmoRef.current.innerText = `${data.ammo}`;
           }
       }
       if (data.maxAmmo !== undefined) {
           lastMaxAmmo.current = data.maxAmmo;
           if (maxAmmoRef.current) {
               maxAmmoRef.current.innerText = `${data.maxAmmo}`;
           }
       }

       // Reload State
       if (data.isReloading !== undefined) {
           setIsReloading(data.isReloading);
       }
    };
    
    const handleRoundStart = (round: number) => {
        setWave(round);
        setShowWaveClear(false);
    };
    
    // Optional: Flash "Wave Complete"
    const handleRoundComplete = () => {
         setShowWaveClear(true);
         setTimeout(() => setShowWaveClear(false), 3000);
    };

    EventBus.on('player-stats-update', handleStatsUpdate);
    EventBus.on('round-start', handleRoundStart);
    EventBus.on('round-complete', handleRoundComplete);

    const initial = useGameStore.getState().playerStats;
    handleStatsUpdate({
        stamina: initial.stamina,
        health: initial.health,
        ammo: initial.ammo,
        maxAmmo: initial.maxAmmo
    });

    return () => {
      EventBus.off('player-stats-update', handleStatsUpdate);
      EventBus.off('round-start', handleRoundStart);
      EventBus.off('round-complete', handleRoundComplete);
    };
  }, []);
  
  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-10">
      <div className="flex justify-between items-start">
         <div className="text-yellow-400 text-2xl font-mono text-shadow-md">POINTS: {points}</div>
      </div>
      
      <div className="flex justify-between items-end w-full">
          {/* Wave Counter (Bottom Left) */}
          <div className="flex flex-col items-start gap-1">
              {/* Wave Clear Notification - Now smaller and above round text */}
              {showWaveClear && (
                 <div className="text-2xl font-bold text-yellow-400 animate-bounce tracking-widest drop-shadow-xl mb-1">
                     WAVE SURVIVED
                 </div>
              )}
          
              <div className="text-red-600 font-extrabold text-5xl tracking-tighter opacity-80 drop-shadow-xl animate-in slide-in-from-right duration-700">
                  ROUND <span className="text-white text-6xl">{wave}</span>
              </div>
          </div>

          <div className="flex flex-col items-end gap-2 w-64">
             {/* Stamina Bar */}
             <div className="w-full h-4 bg-gray-800 rounded overflow-hidden border border-gray-600">
                <div 
                  ref={staminaBarRef}
                  className="h-full bg-green-500 transition-none" 
                  style={{ width: '100%' }}
                />
             </div>
             <div className="text-green-500 text-xs font-bold tracking-wider">STAMINA</div>

             {/* Health & Ammo */}
             <div className="text-right mt-2">
               <div className="text-red-500 text-4xl font-black">
                  <span ref={healthTextRef}>100</span> <span className="text-sm text-gray-400">HP</span>
               </div>
               
               {/* Ammo Display */}
               <div className="text-yellow-500 text-2xl font-bold flex items-center justify-end h-8">
                  {/* Spinner - Visible only when reloading */}
                  <div className={`w-8 flex justify-center mr-1 ${isReloading ? '' : 'hidden'}`}>
                      <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
                  </div>
                  
                  {/* Ammo Count - Visible only when NOT reloading */}
                  <span 
                      ref={currentAmmoRef} 
                      className={`w-8 text-right mr-1 ${isReloading ? 'hidden' : ''}`}
                  >
                      {lastAmmo.current}
                  </span>

                  <span className="text-gray-500 text-xl">/ <span ref={maxAmmoRef}>{lastMaxAmmo.current}</span></span>
               </div>
             </div>
          </div>
      </div>
    </div>
  );
};

const EditorOverlay = () => {
  const setGameState = useGameStore((state) => state.setGameState);
  return (
    <div className="absolute inset-0 bg-gray-900/90 text-white p-4 z-20 flex flex-col pointer-events-auto">
       <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
          <h2 className="text-xl font-bold">Map Editor</h2>
          <button onClick={() => setGameState(GameState.MENU)} className="text-red-400 hover:text-red-300">Exit</button>
       </div>
       <div className="flex-1 flex items-center justify-center text-gray-500">
         Editor Tools Placeholder
       </div>
    </div>
  );
};


const InteractionPrompt = () => {
  const [data, setData] = useState<{ text: string; enabled: boolean } | null>(null);

  useEffect(() => {
    const show = (payload: string | { text: string; enabled: boolean }) => {
        if (typeof payload === 'string') {
            setData({ text: payload, enabled: true });
        } else {
            setData(payload);
        }
    };
    const hide = () => setData(null);

    EventBus.on('show-interaction-prompt', show);
    EventBus.on('hide-interaction-prompt', hide);
    return () => {
      EventBus.off('show-interaction-prompt', show);
      EventBus.off('hide-interaction-prompt', hide);
    };
  }, []);

  if (!data) return null;

  return (
    <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40 animate-in fade-in zoom-in duration-200">
       <div className={`
          text-sm font-medium px-3 py-1.5 rounded-full shadow-sm backdrop-blur-[2px] border tracking-wide flex items-center gap-2
          ${data.enabled 
            ? 'bg-black/50 text-white/90 border-white/10' 
            : 'bg-black/30 text-gray-400/80 border-gray-700/50 grayscale'}
       `}>
         <span className={`px-1.5 rounded text-[10px] font-bold ${data.enabled ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400'}`}>F</span>
         {data.text}
       </div>
    </div>
  );
};

const WeaponNameToast = () => {
    const [name, setName] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);
    const fadeTimer = useRef<NodeJS.Timeout | null>(null);
    const hideTimer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleSwitch = (weaponName: string) => {
            setName(weaponName);
            setVisible(true);

            // Clear existing timers
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
            if (hideTimer.current) clearTimeout(hideTimer.current);

            // Hide after 2 seconds
            hideTimer.current = setTimeout(() => {
                setVisible(false);
            }, 2000);
        };

        EventBus.on('weapon-switch', handleSwitch);
        return () => {
            EventBus.off('weapon-switch', handleSwitch);
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    return (
        <div className={`
            absolute bottom-36 right-6 pointer-events-none z-30 transition-opacity duration-1000 ease-in-out
            ${visible ? 'opacity-100' : 'opacity-0'}
        `}>
            <div className="text-white font-mono text-2xl tracking-wider drop-shadow-md text-right">
                {name}
            </div>
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent to-white/50 mt-1"></div>
        </div>
    );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const { gameState, setGameState } = useGameStore();
  const prevGameState = usePrevious(gameState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Test Runner Link
  useEffect(() => {
    const registerScene = (scene: Phaser.Scene) => {
      TestRunner.setScene(scene);
    };
    EventBus.on('scene-created', registerScene);
    return () => {
      EventBus.off('scene-created', registerScene);
    };
  }, []);

  // Handle Loading
  useEffect(() => {
      const handleReady = () => setIsLoaded(true);
      EventBus.on('scene-ready', handleReady);
      return () => { EventBus.off('scene-ready', handleReady); };
  }, []);

  // Game Flow Logic (Phaser Integration)
  useEffect(() => {
    if (!isLoaded) return;

    if (gameState === GameState.GAME) {
        // CRITICAL FIX: Distinguish between STARTING and RESUMING
        if (prevGameState === GameState.PAUSED) {
            console.log("App: Resuming Game");
            EventBus.emit('resume-game');
        } else if (prevGameState === GameState.GAME_OVER) {
             console.log("App: Restarting Game");
             EventBus.emit('restart-game');
        } else if (prevGameState === GameState.MENU || prevGameState === undefined) {
            console.log("App: Starting New Game");
            EventBus.emit('start-game');
        }
    } else if (gameState === GameState.PAUSED) {
        EventBus.emit('pause-game');
    } else if (gameState === GameState.MENU) {
        EventBus.emit('exit-game');
    } else if (gameState === GameState.GAME_OVER) {
        // Handled internally by Game Over Event
    }

  }, [gameState, isLoaded]); // Removed prevGameState from dep array to avoid infinite loops, relying on ref

  // Handle Global Events
  useEffect(() => {
      const handleTogglePause = () => {
          if (gameState === GameState.GAME) {
              setGameState(GameState.PAUSED);
          } else if (gameState === GameState.PAUSED) {
              setGameState(GameState.GAME);
          }
      };

      const handleGameOver = () => {
          setGameState(GameState.GAME_OVER);
      };

      EventBus.on('toggle-pause', handleTogglePause);
      EventBus.on('game-over', handleGameOver);

      return () => { 
          EventBus.off('toggle-pause', handleTogglePause); 
          EventBus.off('game-over', handleGameOver);
      };
  }, [gameState, setGameState]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <PhaserGame />

      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="w-full h-full">
           <DebugOverlay />
           
           {!isLoaded && <LoadingOverlay />}
           
           {isLoaded && gameState === GameState.MENU && <MainMenu />}
           {gameState === GameState.GAME && <HUD />}
           {gameState === GameState.PAUSED && <PauseMenu />}
           {gameState === GameState.GAME_OVER && <GameOverMenu />}
           {gameState === GameState.EDITOR && <EditorOverlay />}
           {gameState === GameState.GAME && <InteractionPrompt />}
           {gameState === GameState.GAME && <WeaponNameToast />}
        </div>
      </div>
    </div>
  );
};

export default App;