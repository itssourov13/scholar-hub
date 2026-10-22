import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { CVData, SectionKey } from "@scholarhub/shared";

/**
 * Print-style A4 preview, mirroring the web classic template
 * (apps/web/src/components/cv/cv-preview.tsx + cv-preview.module.css).
 * The page is laid out at the web's true 820-unit width with the same
 * font sizes/margins, then uniformly scaled down to fit the phone —
 * the RN equivalent of the web's `zoom`-to-fit.
 */
const PAGE_W = 820;
const PAGE_H = Math.round((PAGE_W * 297) / 210); // A4 aspect ratio

const INK = "#1a1a1a";
const MUTED = "#555555";
const RULE = "#cfcfcf";
const ACCENT = "#0a6d6b";

const SERIF = Platform.select({ ios: "Georgia", default: "serif" });

/** Standard academic-CV section titles (same wording as the web preview). */
const TITLES: Record<SectionKey, string> = {
  researchInterests: "Research Interests",
  summary: "Profile",
  education: "Education",
  researchExperience: "Research Experience",
  publications: "Publications",
  teachingExperience: "Teaching Experience",
  workExperience: "Professional Experience",
  projects: "Projects",
  presentations: "Conferences & Presentations",
  awards: "Awards & Honours",
  skills: "Skills",
  languages: "Languages",
  references: "References",
};

const DEFAULT_ORDER: SectionKey[] = [
  "researchInterests", "summary", "education", "researchExperience", "publications",
  "projects", "teachingExperience", "workExperience", "presentations", "awards",
  "skills", "languages", "references",
];

const has = (v: string | undefined | null): v is string => Boolean(v && v.trim());

function dateRange(a?: string, b?: string) {
  return [a?.trim(), b?.trim()].filter(Boolean).join(" – ");
}

function websiteLabel(url: string): string {
  return /linkedin\.com/i.test(url) ? "LinkedIn" : "Website";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function EntryHead({ title, org, meta }: { title?: string; org?: string; meta?: string }) {
  return (
    <View style={s.entryHead}>
      <Text style={[s.body, s.entryTitle, { flex: 1 }]}>
        {title}
        {title && org ? ", " : ""}
        {org ? <Text style={s.entryOrg}>{org}</Text> : null}
      </Text>
      {has(meta) ? <Text style={s.entryMeta}>{meta}</Text> : null}
    </View>
  );
}

export function CvPreview({ data }: { data: CVData }) {
  const [containerW, setContainerW] = useState(0);
  const [pageH, setPageH] = useState(PAGE_H);
  const scale = containerW > 0 ? containerW / PAGE_W : 0;

  const order = data.sectionOrder?.length ? data.sectionOrder : DEFAULT_ORDER;

  const contact = [data.email, data.phone, data.location].filter(has).join("  •  ");
  const links = [
    has(data.website) && websiteLabel(data.website),
    has(data.githubUrl) && "GitHub",
    has(data.googleScholarUrl) && "Google Scholar",
    has(data.orcid) && "ORCID",
  ].filter(Boolean) as string[];

  function renderSection(key: SectionKey) {
    switch (key) {
      case "researchInterests":
      case "summary":
        return has(data[key]) ? (
          <Section key={key} title={TITLES[key]}>
            <Text style={s.body}>{data[key]}</Text>
          </Section>
        ) : null;
      case "education":
        return data.education?.some((e) => e.institution || e.degree) ? (
          <Section key={key} title={TITLES[key]}>
            {data.education.filter((e) => e.institution || e.degree).map((e, i) => (
              <View key={i} style={s.entry}>
                <EntryHead
                  title={[e.degree, e.field].filter(has).join(" in ")}
                  meta={dateRange(e.startDate, e.endDate)}
                />
                <View style={s.entryHead}>
                  <Text style={[s.body, s.entryOrg, { flex: 1 }]}>
                    {[e.institution, e.location].filter(has).join(", ")}
                  </Text>
                  {has(e.gpa) ? <Text style={s.entryMeta}>CGPA: {e.gpa}</Text> : null}
                </View>
                {has(e.details) ? <Text style={[s.body, s.entryDesc]}>{e.details}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null;
      case "researchExperience":
      case "workExperience":
      case "teachingExperience": {
        const list = data[key]?.filter((e) => e.role || e.organization || e.description);
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((e, i) => (
              <View key={i} style={s.entry}>
                <EntryHead title={e.role} org={e.organization} meta={dateRange(e.startDate, e.endDate)} />
                {has(e.location) ? <Text style={s.entryLocation}>{e.location}</Text> : null}
                {has(e.description) ? <Text style={[s.body, s.entryDesc]}>{e.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "publications": {
        const list = data.publications?.filter((p) => p.title || p.venue || p.doi);
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((p, i) => (
              <View key={i} style={s.entry}>
                <EntryHead title={p.title} meta={p.date} />
                {has(p.venue) ? <Text style={s.entryLocation}>{p.venue}</Text> : null}
                {has(p.doi) ? <Text style={s.entryLink}>{p.doi}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "projects": {
        const list = data.projects?.filter((p) => p.title || p.description);
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((p, i) => (
              <View key={i} style={s.entry}>
                <EntryHead title={p.title} org={p.organization} meta={dateRange(p.startDate, p.endDate)} />
                {has(p.link) ? <Text style={s.entryLink}>{p.link}</Text> : null}
                {has(p.description) ? <Text style={[s.body, s.entryDesc]}>{p.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "presentations": {
        const list = data.presentations?.filter((x) => has(x.text));
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((x, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.body}>{"•"}</Text>
                <Text style={[s.body, { flex: 1 }]}>{x.text}</Text>
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "awards": {
        const list = data.awards?.filter((a) => has(a.title));
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((a, i) => (
              <View key={i} style={s.entry}>
                <EntryHead title={a.title} org={a.issuer} meta={a.year} />
                {has(a.description) ? <Text style={[s.body, s.entryDesc]}>{a.description}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "skills": {
        const list = data.skills?.filter((x) => has(x.category) || has(x.items));
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            {list.map((x, i) => (
              <View key={i} style={s.skillRow}>
                {has(x.category) ? <Text style={[s.body, s.entryTitle]}>{x.category}:</Text> : null}
                <Text style={[s.body, { flex: 1 }]}>{x.items}</Text>
              </View>
            ))}
          </Section>
        ) : null;
      }
      case "languages": {
        const list = data.languages?.filter((x) => has(x.text));
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            <Text style={s.body}>{list.map((x) => x.text).join("  •  ")}</Text>
          </Section>
        ) : null;
      }
      case "references": {
        const list = data.references?.filter((r) => has(r.name));
        return list?.length ? (
          <Section key={key} title={TITLES[key]}>
            <View style={s.refGrid}>
              {list.map((r, i) => (
                <View key={i} style={s.refItem}>
                  <Text style={[s.refText, s.entryTitle]}>{r.name}</Text>
                  {has(r.affiliation) ? <Text style={s.refText}>{r.affiliation}</Text> : null}
                  {has(r.relation) ? <Text style={s.refText}>{r.relation}</Text> : null}
                  {has(r.email) ? <Text style={[s.refText, { color: ACCENT }]}>{r.email}</Text> : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null;
      }
      default:
        return null;
    }
  }

  return (
    <View
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      style={[
        s.wrapper,
        scale > 0 ? { height: pageH * scale } : { aspectRatio: 210 / 297 },
      ]}
    >
      {scale > 0 ? (
        <View
          onLayout={(e) => setPageH(Math.max(PAGE_H, e.nativeEvent.layout.height))}
          style={[s.page, { transform: [{ scale }], transformOrigin: "top left" }]}
        >
          {/* Header — classic: centered, heavy rule underneath */}
          <View style={s.header}>
            <Text style={s.name}>{data.fullName || "Your Name"}</Text>
            {has(data.headline) ? <Text style={s.headline}>{data.headline}</Text> : null}
            {contact ? <Text style={s.contactLine}>{contact}</Text> : null}
            {links.length ? <Text style={[s.contactLine, { color: ACCENT }]}>{links.join("  •  ")}</Text> : null}
          </View>

          {order.map((key) => renderSection(key))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  page: {
    width: PAGE_W,
    minHeight: PAGE_H,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingVertical: 48,
    paddingHorizontal: 52,
  },
  body: {
    fontFamily: SERIF,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
  },
  // Header
  header: {
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 10,
    marginBottom: 16,
  },
  name: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 25,
    lineHeight: 28,
    letterSpacing: 0.5,
    color: INK,
    textAlign: "center",
    marginBottom: 4,
  },
  headline: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 13.5,
    lineHeight: 18,
    color: MUTED,
    textAlign: "center",
    marginBottom: 6,
  },
  contactLine: {
    fontFamily: SERIF,
    fontSize: 11.5,
    lineHeight: 16,
    color: MUTED,
    textAlign: "center",
    marginTop: 2,
  },
  // Sections
  section: {
    marginBottom: 13,
  },
  sectionTitle: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 12.5,
    letterSpacing: 1,
    color: INK,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 2,
    marginBottom: 6,
  },
  // Entries
  entry: {
    marginBottom: 8,
  },
  entryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  entryTitle: {
    fontWeight: "600",
  },
  entryOrg: {
    fontWeight: "500",
  },
  entryMeta: {
    fontFamily: SERIF,
    fontSize: 11.5,
    lineHeight: 16,
    color: MUTED,
    flexShrink: 0,
  },
  entryLocation: {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: 11.5,
    lineHeight: 16,
    color: MUTED,
  },
  entryDesc: {
    marginTop: 3,
  },
  entryLink: {
    fontFamily: SERIF,
    fontSize: 11.5,
    lineHeight: 16,
    color: ACCENT,
  },
  // Lists
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    paddingLeft: 8,
  },
  skillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  // References (two-column grid)
  refGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  refItem: {
    width: "47%",
  },
  refText: {
    fontFamily: SERIF,
    fontSize: 12,
    lineHeight: 17,
    color: INK,
  },
});
