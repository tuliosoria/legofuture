import { ConfidenceDots } from "./ConfidenceDots";
import { InfoTooltip } from "./InfoTooltip";

interface Props {
  label: string;
  dots: 1 | 2 | 3 | 4 | 5;
  caption: string;
  tooltip?: React.ReactNode;
}

export function DotsRow({ label, dots, caption, tooltip }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="type-body-sm font-medium text-jet-black">
          {label}
          {tooltip && <InfoTooltip label={label}>{tooltip}</InfoTooltip>}
        </p>
        <p className="type-caption mt-0.5 text-slate-500">{caption}</p>
      </div>
      <ConfidenceDots filled={dots} className="shrink-0 mt-1" />
    </div>
  );
}
