import { z } from 'zod';

/** Zod schemas used to validate each mapped row before upserting. */

export const ClientRowSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  legalName: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  paymentConditions: z.string().optional(),
  notes: z.string().optional(),
});

export const EmployeeRowSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  professionalEmail: z.string().email('Email professionnel invalide'),
  personalEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  position: z.string().optional(),
  contractType: z.string().optional(),
  entryDate: z.coerce.date().optional(),
  weeklyHours: z.coerce.number().nonnegative().optional(),
  grossSalary: z.coerce.number().nonnegative().optional(),
  netSalary: z.coerce.number().nonnegative().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

export const SiteRowSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  clientId: z.string().min(1, 'Client requis'),
  address: z.string().min(1, 'Adresse requise'),
  postalCode: z.string().optional(),
  commune: z.string().optional(),
  departement: z.string().optional(),
  country: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const TaskRowSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  projectId: z.string().min(1, 'Projet requis'),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  employeeId: z.string().optional(),
  plannedStartDate: z.coerce.date().optional(),
  plannedEndDate: z.coerce.date().optional(),
  estimatedHours: z.coerce.number().nonnegative().optional(),
});

export const PurchaseInvoiceRowSchema = z.object({
  reference: z.string().min(1, 'Référence requise'),
  supplierId: z.string().min(1, 'Fournisseur requis'),
  amount: z.coerce.number({ required_error: 'Montant requis' }),
  date: z.coerce.date({ required_error: 'Date requise' }),
  vatRate: z.coerce.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export type EntityType = 'clients' | 'employees' | 'sites' | 'tasks' | 'purchase-invoices';

export function getRowSchema(entityType: EntityType) {
  switch (entityType) {
    case 'clients':
      return ClientRowSchema;
    case 'employees':
      return EmployeeRowSchema;
    case 'sites':
      return SiteRowSchema;
    case 'tasks':
      return TaskRowSchema;
    case 'purchase-invoices':
      return PurchaseInvoiceRowSchema;
  }
}
