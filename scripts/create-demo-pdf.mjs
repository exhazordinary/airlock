import { readFileSync, writeFileSync } from 'node:fs';

const demo = readFileSync(new URL('../web/src/demo.ts', import.meta.url), 'utf8');
const match = demo.match(/export const PAYSLIP = `([^`]+)`;/);
if (!match) throw new Error('Synthetic payslip fixture missing.');
const escape = (text) => text.replace(/[\\()]/g, '\\$&');
const text = (value, x, y, size = 11, font = 'F1', color = '0.10 0.20 0.16') =>
  `${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
const commands = [
  '0.97 0.98 0.96 rg 0 0 595 842 re f',
  '0.08 0.22 0.17 rg 0 730 595 112 re f',
  text('AIRLOCK', 42, 792, 25, 'F2', '1 1 1'),
  text('SYNTHETIC SAMPLE - NOT A REAL PAYSLIP', 42, 765, 11, 'F2', '0.82 0.94 0.84'),
  text('A sample document you can trace back to the page.', 42, 701, 13),
  '1 1 1 rg 30 106 535 570 re f',
];
let y = 652;
for (const line of match[1].split('\n')) {
  if (!line) { y -= 20; continue; }
  const total = /^(Gross Pay|Net Pay):/.test(line);
  if (total) commands.push(`0.90 0.95 0.91 rg 38 ${y - 7} 519 23 re f`);
  commands.push(text(line, 48, y, 11, total ? 'F2' : 'F1'));
  y -= 28;
}
commands.push(text('All names and identifiers are fictional. No real personal data.', 42, 70, 10));
commands.push(text('Upload this file in AIRLOCK, review the text, then choose a question.', 42, 52, 10));
const stream = commands.join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const start = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
writeFileSync(new URL('../web/public/samples/airlock-demo-payslip.pdf', import.meta.url), pdf);
