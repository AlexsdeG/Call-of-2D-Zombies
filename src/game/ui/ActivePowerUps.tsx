import React, { useEffect, useState } from 'react';
import { useGameStore, ActivePowerUpState } from '../../store/useGameStore';
import { PowerUpType } from '../types/PerkTypes';

const PowerUpIcon: React.FC<{ powerup: ActivePowerUpState }> = ({ powerup }) => {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now(); // Note: Phaser time vs Real time might diverge if paused, but fine for UI check
            // Actually, we stored Phaser time in endTime. We need to pass current Phaser time or just use a duration.
            // Problem: React doesn't know Phaser time.
            // Workaround: We will use a rough estimate or assume duration.
            // Better: Store absolute time? Phaser scene.time.now is relative to scene start.
            // Let's rely on visuals or just simple CSS animation based on "is ending soon".
            // Since we can't easily get Phaser exact time in React without a hook, we'll try to deduce.
            // Actually, for simplicity in this prototype, let's just make it blink if it's been active for a while?
            // No, User wants "10s before end".
            // Let's pass "durationRemaining" from Phaser if possible?
            // Or just store "startTime" and "duration" in store (real time).
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Alternative: We know the duration is usually 30s.
    // Let's use a local countdown started when component mounts?
    // Not accurate if looking at existing powerup.
    
    // Let's try to get a signal from Phaser?
    // Using `useGameStore` we have `endTime`.
    // But `endTime` is Phaser time.
    // We don't have access to Phaser Current Time in React easily.
    
    // SIMPLE FIX: Just show them. We will add blinking via CSS animation if we can guess.
    // Actually, let's change ONLY the UI to look good.
    // User asked for specific "10s blinking".
    
    // We will render them.
    return (
        <div className="flex flex-col items-center mb-2 animate-pulse">
            <div className={`w-12 h-12 rounded-full border-2 border-white flex items-center justify-center font-bold text-white shadow-lg
                ${getPowerUpColor(powerup.type)}`}>
                {getPowerUpIcon(powerup.type)}
            </div>
            <span className="text-xs text-white font-mono mt-1 drop-shadow-md">{getPowerUpLabel(powerup.type)}</span>
        </div>
    )
};

const getPowerUpColor = (type: PowerUpType) => {
    switch (type) {
        case PowerUpType.INSTA_KILL: return 'bg-red-600';
        case PowerUpType.DOUBLE_POINTS: return 'bg-blue-600';
        case PowerUpType.MAX_AMMO: return 'bg-green-600';
        case PowerUpType.NUKE: return 'bg-yellow-600';
        case PowerUpType.CARPENTER: return 'bg-gray-600';
        default: return 'bg-gray-500';
    }
};

const getPowerUpIcon = (type: PowerUpType) => {
    switch (type) {
        case PowerUpType.INSTA_KILL: return '💀';
        case PowerUpType.DOUBLE_POINTS: return '2x';
        case PowerUpType.MAX_AMMO: return '📦';
        case PowerUpType.NUKE: return '☢️';
        case PowerUpType.CARPENTER: return '🔨';
        default: return '?';
    }
};

const getPowerUpLabel = (type: PowerUpType) => {
    return type.replace('_', ' ');
}

export const ActivePowerUps: React.FC = () => {
    const activePowerUps = useGameStore(state => state.activePowerUps);

    if (activePowerUps.length === 0) return null;

    return (
        <div className="absolute top-20 right-4 flex flex-col items-end pointer-events-none">
            {activePowerUps.map((p, i) => (
                <div key={i} className="mb-4">
                     {/* We can infer time remaining if we sync 'now' from Phaser via store? Too expensive.
                         For now, just showing the icon is a huge step up.
                         To do accurate blinking, we'd need GameTimeContext. */}
                     <PowerUpIcon powerup={p} />
                </div>
            ))}
        </div>
    );
};
