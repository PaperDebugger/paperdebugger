import { JsonValue } from "@bufbuild/protobuf";
import { useCallback } from "react";
import { useAdapter } from "../adapters";
import { formatTexSourceComment } from "../components/message-entry-container/tools/paper-score-comment/utils";
import { getCookies } from "../intermediate";
import { generateOverleafDocSHA1, getProjectId } from "../libs/helpers";
import { logWarn } from "../libs/logger";
import { fromJson } from "../libs/protobuf-utils";
import { errorToast, successToast } from "../libs/toasts";
import {
  OverleafComment,
  OverleafCommentSchema,
} from "../pkg/gen/apiclient/project/v1/project_pb";
import { runProjectOverleafComment, runProjectPaperScoreComment } from "../query/api";
import { useConversationStore } from "../stores/conversation/conversation-store";
import { useSocketStore } from "../stores/socket-store";
import { useSync } from "./useSync";

const DIRECT_INSERT_PATTERNS = [
  /\breview\s*&\s*insert\b/i,
  /\b(add|insert|write|put)\b[\s\S]{0,80}\b(comment|comments|annotation|annotations|review)\b[\s\S]{0,80}\b(overleaf|tex|\.tex|paper)\b/i,
  /\b(overleaf|tex|\.tex|paper)\b[\s\S]{0,80}\b(add|insert|write|put)\b[\s\S]{0,80}\b(comment|comments|annotation|annotations|review)\b/i,
  /\bdirect comments?\b[\s\S]{0,80}\b(overleaf|tex|\.tex|paper)\b/i,
  /\buse the paper review comment tool\b/i,
];

type ReviewAndInsertResult = {
  comments: OverleafComment[];
  generatedCount: number;
  insertedCount: number;
  summaryPrompt: string;
};

type ParsedReviewComment = {
  section: string;
  comment: string;
  importance: string;
  anchorHint: string;
};

type ProjectDocSnapshot = {
  id: string;
  path: string;
  version: number;
  lines: string[];
};

type LocatedComment = {
  doc: ProjectDocSnapshot;
  quotePosition: number;
  quoteText: string;
  section: string;
  importance: string;
  comment: string;
};

export class ReviewInsertError extends Error {
  fallbackRecommended: boolean;

  constructor(message: string, fallbackRecommended = false) {
    super(message);
    this.name = "ReviewInsertError";
    this.fallbackRecommended = fallbackRecommended;
  }
}

export function shouldAutoReviewAndInsert(message: string): boolean {
  const trimmed = message.trim();
  return DIRECT_INSERT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function shouldUseAssistantTextFallback(error: unknown): boolean {
  if (error instanceof ReviewInsertError) {
    return error.fallbackRecommended;
  }
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("not implemented");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSectionName(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[^a-z0-9]+/g, " "));
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(
    value
      .toLowerCase()
      .replace(/\\[a-z]+\*?/g, " ")
      .replace(/[{}[\]()%$&#_^~]/g, " ")
      .replace(/\\./g, " ")
      .replace(/\.{3,}/g, " "),
  );
}

function cleanSectionLabel(label: string): string {
  return label
    .replace(/^\s*[-*#\d.)\s]+/, "")
    .replace(/\*\*/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function inferImportance(text: string): string {
  const haystack = text.toLowerCase();
  if (haystack.includes("critical")) return "Critical";
  if (haystack.includes("major") || haystack.includes("severe")) return "High";
  if (haystack.includes("minor") || haystack.includes("small")) return "Low";
  return "Medium";
}

function lastMeaningfulLine(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        line.toLowerCase() !== "latex" &&
        line.toLowerCase() !== "tex" &&
        !line.startsWith("```") &&
        !line.startsWith("%"),
    );
  return lines.at(-1) ?? "";
}

function extractAnchorHintFromHeading(rawHeading: string): string {
  const quoted = rawHeading.match(/"([^"]+)"/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const after = rawHeading.match(/\bafter\s+(.+)$/i);
  if (after?.[1]) {
    return after[1].replace(/[()]/g, "").trim();
  }

  return "";
}

function extractReviewEntriesFromCandidate(candidate: string, defaultAnchorHint: string): ParsedReviewComment[] {
  const results: ParsedReviewComment[] = [];
  const bracketMatches = [...candidate.matchAll(/\[REVIEW:\s*([\s\S]*?)\]/gi)];

  for (const match of bracketMatches) {
    const comment = normalizeWhitespace(match[1] ?? "");
    if (!comment) continue;

    const beforeMatch = candidate.slice(0, match.index ?? 0);
    results.push({
      section: "",
      comment,
      importance: inferImportance(comment),
      anchorHint: lastMeaningfulLine(beforeMatch) || defaultAnchorHint,
    });
  }

  const lineMatches = [...candidate.matchAll(/^\s*%+\s*REVIEW:\s*(.+)$/gim)];
  for (const match of lineMatches) {
    const comment = normalizeWhitespace(match[1] ?? "");
    if (!comment) continue;
    const beforeMatch = candidate.slice(0, match.index ?? 0);
    results.push({
      section: "",
      comment,
      importance: inferImportance(comment),
      anchorHint: lastMeaningfulLine(beforeMatch) || defaultAnchorHint,
    });
  }

  const issueMatches = [...candidate.matchAll(/^\s*Issue:\s*(.+)$/gim)];
  for (const match of issueMatches) {
    const comment = normalizeWhitespace(match[1] ?? "");
    if (!comment) continue;
    results.push({
      section: "",
      comment,
      importance: inferImportance(comment),
      anchorHint: defaultAnchorHint,
    });
  }

  return results;
}

function isCodeFenceLine(line: string): boolean {
  return line.trim().startsWith("```");
}

function isLikelyHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isCodeFenceLine(trimmed)) return false;
  if (/^\s*%+\s*REVIEW:/i.test(trimmed)) return false;
  if (/^\s*Issue:\s*/i.test(trimmed)) return false;
  if (/\[REVIEW:/i.test(trimmed)) return false;
  if (/^[-*]\s+/.test(trimmed) && trimmed.split(":").length <= 1) return false;
  return /:$/.test(trimmed);
}

function inferSectionAndAnchorFromHeading(rawHeading: string): { section: string; anchorHint: string } {
  const section = cleanSectionLabel(rawHeading);
  const anchorHint = extractAnchorHintFromHeading(rawHeading);
  return { section, anchorHint };
}

function parseInlineReviewComments(text: string): ParsedReviewComment[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const results: ParsedReviewComment[] = [];
  let currentSection = "";
  let currentAnchorHint = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (isLikelyHeadingLine(line)) {
      const inferred = inferSectionAndAnchorFromHeading(line.replace(/^[-*]\s*/, ""));
      currentSection = inferred.section || currentSection;
      currentAnchorHint = inferred.anchorHint || currentAnchorHint;
      continue;
    }

    const reviewMatch = line.match(/(?:^|.*)\[REVIEW:\s*([\s\S]*?)\]/i);
    if (reviewMatch?.[1]) {
      results.push({
        section: currentSection,
        comment: normalizeWhitespace(reviewMatch[1]),
        importance: inferImportance(reviewMatch[1]),
        anchorHint: currentAnchorHint,
      });
      continue;
    }

    const percentReviewMatch = line.match(/^%+\s*REVIEW:\s*(.+)$/i);
    if (percentReviewMatch?.[1]) {
      const previousLine = i > 0 ? lines[i - 1].trim() : "";
      results.push({
        section: currentSection,
        comment: normalizeWhitespace(percentReviewMatch[1]),
        importance: inferImportance(percentReviewMatch[1]),
        anchorHint: previousLine && !isCodeFenceLine(previousLine) ? previousLine : currentAnchorHint,
      });
      continue;
    }

    const plainSectionMatch = line.match(
      /^(?:[-*]\s*)?(Title|Abstract|Introduction|Conclusion|Discussion|Methods?|Results?|Related Work|Experiments?|Evaluation|Background|Significance|Limitations?)\b([^:]{0,120})?:\s*(.+)$/i,
    );
    if (plainSectionMatch?.[1] && plainSectionMatch?.[3]) {
      const headingText = `${plainSectionMatch[1]}${plainSectionMatch[2] ?? ""}:`;
      const inferred = inferSectionAndAnchorFromHeading(headingText);
      results.push({
        section: inferred.section,
        comment: normalizeWhitespace(plainSectionMatch[3]),
        importance: inferImportance(plainSectionMatch[3]),
        anchorHint: inferred.anchorHint,
      });
      currentSection = inferred.section || currentSection;
      currentAnchorHint = inferred.anchorHint || currentAnchorHint;
      continue;
    }

    const issueMatch = line.match(/^Issue:\s*(.+)$/i);
    if (issueMatch?.[1]) {
      results.push({
        section: currentSection,
        comment: normalizeWhitespace(issueMatch[1]),
        importance: inferImportance(issueMatch[1]),
        anchorHint: currentAnchorHint,
      });
    }
  }

  return results;
}

function inferSectionFromNarrativeHeading(heading: string): string {
  const cleanedHeading = cleanSectionLabel(heading);
  const match = cleanedHeading.match(/\b(?:in|for)\s+(.+)$/i);
  return (match?.[1] ?? cleanedHeading).trim();
}

function parseNarrativeReviewBlocks(text: string): ParsedReviewComment[] {
  const blocks = text
    .split(/(?=^\s*\d+\.\s+)/gm)
    .map((block) => block.trim())
    .filter(Boolean);

  const results: ParsedReviewComment[] = [];

  for (const block of blocks) {
    const headingMatch = block.match(/^\s*\d+\.\s+(.+)$/m);
    const heading = headingMatch?.[1]?.trim();
    if (!heading) continue;

    const problem = block.match(/^\s*Problem:\s*([\s\S]*?)(?=^\s*(?:Suggestion|Actionable fix|Proposed rewrite|Excerpt|Rationale|Source):|\Z)/im)?.[1];
    const suggestion = block.match(
      /^\s*(?:Suggestion|Actionable fix|Proposed rewrite):\s*([\s\S]*?)(?=^\s*(?:Excerpt|Rationale|Source):|\Z)/im,
    )?.[1];
    const excerpt = block.match(/^\s*Excerpt:\s*([\s\S]*?)(?=^\s*(?:Rationale|Source):|\Z)/im)?.[1];

    const comment = normalizeWhitespace(suggestion ?? problem ?? "");
    if (!comment) continue;

    results.push({
      section: inferSectionFromNarrativeHeading(heading),
      comment,
      importance: inferImportance(`${heading} ${problem ?? ""}`),
      anchorHint: normalizeWhitespace((excerpt ?? "").replace(/^["'`]+|["'`]+$/g, "")),
    });
  }

  return results;
}

function parseAssistantReviewComments(text: string): ParsedReviewComment[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const headingRegex = /^(?:[-*]\s*)?(?:\*\*)?([A-Z][^:\n]{0,160})(?:\*\*)?:\s*$/gm;
  const matches = [...normalized.matchAll(headingRegex)];
  const parsed: ParsedReviewComment[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const rawHeading = (match[1] ?? "").trim();
    const section = cleanSectionLabel(rawHeading);
    if (!section) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? normalized.length;
    const block = normalized.slice(start, end).trim();
    const defaultAnchorHint = extractAnchorHintFromHeading(rawHeading);

    const codeBlocks = [...block.matchAll(/```(?:latex|tex)?\s*([\s\S]*?)```/gi)].map((blockMatch) => blockMatch[1] ?? "");
    const candidates = codeBlocks.length > 0 ? codeBlocks : [block];

    for (const candidate of candidates) {
      const extracted = extractReviewEntriesFromCandidate(candidate, defaultAnchorHint);
      for (const entry of extracted) {
        parsed.push({
          ...entry,
          section,
          importance: entry.importance || inferImportance(rawHeading + " " + entry.comment),
          anchorHint: entry.anchorHint || defaultAnchorHint,
        });
      }
    }
  }

  for (const entry of parseInlineReviewComments(normalized)) {
    parsed.push(entry);
  }

  for (const entry of parseNarrativeReviewBlocks(normalized)) {
    parsed.push(entry);
  }

  const deduped = new Map<string, ParsedReviewComment>();
  for (const entry of parsed) {
    const normalizedComment = normalizeWhitespace(entry.comment);
    if (!normalizedComment) continue;

    const normalizedSection = normalizeSectionName(entry.section);
    const normalizedAnchor = normalizeForMatch(entry.anchorHint);
    const fallbackSection = normalizedAnchor.includes("title")
      ? "title"
      : normalizedAnchor.includes("abstract")
        ? "abstract"
        : normalizedSection;

    const finalizedSection = fallbackSection || "main";
    const finalizedAnchor = normalizeWhitespace(entry.anchorHint);
    const key = `${finalizedSection}::${normalizedComment}`;
    if (!deduped.has(key)) {
      deduped.set(key, {
        ...entry,
        section: entry.section || finalizedSection,
        anchorHint: finalizedAnchor,
        comment: normalizedComment,
      });
    }
  }

  return Array.from(deduped.values());
}

function getLineStartOffset(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1;
  }
  return offset;
}

function findDocLineByMatcher(
  doc: ProjectDocSnapshot,
  matcher: (line: string) => boolean,
): { quotePosition: number; quoteText: string } | null {
  for (let i = 0; i < doc.lines.length; i++) {
    if (!matcher(doc.lines[i])) continue;
    return {
      quotePosition: getLineStartOffset(doc.lines, i),
      quoteText: doc.lines[i],
    };
  }
  return null;
}

function getRootDoc(docs: ProjectDocSnapshot[], rootDocId: string): ProjectDocSnapshot | null {
  if (rootDocId) {
    const byId = docs.find((doc) => doc.id === rootDocId);
    if (byId) return byId;
  }
  const mainTex = docs.find((doc) => doc.path.endsWith("main.tex"));
  if (mainTex) return mainTex;
  const texDoc = docs.find((doc) => doc.path.endsWith(".tex"));
  return texDoc ?? docs[0] ?? null;
}

function locateByAnchorHint(
  docs: ProjectDocSnapshot[],
  anchorHint: string,
): { doc: ProjectDocSnapshot; quotePosition: number; quoteText: string } | null {
  const normalizedHint = normalizeForMatch(anchorHint);
  if (!normalizedHint) return null;

  for (const doc of docs) {
    for (let i = 0; i < doc.lines.length; i++) {
      const normalizedLine = normalizeForMatch(doc.lines[i]);
      if (!normalizedLine) continue;
      if (normalizedLine.includes(normalizedHint) || normalizedHint.includes(normalizedLine)) {
        return {
          doc,
          quotePosition: getLineStartOffset(doc.lines, i),
          quoteText: doc.lines[i],
        };
      }
    }
  }

  return null;
}

function locateBySection(
  docs: ProjectDocSnapshot[],
  rootDocId: string,
  section: string,
): { doc: ProjectDocSnapshot; quotePosition: number; quoteText: string } | null {
  const normalizedSection = normalizeSectionName(section);
  const rootDoc = getRootDoc(docs, rootDocId);

  if (!normalizedSection) return null;

  if (normalizedSection === "title" && rootDoc) {
    const located = findDocLineByMatcher(rootDoc, (line) => line.includes("\\title{"));
    if (located) return { doc: rootDoc, ...located };
  }

  if (normalizedSection === "abstract" && rootDoc) {
    const located = findDocLineByMatcher(
      rootDoc,
      (line) => line.includes("\\begin{abstract}") || line.includes("\\abstract{"),
    );
    if (located) return { doc: rootDoc, ...located };
  }

  for (const doc of docs) {
    const located = findDocLineByMatcher(doc, (line) => {
      const match = line.match(/\\(?:part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{([^}]*)\}/);
      if (!match?.[1]) return false;
      const normalizedHeader = normalizeSectionName(match[1]);
      return (
        normalizedHeader === normalizedSection ||
        normalizedHeader.includes(normalizedSection) ||
        normalizedSection.includes(normalizedHeader)
      );
    });
    if (located) return { doc, ...located };
  }

  if (rootDoc) {
    const documentStart = findDocLineByMatcher(rootDoc, (line) => line.includes("\\begin{document}"));
    if (documentStart) return { doc: rootDoc, ...documentStart };
  }

  return null;
}

function buildLocalOverleafComment(
  projectId: string,
  located: LocatedComment,
): OverleafComment {
  const docContent = located.doc.lines.join("\n");
  return fromJson(
    OverleafCommentSchema,
    {
      commentId: "",
      projectId,
      docId: located.doc.id,
      docVersion: located.doc.version,
      docSha1: generateOverleafDocSHA1(docContent),
      quotePosition: located.quotePosition,
      quoteText: located.quoteText,
      comment: located.comment,
      importance: located.importance,
      docPath: located.doc.path,
      section: located.section,
    } as JsonValue,
  );
}

function summarizeInsertedComment(comment: OverleafComment): string {
  const issueLine =
    comment.comment
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("Issue:")) ?? normalizeWhitespace(comment.comment);

  const issue = issueLine.replace(/^Issue:\s*/i, "").trim();
  const location = comment.section || comment.docPath || "paper";
  const importance = comment.importance || "Review";

  return `[${importance}] ${location}: ${issue}`;
}

function buildInsertedCommentsPrompt(originalPrompt: string, comments: OverleafComment[]): string {
  const summaryLines = comments.slice(0, 8).map((comment) => `- ${summarizeInsertedComment(comment)}`);
  if (comments.length > summaryLines.length) {
    summaryLines.push(`- Plus ${comments.length - summaryLines.length} more inserted comment(s).`);
  }

  return `${originalPrompt}

PaperDebugger note: The review comments have already been inserted directly into the Overleaf TeX source. Do not say the insert tool is unavailable and do not ask the user to paste comments manually. Summarize the inserted comments below, prioritize the highest-impact fixes, and mention that the comments are already in the paper.

Inserted comments:
${summaryLines.join("\n")}`;
}

function getLatestAssistantContent(): string {
  const latestConversation = useConversationStore.getState().currentConversation;
  const latestAssistantMessage = [...latestConversation.messages]
    .reverse()
    .find((message) => message.payload?.messageType.case === "assistant" && message.payload.messageType.value.content.trim());

  if (latestAssistantMessage?.payload?.messageType.case !== "assistant") {
    return "";
  }

  return latestAssistantMessage.payload.messageType.value.content;
}

async function waitForLatestAssistantContent(timeoutMs = 3000, pollMs = 100): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let latestContent = getLatestAssistantContent();

  while (!latestContent && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    latestContent = getLatestAssistantContent();
  }

  return latestContent;
}

async function insertAnchoredCommentsIntoCurrentProject(
  projectId: string,
  comments: OverleafComment[],
  connectSocket: ReturnType<typeof useSocketStore.getState>["connectSocket"],
  disconnectSocket: ReturnType<typeof useSocketStore.getState>["disconnectSocket"],
  addTexComments: ReturnType<typeof useSocketStore.getState>["addTexComments"],
) {
  const csrfToken = document.querySelector('meta[name="ol-csrfToken"]')?.getAttribute("content") || "";
  if (!csrfToken) {
    throw new ReviewInsertError("Overleaf CSRF token not found.");
  }

  const { session, gclb } = await getCookies(window.location.hostname);
  if (!session) {
    throw new ReviewInsertError("Overleaf session cookie not found.");
  }

  await connectSocket(
    projectId,
    {
      cookieOverleafSession2: session,
      cookieGCLB: gclb,
    },
    csrfToken,
  );

  try {
    await addTexComments(
      comments.map((comment) => ({
        ...comment,
        comment: formatTexSourceComment(comment.importance, comment.section, comment.comment),
      })),
    );
  } finally {
    disconnectSocket();
  }
}

export function useReviewAndInsert() {
  const adapter = useAdapter();
  const { sync } = useSync();
  const currentConversation = useConversationStore((s) => s.currentConversation);
  const { connectSocket, disconnectSocket, createSnapshot, addTexComments } = useSocketStore();

  const insertLocally = useCallback(
    async (originalPrompt: string, parsedComments: ParsedReviewComment[]): Promise<ReviewAndInsertResult> => {
      if (adapter.platform !== "overleaf") {
        throw new ReviewInsertError("Direct TeX comment insertion is only available in Overleaf.");
      }

      const projectId = adapter.getDocumentId?.() || getProjectId();
      if (!projectId) {
        throw new ReviewInsertError("Overleaf project id not found.");
      }

      if (parsedComments.length === 0) {
        throw new ReviewInsertError("I could not parse any structured review comments from the assistant response.");
      }

      try {
        const csrfToken = document.querySelector('meta[name="ol-csrfToken"]')?.getAttribute("content") || "";
        if (!csrfToken) {
          throw new ReviewInsertError("Overleaf CSRF token not found.");
        }

        const { session, gclb } = await getCookies(window.location.hostname);
        if (!session) {
          throw new ReviewInsertError("Overleaf session cookie not found.");
        }

        await connectSocket(
          projectId,
          {
            cookieOverleafSession2: session,
            cookieGCLB: gclb,
          },
          csrfToken,
        );

        const snapshot = await createSnapshot();
        const rootDocId = useSocketStore.getState().rootDocId;
        const docs: ProjectDocSnapshot[] = Array.from(snapshot.entries()).map(([id, doc]) => ({
          id,
          path: doc.path,
          version: doc.version,
          lines: doc.lines,
        }));

        const locatedComments: LocatedComment[] = [];
        const skippedComments: ParsedReviewComment[] = [];

        for (const parsedComment of parsedComments) {
          const locatedByAnchor = parsedComment.anchorHint ? locateByAnchorHint(docs, parsedComment.anchorHint) : null;
          const locatedBySection = locateBySection(docs, rootDocId, parsedComment.section);
          const located = locatedByAnchor ?? locatedBySection;

          if (!located) {
            skippedComments.push(parsedComment);
            continue;
          }

          locatedComments.push({
            doc: located.doc,
            quotePosition: located.quotePosition,
            quoteText: located.quoteText,
            section: parsedComment.section,
            importance: parsedComment.importance,
            comment: parsedComment.comment,
          });
        }

        if (locatedComments.length === 0) {
          throw new ReviewInsertError(
            "Review comments were generated, but I could not match them to sections in the current TeX source.",
          );
        }

        const overleafComments = locatedComments.map((located) => buildLocalOverleafComment(projectId, located));

        await addTexComments(
          overleafComments.map((comment) => ({
            ...comment,
            comment: formatTexSourceComment(comment.importance, comment.section, comment.comment),
          })),
        );

        const uniqueSections = Array.from(new Set(overleafComments.map((comment) => comment.section).filter(Boolean)));
        const detail =
          uniqueSections.length > 0
            ? `${uniqueSections.slice(0, 3).join(", ")}${uniqueSections.length > 3 ? ` +${uniqueSections.length - 3} more` : ""}`
            : "the current paper";

        successToast(
          skippedComments.length > 0
            ? `Inserted ${overleafComments.length} TeX review comment(s) into ${detail}. ${skippedComments.length} item(s) could not be matched automatically.`
            : `Inserted ${overleafComments.length} TeX review comment(s) into ${detail}.`,
          "Review Comments Inserted",
        );

        return {
          comments: overleafComments,
          generatedCount: parsedComments.length,
          insertedCount: overleafComments.length,
          summaryPrompt: buildInsertedCommentsPrompt(originalPrompt, overleafComments),
        };
      } finally {
        disconnectSocket();
      }
    },
    [adapter, connectSocket, createSnapshot, addTexComments, disconnectSocket],
  );

  const reviewAndInsert = useCallback(
    async (originalPrompt: string): Promise<ReviewAndInsertResult> => {
      if (adapter.platform !== "overleaf") {
        throw new ReviewInsertError("Direct TeX comment insertion is only available in Overleaf.");
      }

      const projectId = adapter.getDocumentId?.() || getProjectId();
      if (!projectId) {
        throw new ReviewInsertError("Overleaf project id not found.");
      }

      try {
        const fetchAnchoredComments = async (): Promise<OverleafComment[]> => {
          const reviewResponse = await runProjectPaperScoreComment({
            projectId,
            conversationId: currentConversation.id,
          });

          const generatedEntries = reviewResponse.comments.flatMap((result) => result.results);
          if (generatedEntries.length === 0) {
            throw new ReviewInsertError("No review comments were generated for this paper.");
          }

          const anchoredComments: OverleafComment[] = [];
          for (const entry of generatedEntries) {
            const overleafResponse = await runProjectOverleafComment({
              projectId,
              section: entry.section,
              anchorText: entry.anchorText,
              comment: entry.weakness,
              importance: entry.importance,
            });
            anchoredComments.push(...overleafResponse.comments);
          }

          if (anchoredComments.length === 0) {
            throw new ReviewInsertError(
              "Review comments were generated, but none could be anchored into the current TeX source.",
            );
          }

          return anchoredComments;
        };

        let anchoredComments: OverleafComment[];

        try {
          anchoredComments = await fetchAnchoredComments();
        } catch (error) {
          if (shouldUseAssistantTextFallback(error)) {
            throw error;
          }

          const syncResult = await sync();
          if (!syncResult.success) {
            throw new ReviewInsertError(syncResult.error?.message ?? "Failed to sync the Overleaf project.");
          }

          anchoredComments = await fetchAnchoredComments();
        }

        await insertAnchoredCommentsIntoCurrentProject(
          projectId,
          anchoredComments,
          connectSocket,
          disconnectSocket,
          addTexComments,
        );

        const uniqueSections = Array.from(new Set(anchoredComments.map((comment) => comment.section).filter(Boolean)));
        const detail =
          uniqueSections.length > 0
            ? `${uniqueSections.slice(0, 3).join(", ")}${uniqueSections.length > 3 ? ` +${uniqueSections.length - 3} more` : ""}`
            : "the current paper";

        successToast(`Inserted ${anchoredComments.length} TeX review comment(s) into ${detail}.`, "Review Comments Inserted");

        return {
          comments: anchoredComments,
          generatedCount: anchoredComments.length,
          insertedCount: anchoredComments.length,
          summaryPrompt: buildInsertedCommentsPrompt(originalPrompt, anchoredComments),
        };
      } catch (error) {
        const message = getErrorMessage(error);
        if (shouldUseAssistantTextFallback(error)) {
          throw new ReviewInsertError(message, true);
        }
        throw new ReviewInsertError(message);
      }
    },
    [adapter, currentConversation.id, addTexComments, connectSocket, disconnectSocket, sync],
  );

  const insertCommentsFromLatestAssistantResponse = useCallback(
    async (originalPrompt: string): Promise<ReviewAndInsertResult> => {
      const latestAssistantContent = await waitForLatestAssistantContent();
      if (!latestAssistantContent) {
        throw new ReviewInsertError("The review response finished, but no assistant text was available to convert into TeX comments.");
      }

      const parsedComments = parseAssistantReviewComments(latestAssistantContent);
      if (parsedComments.length === 0) {
        logWarn("Could not parse review comments from assistant response", latestAssistantContent);
      }
      return insertLocally(originalPrompt, parsedComments);
    },
    [insertLocally],
  );

  const insertCommentsFromLatestAssistantResponseWithToast = useCallback(
    async (originalPrompt: string): Promise<ReviewAndInsertResult> => {
      try {
        return await insertCommentsFromLatestAssistantResponse(originalPrompt);
      } catch (error) {
        const message = getErrorMessage(error);
        errorToast(message, "Review & Insert Failed");
        throw error;
      }
    },
    [insertCommentsFromLatestAssistantResponse],
  );

  return {
    reviewAndInsert,
    insertCommentsFromLatestAssistantResponse: insertCommentsFromLatestAssistantResponseWithToast,
  };
}
