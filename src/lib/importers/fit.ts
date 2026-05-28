// Placeholder for future FIT/GPX/TCX parsing. Real implementation will likely
// live in a separate Python worker (better library ecosystem) writing into the
// same ActivityImport + Workout tables.

export async function parseFit(): Promise<never> {
  throw new Error("FIT parser not implemented yet. Use a Python worker.");
}
