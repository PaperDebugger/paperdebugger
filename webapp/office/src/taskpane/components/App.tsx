import * as React from "react";

const App: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <paperdebugger-office
        display-mode="fullscreen"
        adapter-id="word-default"
        style={{ flex: 1, width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default App;
