import { Kbd } from '@/components/ui/kbd';

/** A chrome control's hover reveal: its label, plus the live chord bound to its command. */
export function TooltipHint({ label, chord }: { label: string; chord?: string }) {
  return (
    <>
      <span>{label}</span>
      {chord !== undefined && <Kbd>{chord}</Kbd>}
    </>
  );
}
