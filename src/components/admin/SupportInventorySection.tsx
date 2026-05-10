import React, { useState, useMemo, useEffect } from "react";
import { DBData, SupportRecord, SupportRecordItem, SupportProduct, SupportCategory, User } from "../../types";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Save, 
  History, 
  Calendar as CalendarIcon, 
  ClipboardList, 
  Search,
  Trash2, 
  Plus, 
  Minus, 
  Layers, 
  PackagePlus, 
  ArrowRight,
  Settings2,
  TableProperties,
  Download,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SupportInventorySectionProps {
  user: User;
  data: DBData;
  onGlobalRefresh?: () => void;
}

export default function SupportInventorySection({ user, data, onGlobalRefresh }: SupportInventorySectionProps) {
  const [activeTab, setActiveTab] = useState("registro");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState<string | null>(null);

  const handleExportSupport = () => {
    const formattedData = (data.supportRecords || []).flatMap(rec => rec.items.map(item => ({
      "Fecha": new Date(rec.date + "T12:00:00").toLocaleDateString(),
      "ID Registro": rec.id,
      "Artículo": item.name,
      "Bloque": item.category,
      "Cantidad": item.quantity,
      "Unidad": item.unit,
      "Nota": rec.note || ""
    })));
    exportToExcel(formattedData, "Historial_Soporte");
  };

  const handleExportSupportPDF = () => {
    const formattedData = (data.supportRecords || []).flatMap(rec => rec.items.map(item => ({
      "Fecha": new Date(rec.date + "T12:00:00").toLocaleDateString(),
      "Artículo": item.name,
      "Bloque": item.category,
      "Cant.": item.quantity,
      "Unid.": item.unit,
      "Nota": rec.note || "-"
    })));
    exportToPDF(formattedData, "Historial_Soporte", "REPORTE HISTÓRICO DE APOYO");
  };

  const [localCounts, setLocalCounts] = useState<Record<string, number>>({});
  const [localNote, setLocalNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Catalog management states
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "", unit: "uds" });

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const existingRecord = useMemo(() => {
    return data.supportRecords?.find(r => r.date === dateStr);
  }, [data.supportRecords, dateStr]);

  // Sync localCounts when date or existingRecord changes
  useEffect(() => {
    if (existingRecord) {
      const counts: Record<string, number> = {};
      existingRecord.items.forEach(item => {
        counts[item.productId] = item.quantity;
      });
      setLocalCounts(counts);
      setLocalNote(existingRecord.note || "");
    } else {
      setLocalCounts({});
      setLocalNote("");
    }
  }, [existingRecord, selectedDate]);

  const updateCount = (productId: string, delta: number) => {
    setLocalCounts(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleManualCountChange = (productId: string, val: string) => {
    if (val === "") {
      setLocalCounts(prev => ({ ...prev, [productId]: 0 }));
      return;
    }
    
    if (!/^\d+$/.test(val)) {
      toast.error("La cantidad debe ser un número entero positivo sin decimales");
      return;
    }
    
    const num = parseInt(val, 10);
    setLocalCounts(prev => ({
      ...prev,
      [productId]: num
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const items: SupportRecordItem[] = (data.supportProducts || [])
      .filter(p => (localCounts[p.id] || 0) > 0)
      .map(p => ({
        productId: p.id,
        name: p.name,
        quantity: localCounts[p.id] || 0,
        unit: p.unit,
        category: p.category
      }));

    try {
      const res = await fetch("/api/support-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          items,
          note: localNote,
          userName: user.name
        })
      });
      if (res.ok) {
        toast.success(`Inventario de apoyo guardado para ${format(selectedDate, "PPP", { locale: es })}`);
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) {
      toast.error("Error al guardar registro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (date: string) => {
    try {
      const res = await fetch(`/api/support-records?date=${date}`, {
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Registro eliminado");
        if (onGlobalRefresh) onGlobalRefresh();
        if (date === dateStr) {
          setLocalCounts({});
          setLocalNote("");
        }
      }
    } catch (e) {
      toast.error("Error al eliminar registro");
    }
  };

  // Catalog Actions
  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/support-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName })
      });
      if (res.ok) {
        setNewCategoryName("");
        setIsAddingCategory(false);
        toast.success("Bloque creado");
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) { toast.error("Error"); }
  };

  const deleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/support-categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Bloque eliminado");
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) { toast.error("Error"); }
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.category) return;
    try {
      const res = await fetch("/api/support-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct)
      });
      if (res.ok) {
        setNewProduct({ name: "", category: "", unit: "uds" });
        setIsAddingProduct(false);
        toast.success("Producto creado");
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) { toast.error("Error"); }
  };

  const deleteProduct = async (id: string) => {
    try {
      const res = await fetch(`/api/support-products/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Producto eliminado");
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) { toast.error("Error"); }
  };

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");

  const supportCategoriesWithProducts = useMemo(() => {
    const cats = data.supportCategories || [];
    const prods = (data.supportProducts || []).filter(p => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let result = cats.map(cat => ({
      ...cat,
      products: prods.filter(p => p.category === cat.name)
    })).filter(cat => cat.products.length > 0 || !searchTerm);

    if (selectedCategory) {
      result = result.filter(cat => cat.name === selectedCategory);
    }

    return result;
  }, [data.supportCategories, data.supportProducts, searchTerm, selectedCategory]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-wrap gap-2 mb-6">
          <Button 
            variant={activeTab === "registro" ? "default" : "outline"}
            onClick={() => setActiveTab("registro")}
            className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm"
          >
            Registro Diario
          </Button>
          <Button 
            variant={activeTab === "historial" ? "default" : "outline"}
            onClick={() => setActiveTab("historial")}
            className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm"
          >
            Historial
          </Button>
          <Button 
            variant={activeTab === "catalogo" ? "default" : "outline"}
            onClick={() => setActiveTab("catalogo")}
            className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm"
          >
            Catálogo
          </Button>
          <Button 
            variant="outline"
            onClick={handleExportSupport}
            className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline"
            onClick={handleExportSupportPDF}
            className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm border-red-200 text-red-600 hover:bg-red-50"
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            PDF
          </Button>
        </div>

        <TabsContent value="registro" className="animate-in fade-in duration-500">
          <div className="flex flex-col gap-6">
            {/* Sidebar Controls - Stacked vertical */}
            <div className="col-span-12 space-y-4">
               <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                  <CardHeader className="bg-slate-900 text-white p-6">
                    <CardTitle className="flex items-center gap-2 text-lg font-black">
                      <CalendarIcon className="w-5 h-5 text-indigo-400" />
                      Fecha de Conteo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={es}
                      className="rounded-2xl border-none shadow-inner bg-slate-50 w-full"
                    />
                  </CardContent>
               </Card>

               <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-slate-900 text-white">
                  <CardContent className="p-5 space-y-4">
                      
                      {user.role !== "viewer" && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Notas</Label>
                          <textarea 
                             className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:ring-1 focus:ring-indigo-500 min-h-[80px] transition-all font-medium text-slate-900 dark:text-slate-100"
                             placeholder="Observaciones..."
                             value={localNote}
                             onChange={e => setLocalNote(e.target.value)}
                          />
                       </div>
                      )}
                      {user.role !== "viewer" && (
                        <Button 
                           className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all text-xs"
                           onClick={handleSave}
                           disabled={isSaving || (data.supportProducts || []).length === 0}
                        >
                           <Save className="w-4 h-4 mr-2" />
                           {existingRecord ? 'Actualizar' : 'Guardar'}
                        </Button>
                      )}
                  </CardContent>
               </Card>
            </div>

            {/* Main Products Grid - Vertical feed */}
            <div className="col-span-12">
               <div className="bg-white rounded-3xl border border-slate-100 shadow-xl flex flex-col h-[60vh]">
                  <div className="p-5 border-b border-slate-100 bg-slate-50 rounded-t-3xl space-y-4">
                     <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                           <Layers className="w-5 h-5 text-indigo-600" />
                           Insumos
                        </h2>
                        <Input 
                           placeholder="Buscar producto..."
                           className="w-48 bg-white dark:bg-slate-800 border-none text-xs rounded-xl h-8 text-slate-900 dark:text-slate-100"
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                        />
                     </div>
                     
                     <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                        <Button
                           variant={selectedCategory === null ? "default" : "outline"}
                           size="sm"
                           onClick={() => setSelectedCategory(null)}
                           className={`rounded-full px-3 h-7 text-[9px] font-black uppercase tracking-widest ${selectedCategory === null ? "bg-indigo-600" : "bg-white text-slate-400 border-slate-200"}`}
                        >
                           Todo
                        </Button>
                        {(data.supportCategories || []).map(cat => (
                           <Button
                              key={cat.id}
                              variant={selectedCategory === cat.name ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedCategory(cat.name)}
                              className={`rounded-full px-3 h-7 text-[9px] font-black uppercase tracking-widest shrink-0 ${selectedCategory === cat.name ? "bg-indigo-600" : "bg-white text-slate-400 border-slate-200"}`}
                           >
                              {cat.name}
                           </Button>
                        ))}
                     </div>
                  </div>

                      <div className="flex-1 overflow-y-auto pr-2">
                         <div className="p-4 space-y-4">
                            {supportCategoriesWithProducts.length === 0 ? (
                              <div className="h-40 flex flex-col items-center justify-center text-center opacity-40 italic text-slate-400">
                                 <PackagePlus className="w-10 h-10 mb-2" />
                                 <p className="text-xs font-black uppercase tracking-widest">Catálogo vacío</p>
                              </div>
                            ) : (
                              supportCategoriesWithProducts.map(cat => (
                                <div key={cat.id} className="space-y-2">
                                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pt-2 pb-1 bg-white sticky top-0 z-10 border-b border-slate-100">{cat.name}</div>
                                   <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                                      {cat.products.map(p => (
                                        <div key={p.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                           <div className="flex flex-col pr-2 flex-1">
                                              <span className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">{p.name}</span>
                                              <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{p.unit}</span>
                                           </div>
                                           {user.role !== "viewer" && (
                                             <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-white shadow-sm hover:bg-slate-50 text-slate-400" onClick={() => updateCount(p.id, -1)}><Minus className="w-3 h-3" /></Button>
                                                <Input 
                                                   type="number"
                                                   className="w-12 h-7 text-center font-black text-indigo-600 text-xs rounded-lg border-none bg-white dark:bg-slate-800 p-0 dark:text-slate-100"
                                                   value={localCounts[p.id] || 0}
                                                   onChange={(e) => handleManualCountChange(p.id, e.target.value)}
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-indigo-600 shadow-sm text-white" onClick={() => updateCount(p.id, 1)}><Plus className="w-3 h-3" /></Button>
                                             </div>
                                           )}
                                        </div>
                                      ))}
                                      {cat.products.length === 0 && <p className="text-[9px] text-slate-300 italic px-2">Sin productos</p>}
                                   </div>
                                </div>
                              ))
                            )}
                         </div>
                      </div>
                   </div>
             </div>
           </div>
         </TabsContent>

        <TabsContent value="historial" className="animate-in fade-in duration-500">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
             <CardHeader className="p-8 border-b border-slate-50">
                <div className="flex items-center justify-between">
                   <div>
                      <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                         <History className="w-7 h-7 text-indigo-600" />
                         Registros Anteriores
                      </CardTitle>
                      <CardDescription className="font-bold text-xs uppercase tracking-widest text-slate-400 mt-1">
                         Consulta y modificación de inventario histórico
                      </CardDescription>
                   </div>
                   <Badge className="bg-slate-900 text-white font-mono px-4 py-1.5 rounded-full">{data.supportRecords?.length || 0} Registros</Badge>
                </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                   <div className="lg:col-span-5 p-8 border-r border-slate-50 bg-slate-50/30">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        locale={es}
                        className="rounded-3xl border border-slate-100 bg-white shadow-xl p-4 w-full max-w-sm mx-auto"
                        modifiers={{
                           hasData: (date) => !!data.supportRecords?.some(r => isSameDay(new Date(r.date + "T12:00:00"), date))
                        }}
                        modifiersClassNames={{
                           hasData: "bg-indigo-50 font-bold text-indigo-700 ring-2 ring-indigo-500/20"
                        }}
                      />
                   </div>
                    <div className="lg:col-span-12 p-8 flex flex-col h-[700px] bg-white">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-50 pb-6">
                         <div>
                            <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 text-xl">
                                Detalle del día {existingRecord && <Badge className="bg-indigo-600 font-mono text-[10px]">ID: {existingRecord.id.substring(0,8)}</Badge>}
                            </h3>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                               <CalendarIcon className="w-3.5 h-3.5" />
                               {format(selectedDate, "PPP", { locale: es })}
                            </p>
                         </div>
                         <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-[200px] md:max-w-md">
                               <Button
                                  variant={selectedHistoryCategory === null ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setSelectedHistoryCategory(null)}
                                  className={`rounded-full px-3 h-7 text-[9px] font-black uppercase tracking-widest ${selectedHistoryCategory === null ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border-slate-200"}`}
                               >
                                  Todo
                               </Button>
                               {Array.from(new Set((existingRecord?.items || []).map(i => i.category))).filter(Boolean).map(catName => (
                                  <Button
                                     key={catName}
                                     variant={selectedHistoryCategory === catName ? "default" : "outline"}
                                     size="sm"
                                     onClick={() => setSelectedHistoryCategory(catName)}
                                     className={`rounded-full px-3 h-7 text-[9px] font-black uppercase tracking-widest shrink-0 ${selectedHistoryCategory === catName ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border-slate-200"}`}
                                  >
                                     {catName}
                                  </Button>
                               ))}
                            </div>
                            <div className="relative flex-1 md:w-64">
                               <History className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                               <Input 
                                  placeholder="Filtrar registros..." 
                                  className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100"
                                  value={historySearchTerm}
                                  onChange={e => setHistorySearchTerm(e.target.value)}
                               />
                            </div>
                            {existingRecord && user.role !== "viewer" && (
                              <div className="flex gap-2">
                                 <Button variant="outline" className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-slate-200 h-10 shadow-sm" onClick={() => setActiveTab("registro")}>Modificar</Button>
                                 <AlertDialog>
                                    <AlertDialogTrigger className="rounded-xl h-10 w-10 p-0 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 inline-flex items-center justify-center transition-all border border-slate-100 shadow-sm">
                                       <Trash2 className="w-5 h-5"/>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl border-none p-8 shadow-2xl">
                                       <AlertDialogHeader>
                                          <AlertDialogTitle className="text-xl font-black uppercase italic text-slate-900">¿Eliminar Registro?</AlertDialogTitle>
                                          <AlertDialogDescription className="text-sm font-bold text-slate-400">
                                             Esta acción borrará permanentemente los datos del día {format(selectedDate, "PPP", { locale: es })}.
                                          </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter className="mt-6 flex gap-3">
                                          <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px] flex-1">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction 
                                             className="rounded-xl bg-red-600 hover:bg-red-700 font-black uppercase tracking-widest text-[10px] px-8 flex-1"
                                             onClick={() => handleDeleteRecord(dateStr)}
                                          >
                                             Eliminar Ahora
                                          </AlertDialogAction>
                                       </AlertDialogFooter>
                                    </AlertDialogContent>
                                 </AlertDialog>
                              </div>
                           )}
                         </div>
                      </div>

                      <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                         {existingRecord ? (
                           <div className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {existingRecord.items
                                   .filter(item => 
                                     (item.name.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                                     item.category.toLowerCase().includes(historySearchTerm.toLowerCase())) &&
                                     (!selectedHistoryCategory || item.category === selectedHistoryCategory)
                                   )
                                   .map((item, idx) => (
                                   <div key={idx} className="p-5 bg-white border border-slate-100 rounded-3xl flex items-center justify-between shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group active:scale-[0.98]">
                                      <div className="flex-1 min-w-0 pr-4">
                                         <p className="text-sm font-black text-slate-800 uppercase break-words leading-tight group-hover:text-indigo-600 transition-colors">{item.name}</p>
                                         <p className="text-[9px] text-slate-400 font-bold mt-1.5 uppercase leading-none tracking-widest">{item.category}</p>
                                      </div>
                                      <div className="text-right bg-slate-50 px-3 py-2 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                                         <p className="text-xl font-black text-indigo-600 font-mono leading-none">{item.quantity}</p>
                                         <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter mt-1">{item.unit}</p>
                                      </div>
                                   </div>
                                 ))}
                              </div>

                              {existingRecord.items.filter(item => 
                                (item.name.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                                item.category.toLowerCase().includes(historySearchTerm.toLowerCase())) &&
                                (!selectedHistoryCategory || item.category === selectedHistoryCategory)
                              ).length === 0 && (
                                <div className="py-20 text-center text-slate-300">
                                   <p className="text-xs font-bold uppercase tracking-widest">No hay resultados para esta búsqueda</p>
                                </div>
                              )}

                              {existingRecord.note && !historySearchTerm && (
                                <div className="p-6 rounded-3xl bg-indigo-50/50 border border-indigo-100 shadow-inner">
                                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                      <ClipboardList className="w-3.5 h-3.5" />
                                      Nota del Registro
                                   </p>
                                   <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{existingRecord.note}"</p>
                                </div>
                              )}
                           </div>
                         ) : (
                           <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-slate-400 py-32 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                              <TableProperties className="w-16 h-16 mb-4" />
                              <p className="text-lg font-black uppercase tracking-[0.2em]">Seleccione un día con datos</p>
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalogo" className="animate-in fade-in duration-500">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-4 border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                 <CardHeader className="bg-slate-900 text-white p-6">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                       <Settings2 className="w-5 h-5 text-indigo-400" />
                       Gestión Maestra
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nuevo Bloque de Apoyo</h4>
                       <div className="flex gap-2">
                          <Input 
                             placeholder="Ex: Limpieza..." 
                             className="rounded-xl border-slate-200 h-10 text-black text-sm"
                             value={newCategoryName}
                             onChange={e => setNewCategoryName(e.target.value)}
                          />
                          <Button 
                             onClick={addCategory}
                             className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-4 shadow-lg shadow-indigo-200"
                          >
                             <Plus className="w-4 h-4" />
                          </Button>
                       </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-50">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nuevo Artículo de Apoyo</h4>
                       <div className="space-y-3">
                          <div className="space-y-1">
                             <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Nombre</Label>
                             <Input 
                                placeholder="Escobas, Cloro..." 
                                className="rounded-xl border-slate-200 h-10 text-black text-sm"
                                value={newProduct.name}
                                onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                             />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Categoría</Label>
                             <Select value={newProduct.category} onValueChange={v => setNewProduct({...newProduct, category: v})}>
                                <SelectTrigger className="rounded-xl border-slate-200 h-10 text-slate-900 text-sm">
                                   <SelectValue placeholder="Seleccione Bloque" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                   {(data.supportCategories || []).map(c => (
                                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Unidad</Label>
                             <Input 
                                placeholder="uds, lts, kg..." 
                                className="rounded-xl border-slate-200 h-10 text-black text-sm"
                                value={newProduct.unit}
                                onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                             />
                          </div>
                          <Button 
                             onClick={addProduct}
                             className="w-full bg-slate-900 hover:bg-black text-white rounded-xl h-10 font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200"
                          >
                             <PackagePlus className="w-3.5 h-3.5 mr-2" />
                             Registrar en Catálogo
                          </Button>
                       </div>
                    </div>
                 </CardContent>
              </Card>

              <Card className="lg:col-span-8 border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                 <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <CardTitle className="text-lg font-black uppercase tracking-tight text-slate-900">
                          Catálogo Actual de Apoyo
                       </CardTitle>
                       <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input 
                             placeholder="Buscar en catálogo..."
                             className="pl-10 h-9 rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100"
                             value={catalogSearchTerm}
                             onChange={e => setCatalogSearchTerm(e.target.value)}
                          />
                       </div>
                    </div>
                 </CardHeader>
                 <CardContent className="p-0">
                    <ScrollArea className="h-[600px]">
                       <div className="p-6 space-y-8">
                          {(data.supportCategories || [])
                             .filter(cat => 
                               cat.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()) ||
                               (data.supportProducts || []).some(p => p.category === cat.name && p.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()))
                             )
                             .map(cat => (
                             <div key={cat.id} className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2 bg-white sticky top-0 z-10 py-2">
                                   <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">{cat.name}</h5>
                                   <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-slate-300 hover:text-red-500 rounded-lg"
                                      onClick={() => deleteCategory(cat.id)}
                                   >
                                      <Trash2 className="w-3.5 h-3.5" />
                                   </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                   {(data.supportProducts || [])
                                      .filter(p => p.category === cat.name)
                                      .filter(p => p.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()))
                                      .map(p => (
                                      <div key={p.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all">
                                         <div>
                                            <p className="text-xs font-black text-slate-800 uppercase line-clamp-1">{p.name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{p.unit}</p>
                                         </div>
                                         <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-200 group-hover:text-red-400 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => deleteProduct(p.id)}
                                         >
                                            <Trash2 className="w-4 h-4" />
                                         </Button>
                                      </div>
                                   ))}
                                   {(data.supportProducts || [])
                                      .filter(p => p.category === cat.name)
                                      .filter(p => p.name.toLowerCase().includes(catalogSearchTerm.toLowerCase()))
                                      .length === 0 && (
                                      <p className="text-[10px] text-slate-300 italic p-4 col-span-full text-center border-2 border-dashed border-slate-50 rounded-2xl">Sin artículos que coincidan</p>
                                   )}
                                </div>
                             </div>
                          ))}
                          {(data.supportCategories || []).length === 0 && (
                             <div className="h-64 flex flex-col items-center justify-center text-slate-300 opacity-40 italic">
                                <Layers className="w-12 h-12 mb-4" />
                                <p className="text-sm font-black uppercase tracking-widest">Catálogo Vacío</p>
                             </div>
                          )}
                       </div>
                    </ScrollArea>
                 </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
