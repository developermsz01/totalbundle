import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "./shopify.server";
import {
  getStickyCartSettings,
  saveStickyCartSettings,
  getCartDrawerSettings,
  saveCartDrawerSettings,
  type StickyCartSettings,
  type CartDrawerSettings,
} from "./db.server";

export async function handleDashboardLoader(
  request: Request,
  forcedFeature?: "sticky-cart" | "cart-drawer"
) {
  let shop = "your-store.myshopify.com";

  try {
    const authResult = await authenticate.admin(request);
    if (authResult?.session?.shop) {
      shop = authResult.session.shop;
    }
  } catch (authError) {
    if (authError instanceof Response) {
      throw authError;
    }
  }

  const url = new URL(request.url);
  let initialFeature: "sticky-cart" | "cart-drawer" = forcedFeature || "sticky-cart";

  if (!forcedFeature) {
    const featureParam = url.searchParams.get("feature");
    if (featureParam === "cart-drawer" || url.pathname.includes("cart-drawer")) {
      initialFeature = "cart-drawer";
    } else {
      initialFeature = "sticky-cart";
    }
  }

  const stickySettings = getStickyCartSettings(shop);
  const cartDrawerSettings = getCartDrawerSettings(shop);

  return json({
    shop,
    stickySettings,
    cartDrawerSettings,
    initialFeature,
    themeEditorUrl: `https://${shop}/admin/themes/current/editor?context=apps`,
  });
}

export async function handleDashboardAction(request: Request) {
  let shop = "your-store.myshopify.com";
  let admin: any = null;

  try {
    const authResult = await authenticate.admin(request);
    if (authResult?.session?.shop) {
      shop = authResult.session.shop;
    }
    admin = authResult?.admin;
  } catch (authError) {
    if (authError instanceof Response) {
      throw authError;
    }
  }

  const formData = await request.formData();
  const feature = String(formData.get("feature") || "sticky-cart");
  const rawSettings = formData.get("settings");

  if (rawSettings) {
    try {
      if (feature === "cart-drawer") {
        const parsed = JSON.parse(String(rawSettings)) as CartDrawerSettings;
        const updated = saveCartDrawerSettings(shop, parsed);

        // Sync settings to Shopify App Metafield (namespace: cart_drawer)
        if (admin) {
          try {
            const appInstallRes = await admin.graphql(
              `#graphql
              query {
                currentAppInstallation {
                  id
                }
              }`
            );
            const appInstallJson = await appInstallRes.json();
            const appInstallationId = appInstallJson?.data?.currentAppInstallation?.id;

            if (appInstallationId) {
              await admin.graphql(
                `#graphql
                mutation SaveCartDrawerSettings($metafieldsSetInput: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafieldsSetInput) {
                    metafields {
                      id
                      namespace
                      key
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }`,
                {
                  variables: {
                    metafieldsSetInput: [
                      {
                        namespace: "cart_drawer",
                        key: "settings",
                        type: "json",
                        value: JSON.stringify(updated),
                        ownerId: appInstallationId,
                      },
                    ],
                  },
                }
              );
            }
          } catch (metafieldError) {
            console.warn("[dashboard.server] Cart drawer metafield sync skipped/failed:", metafieldError);
          }
        }

        return json({ success: true, feature: "cart-drawer", settings: updated });
      } else {
        // Sticky Cart settings
        const parsed = JSON.parse(String(rawSettings)) as StickyCartSettings;
        const updated = saveStickyCartSettings(shop, parsed);

        // Sync settings to Shopify App Metafield (namespace: sticky_cart)
        if (admin) {
          try {
            const appInstallRes = await admin.graphql(
              `#graphql
              query {
                currentAppInstallation {
                  id
                }
              }`
            );
            const appInstallJson = await appInstallRes.json();
            const appInstallationId = appInstallJson?.data?.currentAppInstallation?.id;

            if (appInstallationId) {
              await admin.graphql(
                `#graphql
                mutation SaveStickyCartSettings($metafieldsSetInput: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafieldsSetInput) {
                    metafields {
                      id
                      namespace
                      key
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }`,
                {
                  variables: {
                    metafieldsSetInput: [
                      {
                        namespace: "sticky_cart",
                        key: "settings",
                        type: "json",
                        value: JSON.stringify(updated),
                        ownerId: appInstallationId,
                      },
                    ],
                  },
                }
              );
            }
          } catch (metafieldError) {
            console.warn("[dashboard.server] Sticky cart metafield sync skipped/failed:", metafieldError);
          }
        }

        return json({ success: true, feature: "sticky-cart", settings: updated });
      }
    } catch (e) {
      return json({ success: false, error: "Failed to parse settings" }, { status: 400 });
    }
  }

  return json({ success: false, error: "No settings provided" }, { status: 400 });
}

