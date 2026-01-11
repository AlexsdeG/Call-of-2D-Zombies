import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Trophy, Clock, Skull, ChevronRight, Star } from 'lucide-react';
import { GameState } from '../../types';

export const PostGameStatsOverlay = () => {
    const sessionReport = useGameStore(state => state.sessionReport);
    const setGameState = useGameStore(state => state.setGameState);
    
    const [animateBar, setAnimateBar] = useState(false);
    const [showLevelUp, setShowLevelUp] = useState(false);

    useEffect(() => {
        // Trigger animations after mount
        if (sessionReport) {
            setTimeout(() => setAnimateBar(true), 500);
            if (sessionReport.levelUp) {
                setTimeout(() => setShowLevelUp(true), 1500);
            }
        }
    }, [sessionReport]);

    if (!sessionReport) return null;

    const { xpGained, levelUp, newLevel, kills, rounds, timePlayed, nextState } = sessionReport;

    // Calculate XP Progress for the CURRENT (new) level
    const prevLevelThreshold = Math.pow(newLevel - 1, 2) * 500;
    const nextLevelThreshold = Math.pow(newLevel, 2) * 500;
    
    // We need total XP to calculate accurate bar position
    // Since we don't pass totalXP in report, we can fetch it from current profile in store
    const currentProfile = useGameStore.getState().profile;
    const currentTotalXP = currentProfile ? currentProfile.xp : 0;
    
    const levelXp = currentTotalXP - prevLevelThreshold;
    const levelMax = nextLevelThreshold - prevLevelThreshold;
    const progress = Math.min(100, Math.max(0, (levelXp / levelMax) * 100));

    // If we leveled up, visual bar starts from 0 (new level start) to current.
    // If we didn't, we ideally would animate from old->new, but simpler is 0->new or just new.
    // Let's float the bar width.

    const handleContinue = () => {
        // Clear session report? Maybe not needed as it will be overwritten/nullified on next game start.
        // Actually good practice to reset session stats on new game logic.
        if (nextState === GameState.MENU) {
             // If going to menu, reset generic stats? 
             // App.tsx handles 'exit-game' emission which in MainGameScene does cleanup.
        }
        setGameState(nextState);
    };

    return (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-in fade-in duration-500 backdrop-blur-md pointer-events-auto">
            
            {/* Header */}
            <h1 className="text-4xl font-black text-white italic tracking-widest mb-2 uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                Mission Report
            </h1>
            <div className="w-64 h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mb-12"></div>

            {/* Level & XP Section */}
            <div className="w-full max-w-2xl px-8 mb-12">
                <div className="flex justify-between items-end mb-2">
                    <div className="text-2xl font-bold text-gray-400">
                        LEVEL <span className="text-white text-4xl">{newLevel}</span>
                    </div>
                    <div className="text-yellow-400 font-mono font-bold animate-pulse">
                        +{xpGained.toLocaleString()} XP
                    </div>
                </div>

                {/* XP Bar Container */}
                <div className="relative h-6 bg-gray-800 rounded-full border border-gray-600 overflow-hidden shadow-inner">
                    {/* Progress Fill */}
                    <div 
                        className="h-full bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-300 transition-all duration-[2000ms] ease-out shadow-[0_0_20px_rgba(234,179,8,0.5)]"
                        style={{ width: animateBar ? `${progress}%` : (levelUp ? '0%' : '0%') }} // Simple entry animation
                    />
                </div>
                
                <div className="text-right text-xs font-mono text-gray-500 mt-1">
                    {Math.round(levelMax - levelXp)} XP TO NEXT LEVEL
                </div>
            </div>

            {/* Level Up Celebration */}
            {levelUp && (
                <div className={`absolute top-20 flex flex-col items-center animate-in zoom-in fade-in duration-700 ${showLevelUp ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                    <Star className="w-24 h-24 text-yellow-500 fill-yellow-500 text-shadow-xl animate-[spin_3s_linear_infinite]" />
                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-xl tracking-tighter mt-4">
                        LEVEL UP!
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-6 w-full max-w-3xl mb-12">
                <StatCard 
                    icon={<Skull className="w-8 h-8 text-red-500" />} 
                    label="KILLS" 
                    value={kills} 
                    delay={100}
                />
                <StatCard 
                    icon={<Trophy className="w-8 h-8 text-yellow-500" />} 
                    label="ROUNDS" 
                    value={rounds} 
                    delay={200}
                />
                <StatCard 
                    icon={<Clock className="w-8 h-8 text-blue-500" />} 
                    label="TIME" 
                    value={`${Math.floor(timePlayed / 60)}m ${Math.floor(timePlayed % 60)}s`} 
                    delay={300}
                />
            </div>

            {/* Helper Hint */}
            {nextState === GameState.GAME_OVER && (
                 <p className="text-red-500/80 text-sm font-mono mb-8 animate-pulse">
                     MISSION FAILED
                 </p>
            )}

            {/* Continue Button */}
            <button 
                onClick={handleContinue}
                className="group flex items-center gap-3 px-12 py-4 bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-yellow-400 rounded-sm transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.6)]"
            >
                <span className="text-xl font-black tracking-widest uppercase">Continue</span>
                <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform stroke-[3]" />
            </button>
        </div>
    );
};

const StatCard = ({ icon, label, value, delay }: { icon: React.ReactNode, label: string, value: string | number, delay: number }) => (
    <div 
        className="flex flex-col items-center p-6 bg-gray-900/50 border border-gray-700/50 rounded-lg animate-in slide-in-from-bottom-4 fade-in duration-700 fill-mode-backwards"
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="mb-3 p-3 bg-black/40 rounded-full border border-gray-800">
            {icon}
        </div>
        <div className="text-sm font-bold text-gray-500 tracking-widest mb-1">{label}</div>
        <div className="text-3xl font-black text-white">{value}</div>
    </div>
);
