export const REDIRECT_URI = `${process.env.PD_API_ENDPOINT || ""}/oauth2`;

export function googleAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/auth");

  const CLIENT_ID = "259796927285-cdkkp6i69elf660ei3strgj0qrftu6ud.apps.googleusercontent.com";
  const SCOPES = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];

  let redirect_uri = REDIRECT_URI;
  if (
    process.env.PD_API_ENDPOINT === "http://localhost:6060" ||
    process.env.PD_API_ENDPOINT === "http://127.0.0.1:6060"
  ) {
    redirect_uri = "https://stg-app.paperdebugger.com/oauth2";
  }
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", redirect_uri);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("prompt", "select_account"); // Force account selection dialog
  url.searchParams.set("state", state);
  return url.toString();
}

export function appleAuthUrl(state: string) {
  // const options: SignInWithAppleOptions = {
  //     clientId: 'dev.junyi.PaperDebugger', // Apple Client ID
  //     redirectURI: REDIRECT_URI,
  //     state: state,
  //     // responseMode: 'query',
  //     scopes: 'name'
  // };
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", Math.random().toString(36).substring(2, 15)); // 推荐加 nonce
  url.searchParams.set("scope", "name email");
  url.searchParams.set("response_mode", "form_post"); // 或 "form_post"
  url.searchParams.set("client_id", "dev.junyi.PaperDebugger.si");
  url.searchParams.set("response_type", "code id_token");
  return url.toString();
}

export async function getGoogleAuthToken(): Promise<string | null> {
  const sleepMs = 3000;
  const maxRetries = (120 * 1000) / sleepMs; // 120 seconds retry
  const randomState = Math.random().toString(36).substring(2, 15);

  const wnd = window.open(googleAuthUrl(randomState), "_blank");
  if (!wnd) {
    throw new Error("failed opening auth window");
  }

  const endpoint = `${process.env.PD_API_ENDPOINT || ""}/oauth2/status?state=${randomState}`;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(endpoint);
    if (res.status === 410) {
      throw new Error("state is used");
    }
    const data = await res.json();
    if (data.access_token) {
      return data.access_token;
    }
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
  throw new Error("get auth token timeout");
}

export function getAppleAuthToken() {
  // const sleepMs = 3000;
  // const maxRetries = 120 * 1000 / sleepMs; // 120 seconds retry
  const randomState = Math.random().toString(36).substring(2, 15);

  // const endpoint = `${process.env.PD_API_ENDPOINT || ""}/oauth2/status?state=${randomState}`;
  const wnd = window.open(appleAuthUrl(randomState), "_blank");
  if (!wnd) {
    throw new Error("failed opening auth window");
  }
}
