export type FAQ = {
  question: string;
  answer: string; // plain text or simple HTML allowed
};

export type Guide = {
  slug: string;
  title: string;
  /** Short one-sentence description used for meta description and card excerpt */
  description: string;
  category: "Scholarships" | "Applications" | "Tests" | "Destinations" | "Visa";
  tags: string[];
  /** ISO date string, e.g. "2025-06-09" */
  publishedAt: string;
  updatedAt: string;
  intro: string;
  /** Full article/blog post body (Markdown). Rendered before the FAQ section. Optional for static seed guides. */
  content?: string;
  faqs: FAQ[];
  /** Optional hero image URL — shown only on the guide detail page, not on listing cards */
  coverImageUrl?: string;
  /** When true the guide is always sorted to position 1 in every listing */
  isPinned?: boolean;
  /** Optional author name shown in the byline (manual guides) */
  writerName?: string;
  /** Optional author designation shown alongside writerName */
  writerDesignation?: string;
};
