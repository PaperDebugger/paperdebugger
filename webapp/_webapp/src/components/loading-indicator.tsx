import { useState, useEffect } from "react";

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

const STYLES = {
  loading: {
    animation: {
      WebkitTextFillColor: "transparent",
      animationDelay: "0.5s",
      animationDuration: "3s",
      animationIterationCount: "infinite",
      animationName: "shimmer",
      background: "#cdcdcd -webkit-gradient(linear, 100% 0, 0 0, from(#cdcdcd), color-stop(.5, #1a1a1a), to(#cdcdcd))",
      WebkitBackgroundClip: "text",
      backgroundRepeat: "no-repeat",
      backgroundSize: "50% 200%",
      backgroundPositionX: "-100%",
    },
  },
} as const;

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

export const LoadingIndicator = ({ text = "Thinking", estimatedSeconds = 0, errorMessage }: LoadingIndicatorProps) => {
  // State
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("green");
  const [isTimeout, setIsTimeout] = useState(false);

  // Handle progress animation
  useEffect(() => {
    if (estimatedSeconds <= 0) return;

    let animationFrameId: number;
    let lastUpdateTime = Date.now();
    let currentProgress = 0;

    const updateProgress = () => {
      const now = Date.now();
      const deltaTime = now - lastUpdateTime;

      // Add random delay to make animation more natural
      if (deltaTime < Math.random() * 500) {
        animationFrameId = requestAnimationFrame(updateProgress);
        return;
      }

      lastUpdateTime = now;

      // Calculate progress with natural fluctuation
      const baseIncrement = (deltaTime / (estimatedSeconds * 1000)) * 100;
      const fluctuation = (Math.random() - 0.5) * 4;
      const increment = Math.max(0, baseIncrement + fluctuation);
      currentProgress = Math.max(currentProgress, currentProgress + increment);

      // Handle phase transitions
      if (currentProgress >= 100) {
        if (phase === "green") {
          setPhase("orange");
          currentProgress = 0;
        } else if (phase === "orange") {
          setPhase("red");
          currentProgress = 0;
        } else if (phase === "red") {
          setIsTimeout(true);
          return;
        }
      }

      setProgress(currentProgress);

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
      return "Sorry — this request took too long to complete. We're working on improving reliability. You can try waiting a bit longer or refreshing the page. Thanks for your patience.";
    if (phase === "orange") return "Synthesizing...";
    if (phase === "red") return "Just a moment...";
    if (errorMessage && errorMessage.length > 0) return errorMessage;
    return text;
  };

  return (
    <div className="indicator">
      {/* Status Text */}
      <div
        className={`flex space-x-1 text-sm ${!isTimeout && !errorMessage ? "loading-shimmer" : ""}`}
        style={!isTimeout && !errorMessage ? STYLES.loading.animation : undefined}
      >
        <span className={isTimeout || errorMessage ? "text-rose-400" : ""}>{getStatusMessage()}</span>
      </div>

      {/* Progress Bar */}
      {estimatedSeconds > 0 && !isTimeout && !errorMessage && (
        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
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
