import type { Confidence } from "@/lib/types/lego";

interface ModelDetailsProps {
  confidence: Confidence;
  updatedAt: string;
  sources?: string;
}

const COPY: Record<Confidence, { label: string; tagline: string; tone: string }> = {
  high: {
    label: "Strong",
    tagline: "Retired set with deep sold-comp history",
    tone: "text-pure-green",
  },
  medium: {
    label: "Moderate",
    tagline: "Adequate history; some signal noise",
    tone: "text-sunshine-yellow",
  },
  low: {
    label: "Thin",
    tagline: "New release or sparse secondary-market data",
    tone: "text-brick-red",
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ModelDetails({
  confidence,
  updatedAt,
  sources = "PriceCharting + Community",
}: ModelDetailsProps) {
  const copy = COPY[confidence];
  return (
    <div className="rounded-card border-2 border-jet-black bg-pure-white p-5">
      <h3 className="type-eyebrow text-slate-500 mb-3">Model details</h3>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="type-body-sm text-slate-500">Source</dt>
          <dd className="type-body font-semibold text-jet-black">{sources}</dd>
        </div>
        <div>
          <dt className="type-body-sm text-slate-500">Data freshness</dt>
          <dd className="type-body font-semibold text-jet-black">
            {formatDate(updatedAt)}
          </dd>
        </div>
        <div>
          <dt
            className="type-body-sm text-slate-500"
            title="How thick the input data is for this set — not how accurate the forecast will be. Retired sets with many monthly sold comps score Strong; new releases with thin secondary markets score Thin."
          >
            Data strength
          </dt>
          <dd className={`type-body font-bold ${copy.tone}`}>{copy.label}</dd>
          <p className="type-body-sm text-slate-600 mt-0.5">{copy.tagline}</p>
        </div>
      </dl>
    </div>
  );
}
