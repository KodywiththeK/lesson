import { timingSafeEqual } from "node:crypto";

/** pg_cron(pg_net)이 보낸 요청인지 `Authorization: Bearer <CRON_SECRET>`로 확인한다. */
export function isAuthorizedCronRequest(request: Request, secret: string | undefined) {
  if (!secret) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
