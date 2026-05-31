import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Trash2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

interface NotificationHistoryItem {
  message: string;
  type?: string;
  timestamp: number;
}

interface NotificationCenterProps {
  notifications: NotificationHistoryItem[];
  onClear: () => void;
  onRemove: (timestamp: number) => void;
  isMasterAdmin?: boolean;
}

export function NotificationCenter({ notifications, onClear, onRemove, isMasterAdmin }: NotificationCenterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`relative h-11 w-11 md:h-12 md:w-12 rounded-2xl flex items-center justify-center ${isMasterAdmin ? 'text-amber-500 hover:bg-amber-500/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'} transition-all`}>
        <Bell className="w-5 h-5 md:w-6 md:h-6" />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-[340px] md:w-[380px] p-0 overflow-hidden rounded-2xl border-slate-200">
        <div className={`p-4 ${isMasterAdmin ? 'bg-amber-500 text-black' : 'bg-slate-900 text-white'} flex items-center justify-between`}>
           <div>
             <h3 className="font-bold tracking-tight">Centro de Notificaciones</h3>
             <p className={`text-xs opacity-80`}>Historial de alertas recientes</p>
           </div>
           {notifications.length > 0 && (
             <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onClear(); }} className={`h-8 w-8 hover:bg-black/20 text-white`}>
               <Trash2 className="w-4 h-4" />
             </Button>
           )}
        </div>
        
        <div className="p-0">
          <ScrollArea className="h-[350px]">
            {notifications.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 text-center opacity-50">
                 <CheckCircle className="w-10 h-10 mb-3 text-slate-400" />
                 <p className="font-medium text-sm">Has leído todo</p>
                 <p className="text-xs">No hay notificaciones recientes</p>
               </div>
            ) : (
               <div className="flex flex-col divide-y divide-slate-100">
                 {notifications.map((n, i) => (
                    <div key={`${n.timestamp}-${i}`} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors group">
                       <div className="mt-0.5 shrink-0">
                         {n.type === 'critical_stock' || n.type === 'gas' ? (
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                         ) : n.type === 'request' ? (
                            <Info className="w-5 h-5 text-indigo-500" />
                         ) : (
                            <Bell className="w-5 h-5 text-slate-400" />
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-tight">{n.message}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1.5">
                             {formatDistanceToNow(n.timestamp, { addSuffix: true, locale: es })}
                          </p>
                       </div>
                       <Button 
                         variant="ghost" 
                         size="icon" 
                         className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded-md shrink-0 transition-all"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           onRemove(n.timestamp);
                         }}
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </Button>
                    </div>
                 ))}
               </div>
            )}
          </ScrollArea>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
