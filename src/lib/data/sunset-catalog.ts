import 'server-only';
import { LEGO_SETS } from './sets';
export const SUNSET_CATALOG = LEGO_SETS.map(({id,name,setNumber,theme,year,status,pieces}) => ({id,name,setNumber,theme,year,status,pieces}));
