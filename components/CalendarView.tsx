import { AttendanceMonthCalendar } from "@/components/AttendanceMonthCalendar";

type Props = {
  year: number;
  monthIndex: number;
  absentYmdSet: Set<string>;
  presentYmdSet: Set<string>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

export function CalendarView(props: Props) {
  return (
    <AttendanceMonthCalendar
      year={props.year}
      monthIndex={props.monthIndex}
      absentYmdSet={props.absentYmdSet}
      presentYmdSet={props.presentYmdSet}
      onPrevMonth={props.onPrevMonth}
      onNextMonth={props.onNextMonth}
    />
  );
}
