export async function POST() {
  return Response.json(
    { error: "File import (FIT/GPX/TCX) not implemented", hint: "Coming after the MVP." },
    { status: 501 }
  );
}
