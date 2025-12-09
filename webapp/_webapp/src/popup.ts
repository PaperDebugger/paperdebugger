/*
 * popup.ts
 *
 * Script for the extension popup page.
 * Handles the request host permission button click.
 */

// Disable context menu (right-click) to comply with CSP
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

document.getElementById('myButton')?.addEventListener('click', async () => {
  const origin = "https://www.google.com/";
  
  try {
    // 直接调用 background script，类似于 intermediate.ts 中的实现
    const response = await chrome.runtime.sendMessage({
      action: "requestHostPermission",
      args: origin,
    });
    
    if (response?.error) {
      console.error("Error requesting permissions:", response.error);
      alert(`Permission request failed: ${response.error}`);
    } else if (response === true) {
      console.log(`Permission granted for ${origin}`);
      alert(`Permission granted for ${origin}`);
    } else {
      console.log(`Permission denied for ${origin}`);
      alert(`Permission denied for ${origin}`);
    }
  } catch (error) {
    console.error("Error requesting permissions:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    alert(`Error: ${errorMessage}`);
  }
});

