import { MonthlyDataStatus } from "@/components/sets/MonthlyDataStatus";
import { SUNSET_CATALOG } from "@/lib/data/sunset-catalog";
import { SunsetCatalog } from "@/components/sets/SunsetCatalog";
export const metadata = { title: 'LEGO set catalog', description: "Browse LEGO sets and offers. Forecasts and sold-price rankings are suspended." };
export const dynamic = "force-dynamic";
export default function Page() { return <><MonthlyDataStatus /><SunsetCatalog title={'LEGO set catalog'} sets={SUNSET_CATALOG} /></>; }
