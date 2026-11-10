import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { handleDashboardLoader, handleDashboardAction } from "../dashboard.server";
import { TotalBundleDashboard } from "../components/TotalBundleDashboard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return handleDashboardLoader(request, "cart-drawer");
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleDashboardAction(request);
};

export default function CartDrawerRoute() {
  return <TotalBundleDashboard forcedFeature="cart-drawer" />;
}

