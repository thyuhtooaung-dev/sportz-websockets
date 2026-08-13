import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";
import type { NextFunction, Request, Response } from "express";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetEnv = process.env.ARCJET_ENV;
const configuredMode = process.env.ARCJET_MODE;
const arcjetMode =
  configuredMode === "DRY_RUN"
    ? "DRY_RUN"
    : configuredMode === "LIVE"
      ? "LIVE"
      : arcjetEnv === "development"
        ? "DRY_RUN"
        : "LIVE";

export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
      ],
    })
  : null;

export const wsArcjet =
  arcjetKey && arcjetEnv !== "development"
    ? arcjet({
        key: arcjetKey,
        rules: [
          shield({ mode: arcjetMode }),
          detectBot({
            mode: arcjetMode,
            allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
          }),
          slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
        ],
      })
    : null;

export function securityMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!httpArcjet) return next();

    try {
      const decision = await httpArcjet.protect(req);

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          res.status(429).json({ error: "Too many requests." });
          return;
        }

        res.status(403).json({ error: "Forbidden." });
        return;
      }
    } catch (e) {
      console.error("Arcjet middleware error", e);
      res.status(503).json({ error: "Service Unavailable" });
      return;
    }

    next();
  };
}
