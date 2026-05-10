import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail, CookingPot, ShieldCheck, Eye, EyeOff, Download, ShieldAlert } from "lucide-react";
import { User, Delegation } from "../types";
import { toast } from "sonner";
import { auth, googleProvider } from "../lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { isSuperAdminEmail } from "../lib/helpers";

interface LoginProps {
  onLogin: (user: User) => void;
  allDelegations: Delegation[];
  currentDelegationId: string;
  onDelegationChange: (id: string) => void;
}

export default function Login({ 
  onLogin, 
  allDelegations, 
  currentDelegationId, 
  onDelegationChange 
}: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const currentDelegation = allDelegations.find(d => d.id === currentDelegationId);
  const isMasterAdminEmail = isSuperAdminEmail(email) || (currentDelegation?.masterAdminEmail?.toLowerCase() === email.toLowerCase() && email !== "");

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        toast.success("Instalación iniciada con éxito");
      }
    } else {
      // Logic for iOS or already installed
      toast.info("Para instalar esta App de forma segura: En iPhone toca 'Compartir' y luego 'Añadir a pantalla de inicio'. En Android/PC usa el menú del navegador.");
    }
  };

  const handleGoogleAuth = async () => {
    setIsAuthenticating(true);
    try {
      // In some environments (like being inside an iframe), signInWithPopup might fail or be blocked.
      // We try it, and if it fails with specific errors we could suggest opening in a new tab.
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: user.email, 
          displayName: user.displayName, 
          photoURL: user.photoURL,
          uid: user.uid,
          delegationId: currentDelegationId
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error de autorización en el servidor");
      }

      const data = await res.json();
      onLogin(data);
      toast.success(`Bienvenido/a, ${data.name}`);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/popup-blocked') {
        toast.error("El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Silent
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Silent
      } else {
        toast.error("Error al autenticar con Google: " + (err.message || "Intente nuevamente"));
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isMasterAdminEmail && !adminPassword) {
      toast.error("Se requiere clave para la cuenta de Administrador Maestro");
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          password: adminPassword, 
          isAdminMode: isMasterAdminEmail,
          delegationId: currentDelegationId
        })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data);
        if (data.isApproved) {
          toast.success(`Acceso concedido: Bienvenido, ${data.name}`);
        } else {
          toast.info("Acceso validado: Su cuenta está esperando aprobación final.");
        }
      } else {
        // Mejoramos la claridad del error de clave para administradores
        if (data.error?.toLowerCase().includes("clave") || data.error?.toLowerCase().includes("contraseña")) {
          toast.error(data.error);
        } else {
          toast.error(data.error || "Error al iniciar sesión");
        }
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      toast.error(`Error de conexión: ${err.message || "Servidor no responde"}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRefreshState = async () => {
    if (!email) {
      toast.error("Ingrese su correo electrónico primero");
      return;
    }
    handleLogin({ preventDefault: () => {} } as any);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-50 p-4 md:p-6">
      <div className="mb-6 md:mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="bg-white p-2.5 md:p-3 rounded-2xl shadow-xl shadow-indigo-100 mb-3 md:mb-4 mx-auto w-fit">
          <CookingPot className="w-8 h-8 md:w-10 md:h-10 text-indigo-600" />
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mb-1">INTENDENCIA AUTONOMA</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px] md:text-[10px]">Gestión Inteligente de Insumos</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl rounded-[1.5rem] md:rounded-[2rem] overflow-hidden bg-white animate-in zoom-in-95 duration-500">
        <CardHeader className={`${isMasterAdminEmail ? 'bg-black' : 'bg-slate-900'} text-white p-6 md:p-8 space-y-2 transition-colors duration-500 relative border-b ${isMasterAdminEmail ? 'border-white/10' : 'border-transparent'}`}>
          <div className="absolute top-6 right-6">
             <Button
               variant="ghost"
               size="icon"
               onClick={handleRefreshState}
               className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
               title="Actualizar Datos de Acceso"
             >
               <Download className="w-4 h-4 rotate-180" />
             </Button>
          </div>
          <CardTitle className={`uppercase tracking-[0.1em] md:tracking-[0.2em] text-[10px] md:text-xs font-black flex items-center gap-3 ${isMasterAdminEmail ? 'text-white drop-shadow-[0_0_10px_white]' : ''}`}>
            {isMasterAdminEmail ? (
              <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-white drop-shadow-[0_0_5px_white]" />
            ) : (
              <CookingPot className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" />
            )}
            {isMasterAdminEmail ? "Acceso Maestro (Seguro)" : "Acceso de Personal Autorizado"}
          </CardTitle>
          <CardDescription className={`font-bold uppercase tracking-widest ${isMasterAdminEmail ? 'text-white/80 drop-shadow-[0_0_3px_white] text-[9px] md:text-[11px]' : 'text-white/60 text-[8px] md:text-[10px]'}`}>
            {isMasterAdminEmail ? "Se requiere verificación de identidad" : "Identificación por correo registrado"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
            <form onSubmit={handleLogin} className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-400">Seleccionar Intendencia / Delegación</Label>
                <select 
                  value={currentDelegationId}
                  onChange={(e) => onDelegationChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl h-12 md:h-14 px-4 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                >
                  {allDelegations.map(del => (
                    <option key={del.id} value={del.id}>{del.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 italic px-1 font-medium">Elija la delegación a la que pertenece antes de ingresar.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-400">Correo Electrónico</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="usuario@ia.com" 
                      className="pl-12 border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl h-12 md:h-14 bg-slate-50 dark:bg-slate-800 focus-visible:ring-indigo-500 transition-all text-sm md:text-base text-slate-900 dark:text-slate-100"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center px-1">
                    <Label htmlFor="pass" className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-slate-400">
                      Clave de Acceso (Solo Admins)
                    </Label>
                    {!isMasterAdminEmail && (
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Cocinero: No requiere clave</span>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isMasterAdminEmail ? 'text-amber-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
                    <Input 
                      id="pass" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      className={`pl-12 pr-12 border-slate-200 dark:border-slate-700 rounded-xl md:rounded-2xl h-12 md:h-14 bg-slate-50 dark:bg-slate-800 transition-all text-sm md:text-base text-slate-900 dark:text-slate-100 ${isMasterAdminEmail ? 'focus-visible:ring-amber-500 border-amber-200' : 'focus-visible:ring-indigo-500'}`}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white transition-all bg-transparent border-none flex items-center justify-center h-fit w-fit cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isAuthenticating}
                variant="secondary" 
                className={`w-full h-12 md:h-14 ${isMasterAdminEmail ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-300 shadow-lg shadow-amber-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} rounded-xl md:rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 border`}
              >
                {isAuthenticating ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  isMasterAdminEmail ? "Acceso Maestro" : "Ingresar con Clave"
                )}
              </Button>

              <div className="relative my-3 md:my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest">O entrar con</span>
                </div>
              </div>

              <Button 
                type="button" 
                onClick={handleGoogleAuth}
                disabled={isAuthenticating}
                className="w-full h-12 md:h-14 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl md:rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 md:gap-3 text-xs"
              >
                {isAuthenticating ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 bg-white rounded-full p-1 shrink-0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                    Google
                  </>
                )}
              </Button>
            </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 md:gap-4 p-6 md:p-8 bg-slate-50 border-t border-slate-100 items-center justify-center">
          <div className="flex items-center justify-center gap-3 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
            <img src="https://www.google.com/favicon.ico" className="w-3 h-3" referrerPolicy="no-referrer" />
            <span className="text-[8px] md:text-[9px] uppercase font-bold tracking-widest text-slate-500">Google Cloud Protected</span>
          </div>
        </CardFooter>
      </Card>

      <div className="w-full max-w-md mt-4 md:mt-6 animate-in slide-in-from-bottom-2 duration-700 delay-300">
        <Button 
          onClick={handleInstallApp}
          className="w-full h-14 bg-white text-emerald-600 hover:bg-emerald-50 border-2 border-emerald-100 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100/50 flex items-center justify-center gap-3 active:scale-95 transition-all group lg:hover:-translate-y-1"
        >
          <div className="p-1.5 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
            <Download className="w-4 h-4" />
          </div>
          Descargar Aplicación Segura
        </Button>
      </div>

      <div className="mt-8 md:mt-12 flex flex-col items-center gap-4 text-slate-400">
        <div className="flex items-center gap-4 bg-emerald-50/50 backdrop-blur-sm border border-emerald-100/50 px-4 py-2 rounded-full shadow-sm">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
             <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Encriptación SSL/TLS Activada</span>
           </div>
           <div className="w-px h-3 bg-emerald-200" />
           <div className="flex items-center gap-2">
             <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" />
             <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">Protección Anti-Ataques PRO</span>
           </div>
        </div>
        <div className="w-8 md:w-10 h-1 bg-slate-200 rounded-full" />
        <p className="text-[8px] md:text-[9px] uppercase font-bold tracking-[0.4em] text-center text-slate-400">
          INTENDENCIA AUTONOMA Cyber-Security Hardened V5.0
        </p>
      </div>
    </div>

  );
}
