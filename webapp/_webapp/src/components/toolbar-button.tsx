import googleAnalytics from "../libs/google-analytics";
import { useAuthStore } from "../stores/auth-store";

type ToolbarButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
};

export const ToolbarButton = ({ children, onClick }: ToolbarButtonProps) => {
  const { user } = useAuthStore();
  return (
    <button
      className={`review-tooltip-menu-button`}
      onClick={() => {
        googleAnalytics.fireEvent(user?.id, "toolbar_click", {});
        onClick?.();
      }}
    >
      {children}
    </button>
  );
};
