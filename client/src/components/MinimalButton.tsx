import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";
import { MENU_ITEMS } from "@shared/config";

interface MinimalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  index: number;
}

const iconMap: Record<string, LucideIcons.LucideIcon> = {
  "Nová objednávka": LucideIcons.PlusCircle,
  "Prehľad objednávok": LucideIcons.ClipboardList,
  "Vydané objednávky": LucideIcons.CheckCircle2,
  "Nevydané objednávky": LucideIcons.Clock,
  "Objednávky na ODBYT": LucideIcons.ShoppingCart,
  "Výber prevádzky": LucideIcons.Store,
  "Import položiek": LucideIcons.FileDown,
  "Odhlásiť zariadenie": LucideIcons.LogOut,
};

export function MinimalButton({ label, index, className, ...props }: MinimalButtonProps) {
  const menuItem = MENU_ITEMS.find(item => item.label === label);
  const Icon = iconMap[label] || LucideIcons.PlusCircle;

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.05,
        ease: [0.23, 1, 0.32, 1] 
      }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative flex items-center w-full p-4 rounded-xl",
        "bg-white dark:bg-slate-900",
        "border border-slate-200 dark:border-slate-800",
        "transition-all duration-300 text-left",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4 w-full">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-800 transition-colors duration-300">
          <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors duration-300" />
        </div>
        
        <div className="flex-1">
          <span className="text-lg font-medium text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors duration-300">
            {label}
          </span>
        </div>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        </div>
      </div>
    </motion.button>
  );
}
