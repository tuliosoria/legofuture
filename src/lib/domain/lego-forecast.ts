import type { LegoSet, ProductPricing, HistoryPoint, Forecast } from "@/lib/types/lego";
import type { PricingBaseline } from "./lego-baseline";
import type { ModelManifestSummary } from "@/lib/ml/lego-forecast-models";
import type { SetForecast } from "./lego-forecast.retained";
import { VALUATION_UNAVAILABLE } from "./sunset-policy";
export type { SetForecast, SetForecastScenario, SetForecastBreakdownRow } from "./lego-forecast.retained";
/** Publication facade has no runtime dependency on retained history or trained models. */
export function forecastForSet(set:LegoSet,_pricing:ProductPricing|null,_history:HistoryPoint[],_manifest:ModelManifestSummary|null=null):SetForecast {
 void _pricing;void _history;void _manifest;
 return {setId:set.id,recommendation:null,confidence:"low",scenarios:null,projectionSeries:[],drivers:[],breakdown:[],forecastEligible:false,ineligibleReason:VALUATION_UNAVAILABLE,updatedAt:null,currentPrice:null,modelVersion:null};
}
export function computeForecast(_product:LegoSet,_pricing:ProductPricing|null,_baseline:PricingBaseline|null=null):Forecast|null {void _product;void _pricing;void _baseline;return null;}
export async function computeMlForecast(_product:LegoSet,_pricing:ProductPricing|null):Promise<Forecast|null> {void _product;void _pricing;return null;}
