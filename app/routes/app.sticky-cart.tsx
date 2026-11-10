import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { handleDashboardLoader, handleDashboardAction } from "../dashboard.server";
import { TotalBundleDashboard } from "../components/TotalBundleDashboard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return handleDashboardLoader(request, "sticky-cart");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleDashboardAction(request);
};

export default function StickyCartRoute() {
  return <TotalBundleDashboard forcedFeature="sticky-cart" />;
}
