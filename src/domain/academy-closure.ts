export type AcademyClosure = {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  /** 0=일요일, 1=월요일. null이면 연속 날짜 휴원이다. */
  weekday: number | null;
  active: boolean;
};

export function getClosuresOnDate(closures: AcademyClosure[], date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return closures.filter((closure) =>
    closure.active && closure.startsOn <= date &&
    (closure.endsOn === null || date <= closure.endsOn) &&
    (closure.weekday === null || closure.weekday === weekday));
}
