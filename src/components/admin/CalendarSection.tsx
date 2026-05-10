import React, { useState, useMemo } from "react";
import { DBData, Movement, User } from "../../types";
import { 
  Calendar as CalendarIcon, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Clock,
  ArrowLeft,
  ChevronRight as ChevronRightIcon,
  Package,
  Layers,
  Search,
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";

interface CalendarSectionProps {
  user: User;
  data: DBData;
}

export default function CalendarSection({ user, data }: CalendarSectionProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const allMovements = useMemo(() => {
    const pastMoves = (data.pastHistories || []).flatMap(h => h.movements || []);
    return [...(data.movements || []), ...pastMoves];
  }, [data.movements, data.pastHistories]);

  const handleExportCalendar = () => {
    const monthKey = format(currentMonth, 'MM-yyyy');
    const filteredMovements = allMovements.filter(m => {
      const mDate = new Date(m.timestamp);
      return mDate.getMonth() === currentMonth.getMonth() && mDate.getFullYear() === currentMonth.getFullYear();
    });

    const formattedData = filteredMovements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(m => ({
      "Fecha": new Date(m.timestamp).toLocaleDateString(),
      "Hora": new Date(m.timestamp).toLocaleTimeString(),
      "Operación": m.type === "in" ? "Entrada (+)" : "Salida (-)",
      "Artículo": m.productName,
      "Cantidad": m.quantity,
      "Unidad": m.unit || "N/A",
      "Bloque": m.category || "N/A",
      "Nota": m.note || ""
    }));
    exportToExcel(formattedData, `Calendario_${monthKey}`);
  };

  const handleExportCalendarPDF = () => {
    const monthKey = format(currentMonth, 'MM-yyyy');
    const filteredMovements = allMovements.filter(m => {
      const mDate = new Date(m.timestamp);
      return mDate.getMonth() === currentMonth.getMonth() && mDate.getFullYear() === currentMonth.getFullYear();
    });

    const formattedData = filteredMovements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(m => ({
      "Fecha": new Date(m.timestamp).toLocaleDateString(),
      "Operación": m.type === "in" ? "IN" : "OUT",
      "Artículo": m.productName,
      "Cant.": m.quantity,
      "Unid.": m.unit || "uds",
      "Bloque": m.category || "-",
      "Nota": m.note || "-"
    }));
    exportToPDF(formattedData, `Calendario_${monthKey}`, `REPORTE MENSUAL: ${format(currentMonth, "MMMM yyyy", { locale: es }).toUpperCase()}`);
  };

  const getMovementsForDay = (day: Date) => {
    return allMovements.filter(m => isSameDay(new Date(m.timestamp), day));
  };

  const getDayStats = (day: Date) => {
    const movements = getMovementsForDay(day);
    const ins = movements.filter(m => m.type === 'in').reduce((acc, curr) => acc + curr.quantity, 0);
    const outs = movements.filter(m => m.type === 'out').reduce((acc, curr) => acc + curr.quantity, 0);
    return { ins, outs, count: movements.length };
  };

  const dayMovements = useMemo(() => {
    if (!selectedDay) return [];
    return allMovements.filter(m => isSameDay(new Date(m.timestamp), selectedDay));
  }, [allMovements, selectedDay]);

  const categoriesWithSpent = useMemo(() => {
    if (!dayMovements.length) return [];
    const spentOut = dayMovements.filter(m => m.type === 'out');
    const grouped: Record<string, { total: number; unit: string; products: Movement[] }> = {};
    
    spentOut.forEach(m => {
      // Find product to get its category if not present in movement
      // Actually movements have productCategory now (from server.ts update if implemented)
      // Let's assume we might need to find it from products list if not in movement
      const prod = data.products.find(p => p.id === m.productId);
      const cat = m.productCategory || prod?.category || "Sin Categoría";
      
      if (!grouped[cat]) {
        grouped[cat] = { total: 0, unit: m.unit || "uds", products: [] };
      }
      grouped[cat].total += m.quantity;
      grouped[cat].products.push(m);
    });
    
    return Object.entries(grouped).map(([name, info]) => ({
      name,
      ...info
    }));
  }, [dayMovements, data.products]);

  const filteredSpentProducts = useMemo(() => {
    if (!selectedCategory) return [];
    const catInfo = categoriesWithSpent.find(c => c.name === selectedCategory);
    return catInfo ? catInfo.products : [];
  }, [selectedCategory, categoriesWithSpent]);

  const handleDeleteMovement = async (id: string) => {
    try {
      const res = await fetch(`/api/movements/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Registro eliminado");
      }
    } catch (e) {
      toast.error("Error al eliminar registro");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-900 tracking-tight flex items-center gap-2">
            📅 Registro Histórico
            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 rounded-full font-mono text-[9px] uppercase tracking-widest px-2">
              Sincronizado
            </Badge>
          </h3>
          <p className="text-xs text-slate-500">Visualice el flujo diario de entradas y salidas de inventario</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {user.role === "admin" && (
            <div className="flex gap-2 w-full md:w-auto">
              <Button 
                 variant="outline" 
                 size="sm" 
                 className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex-1 md:flex-none"
                 onClick={handleExportCalendar}
              >
                 <Download className="w-3.5 h-3.5 mr-2" />
                 Excel
              </Button>
              <Button 
                 variant="outline" 
                 size="sm" 
                 className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-red-200 text-red-600 hover:bg-red-50 flex-1 md:flex-none"
                 onClick={handleExportCalendarPDF}
              >
                 <FileText className="w-3.5 h-3.5 mr-2" />
                 PDF
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full md:w-auto justify-between md:justify-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-white hover:shadow-sm rounded-lg"
            onClick={prevMonth}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs md:text-sm font-bold min-w-[120px] md:w-40 text-center uppercase tracking-widest text-slate-700">
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
      </div>
    </div>

      <div className="bg-white p-4 md:p-8 rounded-3xl border border-slate-200 shadow-xl">
        <div className="grid grid-cols-7 gap-1 md:gap-4 mb-4">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
            <div key={day} className="text-center text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-4">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square md:aspect-auto md:h-32 rounded-xl bg-slate-50/50 border border-slate-50" />
          ))}
          {days.map(day => {
            const { ins, outs, count } = getDayStats(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            
            return (
              <div 
                key={day.toISOString()} 
                className={`aspect-square md:aspect-auto md:h-32 p-1 md:p-3 rounded-xl md:rounded-2xl border transition-all cursor-pointer relative flex flex-col group overflow-hidden ${
                  isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 shadow-lg border-indigo-200' :
                  isToday ? 'border-indigo-300 bg-indigo-50/20' : 
                  'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setSelectedDay(day);
                  setSelectedCategory(null);
                }}
              >
                <div className="flex justify-between items-start mb-1 md:mb-2">
                  <span className={`text-xs md:text-xl font-black font-mono leading-none ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {format(day, "d")}
                  </span>
                  {count > 0 && (
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-500 animate-pulse hidden md:block" />
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-end gap-0.5 md:gap-1.5">
                  {ins > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-emerald-500" />
                      <span className="hidden md:inline text-[9px] font-black font-mono text-emerald-600">+{ins}</span>
                      <div className="md:hidden w-1 h-1 rounded-full bg-emerald-500" />
                    </div>
                  )}
                  {outs > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-red-500" />
                      <span className="hidden md:inline text-[9px] font-black font-mono text-red-600">-{outs}</span>
                      <div className="md:hidden w-1 h-1 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>

                {count > 0 && (
                  <Badge className="absolute top-1 right-1 md:hidden bg-indigo-600 text-[8px] h-3 px-1 border-none rounded-full min-w-[12px] flex items-center justify-center">
                    {count}
                  </Badge>
                )}

                <div className="hidden lg:block absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRightIcon className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-2xl bg-white">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <div className="flex items-center gap-3">
              {selectedCategory && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setSelectedCategory(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {selectedDay && format(selectedDay, "EEEE, dd 'de' MMMM", { locale: es })}
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs uppercase tracking-[0.2em] font-bold mt-1">
                  {selectedCategory ? `Bloque: ${selectedCategory}` : "Análisis de Gasto por Categoría"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6">
            {!selectedCategory ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Gasto Total Día</p>
                    <p className="text-2xl font-black text-indigo-900 leading-none">
                      {selectedDay && getDayStats(selectedDay).outs}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Ingresos Día</p>
                    <p className="text-2xl font-black text-emerald-900 leading-none">
                      {selectedDay && getDayStats(selectedDay).ins}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Bloques con Actividad de Gasto</p>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid grid-cols-1 gap-3">
                      {categoriesWithSpent.map(cat => (
                        <button
                          key={cat.name}
                          onClick={() => setSelectedCategory(cat.name)}
                          className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-slate-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-slate-800 uppercase tracking-tight">{cat.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{cat.products.length} Artículos diferentes</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-lg font-black text-indigo-600 tracking-tighter">-{cat.total}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase">{cat.unit}</p>
                            </div>
                            <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </button>
                      ))}
                      {categoriesWithSpent.length === 0 && (
                        <div className="h-60 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl opacity-50">
                          <Package className="w-10 h-10 mb-2" />
                          <p className="text-xs font-bold uppercase tracking-widest">Sin gastos registrados este día</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desglose de Artículos Gastados</p>
                  <Badge className="bg-indigo-100 text-indigo-700 border-none rounded-lg px-2 h-5 text-[10px] font-bold">
                    {filteredSpentProducts.length} Registros
                  </Badge>
                </div>
                
                <ScrollArea className="h-[450px] pr-4">
                  <div className="space-y-3">
                    {filteredSpentProducts.map((m, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-xl bg-white border border-slate-100 text-indigo-600">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{m.productName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] text-slate-400 font-medium">
                                {format(new Date(m.timestamp), "HH:mm 'hs'")}
                              </span>
                            </div>
                            {m.note && (
                              <p className="text-[10px] text-slate-500 mt-1 italic">
                                {m.note}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-base font-black text-red-600 tracking-tighter">-{m.quantity}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{m.unit}</p>
                          </div>
                          {user.role !== "viewer" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={() => handleDeleteMovement(m.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100">
            <Button variant="outline" onClick={() => setSelectedDay(null)} className="rounded-xl font-bold text-xs uppercase tracking-widest border-slate-200">
              Cerrar Detalle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
