import { toast } from "sonner";

const QUEUE_KEY = "ia_offline_queue";
const CACHE_KEY = "ia_offline_cache";

export function initOfflineSync() {
  if (typeof window === "undefined") return;

  const originalFetch = window.fetch;

  window.addEventListener("online", () => {
    toast.success("Conexión restablecida. Sincronizando datos...");
    processQueue();
  });

  window.addEventListener("offline", () => {
    toast.warning("Sin conexión a internet. Cambios se guardarán localmente.");
  });

  async function processQueue() {
    if (!navigator.onLine) return;

    const queueStr = localStorage.getItem(QUEUE_KEY);
    if (!queueStr) return;

    let queue: any[] = [];
    try {
      queue = JSON.parse(queueStr);
    } catch (e) {
      return;
    }

    if (queue.length === 0) return;

    const remaining = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const res = await originalFetch(item.url, item.options);
        if (res.ok) {
          synced++;
        } else {
          remaining.push(item);
        }
      } catch (e) {
        remaining.push(item);
      }
    }

    if (remaining.length > 0) {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(QUEUE_KEY);
    }

    if (synced > 0) {
      toast.success(`Se sincronizaron ${synced} cambios realizados sin conexión.`);
      window.dispatchEvent(new Event("db:refresh"));
    }
  }

  Object.defineProperty(window, 'fetch', {
    value: async (...args: [RequestInfo | URL, RequestInit?]) => {
      const url = args[0] as string;
      const options = args[1] || {};
      const method = (options.method || "GET").toUpperCase();

      const isApiRequest = typeof url === "string" && url.startsWith("/api/");
      const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

      if (isApiRequest && !navigator.onLine) {
        if (isMutation) {
          // Queue the mutation
          const queueStr = localStorage.getItem(QUEUE_KEY) || "[]";
          let queue = [];
          try { queue = JSON.parse(queueStr); } catch (e) {}
          queue.push({ url, options });
          localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

          toast.info("Cambio guardado local. Se sincronizará al tener internet.");

          return new Response(JSON.stringify({ success: true, _offline: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } else if (method === "GET") {
           const cacheStr = localStorage.getItem(CACHE_KEY) || "{}";
           let cache:any = {};
           try { cache = JSON.parse(cacheStr); } catch (e) {}
           
           const cachedData = cache[url];
           if (cachedData) {
              return new Response(JSON.stringify(cachedData), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
              });
           }
        }
      }

      try {
        const response = await originalFetch(url, options);

        if (isApiRequest && response.ok) {
           if (method === "GET") {
              try {
                  const clone = response.clone();
                  const data = await clone.json();
                  
                  const cacheStr = localStorage.getItem(CACHE_KEY) || "{}";
                  let cache:any = {};
                  try { cache = JSON.parse(cacheStr); } catch (e) {}
                  cache[url] = data;
                  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
              } catch(e) {}
           }
        }

        return response;
      } catch (error: any) {
        const isNetworkError = error.name === "TypeError" || error.message.includes("Failed to fetch");

        if (isApiRequest && isNetworkError) {
          if (isMutation) {
              const queueStr = localStorage.getItem(QUEUE_KEY) || "[]";
              let queue = [];
              try { queue = JSON.parse(queueStr); } catch (e) {}
              queue.push({ url, options });
              localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

              toast.info("Error de red. Cambio guardado temporalmente.");

              return new Response(JSON.stringify({ success: true, _offline: true }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
              });
          } else if (method === "GET") {
               const cacheStr = localStorage.getItem(CACHE_KEY) || "{}";
               let cache:any = {};
               try { cache = JSON.parse(cacheStr); } catch (e) {}
               
               const cachedData = cache[url];
               if (cachedData) {
                  return new Response(JSON.stringify(cachedData), {
                      status: 200,
                      headers: { "Content-Type": "application/json" }
                  });
               }
          }
        }

        throw error;
      }
    },
    writable: true,
    configurable: true
  });

  setTimeout(processQueue, 3000);
}
