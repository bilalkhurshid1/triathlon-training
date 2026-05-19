import type { DistanceUnit, WorkoutType } from "@/lib/validators";

const SPORT_KEYWORDS: Array<[RegExp, WorkoutType]> = [
  [/\b(swim|swam|swimming|pool)\b/i, "swim"],
  [/\b(bike|biking|bicycle|cycling|cycle|stationary bike|ride)\b/i, "bike"],
  [/\b(treadmill|run|ran|jog|jogging|5k|5K)\b/i, "run"],
  [
    /\b(lift|lifting|upper body|push\s*day|pull\s*day|leg\s*day|legs|deadlift|bench|squat|row|lat\s*pull(?:down)?|dumbbell|pec\s*fly|shoulder\s*press|hams|calves|tri\s*pull|biceps|press)\b/i,
    "lift",
  ],
  [/\bbrick\b/i, "brick"],
  [/\brest\b/i, "rest"],
];

export function detectSport(text: string): WorkoutType {
  for (const [re, sport] of SPORT_KEYWORDS) {
    if (re.test(text)) return sport;
  }
  return "other";
}

const DISTANCE_RE = /(\d+(?:\.\d+)?)\s*(miles?|mi|km|yards?|yd|k|m)\b/i;
const HMS_RE = /\b(\d{1,2}):(\d{2}):(\d{2})\b/;
const MS_RE = /\b(\d{1,3}):(\d{2})\b/;
const MIN_RE = /\b(\d{1,3})\s*(?:mins?|minutes?)\b/i;
const PACE_RE = /\b(\d{1,2}):(\d{2})\s*\/\s*mi\b/i;
const MPH_RE = /(\d+(?:\.\d+)?)\s*mph\b/i;

export function extractDistance(text: string): { distance: number; unit: DistanceUnit } | null {
  const m = text.match(DISTANCE_RE);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const raw = m[2].toLowerCase();
  let unit: DistanceUnit;
  if (raw.startsWith("mi")) unit = "mi";
  else if (raw === "km" || raw === "k") unit = "km";
  else if (raw === "m") unit = "m";
  else unit = "yd";
  return { distance: value, unit };
}

export function extractDurationMin(text: string): number | null {
  let m = text.match(HMS_RE);
  if (m) return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / 60);
  m = text.match(MIN_RE);
  if (m) return Number(m[1]);
  m = text.match(MS_RE);
  if (m) {
    // Skip pace strings like "10:25/mi"
    const tail = text.slice(m.index! + m[0].length);
    if (/^\s*\//.test(tail)) return null;
    return Math.round(Number(m[1]) + Number(m[2]) / 60);
  }
  return null;
}

export function extractSpeedMph(text: string): number | null {
  const m = text.match(MPH_RE);
  return m ? parseFloat(m[1]) : null;
}

export function extractPaceSecPerMi(text: string): number | null {
  const m = text.match(PACE_RE);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function isMetricOnlyFragment(text: string): boolean {
  for (const [re] of SPORT_KEYWORDS) {
    if (re.test(text)) return false;
  }
  if (HMS_RE.test(text)) return true;
  if (MPH_RE.test(text)) return true;
  if (PACE_RE.test(text)) return true;
  if (/\d+(\.\d+)?\s*(mi|miles?|km|yd|yards?)\b/i.test(text) && text.length < 40) return true;
  if (/\d+(\.\d+)?\s*%/.test(text) && text.length < 30) return true; // "1% incline"
  if (/^\s*\d{1,3}:\d{2}\s*$/.test(text)) return true; // pure MM:SS
  if (MIN_RE.test(text) && text.length < 40) return true;
  // Short trailing annotations like "at Welles park" attach to previous chunk.
  if (text.length <= 25 && /^(at|in|near|by|on)\b/i.test(text)) return true;
  return false;
}

/**
 * Split a day's free-text line into one chunk per activity, then merge
 * fragments that are just metrics back into their parent. Parenthesized
 * content (lists of lifts) is preserved as part of a single chunk.
 */
export function splitActivities(line: string): string[] {
  // Mask parenthesized groups so we don't split inside them.
  const parens: string[] = [];
  const masked = line.replace(/\(([^()]*)\)/g, (_, inner: string) => {
    parens.push(inner);
    return ` __P${parens.length - 1}__ `;
  });

  const rawParts = masked
    .split(/\s*,?\s*followed by\s+|\s*,\s*|(?<!\d)\.\s+(?:and\s+)?(?:then\s+)?/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (const part of rawParts) {
    if (merged.length > 0 && isMetricOnlyFragment(part)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${part}`;
    } else {
      merged.push(part);
    }
  }

  return merged.map((p) =>
    p.replace(/__P(\d+)__/g, (_, idx) => `(${parens[Number(idx)]})`)
  );
}
