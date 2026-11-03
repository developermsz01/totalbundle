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
} from "@shopify/polaris";
import {
  ExternalIcon,
  CheckIcon,
  ViewIcon,
} from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getStickyCartSettings,
  saveStickyCartSettings,
  type StickyCartSettings,
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

  const settings = getStickyCartSettings(shop);

  return json({
    shop,
    settings,
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
  const rawSettings = formData.get("settings");

  if (rawSettings) {
    try {
      const parsed = JSON.parse(String(rawSettings)) as StickyCartSettings;
      const updated = saveStickyCartSettings(shop, parsed);

      // Sync settings directly to Shopify App Metafield
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
          console.warn("[app._index.action] Metafield sync skipped or failed:", metafieldError);
        }
      }

      return json({ success: true, settings: updated });
    } catch (e) {
      return json({ success: false, error: "Failed to parse settings" }, { status: 400 });
    }
  }

  return json({ success: false, error: "No settings provided" }, { status: 400 });
};

export default function StickyCartDashboard() {
  const { shop, settings: initialSettings, themeEditorUrl } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const appBridge = useAppBridge();

  const isSaving = navigation.state === "submitting";

  // Form State
  const [settings, setSettings] = useState<StickyCartSettings>(initialSettings);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("desktop");
  const [previewAdded, setPreviewAdded] = useState(false);
  const [previewQty, setPreviewQty] = useState(1);
  const [previewVariant, setPreviewVariant] = useState("Standard / Black");

  useEffect(() => {
    if (actionData?.success) {
      appBridge.toast.show("Sticky Add to Cart settings saved & synced!");
    }
  }, [actionData, appBridge]);

  const handleSave = () => {
    submit(
      { settings: JSON.stringify(settings) },
      { method: "POST" }
    );
  };

  const applyColorPreset = (preset: {
    bg: string;
    text: string;
    btnBg: string;
    btnText: string;
    btnHover: string;
    radius: number;
  }) => {
    setSettings((prev) => ({
      ...prev,
      bgColor: preset.bg,
      textColor: preset.text,
      buttonBgColor: preset.btnBg,
      buttonTextColor: preset.btnText,
      buttonHoverBgColor: preset.btnHover,
      borderRadius: preset.radius,
    }));
  };

  const handlePreviewAdd = () => {
    setPreviewAdded(true);
    setTimeout(() => setPreviewAdded(false), 2200);
  };

  return (
    <Page
      fullWidth
      title="Sticky Add to Cart"
      subtitle="Customize and manage your high-converting product buy bar directly from this dashboard."
      primaryAction={{
        content: isSaving ? "Saving..." : "Save Settings",
        onAction: handleSave,
        loading: isSaving,
      }}
      secondaryActions={[
        {
          content: "Preview Storefront",
          icon: ExternalIcon,
          url: `https://${shop}`,
          target: "_blank",
        },
      ]}
    >
      <TitleBar title="Sticky Add to Cart">
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {/* Status Callout Banner */}
        <Banner
          tone={settings.enabled ? "success" : "warning"}
          title={
            settings.enabled
              ? "Sticky Add to Cart is Enabled"
              : "Sticky Add to Cart is Disabled"
          }
        >
          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" variant="bodyMd">
              {settings.enabled
                ? "Your Sticky Add to Cart bar is active on product pages. All customizations below apply directly without needing theme editor changes."
                : "The sticky bar is currently turned off and won't appear on product pages."}
            </Text>
            <Button
              size="slim"
              variant={settings.enabled ? "primary" : "secondary"}
              tone={settings.enabled ? "critical" : "success"}
              onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            >
              {settings.enabled ? "Turn Off" : "Turn On"}
            </Button>
          </InlineStack>
        </Banner>

        <Layout>
          {/* LEFT COLUMN: Controls & Settings */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* 1. Placement & Visibility */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      1. Placement & Triggers
                    </Text>
                    <Badge tone="info">Storefront</Badge>
                  </InlineStack>
                  <Divider />

                  <Checkbox
                    label="Enable Sticky Add to Cart Bar"
                    helpText="Master switch for the sticky buy bar across all product pages."
                    checked={settings.enabled}
                    onChange={(val) => setSettings({ ...settings, enabled: val })}
                  />

                  <Select
                    label="Bar Position"
                    options={[
                      { label: "Bottom of screen (Recommended for Mobile & Desktop)", value: "bottom" },
                      { label: "Top of screen", value: "top" },
                    ]}
                    value={settings.position}
                    onChange={(val) => setSettings({ ...settings, position: val as "bottom" | "top" })}
                  />

                  <Select
                    label="When to Display"
                    options={[
                      { label: "Show after scrolling past product form", value: "scroll" },
                      { label: "Always visible on page load", value: "always" },
                    ]}
                    value={settings.desktopVisibility}
                    onChange={(val) =>
                      setSettings({ ...settings, desktopVisibility: val as "scroll" | "always" })
                    }
                  />

                  <InlineStack gap="600">
                    <Checkbox
                      label="Show on Mobile devices"
                      checked={settings.showOnMobile}
                      onChange={(val) => setSettings({ ...settings, showOnMobile: val })}
                    />
                    <Checkbox
                      label="Show on Desktop screens"
                      checked={settings.showOnDesktop}
                      onChange={(val) => setSettings({ ...settings, showOnDesktop: val })}
                    />
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* 2. Display Elements */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    2. Product & Cart Elements
                  </Text>
                  <Divider />

                  <Checkbox
                    label="Show Product Thumbnail"
                    helpText="Shows the current product or selected variant image inside the bar."
                    checked={settings.showThumbnail}
                    onChange={(val) => setSettings({ ...settings, showThumbnail: val })}
                  />

                  <Checkbox
                    label="Show Compare-at Price & Discount Badge"
                    helpText="Highlights regular price and savings badge (e.g., Save 20%) when items are discounted."
                    checked={settings.showCompareAtPrice}
                    onChange={(val) => setSettings({ ...settings, showCompareAtPrice: val })}
                  />

                  <Checkbox
                    label="Show Quantity Selector (- 1 +)"
                    helpText="Enables customers to adjust units directly within the sticky bar."
                    checked={settings.showQuantity}
                    onChange={(val) => setSettings({ ...settings, showQuantity: val })}
                  />
                </BlockStack>
              </Card>

              {/* 3. Button Text & Checkout Flow */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    3. Button Text & Post-Add Action
                  </Text>
                  <Divider />

                  <InlineStack gap="400">
                    <Box minWidth="45%">
                      <TextField
                        label="Button Text (In Stock)"
                        value={settings.buttonText}
                        onChange={(val) => setSettings({ ...settings, buttonText: val })}
                        autoComplete="off"
                      />
                    </Box>
                    <Box minWidth="45%">
                      <TextField
                        label="Button Text (Sold Out)"
                        value={settings.soldOutText}
                        onChange={(val) => setSettings({ ...settings, soldOutText: val })}
                        autoComplete="off"
                      />
                    </Box>
                  </InlineStack>

                  <Select
                    label="Action After Adding to Cart"
                    options={[
                      {
                        label: "Stay on page & show 'Added to Cart' confirmation (Recommended)",
                        value: "stay",
                      },
                      { label: "Redirect customer to Cart page (/cart)", value: "cart" },
                      { label: "Redirect customer directly to Checkout (/checkout)", value: "checkout" },
                    ]}
                    value={settings.afterAddAction}
                    onChange={(val) =>
                      setSettings({
                        ...settings,
                        afterAddAction: val as "stay" | "cart" | "checkout",
                      })
                    }
                  />
                </BlockStack>
              </Card>

              {/* 4. Colors & Theme Styling */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      4. Colors & Style
                    </Text>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Live Preview on Right
                    </Text>
                  </InlineStack>
                  <Divider />

                  {/* 1-Click Color Presets */}
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Quick Color Themes:
                    </Text>
                    <InlineStack gap="200">
                      <Button
                        size="slim"
                        onClick={() =>
                          applyColorPreset({
                            bg: "#ffffff",
                            text: "#121212",
                            btnBg: "#121212",
                            btnText: "#ffffff",
                            btnHover: "#2e2e2e",
                            radius: 8,
                          })
                        }
                      >
                        Modern Dark
                      </Button>
                      <Button
                        size="slim"
                        onClick={() =>
                          applyColorPreset({
                            bg: "#ffffff",
                            text: "#111827",
                            btnBg: "#2563eb",
                            btnText: "#ffffff",
                            btnHover: "#1d4ed8",
                            radius: 10,
                          })
                        }
                      >
                        Royal Blue
                      </Button>
                      <Button
                        size="slim"
                        onClick={() =>
                          applyColorPreset({
                            bg: "#ffffff",
                            text: "#1e293b",
                            btnBg: "#059669",
                            btnText: "#ffffff",
                            btnHover: "#047857",
                            radius: 12,
                          })
                        }
                      >
                        Emerald Green
                      </Button>
                      <Button
                        size="slim"
                        onClick={() =>
                          applyColorPreset({
                            bg: "#18181b",
                            text: "#fafafa",
                            btnBg: "#fafafa",
                            btnText: "#18181b",
                            btnHover: "#e4e4e7",
                            radius: 24,
                          })
                        }
                      >
                        Minimalist Dark
                      </Button>
                    </InlineStack>
                  </BlockStack>

                  <InlineStack gap="400">
                    <Box minWidth="45%">
                      <TextField
                        label="Bar Background"
                        value={settings.bgColor}
                        onChange={(val) => setSettings({ ...settings, bgColor: val })}
                        autoComplete="off"
                        prefix={
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              backgroundColor: settings.bgColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                      />
                    </Box>
                    <Box minWidth="45%">
                      <TextField
                        label="Text Color"
                        value={settings.textColor}
                        onChange={(val) => setSettings({ ...settings, textColor: val })}
                        autoComplete="off"
                        prefix={
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              backgroundColor: settings.textColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                      />
                    </Box>
                  </InlineStack>

                  <InlineStack gap="400">
                    <Box minWidth="45%">
                      <TextField
                        label="Button Background"
                        value={settings.buttonBgColor}
                        onChange={(val) => setSettings({ ...settings, buttonBgColor: val })}
                        autoComplete="off"
                        prefix={
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              backgroundColor: settings.buttonBgColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                      />
                    </Box>
                    <Box minWidth="45%">
                      <TextField
                        label="Button Text Color"
                        value={settings.buttonTextColor}
                        onChange={(val) => setSettings({ ...settings, buttonTextColor: val })}
                        autoComplete="off"
                        prefix={
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              backgroundColor: settings.buttonTextColor,
                              border: "1px solid #ccc",
                            }}
                          />
                        }
                      />
                    </Box>
                  </InlineStack>

                  <RangeSlider
                    label={`Button Corner Radius: ${settings.borderRadius}px`}
                    value={settings.borderRadius}
                    min={0}
                    max={28}
                    step={2}
                    onChange={(val) => setSettings({ ...settings, borderRadius: Number(val) })}
                  />
                </BlockStack>
              </Card>

              {/* Bottom Sticky Save Button */}
              <Box paddingBlockStart="200">
                <Button variant="primary" size="large" onClick={handleSave} loading={isSaving}>
                  {isSaving ? "Saving Settings..." : "Save Settings to Storefront"}
                </Button>
              </Box>
            </BlockStack>
          </Layout.Section>

          {/* RIGHT COLUMN: Interactive Live Storefront Preview */}
          <Layout.Section variant="oneThird">
            <div style={{ position: "sticky", top: "20px" }}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">
                      Interactive Live Preview
                    </Text>
                    <ButtonGroup variant="segmented">
                      <Button
                        pressed={previewDevice === "desktop"}
                        onClick={() => setPreviewDevice("desktop")}
                        size="slim"
                      >
                        Desktop
                      </Button>
                      <Button
                        pressed={previewDevice === "mobile"}
                        onClick={() => setPreviewDevice("mobile")}
                        size="slim"
                      >
                        Mobile
                      </Button>
                    </ButtonGroup>
                  </InlineStack>

                  <Text as="p" variant="bodyXs" tone="subdued">
                    Simulates your live store product page with the Sticky Add to Cart bar.
                  </Text>

                  {/* Browser/Device Mockup Frame */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: previewDevice === "mobile" ? "300px" : "100%",
                      margin: "0 auto",
                      borderRadius: previewDevice === "mobile" ? "24px" : "8px",
                      border: "2px solid #e1e3e5",
                      overflow: "hidden",
                      backgroundColor: "#f9fafb",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      display: "flex",
                      flexDirection: "column",
                      height: "440px",
                      position: "relative",
                    }}
                  >
                    {/* Device Header */}
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#f1f2f4",
                        borderBottom: "1px solid #e1e3e5",
                        fontSize: "11px",
                        color: "#6b7280",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <div style={{ display: "flex", gap: "4px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                      </div>
                      <span style={{ margin: "0 auto" }}>{shop}/products/classic-tee</span>
                    </div>

                    {/* Scrollable Page Body Mock */}
                    <div style={{ flex: 1, padding: "16px", overflowY: "auto", position: "relative" }}>
                      {/* Product Hero Mock */}
                      <div
                        style={{
                          width: "100%",
                          height: previewDevice === "mobile" ? "120px" : "150px",
                          background: "#e5e7eb",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: "12px",
                        }}
                      >
                        <Text as="span" variant="bodySm" tone="subdued">
                          🛍️ Product Showcase Image
                        </Text>
                      </div>

                      <Text as="h4" variant="headingSm" fontWeight="bold">
                        Everyday Performance Jacket
                      </Text>

                      <div style={{ display: "flex", gap: "8px", alignItems: "baseline", margin: "4px 0" }}>
                        <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111827" }}>$89.00</span>
                        {settings.showCompareAtPrice && (
                          <>
                            <span style={{ fontSize: "13px", textDecoration: "line-through", color: "#6b7280" }}>
                              $119.00
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                background: "#dcfce7",
                                color: "#15803d",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "bold",
                              }}
                            >
                              Save 25%
                            </span>
                          </>
                        )}
                      </div>

                      <p style={{ fontSize: "11px", color: "#6b7280", margin: "8px 0" }}>
                        Premium weather-resistant fabric with 4-way stretch. Designed for everyday comfort and all-season layering.
                      </p>

                      <div
                        style={{
                          padding: "10px",
                          background: "#ffffff",
                          border: "1px dashed #d1d5db",
                          borderRadius: "6px",
                          marginTop: "8px",
                          textAlign: "center",
                          fontSize: "11px",
                          color: "#9ca3af",
                        }}
                      >
                        Primary Product Buy Button Area
                      </div>

                      <div style={{ height: "120px" }} />
                    </div>

                    {/* STICKY ADD TO CART BAR IN MOCKUP */}
                    {settings.enabled && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          [settings.position === "top" ? "top" : "bottom"]: 0,
                          backgroundColor: settings.bgColor,
                          color: settings.textColor,
                          borderTop: settings.position === "bottom" ? "1px solid rgba(0,0,0,0.08)" : "none",
                          borderBottom: settings.position === "top" ? "1px solid rgba(0,0,0,0.08)" : "none",
                          padding: `${settings.padding}px 12px`,
                          boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
                          display: "flex",
                          flexDirection: previewDevice === "mobile" ? "column" : "row",
                          gap: "8px",
                          alignItems: previewDevice === "mobile" ? "stretch" : "center",
                          justifyContent: "space-between",
                          zIndex: 10,
                        }}
                      >
                        {/* Left: Product Media + Title + Price */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                          {settings.showThumbnail && (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "4px",
                                background: "#d1d5db",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "14px",
                              }}
                            >
                              🧥
                            </div>
                          )}
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                              }}
                            >
                              Performance Jacket
                            </div>
                            <div style={{ display: "flex", gap: "4px", alignItems: "center", fontSize: "11px" }}>
                              <span style={{ fontWeight: "700" }}>$89.00</span>
                              {settings.showCompareAtPrice && (
                                <span style={{ textDecoration: "line-through", opacity: 0.6, fontSize: "10px" }}>
                                  $119.00
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quantity + Add Button */}
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {settings.showQuantity && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                border: "1px solid rgba(0,0,0,0.15)",
                                borderRadius: `${Math.min(settings.borderRadius, 6)}px`,
                                overflow: "hidden",
                                height: "28px",
                              }}
                            >
                              <button
                                onClick={() => setPreviewQty(Math.max(1, previewQty - 1))}
                                style={{
                                  border: "none",
                                  background: "none",
                                  width: "22px",
                                  cursor: "pointer",
                                  color: settings.textColor,
                                  fontSize: "12px",
                                }}
                              >
                                -
                              </button>
                              <span style={{ fontSize: "11px", minWidth: "16px", textAlign: "center" }}>
                                {previewQty}
                              </span>
                              <button
                                onClick={() => setPreviewQty(previewQty + 1)}
                                style={{
                                  border: "none",
                                  background: "none",
                                  width: "22px",
                                  cursor: "pointer",
                                  color: settings.textColor,
                                  fontSize: "12px",
                                }}
                              >
                                +
                              </button>
                            </div>
                          )}

                          <button
                            onClick={handlePreviewAdd}
                            style={{
                              backgroundColor: previewAdded ? "#16a34a" : settings.buttonBgColor,
                              color: settings.buttonTextColor,
                              border: "none",
                              borderRadius: `${settings.borderRadius}px`,
                              padding: "6px 12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              flex: previewDevice === "mobile" ? "1 1 auto" : "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {previewAdded ? "✓ Added to Cart!" : settings.buttonText}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Box padding="100">
                    <Text as="p" variant="bodyXs" tone="subdued">
                      💡 Click the Add to Cart button in the preview above to test the interactive instant feedback!
                    </Text>
                  </Box>
                </BlockStack>
              </Card>

              {/* Theme Embed Verification Card */}
              <Box paddingBlockStart="300">
                <Card>
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">
                        Theme Integration
                      </Text>
                      <Badge tone="success">Native 2.0</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Uses Shopify App Embeds for zero storefront speed impact.
                    </Text>
                    <Button url={themeEditorUrl} target="_blank" icon={ExternalIcon} size="slim">
                      Open Theme Customizer
                    </Button>
                  </BlockStack>
                </Card>
              </Box>
            </div>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
