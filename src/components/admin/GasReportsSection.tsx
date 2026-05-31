import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fuel, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";

export default function GasReportsSection({ reports, user, onGlobalRefresh }: any) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/gas-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          note,
          userName: user.name,
        }),
      });
      if (res.ok) {
        toast.success("El reporte de gas ha sido guardado exitosamente.");
        setAmount("");
        setNote("");
        if (onGlobalRefresh) onGlobalRefresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "No autorizado");
      }
    } catch (e) {
      toast.error("No se pudo conectar al servidor.");
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este reporte de gas?")) return;
    try {
      const res = await fetch(`/api/gas-reports/${id}`, {
        method: "DELETE",
        headers: { "x-user-email": user.email },
      });
      if (res.ok) {
        toast.success("Reporte eliminado");
        if (onGlobalRefresh) onGlobalRefresh();
      }
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shadow-inner">
          <Fuel className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reportes de Gas</h2>
          <p className="text-sm font-medium text-slate-500">Gestión y control de recargas de gas</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar Nueva Carga</CardTitle>
          <CardDescription>Añade un nuevo reporte de carga de gas al historial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 w-full md:w-1/3">
              <Label>Cantidad (Litros)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="Ej: 50.5" />
            </div>
            <div className="space-y-2 w-full md:w-1/2">
              <Label>Nota / Responsable</Label>
              <Input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: Recarga semanal" />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Registrar Carga
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de Reportes</CardTitle>
        </CardHeader>
        <CardContent>
          {(!reports || reports.length === 0) ? (
            <div className="text-center py-12 text-slate-500">No hay reportes de gas registrados.</div>
          ) : (
            <div className="space-y-4">
              {reports.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((report: any) => (
                <div key={report.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-100/50 rounded-lg flex items-center justify-center">
                      <Fuel className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{report.amount} Litros</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(report.timestamp).toLocaleString()} • {report.userName} {report.note ? `• ${report.note}` : ''}
                      </div>
                    </div>
                  </div>
                  {user.role === 'admin' && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(report.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
