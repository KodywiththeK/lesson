import type { AcademyClosure } from "@/domain/academy-closure";
import { INSTRUMENT_COLOR_PRESETS } from "@/domain/instrument-color";

type Result = { data: Record<string, unknown>[] | null; error: Error | null };
type WriteResult = { data: unknown; error: Error | null };
type Filter = {
  eq(column: string, value: string): PromiseLike<Result> & Filter;
};
type WriteFilter = {
  eq(column: string, value: string): PromiseLike<WriteResult> & WriteFilter;
};

export type LessonCalendarSettingsClient = {
  from(table: "academy_instrument_colors" | "academy_closures"): {
    select(columns: string): Filter;
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<WriteResult>;
    insert(values: Record<string, unknown>): PromiseLike<WriteResult>;
    update(values: Record<string, unknown>): WriteFilter;
  };
};

export type AcademyInstrumentColor = { instrumentId: string; colorHex: string };

export async function fetchAcademyInstrumentColors(
  client: Pick<LessonCalendarSettingsClient, "from">,
  academyId: string,
): Promise<AcademyInstrumentColor[]> {
  const { data, error } = await client.from("academy_instrument_colors")
    .select("instrument_id,color_hex").eq("academy_id", academyId);
  if (error) throw new Error(`악기 색상을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({ instrumentId: String(row.instrument_id), colorHex: String(row.color_hex) }));
}

export async function saveAcademyInstrumentColor(
  client: Pick<LessonCalendarSettingsClient, "from">,
  academyId: string,
  instrumentId: string,
  colorHex: string,
) {
  if (!INSTRUMENT_COLOR_PRESETS.some((preset) => preset === colorHex)) {
    throw new Error("기본 색상 8개 중에서 선택해 주세요.");
  }
  const { error } = await client.from("academy_instrument_colors").upsert({
    academy_id: academyId, instrument_id: instrumentId, color_hex: colorHex,
  }, { onConflict: "academy_id,instrument_id" });
  if (error) throw new Error(`악기 색상을 저장하지 못했습니다: ${error.message}`);
}

export async function fetchAcademyClosures(
  client: Pick<LessonCalendarSettingsClient, "from">,
  academyId: string,
): Promise<AcademyClosure[]> {
  const { data, error } = await client.from("academy_closures")
    .select("id,title,starts_on,ends_on,weekday,active").eq("academy_id", academyId);
  if (error) throw new Error(`휴원일을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id), title: String(row.title), startsOn: String(row.starts_on),
    endsOn: row.ends_on == null ? null : String(row.ends_on),
    weekday: row.weekday == null ? null : Number(row.weekday), active: row.active === true,
  }));
}

export type SaveAcademyClosureInput = {
  id?: string;
  academyId: string;
  title: string;
  startsOn: string;
  endsOn: string | null;
  weekday: number | null;
};

export async function saveAcademyClosure(client: LessonCalendarSettingsClient, input: SaveAcademyClosureInput) {
  const values = {
    academy_id: input.academyId, title: input.title.trim(), starts_on: input.startsOn,
    ends_on: input.endsOn, weekday: input.weekday, active: true,
  };
  if (!values.title || !input.startsOn || !input.endsOn || input.endsOn < input.startsOn) {
    throw new Error("휴원일 이름과 시작일·종료일을 확인해 주세요.");
  }
  const { error } = input.id
    ? await client.from("academy_closures").update(values).eq("id", input.id).eq("academy_id", input.academyId)
    : await client.from("academy_closures").insert(values);
  if (error) throw new Error(`휴원일을 저장하지 못했습니다: ${error.message}`);
}

export async function archiveAcademyClosure(client: LessonCalendarSettingsClient, academyId: string, id: string) {
  const { error } = await client.from("academy_closures").update({ active: false })
    .eq("id", id).eq("academy_id", academyId);
  if (error) throw new Error(`휴원일을 해제하지 못했습니다: ${error.message}`);
}
