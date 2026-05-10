import React, { useMemo, useState } from "react";
import { DBData, User, Delegation } from "../../types";
import { 
  Users, 
  Trash2, 
  CheckCircle2, 
  XOctagon,
  UserX,
  User as UserIcon,
  Shield,
  AlertTriangle,
  Edit3,
  Download,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
 
import { apiFetch } from "../../lib/api";
import { maskEmail } from "../../lib/helpers";

interface UsersSectionProps {
  user: User;
  data: DBData;
  isSuperAdmin?: boolean;
  onGlobalRefresh?: () => void;
  allDelegations?: Delegation[];
}
 
export default function UsersSection({ user, data, isSuperAdmin, onGlobalRefresh, allDelegations }: UsersSectionProps) {
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string, delegationId?: string} | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [globalUsers, setGlobalUsers] = useState<User[]>([]);
  const [showGlobalUsers, setShowGlobalUsers] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    // No multi-delegation fetching needed
  }, [data.users]);

  const activeUsers = useMemo(() => {
    return data.users.filter(u => u.id !== "admin-main");
  }, [data.users]);

  const isMasterAdmin = user.email === "jsphprendas@gmail.com";

  const [userToApprove, setUserToApprove] = useState<User | null>(null);
  const [approveRole, setApproveRole] = useState("cook");
  const [approveDelegation, setApproveDelegation] = useState("");
  const [userToTransfer, setUserToTransfer] = useState<{id: string, name: string, currentDelegationId?: string} | null>(null);
  const [transferDelegationId, setTransferDelegationId] = useState("");

  const handleTransfer = async () => {
    if (!userToTransfer || !transferDelegationId) return;

    try {
      await apiFetch(`/api/admin/users/transfer`, {
        method: "POST",
        body: JSON.stringify({ 
          userId: userToTransfer.id,
          sourceDelegationId: userToTransfer.currentDelegationId,
          targetDelegationId: transferDelegationId 
        })
      });
      toast.success("Usuario transferido exitosamente");
      setUserToTransfer(null);
      setTransferDelegationId("");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al transferir usuario");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isMasterAdmin) {
      toast.error("Solo el Administrador Maestro puede cambiar roles");
      return;
    }
    try {
      await apiFetch(`/api/users/${userId}/change-role`, {
        method: "POST",
        body: JSON.stringify({ role: newRole })
      });
      toast.success("Tipo de acceso actualizado correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar el rol");
    }
  };

  const handleApprove = async (userId: string, role?: string) => {
    try {
      await apiFetch(`/api/users/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify(role ? { role } : {})
      });
      toast.success("Usuario aprobado exitosamente");
      setUserToApprove(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al aprobar usuario");
    }
  };

  const handleUpdateProfile = async () => {
    if (!userToEdit) return;
    setIsUpdating(true);
    try {
      await apiFetch(`/api/users/${userToEdit.id}/update-profile`, {
        method: "POST",
        body: JSON.stringify({ firstName: editFirstName, lastName: editLastName })
      });
      toast.success("Información actualizada correctamente");
      setUserToEdit(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar perfil");
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditDialog = (u: User) => {
    setUserToEdit(u);
    setEditFirstName(u.firstName || u.name.split(" ")[0]);
    setEditLastName(u.lastName || u.name.split(" ").slice(1).join(" "));
    setEditPassword(u.password || "");
  };

  const handleReject = async (userId: string) => {
    try {
      await apiFetch(`/api/users/${userId}/reject`, { method: "POST" });
      toast.success("Usuario rechazado exitosamente");
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Error al rechazar usuario");
    }
  };

  const confirmRemoveUser = async () => {
    if (!userToDelete) return;
    try {
      await apiFetch(`/api/users/${userToDelete.id}`, { method: "DELETE" });
      toast.success("Usuario eliminado exitosamente");
      setUserToDelete(null);
      if (onGlobalRefresh) onGlobalRefresh();
    } catch (e: any) {
      toast.error(e.message || "Hubo un problema al eliminar al usuario");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-900 tracking-tight flex items-center gap-2 text-sm md:text-base">
            <Users className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" /> 
            Gestión de Personal
            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 rounded-full font-mono text-[8px] md:text-[9px] uppercase tracking-widest px-2">
              {activeUsers.length}
            </Badge>
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500">Administre los accesos y registros del personal operativo</p>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {activeUsers.map(userItem => (
          <Card key={userItem.id} className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden group">
            <CardHeader className="p-4 md:p-5 pb-3 md:pb-4 border-b border-slate-50 flex flex-row items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                {userItem.picture ? (
                  <img 
                    src={userItem.picture} 
                    alt={userItem.name} 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-indigo-100 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold uppercase tracking-widest text-xs md:text-sm">
                    {userItem.name.substring(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm md:text-base font-bold text-slate-800 truncate">{userItem.name}</CardTitle>
                    {(isMasterAdmin || isSuperAdmin) && (
                      <button 
                        onClick={() => openEditDialog(userItem)}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {!(isMasterAdmin || isSuperAdmin) ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">
                        {userItem.role === "cook" ? "Cocinero" : userItem.role === "admin" ? "Administrador" : "Usuario Gestión"}
                      </span>
                    ) : (
                      <select 
                        className="text-[9px] font-black uppercase tracking-widest bg-transparent border-none text-indigo-600 focus:outline-none cursor-pointer"
                        value={userItem.role}
                        onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                      >
                        <option value="cook">Cocinero</option>
                        <option value="admin">Administrador</option>
                        <option value="viewer">Usuario Gestión</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <Badge 
                  variant="secondary" 
                  className={`border-none rounded-full px-1.5 md:px-2 py-0.5 text-[8px] md:text-[9px] font-bold uppercase shrink-0 ${
                    userItem.isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {userItem.isApproved ? 'Activo' : 'Pendiente'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-5 space-y-3 md:space-y-4">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="space-y-1">
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Correo</p>
                  <p className="text-xs md:text-sm font-medium text-slate-700 truncate">{maskEmail(userItem.email, user.email)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Último Ingreso</p>
                  <p className="text-xs md:text-sm font-medium text-slate-700 truncate">
                    {userItem.lastLoginAt ? (
                      <span title={new Date(userItem.lastLoginAt).toLocaleString()}>
                        {new Date(userItem.lastLoginAt).toLocaleDateString()}
                      </span>
                    ) : "Nunca"}
                  </p>
                </div>
              </div>

              {(isMasterAdmin || isSuperAdmin) && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  {!userItem.isApproved ? (
                    <div className="flex gap-2 w-full">
                      <Button 
                        className="flex-1 h-8 md:h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] md:text-xs font-bold"
                        onClick={() => {
                          setUserToApprove(userItem);
                          setApproveRole(userItem.role || "cook");
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1.5" /> Aprobar
                      </Button>
                      <Button 
                        variant="outline"
                        className="flex-1 h-8 md:h-9 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl text-[10px] md:text-xs font-bold"
                        onClick={() => handleReject(userItem.id)}
                      >
                        <XOctagon className="w-3 h-3 mr-1.5" /> Denegar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        className="h-8 md:h-9 text-[10px] md:text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 w-full rounded-xl"
                        onClick={() => setUserToDelete({ id: userItem.id, name: userItem.name, delegationId: userItem.delegationId })}
                      >
                        <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5 mr-2" /> Eliminar Acceso
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {activeUsers.length === 0 && (
          <div className="col-span-full h-64 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400">
            <UserX className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No hay personal operativo registrado</p>
          </div>
        )}
      </div>

      {/* Approve User Dialog */}
      <Dialog open={!!userToApprove} onOpenChange={(open) => !open && setUserToApprove(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-md bg-white">
          <DialogHeader className="bg-emerald-600 text-white p-6">
            <DialogTitle className="text-lg font-black tracking-tight">Aprobar Acceso de Usuario</DialogTitle>
            <DialogDescription className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">
              Configurar rol y sede para {userToApprove?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol Asignado</Label>
              <select 
                value={approveRole}
                onChange={(e) => setApproveRole(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border-slate-200 focus:ring-emerald-500 h-12 text-sm font-bold pl-4"
              >
                <option value="cook">Cocinero</option>
                <option value="admin">Administrador</option>
                <option value="viewer">Usuario Gestión</option>
              </select>
            </div>
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delegación Asignada</Label>
                <select 
                  value={approveDelegation}
                  onChange={(e) => setApproveDelegation(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border-slate-200 focus:ring-emerald-500 h-12 text-sm font-bold pl-4"
                >
                  <option value="">Seleccionar Sede...</option>
                  {allDelegations?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
            <Button variant="ghost" onClick={() => setUserToApprove(null)} className="flex-1 rounded-xl h-12 font-bold text-slate-500 uppercase tracking-widest text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={() => userToApprove && handleApprove(userToApprove.id, approveRole)} 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 rounded-xl h-12 font-bold uppercase tracking-widest text-xs"
            >
              Aprobar Acceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToTransfer} onOpenChange={(open) => !open && setUserToTransfer(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-md bg-white">
          <DialogHeader className="bg-indigo-600 text-white p-6">
            <DialogTitle className="text-lg font-black tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Transferir Usuario
            </DialogTitle>
            <DialogDescription className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">
              Mover a {userToTransfer?.name} a otra intendencia
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delegación Destino</Label>
              <select 
                value={transferDelegationId}
                onChange={(e) => setTransferDelegationId(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border-slate-200 focus:ring-indigo-500 h-12 text-sm font-bold pl-4"
              >
                <option value="">Seleccionar Sede...</option>
                {allDelegations?.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Sede Actual</p>
              <p className="text-sm font-bold text-slate-700 text-center">
                {allDelegations?.find(d => d.id === userToTransfer?.currentDelegationId)?.name || "Sin delegación"}
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
            <Button variant="ghost" onClick={() => setUserToTransfer(null)} className="flex-1 rounded-xl h-12 font-bold text-slate-500 uppercase tracking-widest text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={!transferDelegationId}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-xl h-12 font-bold uppercase tracking-widest text-xs"
            >
              Confirmar Transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-sm">
          <DialogHeader className="bg-red-600 text-white p-6">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmación Requerida
            </DialogTitle>
            <DialogDescription className="text-red-100 text-xs mt-1">
              Acción irreversible de seguridad
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 bg-white space-y-4">
            <p className="text-sm text-slate-600 text-center">
              ¿Está absolutamente seguro de que desea eliminar al usuario <br/>
              <strong className="text-slate-900 block text-lg mt-2">{userToDelete?.name}</strong>?
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-red-500 text-center bg-red-50 py-2 rounded-lg">
              Esta cuenta perderá el acceso inmediatamente
            </p>
          </div>
          <DialogFooter className="p-4 bg-slate-50 flex gap-2 sm:justify-center border-t border-slate-100">
            <Button variant="outline" onClick={() => setUserToDelete(null)} className="flex-1 rounded-xl h-10 font-bold border-slate-200">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmRemoveUser} className="flex-1 rounded-xl h-10 font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20">
              Sí, Eliminar
            </Button>
            {isSuperAdmin && (
              <Button 
                variant="destructive" 
                onClick={async () => {
                   try {
                     await apiFetch(`/api/admin/users/${userToDelete?.id}/purge`, { method: "DELETE" });
                     toast.success("Usuario purgado exitosamente de la app");
                     setUserToDelete(null);
                     if (onGlobalRefresh) onGlobalRefresh();
                   } catch(e: any) {
                     toast.error(e.message || "Error al purgar usuario");
                   }
                }}
                className="flex-1 rounded-xl h-10 font-bold bg-red-900 hover:bg-red-950 text-white shadow-md shadow-red-900/20"
              >
                Purgar Permanentemente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Profile Dialog */}
      <Dialog open={!!userToEdit} onOpenChange={(open) => !open && setUserToEdit(null)}>
        <DialogContent className="border-none rounded-2xl shadow-2xl p-0 overflow-hidden max-w-md bg-white">
          <DialogHeader className="bg-slate-900 text-white p-6">
            <DialogTitle className="text-lg font-black tracking-tight">Editar Información Personal</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
              Actualizar Nombres y Apellidos
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombres</Label>
                <Input 
                  value={editFirstName} 
                  onChange={e => setEditFirstName(e.target.value)}
                  placeholder="Ej. Juan"
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Apellidos</Label>
                <Input 
                  value={editLastName} 
                  onChange={e => setEditLastName(e.target.value)}
                  placeholder="Ej. Pérez"
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Vista Previa</p>
              <p className="text-sm font-bold text-slate-700 text-center">
                {editFirstName || "..."} {editLastName || "..."}
              </p>
            </div>
            {(isMasterAdmin || isSuperAdmin) && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establecer Clave de Acceso Personal (Opcional)</Label>
                <Input 
                  type="password"
                  value={editPassword} 
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Dejar vacío para usar clave de delegación"
                  className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500 text-slate-900 dark:text-slate-100 h-12"
                />
                <p className="text-[9px] text-slate-500 italic">Los administradores también pueden usar la clave general de la delegación.</p>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
            <Button variant="ghost" onClick={() => setUserToEdit(null)} className="flex-1 rounded-xl h-12 font-bold text-slate-500 uppercase tracking-widest text-xs">
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateProfile} 
              disabled={isUpdating}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-xl h-12 font-bold uppercase tracking-widest text-xs"
            >
              {isUpdating ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
