import React from "react";
import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  RenderedItem,
  RenderedResume,
  RenderedSection,
  ResumeHeaderData,
} from "@/models/resume.model";
import { formatDateRange } from "./dates";

// One column, standard fonts, real text, no tables or icons: the layout ATS
// parsers read most reliably. A4, since the user applies in Singapore.

// Hyphenating names and tech terms ("Post-greSQL") reads badly on a resume.
Font.registerHyphenationCallback((word) => [word]);

const INK = "#111111";
const MUTED = "#444444";

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 38,
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.3,
    color: INK,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  contact: {
    marginTop: 3,
    fontSize: 9.5,
    textAlign: "center",
    color: MUTED,
  },
  link: { color: MUTED, textDecoration: "none" },
  section: { marginTop: 9 },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rule: { borderBottomWidth: 0.75, borderBottomColor: INK, marginTop: 1.5, marginBottom: 4 },
  item: { marginBottom: 5 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  org: { fontFamily: "Helvetica-Bold", flexShrink: 1, paddingRight: 8 },
  role: { fontFamily: "Helvetica-Oblique", flexShrink: 1, paddingRight: 8 },
  right: { textAlign: "right", flexShrink: 0 },
  details: { marginTop: 1 },
  bulletRow: { flexDirection: "row", marginTop: 1.5, paddingLeft: 4 },
  bulletDot: { width: 9 },
  bulletText: { flex: 1 },
  skillLine: { marginBottom: 2 },
  skillLabel: { fontFamily: "Helvetica-Bold" },
  letterBody: { marginTop: 18, fontSize: 10.5, lineHeight: 1.45 },
  paragraph: { marginBottom: 9 },
});

function contactParts(header: ResumeHeaderData) {
  const parts: React.ReactNode[] = [];
  if (header.location) parts.push(header.location);
  if (header.email) parts.push(header.email);
  if (header.phone) parts.push(header.phone);
  for (const link of header.links) {
    const href = /^https?:\/\//.test(link.url) ? link.url : `https://${link.url}`;
    parts.push(
      <Link key={link.url} src={href} style={styles.link}>
        {link.url.replace(/^https?:\/\//, "")}
      </Link>,
    );
  }
  return parts;
}

function Header({ header }: { header: ResumeHeaderData }) {
  const parts = contactParts(header);
  return (
    <View>
      <Text style={styles.name}>{header.fullName || "Your Name"}</Text>
      {parts.length > 0 && (
        <Text style={styles.contact}>
          {parts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 ? "  •  " : ""}
              {part}
            </React.Fragment>
          ))}
        </Text>
      )}
    </View>
  );
}

function Bullets({ item }: { item: RenderedItem }) {
  return (
    <>
      {item.bullets.map((b) => (
        <View key={b.id} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{b.text}</Text>
        </View>
      ))}
    </>
  );
}

function Entry({ item }: { item: RenderedItem }) {
  const dates = formatDateRange(item.startDate, item.endDate);
  return (
    <View style={styles.item}>
      {/* The heading lines stay with the first bullet, never alone at a page foot */}
      <View wrap={false}>
        <View style={styles.row}>
          <Text style={styles.org}>{item.organisation}</Text>
          {item.location ? <Text style={styles.right}>{item.location}</Text> : null}
        </View>
        {(item.title || dates) && (
          <View style={styles.row}>
            <Text style={styles.role}>{item.title ?? ""}</Text>
            {dates ? <Text style={styles.right}>{dates}</Text> : null}
          </View>
        )}
      </View>
      {item.details
        ? item.details
            .split("\n")
            .filter((line) => line.trim())
            .map((line, i) => (
              <Text key={i} style={styles.details}>
                {line}
              </Text>
            ))
        : null}
      <Bullets item={item} />
    </View>
  );
}

function SkillLine({ item }: { item: RenderedItem }) {
  return (
    <Text style={styles.skillLine}>
      <Text style={styles.skillLabel}>{item.organisation}: </Text>
      {item.details ?? item.bullets.map((b) => b.text).join(", ")}
    </Text>
  );
}

function Section({ section }: { section: RenderedSection }) {
  return (
    <View style={styles.section}>
      <View wrap={false}>
        <Text style={styles.sectionTitle}>{section.heading}</Text>
        <View style={styles.rule} />
      </View>
      {section.items.map((item) =>
        section.key === "skills" ? (
          <SkillLine key={item.id} item={item} />
        ) : (
          <Entry key={item.id} item={item} />
        ),
      )}
    </View>
  );
}

export function ResumePdfDocument({
  resume,
  title,
}: {
  resume: RenderedResume;
  title: string;
}) {
  return (
    <Document title={title} author={resume.header.fullName} creator="JobSync">
      <Page size="A4" style={styles.page} wrap>
        <Header header={resume.header} />
        {resume.sections.map((section) => (
          <Section key={section.key} section={section} />
        ))}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(
  resume: RenderedResume,
  title: string,
): Promise<Buffer> {
  return renderToBuffer(<ResumePdfDocument resume={resume} title={title} />);
}

// Letters are plain text with blank lines between paragraphs; **bold** is the
// only markup honoured, since anything richer would not survive an ATS.
function Paragraph({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={styles.paragraph}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <Text key={i} style={styles.skillLabel}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </Text>
  );
}

export function CoverLetterPdfDocument({
  header,
  content,
  title,
}: {
  header: ResumeHeaderData;
  content: string;
  title: string;
}) {
  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  return (
    <Document title={title} author={header.fullName} creator="JobSync">
      <Page size="A4" style={{ ...styles.page, paddingTop: 44, paddingHorizontal: 54 }}>
        <Header header={header} />
        <View style={styles.letterBody}>
          {paragraphs.map((p, i) => (
            <Paragraph key={i} text={p} />
          ))}
        </View>
      </Page>
    </Document>
  );
}

export async function renderCoverLetterPdf(
  header: ResumeHeaderData,
  content: string,
  title: string,
): Promise<Buffer> {
  return renderToBuffer(
    <CoverLetterPdfDocument header={header} content={content} title={title} />,
  );
}
