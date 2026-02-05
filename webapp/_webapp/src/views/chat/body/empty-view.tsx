import { Logo } from "../../../components/logo";

export const EmptyView = () => (
  <div className="pd-app-tab-content-body noselect" id="pd-chat-item-container-empty">
    <div className="bg-gray-50 dark:bg-default-50! w-full h-full flex flex-col items-center justify-center text-default-300 dark:text-default-50">
      <Logo className="bg-gray-100 dark:bg-default-200! rounded-full flex justify-center items-center" />
      <p className="text-2xl font-semibold text-gray-300 dark:text-default-300">Ask or Edit</p>
      <div className="block w-full"></div>
      <p className="text-sm text-center max-w-[400px] text-gray-300 dark:text-default-300">
        Start your conversation with PaperDebugger.
      </p>
      <p className="text-sm text-center max-w-[400px] text-gray-300 dark:text-default-300">
        Be careful of the generated content, PaperDebugger will never modify your content without your permission.
      </p>
      <a
        href="https://github.com/PaperDebugger/paperdebugger/issues/new?template=bug_report.md"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 text-sm text-default-300 dark:text-default-300 hover:text-default-400 dark:hover:text-default-400 underline"
      >
        Report Bug
      </a>
    </div>
  </div>
);
