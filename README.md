# Sportz | Real-Time Live Sports Backend

Sportz is a high-performance backend service designed for live sports coverage. It combines **RESTful API** endpoints for data management with **WebSockets** for real-time, low-latency broadcasting of scores and play-by-play commentary.

---

## Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL with Drizzle ORM
* **Real-time:** WebSockets (`ws` library)
* **Validation:** Zod
* **Security:** Arcjet (Rate limiting & Bot protection)

---

##  Key Features

* **Real-Time Broadcasts:** Instant commentary and score updates via per-match WebSocket subscriptions.
* **Robust WebSocket Architecture:** Includes heartbeats (ping/pong), backpressure protection, and subscription caps.
* **Match Management:** Complete CRUD for sports events, including automated status transitions (Scheduled, Live, Finished).
* **Strict Validation:** Type-safe input validation for both REST and WebSocket messages using Zod.
* **Seed Tooling:** Includes scripts to simulate live game environments for testing.

---

## Quick Start

### Prerequisites
* Node.js (LTS)
* PostgreSQL Instance

### Setup
1. **Clone & Install**
   ```bash
   git clone <your-repo-url>
   cd sportz-websockets
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file:
   ```env
   DATABASE_URL=postgres://user:pass@localhost:5432/sportz
   PORT=8000
   ARCJET_KEY=your_key
   ```

3. **Run**
   ```bash
   npm run dev   # Start server
   npm run seed  # Seed initial match data
   ```

---

## API & Protocol

### REST Endpoints
* `GET /matches` - List all matches.
* `POST /matches` - Create a new match.
* `GET /matches/:id/commentary` - Fetch history for a match.
* `POST /matches/:id/commentary` - Push new live commentary.

### WebSocket Commands
Connect to `ws://localhost:8000/ws`.

| Action | Payload Example |
| :--- | :--- |
| **Subscribe** | `{ "type": "subscribe", "matchId": 123 }` |
| **Unsubscribe** | `{ "type": "unsubscribe", "matchId": 123 }` |
| **Bulk Sub** | `{ "type": "setSubscriptions", "matchIds": [1, 2] }` |

---

## System Limits
* **Max Subscriptions:** 50 per socket.
* **Rate Limit:** 10 messages/sec (20 burst).
* **Backpressure:** Connection closes if buffer exceeds 1MB.
* **Payload Limit:** 1MB per message.