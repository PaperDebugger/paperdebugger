import { useDisclosure } from "@heroui/react";
import googleAnalytics, { normalizeName } from "../libs/google-analytics";
import { useAuthStore } from "../stores/auth-store";

interface UseTrackableDisclosureProps {
  name: string;
}

export function useTrackableDisclosure({ name }: UseTrackableDisclosureProps) {
  const { user } = useAuthStore();
  const disclosure = useDisclosure();

  const onOpen = () => {
    disclosure.onOpen();
    googleAnalytics.fireEvent(user?.id, `disclosure_open_${normalizeName(name)}`, {});
  };

  const onClose = () => {
    disclosure.onClose();
    googleAnalytics.fireEvent(user?.id, `disclosure_close_${normalizeName(name)}`, {});
  };

  return {
    ...disclosure,
    onOpen,
    onClose,
  };
}
