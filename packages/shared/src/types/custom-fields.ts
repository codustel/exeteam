export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';

export type CustomFieldsData = Record<string, string | number | boolean | string[] | null>;
