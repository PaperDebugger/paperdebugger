import { useReducer, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

type Phase = "green" | "orange" | "red";

interface LoadingIndicatorProps {
  text?: string;
  estimatedSeconds?: number;
  errorMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_STYLES = {
  green: {
    background: "linear-gradient(90deg, #35aa6b 0%, #7cc89f 100%)",
  },
  orange: {
    background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)",
  },
  red: {
    background: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
  },
} as const;

// ============================================================================
// Component
// ============================================================================

type IndicatorState = {
  progress: number;
  phase: Phase;
  isTimeout: boolean;
};

type IndicatorAction =
  | { type: "SET_PROGRESS"; progress: number }
  | { type: "ADVANCE_PHASE"; nextPhase: Phase }
  | { type: "SET_TIMEOUT" };

function indicatorReducer(state: IndicatorState, action: IndicatorAction): IndicatorState {
  switch (action.type) {
    case "SET_PROGRESS":
      return { ...state, progress: action.progress };
    case "ADVANCE_PHASE":
      return { ...state, phase: action.nextPhase, progress: 0 };
    case "SET_TIMEOUT":
      return { ...state, isTimeout: true };
    default:
      return state;
  }
}

export const LoadingIndicator = ({ text = "Thinking", estimatedSeconds = 0, errorMessage }: LoadingIndicatorProps) => {
  // State
  const [{ progress, phase, isTimeout }, dispatch] = useReducer(indicatorReducer, {
    progress: 0,
    phase: "green",
    isTimeout: false,
  });

  // Handle progress animation
  useEffect(() => {
    if (estimatedSeconds <= 0) return;

    let animationFrameId: number;
    let lastUpdateTime = Date.now();
    let currentProgress = 0;

    // If we want it to go faster, we multiply the increment.
    // 1x = standard duration. 2x = half duration.
    const getSpeedMultiplier = (currentPhase: Phase) => {
      switch (currentPhase) {
        case "green":
          return 1; // Takes full duration
        case "orange":
          return 2; // Takes half duration (50%)
        case "red":
          return 2; // Takes half duration (50%)
        default:
          return 1;
      }
    };

    const updateProgress = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateTime;

      // Add random delay to make animation more natural
      if (deltaTime < Math.random() * 300) {
        animationFrameId = requestAnimationFrame(updateProgress);
        return;
      }

      lastUpdateTime = now;

      // Calculate progress with natural fluctuation
      const speedMultiplier = getSpeedMultiplier(phase);
      // the math
      const baseIncrement = (deltaTime / (estimatedSeconds * 1000)) * 100 * speedMultiplier;
      const fluctuation = baseIncrement * (Math.random() - 0.5);
      const increment = Math.max(0, baseIncrement + fluctuation);
      currentProgress = Math.max(currentProgress, currentProgress + increment);

      // Handle phase transitions
      if (currentProgress >= 100) {
        // we spend 100% of estimatedDuration in green,
        // 50% in orange, and 50% in red before warning.
        if (phase === "green") {
          dispatch({ type: "ADVANCE_PHASE", nextPhase: "orange" });
          currentProgress = 0;
        } else if (phase === "orange") {
          dispatch({ type: "ADVANCE_PHASE", nextPhase: "red" });
          currentProgress = 0;
        } else if (phase === "red") {
          dispatch({ type: "SET_TIMEOUT" });
          return;
        }
      }

      dispatch({ type: "SET_PROGRESS", progress: currentProgress });

      if (!isTimeout) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [estimatedSeconds, phase, isTimeout]);

  // Get status message based on phase
  const getStatusMessage = () => {
    if (isTimeout)
      return "Sorry! This request took too long to complete. We're working on improving reliability. You can try waiting a bit longer or refreshing the page. Thank you for your patience.";
    if (phase === "orange") return "Synthesizing...";
    if (phase === "red") return "Just a moment...";
    if (errorMessage && errorMessage.length > 0) return errorMessage;
    return text;
  };

  return (
    <div className="indicator">
      {/* Status Text */}
      <div
        className={`flex space-x-1 text-xs ${!isTimeout && !errorMessage ? "shimmer" : ""}`}
      >
        <span className={isTimeout || errorMessage ? "text-rose-400" : ""}>{getStatusMessage()}</span>
      </div>

      {/* Progress Bar */}
      {estimatedSeconds > 0 && !isTimeout && !errorMessage && (
        <div className="w-full h-1 bg-gray-200 dark:!bg-default-300 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              ...PHASE_STYLES[phase],
              transition: "width 1s ease-out",
            }}
          />
        </div>
      )}
    </div>
  );
};
