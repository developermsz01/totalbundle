import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getCartDrawerSettings } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "";
  const settings = getCartDrawerSettings(shop);

  return json(
    { settings },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
};
