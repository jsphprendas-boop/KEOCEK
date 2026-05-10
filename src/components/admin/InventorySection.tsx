import React, { useState, useMemo } from "react";
import { DBData, Category, Product, User } from "../../types";
import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { apiFetch } from "../../lib/api";
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  Edit3, 
  AlertTriangle,
  FolderPlus,
  BoxSelect,
  Eye,
  EyeOff,
  History,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  Download,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface InventorySectionProps {
  user: User;
  data: DBData;
  searchTerm: string;
  onExportAll: () => void;
  onGlobalRefresh?: () => void;
}

export default function InventorySection({ user, data, searchTerm, onExportAll, onGlobalRefresh }: InventorySectionProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>('fuerza_publica');
  const [isManagingInventories, setIsManagingInventories] = useState(false);
  const [newInventoryName, setNewInventoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [viewMode, setViewMode] = useState<"blocks" | "all-products">("blocks");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  
  const [refillType, setRefillType] = useState<"semanal" | "global">("global");
  
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState<{
    product: Product | null;
    type: "in" | "out";
    quantity: number;
    note: string;
  }>({
    product: null,
    type: "in",
    quantity: 1,
    note: ""
  });

  const openStockAdjustment = (product: Product, changeType: "in" | "out") => {
    setStockAdjustment({
      product,
      type: changeType,
      quantity: 1,
      note: ""
    });
    setIsAdjustingStock(true);
  };

  const toggleLocationVisibility = async (locationId: string) => {
    try {
      await apiFetch("/api/settings/locations", {
        method: "POST",
        body: JSON.stringify({ action: 'toggle', location: { id: locationId } })
      });
      toast.success("Visibilidad actualizada");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al actualizar visibilidad");
    }
  };
  
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: "",
    category: "",
    quantity: "0",
    unit: "",
    expiryDate: ""
  });

  const handleExportInventory = () => {
    const formattedData = filteredProducts.map(p => ({
      "Categoría": p.category,
      "Nombre": p.name,
      "Stock": p.quantity,
      "Unidad": p.unit || "N/A",
      "Estado": p.isHidden ? "Oculto" : "Visible",
      "Vencimiento": p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : "N/A"
    }));
    exportToExcel(formattedData, `Inventario_${selectedCategory || 'General'}`);
  };

  const handleExportInventoryPDF = () => {
    const formattedData = filteredProducts.map(p => ({
      "Bloque": p.category,
      "Artículo": p.name,
      "Stock": `${p.quantity} ${p.unit || 'uds'}`,
      "Estado": p.isHidden ? "Oculto" : "Visible",
      "Vencimiento": p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : "N/A"
    }));
    exportToPDF(formattedData, `Inventario_${selectedCategory || 'General'}`, `REPORTE DE INVENTARIO - ${selectedCategory || 'GENERAL'}`);
  };

  const filteredCategories = useMemo(() => {
    // Default to the first location if none selected, to avoid empty filter
    const currentLocation = selectedLocation || data.settings?.customLocations?.[0]?.id || 'fuerza_publica';
    let cats = data.categories.filter(c => (c.location || 'fuerza_publica') === currentLocation);
    
    if (!searchTerm) return cats;
    return cats.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data.categories, searchTerm, selectedLocation, data.settings?.customLocations]);

  const filteredProducts = useMemo(() => {
    const currentLocation = selectedLocation || data.settings?.customLocations?.[0]?.id || 'fuerza_publica';
    let prods = data.products.filter(p => (p.location || 'fuerza_publica') === currentLocation);
    if (selectedCategory) {
      prods = prods.filter(p => p.category === selectedCategory);
    }
    if (searchTerm) {
      prods = prods.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return prods;
  }, [data.products, searchTerm, selectedCategory, selectedLocation, data.settings?.customLocations]);

  const allMovements = useMemo(() => {
    const current = data.movements || [];
    const archived = data.pastHistories?.flatMap(h => h.movements) || [];
    return [...current, ...archived].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data.movements, data.pastHistories]);

  const addCategory = async () => {
    if (!newCategoryName) return;
    try {
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategoryName, location: selectedLocation })
      });
      toast.success("Categoría añadida");
      setNewCategoryName("");
      setIsAddingCategory(false);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al añadir categoría");
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    const productsInCat = data.products.filter(p => p.category === name && (p.location || 'fuerza_publica') === selectedLocation);
    if (productsInCat.length > 0) {
      if (!window.confirm(`Este bloque contiene ${productsInCat.length} artículos. ¿Estás seguro de que deseas eliminarlo?`)) return;
    } else {
      if (!window.confirm("¿Seguro que deseas eliminar este bloque?")) return;
    }

    try {
      await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
      toast.success("Bloque eliminado");
      if (selectedCategory === name) setSelectedCategory(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al eliminar bloque");
    }
  };

  const updateCategory = async () => {
    if (!editingCategory || !newCategoryName) return;
    try {
      await apiFetch(`/api/categories/${editingCategory.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newCategoryName })
      });
      toast.success("Categoría actualizada");
      setNewCategoryName("");
      setEditingCategory(null);
      setIsEditingCategory(false);
      // If the renamed category was selected, update selection
      if (selectedCategory === editingCategory.name) {
        setSelectedCategory(newCategoryName);
      }
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al actualizar categoría");
    }
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.category) {
      toast.error("Nombre y categoría son requeridos");
      return;
    }

    const rawQty = newProduct.quantity || "0";
    if (!/^\d+$/.test(rawQty)) {
      toast.error("La cantidad debe ser un número entero positivo sin decimales");
      return;
    }

    const qty = parseInt(rawQty, 10);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({...newProduct, location: selectedLocation, quantity: qty.toString(), refillType})
      });
      toast.success("Producto añadido al inventario");
      setIsAddingProduct(false);
      setNewProduct({
        name: "",
        category: "",
        quantity: "0",
        unit: "",
        expiryDate: ""
      });
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al añadir producto");
    }
  };

  const deleteProduct = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm("¿Seguro que deseas eliminar este producto? Se moverá a la papelera de recuperación.")) return;
    try {
      const product = data.products.find(p => p.id === id);
      
      // 1. Move to trash
      await apiFetch("/api/system/trash", {
        method: "POST",
        body: JSON.stringify({ 
          type: "product", 
          data: product,
          deletedAt: new Date().toISOString(),
          deletedBy: user.email
        })
      });

      // 2. Delete original
      await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      toast.success("Producto movido a la papelera");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al procesar eliminación");
    }
  };

  const toggleProductVisibility = async (product: Product) => {
    try {
      await apiFetch(`/api/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...product, isHidden: !product.isHidden })
      });
      toast.success(product.isHidden ? "Producto visible para el cocinero" : "Producto oculto al cocinero");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al actualizar visibilidad");
    }
  };

  const confirmStockAdjustment = async () => {
    const { product, type, quantity, note } = stockAdjustment;
    if (!product) return;
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }
    if (!note.trim()) {
      toast.error("Debe proporcionar una justificación para este ajuste");
      return;
    }

    try {
      await apiFetch("/api/inventory/add", {
        method: "POST",
        body: JSON.stringify({ 
          productId: product.id, 
          quantity,
          type,
          note,
          location: product.location
        })
      });
      toast.success(`Inventario actualizado: ${type === 'in' ? '+' : '-'}${quantity}`);
      setIsAdjustingStock(false);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al actualizar inventario");
    }
  };

  const updateProduct = async () => {
    if (!editingProduct) return;
    
    const rawQty = editingProduct.quantity || "0";
    if (!/^\d+$/.test(rawQty)) {
      toast.error("La cantidad debe ser un número entero positivo sin decimales");
      return;
    }

    const qty = parseInt(rawQty, 10);
    try {
      await apiFetch(`/api/products/${editingProduct.id}`, {
        method: "PUT",
        body: JSON.stringify({...editingProduct, quantity: qty.toString()})
      });
      toast.success("Producto actualizado");
      setIsEditingProduct(false);
      setEditingProduct(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e) {
      toast.error("Error al actualizar");
    }
  };

  const isExpiringSoon = (dateStr: string) => {
    if (!dateStr) return false;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return diff > 0 && diff < (7 * 24 * 60 * 60 * 1000); // 7 days
  };

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const ProductCard = ({ product }: { product: Product }) => {
    const expired = isExpired(product.expiryDate);
    const expiringSoon = isExpiringSoon(product.expiryDate);
    const stock = parseInt(product.quantity) || 0;
    const progressPercent = Math.min((stock / 50) * 100, 100); // 50 as a visual "target" for the bar

    return (
      <Card 
        className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group overflow-hidden flex flex-col h-full active:scale-[0.98]"
        onClick={() => setSelectedDetailProduct(product)}
      >
        <div className="p-4 flex-1">
          <div className="flex justify-between items-start mb-4">
            <div className="min-w-0 pr-2">
              <h4 className="font-bold text-slate-800 text-sm md:text-base leading-tight truncate group-hover:text-indigo-600 transition-colors">
                {product.name}
              </h4>
              <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 px-1.5 py-0 text-[9px] uppercase font-black mt-1 tracking-wider">
                {product.category}
              </Badge>
            </div>
            
            {user.role !== "viewer" && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-7 w-7 rounded-lg ${product.isHidden ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                  onClick={(e) => { e.stopPropagation(); toggleProductVisibility(product); }}
                >
                  {product.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); setEditingProduct(product); setIsEditingProduct(true); }}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger 
                    className="h-7 w-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-bold tracking-tight">¿Eliminar artículo?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500 font-medium pb-2">
                        El artículo <strong className="text-slate-900 leading-relaxed font-black">{product.name}</strong> será enviado a la papelera de recuperación.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-2xl font-bold border-slate-200">Mantener</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-2xl font-bold px-6 shadow-lg shadow-red-500/20" onClick={() => deleteProduct(product.id)}>
                        Confirmar Eliminación
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {/* Stock Area */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col items-center justify-center group/stock">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Existencia</span>
              <div className="flex items-center gap-2">
                {user.role !== "viewer" && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); openStockAdjustment(product, "out"); }}
                    className="h-6 w-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all font-bold"
                  >-</button>
                )}
                <span className="text-lg font-black text-indigo-600 min-w-[1.5rem] text-center font-mono">{product.quantity}</span>
                {user.role !== "viewer" && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); openStockAdjustment(product, "in"); }}
                    className="h-6 w-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-green-50 hover:text-green-500 hover:border-green-100 transition-all font-bold"
                  >+</button>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{product.unit || 'uds'}</span>
            </div>

            {/* Expiry Area */}
            <div className={`rounded-2xl p-3 border flex flex-col items-center justify-center transition-colors ${
              expired ? 'bg-red-50 border-red-100' : 
              expiringSoon ? 'bg-amber-50 border-amber-100 animate-pulse' : 
              'bg-indigo-50/50 border-indigo-100'
            }`}>
              <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
                expired ? 'text-red-400' : expiringSoon ? 'text-amber-400' : 'text-indigo-400'
              }`}>Vencimiento</span>
              <span className={`text-[11px] font-black font-mono ${
                expired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-indigo-600'
              }`}>
                {product.expiryDate ? format(new Date(product.expiryDate), "dd/MM/yy") : "- - / - -"}
              </span>
              {expired ? (
                <div className="mt-1 flex items-center gap-1 bg-red-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase ring-4 ring-red-50">
                   <AlertTriangle className="w-2.5 h-2.5" /> Vencido
                </div>
              ) : expiringSoon ? (
                <div className="mt-1 bg-amber-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase ring-4 ring-amber-50">
                  Pronto
                </div>
              ) : (
                <div className="mt-1 text-[8px] text-green-500 font-black uppercase">Estable</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
               <span>Nivel de Stock</span>
               <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  expired ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' : 
                  expiringSoon ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 
                  'bg-gradient-to-r from-indigo-500 to-indigo-400'
                }`} 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Location Switcher */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full max-w-md mx-auto relative flex-wrap">
        {data.settings?.customLocations?.map((loc: any) => (
          <div key={loc.id} className="flex-1 min-w-[50%] relative group/loc">
            <button
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                selectedLocation === loc.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              onClick={() => { setSelectedLocation(loc.id); setSelectedCategory(null); }}
            >
              <BoxSelect className="w-4 h-4" />
              {loc.name}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); toggleLocationVisibility(loc.id); }}
              className={`absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-lg transition-all ${
                selectedLocation === loc.id ? 'text-indigo-200 hover:text-white hover:bg-indigo-500' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={loc.visible ? "Visible para cocineros" : "Oculto para cocineros"}
            >
              {loc.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 md:h-8 md:w-8 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                onClick={() => setSelectedCategory(null)}
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 rotate-180" />
              </Button>
            )}
            <h3 className="font-bold text-slate-900 flex items-center gap-2 tracking-tight text-sm md:text-base">
              {selectedCategory ? `📁 Bloque: ${selectedCategory}` : "📦 Catálogo de Bloques"}
              <span className="text-[9px] md:text-[10px] font-normal text-slate-500 bg-slate-50 px-1.5 md:px-2 py-0.5 border border-slate-200 rounded-full">
                {selectedCategory ? `${filteredProducts.length} Artículos` : `${data.categories.length} Categorías`}
              </span>
            </h3>
          </div>
          <p className="text-[10px] md:text-xs text-slate-500">
            {selectedCategory 
              ? `Gestionando artículos dentro de ${selectedCategory}`
              : "Organice y gestione sus artículos de cocina en tiempo real"}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap items-center">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={() => setIsManagingInventories(true)}
          >
            <Settings className="w-3.5 h-3.5 mr-2" />
            Inventarios
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            onClick={handleExportInventory}
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleExportInventoryPDF}
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            PDF
          </Button>
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
            <Button 
              variant={viewMode === "blocks" ? "default" : "ghost"} 
              size="sm" 
              className={`text-[10px] h-8 rounded-lg ${viewMode === "blocks" ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}
              onClick={() => setViewMode("blocks")}
            >
              Bloques
            </Button>
            <Button 
              variant={viewMode === "all-products" ? "default" : "ghost"} 
              size="sm" 
              className={`text-[10px] h-8 rounded-lg ${viewMode === "all-products" ? "bg-white shadow text-indigo-600" : "text-slate-500"}`}
              onClick={() => setViewMode("all-products")}
            >
              Artículos
            </Button>
          </div>
          {user.role !== "viewer" && (
            <>
              {viewMode === "blocks" && !selectedCategory ? (
                <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                  <DialogTrigger className="flex-1 sm:flex-none border border-slate-200 hover:bg-slate-50 rounded-xl h-9 md:h-10 text-[10px] md:text-xs font-bold transition-all px-3 md:px-4 inline-flex items-center justify-center shrink-0">
                    <FolderPlus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2 text-indigo-600" />
                    Nuevo Bloque
                  </DialogTrigger>
                  <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto">
                    <DialogHeader className="bg-slate-900 text-white p-6">
                      <DialogTitle className="text-lg font-bold tracking-tight">Nueva Categoría</DialogTitle>
                      <DialogDescription className="text-slate-400 text-xs uppercase tracking-widest font-mono">Creación de Bloque en {selectedLocation === 'fuerza_publica' ? 'Fuerza Pública' : 'Fronteras'}</DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4 bg-white">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Nombre del Bloque</Label>
                        <Input 
                          value={newCategoryName} 
                          onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="Ej: Abarrotes, Verdura..."
                          className="border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <Button onClick={addCategory} className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 transition-all shadow-lg shadow-indigo-500/20">
                        Confirmar Categoría
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
                  <DialogTrigger className="flex-1 sm:flex-none bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl h-9 md:h-10 text-[10px] md:text-xs font-bold transition-all px-3 md:px-4 shadow-lg shadow-indigo-500/20 inline-flex items-center justify-center shrink-0" onClick={() => setNewProduct(prev => ({...prev, category: selectedCategory || ""}))}>
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" />
                    Añadir Artículo
                  </DialogTrigger>
                  <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-xl mx-auto">
                    <DialogHeader className="bg-slate-900 text-white p-6 text-center">
                      <DialogTitle className="text-lg md:text-xl font-bold tracking-tight">Registro de Producto Maestro</DialogTitle>
                      <DialogDescription className="text-slate-400 text-[10px] md:text-xs uppercase tracking-widest font-mono">Incorporación al Inventario de {selectedLocation === 'fuerza_publica' ? 'Fuerza Pública' : 'Fronteras'}</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-8 bg-white max-h-[80vh] overflow-y-auto">
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Nombre del Producto</Label>
                        <Input 
                          value={newProduct.name} 
                          onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                          placeholder="Arroz, Frijoles..."
                          className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Categoría / Bloque</Label>
                        <Select 
                          value={newProduct.category} 
                          onValueChange={v => setNewProduct({...newProduct, category: v})}
                        >
                          <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                            <SelectValue placeholder="Seleccionar bloque" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-200 rounded-xl">
                            {data.categories.map(c => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Stock Inicial</Label>
                        <Input 
                          type="number"
                          value={newProduct.quantity} 
                          onChange={e => setNewProduct({...newProduct, quantity: e.target.value})}
                          className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Ingreso</Label>
                        <Select value={refillType} onValueChange={(v: "semanal" | "global") => setRefillType(v)}>
                          <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                            <SelectValue placeholder="Tipo Ingreso" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-200 rounded-xl">
                            <SelectItem value="global">Global</SelectItem>
                            <SelectItem value="semanal">Semanal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Unidad de Medida</Label>
                        <Input 
                          value={newProduct.unit} 
                          onChange={e => setNewProduct({...newProduct, unit: e.target.value})}
                          placeholder="Ej: Kilos, Litros..."
                          className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Fecha de Vencimiento</Label>
                        <Input 
                          type="date"
                          value={newProduct.expiryDate} 
                          onChange={e => setNewProduct({...newProduct, expiryDate: e.target.value})}
                          className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 uppercase font-mono text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <Button onClick={addProduct} className="md:col-span-2 w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 md:h-12 transition-all shadow-lg shadow-indigo-500/20 text-xs md:text-sm">
                        Integrar Artículo al Inventario
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
      </div>

      {viewMode === "all-products" && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 mb-4 bg-white p-4 rounded-2xl border border-slate-200">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-4 h-8 text-[10px] font-black uppercase tracking-widest active:scale-95 ${selectedCategory === null ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border-slate-200"}`}
          >
            Todo
          </Button>
          {data.categories.map(cat => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.name ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.name)}
              className={`rounded-full px-4 h-8 text-[10px] font-black uppercase tracking-widest shrink-0 active:scale-95 ${selectedCategory === cat.name ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border-slate-200"}`}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      )}

      {viewMode === "blocks" ? (
        !selectedCategory ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {filteredCategories.map(category => (
              <div key={category.id} className="relative group/cat">
                <Card 
                  className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group relative overflow-hidden flex flex-row items-center p-3 active:scale-95"
                  onClick={() => setSelectedCategory(category.name)}
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
                  <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-slate-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all mr-4">
                    <BoxSelect className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm md:text-lg font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase line-clamp-1">
                      {category.name}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-[10px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {data.products.filter(p => p.category === category.name && (p.location || 'fuerza_publica') === selectedLocation).length} Artículos
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </Card>
                
                {user.role === 'admin' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteCategory(category.id, category.name); }}
                    className="absolute -top-2 -right-2 bg-white border border-slate-200 p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:border-red-100 shadow-sm opacity-0 group-hover/cat:opacity-100 transition-opacity z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <div className="col-span-full h-40 md:h-80 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                <FolderPlus className="w-8 md:w-12 h-8 md:h-12 mb-2 md:mb-4 opacity-10" />
                <p className="text-[10px] md:text-sm font-bold uppercase tracking-[0.2em] opacity-40">No hay bloques registrados</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}

            {filteredProducts.length === 0 && (
              <div className="col-span-full h-40 md:h-80 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                <BoxSelect className="w-8 md:w-12 h-8 md:h-12 mb-2 opacity-10" />
                <p className="text-[10px] md:text-sm font-bold uppercase tracking-[0.2em] opacity-40">Sin artículos en este bloque</p>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* Mobile All-Products List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
            {data.products.filter(p => 
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              p.category.toLowerCase().includes(searchTerm.toLowerCase())
            ).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 uppercase text-[10px] tracking-widest font-black">
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead>Bloque / Categoría</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.products.filter(p => 
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  p.category.toLowerCase().includes(searchTerm.toLowerCase())
                ).map(product => (
                  <TableRow key={product.id} className="group cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedDetailProduct(product)}>
                    <TableCell className="font-bold text-slate-800">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-none px-2 py-0.5 rounded-full text-[10px] uppercase font-bold">
                        {product.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl w-max">
                        {user.role !== "viewer" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white shrink-0 text-slate-500 font-bold" onClick={(e) => { e.stopPropagation(); openStockAdjustment(product, "out"); }}>-</Button>
                        )}
                        <span className="font-mono font-black text-indigo-600 w-8 text-center">{product.quantity}</span>
                        {user.role !== "viewer" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white shrink-0 text-slate-500 font-bold" onClick={(e) => { e.stopPropagation(); openStockAdjustment(product, "in"); }}>+</Button>
                        )}
                        <span className="text-[10px] text-slate-400 ml-1 font-bold uppercase mr-1">{product.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-mono font-medium ${
                        isExpired(product.expiryDate) ? 'text-red-500 font-bold' : 
                        isExpiringSoon(product.expiryDate) ? 'text-amber-500 font-bold' : 'text-slate-500'
                      }`}>
                        {product.expiryDate ? format(new Date(product.expiryDate), "dd MMM yyyy", { locale: es }) : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={`h-8 w-8 ${product.isHidden ? 'text-amber-500 hover:text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-600'}`}
                          onClick={() => toggleProductVisibility(product)}
                        >
                          {product.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => { setEditingProduct(product); setIsEditingProduct(true); }}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteProduct(product.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Edit Category Dialog */}
      <Dialog open={isEditingCategory} onOpenChange={setIsEditingCategory}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-sm">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-lg font-bold tracking-tight">Editar Bloque</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs uppercase tracking-widest font-mono">Modificación de Categoría</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Nuevo Nombre</Label>
              <Input 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Nombre del bloque..."
                className="border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={updateCategory} className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 transition-all shadow-lg shadow-indigo-500/20">
                Guardar Cambios
              </Button>
              <Button variant="outline" onClick={() => setIsEditingCategory(false)} className="rounded-xl font-bold h-11">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditingProduct} onOpenChange={setIsEditingProduct}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-xl mx-auto">
          <DialogHeader className="bg-slate-900 text-white p-6 text-center">
            <DialogTitle className="text-lg md:text-xl font-bold tracking-tight">Editar Artículo del Inventario</DialogTitle>
            <DialogDescription className="text-slate-400 text-[10px] md:text-xs uppercase tracking-widest font-mono">Modificación de Datos Maestros</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 p-4 md:p-8 bg-white max-h-[80vh] overflow-y-auto">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Nombre del Producto</Label>
              <Input 
                value={editingProduct?.name || ""} 
                onChange={e => setEditingProduct(editingProduct ? {...editingProduct, name: e.target.value} : null)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Bloque de Asignación</Label>
              <Select 
                value={editingProduct?.category || ""} 
                onValueChange={v => setEditingProduct(editingProduct ? {...editingProduct, category: v} : null)}
              >
                <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                  <SelectValue placeholder="Seleccionar bloque" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 rounded-xl">
                  {data.categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Stock</Label>
              <Input 
                type="number"
                value={editingProduct?.quantity || "0"} 
                onChange={e => setEditingProduct(editingProduct ? {...editingProduct, quantity: e.target.value} : null)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Unidad</Label>
              <Input 
                value={editingProduct?.unit || ""} 
                onChange={e => setEditingProduct(editingProduct ? {...editingProduct, unit: e.target.value} : null)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label className="text-xs font-bold text-slate-500 uppercase">Vencimiento</Label>
              <Input 
                type="date"
                value={editingProduct?.expiryDate || ""} 
                onChange={e => setEditingProduct(editingProduct ? {...editingProduct, expiryDate: e.target.value} : null)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 uppercase font-mono text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <Button onClick={updateProduct} className="md:col-span-2 w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 md:h-12 transition-all shadow-lg shadow-indigo-500/20 text-xs md:text-sm">
              Actualizar Asignación y Datos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expanded Product Detail View */}
      <Dialog open={!!selectedDetailProduct} onOpenChange={(open) => !open && setSelectedDetailProduct(null)}>
        <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-4xl mx-auto flex flex-col md:flex-row h-[90vh] md:h-auto md:max-h-[85vh]">
          {selectedDetailProduct && (
            <>
              {/* Sidebar Info */}
              <div className="w-full md:w-80 bg-slate-900 text-white flex flex-col shrink-0">
                <div className="p-6 md:p-8 space-y-6">
                  <div>
                    <Badge className="bg-indigo-600 text-white border-none px-2 py-0.5 text-[8px] font-black uppercase tracking-widest mb-2">
                      {selectedDetailProduct.category}
                    </Badge>
                    <DialogTitle className="text-2xl font-black leading-tight tracking-tight mt-1">
                      {selectedDetailProduct.name}
                    </DialogTitle>
                    <p className="text-slate-400 text-xs font-medium mt-2">ID: {selectedDetailProduct.id}</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 shadow-inner">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Stock Actual</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-indigo-400 font-mono leading-none">{selectedDetailProduct.quantity}</span>
                          <span className="text-xs font-bold text-slate-400 uppercase">{selectedDetailProduct.unit || 'uds'}</span>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                      isExpired(selectedDetailProduct.expiryDate) ? 'bg-red-500/10 border-red-500/20' : 
                      isExpiringSoon(selectedDetailProduct.expiryDate) ? 'bg-amber-500/10 border-amber-500/20' : 
                      'bg-emerald-500/10 border-emerald-500/20'
                    }`}>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Vencimiento</span>
                        <span className={`text-base font-black font-mono ${
                          isExpired(selectedDetailProduct.expiryDate) ? 'text-red-400' : 
                          isExpiringSoon(selectedDetailProduct.expiryDate) ? 'text-amber-400' : 
                          'text-emerald-400'
                        }`}>
                          {selectedDetailProduct.expiryDate ? format(new Date(selectedDetailProduct.expiryDate), "dd / MM / yyyy") : "INDETERMINADO"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                         {isExpired(selectedDetailProduct.expiryDate) ? (
                           <Badge className="bg-red-600 text-white border-none rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest animate-pulse">Vencido</Badge>
                         ) : isExpiringSoon(selectedDetailProduct.expiryDate) ? (
                           <Badge className="bg-amber-600 text-white border-none rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">Próximo</Badge>
                         ) : (
                           <Badge className="bg-emerald-600 text-white border-none rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">Vigente</Badge>
                         )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 hidden md:block">
                    <p className="text-slate-500 text-[10px] italic leading-relaxed">
                      Este artículo pertenece al bloque de <strong className="text-slate-300">{selectedDetailProduct.category}</strong>. 
                      {selectedDetailProduct.isHidden && " Actualmente se encuentra oculto para el personal de cocina."}
                    </p>
                  </div>
                </div>
                
                <div className="mt-auto p-6 md:p-8">
                  <Button 
                    className="w-full bg-slate-800 text-white hover:bg-slate-700 transition-all rounded-2xl h-12 font-bold uppercase tracking-widest text-[10px]"
                    onClick={() => setSelectedDetailProduct(null)}
                  >
                    Cerrar Detalle
                  </Button>
                </div>
              </div>

              {/* History Content */}
              <div className="flex-1 bg-white flex flex-col min-h-0">
                <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 uppercase tracking-tight text-sm">Historial de Kardex</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Movimientos registrados del producto</p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-6 md:p-8 space-y-4">
                    {allMovements.filter(m => m.productId === selectedDetailProduct.id).length > 0 ? (
                      allMovements.filter(m => m.productId === selectedDetailProduct.id).map(move => (
                        <div key={move.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all group/move">
                          <div className="flex items-center gap-4">
                             <div className={`p-2.5 rounded-xl ${
                               move.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                             }`}>
                               {move.type === 'in' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                             </div>
                             <div>
                               <p className="text-xs font-black text-slate-800 truncate max-w-[150px] md:max-w-xs">{move.note || (move.type === 'in' ? 'Ingreso de Stock' : 'Salida de Stock')}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Clock className="w-3 h-3 text-slate-400" />
                                 <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest">
                                   {format(new Date(move.timestamp), "d MMM, HH:mm", { locale: es })}
                                 </span>
                               </div>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className={`text-sm md:text-base font-black font-mono ${
                               move.type === 'in' ? 'text-emerald-500' : 'text-red-500'
                             }`}>
                               {move.type === 'in' ? '+' : '-'}{move.quantity}
                             </p>
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{move.unit || selectedDetailProduct.unit || 'uds'}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 text-center space-y-4 opacity-20">
                         <FileText className="w-12 h-12 mx-auto text-slate-400" />
                         <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Sin movimientos previos</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Management Dialog */}
      <Dialog open={isManagingInventories} onOpenChange={setIsManagingInventories}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">Gestionar Inventarios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
             {data.settings?.customLocations?.map((loc: any) => (
                <div key={loc.id} className="flex justify-between items-center p-3 bg-slate-100 rounded-xl">
                  <span className="font-semibold text-slate-800 text-sm">{loc.name}</span>
                  <Button variant="ghost" size="sm" onClick={async () => {
                     // Frontend Safety Check
                     const productsInLoc = data.products.filter(p => (p.location || 'fuerza_publica') === loc.id);
                     if (productsInLoc.length > 0) {
                        toast.error(`No se puede eliminar: El inventario "${loc.name}" contiene ${productsInLoc.length} artículos. Debe moverlos o eliminarlos primero.`);
                        return;
                     }

                     if (window.confirm(`¿Seguro que deseas eliminar el inventario "${loc.name}"?`)) {
                       try {
                         await apiFetch("/api/settings/locations", {
                           method: "POST",
                           body: JSON.stringify({ action: 'delete', location: loc })
                         });
                         toast.success("Inventario eliminado");
                         if (onGlobalRefresh) onGlobalRefresh();
                       } catch (e: any) {
                         toast.error(e.message || "Error al eliminar");
                       }
                     }
                  }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
             ))}
             <div className="flex gap-2">
                <Input value={newInventoryName} onChange={e => setNewInventoryName(e.target.value)} placeholder="Nuevo Inventario" />
                <Button onClick={() => {
                  apiFetch("/api/settings/locations", {
                    method: "POST",
                    body: JSON.stringify({ action: 'add', location: { name: newInventoryName } })
                  }).then(() => {
                    setNewInventoryName("");
                    if (onGlobalRefresh) onGlobalRefresh();
                  });
                }}>Añadir</Button>
             </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustingStock} onOpenChange={setIsAdjustingStock}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-sm">
          <DialogHeader className={`p-6 text-white ${stockAdjustment.type === 'in' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            <DialogTitle className="text-lg font-bold tracking-tight">
              {stockAdjustment.type === 'in' ? 'Ingreso de Stock' : 'Salida de Stock'}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs uppercase tracking-widest font-mono">
              {stockAdjustment.product?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-white">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Cantidad a {stockAdjustment.type === 'in' ? 'sumar' : 'restar'}</Label>
              <Input 
                type="number"
                min="1"
                value={stockAdjustment.quantity} 
                onChange={e => setStockAdjustment({...stockAdjustment, quantity: parseInt(e.target.value) || 0})}
                className="border-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-11 text-slate-900 dark:text-slate-100 font-mono font-bold text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase">Justificación / Motivo</Label>
              <textarea 
                value={stockAdjustment.note} 
                onChange={e => setStockAdjustment({...stockAdjustment, note: e.target.value})}
                placeholder="Indique el motivo del ajuste..."
                className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={confirmStockAdjustment} 
                className={`flex-1 text-white rounded-xl font-bold h-11 transition-all shadow-lg ${
                  stockAdjustment.type === 'in' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                    : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                }`}
              >
                Confirmar Ajuste
              </Button>
              <Button variant="outline" onClick={() => setIsAdjustingStock(false)} className="rounded-xl font-bold h-11">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
