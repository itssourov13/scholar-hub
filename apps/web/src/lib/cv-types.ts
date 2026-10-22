/**
 * Shared CV Builder data model + template catalogue.
 *
 * This file is intentionally free of server-side imports so it can be used
 * by both API routes and client components. The full CV is stored as JSONB
 * (`user_cvs.data`) in the shape of `CVData`, so new optional fields can be
 * added without a DB migration.
 */

export type ContactLink = {
  label: string;
  url: string;
};

export type EducationEntry = {
  institution: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  gpa: string;
  details: string;
};

export type ExperienceEntry = {
  role: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type AwardEntry = {
  title: string;
  issuer: string;
  year: string;
  description: string;
};

export type SkillGroup = {
  category: string;
  items: string;
};

/** Referee contact — shown as "Name, Affiliation, Relation to you". */
export type ReferenceEntry = {
  name: string;
  affiliation: string;
  relation: string;
  email: string;
};

export type PublicationEntry = {
  title: string;
  /** Journal or conference proceedings name. */
  venue: string;
  date: string;
  /** DOI (bare, e.g. "10.1109/xyz") or a full link — either renders as a link. */
  doi: string;
};

export type ProjectEntry = {
  title: string;
  /** Optional context, e.g. "Course project", "Hackathon", a company/team name. */
  organization: string;
  /** Repo, demo, or write-up URL. */
  link: string;
  startDate: string;
  endDate: string;
  description: string;
};

/** Sections that are just a list of free-text lines (e.g. presentations). */
export type TextEntry = {
  text: string;
};

/** Reorderable CV sections (everything except the pinned header/contact block). */
export type SectionKey =
  | "researchInterests"
  | "summary"
  | "education"
  | "researchExperience"
  | "publications"
  | "teachingExperience"
  | "workExperience"
  | "projects"
  | "presentations"
  | "awards"
  | "skills"
  | "languages"
  | "references";

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "researchInterests",
  "summary",
  "education",
  "researchExperience",
  "publications",
  "projects",
  "teachingExperience",
  "workExperience",
  "presentations",
  "awards",
  "skills",
  "languages",
  "references",
];

export type CVData = {
  fullName: string;
  headline: string;
  /** Optional profile photo, stored inline as a resized data URL (see the "photo" template). */
  photo: string;
  /** Whether the photo (if any) should actually render — lets users keep an
   * uploaded photo but hide it without deleting it. Templates that never
   * show a photo (see `templateAllowsPhoto`) ignore this. */
  showPhoto: boolean;
  email: string;
  phone: string;
  location: string;
  website: string;
  githubUrl: string;
  googleScholarUrl: string;
  orcid: string;
  kaggleUrl: string;
  links: ContactLink[];
  researchInterests: string;
  summary: string;
  education: EducationEntry[];
  researchExperience: ExperienceEntry[];
  workExperience: ExperienceEntry[];
  teachingExperience: ExperienceEntry[];
  projects: ProjectEntry[];
  publications: PublicationEntry[];
  presentations: TextEntry[];
  awards: AwardEntry[];
  skills: SkillGroup[];
  languages: TextEntry[];
  references: ReferenceEntry[];
  /** User-customized section order. Drives render order in both the editor and the preview. */
  sectionOrder: SectionKey[];
};

export type CVTemplateId = "classic" | "modern" | "europass" | "photo";

/** Europass is a standardized EU format that never includes a photo. */
export function templateAllowsPhoto(template: CVTemplateId): boolean {
  return template !== "europass";
}

export type CVRecord = {
  id: string;
  title: string;
  template: CVTemplateId;
  data: CVData;
  created_at: string;
  updated_at: string;
};

export const CV_TEMPLATES: { id: CVTemplateId; name: string; description: string }[] = [
  {
    id: "classic",
    name: "Classic Academic",
    description: "Traditional serif layout with a centered header — the format most graduate committees expect.",
  },
  {
    id: "europass",
    name: "Europass CV",
    description: "The standardized EU format — a left-aligned date column with understated navy accents, recognized across Europe.",
  },
  {
    id: "modern",
    name: "Modern Academic",
    description: "Sans-serif layout with a teal accent rail and left-aligned header — a contemporary take on the classic format.",
  },
  {
    id: "photo",
    name: "Spotlight",
    description: "Sans-serif layout with your headshot set beside the header — ideal where a photo is expected or welcomed.",
  },
];

export const EMPTY_EDUCATION: EducationEntry = {
  institution: "",
  degree: "",
  field: "",
  location: "",
  startDate: "",
  endDate: "",
  gpa: "",
  details: "",
};

export const EMPTY_EXPERIENCE: ExperienceEntry = {
  role: "",
  organization: "",
  location: "",
  startDate: "",
  endDate: "",
  description: "",
};

export const EMPTY_AWARD: AwardEntry = {
  title: "",
  issuer: "",
  year: "",
  description: "",
};

export const EMPTY_SKILL: SkillGroup = { category: "", items: "" };

export const EMPTY_REFERENCE: ReferenceEntry = {
  name: "",
  affiliation: "",
  relation: "",
  email: "",
};

export const EMPTY_PUBLICATION: PublicationEntry = {
  title: "",
  venue: "",
  date: "",
  doi: "",
};

export const EMPTY_PROJECT: ProjectEntry = {
  title: "",
  organization: "",
  link: "",
  startDate: "",
  endDate: "",
  description: "",
};

export const EMPTY_TEXT: TextEntry = { text: "" };

/**
 * A realistic standard academic CV used to preview templates. Intentionally
 * omits `website`/`links` so the preview renders no <a> tags (it's shown
 * inside a <button> in the template picker, where nested anchors are invalid).
 */
export const DEMO_CV: CVData = {
  fullName: "Ayesha Rahman",
  headline: "Prospective PhD Student in Computer Science",
  photo: "",
  showPhoto: true,
  email: "ayesha.rahman@example.com",
  phone: "+880 1XXX-XXXXXX",
  location: "Dhaka, Bangladesh",
  website: "",
  githubUrl: "",
  googleScholarUrl: "",
  orcid: "",
  kaggleUrl: "",
  links: [],
  researchInterests:
    "Machine learning for healthcare, natural language processing, and low-resource language modelling.",
  summary: "",
  education: [
    {
      institution: "Bangladesh University of Engineering & Technology",
      degree: "BSc",
      field: "Computer Science & Engineering",
      location: "Dhaka",
      startDate: "2020",
      endDate: "2024",
      gpa: "3.88 / 4.00",
      details: "Thesis: Cross-lingual transfer learning for Bengali clinical text.",
    },
  ],
  researchExperience: [
    {
      role: "Undergraduate Research Assistant",
      organization: "BUET NLP Lab",
      location: "Dhaka",
      startDate: "Jan 2023",
      endDate: "Present",
      description:
        "Built a Bengali medical NER dataset; improved baseline F1 by 11 points using multilingual transformers.",
    },
  ],
  workExperience: [],
  teachingExperience: [
    {
      role: "Teaching Assistant — Data Structures",
      organization: "Dept. of CSE, BUET",
      location: "Dhaka",
      startDate: "2023",
      endDate: "2024",
      description: "Led weekly lab sections and graded assignments for 60+ students.",
    },
  ],
  projects: [
    {
      title: "Bengali Clinical NER Toolkit",
      organization: "Course project",
      link: "",
      startDate: "2023",
      endDate: "2023",
      description: "Open-source annotation toolkit and baseline models for Bengali clinical named-entity recognition.",
    },
  ],
  publications: [
    {
      title: "Low-resource clinical NER for Bengali",
      venue: "Proc. of ACL Student Workshop",
      date: "2024",
      doi: "",
    },
  ],
  presentations: [
    { text: "\u201cNLP for Bengali healthcare\u201d — National AI Symposium, Dhaka, 2024." },
  ],
  awards: [
    {
      title: "Dean's List Award",
      issuer: "BUET",
      year: "2022, 2023",
      description: "",
    },
    {
      title: "Champion, National Hackathon",
      issuer: "ICT Division",
      year: "2023",
      description: "",
    },
  ],
  skills: [
    { category: "Programming", items: "Python, C++, JavaScript, SQL" },
    { category: "ML / Tools", items: "PyTorch, Hugging Face, scikit-learn, Git" },
  ],
  languages: [{ text: "Bengali (native)" }, { text: "English (IELTS 7.5)" }],
  references: [],
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

export function emptyCV(): CVData {
  return {
    fullName: "",
    headline: "",
    photo: "",
    showPhoto: true,
    email: "",
    phone: "",
    location: "",
    website: "",
    githubUrl: "",
    googleScholarUrl: "",
    orcid: "",
    kaggleUrl: "",
    links: [],
    researchInterests: "",
    summary: "",
    education: [],
    researchExperience: [],
    workExperience: [],
    teachingExperience: [],
    projects: [],
    publications: [],
    presentations: [],
    awards: [],
    skills: [],
    languages: [],
    references: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}

/**
 * Merge a possibly-partial CV (e.g. loaded from the DB, or an older shape)
 * into a complete CVData so the editor never has to null-check every field.
 */
export function normalizeCV(input: unknown): CVData {
  const base = emptyCV();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  // Keep any known keys in the saved order, then slot in newly-introduced
  // sections (e.g. a CV saved before "projects" existed) right after
  // whichever of their DEFAULT_SECTION_ORDER neighbours is already present,
  // rather than always dumping them at the very end — so e.g. "projects"
  // lands next to "publications" for existing CVs too, not after "references".
  const validKeys = new Set<string>(DEFAULT_SECTION_ORDER);
  const seen = new Set<string>();
  const sectionOrder: SectionKey[] = [];
  for (const k of arr<unknown>(raw.sectionOrder)) {
    if (typeof k === "string" && validKeys.has(k) && !seen.has(k)) {
      sectionOrder.push(k as SectionKey);
      seen.add(k);
    }
  }
  for (const k of DEFAULT_SECTION_ORDER) {
    if (seen.has(k)) continue;
    const defaultIndex = DEFAULT_SECTION_ORDER.indexOf(k);
    let insertAt = sectionOrder.length;
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const idx = sectionOrder.indexOf(DEFAULT_SECTION_ORDER[i]);
      if (idx !== -1) {
        insertAt = idx + 1;
        break;
      }
    }
    sectionOrder.splice(insertAt, 0, k);
    seen.add(k);
  }

  // Publications used to be free-text lines (`{ text }`); fold any old-shape
  // entries into `title` so previously saved CVs don't lose their content.
  const publications = arr<Record<string, unknown>>(raw.publications).map((p) => ({
    title: str(p.title) || str(p.text),
    venue: str(p.venue),
    date: str(p.date),
    doi: str(p.doi),
  }));

  // References used to be `{ name, title, organization, email }`; map the
  // old `organization` into the new `affiliation` field.
  const references = arr<Record<string, unknown>>(raw.references).map((r) => ({
    name: str(r.name),
    affiliation: str(r.affiliation) || str(r.organization),
    relation: str(r.relation),
    email: str(r.email),
  }));

  return {
    fullName: str(raw.fullName),
    headline: str(raw.headline),
    photo: str(raw.photo),
    showPhoto: typeof raw.showPhoto === "boolean" ? raw.showPhoto : true,
    email: str(raw.email),
    phone: str(raw.phone),
    location: str(raw.location),
    website: str(raw.website),
    githubUrl: str(raw.githubUrl),
    googleScholarUrl: str(raw.googleScholarUrl),
    orcid: str(raw.orcid),
    kaggleUrl: str(raw.kaggleUrl),
    links: arr<ContactLink>(raw.links),
    researchInterests: str(raw.researchInterests),
    summary: str(raw.summary),
    education: arr<EducationEntry>(raw.education),
    researchExperience: arr<ExperienceEntry>(raw.researchExperience),
    workExperience: arr<ExperienceEntry>(raw.workExperience),
    teachingExperience: arr<ExperienceEntry>(raw.teachingExperience),
    projects: arr<ProjectEntry>(raw.projects),
    publications,
    presentations: arr<TextEntry>(raw.presentations),
    awards: arr<AwardEntry>(raw.awards),
    skills: arr<SkillGroup>(raw.skills),
    languages: arr<TextEntry>(raw.languages),
    references,
    sectionOrder,
  };
}
