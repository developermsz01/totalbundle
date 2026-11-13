import { useState, useEffect } from "react";
import { useActionData, useLoaderData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Box,
  Divider,
  Icon,
  TextField,
  Select,
  Checkbox,
  RangeSlider,
  ButtonGroup,
  Modal,
  Thumbnail,
  Spinner,
} from "@shopify/polaris";
import {
  ExternalIcon,
  CheckIcon,
  DeleteIcon,
  PlusIcon,
  ProductIcon,
  SearchIcon,
} from "./Icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import type {
  StickyCartSettings,
  CartDrawerSettings,
  CartDrawerAddon,
  AnnouncementBarSettings,
  AnnouncementBarMessage,
} from "../db.server";

const defaultAnnouncementBarFallback: AnnouncementBarSettings = {
  enabled: true,
  mode: "rotating",
  messages: [
    { id: "msg-1", text: "🎉 Free Shipping on all orders over $50!", link: "" },
    { id: "msg-2", text: "⚡ Use code WELCOME10 for 10% OFF your first order", link: "" },
    { id: "msg-3", text: "⭐ 30-Day Money-Back Guarantee & Easy Returns", link: "" },
  ],
  bgColor: "#111827",
  textColor: "#ffffff",
  fontSize: 13,
  isSticky: false,
  showCloseButton: false,
  rotationInterval: 4,
  marqueeSpeed: 25,
  pauseOnHover: true,
  deviceTarget: "all",
};

// Wizard Steps for Sticky Add to Cart
const STICKY_STEPS = [
  { id: 1, title: "Placement & Triggers", shortTitle: "Placement", subtitle: "Position & display conditions" },
  { id: 2, title: "Product & Cart Elements", shortTitle: "Elements", subtitle: "Thumbnail, badge & quantity" },
  { id: 3, title: "Button Text & Action", shortTitle: "Button & Flow", subtitle: "CTA text & post-add flow" },
  { id: 4, title: "Colors & Styling", shortTitle: "Design", subtitle: "Branding, colors & corner radius" },
];

// Wizard Steps for Cart Drawer
const DRAWER_STEPS = [
  { id: 1, title: "Free Shipping Progress Bar", shortTitle: "Shipping Bar", subtitle: "Goal threshold, bar colors & text" },
  { id: 2, title: "Product Add-ons & Upsells", shortTitle: "Add-ons", subtitle: "1-Click cross-sell companion items" },
  { id: 3, title: "Drawer Elements & Flow", shortTitle: "Elements & Flow", subtitle: "Notes, checkout button & position" },
  { id: 4, title: "Theme Font & Styling", shortTitle: "Theme & Design", subtitle: "Theme font inheritance, colors & radius" },
];

// Wizard Steps for Announcement Bar
const ANNOUNCEMENT_STEPS = [
  { id: 1, title: "Mode & Messages", shortTitle: "Content & Mode", subtitle: "Ticker, rotating or static & text" },
  { id: 2, title: "Design & Behavior", shortTitle: "Design & Controls", subtitle: "Colors, font, sticky & timing" },
];

export interface DashboardLoaderData {
  shop: string;
  stickySettings: StickyCartSettings;
  cartDrawerSettings: CartDrawerSettings;
  announcementBarSettings?: AnnouncementBarSettings;
  storeProducts?: any[];
  initialFeature: "sticky-cart" | "cart-drawer" | "announcement-bar";
  themeEditorUrl: string;
}

export function TotalBundleDashboard({ forcedFeature }: { forcedFeature?: "sticky-cart" | "cart-drawer" | "announcement-bar" }) {
  const loaderData = useLoaderData<DashboardLoaderData>();
  const {
    shop,
    stickySettings: initialStickySettings,
    cartDrawerSettings: initialDrawerSettings,
    storeProducts: initialStoreProducts = [],
    initialFeature: loaderFeature,
    themeEditorUrl,
  } = loaderData;

  const actionData = useActionData<{ success?: boolean; feature?: string }>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const appBridge = useAppBridge();

  const isSaving = navigation.state === "submitting";

  // Store Product Picker states
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [activeStoreProducts, setActiveStoreProducts] = useState<any[]>(initialStoreProducts || []);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Top-level category / module selector: "sticky-cart" | "cart-drawer" | "announcement-bar"
  const [activeFeature, setActiveFeature] = useState<"sticky-cart" | "cart-drawer" | "announcement-bar">(
    forcedFeature || loaderFeature || "sticky-cart"
  );

  useEffect(() => {
    if (forcedFeature) {
      setActiveFeature(forcedFeature);
    }
  }, [forcedFeature]);

  // Stepper states
  const [stickyStep, setStickyStep] = useState<number>(1);
  const [drawerStep, setDrawerStep] = useState<number>(1);
  const [announcementStep, setAnnouncementStep] = useState<number>(1);

  // Settings states (kept strictly separate)
  const [stickySettings, setStickySettings] = useState<StickyCartSettings>(initialStickySettings);
  const [drawerSettings, setDrawerSettings] = useState<CartDrawerSettings>(initialDrawerSettings);
  const [announcementSettings, setAnnouncementSettings] = useState<AnnouncementBarSettings>(
    loaderData.announcementBarSettings || defaultAnnouncementBarFallback
  );

  // Live preview states
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("desktop");
  const [stickyPreviewAdded, setStickyPreviewAdded] = useState(false);
  const [stickyPreviewQty, setStickyPreviewQty] = useState(1);

  // Cart Drawer preview states
  const [drawerPreviewItems, setDrawerPreviewItems] = useState([
    {
      id: "demo-item-1",
      title: "Classic Cotton Crewneck",
      variant: "Heather Grey / L",
      price: 34.0,
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_small.png",
      quantity: 1,
    },
  ]);
  const [drawerNoteOpen, setDrawerNoteOpen] = useState(false);
  const [drawerNoteText, setDrawerNoteText] = useState("");
  const [drawerAddedAlert, setDrawerAddedAlert] = useState<string | null>(null);

  // Calculate drawer preview totals
  const drawerSubtotal = drawerPreviewItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const freeShippingThreshold = drawerSettings.freeShippingThreshold || 50;
  const freeShippingPercent = Math.min(100, Math.round((drawerSubtotal / freeShippingThreshold) * 100));
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - drawerSubtotal);

  // Announcement bar live preview slide rotation
  const [announcementPreviewIdx, setAnnouncementPreviewIdx] = useState(0);

  useEffect(() => {
    if (activeFeature !== "announcement-bar" || announcementSettings.mode !== "rotating") return;
    const ms = Math.max(2000, (announcementSettings.rotationInterval || 4) * 1000);
    const interval = setInterval(() => {
      setAnnouncementPreviewIdx((prev) => {
        const count = announcementSettings.messages?.length || 1;
        return (prev + 1) % count;
      });
    }, ms);
    return () => clearInterval(interval);
  }, [activeFeature, announcementSettings.mode, announcementSettings.rotationInterval, announcementSettings.messages]);

  useEffect(() => {
    if (actionData?.success) {
      if (actionData.feature === "announcement-bar") {
        appBridge.toast.show("Announcement Bar settings saved & synced to theme!");
      } else if (actionData.feature === "cart-drawer") {
        appBridge.toast.show("Cart Drawer settings saved & synced to theme!");
      } else {
        appBridge.toast.show("Sticky Add to Cart settings saved & synced!");
      }
    }
  }, [actionData, appBridge]);

  const handleSaveSticky = () => {
    submit(
      { feature: "sticky-cart", settings: JSON.stringify(stickySettings) },
      { method: "POST" }
    );
  };

  const handleSaveDrawer = () => {
    submit(
      { feature: "cart-drawer", settings: JSON.stringify(drawerSettings) },
      { method: "POST" }
    );
  };

  const handleSaveAnnouncement = () => {
    submit(
      { feature: "announcement-bar", settings: JSON.stringify(announcementSettings) },
      { method: "POST" }
    );
  };

  // Sticky Presets
  const applyStickyPreset = (preset: {
    bg: string;
    text: string;
    btnBg: string;
    btnText: string;
    btnHover: string;
    radius: number;
  }) => {
    setStickySettings((prev) => ({
      ...prev,
      bgColor: preset.bg,
      textColor: preset.text,
      buttonBgColor: preset.btnBg,
      buttonTextColor: preset.btnText,
      buttonHoverBgColor: preset.btnHover,
      borderRadius: preset.radius,
    }));
  };

  // Drawer Presets
  const applyDrawerPreset = (preset: {
    bg: string;
    text: string;
    muted: string;
    border: string;
    checkoutBg: string;
    checkoutText: string;
    checkoutHover: string;
    barColor: string;
    radius: number;
  }) => {
    setDrawerSettings((prev) => ({
      ...prev,
      bgColor: preset.bg,
      textColor: preset.text,
      mutedTextColor: preset.muted,
      borderColor: preset.border,
      checkoutButtonBgColor: preset.checkoutBg,
      checkoutButtonTextColor: preset.checkoutText,
      checkoutButtonHoverBgColor: preset.checkoutHover,
      freeShippingBarColor: preset.barColor,
      borderRadius: preset.radius,
    }));
  };

  // Addon management in step 2
  const handleAddAddonItem = () => {
    const newItem: CartDrawerAddon = {
      id: `addon-${Date.now()}`,
      title: "Premium Protective Case",
      price: "$12.99",
      compareAtPrice: "$18.00",
      image: "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-2_small.png",
      variantId: "",
    };
    setDrawerSettings((prev) => ({
      ...prev,
      addonItems: [...(prev.addonItems || []), newItem],
    }));
  };

  const handleRemoveAddonItem = (id: string) => {
    setDrawerSettings((prev) => ({
      ...prev,
      addonItems: (prev.addonItems || []).filter((item) => item.id !== id),
    }));
  };

  const handleUpdateAddonItem = (id: string, updates: Partial<CartDrawerAddon>) => {
    setDrawerSettings((prev) => ({
      ...prev,
      addonItems: (prev.addonItems || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  };

  // Announcement Bar message management
  const handleAddAnnouncementMessage = () => {
    const newMsg: AnnouncementBarMessage = {
      id: `msg-${Date.now()}`,
      text: "✨ Exclusive limited time deal - Shop today!",
      link: "",
    };
    setAnnouncementSettings((prev) => ({
      ...prev,
      messages: [...(prev.messages || []), newMsg],
    }));
  };

  const handleRemoveAnnouncementMessage = (id: string) => {
    setAnnouncementSettings((prev) => ({
      ...prev,
      messages: (prev.messages || []).filter((m) => m.id !== id),
    }));
  };

  const handleUpdateAnnouncementMessage = (id: string, updates: Partial<AnnouncementBarMessage>) => {
    setAnnouncementSettings((prev) => ({
      ...prev,
      messages: (prev.messages || []).map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  // Launch Shopify ResourcePicker or built-in Product Modal
  const handleOpenProductPicker = async () => {
    try {
      if (typeof window !== "undefined" && (window as any).shopify?.resourcePicker) {
        const selection = await (window as any).shopify.resourcePicker({
          type: "product",
          multiple: true,
        });

        if (selection && Array.isArray(selection) && selection.length > 0) {
          const newAddons: CartDrawerAddon[] = [];
          selection.forEach((prod: any, idx: number) => {
            const variant = prod.variants?.[0];
            const rawVariantId = variant?.id || "";
            const numericVariantId = String(rawVariantId).replace("gid://shopify/ProductVariant/", "");
            const imgUrl = variant?.image?.originalSrc || prod.images?.[0]?.originalSrc || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_small.png";
            const price = variant?.price ? (String(variant.price).startsWith("$") ? String(variant.price) : `$${variant.price}`) : "$0.00";
            const comparePrice = variant?.compareAtPrice ? (String(variant.compareAtPrice).startsWith("$") ? String(variant.compareAtPrice) : `$${variant.compareAtPrice}`) : "";

            newAddons.push({
              id: `addon-store-${Date.now()}-${idx}`,
              title: prod.title + (variant?.title && variant.title !== "Default Title" ? ` (${variant.title})` : ""),
              price: price,
              compareAtPrice: comparePrice,
              image: imgUrl,
              variantId: numericVariantId,
            });
          });

          setDrawerSettings((prev) => ({
            ...prev,
            addonItems: [...(prev.addonItems || []).filter((it) => it.variantId), ...newAddons],
          }));
          return;
        }
      }
    } catch (err) {
      console.warn("[ResourcePicker] Native picker not available, opening built-in modal:", err);
    }

    setPickerSearchQuery("");
    setActiveStoreProducts(initialStoreProducts || []);
    setProductPickerOpen(true);
  };

  const handleSearchStoreProducts = async (query: string) => {
    setPickerSearchQuery(query);
    if (!query.trim()) {
      setActiveStoreProducts(initialStoreProducts || []);
      return;
    }
    setIsSearchingProducts(true);
    try {
      const res = await fetch(`/api/store-products?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.products)) {
        setActiveStoreProducts(data.products);
      }
    } catch (e) {
      console.error("Failed to search products:", e);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const handleSelectStoreVariant = (product: any, variant: any) => {
    const numericVariantId = String(variant.numericId || variant.id || "").replace("gid://shopify/ProductVariant/", "");
    const newAddon: CartDrawerAddon = {
      id: `addon-store-${Date.now()}`,
      title: product.title + (variant.title && variant.title !== "Default Title" ? ` (${variant.title})` : ""),
      price: variant.price || "$0.00",
      compareAtPrice: variant.compareAtPrice || "",
      image: variant.image || product.image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-lifestyle-1_small.png",
      variantId: numericVariantId,
    };

    setDrawerSettings((prev) => ({
      ...prev,
      addonItems: [...(prev.addonItems || []).filter((it) => it.variantId), newAddon],
    }));
    setProductPickerOpen(false);
  };

  // Drawer Preview interactions
  const handleDrawerItemQty = (id: string, delta: number) => {
    setDrawerPreviewItems((prev) =>
      prev
        .map((it) => (it.id === id ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const handleDrawerRemoveItem = (id: string) => {
    setDrawerPreviewItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddPreviewAddon = (addon: CartDrawerAddon) => {
    const numericPrice = parseFloat(addon.price.replace(/[^0-9.]/g, "")) || 4.99;
    setDrawerPreviewItems((prev) => {
      const existing = prev.find((it) => it.title === addon.title);
      if (existing) {
        return prev.map((it) =>
          it.title === addon.title ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}`,
          title: addon.title,
          variant: "Add-on Extra",
          price: numericPrice,
          image: addon.image,
          quantity: 1,
        },
      ];
    });

    setDrawerAddedAlert(`Added "${addon.title}" to cart!`);
    setTimeout(() => setDrawerAddedAlert(null), 2500);
  };

  const handleStickyPreviewAdd = () => {
    setStickyPreviewAdded(true);
    setTimeout(() => setStickyPreviewAdded(false), 2200);
  };

  return (
    <Page
      fullWidth
      title={activeFeature === "sticky-cart" ? "Sticky Add to Cart" : "Cart Drawer & Add-ons"}
      subtitle={
        activeFeature === "sticky-cart"
          ? "Customize and manage your high-converting product buy bar directly from this dashboard."
          : "Slide-out Ajax cart with Free Shipping progress bar, 1-click product add-ons, and theme font styling."
      }
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Settings",
        onAction: activeFeature === "sticky-cart" ? handleSaveSticky : handleSaveDrawer,
        loading: isSaving,
      }}
      secondaryActions={[
        {
          content: "Theme Editor",
          icon: ExternalIcon,
          url: themeEditorUrl,
          target: "_blank",
        },
        {
          content: "Preview Storefront",
          icon: ExternalIcon,
          url: `https://${shop}`,
          target: "_blank",
        },
      ]}
    >
      <TitleBar
        title={
          activeFeature === "sticky-cart"
            ? "Sticky Add to Cart"
            : activeFeature === "cart-drawer"
            ? "Cart Drawer"
            : "Announcement Bar"
        }
      />

      <BlockStack gap="500">
        {/* ========================================================= */}
        {/* TOP-LEVEL CATEGORY SELECTOR (Separate Views)              */}
        {/* ========================================================= */}
        <Card padding="400">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <InlineStack gap="300" blockAlign="center">
              <button
                type="button"
                onClick={() => {
                  setActiveFeature("sticky-cart");
                  setStickyStep(1);
                  navigate("/app/sticky-cart");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: activeFeature === "sticky-cart" ? "2px solid #008060" : "1px solid #d2d5d8",
                  backgroundColor: activeFeature === "sticky-cart" ? "#f0fdf4" : "#ffffff",
                  color: activeFeature === "sticky-cart" ? "#008060" : "#202223",
                  fontWeight: activeFeature === "sticky-cart" ? "700" : "500",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: activeFeature === "sticky-cart" ? "0 2px 8px rgba(0,128,96,0.15)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "18px" }}>🛒</span>
                <span>Sticky Add to Cart</span>
                <Badge tone={activeFeature === "sticky-cart" ? "success" : "info"}>Active</Badge>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveFeature("cart-drawer");
                  setDrawerStep(1);
                  navigate("/app/cart-drawer");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: activeFeature === "cart-drawer" ? "2px solid #008060" : "1px solid #d2d5d8",
                  backgroundColor: activeFeature === "cart-drawer" ? "#f0fdf4" : "#ffffff",
                  color: activeFeature === "cart-drawer" ? "#008060" : "#202223",
                  fontWeight: activeFeature === "cart-drawer" ? "700" : "500",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: activeFeature === "cart-drawer" ? "0 2px 8px rgba(0,128,96,0.15)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "18px" }}>🛍️</span>
                <span>Cart Drawer & Add-ons</span>
                <Badge tone={activeFeature === "cart-drawer" ? "success" : "attention"}>Active</Badge>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveFeature("announcement-bar");
                  setAnnouncementStep(1);
                  navigate("/app/announcement-bar");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: activeFeature === "announcement-bar" ? "2px solid #008060" : "1px solid #d2d5d8",
                  backgroundColor: activeFeature === "announcement-bar" ? "#f0fdf4" : "#ffffff",
                  color: activeFeature === "announcement-bar" ? "#008060" : "#202223",
                  fontWeight: activeFeature === "announcement-bar" ? "700" : "500",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: activeFeature === "announcement-bar" ? "0 2px 8px rgba(0,128,96,0.15)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "18px" }}>📢</span>
                <span>Announcement Bar</span>
                <Badge tone={activeFeature === "announcement-bar" ? "success" : "info"}>Active</Badge>
              </button>
            </InlineStack>

            <Text as="p" variant="bodySm" tone="subdued">
              {activeFeature === "sticky-cart"
                ? "Configuring product page sticky buy bar"
                : activeFeature === "cart-drawer"
                ? "Configuring global slide-out cart drawer & upsells"
                : "Configuring header multi-mode announcement bar"}
            </Text>
          </InlineStack>
        </Card>

        {/* ========================================================= */}
        {/* VIEW 1: STICKY ADD TO CART                                */}
        {/* ========================================================= */}
        {activeFeature === "sticky-cart" && (
          <BlockStack gap="400">
            {/* Stepper Navigation */}
            <Card padding="300">
              <InlineStack gap="200" align="space-between" blockAlign="center" wrap>
                {STICKY_STEPS.map((s) => {
                  const isActive = stickyStep === s.id;
                  const isDone = stickyStep > s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStickyStep(s.id)}
                      style={{
                        flex: "1 1 180px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: isActive ? "2px solid #008060" : "1px solid #e1e3e5",
                        backgroundColor: isActive ? "#f0fdf4" : isDone ? "#fafbfb" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          backgroundColor: isActive ? "#008060" : isDone ? "#202223" : "#e1e3e5",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: "700",
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? "✓" : s.id}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? "#008060" : "#202223",
                            lineHeight: 1.2,
                          }}
                        >
                          {s.shortTitle}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#6d7175",
                            lineHeight: 1.2,
                          }}
                        >
                          {s.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </InlineStack>
            </Card>

            <Layout>
              {/* Left Column: Active Step Settings */}
              <Layout.Section>
                <BlockStack gap="400">
                  {/* Step 1: Placement & Triggers */}
                  {stickyStep === 1 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Placement & Triggers</Text>
                          <Badge tone="info">Storefront</Badge>
                        </InlineStack>
                        <Divider />
                        <Checkbox
                          label="Enable Sticky Add to Cart Bar"
                          helpText="Master switch for the sticky buy bar across all product pages."
                          checked={stickySettings.enabled}
                          onChange={(val) => setStickySettings({ ...stickySettings, enabled: val })}
                        />
                        <Select
                          label="Bar Position"
                          options={[
                            { label: "Bottom of screen (Recommended for Mobile & Desktop)", value: "bottom" },
                            { label: "Top of screen", value: "top" },
                          ]}
                          value={stickySettings.position}
                          onChange={(val) => setStickySettings({ ...stickySettings, position: val as any })}
                        />
                        <Select
                          label="When to Display"
                          options={[
                            { label: "Show after scrolling past product form", value: "scroll" },
                            { label: "Always visible on page load", value: "always" },
                          ]}
                          value={stickySettings.desktopVisibility}
                          onChange={(val) => setStickySettings({ ...stickySettings, desktopVisibility: val as any })}
                        />
                        <InlineStack gap="400">
                          <Checkbox
                            label="Show on Mobile devices"
                            checked={stickySettings.showOnMobile}
                            onChange={(val) => setStickySettings({ ...stickySettings, showOnMobile: val })}
                          />
                          <Checkbox
                            label="Show on Desktop screens"
                            checked={stickySettings.showOnDesktop}
                            onChange={(val) => setStickySettings({ ...stickySettings, showOnDesktop: val })}
                          />
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 2: Elements */}
                  {stickyStep === 2 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Product & Cart Elements</Text>
                          <Badge tone="info">Display</Badge>
                        </InlineStack>
                        <Divider />
                        <Checkbox
                          label="Show Product Thumbnail"
                          helpText="Shows the current product or selected variant image inside the bar."
                          checked={stickySettings.showThumbnail}
                          onChange={(val) => setStickySettings({ ...stickySettings, showThumbnail: val })}
                        />
                        <Checkbox
                          label="Show Compare-at Price & Discount Badge"
                          helpText="Highlights regular price and savings badge (e.g., Save 20%) when items are discounted."
                          checked={stickySettings.showCompareAtPrice}
                          onChange={(val) => setStickySettings({ ...stickySettings, showCompareAtPrice: val })}
                        />
                        <Checkbox
                          label="Show Quantity Selector (- 1 +)"
                          helpText="Enables customers to adjust units directly within the sticky bar."
                          checked={stickySettings.showQuantity}
                          onChange={(val) => setStickySettings({ ...stickySettings, showQuantity: val })}
                        />
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 3: Button & Flow */}
                  {stickyStep === 3 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Button Text & Post-Add Action</Text>
                          <Badge tone="info">Conversion</Badge>
                        </InlineStack>
                        <Divider />
                        <InlineStack gap="300">
                          <Box width="48%">
                            <TextField
                              label="Button Text (In Stock)"
                              value={stickySettings.buttonText}
                              onChange={(val) => setStickySettings({ ...stickySettings, buttonText: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Button Text (Sold Out)"
                              value={stickySettings.soldOutText}
                              onChange={(val) => setStickySettings({ ...stickySettings, soldOutText: val })}
                              autoComplete="off"
                            />
                          </Box>
                        </InlineStack>
                        <Select
                          label="Action After Adding to Cart"
                          options={[
                            { label: "Open Slide-out Cart Drawer (Recommended)", value: "cart" },
                            { label: "Stay on page & show 'Added to Cart' confirmation", value: "stay" },
                            { label: "Instant 1-Click Redirect to Checkout", value: "checkout" },
                          ]}
                          value={stickySettings.afterAddAction}
                          onChange={(val) => setStickySettings({ ...stickySettings, afterAddAction: val as any })}
                          helpText="Choose what happens when the customer clicks the sticky Add to Cart button."
                        />
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 4: Design */}
                  {stickyStep === 4 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Colors & Styling</Text>
                          <Badge tone="info">Branding</Badge>
                        </InlineStack>
                        <Divider />
                        <Text as="p" variant="bodySm" tone="subdued">
                          Quick Presets:
                        </Text>
                        <ButtonGroup>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyStickyPreset({
                                bg: "#ffffff",
                                text: "#121212",
                                btnBg: "#121212",
                                btnText: "#ffffff",
                                btnHover: "#2e2e2e",
                                radius: 8,
                              })
                            }
                          >
                            Minimalist Black & White
                          </Button>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyStickyPreset({
                                bg: "#ffffff",
                                text: "#121212",
                                btnBg: "#008060",
                                btnText: "#ffffff",
                                btnHover: "#006e52",
                                radius: 8,
                              })
                            }
                          >
                            Shopify Green
                          </Button>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyStickyPreset({
                                bg: "#1f2937",
                                text: "#f9fafb",
                                btnBg: "#3b82f6",
                                btnText: "#ffffff",
                                btnHover: "#2563eb",
                                radius: 12,
                              })
                            }
                          >
                            Modern Dark
                          </Button>
                        </ButtonGroup>

                        <Divider />

                        <InlineStack gap="300" wrap>
                          <Box width="48%">
                            <TextField
                              label="Bar Background"
                              value={stickySettings.bgColor}
                              onChange={(val) => setStickySettings({ ...stickySettings, bgColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Text Color"
                              value={stickySettings.textColor}
                              onChange={(val) => setStickySettings({ ...stickySettings, textColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Button Background"
                              value={stickySettings.buttonBgColor}
                              onChange={(val) => setStickySettings({ ...stickySettings, buttonBgColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Button Text Color"
                              value={stickySettings.buttonTextColor}
                              onChange={(val) => setStickySettings({ ...stickySettings, buttonTextColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                        </InlineStack>

                        <RangeSlider
                          label={`Corner Border Radius: ${stickySettings.borderRadius}px`}
                          value={stickySettings.borderRadius}
                          onChange={(val) => setStickySettings({ ...stickySettings, borderRadius: Number(val) })}
                          min={0}
                          max={24}
                          step={2}
                          output
                        />
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step Navigation Controls */}
                  <Card padding="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Button
                        disabled={stickyStep === 1}
                        onClick={() => setStickyStep((prev) => Math.max(1, prev - 1))}
                      >
                        ← Back
                      </Button>
                      <InlineStack gap="200">
                        {stickyStep < 4 ? (
                          <Button
                            variant="primary"
                            onClick={() => setStickyStep((prev) => Math.min(4, prev + 1))}
                          >
                            Next Step →
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            loading={isSaving}
                            onClick={handleSaveSticky}
                          >
                            Save Settings
                          </Button>
                        )}
                      </InlineStack>
                    </InlineStack>
                  </Card>
                </BlockStack>
              </Layout.Section>

              {/* Right Column: Sticky Live Preview */}
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Live Storefront Preview</Text>
                      <ButtonGroup variant="segmented">
                        <Button
                          pressed={previewDevice === "desktop"}
                          size="micro"
                          onClick={() => setPreviewDevice("desktop")}
                        >
                          Desktop
                        </Button>
                        <Button
                          pressed={previewDevice === "mobile"}
                          size="micro"
                          onClick={() => setPreviewDevice("mobile")}
                        >
                          Mobile
                        </Button>
                      </ButtonGroup>
                    </InlineStack>

                    <div
                      style={{
                        backgroundColor: "#f6f6f7",
                        border: "1px solid #d2d5d8",
                        borderRadius: "10px",
                        padding: "16px 12px",
                        minHeight: "260px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ textAlign: "center", marginBottom: "auto", padding: "10px 0" }}>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Simulated Product Page View
                        </Text>
                        <Text as="p" variant="headingMd">
                          Classic Cotton Crewneck
                        </Text>
                        <Text as="p" variant="bodyMd" tone="subdued">
                          $34.00 USD
                        </Text>
                      </div>

                      {/* Sticky Bar Mockup */}
                      <div
                        style={{
                          backgroundColor: stickySettings.bgColor,
                          color: stickySettings.textColor,
                          borderRadius: `${stickySettings.borderRadius}px`,
                          padding: `${stickySettings.padding}px`,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {stickySettings.showThumbnail && (
                          <div
                            style={{
                              width: "38px",
                              height: "38px",
                              borderRadius: "4px",
                              backgroundColor: "#e1e3e5",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "18px",
                              flexShrink: 0,
                            }}
                          >
                            👕
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              fontSize: "12px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            Classic Cotton Tee
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 700, fontSize: "12px" }}>$34.00</span>
                            {stickySettings.showCompareAtPrice && (
                              <span style={{ fontSize: "11px", textDecoration: "line-through", opacity: 0.6 }}>
                                $45.00
                              </span>
                            )}
                          </div>
                        </div>

                        {stickySettings.showQuantity && (
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              border: "1px solid rgba(0,0,0,0.15)",
                              borderRadius: "4px",
                              overflow: "hidden",
                              fontSize: "11px",
                              background: "#ffffff",
                              color: "#121212",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setStickyPreviewQty((q) => Math.max(1, q - 1))}
                              style={{ border: "none", background: "transparent", padding: "2px 6px", cursor: "pointer" }}
                            >
                              -
                            </button>
                            <span style={{ padding: "0 4px", fontWeight: "600" }}>{stickyPreviewQty}</span>
                            <button
                              type="button"
                              onClick={() => setStickyPreviewQty((q) => q + 1)}
                              style={{ border: "none", background: "transparent", padding: "2px 6px", cursor: "pointer" }}
                            >
                              +
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleStickyPreviewAdd}
                          style={{
                            backgroundColor: stickyPreviewAdded ? "#108043" : stickySettings.buttonBgColor,
                            color: stickySettings.buttonTextColor,
                            border: "none",
                            borderRadius: `${Math.max(4, stickySettings.borderRadius - 2)}px`,
                            padding: "8px 14px",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "background-color 0.2s",
                          }}
                        >
                          {stickyPreviewAdded ? "✓ Added" : stickySettings.buttonText}
                        </button>
                      </div>
                    </div>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </BlockStack>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: CART DRAWER & PRODUCT ADD-ONS                     */}
        {/* ========================================================= */}
        {activeFeature === "cart-drawer" && (
          <BlockStack gap="400">
            {/* Stepper Navigation */}
            <Card padding="300">
              <InlineStack gap="200" align="space-between" blockAlign="center" wrap>
                {DRAWER_STEPS.map((s) => {
                  const isActive = drawerStep === s.id;
                  const isDone = drawerStep > s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDrawerStep(s.id)}
                      style={{
                        flex: "1 1 180px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: isActive ? "2px solid #008060" : "1px solid #e1e3e5",
                        backgroundColor: isActive ? "#f0fdf4" : isDone ? "#fafbfb" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          backgroundColor: isActive ? "#008060" : isDone ? "#202223" : "#e1e3e5",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: "700",
                          flexShrink: 0,
                        }}
                      >
                        {isDone ? "✓" : s.id}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          minWidth: 0,
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: isActive ? 700 : 600,
                            color: isActive ? "#008060" : "#202223",
                            lineHeight: 1.2,
                          }}
                        >
                          {s.shortTitle}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#6d7175",
                            lineHeight: 1.2,
                          }}
                        >
                          {s.subtitle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </InlineStack>
            </Card>

            <Layout>
              {/* Left Column: Active Step Settings */}
              <Layout.Section>
                <BlockStack gap="400">
                  {/* Step 1: Free Shipping Progress Bar */}
                  {drawerStep === 1 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Free Shipping Progress Bar</Text>
                          <Badge tone="success">High Impact</Badge>
                        </InlineStack>
                        <Divider />
                        <Checkbox
                          label="Enable Free Shipping Progress Bar at top of drawer"
                          helpText="Motivates buyers to add more items to hit your free shipping threshold."
                          checked={drawerSettings.freeShippingEnabled}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, freeShippingEnabled: val })}
                        />

                        <InlineStack gap="300">
                          <Box width="48%">
                            <TextField
                              type="number"
                              label="Free Shipping Goal Amount ($)"
                              value={String(drawerSettings.freeShippingThreshold)}
                              onChange={(val) =>
                                setDrawerSettings({
                                  ...drawerSettings,
                                  freeShippingThreshold: Math.max(1, Number(val) || 50),
                                })
                              }
                              autoComplete="off"
                              helpText="E.g., $50.00 cart subtotal for free shipping."
                            />
                          </Box>
                          <Box width="48%">
                            <BlockStack gap="100">
                              <Text as="span" variant="bodySm">Progress Bar Fill Color</Text>
                              <InlineStack gap="200" blockAlign="center">
                                <input
                                  type="color"
                                  value={drawerSettings.freeShippingBarColor || "#008060"}
                                  onChange={(e) =>
                                    setDrawerSettings({ ...drawerSettings, freeShippingBarColor: e.target.value })
                                  }
                                  style={{
                                    width: "40px",
                                    height: "36px",
                                    padding: "2px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    backgroundColor: "#fff",
                                  }}
                                  aria-label="Pick progress bar fill color"
                                />
                                <div style={{ flex: 1 }}>
                                  <TextField
                                    label=""
                                    labelHidden
                                    value={drawerSettings.freeShippingBarColor}
                                    onChange={(val) =>
                                      setDrawerSettings({ ...drawerSettings, freeShippingBarColor: val })
                                    }
                                    autoComplete="off"
                                  />
                                </div>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </InlineStack>

                        <TextField
                          label="In-progress Text Template"
                          value={drawerSettings.freeShippingText}
                          onChange={(val) =>
                            setDrawerSettings({ ...drawerSettings, freeShippingText: val })
                          }
                          helpText="Use {amount} as placeholder for the remaining dollar amount."
                          autoComplete="off"
                        />

                        <TextField
                          label="Goal Reached (Unlocked) Text"
                          value={drawerSettings.freeShippingSuccessText}
                          onChange={(val) =>
                            setDrawerSettings({ ...drawerSettings, freeShippingSuccessText: val })
                          }
                          autoComplete="off"
                        />

                        <BlockStack gap="100">
                          <Text as="span" variant="bodySm">Progress Bar Track (Background) Color</Text>
                          <InlineStack gap="200" blockAlign="center">
                            <input
                              type="color"
                              value={drawerSettings.freeShippingBarBgColor || "#e4e5e7"}
                              onChange={(e) =>
                                setDrawerSettings({ ...drawerSettings, freeShippingBarBgColor: e.target.value })
                              }
                              style={{
                                width: "40px",
                                height: "36px",
                                padding: "2px",
                                border: "1px solid #d1d5db",
                                borderRadius: "6px",
                                cursor: "pointer",
                                backgroundColor: "#fff",
                              }}
                              aria-label="Pick progress bar track color"
                            />
                            <div style={{ flex: 1 }}>
                              <TextField
                                label=""
                                labelHidden
                                value={drawerSettings.freeShippingBarBgColor}
                                onChange={(val) =>
                                  setDrawerSettings({ ...drawerSettings, freeShippingBarBgColor: val })
                                }
                                autoComplete="off"
                              />
                            </div>
                          </InlineStack>
                        </BlockStack>
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 2: Product Add-ons & Upsells */}
                  {drawerStep === 2 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Product Add-ons & Cross-Sells</Text>
                          <Badge tone="info">Boost AOV</Badge>
                        </InlineStack>
                        <Divider />
                        <Checkbox
                          label="Enable Product Add-ons inside Cart Drawer"
                          helpText="Displays companion upsells (e.g. warranty, gift wrap, matching item) with 1-click addition."
                          checked={drawerSettings.addonEnabled}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, addonEnabled: val })}
                        />

                        <TextField
                          label="Add-on Section Heading"
                          value={drawerSettings.addonHeading}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, addonHeading: val })}
                          autoComplete="off"
                        />

                        <InlineStack gap="300">
                          <Box width="48%">
                            <TextField
                              label="Add-on Button Label"
                              value={drawerSettings.addonButtonText}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, addonButtonText: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Add-on Button Background"
                              value={drawerSettings.addonButtonBgColor}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, addonButtonBgColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                        </InlineStack>

                        <Divider />

                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="050">
                            <Text as="h3" variant="headingSm">Configured Add-on Items</Text>
                            <Text as="p" variant="bodyXs" tone="subdued">
                              Select products directly from your Shopify store. Customers can add them to cart with 1 click.
                            </Text>
                          </BlockStack>
                          <ButtonGroup>
                            <Button
                              variant="primary"
                              icon={ProductIcon}
                              onClick={handleOpenProductPicker}
                            >
                              Select Products from Store
                            </Button>
                            <Button
                              icon={PlusIcon}
                              onClick={handleAddAddonItem}
                            >
                              + Add Custom Item
                            </Button>
                          </ButtonGroup>
                        </InlineStack>

                        {(!drawerSettings.addonItems || drawerSettings.addonItems.length === 0) ? (
                          <Box
                            padding="600"
                            background="bg-subdued"
                            borderRadius="200"
                            textAlign="center"
                          >
                            <BlockStack gap="200" inlineAlign="center">
                              <Icon source={ProductIcon} tone="subdued" />
                              <Text as="p" variant="bodySm" fontWeight="semibold">
                                No add-on products configured yet
                              </Text>
                              <Text as="p" variant="bodyXs" tone="subdued">
                                Select high-converting companion products from your catalog (e.g. gift wrap, warranties, accessories).
                              </Text>
                              <Box paddingBlockStart="200">
                                <Button variant="primary" icon={ProductIcon} onClick={handleOpenProductPicker}>
                                  Select Products from Store
                                </Button>
                              </Box>
                            </BlockStack>
                          </Box>
                        ) : (
                          <BlockStack gap="300">
                            {drawerSettings.addonItems.map((addon, index) => (
                              <Box
                                key={addon.id}
                                padding="300"
                                background="bg-subdued"
                                borderRadius="200"
                              >
                                <BlockStack gap="300">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                      <Text as="span" variant="bodySm" fontWeight="bold">
                                        Item #{index + 1}
                                      </Text>
                                      {addon.variantId ? (
                                        <Badge tone="success">Store Product Linked (ID: {addon.variantId})</Badge>
                                      ) : (
                                        <Badge tone="attention">Custom / Unlinked</Badge>
                                      )}
                                    </InlineStack>
                                    <InlineStack gap="150">
                                      <Button
                                        size="micro"
                                        variant="plain"
                                        icon={ProductIcon}
                                        onClick={handleOpenProductPicker}
                                      >
                                        Change Product
                                      </Button>
                                      <Button
                                        icon={DeleteIcon}
                                        variant="plain"
                                        tone="critical"
                                        onClick={() => handleRemoveAddonItem(addon.id)}
                                      >
                                        Remove
                                      </Button>
                                    </InlineStack>
                                  </InlineStack>

                                  <InlineStack gap="300" blockAlign="center">
                                    {addon.image ? (
                                      <Thumbnail
                                        source={addon.image}
                                        alt={addon.title}
                                        size="medium"
                                      />
                                    ) : (
                                      <Box
                                        width="60px"
                                        height="60px"
                                        background="bg-surface-secondary"
                                        borderRadius="200"
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                      >
                                        <Icon source={ProductIcon} />
                                      </Box>
                                    )}
                                    <Box width="85%">
                                      <InlineStack gap="300">
                                        <Box width="48%">
                                          <TextField
                                            label="Title"
                                            value={addon.title}
                                            onChange={(val) => handleUpdateAddonItem(addon.id, { title: val })}
                                            autoComplete="off"
                                          />
                                        </Box>
                                        <Box width="48%">
                                          <TextField
                                            label="Price"
                                            value={addon.price}
                                            onChange={(val) => handleUpdateAddonItem(addon.id, { price: val })}
                                            autoComplete="off"
                                          />
                                        </Box>
                                      </InlineStack>
                                    </Box>
                                  </InlineStack>

                                  <InlineStack gap="300">
                                    <Box width="48%">
                                      <TextField
                                        label="Compare-at Price (Optional)"
                                        value={addon.compareAtPrice || ""}
                                        onChange={(val) => handleUpdateAddonItem(addon.id, { compareAtPrice: val })}
                                        autoComplete="off"
                                      />
                                    </Box>
                                    <Box width="48%">
                                      <TextField
                                        label="Shopify Variant ID"
                                        value={addon.variantId || ""}
                                        onChange={(val) => handleUpdateAddonItem(addon.id, { variantId: val })}
                                        autoComplete="off"
                                        helpText="Numeric variant ID added to cart when customer clicks + Add"
                                      />
                                    </Box>
                                  </InlineStack>
                                </BlockStack>
                              </Box>
                            ))}
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 3: Drawer Flow & Elements */}
                  {drawerStep === 3 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Drawer Elements & Flow</Text>
                          <Badge tone="info">Checkout Flow</Badge>
                        </InlineStack>
                        <Divider />
                        <Checkbox
                          label="Enable Slide-out Cart Drawer"
                          helpText="Master switch for the slide-out cart drawer."
                          checked={drawerSettings.enabled}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, enabled: val })}
                        />

                        <Select
                          label="Drawer Slide Position"
                          options={[
                            { label: "Slide from Right (Standard)", value: "right" },
                            { label: "Slide from Left", value: "left" },
                          ]}
                          value={drawerSettings.drawerPosition}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, drawerPosition: val as any })}
                        />

                        <RangeSlider
                          label={`Desktop Drawer Width: ${drawerSettings.drawerWidth}px (Responsive 100% on Mobile)`}
                          value={drawerSettings.drawerWidth}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, drawerWidth: Number(val) })}
                          min={360}
                          max={540}
                          step={10}
                          output
                        />

                        <Divider />

                        <Checkbox
                          label="Show Order Notes / Special Instructions"
                          checked={drawerSettings.showCartNote}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, showCartNote: val })}
                        />

                        {drawerSettings.showCartNote && (
                          <TextField
                            label="Order Note Placeholder"
                            value={drawerSettings.cartNotePlaceholder}
                            onChange={(val) => setDrawerSettings({ ...drawerSettings, cartNotePlaceholder: val })}
                            autoComplete="off"
                          />
                        )}

                        <Checkbox
                          label="Show 'View Cart Page' link"
                          checked={drawerSettings.showViewCartButton}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, showViewCartButton: val })}
                        />

                        <TextField
                          label="Checkout Button Label"
                          value={drawerSettings.checkoutButtonText}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, checkoutButtonText: val })}
                          autoComplete="off"
                        />

                        <TextField
                          label="Empty Cart Message"
                          value={drawerSettings.emptyCartText}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, emptyCartText: val })}
                          autoComplete="off"
                        />
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step 4: Theme Font & Styling */}
                  {drawerStep === 4 && (
                    <Card>
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h2" variant="headingMd">Theme Font & Styling</Text>
                          <Badge tone="info">Styling</Badge>
                        </InlineStack>
                        <Divider />

                        <Banner tone="info">
                          <p>
                            <strong>Theme Inheritance Active:</strong> When enabled, the cart drawer automatically adopts your Shopify theme's typography, button styles, and corner radius.
                          </p>
                        </Banner>

                        <Checkbox
                          label="Inherit Theme Fonts & Styling (Recommended)"
                          helpText="Uses theme CSS variables (--font-body-family, --font-heading-family) for 100% visual harmony."
                          checked={drawerSettings.inheritThemeStyling}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, inheritThemeStyling: val })}
                        />

                        <Select
                          label="Font Family Override"
                          options={[
                            { label: "Inherit Theme Font (Default)", value: "inherit" },
                            { label: "Inter (Clean & Modern Sans)", value: "Inter, sans-serif" },
                            { label: "Roboto (Universal Clean)", value: "Roboto, sans-serif" },
                            { label: "Poppins (Geometric Modern)", value: "Poppins, sans-serif" },
                            { label: "Montserrat (Editorial Modern)", value: "Montserrat, sans-serif" },
                            { label: "Playfair Display (Luxury Serif)", value: "'Playfair Display', serif" },
                            { label: "System UI (Native OS Font)", value: "system-ui, sans-serif" },
                          ]}
                          value={drawerSettings.fontFamily}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, fontFamily: val })}
                        />

                        <InlineStack gap="300">
                          <Box width="48%">
                            <RangeSlider
                              label={`Base Font Size: ${drawerSettings.baseFontSize}px`}
                              value={drawerSettings.baseFontSize}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, baseFontSize: Number(val) })}
                              min={12}
                              max={18}
                              step={1}
                              output
                            />
                          </Box>
                          <Box width="48%">
                            <RangeSlider
                              label={`Heading Font Size: ${drawerSettings.headingFontSize}px`}
                              value={drawerSettings.headingFontSize}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, headingFontSize: Number(val) })}
                              min={14}
                              max={24}
                              step={1}
                              output
                            />
                          </Box>
                        </InlineStack>

                        <Divider />

                        <Text as="p" variant="bodySm" tone="subdued">
                          Quick Color & Design Presets:
                        </Text>
                        <ButtonGroup>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyDrawerPreset({
                                bg: "#ffffff",
                                text: "#121212",
                                muted: "#6d7175",
                                border: "#e5e7eb",
                                checkoutBg: "#121212",
                                checkoutText: "#ffffff",
                                checkoutHover: "#2e2e2e",
                                barColor: "#008060",
                                radius: 8,
                              })
                            }
                          >
                            Minimal Clean
                          </Button>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyDrawerPreset({
                                bg: "#111827",
                                text: "#f9fafb",
                                muted: "#9ca3af",
                                border: "#374151",
                                checkoutBg: "#ffffff",
                                checkoutText: "#111827",
                                checkoutHover: "#e5e7eb",
                                barColor: "#10b981",
                                radius: 8,
                              })
                            }
                          >
                            Dark Mode
                          </Button>
                          <Button
                            size="micro"
                            onClick={() =>
                              applyDrawerPreset({
                                bg: "#ffffff",
                                text: "#18181b",
                                muted: "#71717a",
                                border: "#e4e4e7",
                                checkoutBg: "#059669",
                                checkoutText: "#ffffff",
                                checkoutHover: "#047857",
                                barColor: "#059669",
                                radius: 12,
                              })
                            }
                          >
                            Emerald Forest
                          </Button>
                        </ButtonGroup>

                        <Divider />

                        <InlineStack gap="300" wrap>
                          <Box width="48%">
                            <TextField
                              label="Drawer Background"
                              value={drawerSettings.bgColor}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, bgColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Main Text Color"
                              value={drawerSettings.textColor}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, textColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Muted Text Color"
                              value={drawerSettings.mutedTextColor}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, mutedTextColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Border & Divider Color"
                              value={drawerSettings.borderColor}
                              onChange={(val) => setDrawerSettings({ ...drawerSettings, borderColor: val })}
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Checkout Button Background"
                              value={drawerSettings.checkoutButtonBgColor}
                              onChange={(val) =>
                                setDrawerSettings({ ...drawerSettings, checkoutButtonBgColor: val })
                              }
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <TextField
                              label="Checkout Button Text"
                              value={drawerSettings.checkoutButtonTextColor}
                              onChange={(val) =>
                                setDrawerSettings({ ...drawerSettings, checkoutButtonTextColor: val })
                              }
                              autoComplete="off"
                            />
                          </Box>
                          <Box width="48%">
                            <BlockStack gap="100">
                              <Text as="span" variant="bodySm">Free Shipping Bar Color</Text>
                              <InlineStack gap="200" blockAlign="center">
                                <input
                                  type="color"
                                  value={drawerSettings.freeShippingBarColor || "#008060"}
                                  onChange={(e) =>
                                    setDrawerSettings({ ...drawerSettings, freeShippingBarColor: e.target.value })
                                  }
                                  style={{
                                    width: "40px",
                                    height: "36px",
                                    padding: "2px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    backgroundColor: "#fff",
                                  }}
                                  aria-label="Pick free shipping bar color"
                                />
                                <div style={{ flex: 1 }}>
                                  <TextField
                                    label=""
                                    labelHidden
                                    value={drawerSettings.freeShippingBarColor}
                                    onChange={(val) =>
                                      setDrawerSettings({ ...drawerSettings, freeShippingBarColor: val })
                                    }
                                    autoComplete="off"
                                  />
                                </div>
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        </InlineStack>

                        <RangeSlider
                          label={`Corner Border Radius: ${drawerSettings.borderRadius}px`}
                          value={drawerSettings.borderRadius}
                          onChange={(val) => setDrawerSettings({ ...drawerSettings, borderRadius: Number(val) })}
                          min={0}
                          max={24}
                          step={2}
                          output
                        />
                      </BlockStack>
                    </Card>
                  )}

                  {/* Step Navigation Controls */}
                  <Card padding="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Button
                        disabled={drawerStep === 1}
                        onClick={() => setDrawerStep((prev) => Math.max(1, prev - 1))}
                      >
                        ← Back
                      </Button>
                      <InlineStack gap="200">
                        {drawerStep < 4 ? (
                          <Button
                            variant="primary"
                            onClick={() => setDrawerStep((prev) => Math.min(4, prev + 1))}
                          >
                            Next Step →
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            loading={isSaving}
                            onClick={handleSaveDrawer}
                          >
                            Save Settings
                          </Button>
                        )}
                      </InlineStack>
                    </InlineStack>
                  </Card>
                </BlockStack>
              </Layout.Section>

              {/* Right Column: Live Interactive Cart Drawer Preview */}
              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Live Drawer Preview</Text>
                      <ButtonGroup variant="segmented">
                        <Button
                          pressed={previewDevice === "desktop"}
                          size="micro"
                          onClick={() => setPreviewDevice("desktop")}
                        >
                          Desktop
                        </Button>
                        <Button
                          pressed={previewDevice === "mobile"}
                          size="micro"
                          onClick={() => setPreviewDevice("mobile")}
                        >
                          Mobile
                        </Button>
                      </ButtonGroup>
                    </InlineStack>

                    {drawerAddedAlert && (
                      <Banner tone="success" onDismiss={() => setDrawerAddedAlert(null)}>
                        {drawerAddedAlert}
                      </Banner>
                    )}

                    {/* Interactive Slide-out Drawer Frame */}
                    <div
                      style={{
                        backgroundColor: "#f1f2f4",
                        borderRadius: "12px",
                        padding: previewDevice === "mobile" ? "8px" : "12px",
                        border: "1px solid #d2d5d8",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: previewDevice === "mobile" ? "100%" : "360px",
                          maxWidth: "100%",
                          backgroundColor: drawerSettings.bgColor,
                          color: drawerSettings.textColor,
                          fontFamily:
                            drawerSettings.inheritThemeStyling || drawerSettings.fontFamily === "inherit"
                              ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                              : drawerSettings.fontFamily,
                          fontSize: `${drawerSettings.baseFontSize}px`,
                          borderRadius: `${drawerSettings.borderRadius}px`,
                          border: `1px solid ${drawerSettings.borderColor}`,
                          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                        }}
                      >
                        {/* Drawer Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            borderBottom: `1px solid ${drawerSettings.borderColor}`,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ fontSize: `${drawerSettings.headingFontSize}px` }}>Your Cart</strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                backgroundColor: drawerSettings.borderColor,
                                padding: "1px 6px",
                                borderRadius: "999px",
                              }}
                            >
                              {drawerPreviewItems.reduce((acc, it) => acc + it.quantity, 0)}
                            </span>
                          </div>
                          <span style={{ fontSize: "14px", opacity: 0.6, cursor: "pointer" }}>✕</span>
                        </div>

                        {/* Free Shipping Progress Bar */}
                        {drawerSettings.freeShippingEnabled && (
                          <div
                            style={{
                              padding: "10px 14px",
                              backgroundColor: "rgba(0,0,0,0.02)",
                              borderBottom: `1px solid ${drawerSettings.borderColor}`,
                            }}
                          >
                            <p
                              style={{
                                margin: "0 0 6px 0",
                                fontSize: "12px",
                                textAlign: "center",
                                fontWeight: 500,
                              }}
                            >
                              {freeShippingPercent >= 100 ? (
                                <span>{drawerSettings.freeShippingSuccessText}</span>
                              ) : (
                                <span>
                                  {drawerSettings.freeShippingText.replace(
                                    "{amount}",
                                    `$${remainingForFreeShipping.toFixed(2)}`
                                  )}
                                </span>
                              )}
                            </p>
                            <div
                              style={{
                                width: "100%",
                                height: "6px",
                                backgroundColor: drawerSettings.freeShippingBarBgColor,
                                borderRadius: "999px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${freeShippingPercent}%`,
                                  height: "100%",
                                  backgroundColor: drawerSettings.freeShippingBarColor,
                                  borderRadius: "999px",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Cart Items List */}
                        <div style={{ padding: "12px 14px", flex: 1, maxHeight: "200px", overflowY: "auto" }}>
                          {drawerPreviewItems.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "24px 0", opacity: 0.7 }}>
                              <p style={{ margin: 0, fontWeight: 500 }}>{drawerSettings.emptyCartText}</p>
                            </div>
                          ) : (
                            drawerPreviewItems.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  paddingBottom: "10px",
                                  marginBottom: "10px",
                                  borderBottom: `1px solid ${drawerSettings.borderColor}`,
                                  alignItems: "flex-start",
                                }}
                              >
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  style={{
                                    width: "48px",
                                    height: "48px",
                                    objectFit: "cover",
                                    borderRadius: "4px",
                                    border: `1px solid ${drawerSettings.borderColor}`,
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontWeight: 600, fontSize: "12px" }}>{item.title}</p>
                                  <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: drawerSettings.mutedTextColor }}>
                                    {item.variant}
                                  </p>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      marginTop: "6px",
                                    }}
                                  >
                                    <span style={{ fontWeight: 700, fontSize: "12px" }}>
                                      ${(item.price * item.quantity).toFixed(2)}
                                    </span>

                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        border: `1px solid ${drawerSettings.borderColor}`,
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleDrawerItemQty(item.id, -1)}
                                        style={{ border: "none", background: "transparent", padding: "2px 5px", cursor: "pointer" }}
                                      >
                                        -
                                      </button>
                                      <span style={{ padding: "0 4px", fontWeight: "600" }}>{item.quantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDrawerItemQty(item.id, 1)}
                                        style={{ border: "none", background: "transparent", padding: "2px 5px", cursor: "pointer" }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Product Addon Section in Preview (Only if addons are configured) */}
                        {drawerSettings.addonEnabled && (drawerSettings.addonItems || []).length > 0 && (
                          <div
                            style={{
                              margin: "0 10px 10px 10px",
                              padding: "10px",
                              backgroundColor: "rgba(0,0,0,0.02)",
                              border: `1px solid ${drawerSettings.borderColor}`,
                              borderRadius: `${Math.max(4, drawerSettings.borderRadius - 2)}px`,
                            }}
                          >
                            <p
                              style={{
                                margin: "0 0 8px 0",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                              }}
                            >
                              {drawerSettings.addonHeading}
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {(drawerSettings.addonItems || []).slice(0, 2).map((addon) => (
                                <div
                                  key={addon.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "6px 8px",
                                    backgroundColor: drawerSettings.bgColor,
                                    borderRadius: "4px",
                                    border: `1px solid ${drawerSettings.borderColor}`,
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <img
                                      src={addon.image}
                                      alt={addon.title}
                                      style={{ width: "28px", height: "28px", borderRadius: "3px", objectFit: "cover" }}
                                    />
                                    <div>
                                      <p style={{ margin: 0, fontSize: "11px", fontWeight: 600 }}>{addon.title}</p>
                                      <span style={{ fontSize: "10px", fontWeight: 700 }}>{addon.price}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddPreviewAddon(addon)}
                                    style={{
                                      backgroundColor: drawerSettings.addonButtonBgColor,
                                      color: drawerSettings.addonButtonTextColor,
                                      border: "none",
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {drawerSettings.addonButtonText}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sticky Drawer Footer in Preview */}
                        <div
                          style={{
                            padding: "12px 14px",
                            borderTop: `1px solid ${drawerSettings.borderColor}`,
                            backgroundColor: drawerSettings.bgColor,
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {drawerSettings.showCartNote && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setDrawerNoteOpen(!drawerNoteOpen)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  padding: 0,
                                  fontSize: "11px",
                                  color: drawerSettings.mutedTextColor,
                                  cursor: "pointer",
                                }}
                              >
                                {drawerNoteOpen ? "▾ Hide order note" : "▸ Add order note"}
                              </button>
                              {drawerNoteOpen && (
                                <textarea
                                  placeholder={drawerSettings.cartNotePlaceholder}
                                  value={drawerNoteText}
                                  onChange={(e) => setDrawerNoteText(e.target.value)}
                                  style={{
                                    width: "100%",
                                    marginTop: "4px",
                                    fontSize: "11px",
                                    padding: "4px 6px",
                                    borderRadius: "4px",
                                    border: `1px solid ${drawerSettings.borderColor}`,
                                    boxSizing: "border-box",
                                  }}
                                  rows={2}
                                />
                              )}
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600 }}>Subtotal</span>
                            <span style={{ fontSize: "15px", fontWeight: 700 }}>
                              ${drawerSubtotal.toFixed(2)}
                            </span>
                          </div>

                          <button
                            type="button"
                            style={{
                              backgroundColor: drawerSettings.checkoutButtonBgColor,
                              color: drawerSettings.checkoutButtonTextColor,
                              border: "none",
                              borderRadius: `${drawerSettings.borderRadius}px`,
                              padding: "10px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                              width: "100%",
                            }}
                          >
                            {drawerSettings.checkoutButtonText}
                          </button>

                          {drawerSettings.showViewCartButton && (
                            <span
                              style={{
                                textAlign: "center",
                                fontSize: "11px",
                                color: drawerSettings.mutedTextColor,
                                textDecoration: "underline",
                                cursor: "pointer",
                              }}
                            >
                              {drawerSettings.viewCartButtonText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </BlockStack>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: ANNOUNCEMENT BAR                                  */}
        {/* ========================================================= */}
        {activeFeature === "announcement-bar" && (
          <BlockStack gap="400">
            {/* Stepper Navigation */}
            <Card padding="300">
              <InlineStack gap="300" align="start" blockAlign="center" wrap>
                {ANNOUNCEMENT_STEPS.map((s) => {
                  const isCurrent = announcementStep === s.id;
                  const isPassed = announcementStep > s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setAnnouncementStep(s.id)}
                      style={{
                        background: isCurrent ? "#008060" : isPassed ? "#f0fdf4" : "transparent",
                        border: isCurrent ? "1px solid #008060" : isPassed ? "1px solid #a7f3d0" : "1px solid #e1e3e5",
                        color: isCurrent ? "#ffffff" : isPassed ? "#065f46" : "#202223",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: "13px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: isCurrent ? "#ffffff" : isPassed ? "#008060" : "#e1e3e5",
                          color: isCurrent ? "#008060" : isPassed ? "#ffffff" : "#6d7175",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        {isPassed ? "✓" : s.id}
                      </span>
                      <span>{s.shortTitle}</span>
                    </button>
                  );
                })}
              </InlineStack>
            </Card>

            <Layout>
              {/* Left Column: Settings Configuration */}
              <Layout.Section>
                <BlockStack gap="400">
                  {/* STEP 1: CONTENT & MODE */}
                  {announcementStep === 1 && (
                    <>
                      {/* Master Activation Card */}
                      <Card>
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text as="h3" variant="headingMd">
                                Announcement Bar Activation
                              </Text>
                              <Text as="p" tone="subdued">
                                Show an eye-catching announcement bar across the top of your store.
                              </Text>
                            </BlockStack>
                            <Checkbox
                              label="Enabled"
                              checked={announcementSettings.enabled}
                              onChange={(val) => setAnnouncementSettings({ ...announcementSettings, enabled: val })}
                            />
                          </InlineStack>
                        </BlockStack>
                      </Card>

                      {/* Display Mode Selection */}
                      <Card>
                        <BlockStack gap="400">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingMd">
                              Display & Animation Mode
                            </Text>
                            <Text as="p" tone="subdued">
                              Choose how your announcements transition and display to shoppers.
                            </Text>
                          </BlockStack>

                          <InlineStack gap="300" wrap>
                            {/* Option A: Centered One-by-One Rotating */}
                            <button
                              type="button"
                              onClick={() => setAnnouncementSettings({ ...announcementSettings, mode: "rotating" })}
                              style={{
                                flex: "1 1 200px",
                                padding: "14px",
                                borderRadius: "8px",
                                border: announcementSettings.mode === "rotating" ? "2px solid #008060" : "1px solid #d2d5d8",
                                backgroundColor: announcementSettings.mode === "rotating" ? "#f0fdf4" : "#ffffff",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <InlineStack align="space-between" blockAlign="center">
                                <Text as="span" variant="headingSm" fontWeight="bold">
                                  🔄 Centered (One by One)
                                </Text>
                                {announcementSettings.mode === "rotating" && <Badge tone="success">Selected</Badge>}
                              </InlineStack>
                              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6d7175", lineHeight: 1.4 }}>
                                Text stays centered and changes smoothly from message to message every few seconds.
                              </p>
                            </button>

                            {/* Option B: Continuous Scrolling Marquee Ticker */}
                            <button
                              type="button"
                              onClick={() => setAnnouncementSettings({ ...announcementSettings, mode: "marquee" })}
                              style={{
                                flex: "1 1 200px",
                                padding: "14px",
                                borderRadius: "8px",
                                border: announcementSettings.mode === "marquee" ? "2px solid #008060" : "1px solid #d2d5d8",
                                backgroundColor: announcementSettings.mode === "marquee" ? "#f0fdf4" : "#ffffff",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <InlineStack align="space-between" blockAlign="center">
                                <Text as="span" variant="headingSm" fontWeight="bold">
                                  📜 Scrolling Ticker (Marquee)
                                </Text>
                                {announcementSettings.mode === "marquee" && <Badge tone="success">Selected</Badge>}
                              </InlineStack>
                              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6d7175", lineHeight: 1.4 }}>
                                Continuous, seamless horizontal scrolling text banner across the screen.
                              </p>
                            </button>

                            {/* Option C: Static Centered */}
                            <button
                              type="button"
                              onClick={() => setAnnouncementSettings({ ...announcementSettings, mode: "static" })}
                              style={{
                                flex: "1 1 200px",
                                padding: "14px",
                                borderRadius: "8px",
                                border: announcementSettings.mode === "static" ? "2px solid #008060" : "1px solid #d2d5d8",
                                backgroundColor: announcementSettings.mode === "static" ? "#f0fdf4" : "#ffffff",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <InlineStack align="space-between" blockAlign="center">
                                <Text as="span" variant="headingSm" fontWeight="bold">
                                  📌 Static Centered
                                </Text>
                                {announcementSettings.mode === "static" && <Badge tone="success">Selected</Badge>}
                              </InlineStack>
                              <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#6d7175", lineHeight: 1.4 }}>
                                Displays a single clean, high-priority announcement centered at top.
                              </p>
                            </button>
                          </InlineStack>
                        </BlockStack>
                      </Card>

                      {/* Announcement Messages Manager */}
                      <Card>
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text as="h3" variant="headingMd">
                                Announcement Messages
                              </Text>
                              <Text as="p" tone="subdued">
                                Add promotional messages, shipping notices, or coupon codes.
                              </Text>
                            </BlockStack>
                            <Button variant="primary" size="slim" icon={PlusIcon} onClick={handleAddAnnouncementMessage}>
                              Add Message
                            </Button>
                          </InlineStack>

                          <BlockStack gap="300">
                            {(announcementSettings.messages || []).map((msg, idx) => (
                              <Box key={msg.id} padding="300" background="bg-subdued" borderRadius="200">
                                <BlockStack gap="200">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <Text as="span" variant="bodySm" fontWeight="bold">
                                      Message #{idx + 1}
                                    </Text>
                                    {(announcementSettings.messages || []).length > 1 && (
                                      <Button
                                        variant="plain"
                                        tone="critical"
                                        size="micro"
                                        icon={DeleteIcon}
                                        onClick={() => handleRemoveAnnouncementMessage(msg.id)}
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  </InlineStack>

                                  <TextField
                                    label="Announcement Text"
                                    value={msg.text}
                                    onChange={(val) => handleUpdateAnnouncementMessage(msg.id, { text: val })}
                                    autoComplete="off"
                                    placeholder="e.g. Free Shipping on orders over $50!"
                                  />

                                  <TextField
                                    label="Clickable Link (Optional)"
                                    value={msg.link || ""}
                                    onChange={(val) => handleUpdateAnnouncementMessage(msg.id, { link: val })}
                                    autoComplete="off"
                                    placeholder="e.g. /collections/all or https://yourstore.com/sale"
                                  />
                                </BlockStack>
                              </Box>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </Card>
                    </>
                  )}

                  {/* STEP 2: DESIGN & CONTROLS */}
                  {announcementStep === 2 && (
                    <>
                      {/* Colors & Typography */}
                      <Card>
                        <BlockStack gap="400">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingMd">
                              Colors & Typography
                            </Text>
                            <Text as="p" tone="subdued">
                              Match your store's branding with custom background and text colors.
                            </Text>
                          </BlockStack>

                          <Layout>
                            <Layout.Section variant="oneHalf">
                              <BlockStack gap="100">
                                <Text as="span" variant="bodySm" fontWeight="medium">
                                  Bar Background Color
                                </Text>
                                <InlineStack gap="200" blockAlign="center">
                                  <input
                                    type="color"
                                    value={announcementSettings.bgColor || "#111827"}
                                    onChange={(e) =>
                                      setAnnouncementSettings({ ...announcementSettings, bgColor: e.target.value })
                                    }
                                    style={{
                                      width: "40px",
                                      height: "36px",
                                      padding: "2px",
                                      borderRadius: "6px",
                                      border: "1px solid #d2d5d8",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label=""
                                      labelHidden
                                      value={announcementSettings.bgColor}
                                      onChange={(val) => setAnnouncementSettings({ ...announcementSettings, bgColor: val })}
                                      autoComplete="off"
                                    />
                                  </div>
                                </InlineStack>
                              </BlockStack>
                            </Layout.Section>

                            <Layout.Section variant="oneHalf">
                              <BlockStack gap="100">
                                <Text as="span" variant="bodySm" fontWeight="medium">
                                  Text Color
                                </Text>
                                <InlineStack gap="200" blockAlign="center">
                                  <input
                                    type="color"
                                    value={announcementSettings.textColor || "#ffffff"}
                                    onChange={(e) =>
                                      setAnnouncementSettings({ ...announcementSettings, textColor: e.target.value })
                                    }
                                    style={{
                                      width: "40px",
                                      height: "36px",
                                      padding: "2px",
                                      borderRadius: "6px",
                                      border: "1px solid #d2d5d8",
                                      cursor: "pointer",
                                    }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <TextField
                                      label=""
                                      labelHidden
                                      value={announcementSettings.textColor}
                                      onChange={(val) =>
                                        setAnnouncementSettings({ ...announcementSettings, textColor: val })
                                      }
                                      autoComplete="off"
                                    />
                                  </div>
                                </InlineStack>
                              </BlockStack>
                            </Layout.Section>
                          </Layout>

                          <RangeSlider
                            label={`Font Size: ${announcementSettings.fontSize || 13}px`}
                            value={announcementSettings.fontSize || 13}
                            min={11}
                            max={18}
                            step={1}
                            onChange={(val) => setAnnouncementSettings({ ...announcementSettings, fontSize: val })}
                          />
                        </BlockStack>
                      </Card>

                      {/* Behavior & Animation Timing */}
                      <Card>
                        <BlockStack gap="400">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingMd">
                              Behavior & Timing
                            </Text>
                            <Text as="p" tone="subdued">
                              Control rotation speed, sticky placement, and dismiss settings.
                            </Text>
                          </BlockStack>

                          {announcementSettings.mode === "rotating" && (
                            <RangeSlider
                              label={`Rotation Interval: ${announcementSettings.rotationInterval || 4} seconds`}
                              helpText="How long each message remains on screen before transitioning to the next."
                              value={announcementSettings.rotationInterval || 4}
                              min={2}
                              max={10}
                              step={1}
                              onChange={(val) =>
                                setAnnouncementSettings({ ...announcementSettings, rotationInterval: val })
                              }
                            />
                          )}

                          {announcementSettings.mode === "marquee" && (
                            <RangeSlider
                              label={`Scroll Cycle Duration: ${announcementSettings.marqueeSpeed || 25} seconds`}
                              helpText="Lower values scroll faster; higher values scroll more smoothly."
                              value={announcementSettings.marqueeSpeed || 25}
                              min={10}
                              max={60}
                              step={5}
                              onChange={(val) =>
                                setAnnouncementSettings({ ...announcementSettings, marqueeSpeed: val })
                              }
                            />
                          )}

                          <Checkbox
                            label="Pause scrolling/rotation on hover"
                            helpText="Pauses animation when shoppers mouse over the bar so they can easily read or click."
                            checked={announcementSettings.pauseOnHover}
                            onChange={(val) =>
                              setAnnouncementSettings({ ...announcementSettings, pauseOnHover: val })
                            }
                          />

                          <Checkbox
                            label="Sticky bar at top of page"
                            helpText="Keeps the announcement bar visible at the top while customers scroll."
                            checked={announcementSettings.isSticky}
                            onChange={(val) => setAnnouncementSettings({ ...announcementSettings, isSticky: val })}
                          />

                          <Checkbox
                            label="Show dismiss / close button (×)"
                            helpText="Allows shoppers to close the bar for the current browsing session."
                            checked={announcementSettings.showCloseButton}
                            onChange={(val) =>
                              setAnnouncementSettings({ ...announcementSettings, showCloseButton: val })
                            }
                          />

                          <Select
                            label="Device Visibility"
                            options={[
                              { label: "Show on all devices (Desktop & Mobile)", value: "all" },
                              { label: "Desktop only", value: "desktop" },
                              { label: "Mobile only", value: "mobile" },
                            ]}
                            value={announcementSettings.deviceTarget || "all"}
                            onChange={(val) =>
                              setAnnouncementSettings({ ...announcementSettings, deviceTarget: val as any })
                            }
                          />
                        </BlockStack>
                      </Card>
                    </>
                  )}

                  {/* Stepper Footer Buttons */}
                  <Card>
                    <InlineStack align="space-between" blockAlign="center">
                      {announcementStep > 1 ? (
                        <Button onClick={() => setAnnouncementStep(announcementStep - 1)}>
                          ← Back to Step {announcementStep - 1}
                        </Button>
                      ) : (
                        <div />
                      )}

                      <InlineStack gap="300">
                        {announcementStep < 2 ? (
                          <>
                            <Button loading={isSaving} onClick={handleSaveAnnouncement}>
                              Save Changes
                            </Button>
                            <Button variant="primary" onClick={() => setAnnouncementStep(announcementStep + 1)}>
                              Next Step: Design & Controls →
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="primary"
                            size="large"
                            loading={isSaving}
                            onClick={handleSaveAnnouncement}
                          >
                            Save Announcement Bar
                          </Button>
                        )}
                      </InlineStack>
                    </InlineStack>
                  </Card>
                </BlockStack>
              </Layout.Section>

              {/* Right Column: Live Interactive Preview */}
              <Layout.Section variant="oneThird">
                <BlockStack gap="400">
                  <Card>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Live Storefront Preview
                        </Text>
                        <ButtonGroup variant="segmented">
                          <Button
                            size="micro"
                            pressed={previewDevice === "desktop"}
                            onClick={() => setPreviewDevice("desktop")}
                          >
                            Desktop
                          </Button>
                          <Button
                            size="micro"
                            pressed={previewDevice === "mobile"}
                            onClick={() => setPreviewDevice("mobile")}
                          >
                            Mobile
                          </Button>
                        </ButtonGroup>
                      </InlineStack>

                      {/* Mock Browser Window */}
                      <div
                        style={{
                          width: "100%",
                          borderRadius: "8px",
                          border: "1px solid #d2d5d8",
                          overflow: "hidden",
                          backgroundColor: "#f9fafb",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                        }}
                      >
                        {/* Mock Browser Header Bar */}
                        <div
                          style={{
                            backgroundColor: "#e5e7eb",
                            padding: "6px 10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            borderBottom: "1px solid #d1d5db",
                          }}
                        >
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                          <span style={{ fontSize: "10px", color: "#6b7280", marginLeft: "4px" }}>your-store.com</span>
                        </div>

                        {/* LIVE PREVIEW: ANNOUNCEMENT BAR */}
                        {announcementSettings.enabled ? (
                          <div
                            style={{
                              backgroundColor: announcementSettings.bgColor || "#111827",
                              color: announcementSettings.textColor || "#ffffff",
                              fontSize: `${announcementSettings.fontSize || 13}px`,
                              padding: "8px 12px",
                              textAlign: "center",
                              position: "relative",
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 500,
                            }}
                          >
                            {announcementSettings.mode === "marquee" ? (
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", width: "100%", display: "flex", gap: "24px" }}>
                                <div style={{ animation: "tbDashboardMarquee 15s linear infinite", display: "inline-flex", gap: "24px", whiteSpace: "nowrap" }}>
                                  {(announcementSettings.messages || []).map((m, idx) => (
                                    <span key={idx} style={{ display: "inline-block" }}>{m.text}</span>
                                  ))}
                                  {(announcementSettings.messages || []).map((m, idx) => (
                                    <span key={`dup-${idx}`} style={{ display: "inline-block" }}>{m.text}</span>
                                  ))}
                                </div>
                                <style>{`
                                  @keyframes tbDashboardMarquee {
                                    0% { transform: translateX(0); }
                                    100% { transform: translateX(-50%); }
                                  }
                                `}</style>
                              </div>
                            ) : announcementSettings.mode === "rotating" ? (
                              <InlineStack align="space-between" blockAlign="center" gap="100">
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const len = announcementSettings.messages?.length || 1;
                                    setAnnouncementPreviewIdx((prev) => (prev - 1 + len) % len);
                                  }}
                                  style={{ opacity: 0.7, fontSize: "14px", cursor: "pointer", padding: "0 4px", userSelect: "none" }}
                                >
                                  ‹
                                </span>
                                <span style={{ flex: 1, padding: "0 8px", transition: "all 0.3s ease" }}>
                                  {announcementSettings.messages?.[announcementPreviewIdx % (announcementSettings.messages?.length || 1)]?.text || "Free Shipping over $50!"}
                                </span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const len = announcementSettings.messages?.length || 1;
                                    setAnnouncementPreviewIdx((prev) => (prev + 1) % len);
                                  }}
                                  style={{ opacity: 0.7, fontSize: "14px", cursor: "pointer", padding: "0 4px", userSelect: "none" }}
                                >
                                  ›
                                </span>
                              </InlineStack>
                            ) : (
                              <span>
                                {announcementSettings.messages?.[0]?.text || "Free Shipping over $50!"}
                              </span>
                            )}

                            {announcementSettings.showCloseButton && (
                              <span
                                style={{
                                  position: "absolute",
                                  right: "8px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  opacity: 0.7,
                                  fontSize: "14px",
                                }}
                              >
                                ×
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#9ca3af",
                              fontSize: "11px",
                              padding: "6px",
                              textAlign: "center",
                              fontStyle: "italic",
                            }}
                          >
                            Announcement bar is disabled
                          </div>
                        )}

                        {/* Mock Store Header Below */}
                        <div
                          style={{
                            backgroundColor: "#ffffff",
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid #f3f4f6",
                          }}
                        >
                          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.5px" }}>BRAND STORE</span>
                          <InlineStack gap="200">
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>Shop</span>
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>About</span>
                            <span style={{ fontSize: "12px" }}>🛒</span>
                          </InlineStack>
                        </div>

                        {/* Mock Body */}
                        <div style={{ padding: "16px", backgroundColor: "#fafafa", minHeight: "80px", textAlign: "center" }}>
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>Storefront Hero Section</span>
                        </div>
                      </div>
                    </BlockStack>
                  </Card>

                  {/* Activation Info Card */}
                  <Card>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Theme Customizer
                        </Text>
                        <Badge tone="success">1-Click Embed</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        The Announcement Bar is an independent App Embed in your Theme Editor. It has zero settings clutter in the customizer — everything is controlled right here.
                      </Text>
                      <Button
                        variant="plain"
                        icon={ExternalIcon}
                        url={themeEditorUrl}
                        target="_blank"
                      >
                        Open Theme Editor to Toggle
                      </Button>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Layout.Section>
            </Layout>
          </BlockStack>
        )}
        {/* Built-in Store Product Picker Modal */}
        {productPickerOpen && (
          <Modal
            open={productPickerOpen}
            onClose={() => setProductPickerOpen(false)}
            title="Select Products from Shopify Store"
            primaryAction={{
              content: "Done",
              onAction: () => setProductPickerOpen(false),
            }}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <TextField
                  label="Search Store Catalog"
                  value={pickerSearchQuery}
                  onChange={handleSearchStoreProducts}
                  placeholder="Search products by title..."
                  prefix={<Icon source={SearchIcon} />}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => handleSearchStoreProducts("")}
                />

                {isSearchingProducts ? (
                  <Box padding="600" display="flex" justifyContent="center">
                    <Spinner size="large" />
                  </Box>
                ) : activeStoreProducts.length === 0 ? (
                  <Box padding="400" textAlign="center">
                    <Text as="p" tone="subdued">
                      No matching products found. Check your Shopify product inventory or try another search.
                    </Text>
                  </Box>
                ) : (
                  <Box maxHeight="420px" overflowY="auto">
                    <BlockStack gap="300">
                      {activeStoreProducts.map((prod) => (
                        <Box
                          key={prod.id}
                          padding="300"
                          borderWidth="025"
                          borderColor="border"
                          borderRadius="200"
                          background="bg-subdued"
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="300" blockAlign="center">
                              {prod.image ? (
                                <Thumbnail source={prod.image} alt={prod.title} size="small" />
                              ) : (
                                <Box width="40px" height="40px" background="bg-surface-secondary" borderRadius="100" display="flex" alignItems="center" justifyContent="center">
                                  <Icon source={ProductIcon} />
                                </Box>
                              )}
                              <BlockStack gap="050">
                                <Text as="p" variant="bodyMd" fontWeight="semibold">
                                  {prod.title}
                                </Text>
                                <Text as="p" variant="bodyXs" tone="subdued">
                                  {prod.variants?.length || 1} variant(s) available
                                </Text>
                              </BlockStack>
                            </InlineStack>

                            {prod.variants && prod.variants.length > 1 ? (
                              <Box width="200px">
                                <Select
                                  label="Select variant"
                                  labelHidden
                                  options={[
                                    { label: "Choose variant...", value: "" },
                                    ...prod.variants.map((v: any) => ({
                                      label: `${v.title} (${v.price})`,
                                      value: v.id,
                                    })),
                                  ]}
                                  onChange={(selId) => {
                                    const v = prod.variants.find((item: any) => item.id === selId);
                                    if (v) handleSelectStoreVariant(prod, v);
                                  }}
                                />
                              </Box>
                            ) : (
                              <Button
                                variant="primary"
                                size="slim"
                                onClick={() => handleSelectStoreVariant(prod, prod.variants?.[0] || { id: prod.id, price: "$0.00" })}
                              >
                                + Select ({prod.variants?.[0]?.price || "$0.00"})
                              </Button>
                            )}
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </BlockStack>
    </Page>
  );
}

export default TotalBundleDashboard;

