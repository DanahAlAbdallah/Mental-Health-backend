import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { validateMeInput, validateProfileInput } from "../validators/users";

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

// SENDS "therapistProfile" AS "profile", WHICH IS WHAT THE FRONTEND EXPECTS
function toPublicTherapist<T extends { therapistProfile: unknown }>(
  therapist: T,
) {
  const { therapistProfile, ...rest } = therapist;
  return { ...rest, profile: therapistProfile };
}

// ONLY NON EMPTY STRINGS, NO DUPLICATES, MAX 10
function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items)].slice(0, 10);
}

// null -> null (CLEAR IT), "  text " -> "text", "" -> null, MISSING -> undefined (DON'T TOUCH)
function cleanOptionalText(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  return undefined;
}

// PRISMA ERRORS HAVE A `code` (P2025 = RECORD NOT FOUND)
function hasCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === code
  );
}

// ---------- ADMIN ----------

export async function listUsers(_req: Request, res: Response) {
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
}

export async function deleteUser(req: AuthRequest, res: Response) {
  const id = req.params.id as string;

  // AN ADMIN DELETING THEMSELVES BY MISTAKE COULD LEAVE THE APP WITH NO ADMIN
  if (req.user!.id === id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    if (hasCode(err, "P2025")) {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
}

// ---------- PUBLIC ----------

export async function listTherapists(_req: Request, res: Response) {
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
}

export async function getTherapist(req: Request, res: Response) {
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
}

// ---------- LOGGED-IN THERAPIST ----------

export async function getMyProfile(req: AuthRequest, res: Response) {
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
}

// THE OWNER COMES FROM THE TOKEN, NEVER FROM THE REQUEST
export async function saveMyProfile(req: AuthRequest, res: Response) {
  const body = req.body ?? {};

  const error = validateProfileInput(body);
  if (error) return res.status(400).json({ error });

  const data = {
    bio: body.bio?.trim(),
    specialties: cleanList(body.specialties),
    languages: cleanList(body.languages),
    yearsOfExperience: body.yearsOfExperience,
    sessionPrice: body.sessionPrice,
    sessionType: body.sessionType,
    location:
      typeof body.location === "string" ? body.location.trim() : undefined,
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
}

// ---------- ANY LOGGED-IN USER ----------

// ONLY THE USER THEMSELVES OR AN ADMIN
export async function getUser(req: AuthRequest, res: Response) {
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
}

// UPDATES THE LOGGED-IN USER'S NAME, PHONE AND PHOTO.
// ROLE, PASSWORD AND EMAIL CANNOT BE CHANGED HERE
export async function updateMe(req: AuthRequest, res: Response) {
  const body = req.body ?? {};

  const error = validateMeInput(body);
  if (error) return res.status(400).json({ error });

  const id = req.user!.id;
  const newName = (body.name as string).trim();

  try {
    // BOTH UPDATES SUCCEED TOGETHER OR NEITHER DOES
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          name: newName,
          phone: cleanOptionalText(body.phone),
          avatarUrl: cleanOptionalText(body.avatarUrl),
        },
        select: privateUserSelect,
      });

      // THE NAME SHOWN ON THEIR ARTICLES CHANGES TOO
      await tx.article.updateMany({
        where: { authorId: id },
        data: { author: newName },
      });

      return updatedUser;
    });

    res.json(user);
  } catch (err) {
    console.error("Failed to update own profile:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}