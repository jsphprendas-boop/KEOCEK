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
  status: 'pending' | 'reviewing' | 'approved' | 'confirmed' | 'rejected' | 'delivered';
  isUrgent?: boolean;
  timestamp: string;
  note?: string;
  signature?: string; // Base64 data URL
  workflowId?: string;
}

export interface User {
  id: string;
  email: string;
  googleUid?: string;
  role: 'admin' | 'cook' | 'viewer';
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

export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  value: any;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  assignedRole: 'admin' | 'cook' | 'viewer';
  order: number;
}

export interface WorkflowInstance {
  id: string;
  title: string;
  type: 'inventory_request' | 'purchase_order' | 'data_archival' | 'request';
  currentStageId: string;
  status: 'active' | 'completed' | 'cancelled' | 'rejected';
  creatorId: string;
  createdAt: string;
  startedAt: string;
  stages: Array<{
    id: string;
    name: string;
    status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  }>;
  history: Array<{
    stageId: string;
    actorId: string;
    action: 'approved' | 'rejected' | 'commented';
    timestamp: string;
    comment?: string;
  }>;
  payload: any; // Context data (e.g. Request details)
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string; // "UPDATE_PRODUCT", "DELETE_USER", etc.
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface DBData {
  categories: Category[];
  products: Product[];
  movements: Movement[];
  requests: Request[];
  users: User[];
  pastHistories: ArchivedHistory[];
  adminAuditLog?: Movement[];
  auditEntries?: AuditEntry[]; // Detailed enterprise logs
  workflows?: WorkflowInstance[];
  governancePolicies?: GovernancePolicy[];
  supportRecords?: SupportRecord[];
  supportCategories?: SupportCategory[];
  supportProducts?: SupportProduct[];
  gasReports?: GasReport[];
  trash: TrashItem[];
  _isLoaded?: boolean;
  _isGlobalLoaded?: boolean;
  settings?: {
    criticalStockThreshold?: number;
    locationVisibility?: {
      fuerza_publica?: boolean;
      fronteras?: boolean;
    };
    customLocations?: Array<{ id: string, name: string, visible: boolean }>;
    enterpriseEnablement?: {
      workflowsEnabled: boolean;
      ssoRequired: boolean;
      auditEnabled: boolean;
    };
  };
}
