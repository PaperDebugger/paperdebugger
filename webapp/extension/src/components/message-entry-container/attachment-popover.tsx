import { Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { STYLES } from "../message-card";

// Components
export const AttachmentPopover = ({ attachment }: { attachment: string }) => (
  <Popover placement="bottom" showArrow={true} className="!mt-1">
    <PopoverTrigger className="bg-gray-200 !rounded-xl !flex !w-fit noselect">
      <span className="!text-xs !text-gray-400 border border-gray-300 !rounded-lg !px-1">attachment</span>
    </PopoverTrigger>
    <PopoverContent className={STYLES.attachment.content}>
      <div className="!px-1 !py-2" style={{ overflowWrap: "anywhere" }}>
        <div className={STYLES.attachment.text}>{attachment}</div>
      </div>
    </PopoverContent>
  </Popover>
);
