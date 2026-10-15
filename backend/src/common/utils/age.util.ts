/**
 * Idade a partir da data de nascimento.
 *
 * A data gravada chega como meia-noite UTC (ex.: 2019-04-12T00:00:00.000Z).
 * Ler o dia com o fuso local (Brasil, UTC-3) empurra o aniversário para o
 * dia anterior e pode roubar um mês. O nascimento usa o calendário UTC;
 * "hoje" usa o calendário local do servidor, que é o dia da avaliação.
 *
 * Os meses exibidos são o resto (0–11), nunca o total de meses de vida.
 */

export function ageParts(birthDate: Date, now: Date = new Date()): { years: number; months: number } {
  const yearsRaw = now.getFullYear() - birthDate.getUTCFullYear();
  let months = now.getMonth() - birthDate.getUTCMonth();
  if (now.getDate() < birthDate.getUTCDate()) months -= 1;
  let years = yearsRaw;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function ageInYears(birthDate: Date, at: Date = new Date()): number {
  return ageParts(birthDate, at).years;
}

export function ageDescription(birthDate: Date, now: Date = new Date()): string {
  const { years, months } = ageParts(birthDate, now);
  const yearLabel = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  const monthLabel = `${months} ${months === 1 ? 'mês' : 'meses'}`;
  if (years === 0) return monthLabel;
  if (months === 0) return yearLabel;
  return `${yearLabel} e ${monthLabel}`;
}

export function ageInMonths(birthDate: Date, reference: Date = new Date()): number {
  const { years, months } = ageParts(birthDate, reference);
  return years * 12 + months;
}

export function formatAge(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} ${rest === 1 ? 'mês' : 'meses'}`;
  if (rest === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${rest} ${rest === 1 ? 'mês' : 'meses'}`;
}
