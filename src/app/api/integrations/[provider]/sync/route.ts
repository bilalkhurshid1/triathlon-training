export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return Response.json(
    { error: `'${provider}' sync not implemented`, hint: "Coming after the MVP." },
    { status: 501 }
  );
}
