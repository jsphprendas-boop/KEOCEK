import React from "react";
import { DBData, Request, User as UserType } from "../../types";
import { 
  Check, 
  X, 
  Clock, 
  ShoppingBag, 
  User, 
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ShieldAlert,
  PenTool,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { apiFetch } from "../../lib/api";
import { maskEmail } from "../../lib/helpers";

interface RequestSectionProps {
  user: UserType;
  data: DBData;
}

export default function RequestSection({ user, data }: RequestSectionProps) {
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = React.useState<Record<string, string>>({});
  
  // Advanced Filtering State
  const [filterSearch, setFilterSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<string>("all");
  const [filterUser, setFilterUser] = React.useState<string>("all");
  const [filterUrgent, setFilterUrgent] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);

  const [editingRequest, setEditingRequest] = React.useState<Request | null>(null);
  const [editedItems, setEditedItems] = React.useState<any[]>([]);
  const [itemSearchTerm, setItemSearchTerm] = React.useState("");

  const startEdit = (req: Request) => {
    setEditingRequest(req);
    setEditedItems([...req.items]);
  };

  const updateItemQty = (index: number, newQty: number) => {
    const qty = Math.max(0, Math.floor(newQty));
    setEditedItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: qty } : item).filter(item => item.quantity > 0));
  };

  const [pendingCurrentPage, setPendingCurrentPage] = React.useState(1);
  const pendingItemsPerPage = 10;
  
  const [pastCurrentPage, setPastCurrentPage] = React.useState(1);
  const pastItemsPerPage = 20;

  // reset pagination when filters change
  React.useEffect(() => {
    setPendingCurrentPage(1);
    setPastCurrentPage(1);
  }, [filterSearch, filterStatus, filterUser, filterUrgent]);

  const sortedPendingRequests = useMemo(() => {
    let filtered = data.requests.filter(r => r.status === "pending");
    
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      filtered = filtered.filter(r => 
        r.userName.toLowerCase().includes(search) || 
        r.items.some(item => item.name.toLowerCase().includes(search)) ||
        (r.note && r.note.toLowerCase().includes(search))
      );
    }
    
    if (filterUser !== "all") {
      filtered = filtered.filter(r => r.userId === filterUser);
    }
    
    if (filterUrgent) {
      filtered = filtered.filter(r => r.isUrgent);
    }

    return filtered.sort((a, b) => {
      // Prioritize urgent requests
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [data.requests, filterSearch, filterUser, filterUrgent]);

  const pendingRequests = useMemo(() => {
    const startIndex = (pendingCurrentPage - 1) * pendingItemsPerPage;
    return sortedPendingRequests.slice(startIndex, startIndex + pendingItemsPerPage);
  }, [sortedPendingRequests, pendingCurrentPage]);

  const pendingUsers = useMemo(() => 
    data.users.filter(u => !u.isApproved)
  , [data.users]);

  const isMasterAdmin = user.email === "jsphprendas@gmail.com";

  const { groupedPastRequests, totalPastRequests } = useMemo(() => {
    const currentPast = data.requests.filter(r => r.status !== "pending");
    const archivedPast = data.pastHistories?.flatMap(h => h.requests || []) || [];
    
    // Filter out requests that have already been archived
    const archivedIds = new Set(archivedPast.map(r => r.id));
    const uniqueCurrentPast = currentPast.filter(r => !archivedIds.has(r.id));
    
    let allPast = [...uniqueCurrentPast, ...archivedPast];

    // Apply filters
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      allPast = allPast.filter(r => 
        r.userName.toLowerCase().includes(search) || 
        r.items.some(item => item.name.toLowerCase().includes(search)) ||
        (r.note && r.note.toLowerCase().includes(search))
      );
    }
    
    if (filterStatus !== "all") {
      allPast = allPast.filter(r => r.status === filterStatus);
    }
    
    if (filterUser !== "all") {
      allPast = allPast.filter(r => r.userId === filterUser);
    }
    
    if (filterUrgent) {
      allPast = allPast.filter(r => r.isUrgent);
    }

    allPast = allPast.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const total = allPast.length;
    
    const startIndex = (pastCurrentPage - 1) * pastItemsPerPage;
    const paginatedPast = allPast.slice(startIndex, startIndex + pastItemsPerPage);

    const groups: Record<string, Request[]> = {};
    paginatedPast.forEach(req => {
      const dateKey = format(new Date(req.timestamp), "yyyy-MM-dd");
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(req);
    });
    
    return { groupedPastRequests: groups, totalPastRequests: total };
  }, [data.requests, data.pastHistories, filterSearch, filterStatus, filterUser, filterUrgent, pastCurrentPage]);

  const cooks = useMemo(() => {
    const list = data.users.filter(u => u.role !== "viewer");
    return list;
  }, [data.users]);

  const availableProducts = useMemo(() => {
    if (!itemSearchTerm) return [];
    return data.products.filter(p => 
      p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) &&
      !editedItems.some(ei => ei.productId === p.id)
    ).slice(0, 5);
  }, [data.products, itemSearchTerm, editedItems]);

  const addItemToEdit = (product: any) => {
    setEditedItems(prev => [...prev, { productId: product.id, name: product.name, quantity: 1 }]);
    setItemSearchTerm("");
  };

  const removeItemFromEdit = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const handleAction = async (id: string, action: 'confirm' | 'reject', modifiedItems?: any[]) => {
    try {
      if (action === 'confirm' && modifiedItems) {
        // Save modifications first
        await apiFetch(`/api/requests/${id}`, { 
          method: "PUT",
          body: JSON.stringify({ items: modifiedItems }) 
        });
      }
      
      await apiFetch(`/api/requests/${id}/${action}`, { method: "POST" });
      toast.success(action === 'confirm' ? "Pedido confirmado y stock retirado" : "Pedido rechazado");
    } catch (e: any) {
      toast.error(e.message || "Error al procesar acción");
    }
  };

  const handleDeletePastRequest = async (id: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro histórico?")) return;
    try {
      await apiFetch(`/api/history/requests/${id}`, { method: "DELETE" });
      toast.success("Registro eliminado exitosamente");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  const handleUserAction = async (id: string, action: 'approve' | 'reject') => {
    const role = selectedRoles[id] || "cook";
    try {
      await apiFetch(`/api/users/${id}/${action}`, { 
        method: "POST",
        body: JSON.stringify({ role })
      });
      toast.success(action === 'approve' ? `Usuario aprobado como ${role === "cook" ? "Cocinero" : role === "admin" ? "Administrador" : "Gestión"}` : "Registro denegado");
    } catch (e: any) {
      toast.error(e.message || "Error al procesar usuario");
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Pending Requests Column */}
      <div className="col-span-12 xl:col-span-7 space-y-4 md:space-y-8">
        {/* User Approvals Section */}
        {pendingUsers.length > 0 && isMasterAdmin && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-lg shadow-amber-50 overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-500">
            <div className="p-3 md:p-4 border-b border-amber-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
                <h3 className="font-black text-amber-900 uppercase tracking-tight text-xs md:text-sm">Nuevos Registros</h3>
              </div>
              <Badge className="bg-amber-600 text-white border-none rounded-full px-2 md:px-3 h-4 md:h-5 text-[8px] md:text-[10px] font-black tracking-widest">
                {pendingUsers.length}
              </Badge>
            </div>
            <div className="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {pendingUsers.map(userItem => (
                <div key={userItem.id} className="p-3 md:p-4 bg-white border border-amber-100 rounded-xl shadow-sm flex flex-col justify-between group hover:border-amber-400 transition-all">
                  <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm md:text-lg shrink-0">
                      {userItem.name?.charAt(0) || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate text-xs md:text-sm">{userItem.name || "Usuario"}</p>
                      <p className="text-[8px] md:text-[10px] text-slate-400 font-bold truncate tracking-widest uppercase">{maskEmail(userItem.email, user.email)}</p>
                      
                      <div className="mt-3">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest block mb-1">Perfil Asignado</label>
                        <select 
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-[10px] font-bold focus:ring-amber-500 appearance-none cursor-pointer text-slate-900 dark:text-slate-100"
                          value={selectedRoles[userItem.id] || "cook"}
                          onChange={(e) => setSelectedRoles(prev => ({ ...prev, [userItem.id]: e.target.value }))}
                        >
                          <option value="cook">Cocinero</option>
                          <option value="admin">Administrador</option>
                          <option value="viewer">Usuario Gestión</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      className="flex-1 bg-amber-600 text-white hover:bg-amber-700 h-8 md:h-9 rounded-lg font-bold text-[9px] md:text-[10px] uppercase tracking-widest"
                      onClick={() => handleUserAction(userItem.id, 'approve')}
                    >
                      Aprobar
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50 h-8 md:h-9 rounded-lg font-bold text-[9px] md:text-[10px] uppercase tracking-widest"
                      onClick={() => handleUserAction(userItem.id, 'reject')}
                    >
                      Denegar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col gap-4 bg-indigo-900 text-white">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                <h3 className="font-bold tracking-tight text-sm md:text-base">Tareas de Confirmación</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                   variant="ghost" 
                   size="sm" 
                   className={`h-8 px-2 rounded-lg text-xs font-bold ${showFilters ? 'bg-indigo-700 text-white' : 'text-indigo-300'}`}
                   onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-3.5 h-3.5 mr-2" /> Filtros
                </Button>
                <Badge className="bg-indigo-800 text-indigo-100 border-none rounded-full px-2 md:px-3 py-1 text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-nowrap">
                  {pendingRequests.length} Pendientes
                </Badge>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-2 duration-300 bg-indigo-950/50 p-4 rounded-2xl border border-indigo-800/50 shadow-inner">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Búsqueda rápida</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400" />
                    <Input 
                      className="h-8 pl-9 bg-indigo-900/50 border-indigo-800 text-xs placeholder:text-indigo-400 focus-visible:ring-indigo-500 text-white" 
                      placeholder="Artículo, nota..."
                      value={filterSearch}
                      onChange={e => setFilterSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Estado</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-8 bg-indigo-900/50 border-indigo-800 text-xs">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Cualquier Estado</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="confirmed">Confirmados</SelectItem>
                      <SelectItem value="rejected">Rechazados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Solicitante</label>
                  <Select value={filterUser} onValueChange={setFilterUser}>
                    <SelectTrigger className="h-8 bg-indigo-900/50 border-indigo-800 text-xs">
                      <SelectValue placeholder="Usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Cocineros</SelectItem>
                      {cooks.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end pb-0.5">
                  <Button 
                    variant="ghost" 
                    className={`h-8 w-full border ${filterUrgent ? 'bg-red-600 border-red-500 text-white' : 'bg-indigo-900/50 border-indigo-800 text-indigo-300'} text-xs font-bold rounded-lg transition-all`}
                    onClick={() => setFilterUrgent(!filterUrgent)}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 mr-2" /> Solo Urgentes
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <ScrollArea className="flex-1 min-h-[400px] md:min-h-[600px]">
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              {pendingRequests.map(req => (
                <Card key={req.id} className="border border-slate-200 rounded-xl md:rounded-2xl shadow-sm bg-slate-50/50 hover:border-indigo-200 transition-all group">
                   <CardHeader className="p-4 md:p-5 pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] md:text-[9px] uppercase font-bold tracking-widest border-indigo-200 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            #{req.id.substring(0, 4)}
                          </Badge>
                          <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">• {Math.floor((new Date().getTime() - new Date(req.timestamp).getTime()) / 60000)}m</span>
                          {req.isUrgent && (
                            <Badge className="bg-red-600 text-white border-none text-[8px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full animate-pulse">
                               Urgente
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-100 whitespace-nowrap">
                          <User className="w-2.5 h-2.5 md:w-3 md:h-3" /> {req.userName}
                        </div>
                      </div>
                      <CardTitle className="text-sm md:text-base font-bold text-slate-800 mt-2">Requerimiento de Cocina</CardTitle>
                   </CardHeader>
                   <CardContent className="p-4 md:p-5 pt-3 md:pt-4 space-y-3 md:space-y-4">
                      {editingRequest?.id === req.id ? (
                        <div className="grid grid-cols-1 gap-3">
                           <div className="flex items-center justify-between gap-3 bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                             <div className="flex items-center gap-2">
                               <ShieldAlert className={`w-4 h-4 ${editingRequest.isUrgent ? 'text-red-500' : 'text-slate-300'}`} />
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Estado de Urgencia</span>
                             </div>
                             <div 
                               className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${editingRequest.isUrgent ? 'bg-red-600' : 'bg-slate-300'}`}
                               onClick={() => setEditingRequest({...editingRequest, isUrgent: !editingRequest.isUrgent})}
                             >
                               <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingRequest.isUrgent ? 'right-1' : 'left-1'}`} />
                             </div>
                           </div>

                           <div className="space-y-2">
                             <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-1">Artículos en Pedido</p>
                             {editedItems.map((item, idx) => (
                               <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-indigo-100 rounded-xl shadow-sm">
                                 <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{item.name}</span>
                                 <div className="flex items-center gap-3">
                                   <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white shrink-0" onClick={() => updateItemQty(idx, item.quantity - 1)}>-</Button>
                                      <span className="text-xs font-mono font-bold text-indigo-600 px-1 min-w-[1.5rem] text-center">{item.quantity}</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-white shrink-0" onClick={() => updateItemQty(idx, item.quantity + 1)}>+</Button>
                                   </div>
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 rounded-lg shrink-0" onClick={() => removeItemFromEdit(idx)}>
                                     <Trash2 className="w-3.5 h-3.5" />
                                   </Button>
                                 </div>
                               </div>
                             ))}
                           </div>

                           <div className="pt-2 border-t border-slate-100 space-y-2">
                             <div className="relative">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                               <Input 
                                 placeholder="Agregar más artículos..." 
                                 className="h-9 pl-9 border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder:text-slate-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                 value={itemSearchTerm}
                                 onChange={e => setItemSearchTerm(e.target.value)}
                               />
                             </div>
                             {availableProducts.length > 0 && (
                               <div className="bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                 {availableProducts.map(p => (
                                   <button 
                                     key={p.id}
                                     onClick={() => addItemToEdit(p)}
                                     className="w-full p-2 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-0 flex items-center justify-between"
                                   >
                                     <span className="text-xs font-medium text-slate-700">{p.name}</span>
                                     <Plus className="w-3 h-3 text-indigo-500" />
                                   </button>
                                 ))}
                               </div>
                             )}
                           </div>

                           <div className="flex gap-2 mt-4">
                             <Button 
                               className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]" 
                               onClick={() => { handleAction(req.id, 'confirm', editedItems); setEditingRequest(null); }}
                             >Confirmar Cambios</Button>
                             <Button 
                               variant="outline" 
                               className="flex-1 border-slate-200 text-slate-500 h-10 rounded-xl font-bold uppercase tracking-widest text-[10px]" 
                               onClick={() => setEditingRequest(null)}
                             >Cancelar</Button>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {req.items.map((item, idx) => {
                              const product = data.products.find(p => p.id === item.productId);
                              const currentStock = product ? parseFloat(product.quantity) : 0;
                              const requestedQty = parseFloat(String(item.quantity));
                              const isOverStock = requestedQty > currentStock;

                              return (
                                <div key={idx} className={`flex items-center justify-between p-2.5 md:p-3 bg-white border ${isOverStock ? 'border-red-300 bg-red-50' : 'border-slate-100'} rounded-lg md:rounded-xl group-hover:border-indigo-100 transition-all`}>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-slate-700 truncate">{item.name}</p>
                                      <Badge variant="outline" className="text-[7px] font-black uppercase text-slate-400 border-slate-200 px-1 py-0 h-3">
                                        {product?.location === 'fronteras' ? 'Fronteras' : 'Fza Pública'}
                                      </Badge>
                                    </div>
                                    {isOverStock && (
                                      <p className="text-[8px] text-red-600 font-bold uppercase mt-0.5">Stock insuficiente: {currentStock} disp.</p>
                                    )}
                                  </div>
                                  <Badge className={`${isOverStock ? 'bg-red-600' : 'bg-indigo-600'} text-white border-none rounded-lg font-mono text-[10px] md:text-sm px-1.5 md:px-2 shrink-0 ml-2`}>
                                    {item.quantity}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                          {req.note && (
                            <div className="flex gap-2 p-2.5 md:p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/30">
                              <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400 shrink-0 mt-0.5" />
                              <p className="text-[10px] md:text-xs text-slate-900 dark:text-slate-100 leading-relaxed italic">"{req.note}"</p>
                            </div>
                          )}
                          <Button variant="outline" className="w-full text-xs mt-2" onClick={() => startEdit(req)}>Editar Solicitud</Button>
                        </>
                      )}
                      
                      {req.signature && (
                        <div className="mt-4 p-4 bg-white border border-indigo-200 rounded-2xl shadow-inner">
                          <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <PenTool className="w-4 h-4" /> Firma de Validación
                          </p>
                          <img src={req.signature} alt="Firma del Cocinero" className="max-h-24 w-full object-contain" />
                        </div>
                      )}
                   </CardContent>
                   {user.role !== "viewer" && (
                     <CardFooter className="p-4 md:p-5 pt-0 flex flex-col sm:flex-row gap-2 md:gap-3">
                        <Button 
                          className="w-full sm:flex-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold h-10 md:h-11 transition-all shadow-lg shadow-indigo-500/20 text-xs"
                          onClick={() => handleAction(req.id, 'confirm')}
                        >
                          <Check className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Confirmar
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full sm:flex-1 border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-xl font-bold h-10 md:h-11 transition-all text-xs"
                          onClick={() => handleAction(req.id, 'reject')}
                        >
                          <X className="w-3.5 h-3.5 md:w-4 md:h-4 mr-2" /> Rechazar
                        </Button>
                     </CardFooter>
                   )}
                </Card>
              ))}
              {pendingRequests.length === 0 && (
                <div className="h-40 md:h-80 flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-30">
                   <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                     <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                   </div>
                   <p className="text-xs md:text-sm font-bold uppercase tracking-widest leading-none">Todo en Orden</p>
                </div>
              )}
              
              {sortedPendingRequests.length > pendingItemsPerPage && (
                <div className="flex justify-center mt-4 pb-2">
                  <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <Button variant="ghost" size="sm" onClick={() => setPendingCurrentPage(prev => Math.max(1, prev - 1))} disabled={pendingCurrentPage === 1}>Anterior</Button>
                    <div className="text-xs font-bold px-2">{pendingCurrentPage} / {Math.ceil(sortedPendingRequests.length / pendingItemsPerPage)}</div>
                    <Button variant="ghost" size="sm" onClick={() => setPendingCurrentPage(prev => Math.min(Math.ceil(sortedPendingRequests.length / pendingItemsPerPage), prev + 1))} disabled={pendingCurrentPage >= Math.ceil(sortedPendingRequests.length / pendingItemsPerPage)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* History Column */}
      <div className="col-span-12 xl:col-span-5 space-y-4 md:space-y-6">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full min-h-[400px] md:min-h-[600px] overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
              <h3 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight">Registro de Solicitudes</h3>
            </div>
            <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hoy</span>
          </div>

          <ScrollArea className="flex-1">
             <div className="p-3 md:p-4 space-y-2 md:space-y-4">
                {Object.keys(groupedPastRequests).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map(dateKey => (
                  <div key={dateKey} className="border border-slate-100 rounded-xl md:rounded-2xl overflow-hidden bg-white">
                    <button 
                      onClick={() => toggleDate(dateKey)}
                      className="w-full p-3 md:p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-widest">
                        {format(new Date(dateKey), "d 'de' MMMM", { locale: es })}
                      </span>
                      {expandedDates.has(dateKey) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </button>
                    {expandedDates.has(dateKey) && (
                      <div className="p-2 pt-0 space-y-2">
                        {groupedPastRequests[dateKey].map(req => (
                          <div key={req.id} className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className={`p-2 md:p-2.5 rounded-lg md:rounded-xl relative ${
                                req.status === 'confirmed' ? 'bg-white text-emerald-600 shadow-sm' : 'bg-white text-red-600 shadow-sm'
                              }`}>
                                {req.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : <X className="w-4 h-4 md:w-5 md:h-5" />}
                                {req.isUrgent && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white animate-pulse" />}
                              </div>
                              <div>
                                <p className="text-[10px] md:text-xs font-bold text-slate-800 flex items-center gap-2">
                                   {req.status === 'confirmed' ? 'Aceptado' : 'Rechazado'}
                                   {req.isUrgent && <span className="text-[7px] bg-red-100 text-red-600 px-1 rounded-sm font-black uppercase">URG</span>}
                                </p>
                                <p className="text-[8px] md:text-[10px] text-slate-400 font-medium">
                                   {req.userName} • {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-white border-none rounded-lg text-[8px] md:text-[10px] font-bold text-slate-500">
                                 {req.items.length} Art.
                              </Badge>
                              {user.role === 'admin' && (
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePastRequest(req.id)} className="h-6 w-6 md:h-7 md:w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md">
                                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(groupedPastRequests).length === 0 && (
                  <div className="py-10 md:py-20 text-center opacity-20">
                    <AlertCircle className="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2" />
                    <p className="text-[10px] md:text-xs font-bold uppercase">Sin historial</p>
                  </div>
                )}
                
                {totalPastRequests > pastItemsPerPage && (
                  <div className="flex justify-center mt-4 mb-2">
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                      <Button variant="ghost" size="sm" onClick={() => setPastCurrentPage(prev => Math.max(1, prev - 1))} disabled={pastCurrentPage === 1}>Anterior</Button>
                      <div className="text-xs font-bold px-2">{pastCurrentPage} / {Math.ceil(totalPastRequests / pastItemsPerPage)}</div>
                      <Button variant="ghost" size="sm" onClick={() => setPastCurrentPage(prev => Math.min(Math.ceil(totalPastRequests / pastItemsPerPage), prev + 1))} disabled={pastCurrentPage >= Math.ceil(totalPastRequests / pastItemsPerPage)}>Siguiente</Button>
                    </div>
                  </div>
                )}
             </div>
          </ScrollArea>
        </section>
      </div>
    </div>

  );
}
