import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { admin } = await authenticate.admin(request);
    const url = new URL(request.url);
    const queryTerm = url.searchParams.get("q") || "";

    const graphqlQuery = `
      query SearchProducts($query: String) {
        products(first: 30, query: $query) {
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
    `;

    const response = await admin.graphql(graphqlQuery, {
      variables: {
        query: queryTerm ? `title:*${queryTerm}*` : null,
      },
    });

    const data = await response.json();
    const rawNodes = data?.data?.products?.nodes || [];

    const products = rawNodes.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      image: p.featuredMedia?.image?.url || "",
      variants: (p.variants?.nodes || []).map((v: any) => {
        const numericId = String(v.id).replace("gid://shopify/ProductVariant/", "");
        return {
          id: v.id,
          numericId,
          title: v.title,
          price: v.price ? (String(v.price).startsWith("$") ? String(v.price) : `$${v.price}`) : "$0.00",
          compareAtPrice: v.compareAtPrice
            ? String(v.compareAtPrice).startsWith("$")
              ? String(v.compareAtPrice)
              : `$${v.compareAtPrice}`
            : "",
          image: v.image?.url || p.featuredMedia?.image?.url || "",
        };
      }),
    }));

    return json({ success: true, products });
  } catch (error: any) {
    console.error("[api.store-products] Error fetching store products:", error);
    return json({ success: false, products: [], error: String(error?.message || error) }, { status: 500 });
  }
};

