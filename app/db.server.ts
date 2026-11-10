import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var __memoryBundles: any[] | undefined;
  var __memoryStickyCartSettings: Map<string, StickyCartSettings> | undefined;
  var __memoryCartDrawerSettings: Map<string, CartDrawerSettings> | undefined;
}

export interface StickyCartSettings {
  enabled: boolean;
  position: "bottom" | "top";
  desktopVisibility: "scroll" | "always";
  showOnMobile: boolean;
  showOnDesktop: boolean;
  showThumbnail: boolean;
  showCompareAtPrice: boolean;
  showQuantity: boolean;
  buttonText: string;
  soldOutText: string;
  afterAddAction: "stay" | "cart" | "checkout";
  bgColor: string;
  textColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonHoverBgColor: string;
  borderRadius: number;
  padding: number;
}

export interface CartDrawerAddon {
  id: string;
  title: string;
  price: string;
  compareAtPrice?: string;
  image: string;
  variantId?: string;
}

export interface CartDrawerSettings {
  enabled: boolean;
  // Free Shipping Bar
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  freeShippingText: string;
  freeShippingSuccessText: string;
  freeShippingBarColor: string;
  freeShippingBarBgColor: string;

  // Product Add-on / Upsells
  addonEnabled: boolean;
  addonHeading: string;
  addonItems: CartDrawerAddon[];
  addonButtonText: string;

  // Drawer Content & Flow
  showCartNote: boolean;
  cartNotePlaceholder: string;
  showDiscountField: boolean;
  showEstimatedTaxShipping: boolean;
  checkoutButtonText: string;
  viewCartButtonText: string;
  showViewCartButton: boolean;
  emptyCartText: string;
  emptyCartButtonText: string;
  emptyCartButtonUrl: string;

  // Theme Font & Styling
  inheritThemeStyling: boolean;
  fontFamily: string;
  baseFontSize: number;
  headingFontSize: number;
  bgColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  checkoutButtonBgColor: string;
  checkoutButtonTextColor: string;
  checkoutButtonHoverBgColor: string;
  addonButtonBgColor: string;
  addonButtonTextColor: string;
  borderRadius: number;
  drawerPosition: "right" | "left";
  drawerWidth: number;
}

export const defaultStickyCartSettings: StickyCartSettings = {
  enabled: true,
  position: "bottom",
  desktopVisibility: "scroll",
  showOnMobile: true,
  showOnDesktop: true,
  showThumbnail: true,
  showCompareAtPrice: true,
  showQuantity: true,
  buttonText: "Add to Cart",
  soldOutText: "Sold Out",
  afterAddAction: "stay",
  bgColor: "#ffffff",
  textColor: "#121212",
  buttonBgColor: "#121212",
  buttonTextColor: "#ffffff",
  buttonHoverBgColor: "#2e2e2e",
  borderRadius: 8,
  padding: 12,
};

export const defaultCartDrawerSettings: CartDrawerSettings = {
  enabled: true,
  freeShippingEnabled: true,
  freeShippingThreshold: 50,
  freeShippingText: "Add {amount} more for FREE Shipping!",
  freeShippingSuccessText: "🎉 You have unlocked Free Shipping!",
  freeShippingBarColor: "#008060",
  freeShippingBarBgColor: "#e4e5e7",

  addonEnabled: true,
  addonHeading: "Complete your order (Special Add-on)",
  addonItems: [
    {
      id: "addon-1",
      title: "Eco-Friendly Gift Packaging",
      price: "$4.99",
      compareAtPrice: "$8.00",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_small.png",
      variantId: "",
    },
    {
      id: "addon-2",
      title: "1-Year Extended Warranty Protection",
      price: "$9.99",
      compareAtPrice: "$15.00",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-2_small.png",
      variantId: "",
    },
  ],
  addonButtonText: "+ Add",

  showCartNote: true,
  cartNotePlaceholder: "Special instructions for seller...",
  showDiscountField: false,
  showEstimatedTaxShipping: true,
  checkoutButtonText: "Proceed to Checkout",
  viewCartButtonText: "View Cart Page",
  showViewCartButton: true,
  emptyCartText: "Your cart is currently empty",
  emptyCartButtonText: "Explore Products",
  emptyCartButtonUrl: "/collections/all",

  inheritThemeStyling: true,
  fontFamily: "inherit",
  baseFontSize: 14,
  headingFontSize: 18,
  bgColor: "#ffffff",
  textColor: "#121212",
  mutedTextColor: "#6d7175",
  borderColor: "#e5e7eb",
  checkoutButtonBgColor: "#121212",
  checkoutButtonTextColor: "#ffffff",
  checkoutButtonHoverBgColor: "#2e2e2e",
  addonButtonBgColor: "#121212",
  addonButtonTextColor: "#ffffff",
  borderRadius: 8,
  drawerPosition: "right",
  drawerWidth: 420,
};

const settingsMap = globalThis.__memoryStickyCartSettings || new Map<string, StickyCartSettings>();
globalThis.__memoryStickyCartSettings = settingsMap;

const cartDrawerSettingsMap = globalThis.__memoryCartDrawerSettings || new Map<string, CartDrawerSettings>();
globalThis.__memoryCartDrawerSettings = cartDrawerSettingsMap;

export function getStickyCartSettings(shop: string): StickyCartSettings {
  if (shop && settingsMap.has(shop)) {
    return { ...defaultStickyCartSettings, ...settingsMap.get(shop) };
  }
  return { ...defaultStickyCartSettings };
}

export function saveStickyCartSettings(shop: string, settings: Partial<StickyCartSettings>): StickyCartSettings {
  const current = getStickyCartSettings(shop);
  const updated: StickyCartSettings = { ...current, ...settings };
  if (shop) {
    settingsMap.set(shop, updated);
  }
  return updated;
}

export function getCartDrawerSettings(shop: string): CartDrawerSettings {
  if (shop && cartDrawerSettingsMap.has(shop)) {
    return { ...defaultCartDrawerSettings, ...cartDrawerSettingsMap.get(shop) };
  }
  return { ...defaultCartDrawerSettings };
}

export function saveCartDrawerSettings(shop: string, settings: Partial<CartDrawerSettings>): CartDrawerSettings {
  const current = getCartDrawerSettings(shop);
  const updated: CartDrawerSettings = { ...current, ...settings };
  if (shop) {
    cartDrawerSettingsMap.set(shop, updated);
  }
  return updated;
}

const memoryBundles = globalThis.__memoryBundles || [];
globalThis.__memoryBundles = memoryBundles;

let rawPrisma: PrismaClient | null = null;
if (process.env.DATABASE_URL) {
  try {
    if (process.env.NODE_ENV !== "production") {
      if (!global.prismaGlobal) {
        global.prismaGlobal = new PrismaClient();
      }
      rawPrisma = global.prismaGlobal;
    } else {
      rawPrisma = new PrismaClient();
    }
  } catch (e) {
    console.warn("[db.server] Failed to initialize PrismaClient:", e);
    rawPrisma = null;
  }
}

// In-memory bundle repository
const inMemoryBundle = {
  async findMany(args?: any) {
    let result = [...memoryBundles];
    if (args?.where?.shop) {
      result = result.filter((b) => !b.shop || b.shop === args.where.shop);
    }
    return result;
  },
  async findUnique(args: any) {
    return memoryBundles.find((b) => b.id === args?.where?.id) || null;
  },
  async create(args: any) {
    const newBundle = {
      id: "bundle_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      shop: args.data.shop,
      title: args.data.title,
      description: args.data.description || null,
      status: args.data.status || "ACTIVE",
      discountType: args.data.discountType || "PERCENTAGE",
      discountValue: args.data.discountValue ?? 10.0,
      minQuantity: args.data.minQuantity ?? 2,
      tieredRulesJson: args.data.tieredRulesJson || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      products: [],
    };
    memoryBundles.unshift(newBundle);
    return newBundle;
  },
  async update(args: any) {
    const idx = memoryBundles.findIndex((b) => b.id === args?.where?.id);
    if (idx !== -1) {
      memoryBundles[idx] = { ...memoryBundles[idx], ...args.data, updatedAt: new Date() };
      return memoryBundles[idx];
    }
    return null;
  },
  async delete(args: any) {
    const idx = memoryBundles.findIndex((b) => b.id === args?.where?.id);
    if (idx !== -1) {
      const removed = memoryBundles.splice(idx, 1);
      return removed[0];
    }
    return null;
  },
  async count(args?: any) {
    if (args?.where?.shop) {
      return memoryBundles.filter((b) => !b.shop || b.shop === args.where.shop).length;
    }
    return memoryBundles.length;
  },
};

const inMemoryBundleProduct = {
  async findMany() {
    return [];
  },
  async create(args: any) {
    return { id: "bp_" + Date.now(), ...args.data, createdAt: new Date() };
  },
  async deleteMany() {
    return { count: 0 };
  },
};

// Safe DB export proxy that never crashes unhandled
const db: any = new Proxy(rawPrisma || {}, {
  get(target, prop: string) {
    if (prop === "bundle") {
      if (rawPrisma?.bundle) {
        return new Proxy(rawPrisma.bundle, {
          get(bTarget, bProp: string) {
            const orig = (bTarget as any)[bProp];
            if (typeof orig === "function") {
              return async (...args: any[]) => {
                try {
                  return await orig.apply(bTarget, args);
                } catch (dbErr) {
                  console.warn(`[db.server] prisma.bundle.${bProp} failed, using memory store:`, dbErr);
                  return (inMemoryBundle as any)[bProp]?.(...args);
                }
              };
            }
            return orig;
          },
        });
      }
      return inMemoryBundle;
    }

    if (prop === "bundleProduct") {
      if (rawPrisma?.bundleProduct) {
        return new Proxy(rawPrisma.bundleProduct, {
          get(bpTarget, bpProp: string) {
            const orig = (bpTarget as any)[bpProp];
            if (typeof orig === "function") {
              return async (...args: any[]) => {
                try {
                  return await orig.apply(bpTarget, args);
                } catch (dbErr) {
                  console.warn(`[db.server] prisma.bundleProduct.${bpProp} failed, using memory store:`, dbErr);
                  return (inMemoryBundleProduct as any)[bpProp]?.(...args);
                }
              };
            }
            return orig;
          },
        });
      }
      return inMemoryBundleProduct;
    }

    if (rawPrisma && prop in rawPrisma) {
      return (rawPrisma as any)[prop];
    }

    return (target as any)[prop];
  },
});

export default db;
export { rawPrisma as prisma };
