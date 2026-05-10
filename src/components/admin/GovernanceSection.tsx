import React, { useState, useMemo } from "react";
import { User, DBData, AuditEntry, GovernancePolicy, WorkflowInstance } from "../../types";
import { 
  ShieldCheck, 
  History, 
  FileLock2, 
  Gavel, 
  Search, 
  Plus, 
  Filter, 
  Download, 
  AlertCircle,
  Activity,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "motion/react";
import { exportToExcel } from "../../lib/exportUtils";

interface GovernanceSectionProps {
  user: User;
  data: DBData;
  onRefresh?: () => void;
}

export default function GovernanceSection({ user, data, onRefresh }: GovernanceSectionProps) {
  const [activeTab, setActiveTab] = useState("audit");
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const audits = useMemo(() => {
    let logs = data.auditEntries || [];
    if (searchTerm) {
      logs = logs.filter(l => 
        l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.entityId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (severityFilter) {
      logs = logs.filter(l => l.severity === severityFilter);
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [data.auditEntries, searchTerm, severityFilter]);

  const policies = useMemo(() => data.governancePolicies || [
    { 
      id: "pol-1", 
      name: "Doble Verificación en Egresos", 
      description: "Requiere aprobación de 2 administradores para salidas mayores a 50 unidades.", 
      isEnabled: true, 
      value: 50, 
      lastUpdatedBy: "Admin", 
      lastUpdatedAt: new Date().toISOString() 
    },
    { 
      id: "pol-2", 
      name: "Control de PII (Datos Sensibles)", 
      description: "Ocultar apellidos y correos en reportes estándar para cocineros.", 
      isEnabled: false, 
      value: null, 
      lastUpdatedBy: "System", 
      lastUpdatedAt: new Date().toISOString() 
    },
    { 
      id: "pol-3", 
      name: "Retención de Registros", 
      description: "Días que permanecen los registros en el sistema antes de archivado automático.", 
      isEnabled: true, 
      value: 365, 
      lastUpdatedBy: "Admin", 
      lastUpdatedAt: new Date().toISOString() 
    }
  ], [data.governancePolicies]);

  const workflows = useMemo(() => data.workflows || [], [data.workflows]);

  const handleExportAudit = () => {
    const formatted = audits.map(a => ({
      "Timestamp": format(new Date(a.timestamp), "PPpp", { locale: es }),
      "Usuario": a.userName,
      "Acción": a.action,
      "Entidad": a.entityType,
      "ID Entidad": a.entityId,
      "Severidad": a.severity.toUpperCase(),
      "Detalle": JSON.stringify(a.metadata || {})
    }));
    exportToExcel(formatted, "Reporte_Auditoria_Gobernanza");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            GOBERNANZA E INTELIGENCIA
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 ml-11">
            Gestión de cumplimiento, auditoría y flujos de trabajo empresariales
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportAudit}
            className="rounded-xl border-indigo-200 text-indigo-700 font-black text-[10px] uppercase tracking-widest h-10 px-4"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Auditoría
          </Button>
          <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest h-10 px-4 shadow-lg shadow-indigo-200">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Política
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 h-14 flex items-stretch gap-1 w-full md:w-auto overflow-x-auto">
          <TabsTrigger value="audit" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 px-6">
            <History className="w-4 h-4" /> Auditoría
          </TabsTrigger>
          <TabsTrigger value="policies" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 px-6">
            <Gavel className="w-4 h-4" /> Políticas
          </TabsTrigger>
          <TabsTrigger value="workflows" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 px-6">
            <GitBranch className="w-4 h-4" /> Flujos Active
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 px-6">
            <ShieldAlert className="w-4 h-4" /> Seguridad SSO
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="security" className="m-0 focus-visible:outline-none">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                      <ShieldAlert className="w-6 h-6 text-red-600" />
                      Configuración de Seguridad Enterprise
                    </h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Sincronizado con Google Identity Platform</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                       <h4 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-4">Políticas de Autenticación</h4>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-700">Forzar SSO (Google) para Administradores</span>
                                <span className="text-[10px] text-slate-400 font-medium italic">Impide el uso de claves locales para cuentas admin.</span>
                             </div>
                             <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                             </div>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-700">Requerir Verificación de Email</span>
                                <span className="text-[10px] text-slate-400 font-medium italic">Solo permite usuarios Google con email verificado.</span>
                             </div>
                             <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="p-6 border border-amber-100 bg-amber-50/30 rounded-3xl">
                       <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
                         <AlertCircle className="w-4 h-4" /> Alerta de Cumplimiento
                       </h4>
                       <p className="text-xs font-bold text-amber-700/80 leading-relaxed uppercase tracking-tighter">
                         El sistema está operando bajo la norma de gobernanza v5.0. No se permite la eliminación definitiva de registros sin que pasen por el estado 'Papelera' por 30 días.
                       </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center p-12 bg-indigo-900 rounded-[3rem] text-white text-center shadow-2xl shadow-indigo-200">
                     <ShieldCheck className="w-20 h-20 text-white mb-6 animate-pulse" />
                     <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">SSO Status: PROTECTED</h3>
                     <p className="text-indigo-300 font-bold text-[10px] uppercase tracking-widest">Single Sign-On Enforced via Google KMS</p>
                     <div className="mt-8 flex gap-4 w-full max-w-xs">
                        <Button className="flex-1 bg-white text-indigo-900 font-black rounded-2xl h-14 hover:bg-slate-100 uppercase tracking-widest text-[10px]">Rotar Llaves</Button>
                        <Button variant="outline" className="flex-1 border-white/20 text-white font-black rounded-2xl h-14 hover:bg-white/10 uppercase tracking-widest text-[10px]">Logs Auth</Button>
                     </div>
                  </div>
               </div>
            </div>
          </TabsContent>
          <TabsContent value="audit" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-indigo-600" />
                    </div>
                    <Badge className="bg-indigo-600 text-white border-none rounded-full px-3 py-1 font-black text-[10px]">TOTAL</Badge>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{audits.length}</h3>
                  <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1">Registros de Actividad</p>
                </CardContent>
              </Card>
              <Card className="rounded-[2rem] border-none shadow-xl shadow-red-200/50 overflow-hidden bg-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <Badge className="bg-red-600 text-white border-none rounded-full px-3 py-1 font-black text-[10px]">CRÍTICO</Badge>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {audits.filter(a => a.severity === 'critical' || a.severity === 'high').length}
                  </h3>
                  <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1">Alertas de Seguridad</p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
               <div className="flex flex-col md:flex-row gap-4 mb-8">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <Input 
                      placeholder="Buscar por usuario, acción o ID..." 
                      className="pl-12 h-12 rounded-2xl border-slate-200 focus-visible:ring-indigo-600 font-medium"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high', 'critical'].map(sev => (
                      <Button
                        key={sev}
                        variant={severityFilter === sev ? "default" : "outline"}
                        onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                        className={`rounded-xl h-12 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                          severityFilter === sev 
                          ? (sev === 'critical' ? 'bg-red-600' : sev === 'high' ? 'bg-orange-600' : 'bg-indigo-600')
                          : 'border-slate-200'
                        }`}
                      >
                        {sev}
                      </Button>
                    ))}
                  </div>
               </div>

               <div className="overflow-hidden rounded-3xl border border-slate-100">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha/Hora</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Usuario</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Acción</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Severidad</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">ID Entidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {audits.length > 0 ? audits.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-xs font-bold text-slate-900">{format(new Date(log.timestamp), "dd/MM/yyyy")}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{format(new Date(log.timestamp), "HH:mm:ss")}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 uppercase">
                                {log.userName.slice(0, 2)}
                              </div>
                              <span className="text-sm font-bold text-slate-700">{log.userName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-[10px] font-black uppercase tracking-widest ${
                              log.severity === 'critical' ? 'text-red-600' :
                              log.severity === 'high' ? 'text-orange-600' :
                              log.severity === 'medium' ? 'text-indigo-600' : 'text-slate-400'
                            }`}>
                              {log.severity}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">{log.entityId}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="p-20 text-center">
                             <div className="w-16 h-16 bg-slate-50 rounded-3xl mx-auto flex items-center justify-center mb-6">
                               <Search className="w-8 h-8 text-slate-200" />
                             </div>
                             <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No se encontraron registros de auditoría</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
            </div>
          </TabsContent>

          <TabsContent value="policies" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {policies.map(policy => (
                 <motion.div key={policy.id} whileHover={{ y: -5 }}>
                   <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden group">
                     <CardHeader className="pb-2">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`w-12 h-12 ${policy.isEnabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'} rounded-2xl flex items-center justify-center transition-colors`}>
                            <FileLock2 className="w-6 h-6" />
                          </div>
                          <div className="flex flex-col items-end">
                             <Badge className={`${policy.isEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'} border-none rounded-full px-3 py-1 font-black text-[9px] uppercase tracking-widest`}>
                               {policy.isEnabled ? 'ACTIVA' : 'DESACTIVADA'}
                             </Badge>
                          </div>
                        </div>
                        <CardTitle className="text-xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                          {policy.name}
                        </CardTitle>
                        <CardDescription className="text-xs font-bold leading-relaxed pt-2 line-clamp-2">
                          {policy.description}
                        </CardDescription>
                     </CardHeader>
                     <CardContent className="pt-4">
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3 mb-6">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <span>Valor Umbral</span>
                              <span className="text-slate-900">{policy.value || 'N/A'}</span>
                           </div>
                           <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <span>Actualizado por</span>
                              <span className="text-slate-900">{policy.lastUpdatedBy}</span>
                           </div>
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest h-11">Editar</Button>
                          <Button 
                             variant="outline" 
                             className={`flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest h-11 ${policy.isEnabled ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}`}
                          >
                            {policy.isEnabled ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                     </CardContent>
                   </Card>
                 </motion.div>
               ))}
            </div>
          </TabsContent>

          <TabsContent value="workflows" className="m-0 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/60 border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <GitBranch className="w-6 h-6 text-indigo-600" />
                    Intancias de Flujo Activas
                  </h3>
                  <Badge className="bg-slate-100 text-slate-500 border-none rounded-full px-3 py-1 font-black text-[10px]">
                    {workflows.length} EN CURSO
                  </Badge>
                </div>

                <ScrollArea className="h-[500px] pr-4">
                  {workflows.length > 0 ? (
                    <div className="space-y-4">
                      {workflows.map((wf) => (
                        <div key={wf.id} className="p-6 border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all hover:bg-slate-50 group">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center font-black text-indigo-600 text-sm focus:ring-0">
                                    {wf.type === 'request' ? 'RQ' : 'SY'}
                                 </div>
                                 <div className="focus:ring-0">
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">{wf.title}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">INICIADO EL {format(new Date(wf.startedAt), "dd/MM HH:mm")}</p>
                                 </div>
                              </div>
                              <Badge className={`${
                                wf.status === 'completed' ? 'bg-emerald-500' : 
                                wf.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                              } text-white border-none rounded-full font-black text-[9px] uppercase tracking-widest focus:ring-0`}>
                                {wf.status}
                              </Badge>
                           </div>
                           
                           <div className="flex items-center justify-between gap-2 mt-6 overflow-x-auto pb-2">
                              {wf.stages.map((stage, idx) => (
                                <React.Fragment key={stage.id}>
                                  <div className="flex flex-col items-center gap-2 flex-1 min-w-[60px]">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                      stage.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                                      stage.status === 'reviewing' ? 'bg-amber-100 text-amber-600 animate-pulse' :
                                      'bg-slate-100 text-slate-400'
                                    }`}>
                                      {stage.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter text-center line-clamp-1">{stage.name}</span>
                                  </div>
                                  {idx < wf.stages.length - 1 && (
                                    <div className="w-8 h-px bg-slate-100 mt-4 shrink-0" />
                                  )}
                                </React.Fragment>
                              ))}
                           </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                       <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                          <GitBranch className="w-10 h-10 text-slate-200" />
                       </div>
                       <h3 className="text-xl font-black text-slate-300 uppercase tracking-tight">No hay flujos activos</h3>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs">Los procesos de aprobación aparecerán aquí automáticamente.</p>
                       <Button className="mt-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-8 shadow-xl shadow-indigo-200 h-14">Optimizar Flujos</Button>
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-6">
                <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-slate-900 text-white overflow-hidden">
                  <CardHeader className="p-8">
                    <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck className="w-5 h-5 text-indigo-400" /> Motor de Flujos
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Configuración del motor de reglas</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Auto-Escalación</span>
                        <div className="w-10 h-5 bg-indigo-600 rounded-full flex items-center px-1">
                          <div className="w-3 h-3 bg-white rounded-full ml-auto" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Auditoría Real</span>
                        <div className="w-10 h-5 bg-emerald-500 rounded-full flex items-center px-1">
                          <div className="w-3 h-3 bg-white rounded-full ml-auto" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-500/20">
                       <h4 className="font-black uppercase text-xs tracking-widest mb-2 italic">Tip de Gobernanza</h4>
                       <p className="text-[10px] font-bold leading-relaxed text-indigo-100 opacity-80 uppercase tracking-tighter">
                         Active la 'Auto-Escalación' para que pedidos urgentes sin revisar en 30 min pasen a un Administrador Global.
                       </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden p-8">
                   <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest mb-6">Métricas de Proceso</h4>
                   <div className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                           <span>Tiempo Aprobación</span>
                           <span className="text-indigo-600 font-black">1.2h</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="w-[40%] h-full bg-indigo-600 rounded-full" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                           <span>Tasa de Rechazo</span>
                           <span className="text-red-500 font-black">4.5%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="w-[15%] h-full bg-red-500 rounded-full" />
                        </div>
                      </div>
                   </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
