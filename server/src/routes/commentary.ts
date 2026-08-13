import { desc, eq } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";

const MAX_LIMIT = 100;

export const commentaryRouter: Router = Router({ mergeParams: true });

commentaryRouter.get("/", async (req: Request, res: Response) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    res
      .status(400)
      .json({ error: "Invalid match ID.", details: paramsResult.error.issues });
    return;
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({
      error: "Invalid query parameters.",
      details: queryResult.error.issues,
    });
    return;
  }

  try {
    const { id: matchId } = paramsResult.data;
    const { limit = 10 } = queryResult.data;

    const safeLimit = Math.min(limit, MAX_LIMIT);

    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      .orderBy(desc(commentary.createdAt))
      .limit(safeLimit);

    res.status(200).json({ data: results });
  } catch (error) {
    console.error("Failed to fetch commentary:", error);
    res.status(500).json({ error: "Failed to fetch commentary." });
  }
});

commentaryRouter.post("/", async (req: Request, res: Response) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    res
      .status(400)
      .json({ error: "Invalid match ID.", details: paramsResult.error.issues });
    return;
  }

  const bodyResult = createCommentarySchema.safeParse(req.body);

  if (!bodyResult.success) {
    res.status(400).json({
      error: "Invalid commentary payload.",
      details: bodyResult.error.issues,
    });
    return;
  }

  try {
    const { minute, ...rest } = bodyResult.data;
    const [result] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        minute,
        ...rest,
      })
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    res.status(201).json({ data: result });
  } catch (error) {
    console.error("Failed to create commentary:", error);
    res.status(500).json({ error: "Failed to create commentary." });
  }
});
