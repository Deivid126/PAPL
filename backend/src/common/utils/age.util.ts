/**
 * Calcula a idade em meses completos a partir da data de nascimento.
 * Armazenamos a idade em meses (Child.ageAtEvaluation) e formatamos
 * como "X anos e Y meses" na apresentação.
 */
export function ageInMonths(birthDate: Date, reference: Date = new Date()): number {
  const b = new Date(birthDate);
  const r = new Date(reference);
  let months = (r.getFullYear() - b.getFullYear()) * 12;
  months += r.getMonth() - b.getMonth();
  if (r.getDate() < b.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function formatAge(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} ${rest === 1 ? 'mês' : 'meses'}`;
  if (rest === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${rest} ${rest === 1 ? 'mês' : 'meses'}`;
}