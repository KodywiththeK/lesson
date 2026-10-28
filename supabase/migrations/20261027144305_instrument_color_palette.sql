-- 기존 직접 선택 색상을 RGB 제곱 거리상 가장 가까운 기본 색으로 바꾼다.
-- 거리가 같으면 팔레트 순서가 앞선 색을 선택한다.
with palette (color_hex, red, green, blue, priority) as (
  values
    ('#6653a6', 102, 83, 166, 1),
    ('#246bb2', 36, 107, 178, 2),
    ('#16817d', 22, 129, 125, 3),
    ('#62852b', 98, 133, 43, 4),
    ('#bc7325', 188, 115, 37, 5),
    ('#af4e61', 175, 78, 97, 6),
    ('#9a59a9', 154, 89, 169, 7),
    ('#526b81', 82, 107, 129, 8)
), existing as (
  select academy_id, instrument_id, color_hex,
    get_byte(decode(substr(color_hex, 2), 'hex'), 0) as red,
    get_byte(decode(substr(color_hex, 2), 'hex'), 1) as green,
    get_byte(decode(substr(color_hex, 2), 'hex'), 2) as blue
  from public.academy_instrument_colors
), ranked as (
  select existing.academy_id, existing.instrument_id, palette.color_hex,
    row_number() over (
      partition by existing.academy_id, existing.instrument_id
      order by
        (existing.red - palette.red) ^ 2 +
        (existing.green - palette.green) ^ 2 +
        (existing.blue - palette.blue) ^ 2,
        palette.priority
    ) as rank
  from existing cross join palette
)
update public.academy_instrument_colors as colors
set color_hex = ranked.color_hex
from ranked
where colors.academy_id = ranked.academy_id
  and colors.instrument_id = ranked.instrument_id
  and ranked.rank = 1
  and colors.color_hex <> ranked.color_hex;

alter table public.academy_instrument_colors
  add constraint academy_instrument_colors_palette_check
  check (color_hex in (
    '#6653a6', '#246bb2', '#16817d', '#62852b',
    '#bc7325', '#af4e61', '#9a59a9', '#526b81'
  ));
