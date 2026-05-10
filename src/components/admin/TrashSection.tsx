import React, { useState, useMemo } from "react";
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Package, 
  ArrowRightLeft, 
  Clock, 
  ShoppingBag, 
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrashItem, DBData, User as UserType } from "../../types";
import { maskEmail } from "../../lib/helpers";

interface TrashSectionProps {
  user: UserType;
  data: DBData;
}

export default function TrashSection({ user, data }: TrashSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("product");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const trashItems = data.trash || [];

  const filteredTrash = useMemo(() => {
    return trashItems.filter(item => {
      const typeMatch = filterType === "all" || item.type === filterType;
      
      let nameToSearch = "";
      if (item.type === 'product') nameToSearch = item.data.name;
      else if (item.type === 'movement') nameToSearch = item.data.productName;
      else if (item.type === 'user') nameToSearch = item.data.name || item.data.email;
      else if (item.type === 'request') nameToSearch = item.data.userName;
      else if (item.type === 'gas') nameToSearch = `Gasto Gas: ${item.data.amount}L`;
      
      const searchMatch = !searchTerm || nameToSearch?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return typeMatch && searchMatch;
    }).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [trashItems, filterType, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredTrash.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTrash.map(i => i.id)));
    }
  };

  const handleRestore = async (ids?: string[]) => {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds })
      });
      
      if (!res.ok) throw new Error("Error al restaurar");
      
      toast.success(`${targetIds.length} elementos restaurados correctamente`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/trash/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Eliminado permanentemente");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEmptyTrash = async () => {
    try {
      const res = await fetch("/api/trash/empty", { method: "DELETE" });
      if (!res.ok) throw new Error("Error al vaciar papelera");
      toast.success("Papelera vaciada");
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'product': return <Package className="w-4 h-4" />;
      case 'movement': return <ArrowRightLeft className="w-4 h-4" />;
      case 'user': return <User className="w-4 h-4" />;
      case 'request': return <ShoppingBag className="w-4 h-4" />;
      case 'support': return <Zap className="w-4 h-4" />;
      case 'gas': return <FileText className="w-4 h-4" />;
      default: return <Trash2 className="w-4 h-4" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'product': return "Producto";
      case 'movement': return "Movimiento";
      case 'user': return "Usuario";
      case 'request': return "Pedido";
      case 'support': return "Soporte";
      case 'gas': return "Gasto Gas";
      default: return type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Papelera de Reciclaje</h2>
            <p className="text-sm text-slate-500 font-medium italic">Gestiona y restaura elementos eliminados</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {selectedIds.size > 0 && (
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold flex-1 md:flex-none"
              onClick={() => handleRestore()}
              disabled={isLoading}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Restaurar ({selectedIds.size})
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger 
              className={cn(
                buttonVariants({ variant: "outline" }),
                "border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold flex-1 md:flex-none h-10 px-4"
              )}
              disabled={trashItems.length === 0}
            >
              Vaciar Papelera
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-bold">¿Vaciar papelera permanentemente?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 font-medium">
                  Esta acción no se puede deshacer. Se eliminarán permanentemente todos los elementos actualmente en la papelera.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-2xl font-bold" onClick={handleEmptyTrash}>
                  Confirmar Eliminación Total
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <aside className="md:col-span-3 space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Nombre, ID..." 
                    className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-2xl text-sm" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Tipo de Elemento</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-2xl text-sm font-bold">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="product">Productos</SelectItem>
                    <SelectItem value="movement">Movimientos</SelectItem>
                    <SelectItem value="user">Usuarios</SelectItem>
                    <SelectItem value="request">Pedidos</SelectItem>
                    <SelectItem value="support">Soporte</SelectItem>
                    <SelectItem value="gas">Reportes Gas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="ghost" 
                className="w-full justify-start text-xs font-bold text-slate-400 hover:text-indigo-600 rounded-xl"
                onClick={selectAll}
              >
                {selectedIds.size === filteredTrash.length ? "Deseleccionar todos" : "Seleccionar todos filtrados"}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm bg-indigo-600 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-indigo-300" />
                <h4 className="font-black text-sm uppercase tracking-widest">Información</h4>
              </div>
              <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                Los elementos en la papelera pueden ser restaurados a su ubicación original conservando su información histórica. 
                <br /><br />
                <span className="font-black text-white">PROTECCIÓN DE INVENTARIO:</span> Al restaurar o eliminar un movimiento, el stock actual <span className="underline">no se ve afectado</span> para preservar el conteo establecido.
              </p>
            </CardContent>
          </Card>
        </aside>

        <main className="md:col-span-9">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
             <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                 {filteredTrash.length} Elementos encontrados
               </span>
               <div className="flex gap-2">
                 <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase">
                    <Clock className="w-3 h-3" /> Orden descendente
                 </div>
               </div>
             </div>

             <ScrollArea className="flex-1">
               <div className="p-4 space-y-3">
                 {filteredTrash.map(item => (
                   <div 
                      key={item.id} 
                      className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedIds.has(item.id) 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md'
                      }`}
                      onClick={() => toggleSelect(item.id)}
                   >
                     <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                       selectedIds.has(item.id) ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'
                     }`}>
                       {getTypeIcon(item.type)}
                     </div>

                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-0.5">
                         <span className="text-sm font-bold text-slate-900 truncate">
                            {item.type === 'product' ? item.data.name : 
                             item.type === 'movement' ? item.data.productName :
                             item.type === 'user' ? (item.data.name || maskEmail(item.data.email, user.email)) : 
                             item.type === 'request' ? `Pedido de ${item.data.userName}` :
                             item.type === 'support' ? `Soporte: ${item.data.userName}` : (item.id)}
                         </span>
                         <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0 border-slate-200 text-slate-400">
                           {getTypeName(item.type)}
                         </Badge>
                       </div>
                       <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 italic">
                         <span className="flex items-center gap-1">
                           <Calendar className="w-3 h-3" /> Eliminado el {format(new Date(item.deletedAt), "dd MMM, HH:mm", { locale: es })}
                         </span>
                         <span className="truncate">Ref: {item.data.id || (item.data.email ? maskEmail(item.data.email, user.email) : 'N/A')}</span>
                       </div>
                     </div>

                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl text-indigo-600 hover:bg-indigo-100"
                          onClick={(e) => { e.stopPropagation(); handleRestore([item.id]); }}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger 
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "h-9 w-9 rounded-xl text-red-500 hover:bg-red-50"
                            )}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <XCircle className="w-4 h-4" />
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-none">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-bold">¿Eliminar permanentemente?</AlertDialogTitle>
                              <AlertDialogDescription className="font-medium text-slate-500">
                                Esta acción es irreversible. Se borrarán todos los datos de este {getTypeName(item.type).toLowerCase()}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-2xl font-bold">No, mantener</AlertDialogCancel>
                              <AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-2xl font-bold" onClick={() => handlePermanentDelete(item.id)}>
                                Sí, eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                     </div>
                   </div>
                 ))}

                 {filteredTrash.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 text-center">
                     <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-10 h-10 text-slate-200" />
                     </div>
                     <h3 className="text-lg font-black text-slate-800 tracking-tight">Papelera limpia</h3>
                     <p className="text-sm text-slate-400 font-medium italic max-w-xs mx-auto mt-2">
                       No se encontraron elementos eliminados que coincidan con los filtros actuales.
                     </p>
                   </div>
                 )}
               </div>
             </ScrollArea>
          </div>
        </main>
      </div>
    </div>
  );
}
