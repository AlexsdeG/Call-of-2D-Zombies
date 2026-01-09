import React, { useState } from 'react';
import { EventBus } from '../../EventBus';
import { Box, Grid, Eraser, Settings } from 'lucide-react';
import { WEAPON_DEFS } from '../../../config/constants';
import { ContextMenu } from './ContextMenu';
import { ScriptEditorModal } from './ScriptEditorModal';
import { GlobalManagerModal } from './GlobalManagerModal';

type EditorTab = 'tiles' | 'objects' | 'settings';

export const EditorSidebar = () => {
  const [activeTab, setActiveTab] = useState<EditorTab>('tiles');
  const [activeTile, setActiveTile] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<'paint' | 'erase' | 'select' | 'place_object'>('paint');
  
  // Brush Settings
  const [brushShape, setBrushShape] = useState<'square' | 'circle'>('square');
  const [brushWidth, setBrushWidth] = useState(1);
  const [brushHeight, setBrushHeight] = useState(1);
  
  // Map Settings
  const [mapWidth, setMapWidth] = useState(50);
  const [mapHeight, setMapHeight] = useState(50);

  // Object State
  const [selectedObject, setSelectedObject] = useState<any | null>(null);
  const objectTypes = ['Spawner', 'SpawnPoint', 'CustomObject', 'TriggerZone', 'Barricade', 'Door', 'WallBuy', 'PerkMachine', 'MysteryBox', 'PackAPunch'];

  // Script Editor State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, scriptIndex: number } | null>(null);
  const [editingScript, setEditingScript] = useState<{ script: any, index: number } | null>(null);
  const [isGlobalManagerOpen, setIsGlobalManagerOpen] = useState(false);
  
  // Globals Local State (Synced from Scene ideally, but for now managed here/propogated)
  const [globalVariables, setGlobalVariables] = useState<any[]>([]);
  const [globalScripts, setGlobalScripts] = useState<any[]>([]);

  // Sync Global Events
  React.useEffect(() => {
      const openGlobalManager = () => setIsGlobalManagerOpen(true);
      EventBus.on('editor-open-global-scripts', openGlobalManager);
      return () => {
          EventBus.off('editor-open-global-scripts', openGlobalManager);
      };
  }, []);

  const updateGlobals = (vars: any[], scripts: any[]) => {
      setGlobalVariables(vars);
      setGlobalScripts(scripts);
      EventBus.emit('editor-update-globals', { variables: vars, scripts });
  };

  // Sync initial state
  React.useEffect(() => {
      const onSceneReady = () => {
          // Force reset to Paint Wall on scene load
          setActiveTool('paint');
          setActiveTile(1);
          EventBus.emit('editor-tool-change', { tool: 'paint', tileIndex: 1 });
          EventBus.emit('editor-brush-update', { shape: brushShape, width: brushWidth, height: brushHeight });
      };

      EventBus.on('scene-ready', onSceneReady);
      
      return () => {
          EventBus.off('scene-ready', onSceneReady);
      };
  }, [brushShape, brushWidth, brushHeight]);

  // Sync Brush
  React.useEffect(() => {
      EventBus.emit('editor-brush-update', { shape: brushShape, width: brushWidth, height: brushHeight });
  }, [brushShape, brushWidth, brushHeight]);

  // Object Listeners
  React.useEffect(() => {
      const onSelect = (obj: any) => setSelectedObject(obj);
      const onDeselect = () => setSelectedObject(null);
      
      EventBus.on('editor-object-selected', onSelect);
      EventBus.on('editor-object-deselected', onDeselect);
      
      return () => {
          EventBus.off('editor-object-selected', onSelect);
          EventBus.off('editor-object-deselected', onDeselect);
      };
  }, []);

  const handleToolSelect = (tool: 'paint' | 'erase' | 'select' | 'place_object') => {
      setActiveTool(tool);
      EventBus.emit('editor-tool-change', { tool, tileIndex: tool === 'erase' ? 0 : activeTile });
  };


  const handleTileSelect = (index: number) => {
      setActiveTile(index);
      setActiveTool('paint');
      EventBus.emit('editor-tool-change', { tool: 'paint', tileIndex: index });
  };
  
  // Script Handlers
  const handleScriptRightClick = (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, scriptIndex: index });
  };
  
  const deleteScript = (index: number) => {
      if (selectedObject) {
         EventBus.emit('editor-script-delete', { id: selectedObject.id, index });
      }
  };
  
  const renameScript = (index: number) => {
      const newName = prompt("Enter new script name:", selectedObject?.scripts[index]?.name);
      if (newName && selectedObject) {
          const updatedScript = { ...selectedObject.scripts[index], name: newName };
          EventBus.emit('editor-script-update', { id: selectedObject.id, index, script: updatedScript });
      }
  };
  
  const saveScript = (updated: any) => {
     if (editingScript && selectedObject) {
         EventBus.emit('editor-script-update', { id: selectedObject.id, index: editingScript.index, script: updated });
     }
  };

  return (
    <div className="w-64 bg-gray-900 border-l border-gray-700 h-full flex flex-col text-gray-200 pointer-events-auto relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
          <h2 className="font-bold text-lg text-white tracking-wide">TOOLBOX</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
          <button 
             onClick={() => setActiveTab('tiles')}
             className={`flex-1 p-3 flex justify-center hover:bg-gray-800 transition ${activeTab === 'tiles' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : ''}`}
             title="Tiles"
          >
              <Grid size={20} />
          </button>
          <button 
             onClick={() => setActiveTab('objects')}
             className={`flex-1 p-3 flex justify-center hover:bg-gray-800 transition ${activeTab === 'objects' ? 'bg-gray-800 text-green-400 border-b-2 border-green-400' : ''}`}
             title="Objects"
          >
              <Box size={20} />
          </button>
          <button 
             onClick={() => setActiveTab('settings')}
             className={`flex-1 p-3 flex justify-center hover:bg-gray-800 transition ${activeTab === 'settings' ? 'bg-gray-800 text-yellow-400 border-b-2 border-yellow-400' : ''}`}
             title="Settings"
          >
              <Settings size={20} />
          </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* TILES TAB */}
          {activeTab === 'tiles' && (
              <div className="flex flex-col gap-4">
                  
                  {/* Tools */}
                  <div className="flex gap-2 mb-2">
                       <button 
                          onClick={() => handleToolSelect('paint')}
                          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm font-bold border transition
                            ${activeTool === 'paint' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                       >
                           PAINT
                       </button>
                       <button 
                          onClick={() => handleToolSelect('erase')}
                          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm font-bold border transition
                            ${activeTool === 'erase' ? 'bg-red-600 border-red-400 text-white' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                       >
                           <Eraser size={16} /> ERASE
                       </button>
                  </div>

                  {/* Brush Settings */}
                  <div className="p-3 bg-gray-800 rounded border border-gray-700 space-y-3">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Brush Settings</div>
                      
                      {/* Shape */}
                      <div className="flex gap-2">
                          <button 
                             onClick={() => setBrushShape('square')}
                             className={`flex-1 text-xs py-1 rounded border ${brushShape === 'square' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black border-gray-600 hover:bg-gray-700'}`}
                          >
                              SQUARE
                          </button>
                          <button 
                             onClick={() => setBrushShape('circle')}
                             className={`flex-1 text-xs py-1 rounded border ${brushShape === 'circle' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black border-gray-600 hover:bg-gray-700'}`}
                          >
                              CIRCLE
                          </button>
                      </div>

                      {/* Size */}
                      <div className="flex gap-2">
                          <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Width</label>
                              <input 
                                type="number" 
                                min="1" max="20"
                                value={brushWidth}
                                onChange={(e) => setBrushWidth(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-black border border-gray-600 rounded p-1 text-xs focus:border-blue-500 outline-none text-center"
                              />
                          </div>
                          <div className="flex-1">
                              <label className="block text-[10px] text-gray-500 mb-1">Height</label>
                              <input 
                                type="number" 
                                min="1" max="20"
                                value={brushHeight}
                                onChange={(e) => setBrushHeight(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-black border border-gray-600 rounded p-1 text-xs focus:border-blue-500 outline-none text-center"
                              />
                          </div>
                      </div>
                  </div>

                  {/* Tile Palette */}
                  <div className="grid grid-cols-4 gap-2">
                      <TileButton label="Floor" color="bg-gray-500" selected={activeTile === 0} onClick={() => handleTileSelect(0)} />
                      <TileButton label="Wall" color="bg-gray-300" selected={activeTile === 1} onClick={() => handleTileSelect(1)} />
                      {/* Placeholders for future tiles */}
                      <TileButton label="Water" color="bg-blue-500" selected={activeTile === 2} onClick={() => handleTileSelect(2)} />
                      <TileButton label="Grass" color="bg-green-700" selected={activeTile === 3} onClick={() => handleTileSelect(3)} />
                  </div>
              </div>
          )}

          {/* OBJECTS TAB */}
          {activeTab === 'objects' && (
              <div className="flex flex-col gap-4">
                  {/* Tools */}
                  <div className="flex gap-2 mb-2">
                       <button 
                          onClick={() => handleToolSelect('select')}
                          className={`flex-1 py-2 px-3 rounded flex items-center justify-center gap-2 text-sm font-bold border transition
                            ${activeTool === 'select' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                       >
                           SELECT / MOVE
                       </button>
                  </div>

                  {/* Object Palette */}
                  <div className="space-y-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Place Object</div>
                      <div className="grid grid-cols-2 gap-2">
                          {objectTypes.map(type => (
                              <button
                                  key={type}
                                  onClick={() => EventBus.emit('editor-object-select', { type })}
                                  className="p-2 bg-gray-800 border border-gray-600 rounded hover:bg-gray-700 text-xs text-left truncate"
                              >
                                  {type}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Property Inspector */}
                  {selectedObject && (
                      <div className="mt-4 p-3 bg-gray-800 rounded border border-gray-500 space-y-3 animate-fade-in">
                          <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-blue-400 uppercase">{selectedObject.type}</span>
                              <button 
                                onClick={() => EventBus.emit('editor-object-delete')}
                                className="text-red-500 hover:text-red-400"
                              >
                                  <Eraser size={14} />
                              </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                      <label className="text-[10px] text-gray-500">X</label>
                                      <input 
                                          type="number" 
                                          step={8}
                                          value={selectedObject.x} 
                                          onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'x', value: parseInt(e.target.value) || 0 })}
                                          onFocus={() => EventBus.emit('editor-input-focus')}
                                          onBlur={() => EventBus.emit('editor-input-blur')}
                                          onKeyDown={(e) => e.stopPropagation()}
                                          className="w-full bg-black border border-gray-700 rounded p-1 text-xs text-gray-400 font-mono focus:border-blue-500 outline-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-gray-500">Y</label>
                                      <input 
                                          type="number" 
                                          step={8}
                                          value={selectedObject.y} 
                                          onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'y', value: parseInt(e.target.value) || 0 })}
                                          onFocus={() => EventBus.emit('editor-input-focus')}
                                          onBlur={() => EventBus.emit('editor-input-blur')}
                                          onKeyDown={(e) => e.stopPropagation()}
                                          className="w-full bg-black border border-gray-700 rounded p-1 text-xs text-gray-400 font-mono focus:border-blue-500 outline-none"
                                      />
                                  </div>
                          </div>

                          {/* Custom Props */}
                          <div className="space-y-2 pt-2 border-t border-gray-700">
                              {/* Cost (Common) */}
                              {selectedObject.properties.cost !== undefined && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Cost</label>
                                      <input 
                                        type="number" 
                                        value={selectedObject.properties.cost || 0}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'cost', value: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none" 
                                      />
                                  </div>
                              )}
                              
                              {/* Zone (Door/Spawner) */}
                              {(selectedObject.type === 'Door' || selectedObject.type === 'Spawner') && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Zone ID</label>
                                      <input 
                                        type="number" 
                                        value={selectedObject.properties.zone || 0}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'zone', value: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none" 
                                      />
                                  </div>
                              )}

                              {/* Rotation (MysteryBox) */}
                              {selectedObject.properties.rotation !== undefined && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Rotation (Deg)</label>
                                      <select 
                                        value={selectedObject.properties.rotation || 0}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'rotation', value: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                      >
                                          <option value={0}>0</option>
                                          <option value={90}>90</option>
                                          <option value={180}>180</option>
                                          <option value={270}>270</option>
                                      </select>
                                  </div>
                              )}
                              
                              {/* Weapon Selector (WallBuy) */}
                              {selectedObject.properties.weapon !== undefined && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Weapon</label>
                                      <select 
                                        value={selectedObject.properties.weapon || 'PISTOL'}
                                        onChange={(e) => {
                                            const key = e.target.value;
                                            const cost = WEAPON_DEFS[key as keyof typeof WEAPON_DEFS]?.cost || 500;
                                            EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'weapon', value: key });
                                            // Auto-update cost based on weapon default
                                            EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'cost', value: cost });
                                        }}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                      >
                                          {Object.keys(WEAPON_DEFS).map(key => {
                                              const def = WEAPON_DEFS[key as keyof typeof WEAPON_DEFS];
                                              return <option key={key} value={key}>{def.category} - {def.name}</option>;
                                          })}
                                      </select>
                                  </div>
                              )}

                               {/* Perk Selector (PerkMachine) */}
                              {selectedObject.properties.perk !== undefined && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Perk</label>
                                      <select 
                                        value={selectedObject.properties.perk || 'JUGGERNOG'}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'perk', value: e.target.value })}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                      >
                                          {['JUGGERNOG', 'SPEED_COLA', 'DOUBLE_TAP', 'STAMIN_UP'].map(p => <option key={p} value={p}>{p}</option>)}
                                      </select>
                                  </div>
                              )}

                              
                              {/* Name Property (for CustomObject/TriggerZone) */}
                              {(selectedObject.type === 'CustomObject' || selectedObject.type === 'TriggerZone') && (
                                  <div className="mb-2">
                                      <label className="text-[10px] text-gray-500">Name</label>
                                      <input 
                                        type="text"
                                        value={selectedObject.properties.name || ''}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'name', value: e.target.value })}
                                        onFocus={() => EventBus.emit('editor-input-focus')}
                                        onBlur={() => EventBus.emit('editor-input-blur')}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                        placeholder="Object Name"
                                      />
                                  </div>
                              )}
                              
                              {/* Custom Object Props */}
                              {selectedObject.type === 'CustomObject' && (
                                  <>
                                      <div>
                                          <label className="text-[10px] text-gray-500">Color</label>
                                          <div className="flex gap-2">
                                              <input 
                                                type="color" 
                                                value={selectedObject.properties.color || '#888888'}
                                                onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'color', value: e.target.value })}
                                                onFocus={() => EventBus.emit('editor-input-focus')}
                                                onBlur={() => EventBus.emit('editor-input-blur')}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="w-8 h-6 bg-transparent border-none p-0 cursor-pointer"
                                              />
                                              <input 
                                                type="text" 
                                                value={selectedObject.properties.color || '#888888'}
                                                readOnly
                                                className="flex-1 bg-black border border-gray-700 rounded p-1 text-xs text-gray-400 font-mono"
                                              />
                                          </div>
                                      </div>
                                      <div className="flex gap-2">
                                          <div className="flex-1">
                                              <label className="text-[10px] text-gray-500">Width</label>
                                              <input 
                                                type="number"
                                                min="16" step="16"
                                                value={selectedObject.properties.width || 32}
                                                onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'width', value: parseInt(e.target.value) || 32 })}
                                                onFocus={() => EventBus.emit('editor-input-focus')}
                                                onBlur={() => EventBus.emit('editor-input-blur')}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                              />
                                          </div>
                                          <div className="flex-1">
                                              <label className="text-[10px] text-gray-500">Height</label>
                                              <input 
                                                type="number"
                                                min="16" step="16"
                                                value={selectedObject.properties.height || 32}
                                                onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'height', value: parseInt(e.target.value) || 32 })}
                                                onFocus={() => EventBus.emit('editor-input-focus')}
                                                onBlur={() => EventBus.emit('editor-input-blur')}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                              />
                                          </div>
                                      </div>
                                  </>
                              )}

                              {/* Trigger Zone Props */}
                              {selectedObject.type === 'TriggerZone' && (
                                  <div>
                                      <label className="text-[10px] text-gray-500">Radius</label>
                                      <input 
                                        type="number"
                                        min="16" step="16"
                                        value={selectedObject.properties.radius || 32}
                                        onChange={(e) => EventBus.emit('editor-object-update-prop', { id: selectedObject.id, key: 'radius', value: parseInt(e.target.value) || 32 })}
                                        onFocus={() => EventBus.emit('editor-input-focus')}
                                        onBlur={() => EventBus.emit('editor-input-blur')}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-full bg-black border border-gray-700 rounded p-1 text-xs focus:border-blue-500 outline-none"
                                      />
                                  </div>
                              )}
                              
                              {/* SCRIPTS SECTION */}
                              <div className="pt-2 border-t border-gray-700">
                                   <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Attached Scripts</div>
                                   
                                   {/* List Existing Scripts */}
                                   {(selectedObject.scripts && selectedObject.scripts.length > 0) ? (
                                       <div className="space-y-1 mb-2">
                                           {selectedObject.scripts.map((script: any, idx: number) => (
                                               <div 
                                                 key={idx} 
                                                 className="bg-gray-700 p-1 rounded text-[10px] flex justify-between items-center cursor-pointer hover:bg-gray-600 border border-transparent hover:border-gray-500"
                                                 onContextMenu={(e) => handleScriptRightClick(e, idx)}
                                                 onClick={() => setEditingScript({ script, index: idx })}
                                               >
                                                   <span className="truncate max-w-[100px]">{script.name}</span>
                                                   <div className="text-gray-400 text-[8px]">{script.triggers?.length || 0} Triggers</div>
                                               </div>
                                           ))}
                                       </div>
                                   ) : (
                                       <div className="bg-black/50 p-2 rounded text-[10px] text-gray-500 text-center border border-gray-800 border-dashed mb-2">
                                           No scripts attached.
                                       </div>
                                   )}

                                   <button
                                     onClick={() => {
                                         // Create a default script
                                         const newScript = {
                                             id: crypto.randomUUID(),
                                             name: 'New Script',
                                             triggers: [{ type: 'ON_INTERACT' }],
                                             actions: [{ type: 'SHOW_TEXT', parameters: { text: "Hello!" } }],
                                             enabled: true
                                         };
                                         EventBus.emit('editor-object-add-script', { id: selectedObject.id, script: newScript });
                                     }}
                                     className="w-full py-1 bg-blue-700 hover:bg-blue-600 rounded text-[10px] font-bold transition"
                                   >
                                       + ADD SCRIPT
                                   </button>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
              <div className="flex flex-col gap-4">
                  <div className="text-sm font-bold text-gray-400 uppercase">Map Settings</div>
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="block text-xs">Map Name</label>
                          <input type="text" className="w-full bg-black border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" placeholder="Untitled Map" />
                      </div>

                      <div className="space-y-2">
                          <div className="text-xs font-bold text-gray-400">Map Dimensions (Tiles)</div>
                          <div className="flex gap-2">
                              <div className="flex-1">
                                  <label className="block text-[10px] text-gray-500">Width</label>
                                  <input 
                                    type="number" 
                                    value={mapWidth}
                                    onChange={(e) => setMapWidth(parseInt(e.target.value) || 1)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                  />
                              </div>
                              <div className="flex-1">
                                  <label className="block text-[10px] text-gray-500">Height</label>
                                  <input 
                                    type="number" 
                                    value={mapHeight}
                                    onChange={(e) => setMapHeight(parseInt(e.target.value) || 1)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm focus:border-blue-500 outline-none" 
                                  />
                              </div>
                          </div>
                          <button 
                            onClick={() => EventBus.emit('editor-map-resize', { width: mapWidth, height: mapHeight })}
                            className="w-full py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold transition"
                          >
                              APPLY RESIZE
                          </button>
                      </div>

                      {/* Global Scripts Section */}
                      <div className="space-y-2 pt-4 border-t border-gray-700">
                          <div className="text-xs font-bold text-gray-400">Global Scripts</div>
                          <div className="text-[10px] text-gray-500 mb-2">Scripts that run on Game Start or Global Events.</div>
                          
                           {/* List Global Scripts */}
                           {/* Note: We need to access map.scripts somehow. Currently we only have selectedObject. 
                               We need to emit an event to get/set map global scripts or pass it as prop?
                               Actually EditorSidebar is generic. Let's assume we can emit 'editor-map-script-add' etc.
                               But we need to display them. We probably need a new state `globalScripts` passed via props or event.
                               For now, let's just emit event to open a "Global Script Manager" modal or list them if we have them. 
                               
                               Wait, `EditorScene` has `mapData`. We can subscribe to `editor-map-update`.
                           */}
                           <button 
                             onClick={() => EventBus.emit('editor-open-global-scripts')}
                             className="w-full py-2 bg-purple-700 hover:bg-purple-600 rounded text-xs font-bold transition"
                           >
                               MANAGE GLOBAL SCRIPTS
                           </button>
                      </div>
                  </div>
              </div>
          )}

      </div>
      
      {/* Script Context Menu */}
      {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={[
                { label: 'Rename', action: () => renameScript(contextMenu.scriptIndex) },
                { label: 'Delete', action: () => deleteScript(contextMenu.scriptIndex), color: 'red' }
            ]}
            onClose={() => setContextMenu(null)}
          />
      )}
      


      {/* Script Editor Modal */}
      {editingScript && (
          <ScriptEditorModal
              script={editingScript.script}
              onClose={() => setEditingScript(null)}
              onSave={saveScript}
              knownGlobals={globalVariables}
          />
      )}
      
      {/* Global Manager */}
      {isGlobalManagerOpen && (
          <GlobalManagerModal
              variables={globalVariables}
              scripts={globalScripts}
              onUpdateVariables={(vars) => updateGlobals(vars, globalScripts)}
              onUpdateScripts={(scripts) => updateGlobals(globalVariables, scripts)}
              onClose={() => setIsGlobalManagerOpen(false)}
          />
      )}
    </div>
  );
};


// Helper Component
const TileButton = ({ label, color, selected, onClick }: { label: string, color: string, selected: boolean, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className={`
            aspect-square rounded border-2 flex flex-col items-center justify-center gap-1 transition relative overflow-hidden group
            ${selected ? 'border-white ring-2 ring-blue-500 z-10' : 'border-transparent hover:border-gray-500'}
        `}
    >
        <div className={`w-full h-full ${color}`}></div>
        <span className="absolute bottom-0 w-full bg-black/60 text-[10px] text-center p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {label}
        </span>
    </button>
);
