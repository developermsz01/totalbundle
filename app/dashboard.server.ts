import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticate } from "./shopify.server";
import {
  getStickyCartSettings,
  saveStickyCartSettings,
  getCartDrawerSettings,
  saveCartDrawerSettings,
  getAnnouncementBarSettings,
  saveAnnouncementBarSettings,
  type StickyCartSettings,
  type CartDrawerSettings,
  type AnnouncementBarSettings,
} from "./db.server";

export async function handleDashboardLoader(
  request: Request,
  forcedFeature?: "sticky-cart" | "cart-drawer" | "announcement-bar"
) {
  let shop = "your-store.myshopify.com";
  let storeProducts: Array<{
    id: string;
    title: string;
    handle: string;
    image: string;
    variants: Array<{
      id: string;
      numericId: string;
      title: string;
      price: string;
      compareAtPrice: string;
      image: string;
    }>;
  }> = [];

  try {
    const authResult = await authenticate.admin(request);
    if (authResult?.session?.shop) {
      shop = authResult.session.shop;
    }
    if (authResult?.admin) {
      try {
        const prodRes = await authResult.admin.graphql(`
          query GetStoreProductsInitial {
            products(first: 30) {
              nodes {
                id
                title
                handle
                featuredMedia {
                  ... on MediaImage {
                    image {
                      url
                    }
                  }
                }
                variants(first: 10) {
                  nodes {
                    id
                    title
                    price
                    compareAtPrice
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        `);
        const prodData = await prodRes.json();
        const nodes = prodData?.data?.products?.nodes || [];
        storeProducts = nodes.map((p: any) => ({
          id: p.id,
          title: p.title,
          handle: p.handle,
          image: p.featuredMedia?.image?.url || "",
          variants: (p.variants?.nodes || []).map((v: any) => ({
            id: v.id,
            numericId: String(v.id).replace("gid://shopify/ProductVariant/", ""),
            title: v.title,
            price: v.price ? (String(v.price).startsWith("$") ? String(v.price) : `$${v.price}`) : "$0.00",
            compareAtPrice: v.compareAtPrice
              ? String(v.compareAtPrice).startsWith("$")
                ? String(v.compareAtPrice)
                : `$${v.compareAtPrice}`
              : "",
            image: v.image?.url || p.featuredMedia?.image?.url || "",
          })),
        }));
      } catch (gqlErr) {
        console.warn("[handleDashboardLoader] Failed to fetch store products:", gqlErr);
      }
    }
  } catch (authError) {
    if (authError instanceof Response) {
      throw authError;
    }
  }

  const url = new URL(request.url);
  let initialFeature: "sticky-cart" | "cart-drawer" | "announcement-bar" = forcedFeature || "sticky-cart";

  if (!forcedFeature) {
    const featureParam = url.searchParams.get("feature");
    if (featureParam === "announcement-bar" || url.pathname.includes("announcement-bar")) {
      initialFeature = "announcement-bar";
    } else if (featureParam === "cart-drawer" || url.pathname.includes("cart-drawer")) {
      initialFeature = "cart-drawer";
    } else {
      initialFeature = "sticky-cart";
    }
  }

  const stickySettings = getStickyCartSettings(shop);
  const cartDrawerSettings = getCartDrawerSettings(shop);
  const announcementBarSettings = getAnnouncementBarSettings(shop);

  return json({
    shop,
    stickySettings,
    cartDrawerSettings,
    announcementBarSettings,
    storeProducts,
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

        // Sync settings to Shopify Metafields (both App Installation and Shop for 100% Liquid availability)
        if (admin) {
          try {
            const shopQueryRes = await admin.graphql(
              `#graphql
              query GetShopAndAppId {
                shop {
                  id
                }
                currentAppInstallation {
                  id
                }
              }`
            );
            const shopQueryJson = await shopQueryRes.json();
            const shopId = shopQueryJson?.data?.shop?.id;
            const appInstallationId = shopQueryJson?.data?.currentAppInstallation?.id;

            const metafieldsToSet: Array<{
              namespace: string;
              key: string;
              type: string;
              value: string;
              ownerId: string;
            }> = [];

            const serializedSettings = JSON.stringify(updated);

            if (shopId) {
              metafieldsToSet.push({
                namespace: "cart_drawer",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: shopId,
              });
            }

            if (appInstallationId) {
              metafieldsToSet.push({
                namespace: "cart_drawer",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: appInstallationId,
              });
            }

            if (metafieldsToSet.length > 0) {
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
                    metafieldsSetInput: metafieldsToSet,
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

        // Sync settings to Shopify Metafields (both App Installation and Shop)
        if (admin) {
          try {
            const shopQueryRes = await admin.graphql(
              `#graphql
              query GetShopAndAppIdSticky {
                shop {
                  id
                }
                currentAppInstallation {
                  id
                }
              }`
            );
            const shopQueryJson = await shopQueryRes.json();
            const shopId = shopQueryJson?.data?.shop?.id;
            const appInstallationId = shopQueryJson?.data?.currentAppInstallation?.id;

            const metafieldsToSet: Array<{
              namespace: string;
              key: string;
              type: string;
              value: string;
              ownerId: string;
            }> = [];

            const serializedSettings = JSON.stringify(updated);

            if (shopId) {
              metafieldsToSet.push({
                namespace: "sticky_cart",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: shopId,
              });
            }

            if (appInstallationId) {
              metafieldsToSet.push({
                namespace: "sticky_cart",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: appInstallationId,
              });
            }

            if (metafieldsToSet.length > 0) {
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
                    metafieldsSetInput: metafieldsToSet,
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

      // Announcement Bar settings
      if (feature === "announcement-bar") {
        const parsed = JSON.parse(String(rawSettings)) as AnnouncementBarSettings;
        const updated = saveAnnouncementBarSettings(shop, parsed);

        // Sync settings to Shopify Metafields (both App Installation and Shop)
        if (admin) {
          try {
            const shopQueryRes = await admin.graphql(
              `#graphql
              query GetShopAndAppIdAnnouncement {
                shop {
                  id
                }
                currentAppInstallation {
                  id
                }
              }`
            );
            const shopQueryJson = await shopQueryRes.json();
            const shopId = shopQueryJson?.data?.shop?.id;
            const appInstallationId = shopQueryJson?.data?.currentAppInstallation?.id;

            const metafieldsToSet: Array<{
              namespace: string;
              key: string;
              type: string;
              value: string;
              ownerId: string;
            }> = [];

            const serializedSettings = JSON.stringify(updated);

            if (shopId) {
              metafieldsToSet.push({
                namespace: "announcement_bar",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: shopId,
              });
            }

            if (appInstallationId) {
              metafieldsToSet.push({
                namespace: "announcement_bar",
                key: "settings",
                type: "json",
                value: serializedSettings,
                ownerId: appInstallationId,
              });
            }

            if (metafieldsToSet.length > 0) {
              await admin.graphql(
                `#graphql
                mutation SaveAnnouncementBarSettings($metafieldsSetInput: [MetafieldsSetInput!]!) {
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
                    metafieldsSetInput: metafieldsToSet,
                  },
                }
              );
            }
          } catch (metafieldError) {
            console.warn("[dashboard.server] Announcement bar metafield sync skipped/failed:", metafieldError);
          }
        }

        return json({ success: true, feature: "announcement-bar", settings: updated });
      }
    } catch (e) {
      return json({ success: false, error: "Failed to parse settings" }, { status: 400 });
    }
  }

  return json({ success: false, error: "No settings provided" }, { status: 400 });
}

