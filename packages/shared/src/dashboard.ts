// packages/shared/src/dashboard.ts

export interface GeneralDashboard {
  clients: { total: number; nouveauxCeMois: number };
  projects: { total: number; enCours: number; termines: number };
  tasks: { total: number; enCours: number; terminees: number; enRetard: number };
  employees: { total: number; enConge: number; actifs: number };
  revenue: { factureEmisHT: number; encaisse: number; enAttente: number };
  rendementMoyen: number;
  tasksByStatus: { status: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  tasksCompletedByWeek: { week: string; completed: number }[];
}

export interface ProductionDashboard {
  tasksByStatus: { status: string; count: number }[];
  rendementParOperateur: {
    operatorId: string;
    operatorName: string;
    rendement: number;
  }[];
  delaiRLMoyen: number;
  tasksOverdue: number;
  tasksCompletedOnTime: number;
  productionByWeek: { week: string; completed: number; started: number }[];
  topCodes: { codeProduit: string; count: number; rendementMoyen: number }[];
}

export interface FinancierDashboard {
  chiffreAffaireHT: number;
  chiffreAffaireTTC: number;
  totalAchatsHT: number;
  margeGrossiere: number;
  invoicesByStatus: { status: string; count: number; total: number }[];
  revenueByMonth: { month: string; CA: number; achats: number }[];
  topClients: { clientId: string; clientName: string; totalHT: number }[];
  pendingInvoices: {
    id: string;
    clientName: string;
    amount: number;
    dueDate: string;
  }[];
}

export interface ClientDashboard {
  projects: { total: number; enCours: number; termines: number };
  tasks: { total: number; enCours: number; terminees: number; enRetard: number };
  sites: { total: number };
  lastActivity: string | null;
  tasksByStatus: { status: string; count: number }[];
  recentTasks: {
    id: string;
    title: string;
    status: string;
    updatedAt: string;
  }[];
}

export interface EmployeeDashboard {
  tasksAssigned: number;
  tasksCompleted: number;
  rendementMoyen: number;
  hoursLogged: number;
  congesRestants: number;
  tasksByStatus: { status: string; count: number }[];
  rendementByWeek: { week: string; rendement: number }[];
  upcomingLeaves: { startDate: string; endDate: string; type: string }[];
}

export interface RentabiliteEmployee {
  employeeId: string;
  employeeName: string;
  salaireCharge: number;
  revenueGenere: number;
  ratio: number;
  hoursLogged: number;
  tauxOccupation: number;
}

export interface RentabiliteDashboard {
  employees: RentabiliteEmployee[];
  totals: {
    masseSalariale: number;
    revenueTotal: number;
    ratioGlobal: number;
  };
}

export type DashboardExportType =
  | 'general'
  | 'production'
  | 'financier'
  | 'rentabilite';