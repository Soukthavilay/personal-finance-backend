# API Docs - Personal Finance Backend

Base URL: `/api`

## Authentication

This backend uses **JWT stored in an HttpOnly cookie**.

- Cookie name: `token`
- Set by: `POST /api/auth/login`
- Cleared by: `POST /api/auth/logout`

If you call the API from a browser-based frontend, send credentials:

- `fetch(..., { credentials: 'include' })`
- Axios: `{ withCredentials: true }`

All endpoints marked **Auth required** expect a valid cookie (or `Authorization: Bearer ...` fallback).

## CSRF Protection (required for write requests)

For `POST`, `PUT`, `PATCH`, `DELETE` requests (except `login/register/csrf`), the backend requires a CSRF token:

1. Call `GET /api/auth/csrf`
   - Response contains `csrfToken`
   - Response also sets a cookie `csrfToken`
2. For every write request, send header:

`x-csrf-token: <csrfToken>`

If missing or invalid:

- `403` `{ "message": "CSRF token invalid or missing" }`

---

## Auth

### CSRF token

`GET /api/auth/csrf`

Response:

- `200` (sets cookie `csrfToken`)

```json
{ "csrfToken": "..." }
```

### Register

`POST /api/auth/register`

Body:

```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

Responses:

- `201`

```json
{ "message": "User registered successfully" }
```

Notes:

- On successful registration, the backend seeds a default set of income/expense categories for the new user.

Rate limiting:

- `POST /api/auth/register` and `POST /api/auth/login` are rate limited.

- `400`

```json
{ "message": "All fields are required" }
```

- `400`

```json
{ "message": "Email already exists" }
```

### Login

`POST /api/auth/login`

Body:

```json
{
  "email": "string",
  "password": "string"
}
```

Responses:

- `200` (sets cookie `token`)

```json
{ "user": { "id": 1, "username": "...", "email": "..." } }
```

- `400`

```json
{ "message": "All fields are required" }
```

- `400`

```json
{ "message": "Invalid credentials" }
```

### Me (current user)

Auth required.

`GET /api/auth/me`

Response:

- `200`

```json
{ "user": { "id": 1, "username": "...", "email": "..." } }
```

- `401`

```json
{ "message": "Access token missing" }
```

### Logout

Auth optional.

`POST /api/auth/logout`

Response:

- `200` (clears cookie)

```json
{ "message": "Logged out" }
```

---

## Categories (per-user)

All endpoints below: Auth required.

### List categories

`GET /api/categories`

Response:

- `200`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Food",
    "type": "expense",
    "created_at": "..."
  }
]
```

### Create category

`POST /api/categories`

Body:

```json
{
  "name": "Food",
  "type": "expense"
}
```

Response:

- `201`

```json
{ "id": 1, "user_id": 1, "name": "Food", "type": "expense" }
```

### Update category

`PUT /api/categories/:id`

Body:

```json
{
  "name": "string",
  "type": "income|expense"
}
```

Responses:

- `200`

```json
{ "message": "Category updated" }
```

- `404`

```json
{ "message": "Category not found or unauthorized" }
```

### Delete category

`DELETE /api/categories/:id`

Responses:

- `200`

```json
{ "message": "Category deleted" }
```

- `400`

```json
{ "message": "Category is in use by transactions and cannot be deleted" }
```

- `400`

```json
{ "message": "Category is in use by budgets and cannot be deleted" }
```

- `404`

```json
{ "message": "Category not found or unauthorized" }
```

---

## Transactions

All endpoints below: Auth required.

### List transactions (with filters + pagination)

`GET /api/transactions`

Query params:

- `startDate` (optional, requires `endDate`) - format `YYYY-MM-DD`
- `endDate` (optional, requires `startDate`) - format `YYYY-MM-DD`
- `categoryId` (optional) - category id
- `categoryStr` (optional) - deprecated alias of `categoryId`
- `limit` (optional) - default `50`, max `200`
- `offset` (optional) - default `0`

Response:

- `200`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "category_id": 2,
    "amount": "100.00",
    "transaction_date": "2026-01-22",
    "description": "Lunch",
    "created_at": "...",
    "category_name": "Food",
    "category_type": "expense"
  }
]
```

### Transaction detail

`GET /api/transactions/:id`

Responses:

- `200`

```json
{
  "id": 1,
  "user_id": 1,
  "category_id": 2,
  "amount": "100.00",
  "transaction_date": "2026-01-22",
  "description": "Lunch",
  "created_at": "...",
  "category_name": "Food",
  "category_type": "expense"
}
```

- `404`

```json
{ "message": "Transaction not found or unauthorized" }
```

### Create transaction

`POST /api/transactions`

Body:

```json
{
  "category_id": 2,
  "amount": 100,
  "transaction_date": "2026-01-22",
  "description": "Lunch"
}
```

Responses:

- `201`

```json
{
  "id": 1,
  "user_id": 1,
  "category_id": 2,
  "amount": 100,
  "transaction_date": "2026-01-22",
  "description": "Lunch"
}
```

- `400`

```json
{ "message": "Invalid category" }
```

- `400`

```json
{ "message": "Invalid amount" }
```

- `400`

```json
{ "message": "Invalid date format. Use YYYY-MM-DD" }
```

### Update transaction

`PUT /api/transactions/:id`

Body:

```json
{
  "category_id": 2,
  "amount": 120,
  "transaction_date": "2026-01-22",
  "description": "Updated note"
}
```

Responses:

- `200`

```json
{ "message": "Transaction updated" }
```

- `400`

```json
{ "message": "Invalid category" }
```

- `400`

```json
{ "message": "Invalid amount" }
```

- `400`

```json
{ "message": "Invalid date format. Use YYYY-MM-DD" }
```

- `404`

```json
{ "message": "Transaction not found or unauthorized" }
```

### Delete transaction

`DELETE /api/transactions/:id`

Responses:

- `200`

```json
{ "message": "Transaction deleted" }
```

- `404`

```json
{ "message": "Transaction not found or unauthorized" }
```

---

## Budgets

All endpoints below: Auth required.

### List budgets

`GET /api/budgets`

Query params:

- `period` (optional)

Response:

- `200`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "category_id": 2,
    "amount": "1000.00",
    "period": "2026-01",
    "created_at": "...",
    "category_name": "Food"
  }
]
```

### Create budget

`POST /api/budgets`

Body:

```json
{
  "category_id": 2,
  "amount": 1000,
  "period": "2026-01"
}
```

Responses:

- `201`

```json
{ "id": 1, "user_id": 1, "category_id": 2, "amount": 1000, "period": "2026-01" }
```

- `400`

```json
{ "message": "Invalid category" }
```

- `400`

```json
{ "message": "Budget already exists for this category and period" }
```

### Update budget

`PUT /api/budgets/:id`

Body:

```json
{
  "amount": 1500,
  "category_id": 2
}
```

Responses:

- `200`

```json
{ "message": "Budget updated" }
```

- `404`

```json
{ "message": "Budget not found or unauthorized" }
```

### Delete budget

`DELETE /api/budgets/:id`

Responses:

- `200`

```json
{ "message": "Budget deleted" }
```

- `404`

```json
{ "message": "Budget not found or unauthorized" }
```

---

## Reports

All endpoints below: Auth required.

### Dashboard stats

`GET /api/reports/dashboard`

Query params:

- `month` (optional)
- `year` (optional)

Response:

- `200`

```json
{
  "income": 0,
  "expense": 0,
  "balance": 0,
  "categoryStats": [{ "name": "Food", "total": "1200.00" }]
}
```

---

## Notes

- Update this file whenever you add or change an API endpoint.
- Keep it consistent with `README.md` and `implement.md`.
