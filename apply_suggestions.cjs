const fs = require('fs');

const path = 'src/components/CookDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add `isOnline` state
const targetState = 'const [searchTerm, setSearchTerm] = useState("");';
const onlineState = `
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");`;

content = content.replace(targetState, onlineState);

// 2. Add Haptic feedback to `addToCart`
const targetAddToCart = 'const addToCart = (product: Product) => {';
const newAddToCart = `const addToCart = (product: Product) => {
    try { if (navigator.vibrate) navigator.vibrate(50); } catch(e){} // Haptic feedback`;
content = content.replace(targetAddToCart, newAddToCart);

// 3. Update Terminal Cocina Header for Offline State
const targetHeader = `<h1 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase italic">Terminal Cocina</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.3em] leading-none mt-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Sincronizado V5.0
            </p>`;

const newHeader = `<h1 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase italic">Terminal Cocina</h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] leading-none mt-1.5 flex items-center gap-2">
              <span className={\`w-1.5 h-1.5 rounded-full \${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}\`} />
              {isOnline ? 'Sincronizado' : 'Sin Conexión'}
            </p>`;

content = content.replace(targetHeader, newHeader);

// 4. Update Search Input to have a Clear button
const targetSearch = `<Input 
                        placeholder="Buscar insumos..." 
                        className="pl-12 border-slate-200 dark:border-slate-800 rounded-3xl h-14 md:h-16 text-sm md:text-base bg-white dark:bg-slate-900 shadow-sm focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all text-slate-900 dark:text-slate-100 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />`;

const newSearch = `<Input 
                        placeholder="Buscar insumos..." 
                        className="pl-12 pr-12 border-slate-200 dark:border-slate-800 rounded-3xl h-14 md:h-16 text-sm md:text-base bg-white dark:bg-slate-900 shadow-sm focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all text-slate-900 dark:text-slate-100 font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <AnimatePresence>
                        {searchTerm && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full"
                              onClick={() => setSearchTerm("")}
                            >
                              <XCircle className="w-5 h-5" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>`;

content = content.replace(targetSearch, newSearch);

fs.writeFileSync(path, content);
console.log('Suggestions applied.');
