
import { MainGameScene } from '../game/scenes/MainGameScene';
import { DEBUG_MAP, MapData } from '../config/defaultMap';

export const testMapObjects = (scene: MainGameScene) => {
    console.log('--- STARTING MAP OBJECT TEST ---');
    try {
        const perkMachines = scene['perkMachineGroup'].getChildren();
        const mysteryBoxes = scene['mysteryBoxGroup'].getChildren();
        const papMachines = scene['packAPunchGroup'].getChildren();

        console.log(`Perk Machines Found: ${perkMachines.length}`);
        console.log(`Mystery Boxes Found: ${mysteryBoxes.length}`);
        console.log(`PaP Machines Found: ${papMachines.length}`);

        if (perkMachines.length < 4) console.warn('WARNING: Missing Perk Machines? Expected 4.');
        if (mysteryBoxes.length < 1) console.warn('WARNING: Missing Mystery Box? Expected at least 1.');
        if (papMachines.length < 1) console.warn('WARNING: Missing Pack-a-Punch? Expected 1.');

        console.log('--- MAP OBJECT TEST COMPLETE ---');
    } catch (e) {
        console.error('TEST FAILED:', e);
    }
};