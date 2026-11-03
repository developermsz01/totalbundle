import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var __memoryBundles: any[] | undefined;
}

const defaultSampleBundles = [
  {
    id: "bundle_volume_tiered",
    shop: "",
    title: "Volume Tiered Discount (Buy More, Save More)",
    description: "Mix & match any 2 items for 10% off, 3 items for 20% off, or 4+ items for 30% off.",
    status: "ACTIVE",
    discountType: "TIERED",
    discountValue: 20.0,
    minQuantity: 2,
    tieredRulesJson: JSON.stringify([
      { minQuantity: 2, discount: 10 },
      { minQuantity: 3, discount: 20 },
      { minQuantity: 4, discount: 30 },
    ]),
    createdAt: new Date(),
    updatedAt: new Date(),
    products: [],
  },
  {
    id: "bundle_starter_pack",
    shop: "",
    title: "Starter Accessory Bundle",
    description: "Get 15% off when you purchase at least 2 accessories together.",
    status: "ACTIVE",
    discountType: "PERCENTAGE",
    discountValue: 15.0,
    minQuantity: 2,
    tieredRulesJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    products: [],
  },
];

const memoryBundles = globalThis.__memoryBundles || [...defaultSampleBundles];
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
