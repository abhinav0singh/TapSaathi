import RiderExperience from "@/components/worker/RiderExperience";

export default async function WorkerPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;

  return <RiderExperience workerId={workerId} />;
}
