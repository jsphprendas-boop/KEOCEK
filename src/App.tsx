/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { socket, socketEvents } from "@/src/lib/socket";
import { DBData, User, Delegation } from "./types";
import { apiFetch } from "./lib/api";
import { Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "./lib/firebase";
import { signOut } from "firebase/auth";
import { isSuperAdminEmail } from "./lib/helpers";
import { motion, AnimatePresence } from "motion/react";

// Pages
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import CookDashboard from "./components/CookDashboard";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("ia_user");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch(e) {
          localStorage.removeItem("ia_user");
          return null;
        }
      }
    } catch(e) {
      console.error("Local storage access denied:", e);
    }
    return null;
  });
  const [dbData, setDbData] = useState<DBData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<{message: string, type?: string, timestamp: number}[]>([]);
  const [currentDelegationId, setCurrentDelegationId] = useState<string>("default");

  // Handle delegation change
  const handleDelegationChange = (id: string) => {
    // Single delegation mode: always default
    setCurrentDelegationId("default");
  };

  // We need a ref for the current user to avoid closure staleness in socket listeners
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    socket.on(socketEvents.DB_UPDATE, (data: DBData) => {
      setDbData(data);
    });

    socket.on(socketEvents.NOTIFICATION, (notif: { message: string, type?: string, targetRole?: string, isUrgent?: boolean }) => {
      const currentUser = userRef.current;
      
      // Filter by role
      if (notif.targetRole === 'superadmin') {
         if (!isSuperAdminEmail(currentUser?.email)) return;
      } else if (notif.targetRole && notif.targetRole !== 'superadmin' && currentUser?.role !== notif.targetRole) {
        return;
      }

      // Add to history
      setNotificationHistory(prev => [{ 
        message: notif.message, 
        type: notif.type, 
        timestamp: Date.now() 
      }, ...prev].slice(0, 50));

      // Determine importance
      const isUrgent = notif.isUrgent || notif.type === 'critical_stock';

      // Show Sonner Toast
      if (isUrgent) {
        toast.error(notif.message, { 
          duration: 10000,
          style: { 
            background: "#ef4444", 
            color: "white", 
            border: "2px solid rgba(255,255,255,0.2)",
            fontWeight: "900",
            letterSpacing: "0.02em",
            fontSize: "14px",
            boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
            borderRadius: "16px"
          }
        });
      } else {
        toast.info(notif.message, {
          duration: 6000,
          style: {
            background: notif.type === 'request' ? '#6366f1' : '#1e293b',
            color: 'white',
            border: 'none',
            fontWeight: "700",
            borderRadius: "16px",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
          }
        });
      }
      
      // Try Browser Native Notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("INTENDENCIA AUTONOMA", {
          body: notif.message,
          icon: "/favicon.ico"
        });
      }

      // Audio Alert
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = isUrgent ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(isUrgent ? 1100 : 880, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(isUrgent ? 440 : 440, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isUrgent ? 0.8 : 0.5));
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + (isUrgent ? 0.8 : 0.5));
      } catch(e) {
        console.error("Audio play failed", e);
      }
    });

    // Request Notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Initial socket join
    socket.emit(socketEvents.JOIN_DELEGATION, currentDelegationId);

    // Initial fetch
    loadData(currentDelegationId);

    return () => {
      socket.off(socketEvents.DB_UPDATE);
      socket.off(socketEvents.NOTIFICATION);
    };
  }, []);

  const loadData = async (delId: string) => {
    try {
      setLoadError(null);
      const data = await apiFetch("/api/db", {
        headers: { "x-delegation-id": delId }
      });
      setDbData(data);
      
      // Verification of user state only for non-superadmin and sessioned users
      const currentUser = userRef.current;
      
      // SUPER ADMIN DEFINITIVE BYPASS
      if (isSuperAdminEmail(currentUser?.email)) {
        console.log("Super Admin session detected, bypassing revocation check.");
        return;
      }
      
      // If data is not fully loaded from cloud yet, skip revocation verification to avoid race conditions
      if (data._isLoaded === false) {
        console.log("Delegation data still loading from cloud, skipping user verification");
        return;
      }
      
      // Only verify users that belong to a specific delegation (marked with u-)
      if (currentUser?.id && currentUser.id.startsWith('u-')) {
        const actualUser = (data.users || []).find((u: User) => u.id === currentUser.id);
        if (!actualUser) {
          console.warn("User not found in delegation list. Revoking access for:", currentUser.email);
          handleLogout();
          toast.error("Su sesión ha expirado o su acceso ha sido revocado.");
        }
      }
    } catch(e: any) {
      console.error("Failed to load db data", e);
      setLoadError(e.message || "Error al conectar con el servidor central");
    }
  };

  const fetchGlobalInfo = async () => {
     try {
       const delList = await apiFetch("/api/global/delegations");
       setDelegations(delList);
     } catch(e) {
       console.error("Failed to load delegations", e);
     }
  };

  const handleLogin = React.useCallback((u: User) => {
    setUser(u);
    if (u.delegationId) {
      handleDelegationChange(u.delegationId);
    }
    try { localStorage.setItem("ia_user", JSON.stringify(u)); } catch(e){}
  }, []);

  const handleLogout = React.useCallback(async () => {
    setUser(null);
    try { 
      await signOut(auth);
      localStorage.removeItem("ia_user"); 
    } catch(e) {
      console.error("Logout error", e);
    }
  }, []);

  useEffect(() => {
    if (dbData && dbData.users && user) {
      if (dbData._isLoaded === false) return; // Wait for full cloud data
      
      // SUPER ADMIN BYPASS - IMMEDIATELY STOP IF SUPER ADMIN
      if (isSuperAdminEmail(user.email)) return;

      // Security: If normal admin is in wrong delegation, force correct one
      if (user.delegationId && user.delegationId !== currentDelegationId) {
        console.warn("User detected in wrong delegation. Redirecting...");
        handleDelegationChange(user.delegationId);
        return;
      }

      const updatedUser = dbData.users.find(u => u.id === user.id);
      if (updatedUser) {
        // Only update if something relevant actually changed to avoid re-render loops
        const hasChanged = updatedUser.role !== user.role || 
                           updatedUser.isApproved !== user.isApproved || 
                           updatedUser.name !== user.name;
                           
        if (hasChanged) {
          if (!updatedUser.isApproved && user.isApproved) {
            handleLogout();
            toast.error("Su acceso ha sido revocado.");
          } else {
            setUser(updatedUser);
            try { localStorage.setItem("ia_user", JSON.stringify(updatedUser)); } catch(e){}
            toast.info(`Su perfil ha sido actualizado: Rol actual - ${updatedUser.role}`);
          }
        }
      } else {
        // User was removed/deleted from the delegation
        // Re-check super admin here just in case
        if (!isSuperAdminEmail(user.email)) {
          console.warn("User removed from delegation list. Revoking access.");
          handleLogout();
          toast.error("Su acceso ha sido revocado.");
        }
      }
    }
  }, [dbData, user?.id, user?.role, user?.isApproved, user?.name, handleLogout, currentDelegationId]);

  if (loadError) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50 text-center"
      >
        <div className="bg-red-50 p-4 rounded-3xl mb-6 shadow-xl border border-red-100">
          <Building2 className="w-16 h-16 text-red-500 mb-2 mx-auto" />
          <h2 className="text-xl font-black text-red-900 uppercase tracking-tight">Fallo Crítico de Enlace</h2>
        </div>
        <p className="text-slate-500 font-bold mb-8 max-w-xs">{loadError}</p>
        <Button 
          onClick={() => loadData(currentDelegationId)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest px-8 h-14 rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
        >
          Reintentar Sincronización
        </Button>
      </motion.div>
    );
  }

  if (!dbData) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="w-20 h-20 bg-indigo-600 rounded-3xl mb-6 shadow-2xl shadow-indigo-500/40 flex items-center justify-center animate-bounce">
        <span className="text-white font-black text-2xl">IA</span>
      </div>
      <div className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
        Inicializando Intendencia
      </div>
    </div>
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" replace /> : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.4, ease: "circOut" }}
                >
                  <Login 
                    onLogin={handleLogin} 
                    allDelegations={delegations}
                    currentDelegationId={currentDelegationId}
                    onDelegationChange={handleDelegationChange}
                  />
                </motion.div>
              )} 
            />
            <Route
              path="/*"
              element={
                user ? (
                  (!user.isApproved && !isSuperAdminEmail(user.email)) ? (
                    <motion.div 
                      key="pending"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center"
                    >
                      <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mb-6 animate-pulse shadow-inner">
                        <Clock className="w-10 h-10 text-amber-600" />
                      </div>
                      <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">Cuenta en Revisión</h2>
                      <p className="text-slate-500 max-w-sm mb-8 font-medium">
                        Hola <span className="font-bold text-slate-900">{user.name}</span>, tu solicitud ha sido recibida. 
                        El Administrador Maestro asignará tu perfil (Cocinero, Admin o Gestión) en breve.
                      </p>
                      <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-widest">
                          <div className="w-2 h-2 bg-amber-600 rounded-full animate-ping" />
                          Esperando Respuesta Directa...
                        </div>
                        <div className="flex gap-4">
                          <Button 
                            onClick={() => {
                              const checkStatus = async () => {
                                try {
                                  const res = await fetch("/api/auth/login", {
                                    method: "POST",
                                    headers: { 
                                      "Content-Type": "application/json",
                                      "x-delegation-id": currentDelegationId
                                    },
                                    body: JSON.stringify({ email: user.email })
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setUser(data);
                                    if (data.isApproved) toast.success("¡Cuenta aprobada! Bienvenido.");
                                    else toast.info("Aún en revisión.");
                                  }
                                } catch(e) {
                                  toast.error("Error al conectar");
                                }
                              };
                              checkStatus();
                            }}
                            className="h-12 px-8 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                          >
                            Actualizar Estado
                          </Button>
                          <Button 
                            variant="ghost" 
                            onClick={handleLogout}
                            className="text-slate-400 hover:text-red-600 font-bold text-[10px] uppercase tracking-widest h-12"
                          >
                            Salir
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dashboard"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="h-screen w-full overflow-hidden"
                    >
                      {user.role === "admin" || user.role === "viewer" ? (
                        <AdminDashboard 
                          user={user} 
                          data={dbData} 
                          onLogout={handleLogout} 
                          delegationId={currentDelegationId}
                          allDelegations={delegations}
                          onDelegationChange={handleDelegationChange}
                          onGlobalRefresh={() => loadData(currentDelegationId)}
                          notificationHistory={notificationHistory}
                        />
                      ) : (
                        <CookDashboard 
                          user={user} 
                          data={dbData} 
                          onLogout={handleLogout} 
                          delegationId={currentDelegationId} 
                          onRefresh={() => loadData(currentDelegationId)}
                          notificationHistory={notificationHistory}
                        />
                      )}
                    </motion.div>
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
          </Routes>
        </AnimatePresence>
        <Toaster position="top-center" richColors closeButton expand />
      </BrowserRouter>
    </ThemeProvider>
  );
}
