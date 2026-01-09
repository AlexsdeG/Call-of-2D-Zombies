import localforage from 'localforage';
import { MapData } from '../../schemas/mapSchema';
import { MapSerializer } from '../systems/MapSerializer';

const STORE_KEY_CURRENT = 'editor-current-project';
const STORE_KEY_PROJECTS = 'editor-project-list';

export class ProjectStorage {
    
    public static async saveProject(data: MapData): Promise<void> {
        // Save current working project (Editor Format)
        await localforage.setItem(STORE_KEY_CURRENT, data);
        
        // Update Project List
        const list = await this.getProjectList();
        const existingIndex = list.findIndex(p => p.name === data.name);
        
        if (existingIndex >= 0) {
            list[existingIndex].lastModified = Date.now();
        } else {
            list.push({ name: data.name, lastModified: Date.now() });
        }
        await localforage.setItem(STORE_KEY_PROJECTS, list);
        
        // Also save the named project separately so it can be loaded later
        // Key format: 'project-[name]'
        await localforage.setItem(`project-${data.name}`, data);
        
        console.log('Project Saved:', data.name);
    }
    
    public static async loadProject(name?: string): Promise<MapData | null> {
        if (!name) {
            return await localforage.getItem<MapData>(STORE_KEY_CURRENT);
        } else {
            return await localforage.getItem<MapData>(`project-${name}`);
        }
    }
    
    public static async getProjectList(): Promise<{name: string, lastModified: number}[]> {
         return await localforage.getItem<{name: string, lastModified: number}[]>(STORE_KEY_PROJECTS) || [];
    }

    public static async downloadProject(data: MapData, format: 'editor' | 'game') {
        let exportData = data;
        let extension = 'editor.json';
        
        if (format === 'game') {
            // Translate to Game Format
            exportData = MapSerializer.translateToGameFormat(data);
            extension = 'game.json';
        } else {
             // Editor format (ensure header is set if not already)
             // We can re-serialize or just trust existing data?
             // MapSerializer.serialize adds format: "editor".
             // If data comes from storage, it might have it.
             (exportData as any).format = 'editor';
        }
        
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.name || 'map'}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    public static async importProject(file: File): Promise<MapData> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                 try {
                     const json = JSON.parse(evt.target?.result as string);
                     const validation = MapSerializer.validate(json);
                     
                     if (validation.success) {
                         // Translate imported Game Format -> Editor Format
                         const editorData = MapSerializer.translateToEditorFormat(validation.data);
                         resolve(editorData);
                     } else {
                         reject(new Error("Invalid Map Data"));
                     }
                 } catch (err) {
                     reject(err);
                 }
            };
            reader.readAsText(file);
        });
    }
}
