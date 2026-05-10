/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Delegation, User } from "../../types";
import { apiFetch } from "../../lib/api";
import { maskEmail } from "../../lib/helpers";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import { Plus, UserPlus, Trash2, Building2, ShieldAlert, Fingerprint, CalendarDays, Activity, Users, ClipboardList, Globe, AlertTriangle } from "lucide-react";

interface GlobalManagementSectionProps {
  user: User;
  onDelegationCreated: () => void;
  delegations: Delegation[];
}

interface GlobalStats {
  totalUsers: number;
  totalRequests: number;
  activeDelegations: number;
  superAdmins: number;
  recentActivity: { 
    id: string; 
    action: string; 
    details: string; 
    timestamp: string; 
    user: string;
    delegationId?: string;
    delegationName?: string;
  }[];
}

export default function GlobalManagementSection({ user, onDelegationCreated, delegations }: GlobalManagementSectionProps) {
  const [userToRevoke, setUserToRevoke] = useState<{id: string, name: string} | null>(null);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [newDelName, setNewDelName] = useState("");
  const [masterAdminUserId, setMasterAdminUserId] = useState("");
  const [masterAdminPassword, setMasterAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [filterDelegationId, setFilterDelegationId] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const statsData = await apiFetch("/api/admin/global-stats");
        setStats(statsData);
        const usersData = await apiFetch("/api/admin/all-users");
        setGlobalUsers(usersData);
      } catch (e) {}
    };
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 60000); // Polling every 60s
    return () => clearInterval(interval);
  }, [delegations]);

  const filteredLogs = React.useMemo(() => {
    if (!stats?.recentActivity) return [];
    if (!filterDelegationId) return stats.recentActivity;
    return stats.recentActivity.filter(log => log.delegationId === filterDelegationId);
  }, [stats?.recentActivity, filterDelegationId]);

  const handleCreateDelegation = async () => {
    const selectedUser = globalUsers.find(u => u.id === masterAdminUserId);
    if (!newDelName || !selectedUser || !masterAdminPassword) {
      toast.error("Nombre, Usuario Administrador y Contraseña son campos requeridos");
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch("/api/global/delegations", {
        method: "POST",
        body: JSON.stringify({
          name: newDelName,
          masterAdminEmail: selectedUser.email,
          masterAdminPassword: masterAdminPassword
        })
      });
      toast.success("Nueva intendencia/delegación creada correctamente");
      setNewDelName("");
      setMasterAdminUserId("");
      setMasterAdminPassword("");
      onDelegationCreated();
    } catch (e: any) {
      toast.error(e.message || "Error al crear delegación");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeDelegation = async () => {
    if (!userToRevoke) return;

    try {
      setIsLoading(true);
      await apiFetch(`/api/global/delegations/${userToRevoke.id}`, {
        method: "DELETE"
      });
      toast.success(`Instancia ${userToRevoke.name} revocada permanentemente`);
      setUserToRevoke(null);
      onDelegationCreated();
    } catch (e: any) {
      toast.error(e.message || "Error al revocar instancia");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm("¿Desea eliminar este registro de la bitácora?")) return;

    try {
      await apiFetch(`/api/global/audit-logs/${logId}`, {
        method: "DELETE"
      });
      toast.success("Registro eliminado");
      // Refresh stats locally to update the UI immediately
      if (stats) {
        setStats({
          ...stats,
          recentActivity: stats.recentActivity.filter(log => log.id !== logId)
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar registro");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-purple-500" />
            Gestión Global de Intendencias
          </h2>
          <p className="text-slate-500 font-medium">Control total sobre la red descentralizada de delegaciones.</p>
        </div>
      </div>

      {/* Global Dashboard Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Jurisdicciones", value: stats?.activeDelegations || 0, icon: Globe, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Personal Total", value: stats?.totalUsers || 0, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Gestiones", value: stats?.totalRequests || 0, icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Super Admins", value: stats?.superAdmins || 0, icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`p-4 rounded-3xl border border-slate-100 shadow-sm ${item.bg}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-white shadow-sm">
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</span>
            </div>
            <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Delegation Card */}
        <Card className="lg:col-span-1 border-none shadow-2xl shadow-indigo-500/10 bg-gradient-to-br from-white to-slate-50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
          <CardHeader className="pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-2">
              <Plus className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle className="text-xl font-black text-slate-900 tracking-tight">
              Nueva Intendencia
            </CardTitle>
            <CardDescription className="font-medium">Expande la red de gestión regional.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nombre Identificador</label>
              <div className="relative group">
                <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                <Input 
                  placeholder="Ej: Delegación Central" 
                  value={newDelName}
                  onChange={(e) => setNewDelName(e.target.value)}
                  className="pl-10 h-12 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-visible:ring-purple-500 font-bold transition-all text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Administrador</label>
              <div className="relative group">
                <UserPlus className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                <select
                  value={masterAdminUserId}
                  onChange={(e) => setMasterAdminUserId(e.target.value)}
                  className="pl-10 h-11 w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-visible:ring-purple-500 font-bold transition-all text-slate-900 dark:text-slate-100 appearance-none"
                >
                  <option value="">Seleccione un usuario...</option>
                  {globalUsers.map((u, index) => (
                    <option key={`${u.id}-${u.email}-${index}`} value={u.id}>{u.name} - {maskEmail(u.email, user.email)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Clave de Acceso (Admin)</label>
              <div className="relative group">
                <ShieldAlert className="absolute left-3 top-3 w-4 h-4 text-slate-400 group-focus-within:text-purple-600 transition-colors" />
                <Input 
                  type="password"
                  placeholder="Defina la clave para administradores" 
                  value={masterAdminPassword}
                  onChange={(e) => setMasterAdminPassword(e.target.value)}
                  className="pl-10 h-11 rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus-visible:ring-purple-500 font-bold transition-all text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0 animate-pulse" />
                <p className="text-[9px] text-indigo-800 font-bold leading-relaxed">
                  Esta clave será requerida para el Administrador Maestro y sus administradores secundarios. Los cocineros ingresan directamente.
                </p>
              </div>
            </div>
            <Button 
              className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-slate-200 transition-all active:scale-95 group overflow-hidden relative"
              onClick={handleCreateDelegation}
              disabled={isLoading}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                   Protocolizar Instancia
                   <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* List of Delegations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-sm">
               Intendencias Existentes
               <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors h-5 px-1.5 font-black">{delegations.length}</Badge>
            </h3>
            <div className="w-12 h-1 bg-slate-200 rounded-full" />
          </div>
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {delegations.map((del, index) => (
                <motion.div
                  key={del.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                >
                  <Card 
                    className={`group border-slate-200 hover:border-purple-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-purple-500/10 overflow-hidden relative cursor-pointer ${filterDelegationId === del.id ? 'ring-2 ring-purple-500' : ''}`}
                    onClick={() => setFilterDelegationId(filterDelegationId === del.id ? null : del.id)}
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all transform translate-y-[-10px] group-hover:translate-y-0 duration-300">
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] uppercase font-black tracking-tighter px-2">
                        Sistema Operativo
                      </Badge>
                    </div>
                    
                    <CardContent className="p-0">
                      <div className="p-6">
                        <div className="flex items-start gap-5">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group-hover:from-purple-500 group-hover:to-indigo-600 transition-all duration-500 shrink-0 shadow-inner">
                              <Building2 className="w-7 h-7 text-slate-400 group-hover:text-white transition-colors duration-500" />
                            </div>
                            {index === 0 && (
                              <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
                                <Plus className="w-3 h-3 text-white rotate-45" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-xl font-black text-slate-900 group-hover:text-purple-900 transition-colors truncate tracking-tight">
                                {del.name}
                              </h4>
                              {index === 0 && (
                                <Badge className="bg-indigo-600 text-[8px] font-black uppercase h-4 px-1.5 leading-none tracking-widest ring-2 ring-indigo-100">Sede</Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 text-slate-400">
                               <Fingerprint className="w-3 h-3" />
                               <span className="text-[10px] font-mono font-black uppercase tracking-wider">ID: {del.id.split('-')[1] || del.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 space-y-3">
                          <div className="relative overflow-hidden group/admin p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-purple-50/50 group-hover:border-purple-100 transition-all">
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover/admin:border-purple-200 transition-colors">
                                <ShieldAlert className="w-4 h-4 text-purple-600" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover/admin:text-purple-400">Administrador Maestro</span>
                                <span className="text-sm font-bold text-slate-800 truncate dark:text-slate-200 group-hover/admin:text-purple-900">{maskEmail(del.masterAdminEmail, user.email)}</span>
                              </div>
                            </div>
                            <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          
                          <div className="flex items-center justify-between px-2 text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3 h-3" />
                              <span className="text-[10px] font-bold">Inaugurada: {new Date(del.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-1">
                              <div className="w-1 h-1 rounded-full bg-slate-200" />
                              <div className="w-1 h-1 rounded-full bg-slate-200" />
                              <div className="w-1 h-1 rounded-full bg-slate-200" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="px-6 pb-6 pt-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setUserToRevoke({ id: del.id, name: del.name })}
                          className="w-full h-11 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-100 hover:border-red-100 rounded-xl transition-all duration-300 font-black uppercase tracking-widest text-[10px]"
                          disabled={del.id === 'default'}
                        >
                          <Trash2 className="w-4 h-4 mr-2 transition-transform group-hover:rotate-12" />
                          Revocar Instancia
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      {/* Global Activity Log */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 leading-tight">
              {filterDelegationId 
                ? `Eventos: ${delegations.find(d => d.id === filterDelegationId)?.name}` 
                : "Bitácora de Eventos Globales"}
            </h3>
          </div>
          {filterDelegationId && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setFilterDelegationId(null)}
              className="h-9 w-full sm:w-auto text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 border border-indigo-100 sm:border-transparent rounded-xl"
            >
              Ver Todo lo Global
            </Button>
          )}
        </div>
        <Card className="rounded-3xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left min-w-[600px] sm:min-w-0">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Fecha/Hora</th>
                  {!filterDelegationId && <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Sede</th>}
                  <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Evento</th>
                  <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 hidden sm:table-cell">Detalles</th>
                  <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 hidden lg:table-cell">Usuario</th>
                  <th className="px-4 md:px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLogs && filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-3 h-3 text-slate-400 hidden xs:block" />
                          <span className="text-[10px] font-bold text-slate-600">
                            {new Date(log.timestamp).toLocaleString('es-AR', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                      </td>
                      {!filterDelegationId && (
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (log.delegationId) setFilterDelegationId(log.delegationId);
                            }}
                            className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter hover:bg-indigo-100 transition-colors truncate max-w-[100px]"
                          >
                            {log.delegationName || log.delegationId || 'GLOBAL'}
                          </button>
                        </td>
                      )}
                      <td className="px-4 md:px-6 py-4">
                        <Badge className={`bg-white border text-[8px] font-black uppercase tracking-tighter whitespace-nowrap ${
                          log.action.includes('ELIMINACION') || log.action.includes('RECHAZO') ? 'text-red-500 border-red-100' : 
                          log.action.includes('CREACION') || log.action.includes('APROBACION') ? 'text-emerald-500 border-emerald-100' : 
                          log.action.includes('NUEVA') || log.action.includes('REGISTRO') ? 'text-indigo-500 border-indigo-100' :
                          'text-slate-400 border-slate-100'
                        }`}>
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                        <span className="text-[10px] font-medium text-slate-600 line-clamp-1 hover:line-clamp-none transition-all">{log.details}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate max-w-[80px]">{maskEmail(log.user, user.email) || 'SISTEMA'}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={filterDelegationId ? 4 : 5} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center">
                        <Activity className="w-8 h-8 opacity-20 mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {filterDelegationId ? "No hay actividad registrada para esta sede" : "No hay registros de actividad todavía"}
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Dialog open={!!userToRevoke} onOpenChange={(open) => !open && setUserToRevoke(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-sm">
          <DialogHeader className="bg-red-600 text-white p-6">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmación Requerida
            </DialogTitle>
            <DialogDescription className="text-red-100 text-xs mt-1">
              Acción crítica irreversible
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 bg-white space-y-4">
            <p className="text-sm text-slate-600 text-center">
              ¿Está absolutamente seguro de que desea revocar la sede <br/>
              <strong className="text-slate-900 block text-lg mt-2">{userToRevoke?.name.toUpperCase()}</strong>?
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-red-500 text-center bg-red-50 py-2 rounded-lg">
              Esto borrará TODOS los perfiles, datos y expedientes de esta intendencia.
            </p>
          </div>
          <DialogFooter className="p-4 bg-slate-50 flex gap-2 sm:justify-center border-t border-slate-100">
            <Button variant="outline" onClick={() => setUserToRevoke(null)} className="flex-1 rounded-xl h-10 font-bold border-slate-200">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRevokeDelegation} disabled={isLoading} className="flex-1 rounded-xl h-10 font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20">
              {isLoading ? "Revocando..." : "Sí, Proceder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
