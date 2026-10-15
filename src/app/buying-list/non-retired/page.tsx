import { SUNSET_CATALOG } from "@/lib/data/sunset-catalog";
import { SunsetCatalog } from "@/components/sets/SunsetCatalog";
export const metadata = { title: 'Active sets — rankings suspended', description: "Browse LEGO sets and offers. Forecasts and sold-price rankings are suspended." };
export default function Page() { return <SunsetCatalog title={'Active sets — rankings suspended'} sets={SUNSET_CATALOG.filter(set => set.status !== "Retired")} />; }
