// LIMITS (CHANGE THEM IF YOUR APP NEEDS DIFFERENT ONES)
export const MAX_TITLE_LENGTH = 150;
export const MAX_CONTENT_LENGTH = 20000;
export const MAX_CATEGORY_LENGTH = 50;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_ARTICLES_PER_AUTHOR = 100;

// RETURNS AN ERROR MESSAGE, OR null IF THE ARTICLE INPUT IS OK
export function validateArticleInput(body: Record<string, any>): string | null {
  const { title, content, category } = body;

  if (typeof title !== "string" || !title.trim()) return "Title is required";
  if (typeof content !== "string" || !content.trim())
    return "Content is required";
  if (typeof category !== "string" || !category.trim())
    return "Category is required";

  if (title.trim().length > MAX_TITLE_LENGTH) {
    return `Title must be at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (content.trim().length > MAX_CONTENT_LENGTH) {
    return `Content must be at most ${MAX_CONTENT_LENGTH} characters`;
  }
  if (category.trim().length > MAX_CATEGORY_LENGTH) {
    return `Category must be at most ${MAX_CATEGORY_LENGTH} characters`;
  }

  return null;
}

// READS A POSITIVE WHOLE NUMBER FROM THE URL (?page=2), OR USES THE DEFAULT.
// THE URL VALUE CAN BE ANYTHING (TEXT, A LIST...), SO WE CHECK ITS TYPE FIRST
export function parsePositiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}
