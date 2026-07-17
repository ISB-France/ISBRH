import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { fr } from "react-day-picker/locale";
import { cn } from "../../lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={fr}
      className={cn("p-3", className)}
      classNames={{
        root: "w-full",
        months: "flex flex-col space-y-4",
        month: "space-y-4",
        nav: "flex items-center justify-between",
        button_previous: "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-secondary",
        button_next: "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-foreground hover:bg-secondary",
        month_caption: "flex justify-center",
        caption_label: "text-sm font-semibold text-foreground",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-semibold text-muted-foreground pt-2 pb-1",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative",
        day_button:
          "flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-secondary aria-selected:hover:bg-primary aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected: "bg-primary text-primary-foreground rounded-md",
        today: "font-semibold",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
