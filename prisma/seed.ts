import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Athar database seeding...");

  // Shared password for all testing accounts
  const hashedPassword = await bcrypt.hash("Test123456!", 10);

  // ==========================================
  // 1. USERS: 1 admin, 10 therapists, 39 clients
  // ==========================================

  const users = [
    {
      id: "seed-admin-01",
      name: "Athar Admin",
      email: "admin@test.com",
      role: "admin",
      emailVerified: true,
    },

    ...Array.from({ length: 10 }, (_, i) => ({
      id: `seed-therapist-${String(i + 1).padStart(2, "0")}`,
      name: `Therapist ${i + 1}`,
      email: `therapist${i + 1}@test.com`,
      role: "therapist",
      emailVerified: true,
    })),

    ...Array.from({ length: 39 }, (_, i) => ({
      id: `seed-client-${String(i + 1).padStart(2, "0")}`,
      name: `Client ${i + 1}`,
      email: `client${i + 1}@test.com`,
      role: "client",
      emailVerified: i !== 38,
    })),
  ];

  await prisma.user.createMany({
    data: users.map((user) => ({
      ...user,
      password: hashedPassword,
    })),
    skipDuplicates: true,
  });

  console.log("50 users created.");

  // ==========================================
  // 2. THERAPIST PROFILES: 10 profiles
  // ==========================================

  const specialties = [
    ["Anxiety", "Stress Management"],
    ["Depression", "Self-esteem"],
    ["Relationships", "Family Therapy"],
    ["OCD", "Anxiety"],
    ["Trauma", "PTSD"],
    ["Child Psychology", "Behavioral Therapy"],
    ["Grief", "Emotional Support"],
    ["Mindfulness", "Stress Management"],
    ["Addiction", "Behavioral Therapy"],
    ["Personal Development", "Self-esteem"],
  ];

  const profiles = Array.from({ length: 10 }, (_, i) => ({
    userId: `seed-therapist-${String(i + 1).padStart(2, "0")}`,
    bio: `I am a mental health professional with ${i + 2} years of experience. I help individuals improve their emotional well-being and develop healthy coping strategies.`,
    specialties: specialties[i],
    languages: ["English", "Arabic"],
    yearsOfExperience: i + 2,
    sessionPrice: 25 + i * 5,
    sessionType: i % 3 === 0 ? "both" : i % 3 === 1 ? "online" : "in-person",
    location: "Saida, Lebanon",
  }));

  await prisma.therapistProfile.createMany({
    data: profiles,
    skipDuplicates: true,
  });

  console.log("10 therapist profiles created.");

  // ==========================================
  // 3. ARTICLES: 50 articles
  // ==========================================

  const articleTopics = [
    {
      category: "Anxiety",
      titles: [
        "Understanding Anxiety",
        "How to Manage Daily Stress",
        "Recognizing Anxiety Triggers",
        "Breathing Techniques for Anxiety",
        "Building Emotional Resilience",
      ],
    },
    {
      category: "Depression",
      titles: [
        "Understanding Depression",
        "Small Steps Toward Healing",
        "The Importance of Self-Care",
        "Breaking the Cycle of Negative Thoughts",
        "How to Ask for Emotional Support",
      ],
    },
    {
      category: "OCD",
      titles: [
        "Understanding OCD",
        "Common OCD Misconceptions",
        "Managing Intrusive Thoughts",
        "When to Seek Professional Help",
        "Learning About Compulsions",
      ],
    },
    {
      category: "Self-care",
      titles: [
        "Creating a Healthy Routine",
        "The Importance of Sleep",
        "Setting Healthy Boundaries",
        "Practicing Mindfulness",
        "Making Time for Yourself",
      ],
    },
    {
      category: "Relationships",
      titles: [
        "Healthy Communication",
        "Understanding Emotional Boundaries",
        "Building Strong Relationships",
        "Managing Relationship Conflicts",
        "The Importance of Empathy",
      ],
    },
    {
      category: "Stress",
      titles: [
        "Understanding Chronic Stress",
        "Healthy Ways to Relax",
        "Balancing Work and Personal Life",
        "Recognizing Burnout",
        "Developing Coping Strategies",
      ],
    },
    {
      category: "Mindfulness",
      titles: [
        "An Introduction to Mindfulness",
        "Living in the Present Moment",
        "Mindful Breathing Exercises",
        "Building Daily Mindfulness Habits",
        "Mindfulness and Emotional Health",
      ],
    },
    {
      category: "Personal Growth",
      titles: [
        "Building Self-Confidence",
        "Learning to Accept Yourself",
        "Overcoming Self-Doubt",
        "Setting Realistic Goals",
        "Understanding Personal Growth",
      ],
    },
    {
      category: "Trauma",
      titles: [
        "Understanding Emotional Trauma",
        "The Healing Process",
        "Creating a Safe Environment",
        "Supporting Someone Through Trauma",
        "Recognizing Trauma Responses",
      ],
    },
    {
      category: "Emotional Health",
      titles: [
        "Understanding Your Emotions",
        "Developing Emotional Awareness",
        "Expressing Feelings in Healthy Ways",
        "Why Emotional Health Matters",
        "Learning to Handle Difficult Emotions",
      ],
    },
  ];

  const articles = articleTopics.flatMap((group, groupIndex) =>
    group.titles.map((title, titleIndex) => {
      const articleNumber = groupIndex * 5 + titleIndex + 1;
      const therapistNumber = ((articleNumber - 1) % 10) + 1;

      return {
        id: `seed-article-${String(articleNumber).padStart(2, "0")}`,
        title,
        content: `${title}. Mental health is an important part of our overall well-being. Understanding this topic can help us recognize our feelings, develop healthy habits, and know when to seek professional support. Remember that everyone's experience is different, and professional guidance can make a difference.`,
        category: group.category,
        author: `Therapist ${therapistNumber}`,
        authorId: `seed-therapist-${String(therapistNumber).padStart(2, "0")}`,
      };
    }),
  );

  await prisma.article.createMany({
    data: articles,
    skipDuplicates: true,
  });

  console.log("50 articles created.");

  // ==========================================
  // 4. AVAILABILITY SLOTS: 50 slots
  // ==========================================

  const availabilitySlots = Array.from({ length: 50 }, (_, i) => {
    const therapistNumber = (i % 10) + 1;

    const date = new Date(Date.UTC(2026, 11, 1 + i))
      .toISOString()
      .split("T")[0];

    const startHour = 9 + (Math.floor(i / 10) % 5);

    return {
      id: `seed-slot-${String(i + 1).padStart(2, "0")}`,
      therapistId: `seed-therapist-${String(therapistNumber).padStart(2, "0")}`,
      date,
      startTime: `${String(startHour).padStart(2, "0")}:00`,
      endTime: `${String(startHour + 1).padStart(2, "0")}:00`,
      isBooked: i < 30,
    };
  });

  await prisma.availabilitySlot.createMany({
    data: availabilitySlots,
    skipDuplicates: true,
  });

  console.log("50 availability slots created.");

  // ==========================================
  // 5. SESSIONS: 30 sessions
  // ==========================================

  const statuses = ["pending", "confirmed", "cancelled"];

  const sessions = Array.from({ length: 30 }, (_, i) => {
    const slot = availabilitySlots[i];

    const therapistNumber = (i % 10) + 1;
    const clientNumber = (i % 39) + 1;

    return {
      id: `seed-session-${String(i + 1).padStart(2, "0")}`,
      therapistId: `seed-therapist-${String(therapistNumber).padStart(2, "0")}`,
      patientId: `seed-client-${String(clientNumber).padStart(2, "0")}`,
      slotId: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      sessionType: i % 2 === 0 ? "online" : "in-person",
      status: statuses[i % statuses.length],
    };
  });

  await prisma.session.createMany({
    data: sessions,
    skipDuplicates: true,
  });

  console.log("30 sessions created.");

  console.log("--------------------------------");
  console.log("Athar database seeding completed!");
  console.log("--------------------------------");
}

main()
  .catch((error) => {
    console.error("Error while seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
