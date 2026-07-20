import { FellowshipDashboard } from "@/components/FellowshipDashboard";

export default async function FellowshipPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <FellowshipDashboard code={code} />;
}
