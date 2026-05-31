import React, { useState, useMemo, useRef, useEffect } from "react";
import { User, DBData, Product, Request } from "../types";
import SignatureCanvas from "react-signature-canvas";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  ShoppingBag, 
  PlusCircle,
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
  Bell,
  ChevronDown,
  Shield,
  Map,
  Mic,
  ScanBarcode,
  Settings,
  Palette,
  Monitor
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationCenter } from "./NotificationCenter";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { apiFetch } from "../lib/api";

interface CookDashboardProps {
  user: User;
  data: DBData;
  onLogout: () => void;
  onRefresh?: () => void;
  notificationHistory: {message: string, type?: string, timestamp: number}[];
  onClearNotifications: () => void;
  onRemoveNotification: (ts: number) => void;
}

const RequestCard = React.memo(({ req }: { req: any }) => (
  <Card className="border border-slate-200 rounded-2xl shadow-sm overflow-hidden bg-white">
    <div className="grid grid-cols-1 md:grid-cols-12 shrink-0">
        <div className="md:col-span-4 bg-slate-50/50 p-4 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black uppercase text-slate-600 dark:text-slate-400 font-mono tracking-widest">{String(req.id).substring(0,8)}</span>
                  <Badge className={`uppercase text-xs font-black tracking-widest px-2.5 py-1 rounded-full ${
                    req.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    req.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {req.status === 'pending' ? 'Pendiente' : 
                      req.status === 'confirmed' ? 'Confirmado' : 'Rechazado'}
                  </Badge>
              </div>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold">{safeFormat(req.timestamp, "HH:mm")}</span>
              </div>
              {req.isUrgent && (
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20 animate-pulse transition-all">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="text-sm font-black uppercase tracking-widest">Urgente</span>
                </div>
              )}
        </div>
        <div className="md:col-span-8 p-4">
          <p className="text-sm font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest mb-3">Artículos</p>
          <div className="flex flex-wrap gap-2 mb-3">
              {Array.isArray(req.items) && req.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                    <span className="text-[11px] md:text-xs font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="text-[11px] md:text-xs font-black font-mono text-indigo-600">x{item.quantity}</span>
                </div>
              ))}
          </div>
          {req.note && (
            <div className="pt-3 border-t border-slate-100 flex gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs md:text-sm text-slate-700 dark:text-slate-300 italic">"{req.note}"</p>
            </div>
          )}
        </div>
    </div>
  </Card>
));

export default React.memo(function CookDashboard({ user, data, onLogout, onRefresh, notificationHistory, onClearNotifications, onRemoveNotification }: CookDashboardProps) {
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  
  const { theme, setTheme } = useTheme();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [note, setNote] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
// Removed view state
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isGasDialogOpen, setIsGasDialogOpen] = useState(false);
  const [gasAmount, setGasAmount] = useState("");
  const [gasNote, setGasNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingGas, setIsSubmittingGas] = useState(false);
  
  // Suggestion states
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

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

  const [selectedLocation, setSelectedLocation] = useState<string>('fuerza_publica');
  const [isInventoryVisible, setIsInventoryVisible] = useState(true);

  const visibleLocations = useMemo(() => {
    // Check customLocations first
    const custom = data.settings?.customLocations;
    if (custom) {
      return custom.filter((l: any) => l.visible !== false).map((l: any) => l.id);
    }
    const visibility = data.settings?.locationVisibility || { fuerza_publica: true, fronteras: true };
    const locations: string[] = [];
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
    let prods = (data.products || []).filter(p => !p.isHidden && (p.location || 'fuerza_publica') === selectedLocation);
    if (selectedCategory) {
      prods = prods.filter(p => p.category === selectedCategory);
    }
    return prods.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data.products, searchTerm, selectedCategory, selectedLocation]);

  const addToCart = (product: Product) => {
    try { if (navigator.vibrate) navigator.vibrate(50); } catch(e){} // Haptic feedback
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
    
    for (let i = 0; i < data.pastHistories.length; i++) {
      const history = data.pastHistories[i];
      const hReqs = history.requests;
      if (hReqs && Array.isArray(hReqs)) {
        for (let j = 0; j < hReqs.length; j++) {
          const req = hReqs[j];
          if (!req || !req.id) continue;
          
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
    if (!data.requests || !Array.isArray(data.requests)) return pastUserRequests;
    
    const userId = user.id;
    const userEmail = String(user.email || "").toLowerCase().trim();
    const userNameLower = String(user.name || "").toLowerCase().trim();
    
    const currentRequests = data.requests.filter(req => {
      if (!req || !req.id) return false;
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
      console.log("Checking date:", dateKey, "Requests:", requestsByDateMap[dateKey]);
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

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const cartContent = (
    <>
      <CardHeader className="p-4 md:p-6 bg-slate-900 text-white shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-xs md:text-base font-black tracking-widest uppercase flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
              Pedido Actual
            </CardTitle>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setCart([])}
              className="text-xs h-6 px-2 text-slate-700 dark:text-slate-300 hover:text-red-500 uppercase font-black"
            >
              Vaciar
            </Button>
            <Button 
              disabled={cart.length === 0}
              className="bg-indigo-600 text-white hover:bg-indigo-700 h-8 md:h-10 px-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 disabled:opacity-30 transition-all active:scale-95 text-xs md:text-sm"
              onClick={() => { submitRequest(); setIsMobileCartOpen(false); }}
            >
              <Send className="w-3 h-3 md:w-4 md:h-4 mr-2" />
              Enviar
            </Button>
          </div>
          <Badge className="bg-indigo-500 text-white border-none rounded-full px-2 h-4 md:h-5 text-[10px] md:text-sm font-bold">
            {cart.reduce((acc, curr) => acc + curr.quantity, 0)} Items
          </Badge>
        </div>
      </CardHeader>
      <div className="flex-1 min-h-0 bg-slate-50/50 overflow-y-auto custom-scrollbar relative">
        {cart.length === 0 ? (
          <div className="h-40 lg:h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-6 text-center space-y-2 py-12">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 md:w-8 md:h-8 opacity-20" />
            </div>
            <div>
              <p className="text-sm md:text-base font-bold uppercase tracking-widest">Vacío</p>
            </div>
          </div>
        ) : (
          <div className="p-3 md:p-5 space-y-2 md:space-y-3">
            {cart.map(item => {
              const product = (data.products || []).find(p => p.id === item.productId);
              const maxStock = product ? parseFloat(product.quantity) : 0;
              
              return (
                <div key={item.productId} className="flex items-center justify-between gap-2 md:gap-4 bg-white p-2 md:p-3 rounded-xl md:rounded-2xl border border-slate-100 shadow-sm animate-in zoom-in-95 duration-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-sm font-black text-slate-800 uppercase truncate">{item.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <button 
                        className="w-6 h-6 md:w-7 md:h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all font-bold text-slate-700 dark:text-slate-300 text-xs"
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
                      <div className="w-6 md:w-8 text-center font-mono font-bold text-indigo-600 text-sm md:text-base">
                        {item.quantity}
                      </div>
                      <button 
                        className="w-6 h-6 md:w-7 md:h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all font-bold text-slate-700 dark:text-slate-300 text-xs"
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
                    className="h-7 md:h-8 w-7 md:w-8 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
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
            <div className={`p-2 rounded-xl transition-all ${isUrgent ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-slate-200 text-slate-600 dark:text-slate-400'}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-800">Pedido Urgente</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium italic">Marcar para prioridad inmediata</p>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full transition-all relative ${isUrgent ? 'bg-red-600' : 'bg-slate-200'}`}>
             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isUrgent ? 'right-1' : 'left-1'}`} />
          </div>
        </div>

        <div className="w-full space-y-1 md:space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] md:text-sm font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest">Notas</label>
            <MessageSquare className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          </div>
          <textarea 
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl md:rounded-2xl p-2 md:p-3 text-sm md:text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none min-h-[60px] md:min-h-[80px] transition-all text-slate-900 dark:text-slate-100"
            placeholder="Escriba aquí..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </CardFooter>
    </>
  );

  return (
    <div className="flex-1 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors duration-300 custom-scrollbar relative">
      {/* Header */}
      <header className="px-3 md:px-8 py-2 md:py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <motion.div 
            whileHover={{ rotate: 10, scale: 1.1 }}
            className="bg-indigo-600 p-1.5 md:p-2 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none shrink-0"
          >
            <CookingPot className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </motion.div>
          <div className="flex flex-col">
            <h1 className="text-[13px] md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase italic">Terminal Cocina</h1>
            <div className="flex items-center gap-1.5 mt-1 hidden xs:flex md:flex">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <p className="text-[9px] md:text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest leading-none">
                {isOnline ? 'En línea' : 'Sin Conexión'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <Button 
            variant="ghost" 
            className="md:hidden rounded-lg h-8 px-2 text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 hover:bg-blue-100"
            onClick={() => setIsChatOpen(true)}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1" /> Soporte
          </Button>

          <Button 
            variant="ghost" 
            className="md:hidden rounded-lg h-8 px-2 text-[10px] font-black uppercase text-orange-600 bg-orange-50/50 hover:bg-orange-100"
            onClick={() => setIsGasDialogOpen(true)}
          >
            <Fuel className="w-3.5 h-3.5 mr-1" /> Gas
          </Button>
          
          <div className="hidden md:flex flex-row items-center gap-2">
            <Button 
                variant="outline" 
                className="rounded-xl h-9 px-4 text-[10px] md:text-xs font-black uppercase text-blue-600 border-blue-200 bg-blue-50/30 hover:bg-blue-50 transition-all flex items-center gap-2 shadow-sm"
                onClick={() => setIsChatOpen(true)}
              >
                <MessageSquare className="w-4 h-4" /> 
                Soporte
            </Button>
            <Button 
                variant="outline" 
                className="rounded-xl h-9 px-4 text-[10px] md:text-xs font-black uppercase text-orange-600 border-orange-200 bg-orange-50/30 hover:bg-orange-50 transition-all flex items-center gap-2 shadow-sm"
                onClick={() => setIsGasDialogOpen(true)}
              >
                <Fuel className="w-4 h-4" /> 
                Reportar Gas
            </Button>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3">
             <div 
              className="px-2 md:px-3 h-8 md:h-9 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg md:rounded-xl cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-1.5 md:gap-2 active:scale-95 border border-indigo-100 dark:border-indigo-800/50" 
              onClick={() => setIsMobileCartOpen(true)}
            >
              <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="font-black text-xs md:text-sm">{cart.length}</span>
            </div>

            <Button variant="ghost" size="icon" onClick={onRefresh} className="md:hidden h-8 w-8 text-slate-400 rounded-lg shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </Button>
            
            <Button variant="ghost" size="icon" onClick={onLogout} className="md:hidden h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg shrink-0">
              <LogOut className="w-4 h-4" />
            </Button>

            <div className="hidden md:flex items-center gap-3">
              <ThemeToggle />
              <NotificationCenter 
                notifications={notificationHistory} 
                onClear={onClearNotifications} 
                onRemove={onRemoveNotification} 
                isMasterAdmin={false}
              />
              <Button variant="outline" size="icon" onClick={onLogout} className="text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl h-9 w-9 shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="request" className="flex-1 flex flex-col-reverse md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
          <div className="w-full md:w-64 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-r border-slate-100 dark:border-slate-800 p-2 md:p-4 pb-[env(safe-area-inset-bottom)] flex shrink-0 z-40 relative">
            <TabsList className="flex flex-row md:flex-col w-full h-auto bg-transparent gap-2 p-0 justify-around">
              <TabsTrigger 
                value="request" 
                className="flex-1 md:w-full justify-center md:justify-start flex-col md:flex-row rounded-xl md:rounded-2xl h-14 md:px-4 font-black transition-all gap-1 md:gap-3 data-[state=active]:bg-slate-100 md:data-[state=active]:bg-slate-200 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white shadow-none border-none group"
              >
                <div className="bg-transparent md:bg-white md:dark:bg-slate-700 p-1 md:p-2 rounded-xl group-data-[state=active]:shadow-none md:group-data-[state=active]:shadow-sm group-data-[state=active]:bg-transparent md:group-data-[state=active]:bg-indigo-50 md:dark:group-data-[state=active]:bg-indigo-900/40 transition-all">
                  <ShoppingBag className="w-5 h-5 md:w-5 md:h-5 text-slate-400 group-data-[state=active]:text-indigo-600 group-hover:scale-110 transition-transform" />
                </div>
                <span className="inline-block uppercase tracking-widest text-[9px] md:text-xs text-slate-500 group-data-[state=active]:text-indigo-600 transition-colors mt-0.5 md:mt-0">Catálogo</span>
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="flex-1 md:w-full justify-center md:justify-start flex-col md:flex-row rounded-xl md:rounded-2xl h-14 md:px-4 font-black transition-all gap-1 md:gap-3 data-[state=active]:bg-slate-100 md:data-[state=active]:bg-slate-200 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white shadow-none border-none group"
              >
                <div className="bg-transparent md:bg-white md:dark:bg-slate-700 p-1 md:p-2 rounded-xl group-data-[state=active]:shadow-none md:group-data-[state=active]:shadow-sm group-data-[state=active]:bg-transparent md:group-data-[state=active]:bg-indigo-50 md:dark:group-data-[state=active]:bg-indigo-900/40 transition-all">
                  <History className="w-5 h-5 md:w-5 md:h-5 text-slate-400 group-data-[state=active]:text-indigo-600 group-hover:scale-110 transition-transform" />
                </div>
                <span className="inline-block uppercase tracking-widest text-[9px] md:text-xs text-slate-500 group-data-[state=active]:text-indigo-600 transition-colors mt-0.5 md:mt-0">Historial</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex-1 md:w-full justify-center md:justify-start flex-col md:flex-row rounded-xl md:rounded-2xl h-14 md:px-4 font-black transition-all gap-1 md:gap-3 data-[state=active]:bg-slate-100 md:data-[state=active]:bg-slate-200 dark:data-[state=active]:bg-slate-800 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white shadow-none border-none group"
              >
                <div className="bg-transparent md:bg-white md:dark:bg-slate-700 p-1 md:p-2 rounded-xl group-data-[state=active]:shadow-none md:group-data-[state=active]:shadow-sm group-data-[state=active]:bg-transparent md:group-data-[state=active]:bg-indigo-50 md:dark:group-data-[state=active]:bg-indigo-900/40 transition-all">
                  <Settings className="w-5 h-5 md:w-5 md:h-5 text-slate-400 group-data-[state=active]:text-indigo-600 group-hover:scale-110 transition-transform" />
                </div>
                <span className="inline-block uppercase tracking-widest text-[9px] md:text-xs text-slate-500 group-data-[state=active]:text-indigo-600 transition-colors mt-0.5 md:mt-0">Ajustes</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto w-full relative custom-scrollbar bg-slate-50 md:bg-transparent">
            <TabsContent value="request" className="m-0 p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300 h-full">
              {visibleLocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-600 dark:text-slate-400">
                  <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-bold text-lg text-center uppercase tracking-widest">No hay inventarios disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-[1600px] mx-auto min-h-full">
                    {/* Phone Mockup Frame */}
                    <div className="hidden lg:flex lg:col-span-4 justify-center sticky top-0 py-4">
                      <div className="relative w-[340px] h-[680px] bg-slate-900 rounded-[3rem] p-3 shadow-2xl border-[8px] border-slate-800">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-10" />
                        <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[2rem] overflow-hidden flex flex-col shadow-inner">
                           {cartContent}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-8 flex flex-col gap-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-[1.5rem] flex w-full md:w-fit shadow-inner relative overflow-hidden backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50">
                          {data.settings?.customLocations ? (
                            data.settings.customLocations.filter((l: any) => l.visible !== false).map((loc: any) => (
                              <button
                                key={loc.id}
                                className={`relative flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all duration-300 z-10 ${
                                  selectedLocation === loc.id 
                                    ? 'text-indigo-800 dark:text-indigo-200' 
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                }`}
                                onClick={() => { 
                                  if (selectedLocation === loc.id) {
                                    setIsInventoryVisible(!isInventoryVisible);
                                  } else {
                                    setSelectedLocation(loc.id); 
                                    setSelectedCategory(null);
                                    setIsInventoryVisible(true);
                                  }
                                }}
                              >
                                {selectedLocation === loc.id && (
                                  <motion.div 
                                    layoutId="activeLocationTab"
                                    className="absolute inset-0 bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.1)] rounded-2xl -z-10"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                  />
                                )}
                                {loc.id === 'fuerza_publica' ? (
                                  <Shield className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedLocation === 'fuerza_publica' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                                ) : loc.id === 'fronteras' ? (
                                  <Map className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedLocation === 'fronteras' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                                ) : (
                                  <BoxSelect className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedLocation === loc.id ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                                )}
                                <span className="text-[10px] md:text-xs uppercase tracking-widest mt-0.5">{loc.name}</span>
                              </button>
                            ))
                          ) : (
                            <>
                              {visibleLocations.includes('fuerza_publica') && (
                                <button
                                  className={`relative flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all duration-300 z-10 ${
                                    selectedLocation === 'fuerza_publica' 
                                      ? 'text-indigo-800 dark:text-indigo-200' 
                                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                  }`}
                                  onClick={() => { 
                                    if (selectedLocation === 'fuerza_publica') {
                                      setIsInventoryVisible(!isInventoryVisible);
                                    } else {
                                      setSelectedLocation('fuerza_publica'); 
                                      setSelectedCategory(null);
                                      setIsInventoryVisible(true);
                                    }
                                  }}
                                >
                                  {selectedLocation === 'fuerza_publica' && (
                                    <motion.div 
                                      layoutId="activeLocationTab"
                                      className="absolute inset-0 bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.1)] rounded-2xl -z-10"
                                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                  )}
                                  <Shield className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedLocation === 'fuerza_publica' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                                  <span className="text-[10px] md:text-xs uppercase tracking-widest mt-0.5">Fza Pública</span>
                                </button>
                              )}
                              {visibleLocations.includes('fronteras') && (
                                <button
                                  className={`relative flex-1 md:flex-none flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-2xl font-black transition-all duration-300 z-10 ${
                                    selectedLocation === 'fronteras' 
                                      ? 'text-indigo-800 dark:text-indigo-200' 
                                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                                  }`}
                                  onClick={() => { 
                                    if (selectedLocation === 'fronteras') {
                                      setIsInventoryVisible(!isInventoryVisible);
                                    } else {
                                      setSelectedLocation('fronteras'); 
                                      setSelectedCategory(null);
                                      setIsInventoryVisible(true);
                                    }
                                  }}
                                >
                                  {selectedLocation === 'fronteras' && (
                                    <motion.div 
                                      layoutId="activeLocationTab"
                                      className="absolute inset-0 bg-white dark:bg-slate-900 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.1)] rounded-2xl -z-10"
                                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                  )}
                                  <Map className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${selectedLocation === 'fronteras' ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                                  <span className="text-[10px] md:text-xs uppercase tracking-widest mt-0.5">Fronteras</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        <div className="relative flex-1 max-w-md">
                          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                          </div>
                          <Input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-200/30 dark:bg-slate-800/30 border-none h-12 pl-12 pr-24 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                            placeholder={isListening ? "Escuchando..." : "Buscar insumos..."}
                          />
                          <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-8 w-8 rounded-xl ${isListening ? 'text-red-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 hover:text-indigo-600'}`}
                              onClick={() => {
                                setIsListening(!isListening);
                                if (!isListening) toast.info("Dictado por voz activado (Simulado)");
                              }}
                            >
                              <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-indigo-600 rounded-xl"
                              onClick={() => {
                                setIsScanning(true);
                                toast.info("Escáner de código de barras abierto (Simulado)");
                                setTimeout(() => setIsScanning(false), 2000);
                              }}
                            >
                              <ScanBarcode className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {isInventoryVisible && (
                        <>
                          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-1.5 w-fit min-w-[200px]">
                            <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
                              <SelectTrigger className="w-full border-none shadow-none text-[11px] font-black uppercase tracking-[0.2em] h-10 px-4">
                                <SelectValue placeholder="CATEGORÍA" />
                              </SelectTrigger>
                              <SelectContent className="font-black uppercase tracking-wider text-[10px]">
                                <SelectItem value="all">ALL</SelectItem>
                                {filteredCategories.map(category => (
                                  <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {selectedCategory ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                              {(() => {
                                const products = filteredProducts;
                                return products.length > 0 ? (
                                  <>{products.map(product => (
                                    <Card 
                                      key={product.id} 
                                      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer group overflow-hidden flex flex-col active:scale-[0.98] h-full ${user.role !== 'viewer' ? 'hover:shadow-xl hover:border-indigo-300' : 'cursor-not-allowed opacity-70'}`} 
                                      onClick={() => user.role !== 'viewer' && addToCart(product)}
                                    >
                                      <div className="p-3 md:p-4 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-3 md:mb-4">
                                          <div className="min-w-0 pr-2">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-start gap-2">
                                              <span>{product.name}</span>
                                              {parseFloat(product.quantity) <= (data.settings?.criticalStockThreshold || 10) && (
                                                <span className="flex-shrink-0 relative flex h-2.5 w-2.5 mt-1" title="Stock Crítico">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                </span>
                                              )}
                                            </h4>
                                            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[10px] uppercase font-black mt-1.5 tracking-wider truncate max-w-full inline-block">
                                              {product.category.substring(0, 15)}{product.category.length > 15 ? '...' : ''}
                                            </Badge>
                                          </div>
                                        </div>
                                        
                                        <div className="mt-auto grid grid-cols-2 gap-2">
                                          {/* Stock Area */}
                                          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-2 md:p-3 border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center">
                                            <span className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Existencia</span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-base md:text-lg font-black text-indigo-600 dark:text-indigo-400 text-center font-mono leading-none">{product.quantity}</span>
                                            </div>
                                            <span className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">{product.unit || 'uds'}</span>
                                          </div>
                                          
                                          {/* Add to Request Area */}
                                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-2 md:p-3 border border-indigo-100 dark:border-indigo-800/30 flex flex-col items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 dark:group-hover:bg-indigo-600 transition-colors">
                                            <span className="text-[9px] md:text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest mb-1 group-hover:text-indigo-100 transition-colors">Pedir</span>
                                            <div className="flex items-center justify-center h-full">
                                              <PlusCircle className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}</>
                                ) : (
                                  <div className="col-span-full h-40 md:h-60 flex flex-col items-center justify-center p-12">
                                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                        <Search className="w-8 h-8 text-slate-300" />
                                      </div>
                                      <p className="text-sm md:text-base font-black uppercase text-slate-400 tracking-widest text-center">No encontrado</p>
                                  </div>
                                )
                              })()}
                            </div>
                          ) : (
                            <div className="space-y-10 pb-20">
                              {filteredCategories.map(category => {
                                 const products = filteredProducts.filter(p => p.category === category.name);
                                 if (products.length === 0) return null;
                                 return (
                                   <div key={category.id} className="space-y-6">
                                     <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.3em] border-b-2 border-slate-900 dark:border-slate-100 pb-2 inline-block translate-x-1">{category.name}</h3>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                       {products.map(product => (
                                          <Card 
                                            key={product.id} 
                                            className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer group overflow-hidden flex flex-col active:scale-[0.98] h-full ${user.role !== 'viewer' ? 'hover:shadow-xl hover:border-indigo-300' : 'cursor-not-allowed opacity-70'}`} 
                                            onClick={() => user.role !== 'viewer' && addToCart(product)}
                                          >
                                            <div className="p-3 md:p-4 flex-1 flex flex-col">
                                              <div className="flex justify-between items-start mb-3 md:mb-4">
                                                <div className="min-w-0 pr-2">
                                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-start gap-2">
                                                    <span>{product.name}</span>
                                                    {parseFloat(product.quantity) <= (data.settings?.criticalStockThreshold || 10) && (
                                                      <span className="flex-shrink-0 relative flex h-2.5 w-2.5 mt-1" title="Stock Crítico">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                                      </span>
                                                    )}
                                                  </h4>
                                                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-1.5 py-0 text-[10px] uppercase font-black mt-1.5 tracking-wider truncate max-w-full inline-block">
                                                    {product.category.substring(0, 15)}{product.category.length > 15 ? '...' : ''}
                                                  </Badge>
                                                </div>
                                              </div>
                                              
                                              <div className="mt-auto grid grid-cols-2 gap-2">
                                                {/* Stock Area */}
                                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-2 md:p-3 border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center">
                                                  <span className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Existencia</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-base md:text-lg font-black text-indigo-600 dark:text-indigo-400 text-center font-mono leading-none">{product.quantity}</span>
                                                  </div>
                                                  <span className="text-[9px] md:text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">{product.unit || 'uds'}</span>
                                                </div>
                                                
                                                {/* Add to Request Area */}
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-2 md:p-3 border border-indigo-100 dark:border-indigo-800/30 flex flex-col items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 dark:group-hover:bg-indigo-600 transition-colors">
                                                  <span className="text-[9px] md:text-[10px] font-black text-indigo-400 dark:text-indigo-300 uppercase tracking-widest mb-1 group-hover:text-indigo-100 transition-colors">Pedir</span>
                                                  <div className="flex items-center justify-center h-full">
                                                    <PlusCircle className="w-6 h-6 md:w-7 md:h-7 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </Card>
                                        ))}
                                     </div>
                                   </div>
                                 );
                              })}
                              {filteredProducts.length === 0 && (
                                <div className="col-span-full h-40 md:h-60 flex flex-col items-center justify-center p-12">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                      <Search className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-sm md:text-base font-black uppercase text-slate-400 tracking-widest text-center">No encontrado</p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      
                      {!isInventoryVisible && (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center max-w-sm w-full"
                          >
                            <Shield className="w-16 h-16 mb-4 text-indigo-200 dark:text-indigo-900/50" />
                            <h3 className="font-black text-lg tracking-tight text-slate-800 dark:text-slate-200 uppercase">Inventario Oculto</h3>
                            <p className="text-sm font-bold mt-2 opacity-80 uppercase tracking-widest">
                              Presione el botón <span className="text-indigo-600 dark:text-indigo-400">{selectedLocation === 'fuerza_publica' ? 'Fza Pública' : 'Fronteras'}</span> nuevamenente para visualizar los productos.
                            </p>
                          </motion.div>
                        </div>
                      )}
                    </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="m-0 p-4 md:p-6 animate-in fade-in zoom-in-95 duration-300">
               <div className="max-w-4xl mx-auto space-y-4 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-3 md:pb-4 gap-4">
                  <div>
                    <h2 className="text-base md:text-2xl font-black text-slate-900 tracking-tight">Historial de Pedidos</h2>
                    <p className="text-[10px] md:text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest font-bold mt-1">Busque sus solicitudes por fecha</p>
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
                    <span className="text-sm md:text-base font-bold min-w-[120px] md:w-40 text-center uppercase tracking-widest text-slate-700 dark:text-slate-300">
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
                      <div key={day} className="text-center text-[10px] md:text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest py-1 md:py-2">
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
                            <span className={`text-sm md:text-xl font-black font-mono leading-none ${isToday ? 'text-indigo-600' : hasActivity ? 'text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                              {format(day, "d")}
                            </span>
                            {total > 0 && (
                              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                            )}
                          </div>

                          <div className="flex-1 flex flex-col justify-end gap-0.5 mt-auto">
                             {confirmed > 0 && (
                               <div className="flex items-center gap-1">
                                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 shrink-0" />
                                 <span className="text-[9px] md:text-xs font-black font-mono text-emerald-600 leading-none truncate">{confirmed} <span className="hidden md:inline">OK</span></span>
                               </div>
                             )}
                             {rejected > 0 && (
                               <div className="flex items-center gap-1">
                                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 shrink-0" />
                                 <span className="text-[9px] md:text-xs font-black font-mono text-red-600 leading-none truncate">{rejected} <span className="hidden md:inline">NO</span></span>
                               </div>
                             )}
                             {pending > 0 && (
                               <div className="flex items-center gap-1">
                                 <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-amber-500 shrink-0" />
                                 <span className="text-[9px] md:text-xs font-black font-mono text-amber-600 text-nowrap leading-none truncate">{pending} <span className="hidden md:inline">PEN</span></span>
                               </div>
                             )}
                          </div>

                          {total > 0 && (
                            <Badge className="absolute top-0.5 right-0.5 md:hidden bg-indigo-600 text-[10px] h-3 px-0.5 border-none rounded-sm min-w-[10px] flex items-center justify-center">
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
                          <DialogDescription className="text-white/90 text-[10px] md:text-sm uppercase tracking-[0.2em] font-black mt-1">
                            Mostrando sus solicitudes en esta fecha
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="p-4 md:p-8 bg-slate-50">
                      <ScrollArea className="h-[45vh] md:h-[400px]">
                        <div className="space-y-4 md:space-y-5 pr-4">
                          {selectedDay && getRequestsForDay(selectedDay).map((req) => (
                              <RequestCard key={req.id} req={req} />
                          ))}
                          {selectedDay && getRequestsForDay(selectedDay).length === 0 && (
                              <div className="text-center py-12 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
                                Sin pedidos en esta fecha
                              </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
          </TabsContent>
          <TabsContent value="settings" className="m-0 p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-300 h-full overflow-y-auto">
             <div className="max-w-[1600px] mx-auto min-h-full pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                   <div>
                      <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 dark:text-slate-100 flex items-center gap-2">
                         <Palette className="w-5 h-5 text-indigo-500" />
                         Apariencia
                      </h2>
                      <p className="text-[11px] md:text-xs uppercase tracking-widest font-black mt-1 text-slate-500 dark:text-slate-400">
                         Tema visual de la aplicación
                      </p>
                   </div>
                   <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl w-full sm:w-auto overflow-hidden">
                      <button 
                        onClick={() => setTheme("light")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      >
                         <Sun className="w-4 h-4" /> <span>Claro</span>
                      </button>
                      <button 
                        onClick={() => setTheme("dark")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      >
                         <Moon className="w-4 h-4" /> <span>Oscuro</span>
                      </button>
                      <button 
                        onClick={() => setTheme("system")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                      >
                         <Monitor className="w-4 h-4" /> <span>Auto</span>
                      </button>
                   </div>
                </div>
             </div>
          </TabsContent>
          </div>
        </Tabs>
        <Dialog open={isSignatureOpen} onOpenChange={setIsSignatureOpen}>
          <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-y-auto max-h-[85vh] max-w-[calc(100vw-2rem)] md:max-w-md mx-auto bg-white">
            <DialogHeader className="bg-slate-900 text-white p-6">
              <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
                <PenTool className="w-6 h-6 text-indigo-400" />
                Firma del Cocinero
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-xs md:text-sm uppercase tracking-widest font-medium mt-1">
                Use su dedo para firmar y validar la solicitud de hoy
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50 relative group">
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="#1e293b"
                  canvasProps={{
                    className: "w-full h-32 md:h-48 cursor-crosshair"
                  }}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-white"
                  onClick={() => sigPad.current?.clear()}
                >
                  <Eraser className="w-4 h-4" />
                </Button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-30">
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400">Firmar Aquí</span>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm md:text-sm text-amber-800 font-medium leading-relaxed italic">
                  "Al firmar, justifico que soy el usuario <strong>{user.name}</strong> y que los productos solicitados son necesarios para la operación diaria."
                </p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <Button variant="ghost" className="flex-1 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={() => setIsSignatureOpen(false)}>
                Atrás
              </Button>
              <Button 
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-indigo-200"
                onClick={submitRequest}
              >
                {isSubmitting ? "Enviando..." : "Finalizar Pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <Dialog open={isGasDialogOpen} onOpenChange={setIsGasDialogOpen}>
        <DialogContent className="border-none rounded-3xl shadow-2xl p-0 overflow-y-auto max-h-[85vh] max-w-[calc(100vw-2rem)] md:max-w-md bg-white">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-3">
              <Fuel className="w-6 h-6 text-orange-400" />
              Reportar Consumo Gas
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs md:text-sm uppercase tracking-widest font-medium mt-1">
              Registro para Gestión de Reposición
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Litros / Cantidad</Label>
              <Input 
                type="number" 
                value={gasAmount}
                onChange={e => setGasAmount(e.target.value)}
                className="border-slate-200 dark:border-slate-700 rounded-xl h-12 bg-slate-50 dark:bg-slate-800 focus-visible:ring-orange-500 font-mono text-xl text-slate-900 dark:text-slate-100"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Notas adicionales</Label>
              <textarea 
                value={gasNote}
                onChange={e => setGasNote(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none min-h-[80px] text-slate-900 dark:text-slate-100"
                placeholder="Detalles sobre el uso o el depósito..."
              />
            </div>
          </div>
          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
            <Button variant="ghost" className="flex-1 rounded-xl font-bold uppercase tracking-widest text-sm" onClick={() => setIsGasDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              disabled={isSubmittingGas}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black uppercase tracking-widest text-sm shadow-lg shadow-orange-200"
              onClick={submitGasReport}
            >
              {isSubmittingGas ? "Enviando..." : "Enviar Reporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden bg-white dark:bg-slate-900 border-none rounded-3xl shadow-2xl z-50">
          <DialogHeader className="p-4 md:p-6 bg-blue-50 dark:bg-blue-900/40 border-b border-blue-100 dark:border-blue-800/60 pb-4">
            <DialogTitle className="text-xl font-black flex items-center gap-3 text-blue-900 dark:text-blue-100 uppercase tracking-tight">
              <div className="bg-blue-600 text-white p-2 md:p-2.5 rounded-xl shadow-md border border-blue-500">
                <MessageSquare className="w-5 h-5" />
              </div>
              Chat de Soporte
            </DialogTitle>
            <DialogDescription className="text-blue-700/70 dark:text-blue-300 font-bold uppercase tracking-widest textxs mt-2">
              Comunícate con el Administrador
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4 h-64 overflow-y-auto mb-4 custom-scrollbar">
              <div className="text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">Hoy</span>
              </div>
              <div className="flex justify-end">
                 <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm text-sm font-medium shadow-sm max-w-[80%]">
                   Hola, necesito confirmar el stock de carne.
                 </div>
              </div>
              <div className="flex">
                 <div className="bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 p-3 rounded-2xl rounded-tl-sm text-sm font-medium shadow-sm max-w-[80%] border border-slate-100 dark:border-slate-600">
                   Revisando... Sí, tenemos 15 Kg disponibles.
                 </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Escriba su mensaje..." 
                className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-2xl h-12 focus-visible:ring-blue-500"
              />
              <Button size="icon" className="h-12 w-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95 shrink-0" onClick={() => {toast.success("Mensaje enviado (simulado)"); setIsChatOpen(false)}}>
                 <Send className="w-5 h-5 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="py-4 md:py-6 px-4 md:px-8 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
         <p className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">Terminal Cocina</p>
         <div className="flex items-center gap-1.5 md:gap-2">
            <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] md:text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">En línea</span>
         </div>
      </footer>

      {/* Floating Mobile Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-4 right-4 z-50 lg:hidden animate-in slide-in-from-bottom-8 duration-300 pointer-events-none">
          <Button 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] h-14 md:h-16 font-black uppercase tracking-widest shadow-[0_10px_40px_-10px_rgba(79,70,229,0.8)] active:scale-95 transition-transform flex justify-between items-center px-6 pointer-events-auto"
            onClick={() => setIsMobileCartOpen(true)}
          >
            <span className="flex items-center gap-2 text-xs md:text-base">
              <ShoppingBag className="w-5 h-5 md:w-6 md:h-6" />
              Ver Pedido ({cart.reduce((acc, curr) => acc + curr.quantity, 0)})
            </span>
            <span className="flex items-center gap-1 opacity-80 group-hover:opacity-100 text-[10px] md:text-sm tracking-widest">
              Abrir <ChevronDown className="w-4 h-4 ml-1 rotate-180" />
            </span>
          </Button>
        </div>
      )}

      {/* Mobile Cart Full Screen Overlay */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] lg:hidden flex flex-col bg-slate-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                Tu Pedido
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setIsMobileCartOpen(false)} className="rounded-full">
                 <XCircle className="w-6 h-6 text-slate-600 dark:text-slate-400 hover:text-slate-600 dark:text-slate-400" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto flex flex-col font-sans">
              {cartContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
});
