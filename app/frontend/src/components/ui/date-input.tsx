import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

function parseDisplay(display: string): Date | undefined {
  if (!display) return undefined;
  const parts = display.split("/");
  if (parts.length === 3) {
    const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

function dateToDisplay(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

export function DateInput({ value, onChange, required, placeholder, disabled }: DateInputProps) {
  const selected = parseDisplay(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-left font-normal",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {selected ? dateToDisplay(selected) : <span>{placeholder || "jj/mm/aaaa"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) onChange(dateToDisplay(date));
          }}
          autoFocus
          classNames={{ selected: "rounded-full" }}
          modifiersStyles={{
            selected: { backgroundColor: "#f6b8b8", color: "#7f1d1d" },
          }}
        />
      </PopoverContent>
      {required && (
        <input
          type="text"
          value={value}
          required
          className="sr-only"
          tabIndex={-1}
          readOnly
          onChange={() => {}}
        />
      )}
    </Popover>
  );
}
