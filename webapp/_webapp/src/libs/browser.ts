// This function is used in background.js
export async function getAllCookies(name: string, url: string) {
  // @ts-expect-error: browser may not be defined in all environments
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;
  const stores = await browserAPI.cookies.getAllCookieStores();
  const cookies: chrome.cookies.Cookie[] = [];
  for (const store of stores) {
    const cookieOfStore = await browserAPI.cookies.getAll({ name, url, storeId: store.id });
    cookies.push(...cookieOfStore);
  }
  return cookies;
}

export enum Browser {
  Chrome = "chrome",
  Safari = "safari",
  Unknown = "unknown",
}

export function getBrowser() {
  if (navigator.userAgent.toLowerCase().includes("chrome")) {
    return Browser.Chrome;
  }
  if (navigator.userAgent.toLowerCase().includes("safari")) {
    return Browser.Safari;
  }
  return Browser.Unknown;
}
