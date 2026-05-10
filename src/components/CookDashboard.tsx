import React, { useState, useMemo, useRef, useEffect } from "react";
import { User, DBData, Product, Request } from "../types";
import SignatureCanvas from "react-signature-canvas";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { 
  ShoppingBag, 
  History, 
  LogOut, 
  Search, 
  Send,
  CookingPot,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  PenTool,
  Eraser,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Fuel,
  Sun,
  Moon,
  BoxSelect,
  TrendingUp,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeToggle } from "./ThemeToggle";
import { safeFormat } from "../lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

import { apiFetch } from "../lib/api";

interface CookDashboardProps {
  user: User;
  data: DBData;
  onLogout: () => void;
  delegationId: string;
  onRefresh?: () => void;
  notificationHistory: {message: string, type?: string, timestamp: number}[];
}

const RequestCard = React.memo(({ req }: { req: any }) => (
  <Card className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden bg-white">
    <div className="grid grid-cols-1 md:grid-cols-12 shrink-0">
        <div className="md:col-span-4 bg-slate-50/50 p-4 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400 font-mono tracking-widest">{String(req.id).substring(0,8)}</span>
                  <Badge className={`uppercase text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full ${
                    req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    req.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {req.status === 'pending' ? 'Pendiente' : 
                      req.status === 'confirmed' ? 'Confirmado' : 'Rechazado'}
                  </Badge>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold">{safeFormat(req.timestamp, "HH:mm")}</span>
              </div>
              {req.isUrgent && (
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 animate-pulse transition-all">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Urgente</span>
                </div>
              )}
        </div>
        <div className="md:col-span-8 p-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Artículos</p>
          <div className="flex flex-wrap gap-2 mb-3">
              {Array.isArray(req.items) && req.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                    <span className="text-xs font-bold text-slate-700">{item.name}</span>
                    <span className="text-xs font-black font-mono text-indigo-600">x{item.quantity}</span>
                </div>
              ))}
          </div>
          {req.note && (
            <div className="pt-3 border-t border-slate-100 flex gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-slate-300 mt-0.5" />
                <p className="text-xs text-slate-500 italic">"{req.note}"</p>
            </div>
          )}
        </div>
    </div>
  </Card>
));

export default React.memo(function CookDashboard({ user, data, onLogout, delegationId, onRefresh, notificationHistory }: CookDashboardProps) {
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [note, setNote] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [view, setView] = useState<'request' | 'history'>('request');
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isGasDialogOpen, setIsGasDialogOpen] = useState(false);
  const [gasAmount, setGasAmount] = useState("");
  const [gasNote, setGasNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingGas, setIsSubmittingGas] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const sigPad = useRef<SignatureCanvas>(null);

  const submitGasReport = async () => {
    if (!gasAmount) return;
    setIsSubmittingGas(true);
    try {
      await apiFetch("/api/gas-reports", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          amount: parseFloat(gasAmount),
          note: gasNote
        })
      });
      toast.success("Reporte de gas enviado");
      setIsGasDialogOpen(false);
      setGasAmount("");
      setGasNote("");
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al enviar reporte");
    } finally {
      setIsSubmittingGas(false);
    }
  };

  const [selectedLocation, setSelectedLocation] = useState<'fuerza_publica' | 'fronteras'>('fuerza_publica');

  const visibleLocations = useMemo(() => {
    const visibility = data.settings?.locationVisibility || { fuerza_publica: true, fronteras: true };
    const locations: ('fuerza_publica' | 'fronteras')[] = [];
    if (visibility.fuerza_publica !== false) locations.push('fuerza_publica');
    if (visibility.fronteras !== false) locations.push('fronteras');
    return locations;
  }, [data.settings]);

  useEffect(() => {
    if (visibleLocations.length > 0 && !visibleLocations.includes(selectedLocation)) {
      setSelectedLocation(visibleLocations[0]);
    }
  }, [visibleLocations, selectedLocation]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    return (data.categories || []).filter(c => (c.location || 'fuerza_publica') === selectedLocation);
  }, [data.categories, selectedLocation]);

  const filteredProducts = useMemo(() => {
    if (!data.products) return [];
    let prods = data.products.filter(p => !p.isHidden && (p.location || 'fuerza_publica') === selectedLocation);
    if (selectedCategory) {
      prods = prods.filter(p => p.category === selectedCategory);
    }
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return prods;
    
    return prods.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.category.toLowerCase().includes(searchLower)
    );
  }, [data.products, searchTerm, selectedCategory, selectedLocation]);

  const addToCart = (product: Product) => {
    const isExisting = cart.find(item => item.productId === product.id);
    const currentQtyInCart = isExisting ? isExisting.quantity : 0;

    const stockNum = parseFloat(product.quantity);
    if (currentQtyInCart >= stockNum) {
      toast.error(`No se puede pedir más de ${product.name}. Solo hay ${product.quantity} ${product.unit} en stock.`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.productId !== id));
  };

  const submitRequest = async () => {
    if (cart.length === 0) return;
    
    // Si no hay firma abierta, la abrimos primero
    if (!isSignatureOpen) {
      setIsSignatureOpen(true);
      return;
    }

    if (sigPad.current?.isEmpty()) {
      toast.error("Debe firmar para validar el pedido");
      return;
    }

    setIsSubmitting(true);
    const signature = sigPad.current?.getTrimmedCanvas().toDataURL("image/png");

    try {
      await apiFetch("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          userId: user.id,
          userName: user.name,
          items: cart,
          note,
          isUrgent,
          signature
        })
      });
      
      toast.success("Pedido enviado a administración");
      setCart([]);
      setNote("");
      setIsUrgent(false);
      setIsSignatureOpen(false);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al enviar pedido");
    } finally {
      setIsSubmitting(false);
    }
  };

  const safeFormat = (date: Date | number | string, formatStr: string) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "Fecha Inválida";
      return format(d, formatStr, { locale: es });
    } catch (e) {
      return "F-Error";
    }
  };

  const pastUserRequests = useMemo(() => {
    if (!data.pastHistories || !Array.isArray(data.pastHistories)) return [];
    
    const allPast: Request[] = [];
    const userId = user.id;
    const userEmail = String(user.email || "").toLowerCase().trim();
    const userNameLower = String(user.name || "").toLowerCase().trim();
    
    // Performance optimization: limit history scan or use a more efficient filter
    // Only search in the last few histories if needed, or keep the full scan but optimized
    for (const history of data.pastHistories) {
      const hReqs = history.requests;
      if (Array.isArray(hReqs)) {
        for (const req of hReqs) {
          if (!req?.id) continue;
          
          const reqNameLower = String(req.userName || "").toLowerCase().trim();
          const reqEmail = String((req as any).userEmail || "").toLowerCase().trim();
          
          const matchesId = Boolean(userId && req.userId === userId);
          const matchesEmail = Boolean(userEmail && reqEmail && reqEmail === userEmail);
          
          let matchesName = false;
          if (userNameLower && reqNameLower) {
             matchesName = reqNameLower.includes(userNameLower) || userNameLower.includes(reqNameLower);
          }

          if (matchesId || matchesEmail || matchesName) {
            allPast.push(req);
          }
        }
      }
    }
    return allPast;
  }, [data.pastHistories, user.id, user.email, user.name]);

  const userRequests = useMemo(() => {
    const userId = user.id;
    const userEmail = String(user.email || "").toLowerCase().trim();
    const userNameLower = String(user.name || "").toLowerCase().trim();
    
    const currentRequests = (data.requests || []).filter(req => {
      if (!req?.id) return false;
      const reqNameLower = String(req.userName || "").toLowerCase().trim();
      const reqEmail = String((req as any).userEmail || "").toLowerCase().trim();
      
      const matchesId = Boolean(userId && req.userId === userId);
      const matchesEmail = Boolean(userEmail && reqEmail && reqEmail === userEmail);
      
      let matchesName = false;
      if (userNameLower && reqNameLower) {
         matchesName = reqNameLower.includes(userNameLower) || userNameLower.includes(reqNameLower);
      }
      
      return matchesId || matchesEmail || matchesName;
    });
    
    return [...currentRequests, ...pastUserRequests].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [data.requests, pastUserRequests, user.id, user.email, user.name]);

  // Pre-calculate requests by date for O(1) day lookups
  const requestsByDateMap = useMemo(() => {
    const map: Record<string, Request[]> = {};
    for (let i = 0; i < userRequests.length; i++) {
      const req = userRequests[i];
      if (!req.timestamp) continue;
      try {
        const d = new Date(req.timestamp);
        if (isNaN(d.getTime())) continue;
        const dateKey = format(d, "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(req);
      } catch (e) {
        // Skip invalid dates
      }
    }
    return map;
  }, [userRequests]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    return eachDayOfInterval({ 
      start: startOfMonth(currentMonth), 
      end: endOfMonth(currentMonth) 
    });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));

  const getRequestsForDay = (day: Date) => {
    if (!day) return [];
    try {
      const dateKey = format(day, "yyyy-MM-dd");
      return requestsByDateMap[dateKey] || [];
    } catch (e) {
      return [];
    }
  };

  const dayStats = useMemo(() => {
    const stats: Record<string, { confirmed: number; rejected: number; pending: number; total: number }> = {};
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dateKey = format(day, "yyyy-MM-dd");
      const dayReqs = requestsByDateMap[dateKey] || [];
      if (dayReqs.length > 0) {
        let confirmed = 0, rejected = 0, pending = 0;
        for (let j = 0; j < dayReqs.length; j++) {
          const s = dayReqs[j].status;
          if (s === 'confirmed') confirmed++;
          else if (s === 'rejected') rejected++;
          else if (s === 'pending') pending++;
        }
        stats[dateKey] = { confirmed, rejected, pending, total: dayReqs.length };
      }
    }
    return stats;
  }, [days, requestsByDateMap]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300">
      {/* Header */}
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none"
          >
            <CookingPot className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </motion.div>
          <div className="hidden xs:block">
            <h1 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase italic">Terminal Cocina</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] leading-none mt-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Sincronizado V5.0
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 md:h-11 px-3 md:px-5 text-[10px] md:text-xs font-black uppercase text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-900 dark:hover:bg-orange-950 transition-all flex items-center gap-2 shadow-sm"
            onClick={() => setIsGasDialogOpen(true)}
          >
            <Fuel className="w-4 h-4" /> 
            <span className="hidden sm:inline">Reportar Gas</span>
            <span className="sm:hidden">Gas</span>
          </Button>
          
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 shadow-inner">
            <Button 
              variant="ghost" 
              className={`rounded-xl h-10 md:h-11 px-3 md:px-6 text-[10px] md:text-xs font-black transition-all ${view === 'request' ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 border border-slate-200/50 dark:border-slate-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              onClick={() => setView('request')}
            >
              <ShoppingBag className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline uppercase tracking-widest">Catálogo</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`rounded-xl h-10 md:h-11 px-3 md:px-6 text-[10px] md:text-xs font-black transition-all ${view === 'history' ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 border border-slate-200/50 dark:border-slate-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              onClick={() => setView('history')}
            >
              <History className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline uppercase tracking-widest">Historial</span>
            </Button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          
          <ThemeToggle />

          <Button variant="ghost" className="h-10 w-10 md:h-12 md:w-12 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-all group" onClick={onLogout}>
            <LogOut className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-3 md:p-8 animate-in fade-in duration-500">
        {view === 'request' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8 w-full items-start">
            {/* Catalog */}
            {visibleLocations.length === 0 ? (
              <div className="lg:col-span-8 flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold text-lg">No hay inventarios disponibles</p>
                <p className="text-sm">El administrador ha ocultado todos los inventarios en este momento.</p>
              </div>
            ) : (
              <div className="lg:col-span-8 flex flex-col gap-4 md:gap-6 order-2 lg:order-1">
                {/* Inventory Type Switcher */}
                {visibleLocations.length > 1 && (
                <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm mx-auto mb-2 dark:bg-slate-900 border-none">
                  {visibleLocations.includes('fuerza_publica') && (
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold transition-all text-xs ${
                        selectedLocation === 'fuerza_publica' 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => { setSelectedLocation('fuerza_publica'); setSelectedCategory(null); }}
                    >
                      Fza Pública
                    </button>
                  )}
                  {visibleLocations.includes('fronteras') && (
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-bold transition-all text-xs ${
                        selectedLocation === 'fronteras' 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => { setSelectedLocation('fronteras'); setSelectedCategory(null); }}
                    >
                      Fronteras
                    </button>
                  )}
                </div>
              )}

              <div className="relative group shrink-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input 
                  placeholder="Buscar insumos..." 
                  className="pl-12 border-slate-200 dark:border-slate-700 rounded-2xl h-12 md:h-14 text-sm md:text-base bg-white dark:bg-slate-800 shadow-sm focus-visible:ring-indigo-500 transition-all text-slate-900 dark:text-slate-100"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex bg-white py-2 px-1 gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0 border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                <Button
                  variant={selectedCategory === null ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  className={`rounded-full px-4 shrink-0 text-xs font-bold transition-all active:scale-95 ${selectedCategory === null ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 dark:bg-slate-800'}`}
                >
                  Todos
                </Button>
                {filteredCategories.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.name ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.name)}
                    className={`rounded-full px-4 shrink-0 text-xs font-bold transition-all active:scale-95 ${selectedCategory === category.name ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 dark:bg-slate-800'}`}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-5 py-2">
                {filteredProducts.map(product => (
                    <Card 
                    key={product.id} 
                    className={`border border-slate-200 dark:border-slate-800 rounded-xl md:rounded-2xl shadow-sm transition-all cursor-pointer group bg-white dark:bg-slate-900 overflow-hidden flex flex-col ${user.role !== 'viewer' ? 'hover:shadow-xl hover:border-indigo-200 active:scale-95' : 'cursor-not-allowed opacity-70'}`} 
                    onClick={() => user.role !== 'viewer' && addToCart(product)}
                  >
                    <CardHeader className="p-3 md:p-5 pb-2 md:pb-3 flex-1">
                      <div className="flex justify-between items-start mb-2 md:mb-3">
                        <Badge variant="outline" className="text-[7px] md:text-[9px] uppercase font-bold tracking-widest border-slate-100 bg-slate-50 text-slate-500 rounded-full h-4 md:h-5">
                          {product.category}
                        </Badge>
                        <div className="flex flex-col items-end">
                          <span className="text-sm md:text-lg font-black font-mono text-indigo-600 leading-none">{product.quantity}</span>
                          <span className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{product.unit}</span>
                        </div>
                      </div>
                      <CardTitle className="text-xs md:text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">{product.name}</CardTitle>
                    </CardHeader>
                    <div className="h-1 bg-slate-50 group-hover:bg-indigo-500 transition-colors" />
                  </Card>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full h-40 md:h-60 flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-30">
                      <Search className="w-8 h-8 md:w-10 md:h-10" />
                      <p className="text-[10px] md:text-sm font-bold uppercase">No encontrado</p>
                  </div>
                )}
              </div>
            </div>
          )}

            {/* Shopping Cart */}
            <Card id="shopping-cart-card" className="lg:col-span-4 border border-slate-200 shadow-xl rounded-2xl md:rounded-3xl flex flex-col bg-white overflow-hidden animate-in slide-in-from-top-4 lg:slide-in-from-right-4 duration-500 order-1 lg:order-2 lg:sticky lg:top-24 max-h-[85vh]">
              <CardHeader className="p-4 md:p-6 bg-slate-900 text-white shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-xs md:text-base font-black tracking-widest uppercase flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
                      Pedido Actual
                    </CardTitle>
                    <Button 
                      disabled={cart.length === 0}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 h-8 md:h-10 px-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 disabled:opacity-30 transition-all active:scale-95 text-[9px] md:text-xs"
                      onClick={submitRequest}
                    >
                      <Send className="w-3 h-3 md:w-4 md:h-4 mr-2" />
                      Enviar
                    </Button>
                  </div>
                  <Badge className="bg-indigo-500 text-white border-none rounded-full px-2 h-4 md:h-5 text-[8px] md:text-[10px] font-bold">
                    {cart.reduce((acc, curr) => acc + curr.quantity, 0)} Items
                  </Badge>
                </div>
              </CardHeader>
              <div className="flex-1 min-h-0 bg-slate-50/50 overflow-y-auto custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="h-40 md:h-60 flex flex-col items-center justify-center text-slate-300 p-6 text-center space-y-2">
                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 md:w-8 md:h-8 opacity-20" />
                    </div>
                    <div>
                      <p className="text-[10px] md:text-sm font-bold uppercase tracking-widest">Vacío</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 md:p-5 space-y-2 md:space-y-3">
                    {cart.map(item => {
                      const product = data.products.find(p => p.id === item.productId);
                      const maxStock = product ? parseFloat(product.quantity) : 0;
                      
                      return (
                        <div key={item.productId} className="flex items-center justify-between gap-2 md:gap-4 bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95 duration-200">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] md:text-xs font-black text-slate-800 uppercase truncate">{item.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <button 
                                className="w-6 h-6 md:w-7 md:h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all font-bold text-slate-500 text-xs"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity - 1 } : i));
                                  } else {
                                    removeFromCart(item.productId);
                                  }
                                }}
                              >
                                -
                              </button>
                              <div className="w-6 md:w-8 text-center font-mono font-bold text-indigo-600 text-[10px] md:text-sm">
                                {item.quantity}
                              </div>
                              <button 
                                className="w-6 h-6 md:w-7 md:h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all font-bold text-slate-500 text-xs"
                                onClick={() => {
                                  if (item.quantity < maxStock) {
                                    setCart(prev => prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i));
                                  } else {
                                    toast.error(`No hay más stock de ${item.name}. (Límite: ${maxStock})`);
                                  }
                                }}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 md:h-8 w-7 md:w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <XCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <CardFooter className="p-4 md:p-6 border-t border-slate-100 flex flex-col gap-3 md:gap-5 bg-white shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] shrink-0">
                <div className="w-full flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 group transition-all" onClick={() => setIsUrgent(!isUrgent)}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all ${isUrgent ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-slate-200 text-slate-400'}`}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">Pedido Urgente</p>
                      <p className="text-[9px] text-slate-400 font-medium italic">Marcar para prioridad inmediata</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-all relative ${isUrgent ? 'bg-red-600' : 'bg-slate-200'}`}>
                     <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isUrgent ? 'right-1' : 'left-1'}`} />
                  </div>
                </div>

                <div className="w-full space-y-1 md:space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Notas</label>
                    <MessageSquare className="w-3 h-3 text-slate-300" />
                  </div>
                  <textarea 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl md:rounded-2xl p-2 md:p-3 text-[10px] md:text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none min-h-[60px] md:min-h-[80px] transition-all text-slate-900 dark:text-slate-100"
                    placeholder="Escriba aquí..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </CardFooter>

            </Card>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-3 md:pb-4 gap-4">
              <div>
                <h2 className="text-base md:text-2xl font-black text-slate-900 tracking-tight">Historial de Pedidos</h2>
                <p className="text-[8px] md:text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Busque sus solicitudes por fecha</p>
              </div>
              
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-full md:w-auto justify-between md:justify-center shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-slate-50 hover:shadow-sm rounded-lg"
                  onClick={prevMonth}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-[10px] md:text-sm font-bold min-w-[120px] md:w-40 text-center uppercase tracking-widest text-slate-700">
                  {safeFormat(currentMonth, "MMMM yyyy")}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-slate-50 hover:shadow-sm rounded-lg"
                  onClick={nextMonth}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-white p-3 md:p-8 rounded-[1.5rem] md:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
              <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
                  <div key={day} className="text-center text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest py-1 md:py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 md:gap-4">
                {(() => {
                  const firstDayOfMonth = startOfMonth(currentMonth).getDay();
                  return Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square md:h-24 lg:h-32 rounded-lg md:rounded-xl bg-slate-50/50 border border-slate-50" />
                  ));
                })()}
                {days.map(day => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const stats = dayStats[dateKey] || { confirmed: 0, rejected: 0, pending: 0, total: 0 };
                  const { confirmed, rejected, pending, total } = stats;
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasActivity = total > 0;
                  
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`aspect-square md:h-24 lg:h-32 p-1 md:p-3 rounded-lg md:rounded-2xl border transition-all cursor-pointer relative flex flex-col group overflow-hidden ${
                        isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50 shadow-lg border-indigo-200' :
                        hasActivity ? 'bg-indigo-50/40 border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50' :
                        isToday ? 'border-indigo-300 bg-indigo-50/10' : 
                        'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedDay(day)}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] md:text-xl font-black font-mono leading-none ${isToday ? 'text-indigo-600' : hasActivity ? 'text-indigo-400' : 'text-slate-400'}`}>
                          {format(day, "d")}
                        </span>
                        {total > 0 && (
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-500 animate-pulse hidden md:block shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
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
                        <Badge className="absolute top-0.5 right-0.5 md:hidden bg-indigo-600 text-[7px] h-3 px-0.5 border-none rounded-sm min-w-[10px] flex items-center justify-center">
                          {total}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
              <DialogContent className="border-none rounded-[2rem] shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-1rem)] md:max-w-2xl mx-auto bg-white">
                <DialogHeader className="bg-indigo-600 text-white p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <DialogTitle className="text-xl md:text-2xl font-black tracking-tight truncate uppercase italic flex items-center gap-2">
                        <History className="w-5 h-5 text-indigo-300" /> 
                        {selectedDay && safeFormat(selectedDay, "EEEE, dd 'de' MMMM")}
                      </DialogTitle>
                      <DialogDescription className="text-white/60 text-[8px] md:text-xs uppercase tracking-[0.2em] font-black mt-1">
                        Mostrando sus solicitudes en esta fecha
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="p-4 md:p-8 bg-slate-50">
                  <ScrollArea className="h-[45vh] md:h-[400px]">
                    <div className="space-y-4 md:space-y-5 pr-4">
                      {selectedDay && <p className="text-xs text-slate-400">Día seleccionado: {format(selectedDay, "yyyy-MM-dd")}</p>}
                      {selectedDay && (() => {
                        const dayReqs = getRequestsForDay(selectedDay);
                        return dayReqs.length > 0 ? (
                          <div className="space-y-4">
                              {dayReqs.map(req => <RequestCard key={req.id} req={req} />)}
                            </div>
                        ) : (
                          <div className="h-40 flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50">
                             <History className="w-8 h-8" />
                             <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest">Sin solicitudes en esta fecha</p>
                          </div>
                        );
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
        <Dialog open={isSignatureOpen} onOpenChange={setIsSignatureOpen}>
          <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-md mx-auto bg-white">
            <DialogHeader className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                <PenTool className="w-6 h-6 text-indigo-400" />
                Firma del Cocinero
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-1">
                Use su dedo para firmar y validar la solicitud de hoy
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative group">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="#1e293b"
                  canvasProps={{
                    className: "w-full h-48 cursor-crosshair"
                  }}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-white"
                  onClick={() => sigPad.current?.clear()}
                >
                  <Eraser className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-30">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Firmar Aquí</span>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] md:text-xs text-amber-800 font-medium leading-relaxed italic">
                  "Al firmar, justifico que soy el usuario {user.name} y que los productos solicitados son necesarios para la operación diaria."
                </p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <Button variant="ghost" className="flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsSignatureOpen(false)}>
                Atrás
              </Button>
              <Button 
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200"
                onClick={submitRequest}
              >
                {isSubmitting ? "Enviando..." : "Finalizar Pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Dialog open={isGasDialogOpen} onOpenChange={setIsGasDialogOpen}>
        <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-hidden max-w-[calc(100vw-2rem)] md:max-w-md bg-white">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
              <Fuel className="w-6 h-6 text-orange-400" />
              Reportar Consumo Gas
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-1">
              Registro para Gestión de Reposición
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Litros / Cantidad</Label>
              <Input 
                type="number" 
                value={gasAmount}
                onChange={e => setGasAmount(e.target.value)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-12 bg-slate-50 dark:bg-slate-800 focus-visible:ring-orange-500 font-mono text-xl text-slate-900 dark:text-slate-100"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas adicionales</Label>
              <textarea 
                value={gasNote}
                onChange={e => setGasNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none min-h-[80px] text-slate-900 dark:text-slate-100"
                placeholder="Detalles sobre el uso o el depósito..."
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
            <Button variant="ghost" className="flex-1 rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setIsGasDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              disabled={isSubmittingGas}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-200"
              onClick={submitGasReport}
            >
              {isSubmittingGas ? "Enviando..." : "Enviar Reporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <footer className="py-4 md:py-6 px-4 md:px-8 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
         <p className="text-[7px] md:text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] md:tracking-[0.3em]">Terminal Cocina</p>
         <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">En línea</span>
         </div>
      </footer>
    </div>

  );
});
