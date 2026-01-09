import React, { useRef } from 'react';
import { ProjectStorage } from '../../storage/ProjectStorage';
import { MapSerializer } from '../../systems/MapSerializer';
import { SecurityAnalyzer } from '../../../utils/SecurityAnalyzer';

interface LoadMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (data: any) => void; // Changed to accept data or name (handled by caller?)
    // Actually, to support both, let's just pass the data object if possible, or trigger a load by name?
    // If we standardize: Caller expects to receive 'MapData' ready to inject?
    // ProjectStorage.loadProject returns MapData. 
    // File reader returns MapData.
    // So onLoad should receive MapData!
}

export const LoadMapModal: React.FC<LoadMapModalProps> = ({ isOpen, onClose, onLoad }) => {
    const [activeTab, setActiveTab] = React.useState<'local' | 'file'>('local');
    const [projects, setProjects] = React.useState<{name: string, lastModified: number}[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    React.useEffect(() => {
        if (isOpen) {
            ProjectStorage.getProjectList().then(list => {
                setProjects(list.sort((a,b) => b.lastModified - a.lastModified));
            });
        }
    }, [isOpen]);

    const handleLocalLoad = async (name: string) => {
        const data = await ProjectStorage.loadProject(name);
        if (data) {
            onLoad(data);
            onClose();
        }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
             try {
                 const json = JSON.parse(evt.target?.result as string);
                 const validation = MapSerializer.validate(json);
                 if (validation.success) {
                     const report = SecurityAnalyzer.scanMapData(validation.data);
                     if (!report.safe) {
                         alert("Security Issue:\n" + report.issues.join('\n'));
                         return;
                     }
                     // Pass the valid data
                     onLoad(validation.data);
                     onClose();
                 } else {
                     alert("Invalid Map JSON");
                 }
             } catch (err) {
                 console.error(err);
                 alert("Failed to parse JSON");
             }
        };
        reader.readAsText(file);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto">
            <div className="bg-gray-800 border border-gray-600 rounded-lg w-96 shadow-xl flex flex-col overflow-hidden">
                <div className="flex border-b border-gray-700 bg-gray-900/50">
                    <button 
                        onClick={() => setActiveTab('local')}
                        className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'local' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        BROWSER STORAGE
                    </button>
                    <button 
                         onClick={() => setActiveTab('file')}
                         className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'file' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        IMPORT FILE
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'local' ? (
                        <div className="mb-4 max-h-64 overflow-y-auto bg-gray-900/50 rounded p-2 min-h-[150px]">
                            {projects.length === 0 ? (
                                <div className="text-gray-500 text-center italic py-10">No saved projects found.</div>
                            ) : (
                                <div className="space-y-2">
                                    {projects.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => handleLocalLoad(p.name)}
                                            className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded flex justify-between items-center group transition"
                                        >
                                            <span className="font-bold text-white group-hover:text-blue-300">{p.name}</span>
                                            <span className="text-xs text-gray-400">
                                                {new Date(p.lastModified).toLocaleDateString()}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[150px] border-2 border-dashed border-gray-600 rounded bg-gray-900/30 hover:bg-gray-900/50 transition cursor-pointer"
                             onClick={() => fileInputRef.current?.click()}>
                            <span className="text-4xl mb-2">📂</span>
                            <span className="text-gray-300 font-bold">Click to Upload JSON</span>
                            <span className="text-gray-500 text-xs mt-1">Supports Editor & Game Format</span>
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileImport} 
                                accept=".json" 
                                className="hidden" 
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 mt-6 border-t border-gray-700 pt-4">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
