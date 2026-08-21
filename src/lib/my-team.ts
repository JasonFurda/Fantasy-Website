// Cookie that stores which franchise the visitor is "viewing as".
// Value is an espn_id (number as string), or "none" for browsing without a team.
// Unset means the visitor hasn't chosen yet (show the picker).
export const MY_TEAM_COOKIE = "chamoms_team";
export const MY_TEAM_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
