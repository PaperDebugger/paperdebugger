export const UnknownEntryMessageContainer = ({ message }: { message: string }) => {
  return (
    <div className="chat-message-entry">
      <div className="indicator">
        <div className="!text-sm !text-red-500 !w-full !bg-red-100 !rounded-md !py-1 !px-2 !mb-4">{message}</div>
      </div>
    </div>
  );
};
