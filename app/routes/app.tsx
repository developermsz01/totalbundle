import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (authError) {
    // If it's a thrown Response (like redirect to auth or bounce page), rethrow for Remix
    if (authError instanceof Response) {
      throw authError;
    }
    console.error("[app.loader] Authentication error:", authError);
  }

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Sticky Cart
        </Link>
        <Link to="/app/additional">Documentation</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch thrown Responses, so that headers are included.
// Any runtime error is caught safely without breaking out to root.
export function ErrorBoundary() {
  const error = useRouteError();
  try {
    return boundary.error(error);
  } catch (caughtError: any) {
    return (
      <div
        style={{
          padding: "32px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'San Francisco', Roboto, 'Segoe UI', 'Helvetica Neue', sans-serif",
          maxWidth: "640px",
          margin: "40px auto",
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          border: "1px solid #e1e3e5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#202223", margin: 0 }}>
            TotalBundles Notice
          </h2>
        </div>
        <p style={{ color: "#4a4f54", lineHeight: "1.5", fontSize: "14px" }}>
          The app encountered a temporary initialization delay while loading data.
        </p>
        <div
          style={{
            background: "#f6f6f7",
            padding: "12px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#6d7175",
            marginBottom: "20px",
            wordBreak: "break-all",
          }}
        >
          {caughtError?.message || String(caughtError)}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: "#008060",
            color: "#ffffff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Reload Dashboard
        </button>
      </div>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
