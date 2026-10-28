import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { buildConfig, runQuery } from "../../shared/erpConnection.ts";
import { invoiceUniverse } from "../../shared/invoiceUniverse.ts";
import { empFilter } from "../../shared/empresaScope.ts";

// Exportacao estritamente read-only para o Comercial Lokan.
// Somente empresas PJ de regioes habilitadas por segredo de aplicacao.
// Nao reutiliza snapshots truncados, nem escreve no ERP.
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const safeText = (v: unknown, max=200) => String(v ?? "").trim().slice(0,max);
const normalizeArea = (city: unknown, uf: unknown) =>
  safeText(city,110).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toUpperCase() + ":" + safeText(uf,2).toUpperCase();
const bad = (error: string, status=400) => Response.json({success:false,error},{status});
const getRows = (result: any): any[] => {
  if(Array.isArray(result?.recordset)) return result.recordset;
  if(Array.isArray(result?.recordsets)){
    for(const list of result.recordsets)if(Array.isArray(list)&&list.length)return list;
  }
  return Array.isArray(result)?result:[];
};
const isCNPJ = (cnpj: string) => {
  if(!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj))return false;
  const validate = (size:number)=>{
    let total=0,k=size-7;
    for(let i=0;i<size;i++){total+=Number(cnpj[i])*k--;if(k<2)k=9;}
    const rest=total%11;
    return Number(cnpj[size])===(rest<2?0:11-rest);
  };
  return validate(12)&&validate(13);
};
function authorized(request: Request) {
  const secret = Deno.env.get("COMERCIAL_EXPORT_SERVICE_TOKEN");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  if(!secret || secret.length < 40 || !bearer || secret.length!==bearer.length)return false;
  let different=0;
  for(let i=0;i<secret.length;i++)different |= secret.charCodeAt(i)^bearer.charCodeAt(i);
  return different===0;
}
async function sqlRead(source: any, query: string, limit=45000){
  const config=buildConfig(source);
  if(!config)throw new Error("Conexao ERP nao configurada");
  const wrapped=config.clientId ? "EXEC DW_API '"+config.clientId.replace(/'/g,"''")+"', '"+query.replace(/'/g,"''")+"'" : query;
  return getRows(await runQuery(source,wrapped,limit));
}
async function sourcesFor(client: any){
  const sourceList = await client.asServiceRole.entities.ErpDataSource.list();
  const rows = Array.isArray(sourceList)?sourceList:(sourceList?.items||sourceList?.data||[]);
  return rows.filter((s:any)=>s.is_active===true && (s.status==="connected" || !s.status));
}
function rentalNFByClientSQL(ids: number[]) {
  const values=ids.join(",");
  const filters = " AND " + invoiceUniverse("n") + " " + empFilter("f");
  const union1 = "SELECT f.cd_pessoa, CAST(n.cd_nf AS varchar(80)) AS cd_nf, " +
      "n.dt_emi_nf, CAST(n.vl_faturamento AS decimal(18,2)) AS valor_nf " +
      "FROM fl_fatura fat WITH (NOLOCK) " +
      "INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle " +
      "INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf " +
      "WHERE f.cd_pessoa IN (" + values + ") AND ISNULL(n.vl_faturamento,0)>0" + filters;
  const union2 = "SELECT f.cd_pessoa, CAST(n.cd_nf AS varchar(80)) AS cd_nf, " +
      "n.dt_emi_nf, CAST(n.vl_faturamento AS decimal(18,2)) AS valor_nf " +
      "FROM fl_fatura fat WITH (NOLOCK) " +
      "INNER JOIN fich_loc f WITH (NOLOCK) ON f.cd_controle = fat.cd_controle " +
      "INNER JOIN nf n WITH (NOLOCK) ON n.cd_nf = fat.cd_nf_mo " +
      "WHERE f.cd_pessoa IN (" + values + ") AND ISNULL(n.vl_faturamento,0)>0" + filters;
  return "WITH nf_locacao AS (" + union1 + " UNION " + union2 + ") " +
      "SELECT cd_pessoa, COUNT(*) AS invoice_count, MIN(cd_nf) AS proof_invoice_id, " +
      "MIN(dt_emi_nf) AS first_revenue_at, MAX(dt_emi_nf) AS last_revenue_at, " +
      "SUM(valor_nf) AS confirmed_rental_revenue " +
      "FROM nf_locacao GROUP BY cd_pessoa";
}
function dateText(d:unknown):string|null {
  if(!d)return null;
  const date=new Date(String(d));return Number.isFinite(date.getTime())?date.toISOString():null;
}
Deno.serve(async (req: Request) => {
  try {
    if(req.method!=="POST")return bad("Metodo nao permitido",405);
    if(!authorized(req))return bad("Nao autorizado",401);
    const whitelist = (Deno.env.get("COMERCIAL_EXPORT_ALLOWED_AREAS")||"")
      .split(/[;,\n]/).map(x=>x.trim().toUpperCase()).filter(Boolean);
    if(!whitelist.length)return bad("Regioes de exportacao ainda nao autorizadas",412);
    const input=await req.json().catch(()=>({}));
    const sdk=createClientFromRequest(req);
    const sources=await sourcesFor(sdk);
    if(input.action==="sources") {
      return Response.json({success:true,source_options:sources.map((s:any)=>({id:s.id,name:s.name})),
        permitted_areas:whitelist});
    }
    if(input.action==="match") {
      const cnpj=digits(input.cnpj14),city=safeText(input.city,110),uf=safeText(input.uf,2).toUpperCase();
      if(!isCNPJ(cnpj))return bad("CNPJ invalido");
      if(!whitelist.includes(normalizeArea(city,uf)))return bad("Regiao fora do escopo autorizado",403);
      const normalizedDoc="REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(p.nr_cnpj_pessoa,''),'.',''),'/',''),'-',''),' ','')";
      const rentals:any[]=[];
      const matches:any[]=[];
      let hasRegionalMatch=false;
      for(const source of sources) {
        const sql="SELECT TOP 20 p.cd_pessoa,p.cidade_pessoa,p.uf_pessoa,p.nr_cnpj_pessoa " +
          "FROM pessoa p WITH (NOLOCK) WHERE " + normalizedDoc + " = '" + cnpj +
          "' AND p.fl_cliente_pessoa=1 ORDER BY p.cd_pessoa";
        const rows=await sqlRead(source,sql,45000);
        if(rows.length>=20)return bad("Excesso de duplicacoes cadastrais; auditar no ERP antes de classificar",409);
        if(rows.some((r:any)=>normalizeArea(r.cidade_pessoa,r.uf_pessoa)===normalizeArea(city,uf)))
          hasRegionalMatch=true;
        const ids=[...new Set(rows.map((r:any)=>Number(r.cd_pessoa)).filter((n:number)=>Number.isSafeInteger(n)&&n>0))];
        matches.push(...rows.map((r:any)=>({source_id:source.id,erp_client_code:String(r.cd_pessoa)})));
        if(!ids.length)continue;
        const fiscal=await sqlRead(source,rentalNFByClientSQL(ids),75000);
        for(const p of fiscal) {
          if(Number(p.invoice_count)<=0||Number(p.confirmed_rental_revenue)<=0||!p.first_revenue_at)continue;
          rentals.push({
            invoice_id:safeText(source.id,50)+":"+safeText(p.proof_invoice_id,60),
            invoice_date:dateText(p.first_revenue_at),invoice_status:"authorized",
            cancelled:false,revenue_confirmed:true,
            revenue_value:Number(p.confirmed_rental_revenue),
            source_id:source.id,erp_client_code:String(p.cd_pessoa),
            invoice_count:Number(p.invoice_count)
          });
        }
      }
      if(!hasRegionalMatch)return bad("CNPJ nao pertence a area piloto autorizada",403);
      return Response.json({success:true,complete:true,all_sources_checked:true,cnpj14:cnpj,
        source_key:"cerebro:multi_erp",run_id:"commerce-match:"+new Date().toISOString(),
        integration_version:"comercial-map-v1",erp_registered:matches.length>0,
        erp_client_code:matches[0]?.erp_client_code||"",
        business_unit:"Multiorigem",sources_checked:sources.length,source_matches:matches,rentals});
    }
    if(input.action!=="page")return bad("Acao desconhecida",400);
    const city=safeText(input.city,110),uf=safeText(input.uf,2).toUpperCase();
    const area=normalizeArea(city,uf);
    if(!whitelist.includes(area))return bad("Regiao fora do escopo autorizado",403);
    const source=sources.find((s:any)=>s.id===safeText(input.source_id,64));
    if(!source)return bad("Fonte ERP nao disponivel",404);
    const after=Number(input.after)||0;
    const limit=Math.max(1,Math.min(100,Number(input.limit)||60));
    if(!Number.isSafeInteger(after)||after<0)return bad("Cursor invalido");
    const sqCity=city.replace(/'/g,"''");
    const sqUf=uf.replace(/'/g,"''");
    const clientsSql = "SELECT TOP " + limit + " " +
      "p.cd_pessoa,p.nm_pessoa,p.nm_fan_pessoa,p.nr_cnpj_pessoa, " +
      "p.log_pessoa,p.num_pessoa,p.comple_pessoa,p.bairro_pessoa, " +
      "p.cidade_pessoa,p.uf_pessoa,p.cep_pessoa " +
      "FROM pessoa p WITH (NOLOCK) WHERE p.cd_pessoa > " + after +
      " AND p.fl_cliente_pessoa = 1 " +
      " AND UPPER(LTRIM(RTRIM(p.cidade_pessoa))) = UPPER('" + sqCity + "')" +
      " AND UPPER(LTRIM(RTRIM(p.uf_pessoa))) = '" + sqUf + "'" +
      " ORDER BY p.cd_pessoa";
    const raw=await sqlRead(source,clientsSql,45000);
    const nextCursor=raw.length===limit ? Number(raw[raw.length-1]?.cd_pessoa) : null;
    const legalEntities=raw.map((r:any)=>({...r,cnpj14:digits(r.nr_cnpj_pessoa)})).filter((r:any)=>isCNPJ(r.cnpj14));
    const clientIds=[...new Set(legalEntities.map((r:any)=>Number(r.cd_pessoa)).filter((n:number)=>Number.isSafeInteger(n)&&n>0))];
    const fiscalRows=clientIds.length ? await sqlRead(source,rentalNFByClientSQL(clientIds),75000) : [];
    const proofs=new Map(fiscalRows.map((r:any)=>[String(r.cd_pessoa),r]));
    const runId="commerce-page:"+source.id+":"+new Date().toISOString();
    const companies=legalEntities.map((r:any)=>{
      const proof:any=proofs.get(String(r.cd_pessoa));
      const invoiceCount=Number(proof?.invoice_count)||0;
      const isClient=invoiceCount>0 && Number(proof?.confirmed_rental_revenue)>0;
      const addr=[r.log_pessoa,r.num_pessoa,r.comple_pessoa,r.bairro_pessoa].map(v=>safeText(v,110)).filter(Boolean).join(", ");
      return {
        cnpj14:r.cnpj14,cnpj_root8:r.cnpj14.slice(0,8),
        erp_client_code:String(r.cd_pessoa),source_id:source.id,source_name:safeText(source.name,100),
        legal_name:safeText(r.nm_pessoa,200),trade_name:safeText(r.nm_fan_pessoa,200),
        city:safeText(r.cidade_pessoa,120),state:safeText(r.uf_pessoa,2).toUpperCase(),
        postal_code:digits(r.cep_pessoa).slice(0,8),address:addr,
        has_confirmed_rental_revenue:isClient,invoice_count:invoiceCount,
        first_revenue_at:isClient?dateText(proof.first_revenue_at):null,
        last_revenue_at:isClient?dateText(proof.last_revenue_at):null,
        proof_invoice_id:isClient?safeText(proof.proof_invoice_id,80):null,
        source_checked_at:new Date().toISOString()
      };
    });
    return Response.json({
      success:true,complete:true,source_id:source.id,source_name:source.name,
      city,uf,run_id:runId,after,limit,next_cursor:nextCursor,
      total_on_page:companies.length,raw_on_page:raw.length,
      companies,proof_basis:"fl_fatura + fich_loc + nf; NF de saida nao cancelada com faturamento positivo"
    });
  }catch(err){
    console.error("commercialCustomerExport",String((err as Error)?.message||err).slice(0,300));
    return bad("Falha na consulta do Cérebro/ERP. Nenhuma pagina parcial sera exportada.",503);
  }
});
