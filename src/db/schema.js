import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const matchStatusEnum = pgEnum('match_status', [
  'scheduled',
  'live',
  'finished',
]);

export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    sport: text('sport').notNull(),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    status: matchStatusEnum('status').notNull().default('scheduled'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    homeScore: integer('home_score').notNull().default(0),
    awayScore: integer('away_score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('matches_home_score_non_negative', sql`${table.homeScore} >= 0`),
    check('matches_away_score_non_negative', sql`${table.awayScore} >= 0`),
  ],
);

export const commentary = pgTable(
  'commentary',
  {
    id: serial('id').primaryKey(),
    matchId: integer('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    minute: integer('minute').notNull(),
    sequence: integer('sequence').notNull(),
    period: text('period'),
    eventType: text('event_type').notNull(),
    actor: text('actor'),
    team: text('team'),
    message: text('message').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('commentary_match_minute_sequence_idx').on(
      table.matchId,
      table.minute,
      table.sequence,
    ),
    check('commentary_minute_non_negative', sql`${table.minute} >= 0`),
    check('commentary_sequence_non_negative', sql`${table.sequence} >= 0`),
  ],
);
