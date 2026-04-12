export const getImportanceColor = (importance: string) => {
  switch (importance) {
    case "Critical":
      return "!bg-red-100 !text-red-800 !border-red-200";
    case "High":
      return "!bg-orange-100 !text-orange-800 !border-orange-200";
    case "Medium":
      return "!bg-yellow-100 !text-yellow-800 !border-yellow-200";
    default:
      return "!bg-gray-100 !text-gray-800 !border-gray-200";
  }
};

export const getImportanceIcon = (importance: string) => {
  switch (importance) {
    case "Critical":
      return "tabler:alert-triangle";
    case "High":
      return "tabler:alert-circle";
    case "Medium":
      return "tabler:info-circle";
    default:
      return "tabler:info-circle";
  }
};

export const cleanCommentText = (comment: string) => {
  return comment.replace("👨🏻‍💻 Medium:", "").replace("👨🏻‍💻 High:", "").replace("👨🏻‍💻 Critical:", "").replace("👨🏻‍💻 Low:", "");
};

const wrapCommentLine = (line: string) => {
  const trimmed = line.trim();
  return trimmed.length > 0 ? `% ${trimmed}` : "%";
};

export const formatTexSourceComment = (importance: string, section: string, comment: string) => {
  const cleanedComment = cleanCommentText(comment).trim();
  const header = importance ? `PaperDebugger ${importance} review comment` : "PaperDebugger review comment";
  const sectionLine = section ? `Section: ${section}` : "";

  const lines = [header, sectionLine, cleanedComment]
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => line.split("\n"))
    .map(wrapCommentLine);

  return `\n${lines.join("\n")}\n`;
};
