import './App.css';

const openSettingsPage = () => {
  if (browser.runtime?.openOptionsPage) {
    browser.runtime.openOptionsPage();
    return;
  }
  window.open(browser.runtime.getURL('/options.html'), '_blank', 'noopener,noreferrer');
};

function App() {
  return (
    <div className="popup-shell noselect">
      <h1 className="title">PaperDebugger</h1>
      <h2 className="subtitle">How to use</h2>

      <div className="steps">
        <div className="step">
          <span className="step-number">1.</span>
          <p className="step-text">
            In{' '}
            <a className="step-link" href="https://overleaf.com" target="_blank" rel="noreferrer">
              overleaf.com
            </a>
            , open any of your projects.
          </p>
        </div>
        <div className="step">
          <span className="step-number">2.</span>
          <p className="step-text">PaperDebugger is in the "top left" of the project page.</p>
        </div>
      </div>

      <img src="/images/locator.png" alt="PaperDebugger Location" style={{ width: '100%', marginTop: "1em" }} />

      <p className="footnote">
        Self-hosted Overleaf?{' '}
        <a
          className="step-link"
          href={browser.runtime.getURL('/options.html')}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault();
            openSettingsPage();
          }}
        >
          Allow PaperDebugger access here.
        </a>
      </p>
    </div>
  );
}

export default App;
