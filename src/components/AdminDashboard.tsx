import React, { useState, useMemo } from "react";
import { User, DBData, Product, Movement, Request, Delegation } from "../types";
import { 
  Menu,
  X,
  LayoutDashboard, 
  Package, 
  Calculator, 
  Bell, 
  Calendar as CalendarIcon, 
  LogOut, 
  Search, 
  Plus, 
  History,
  TrendingDown,
  TrendingUp,
  Clock,
  Users,
  ClipboardList,
  Fuel,
  Download,
  RotateCcw,
  Sun,
  Moon,
  Building2,
  ShieldCheck,
  GitBranch
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { exportMultipleSheetsToExcel } from "../lib/exportUtils";
import { format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { isSuperAdminEmail } from "../lib/helpers";

// Sub-components
import InventorySection from "./admin/InventorySection";
import InventoryHistorySection from "./admin/InventoryHistorySection";
import AccountingSection from "./admin/AccountingSection";
import RequestSection from "./admin/RequestSection";
import CalendarSection from "./admin/CalendarSection";
import UsersSection from "./admin/UsersSection";
import RequestsHistorySection from "./admin/RequestsHistorySection";
import SupportInventorySection from "./admin/SupportInventorySection";
import GasReportsSection from "./admin/GasReportsSection";
import TrashSection from "./admin/TrashSection";
import GlobalManagementSection from "./admin/GlobalManagementSection";
import GovernanceSection from "./admin/GovernanceSection";

interface AdminDashboardProps {
  user: User;
  data: DBData;
  onLogout: () => void;
  delegationId: string;
  allDelegations: Delegation[];
  onDelegationChange: (id: string) => void;
  onGlobalRefresh: () => void;
  notificationHistory: {message: string, type?: string, timestamp: number}[];
}

export default React.memo(function AdminDashboard({ 
  user, 
  data, 
  onLogout,
  delegationId,
  allDelegations,
  onDelegationChange,
  onGlobalRefresh,
  notificationHistory
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const isSuperAdmin = useMemo(() => {
    return isSuperAdminEmail(user.email);
  }, [user.email]);

  const effectiveUser = useMemo(() => {
    if (isSuperAdmin && isReadOnly) {
      return { ...user, role: "viewer" as const };
    }
    return user;
  }, [user, isSuperAdmin, isReadOnly]);

  const pendingCount = useMemo(() => {
    const stockRequests = data.requests.filter(r => r.status === "pending").length;
    const userRequests = data.users.filter(u => !u.isApproved).length;
    return stockRequests + userRequests;
  }, [data.requests, data.users]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Close menu on mobile after selection
  };

  const handleExportAllData = () => {
    const sheets = [];

    // 1. INVENTARIO COMPLETO
    if (data.products && data.products.length > 0) {
      sheets.push({
        name: "Inventario General",
        data: data.products.map(p => {
          const cat = data.categories?.find(c => c.id === p.category || c.name === p.category);
          return {
            "ID": p.id,
            "Bloque/Categoría": cat ? cat.name : p.category,
            "Artículo": p.name,
            "Stock Actual": p.quantity,
            "Unidad": p.unit || "N/A",
            "Referencia": p.type || "General",
            "Vencimiento": p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : "No registra",
            "Estado": p.isHidden ? "Oculto" : "Visible"
          };
        })
      });
    }    // 2. CONTADURIA (MOVIMIENTOS ACTUALES)
    if (data.movements && data.movements.length > 0) {
      sheets.push({
        name: "Contaduría (Activos)",
        data: data.movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(m => ({
          "Fecha": new Date(m.timestamp).toLocaleDateString(),
          "Hora": new Date(m.timestamp).toLocaleTimeString(),
          "Operación": m.type === "in" ? "Entrada (+)" : "Salida (-)",
          "Artículo": m.productName,
          "Cantidad": m.quantity,
          "Unidad": m.unit || "N/A",
          "Bloque": m.category || "N/A",
          "Nota": m.note || "N/A"
        }))
      });
    }

    // 3. KARDEX / HISTORIAL (MOVIMIENTOS ARCHIVADOS)
    const archivedMovements = data.pastHistories?.flatMap(h => h.movements || []) || [];
    if (archivedMovements.length > 0) {
      sheets.push({
        name: "Kardex (Histórico)",
        data: archivedMovements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(m => ({
          "Fecha": new Date(m.timestamp).toLocaleDateString(),
          "Hora": new Date(m.timestamp).toLocaleTimeString(),
          "Operación": m.type === "in" ? "Entrada (+)" : "Salida (-)",
          "Artículo": m.productName,
          "Cantidad": m.quantity,
          "Unidad": m.unit || "N/A",
          "Bloque": m.category || "N/A",
          "Nota": m.note || "N/A"
        }))
      });
    }

    // 4. PEDIDOS PASADOS
    const allRequests = [
      ...(data.requests || []).map(r => ({ ...r, source: 'Pendiente' })),
      ...(data.pastHistories?.flatMap(h => (h.requests || []).map(r => ({ ...r, source: 'Archivado' }))) || [])
    ];

    if (allRequests.length > 0) {
      const pedidoItems = allRequests.flatMap(req => {
        return (req.items || []).map(item => ({
          "Folio": req.id,
          "Fecha": new Date(req.timestamp).toLocaleDateString(),
          "Solicitó": req.userName || "N/A",
          "Artículo": item.name,
          "Cantidad": item.quantity,
          "Estado": req.status === "confirmed" ? "Aprobado" : req.status === "rejected" ? "Rechazado" : "Pendiente",
          "Origen": (req as any).source,
          "Comentarios": req.note || ""
        }));
      });
      sheets.push({ name: "Pedidos Pasados", data: pedidoItems });
    }

    // 5. CALENDARIO OPERATIVO (Timeline)
    const timeline = [];
    
    // Add current movements to timeline
    data.movements?.forEach(m => {
      timeline.push({
        "Timestamp": new Date(m.timestamp),
        "Fecha": new Date(m.timestamp).toLocaleDateString(),
        "Hora": new Date(m.timestamp).toLocaleTimeString(),
        "Evento": "STOCK",
        "Detalle": `${m.type === "in" ? "Ingreso" : "Salida"}: ${m.productName}`,
        "Valor": `${m.type === "in" ? "+" : "-"}${m.quantity} ${m.unit || ""}`,
        "Responsable": m.note || "N/A"
      });
    });

    // Add gas reports to timeline
    if (data.gasReports) {
      data.gasReports.forEach(g => {
        timeline.push({
          "Timestamp": new Date(g.timestamp),
          "Fecha": new Date(g.timestamp).toLocaleDateString(),
          "Hora": new Date(g.timestamp).toLocaleTimeString(),
          "Evento": "GAS",
          "Detalle": "Registro de Carga de Gas",
          "Valor": `${g.amount} Lts`,
          "Responsable": g.userName || "N/A"
        });
      });
    }

    if (timeline.length > 0) {
      sheets.push({
        name: "Calendario",
        data: timeline.sort((a, b) => b.Timestamp.getTime() - a.Timestamp.getTime()).map(({Timestamp, ...rest}) => rest)
      });
    }

    // 6. APOYO (CATALOGO Y REGISTROS)
    if (data.supportProducts && data.supportProducts.length > 0) {
      sheets.push({
        name: "Apoyo (Catálogo)",
        data: data.supportProducts.map(p => ({
          "Artículo": p.name,
          "Bloque": p.category,
          "Unidad": p.unit || "N/A"
        }))
      });
    }

    if (data.supportRecords && data.supportRecords.length > 0) {
      sheets.push({
        name: "Apoyo (Registros)",
        data: data.supportRecords.flatMap(rec => rec.items.map(item => ({
          "Fecha": rec.date,
          "Solicitó": rec.userName || "N/A",
          "Artículo": item.name,
          "Cantidad": item.quantity,
          "Unidad": item.unit,
          "Nota": rec.note || ""
        })))
      });
    }

    // 7. REPORTES DE GAS
    if (data.gasReports && data.gasReports.length > 0) {
      sheets.push({
        name: "Reportes Gas",
        data: data.gasReports.map(g => ({
          "Fecha": new Date(g.timestamp).toLocaleDateString(),
          "Litros": g.amount,
          "Responsable": g.userName || "N/A",
          "Nota": g.note || ""
        }))
      });
    }

    // 8. PAPELERA (RECOVERY)
    if (data.trash && data.trash.length > 0) {
      sheets.push({
        name: "Papelera (Recuperación)",
        data: data.trash.map(t => ({
          "Tipo": t.type,
          "Fecha Eliminación": t.deletedAt ? new Date(t.deletedAt).toLocaleString() : "N/A",
          "Detalle": JSON.stringify(t.data)
        }))
      });
    }

    // 9. LISTA DE PERSONAL
    if (data.users && data.users.length > 0) {
      sheets.push({
        name: "Personal y Usuarios",
        data: data.users.map(u => ({
          "Nombre": u.name,
          "First Name": u.firstName || "",
          "Last Name": u.lastName || "",
          "Email": u.email,
          "Rol": u.role,
          "Fecha Registro": u.id.length > 10 ? new Date(parseInt(u.id.split('-')[1]) || Date.now()).toLocaleDateString() : "N/A",
          "Estado": u.isApproved ? "Activo" : "Pendiente"
        }))
      });
    }

    if (sheets.length === 0) {
      sheets.push({ name: "Aviso", data: [{"Estado": "Sin datos para exportar"}] });
    }

    exportMultipleSheetsToExcel(sheets, "REPORTE_TOTAL_INVENTARIO");
  };


  const isMasterAdmin = useMemo(() => {
    return user.email === "jsphprendas@gmail.com" || user.email === "alecamposa32@gmail.com";
  }, [user.email]);

  return (
    <div className="flex h-[100dvh] bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-200 overflow-hidden transition-colors duration-300">
      
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-md"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-full lg:w-80 ${isMasterAdmin ? 'bg-neutral-950 border-r border-amber-500/20' : 'bg-slate-900 border-r border-slate-800'} text-white flex flex-col z-50 transform transition-transform duration-500 ease-in-out ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`p-8 flex items-center justify-between border-b ${isMasterAdmin ? 'border-amber-500/10' : 'border-white/5'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 ${isMasterAdmin ? 'bg-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.4)]' : 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.3)]'} rounded-xl flex items-center justify-center font-black text-xl text-white transform hover:rotate-6 transition-transform`}>IA</div>
            <div>
              <h1 className={`text-xl font-black tracking-tight leading-none ${isMasterAdmin ? 'text-amber-500' : 'text-white'}`}>INTENDENCIA</h1>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mt-1">Autónoma V5</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" className={`lg:hidden ${isMasterAdmin ? 'text-amber-500 hover:bg-amber-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'} rounded-full`} onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto no-scrollbar">
          {/* Delegation Selector ONLY for SuperAdmin */}
          {isSuperAdmin && (
            <div className="mb-6 px-1">
              <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-1 ${isMasterAdmin ? 'text-amber-500/80 shadow-[0_0_10px_rgba(255,191,0,0.2)]' : 'text-slate-500'}`}>
                Jurisdicción Actual
              </div>
              <div className="relative group">
                <Building2 className={`absolute left-3 top-2.5 w-4 h-4 ${isMasterAdmin ? 'text-amber-500' : 'text-slate-400'} z-10 transition-transform group-hover:scale-110`} />
                <select 
                  value={delegationId}
                  onChange={(e) => onDelegationChange(e.target.value)}
                  className={`w-full ${isMasterAdmin ? 'bg-black/50 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(255,191,0,0.1)]' : 'bg-slate-800 border-white/10 text-white'} text-xs font-black rounded-xl pl-10 pr-4 py-3 border focus:ring-2 ${isMasterAdmin ? 'focus:ring-amber-500' : 'focus:ring-indigo-500'} transition-all outline-none appearance-none cursor-pointer relative uppercase tracking-wider h-11`}
                >
                  <optgroup label="Instancias Activas" className={isMasterAdmin ? 'bg-black text-amber-500' : 'bg-slate-900 text-white'}>
                    {allDelegations.map(del => (
                      <option key={del.id} value={del.id} className="py-2">
                         {del.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className={`absolute right-3 top-3.5 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] ${isMasterAdmin ? 'border-t-amber-500' : 'border-t-slate-400'} pointer-events-none`} />
              </div>
              
              {isSuperAdmin && (
                <div className="mt-4 px-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsReadOnly(!isReadOnly)}
                    className={`w-full justify-between h-9 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      isReadOnly 
                        ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' 
                        : 'bg-slate-800/50 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                       {isReadOnly ? <LogOut className="w-3 h-3 rotate-180" /> : <Search className="w-3 h-3" />}
                       {isReadOnly ? 'Modo Observador' : 'Modo Control'}
                    </div>
                    <div className={`w-2 h-2 rounded-full ${isReadOnly ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-600'}`} />
                  </Button>
                </div>
              )}

              <div className={`mt-1.5 px-1 text-[8px] font-bold uppercase tracking-widest ${isMasterAdmin ? 'text-amber-500/40' : 'text-slate-500'}`}>
                Cambio dinámico de entorno
              </div>
            </div>
          )}

          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 pt-2">Administración</div>
          <SidebarItem 
            icon={<Package className="w-5 h-5" />} 
            label="Inventario" 
            active={activeTab === "inventory"} 
            onClick={() => handleTabChange("inventory")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<Calculator className="w-5 h-5" />} 
            label="Contaduría" 
            active={activeTab === "accounting"} 
            onClick={() => handleTabChange("accounting")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<Clock className="w-5 h-5" />} 
            label="Kárdex / Historial" 
            active={activeTab === "inventory-history"} 
            onClick={() => handleTabChange("inventory-history")} 
            isGolden={isMasterAdmin}
            customActiveClass={activeTab === "inventory-history" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : ""}
          />
          <div className="pt-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Gestión</div>
          <SidebarItem 
            icon={<Users className="w-5 h-5" />} 
            label="Personal" 
            active={activeTab === "users"} 
            onClick={() => handleTabChange("users")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<Bell className="w-5 h-5" />} 
            label="Notificaciones" 
            active={activeTab === "notifications"} 
            onClick={() => handleTabChange("notifications")} 
            badge={pendingCount > 0 ? pendingCount : undefined}
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<History className="w-5 h-5" />} 
            label="Pedidos Pasados" 
            active={activeTab === "requests-history"} 
            onClick={() => handleTabChange("requests-history")} 
            isGolden={isMasterAdmin}
            customActiveClass={activeTab === "requests-history" ? "bg-red-600 text-white shadow-lg shadow-red-500/20" : ""}
            customInactiveClass={activeTab !== "requests-history" ? "text-red-400/70 hover:text-red-500 hover:bg-red-500/10" : ""}
          />
          <SidebarItem 
            icon={<CalendarIcon className="w-5 h-5" />} 
            label="Calendario" 
            active={activeTab === "calendar"} 
            onClick={() => handleTabChange("calendar")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<ClipboardList className="w-5 h-5" />} 
            label="Apoyo" 
            active={activeTab === "support-inventory"} 
            onClick={() => handleTabChange("support-inventory")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<Fuel className="w-5 h-5" />} 
            label="Reportes Gas" 
            active={activeTab === "gas-reports"} 
            onClick={() => handleTabChange("gas-reports")} 
            isGolden={isMasterAdmin}
          />
          <SidebarItem 
            icon={<RotateCcw className="w-5 h-5" />} 
            label="Centro de Recuperación" 
            active={activeTab === "recovery"} 
            onClick={() => handleTabChange("recovery")} 
            isGolden={isMasterAdmin}
            customActiveClass={activeTab === "recovery" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : ""}
          />
          <SidebarItem 
            icon={<ShieldCheck className="w-5 h-5" />} 
            label="Gobernanza" 
            active={activeTab === "governance"} 
            onClick={() => handleTabChange("governance")} 
            isGolden={isMasterAdmin}
          />

          {isSuperAdmin && (
            <>
              <div className="pt-6 text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-2 px-2">Super Admin Ops</div>
              <SidebarItem 
                icon={<Building2 className="w-5 h-5" />} 
                label="Gestionar Intendencias" 
                active={activeTab === "global-management"} 
                onClick={() => handleTabChange("global-management")} 
                customActiveClass="bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              />
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-white/10 shrink-0 flex flex-col gap-2">
          <Button
            variant="outline"
            className={`w-full justify-start border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 rounded-xl h-12 px-4 transition-all shadow-sm ${isMasterAdmin ? '!border-amber-500/50 !text-amber-500 hover:!bg-amber-500/10' : ''}`}
            onClick={handleExportAllData}
          >
            <Download className={`w-5 h-5 mr-3 shrink-0 ${isMasterAdmin ? 'text-amber-500' : 'text-emerald-600'}`} />
            <div className="flex flex-col items-start bg-transparent text-left">
              <span className="font-bold text-sm tracking-wide leading-tight">Exportar Todo</span>
              <span className={`text-[10px] font-medium leading-tight ${isMasterAdmin ? 'text-amber-500/70' : 'text-emerald-600/70'}`}>Múltiples Hojas Excel</span>
            </div>
          </Button>

          <Button 
            variant="ghost" 
            className={`w-full justify-start ${isMasterAdmin ? 'text-white/60 hover:text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.4)]' : 'text-indigo-400 hover:text-white'} hover:bg-white/5 rounded-xl h-12 px-4 transition-all`}
            onClick={onLogout}
          >
            <LogOut className={`w-5 h-5 mr-3 shrink-0 ${isMasterAdmin ? 'text-white' : ''}`} />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Subtle Background Pattern for Master Admin */}
        {isMasterAdmin && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent pointer-events-none" />
        )}

        {/* Global Toolbar */}
        <header className={`h-20 ${isMasterAdmin ? 'bg-black/95 border-b border-amber-500/20' : 'bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800'} flex items-center justify-between px-6 md:px-10 z-30 backdrop-blur-md sticky top-0`}>
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" className={`lg:hidden ${isMasterAdmin ? 'text-amber-500 hover:bg-amber-500/10' : 'text-slate-500'} h-10 w-10`} onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="w-7 h-7" />
            </Button>
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isMasterAdmin ? 'text-amber-500/50' : 'text-slate-400'}`} />
              <Input 
                placeholder="Explorar inteligencia de datos..." 
                className={`w-full pl-11 pr-4 py-2 ${isMasterAdmin ? 'bg-white/5 border-amber-500/30 text-amber-500 placeholder:text-amber-500/30 focus-visible:ring-amber-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-indigo-500'} rounded-2xl text-xs md:text-sm transition-all h-11 focus-visible:ring-offset-0`} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className={`text-[10px] ${isMasterAdmin ? 'text-amber-500/60 font-black' : 'text-slate-500'} uppercase font-bold tracking-widest`}>Terminal V5.0</span>
              <span className={`text-xs font-black flex items-center gap-1.5 ${isMasterAdmin ? 'text-amber-500' : 'text-indigo-600'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isMasterAdmin ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'bg-green-500'} animate-pulse`}></div>
                Operativo
              </span>
            </div>
            <div className={`hidden sm:block h-10 w-px ${isMasterAdmin ? 'bg-amber-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            
            <ThemeToggle />
            
            <Button 
              variant="ghost" 
              size="icon" 
              className={`h-11 w-11 md:h-12 md:w-12 rounded-2xl ${isMasterAdmin ? 'text-amber-500 hover:bg-amber-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950'} transition-all group`}
              onClick={onLogout}
            >
              <LogOut className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors scroll-smooth touch-pan-y">
          <div className="p-4 sm:p-6 md:p-10 max-w-screen-2xl mx-auto min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full"
              >
                {isSuperAdmin && isReadOnly && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center">
                        <Search className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Modo de Visualización Activo</h4>
                        <p className="text-xs font-bold text-amber-600/80 uppercase tracking-widest">Estás explorando los datos sin permisos de edición (Lectura)</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsReadOnly(false)}
                      className="border-amber-200 text-amber-700 hover:bg-amber-100 h-9 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    >
                      Volver al Control Total
                    </Button>
                  </motion.div>
                )}

                {activeTab === "inventory" && <InventorySection user={effectiveUser} data={data} searchTerm={searchTerm} onExportAll={handleExportAllData} onGlobalRefresh={onGlobalRefresh} />}
                {activeTab === "inventory-history" && <InventoryHistorySection user={effectiveUser} data={data} />}
                {activeTab === "accounting" && 
                  <AccountingSection 
                    user={effectiveUser} 
                    data={data} 
                    searchTerm={searchTerm} 
                    onExportAll={handleExportAllData}
                    onGlobalRefresh={onGlobalRefresh}
                  />
                }
                {activeTab === "users" && (
                  <UsersSection 
                    user={effectiveUser} 
                    data={data} 
                    isSuperAdmin={isSuperAdmin} 
                    onGlobalRefresh={onGlobalRefresh}
                    allDelegations={allDelegations}
                  />
                )}
                {activeTab === "notifications" && <RequestSection user={effectiveUser} data={data} />}
                {activeTab === "requests-history" && 
                  <RequestsHistorySection 
                    user={effectiveUser} 
                    data={data} 
                    onExportAll={handleExportAllData}
                  />
                }
                {activeTab === "calendar" && <CalendarSection user={effectiveUser} data={data} />}
                {activeTab === "support-inventory" && <SupportInventorySection user={effectiveUser} data={data} />}
                {activeTab === "gas-reports" && <GasReportsSection reports={data.gasReports || []} user={effectiveUser} />}
                {activeTab === "recovery" && <TrashSection user={effectiveUser} data={data} />}
                {activeTab === "governance" && <GovernanceSection user={effectiveUser} data={data} onRefresh={onGlobalRefresh} />}
                {activeTab === "global-management" && isSuperAdmin && (
                  <GlobalManagementSection 
                    user={effectiveUser}
                    onDelegationCreated={onGlobalRefresh} 
                    delegations={allDelegations} 
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="h-8 bg-slate-800 text-white flex items-center px-4 md:px-8 justify-between text-[8px] md:text-[10px] uppercase tracking-widest font-medium shrink-0">
          <div className="flex gap-2 md:gap-4">
            <span className={effectiveUser.role === "viewer" ? "text-amber-400 font-black animate-pulse" : "text-indigo-400"}>
              Modo: {effectiveUser.role === "viewer" ? "Gestión (Solo Lectura)" : "Control Total"}
            </span>
            <span className="opacity-50 hidden sm:inline">Sincronizado con Nube</span>
          </div>
          <div>INTENDENCIA AUTONOMA © 2026</div>
        </div>
      </main>
    </div>
  );
});

function SidebarItem({ icon, label, active, onClick, badge, isGolden, customActiveClass, customInactiveClass }: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick: () => void; 
  badge?: number;
  isGolden?: boolean;
  customActiveClass?: string;
  customInactiveClass?: string;
}) {
  const defaultActiveClass = isGolden 
    ? "bg-white text-slate-900 shadow-[0_0_20px_white] scale-[1.02]" 
    : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20";
    
  const activeClass = customActiveClass || defaultActiveClass;

  return (
    <motion.button
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold transition-all rounded-xl border border-transparent ${
        active 
          ? activeClass 
          : customInactiveClass || (isGolden 
            ? "text-white/40 hover:text-white hover:bg-white/5 border-transparent" 
            : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent")
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={active ? (isGolden ? "text-slate-900" : "text-white") : (isGolden ? "text-amber-500" : "text-slate-500")}>
          {icon}
        </div>
        <span className="tracking-tight">{label}</span>
      </div>
      {badge !== undefined && (
        <Badge className={`${isGolden ? 'bg-black text-amber-500' : 'bg-red-500 text-white'} text-[10px] px-1.5 py-0.5 rounded-full font-black border-none animate-in zoom-in duration-300`}>
          {badge}
        </Badge>
      )}
    </motion.button>
  );
}
