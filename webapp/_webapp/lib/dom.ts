// Wait until an element matching `selector` exists, then fire `callback` once.
export async function onElementAppeared(selector: string, callback: (element: Element) => void) {
  const element = document.querySelector(selector);
  if (element) {
    return callback(element);
  }

  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (element) {
      observer.disconnect();
      callback(element);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Fire `callback` every time a node matching `selector` is added to the DOM.
export function onElementAdded(selector: string, callback: (element: Element) => void) {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && (node as Element).matches(selector)) {
          callback(node as Element);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}
