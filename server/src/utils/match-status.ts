import { MATCH_STATUS } from "../validation/matches.js";

export function getMatchStatus(
  startTime: string | Date | null | undefined,
  endTime: string | Date | null | undefined,
  now = new Date(),
): "scheduled" | "live" | "finished" {
  if (!startTime || !endTime) return "scheduled";

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "scheduled";
  }

  if (now < start) {
    return MATCH_STATUS.SCHEDULED;
  }

  if (now >= end) {
    return MATCH_STATUS.FINISHED;
  }

  return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus(
  match: { startTime: Date | null; endTime: Date | null; status: string },
  updateStatus: (
    nextStatus: "scheduled" | "live" | "finished",
  ) => Promise<void>,
): Promise<string> {
  const nextStatus = getMatchStatus(match.startTime, match.endTime);
  if (!nextStatus) {
    return match.status;
  }
  if (match.status !== nextStatus) {
    await updateStatus(nextStatus);
    match.status = nextStatus;
  }
  return match.status;
}
