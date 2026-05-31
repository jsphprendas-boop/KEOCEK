# System Instructions

- **CRITICAL CORE FUNCTIONALITY PROTECTED:** Any UI change, styling update, or new feature MUST NOT affect the inventory logic, products, data, or history. 
- Defend the core functionality at all costs. Do not remove or block any data, items, or history logs when fixing visual details or applying changes to individual sections.
- When making modifications, use extremely surgical and safe changes (prefer adding CSS/Tailwind classes rather than refactoring structural logic).
- Never lose inventory data when fixing UI.
- **RESTRICTION ON DB AND SERVER**: Do not alter `server.ts`, database saving flows, or `lib/firebase.ts` without explicit user instruction. The backend logic, inventory state (Kardex, movements, current stock), and user authentication are sacred and must be strictly preserved at all times during feature expansions.