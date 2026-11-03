import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let title = "Application Notice";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    details = error.data?.message || (typeof error.data === "string" ? error.data : details);
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <html>
      <head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, fontFamily: "Inter, -apple-system, sans-serif", backgroundColor: "#f6f6f7", color: "#202223" }}>
        <div style={{ maxWidth: "600px", margin: "60px auto", padding: "32px", background: "#ffffff", borderRadius: "12px", border: "1px solid #e1e3e5", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span style={{ fontSize: "28px" }}>📦</span>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>TotalBundles</h1>
              <p style={{ margin: 0, fontSize: "13px", color: "#6d7175" }}>Smart Bundling & Sticky Cart for Shopify</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "20px" }}>
            <h2 style={{ fontSize: "16px", color: "#202223", marginTop: 0 }}>{title}</h2>
            <p style={{ fontSize: "14px", lineHeight: "1.5", color: "#4a4f54" }}>
              {details}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#008060",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              Retry Connection
            </button>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
