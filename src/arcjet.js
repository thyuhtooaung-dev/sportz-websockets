import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const rawArcjetMode = process.env.ARCJET_MODE;

if (rawArcjetMode && rawArcjetMode !== "LIVE" && rawArcjetMode !== "DRY_RUN") {
  throw new Error("ARCJET_MODE must be LIVE or DRY_RUN");
}

const arcjetMode = rawArcjetMode ?? "LIVE";

export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: [
            "CATEGORY:SEARCH_ENGINE",
            "CATEGORY:PREVIEW",
            "CATEGORY:TOOL", // Allows common dev tools like Postman
            "CURL",
          ],
        }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
      ],
    })
  : null;

export const wsArcjet = arcjetKey
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
  return async (req, res, next) => {
    if (!httpArcjet) return next();

    try {
      const decision = await httpArcjet.protect(req);
      if (decision.conclusion !== "ALLOW") {
        console.log("Arcjet would have blocked this! Reason:", decision.reason);
      }
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too many requests" });
        }
        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (e) {
      console.error("Arcjet middleware error", e);
      return res.status(503).json({ error: "Service unavailable" });
    }

    return next();
  };
}
