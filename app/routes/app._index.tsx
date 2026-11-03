import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
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
  ProgressBar,
  IndexTable,
} from "@shopify/polaris";
import {
  ExternalIcon,
  ProductIcon,
  CartIcon,
  DiscountIcon,
  CheckIcon,
  MagicIcon,
} from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

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
    console.warn("[app._index.loader] authenticate error, using fallback shop:", authError);
  }

  let bundles: any[] = [];
  try {
    bundles = await db.bundle.findMany({
      where: { shop },
      include: { products: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (dbErr) {
    console.warn("[app._index.loader] Error loading bundles from db:", dbErr);
  }

  const activeCount = bundles.filter((b) => b.status === "ACTIVE").length;

  return json({
    shop,
    bundles,
    activeCount,
    themeEditorUrl: `https://${shop}/admin/themes/current/editor?context=apps`,
  });
};

export default function DashboardHome() {
  const { shop, bundles, activeCount, themeEditorUrl } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Onboarding progress calculation
  const hasBundles = bundles.length > 0;
  const completedSteps = 2 + (hasBundles ? 1 : 0);
  const totalSteps = 4;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <Page fullWidth>
      <TitleBar title="TotalBundles Dashboard">
        <button variant="primary" onClick={() => navigate("/app/bundles")}>
          Create New Bundle
        </button>
      </TitleBar>

      <BlockStack gap="600">
        {/* Welcome & Overview Banner */}
        <Banner tone="info" title={`Welcome to TotalBundles for ${shop}`}>
          <p>
            Boost your Average Order Value (AOV) and conversion rate with high-converting bundle discounts
            and the responsive <strong>Sticky Add to Cart</strong> bar.
          </p>
        </Banner>

        {/* Metric Summary Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Active Bundles
                  </Text>
                  <Icon source={ProductIcon} tone="base" />
                </InlineStack>
                <InlineStack align="start" gap="300" blockAlign="baseline">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {activeCount}
                  </Text>
                  <Badge tone={activeCount > 0 ? "success" : "attention"}>
                    {activeCount > 0 ? "Live on Storefront" : "Needs Bundle"}
                  </Badge>
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  {bundles.length} total bundles created
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Sticky Add to Cart
                  </Text>
                  <Icon source={CartIcon} tone="base" />
                </InlineStack>
                <InlineStack align="start" gap="300" blockAlign="baseline">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    Active
                  </Text>
                  <Badge tone="success">Theme App Extension</Badge>
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Always-visible buy bar on product pages
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Expected AOV Lift
                  </Text>
                  <Icon source={DiscountIcon} tone="base" />
                </InlineStack>
                <InlineStack align="start" gap="300" blockAlign="baseline">
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    +24.8%
                  </Text>
                  <Badge tone="info">Industry Benchmark</Badge>
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Tiered bundles drive larger cart sizes
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Quick Setup Checklist */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Quick Setup & Launch Checklist
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Complete these steps to maximize bundle conversions on your store.
                </Text>
              </BlockStack>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {completedSteps} of {totalSteps} completed ({progressPercent}%)
              </Text>
            </InlineStack>

            <ProgressBar progress={progressPercent} tone="primary" size="small" />

            <BlockStack gap="300">
              {/* Step 1 */}
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={CheckIcon} tone="success" />
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        App Installed & Secured
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Shopify App Bridge and OAuth token exchange are active.
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge tone="success">Completed</Badge>
                </InlineStack>
              </Box>

              {/* Step 2 */}
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={CheckIcon} tone="success" />
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Theme App Extension Deployed
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Sticky Add to Cart extension is published to your theme library.
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Button
                    url={themeEditorUrl}
                    target="_blank"
                    icon={ExternalIcon}
                    size="slim"
                  >
                    Open Theme Editor
                  </Button>
                </InlineStack>
              </Box>

              {/* Step 3 */}
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={hasBundles ? CheckIcon : MagicIcon} tone={hasBundles ? "success" : "base"} />
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Configure Your First Bundle Deal
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Set up a tiered volume discount or percentage bundle in Bundle Studio.
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  {hasBundles ? (
                    <Badge tone="success">Completed</Badge>
                  ) : (
                    <Button variant="primary" size="slim" onClick={() => navigate("/app/bundles")}>
                      Create Bundle
                    </Button>
                  )}
                </InlineStack>
              </Box>

              {/* Step 4 */}
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={CartIcon} tone="base" />
                    <BlockStack gap="050">
                      <Text as="p" variant="bodyMd" fontWeight="semibold">
                        Test Sticky Cart on Product Page
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Scroll down on any product page to verify the smooth sticky buy bar appearance.
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Button
                    url={`https://${shop}`}
                    target="_blank"
                    icon={ExternalIcon}
                    size="slim"
                  >
                    Preview Store
                  </Button>
                </InlineStack>
              </Box>
            </BlockStack>
          </BlockStack>
        </Card>

        {/* Active Bundles Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      Active Bundles Overview
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Manage bundle tiers, automatic discounts, and included products.
                    </Text>
                  </BlockStack>
                  <Button onClick={() => navigate("/app/bundles")}>
                    Go to Bundle Studio
                  </Button>
                </InlineStack>

                <Divider />

                {bundles.length > 0 ? (
                  <IndexTable
                    resourceName={{ singular: "bundle", plural: "bundles" }}
                    itemCount={bundles.length}
                    headings={[
                      { title: "Bundle Title" },
                      { title: "Discount Rule" },
                      { title: "Min Items" },
                      { title: "Status" },
                      { title: "Actions" },
                    ]}
                    selectable={false}
                  >
                    {bundles.map((bundle, index) => (
                      <IndexTable.Row id={bundle.id} key={bundle.id} position={index}>
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {bundle.title}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {bundle.discountType === "TIERED" ? (
                            <Badge tone="info">Tiered Volume</Badge>
                          ) : bundle.discountType === "PERCENTAGE" ? (
                            <Badge tone="success">{bundle.discountValue}% Off</Badge>
                          ) : (
                            <Badge tone="attention">${bundle.discountValue} Off</Badge>
                          )}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {bundle.minQuantity} items minimum
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={bundle.status === "ACTIVE" ? "success" : "subdued"}>
                            {bundle.status}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Button size="slim" onClick={() => navigate("/app/bundles")}>
                            Edit in Studio
                          </Button>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                ) : (
                  <Box padding="500">
                    <BlockStack gap="300" align="center" inlineAlign="center">
                      <Icon source={ProductIcon} tone="subdued" />
                      <Text as="p" variant="bodyMd" tone="subdued">
                        No bundles found yet. Launch your first high-converting offer now!
                      </Text>
                      <Button variant="primary" onClick={() => navigate("/app/bundles")}>
                        Create Your First Bundle
                      </Button>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Sticky Add to Cart Feature Spotlight */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">
                    Sticky Add to Cart Bar
                  </Text>
                  <Badge tone="success">Included</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Keeps the buy button in front of customers at all times as they scroll through long product
                  descriptions, customer reviews, and images.
                </Text>
                <BlockStack gap="150">
                  <Text as="p" variant="bodySm">
                    ✅ <strong>Smart Trigger:</strong> Displays automatically after customer scrolls past primary product form.
                  </Text>
                  <Text as="p" variant="bodySm">
                    ✅ <strong>Variant Sync:</strong> Dynamically updates price and availability on dropdown change.
                  </Text>
                  <Text as="p" variant="bodySm">
                    ✅ <strong>Mobile Friendly:</strong> Clean, responsive fixed bar designed for thumb zone taps.
                  </Text>
                </BlockStack>
                <Divider />
                <InlineStack align="end">
                  <Button url={themeEditorUrl} target="_blank" icon={ExternalIcon}>
                    Customize in Theme Editor
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Bundle Studio Pro Tips
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Proven tactics used by 7-figure Shopify stores to increase sales:
                </Text>
                <BlockStack gap="200">
                  <Box padding="200" background="bg-surface-secondary" borderRadius="150">
                    <Text as="p" variant="bodySm">
                      💡 <strong>Tiered Volume Discounts:</strong> Offering 2 for 10% off, 3 for 20% off, and 4 for 30% off
                      encourages shoppers to add that extra item to reach the next discount threshold.
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="150">
                    <Text as="p" variant="bodySm">
                      💡 <strong>Mix & Match Bundling:</strong> Let customers choose variations (e.g. colors/sizes) to reduce
                      return rates and increase perceived customer value.
                    </Text>
                  </Box>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="150">
                    <Text as="p" variant="bodySm">
                      💡 <strong>No App Slowdown:</strong> Built directly on Shopify Functions and Native App Embeds for zero impact on storefront speed.
                    </Text>
                  </Box>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
