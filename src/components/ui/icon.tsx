import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export { ChevronLeft, ChevronRight, File, FilePlus, FileText, Folder, FolderPlus, Search, Settings, Trash2, X } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
}

export function Icon({ icon: LucideComponent, size = 15, className }: IconProps) {
  const normalizedStrokeWidth = Number(((1.2 * 24) / size).toFixed(10));

  return (
    <LucideComponent
      size={size}
      absoluteStrokeWidth
      strokeWidth={1.2}
      aria-hidden="true"
      className={cn(className)}
      // Lucide's division can serialize as `1.9199999999999997`; retain the precise Orbit stroke.
      ref={(element) => element?.setAttribute('stroke-width', String(normalizedStrokeWidth))}
    />
  );
}
