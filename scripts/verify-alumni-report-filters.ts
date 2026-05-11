/**
 * Smoke: alumni report filter URL parsing + Mongo pre-match shape (no DB).
 */
import {
  parseAlumniReportFiltersFromSearchParams,
  alumniReportFiltersToSearchParams,
  buildAlumniReportPreLookupMatch,
} from "../src/lib/alumni/alumni-report-filters";

const sp = new URLSearchParams();
sp.set("q", "أحمد ٢٠٢٣");
sp.set("graduationYears", "2023,2024");
sp.set("verifiedAlumni", "yes");
sp.set("hasStories", "yes");
sp.set("mentorFilter", "no");

const f = parseAlumniReportFiltersFromSearchParams(sp);
if (f.graduationYears.join(",") !== "2023,2024") throw new Error("graduationYears");
if (f.verifiedAlumni !== "yes") throw new Error("verifiedAlumni");
if (f.hasStories !== "yes") throw new Error("hasStories");

const roundTrip = alumniReportFiltersToSearchParams(f);
const f2 = parseAlumniReportFiltersFromSearchParams(roundTrip);
if (f2.graduationYears.length !== f.graduationYears.length) throw new Error("roundTrip");

const pre = buildAlumniReportPreLookupMatch(f);
if (!("$and" in pre)) throw new Error("pre.$and");

console.log("verify-alumni-report-filters: ok");
