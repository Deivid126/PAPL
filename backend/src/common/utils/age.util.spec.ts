import { ageDescription, ageParts } from './age.util';

describe('ageDescription', () => {
  const birth = new Date('2019-04-12T00:00:00.000Z');

  it('mostra o resto dos meses, não o total de meses de vida', () => {
    const now = new Date(2026, 9, 15);
    expect(ageParts(birth, now)).toEqual({ years: 7, months: 6 });
    expect(ageDescription(birth, now)).toBe('7 anos e 6 meses');
  });

  it('não conta o mês corrente se o dia do aniversário ainda não chegou', () => {
    const now = new Date(2026, 3, 11);
    expect(ageParts(birth, now)).toEqual({ years: 6, months: 11 });
    expect(ageDescription(birth, now)).toBe('6 anos e 11 meses');
  });

  it('omite os meses quando o aniversário cai no dia', () => {
    const now = new Date(2026, 3, 12);
    expect(ageDescription(birth, now)).toBe('7 anos');
  });

  it('usa o dia UTC do nascimento, sem deslocar para o dia anterior', () => {
    const now = new Date(2019, 3, 12);
    expect(ageParts(birth, now)).toEqual({ years: 0, months: 0 });
  });
});
