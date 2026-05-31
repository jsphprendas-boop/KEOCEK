import React, { useState, useMemo } from "react";
import { DBData, Movement, User } from "../../types";
import { 
  Search, 
  Calendar, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Filter,
  Download,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  BoxSelect,
  Trash2
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
import { apiFetch } from "../../lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InventoryHistorySectionProps {
  user: User;
  data: DBData;
}

export default function InventoryHistorySection({ user, data }: InventoryHistorySectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = React.useDeferredValue(searchTerm);
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");
  const [locationFilter, setLocationFilter] = useState<"all" | "fuerza_publica" | "fronteras">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const itemsPerPage = 15;

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    // Evitar abrir detalle si hace click en el boton de borrar
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const archivedMovements = useMemo(() => {
    return (data.pastHistories || []).flatMap(h => h.movements || []);
  }, [data.pastHistories]);

  // Combine current movements with archived movements from pastHistories
  const allMovements = useMemo(() => {
    const current = data.movements || [];
    
    // Merge and sort by timestamp descending
    const combined = [...current, ...archivedMovements];
    return combined.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [data.movements, archivedMovements]);

  const filteredMovements = useMemo(() => {
    if (!allMovements?.length) return [];
    
    return allMovements.filter(m => {
      let matchesSearch = true;
      if (deferredSearchTerm) {
        const lowerSearch = deferredSearchTerm.toLowerCase();
        matchesSearch = 
          (m.productName || "").toLowerCase().includes(lowerSearch) ||
          (m.note || "").toLowerCase().includes(lowerSearch) ||
          (m.category || "").toLowerCase().includes(lowerSearch);
      }
      
      const matchesType = typeFilter === "all" || m.type === typeFilter;
      const matchesLocation = locationFilter === "all" || m.location === locationFilter;
      const matchesDate = !dateFilter || (m.timestamp && typeof m.timestamp === 'string' && m.timestamp.startsWith(dateFilter));

      return matchesSearch && matchesType && matchesLocation && matchesDate;
    });
  }, [allMovements, deferredSearchTerm, typeFilter, locationFilter, dateFilter]);

  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredMovements.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredMovements, currentPage]);

  const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);

  const handleExport = () => {
    const formattedData = filteredMovements.map(m => ({
      "Fecha": format(m.timestamp ? new Date(m.timestamp) : new Date(), "dd/MM/yyyy HH:mm"),
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
      "Fecha": format(m.timestamp ? new Date(m.timestamp) : new Date(), "dd/MM/yyyy HH:mm"),
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

  const handleDeleteMovement = async () => {
    if (!itemToDelete) return;

    try {
      await apiFetch(`/api/movements/${itemToDelete}`, { method: "DELETE" });
      toast.success("Registro histórico eliminado (sin afectar stock actual)");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar el registro");
    } finally {
      setItemToDelete(null);
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
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500"
                value={dateFilter}
                onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
              />
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
          <Table className="min-w-[800px]">
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
                  <React.Fragment key={movement.id}>
                    <TableRow 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={(e) => toggleExpand(movement.id, e)}
                    >
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">
                            {format(movement.timestamp ? new Date(movement.timestamp) : new Date(), "dd MMM yyyy", { locale: es })}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">
                            {format(movement.timestamp ? new Date(movement.timestamp) : new Date(), "HH:mm:ss")}
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
                          <p className="text-xs text-slate-600 leading-relaxed font-medium truncate">
                            {movement.note || "-- Sin observaciones --"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right">
                        {(user.role === "admin" || user.role === "master_admin") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemToDelete(movement.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRowId === movement.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-slate-50/50 p-4 border-t border-slate-100">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                             <p className="font-bold text-xs text-slate-500 uppercase tracking-wider">Detalles de Movimiento</p>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <p className="text-[10px] text-slate-400 font-bold uppercase">Nota</p>
                                   <p className="text-xs text-slate-700 font-medium">{movement.note || "Sin observaciones."}</p>
                                </div>
                                {/* No user property available in Movement type */}
                             </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar del historial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro únicamente del historial. <strong>El inventario actual (stock) no se modificará</strong>.
              El registro quedará de forma temporal en la papelera del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMovement}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
            >
              Borrar Registro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
