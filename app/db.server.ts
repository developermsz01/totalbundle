import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var __memoryBundles: any[] | undefined;
  var __memoryStickyCartSettings: Map<string, StickyCartSettings> | undefined;
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

const settingsMap = globalThis.__memoryStickyCartSettings || new Map<string, StickyCartSettings>();
globalThis.__memoryStickyCartSettings = settingsMap;

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
