# Personal Finance Backend

Node.js + Express REST API for a personal finance app.

## Requirements

- Node.js (recommended: >= 18)
- MySQL Server (8.x+ / 9.x)

## Project structure

- `server.js`: API entrypoint
- `schema.sql`: database schema
- `scripts/init_db.js`: initializes database schema

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Create `.env`

Create a file named `.env` at the project root (same level as `server.js`). Example:

```env
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=personal_finance

JWT_SECRET=change_me
```

Notes:

- `.env` is ignored by git. Each machine must create it locally.
- If your MySQL is not on port `3306`, update `DB_PORT`.

### 3) Initialize database

This runs `schema.sql` to create DB + tables:

```bash
npm run init-db
```

### 4) Run the backend (nodemon)

```bash
npm run dev
```

### 5) Verify server

Open in browser:

- `http://localhost:3000/`

Expected response:

```txt
Personal Finance API is running
```

## Scripts

- `npm run dev`: start server with nodemon
- `npm start`: start server with node
- `npm run init-db`: run schema initialization

## Auth (cookie-based)

- `POST /api/auth/login` sets an HttpOnly cookie named `token`.
- `GET /api/auth/me` returns the currently authenticated user (requires cookie).
- `POST /api/auth/logout` clears the cookie.

Notes:

- Registering a new user seeds a default set of categories for that user.

If you call the API from a browser-based frontend, make sure to send credentials:

- `fetch(..., { credentials: 'include' })`
- Axios: `{ withCredentials: true }`

## CSRF (required for write requests)

For `POST/PUT/PATCH/DELETE` requests (except `login/register/csrf`), the backend requires a CSRF token.

Flow:

1. Call `GET /api/auth/csrf` to get `{ csrfToken }` (also sets a `csrfToken` cookie)
2. Send header `x-csrf-token: <csrfToken>` for write requests

## CORS (frontend on another port)

If your frontend runs on a different port (example: `http://localhost:8081`), set:

```env
CORS_ORIGIN=http://localhost:8081
```

## Transactions

- `GET /api/transactions?limit=&offset=&startDate=&endDate=&categoryId=&categoryStr=`
  - Pagination:
    - `limit` default 50 (max 200)
    - `offset` default 0
- `GET /api/transactions/:id`

## Troubleshooting

### A) `Error: connect ECONNREFUSED 127.0.0.1:3306`

Meaning: the app cannot reach MySQL on `host:port`.

Fix checklist:

- Ensure MySQL server is running.
- Ensure `DB_HOST` / `DB_PORT` in `.env` matches your MySQL.
- Check if port is listening:

macOS:

```bash
lsof -nP -iTCP:3306 -sTCP:LISTEN
```

Windows (PowerShell):

```powershell
netstat -ano | findstr :3306
```

If you are using Docker, ensure port mapping exists (example):

```bash
docker run -p 3306:3306 ...
```

### B) `Access denied for user 'root'@'localhost' (using password: NO/YES)`

Meaning: wrong credentials.

Fix:

- Verify login via CLI:

macOS / Linux:

```bash
mysql -u root -p
```

Windows (MySQL Client):

```bat
mysql -u root -p
```

- Update `.env`:
  - `DB_USER`
  - `DB_PASSWORD`

Recommended: create a dedicated user for the app:

```sql
CREATE USER IF NOT EXISTS 'pf_user'@'localhost' IDENTIFIED BY 'pf_password';
GRANT ALL PRIVILEGES ON personal_finance.* TO 'pf_user'@'localhost';
FLUSH PRIVILEGES;
```

Then set:

```env
DB_USER=pf_user
DB_PASSWORD=pf_password
```

### C) `ERROR 1819 (HY000): Your password does not satisfy the current policy requirements`

Meaning: MySQL password policy is enabled and your password is too weak.

Fix:

- Use a stronger password (longer, includes upper/lowercase, number, special character).

### D) MySQL Workbench crashes on macOS

MySQL Workbench can crash on some macOS versions / MySQL versions.

Workarounds:

- Use CLI (`mysql` command)
- Use an alternative GUI:
  - DBeaver
  - TablePlus

## macOS MySQL (Homebrew) quick commands

```bash
brew install mysql
brew services start mysql
brew services info mysql
brew services stop mysql
```

## Windows MySQL quick notes

Common install options:

- MySQL Installer (official)
- XAMPP/WAMP (bundled stacks)
- Docker

Make sure:

- MySQL service is started (Windows Services)
- Port `3306` is not blocked and matches `.env`

---

If you still cannot run `npm run init-db`, paste the full error output and your `.env` values (hide password) so it can be diagnosed quickly.
