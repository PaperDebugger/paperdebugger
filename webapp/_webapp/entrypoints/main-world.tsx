// MAIN world. Has page JS (Overleaf's cmView etc.) but NO chrome.runtime —
// reach the background through the ISOLATED bridge (lib/intermediate makeFunction).
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { onElementAppeared } from '@/lib/dom';
import { usePaperDebuggerUiStore } from '@/stores/paper-debugger-ui-store';
import { MainDrawer } from '@/components/main-drawer';
import pdCss from '@/assets/pd.css?inline';

// Anchor the button waits for (old + redesigned Overleaf toolbars).
const ANCHOR_APPEARED = '.toolbar-left .toolbar-item, .ide-redesign-toolbar-menu-bar';
const findAnchor = () =>
  document.querySelector('.toolbar-left') ?? document.querySelector('.ide-redesign-toolbar-menu-bar');

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M175.746 56.0023C191.498 56.0023 203.137 55.8084 213.012 58.9896L213.899 59.2826C232.469 65.5748 246.989 80.2934 253.013 98.9906L253.302 99.9212C256.182 109.596 256 120.996 256 136.256C256 164.564 256.194 182.481 251.375 197.44C242.048 226.391 219.565 249.18 190.812 258.923L189.438 259.377C174.479 264.196 156.562 264.002 128.254 264.002H122.909C116.634 264.002 111.185 264.009 106.679 263.724C102.332 263.449 97.9197 262.863 93.501 261.31L92.6172 260.986C80.5555 256.388 70.9889 246.939 66.2383 234.957L66.0166 234.385C64.2201 229.671 63.5719 224.96 63.2783 220.324C63.0644 216.944 63.0142 213.034 63.0029 208.643L63.0059 114.104C63.0246 108.412 63.1062 103.349 63.4619 98.9955C63.9515 93.0036 65.0381 86.9585 68.0137 81.1185C72.4238 72.4633 79.461 65.4261 88.1162 61.016C93.9563 58.0403 100.001 56.9538 105.993 56.4642C111.798 55.9899 118.863 56.0023 127 56.0023H175.746ZM115 87.9994C103.954 87.9994 95.0002 96.9539 95 107.999V217.999C95 225.731 101.268 231.999 109 231.999H121C128.732 231.999 135 225.731 135 217.999V175.599C135 175.564 134.988 174.599 135.066 173.64C135.161 172.484 135.457 170.02 136.853 167.282L137.17 166.689C138.81 163.762 141.284 161.38 144.282 159.852L144.792 159.603C147.323 158.42 149.557 158.154 150.641 158.066C151.604 157.987 152.572 157.999 152.6 157.999H192C209.673 157.999 224 143.672 224 125.999V119.999C224 102.326 209.673 87.9994 192 87.9994H115ZM167 190.001V231.21C172.255 230.755 176.141 230.041 179.625 228.918L180.541 228.616C198.917 222.389 213.449 208.169 220.099 190.001H167Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ponytail: placeholder button — keeps Overleaf's native toolbar classes so it
// sits in the bar. Toggles the drawer; the rest of its behaviour (context menu,
// shortcuts) lands with the inner-content rewrite.
function ToolbarButton() {
  const { isOpen, setIsOpen } = usePaperDebuggerUiStore();
  return (
    <button
      id="paper-debugger-button"
      className="btn btn-full-height ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued menu-bar-toggle toolbar-item"
      style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Logo />
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 300 }}>Paper</span>
        <span style={{ fontWeight: 700 }}>Debugger</span>
      </span>
    </button>
  );
}

function App() {
  const anchor = findAnchor();
  return (
    <>
      {anchor && createPortal(<ToolbarButton />, anchor)}
      <MainDrawer />
    </>
  );
}

// Tailwind's preflight is global; inject our compiled CSS once into the page.
function injectStyles() {
  if (document.getElementById('pd-styles')) return;
  const style = document.createElement('style');
  style.id = 'pd-styles';
  style.textContent = pdCss;
  document.head.appendChild(style);
}

export default defineUnlistedScript(() => {
  console.log('[PaperDebugger] main-world script loaded');

  onElementAppeared(ANCHOR_APPEARED, () => {
    if (document.getElementById('paper-debugger-root')) return; // already injected
    injectStyles();
    const root = document.createElement('div');
    root.id = 'paper-debugger-root';
    root.classList.add('pd-scope');
    document.body.appendChild(root);
    createRoot(root).render(<App />);
    console.log('[PaperDebugger] drawer + toolbar button injected');
  });
});
