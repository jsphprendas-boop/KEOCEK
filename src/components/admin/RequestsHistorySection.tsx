import React, { useState, useMemo, useCallback, useEffect } from "react";
import { DBData, Request, User as UserType } from "../../types";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  ArrowLeft,
  ChevronRight as ChevronRightIcon,
  Package,
  Search,
  User,
  CheckCircle2,
  XCircle,
  Clock4,
  History as HistoryIcon,
  Trash2,
  List,
  Plus,
  Minus,
  Save,
  Download,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";

interface RequestsHistorySectionProps {
  user: UserType;
  data: DBData;
  onExportAll: () => void;
}

import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { maskEmail } from "../../lib/helpers";

export default function RequestsHistorySection({ user, data, onExportAll }: RequestsHistorySectionProps) {
  const [selectedCook, setSelectedCook] = useState<UserType | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [editedItems, setEditedItems] = useState<any[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDeleteId, setRequestToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRequest) {
      setEditedItems([...selectedRequest.items.map(item => ({...item}))]);
    } else {
      setEditedItems(null);
    }
  }, [selectedRequest]);

  const handleUpdateItemQty = (index: number, change: number) => {
    if (!editedItems) return;
    const newItems = [...editedItems];
    newItems[index].quantity = Math.max(0, newItems[index].quantity + change);
    setEditedItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (!editedItems) return;
    const newItems = [...editedItems];
    newItems.splice(index, 1);
    setEditedItems(newItems);
  };

  const handleSaveRequestEdits = async () => {
    if (!selectedRequest || !editedItems) return;
    setIsSaving(true);
    try {
      const remainingItems = editedItems.filter(item => item.quantity > 0);
      if (remainingItems.length === 0) {
        await handleDeleteRequest(selectedRequest.id);
        toast.success("Pedido eliminado");
      } else {
        const res = await fetch(`/api/history/requests/${selectedRequest.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: remainingItems })
        });
        if (res.ok) {
           const updatedReq = await res.json();
           setSelectedRequest(updatedReq);
           toast.success("Pedido actualizado");
        }
      }
    } catch (e) {
      toast.error("Error al guardar cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setRequestToDeleteId(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDeleteId) return;
    try {
      const res = await fetch(`/api/history/requests/${requestToDeleteId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Pedido eliminado");
        if (selectedRequest?.id === requestToDeleteId) {
          setSelectedRequest(null);
        }
        setIsDeleteDialogOpen(false);
        setRequestToDeleteId(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar pedido");
    }
  };

  const cooks = useMemo(() => {
    return data.users.filter(u => u.role === "cook" || u.role === "admin");
  }, [data.users]);

  const filteredCooks = cooks.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    maskEmail(c.email, user.email).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const allRequests = useMemo(() => {
    const pastRequests = data.pastHistories?.flatMap(h => h.requests || []) || [];
    return [...data.requests, ...pastRequests];
  }, [data.requests, data.pastHistories]);

  // Filter requests by the selected cook
  const cookRequests = useMemo(() => {
    if (!selectedCook) return [];
    return allRequests.filter(r => r.userId === selectedCook.id);
  }, [allRequests, selectedCook]);

  const handleExportAll = () => {
    const formattedData = allRequests.flatMap(req => {
      const u = data.users.find(u => u.id === req.userId);
      return req.items.map(item => ({
        "Folio": req.id,
        "Urgente": req.isUrgent ? "SÍ" : "NO",
        "Cocinero": u ? u.name : req.userName || "Desconcido",
        "Estado": req.status === "confirmed" ? "Aprobado" : req.status === "rejected" ? "Rechazado" : "Pendiente",
        "Fecha": new Date(req.timestamp).toLocaleString(),
        "Artículo": item.name,
        "Cantidad": item.quantity,
        "Nota": req.note || ""
      }));
    });
    exportToExcel(formattedData, "Historial_Pedidos");
  };

  const handleExportAllPDF = () => {
    const formattedData = allRequests.flatMap(req => {
      const u = data.users.find(u => u.id === req.userId);
      return req.items.map(item => ({
        "Fecha": format(new Date(req.timestamp), "dd/MM/yyyy HH:mm"),
        "Folio": req.id.slice(-6).toUpperCase(),
        "Solicitante": u ? u.name : req.userName || "Desconocido",
        "Artículo": item.name,
        "Cant.": item.quantity,
        "Estado": req.status === "confirmed" ? "APROBADO" : req.status === "rejected" ? "RECHAZADO" : "PENDIENTE",
        "Urgente": req.isUrgent ? "SÍ" : "NO"
      }));
    });
    exportToPDF(formattedData, "Historial_Pedidos_Total", "REPORTE HISTÓRICO GLOBAL DE PEDIDOS");
  };

  const handleExportCook = () => {
    if (!selectedCook) return;
    const formattedData = cookRequests.flatMap(req => {
      return req.items.map(item => ({
        "ID Pedido": req.id,
        "Urgente": req.isUrgent ? "SÍ" : "NO",
        "Cocinero": selectedCook.name,
        "Estado": req.status === "confirmed" ? "Aprobado" : req.status === "rejected" ? "Denegado" : "Pendiente",
        "Fecha": new Date(req.timestamp).toLocaleString(),
        "Artículo": item.name,
        "Cantidad": item.quantity,
        "Nota": req.note || ""
      }));
    });
    exportToExcel(formattedData, `Historial_${selectedCook.firstName || selectedCook.name.split(" ")[0]}`);
  };

  const handleExportCookPDF = () => {
    if (!selectedCook) return;
    const formattedData = cookRequests.flatMap(req => {
      return req.items.map(item => ({
        "Fecha": format(new Date(req.timestamp), "dd/MM/yyyy HH:mm"),
        "Folio": req.id.slice(-6).toUpperCase(),
        "Artículo": item.name,
        "Cant.": item.quantity,
        "Estado": req.status === "confirmed" ? "APROBADO" : req.status === "rejected" ? "RECHAZADO" : "PENDIENTE",
        "Urgente": req.isUrgent ? "SÍ" : "NO"
      }));
    });
    exportToPDF(formattedData, `Historial_${selectedCook.firstName || selectedCook.name.split(" ")[0]}`, `REPORTE DE PEDIDOS - ${selectedCook.name.toUpperCase()}`);
  };

  const getRequestsForDay = useCallback((day: Date) => {
    return cookRequests.filter(r => isSameDay(new Date(r.timestamp), day));
  }, [cookRequests]);

  const getDayStats = (day: Date) => {
    const dayReqs = getRequestsForDay(day);
    const confirmed = dayReqs.filter(r => r.status === 'confirmed').length;
    const rejected = dayReqs.filter(r => r.status === 'rejected').length;
    const pending = dayReqs.filter(r => r.status === 'pending').length;
    return { confirmed, rejected, pending, total: dayReqs.length };
  };

  const dayRequests = useMemo(() => {
    if (!selectedDay) return [];
    return getRequestsForDay(selectedDay).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [getRequestsForDay, selectedDay]);

  if (!selectedCook) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-red-600 p-6 md:p-8 rounded-[2rem] text-white shadow-xl shadow-red-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl md:text-3xl font-black tracking-tight mb-2 uppercase">Pedidos Pasados</h3>
            <p className="text-red-100 text-xs md:text-sm font-medium max-w-md opacity-80 uppercase tracking-widest leading-relaxed">
              Seleccione un integrante del personal de cocina para visualizar su historial de pedidos y rendimiento en el calendario.
            </p>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <HistoryIcon className="w-32 h-32 rotate-12" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o correo..." 
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none rounded-2xl h-12 px-6 font-bold uppercase tracking-widest text-[10px] border-red-200 text-red-600 hover:bg-red-50 shadow-sm"
              onClick={handleExportAll}
            >
              <Download className="w-4 h-4 mr-2" />
              Excel Global
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none rounded-2xl h-12 px-6 font-bold uppercase tracking-widest text-[10px] border-red-200 text-red-600 hover:bg-red-50 shadow-sm"
              onClick={handleExportAllPDF}
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF Global
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCooks.map(cook => (
            <button
              key={cook.id}
              onClick={() => setSelectedCook(cook)}
              className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-red-200 transition-all flex items-center gap-4 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors uppercase tracking-widest text-xl mb-0">
                {cook.name.substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900 group-hover:text-red-600 transition-colors truncate">
                  {cook.firstName && cook.lastName ? `${cook.firstName} ${cook.lastName}` : cook.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[8px] uppercase tracking-widest font-black py-0.5 px-1.5 border-slate-200 text-slate-500">
                    {cook.role === 'admin' ? 'Administrador' : 'Cocinero'}
                  </Badge>
                  <span className="text-[9px] text-slate-400 font-bold truncate">{(allRequests.filter(r => r.userId === cook.id)).length} Solicitudes</span>
                </div>
              </div>
              <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl h-10 w-10 hover:bg-red-50 hover:text-red-600"
            onClick={() => setSelectedCook(null)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-900 tracking-tight flex items-center gap-2 text-sm md:text-base uppercase">
              Calendario: {selectedCook.firstName || selectedCook.name.split(" ")[0]}
            </h3>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-widest">
              Visualizando actividad de {maskEmail(selectedCook.email, user.email)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-[10px] uppercase font-bold tracking-widest h-8 px-4 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={handleExportCook}
          >
            <Download className="w-3.5 h-3.5 mr-2" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-[10px] uppercase font-bold tracking-widest h-8 px-4 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={handleExportCookPDF}
          >
            <FileText className="w-3.5 h-3.5 mr-2" /> PDF
          </Button>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg text-[10px] uppercase font-bold tracking-widest h-8 px-4 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="w-3.5 h-3.5 mr-2" /> Calendario
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`rounded-lg text-[10px] uppercase font-bold tracking-widest h-8 px-4 ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              onClick={() => setViewMode("list")}
            >
              <List className="w-3.5 h-3.5 mr-2" /> Lista
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white p-3 md:p-8 rounded-[1.5rem] md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {viewMode === "calendar" ? (
          <>
            <div className="flex items-center justify-between mb-4 md:mb-6 bg-slate-50 p-2 rounded-xl">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-white hover:shadow-sm rounded-lg"
                onClick={prevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs md:text-sm font-bold min-w-[120px] text-center uppercase tracking-widest text-slate-700">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 hover:bg-white hover:shadow-sm rounded-lg"
                onClick={nextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
                <div key={day} className="text-center text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest py-1 md:py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-4">
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square md:h-24 lg:h-32 rounded-lg md:rounded-xl bg-slate-50/50 border border-slate-50" />
              ))}
              {days.map(day => {
            const { confirmed, rejected, pending, total } = getDayStats(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasActivity = total > 0;
            
            return (
              <div 
                key={day.toISOString()} 
                className={`aspect-square md:h-24 lg:h-32 p-1 md:p-3 rounded-lg md:rounded-2xl border transition-all cursor-pointer relative flex flex-col group overflow-hidden ${
                  isSelected ? 'ring-2 ring-red-500 bg-red-50 shadow-lg border-red-200' :
                  hasActivity ? 'bg-red-50/40 border-red-100 hover:border-red-200 hover:bg-red-50' :
                  isToday ? 'border-red-300 bg-red-50/10' : 
                  'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setSelectedDay(day);
                  setSelectedRequest(null);
                }}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] md:text-xl font-black font-mono leading-none ${isToday ? 'text-red-600' : hasActivity ? 'text-red-400' : 'text-slate-400'}`}>
                    {format(day, "d")}
                  </span>
                  {total > 0 && (
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse hidden md:block shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-end gap-0.5 mt-auto">
                   {confirmed > 0 && (
                     <div className="flex items-center gap-1">
                       <div className="w-1 h-1 rounded-full bg-emerald-500" />
                       <span className="hidden md:inline text-[9px] font-black font-mono text-emerald-600">{confirmed} OK</span>
                     </div>
                   )}
                   {rejected > 0 && (
                     <div className="flex items-center gap-1">
                       <div className="w-1 h-1 rounded-full bg-red-500" />
                       <span className="hidden md:inline text-[9px] font-black font-mono text-red-600">{rejected} NO</span>
                     </div>
                   )}
                   {pending > 0 && (
                     <div className="flex items-center gap-1">
                       <div className="w-1 h-1 rounded-full bg-amber-500" />
                       <span className="hidden md:inline text-[9px] font-black font-mono text-amber-600 text-nowrap">{pending} PEN</span>
                     </div>
                   )}
                </div>

                {total > 0 && (
                  <Badge className="absolute top-0.5 right-0.5 md:hidden bg-red-600 text-[7px] h-3 px-0.5 border-none rounded-sm min-w-[10px] flex items-center justify-center">
                    {total}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
        </>
      ) : (
        <div className="space-y-4">
          <h3 className="font-black text-slate-800 text-lg uppercase">Todos los pedidos ({cookRequests.length})</h3>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-3 pr-4">
              {cookRequests.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(req => (
                 <div
                   key={req.id}
                   className="w-full flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group"
                 >
                   <div className="flex items-center gap-4 text-left min-w-0 flex-1">
                     <div className={`p-3 rounded-xl transition-all ${
                       req.status === 'confirmed' ? 'bg-white text-emerald-600 shadow-sm' :
                       req.status === 'rejected' ? 'bg-white text-red-600 shadow-sm' : 'bg-white text-amber-600 shadow-sm'
                     }`}>
                       {req.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
                        req.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <Clock4 className="w-5 h-5" />}
                     </div>
                     <div className="min-w-0">
                       <p className="font-black text-slate-800 text-sm md:text-base leading-tight">
                         Pedido #{req.id.slice(-4).toUpperCase()}
                       </p>
                       <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                         {format(new Date(req.timestamp), "dd/MM/yyyy HH:mm 'hs'")} • {req.items.length} Artículos
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 shrink-0">
                     {(req.status === 'rejected' || user.role === 'admin') && (
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg"
                         onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }}
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     )}
                   </div>
                 </div>
              ))}
              {cookRequests.length === 0 && (
                <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-50 rounded-[2rem]">
                  <Package className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-[10px] md:text-sm uppercase font-black tracking-widest">Sin actividad registrada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="border-none rounded-[2rem] shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-1rem)] md:max-w-2xl mx-auto bg-white">
          <DialogHeader className="bg-red-600 text-white p-6 md:p-8">
            <div className="flex items-center gap-3">
              {selectedRequest && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 rounded-xl text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => setSelectedRequest(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-xl md:text-2xl font-black tracking-tight truncate uppercase italic">
                  {selectedDay && format(selectedDay, "EEEE, dd 'de' MMMM", { locale: es })}
                </DialogTitle>
                <DialogDescription className="text-white/60 text-[8px] md:text-xs uppercase tracking-[0.2em] font-black mt-1">
                  {selectedRequest ? `Cocinero: ${selectedCook.name}` : `Actividad personal de ${selectedCook.firstName || selectedCook.name}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 md:p-8">
            {!selectedRequest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                  <StatItem label="OK" value={getDayStats(selectedDay || new Date()).confirmed} color="text-emerald-600" bg="bg-emerald-50" />
                  <StatItem label="PEN" value={getDayStats(selectedDay || new Date()).pending} color="text-amber-600" bg="bg-amber-50" />
                  <StatItem label="NO" value={getDayStats(selectedDay || new Date()).rejected} color="text-red-600" bg="bg-red-50" />
                </div>

                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Listado de Solicitudes</p>
                <ScrollArea className="h-[40vh] md:h-[350px] pr-2">
                  <div className="space-y-3">
                    {dayRequests.map(req => (
                      <div
                        key={req.id}
                        className="w-full flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-red-300 hover:shadow-xl hover:bg-white transition-all group"
                      >
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-4 text-left min-w-0 flex-1"
                        >
                          <div className={`p-3 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-all ${
                            req.status === 'confirmed' ? 'bg-white text-emerald-600 shadow-sm' :
                            req.status === 'rejected' ? 'bg-white text-red-600 shadow-sm' : 'bg-white text-amber-600 shadow-sm'
                          }`}>
                            {req.status === 'confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
                             req.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <Clock4 className="w-5 h-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 text-sm md:text-base leading-tight">
                              Pedido #{req.id.slice(-4).toUpperCase()}
                            </p>
                            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              {format(new Date(req.timestamp), "HH:mm 'hs'")} • {req.items.length} Artículos
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {(req.status === 'rejected' || user.role === 'admin') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg"
                              onClick={(e) => { e.stopPropagation(); handleDeleteRequest(req.id); }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <button onClick={() => setSelectedRequest(req)}>
                            <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-red-600 transition-colors" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {dayRequests.length === 0 && (
                      <div className="h-48 flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-50 rounded-[2rem]">
                        <Package className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-[10px] md:text-sm uppercase font-black tracking-widest">Sin actividad registrada este día</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                  <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/10 shadow-sm flex items-center justify-center border border-white/10">
                        <User className="w-6 h-6 text-white/50" />
                      </div>
                      <div>
                        <p className="font-black text-white text-base">
                          {selectedCook.firstName && selectedCook.lastName ? `${selectedCook.firstName} ${selectedCook.lastName}` : selectedCook.name}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{format(new Date(selectedRequest.timestamp), "HH:mm 'hs'")}</p>
                          {selectedRequest.isUrgent && (
                            <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase tracking-widest h-4">Urgente</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className={`rounded-xl h-8 uppercase text-[10px] font-black tracking-widest px-4 border-none shadow-sm ${
                      selectedRequest.status === 'confirmed' ? 'bg-emerald-500 text-white' :
                      selectedRequest.status === 'rejected' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {selectedRequest.status === 'confirmed' ? 'Aprobado' :
                       selectedRequest.status === 'rejected' ? 'Denegado' : 'Pendiente'}
                    </Badge>
                  </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Detalle del Pedido</p>
                  <ScrollArea className="h-[30vh] md:h-[280px] pr-2">
                    <div className="space-y-2">
                      {(editedItems || selectedRequest.items).map((item, idx) => (
                        <div key={idx} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-xl bg-red-50 text-red-500">
                              <Package className="w-5 h-5" />
                            </div>
                            <span className="text-sm md:text-base font-bold text-slate-700">{item.name}</span>
                          </div>
                          {user.role === 'admin' ? (
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateItemQty(idx, -1)}>
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className="text-base font-black text-slate-900 font-mono min-w-[2rem] text-center">{item.quantity}</span>
                              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateItemQty(idx, 1)}>
                                <Plus className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50 ml-1 rounded-lg" onClick={() => handleRemoveItem(idx)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-base md:text-xl font-black text-slate-900 font-mono bg-slate-50 px-3 py-1 rounded-lg">x{item.quantity}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {selectedRequest.note && (
                  <div className="p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-lg">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Nota Adjunta</p>
                    <p className="text-sm italic font-medium opacity-90 leading-relaxed text-slate-200">"{selectedRequest.note}"</p>
                  </div>
                )}

                {selectedRequest.signature && (
                  <div className="mt-4 px-1">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-red-500"></span> Registro de Firma
                    </p>
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-3 md:p-6 shadow-inner text-center">
                      <img src={selectedRequest.signature} alt="Firma de Verificación" className="max-h-32 md:max-h-48 mx-auto" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
            <Button 
               variant="ghost" 
               onClick={() => selectedRequest ? setSelectedRequest(null) : setSelectedDay(null)} 
               className="flex-1 rounded-[1.2rem] h-12 font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-100"
            >
              Cerrar
            </Button>
            {selectedRequest && user.role === 'admin' ? (
              <Button 
                onClick={handleSaveRequestEdits}
                disabled={isSaving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.2rem] h-12 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            ) : selectedRequest && (
              <Button 
                onClick={() => setSelectedRequest(null)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-[1.2rem] h-12 font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-red-500/20"
              >
                Volver
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="border-none rounded-3xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.8)] overflow-hidden max-w-sm bg-white">
          <DialogHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 shadow-inner text-center">
            <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-80" />
            <DialogTitle className="text-xl font-black tracking-tight drop-shadow-sm">¿Eliminar Registro?</DialogTitle>
            <DialogDescription className="text-red-100 text-xs font-bold uppercase tracking-widest leading-relaxed mt-2">
              Esta acción borrará permanentemente este pedido del historial.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 text-center text-sm font-medium text-slate-600">
            ¿Está seguro de que desea eliminar este pedido? No podrá recuperarlo.
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 sm:justify-center">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl font-bold uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-200">
              Cancelar
            </Button>
            {user.role !== "viewer" && (
              <Button 
                onClick={confirmDeleteRequest} 
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

function StatItem({ label, value, color, bg }: { label: string, value: number, color: string, bg: string }) {
  return (
    <div className={`p-3 md:p-4 ${bg} rounded-xl md:rounded-2xl border border-white/50 text-center`}>
      <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${color} mb-1`}>{label}</p>
      <p className={`text-base md:text-2xl font-black ${color} leading-none`}>{value}</p>
    </div>
  );
}
