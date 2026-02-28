// Task statuses (default set, can be extended per project)
export const TASK_STATUS = {
  A_TRAITER: 'a_traiter',
  EN_ATTENTE: 'en_attente',
  EN_COURS: 'en_cours',
  A_COMPLETER: 'a_completer',
  EN_REVUE: 'en_revue',
  TERMINEE: 'terminee',
  LIVREE: 'livree',
  BLOQUEE: 'bloquee',
  ANNULEE: 'annulee',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  a_traiter: '#94A3B8',
  en_attente: '#F59E0B',
  en_cours: '#3B82F6',
  a_completer: '#8B5CF6',
  en_revue: '#06B6D4',
  terminee: '#22C55E',
  livree: '#16A34A',
  bloquee: '#EF4444',
  annulee: '#6B7280',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  a_traiter: 'À traiter',
  en_attente: 'En attente',
  en_cours: 'En cours',
  a_completer: 'À compléter',
  en_revue: 'En revue',
  terminee: 'Terminée',
  livree: 'Livrée',
  bloquee: 'Bloquée',
  annulee: 'Annulée',
};

// Statuses requiring a deliverable link
export const STATUSES_REQUIRING_DELIVERABLE: TaskStatus[] = ['terminee', 'livree'];

export const PRIORITY = {
  BASSE: 'basse',
  NORMALE: 'normale',
  HAUTE: 'haute',
  URGENTE: 'urgente',
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const ROLE = {
  SUPER_ADMIN: 'super_admin',
  GERANT: 'gerant',
  RESPONSABLE_PRODUCTION: 'responsable_production',
  EMPLOYE: 'employe',
  COMPTABLE: 'comptable',
  RH: 'rh',
  CLIENT: 'client',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const CUSTOM_FIELD_TYPE = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  SELECT: 'select',
  BOOLEAN: 'boolean',
  MULTISELECT: 'multiselect',
  URL: 'url',
  GPS: 'gps',
} as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE)[keyof typeof CUSTOM_FIELD_TYPE];

export const CUSTOM_FIELD_SCOPE = {
  TASK: 'task',
  SITE: 'site',
} as const;

export type CustomFieldScope = (typeof CUSTOM_FIELD_SCOPE)[keyof typeof CUSTOM_FIELD_SCOPE];

export const SITE_TYPOGRAPHY = {
  PYLONE: 'pylone',
  TERRASSE_TECHNIQUE: 'terrasse_technique',
  TOUR: 'tour',
  CHATEAU_EAU: 'chateau_eau',
  SHELTER: 'shelter',
  LOCAL_TECHNIQUE: 'local_technique',
  AUTRE: 'autre',
} as const;

export type SiteTypology = (typeof SITE_TYPOGRAPHY)[keyof typeof SITE_TYPOGRAPHY];

export const PROJECT_STATUS = {
  BROUILLON: 'brouillon',
  EN_COURS: 'en_cours',
  EN_PAUSE: 'en_pause',
  TERMINE: 'termine',
  ANNULE: 'annule',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

export const QUOTE_STATUS = {
  BROUILLON: 'brouillon',
  ENVOYE: 'envoye',
  ACCEPTE: 'accepte',
  REFUSE: 'refuse',
  EXPIRE: 'expire',
} as const;

export const INVOICE_STATUS = {
  BROUILLON: 'brouillon',
  ENVOYEE: 'envoyee',
  PAYEE_PARTIELLEMENT: 'payee_partiellement',
  PAYEE: 'payee',
  EN_RETARD: 'en_retard',
  ANNULEE: 'annulee',
} as const;

export const DEMAND_STATUS = {
  NOUVELLE: 'nouvelle',
  ACCEPTEE: 'acceptee',
  EN_COURS: 'en_cours',
  LIVREE: 'livree',
  REJETEE: 'rejetee',
} as const;

export const ATTACHMENT_STATUS = {
  GENERE: 'genere',
  VALIDE: 'valide',
  FACTURE: 'facture',
} as const;

export const LEAVE_STATUS = {
  EN_ATTENTE: 'en_attente',
  APPROUVE: 'approuve',
  REFUSE: 'refuse',
  ANNULE: 'annule',
} as const;

export const CONTRACT_TYPE = {
  CDI: 'cdi',
  CDD: 'cdd',
  STAGE: 'stage',
  FREELANCE: 'freelance',
  ALTERNANCE: 'alternance',
} as const;

export const INTERLOCUTEUR_FONCTION = {
  CHEF_PROJET: 'chef_projet',
  CHARGE_AFFAIRE: 'charge_affaire',
  RESP_BE: 'resp_be',
  AUTRE: 'autre',
} as const;
