import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getAnnouncementBarSettings, saveAnnouncementBarSettings } from "../db.server";
import { unauthenticated } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  let settings = getAnnouncementBarSettings(shop);

  if (shop) {
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
          settings = saveAnnouncementBarSettings(shop, parsed);
        }
      }
    } catch (err) {
      console.warn("[api.announcement-bar-settings] Could not fetch metafield via unauthenticated admin:", err);
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

