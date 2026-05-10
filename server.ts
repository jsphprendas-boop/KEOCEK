import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function startServer() {
  console.log(`[SERVER] Starting server version: ${new Date().toISOString()}`);
  const app = express();
  app.set('trust proxy', 1);
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  let db: any = null;
  let auth: any = null;
  
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
      console.log(`[CONFIG] Read firebase-applet-config.json. Project: ${firebaseConfig.projectId}, Database: ${firebaseConfig.firestoreDatabaseId}`);

      const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
      console.log(`[FIREBASE] Attempting to target database: ${dbId}`);
      try {
        // Initialize Admin SDK
        if (!admin.apps.length) {
          const adminOptions: any = {};
          if (firebaseConfig.projectId) adminOptions.projectId = firebaseConfig.projectId;
          
          admin.initializeApp(adminOptions);
          const currentProject = admin.app().options.projectId;
          console.log(`[FIREBASE] Admin initialized. Target Project: ${firebaseConfig.projectId}, Actual ADC Project: ${currentProject || 'Unknown'}`);
        }
      
        // In firebase-admin v13+, getFirestore(dbId) targets a specific database ID for the default app
        db = getFirestore(dbId);
        console.log(`[FIREBASE] Firestore client created for database: ${dbId}`);
        
        // TEST CONNECTION: Perform a light read to check if DB is accessible
        try {
          console.log(`[FIREBASE] Testing connection to database: ${dbId}...`);
          await db.doc("_test_/connection").get();
          console.log(`[FIREBASE] Connection to database ${dbId} verified.`);
        } catch (initialErr: any) {
          const errMsg = initialErr.message || "";
          const errCode = initialErr.code;
          console.log(`[FIREBASE] Connection test result for ${dbId}: Code ${errCode}, Msg: ${errMsg}`);

          if (errMsg.includes("NOT_FOUND") || errCode === 5) {
            if (dbId !== "(default)") {
              console.error(`[FIREBASE] Database ${dbId} NOT FOUND. Falling back to (default) database.`);
              db = getFirestore();
              // Test default too
              try {
                await db.doc("_test_/connection").get();
                console.log(`[FIREBASE] Fallback to (default) database successful.`);
              } catch (defaultErr: any) {
                console.error(`[FIREBASE] Fallback (default) database also failed: ${defaultErr.message}`);
              }
            } else {
              console.error(`[FIREBASE] The (default) database was NOT FOUND. Please ensure Firestore is initialized in the console.`);
            }
          } else {
            console.error(`[FIREBASE] Connection test error:`, errMsg);
          }
        }
      } catch (dbErr: any) {
        console.error(`[FIREBASE] Error during Firestore initialization:`, dbErr.message || dbErr);
        db = getFirestore(); 
        console.log(`[FIREBASE] Falling back to default database client`);
      }
    } catch (e) {
      console.error("[FIREBASE] Admin setup error [CRITICAL]:", e);
    }
  }

  // Middleware de logging para diagnóstico
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Firebase DB: ${db ? 'Initialized' : 'Null'}`);
    }
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Recursive function to remove undefined values for Firestore
  function sanitizeForFirestore(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(v => sanitizeForFirestore(v));
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          sanitized[key] = sanitizeForFirestore(obj[key]);
        }
      });
      return sanitized;
    }
    return obj;
  }

  // Robust Firestore Error Handling
  const OperationType = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
    GET: 'get',
    WRITE: 'write',
  } as const;

  type OperationType = typeof OperationType[keyof typeof OperationType];

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    timestamp: string;
    context?: any;
  }

  function handleFirestoreError(error: any, operationType: OperationType, path: string | null, context?: any) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path,
      timestamp: new Date().toISOString(),
      context
    };
    
    // Check for Permission Denied specifically
    if (errInfo.error.includes("PERMISSION_DENIED") || error.code === 7) {
      console.error(`[FIRESTORE PERMISSION DENIED] Op: ${operationType} | Path: ${path} | Info: ${JSON.stringify(errInfo)}`);
    } else {
      console.error(`[FIRESTORE ERROR] Op: ${operationType} | Path: ${path}:`, error);
    }
    
    return errInfo;
  }

  let globalData: any = {
    delegations: [
      { id: "default", name: "INTENDENCIA AUTONOMA", masterAdminEmail: "alecamposa32@gmail.com", createdAt: new Date().toISOString() }
    ],
    superAdmins: ["jsphprendas@gmail.com", "alecamposa32@gmail.com"],
    auditLogs: []
  };

  const addGlobalLog = (action: string, details: string, user: string, delegationId?: string, delegationName?: string, req?: express.Request) => {
    if (!globalData.auditLogs) globalData.auditLogs = [];
    
    // Capture basic metadata if request is provided
    const metadata = req ? {
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    } : undefined;

    globalData.auditLogs.push({
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
      delegationId,
      delegationName,
      metadata
    });
    // Keep only last 200 logs
    if (globalData.auditLogs.length > 200) {
      globalData.auditLogs.shift();
    }
    saveGlobalData();
  };

  const addAuditEntry = (delData: any, entry: any) => {
    if (!delData.auditEntries) delData.auditEntries = [];
    const newEntry = {
      id: "audit-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      ...entry
    };
    delData.auditEntries.push(newEntry);
    // Keep 1000 entries for enterprise audit
    if (delData.auditEntries.length > 1000) delData.auditEntries.shift();
  };

  const getDefaultData = (delegationId: string) => ({
    id: delegationId,
    categories: [],
    products: [],
    movements: [],
    requests: [],
    pastHistories: [],
    adminAuditLog: [],
    supportRecords: [],
    supportCategories: [],
    supportProducts: [],
    gasReports: [],
    trash: [],
    auditEntries: [],
    workflows: [],
    governancePolicies: [],
    settings: {
      locationVisibility: {
        fuerza_publica: true,
        fronteras: true
      },
      customLocations: [
        { id: "fuerza_publica", name: "Fuerza Pública", visible: true },
        { id: "fronteras", name: "Fronteras", visible: true }
      ]
    },
    users: []
  });

  const dataByDelegation: { [key: string]: any } = {};
  const loadedDelegations = new Set<string>();
  let isGlobalLoaded = false;

  // Helper to save global data
  async function saveGlobalData() {
    if (!isGlobalLoaded) {
      // console.warn("[SAVE] Blocked saveGlobalData because data is not yet loaded from Firestore.");
      return;
    }
    if (db) {
      try {
        await db.doc("system/global_config").set(sanitizeForFirestore(globalData));
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, "system/global_config");
      }
    }
  }

  // Data persistence per delegation
  const saveDebounce: { [key: string]: NodeJS.Timeout } = {};

  async function saveDelegationData(delId: string) {
    // SECURITY GUARD: Never save if delId is default AND there are other delegations (prevents pollution)
    if (delId === "default" && globalData.delegations.length > 1 && !isGlobalLoaded) {
       console.warn("Safety Block: Attempted to save 'default' delegation while global data not fully loaded.");
       return;
    }

    // SECURITY GUARD: If the delegation is known but hasn't finished loading from Firestore, do NOT save
    // This prevents overwriting existing cloud data with empty local data during startup/restart
    const isKnown = globalData.delegations.some((d: any) => d.id === delId) || delId === "default";
    if (isKnown && !loadedDelegations.has(delId) && db) {
       console.warn(`Safety Block: Blocked saving delegation ${delId} because it has not finished loading from Firestore.`);
       return;
    }

    if (saveDebounce[delId]) {
      clearTimeout(saveDebounce[delId]);
    }
  
    saveDebounce[delId] = setTimeout(async () => {
      const data = dataByDelegation[delId];
      if (!data) return;
  
      // SAFETY GUARD: Check for accidental wipe
      if (loadedDelegations.has(delId)) {
        // If data was previously loaded, we expect it to still have basic structures
        // If it's suddenly empty, we log a warning
        if (data.categories.length === 0 && data.products.length === 0 && data.users.length === 0) {
           console.warn(`[DATA WARNING] Saving an empty state for delegation ${delId}. This might be intentional or a wipe.`);
        }
      }

      if (db) {
        try {
          await Promise.all([
            db.doc(`delegations/${delId}/system/main_db`).set(sanitizeForFirestore({
              categories: data.categories,
              products: data.products,
              supportCategories: data.supportCategories || [],
              supportProducts: data.supportProducts || [],
              users: data.users,
              settings: data.settings || {}
            })),
            db.doc(`delegations/${delId}/system/main_db_data_1`).set(sanitizeForFirestore({
              movements: data.movements,
              requests: data.requests
            })),
            db.doc(`delegations/${delId}/system/main_db_data_2`).set(sanitizeForFirestore({
              adminAuditLog: data.adminAuditLog || [],
              auditEntries: data.auditEntries || [],
              workflows: data.workflows || [],
              governancePolicies: data.governancePolicies || [],
              supportRecords: data.supportRecords || [],
              gasReports: data.gasReports || []
            })),
            db.doc(`delegations/${delId}/system/trash_db`).set(sanitizeForFirestore({
              trash: data.trash || []
            }))
          ]);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `delegations/${delId}/system/*`, { delId });
        }
      }
    }, 2000);
  }

  const getContext = (req: express.Request) => {
    const delIdHeader = req.headers["x-delegation-id"];
    const delId = (Array.isArray(delIdHeader) ? delIdHeader[0] : delIdHeader as string) || "default";
    const userEmail = (Array.isArray(req.headers["x-user-email"]) ? req.headers["x-user-email"][0] : req.headers["x-user-email"] as string || "").toLowerCase();
    
    // Ensure we have a structure for this delegation if it's new
    if (!dataByDelegation[delId]) {
      dataByDelegation[delId] = getDefaultData(delId);
    }

    const superAdmins = Array.isArray(globalData.superAdmins) ? globalData.superAdmins : ["jsphprendas@gmail.com"];
    const isSuperAdmin = superAdmins.some((email: string) => typeof email === 'string' && email.toLowerCase() === userEmail);
    const delData = dataByDelegation[delId];

    return { 
      id: delId, 
      data: delData,
      userEmail,
      isSuperAdmin,
      save: () => saveDelegationData(delId)
    };
  };

  // Pre-initialize basic delegations
  ["default"].forEach(id => {
    dataByDelegation[id] = getDefaultData(id);
  });

  // Initialize dataByDelegation with all known delegations from globalData
  globalData.delegations.forEach(del => {
    if (!dataByDelegation[del.id]) {
      dataByDelegation[del.id] = getDefaultData(del.id);
    }
  });

  if (db) {
    // Initial fetching of global config from Firestore in background to not block startup
    (async () => {
      const dbId = fs.existsSync(firebaseConfigPath) ? JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8")).firestoreDatabaseId || "(default)" : "(default)";
      
      const tryFetch = async (targetDb: any, tDbId: string, retryCount = 0): Promise<boolean> => {
        try {
          console.log(`[FETCH] Loading global config (DB: ${tDbId}, Attempt: ${retryCount + 1})...`);
          const globalSnap = await targetDb.doc("system/global_config").get();
          console.log(`[FETCH] Success from ${tDbId}. Exists: ${globalSnap.exists}`);
          
          if (globalSnap.exists) {
            const cloudGlobal = globalSnap.data() as any;
            globalData = { ...globalData, ...cloudGlobal };
            isGlobalLoaded = true;
            
            // Ensure hardcoded super admins are always present
            const hardcodedSuperAdmins = ["jsphprendas@gmail.com", "alecamposa32@gmail.com"];
            globalData.superAdmins = Array.from(new Set([...(globalData.superAdmins || []), ...hardcodedSuperAdmins]));
            
            // Load delegations data in background
            for (const del of globalData.delegations) {
              const delId = del.id;
              if (!dataByDelegation[delId]) {
                dataByDelegation[delId] = getDefaultData(delId);
              }
              
              try {
                const [mainSnap, data1Snap, data2Snap, trashSnap] = await Promise.all([
                  targetDb.doc(`delegations/${delId}/system/main_db`).get(),
                  targetDb.doc(`delegations/${delId}/system/main_db_data_1`).get(),
                  targetDb.doc(`delegations/${delId}/system/main_db_data_2`).get(),
                  targetDb.doc(`delegations/${delId}/system/trash_db`).get()
                ]);
                
                const delData = dataByDelegation[delId];

                if (mainSnap.exists) {
                  const cloudData = mainSnap.data() as any;
                  const cloudData1 = data1Snap.exists ? data1Snap.data() as any : {};
                  const cloudData2 = data2Snap.exists ? data2Snap.data() as any : {};
                  const cloudTrash = trashSnap.exists ? trashSnap.data() as any : {};

                  delData.categories = cloudData.categories || [];
                  delData.products = cloudData.products || [];
                  delData.movements = cloudData1.movements || [];
                  delData.requests = cloudData1.requests || [];
                  delData.adminAuditLog = cloudData2.adminAuditLog || [];
                  delData.supportRecords = cloudData2.supportRecords || [];
                  delData.supportCategories = cloudData.supportCategories || [];
                  delData.supportProducts = cloudData.supportProducts || [];
                  delData.gasReports = cloudData2.gasReports || [];
                  delData.auditEntries = cloudData2.auditEntries || [];
                  delData.workflows = cloudData2.workflows || [];
                  delData.governancePolicies = cloudData2.governancePolicies || [];
                  delData.settings = cloudData.settings || delData.settings;
                  delData.trash = cloudTrash.trash || [];
                  
                  const cloudUsers = cloudData.users || [];
                  const memoryUsers = delData.users || [];
                  const mergedUsers = [...cloudUsers];
                  
                  memoryUsers.forEach((mu: any) => {
                    if (!mergedUsers.some((cu: any) => cu.email.toLowerCase() === mu.email.toLowerCase())) {
                      mergedUsers.push(mu);
                    }
                  });
                  delData.users = mergedUsers;
                  
                  const masterExists = delData.users.find((u: any) => u.email === del.masterAdminEmail);
                  if (!masterExists && del.masterAdminEmail) {
                    delData.users.push({
                      id: "admin-" + delId,
                      email: del.masterAdminEmail,
                      role: "admin",
                      name: "Administrador Delegation",
                      isApproved: true,
                      delegationId: delId
                    });
                  }
                }
                loadedDelegations.add(delId);
              } catch (e) {
                console.error(`[FETCH] Error loading delegation ${delId} from ${tDbId}:`, e);
              }
            }
            console.log(`[FETCH] Delegations data loaded in background from ${tDbId}`);
            return true;
          } else {
            console.log(`[FETCH] Global config not found in ${tDbId}, creating default...`);
            await targetDb.doc("system/global_config").set(sanitizeForFirestore(globalData));
            isGlobalLoaded = true;
            globalData.delegations.forEach((d: any) => loadedDelegations.add(d.id));
            return true;
          }
        } catch (e: any) {
          const isPermissionDenied = e.message?.includes("PERMISSION_DENIED") || e.code === 7;
          const isNotFound = e.message?.includes("NOT_FOUND") || e.code === 5;

          if (tDbId !== "(default)" && (isPermissionDenied || isNotFound)) {
             console.log(`[FETCH] DB ${tDbId} unreachable or denied. This is common if the database is still provisioning or private. Trying (default) fallback...`);
             try {
               const fallbackDb = getFirestore();
               db = fallbackDb; 
               return tryFetch(fallbackDb, "(default)", 0);
             } catch (fallbackErr) {
               console.error("[FETCH] Fatal error during fallback initialization:", fallbackErr);
             }
          } else if (tDbId === "(default)" && isNotFound) {
             console.log(`[FETCH] (default) database not found. This is normal if only a custom-named database exists.`);
          } else {
             console.error(`[FETCH] Error loading global config (DB: ${tDbId}):`, e.message || e);
          }
          
          if (tDbId === "(default)" || retryCount >= 2) {
            console.warn(`[FETCH] Terminal failure. Database access unavailable. App will run with local-only config.`);
            isGlobalLoaded = true; // Still allow app to start
            globalData.delegations.forEach((d: any) => loadedDelegations.add(d.id));
            return true;
          }

          if (retryCount < 2) {
             console.log(`[FETCH] Retrying in 2s...`);
             await new Promise(r => setTimeout(r, 2000));
             return tryFetch(targetDb, tDbId, retryCount + 1);
          }
          
          return false;
        }
      };

      await tryFetch(db, dbId);
    })();
  }

  const checkCriticalStock = (delData: any, product: any, oldQty: number, newQty: number, forceId?: string) => {
    const targetRoom = forceId || delData.id;
    const threshold = delData.settings?.criticalStockThreshold || 10;
    if (oldQty > threshold && newQty <= threshold) {
      io.to(targetRoom).emit("notification", { 
        message: `⚠️ CRÍTICO: Stock bajo en ${product.name} (${newQty} ${product.unit}).`, 
        type: "critical_stock",
        targetRole: "admin" 
      });
    }

    // Notify ALL cooks if stock is significantly renewed (e.g. from 0 to something high)
    if (oldQty <= 0 && newQty > 0) {
      io.to(targetRoom).emit("notification", {
        message: `✅ DISPONIBLE: Se ha repuesto el stock de ${product.name}.`,
        type: "inventory",
        targetRole: "cook"
      });
    }
  };

  const addMovement = (delData: any, { productId, productName, type, quantity, unit, category, location, note, timestamp }: any) => {
    const mDate = new Date(timestamp || new Date());
    const dateStr = mDate.toISOString().split("T")[0];
    
    const existingMovement = delData.movements.find((m: any) => 
      m.productId === productId && 
      m.type === type && 
      m.location === location &&
      m.timestamp.startsWith(dateStr) &&
      m.note === (note || "")
    );

    if (existingMovement) {
      existingMovement.quantity += quantity;
    } else {
      delData.movements.push({
        id: Date.now().toString() + Math.random(),
        productId,
        productName,
        type,
        quantity,
        unit,
        category,
        location: location || 'fuerza_publica',
        timestamp: timestamp || new Date().toISOString(),
        note: note || ""
      });
    }
  };

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      firebase: db ? 'connected' : 'none',
      delegations: globalData.delegations.length
    });
  });

  // Global API for managing delegations
  app.get("/api/global/delegations", (req, res) => {
    res.json(globalData.delegations);
  });

  app.post("/api/global/delegations", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const { name, masterAdminEmail, masterAdminPassword } = req.body;
    
    if (!name) return res.status(400).json({ error: "El nombre de la aplicación/delegación es obligatorio" });

    const newDel = {
      id: "del-" + Date.now(),
      name: name || "Nueva Delegación",
      masterAdminEmail: (masterAdminEmail || "").toLowerCase(),
      masterAdminPassword: masterAdminPassword || "",
      createdAt: new Date().toISOString()
    };
    
    // Initialize standard data structure for this delegation
    dataByDelegation[newDel.id] = getDefaultData(newDel.id);
    loadedDelegations.add(newDel.id); // NEW: Mark as loaded so it can be saved
    
    // Add the master admin as the first official user of this delegation
    let masterUser = null;
    // Look for the user globally
    for (const delId of Object.keys(dataByDelegation)) {
      const found = dataByDelegation[delId].users.find((u: any) => u.email === newDel.masterAdminEmail);
      if (found) {
        masterUser = found;
        break;
      }
    }

    if (masterUser) {
      // If user exists, promote them directly
      masterUser.role = "admin";
      masterUser.isApproved = true;
      masterUser.delegationId = newDel.id;
      if (newDel.masterAdminPassword) masterUser.password = newDel.masterAdminPassword;
      dataByDelegation[newDel.id].users.push(masterUser);
    } else {
      // If not exists globally, create new
      dataByDelegation[newDel.id].users.push({
        id: "admin-" + newDel.id,
        email: newDel.masterAdminEmail,
        role: "admin",
        name: "Administrador Maestro",
        isApproved: true,
        delegationId: newDel.id,
        password: newDel.masterAdminPassword
      });
    }

    globalData.delegations.push(newDel);
    addGlobalLog("CREACION_DELEGACION", `Se creó la delegación ${newDel.name}`, masterAdminEmail, newDel.id, newDel.name);
    saveGlobalData();
    saveDelegationData(newDel.id);
    res.json(newDel);
  });

  app.delete("/api/global/delegations/:id", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const delId = req.params.id;
    if (delId === "default") return res.status(400).json({ error: "No se puede eliminar la sede principal" });

    globalData.delegations = globalData.delegations.filter((d: any) => d.id !== delId);
    delete dataByDelegation[delId];
    
    addGlobalLog("ELIMINACION_DELEGACION", `Se eliminó permanentemente la delegación ID: ${delId}`, "Super Admin", delId);
    saveGlobalData();
    // In a real database we would also delete the documents from Firestore here
    res.json({ success: true, message: "Delegación eliminada permanentemente" });
  });

  // SUPER ADMIN GLOBAL STATS
  app.get("/api/admin/global-stats", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    let totalUsers = 0;
    let totalRequests = 0;
    let activeDelegations = globalData.delegations.length;

    Object.keys(dataByDelegation).forEach(delId => {
      totalUsers += dataByDelegation[delId].users.length;
      totalRequests += dataByDelegation[delId].requests.length;
    });

    res.json({
      totalUsers,
      totalRequests,
      activeDelegations,
      superAdmins: globalData.superAdmins.length,
      recentActivity: (globalData.auditLogs || []).slice(-10).reverse()
    });
  })

  app.delete("/api/global/audit-logs/:id", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const logId = req.params.id;
    const initialCount = globalData.auditLogs.length;
    globalData.auditLogs = globalData.auditLogs.filter((log: any) => log.id !== logId);
    
    if (globalData.auditLogs.length < initialCount) {
      saveGlobalData();
      res.json({ success: true, message: "Registro de bitácora eliminado" });
    } else {
      res.status(404).json({ error: "Registro no encontrado" });
    }
  });

  // SUPER ADMIN GLOBAL USER MANAGEMENT
  app.get("/api/admin/all-users", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const allUsers: any[] = [];
    Object.keys(dataByDelegation).forEach(delId => {
      const del = globalData.delegations.find((d: any) => d.id === delId);
      const delegationName = del ? del.name : delId;
      
      dataByDelegation[delId].users.forEach((u: any) => {
        allUsers.push({ ...u, delegationName, delegationId: delId });
      });
    });
    res.json(allUsers);
  });

  app.put("/api/admin/users/:id", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const { targetDelegationId, role, name, password, isApproved } = req.body;
    const targetDelId = targetDelegationId;

    if (!dataByDelegation[targetDelId]) return res.status(404).json({ error: "Delegación no encontrada" });

    const userIndex = dataByDelegation[targetDelId].users.findIndex((u: any) => u.id === req.params.id);
    if (userIndex === -1) return res.status(404).json({ error: "Usuario no encontrado en la delegación especificada" });

    const user = dataByDelegation[targetDelId].users[userIndex];
    if (role) user.role = role;
    if (name) user.name = name;
    if (password) user.password = password;
    if (isApproved !== undefined) user.isApproved = isApproved;

    saveDelegationData(targetDelId);
    io.to(targetDelId).emit("db:update", dataByDelegation[targetDelId]);
    res.json(user);
  });

  app.delete("/api/admin/users/:delId/:userId", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });

    const targetDelId = req.params.delId;
    const userId = req.params.userId;

    if (!dataByDelegation[targetDelId]) return res.status(404).json({ error: "Delegación no encontrada" });

    const userIndex = dataByDelegation[targetDelId].users.findIndex((u: any) => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: "Usuario no encontrado" });

    const user = dataByDelegation[targetDelId].users[userIndex];
    if (user.email === "jsphprendas@gmail.com") {
      return res.status(403).json({ error: "No se puede eliminar al administrador maestro" });
    }

    if (!dataByDelegation[targetDelId].trash) dataByDelegation[targetDelId].trash = [];
    dataByDelegation[targetDelId].trash.push({
      id: "trash-" + Date.now() + Math.random(),
      type: "user",
      originalId: user.id,
      data: user,
      deletedAt: new Date().toISOString()
    });

    dataByDelegation[targetDelId].users.splice(userIndex, 1);
    saveDelegationData(targetDelId);
    io.to(targetDelId).emit("db:update", dataByDelegation[targetDelId]);
    res.json({ success: true });
  });

  app.post("/api/admin/users/transfer", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado"});

    const { userId, sourceDelegationId, targetDelegationId } = req.body;
    console.log(`Transfer request: userId=${userId}, source=${sourceDelegationId}, target=${targetDelegationId}`);

    if (!dataByDelegation[sourceDelegationId] || !dataByDelegation[targetDelegationId]) {
      return res.status(404).json({ error: "Delegación no encontrada"});
    }

    const userIndex = dataByDelegation[sourceDelegationId].users.findIndex((u: any) => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: "Usuario no encontrado en la delegación de origen"});

    const user = dataByDelegation[sourceDelegationId].users.splice(userIndex, 1)[0];
    
    // Update user delegation
    user.delegationId = targetDelegationId;
    user.role = "cook"; // Optional: reset role or keep? The request implies they become a cook if moved
    
    // Push to target
    dataByDelegation[targetDelegationId].users.push(user);
    
    saveDelegationData(sourceDelegationId);
    saveDelegationData(targetDelegationId);
    
    io.to(sourceDelegationId).emit("db:update", dataByDelegation[sourceDelegationId]);
    io.to(targetDelegationId).emit("db:update", dataByDelegation[targetDelegationId]);
    
    res.json({ success: true, user });
  });

  // Gas API
  app.post("/api/gas-reports", (req, res) => {
    const { data, save, id } = getContext(req);
    const report = { id: Date.now().toString(), ...req.body, timestamp: new Date().toISOString() };
    if (!data.gasReports) data.gasReports = [];
    data.gasReports.push(report);
    save();
    io.to(id).emit("db:update", data);
    io.to(id).emit("notification", { message: `Nuevo reporte de gas: ${report.userName} - ${report.amount} L`, type: "gas", targetRole: "admin" });
    res.json(report);
  });

  app.delete("/api/gas-reports/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const index = data.gasReports.findIndex((r: any) => r.id === req.params.id);
    if (index !== -1) {
      const report = data.gasReports[index];
      
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "gas-report",
        originalId: report.id,
        data: report,
        deletedAt: new Date().toISOString()
      });

      data.gasReports.splice(index, 1);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Reporte no encontrado" });
    }
  });

  // API Routes
  app.post("/api/auth/google", (req, res) => {
    const { email, displayName, photoURL, uid, delegationId } = req.body;
    // Force all new registrations to the 'default' (Principal) delegation
    const delId = "default";
    const data = dataByDelegation[delId] || dataByDelegation["default"];

    // Try finding by UID first if provided, then by email
    let user = data.users.find((u: any) => u.googleUid === uid);
    if (!user) {
      user = data.users.find((u: any) => u.email === (email || "").toLowerCase());
    }
 
    if (user) {
      // Update store with UID and picture if missing
      if (!user.googleUid && uid) user.googleUid = uid;
      if (!user.picture && photoURL) user.picture = photoURL;
      
      // Track last login
      user.lastLoginAt = new Date().toISOString();
      user.lastDeviceUsed = req.headers['user-agent'] || 'unknown';
      
      saveDelegationData(delId);
      return res.json(user);
    } else {
      // Register user
      const newUser = {
        id: "u-" + Date.now(),
        email: (email || "").toLowerCase(),
        googleUid: uid,
        picture: photoURL,
        name: displayName || email.split("@")[0],
        firstName: displayName?.split(" ")[0] || "",
        lastName: displayName?.split(" ").slice(1).join(" ") || "",
        role: "cook", // Default, master admin will choose on approval
        isApproved: false,
        delegationId: delId,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      data.users.push(newUser);
      saveDelegationData(delId);
      io.to(delId).emit("db:update", data);
      io.to(delId).emit("notification", { message: `Nuevo usuario registrado por Google: ${newUser.name}`, type: "user", targetRole: "admin" });
      addGlobalLog("LOGIN_GOOGLE", `Usuario ingresó/registró con Google: ${newUser.email}`, newUser.email, delId, undefined, req);
      return res.json(newUser);
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password, delegationId } = req.body;
    const delId = delegationId || "default";
    const data = dataByDelegation[delId] || dataByDelegation["default"];
    
    const lowerEmail = (email || "").toLowerCase();
    
    // Determine if this user is a Super Admin
    const isGlobalSuperAdmin = globalData.superAdmins.some((e: string) => e.toLowerCase() === lowerEmail);
    
    // Determine if this user should be treated as a Master Admin of this delegation
    const delInfo = globalData.delegations.find((d: any) => d.id === delId) || globalData.delegations[0];
    const isMasterAdmin = lowerEmail === "jsphprendas@gmail.com" || 
                         (delInfo && lowerEmail === (delInfo.masterAdminEmail || "").toLowerCase());

    let user = data.users.find((u: any) => u.email === lowerEmail);

    // If it's a global super admin or master admin of the delegation, we check the master keys
    if (isMasterAdmin || isGlobalSuperAdmin) {
      const masterKey = "INTEN4321";
      const delegationKey = delInfo?.masterAdminPassword; // This is the "Clave de Acceso" for this delegation
      
      const isValidAdminKey = (password === masterKey) || (delegationKey && password === delegationKey);

      if (isValidAdminKey) {
        if (!user) {
          user = {
            id: "admin-" + delId,
            email: lowerEmail,
            role: "admin",
            name: isGlobalSuperAdmin ? "Super Administrador" : "Administrador Maestro",
            isApproved: true,
            delegationId: delId,
            lastLoginAt: new Date().toISOString()
          };
          data.users.push(user);
        } else {
          // If the user exists but somehow has a different role, promote them if they are master/super admin
          user.role = "admin"; 
          user.isApproved = true;
          user.lastLoginAt = new Date().toISOString();
          user.lastDeviceUsed = req.headers['user-agent'] || 'unknown';
        }
        saveDelegationData(delId);
        addGlobalLog("LOGIN_PASSWORD", `Acceso administrativo (Maestro) concedido: ${lowerEmail}`, lowerEmail, delId, undefined, req);
        return res.json(user);
      } else {
        // Correct email but wrong master key
        return res.status(401).json({ error: "Clave de acceso de administrador inválida" });
      }
    }

    if (!user) {
      return res.status(404).json({ error: "Usuario no registrado en esta delegación" });
    }

    // Now handle regular users (cooks or secondary admins)
    // If they are admins, they SHOULD use the delegation key OR their personal password
    if (user.role === 'admin') {
      const delegationKey = delInfo?.masterAdminPassword;
      const isValid = (password === "INTEN4321") || (delegationKey && password === delegationKey) || (user.password && password === user.password);
      
      if (!isValid) {
        return res.status(401).json({ error: "Se requiere clave de acceso válida para administradores" });
      }
    } else {
      // It's a cook (or non-admin). Cooks enter directly if there is no password set for them specifically.
      // If a password was set for them, we check it. If not, they can just enter (e.g. via Google or just providing email if we allow it)
      if (user.password && password !== user.password && password !== "") {
        return res.status(401).json({ error: "Contraseña incorrecta" });
      }
    }

    user.lastLoginAt = new Date().toISOString();
    user.lastDeviceUsed = req.headers['user-agent'] || 'unknown';
    saveDelegationData(delId);
    res.json(user);
  });

  app.post("/api/auth/register", (req, res) => {
    const { email, name, lastName } = req.body;
    // Force all new registrations to the 'default' (Principal) delegation
    const delId = "default";
    const data = dataByDelegation[delId] || dataByDelegation["default"];
    
    const existingUser = data.users.find((u: any) => u.email === email);
    
    if (existingUser) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    const newUser = {
      id: "u-" + Date.now(),
      email,
      name: `${name} ${lastName}`,
      firstName: name,
      lastName: lastName,
      role: "cook",
      isApproved: false,
      delegationId: delId
    };

    data.users.push(newUser);
    saveDelegationData(delId);
    io.to(delId).emit("db:update", data);
    
    // Global Log
    const del = globalData.delegations.find((d: any) => d.id === delId);
    addGlobalLog("REGISTRO_USUARIO", `Nuevo registro: ${newUser.name} (${newUser.email})`, newUser.email, delId, del?.name);

    io.to(delId).emit("notification", { message: `Nuevo usuario registrado: ${name} ${lastName}`, type: "user", targetRole: "admin" });
    res.json(newUser);
  });

  app.post("/api/users/:id/update-profile", (req, res) => {
    const { data, save, id } = getContext(req);
    const { firstName, lastName } = req.body;
    const userIndex = data.users.findIndex((u: any) => u.id === req.params.id);
    
    if (userIndex !== -1) {
      data.users[userIndex].firstName = firstName;
      data.users[userIndex].lastName = lastName;
      data.users[userIndex].name = `${firstName} ${lastName}`.trim();
      
      save();
      io.to(id).emit("db:update", data);
      res.json(data.users[userIndex]);
    } else {
      res.status(404).json({ error: "Usuario no encontrado" });
    }
  });

  app.post("/api/users/:id/change-role", (req, res) => {
    const { data, save, id } = getContext(req);
    const { role } = req.body;
    const userIndex = data.users.findIndex((u: any) => u.id === req.params.id);
    
    if (userIndex !== -1) {
      if (data.users[userIndex].email === "jsphprendas@gmail.com") {
        return res.status(403).json({ error: "No se puede cambiar el rol del administrador maestro" });
      }
      
      data.users[userIndex].role = role;
      save();
      io.to(id).emit("db:update", data);
      res.json(data.users[userIndex]);
    } else {
      res.status(404).json({ error: "Usuario no encontrado" });
    }
  });

  app.post("/api/users/:id/approve", (req, res) => {
    const { data, save, id } = getContext(req);
    const { role } = req.body;
    const userIndex = data.users.findIndex((u: any) => u.id === req.params.id);
    if (userIndex !== -1) {
      data.users[userIndex].isApproved = true;
      if (role) {
        data.users[userIndex].role = role;
      }
      save();
      io.to(id).emit("db:update", data);
      io.to(id).emit("notification", { message: `Usuario aprobado: ${data.users[userIndex].name}`, type: "user", targetRole: "admin" });

      // Global Log
      const del = globalData.delegations.find((d: any) => d.id === id);
      addGlobalLog("APROBACION_USUARIO", `Usuario aprobado: ${data.users[userIndex].email} como ${role || data.users[userIndex].role}`, "Admin", id, del?.name);

      res.json(data.users[userIndex]);
    } else {
      res.status(404).json({ error: "Usuario no encontrado" });
    }
  });

  app.post("/api/users/:id/reject", (req, res) => {
    const { data, save, id } = getContext(req);
    data.users = data.users.filter((u: any) => u.id !== req.params.id);
    save();
    io.to(id).emit("db:update", data);
    // Notify super admin only
    io.emit("notification", { message: `Usuario rechazado en ${id}`, type: "user", targetRole: "superadmin" });
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const userIndex = data.users.findIndex((u: any) => u.id === req.params.id);
    if (userIndex !== -1) {
      const user = data.users[userIndex];
      if (user.email === "jsphprendas@gmail.com") {
        return res.status(403).json({ error: "No se puede eliminar al administrador maestro" });
      }
      
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "user",
        originalId: user.id,
        data: user,
        deletedAt: new Date().toISOString()
      });

      data.users = data.users.filter((u: any) => u.id !== req.params.id);
      save();
      io.to(id).emit("db:update", data);
      io.to(id).emit("notification", { message: `Usuario enviado a papelera: ${user.name}`, type: "user", targetRole: "admin" });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Usuario no encontrado" });
    }
  });

  app.delete("/api/admin/users/:id/purge", (req, res) => {
    const { isSuperAdmin } = getContext(req);
    if (!isSuperAdmin) return res.status(403).json({ error: "Acceso denegado" });
    
    // Purge from everything: users list and any trash records
    Object.keys(dataByDelegation).forEach(delId => {
       const delData = dataByDelegation[delId];
       delData.users = delData.users.filter((u: any) => u.id !== req.params.id);
       if (delData.trash) {
         delData.trash = delData.trash.filter((t: any) => t.data?.id !== req.params.id);
       }
       saveDelegationData(delId);
       io.to(delId).emit("db:update", delData);
    });
    
    res.json({ success: true });
  });

  // Trash Endpoints
  app.get("/api/trash", (req, res) => {
    const { data } = getContext(req);
    res.json(data.trash || []);
  });

  app.post("/api/trash/restore", (req, res) => {
    const { data, save, id } = getContext(req);
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid IDs" });

    const restoredItems: any[] = [];
    const remainingTrash: any[] = [];

    (data.trash || []).forEach((item: any) => {
      if (ids.includes(item.id)) {
        restoredItems.push(item);
      } else {
        remainingTrash.push(item);
      }
    });

    restoredItems.forEach(item => {
      switch (item.type) {
        case 'product':
          data.products.push(item.data);
          break;
        case 'movement':
          data.movements.push(item.data);
          break;
        case 'user':
          data.users.push(item.data);
          break;
        case 'request':
          data.requests.push(item.data);
          break;
        case 'support':
          if (!data.supportRecords) data.supportRecords = [];
          data.supportRecords.push(item.data);
          break;
        case 'gas':
          if (!data.gasReports) data.gasReports = [];
          data.gasReports.push(item.data);
          break;
      }
    });

    data.trash = remainingTrash;
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true, restored: restoredItems.length });
  });

  app.delete("/api/trash/empty", (req, res) => {
    const { data, save, id } = getContext(req);
    data.trash = [];
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.delete("/api/trash/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    data.trash = (data.trash || []).filter((t: any) => t.id !== req.params.id);
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.get("/api/db", (req, res) => {
    const { data, id } = getContext(req);
    res.json({ 
      ...data, 
      _isLoaded: loadedDelegations.has(id),
      _isGlobalLoaded: isGlobalLoaded
    });
  });

  app.get("/api/settings", (req, res) => {
    const { data } = getContext(req);
    res.json(data.settings || {});
  });

  app.post("/api/settings/visibility", (req, res) => {
    const { data, save, id } = getContext(req);
    const { location, visible } = req.body;
    if (!data.settings) data.settings = {};
    if (!data.settings.locationVisibility) {
      data.settings.locationVisibility = { fuerza_publica: true, fronteras: true };
    }
    
    if (location === 'fuerza_publica' || location === 'fronteras') {
      data.settings.locationVisibility[location] = visible;
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true, settings: data.settings });
    } else {
      res.status(400).json({ error: "Ubicación inválida" });
    }
  });

  app.post("/api/settings/locations", (req, res) => {
    const { data, save, id } = getContext(req);
    const { action, location } = req.body;
    
    if (!data.settings) data.settings = {};
    if (!data.settings.customLocations) {
      data.settings.customLocations = [
        { id: "fuerza_publica", name: "Fuerza Pública", visible: true },
        { id: "fronteras", name: "Fronteras", visible: true }
      ];
    }
    
    if (action === 'add') {
      data.settings.customLocations.push({ id: Date.now().toString(), name: location.name, visible: true });
    } else if (action === 'delete') {
      // SAFETY GUARD: Check if there are products in this location
      const productsInLocation = data.products.filter((p: any) => p.location === location.id);
      if (productsInLocation.length > 0) {
        return res.status(400).json({ 
          error: `No se puede eliminar: Hay ${productsInLocation.length} artículos asociados a esta ubicación. Muévalos o elimínelos primero.` 
        });
      }
      
      // SAFETY GUARD: Check if there are categories in this location
      const categoriesInLocation = data.categories.filter((c: any) => c.location === location.id);
      if (categoriesInLocation.length > 0) {
        return res.status(400).json({ 
          error: `No se puede eliminar: Hay ${categoriesInLocation.length} bloques asociados a esta ubicación.` 
        });
      }

      // Add to trash for recovery
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-loc-" + Date.now(),
        type: "location",
        data: location,
        deletedAt: new Date().toISOString()
      });

      data.settings.customLocations = data.settings.customLocations.filter((loc: any) => loc.id !== location.id);
    } else if (action === 'toggle') {
      const locToToggle = data.settings.customLocations.find((loc: any) => loc.id === location.id);
      if (locToToggle) {
        locToToggle.visible = !locToToggle.visible;
      }
    }
    
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true, settings: data.settings });
  });

  app.post("/api/categories", (req, res) => {
    const { data, save, id } = getContext(req);
    const category = { 
      id: Date.now().toString(), 
      location: 'fuerza_publica', // Default
      ...req.body 
    };
    data.categories.push(category);
    save();
    io.to(id).emit("db:update", data);
    res.json(category);
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const categoryIndex = data.categories.findIndex((c: any) => c.id === req.params.id);
    if (categoryIndex !== -1) {
      data.categories.splice(categoryIndex, 1);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Bloque no encontrado" });
    }
  });

  app.put("/api/categories/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const { name } = req.body;
    const index = data.categories.findIndex((c: any) => c.id === req.params.id);
    
    if (index !== -1) {
      const oldName = data.categories[index].name;
      data.categories[index].name = name;
      
      // Update all products referencing this category name
      data.products.forEach((p: any) => {
        if (p.category === oldName) {
          p.category = name;
        }
      });

      // Update all movements referencing this category name
      data.movements.forEach((m: any) => {
        if (m.category === oldName) {
          m.category = name;
        }
      });

      save();
      io.to(id).emit("db:update", data);
      res.json(data.categories[index]);
    } else {
      res.status(404).json({ error: "Category not found" });
    }
  });

  app.post("/api/products", (req, res) => {
    const { data, save, id } = getContext(req);
    const product = { 
      id: Date.now().toString(), 
      location: 'fuerza_publica', // Default
      ...req.body 
    };
    data.products.push(product);

    if (parseFloat(product.quantity || 0) > 0) {
      addMovement(data, {
        productId: product.id,
        productName: product.name,
        type: "in",
        quantity: parseFloat(product.quantity),
        unit: product.unit,
        category: product.category,
        location: product.location,
        note: product.refillType === 'semanal' ? 'INGRESO SEMANAL' : 'INGRESO GLOBAL'
      });
    }

    save();
    io.to(id).emit("db:update", data);
    res.json(product);
  });

  app.put("/api/products/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const index = data.products.findIndex((p: any) => p.id === req.params.id);
    if (index !== -1) {
      const oldProduct = data.products[index];
      const newProduct = { ...oldProduct, ...req.body };
      
      const oldQty = parseFloat(oldProduct.quantity || "0");
      const newQty = parseFloat(newProduct.quantity || "0");
      
      if (oldQty !== newQty) {
        addMovement(data, {
          productId: oldProduct.id,
          productName: newProduct.name,
          type: newQty > oldQty ? "in" : "out",
          quantity: Math.abs(newQty - oldQty),
          unit: newProduct.unit,
          category: newProduct.category || oldProduct.category,
          location: newProduct.location || oldProduct.location,
          note: "EDICIÓN MANUAL DE ARTÍCULO"
        });
        checkCriticalStock(data, newProduct, oldQty, newQty);
      }
      
      data.products[index] = newProduct;
      save();
      io.to(id).emit("db:update", data);
      res.json(data.products[index]);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const index = data.products.findIndex((p: any) => p.id === req.params.id);
    if (index !== -1) {
      const product = data.products[index];
      
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "product",
        originalId: product.id,
        data: product,
        deletedAt: new Date().toISOString()
      });

      data.products = data.products.filter((p: any) => p.id !== req.params.id);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.post("/api/requests", (req, res) => {
    const { data, save, id } = getContext(req);
    const { signature, timestamp } = req.body;
    if (!signature || signature.length < 500) {
      return res.status(400).json({ error: "La firma es obligatoria y debe ser válida." });
    }
    const request = { 
      id: Date.now().toString(), 
      status: "pending", 
      isUrgent: req.body.isUrgent || false,
      timestamp: timestamp || new Date().toISOString(),
      ...req.body 
    };
    data.requests.push(request);
    save();
    io.to(id).emit("db:update", data);
    
    // Global Log
    const del = globalData.delegations.find((d: any) => d.id === id);
    addGlobalLog("NUEVA_PETICION", `Pedido de ${request.userName} (${request.items.length} items)`, request.userName, id, del?.name);

    io.to(id).emit("notification", { 
      message: `${request.isUrgent ? '🚨 PEDIDO URGENTE: ' : 'Nuevo pedido: '}${request.userName}`, 
      type: "request", 
      isUrgent: request.isUrgent,
      targetRole: "admin" 
    });
    
    // Also notify other cooks if it's urgent
    if (request.isUrgent) {
      io.to(id).emit("notification", {
        message: `🚨 COCINA: Pedido URGENTE de ${request.userName}`,
        type: "request",
        isUrgent: true,
        targetRole: "cook"
      });
    }
    
    res.json(request);
  });

  app.post("/api/requests/:id/confirm", (req, res) => {
    const { data, save, id, userEmail } = getContext(req);
    const index = data.requests.findIndex((r: any) => r.id === req.params.id);
    if (index !== -1) {
      const request = data.requests[index];
      const oldStatus = request.status;
      request.status = "confirmed";
      
      // Enterprise Audit
      addAuditEntry(data, {
        userId: userEmail,
        userName: userEmail.split('@')[0],
        action: "APPROVE_REQUEST",
        entityType: "Request",
        entityId: request.id,
        oldValue: { status: oldStatus },
        newValue: { status: "confirmed" },
        severity: request.isUrgent ? 'high' : 'medium'
      });
      
      // Withdraw products from inventory and create movements
      request.items.forEach((item: any) => {
        const prodIndex = data.products.findIndex((p: any) => p.id === item.productId);
        if (prodIndex !== -1) {
          const product = data.products[prodIndex];
          const qtyRequested = parseFloat(item.quantity);
          const oldQty = parseFloat(product.quantity);
          const newQty = Math.max(0, oldQty - qtyRequested);
          product.quantity = newQty.toString();
          checkCriticalStock(data, product, oldQty, newQty);
          
          addMovement(data, {
            productId: product.id,
            productName: product.name,
            type: "out",
            quantity: qtyRequested,
            unit: product.unit,
            category: product.category,
            location: product.location,
            note: `Pedido por: ${request.userName}${request.note ? ' - ' + request.note : ''}`
          });
        }
      });

      save();
      io.to(id).emit("db:update", data);
      res.json(request);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.put("/api/requests/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const index = data.requests.findIndex((r: any) => r.id === req.params.id);
    if (index !== -1) {
      if (data.requests[index].status !== 'pending') {
        return res.status(400).json({ error: "No se puede modificar una solicitud confirmada o rechazada" });
      }
      data.requests[index].items = req.body.items;
      data.requests[index].note = req.body.note;
      if (req.body.isUrgent !== undefined) {
        data.requests[index].isUrgent = req.body.isUrgent;
      }

      save();
      io.to(id).emit("db:update", data);
      res.json(data.requests[index]);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.post("/api/requests/:id/reject", (req, res) => {
    const { data, save, id, userEmail } = getContext(req);
    const index = data.requests.findIndex((r: any) => r.id === req.params.id);
    if (index !== -1) {
      const request = data.requests[index];
      const oldStatus = request.status;
      request.status = "rejected";

      addAuditEntry(data, {
        userId: userEmail,
        userName: userEmail.split('@')[0],
        action: "REJECT_REQUEST",
        entityType: "Request",
        entityId: request.id,
        oldValue: { status: oldStatus },
        newValue: { status: "rejected" },
        severity: 'medium'
      });

      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  // Enterprise Workflow Transition
  app.post("/api/workflow/transition/:id", (req, res) => {
    const { data, save, id: delId, userEmail } = getContext(req);
    const { status, note } = req.body;
    const request = data.requests.find((r: any) => r.id === req.params.id);
    
    if (request) {
      const oldStatus = request.status;
      request.status = status;
      
      // Log transition
      addAuditEntry(data, {
        userId: userEmail,
        userName: userEmail.split('@')[0],
        action: "WORKFLOW_TRANSITION",
        entityType: "Request",
        entityId: request.id,
        oldValue: oldStatus,
        newValue: status,
        severity: 'low',
        metadata: { note }
      });

      save();
      io.to(delId).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Record not found" });
    }
  });

  app.put("/api/history/requests/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const { id: reqId } = req.params;
    const body = req.body;
    let found = false;
    let updatedReq = null;

    // Check main requests
    const reqIndex = data.requests.findIndex((r: any) => r.id === reqId);
    if (reqIndex !== -1) {
      data.requests[reqIndex] = { ...data.requests[reqIndex], ...body };
      updatedReq = data.requests[reqIndex];
      found = true;
    } else {
      // Check in past histories
      for (const history of data.pastHistories) {
        const hReqIndex = history.requests?.findIndex((r: any) => r.id === reqId);
        if (hReqIndex !== -1 && hReqIndex !== undefined) {
          history.requests[hReqIndex] = { ...history.requests[hReqIndex], ...body };
          updatedReq = history.requests[hReqIndex];
          found = true;
          if (db) {
            try { db.doc(`delegations/${id}/pastHistories/${history.id}`).set(sanitizeForFirestore(history)); } catch(e){}
          }
          break;
        }
      }
    }

    if (found) {
      save();
      io.to(id).emit("db:update", data);
      res.json(updatedReq);
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.delete("/api/history/requests/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    const { id: reqId } = req.params;
    let found = false;

    // Check main requests
    const reqIndex = data.requests.findIndex((r: any) => r.id === reqId);
    if (reqIndex !== -1) {
      data.requests.splice(reqIndex, 1);
      found = true;
    } else {
      // Check in past histories
      for (const history of data.pastHistories) {
        const hReqIndex = history.requests?.findIndex((r: any) => r.id === reqId);
        if (hReqIndex !== -1 && hReqIndex !== undefined) {
          history.requests.splice(hReqIndex, 1);
          found = true;
          if (db) {
            try { db.doc(`delegations/${id}/pastHistories/${history.id}`).set(sanitizeForFirestore(history)); } catch(e){}
          }
          break;
        }
      }
    }

    if (found) {
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Request not found" });
    }
  });

  app.post("/api/inventory/add", (req, res) => {
    const { data, save, id } = getContext(req);
    const { productId, quantity, note, type, timestamp } = req.body;
    
    console.log(`Inventory adjustment for ${productId}: ${type} ${quantity}`);
    
    const prodIndex = data.products.findIndex((p: any) => p.id === productId);
    if (prodIndex !== -1) {
      const product = data.products[prodIndex];
      const qty = parseFloat(quantity);
      const oldQty = parseFloat(product.quantity);
      
      if (isNaN(qty)) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      if (type === "out") {
        const newQty = Math.max(0, oldQty - qty);
        product.quantity = newQty.toString();
        // Pass id for delegation correct notification
        checkCriticalStock(data, product, oldQty, newQty, id);
        console.log(`Stock OUT: ${product.name} ${oldQty} -> ${newQty}`);
      } else {
        const newQty = oldQty + qty;
        product.quantity = newQty.toString();
        console.log(`Stock IN: ${product.name} ${oldQty} -> ${newQty}`);
      }
      
      const movement = {
        id: Date.now().toString() + Math.random(),
        productId: product.id,
        productName: product.name,
        type: type || "in",
        quantity: Math.abs(qty),
        unit: product.unit,
        category: product.category,
        location: product.location,
        timestamp: timestamp || new Date().toISOString(),
        note: note || ""
      };

      addMovement(data, movement);

      if (note && note.includes("AJUSTE ADMIN")) {
        if (!data.adminAuditLog) data.adminAuditLog = [];
        data.adminAuditLog.push(movement);
      }

      save();
      io.to(id).emit("db:update", data);
      res.json(product);
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  app.post("/api/history/archive", async (req, res) => {
    const { data, save, id } = getContext(req);
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    const todayStr = targetDate.toISOString().split("T")[0];

    // BACKUP BEFORE CLEAR
    if (db) {
       await db.collection(`delegations/${id}/backups`).add({
         type: "pre_archive",
         timestamp: new Date().toISOString(),
         dataSnapshot: {
           movements: data.movements,
           requests: data.requests.filter((r: any) => r.status !== 'pending')
         }
       });
    }
    
    const requestsToArchive = data.requests.filter((r: any) => r.status !== 'pending');
    const remainingRequests = data.requests.filter((r: any) => r.status === 'pending');

    if (data.movements.length === 0 && requestsToArchive.length === 0) {
      return res.status(400).json({ error: "No hay actividad (movimientos o pedidos procesados) para archivar" });
    }

    let existingHistory = data.pastHistories.find((h: any) => h.date.startsWith(todayStr));

    if (existingHistory) {
      existingHistory.movements = [...existingHistory.movements, ...data.movements];
      existingHistory.requests = [...(existingHistory.requests || []), ...requestsToArchive];
      existingHistory.date = targetDate.toISOString();
      if (db) {
        try { await db.doc(`delegations/${id}/pastHistories/${existingHistory.id}`).set(sanitizeForFirestore(existingHistory)); } catch(e){}
      }
    } else {
      const history = {
        id: Date.now().toString(),
        date: targetDate.toISOString(),
        movements: [...data.movements],
        requests: [...requestsToArchive]
      };
      data.pastHistories.push(history);
      if (db) {
        try { await db.doc(`delegations/${id}/pastHistories/${history.id}`).set(sanitizeForFirestore(history)); } catch(e){}
      }
    }

    data.movements = []; 
    data.requests = remainingRequests; 
    
    await save();
    io.to(id).emit("db:update", data);
    res.json(existingHistory || data.pastHistories[data.pastHistories.length - 1]);
  });

  app.put("/api/history/:id", async (req, res) => {
    const { data, save, id } = getContext(req);
    const { title, note, date } = req.body;
    const history = data.pastHistories.find((h: any) => h.id === req.params.id);
    if (!history) {
      return res.status(404).json({ error: "Historial no encontrado" });
    }
    
    if (title !== undefined) history.title = title;
    if (note !== undefined) history.note = note;
    if (date !== undefined) history.date = date;

    if (db) {
      try { await db.doc(`delegations/${id}/pastHistories/${history.id}`).set(sanitizeForFirestore(history)); } catch(e){}
    }
    
    await save();
    io.to(id).emit("db:update", data);
    res.json(history);
  });

  app.delete("/api/history/:id", async (req, res) => {
    const { data, save, id } = getContext(req);
    const historyIndex = data.pastHistories.findIndex((h: any) => h.id === req.params.id);
    if (historyIndex !== -1) {
      const history = data.pastHistories[historyIndex];
      
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "history",
        originalId: history.id,
        data: history,
        deletedAt: new Date().toISOString()
      });

      data.pastHistories = data.pastHistories.filter((h: any) => h.id !== req.params.id);
      if (db) {
         try { await db.doc(`delegations/${id}/pastHistories/${req.params.id}`).delete(); } catch(e){}
      }
      await save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Historial no encontrado" });
    }
  });

  app.delete("/api/movements", async (req, res) => {
    const { data, save, id } = getContext(req);
    data.movements = [];
    await save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.delete("/api/movements/date/:date", async (req, res) => {
    const { data, save, id } = getContext(req);
    const { date } = req.params; 
    
    data.movements = data.movements.filter((m: any) => !m.timestamp.startsWith(date));
    
    if (data.pastHistories && data.pastHistories.length > 0) {
      data.pastHistories = data.pastHistories.map((history: any) => ({
        ...history,
        movements: history.movements.filter((m: any) => !m.timestamp.startsWith(date))
      }));
    }
    
    await save();
    io.to(id).emit("db:update", data);
    res.json({ success: true, message: `Movimientos del día ${date} eliminados.` });
  });

  app.delete("/api/movements/:id", async (req, res) => {
    const { data, save, id } = getContext(req);
    const { id: movId } = req.params;
    let found = false;
    let movementToDelete: any = null;

    const findAndRemove = (list: any[]) => {
      const index = list.findIndex((m: any) => m.id === movId);
      if (index !== -1) {
        movementToDelete = list[index];
        list.splice(index, 1);
        return true;
      }
      return false;
    };

    if (findAndRemove(data.movements)) { found = true; }
    else {
      for (const history of data.pastHistories) {
        if (findAndRemove(history.movements)) {
          found = true;
          if (db) {
            try { await db.doc(`delegations/${id}/pastHistories/${history.id}`).set(sanitizeForFirestore(history)); } catch(e){}
          }
          break;
        }
      }
    }

    if (!found && data.adminAuditLog) {
      if (findAndRemove(data.adminAuditLog)) { found = true; }
    }

    if (found && movementToDelete) {
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "movement",
        originalId: movementToDelete.id,
        data: movementToDelete,
        deletedAt: new Date().toISOString()
      });
      
      await save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Movement not found" });
    }
  });

  app.post("/api/settings", (req, res) => {
    const { data, save, id } = getContext(req);
    if (!data.settings) data.settings = { criticalStockThreshold: 10 };
    data.settings = { ...data.settings, ...req.body };
    save();
    io.to(id).emit("db:update", data);
    res.json(data.settings);
  });

  app.post("/api/system/trash", (req, res) => {
    const { data, save, id } = getContext(req);
    if (!data.trash) data.trash = [];
    const item = { id: Date.now().toString(), ...req.body };
    data.trash.push(item);
    save();
    io.to(id).emit("db:update", data);
    res.json(item);
  });

  app.post("/api/system/restore", (req, res) => {
    const { data, save, id } = getContext(req);
    const { id: itemId } = req.body;
    const index = data.trash.findIndex((t: any) => t.id === itemId);
    if (index !== -1) {
      const entry = data.trash[index];
      const item = entry.data;
      const type = entry.type || item.type; 

      if (type === 'movement') {
        data.movements.push(item);
      } else if (type === 'history') {
        data.pastHistories.push(item);
      } else if (type === 'product') {
        data.products.push(item);
      } else if (type === 'user') {
        data.users.push(item);
      }
      
      data.trash.splice(index, 1);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true, item: item });
    } else {
      res.status(404).json({ error: "Item not found in trash" });
    }
  });

  app.post("/api/system/delete-permanent", (req, res) => {
    const { data, save, id } = getContext(req);
    const { id: itemId } = req.body;
    const index = data.trash.findIndex((t: any) => t.id === itemId);
    if (index !== -1) {
      data.trash.splice(index, 1);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Item not found in trash" });
    }
  });

  app.post("/api/system/clear-trash", (req, res) => {
    const { data, save, id } = getContext(req);
    data.trash = [];
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.post("/api/system/clear-kardex", async (req, res) => {
    const { data, save, id } = getContext(req);
    if (db) {
      const pastHistoriesSnap = await db.collection(`delegations/${id}/pastHistories`).get();
      const deletePromises = pastHistoriesSnap.docs.map((d: any) => d.ref.delete());
      await Promise.all(deletePromises);
    }
    data.pastHistories = [];
    data.movements = []; 
    
    await save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.post("/api/system/reset", async (req, res) => {
    const { data, save, id } = getContext(req);
    const { password } = req.body;
    
    const adminPassword = process.env.ADMIN_RESET_PASSWORD || "admin123";
    
    // Check if it's the global admin password
    let authorized = (password === adminPassword);
    
    // If not global admin, check if it's the delegation's master password
    if (!authorized) {
      const delInfo = globalData.delegations.find((d: any) => d.id === id);
      if (delInfo && delInfo.masterAdminPassword && password === delInfo.masterAdminPassword) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(401).json({ error: "Clave de administrador incorrecta" });
    }

    // BACKUP BEFORE RESET
    if (db) {
       await db.collection(`delegations/${id}/backups`).add({
         type: "pre_reset",
         timestamp: new Date().toISOString(),
         dataSnapshot: {
           movements: data.movements,
           requests: data.requests,
           pastHistories: data.pastHistories,
           supportRecords: data.supportRecords
         }
       });
    }

    data.movements = [];
    data.requests = [];
    data.adminAuditLog = [];
    data.supportRecords = [];
    
    if (db) {
      for (const h of data.pastHistories) {
        try { await db.doc(`delegations/${id}/pastHistories/${h.id}`).delete(); } catch(e){}
      }
    }
    data.pastHistories = [];
    
    await save();
    io.to(id).emit("db:update", data);
    res.json({ success: true, message: "Sistema reiniciado. Bloques preservados." });
  });

  // Support Records API
  app.get("/api/support-records", (req, res) => {
    const { data } = getContext(req);
    res.json(data.supportRecords || []);
  });

  app.post("/api/support-records", (req, res) => {
    const { data, save, id } = getContext(req);
    const record = req.body;
    if (!record.date || !record.items || !record.userName) {
      return res.status(400).json({ error: "Date, items, and userName are required" });
    }

    if (!data.supportRecords) data.supportRecords = [];
    
    const existingIndex = data.supportRecords.findIndex((r: any) => r.date === record.date);
    const updatedRecord = {
      id: existingIndex !== -1 ? data.supportRecords[existingIndex].id : Date.now().toString(),
      timestamp: new Date().toISOString(),
      userName: record.userName,
      ...record
    };

    if (existingIndex !== -1) {
      data.supportRecords[existingIndex] = updatedRecord;
    } else {
      data.supportRecords.push(updatedRecord);
      io.to(id).emit("notification", { 
        message: `NUEVO REGISTRO SOPORTE: ${updatedRecord.userName}`, 
        type: "support", 
        targetRole: "admin" 
      });
    }
    
    record.items.forEach((item: any) => {
      const product = data.products.find((p: any) => p.id === item.productId);
      if (product) {
        const oldQty = parseFloat(product.quantity || "0");
        const qtyToSubtract = parseFloat(item.quantity || "0");
        const newQty = Math.max(0, oldQty - qtyToSubtract);
        product.quantity = newQty.toString();
        
        checkCriticalStock(data, product, oldQty, newQty, id);
      }
      
      addMovement(data, {
        productId: item.productId,
        productName: item.name,
        type: "out",
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        location: product?.location || 'fuerza_publica',
        note: `Gasto apoyo por: ${record.userName}${record.note ? ' - ' + record.note : ''}`
      });
    });

    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.delete("/api/support-records", (req, res) => {
    const { data, save, id } = getContext(req);
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date required" });
    if (!data.supportRecords) return res.status(404).json({ error: "Not found" });
    data.supportRecords = data.supportRecords.filter((r: any) => r.date !== date);
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.delete("/api/support-records/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    if (!data.supportRecords) return res.status(404).json({ error: "Not found" });
    data.supportRecords = data.supportRecords.filter((r: any) => r.id !== req.params.id);
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  // Support Catalog API
  app.post("/api/support-categories", (req, res) => {
    const { data, save, id } = getContext(req);
    const category = { id: Date.now().toString(), ...req.body };
    if (!data.supportCategories) data.supportCategories = [];
    data.supportCategories.push(category);
    save();
    io.to(id).emit("db:update", data);
    res.json(category);
  });

  app.delete("/api/support-categories/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    if (!data.supportCategories) return res.status(404).json({ error: "Not found" });
    data.supportCategories = data.supportCategories.filter((c: any) => c.id !== req.params.id);
    save();
    io.to(id).emit("db:update", data);
    res.json({ success: true });
  });

  app.post("/api/support-products", (req, res) => {
    const { data, save, id } = getContext(req);
    const product = { id: Date.now().toString(), ...req.body };
    if (!data.supportProducts) data.supportProducts = [];
    data.supportProducts.push(product);
    save();
    io.to(id).emit("db:update", data);
    res.json(product);
  });

  app.delete("/api/support-products/:id", (req, res) => {
    const { data, save, id } = getContext(req);
    if (!data.supportProducts) return res.status(404).json({ error: "Not found" });
    const productIndex = data.supportProducts.findIndex((p: any) => p.id === req.params.id);
    if (productIndex !== -1) {
      const product = data.supportProducts[productIndex];
      if (!data.trash) data.trash = [];
      data.trash.push({
        id: "trash-" + Date.now() + Math.random(),
        type: "support-product",
        originalId: product.id,
        data: product,
        deletedAt: new Date().toISOString()
      });
      data.supportProducts.splice(productIndex, 1);
      save();
      io.to(id).emit("db:update", data);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Product not found" });
    }
  });

  // Socket setup
  io.on("connection", (socket) => {
    console.log("Client connected");
    
    socket.on("join:delegation", (delegationId) => {
      socket.join(delegationId);
      console.log(`Socket ${socket.id} joined delegation: ${delegationId}`);
    });

    socket.on("disconnect", () => console.log("Client disconnected"));
  });

  // Generic error handler to ensure JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled API error:", err);
    res.status(err.status || 500).json({ error: "API error", message: err.message });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
