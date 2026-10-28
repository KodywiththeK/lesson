import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTRUMENT_COLOR_PRESETS } from "@/domain/instrument-color";

const migrations = join(process.cwd(), "supabase/migrations");

function paletteMigration() {
  const filename = readdirSync(migrations).find((name) => name.endsWith("_instrument_color_palette.sql"));
  expect(filename).toBeDefined();
  return readFileSync(join(migrations, filename!), "utf8").toLowerCase();
}

describe("악기 색상 팔레트 DB 계약", () => {
  it("기존 직접 선택 값을 가장 가까운 팔레트 값으로 바꾸고 새 임의 색상은 거부한다", () => {
    const sql = paletteMigration();
    expect(sql).toContain("update public.academy_instrument_colors");
    expect(sql).toContain("palette.priority");
    expect(sql).toContain("academy_instrument_colors_palette_check");
    const paletteRows = [...sql.matchAll(/\('(#[0-9a-f]{6})', (\d+), (\d+), (\d+), (\d+)\)/g)];
    expect(paletteRows.map((row) => row[1])).toEqual([...INSTRUMENT_COLOR_PRESETS]);
    paletteRows.forEach((row, index) => {
      const rgb = [1, 3, 5].map((start) => Number.parseInt(row[1].slice(start, start + 2), 16));
      expect(row.slice(2).map(Number)).toEqual([...rgb, index + 1]);
    });
    const constraint = sql.slice(sql.indexOf("add constraint academy_instrument_colors_palette_check"));
    for (const preset of INSTRUMENT_COLOR_PRESETS) expect(constraint).toContain(`'${preset}'`);
  });
});
