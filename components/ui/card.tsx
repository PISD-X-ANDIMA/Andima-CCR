import type { HTMLAttributes } from "react";
function part(base: string) {
  return function CardPart({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={`${base} ${className}`} {...props} />; };
}
export const Card = part("min-w-0 rounded-xl border border-slate-200 bg-white py-6 text-slate-950 shadow-sm");
export const CardHeader = part("grid gap-1.5 px-6");
export const CardTitle = part("font-semibold leading-none");
export const CardDescription = part("text-sm text-slate-500");
export const CardContent = part("px-6 pt-6");
export const CardFooter = part("flex items-center px-6 pt-6");
