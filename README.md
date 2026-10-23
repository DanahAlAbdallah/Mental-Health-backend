# Mental Health Platform: Backend

REST API for a platform that connects clients with therapists. It handles authentication, user and therapist profiles, articles, therapist availability, and session booking.

> Frontend repository: [https://github.com/DanahAlAbdallah/Mental-Health-Frontend]

## Features

- Sign up and log in with JWT authentication
- Password hashing with bcrypt and password strength validation
- Role-based users: **client** and **therapist**
- User profile management (name, phone, avatar)
- Therapist profiles (bio, specialties, languages, price, session type, location)
- Articles (create, read, update)
- Therapist availability slots
- Session booking

## Tech Stack

| Area             | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Runtime          | [Node.js](https://nodejs.org)                                    |
| Framework        | [Express](https://expressjs.com)                                 |
| Language         | [TypeScript](https://www.typescriptlang.org)                     |
| ORM              | [Prisma](https://www.prisma.io)                                  |
| Database         | PostgreSQL (change if you use another)                           |
| Authentication   | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) (JWT) |
| Password hashing | [bcrypt](https://github.com/kelektiv/node.bcrypt.js)             |
| CORS             | [cors](https://github.com/expressjs/cors)                        |
| Config           | [dotenv](https://github.com/motdotla/dotenv)                     |
| Hosting          | [Render](https://render.com)                                     |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18 or newer
- npm
- A database supported by Prisma (for example PostgreSQL)

### Installation

```bash
# 1. Clone the repository
git clone <https://github.com/DanahAlAbdallah/Mental-Health-backend>

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
```

### Environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/your_db"
JWT_SECRET="a-long-random-secret-string"
PORT=3001
```

| Variable       | Description                                                         |
| -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL` | Connection string for your database                                 |
| `JWT_SECRET`   | Secret used to sign JWT tokens. Keep it private and never commit it |
| `PORT`         | Port the server listens on (defaults to 3001)                       |

### Set up the database (Prisma)

```bash
# Generate the Prisma client
npx prisma generate

# Create and apply migrations (development)
npx prisma migrate dev

# Optional: open Prisma Studio to view and edit data
npx prisma studio
```

### Run the server

```bash
npm run dev
```

The API runs at [http://localhost:3001](http://localhost:3001).

## Available Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the server in development mode |
| `npm run build` | Compile TypeScript                   |
| `npm start`     | Run the compiled server              |

Adjust this table to match the scripts in your `package.json`.

## API Overview

Base URL: `/api`

| Area         | Route               | Description                                               |
| ------------ | ------------------- | --------------------------------------------------------- |
| Auth         | `POST /auth/signup` | Create an account                                         |
| Auth         | `POST /auth/login`  | Log in and receive a JWT                                  |
| Users        | `/users`            | Profile endpoints (for example `GET` and `PUT /users/me`) |
| Articles     | `/articles`         | Browse, create, and edit articles                         |
| Availability | `/availability`     | Therapist availability slots                              |
| Sessions     | `/sessions`         | Book and view sessions                                    |

Protected routes require this header:

```
Authorization: Bearer <token>
```

## Project Structure

```
src/
├── routes/       # articles, users, availability, sessions
├── middleware/   # authenticate (JWT verification)
└── index.ts      # Express app, auth routes, server start
prisma/
└── schema.prisma # Database models
generated/
└── prisma/       # Generated Prisma client
```

Adjust this section to match your actual folders.

## Deployment (Render)

- **Build command:**
  ```bash
  npm install && npx prisma generate && npm run build
  ```
- **Start command:**
  ```bash
  npm start
  ```
- **Environment variables:** set `DATABASE_URL` and `JWT_SECRET` in the Render dashboard.
- **Database migrations in production:** run `npx prisma migrate deploy`.
- **CORS:** allow your deployed frontend origin in the `cors` configuration.

## Security Notes

- Passwords are hashed with bcrypt and never returned by the API.
- Passwords must be at least 8 characters and include a letter, a number, and a special character.
- Never commit `.env` files or secrets.

## Working on...

- [ ] Therapists can edit only their own articles
- [ ] Password reset by email
- [ ] Profile picture upload
- [ ] Email notifications for sessions
- [ ] Login with Google
- [ ] Session notes and client folders for therapists
- [ ] AI-assisted therapist matching and pre-session briefs

## Author

Your Name: [GitHub](https://github.com/DanahAlAbdallah) · [LinkedIn](https://www.linkedin.com/in/danahalabdallah)
