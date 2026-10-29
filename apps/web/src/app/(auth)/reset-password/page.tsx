import { ResetClient } from "./reset-client";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetClient token={token ?? ""} />;
}
