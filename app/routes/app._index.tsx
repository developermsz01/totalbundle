import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
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
  ProgressBar,
} from "@shopify/polaris";
import {
  ExternalIcon,
  CheckIcon,
  DeleteIcon,
  PlusIcon,
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getStickyCartSettings,
  saveStickyCartSettings,
  getCartDrawerSettings,
  saveCartDrawerSettings,
  type StickyCartSettings,
  type CartDrawerSettings,
  type CartDrawerAddon,
  defaultStickyCartSettings,
  defaultCartDrawerSettings,
} from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
  const featureParam = url.searchParams.get("feature");
  const initialFeature: "sticky-cart" | "cart-drawer" =
    featureParam === "cart-drawer" ? "cart-drawer" : "sticky-cart";

  const stickySettings = getStickyCartSettings(shop);
  const cartDrawerSettings = getCartDrawerSettings(shop);

  return json({
    shop,
    stickySettings,
    cartDrawerSettings,
    initialFeature,
    themeEditorUrl: `https://${shop}/admin/themes/current/editor?context=apps`,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
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
            console.warn("[app._index.action] Cart drawer metafield sync skipped/failed:", metafieldError);
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
            console.warn("[app._index.action] Sticky cart metafield sync skipped/failed:", metafieldError);
          }
        }

        return json({ success: true, feature: "sticky-cart", settings: updated });
      }
    } catch (e) {
      return json({ success: false, error: "Failed to parse settings" }, { status: 400 });
    }
  }

  return json({ success: false, error: "No settings provided" }, { status: 400 });
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

export default function TotalBundleDashboard() {
  const {
    shop,
    stickySettings: initialStickySettings,
    cartDrawerSettings: initialDrawerSettings,
    initialFeature,
    themeEditorUrl,
  } = useLoaderData<typeof loader>();

  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const appBridge = useAppBridge();

  const isSaving = navigation.state === "submitting";

  // Top-level category / module selector: "sticky-cart" | "cart-drawer"
  const [activeFeature, setActiveFeature] = useState<"sticky-cart" | "cart-drawer">(initialFeature);

  // Stepper states
  const [stickyStep, setStickyStep] = useState<number>(1);
  const [drawerStep, setDrawerStep] = useState<number>(1);

  // Settings states (kept strictly separate)
  const [stickySettings, setStickySettings] = useState<StickyCartSettings>(initialStickySettings);
  const [drawerSettings, setDrawerSettings] = useState<CartDrawerSettings>(initialDrawerSettings);

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

  useEffect(() => {
    if (actionData?.success) {
      if (actionData.feature === "cart-drawer") {
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
      <TitleBar title={activeFeature === "sticky-cart" ? "Sticky Add to Cart" : "Cart Drawer"} />

      <BlockStack gap="500">
        {/* ========================================================= */}
        {/* TOP-LEVEL CATEGORY SELECTOR (Separate Views)              */}
        {/* ========================================================= */}
        <Card padding="400">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <InlineStack gap="300" blockAlign="center">
              <button
                type="button"
                onClick={() => setActiveFeature("sticky-cart")}
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
                onClick={() => setActiveFeature("cart-drawer")}
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
                <Badge tone={activeFeature === "cart-drawer" ? "success" : "attention"}>New Feature</Badge>
              </button>
            </InlineStack>

            <Text as="p" variant="bodySm" tone="subdued">
              {activeFeature === "sticky-cart"
                ? "Configuring product page sticky buy bar"
                : "Configuring global slide-out cart drawer & upsells"}
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
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: isActive ? "2px solid #008060" : "1px solid #e1e3e5",
                        backgroundColor: isActive ? "#f0fdf4" : isDone ? "#fafbfb" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <InlineStack gap="200" blockAlign="center">
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
                          }}
                        >
                          {isDone ? "✓" : s.id}
                        </span>
                        <BlockStack gap="050">
                          <Text
                            as="span"
                            variant="bodySm"
                            fontWeight={isActive ? "bold" : "medium"}
                            tone={isActive ? "success" : undefined}
                          >
                            {s.shortTitle}
                          </Text>
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {s.subtitle}
                          </Text>
                        </BlockStack>
                      </InlineStack>
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
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: isActive ? "2px solid #008060" : "1px solid #e1e3e5",
                        backgroundColor: isActive ? "#f0fdf4" : isDone ? "#fafbfb" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <InlineStack gap="200" blockAlign="center">
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
                          }}
                        >
                          {isDone ? "✓" : s.id}
                        </span>
                        <BlockStack gap="050">
                          <Text
                            as="span"
                            variant="bodySm"
                            fontWeight={isActive ? "bold" : "medium"}
                            tone={isActive ? "success" : undefined}
                          >
                            {s.shortTitle}
                          </Text>
                          <Text as="span" variant="bodyXs" tone="subdued">
                            {s.subtitle}
                          </Text>
                        </BlockStack>
                      </InlineStack>
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
                            <TextField
                              label="Progress Bar Fill Color"
                              value={drawerSettings.freeShippingBarColor}
                              onChange={(val) =>
                                setDrawerSettings({ ...drawerSettings, freeShippingBarColor: val })
                              }
                              autoComplete="off"
                            />
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

                        <TextField
                          label="Progress Bar Track (Background) Color"
                          value={drawerSettings.freeShippingBarBgColor}
                          onChange={(val) =>
                            setDrawerSettings({ ...drawerSettings, freeShippingBarBgColor: val })
                          }
                          autoComplete="off"
                        />
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
                          <Text as="h3" variant="headingSm">Configured Add-on Items</Text>
                          <Button icon={PlusIcon} size="slim" onClick={handleAddAddonItem}>
                            Add Item
                          </Button>
                        </InlineStack>

                        <BlockStack gap="300">
                          {(drawerSettings.addonItems || []).map((addon, index) => (
                            <Box
                              key={addon.id}
                              padding="300"
                              background="bg-subdued"
                              borderRadius="200"
                            >
                              <BlockStack gap="200">
                                <InlineStack align="space-between" blockAlign="center">
                                  <Text as="span" variant="bodySm" fontWeight="bold">
                                    Item #{index + 1}
                                  </Text>
                                  <Button
                                    icon={DeleteIcon}
                                    variant="plain"
                                    tone="critical"
                                    onClick={() => handleRemoveAddonItem(addon.id)}
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>

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
                                      label="Image URL"
                                      value={addon.image}
                                      onChange={(val) => handleUpdateAddonItem(addon.id, { image: val })}
                                      autoComplete="off"
                                    />
                                  </Box>
                                </InlineStack>
                              </BlockStack>
                            </Box>
                          ))}
                        </BlockStack>
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

                        {/* Product Addon Section in Preview */}
                        {drawerSettings.addonEnabled && (
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
      </BlockStack>
    </Page>
  );
}
