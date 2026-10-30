import "dotenv/config";
import express from "express";
import cors from "cors";
import articlesRouter from "./routes/articles";
import usersRouter from "./routes/users";
import availabilityRouter from "./routes/availability";
import sessionsRouter from "./routes/sessions";
import authRoutes from "./routes/authRoutes";


const app = express();
const JWT_SECRET = process.env.JWT_SECRET!;

app.use(cors());
app.use(express.json());

// ARTICLE ROUTES
app.use("/api/articles", articlesRouter);

// USERS ROUTES
app.use("/api/users", usersRouter);

// THERAPIST AVAILABILITY SLOTS ROUTES
app.use("/api/availability", availabilityRouter);

// SESSEIONS ROUTES
app.use("/api/sessions", sessionsRouter);

// LOGIN & SIGNUP
app.use("/api/auth", authRoutes);

// ================= START SERVER =================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
