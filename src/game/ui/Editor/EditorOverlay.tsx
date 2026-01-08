import React from 'react';
import { useGameStore } from '../../../store/useGameStore'; // Adjusted path
import { GameState } from '../../../types';
import { EditorSidebar } from './EditorSidebar';

export const EditorOverlay = () => {
  const setGameState = useGameStore((state) => state.setGameState);

  return (
    <div className="absolute inset-0 flex flex-col z-20 pointer-events-none">
       {/* Top Bar */}
       <div className="w-full h-12 bg-gray-900/90 border-b border-gray-700 flex justify-between items-center px-4 pointer-events-auto backdrop-blur-sm">
          <div className="flex items-center gap-4">
              <h2 className="text-white font-bold tracking-wider text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  MAP EDITOR <span className="text-xs text-gray-500 bg-black/50 px-2 py-0.5 rounded">BETA 0.1</span>
              </h2>
          </div>
          
          <div className="flex items-center gap-2">
              <button 
                onClick={() => console.log('Save logic pending')}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-bold transition"
              >
                  SAVE
              </button>
              <button 
                onClick={() => setGameState(GameState.MENU)} 
                className="px-4 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 rounded text-xs font-bold transition"
              >
                  EXIT
              </button>
          </div>
       </div>

       {/* Main Area */}
       <div className="flex-1 flex overflow-hidden">
           {/* Canvas is behind here */}
           <div className="flex-1 relative">
               {/* Overlay for tooltips or floating panels could go here */}
               <div className="absolute bottom-4 left-4 pointer-events-none opacity-50">
                    <div className="text-xs text-white font-mono bg-black/50 p-2 rounded">
                        <div>WASD or MMB: Move Camera</div>
                        <div>SCROLL or Q/E: Zoom</div>
                        <div>LMB: Paint</div>
                    </div>
               </div>
           </div>

           {/* Sidebar */}
           <EditorSidebar />
       </div>
    </div>
  );
};
