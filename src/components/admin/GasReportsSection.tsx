import React from "react";
import { GasReport, User } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Fuel, Download, Trash2, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "../../lib/exportUtils";
import { toast } from "sonner";

interface GasReportsSectionProps {
  reports: GasReport[];
  user: User;
}

export default function GasReportsSection({ reports, user }: GasReportsSectionProps) {
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este reporte de gas? Se enviará a la papelera.")) return;
    try {
      const res = await fetch(`/api/gas-reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Reporte eliminado");
      } else {
        toast.error("Error al eliminar el reporte");
      }
    } catch (e) {
      toast.error("Error de conexión");
    }
  };
  const handleExportGas = () => {
    const formattedData = reports.map(g => ({
      "Fecha": new Date(g.timestamp).toLocaleDateString(),
      "Hora": new Date(g.timestamp).toLocaleTimeString(),
      "Litros": g.amount,
      "Reportó": g.userName || "N/A",
      "Nota": g.note || ""
    }));
    exportToExcel(formattedData, "Reportes_Gas");
  };

  const handleExportGasPDF = () => {
    const formattedData = reports.map(g => ({
      "Fecha": format(new Date(g.timestamp), "dd/MM/yyyy"),
      "Hora": format(new Date(g.timestamp), "HH:mm"),
      "Litros": `${g.amount} L`,
      "Responsable": g.userName || "N/A",
      "Nota": g.note || "-"
    }));
    exportToPDF(formattedData, "Reportes_Gas", "REPORTE DE CONSUMO DE GAS");
  };

  const groupedReports = reports.reduce((acc, report) => {
    const dateKey = format(new Date(report.timestamp), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(report);
    return acc;
  }, {} as Record<string, GasReport[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
        <h3 className="font-bold text-slate-800 uppercase tracking-tight">Reportes de Gas</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={handleExportGas}
            disabled={reports.length === 0}
          >
            <Download className="w-3.5 h-3.5 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl font-bold uppercase text-[10px] tracking-widest border-red-200 text-red-600 hover:bg-red-50"
            onClick={handleExportGasPDF}
            disabled={reports.length === 0}
          >
            <FileText className="w-3.5 h-3.5 mr-2" />
            PDF
          </Button>
        </div>
      </div>
      {Object.keys(groupedReports).sort((a, b) => b.localeCompare(a)).map(date => (
        <Card key={date} className="border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">
              {format(new Date(date + "T12:00:00"), "d 'de' MMMM", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {groupedReports[date].map(report => (
              <div key={report.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-orange-100">
                    <Fuel className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{report.userName}</p>
                    {report.note && <p className="text-xs text-slate-500 italic">{report.note}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-lg font-black text-orange-600">{report.amount} L</p>
                    <p className="text-[10px] text-slate-400 font-mono">{format(new Date(report.timestamp), 'HH:mm')}</p>
                  </div>
                  {user.role === "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteReport(report.id)}
                      className="text-slate-300 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      {reports.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <p className="text-sm font-bold uppercase tracking-widest">Sin reportes de gas</p>
        </div>
      )}
    </div>
  );
}
