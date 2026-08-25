import { empFilter } from './empresaScope.ts';

// Critério de cliente ativo e receita para análise de churn/coorte.
//
// Cliente ativo no período = tem ao menos uma remessa REALIZADA (fl_remessa.dt_saida
// preenchida — equipamento efetivamente saiu) e não cancelada (fl_rem_cancelada <> 'S'),
// ligada a uma ficha de locação (fich_loc) com cd_pessoa. Substitui a contagem bruta de
// fich_loc, que inclui orçamentos não aprovados e remessas canceladas — inflação
// artificial de churn. (dt_liberacao existe na tabela mas é NULL em 100% dos registros
// deste ERP — a data de realização efetiva é dt_saida.)
//
// Receita do cliente no período = SUM(fl_fatura.vl_fatura) das faturas geradas para a
// ficha do cliente (fl_fatura.dt_geracao dentro do período). Substitui o proxy da tabela
// nf, que perdia clientes faturados sem NF ainda emitida.
//
// Os fragmentos abaixo NÃO incluem filtro de data — cada chamador adiciona o
// predicado sargable sobre a coluna de data apropriada (r.dt_saida ou fat.dt_geracao).

// Base de remessas realizadas ligadas à ficha.
// Caller monta o SELECT e adiciona: AND r.dt_saida >= <start> AND r.dt_saida < <end>
export const approvedRemessaFrom = `FROM fl_remessa r WITH (NOLOCK)
  JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = r.cd_controle
  WHERE r.dt_saida IS NOT NULL
    AND ISNULL(r.fl_rem_cancelada,'') <> 'S'
    AND f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
    ${empFilter('f')}`;

// Base de faturas ligadas à ficha.
// Caller monta o SELECT/GROUP BY e adiciona: AND fat.dt_geracao >= <start> AND fat.dt_geracao < <end>
export const faturaFrom = `FROM fl_fatura fat WITH (NOLOCK)
  JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle
  WHERE f.cd_pessoa IS NOT NULL AND f.cd_pessoa <> ''
    AND (f.cd_empresa IS NULL OR f.cd_empresa NOT IN (5,6))`;