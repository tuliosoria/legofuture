import { NextResponse } from "next/server";
import { VALUATION_UNAVAILABLE } from "@/lib/domain/sunset-policy";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({items:[],status:"unavailable",reason:VALUATION_UNAVAILABLE,updatedAt:null},{headers:{"Cache-Control":"no-store"}}); }
