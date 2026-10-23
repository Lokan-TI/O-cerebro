// Janela anual única (Pente Fino 8/8 + F1): usada por QUALQUER refresh, com ou sem
// período explícito. O ano completo é sempre ancorado no ano civil do início do período,
// nunca no fim informado (o refresh "padrão" envia fim = hoje+1, o que antes fazia o
// ano anterior "completo" virar YTD).
//   - YTD: [início-1a, min(fim, hoje+1) - 1a)
//   - Ano anterior completo: [início-1a, início-1a + 1 ano)
//   - ano_parcial: min(fim, hoje+1) < início + 1 ano
export function buildAnnualWindow(requestedStart: string | null, requestedEnd: string | null) {
  const today1 = 'DATEADD(day,1,CAST(GETDATE() AS date))';
  const yearStart = requestedStart ? `'${requestedStart}'` : 'DATEFROMPARTS(YEAR(GETDATE()),1,1)';
  const yearEnd = requestedEnd ? `'${requestedEnd}'` : 'DATEADD(year,1,DATEFROMPARTS(YEAR(GETDATE()),1,1))';
  const lastYearStart = requestedStart
    ? `DATEADD(year,-1,CAST('${requestedStart}' AS date))`
    : 'DATEFROMPARTS(YEAR(GETDATE())-1,1,1)';
  const calYearEnd = `DATEADD(year,1,CAST(${yearStart} AS date))`;
  const effEnd = requestedEnd
    ? `(CASE WHEN CAST('${requestedEnd}' AS date) < ${today1} THEN CAST('${requestedEnd}' AS date) ELSE ${today1} END)`
    : today1;
  const lastYearEnd = `DATEADD(year,-1,${effEnd})`;
  const lastYearFullEnd = `DATEADD(year,1,${lastYearStart})`;
  const ytdExtra = `
        ISNULL(SUM(CASE WHEN dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${lastYearFullEnd} THEN vl_faturamento ELSE 0 END),0) AS fat_ano_ant_full,
        COUNT(CASE WHEN dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${lastYearEnd} THEN 1 END) AS nfs_ano_ant,
        COUNT(DISTINCT CASE WHEN dt_emi_nf >= ${lastYearStart} AND dt_emi_nf < ${lastYearEnd} THEN cd_pessoa END) AS clientes_ano_ant,
        CASE WHEN ${effEnd} < ${calYearEnd} THEN 1 ELSE 0 END AS ano_parcial,
        DAY(GETDATE()) AS ano_ytd_dia,
        CONVERT(varchar(10), DATEADD(day,-1,${effEnd}), 23) AS ano_ytd_ate,`;
  return { yearStart, yearEnd, lastYearStart, lastYearEnd, lastYearFullEnd, effEnd, ytdExtra };
}