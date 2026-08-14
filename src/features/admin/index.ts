// Compatibility barrel: corrects a typo'd directory name (src/features/adimn) by re-exporting
// the intended public API under src/features/admin so imports like `@/features/admin` work.

export { summarizeModerationRow, snippet, groupBySeverity, type ModerationQueueRow } from "../adimn/moderationSummary";
export { fetchDashboardStats, type DashboardStats } from "../adimn/dashboardStats";
export { importRosterAsInvites, parseRosterCsv, type RosterRow, type RosterImportResult } from "../adimn/rosterImport";
export { getOrgFileLimits, updateOrgFileLimits, type OrgFileLimits } from "../adimn/fileLimits";
