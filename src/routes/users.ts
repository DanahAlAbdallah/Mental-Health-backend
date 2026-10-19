import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// THE SESSION TYPES A THERAPIST CAN CHOOSE FROM
const SESSION_TYPES = ["online", "in-person", "both"];

// THE USER FIELDS IT IS SAFE TO SEND BACK TO THE USER THEMSELVES (NEVER THE PASSWORD)
const privateUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
};

// THE USER FIELDS THAT ARE PUBLIC, FOR THE THERAPISTS PAGES (NO EMAIL, NO PHONE)
const publicTherapistSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  therapistProfile: true,
};

// TURNS A THERAPIST FROM THE DATABASE INTO WHAT THE FRONTEND EXPECTS:
// THE FIELD "therapistProfile" IS SENT AS "profile"
function toPublicTherapist<T extends { therapistProfile: unknown }>(
  therapist: T,
) {
  const { therapistProfile, ...rest } = therapist;
  return { ...rest, profile: therapistProfile };
}

// CLEANS A LIST OF TEXTS (EXAMPLE: SPECIALTIES): ONLY NON EMPTY STRINGS, NO DUPLICATES, MAX 10
function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items)].slice(0, 10);
}

// GET ALL USERS (ADMIN ONLY)
router.get("/", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: privateUserSelect,
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET ALL THERAPISTS. PUBLIC, SO IT ONLY SENDS NAME, PHOTO AND PROFILE
router.get("/therapists", async (_req, res) => {
  try {
    const therapists = await prisma.user.findMany({
      where: { role: "therapist" },
      select: publicTherapistSelect,
      orderBy: { name: "asc" },
    });
    res.json(therapists.map(toPublicTherapist));
  } catch (err) {
    console.error("Failed to fetch therapists:", err);
    res.status(500).json({ error: "Failed to fetch therapists" });
  }
});

// GET ONE THERAPIST BY ID. PUBLIC, SAME SAFE FIELDS AS THE LIST
router.get("/therapists/:id", async (req, res) => {
  try {
    const therapist = await prisma.user.findFirst({
      where: { id: req.params.id as string, role: "therapist" },
      select: publicTherapistSelect,
    });

    if (!therapist) {
      return res.status(404).json({ error: "Therapist not found" });
    }

    res.json(toPublicTherapist(therapist));
  } catch (err) {
    console.error("Failed to fetch therapist:", err);
    res.status(500).json({ error: "Failed to fetch therapist" });
  }
});

// GET THE PROFILE OF THE LOGGED IN THERAPIST (FOR THE EDIT PROFILE PAGE).
// IF THEY HAVE NOT FILLED IT YET, SENDS EMPTY DEFAULTS
router.get(
  "/me/profile",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    try {
      const profile = await prisma.therapistProfile.findUnique({
        where: { userId: req.user!.id },
      });

      res.json(
        profile ?? {
          userId: req.user!.id,
          bio: "",
          specialties: [],
          languages: [],
          sessionType: "online",
        },
      );
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  },
);

// SAVE THE PROFILE OF THE LOGGED IN THERAPIST.
// THE OWNER COMES FROM THE LOGIN TOKEN, NEVER FROM THE REQUEST
router.put(
  "/me/profile",
  authenticate,
  requireRole("therapist"),
  async (req: AuthRequest, res) => {
    const {
      bio,
      specialties,
      languages,
      yearsOfExperience,
      sessionPrice,
      sessionType,
      location,
    } = req.body;

    if (bio !== undefined && (typeof bio !== "string" || bio.length > 1000)) {
      return res
        .status(400)
        .json({ error: "Bio must be text of at most 1000 characters" });
    }

    if (sessionType !== undefined && !SESSION_TYPES.includes(sessionType)) {
      return res.status(400).json({
        error: `Session type must be one of: ${SESSION_TYPES.join(", ")}`,
      });
    }

    for (const [label, value] of [
      ["Years of experience", yearsOfExperience],
      ["Session price", sessionPrice],
    ] as const) {
      if (
        value !== undefined &&
        value !== null &&
        (!Number.isInteger(value) || value < 0)
      ) {
        return res
          .status(400)
          .json({ error: `${label} must be a positive whole number` });
      }
    }

    const data = {
      bio: bio?.trim(),
      specialties: cleanList(specialties),
      languages: cleanList(languages),
      yearsOfExperience,
      sessionPrice,
      sessionType,
      location: typeof location === "string" ? location.trim() : undefined,
    };

    try {
      const profile = await prisma.therapistProfile.upsert({
        where: { userId: req.user!.id },
        update: data,
        create: { userId: req.user!.id, ...data },
      });
      res.json(profile);
    } catch (err) {
      console.error("Failed to save profile:", err);
      res.status(500).json({ error: "Failed to save profile" });
    }
  },
);

// GET ONE USER. ONLY THE USER THEMSELVES OR AN ADMIN
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  const isOwnProfile = req.user!.id === req.params.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwnProfile && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id as string },
      select: privateUserSelect,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Failed to fetch user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// UPDATE A USER'S NAME, EMAIL, PHONE AND PHOTO. ONLY THE USER THEMSELVES OR AN ADMIN.
// THE ROLE AND THE PASSWORD CANNOT BE CHANGED HERE
router.put("/:id", authenticate, async (req: AuthRequest, res) => {
  const isOwnProfile = req.user!.id === req.params.id;
  const isAdmin = req.user!.role === "admin";

  if (!isOwnProfile && !isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { name, email, phone, avatarUrl } = req.body;

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "Name cannot be empty" });
  }

  if (
    email !== undefined &&
    (typeof email !== "string" || !email.includes("@"))
  ) {
    return res.status(400).json({ error: "Please enter a valid email" });
  }

  try {
    const id = req.params.id as string;
    const newName = name?.trim();

    // IF THE NAME CHANGES, THE NAME SHOWN ON THEIR ARTICLES CHANGES TOO
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: newName,
          email: email?.trim().toLowerCase(),
          phone: typeof phone === "string" ? phone.trim() : undefined,
          avatarUrl:
            typeof avatarUrl === "string" ? avatarUrl.trim() : undefined,
        },
        select: privateUserSelect,
      }),
      ...(newName
        ? [
            prisma.article.updateMany({
              where: { authorId: id },
              data: { author: newName },
            }),
          ]
        : []),
    ]);

    res.json(user);
  } catch (err) {
    // P2002 IS PRISMA'S CODE FOR "THIS VALUE MUST BE UNIQUE" (THE EMAIL IS TAKEN)
    if ((err as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "This email is already in use" });
    }
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE A USER (ADMIN ONLY). THEIR PROFILE AND ARTICLES ARE DELETED WITH THEM
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
