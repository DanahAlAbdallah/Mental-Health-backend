import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { validateMeInput, validateProfileInput } from "../validators/users";

// ======================================================
// SELECT OBJECTS
// ======================================================

// Private fields: only the account owner or authorized admin.
// NEVER include password or passwordHash.
const privateUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
};

// Public therapist information.
// Explicitly select fields instead of returning the entire profile.
const publicTherapistSelect = {
  id: true,
  name: true,
  role: true,
  avatarUrl: true,
  therapistProfile: {
    select: {
      bio: true,
      specialties: true,
      languages: true,
      yearsOfExperience: true,
      sessionPrice: true,
      sessionType: true,
      location: true,
    },
  },
};

// Fields returned to a therapist when managing their own profile.
const therapistProfileSelect = {
  userId: true,
  bio: true,
  specialties: true,
  languages: true,
  yearsOfExperience: true,
  sessionPrice: true,
  sessionType: true,
  location: true,
};

// ======================================================
// HELPER FUNCTIONS
// ======================================================

// Convert therapistProfile into "profile" for React.
function toPublicTherapist(therapist: {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  therapistProfile: {
    bio: string;
    specialties: string[];
    languages: string[];
    yearsOfExperience: number | null;
    sessionPrice: number | null;
    sessionType: string;
    location: string | null;
  } | null;
}) {
  return {
    id: therapist.id,
    name: therapist.name,
    role: therapist.role,
    avatarUrl: therapist.avatarUrl ?? undefined,
    profile: therapist.therapistProfile ?? {
      bio: "",
      specialties: [],
      languages: [],
      yearsOfExperience: null,
      sessionPrice: null,
      sessionType: "online",
      location: null,
    },
  };
}

// Clean arrays: remove empty strings, duplicates and limit to 10.
function cleanList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set(items)].slice(0, 10);
}

// null = clear the field
// string = trim the value
// empty string = null
// undefined = leave unchanged
function cleanOptionalText(value: unknown): string | null | undefined {
  if (value === null) return null;

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return undefined;
}

// Check Prisma error codes.
function hasCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === code
  );
}

// Check admin permissions inside controllers too.
// Route middleware is still required.
function isAdmin(req: AuthRequest): boolean {
  return req.user?.role === "admin";
}

// Return a default therapist profile when one does not exist.
function emptyTherapistProfile(userId: string) {
  return {
    userId,
    bio: "",
    specialties: [],
    languages: [],
    yearsOfExperience: null,
    sessionPrice: null,
    sessionType: "online",
    location: null,
  };
}

// ======================================================
// ADMIN
// ======================================================

// GET /api/users
// Admin can list users, including authorized contact details.
export async function listUsers(req: AuthRequest, res: Response) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const users = await prisma.user.findMany({
      select: privateUserSelect,
      orderBy: { createdAt: "desc" },
    });

    return res.json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);

    return res.status(500).json({
      error: "Failed to fetch users",
    });
  }
}

// GET /api/users/admin/:id
// Admin can view one user's private account information.
export async function getAdminUser(req: AuthRequest, res: Response) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: privateUserSelect,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(user);
  } catch (err) {
    console.error("Failed to fetch admin user:", err);

    return res.status(500).json({
      error: "Failed to fetch user",
    });
  }
}

// DELETE /api/users/:id
// Admin can delete users, but cannot delete their own account.
export async function deleteUser(req: AuthRequest, res: Response) {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (req.user!.id === id) {
    return res.status(400).json({
      error: "You cannot delete your own account",
    });
  }

  try {
    await prisma.user.delete({
      where: { id },
    });

    return res.status(204).send();
  } catch (err) {
    if (hasCode(err, "P2025")) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    console.error("Failed to delete user:", err);

    return res.status(500).json({
      error: "Failed to delete user",
    });
  }
}

// ======================================================
// PUBLIC THERAPIST PROFILES
// ======================================================

// GET /api/users/therapists
// Anyone can browse public therapist information.
export async function listTherapists(_req: Request, res: Response) {
  try {
    const therapists = await prisma.user.findMany({
      where: { role: "therapist" },
      select: publicTherapistSelect,
      orderBy: { name: "asc" },
    });

    return res.json(therapists.map(toPublicTherapist));
  } catch (err) {
    console.error("Failed to fetch therapists:", err);

    return res.status(500).json({
      error: "Failed to fetch therapists",
    });
  }
}

// GET /api/users/therapists/:id
// Anyone can view one therapist's public profile.
export async function getTherapist(req: Request, res: Response) {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    return res.status(400).json({
      error: "Invalid therapist ID",
    });
  }

  try {
    const therapist = await prisma.user.findFirst({
      where: {
        id,
        role: "therapist",
      },
      select: publicTherapistSelect,
    });

    if (!therapist) {
      return res.status(404).json({
        error: "Therapist not found",
      });
    }

    return res.json(toPublicTherapist(therapist));
  } catch (err) {
    console.error("Failed to fetch therapist:", err);

    return res.status(500).json({
      error: "Failed to fetch therapist",
    });
  }
}

// GET /api/users/:id
// Public endpoint: therapist profiles only.
// Clients and admins are not exposed through this endpoint.
export async function getUserDetails(req: Request, res: Response) {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    return res.status(400).json({
      error: "Invalid user ID",
    });
  }

  try {
    const therapist = await prisma.user.findFirst({
      where: {
        id,
        role: "therapist",
      },
      select: publicTherapistSelect,
    });

    if (!therapist) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(toPublicTherapist(therapist));
  } catch (err) {
    console.error("Failed to fetch public user details:", err);

    return res.status(500).json({
      error: "Failed to fetch user details",
    });
  }
}

// ======================================================
// LOGGED-IN THERAPIST
// ======================================================

// GET /api/users/me/profile
// Therapist can view their own professional profile.
export async function getMyProfile(req: AuthRequest, res: Response) {
  if (req.user?.role !== "therapist") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const profile = await prisma.therapistProfile.findUnique({
      where: {
        userId: req.user.id,
      },
      select: therapistProfileSelect,
    });

    return res.json(profile ?? emptyTherapistProfile(req.user.id));
  } catch (err) {
    console.error("Failed to fetch profile:", err);

    return res.status(500).json({
      error: "Failed to fetch profile",
    });
  }
}

// PUT /api/users/me/profile
// Therapist can update only their own professional profile.
export async function saveMyProfile(req: AuthRequest, res: Response) {
  if (req.user?.role !== "therapist") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const body = req.body ?? {};

  const error = validateProfileInput(body);

  if (error) {
    return res.status(400).json({ error });
  }

  const data = {
    bio: body.bio.trim(),
    specialties: cleanList(body.specialties),
    languages: cleanList(body.languages),
    yearsOfExperience: body.yearsOfExperience,
    sessionPrice: body.sessionPrice,
    sessionType: body.sessionType,
    location: cleanOptionalText(body.location),
  };

  try {
    const profile = await prisma.therapistProfile.upsert({
      where: {
        userId: req.user.id,
      },
      update: data,
      create: {
        userId: req.user.id,
        ...data,
      },
      select: therapistProfileSelect,
    });

    return res.json(profile);
  } catch (err) {
    console.error("Failed to save profile:", err);

    return res.status(500).json({
      error: "Failed to save profile",
    });
  }
}

// ======================================================
// ANY LOGGED-IN USER
// ======================================================

// GET /api/users/me
// User can retrieve their own private account information.
export async function getMyAccount(req: AuthRequest, res: Response) {
  if (!req.user?.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: privateUserSelect,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(user);
  } catch (err) {
    console.error("Failed to fetch account:", err);

    return res.status(500).json({
      error: "Failed to fetch account",
    });
  }
}

// PUT /api/users/me
// User can update their own name, phone and avatar.
// Cannot change role, email or password through this endpoint.
export async function updateMe(req: AuthRequest, res: Response) {
  if (!req.user?.id) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const body = req.body ?? {};

  const error = validateMeInput(body);

  if (error) {
    return res.status(400).json({ error });
  }

  const id = req.user.id;
  const newName = body.name.trim();

  try {
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

      // Keep article author names synchronized.
      await tx.article.updateMany({
        where: { authorId: id },
        data: { author: newName },
      });

      return updatedUser;
    });

    return res.json(user);
  } catch (err) {
    console.error("Failed to update own profile:", err);

    return res.status(500).json({
      error: "Failed to update profile",
    });
  }
}
