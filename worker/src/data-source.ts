export interface EnvSource {
  SHEET_ID?: string;
  GOOGLE_SHEETS_API_KEY?: string;
}

export type Row=Record<string,unknown>;

function rows(values:unknown[][]):Row[]{
  const header=(values[0]||[]).map(String);
  return values.slice(1).filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??null])));
}

export async function readSheet(env:EnvSource,sheet:string,range:string):Promise<Row[]>{
  if(!env.SHEET_ID || !env.GOOGLE_SHEETS_API_KEY) throw new Error('Spreadsheet source is not configured');
  const a1=encodeURIComponent(`'${sheet}'!${range}`);
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/${a1}?key=${env.GOOGLE_SHEETS_API_KEY}&valueRenderOption=UNFORMATTED_VALUE`;
  const response=await fetch(url);
  if(!response.ok) throw new Error(`Google Sheets ${response.status}`);
  const body=await response.json() as {values?:unknown[][]};
  return rows(body.values||[]);
}
