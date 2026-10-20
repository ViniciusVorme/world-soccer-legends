export const PESO_ATAQUE = {
  GOL: 0, LD: 0, ZAG: 0, LE: 0,
  MD: 0.5, ME: 0.5, VOL: 0.2, MC: 0.5, MEI: 0.8,
  PD: 1, CA: 1, PE: 1
};

export const PESO_DEFESA = {
  GOL: 1, LD: 1, ZAG: 1, LE: 1,
  MD: 0.5, ME: 0.5, VOL: 0.8, MC: 0.5, MEI: 0.2,
  PD: 0, CA: 0, PE: 0
};

export function calcTeamForces(lineup) {
  let somaAtaque = 0, pesoAtaqueTotal = 0;
  let somaDefesa = 0, pesoDefesaTotal = 0;
  let somaOverall = 0, count = 0;

  for (const { slotPos, player } of lineup) {
    const pa = PESO_ATAQUE[slotPos] ?? 0;
    const pd = PESO_DEFESA[slotPos] ?? 0;
    pesoAtaqueTotal += pa;
    pesoDefesaTotal += pd;
    if (player) {
      somaAtaque += player.force * pa;
      somaDefesa += player.force * pd;
      somaOverall += player.force;
      count++;
    }
  }

  return {
    attack: pesoAtaqueTotal > 0 ? Math.round(somaAtaque / pesoAtaqueTotal) : 0,
    defense: pesoDefesaTotal > 0 ? Math.round(somaDefesa / pesoDefesaTotal) : 0,
    overall: count > 0 ? Math.round(somaOverall / count) : 0
  };
}
