# Implementation Tracker

## Purpose

This file tracks what the backend already has, what is missing, and what to implement next.
Update this file whenever you add/change a feature.

## Current Stack

- Node.js + Express
- MySQL (via `mysql2`)
- Auth: JWT stored in **HttpOnly cookie**
- Dev runner: `nodemon`

## Environment Variables

Required:

- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`

Optional:

- `NODE_ENV` (when `production`, cookie uses `secure: true`)
- `CORS_ORIGIN` (comma-separated list, enables CORS + credentials)

## Database Schema (current)

- **Users**
  - `id`, `username`, `email`, `password_hash`, `reset_password_token_hash`, `reset_password_expires_at`, `created_at`
- **Categories (per-user)**
  - `id`, `user_id`, `name`, `type`, `created_at`
  - Unique: `(user_id, name, type)`
- **Transactions**
  - `id`, `user_id`, `category_id`, `amount`, `transaction_date`, `description`, `created_at`
- **Budgets**
  - `id`, `user_id`, `category_id`, `amount`, `period`, `created_at`

Notes:

- After changing `schema.sql`, dev setup may require dropping DB and re-running `npm run init-db`.

## API Surface (current)

Base URL: `/api`

### Auth

- `POST /auth/register`
  - Create user account.
- `POST /auth/login`
  - Sets `token` cookie (HttpOnly).
  - Returns JWT token in response body as `token` (for mobile bearer token flow).
- `POST /auth/forgot-password`
  - Generates password reset token.
- `POST /auth/reset-password`
  - Resets password using token.
- `POST /auth/logout`
  - Clears `token` cookie.

- `GET /auth/me`
  - Returns current user profile from JWT cookie.

Cookie behavior:

- cookie name: `token`
- `httpOnly: true`
- `sameSite: lax`
- `secure: NODE_ENV === 'production'`
- `maxAge: 1h`

### Categories (per-user)

All require auth.

- `GET /categories`
  - Returns categories owned by current user.
- `POST /categories`
  - Create category for current user.
- `PUT /categories/:id`
  - Update category only if owned by current user.
- `DELETE /categories/:id`
  - Delete category only if owned by current user.

### Transactions

All require auth.

- `GET /transactions`
  - Filters:
    - `startDate`, `endDate`
    - `categoryId` (preferred)
    - `categoryStr` (deprecated alias)
  - Pagination:
    - `limit` (default 50, max 200)
    - `offset` (default 0)
- `GET /transactions/:id`
  - Returns transaction detail for current user.
- `POST /transactions`
  - Validates category belongs to current user.
- `PUT /transactions/:id`
  - Validates category belongs to current user.
- `DELETE /transactions/:id`

### Budgets

All require auth.

- `GET /budgets?period=...`
- `POST /budgets`
  - Validates category belongs to current user.
- `PUT /budgets/:id`
  - Allows updating `amount` and optionally `category_id`.
- `DELETE /budgets/:id`

### Reports

All require auth.

- `GET /reports/dashboard?month=&year=`
  - Income/expense/balance + expense by category.
  - Joins categories with `c.user_id = t.user_id` to avoid cross-user leakage.

## Security (current)

- JWT stored in HttpOnly cookie to reduce token exposure to XSS.
- Middleware verifies JWT from cookie (falls back to `Authorization` header for compatibility).
- SQL queries use parameter placeholders (`?`).

## Known Gaps / Missing Features

### Must-have (P0)

- `GET /auth/me`
  - Return current user profile from JWT cookie.
- Transaction detail endpoint: `GET /transactions/:id`
- Pagination for transactions (limit/offset) + stable sorting
- Stronger input validation (amount/date/period) and consistent error codes

Validation status:

- Transactions: validates `amount > 0` and `transaction_date` format `YYYY-MM-DD`
- Budgets: validates `amount > 0` and `period` format `YYYY-MM`

### Important (P1)

- Category delete safety:
  - Implemented: prevent deleting a category if referenced by Transactions or Budgets
- Budget period format validation (e.g. `YYYY-MM`)
- Implemented: seed default categories per-user at registration

### Security hardening (P2)

- Implemented: CSRF protection for write requests (double-submit cookie + `x-csrf-token`)
- Implemented: rate limiting for auth endpoints (login/register)
- Centralized error handling + structured logging

### Developer Experience

- Add Postman collection / API examples
- Add automated tests

## Notes / Work Log

- (YYYY-MM-DD) -
