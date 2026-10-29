import { MagicClient } from "./magic-client";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <MagicClient token={token ?? ""} />;
}
