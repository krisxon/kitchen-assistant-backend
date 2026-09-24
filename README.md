# Kitchen Assistant — Backend API

Node.js + TypeScript backend server for the Kitchen Assistant app.
Sits between the Flutter app and all third-party services.

---

## Architecture

```
Flutter App
  └── HTTP requests with Bearer token (Supabase JWT)
        └── Node.js / TypeScript Server (this)
              ├── Verifies JWT with Supabase
              ├── Checks freemium limits
              ├── Calls Claude API (recipes, AI chat)
              ├── Calls Firebase FCM (push notifications)
              └── Reads/writes Supabase DB
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Set up Supabase
- Run `../kitchen_assistant_mvp/supabase_schema.sql` in the Supabase SQL editor
- Then run `supabase_functions.sql` for the RPC functions

### 4. Set up Firebase
- Go to Firebase Console → Project Settings → Service Accounts
- Generate a new private key
- Copy `project_id`, `private_key`, and `client_email` into `.env`

### 5. Run in development
```bash
npm run dev
```

### 6. Build for production
```bash
npm run build
npm start
```

---

## API Endpoints

All endpoints require `Authorization: Bearer <supabase_jwt>` header
except the health check.

### Health
```
GET /api/health
→ { success: true, message: "...", timestamp: "..." }
```

### Recipes

#### Generate a recipe
```
POST /api/recipes/generate
Body: { dishName: string, servings?: number }
→ { success: true, data: Recipe, meta: { remainingGenerations: number } }
```

#### Scale a recipe
```
POST /api/recipes/scale
Body: { recipe: Recipe, newServings: number }
→ { success: true, data: Recipe }
```

#### Get ingredient substitution
```
POST /api/recipes/substitute
Body: { ingredient: string, dishName: string, availableIngredients?: string[] }
→ { success: true, data: Substitution }
```

#### Get saved recipes
```
GET /api/recipes/saved
→ { success: true, data: Recipe[] }
```

#### Save / unsave a recipe
```
PATCH /api/recipes/:id/save
Body: { isSaved: boolean }
→ { success: true, message: "Recipe saved" }
```

### AI Assistant

#### Ask a kitchen question
```
POST /api/assistant/ask
Body: { question: string, conversationHistory?: Message[] }
→ { success: true, data: { answer: string }, meta: { remainingQuestions: number } }
```

#### Suggest dishes from ingredients
```
POST /api/assistant/suggest-dishes
Body: { ingredients: string[] }
→ { success: true, data: string[] }
```

### Notifications

#### Register FCM token
```
POST /api/notifications/register-token
Body: { fcmToken: string }
→ { success: true, message: "FCM token registered" }
```

#### Schedule cook notifications
```
POST /api/notifications/schedule-cook
Body: { recipe: Recipe, cookStartTime: string (ISO date) }
→ { success: true, message: "N notifications scheduled" }
```

---

## Error Responses

All errors follow this shape:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "upgradeRequired": true  // only on freemium limit errors
}
```

### Status codes
- `200` — Success
- `400` — Bad request (missing/invalid fields)
- `401` — Unauthenticated (missing/invalid JWT)
- `403` — Forbidden (freemium limit reached)
- `404` — Not found
- `429` — Rate limited
- `500` — Server error

---

## Freemium Limits (MVP)

| Feature              | Free        | Premium     |
|----------------------|-------------|-------------|
| Recipe generations   | 5 / month   | Unlimited   |
| AI Chef questions    | 5 / month   | Unlimited   |
| Substitutions        | Unlimited   | Unlimited   |
| Cooking timers       | Unlimited   | Unlimited   |
| Saved recipes        | 10          | Unlimited   |

---

## Project Structure

```
src/
├── index.ts                          # Express app entry point
├── config/
│   └── env.ts                        # Env vars validation
├── controllers/
│   ├── recipe.controller.ts          # Recipe endpoints
│   └── assistant.controller.ts       # AI + notification endpoints
├── middleware/
│   └── auth.middleware.ts            # JWT verification
├── routes/
│   └── index.ts                      # All route definitions
├── services/
│   ├── ai/
│   │   └── claude.service.ts         # Claude API integration
│   ├── notifications/
│   │   └── notification.service.ts   # Firebase FCM
│   └── supabase/
│       ├── client.ts                 # Supabase admin client
│       └── user.service.ts           # User profile & usage
├── types/
│   └── index.ts                      # Shared TypeScript types
└── utils/
    └── logger.ts                     # Winston logger
```

---

## Deployment (Recommended)

**Railway** or **Render** — both support Node.js, free tier available,
and environment variables are easy to configure.

```bash
# Railway
railway init
railway up

# Render
# Connect your GitHub repo in the Render dashboard
# Set build command: npm run build
# Set start command: npm start
```

Make sure to add all `.env` variables to your deployment platform's
environment settings — never commit `.env` to git.

Add `.env` to `.gitignore`:
```
node_modules/
dist/
.env
```
