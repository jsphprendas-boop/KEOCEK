export interface Category {
  id: string;
  name: string;
  location: 'fuerza_publica' | 'fronteras';
}

export interface Product {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  type: string;
  expiryDate: string;
  category: string;
  location: 'fuerza_publica' | 'fronteras';
  isHidden?: boolean;
}

export interface Movement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out';
  quantity: number;
  unit: string;
  category: string;
  location: 'fuerza_publica' | 'fronteras';
  productCategory?: string;
  timestamp: string;
  note: string;
}

export interface ArchivedHistory {
  id: string;
  date: string;
  movements: Movement[];
  requests?: Request[];
  title?: string;
  note?: string;
}

export interface RequestItem {
  productId: string;
  name: string;
  quantity: string;
}

export interface Request {
  id: string;
  userId: string;
  userName: string;
  items: RequestItem[];
  status: 'pending' | 'confirmed' | 'rejected';
  isUrgent?: boolean;
  timestamp: string;
  note?: string;
  signature?: string; // Base64 data URL
}

export interface User {
  id: string;
  email: string;
  googleUid?: string;
  role: 'master_admin' | 'admin' | 'gestion_user' | 'cook' | 'viewer';
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  isApproved: boolean;
  delegationId?: string; // ID of the delegation the user belongs to
  delegationName?: string; // Name of delegation for global view
  password?: string;
  lastLoginAt?: string;
  createdAt?: string;
  lastDeviceUsed?: string;
}

export interface Delegation {
  id: string;
  name: string;
  masterAdminEmail: string;
  masterAdminPassword?: string; // Access key for this delegation
  createdAt: string;
  isCustomMaster?: boolean; // If true, the masterAdminEmail is the master for this specific delegation
}

export interface SupportCategory {
  id: string;
  name: string;
}

export interface SupportProduct {
  id: string;
  name: string;
  category: string; // Category name
  unit: string;
}

export interface SupportRecordItem {
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface SupportRecord {
  id: string;
  date: string;
  userName?: string;
  items: SupportRecordItem[];
  note?: string;
  timestamp: string;
}

export interface GasReport {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  note?: string;
  timestamp: string;
}

export interface TrashItem {
  id: string;
  type: 'product' | 'movement' | 'user' | 'request' | 'support' | 'gas';
  data: any;
  deletedAt: string;
}

export interface AssetLocationBlock {
  id: string;
  name: string;
  subLocations: string[];
}

export interface DBData {
  categories: Category[];
  products: Product[];
  movements: Movement[];
  requests: Request[];
  users: User[];
  pastHistories: ArchivedHistory[];
  adminAuditLog?: Movement[];
  supportRecords?: SupportRecord[];
  supportCategories?: SupportCategory[];
  supportProducts?: SupportProduct[];
  gasReports?: GasReport[];
  trash: TrashItem[];
  assets?: Asset[];
  assetLocationBlocks?: AssetLocationBlock[];
  _isLoaded?: boolean;
  _isGlobalLoaded?: boolean;
  settings?: {
    criticalStockThreshold?: number;
    locationVisibility?: {
      fuerza_publica?: boolean;
      fronteras?: boolean;
    };
    customLocations?: Array<{ id: string, name: string, visible: boolean }>;
  };
}

export interface Asset {
  id: string;
  itemNumber: string; // Numero de item
  barcode: string; // Cod de barras
  assetNumber: string; // Patrimonio
  description: string; // Descripción
  brand: string; // Marca
  model: string; // Modelo
  serialNumber: string; // Serie
  state: 'bueno' | 'regular' | 'malo'; // Estado
  observations: string; // Observaciones
  lastRevisionDate?: string; // Fecha de última revisión
  locationBlock?: string; // Bloque de ubicación (e.g. Módulo A)
  location?: string; // Ubicación específica o número de cama/cuarto (e.g. Cama 12)
  assignedTo?: string; // ID del usuario al que se le asigna (opcional)
}
