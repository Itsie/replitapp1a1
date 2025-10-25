import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface WorkCenter {
  id: string;
  name: string;
  department: string;
}

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: AppointmentFormData) => void;
  orderId: string;
  orderNumber: string;
  date: string;
  workCenters: WorkCenter[];
  defaultWorkCenterId?: string;
}

export interface AppointmentFormData {
  startMin: number;
  lengthMin: number;
  workCenterId: string;
}

const appointmentSchema = z.object({
  startMin: z.number().min(0).max(1440),
  lengthMin: z.number().min(5).max(660),
  workCenterId: z.string().min(1, "Arbeitsstation ist erforderlich"),
});

// Generate time options in 5-minute increments from 07:00 to 18:00
function generateTimeOptions() {
  const options: { value: number; label: string }[] = [];
  const startHour = 7;
  const endHour = 18;

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      if (hour === endHour && minute > 0) break; // Stop at 18:00
      const totalMinutes = hour * 60 + minute;
      const label = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      options.push({ value: totalMinutes, label });
    }
  }

  return options;
}

const timeOptions = generateTimeOptions();

const durationPresets = [
  { value: 30, label: "30 Minuten" },
  { value: 45, label: "45 Minuten" },
  { value: 60, label: "1 Stunde" },
  { value: 90, label: "1,5 Stunden" },
  { value: 120, label: "2 Stunden" },
  { value: 180, label: "3 Stunden" },
];

export function AppointmentDialog({
  open,
  onOpenChange,
  onConfirm,
  orderId,
  orderNumber,
  date,
  workCenters,
  defaultWorkCenterId,
}: AppointmentDialogProps) {
  const [customDuration, setCustomDuration] = useState(false);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      startMin: 8 * 60, // 08:00
      lengthMin: 60, // 1 hour default
      workCenterId: defaultWorkCenterId || "",
    },
  });

  const handleSubmit = (data: AppointmentFormData) => {
    onConfirm(data);
    form.reset();
    setCustomDuration(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-appointment">
        <DialogHeader>
          <DialogTitle>Termin festlegen</DialogTitle>
          <DialogDescription>
            Auftrag <span className="font-mono font-medium">{orderNumber}</span> am{" "}
            {new Date(date).toLocaleDateString("de-DE")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Start Time */}
            <FormField
              control={form.control}
              name="startMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Startzeit</FormLabel>
                  <Select
                    value={field.value.toString()}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-start-time">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {timeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duration */}
            <FormField
              control={form.control}
              name="lengthMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dauer</FormLabel>
                  {!customDuration ? (
                    <>
                      <Select
                        value={field.value.toString()}
                        onValueChange={(value) => {
                          if (value === "custom") {
                            setCustomDuration(true);
                          } else {
                            field.onChange(parseInt(value));
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-duration">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {durationPresets.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value.toString()}>
                              {preset.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Benutzerdefiniert...</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          min={5}
                          max={660}
                          step={5}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-custom-duration"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCustomDuration(false);
                          field.onChange(60);
                        }}
                        data-testid="button-cancel-custom"
                      >
                        Abbrechen
                      </Button>
                    </div>
                  )}
                  <FormDescription>
                    Arbeitszeit: 07:00-18:00, Rundung auf 5 Minuten
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Work Center */}
            <FormField
              control={form.control}
              name="workCenterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arbeitsstation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-workcenter">
                        <SelectValue placeholder="Arbeitsstation wählen..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workCenters.map((wc) => (
                        <SelectItem key={wc.id} value={wc.id}>
                          {wc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-appointment"
              >
                Abbrechen
              </Button>
              <Button type="submit" data-testid="button-confirm-appointment">
                Termin erstellen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
