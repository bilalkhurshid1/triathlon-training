import { importDiaryTxt } from "@/lib/importers/diary-txt";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  let raw: string;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "missing 'file' field" }, { status: 400 });
    }
    raw = await file.text();
  } else {
    raw = await req.text();
  }
  const result = await importDiaryTxt(raw);
  return Response.json(result);
}
