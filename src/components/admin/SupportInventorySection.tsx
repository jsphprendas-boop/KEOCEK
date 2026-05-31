import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Calendar as CalendarIcon, Download, UserCircle, ClipboardList, Plus, PlusCircle, Sun, Moon, FolderPlus, PackagePlus, Search, Tags, History, Pencil } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "../../lib/exportUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";

export default function SupportInventorySection({ user, data, onGlobalRefresh }: any) {
  const [isLoading, setIsLoading] = useState(false);

  // States for Daily Consumption (Consumo)
  const [consumeDate, setConsumeDate] = useState(new Date().toISOString().split('T')[0]);
  const [consumeShift, setConsumeShift] = useState("Día");
  const [consumeCook, setConsumeCook] = useState("");
  const [consumeItems, setConsumeItems] = useState<{name: string, quantity: number, unit: string}[]>([]);
  const [consumeItemCat, setConsumeItemCat] = useState("");
  const [consumeItemProd, setConsumeItemProd] = useState("");
  const [consumeItemQty, setConsumeItemQty] = useState("");
  const [consumeItemUnit, setConsumeItemUnit] = useState("");

  // States for Catalog
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newProductData, setNewProductData] = useState({ name: "", unit: "Kilos" });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [editProductData, setEditProductData] = useState({ id: "", name: "", unit: "Kilos", category: "" });

  // State for History
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const supportCategories = useMemo(() => data.supportCategories || [], [data.supportCategories]);
  const supportProducts = useMemo(() => data.supportProducts || [], [data.supportProducts]);

  const supportRecords = data.supportRecords || [];
  const consumeRecords = supportRecords.filter((r: any) => r.recordType === "consumo");

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este registro de consumo de forma permanente?")) return;
    try {
      await fetch(`/api/support-records/${id}`, { method: "DELETE", headers: { "x-user-email": user?.email || "" }});
      toast.success("Registro eliminado");
      if(onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al eliminar el registro");
    }
  };

  const handleExport = () => {
    if (consumeRecords.length === 0) {
        toast.error("No hay registros para exportar");
        return;
    }
    const exportData = consumeRecords.map((r: any) => ({
      "Fecha del Consumo": r.consumeDate || r.date?.split('T')[0] || "",
      "Turno": r.consumeShift || "",
      "Personal/Cocinero": r.userName || "",
      "Productos": r.items?.map((i: any) => `${i.quantity} ${i.unit} ${i.name}`).join(", ") || "",
      "Registrado por": r.addedBy || "",
      "Fecha de Registro": r.timestamp ? new Date(r.timestamp).toLocaleString() : ""
    }));
    exportToExcel(exportData, "Historial_Consumo_Apoyo");
  };

  // Consumo Logic
  const handleAddConsumeItem = () => {
    if (!consumeItemProd || !consumeItemQty || Number(consumeItemQty) <= 0) {
      toast.error("Seleccione un producto e ingrese una cantidad válida");
      return;
    }
    const prod = supportProducts.find((p: any) => p.id === consumeItemProd);
    if (!prod) return;

    setConsumeItems([...consumeItems, { 
      name: prod.name, 
      quantity: Number(consumeItemQty), 
      unit: consumeItemUnit || prod.unit || "Unidades" 
    }]);
    setConsumeItemCat("");
    setConsumeItemProd("");
    setConsumeItemQty("");
    setConsumeItemUnit("");
  };

  const handleRemoveConsumeItem = (index: number) => {
    setConsumeItems(consumeItems.filter((_, i) => i !== index));
  };

  const handleAddConsume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumeDate || !consumeShift || !consumeCook || consumeItems.length === 0) {
        toast.error("Complete todos los campos base y agregue al menos un producto");
        return;
    }

    setIsLoading(true);
    try {
      const uniqueId = new Date().toISOString(); 
      const res = await fetch("/api/support-records", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ 
            date: uniqueId, 
            userName: consumeCook, 
            items: consumeItems,
            consumeDate: consumeDate,
            consumeShift: consumeShift,
            recordType: "consumo",
            addedBy: user?.name || user?.email || "Admin"
        }),
      });

      if (res.ok) {
        toast.success("Consumo registrado correctamente");
        setConsumeItems([]);
        setConsumeCook("");
        if(onGlobalRefresh) onGlobalRefresh();
      } else {
        toast.error("Error al guardar el consumo");
      }
    } catch (e) {
        toast.error("Error de conexión");
    }
    setIsLoading(false);
  };

  // Catalog Logic
  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    try {
      await fetch("/api/support-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      setNewCategoryName("");
      setIsAddingCategory(false);
      toast.success("Bloque creado");
      if(onGlobalRefresh) onGlobalRefresh();
    } catch (e) {}
  };

  const handleDeleteCategory = async (id: string) => {
    if(!window.confirm("¿Eliminar este bloque y sus productos?")) return;
    try {
      await fetch(`/api/support-categories/${id}`, { method: "DELETE" });
      if(onGlobalRefresh) onGlobalRefresh();
    } catch(e) {}
  };

  const handleAddProduct = async () => {
    if (!newProductData.name || !selectedCategory) return;
    try {
      await fetch("/api/support-products", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ ...newProductData, category: selectedCategory }),
      });
      setNewProductData({ name: "", unit: "Kilos" });
      setIsAddingProduct(false);
      toast.success("Producto creado");
      if(onGlobalRefresh) onGlobalRefresh();
    } catch (e) {}
  };

  const handleEditProductSave = async () => {
    if (!editProductData.name || !editProductData.category) return;
    try {
      await fetch(`/api/support-products/${editProductData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-email": user?.email || "" },
        body: JSON.stringify({ name: editProductData.name, unit: editProductData.unit, category: editProductData.category }),
      });
      setIsEditingProduct(false);
      toast.success("Producto actualizado");
      if(onGlobalRefresh) onGlobalRefresh();
    } catch (e) {}
  };

  const handleDeleteProduct = async (id: string) => {
    if(!window.confirm("¿Eliminar este producto?")) return;
    try {
      await fetch(`/api/support-products/${id}`, { method: "DELETE" });
      if(onGlobalRefresh) onGlobalRefresh();
    } catch(e) {}
  };

  // History / Calendar Logic
  const groupedConsumes = useMemo(() => {
     return consumeRecords.reduce((acc: any, r: any) => {
        const date = r.consumeDate || r.date?.split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(r);
        return acc;
      }, {});
  }, [consumeRecords]);
  
  const datesWithRecords = useMemo(() => {
      return Object.keys(groupedConsumes).map(dateStr => new Date(dateStr + "T00:00:00"));
  }, [groupedConsumes]);

  const getRecordsForSelectedDate = () => {
      if (!selectedDate) return [];
      const tzOffset = selectedDate.getTimezoneOffset() * 60000; 
      const localDateIso = new Date(selectedDate.getTime() - tzOffset).toISOString().split('T')[0];
      return groupedConsumes[localDateIso] || [];
  };

  const recordsForDate = getRecordsForSelectedDate();

  return (
    <div className="space-y-4 sm:space-y-5 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 dark:from-indigo-900 dark:via-slate-800 dark:to-indigo-950 p-6 sm:p-8 rounded-[2rem] shadow-xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10 text-white flex-1">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 drop-shadow-sm">Apoyo Interno</h2>
          <p className="text-indigo-200/90 font-medium text-sm sm:text-base tracking-wide max-w-md">Control de consumo diario y seguimiento de inventario del personal de apoyo.</p>
        </div>
        <div className="relative z-10 w-full sm:w-auto">
            <Button onClick={handleExport} className="w-full sm:w-auto bg-white hover:bg-slate-50 text-indigo-700 border-0 rounded-2xl h-14 sm:h-14 px-6 shadow-lg shadow-black/10 font-black text-sm uppercase tracking-widest transition-transform active:scale-95">
              <Download className="w-5 h-5 mr-2" />
              <span>Exportar XLS</span>
            </Button>
        </div>
        <div className="absolute -right-6 -bottom-6 text-white/10 pointer-events-none">
            <PackagePlus className="w-48 h-48 sm:w-64 sm:h-64" />
        </div>
      </div>

      <Tabs defaultValue="consumo" className="w-full">
      <div className="w-full pb-4 sm:pb-6 flex justify-center">
        <TabsList className="relative z-10 flex w-full sm:w-auto bg-slate-100/80 dark:bg-slate-800/60 p-1.5 rounded-2xl shadow-inner border border-slate-200/50 dark:border-slate-700/50 gap-1 overflow-x-auto scrollbar-hide">
          <TabsTrigger value="consumo" className="flex-1 sm:flex-none min-w-[100px] rounded-[0.85rem] px-3 sm:px-6 py-2.5 sm:py-3 font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm transition-all duration-300 flex flex-col sm:flex-row items-center justify-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200">
            <ClipboardList className="w-4 h-4 sm:shrink-0" />
            <span className="truncate leading-none">Consumo</span>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="flex-1 sm:flex-none min-w-[100px] rounded-[0.85rem] px-3 sm:px-6 py-2.5 sm:py-3 font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm transition-all duration-300 flex flex-col sm:flex-row items-center justify-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200">
            <Tags className="w-4 h-4 sm:shrink-0" />
            <span className="truncate leading-none">Catálogo</span>
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex-1 sm:flex-none min-w-[100px] rounded-[0.85rem] px-3 sm:px-6 py-2.5 sm:py-3 font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-300 data-[state=active]:shadow-sm transition-all duration-300 flex flex-col sm:flex-row items-center justify-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-200">
            <History className="w-4 h-4 sm:shrink-0" />
            <span className="truncate leading-none">Historial</span>
          </TabsTrigger>
        </TabsList>
      </div>

        <div className="mt-6">
            <TabsContent value="consumo" className="space-y-6 focus:outline-none mt-0 animate-in fade-in zoom-in-95 duration-300">
              {/* Consumo Form */}
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="mb-8 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800/60 pb-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/40 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
                        <UserCircle className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="font-black text-xl sm:text-2xl text-slate-800 dark:text-slate-100 leading-tight">Registrar Consumo</h3>
                        <p className="text-[11px] sm:text-xs font-black text-slate-500 uppercase mt-1 tracking-widest">Asignación de cocinero y productos</p>
                    </div>
                </div>
                <form onSubmit={handleAddConsume} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                      <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest">Fecha del Consumo</Label>
                          <Input type="date" value={consumeDate} onChange={(e) => setConsumeDate(e.target.value)} className="h-16 flex items-center w-full rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-none focus:ring-2 ring-indigo-500/20 text-base sm:text-lg font-bold px-5 shadow-inner text-slate-800 dark:text-slate-100 cursor-pointer" />
                      </div>
                      <div className="space-y-2">
                          <Label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest">Turno</Label>
                          <Select value={consumeShift} onValueChange={setConsumeShift}>
                              <SelectTrigger className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-none focus:ring-2 ring-indigo-500/20 text-base sm:text-lg font-bold px-5 shadow-inner text-slate-800 dark:text-slate-100">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-none shadow-2xl">
                                  <SelectItem value="Día" className="rounded-xl py-4 flex items-center cursor-pointer font-bold"><div className="flex items-center gap-3"><Sun className="w-5 h-5 text-amber-500" /> Día</div></SelectItem>
                                  <SelectItem value="Noche" className="rounded-xl py-4 flex items-center cursor-pointer font-bold"><div className="flex items-center gap-3"><Moon className="w-5 h-5 text-indigo-500" /> Noche</div></SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
                  
                  <div className="space-y-2">
                      <Label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest">Cocinero / Personal Responsable</Label>
                      <Input placeholder="Nombre de quien retira..." value={consumeCook} onChange={(e) => setConsumeCook(e.target.value)} className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border-none focus:ring-2 ring-indigo-500/20 text-base sm:text-lg font-bold px-5 shadow-inner placeholder:text-slate-400 placeholder:font-medium" />
                  </div>

                  {/* Add Product Section */}
                  <div className="mt-8 bg-slate-50 dark:bg-slate-800/40 p-5 sm:p-7 rounded-[2rem] border border-slate-200/60 dark:border-slate-700/50">
                      <h4 className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-5 flex items-center gap-2">
                          <PlusCircle className="w-5 h-5" />
                          Añadir Productos Gastados
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-4">
                              <Select value={consumeItemCat} onValueChange={(val) => { setConsumeItemCat(val); setConsumeItemProd(""); }}>
                                <SelectTrigger className="h-16 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm text-base font-bold px-5"><SelectValue placeholder="Categoría..." /></SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">{supportCategories.map((c: any) => <SelectItem key={c.id} value={c.id} className="py-3 rounded-xl cursor-pointer font-semibold">{c.name}</SelectItem>)}</SelectContent>
                              </Select>
                          </div>
                          
                          <div className="md:col-span-4">
                              <Select value={consumeItemProd} onValueChange={setConsumeItemProd} disabled={!consumeItemCat}>
                                <SelectTrigger className="h-16 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm text-base font-bold px-5"><SelectValue placeholder="Producto..." /></SelectTrigger>
                                <SelectContent className="rounded-2xl border-none shadow-2xl">{supportProducts.filter((p: any) => p.category === consumeItemCat).map((p: any) => <SelectItem key={p.id} value={p.id} className="py-3 rounded-xl cursor-pointer font-semibold">{p.name}</SelectItem>)}</SelectContent>
                              </Select>
                          </div>
                          
                          <div className="md:col-span-4 flex flex-row gap-3 mt-1 md:mt-0">
                              <Input type="number" placeholder="Cant." value={consumeItemQty} onChange={(e) => setConsumeItemQty(e.target.value)} className="h-16 rounded-2xl bg-white dark:bg-slate-900 border-none shadow-sm text-lg font-black w-24 px-5 text-center shrink-0" />
                              <Button type="button" onClick={handleAddConsumeItem} className="h-16 flex-1 rounded-2xl font-black uppercase tracking-widest bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900 shadow-none active:scale-95 transition-transform">
                                  Añadir
                              </Button>
                          </div>
                      </div>
                  </div>

                  {/* Added Items List */}
                  {consumeItems.length > 0 && (
                      <div className="space-y-3 pt-3">
                          <Label className="text-[11px] font-black text-slate-500 uppercase ml-1 tracking-widest">Lista Guardada (Sin Registrar Aún)</Label>
                          {consumeItems.map((item, index) => (
                              <div key={index} className="flex justify-between items-center bg-indigo-50/70 dark:bg-indigo-900/20 p-4 sm:p-5 rounded-[1.5rem] border border-indigo-100 dark:border-indigo-800/50">
                                  <div className="flex items-center gap-4 min-w-0 flex-1">
                                      <div className="bg-white dark:bg-slate-900 w-12 h-12 rounded-[1rem] flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm shadow-sm shrink-0 border border-indigo-100 dark:border-indigo-800/50">
                                          {item.quantity}
                                      </div>
                                      <div className="min-w-0 pr-2">
                                        <div className="font-black text-base text-slate-800 dark:text-slate-100 leading-tight truncate">{item.name}</div>
                                        <div className="text-[10px] uppercase font-black text-indigo-500/70 mt-1 tracking-widest">{item.unit}</div>
                                      </div>
                                  </div>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveConsumeItem(index)} className="w-12 h-12 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 shrink-0">
                                      <Trash2 className="w-5 h-5" />
                                  </Button>
                              </div>
                          ))}
                      </div>
                  )}

                  <Button type="submit" disabled={isLoading || consumeItems.length === 0} className="w-full h-16 font-black text-base uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.25rem] mt-6 shadow-xl shadow-indigo-600/20 transition-transform active:scale-95">
                      Registrar Consumo Completo
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="catalogo" className="space-y-6 focus:outline-none mt-0">
                <div className="flex flex-col gap-5 bg-white dark:bg-slate-900 rounded-[2rem] p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                          <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 pl-1 leading-none">Bloques y Productos</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase mt-1 pl-1 tracking-wider">Gestión de catálogo interno</p>
                      </div>
                      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                          <DialogTrigger className="h-14 mt-4 sm:mt-0 sm:h-12 w-full flex items-center justify-center sm:w-auto px-6 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 shadow-none font-black text-xs uppercase tracking-wide transition-colors shrink-0">
                              <Plus className="w-4 h-4 mr-1.5" />
                              Nuevo Bloque
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] w-[95%] max-w-sm p-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
                             <div className="p-6 sm:p-8 space-y-6">
                                <div className="text-center">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm">
                                        <FolderPlus className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="font-black text-2xl tracking-tight">Nuevo Bloque</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Crea una categoría para organizar.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Nombre</Label>
                                        <Input placeholder="Ej. Abarrotes, Verduras..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="h-14 rounded-2xl text-base px-4 bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 ring-indigo-500/20" autoFocus />
                                    </div>
                                    <Button onClick={handleAddCategory} disabled={!newCategoryName} className="w-full h-14 font-black text-base rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-transform">
                                        Crear Bloque
                                    </Button>
                                </div>
                             </div>
                          </DialogContent>
                      </Dialog>
                  </div>

                  <div className="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5 sm:-mx-6 sm:px-6 scrollbar-hide snap-x">
                    <button onClick={() => setSelectedCategory(null)} 
                            className={`snap-start shrink-0 px-6 py-4 rounded-[1.25rem] font-black text-sm transition-all border-2 ${selectedCategory === null ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                        Todos
                    </button>
                    {supportCategories.map((c: any) => (
                        <div key={c.id} className="relative group snap-start shrink-0">
                            <button onClick={() => setSelectedCategory(c.id)} 
                                    className={`px-6 py-4 rounded-[1.25rem] font-black text-sm transition-all border-2 pr-14 ${selectedCategory === c.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                                {c.name}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }} className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-colors ${selectedCategory === c.id ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'}`}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                  </div>

                  {/* Search & Actions */}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-2 pl-4 rounded-[1.25rem] border border-transparent focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                      <Search className="w-5 h-5 text-slate-400" />
                      <input 
                          type="text" 
                          placeholder="Buscar producto en el catálogo..." 
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="flex-1 bg-transparent border-none outline-none text-base font-medium text-slate-800 dark:text-slate-100 h-12 w-full placeholder:text-slate-400"
                      />
                  </div>

                  {/* Lista de Productos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
                        <DialogTrigger className="w-full h-auto min-h-[120px] bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 rounded-[1.5rem] flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 hover:border-indigo-300 transition-all font-black text-sm active:scale-95 p-4 gap-3">
                            <Plus className="w-8 h-8" /> 
                            <span>Añadir Producto</span>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem] w-[95%] max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
                             <div className="p-6 sm:p-8 space-y-6">
                                <div className="text-center">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm">
                                        <PackagePlus className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="font-black text-2xl tracking-tight">Nuevo Producto</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Bloque / Categoría</Label>
                                        <Select value={selectedCategory || ''} onValueChange={setSelectedCategory}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-base px-4 font-medium">
                                                <SelectValue placeholder="Seleccionar bloque..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-xl">
                                                {supportCategories.map((c:any) => <SelectItem key={c.id} value={c.id} className="py-3 cursor-pointer">{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Nombre del Producto</Label>
                                        <Input placeholder="Ej. Arroz Blanco" value={newProductData.name} onChange={(e) => setNewProductData({...newProductData, name: e.target.value})} className="h-14 rounded-2xl text-base px-4 bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 ring-indigo-500/20" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Unidad de Medida</Label>
                                        <Select value={newProductData.unit} onValueChange={(v) => setNewProductData({...newProductData, unit: v})}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-base px-4 font-medium">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-xl">
                                                <SelectItem value="Kilos" className="py-3 cursor-pointer">Kilos (kg)</SelectItem>
                                                <SelectItem value="Gramos" className="py-3 cursor-pointer">Gramos (g)</SelectItem>
                                                <SelectItem value="Litros" className="py-3 cursor-pointer">Litros (L)</SelectItem>
                                                <SelectItem value="Unidades" className="py-3 cursor-pointer">Unidades (und)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddProduct} disabled={!newProductData.name || !selectedCategory} className="w-full h-14 font-black text-base rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-transform mt-2">
                                        Guardar Producto
                                    </Button>
                                </div>
                             </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isEditingProduct} onOpenChange={setIsEditingProduct}>
                        <DialogContent className="rounded-[2rem] w-[95%] max-w-md p-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
                             <div className="p-6 sm:p-8 space-y-6">
                                <div className="text-center">
                                    <div className="bg-indigo-100 dark:bg-indigo-900/50 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm border border-indigo-200/50 dark:border-indigo-800/50">
                                        <Pencil className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h3 className="font-black text-2xl tracking-tight text-slate-800 dark:text-slate-100">Editar Producto</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Bloque / Categoría</Label>
                                        <Select value={editProductData.category} onValueChange={(v) => setEditProductData({...editProductData, category: v})}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-base px-4 font-bold shadow-inner">
                                                <SelectValue placeholder="Seleccionar bloque..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-xl">
                                                {supportCategories.map((c:any) => <SelectItem key={c.id} value={c.id} className="py-3 cursor-pointer font-semibold">{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Nombre del Producto</Label>
                                        <Input placeholder="Ej. Arroz Blanco" value={editProductData.name} onChange={(e) => setEditProductData({...editProductData, name: e.target.value})} className="h-14 rounded-2xl text-base font-bold px-4 bg-slate-50 dark:bg-slate-800 border-none shadow-inner focus:ring-2 ring-indigo-500/20 text-slate-800 dark:text-slate-100" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Unidad de Medida</Label>
                                        <Select value={editProductData.unit} onValueChange={(v) => setEditProductData({...editProductData, unit: v})}>
                                            <SelectTrigger className="h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none text-base px-4 font-bold shadow-inner">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-2xl border-none shadow-xl">
                                                <SelectItem value="Kilos" className="py-3 cursor-pointer font-semibold">Kilos (kg)</SelectItem>
                                                <SelectItem value="Gramos" className="py-3 cursor-pointer font-semibold">Gramos (g)</SelectItem>
                                                <SelectItem value="Litros" className="py-3 cursor-pointer font-semibold">Litros (L)</SelectItem>
                                                <SelectItem value="Unidades" className="py-3 cursor-pointer font-semibold">Unidades (und)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleEditProductSave} disabled={!editProductData.name || !editProductData.category} className="w-full h-14 font-black text-xs uppercase tracking-widest rounded-2xl bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-transform mt-4 text-white">
                                        Guardar Cambios
                                    </Button>
                                </div>
                             </div>
                        </DialogContent>
                    </Dialog>

                    {supportProducts
                      .filter((p: any) => (!selectedCategory || p.category === selectedCategory) && (!catalogSearch || p.name.toLowerCase().includes(catalogSearch.toLowerCase())))
                      .map((p: any) => (
                        <div key={p.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start w-full relative">
                                <div className="bg-white dark:bg-slate-900 w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-800">
                                    <PackagePlus className="w-5 h-5 text-indigo-400/50 dark:text-indigo-600/50" />
                                </div>
                                <div className="flex items-center gap-1 absolute top-0 right-0">
                                  <button onClick={() => {
                                      setEditProductData({ id: p.id, name: p.name, category: p.category, unit: p.unit });
                                      setIsEditingProduct(true);
                                  }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors shrink-0 bg-transparent opacity-100 sm:opacity-0 group-hover:opacity-100">
                                      <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shrink-0 bg-transparent opacity-100 sm:opacity-0 group-hover:opacity-100">
                                      <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col pr-2 mt-1">
                                <h4 className="font-black text-base md:text-lg text-slate-800 dark:text-slate-100 break-words whitespace-normal leading-tight line-clamp-2" title={p.name}>{p.name}</h4>
                                <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] sm:text-xs text-slate-500 font-black uppercase tracking-widest bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded-md">{supportCategories.find(c => c.id === p.category)?.name || "General"}</span>
                                    <span className={`shrink-0 w-max text-[10px] sm:text-xs font-black uppercase tracking-widest px-2 py-1 rounded-md border flex items-center justify-center ${(!p.quantity || p.quantity < 5) ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:border-red-900/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-900/50'}`}>
                                        {p.quantity || 0} {p.unit}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                  </div>
                </div>
            </TabsContent>

            <TabsContent value="historial" className="space-y-6 focus:outline-none mt-0 animate-in fade-in zoom-in-95 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6">
                   {/* Calendar Column */}
                   <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center sticky top-20 w-full overflow-hidden">
                       <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 w-full mb-6 text-center border-b border-slate-100 dark:border-slate-800 pb-4">Seleccionar Día</h3>
                       <div className="w-full flex justify-center overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
                           <div className="snap-center w-full flex justify-center">
                             <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(newDate) => {
                                   if(newDate) setSelectedDate(newDate);
                                }}
                                className="rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 sm:p-4 shadow-sm w-max mx-auto"
                                classNames={{
                                  head_cell: "text-slate-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs w-9 h-9 sm:w-11 sm:h-11",
                                  cell: "h-9 w-9 sm:h-11 sm:w-11 text-center text-sm p-0 flex items-center justify-center",
                                  day: "h-8 w-8 sm:h-10 sm:w-10 text-slate-700 dark:text-slate-200 font-black rounded-lg sm:rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all",
                                  nav_button: "h-7 w-7 sm:h-8 sm:w-8 bg-transparent text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-100 rounded-lg sm:rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                                  caption: "flex justify-between items-center w-full pt-1 pb-4 px-2 relative",
                                  caption_label: "text-sm sm:text-base font-black uppercase tracking-widest text-slate-800 dark:text-slate-100",
                                  day_selected: "bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 opacity-100 shadow-md shadow-indigo-600/20",
                                  day_today: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
                                  day_outside: "text-slate-300 dark:text-slate-600 font-medium",
                                  months: "w-full",
                                  month: "w-full space-y-4",
                                }}
                                modifiers={{
                                    hasRecords: datesWithRecords
                                }}
                                modifiersStyles={{
                                    hasRecords: { 
                                        color: 'var(--color-indigo-600)',
                                        fontWeight: '900'
                                    }
                                }}
                             />
                           </div>
                       </div>
                       <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-6 text-[11px] font-black uppercase tracking-widest text-slate-500 w-full max-w-sm shrink-0">
                           <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50"></span> Registros</div>
                           <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span> Vacío</div>
                       </div>
                   </div>

                   {/* Records Column */}
                   <div className="space-y-4">
                       <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 px-2 flex items-center justify-between">
                           <span>Consumo del día</span>
                           <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-xl">
                               {selectedDate?.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric'})}
                           </span>
                       </h3>
                       
                       {recordsForDate.length === 0 ? (
                           <div className="bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-12 text-center">
                               <CalendarIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                               <p className="font-bold text-slate-500 dark:text-slate-400">No hay consumo este día</p>
                           </div>
                       ) : (
                           <div className="grid gap-3">
                               {recordsForDate.map((r: any) => (
                                <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-4 rounded-[1.25rem] shrink-0 shadow-inner ${r.consumeShift === 'Día' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40'}`}>
                                            {r.consumeShift === 'Día' ? <Sun className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
                                        </div>
                                        <div className="pt-1">
                                            <div className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 leading-none">{r.userName}</div>
                                            <div className="flex flex-wrap gap-2">
                                                {r.items?.map((item: any, idx: number) => (
                                                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-xl">
                                                        <span className="text-indigo-600 dark:text-indigo-400 font-black bg-indigo-50 dark:bg-indigo-900/30 px-1.5 rounded-md">{item.quantity}</span> {item.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 self-end sm:self-auto shrink-0 transition-colors border border-slate-100 dark:border-slate-700">
                                      <Trash2 className="w-5 h-5" />
                                    </Button>
                                </div>
                               ))}
                           </div>
                       )}
                   </div>
               </div>
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

