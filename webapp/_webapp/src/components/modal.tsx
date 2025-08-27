import { Modal as HeroModal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";

import { ModalProps as HeroModalProps } from "@heroui/react";
import { memo, useMemo } from "react";

type ModalProps = {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  content?: React.ReactNode;
  children?: React.ReactNode;
} & Omit<HeroModalProps, "children" | "content">;

const defaultClassNames = {
  backdrop: "bg-gradient-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20 z-[9997]",
  base: "z-[9998]",
  body: "z-[9998]",
  header: "z-[9998]",
  footer: "z-[9998]",
  wrapper: "z-[9998] rnd-cancel noselect",
};

export const Modal = memo(
  ({ children, isOpen, onOpenChange, header, footer, content, size = "md", classNames, ...props }: ModalProps) => {
    const mergedClassNames = useMemo(
      () => ({
        ...defaultClassNames,
        ...classNames,
      }),
      [classNames],
    );

    const modalContent = useMemo(() => {
      if (content) return content;

      return (
        <>
          {header && <ModalHeader className="!py-3">{header}</ModalHeader>}
          <ModalBody>{children}</ModalBody>
          {footer && <ModalFooter className="!py-3">{footer}</ModalFooter>}
        </>
      );
    }, [content, header, children, footer]);

    return (
      <HeroModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="center"
        scrollBehavior="inside"
        size={size}
        classNames={mergedClassNames}
        hideCloseButton
        {...props}
      >
        <ModalContent>{() => modalContent}</ModalContent>
      </HeroModal>
    );
  },
);

Modal.displayName = "Modal";
