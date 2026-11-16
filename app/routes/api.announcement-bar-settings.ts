import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getAnnouncementBarSettings, saveAnnouncementBarSettings } from "../db.server";
import { unauthenticated } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  let settings = null;

  if (shop) {
    // 1. Try to fetch the live saved settings from Shopify Metafield
    try {
      const auth = await unauthenticated.admin(shop);
      if (auth?.admin) {
        const response = await auth.admin.graphql(
          `#graphql
          query GetAnnouncementBarMetafields {
            currentAppInstallation {
              metafield(namespace: "announcement_bar", key: "settings") {
                value
              }
            }
            shop {
              metafield(namespace: "announcement_bar", key: "settings") {
                value
              }
            }
          }`
        );
        const data = await response.json();
        const appVal = data?.data?.currentAppInstallation?.metafield?.value;
        const shopVal = data?.data?.shop?.metafield?.value;
        const rawJson = appVal || shopVal;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          parsed._saved = true;
          settings = saveAnnouncementBarSettings(shop, parsed);
        }
      }
    } catch (err) {
      // In-memory fallback if available for this specific shop
      if (globalThis.__memoryAnnouncementBarSettings && globalThis.__memoryAnnouncementBarSettings.has(shop)) {
        settings = getAnnouncementBarSettings(shop);
        if (settings) settings._saved = true;
      }
    }
  }

  return json(
    { settings },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
};

