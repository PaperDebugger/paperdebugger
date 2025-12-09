import { Button, Spinner } from "@heroui/react";
import { Modal } from "./modal";
import { useCallback, useEffect, useState } from "react";
import { useSettingStore } from "../stores/setting-store";
import { getUrl } from "../intermediate";
import { Logo } from "./logo";

// Types
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  imagePath?: string;
  content: React.ReactNode;
}

interface OnboardingStepProps {
  step: OnboardingStep;
  imageUrl?: string;
  imageError: boolean;
  onImageClick: () => void;
  onImageError: () => void;
}

interface OnboardingFooterProps {
  currentStep: number;
  totalSteps: number;
  isCompleting: boolean;
  onSkip: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

interface OnboardingHeaderProps {
  title: string;
  description: string;
}

// Constants
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to PaperDebugger",
    description: "We are here to help you write better papers",
    imagePath: "images/onboarding-welcome.png",
    content: <WelcomeContent />,
  },
  {
    id: "select-text",
    title: "Select Text for Analysis",
    description: "Analyze specific sections of your paper",
    imagePath: "images/onboarding-select.png",
    content: <SelectTextContent />,
  },
  {
    id: "complete",
    title: "",
    description: "",
    content: <CompleteContent />,
  },
];

// Step Content Components
function WelcomeContent() {
  return (
    <div className="space-y-2">
      <div>Access PaperDebugger in below two ways.</div>
      <div className="space-y-2">
        <AccessMethodItem
          icon={
            <Logo className="bg-transparent p-0 m-0 flex items-center justify-center w-6 h-6 align-middle text-primary-600" />
          }
          title="Top Left Button"
          description="Click the PaperDebugger icon in the top left of Overleaf."
        />
        <AccessMethodItem
          icon={<span className="text-primary-600 font-bold">⌘ + L</span>}
          title="Keyboard shortcut"
          description={
            <>
              Press <KeyboardShortcut>⌘ + L</KeyboardShortcut> (Mac) or <KeyboardShortcut>Ctrl + L</KeyboardShortcut>{" "}
              (Windows/Linux)
            </>
          }
        />
      </div>
    </div>
  );
}

function SelectTextContent() {
  return (
    <div className="space-y-2">
      <div>To analyze specific text:</div>
      <ol className="list-decimal list-inside space-y-1">
        <li>Select text in your document</li>
        <li>
          Press <KeyboardShortcut>⌘ + L</KeyboardShortcut> or click the PaperDebugger button
        </li>
        <li>Use our default prompt or customize it to your needs</li>
      </ol>
      <div className="text-xs text-gray-600 mt-2 italic">
        Tip: You can select entire sections or just specific paragraphs
      </div>
    </div>
  );
}

function CompleteContent() {
  return (
    <div className="space-y-2">
      <div className="text-center text-lg font-bold">🎉 You are all set!</div>
    </div>
  );
}

// Reusable Components
function AccessMethodItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-[64px] bg-primary-100 py-2 rounded-md">{icon}</div>
      <div>
        <p className="font-medium mb-1">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function KeyboardShortcut({ children }: { children: React.ReactNode }) {
  return <code className="bg-gray-100 px-2 py-1 rounded">{children}</code>;
}

function OnboardingHeader({ title, description }: OnboardingHeaderProps) {
  return (
    <div className="flex flex-col">
      <div>{title}</div>
      <div className="text-sm text-gray-500">{description}</div>
    </div>
  );
}

function OnboardingFooter({
  currentStep,
  totalSteps,
  isCompleting,
  onSkip,
  onPrevious,
  onNext,
}: OnboardingFooterProps) {
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex flex-row items-center w-full">
      <div className="flex flex-row w-1/3">
        <Button size="sm" variant="light" color="default" onPress={onSkip} isDisabled={isCompleting}>
          {isCompleting ? <Spinner size="sm" /> : "Skip"}
        </Button>
      </div>

      <div className="flex flex-row justify-center gap-2 w-1/3">
        {Array.from({ length: totalSteps }, (_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              index === currentStep ? "bg-primary-500" : "bg-gray-300"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-row gap-2 justify-end w-1/3">
        <Button size="sm" variant="light" color="default" onPress={onPrevious} isDisabled={isFirstStep || isCompleting}>
          Previous
        </Button>

        <Button size="sm" color="primary" onPress={onNext} isDisabled={isCompleting}>
          {isCompleting ? <Spinner size="sm" /> : isLastStep ? "Done" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function OnboardingStep({ step, imageUrl, imageError, onImageClick, onImageError }: OnboardingStepProps) {
  const showImage = step.imagePath && imageUrl && !imageError;

  return (
    <div className="flex flex-col gap-4 text-sm transition-all duration-300">
      {showImage && (
        <div className="flex justify-center">
          <img
            src={imageUrl}
            alt={step.title}
            className="w-full max-w-2xl h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity duration-200"
            onClick={onImageClick}
            onError={onImageError}
          />
        </div>
      )}
      <div className="flex-grow">{step.content}</div>
    </div>
  );
}

function ImageModal({
  isOpen,
  onClose,
  imageUrl,
  imageError,
  title,
  onImageError,
}: {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  imageError: boolean;
  title: string;
  onImageError: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} size="full">
      <div className="flex items-center justify-center h-full p-4">
        {imageUrl && !imageError && (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[90vh] w-auto max-w-full object-contain rounded-lg shadow-lg cursor-pointer"
            onClick={onClose}
            onError={onImageError}
          />
        )}
      </div>
    </Modal>
  );
}

// Custom Hooks
function useOnboardingNavigation(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);

  const goToNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const goToPrevious = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
    },
    [totalSteps],
  );

  return {
    currentStep,
    goToNext,
    goToPrevious,
    goToStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
  };
}

function useOnboardingImage(step: OnboardingStep) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (step.imagePath) {
      setImageError(false);
      getUrl(step.imagePath)
        .then(setImageUrl)
        .catch(() => setImageError(true));
    } else {
      setImageUrl(undefined);
      setImageError(false);
    }
  }, [step.imagePath]);

  return { imageUrl, imageError, setImageError };
}

function useOnboardingKeyboardHandlers(
  isOpen: boolean,
  onNext: () => void,
  onPrevious: () => void,
  onComplete: () => void,
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
          onNext();
          break;
        case "ArrowLeft":
          onPrevious();
          break;
        case "Escape":
          onComplete();
          break;
      }
    },
    [onNext, onPrevious, onComplete],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);
}

// Main Component
export const OnboardingGuide = () => {
  const { settings, updateSettings } = useSettingStore();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const navigation = useOnboardingNavigation(ONBOARDING_STEPS.length);
  const currentStepData = ONBOARDING_STEPS[navigation.currentStep];
  const { imageUrl, imageError, setImageError } = useOnboardingImage(currentStepData);

  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await updateSettings({ showedOnboarding: true });
    } finally {
      setIsCompleting(false);
    }
  }, [updateSettings]);

  const handleNext = useCallback(() => {
    if (navigation.isLastStep) {
      handleComplete();
    } else {
      navigation.goToNext();
    }
  }, [navigation, handleComplete]);

  const handlePrevious = useCallback(() => {
    navigation.goToPrevious();
  }, [navigation]);

  const handleImageClick = useCallback(() => {
    setIsImageModalOpen(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, [setImageError]);

  const handleImageModalClose = useCallback(() => {
    setIsImageModalOpen(false);
  }, []);

  useOnboardingKeyboardHandlers(!(settings?.showedOnboarding ?? true), handleNext, handlePrevious, handleComplete);

  const isOpen = !(settings?.showedOnboarding ?? true);

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        className="noselect"
        onOpenChange={(open) => !open && handleComplete()}
        size="xl"
        header={<OnboardingHeader title={currentStepData.title} description={currentStepData.description} />}
        footer={
          <OnboardingFooter
            currentStep={navigation.currentStep}
            totalSteps={ONBOARDING_STEPS.length}
            isCompleting={isCompleting}
            onSkip={handleComplete}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
        }
      >
        <OnboardingStep
          step={currentStepData}
          imageUrl={imageUrl}
          imageError={imageError}
          onImageClick={handleImageClick}
          onImageError={handleImageError}
        />
      </Modal>

      <ImageModal
        isOpen={isImageModalOpen}
        onClose={handleImageModalClose}
        imageUrl={imageUrl}
        imageError={imageError}
        title={currentStepData.title}
        onImageError={handleImageError}
      />
    </>
  );
};
