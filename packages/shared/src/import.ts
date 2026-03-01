export enum ImportEntityType {
  Clients = 'clients',
  Employees = 'employees',
  Sites = 'sites',
  Tasks = 'tasks',
  PurchaseInvoices = 'purchase-invoices',
}

export enum ImportJobStatus {
  Pending = 'pending',
  Processing = 'processing',
  Done = 'done',
  Failed = 'failed',
}

export enum OnDuplicateAction {
  Skip = 'skip',
  Update = 'update',
}

export interface ColumnMapping {
  excelColumn: string;
  dbField: string;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportJobSummary {
  id: string;
  entityType: ImportEntityType;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: ImportError[] | null;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: OnDuplicateAction;
  templateId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ImportTemplateSummary {
  id: string;
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Required DB fields per entity type (used for validation UI). */
export const REQUIRED_FIELDS: Record<ImportEntityType, string[]> = {
  [ImportEntityType.Clients]: ['name'],
  [ImportEntityType.Employees]: ['firstName', 'lastName', 'email'],
  [ImportEntityType.Sites]: ['name', 'clientId', 'address'],
  [ImportEntityType.Tasks]: ['title', 'projectId'],
  [ImportEntityType.PurchaseInvoices]: ['reference', 'supplierId', 'amount', 'date'],
};

/** Available DB fields per entity type for mapping dropdowns. */
export const AVAILABLE_FIELDS: Record<ImportEntityType, { value: string; label: string }[]> = {
  [ImportEntityType.Clients]: [
    { value: 'name', label: 'Nom *' },
    { value: 'legalName', label: 'Raison sociale' },
    { value: 'siret', label: 'SIRET' },
    { value: 'vatNumber', label: 'N° TVA' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'addressLine1', label: 'Adresse' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'city', label: 'Ville' },
    { value: 'country', label: 'Pays' },
    { value: 'paymentConditions', label: 'Conditions de paiement' },
    { value: 'notes', label: 'Notes' },
  ],
  [ImportEntityType.Employees]: [
    { value: 'firstName', label: 'Prénom *' },
    { value: 'lastName', label: 'Nom *' },
    { value: 'professionalEmail', label: 'Email professionnel *' },
    { value: 'personalEmail', label: 'Email personnel' },
    { value: 'phone', label: 'Téléphone' },
    { value: 'position', label: 'Poste' },
    { value: 'contractType', label: 'Type de contrat' },
    { value: 'entryDate', label: "Date d'entrée" },
    { value: 'weeklyHours', label: 'Heures hebdomadaires' },
    { value: 'grossSalary', label: 'Salaire brut' },
    { value: 'netSalary', label: 'Salaire net' },
    { value: 'addressLine1', label: 'Adresse' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'city', label: 'Ville' },
  ],
  [ImportEntityType.Sites]: [
    { value: 'name', label: 'Nom *' },
    { value: 'clientId', label: 'Client (ID) *' },
    { value: 'address', label: 'Adresse *' },
    { value: 'postalCode', label: 'Code postal' },
    { value: 'commune', label: 'Commune' },
    { value: 'departement', label: 'Département' },
    { value: 'country', label: 'Pays' },
    { value: 'latitude', label: 'Latitude' },
    { value: 'longitude', label: 'Longitude' },
  ],
  [ImportEntityType.Tasks]: [
    { value: 'title', label: 'Titre *' },
    { value: 'projectId', label: 'Projet (ID) *' },
    { value: 'description', label: 'Description' },
    { value: 'status', label: 'Statut' },
    { value: 'priority', label: 'Priorité' },
    { value: 'employeeId', label: 'Employé assigné (ID)' },
    { value: 'plannedStartDate', label: 'Date début prévue' },
    { value: 'plannedEndDate', label: 'Date fin prévue' },
    { value: 'estimatedHours', label: 'Heures estimées' },
  ],
  [ImportEntityType.PurchaseInvoices]: [
    { value: 'reference', label: 'Référence *' },
    { value: 'supplierId', label: 'Fournisseur (ID) *' },
    { value: 'amount', label: 'Montant HT *' },
    { value: 'date', label: 'Date *' },
    { value: 'vatRate', label: 'Taux TVA' },
    { value: 'dueDate', label: "Date d'échéance" },
    { value: 'notes', label: 'Notes' },
  ],
};

/** Headers for downloadable Excel templates per entity type. */
export const TEMPLATE_HEADERS: Record<ImportEntityType, string[]> = {
  [ImportEntityType.Clients]: [
    'Nom', 'Raison sociale', 'SIRET', 'N° TVA', 'Email', 'Téléphone',
    'Adresse', 'Code postal', 'Ville', 'Pays', 'Conditions de paiement', 'Notes',
  ],
  [ImportEntityType.Employees]: [
    'Prénom', 'Nom', 'Email professionnel', 'Email personnel', 'Téléphone',
    'Poste', 'Type de contrat', "Date d'entrée", 'Heures hebdomadaires',
    'Salaire brut', 'Salaire net', 'Adresse', 'Code postal', 'Ville',
  ],
  [ImportEntityType.Sites]: [
    'Nom', 'Client (ID)', 'Adresse', 'Code postal', 'Commune', 'Département', 'Pays', 'Latitude', 'Longitude',
  ],
  [ImportEntityType.Tasks]: [
    'Titre', 'Projet (ID)', 'Description', 'Statut', 'Priorité',
    'Employé assigné (ID)', 'Date début prévue', 'Date fin prévue', 'Heures estimées',
  ],
  [ImportEntityType.PurchaseInvoices]: [
    'Référence', 'Fournisseur (ID)', 'Montant HT', 'Date', 'Taux TVA', "Date d'échéance", 'Notes',
  ],
};
