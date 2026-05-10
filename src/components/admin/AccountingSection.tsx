import React, { useState, useMemo } from "react";
import { DBData, Product, Movement, User } from "../../types";
import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  RefreshCcw,
  History,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  ChevronRight,
  ChevronLeft,
  Save,
  Trash2,
  FolderClock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  FileText,
  ShieldAlert,
  Settings2,
  Lock,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, addDays, subDays, subMonths, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { apiFetch } from "../../lib/api";

interface AccountingSectionProps {
  user: User;
  data: DBData;
  searchTerm: string;
  onExportAll: () => void;
  onGlobalRefresh?: () => void;
}

interface ConsumptionProductInfo {
  name: string;
  unit: string;
  total: number;
}

interface ConsumptionCategoryInfo {
  total: number;
  products: Record<string, ConsumptionProductInfo>;
}

export default function AccountingSection({ 
  user, 
  data, 
  searchTerm, 
  onExportAll,
  onGlobalRefresh
}: AccountingSectionProps) {
  const [isAddingStock, setIsAddingStock] = useState(false);
  const [registryMode, setRegistryMode] = useState<"supply" | "new">("supply");
  const [refillType, setRefillType] = useState<"global" | "semanal">("semanal");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [isConsumptionDialogOpen, setIsConsumptionDialogOpen] = useState(false);
  const [selectedConsumptionMonth, setSelectedConsumptionMonth] = useState<string | null>(null);
  
  const [isCriticalStockDialogOpen, setIsCriticalStockDialogOpen] = useState(false);
  const [tempThreshold, setTempThreshold] = useState("");
  const [selectedConsumptionCategory, setSelectedConsumptionCategory] = useState<string | null>(null);
  const [isGlobalIncomesDialogOpen, setIsGlobalIncomesDialogOpen] = useState(false);
  const [selectedGlobalIncomesDate, setSelectedGlobalIncomesDate] = useState<string | null>(null);
  const [refillQty, setRefillQty] = useState("");
  const [refillNote, setRefillNote] = useState("");

  const [isHistoryViewOpen, setIsHistoryViewOpen] = useState(false);
  const [selectedPastHistoryId, setSelectedPastHistoryId] = useState<string | null>(null);
  const [historyItemSearch, setHistoryItemSearch] = useState("");

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"incomes" | "admin" | "history">("incomes");
  const [historyMonth, setHistoryMonth] = useState<Date>(new Date());
  
  const [supplyCategoryFilter, setSupplyCategoryFilter] = useState("all");

  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("0");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");

  const [isDeleteCurrentOpen, setIsDeleteCurrentOpen] = useState(false);
  const [isEditingPastHistoryOpen, setIsEditingPastHistoryOpen] = useState(false);
  const [isDeletePastHistoryConfirmOpen, setIsDeletePastHistoryConfirmOpen] = useState(false);
  const [historyToDeleteId, setHistoryToDeleteId] = useState<string | null>(null);

  const [editHistoryTitle, setEditHistoryTitle] = useState("");
  const [editHistoryNote, setEditHistoryNote] = useState("");
  const [editHistoryDate, setEditHistoryDate] = useState("");
  const [editHistoryTime, setEditHistoryTime] = useState("");

  // Incomes log navigation
  const [incomesSubTab, setIncomesSubTab] = useState<"semanal" | "global">("semanal");
  const [incomesDate, setIncomesDate] = useState<Date>(new Date());

  // States for new product in Global Registry
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");
  const [newProductExpiry, setNewProductExpiry] = useState("");

  const filteredProducts = useMemo(() => {
    return (data.products || []).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data.products, searchTerm]);

  const pastMoves = useMemo(() => {
    return data.pastHistories?.flatMap(h => h.movements) || [];
  }, [data.pastHistories]);

  const allAccountsMovements = useMemo(() => {
    return [...(data.movements || []), ...pastMoves];
  }, [data.movements, pastMoves]);

  const [accountSearchTerm, setAccountSearchTerm] = useState("");

  const deleteBySelectedDate = async () => {
    const today = new Date();
    const dateStr = format(today, "yyyy-MM-dd");
    const confirmMsg = `¿Desea eliminar TODOS los movimientos del día de hoy (${dateStr})? Esta acción es irreversible.`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await apiFetch(`/api/movements/date/${dateStr}`, { method: "DELETE" });
      toast.success(`Movimientos del día ${dateStr} eliminados`);
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  const handleExportAccounting = () => {
    const filteredMovements = allAccountsMovements.filter(m => 
      m.productName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      (m.note || "").toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(accountSearchTerm.toLowerCase())
    );

    const formattedData = filteredMovements.map(m => {
      const isIncome = m.type === "in";
      return {
        "ID Movimiento": m.id,
        "Tipo": isIncome ? "Entrada" : "Salida",
        "Artículo": m.productName,
        "Cantidad": (isIncome ? "+" : "-") + m.quantity,
        "Unidad": m.unit || "N/A",
        "Categoría": m.category,
        "Fecha": new Date(m.timestamp).toLocaleString(),
        "Nota": m.note || "Sin nota"
      };
    });
    exportToExcel(formattedData, "Contabilidad_Movimientos");
  };

  const handleExportAccountingPDF = () => {
    const filteredMovements = allAccountsMovements.filter(m => 
      m.productName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      (m.note || "").toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(accountSearchTerm.toLowerCase())
    );

    const formattedData = filteredMovements.map(m => {
      const isIncome = m.type === "in";
      return {
        "Fecha": format(new Date(m.timestamp), "dd/MM/yyyy HH:mm"),
        "Tipo": isIncome ? "Entrada" : "Salida",
        "Artículo": m.productName,
        "Cantidad": (isIncome ? "+" : "-") + m.quantity,
        "Unidad": m.unit || "N/A",
        "Categoría": m.category,
        "Nota": m.note || "-"
      };
    });
    exportToPDF(formattedData, "Contabilidad_Movimientos", "REPORTE CONTABLE DE MOVIMIENTOS");
  };
  
  const handleClearKardex = async () => {
    const confirmation = window.prompt("ADVERTENCIA: Vas a eliminar TODO el historial de Kardex. Esta acción no se puede deshacer.\n\nPara continuar, escribe la palabra ELIMINAR en mayúsculas:");
    if (confirmation !== "ELIMINAR") {
      if (confirmation) toast.error("Confirmación incorrecta");
      return;
    }
    try {
      await apiFetch("/api/system/clear-kardex", { method: "POST" });
      toast.success("Historial de Kardex eliminado");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar historial");
    }
  };

  const filteredMovementsUI = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    let list = allAccountsMovements;
    
    if (!accountSearchTerm) {
      list = allAccountsMovements.filter(m => m.timestamp.startsWith(todayStr));
    }

    return [...list]
      .filter(m => 
        m.productName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
        (m.note || "").toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
        m.category.toLowerCase().includes(accountSearchTerm.toLowerCase())
      )
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allAccountsMovements, accountSearchTerm]);

  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const thisMonth = todayStr.substring(0, 7);

    const movementsToday = allAccountsMovements.filter(m => m.timestamp.startsWith(todayStr));
    const movementsMonth = allAccountsMovements.filter(m => m.timestamp.startsWith(thisMonth));

    return {
      todayIn: movementsToday.filter(m => m.type === "in").length,
      todayOut: movementsToday.filter(m => m.type === "out").length,
      monthIn: movementsMonth.filter(m => m.type === "in").length,
      monthOut: movementsMonth.filter(m => m.type === "out").length,
    };
  }, [allAccountsMovements]);

  const sortedPastHistories = useMemo(() => {
    return [...(data.pastHistories || [])].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [data.pastHistories]);

  const filteredPastHistories = useMemo(() => {
    const monthKey = format(historyMonth, 'yyyy-MM');
    return sortedPastHistories.filter(h => format(new Date(h.date), 'yyyy-MM') === monthKey);
  }, [sortedPastHistories, historyMonth]);

  const consumptionDataByMonth = useMemo(() => {
    const monthlyMap: Record<string, Record<string, ConsumptionCategoryInfo>> = {};

    allAccountsMovements.forEach(m => {
      // Always include if it is out
      if (m.type !== 'out') return;
      
      const date = new Date(m.timestamp);
      
      // Keep running total instead of just for archived histories.
      // This will use the current date if not archived yet.
      const monthKey = format(date, "MMMM yyyy", { locale: es });
      
      const prod = data.products.find(p => p.id === m.productId);
      const categoryName = m.category || prod?.category || "Sin Categoría";

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {};
      }

      if (!monthlyMap[monthKey][categoryName]) {
        monthlyMap[monthKey][categoryName] = { total: 0, products: {} };
      }

      const prodId = m.productId;
      if (!monthlyMap[monthKey][categoryName].products[prodId]) {
        monthlyMap[monthKey][categoryName].products[prodId] = { 
          name: m.productName, 
          unit: m.unit, 
          total: 0 
        };
      }

      monthlyMap[monthKey][categoryName].total += m.quantity;
      monthlyMap[monthKey][categoryName].products[prodId].total += m.quantity;
    });

    return monthlyMap;
  }, [allAccountsMovements, data.products]);

  const globalIncomesData = useMemo(() => {
    return allAccountsMovements
      .filter(m => m.type === 'in')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allAccountsMovements]);

  const globalIncomesByDate = useMemo(() => {
    const grouped: Record<string, Movement[]> = {};
    globalIncomesData.forEach(m => {
      const dateKey = format(new Date(m.timestamp), 'yyyy-MM-dd');
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(m);
    });
    return grouped;
  }, [globalIncomesData]);

  const totalHistoricalConsumption = useMemo(() => {
    return allAccountsMovements
      .filter(m => m.type === 'out')
      .reduce((acc, m) => acc + m.quantity, 0);
  }, [allAccountsMovements]);

  const currentMonthConsumption = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().substring(0, 7);
    return allAccountsMovements
      .filter(m => m.type === 'out' && m.timestamp.startsWith(thisMonth))
      .reduce((acc, m) => acc + m.quantity, 0);
  }, [allAccountsMovements]);

  const totalGlobalIncome = useMemo(() => {
    return globalIncomesData.reduce((acc, m) => acc + m.quantity, 0);
  }, [globalIncomesData]);

  const adminMovements = useMemo(() => {
    const auditLog = data.adminAuditLog || [];
    // We also want to include movements marked as AJUSTE ADMIN from the general movements 
    // to avoid losing previously recorded adjustments that haven't been archived yet, 
    // or are in past histories.
    const generalAdjustments = allAccountsMovements.filter(m => (m.note || "").includes("AJUSTE ADMIN"));
    
    // Combine them, preferring audit log entries but keeping unique records
    const combined = [...auditLog];
    generalAdjustments.forEach(m => {
      if (!combined.some(am => am.id === m.id)) {
        combined.push(m);
      }
    });

    return combined.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data.adminAuditLog, allAccountsMovements]);



  const submitManualAdjustment = async () => {
    if (!adjustingProduct || !adjustAmount || !adjustNote) {
      toast.error("Debe ingresar cantidad y motivo del ajuste");
      return;
    }
    
    // Constraint: Integer only via regex
    if (!/^\d+$/.test(adjustAmount)) {
      toast.error("La cantidad debe ser un número entero positivo sin decimales");
      return;
    }
    const qty = parseInt(adjustAmount, 10);
    if (qty <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }

    // Constraint: Prevent negative stock
    if (adjustType === 'out' && (parseFloat(adjustingProduct.quantity) - qty < 0)) {
       toast.error("No hay suficiente stock. El inventario no puede bajar de 0.");
       return;
    }

    try {
      await apiFetch("/api/inventory/add", {
        method: "POST",
        body: JSON.stringify({
          productId: adjustingProduct.id,
          quantity: qty,
          note: `AJUSTE ADMIN: ${adjustNote}`,
          type: adjustType
        })
      });
      toast.success("Ajuste de inventario registrado");
      setIsAdjustingStock(false);
      setAdjustAmount("0");
      setAdjustNote("");
      setAdjustingProduct(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al registrar ajuste");
    }
  };

  const submitRefill = async () => {
    if (!selectedProduct || !refillQty) return;
    
    // Constraint: Integer only via regex
    if (!/^\d+$/.test(refillQty)) {
      toast.error("La cantidad debe ser un número entero positivo sin decimales");
      return;
    }
    const qty = parseInt(refillQty, 10);
    if (qty <= 0) {
      toast.error("La cantidad debe ser mayor a cero");
      return;
    }

    try {
      await apiFetch("/api/inventory/add", {
        method: "POST",
        body: JSON.stringify({
          productId: selectedProduct,
          quantity: qty,
          note: `${refillType === 'global' ? 'INGRESO GLOBAL' : 'INGRESO SEMANAL'}: ${refillNote}`,
          type: "in"
        })
      });
      toast.success("Ingreso de stock registrado");
      setIsAddingStock(false);
      setSelectedProduct("");
      setRefillQty("");
      setRefillNote("");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al registrar ingreso");
    }
  };

  const submitNewProduct = async () => {
    if (!newProductName || !newProductCategory || !refillQty) {
      toast.error("Nombre, categoría y stock inicial son requeridos");
      return;
    }

    // Constraint: Integer only via regex
    if (!/^\d+$/.test(refillQty)) {
      toast.error("La cantidad inicial debe ser un número entero positivo sin decimales");
      return;
    }
    const qty = parseInt(refillQty, 10);
    if (qty <= 0) {
      toast.error("La cantidad inicial debe ser mayor a cero");
      return;
    }

    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: newProductName,
          category: newProductCategory,
          quantity: qty,
          unit: newProductUnit,
          expiryDate: newProductExpiry,
          type: "",
          refillType: refillType
        })
      });
      toast.success("Nuevo producto integrado al sistema");
      setIsAddingStock(false);
      setNewProductName("");
      setNewProductCategory("");
      setNewProductUnit("");
      setNewProductExpiry("");
      setRefillQty("");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al crear producto");
    }
  };

  const archiveHistory = async () => {
    if (data.movements.length === 0) {
      toast.error("No hay movimientos para archivar");
      return;
    }
    try {
      await apiFetch("/api/history/archive", { 
        method: "POST",
        body: JSON.stringify({})
      });
      toast.success("Historial archivado exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error al archivar historial");
    }
  };

  const deleteCurrentMovements = async () => {
    try {
      await apiFetch("/api/movements", { method: "DELETE" });
      toast.success("Historial eliminado completamente");
      setIsDeleteCurrentOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar historial");
    }
  };

  const openEditHistory = (id: string, currentTitle?: string, currentNote?: string, currentDate?: string) => {
    setSelectedPastHistoryId(id);
    setEditHistoryTitle(currentTitle || "");
    setEditHistoryNote(currentNote || "");
    if (currentDate) {
      const d = new Date(currentDate);
      setEditHistoryDate(format(d, "yyyy-MM-dd"));
      setEditHistoryTime(format(d, "HH:mm"));
    }
    setIsEditingPastHistoryOpen(true);
  };

  const updatePastHistory = async () => {
    if (!selectedPastHistoryId) return;
    try {
      const dateString = `${editHistoryDate}T${editHistoryTime}`;
      await apiFetch(`/api/history/${selectedPastHistoryId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          title: editHistoryTitle, 
          note: editHistoryNote,
          date: new Date(dateString).toISOString()
        })
      });
      toast.success("Historial actualizado");
      setIsEditingPastHistoryOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar");
    }
  };

  const confirmDeletePastHistory = (id: string) => {
    setHistoryToDeleteId(id);
    setIsDeletePastHistoryConfirmOpen(true);
  };

  const deletePastHistory = async (id: string) => {
    try {
      await apiFetch(`/api/history/${id}`, { method: "DELETE" });
      toast.success("Historial movido a la papelera");
      setIsDeletePastHistoryConfirmOpen(false);
      setHistoryToDeleteId(null);
    } catch (e: any) {
      toast.error(e.message || "Error al mover a papelera");
    }
  };

  const handleDeleteMovement = async (id: string, movementData?: any) => {
    if (!window.confirm("¿Seguro que deseas eliminar este registro? Se moverá a la papelera de recuperación.")) return;
    try {
      await apiFetch(`/api/movements/${id}`, { method: "DELETE" });
      toast.success("Registro movido a la papelera");
    } catch (e: any) {
      toast.error(e.message || "Error al procesar eliminación");
    }
  };

  const handleSystemReset = async () => {
    if (!resetPassword) {
      toast.error("Debe ingresar la clave de administrador");
      return;
    }
    const confirmation = window.prompt("⚠️ PELIGRO: Vas a REINICIAR el sistema de esta sede. Se borrarán pedidos, historial y registros de soporte.\n\nEscribe REINICIAR para confirmar:");
    if (confirmation !== "REINICIAR") {
       if (confirmation) toast.error("Confirmación fallida");
       return;
    }
    try {
      const result = await apiFetch("/api/system/reset", {
        method: "POST",
        body: JSON.stringify({ password: resetPassword })
      });
      toast.success(result.message);
      setIsResetDialogOpen(false);
      setResetPassword("");
    } catch (e: any) {
      toast.error(e.message || "Error al reiniciar sistema");
    }
  };

  const criticalStockThreshold = data.settings?.criticalStockThreshold || 10;
  
  const criticalStockProducts = useMemo(() => 
    data.products.filter(p => parseFloat(p.quantity) <= criticalStockThreshold)
  , [data.products, criticalStockThreshold]);

  const criticalStockCount = criticalStockProducts.length;

  const totalIncomeToday = useMemo(() => 
    allAccountsMovements.filter(m => m.type === "in" && m.timestamp.startsWith(format(new Date(), "yyyy-MM-dd")))
    .reduce((acc, curr) => acc + curr.quantity, 0)
  , [allAccountsMovements]);

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Navigation Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <Button 
              variant={activeTab === "incomes" ? "default" : "outline"}
              onClick={() => setActiveTab("incomes")}
              className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
            >
              Ingresos
            </Button>
            <Button 
              variant={activeTab === "history" ? "default" : "outline"}
              onClick={() => setActiveTab("history")}
              className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
            >
              Kardex
            </Button>
            {user.role !== "viewer" && (
              <Button 
                variant={activeTab === "admin" ? "default" : "outline"}
                onClick={() => setActiveTab("admin")}
                className="rounded-full px-4 py-1 h-8 text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
              >
                Ajustes
              </Button>
            )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex flex-col">
          <h2 className="text-sm md:text-lg font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
            Panel de Contabilidad
          </h2>
          <p className="text-[10px] md:text-sm text-slate-500">Gestión de recursos y métricas de movimiento</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar en movimientos..." 
              value={accountSearchTerm}
              onChange={(e) => setAccountSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-slate-200 h-9 md:h-10 text-[10px] md:text-sm bg-white focus:ring-indigo-500"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50 w-full md:w-auto shrink-0"
            onClick={handleExportAccounting}
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-red-200 text-red-600 hover:bg-red-50 w-full md:w-auto shrink-0"
            onClick={handleExportAccountingPDF}
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        <div 
          className="cursor-pointer transition-transform hover:scale-[1.02]" 
          onClick={() => {
            const currentMonthKey = format(new Date(), "MMMM yyyy", { locale: es });
            if (consumptionDataByMonth[currentMonthKey]) {
              setSelectedConsumptionMonth(currentMonthKey);
            }
            setIsConsumptionDialogOpen(true);
          }}
        >
          <SummaryCard 
            title="Gasto Real Acumulado" 
            value={`${totalHistoricalConsumption} Unid.`}
            icon={<TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />}
            color="text-slate-800"
          />
        </div>

        <Dialog open={isConsumptionDialogOpen} onOpenChange={(open) => {
          setIsConsumptionDialogOpen(open);
          if (!open) {
            setSelectedConsumptionMonth(null);
            setSelectedConsumptionCategory(null);
          }
        }}>
          <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-2xl mx-auto">
            <DialogHeader className="bg-slate-900 text-white p-4 md:p-6">
              <div className="flex items-center gap-3">
                {(selectedConsumptionCategory || selectedConsumptionMonth) && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 md:h-8 md:w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => {
                      if (selectedConsumptionCategory) setSelectedConsumptionCategory(null);
                      else setSelectedConsumptionMonth(null);
                    }}
                  >
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                )}
                <div>
                  <DialogTitle className="text-sm md:text-lg font-bold tracking-tight flex items-center justify-between">
                    <span>
                      {selectedConsumptionCategory 
                        ? `Detalle: ${selectedConsumptionCategory}` 
                        : selectedConsumptionMonth 
                          ? `Consumo: ${selectedConsumptionMonth}` 
                          : "Consumo Histórico Mensual"}
                    </span>
                    {selectedConsumptionMonth && !selectedConsumptionCategory && (
                      <Badge className="bg-white text-slate-900 border-none px-3 py-1 text-xs font-black">
                        {Object.values(consumptionDataByMonth[selectedConsumptionMonth]).reduce((acc, cat) => acc + cat.total, 0)} Total
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-[8px] md:text-xs uppercase tracking-widest font-mono">
                    {selectedConsumptionCategory 
                      ? "Gasto por Artículo" 
                      : selectedConsumptionMonth 
                        ? "Bloques Archivados este Mes" 
                        : "Seleccione un mes para ver el detalle"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="p-4 md:p-6 bg-white max-h-[60vh] overflow-y-auto">
              {!selectedConsumptionMonth ? (
                /* Meses como carpetas */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {Object.keys(consumptionDataByMonth).sort((a, b) => {
                    const dateA = new Date(a.split(" ").reverse().join(" "));
                    const dateB = new Date(b.split(" ").reverse().join(" "));
                    return dateB.getTime() - dateA.getTime();
                  }).map(month => (
                    <Card 
                      key={month} 
                      className="border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-white to-slate-50"
                      onClick={() => setSelectedConsumptionMonth(month)}
                    >
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                        <FolderClock className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition-transform" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{month}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            Detalles del Mes
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {Object.keys(consumptionDataByMonth).length === 0 && (
                    <div className="col-span-full py-12 md:py-20 text-center text-slate-400">
                      <p className="text-[10px] md:text-sm font-bold uppercase tracking-widest">Sin datos de consumo archivados</p>
                    </div>
                  )}
                </div>
              ) : !selectedConsumptionCategory ? (
                /* Categorías del mes */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {Object.entries(consumptionDataByMonth[selectedConsumptionMonth]).map(([category, info]) => (
                    <Card 
                      key={category} 
                      className="border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => setSelectedConsumptionCategory(category)}
                    >
                      <CardContent className="p-3 md:p-4 flex justify-between items-center">
                        <div className="space-y-0.5 md:space-y-1">
                          <p className="text-[8px] md:text-xs font-bold text-slate-500 uppercase">{category}</p>
                          <p className="text-base md:text-xl font-black text-slate-800 tracking-tighter">
                            {info.total} <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Salidas</span>
                          </p>
                        </div>
                        <ChevronRight className="w-3 md:w-4 h-3 md:h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                /* Productos de la categoría */
                <div className="space-y-2 md:space-y-3">
                  {Object.entries(consumptionDataByMonth[selectedConsumptionMonth][selectedConsumptionCategory].products).map(([id, info]) => (
                    <div key={id} className="flex justify-between items-center p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all">
                      <div>
                        <p className="font-bold text-slate-800 text-xs md:text-base">{info.name}</p>
                        <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Gastado</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm md:text-lg font-black text-indigo-600 tracking-tighter">-{info.total}</p>
                        <p className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase">{info.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="p-3 md:p-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsConsumptionDialogOpen(false)} className="rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest border-slate-200">
                Cerrar Análisis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div onClick={() => setIsGlobalIncomesDialogOpen(true)} className="cursor-pointer transition-all hover:scale-[1.02]">
          <SummaryCard 
            title="Ingresos Globales" 
            value={`+${totalGlobalIncome}`}
            icon={<ArrowUpRight className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />}
            color="text-indigo-600"
          />
        </div>

        <Dialog open={isGlobalIncomesDialogOpen} onOpenChange={(open) => {
          setIsGlobalIncomesDialogOpen(open);
          if (!open) setSelectedGlobalIncomesDate(null);
        }}>
          <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-2xl mx-auto">
            <DialogHeader className="bg-slate-900 text-white p-4 md:p-6 shadow-xl">
              <div className="flex items-center gap-3">
                {selectedGlobalIncomesDate && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 md:h-8 md:w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => setSelectedGlobalIncomesDate(null)}
                  >
                    <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                )}
                <div>
                  <DialogTitle className="text-sm md:text-lg font-bold tracking-tight">
                    {selectedGlobalIncomesDate 
                      ? `Ingresos del ${format(new Date(selectedGlobalIncomesDate + "T12:00:00"), 'dd/MM/yyyy')}`
                      : "Registro de Ingresos Globales"}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-[8px] md:text-xs uppercase tracking-widest font-mono">
                    {selectedGlobalIncomesDate ? "Detalle de Entradas Diarias" : "Seleccione una fecha para ver el detalle"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="p-0 bg-white">
              {!selectedGlobalIncomesDate ? (
                <ScrollArea className="h-[50vh] min-h-[300px] p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.keys(globalIncomesByDate).sort((a, b) => b.localeCompare(a)).map(date => {
                      const moves = globalIncomesByDate[date];
                      const dayTotal = moves.reduce((acc, m) => acc + m.quantity, 0);
                      return (
                        <Card 
                          key={date} 
                          className="border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer bg-slate-50/50 group"
                          onClick={() => setSelectedGlobalIncomesDate(date)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                            <Calendar className="w-6 h-6 text-emerald-500 mb-1 group-hover:scale-110 transition-transform" />
                            <p className="text-[10px] font-black text-slate-800">{format(new Date(date + "T12:00:00"), 'dd / MM / yyyy')}</p>
                            <p className="text-[12px] font-black text-emerald-600">+{dayTotal} Unid.</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{moves.length} Entradas</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {Object.keys(globalIncomesByDate).length === 0 && (
                      <div className="col-span-full py-20 text-center text-slate-300 italic font-medium">
                        Sin registros de ingresos globales
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-[50vh] min-h-[300px]">
                  <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-20 backdrop-blur-md">
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-[9px] uppercase font-black text-slate-400 h-10 px-6">Hora</TableHead>
                        <TableHead className="text-[9px] uppercase font-black text-slate-400 h-10 px-6">Insumo</TableHead>
                        <TableHead className="text-[9px] uppercase font-black text-slate-400 h-10 px-6 text-right">Ingreso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalIncomesByDate[selectedGlobalIncomesDate].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map((m) => (
                        <TableRow key={m.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-6 py-4">
                            <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">{format(new Date(m.timestamp), 'HH:mm')} hs</span>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-800 break-words max-w-[150px]">{m.productName}</p>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">{m.category}</p>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <span className="font-mono text-base font-black text-emerald-600">+{m.quantity}</span>
                            <span className="text-[9px] text-slate-400 ml-1 font-bold uppercase">{m.unit}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center px-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {selectedGlobalIncomesDate ? "Total del Día" : "Total Histórico Global"}
                </span>
                <span className="text-lg font-black text-slate-900 tracking-tighter">
                  +{selectedGlobalIncomesDate 
                    ? globalIncomesByDate[selectedGlobalIncomesDate].reduce((acc, m) => acc + m.quantity, 0)
                    : totalGlobalIncome} Unid.
                </span>
              </div>
            </div>
            <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
               <Button variant="outline" onClick={() => setIsGlobalIncomesDialogOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200">
                 Cerrar Listado
               </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <SummaryCard 
          title="Eficiencia" 
          value="98.4%"
          icon={<CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-900" />}
          color="text-indigo-900"
          special
        />
      </div>

      <div className="grid grid-cols-12 gap-4 md:gap-8">
        {/* Main Stock Table */}
        <div className="col-span-12 space-y-4 md:space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm md:text-base">📋 Auditoría de Movimientos</h3>
                {searchTerm && (
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-none rounded-full px-2 py-0 h-5 text-[9px]">
                    Filtro Activo
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Adjustment Dialog */}
      <Dialog open={isAdjustingStock} onOpenChange={setIsAdjustingStock}>
        <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-md bg-white">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              {adjustType === 'in' ? <Plus className="w-5 h-5 text-emerald-400" /> : <Minus className="w-5 h-5 text-red-500" />}
              {adjustType === 'in' ? 'Aumentar Insumo' : 'Reducir Insumo'}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-1">
              {adjustingProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad a ajustar ({adjustingProduct?.unit})</Label>
              <div className="flex items-center gap-4">
                 <Button 
                   variant="outline" 
                   size="icon" 
                   className="h-10 w-10 border-slate-200"
                   onClick={() => setAdjustAmount(Math.max(0.1, parseFloat(adjustAmount) - 1).toString())}
                 >
                   <Minus className="w-4 h-4" />
                 </Button>
                 <Input 
                   type="number" 
                   value={adjustAmount}
                   onChange={e => setAdjustAmount(e.target.value)}
                   className="text-center font-mono text-xl font-black h-12 rounded-xl focus:ring-indigo-500 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                 />
                 <Button 
                   variant="outline" 
                   size="icon" 
                   className="h-10 w-10 border-slate-200"
                   onClick={() => setAdjustAmount((parseFloat(adjustAmount) + 1).toString())}
                 >
                   <Plus className="w-4 h-4" />
                 </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo del Ajuste</Label>
                <div className="p-1 rounded-full bg-slate-100">
                  <ShieldAlert className="w-3 h-3 text-slate-400" />
                </div>
              </div>
              <textarea 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-[11px] md:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] transition-all font-medium italic text-slate-900 dark:text-slate-100"
                placeholder="Indique la razón del cambio (ej: merma, error de carga, reposición especial...)"
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
             <Button 
               variant="outline" 
               className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-11"
               onClick={() => setIsAdjustingStock(false)}
             >
               Cancelar
             </Button>
             <Button 
               className={`rounded-xl font-black uppercase tracking-widest text-[10px] h-11 ${
                 adjustType === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
               }`}
               onClick={submitManualAdjustment}
             >
               Confirmar Ajuste
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                  <DialogTrigger className="h-9 w-9 md:h-10 md:w-10 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl inline-flex items-center justify-center transition-colors">
                    <Settings2 className="w-4 h-4 md:w-5 md:h-5" />
                  </DialogTrigger>
                  <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto">
                    <DialogHeader className="bg-red-600 text-white p-6">
                      <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5" /> Reinicio Maestro
                      </DialogTitle>
                      <DialogDescription className="text-red-100 text-[10px] uppercase font-bold tracking-widest opacity-80">
                        Esta acción es irreversible
                      </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-4 bg-white">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Se eliminarán todos los <strong>productos</strong>, <strong>movimientos</strong> e <strong>historiales</strong>.
                        Los <span className="text-indigo-600 font-bold underline">bloques (categorías)</span> se mantendrán intactos.
                      </p>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clave de Administrador</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <Input 
                            type="password" 
                            value={resetPassword} 
                            onChange={e => setResetPassword(e.target.value)}
                            className="pl-10 border-slate-200 dark:border-slate-700 rounded-xl h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-red-500 text-sm text-slate-900 dark:text-slate-100"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        onClick={handleSystemReset}
                        className="w-full h-12 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
                      >
                        Ejecutar Reinicio Total
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Button 
                    onClick={() => { setRefillType('semanal'); setIsAddingStock(true); }}
                    className="flex-1 sm:flex-none bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-[10px] md:text-xs h-9 md:h-10 px-3 md:px-4 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" /> 
                    <span>Semanal</span>
                  </Button>
                  <Button 
                    onClick={() => { setRefillType('global'); setIsAddingStock(true); }}
                    className="flex-1 sm:flex-none bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-[10px] md:text-xs h-9 md:h-10 px-3 md:px-4 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" /> 
                    <span>Global</span>
                  </Button>
                </div>
                
                <Dialog open={isAddingStock} onOpenChange={setIsAddingStock}>
                  <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] sm:max-w-lg mx-auto">
                    <DialogHeader className="bg-slate-900 text-white p-4 md:p-6">
                      <DialogTitle className="text-base md:text-lg font-bold tracking-tight">
                        {refillType === 'global' ? 'Registro Maestro Global' : 'Registro Maestro Semanal'}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 text-[10px] uppercase tracking-widest font-mono">Incorporación de Mercancía</DialogDescription>
                    </DialogHeader>
                  <div className="p-1 bg-slate-100 flex gap-1 mx-4 md:mx-6 mt-4 rounded-xl border border-slate-200">
                    <Button 
                      variant={registryMode === 'supply' ? 'default' : 'ghost'}
                      className={`flex-1 rounded-lg h-9 text-[10px] md:text-xs font-bold transition-all ${registryMode === 'supply' ? 'bg-white text-indigo-600 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      onClick={() => setRegistryMode('supply')}
                    >
                      <RefreshCcw className="w-3 h-3 md:w-3.5 md:h-3.5 mr-2" /> Abastecer
                    </Button>
                    <Button 
                      variant={registryMode === 'new' ? 'default' : 'ghost'}
                      className={`flex-1 rounded-lg h-9 text-[10px] md:text-xs font-bold transition-all ${registryMode === 'new' ? 'bg-white text-indigo-600 shadow-sm hover:bg-white' : 'text-slate-500 hover:bg-slate-200'}`}
                      onClick={() => setRegistryMode('new')}
                    >
                      <PackagePlus className="w-3 h-3 md:w-3.5 md:h-3.5 mr-2" /> Nuevo
                    </Button>
                  </div>
                  <div className="p-4 md:p-6 space-y-4 bg-white max-h-[70vh] overflow-y-auto">
                    {registryMode === 'supply' ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">1. Filtro por Bloque</Label>
                            <Select value={supplyCategoryFilter} onValueChange={(val) => { setSupplyCategoryFilter(val); setSelectedProduct(""); }}>
                              <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                                <SelectValue placeholder="Todos los bloques" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200">
                                <SelectItem value="all">Todos los bloques</SelectItem>
                                {data.categories.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">2. Producto</Label>
                            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                              <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                                <SelectValue placeholder="Buscar artículo..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-slate-200">
                                {data.products
                                  .filter(p => supplyCategoryFilter === 'all' || p.category === supplyCategoryFilter)
                                  .map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Cantidad a Ingresar</Label>
                            <Input 
                              type="number" 
                              value={refillQty} 
                              onChange={e => setRefillQty(e.target.value)}
                              className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus-visible:ring-indigo-500 text-sm text-black"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Notas / Referencia</Label>
                            <Input 
                              value={refillNote} 
                              onChange={e => setRefillNote(e.target.value)}
                              className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus-visible:ring-indigo-500 text-sm text-black"
                              placeholder="Ej: Pedido..."
                            />
                          </div>
                        </div>
                        <Button onClick={submitRefill} className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 md:h-12 transition-all shadow-lg shadow-indigo-500/20 mt-2 text-xs uppercase tracking-wider">
                          Confirmar
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Nombre del Producto</Label>
                          <Input 
                            value={newProductName} 
                            onChange={e => setNewProductName(e.target.value)}
                            className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus-visible:ring-indigo-500 text-sm text-black"
                            placeholder="Nombre..."
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Bloque / Categoría</Label>
                            <Select value={newProductCategory} onValueChange={setNewProductCategory}>
                              <SelectTrigger className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus:ring-indigo-500 text-sm">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {data.categories.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Unidad</Label>
                            <Input 
                              value={newProductUnit} 
                              onChange={e => setNewProductUnit(e.target.value)}
                              className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus-visible:ring-indigo-500 text-sm text-black"
                              placeholder="Ej: Kilos, Cajas..."
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Stock Inicial</Label>
                            <Input 
                              type="number" 
                              value={refillQty} 
                              onChange={e => setRefillQty(e.target.value)}
                              className="border-slate-200 rounded-xl h-10 md:h-11 bg-slate-50 focus-visible:ring-indigo-500 text-sm text-black"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">Vencimiento</Label>
                            <Input 
                              type="date" 
                              value={newProductExpiry} 
                              onChange={e => setNewProductExpiry(e.target.value)}
                              className="border-slate-200 dark:border-slate-700 rounded-xl h-10 md:h-11 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 uppercase font-mono text-sm text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                        <Button onClick={submitNewProduct} className="w-full bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-11 md:h-12 transition-all shadow-lg shadow-indigo-500/20 mt-2 text-xs uppercase tracking-wider">
                          Crear e Integrar
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            
            <div className="min-h-[300px] md:min-h-[400px]">
              {activeTab === 'incomes' && (
                <div className="flex items-center gap-2 flex-wrap px-4 md:px-6 py-3 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm mr-2 h-8">
                     <Button 
                       variant="ghost" 
                       size="sm"
                       className={`text-[9px] uppercase tracking-widest h-6 px-2 rounded-md ${incomesSubTab === 'semanal' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'}`}
                       onClick={() => setIncomesSubTab('semanal')}
                     >
                       Seman.
                     </Button>
                     <Button 
                       variant="ghost" 
                       size="sm"
                       className={`text-[9px] uppercase tracking-widest h-6 px-2 rounded-md ${incomesSubTab === 'global' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'}`}
                       onClick={() => setIncomesSubTab('global')}
                     >
                       Global
                     </Button>
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm h-8">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setIncomesDate(subDays(incomesDate, 1))}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <div className="px-1 min-w-[90px] justify-center text-center">
                       <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">
                         {format(incomesDate, "dd MMM yyyy", { locale: es })}
                       </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setIncomesDate(addDays(incomesDate, 1))}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'incomes' ? (
                <>
                  {/* Mobile Incomes List */}
                  <div className="grid grid-cols-1 gap-2 p-4 md:hidden">
                    {allAccountsMovements
                       .filter(m => m.type === 'in')
                       .filter(m => {
                         const mDate = new Date(m.timestamp).toISOString().split('T')[0];
                         const targetDate = incomesDate.toISOString().split('T')[0];
                         if (mDate !== targetDate) return false;
                         const isWeekly = m.note?.includes('SEMANAL');
                         if (incomesSubTab === 'semanal' && !isWeekly) return false;
                         if (incomesSubTab === 'global' && isWeekly) return false;
                         return true;
                       })
                       .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                       .map(movement => {
                          const isWeekly = movement.note?.includes('SEMANAL');
                          return (
                            <div key={movement.id} className="p-3 bg-white border border-slate-100 rounded-xl flex justify-between items-center shadow-sm">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 text-xs">{movement.productName}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">{format(new Date(movement.timestamp), 'HH:mm')}</span>
                                  <Badge className={`border-none rounded-full px-1.5 py-0 h-3.5 text-[7px] font-black tracking-widest uppercase ${isWeekly ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {isWeekly ? 'Sem' : 'Glob'}
                                  </Badge>
                                </div>
                              </div>
                              <span className="font-mono text-sm font-black text-green-600">+{movement.quantity}</span>
                            </div>
                          );
                       })
                    }
                  </div>

                  {/* Desktop Incomes Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-white border-b border-slate-100">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4">Fecha</TableHead>
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4">Producto</TableHead>
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4 text-right">Cant.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allAccountsMovements
                           .filter(m => m.type === 'in')
                           .filter(m => {
                             const mDate = new Date(m.timestamp).toISOString().split('T')[0];
                             const targetDate = incomesDate.toISOString().split('T')[0];
                             if (mDate !== targetDate) return false;
                             const isWeekly = m.note?.includes('SEMANAL');
                             if (incomesSubTab === 'semanal' && !isWeekly) return false;
                             if (incomesSubTab === 'global' && isWeekly) return false;
                             return true;
                           })
                           .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                           .map(movement => {
                              const isWeekly = movement.note?.includes('SEMANAL');
                              return (
                                <TableRow key={movement.id} className="hover:bg-slate-50 transition-colors border-slate-50">
                                  <TableCell className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800 text-[10px] md:text-xs">{format(new Date(movement.timestamp), 'dd MMM', { locale: es })}</span>
                                      <span className="text-[8px] md:text-[10px] text-slate-400 font-mono">{format(new Date(movement.timestamp), 'HH:mm')}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 md:px-6 py-3 md:py-4">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-800 text-xs">{movement.productName}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <Badge className={`border-none rounded-full px-1.5 py-0 h-3.5 text-[7px] md:text-[8px] font-black tracking-widest uppercase ${isWeekly ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                          {isWeekly ? 'Sem' : 'Glob'}
                                        </Badge>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 md:px-6 py-3 md:py-4 text-right">
                                    <div className="flex justify-end items-baseline gap-1">
                                      <span className="font-mono text-sm md:text-base font-black text-green-600 leading-none">+{movement.quantity}</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                           })
                        }
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : activeTab === 'history' ? (
                <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                          Registros de Hoy
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold uppercase text-[10px] tracking-widest border-indigo-200 text-indigo-600 hover:bg-white" onClick={archiveHistory}>
                         <Save className="w-3.5 h-3.5 mr-2" /> Archivar Sesión
                       </Button>
                       {user.role === 'admin' && (
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           onClick={handleClearKardex}
                           className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl font-bold uppercase tracking-widest text-[10px] h-9 px-3"
                         >
                           <Trash2 className="w-4 h-4 mr-2" />
                           Borrar Todo
                         </Button>
                       )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <History className="w-4 h-4 text-indigo-600" />
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Movimientos del Día</h4>
                       </div>
                       <Badge variant="outline" className="text-[9px] font-bold text-slate-400 border-slate-200">
                         {filteredMovementsUI.length} Registros
                       </Badge>
                    </div>
                    
                    <ScrollArea className="h-[400px] pr-4 -mr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-4">
                        {filteredMovementsUI.length > 0 ? (
                          filteredMovementsUI.map(m => (
                            <div key={m.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-white hover:border-indigo-100 transition-all shadow-sm">
                               <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${m.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                                     {m.type === 'in' ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold text-slate-800 line-clamp-1">{m.productName}</p>
                                     <div className="flex items-center gap-2">
                                        <p className="text-[9px] text-slate-400 font-mono font-bold">{format(new Date(m.timestamp), 'HH:mm:ss')}</p>
                                        {m.note && <span className="text-[8px] bg-slate-200 text-slate-600 px-1 rounded uppercase font-black tracking-tighter truncate max-w-[80px]">{m.note}</span>}
                                     </div>
                                  </div>
                               </div>
                               <div className="text-right flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-black font-mono ${m.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                       {m.type === 'in' ? '+' : '-'}{m.quantity}
                                    </p>
                                    {user.role === 'admin' && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteMovement(m.id, m);
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase">{m.unit}</p>
                               </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full h-32 flex flex-col items-center justify-center text-slate-400 opacity-40 italic">
                            <History className="w-8 h-8 mb-2" />
                            <p className="text-[10px] font-bold uppercase">Sin movimientos registrados</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <FolderClock className="w-4 h-4 text-indigo-600" />
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sesiones Archivadas</h4>
                       </div>
                       <Badge variant="outline" className="text-[9px] font-bold text-slate-400 border-slate-200">
                         {(data.pastHistories || []).filter(h => h.date.startsWith(format(new Date(), "yyyy-MM"))).length} Cierres
                       </Badge>
                    </div>
                    
                    <ScrollArea className="h-[250px] pr-4 -mr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pb-4">
                        {data.pastHistories
                          .filter(h => h.date.startsWith(format(new Date(), "yyyy-MM")))
                          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(history => (
                            <Button
                              key={history.id}
                              variant="ghost"
                              className="w-full justify-between h-16 rounded-2xl hover:bg-white border border-slate-100 hover:border-indigo-100 transition-all text-left px-4 group shadow-sm bg-slate-50/50"
                              onClick={() => {
                                setSelectedPastHistoryId(history.id);
                                setIsHistoryViewOpen(true);
                                setHistoryItemSearch("");
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-indigo-600" />
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-800 truncate max-w-[120px]">{history.title || `Cierre ${format(new Date(history.date), 'dd/MM/yy')}`}</span>
                                  <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-tighter">{format(new Date(history.date), 'dd MMMM', { locale: es })}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-indigo-600" />
                            </Button>
                          ))
                        }
                        {(data.pastHistories || []).filter(h => h.date.startsWith(format(new Date(), "yyyy-MM"))).length === 0 && (
                          <div className="col-span-full h-24 flex flex-col items-center justify-center text-slate-400 opacity-40 border-2 border-dashed border-slate-100 rounded-2xl">
                            <p className="text-[10px] font-bold uppercase">Sin cierres mensuales</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile Admin Adjustments List */}
                  <div className="grid grid-cols-1 gap-2 p-4 md:hidden">
                    {adminMovements.map(m => (
                      <Card key={m.id} className="p-3 bg-white border-slate-200 rounded-xl flex flex-col gap-2 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{format(new Date(m.timestamp), 'dd/MM/yy HH:mm')}</span>
                          <span className={`font-mono text-xs font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                             {m.type === 'in' ? '+' : '-'}{m.quantity} {m.unit}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 pr-8">{m.productName}</p>
                        <p className="text-[9px] text-slate-500 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100 pr-8">
                           {m.note?.replace('AJUSTE ADMIN: ', '')}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 bottom-2 h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMovement(m.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </Card>
                    ))}
                  </div>

                  {/* Desktop Admin Adjustments Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-white border-b border-slate-100">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4">Fecha</TableHead>
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4">Producto</TableHead>
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4 text-right">Ajuste</TableHead>
                          <TableHead className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest px-4 md:px-6 py-3 md:py-4">Motivo</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminMovements.map(m => (
                          <TableRow key={m.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                            <TableCell className="px-4 md:px-6 py-3 md:py-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-900">{format(new Date(m.timestamp), 'dd/MM/yyyy')}</span>
                                <span className="text-[8px] text-slate-400 uppercase tracking-widest">{format(new Date(m.timestamp), 'HH:mm')}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 md:px-6 py-3 md:py-4 text-xs font-bold text-slate-700">{m.productName}</TableCell>
                            <TableCell className="px-4 md:px-6 py-3 md:py-4 text-right">
                               <span className={`font-mono text-sm font-black ${m.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                                 {m.type === 'in' ? '+' : '-'}{m.quantity}
                               </span>
                               <span className="text-[9px] text-slate-400 ml-1 uppercase">{m.unit}</span>
                            </TableCell>
                            <TableCell className="px-4 md:px-6 py-3 md:py-4">
                               <p className="text-[10px] text-slate-500 italic max-w-[200px] truncate" title={m.note}>
                                 {m.note?.replace('AJUSTE ADMIN: ', '')}
                               </p>
                            </TableCell>
                            <TableCell className="px-4 md:px-6 py-3 md:py-4 text-right pr-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMovement(m.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Past History Detail Dialog */}
      <Dialog open={isHistoryViewOpen} onOpenChange={setIsHistoryViewOpen}>
        <DialogContent className="border-none rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] p-0 overflow-hidden max-w-xl bg-white">
          <DialogHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 shadow-inner relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
            <div className="relative z-10 space-y-4">
              <div>
                <DialogTitle className="text-xl font-black tracking-tight drop-shadow-sm flex flex-col gap-1">
                  {selectedPastHistoryId && data.pastHistories.find(h => h.id === selectedPastHistoryId)?.title 
                    ? data.pastHistories.find(h => h.id === selectedPastHistoryId)?.title
                    : 'Detalle de Historial'}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs uppercase tracking-widest font-mono flex gap-2 items-center mt-1">
                  Registros Consolidados
                  {selectedPastHistoryId && data.pastHistories.find(h => h.id === selectedPastHistoryId) && (
                    <span className="bg-slate-700 font-sans px-2 py-0.5 rounded-full text-white text-[10px]">
                       {format(new Date(data.pastHistories.find(h => h.id === selectedPastHistoryId)!.date), 'dd MMMM yyyy HH:mm', { locale: es })}
                    </span>
                  )}
                </DialogDescription>
              </div>

              <div className="relative group">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <Input 
                  placeholder="Filtrar productos en este historial..." 
                  value={historyItemSearch}
                  onChange={(e) => setHistoryItemSearch(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pl-10 rounded-xl h-10 text-xs focus:ring-indigo-500"
                />
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[50vh] min-h-[400px] bg-slate-50/50">
            <div className="p-6 space-y-4">
              {selectedPastHistoryId && data.pastHistories.find(h => h.id === selectedPastHistoryId)?.note && !historyItemSearch && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl shadow-inner mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Notas / Observaciones</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.pastHistories.find(h => h.id === selectedPastHistoryId)?.note}</p>
                </div>
              )}
              
              <div className="space-y-3">
                {selectedPastHistoryId && data.pastHistories.find(h => h.id === selectedPastHistoryId)?.movements
                  .filter(m => 
                    m.productName.toLowerCase().includes(historyItemSearch.toLowerCase()) ||
                    m.category.toLowerCase().includes(historyItemSearch.toLowerCase())
                  )
                  .map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${m.type === 'in' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {m.type === 'in' ? <ArrowUpRight className="w-4 h-4 text-green-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{m.productName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {m.category} • {format(new Date(m.timestamp), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black font-mono text-lg ${m.type === 'in' ? 'text-green-600' : 'text-red-500'}`}>
                        {m.type === 'in' ? '+' : '-'}{m.quantity}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{m.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center sm:justify-between">
            <Button variant="ghost" onClick={() => {
              if (!selectedPastHistoryId) return;
              const hist = data.pastHistories.find(h => h.id === selectedPastHistoryId);
              if (hist) {
                openEditHistory(selectedPastHistoryId, hist.title, hist.note, hist.date);
                setIsHistoryViewOpen(false);
              }
            }} className="text-indigo-600 font-bold hover:bg-slate-100 uppercase tracking-widest text-xs">
              Editar Registro
            </Button>
            <Button variant="outline" onClick={() => setIsHistoryViewOpen(false)} className="rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200">
              Cerrar Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Past History Dialog */}
      <Dialog open={isEditingPastHistoryOpen} onOpenChange={setIsEditingPastHistoryOpen}>
        <DialogContent className="border-none rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden max-w-md bg-white">
          <DialogHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6 shadow-inner">
            <DialogTitle className="text-lg font-black tracking-tight drop-shadow-sm">Editar Historial Pasado</DialogTitle>
            <DialogDescription className="text-indigo-100 text-xs font-bold uppercase tracking-widest">
              Añade notas o un título identificativo
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Fecha del Registro</Label>
                <Input 
                  type="date"
                  value={editHistoryDate} 
                  onChange={e => setEditHistoryDate(e.target.value)}
                  className="border-slate-200 rounded-xl bg-slate-50 focus-visible:ring-indigo-500 h-10 shadow-inner text-black font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Hora</Label>
                <Input 
                  type="time"
                  value={editHistoryTime} 
                  onChange={e => setEditHistoryTime(e.target.value)}
                  className="border-slate-200 rounded-xl bg-slate-50 focus-visible:ring-indigo-500 h-10 shadow-inner text-black font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Título Opcional</Label>
              <Input 
                value={editHistoryTitle} 
                onChange={e => setEditHistoryTitle(e.target.value)}
                placeholder="Ej. Cierre Mensual, Auditoría..."
                className="border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 h-12 shadow-inner text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-slate-400">Observaciones (Agregar contenido)</Label>
              <textarea 
                value={editHistoryNote} 
                onChange={e => setEditHistoryNote(e.target.value)}
                placeholder="Escribe aquí aclaraciones, sobrantes o detalles relevantes adicionales..."
                className="w-full flex min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm shadow-inner placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex w-full justify-between sm:justify-between items-center">
            <Button 
              variant="ghost" 
              onClick={() => {
                if(selectedPastHistoryId) confirmDeletePastHistory(selectedPastHistoryId);
                setIsEditingPastHistoryOpen(false);
              }} 
              className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold uppercase tracking-widest text-xs"
            >
              Borrar Historial
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsEditingPastHistoryOpen(false)} className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                Cancelar
              </Button>
              {user.role !== "viewer" && (
                <Button variant="ghost" onClick={updatePastHistory} className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-md rounded-xl font-bold uppercase tracking-widest text-xs">
                  Guardar Cambios
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Current Movements Confirmation */}
      <Dialog open={isDeleteCurrentOpen} onOpenChange={setIsDeleteCurrentOpen}>
        <DialogContent className="border-none rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden max-w-sm bg-white">
          <DialogHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 shadow-inner text-center">
            <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <DialogTitle className="text-xl font-black tracking-tight drop-shadow-sm">¿Eliminar Historial Actual?</DialogTitle>
            <DialogDescription className="text-red-100 text-xs font-bold uppercase tracking-widest leading-relaxed mt-2">
              Esta acción borrará toda la actividad en curso sin crear un archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-sm font-medium text-slate-600">
            Perderás todos los registros mostrados en "Actividad de Inventario". Esta acción no se puede deshacer.
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 sm:justify-center">
            <Button variant="ghost" onClick={() => setIsDeleteCurrentOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-200">
              Cancelar
            </Button>
            {user.role !== "viewer" && (
              <Button onClick={deleteCurrentMovements} className="rounded-xl font-bold uppercase tracking-widest text-xs bg-red-600 text-white hover:bg-red-700 shadow-md">
                Sí, Eliminar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Past History Confirmation */}
      <Dialog open={isDeletePastHistoryConfirmOpen} onOpenChange={setIsDeletePastHistoryConfirmOpen}>
        <DialogContent className="border-none rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden max-w-sm bg-white">
          <DialogHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 shadow-inner text-center">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <DialogTitle className="text-xl font-black tracking-tight drop-shadow-sm">Eliminar Registro Archivado</DialogTitle>
            <DialogDescription className="text-red-100 text-xs font-bold uppercase tracking-widest leading-relaxed mt-2">
              Advertencia: Está a punto de borrar permanentemente un registro del historial archivado.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-sm font-medium text-slate-600">
            Esta acción es irreversible y los datos no podrán ser recuperados. ¿Desea continuar?
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 sm:justify-center">
            <Button variant="ghost" onClick={() => setIsDeletePastHistoryConfirmOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-200">
              Cancelar
            </Button>
            {user.role !== "viewer" && (
              <Button 
                onClick={() => historyToDeleteId && deletePastHistory(historyToDeleteId)} 
                className="rounded-xl font-bold uppercase tracking-widest text-xs bg-red-600 text-white hover:bg-red-700 shadow-md"
              >
                Confirmar Borrado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon, color, special = false }: { title: string; value: string; icon: React.ReactNode; color: string; special?: boolean }) {
  return (
    <Card className={`rounded-2xl border transition-all ${
      special 
        ? "border-indigo-200 bg-indigo-50/50 shadow-sm shadow-indigo-100" 
        : "bg-white border-slate-200 shadow-sm"
    }`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${special ? 'bg-white' : 'bg-slate-50'} border border-slate-100`}>
          {icon}
        </div>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${special ? 'text-indigo-600' : 'text-slate-500'}`}>
            {title}
          </p>
          <p className={`text-2xl font-black tracking-tighter ${color} leading-none`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="border-2 border-black shadow-none rounded-none flex items-center p-4 bg-white">
      <div className="flex-1">
        <p className="text-[10px] font-bold uppercase text-gray-400 tracking-tighter leading-none mb-1">{title}</p>
        <p className="text-2xl font-black font-mono leading-none tracking-tighter">{value}</p>
      </div>
      <div className="h-10 w-10 flex items-center justify-center bg-gray-50 border border-black border-dashed">
        {icon}
      </div>
    </Card>
  );
}
