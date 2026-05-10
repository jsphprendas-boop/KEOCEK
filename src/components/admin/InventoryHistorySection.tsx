import React, { useState, useMemo } from "react";
import { DBData, Movement, User } from "../../types";
import { 
  Search, 
  Calendar, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Filter,
  Download,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  BoxSelect
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { toast } from "sonner";

interface InventoryHistorySectionProps {
  user: User;
  data: DBData;
}

export default function InventoryHistorySection({ user, data }: InventoryHistorySectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "fuerza_publica" | "fronteras">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Combine current movements with archived movements from pastHistories
  const allMovements = useMemo(() => {
    const current = data.movements || [];
    const archived = (data.pastHistories || []).flatMap(h => h.movements || []);
    
    // Merge and sort by timestamp descending
    const combined = [...current, ...archived];
    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data.movements, data.pastHistories]);

  const filteredMovements = useMemo(() => {
    return allMovements.filter(m => {
      const matchesSearch = 
        m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.note || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.category || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      
      const matchesLocation = locationFilter === "all" || m.location === locationFilter;
      
      const matchesDate = !dateFilter || m.timestamp.startsWith(dateFilter);

      return matchesSearch && matchesType && matchesLocation && matchesDate;
    });
  }, [allMovements, searchTerm, typeFilter, locationFilter, dateFilter]);

  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMovements.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMovements, currentPage]);

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

  const deleteByDate = async () => {
    if (!dateFilter) {
      toast.error("Seleccione una fecha primero");
      return;
    }
    const confirmMsg = `¿Está seguro de eliminar TODOS los movimientos del día ${dateFilter}? Esta acción es irreversible (se borrará tanto el historial actual como el archivado de este día).`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/movements/date/${dateFilter}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Movimientos del día ${dateFilter} eliminados`);
      } else {
        toast.error("Error al eliminar movimientos");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const handleExport = () => {
    const formattedData = filteredMovements.map(m => ({
      "Fecha": format(new Date(m.timestamp), "dd/MM/yyyy HH:mm"),
      "Producto": m.productName,
      "Categoría": m.category || "N/A",
      "Tipo": m.type === "in" ? "ENTRADA" : "SALIDA",
      "Cantidad": m.quantity,
      "Unidad": m.unit,
      "Nota": m.note || "-"
    }));
    exportToExcel(formattedData, "Historial_Inventario");
    toast.success("Excel generado exitosamente");
  };

  const handleExportPDF = () => {
    const formattedData = filteredMovements.map(m => ({
      "Fecha": format(new Date(m.timestamp), "dd/MM/yyyy HH:mm"),
      "Artículo": m.productName,
      "Tipo": m.type === "in" ? "ENTRADA" : "SALIDA",
      "Cant.": m.quantity,
      "Unid.": m.unit,
      "Inventario": m.location === 'fronteras' ? 'Fronteras' : 'Fza Pública',
      "Nota": m.note || "-"
    }));
    exportToPDF(formattedData, "Historial_Inventario", "REPORTE HISTÓRICO DE MOVIMIENTOS");
    toast.success("PDF generado exitosamente");
  };

  const handleDeleteMovement = async (id: string, movement: Movement) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el registro de ${movement.productName}? Esta acción moverá el registro a la papelera.`)) return;
    try {
      const res = await fetch(`/api/movements/${id}`, { 
        method: "DELETE"
      });
      if (res.ok) {
        toast.success("Movimiento eliminado y enviado a papelera");
      } else {
        toast.error("Error al eliminar el movimiento");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };

  const clearMovements = async () => {
    if (!window.confirm("¿Estás seguro de que deseas vaciar el historial actual? (Esto no borrará el historial archivado)")) return;
    try {
      const res = await fetch("/api/movements", { method: "DELETE" });
      if (res.ok) {
        toast.success("Historial actual limpiado");
      }
    } catch (e) {
      toast.error("Error al limpiar historial");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Controls */}
      <Card className="border-none shadow-sm bg-white overflow-hidden rounded-2xl">
        <CardHeader className="bg-slate-900 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
                <Clock className="w-6 h-6 text-indigo-400" />
                Historial de Movimientos
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1 font-medium italic">
                Seguimiento detallado de entradas y salidas de inventario
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button 
                variant="outline" 
                onClick={handleExport}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportPDF}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
              {user.role === "admin" && (
                <Button 
                  variant="destructive" 
                  onClick={clearMovements}
                  className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Buscar producto, nota o categoría..." 
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
            
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input 
                type="date"
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500 pr-10"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              />
              {dateFilter && user.role === "admin" && (
                <button 
                  onClick={deleteByDate}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 transition-colors"
                  title="Eliminar todo lo de este día"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <Select value={typeFilter} onValueChange={(v: any) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="Tipo de Movimiento" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los movimientos</SelectItem>
                <SelectItem value="in">Entradas (Stock +)</SelectItem>
                <SelectItem value="out">Salidas (Stock -)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={(v: any) => { setLocationFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500">
                <div className="flex items-center gap-2">
                  <BoxSelect className="w-4 h-4 text-slate-400" />
                  <SelectValue placeholder="Inventario" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo los Inventarios</SelectItem>
                <SelectItem value="fuerza_publica">Fuerza Pública</SelectItem>
                <SelectItem value="fronteras">Fronteras</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200 shadow-xl overflow-hidden rounded-2xl bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest pl-6 py-4">Fecha y Hora</TableHead>
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest py-4">Producto</TableHead>
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest py-4">Tipo</TableHead>
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest py-4 text-center">Cantidad</TableHead>
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest py-4">Referencia / Nota</TableHead>
                <TableHead className="font-bold text-slate-600 uppercase text-[10px] tracking-widest py-4 text-right pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMovements.length > 0 ? (
                paginatedMovements.map((movement) => (
                  <TableRow key={movement.id} className="hover:bg-slate-50/80 transition-colors group">
                    <TableCell className="pl-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm">
                          {format(new Date(movement.timestamp), "dd MMM yyyy", { locale: es })}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {format(new Date(movement.timestamp), "HH:mm:ss")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                          {movement.productName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {movement.category || "General"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {movement.type === "in" ? (
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-emerald-50 text-emerald-600 border-none rounded-lg px-2 py-1 flex items-center gap-1 w-fit shadow-sm shadow-emerald-500/10">
                            <ArrowUpCircle className="w-3 h-3" />
                            <span className="text-[10px] font-black uppercase">Entrada</span>
                          </Badge>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter text-center">
                            {movement.location === 'fronteras' ? 'Fronteras' : 'Fza Pública'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-rose-50 text-rose-600 border-none rounded-lg px-2 py-1 flex items-center gap-1 w-fit shadow-sm shadow-rose-500/10">
                            <ArrowDownCircle className="w-3 h-3" />
                            <span className="text-[10px] font-black uppercase">Salida</span>
                          </Badge>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter text-center">
                            {movement.location === 'fronteras' ? 'Fronteras' : 'Fza Pública'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-base font-black font-mono ${movement.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {movement.type === 'in' ? '+' : '-'}{movement.quantity}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{movement.unit}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-start gap-2 max-w-xs md:max-w-md">
                        <FileText className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {movement.note || "-- Sin observaciones --"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      {user.role === "admin" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteMovement(movement.id, movement)}
                          className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Clock className="w-12 h-12 mb-4 opacity-10" />
                      <p className="font-bold uppercase tracking-widest text-xs opacity-40">No se encontraron movimientos registrados</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="rounded-xl h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="rounded-xl h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 border-none transition-transform hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-indigo-100 uppercase text-[10px] font-bold tracking-widest">Entradas del Periodo</CardDescription>
            <CardTitle className="text-3xl font-black">
              {filteredMovements.filter(m => m.type === 'in').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-indigo-200 mt-2">Movimientos de reabastecimiento registrados</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-950/20 border-none transition-transform hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400 uppercase text-[10px] font-bold tracking-widest">Salidas del Periodo</CardDescription>
            <CardTitle className="text-3xl font-black">
              {filteredMovements.filter(m => m.type === 'out').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mt-2">Movimientos de consumo procesados</p>
          </CardContent>
        </Card>

        <Card className="bg-white border border-slate-200 rounded-2xl shadow-sm transition-transform hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Total Histórico</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-900">
              {allMovements.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 mt-2">Registros totales en la base de datos (Incluye archivados)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
