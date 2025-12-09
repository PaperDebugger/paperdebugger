function show(platform, enabled, useSettingsInsteadOfPreferences) {
  document.body.classList.add(`platform-${platform}`);

  if (useSettingsInsteadOfPreferences) {
    document.body.classList.add("use-settings");
  }

  if (typeof enabled === "boolean") {
    document.body.classList.toggle(`state-on`, enabled);
    document.body.classList.toggle(`state-off`, !enabled);
  } else {
    document.body.classList.remove(`state-on`);
    document.body.classList.remove(`state-off`);
  }
}

function openPreferences() {
  webkit.messageHandlers.controller.postMessage("open-preferences");
}

function quit() {
  webkit.messageHandlers.controller.postMessage("quit");
}

document.querySelector("button.open-preferences-1").addEventListener("click", openPreferences);
document.querySelector("button.open-preferences-2").addEventListener("click", openPreferences);
document.querySelector("button.open-preferences-3").addEventListener("click", openPreferences);
document.querySelector("button.quit-1").addEventListener("click", quit);
document.querySelector("button.quit-2").addEventListener("click", quit);
document.querySelector("button.quit-3").addEventListener("click", quit);
