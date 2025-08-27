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
