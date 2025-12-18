import { Logo } from "../../../components/logo";

export const EmptyView = () => (
  <div className="pd-app-tab-content-body noselect" id="pd-chat-item-container-empty">
    <div className="bg-gray-50 w-full h-full flex flex-col items-center justify-center text-default-400 dark:text-default-50">
      <Logo className="bg-gray-100 rounded-full flex justify-center items-center" />
      <p className="text-2xl font-semibold">Ask or Edit</p>
      <div className="block w-full"></div>
      <p className="text-sm text-center max-w-[400px]">
        Start your conversation with PaperDebugger.
      </p>
      <p className="text-sm text-center max-w-[400px]">
        Be careful of the generated content, PaperDebugger will never modify your content without your permission.
      </p>
    </div>
  </div>
);
