import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { fromJson, JsonValue } from "@bufbuild/protobuf";
import { RefreshTokenResponseSchema } from "../pkg/gen/apiclient/auth/v1/auth_pb";
import { GetUserResponseSchema } from "../pkg/gen/apiclient/user/v1/user_pb";
import { EventEmitter } from "events";
import { ErrorCode, ErrorSchema } from "../pkg/gen/apiclient/shared/v1/shared_pb";
import { errorToast } from "./toasts";

export type RequestOptions = {
  ignoreErrorToast?: boolean;
};

class ApiClient {
  private axiosInstance: AxiosInstance;
  private refreshToken: string | null;
  private onTokenRefreshedEventEmitter: EventEmitter;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
    this.refreshToken = null;
    this.onTokenRefreshedEventEmitter = new EventEmitter();
  }

  updateBaseURL(baseURL: string): void {
    this.axiosInstance.defaults.baseURL = baseURL;
    localStorage.setItem(LOCAL_STORAGE_KEY, baseURL);
    console.log("apiclient baseURL updated to", baseURL);
  }

  addListener(event: "tokenRefreshed", listener: (args: { token: string; refreshToken: string }) => void): void {
    this.onTokenRefreshedEventEmitter.addListener(event, listener);
  }

  removeListener(event: "tokenRefreshed", listener: (args: { token: string; refreshToken: string }) => void): void {
    this.onTokenRefreshedEventEmitter.removeListener(event, listener);
  }

  setTokens(token: string, refreshToken: string): void {
    this.refreshToken = refreshToken;
    this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  clearTokens(): void {
    this.refreshToken = null;
    delete this.axiosInstance.defaults.headers.common["Authorization"];
  }

  hasToken(): boolean {
    const token = this.axiosInstance.defaults.headers.common["Authorization"]?.toString() || "";
    return token?.replace("Bearer ", "").trim() !== "";
  }

  async isAuthed(): Promise<boolean> {
    try {
      const response = await this.get("/users/@self");
      const user = fromJson(GetUserResponseSchema, response);
      return user.user?.id !== "";
    } catch {
      return false;
    }
  }

  async refresh() {
    const response = await this.axiosInstance.post<JsonValue>("/auth/refresh", {
      refreshToken: this.refreshToken,
    });
    const resp = fromJson(RefreshTokenResponseSchema, response.data);
    this.setTokens(resp.token, resp.refreshToken);
    this.onTokenRefreshedEventEmitter.emit("tokenRefreshed", {
      token: resp.token,
      refreshToken: resp.refreshToken,
    });
  }

  private async requestWithRefresh(config: AxiosRequestConfig): Promise<JsonValue> {
    try {
      const response = await this.axiosInstance(config);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401 && this.hasToken()) {
        await this.refresh();
        const response = await this.axiosInstance(config);
        return response.data;
      }
      throw error;
    }
  }

  private async requestWithErrorToast(config: AxiosRequestConfig, options?: RequestOptions): Promise<JsonValue> {
    try {
      return await this.requestWithRefresh(config);
    } catch (error) {
      if (error instanceof AxiosError) {
        const errorData = error.response?.data;
        const errorPayload = fromJson(ErrorSchema, errorData);
        if (!options?.ignoreErrorToast) {
          const message = errorPayload.message.replace(/^rpc error: code = Code\(\d+\) desc = /, "");
          errorToast(message, `Request Failed: ${ErrorCode[errorPayload.code]}`);
        }
        throw errorPayload;
      }
      throw error;
    }
  }

  async get(url: string, params?: object, options?: RequestOptions): Promise<JsonValue> {
    return this.requestWithErrorToast(
      {
        method: "GET",
        url,
        params,
      },
      options,
    );
  }

  async post(url: string, data?: object, options?: RequestOptions): Promise<JsonValue> {
    return this.requestWithErrorToast(
      {
        method: "POST",
        url,
        data,
      },
      options,
    );
  }

  async put(url: string, data?: object, options?: RequestOptions): Promise<JsonValue> {
    return this.requestWithErrorToast(
      {
        method: "PUT",
        url,
        data,
      },
      options,
    );
  }

  async patch(url: string, data?: object, options?: RequestOptions): Promise<JsonValue> {
    return this.requestWithErrorToast(
      {
        method: "PATCH",
        url,
        data,
      },
      options,
    );
  }

  async delete(url: string, options?: RequestOptions): Promise<JsonValue> {
    return this.requestWithErrorToast(
      {
        method: "DELETE",
        url,
      },
      options,
    );
  }

  async postStream(
    url: string,
    data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(this.axiosInstance.defaults.baseURL + url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${this.axiosInstance.defaults.headers.common["Authorization"]}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Ensure the response body is a readable stream
    if (!response.body) {
      throw new Error("Readable stream not supported in this environment.");
    }

    return response.body; // Return the readable stream
  }
}

const DEFAULT_ENDPOINT = `${process.env.PD_API_ENDPOINT || "http://localhost:3000"}/_pd/api/v1`;
const LOCAL_STORAGE_KEY = "pd.devtool.endpoint";
// Create apiclient instance with endpoint from localStorage or default
export const getEndpointFromLocalStorage = () => {
  try {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || DEFAULT_ENDPOINT;
  } catch (error) {
    // Fallback if localStorage is not available (e.g., in SSR)
    return DEFAULT_ENDPOINT;
  }
};

export const resetApiClientEndpoint = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  apiclient.updateBaseURL(getEndpointFromLocalStorage());
};

const apiclient = new ApiClient(getEndpointFromLocalStorage());
export default apiclient;
