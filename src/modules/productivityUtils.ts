type ProductivitySortMode = 'current-desc'|'current-asc'|'change-desc'|'change-asc';
type MovementFilter = 'ALL'|'UP'|'DOWN'|'STABLE';
type ProductivityComparable = {productivity?:number|null;productivityPrevious?:number|null};

export const productivitySort=(a:ProductivityComparable,b:ProductivityComparable,mode:ProductivitySortMode)=>{const av=a.productivity??null,bv=b.productivity??null,ad=av==null||a.productivityPrevious==null?null:av-a.productivityPrevious,bd=bv==null||b.productivityPrevious==null?null:bv-b.productivityPrevious;if(mode==='current-asc')return av==null?1:bv==null?-1:av-bv;if(mode==='change-desc')return ad==null?1:bd==null?-1:bd-ad;if(mode==='change-asc')return ad==null?1:bd==null?-1:ad-bd;return av==null?1:bv==null?-1:bv-av};

export const movementMatch=(v:number|null|undefined,p:number|null|undefined,filter:MovementFilter)=>{if(filter==='ALL')return true;if(v==null||p==null)return false;const d=v-p;return filter==='UP'?d>0:filter==='DOWN'?d<0:d===0};
