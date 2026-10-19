const text = x => x == null ? '' : String(x);
const numeric = x => /^-?(?:\d+\.?\d*|\.\d+)$/.test(text(x).trim()) ? Number(x) : null;
const key = x => text(x).trim().toUpperCase().replace(/[^A-Z0-9%]/g,'');
export function calculateFormula(expression, stats){
  const tokens=text(expression).match(/[A-Za-z_][A-Za-z_0-9%]*|[0-9]+[A-Za-z_][A-Za-z_0-9%]*|\d+(?:\.\d+)?|[()+*/-]/g)||[];
  if(!tokens.length || tokens.length>80 || tokens.join('').toUpperCase()!==text(expression).replace(/\s+/g,'').toUpperCase())throw Error('Invalid formula');
  let i=0; const fields=Object.fromEntries(Object.entries(stats||{}).map(([k,v])=>[key(k),numeric(v)]));
  const factor=()=>{
    const t=tokens[i++];if(!t)throw Error('Incomplete formula');
    if(t==='('){const v=expr();if(tokens[i++]!==')')throw Error('Missing closing parenthesis');return v;}
    if(t==='-')return -factor();
    if(/^\d+(?:\.\d+)?$/.test(t))return Number(t);
    const k=key(t);if(!Object.hasOwn(fields,k)||fields[k]===null)throw Error('Unavailable stat: '+t);
    return fields[k];
  };
  const term=()=>{let v=factor();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],right=factor();if(op==='/'&&right===0)throw Error('Division by zero');v=op==='*'?v*right:v/right;}return v};
  const expr=()=>{let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],right=term();v=op==='+'?v+right:v-right;}return v};
  const val=expr();if(i!==tokens.length||!Number.isFinite(val))throw Error('Invalid formula');
  return Number(val.toFixed(3));
}
