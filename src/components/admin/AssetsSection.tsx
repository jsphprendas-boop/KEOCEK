import React, { useState, useMemo, useEffect } from 'react';
import { Asset, DBData, User, AssetLocationBlock } from '../../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlusCircle, Search, Edit2, Trash2, Box, Info, Download, User as UserIcon, LayoutGrid, List, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from "sonner";
import { apiFetch } from "../../lib/api";
import { Badge } from "@/components/ui/badge";
import { exportToExcel } from "../../lib/exportUtils";

interface AssetsSectionProps {
  data: DBData;
  onRefresh: () => void;
  isMasterAdmin?: boolean;
}

const LOCATION_BLOCKS = [
  "Módulo A", "Módulo B", "Módulo C", "Módulo D", 
  "Administración", "Cocina", "Comedor", "Clínica", "Otros"
];

const getLocationsForBlock = (block: string) => {
   if (block.startsWith('Módulo')) {
       return Array.from({length: 20}, (_, i) => `Celda ${i+1}`);
   }
   if (block === 'Administración') {
       return ["Oficina Principal", "Recepción", "Sala de Reuniones", "Archivo"];
   }
   if (block === 'Cocina' || block === 'Comedor') {
       return ["Área General", "Bodega", "Cuarto Frío"];
   }
   if (block === 'Clínica') {
       return ["Consultorio", "Farmacia", "Sala de Espera", "Observación"];
   }
   return ["Área General", "Bodega"];
}

function ManageAssetLocationsDialog({ 
  open, 
  onOpenChange, 
  assetLocationBlocks,
  onRefresh
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  assetLocationBlocks: AssetLocationBlock[];
  onRefresh: () => void;
}) {
  const [blocks, setBlocks] = useState(assetLocationBlocks);
  const [newBlockName, setNewBlockName] = useState("");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [newSubLocation, setNewSubLocation] = useState("");

  useEffect(() => {
    setBlocks(assetLocationBlocks);
  }, [assetLocationBlocks]);

  const handleAddBlock = async () => {
    if (!newBlockName.trim()) return;
    try {
      await fetch('/api/asset-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBlockName.trim(), subLocations: [] })
      });
      setNewBlockName("");
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleRemoveBlock = async (id: string) => {
    if (!window.confirm("¿Eliminar este bloque?")) return;
    try {
      await fetch(`/api/asset-locations/${id}`, { method: 'DELETE' });
      if (selectedBlockId === id) setSelectedBlockId(null);
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleAddSubLocation = async (blockId: string) => {
    if (!newSubLocation.trim()) return;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    try {
      const updatedBlock = { ...block, subLocations: [...(block.subLocations || []), newSubLocation.trim()] };
      await fetch(`/api/asset-locations/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBlock)
      });
      setNewSubLocation("");
      onRefresh();
    } catch(e) { console.error(e); }
  };

  const handleRemoveSubLocation = async (blockId: string, subLocIndex: number) => {
    if (!window.confirm("¿Eliminar esta ubicación?")) return;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    try {
      const updatedBlock = { ...block, subLocations: block.subLocations.filter((_, i) => i !== subLocIndex) };
      await fetch(`/api/asset-locations/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedBlock)
      });
      onRefresh();
    } catch(e) { console.error(e); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl border border-slate-100 shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">Gestionar Ubicaciones de Activos</DialogTitle>
          <DialogDescription>
            Crea bloques principales (ej. Módulo A) y ubicaciones específicas (ej. Celda 1).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest mb-4">Bloques de Ubicación</h3>
            <div className="flex gap-2 mb-4">
              <Input 
                value={newBlockName}
                onChange={e => setNewBlockName(e.target.value)}
                placeholder="Nuevo bloque..."
                className="bg-white"
                onKeyDown={e => e.key === 'Enter' && handleAddBlock()}
              />
              <Button onClick={handleAddBlock} className="bg-indigo-600 hover:bg-indigo-700 text-white"><PlusCircle className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {blocks.map(block => (
                <div 
                  key={block.id} 
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedBlockId === block.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                   <span className="font-bold">{block.name}</span>
                   <button onClick={(e) => { e.stopPropagation(); handleRemoveBlock(block.id); }} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {blocks.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No hay bloques registrados</p>}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
            <h3 className="font-bold text-sm text-slate-500 uppercase tracking-widest mb-4">Ubicaciones Específicas</h3>
            {selectedBlockId ? (
              <>
                <div className="flex gap-2 mb-4">
                  <Input 
                    value={newSubLocation}
                    onChange={e => setNewSubLocation(e.target.value)}
                    placeholder="Nueva ubicación..."
                    className="bg-white"
                    onKeyDown={e => e.key === 'Enter' && handleAddSubLocation(selectedBlockId)}
                  />
                  <Button onClick={() => handleAddSubLocation(selectedBlockId)} className="bg-emerald-600 hover:bg-emerald-700 text-white"><PlusCircle className="w-4 h-4" /></Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {blocks.find(b => b.id === selectedBlockId)?.subLocations?.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between p-2 px-3 rounded-xl bg-white border border-slate-200 text-sm font-medium">
                       <span>{loc}</span>
                       <button onClick={() => handleRemoveSubLocation(selectedBlockId, i)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {(!blocks.find(b => b.id === selectedBlockId)?.subLocations || blocks.find(b => b.id === selectedBlockId)!.subLocations.length === 0) && (
                    <p className="text-center text-slate-400 text-sm py-4">No hay ubicaciones en este bloque</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
                 <LayoutGrid className="w-8 h-8 mb-2 opacity-50" />
                 <p className="text-sm">Selecciona un bloque para ver o agregar ubicaciones</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssetFormDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData,
  assetLocationBlocks,
  totalAssets
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: Partial<Asset>) => Promise<void>;
  initialData: Asset | null;
  assetLocationBlocks: AssetLocationBlock[];
  totalAssets: number;
}) {
  const [formData, setFormData] = useState<Partial<Asset>>({
    barcode: "", assetNumber: "", description: "", 
    brand: "", model: "", serialNumber: "", state: "bueno", observations: "", lastRevisionDate: "", locationBlock: "", location: ""
  });

  useEffect(() => {
    if (initialData && open) {
      setFormData(initialData);
    } else if (open) {
      setFormData({
        barcode: "", assetNumber: `ACT-${(totalAssets + 1).toString().padStart(4, '0')}`, description: "", 
        brand: "", model: "", serialNumber: "", state: "bueno", observations: "", lastRevisionDate: "", locationBlock: "", location: ""
      });
    }
  }, [initialData, open, totalAssets]);


  const handleSave = async () => {
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-3xl border-none shadow-2xl p-0 flex flex-col max-h-[90vh] overflow-hidden">
          <DialogHeader className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-6 shrink-0">
            <DialogTitle className="text-xl md:text-2xl font-black">{initialData ? 'Editar Activo' : 'Registrar Activo'}</DialogTitle>
            <DialogDescription className="text-indigo-100 font-medium">
              Complete la información del activo institucional.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
             <div className="space-y-2 relative">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Patrimonio <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  value={formData.assetNumber || ""} 
                  onChange={e => setFormData({...formData, assetNumber: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                  placeholder="Ej. MC-12345"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Descripción <span className="text-rose-500">*</span>
                </Label>
                <Input 
                  value={formData.description || ""} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                  placeholder="Ej. Computadora Portátil"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Código de Barras</Label>
                <Input 
                  value={formData.barcode || ""} 
                  onChange={e => setFormData({...formData, barcode: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                  placeholder="Ej. |||||||||||||||"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marca</Label>
                <Input 
                  value={formData.brand || ""} 
                  onChange={e => setFormData({...formData, brand: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                  placeholder="Ej. Dell, HP, Toyota..."
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo</Label>
                <Input 
                  value={formData.model || ""} 
                  onChange={e => setFormData({...formData, model: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Serie</Label>
                <Input 
                  value={formData.serialNumber || ""} 
                  onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estado del Bien</Label>
                <Select value={formData.state || "bueno"} onValueChange={(v: 'bueno' | 'regular' | 'malo') => setFormData({...formData, state: v})}>
                  <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 h-11 font-medium">
                    <SelectValue placeholder="Seleccione el estado" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    <SelectItem value="bueno" className="font-medium text-emerald-700">Bueno</SelectItem>
                    <SelectItem value="regular" className="font-medium text-amber-700">Regular</SelectItem>
                    <SelectItem value="malo" className="font-medium text-red-700">Malo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5" /> Última Revisión
                </Label>
                <Input 
                  type="date"
                  value={formData.lastRevisionDate || ""} 
                  onChange={e => setFormData({...formData, lastRevisionDate: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                />
              </div>

              <div className="space-y-4 md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 relative isolation">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Ubicación del Activo
                </Label>
                <div className="flex flex-wrap gap-2">
                   {assetLocationBlocks.map(block => (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => setFormData({...formData, locationBlock: block.name, location: ''})}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${formData.locationBlock === block.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                         {block.name}
                      </button>
                   ))}
                   {assetLocationBlocks.length === 0 && <span className="text-xs text-slate-400 italic">No hay bloques registrados. Utilice "Gestionar Ubicaciones".</span>}
                </div>

                {formData.locationBlock && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-300">
                     <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                        Ubicación Específica en {formData.locationBlock}
                     </Label>
                     <div className="flex flex-wrap gap-2">
                        {assetLocationBlocks.find(b => b.name === formData.locationBlock)?.subLocations?.map(loc => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setFormData({...formData, location: loc})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.location === loc ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm transform scale-105' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600'}`}
                          >
                             {loc}
                          </button>
                        ))}
                     </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observaciones</Label>
                <Input 
                  value={formData.observations || ""} 
                  onChange={e => setFormData({...formData, observations: e.target.value})}
                  className="rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11"
                  placeholder="Detalles adicionales..."
                />
              </div>
          </div>
          <DialogFooter className="bg-slate-50 p-4 md:p-6 border-t border-slate-100 shrink-0">
            <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="font-bold rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-200"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-bold tracking-wide"
              >
                Guardar Activo
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}

export const AssetsSection = React.memo(function AssetsSection({ data, onRefresh, isMasterAdmin }: AssetsSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isAdding, setIsAdding] = useState(false);
  const [isManagingLocations, setIsManagingLocations] = useState(false);
  const [isEditing, setIsEditing] = useState<Asset | null>(null);

  const assets = useMemo(() => data.assets || [], [data.assets]);

  const filteredAssets = useMemo(() => {
    let result = assets;
    
    if (locationFilter && locationFilter !== "all") {
       result = result.filter(a => a.locationBlock === locationFilter);
    }
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.description?.toLowerCase().includes(lowerSearch) ||
        a.assetNumber?.toLowerCase().includes(lowerSearch) || 
        a.barcode?.toLowerCase().includes(lowerSearch) ||
        a.brand?.toLowerCase().includes(lowerSearch) ||
        a.locationBlock?.toLowerCase().includes(lowerSearch) ||
        a.location?.toLowerCase().includes(lowerSearch)
      );
    }
    
    return result;
  }, [assets, searchTerm, locationFilter]);

  const handleExport = () => {
    const exportData = filteredAssets.map(a => ({
      "N° Item": a.itemNumber,
      "Patrimonio": a.assetNumber,
      "Cod. Barras": a.barcode,
      "Descripción": a.description,
      "Marca": a.brand,
      "Modelo": a.model,
      "Serie": a.serialNumber,
      "Estado": a.state,
      "Bloque": a.locationBlock || "",
      "Ubicación": a.location || "",
      "Última Revisión": a.lastRevisionDate || "",
      "Observaciones": a.observations
    }));
    exportToExcel(exportData, "Inventario_Activos");
  };

  const handleSave = async (formData: Partial<Asset>) => {
    if (!formData.description || !formData.assetNumber) {
      toast.error("Descripción y Patrimonio son obligatorios");
      return;
    }

    try {
      if (isEditing) {
        await apiFetch(`/api/assets/${isEditing.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        toast.success("Activo actualizado exitosamente");
      } else {
        const newItemNumber = (assets.length + 1).toString();
        const dataToSave = { ...formData, itemNumber: newItemNumber };
        await apiFetch('/api/assets', {
          method: 'POST',
          body: JSON.stringify(dataToSave)
        });
        toast.success("Activo registrado exitosamente");
      }
      setIsAdding(false);
      setIsEditing(null);
      onRefresh();
    } catch (e) {
      toast.error("Error al guardar activo");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar este activo?")) return;
    try {
      await apiFetch(`/api/assets/${id}`, { method: 'DELETE' });
      toast.success("Activo eliminado");
      onRefresh();
    } catch (e) {
      toast.error("Error al eliminar activo");
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'bueno': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200';
      case 'regular': return 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200';
      case 'malo': return 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Box className="w-8 h-8 text-indigo-600" />
            Inventario de Activos
          </h2>
          <p className="text-slate-500 font-medium">Gestión de activos institucionales de la delegación</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsManagingLocations(true)}
            variant="outline"
            className="rounded-xl border-slate-200 text-slate-700 font-bold hover:bg-slate-50 shadow-sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2 text-indigo-500" />
            Ubicaciones
          </Button>

          <Button 
            onClick={() => {
              setIsAdding(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-bold tracking-wide"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Registrar Activo
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl border-none shadow-xl bg-white/70 backdrop-blur-xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Buscar por descripción, patrimonio, marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl bg-white border-slate-200 h-12 focus-visible:ring-indigo-500 font-medium placeholder:text-slate-400"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={async () => {
                  if (!window.confirm("¿Importar datos del excel?")) return;
                  const { seedAssets } = await import('../../seedAssets');
                  let currentCount = assets.length;
                  
                  // Also create location blocks if they don't exist
                  const blocks = Array.from(new Set(seedAssets.map(a => a.locationBlock)));
                  for (const blockName of blocks) {
                    if (!data.assetLocationBlocks?.find(b => b.name === blockName)) {
                      await apiFetch('/api/asset-locations', {
                        method: 'POST',
                        body: JSON.stringify({ name: blockName, subLocations: [] })
                      });
                    }
                  }

                  for (const asset of seedAssets) {
                    currentCount++;
                    await apiFetch('/api/assets', {
                      method: 'POST',
                      body: JSON.stringify({ ...asset, itemNumber: currentCount.toString() })
                    });
                  }
                  toast.success("Importados correctamente");
                  onRefresh();
                }}
                variant="outline"
                className="rounded-xl border-slate-200 text-slate-700 font-bold hover:bg-slate-50 shadow-sm"
              >
                Importar Excel
              </Button>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="rounded-xl border-slate-200 bg-white h-12 font-medium">
                  <SelectValue placeholder="Todas las ubicaciones" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-[200px]">
                  <SelectItem value="all" className="font-bold text-slate-700">Todas las Ubicaciones</SelectItem>
                  {data.assetLocationBlocks?.map(block => (
                    <SelectItem key={block.id} value={block.name} className="font-medium">
                      {block.name}
                    </SelectItem>
                  ))}
                  {(!data.assetLocationBlocks || data.assetLocationBlocks.length === 0) && (
                    <SelectItem value="none" disabled className="text-slate-400 italic">No hay ubicaciones</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 h-8 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 h-8 rounded-lg ${viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            
            <Button 
                variant="outline" 
                onClick={handleExport}
                className="flex ml-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl gap-2 font-bold flex-1 md:flex-none justify-center md:justify-start uppercase text-[10px] tracking-widest h-11"
              >
                <Download className="w-4 h-4" />
                Exportar
            </Button>
            
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider hidden sm:block whitespace-nowrap">
              {filteredAssets.length} Activos
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            {viewMode === 'table' ? (
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="font-black text-slate-700 py-5">N° ITEM</TableHead>
                  <TableHead className="font-black text-slate-700">PATRIMONIO</TableHead>
                  <TableHead className="font-black text-slate-700">DESCRIPCIÓN</TableHead>
                  <TableHead className="font-black text-slate-700">MARCA / MODELO</TableHead>
                  <TableHead className="font-black text-slate-700">SERIE</TableHead>
                  <TableHead className="font-black text-slate-700">UBICACIÓN</TableHead>
                  <TableHead className="font-black text-slate-700 text-center">ESTADO</TableHead>
                  <TableHead className="font-black text-slate-700">REVISIÓN</TableHead>
                  <TableHead className="text-right font-black text-slate-700 pr-6">ACCIONES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <Box className="w-16 h-16 text-slate-200 mb-4" />
                        <p className="text-lg font-medium">No se encontraron activos</p>
                        <p className="text-sm">Agrega un nuevo activo para comenzar</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-indigo-50/30 transition-colors border-slate-50">
                      <TableCell className="py-4 font-mono font-medium text-slate-500">{asset.itemNumber || '-'}</TableCell>
                      <TableCell>
                        <div className="font-bold text-indigo-700">{asset.assetNumber}</div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-1">
                          <span className="bg-slate-100 px-1.5 rounded text-[10px]">CB: {asset.barcode || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 max-w-[250px] truncate" title={asset.description}>
                        {asset.description}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-slate-700">{asset.brand || '-'}</div>
                        <div className="text-xs text-slate-500">{asset.model || '-'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">{asset.serialNumber || '-'}</TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-slate-700">{asset.locationBlock || '-'}</div>
                        <div className="text-xs text-slate-500">{asset.location || '-'}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`uppercase text-[10px] tracking-wider font-bold ${getStateColor(asset.state)}`}>
                          {asset.state}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {asset.lastRevisionDate ? (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <CalendarIcon className="w-3.5 h-3.5" /> Revisado: {asset.lastRevisionDate}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No revisado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6 space-x-2">
                         {asset.observations && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg" title={asset.observations}>
                            <Info className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                          onClick={() => {
                            setIsEditing(asset);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          onClick={() => handleDelete(asset.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
            ) : (
              <div className="p-6">
                {filteredAssets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 h-64 border-2 border-dashed border-slate-200 rounded-3xl">
                    <Box className="w-16 h-16 text-slate-200 mb-4" />
                    <p className="text-lg font-medium">No se encontraron activos</p>
                    <p className="text-sm">Agrega un nuevo activo para comenzar</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredAssets.map(asset => (
                      <div key={asset.id} className="group flex flex-col bg-slate-50 hover:bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden">
                        
                        <div className="p-5 flex-1 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                               <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                 <Box className="w-3 h-3 text-slate-400" />
                                 {asset.assetNumber}
                               </div>
                               <h3 className="text-lg font-black text-slate-800 leading-tight">
                                 {asset.description}
                               </h3>
                               <p className="text-sm text-slate-500 font-medium mt-1">
                                 {asset.brand || 'Sin marca'} {asset.model && `• ${asset.model}`}
                               </p>
                            </div>
                            <Badge variant="outline" className={`uppercase text-[10px] tracking-wider font-bold shrink-0 ${getStateColor(asset.state)}`}>
                              {asset.state}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {/* Location */}
                            {(asset.locationBlock || asset.location) && (
                              <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="bg-indigo-50 text-indigo-500 p-2 rounded-xl">
                                    <LayoutGrid className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ubicación</span>
                                    <span className="text-sm font-bold text-slate-700">
                                      {asset.locationBlock} {asset.location && `- ${asset.location}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Last Revision */}
                            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 text-sm font-medium text-slate-600">
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight">Última Revisión</span>
                                <span>{asset.lastRevisionDate ? asset.lastRevisionDate : <span className="text-slate-400 italic">Sin registros</span>}</span>
                              </div>
                            </div>
                            
                            {/* Serial and item number */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                               <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl flex flex-col items-center justify-center text-center">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">N° Item</span>
                                  <span className="font-mono text-slate-700 mt-0.5">{asset.itemNumber || '-'}</span>
                               </div>
                               <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl flex flex-col items-center justify-center text-center">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Serie</span>
                                  <span className="font-mono text-slate-700 mt-0.5 truncate w-full px-1">{asset.serialNumber || '-'}</span>
                               </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between group-hover:bg-indigo-50/50 transition-colors">
                            {asset.observations ? (
                               <div className="flex items-center gap-1.5 text-xs text-slate-400 max-w-[60%] truncate" title={asset.observations}>
                                  <Info className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">{asset.observations}</span>
                               </div>
                            ) : <div></div>}
                            
                            <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white shadow-sm"
                                  onClick={() => setIsEditing(asset)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white shadow-sm"
                                  onClick={() => handleDelete(asset.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <AssetFormDialog
        open={isAdding || !!isEditing}
        onOpenChange={(open) => {
          if (!open) {
            setIsAdding(false);
            setIsEditing(null);
          }
        }}
        onSave={handleSave}
        initialData={isEditing}
        assetLocationBlocks={data.assetLocationBlocks || []}
        totalAssets={(data.assets || []).length}
      />

      <ManageAssetLocationsDialog
        open={isManagingLocations}
        onOpenChange={setIsManagingLocations}
        assetLocationBlocks={data.assetLocationBlocks || []}
        onRefresh={onRefresh}
      />
    </div>
  );
});
