"use client";

import { useStore } from "@/lib/store";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export function Toast() {
  const { toast } = useStore();
  if (!toast) return null;

  const styles = {
    ok: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: <CheckCircle2 size={16} /> },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: <AlertCircle size={16} /> },
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: <Info size={16} /> },
  };
  const s = styles[toast.tipo];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-md border ${s.bg} ${s.border} ${s.text} shadow-lg max-w-sm`}>
        {s.icon}
        <span className="text-xs font-medium">{toast.mensaje}</span>
      </div>
    </div>
  );
}
