import clsx from "clsx";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from "react";

// Piccoli componenti squadrati usati dalla pagina di Sara.
type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "outline";
const BADGE: Record<BadgeVariant, string> = {
  default: "bg-brand text-white border-brand",
  secondary: "bg-steel-soft text-steel border-steel-line",
  destructive: "bg-red-700 text-white border-red-700",
  success: "bg-emerald-700 text-white border-emerald-700",
  warning: "bg-amber-500 text-white border-amber-500",
  outline: "bg-white text-slate-700 border-steel-line",
};
export function Badge({ variant = "default", className, ...p }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={clsx("inline-flex items-center border px-2 py-0.5 text-xs font-medium", BADGE[variant], className)} {...p} />;
}

export function Button({ variant = "default", size = "default", className, ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost"; size?: "default" | "sm" | "icon" }) {
  return <button className={clsx("btn", variant === "outline" && "btn-outline", variant === "ghost" && "btn-outline border-transparent",
    size === "sm" && "h-8 px-3", size === "icon" && "w-10 px-0", className)} {...p} />;
}

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={clsx("box", className)} {...p} />;
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={clsx("p-4 pb-2", className)} {...p} />;
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h3 className={clsx("text-sm font-semibold text-steel", className)} {...p} />;
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={clsx("p-4 pt-2", className)} {...p} />;
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={clsx("field", className)} {...p} />;
