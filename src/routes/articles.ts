import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import * as articles from "../controllers/articles";

const router = Router();

// PUBLIC. "/latest" AND "/mine" MUST STAY ABOVE "/:id", OTHERWISE THEY ARE TREATED AS AN ID
router.get("/", articles.listArticles);
router.get("/latest", articles.listLatestArticles);
router.get(
  "/mine",
  authenticate,
  requireRole("therapist"),
  articles.listMyArticles,
);
router.get("/:id", articles.getArticle);

// THERAPISTS AND ADMINS ONLY (OWNERSHIP IS CHECKED INSIDE THE CONTROLLER)
router.post(
  "/",
  authenticate,
  requireRole("therapist", "admin"),
  articles.createArticle,
);
router.put(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  articles.updateArticle,
);
router.delete(
  "/:id",
  authenticate,
  requireRole("therapist", "admin"),
  articles.deleteArticle,
);

export default router;
