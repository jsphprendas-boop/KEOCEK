import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calculator, Package, TrendingUp, DollarSign, AlertCircle, Eye } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AccountingSection({ data }: any) {
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [selectedFlowMonth, setSelectedFlowMonth] = useState<string>("30days");

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    (data.movements || []).forEach((m: any) => {
       const date = new Date(m.timestamp);
       if (!isNaN(date.getTime())) {
         const yyyy = date.getFullYear();
         const mm = String(date.getMonth() + 1).padStart(2, '0');
         months.add(`${yyyy}-${mm}`);
       }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [data.movements]);

  const stats = useMemo(() => {
    let totalItems = 0;
    let lowStockItems = 0;
    let totalInSelected = 0;
    let totalOutSelected = 0;
    const categoryTotals: Record<string, number> = {};
    const criticalProducts: any[] = [];

    (data.products || []).forEach((p: any) => {
      const qty = parseFloat(p.quantity || "0");
      const customMin = parseFloat(p.minStock);
      const minQty = !isNaN(customMin) ? customMin : (data.settings?.criticalStockThreshold || 10);
      totalItems += qty;
      
      if (qty <= minQty) {
        lowStockItems++;
        criticalProducts.push({ ...p, computedMin: minQty });
      }

      if (qty > 0) {
        const cat = data.categories?.find((c: any) => c.id === p.categoryId)?.name || "Sin Categoría";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + qty;
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMovements = (data.movements || []).filter((m: any) => new Date(m.timestamp) >= thirtyDaysAgo);
    
    // Calculate volume over last 30 days per day for trend chart
    const dailyTrendMap: Record<string, { in: number, out: number }> = {};

    recentMovements.forEach((m: any) => {
       const qty = parseFloat(m.quantity || "0");
       const dateStr = new Date(m.timestamp).toLocaleDateString();
       
       if (!dailyTrendMap[dateStr]) dailyTrendMap[dateStr] = { in: 0, out: 0 };

       if (m.type === 'in') {
         dailyTrendMap[dateStr].in += qty;
       }
       if (m.type === 'out') {
         dailyTrendMap[dateStr].out += qty;
       }
    });

    // Flow for selected month
    (data.movements || []).forEach((m: any) => {
       const date = new Date(m.timestamp);
       if (isNaN(date.getTime())) return;
       const qty = parseFloat(m.quantity || "0");
       
       if (selectedFlowMonth === "30days") {
         if (date >= thirtyDaysAgo) {
           if (m.type === 'in') totalInSelected += qty;
           if (m.type === 'out') totalOutSelected += qty;
         }
       } else {
         const yyyy = date.getFullYear();
         const mm = String(date.getMonth() + 1).padStart(2, '0');
         if (`${yyyy}-${mm}` === selectedFlowMonth) {
           if (m.type === 'in') totalInSelected += qty;
           if (m.type === 'out') totalOutSelected += qty;
         }
       }
    });

    const chartData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    
    // Sort daily trend correctly by date
    const trendData = Object.entries(dailyTrendMap).map(([date, values]) => ({
      date,
      Entradas: values.in,
      Salidas: values.out
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10); // Last 10 active days

    return { totalItems, lowStockItems, totalInSelected, totalOutSelected, chartData, recentMovements, criticalProducts, trendData };
  }, [data, selectedFlowMonth]);

  const COLORS = ['#4f46e5', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981'];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center shadow-inner">
          <Calculator className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Contaduría y Analítica</h2>
          <p className="text-sm font-medium text-slate-500">Resumen, estadísticas y valorización de inventario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-indigo-100 font-medium text-sm">Total Unidades Físicas</p>
                <h3 className="text-3xl font-black mt-2">{stats.totalItems.toLocaleString()}</h3>
              </div>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-medium text-sm">SKUs (Variedad de prod.)</p>
                <h3 className="text-3xl font-black mt-2 text-slate-800">{(data.products || []).length}</h3>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div onClick={() => setIsCriticalModalOpen(true)}>
          <Card className="bg-white border-rose-200 cursor-pointer hover:border-rose-400 hover:shadow-lg hover:shadow-rose-500/10 transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 font-medium text-sm group-hover:text-rose-600 transition-colors">Items en Alerta (Resurtir) <Eye className="w-3 h-3 inline-block ml-1 opacity-50" /></p>
                  <h3 className="text-3xl font-black mt-2 text-rose-600">{stats.lowStockItems}</h3>
                </div>
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest pl-1">Flujo Operativo Mensual</h3>
          <Select value={selectedFlowMonth} onValueChange={setSelectedFlowMonth}>
            <SelectTrigger className="w-[180px] h-8 rounded-xl border-slate-200 bg-white font-medium text-slate-600 shadow-sm focus:ring-1 focus:ring-indigo-500 text-xs">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl">
               <SelectItem value="30days" className="rounded-lg font-medium cursor-pointer text-sm">Últimos 30 días</SelectItem>
               {availableMonths.map((m: string) => {
                   const [y, mm] = m.split('-');
                   const date = new Date(parseInt(y), parseInt(mm) - 1);
                   const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                   return <SelectItem key={m} value={m} className="rounded-lg capitalize font-medium cursor-pointer text-sm">{label}</SelectItem>
               })}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-white border-transparent shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 font-medium text-xs">Ingresos de Inventario</p>
                  <h3 className="text-2xl font-black mt-1 text-emerald-600">+{stats.totalInSelected.toLocaleString()} <span className="text-[10px] text-slate-400">unids. sumadas</span></h3>
                </div>
                <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-transparent shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 font-medium text-xs">Despachos de Inventario</p>
                  <h3 className="text-2xl font-black mt-1 text-rose-600">-{stats.totalOutSelected.toLocaleString()} <span className="text-[10px] text-slate-400">unids. restadas</span></h3>
                </div>
                <div className="w-8 h-8 bg-rose-100 rounded-xl flex items-center justify-center scale-y-[-1]">
                  <TrendingUp className="w-4 h-4 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Composición del Inventario</CardTitle>
            <CardDescription>Distribución física por categoría de producto</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {stats.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} unid.`, 'Stock']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">Sin datos registrados</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Artículos (Mayor Volumen)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data.products || []).slice().sort((a: any, b: any) => parseFloat(b.quantity || "0") - parseFloat(a.quantity || "0")).slice(0, 5).map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-600'}`}>{i+1}</div>
                      <div>
                        <div className="font-semibold text-sm text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{p.category || 'General'}</div>
                      </div>
                    </div>
                    <div className="font-black text-slate-800 text-base">{p.quantity} <span className="text-xs text-slate-500 font-medium">{p.unit}</span></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de Flujo Operativo (Últimos días)</CardTitle>
          <CardDescription>Gráfica de barras comparando niveles de ingresos contra niveles de despachos/uso.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {stats.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} />
                  <Legend wrapperStyle={{paddingTop: '20px'}} />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Salidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">Sin datos de movimientos recientes</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCriticalModalOpen} onOpenChange={setIsCriticalModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
               <AlertCircle className="w-5 h-5 text-rose-500" />
               Productos en Nivel Crítico ({stats.criticalProducts.length})
            </DialogTitle>
            <DialogDescription>
              Estos productos han alcanzado o superado su límite mínimo de stock establecido y requieren resurtido urgente.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2 py-4">
            {stats.criticalProducts.length === 0 && (
               <div className="text-center text-slate-500 py-10 opacity-60">
                 <Package className="w-12 h-12 mx-auto mb-3" />
                 Todos los productos tienen niveles de stock saludables.
               </div>
            )}
            {stats.criticalProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                 <div>
                   <h4 className="font-bold text-slate-800 flex items-center gap-2">
                     {p.name}
                     {parseFloat(p.quantity || "0") <= 0 ? (
                       <Badge variant="destructive" className="text-[9px]">Agotado</Badge>
                     ) : (
                       <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] border-none shadow-sm">A punto de acabarse</Badge>
                     )}
                   </h4>
                   <p className="text-xs text-slate-500 mt-1">Límite establecido: mínimo {p.computedMin}</p>
                 </div>
                 <div className="text-right">
                   <div className="text-xl font-black text-rose-600">{p.quantity} <span className="text-sm font-medium">{p.unit}</span></div>
                   <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">{p.location || 'N/A'}</div>
                 </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
