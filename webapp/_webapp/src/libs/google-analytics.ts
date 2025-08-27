import { getOrCreateSessionId } from "../intermediate";

const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

const MEASUREMENT_ID = process.env.PD_GA_TRACKING_ID;
const API_SECRET = process.env.PD_GA_API_SECRET;
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;

interface AnalyticsParams {
  session_id?: string;
  engagement_time_msec?: number;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

class Analytics {
  private debug = false;

  constructor(debug = false) {
    this.debug = debug;
  }

  // Fires an event with optional params. Event names must only include letters and underscores.
  async fireEvent(clientId: string | undefined, name: string, params: AnalyticsParams = {}) {
    if (import.meta.env.DEV) {
      return;
    }

    // Configure session id and engagement time if not present, for more details see:
    // https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events?client_type=gtag#recommended_parameters_for_reports
    if (!params.session_id) {
      params.session_id = await getOrCreateSessionId();
    }
    if (!params.engagement_time_msec) {
      params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_MSEC;
    }
    if (!params.user_id) {
      params.user_id = clientId;
    }

    try {
      await fetch(
        `${this.debug ? GA_DEBUG_ENDPOINT : GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
        {
          method: "POST",
          body: JSON.stringify({
            client_id: clientId || "unknown",
            events: [
              {
                name,
                params,
              },
            ],
          }),
        },
      ).catch((_) => {
        // eslint-disable-line @typescript-eslint/no-unused-vars
        // logInfo("Google Analytics request failed with an exception", e);
      });

      if (!this.debug) {
        return;
      }
    } catch (e) {
      // eslint-disable-line @typescript-eslint/no-unused-vars
      // logInfo("Google Analytics request failed with an exception", e);
    }
  }

  // Fire a page view event.
  async firePageViewEvent(clientId: string, pageTitle: string, pageLocation: string, additionalParams = {}) {
    return this.fireEvent(clientId, "page_view", {
      page_title: pageTitle,
      page_location: pageLocation,
      ...additionalParams,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async fireErrorEvent(error: any, additionalParams = {}) {
    // Note: 'error' is a reserved event name and cannot be used
    // see https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag#reserved_names
    return this.fireEvent("extension_error", {
      ...error,
      ...additionalParams,
    });
  }
}

export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

export default new Analytics();
