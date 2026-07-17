import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const parts = value.split("-");
    if (parts.length === 3) {
      const secondParts = parts[2].split("T");
      return `${secondParts[0]}/${parts[1]}/${parts[0]}`;
    }
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
