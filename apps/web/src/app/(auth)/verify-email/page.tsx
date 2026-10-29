import { VerifyClient } from "./verify-client";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyClient token={token ?? ""} />;
}
