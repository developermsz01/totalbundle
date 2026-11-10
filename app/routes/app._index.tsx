import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { handleDashboardLoader, handleDashboardAction } from "../dashboard.server";
import { TotalBundleDashboard } from "../components/TotalBundleDashboard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return handleDashboardLoader(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return handleDashboardAction(request);
};

export default function IndexRoute() {
  return <TotalBundleDashboard />;
}
