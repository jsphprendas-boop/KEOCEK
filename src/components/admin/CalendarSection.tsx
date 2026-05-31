import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarIcon, Package, Fuel, ShieldAlert } from "lucide-react";

export default function CalendarSection({ data }: any) {
  const events = useMemo(() => {
    let allEvents: any[] = [];
    
    (data.movements || []).forEach((m: any) => {
      allEvents.push({
        id: m.id,
        timestamp: new Date(m.timestamp),
        type: 'movement',
        title: `${m.type === 'in' ? 'Entrada' : 'Salida'}: ${m.productName}`,
        details: `${m.quantity} ${m.unit || ''}`,
        user: m.note || "N/A"
      });
    });

    (data.gasReports || []).forEach((g: any) => {
      allEvents.push({
        id: g.id,
        timestamp: new Date(g.timestamp),
        type: 'gas',
        title: `Carga de Gas`,
        details: `${g.amount} Litros`,
        user: g.userName || "N/A"
      });
    });

    return allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center shadow-inner">
          <CalendarIcon className="w-6 h-6 text-sky-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Calendario Operativo</h2>
          <p className="text-sm font-medium text-slate-500">Línea de tiempo de todos los eventos del sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial Reciente</CardTitle>
          <CardDescription>Eventos ocurridos en la última semana</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative border-l border-slate-200 ml-4 py-2 space-y-8">
            {events.slice(0, 50).map((event) => (
              <div key={event.id} className="relative pl-8">
                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center
                  ${event.type === 'gas' ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                  {event.type === 'gas' ? <Fuel className="w-3 h-3 text-white" /> : <Package className="w-3 h-3 text-white" />}
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                    <h4 className="font-bold text-slate-800">{event.title}</h4>
                    <span className="text-xs font-semibold text-slate-400">
                      {event.timestamp.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{event.details}</p>
                  <p className="text-xs text-slate-400 mt-2">Responsable / Nota: {event.user}</p>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-slate-500 text-center py-8">No hay eventos recientes registrados.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
