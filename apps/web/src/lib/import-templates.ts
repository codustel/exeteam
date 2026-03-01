'use client';

import * as ExcelJS from 'exceljs';
import { ImportEntityType, TEMPLATE_HEADERS } from '@exeteam/shared';

/**
 * Generate and trigger browser download of a minimal Excel template
 * with the correct column headers for the given entity type.
 */
export async function downloadImportTemplate(entityType: ImportEntityType): Promise<void> {
  const headers = TEMPLATE_HEADERS[entityType];
  if (!headers) throw new Error(`Unknown entity type: ${entityType}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ExeTeam';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Import');

  // Auto-width columns
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(header.length + 4, 15),
  }));

  // Add header row with bold styling
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFF6600' },
  };

  // Add one empty sample row
  const sampleData = headers.map(() => '');
  sheet.addRow(sampleData);

  // Write to buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `modele-import-${entityType}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
