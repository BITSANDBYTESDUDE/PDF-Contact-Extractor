import type { Request, Response } from 'express';
import { z } from 'zod';
import { generateCsv } from '../services/csvExporter.js';
import { generateExcel } from '../services/excelExporter.js';

const schema = z.object({
  format: z.enum(['xlsx', 'csv']),
  preserveForExcel: z.boolean().default(true),
  contacts: z
    .array(
      z.object({
        name: z.string().max(150),
        phone: z.string().min(1).max(50),
        sourceFile: z.string().max(180),
      }),
    )
    .min(1)
    .max(10000),
});
export async function exportController(req: Request, res: Response) {
  const input = schema.parse(req.body);
  const filename = `extracted-contacts-${new Date().toISOString().slice(0, 10)}.${input.format}`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (input.format === 'csv')
    res.type('text/csv; charset=utf-8').send(generateCsv(input.contacts, input.preserveForExcel));
  else
    res
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .send(generateExcel(input.contacts));
}
