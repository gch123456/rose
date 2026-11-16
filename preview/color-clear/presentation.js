export const DEFAULT_PRESENTATION=Object.freeze({progress:false,remaining:false,labels:false,background:true});
export function normalizePresentation(value){return Object.fromEntries(Object.entries(DEFAULT_PRESENTATION).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback]));}
