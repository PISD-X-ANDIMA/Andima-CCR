"use client";
import { createContext, useContext, type CSSProperties, type ComponentProps, type ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
export type ChartConfig = Record<string, { label: string; color: string }>;
const Context = createContext<ChartConfig>({});
export function ChartContainer({ config, children, className = "" }: { config: ChartConfig; children: ComponentProps<typeof ResponsiveContainer>["children"]; className?: string }) {
  const style = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color])) as CSSProperties;
  return <Context.Provider value={config}><div style={style} className={`h-72 w-full min-w-0 text-xs [&_.recharts-cartesian-grid_line]:stroke-slate-200 [&_.recharts-cartesian-axis-tick_text]:fill-slate-500 ${className}`}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></Context.Provider>;
}
export const ChartTooltip = Tooltip;
type Entry = { dataKey?: string | number; name?: string | number; value?: number | string | (number | string)[]; color?: string };
export function ChartTooltipContent({ active, payload, label, formatter, labelFormatter }: { active?: boolean; payload?: readonly Entry[]; label?: ReactNode; indicator?: "dot"; formatter?: (value: number) => string; labelFormatter?: (label: string) => string }) {
  const config = useContext(Context);
  if (!active || !payload?.length) return null;
  return <div className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl"><div className="mb-1.5 font-medium">{labelFormatter ? labelFormatter(String(label ?? "")) : label}</div>{payload.map((entry, index) => { const key = String(entry.dataKey ?? entry.name); return <div key={`${key}-${index}`} className="flex items-center gap-2 py-1"><i className="size-2 rounded-full" style={{ backgroundColor: config[key]?.color ?? entry.color }} /><span className="text-slate-500">{config[key]?.label ?? key}</span><span className="ml-auto pl-3 font-mono font-medium">{formatter ? formatter(Number(entry.value ?? 0)) : String(entry.value ?? "")}</span></div>; })}</div>;
}
