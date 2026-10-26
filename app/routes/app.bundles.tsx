import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  Modal,
  TextField,
  Select,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const bundles = await db.bundle.findMany({
    where: { shop: session.shop },
    include: { products: true },
    orderBy: { createdAt: "desc" },
  });

  return json({
    shop: session.shop,
    bundles,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const discountType = String(formData.get("discountType") || "TIERED");
    const discountValue = parseFloat(String(formData.get("discountValue") || "10"));
    const minQuantity = parseInt(String(formData.get("minQuantity") || "2"), 10);
    const tieredRulesJson = String(formData.get("tieredRulesJson") || "");

    if (!title) {
      return json({ error: "Bundle title is required" }, { status: 400 });
    }

    const bundle = await db.bundle.create({
      data: {
        shop: session.shop,
        title,
        description,
        discountType,
        discountValue,
        minQuantity,
        tieredRulesJson: tieredRulesJson || JSON.stringify([
          { minQuantity: 2, discount: 10 },
          { minQuantity: 3, discount: 20 },
          { minQuantity: 4, discount: 30 },
        ]),
        status: "ACTIVE",
      },
    });

    return json({ success: true, createdId: bundle.id });
  }

  if (intent === "seed") {
    // Seed default sample bundles for demonstration
    await db.bundle.create({
      data: {
        shop: session.shop,
        title: "Creator Gear Essentials Pack",
        description: "Tiered mix & match bundle for workspace and audio essentials.",
        discountType: "TIERED",
        discountValue: 15,
        minQuantity: 2,
        tieredRulesJson: JSON.stringify([
          { minQuantity: 2, discount: 10 },
          { minQuantity: 3, discount: 20 },
          { minQuantity: 4, discount: 30 },
        ]),
        status: "ACTIVE",
        products: {
          create: [
            {
              productId: "gid://shopify/Product/1001",
              productTitle: "Studio Pro Dynamic Microphone",
              price: 129.0,
            },
            {
              productId: "gid://shopify/Product/1002",
              productTitle: "Noise-Cancelling Wireless Headphones",
              price: 199.0,
            },
            {
              productId: "gid://shopify/Product/1003",
              productTitle: "Ergonomic Mechanical Keyboard",
              price: 149.0,
            },
          ],
        },
      },
    });

    return json({ success: true, seeded: true });
  }

  if (intent === "delete") {
    const bundleId = String(formData.get("bundleId") || "");
    if (bundleId) {
      await db.bundle.deleteMany({
        where: { id: bundleId, shop: session.shop },
      });
      return json({ success: true, deleted: true });
    }
  }

  if (intent === "toggleStatus") {
    const bundleId = String(formData.get("bundleId") || "");
    const currentStatus = String(formData.get("currentStatus") || "ACTIVE");
    const nextStatus = currentStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";

    if (bundleId) {
      await db.bundle.updateMany({
        where: { id: bundleId, shop: session.shop },
        data: { status: nextStatus },
      });
      return json({ success: true, toggled: true });
    }
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};

export default function BundlesPage() {
  const { bundles } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState("TIERED");
  const [discountValue, setDiscountValue] = useState("10");
  const [minQuantity, setMinQuantity] = useState("2");

  const handleCreateSubmit = () => {
    if (!title.trim()) {
      shopify.toast.show("Please enter a bundle title", { isError: true });
      return;
    }

    const fd = new FormData();
    fd.append("intent", "create");
    fd.append("title", title);
    fd.append("description", description);
    fd.append("discountType", discountType);
    fd.append("discountValue", discountValue);
    fd.append("minQuantity", minQuantity);

    submit(fd, { method: "post" });
    setModalOpen(false);
    setTitle("");
    setDescription("");
    shopify.toast.show("Bundle created successfully!");
  };

  const handleSeed = () => {
    const fd = new FormData();
    fd.append("intent", "seed");
    submit(fd, { method: "post" });
    shopify.toast.show("Sample bundle created!");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this bundle?")) {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("bundleId", id);
      submit(fd, { method: "post" });
      shopify.toast.show("Bundle deleted");
    }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const fd = new FormData();
    fd.append("intent", "toggleStatus");
    fd.append("bundleId", id);
    fd.append("currentStatus", currentStatus);
    submit(fd, { method: "post" });
  };

  const activeCount = bundles.filter((b) => b.status === "ACTIVE").length;
  const totalProducts = bundles.reduce((acc, b) => acc + (b.products?.length || 0), 0);

  return (
    <Page>
      <TitleBar title="Bundle Studio" />
      <BlockStack gap="500">
        {/* Metric Overview Row */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Active Bundles
                </Text>
                <Text as="p" variant="heading2xl">
                  {activeCount}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Live on storefront promotions
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Tier Discounts
                </Text>
                <Text as="p" variant="heading2xl">
                  10% - 30%
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Multi-tier progressive discount
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Bundled Items
                </Text>
                <Text as="p" variant="heading2xl">
                  {totalProducts}
                </Text>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Configured across all packs
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Action Bar */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                Configured Product Bundles
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Build mix-and-match packages, volume bundles, and tier discount rules.
              </Text>
            </BlockStack>
            <InlineStack gap="300">
              {bundles.length === 0 && (
                <Button onClick={handleSeed} loading={isSubmitting}>
                  ⚡ Load Demo Bundle
                </Button>
              )}
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                + Create New Bundle
              </Button>
            </InlineStack>
          </InlineStack>
        </Card>

        {/* Bundles List */}
        <Card padding="0">
          {bundles.length === 0 ? (
            <Box padding="500">
              <BlockStack gap="300" inlineAlign="center">
                <Text as="p" variant="bodyMd" tone="subdued">
                  No bundles created yet. Click "Create New Bundle" or "Load Demo Bundle" to get started.
                </Text>
                <InlineStack gap="200">
                  <Button variant="primary" onClick={() => setModalOpen(true)}>
                    Create First Bundle
                  </Button>
                  <Button onClick={handleSeed}>Seed Sample Bundle</Button>
                </InlineStack>
              </BlockStack>
            </Box>
          ) : (
            <IndexTable
              resourceName={{ singular: "bundle", plural: "bundles" }}
              itemCount={bundles.length}
              headings={[
                { title: "Bundle Title" },
                { title: "Status" },
                { title: "Discount Rule" },
                { title: "Min Quantity" },
                { title: "Items" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {bundles.map((bundle, index) => (
                <IndexTable.Row id={bundle.id} key={bundle.id} position={index}>
                  <IndexTable.Cell>
                    <BlockStack gap="050">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">
                        {bundle.title}
                      </Text>
                      {bundle.description && (
                        <Text as="span" variant="bodyXs" tone="subdued">
                          {bundle.description}
                        </Text>
                      )}
                    </BlockStack>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone={bundle.status === "ACTIVE" ? "success" : "info"}>
                      {bundle.status}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Badge tone="attention">
                      {bundle.discountType === "TIERED"
                        ? "Progressive Tier (10%-30%)"
                        : `${bundle.discountValue}% OFF`}
                    </Badge>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">
                      {bundle.minQuantity} items min
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text as="span" variant="bodySm">
                      {bundle.products?.length || 0} products
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <InlineStack gap="200">
                      <Button
                        size="micro"
                        onClick={() => handleToggleStatus(bundle.id, bundle.status)}
                      >
                        {bundle.status === "ACTIVE" ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        size="micro"
                        tone="critical"
                        onClick={() => handleDelete(bundle.id)}
                      >
                        Delete
                      </Button>
                    </InlineStack>
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          )}
        </Card>

        {/* Integration Instructions Card */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">
                  🚀 Ready for Shopify Functions & Storefront Integration
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This bundle application is configured with Shopify Remix, Polaris, and Prisma SQLite.
                  You can deploy discounts directly to checkout using Shopify CLI Function extensions:
                </Text>
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <Text as="p" variant="bodySm">
                    <code>shopify app generate extension --template=product_discount --name=bundle-discount</code>
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Create Bundle Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Custom Product Bundle"
        primaryAction={{
          content: "Save Bundle",
          onAction: handleCreateSubmit,
          loading: isSubmitting,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Bundle Title"
              value={title}
              onChange={setTitle}
              placeholder="e.g., Ultimate Creator Pack"
              autoComplete="off"
            />
            <TextField
              label="Description (Optional)"
              value={description}
              onChange={setDescription}
              placeholder="e.g., Mix and match any 3 accessories to get 20% off"
              multiline={3}
              autoComplete="off"
            />
            <Select
              label="Discount Model"
              options={[
                { label: "Tiered Volume (2 items = 10%, 3 items = 20%, 4+ items = 30%)", value: "TIERED" },
                { label: "Fixed Percentage (e.g. 15% off all bundle items)", value: "PERCENTAGE" },
                { label: "Fixed Dollar Discount", value: "FIXED_AMOUNT" },
              ]}
              value={discountType}
              onChange={setDiscountType}
            />
            {discountType !== "TIERED" && (
              <TextField
                label="Discount Value"
                type="number"
                value={discountValue}
                onChange={setDiscountValue}
                suffix={discountType === "PERCENTAGE" ? "%" : "$"}
                autoComplete="off"
              />
            )}
            <TextField
              label="Minimum Required Items"
              type="number"
              value={minQuantity}
              onChange={setMinQuantity}
              autoComplete="off"
              helpText="The customer must pick at least this many items to activate the bundle discount."
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
