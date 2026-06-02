/* app.js (Supabase-backed weekly data; static HTML for other tabs)
   Weekly matchups load from Supabase. Other views use pre-generated HTML.

   Replace SUPABASE_ANON_KEY with your publishable key (Dashboard → Settings → API).
*/

const SUPABASE_URL = 'https://ixxltpuzpwsdwqhupaor.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-ecI4qXWNBPkKiKG3o1uEA_-Qa4r_J2';

let supabaseClient;
if (globalThis.supabase) {
  const { createClient } = globalThis.supabase;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error(
    'Missing Supabase JS: add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> before app.js.'
  );
}

let yearDataCache = {};
let currentYear = 2025;
let currentWeek = null;
let currentMatchupIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded - initializing page");
  // Show Weekly Matchups by default
  showWeeklyMatchups();
  
  // Default to 2025 if present, else first available
  loadYear(currentYear).catch(err => {
    console.error("Error loading year:", err);
    showError(`Failed to load data: ${err.message}. Make sure you're running from a web server (not file://).`);
  });
});

function normalizeEmbed(obj) {
  if (obj == null) return null;
  return Array.isArray(obj) ? obj[0] : obj;
}

function mapPlayerSlotRow(row) {
  return {
    slot: row.slot ?? '',
    name: row.player_name ?? 'Unknown',
    proTeam: row.pro_team ?? '',
    opp: row.opponent ?? '',
    points: Number(row.points) || 0,
    proj: Number(row.projected) || 0,
    gamePlayed: row.game_played ?? 0,
    bye: !!row.is_bye,
    injuryStatus: row.injury_status ?? '',
    injured: !!row.is_injured,
    bench: !!row.is_bench,
  };
}

function buildLineup(slots, teamSide) {
  return (slots || [])
    .filter((s) => s.team_side === teamSide)
    .sort((a, b) => (a.sort_idx ?? 0) - (b.sort_idx ?? 0))
    .map(mapPlayerSlotRow);
}

function reshapeYearFromSupabase(year, seasonRow, matchups) {
  const weeks = {};
  let maxWeek = 0;

  for (const row of matchups) {
    const w = Number(row.week);
    if (!Number.isFinite(w)) continue;
    maxWeek = Math.max(maxWeek, w);
    const key = String(w);
    if (!weeks[key]) weeks[key] = [];

    const awayTeam = normalizeEmbed(row.away_team);
    const homeTeam = normalizeEmbed(row.home_team);
    const slots = row.player_slots || [];

    weeks[key].push({
      away: {
        id: awayTeam && awayTeam.espn_id != null ? Number(awayTeam.espn_id) : 0,
        name: awayTeam?.name ?? 'Unknown',
        owner: awayTeam?.owner ?? '',
        score: Number(row.away_score) || 0,
        projected: Number(row.away_projected) || 0,
        lineup: buildLineup(slots, 'away'),
      },
      home: {
        id: homeTeam && homeTeam.espn_id != null ? Number(homeTeam.espn_id) : 0,
        name: homeTeam?.name ?? 'Unknown',
        owner: homeTeam?.owner ?? '',
        score: Number(row.home_score) || 0,
        projected: Number(row.home_projected) || 0,
        lineup: buildLineup(slots, 'home'),
      },
    });
  }

  const cw = seasonRow?.current_week;
  return {
    year,
    current_week: cw != null && !Number.isNaN(Number(cw)) ? Number(cw) : (maxWeek || 1),
    weeks,
  };
}

// ---------- Data loading ----------
async function loadYear(year) {
  currentYear = year;

  if (!yearDataCache[year]) {
    try {
      console.log('SUPABASE_ANON_KEY value:', JSON.stringify(SUPABASE_ANON_KEY));
      if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'your_anon_key_here') {
        throw new Error(
          'Set SUPABASE_ANON_KEY in app.js to your Supabase publishable (anon) key (Dashboard → Settings → API).'
        );
      }

      if (!supabaseClient) {
        throw new Error('Supabase client failed to initialize. Load @supabase/supabase-js before app.js.');
      }

      const { data: seasonRow, error: seasonErr } = await supabaseClient
        .from('seasons')
        .select('current_week')
        .eq('year', year)
        .maybeSingle();
      if (seasonErr) throw seasonErr;

      const { data: matchups, error: matchupsErr } = await supabaseClient
        .from('matchups')
        .select(
          `
            id, week, away_score, home_score, away_projected, home_projected,
            away_team:teams!matchups_away_team_id_fkey(id, espn_id, name, owner),
            home_team:teams!matchups_home_team_id_fkey(id, espn_id, name, owner),
            player_slots(team_side, slot, player_name, pro_team, opponent, points, projected, game_played, is_bye, injury_status, is_injured, is_bench, sort_idx)
          `
        )
        .eq('year', year)
        .order('week', { ascending: true })
        .order('id', { ascending: true });
      if (matchupsErr) throw matchupsErr;

      yearDataCache[year] = reshapeYearFromSupabase(year, seasonRow, matchups || []);

      /* Fallback (local JSON): restore if needed
      const resp = await fetch(`data-${year}.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      yearDataCache[year] = await resp.json();
      */
    } catch (err) {
      if (String(err.message || '').includes('fetch')) {
        throw new Error(
          `Cannot load data. If using JSON files, run a local web server. Supabase error: ${err.message}`
        );
      }
      throw err;
    }
  }

  const yd = yearDataCache[year];
  if (!yd || !yd.weeks) {
    throw new Error('Invalid data format from Supabase (missing weeks).');
  }

  const weekKeys = Object.keys(yd.weeks).map(Number).filter((w) => !isNaN(w));
  if (weekKeys.length === 0) {
    throw new Error(`No weeks found for season ${year} in Supabase.`);
  }

  currentWeek = yd.current_week || Math.max(...weekKeys);

  renderYearButtons(year);

  // Show Weekly Matchups if it's visible
  const weeklyMatchupsPage = document.getElementById('weekly-matchups-content');
  if (weeklyMatchupsPage && weeklyMatchupsPage.style.display !== 'none') {
    renderWeekNav(yd);
    showWeek(currentWeek, year);
  } else {
    // If Weekly Matchups is not shown, just render the nav (it will be hidden)
    renderWeekNav(yd);
    showWeek(currentWeek, year);
  }
}

function showError(message) {
  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `
      <div style="padding: 40px; text-align: center; background: #fee; border: 2px solid #fcc; border-radius: 10px; margin: 20px;">
        <h2 style="color: #c00;">Error Loading Data</h2>
        <p style="color: #800; font-size: 1.1em; margin: 20px 0;">${escapeHtml(message)}</p>
        <p style="color: #666; margin-top: 20px;">
          <strong>To fix this:</strong><br>
          Open a terminal in this folder and run:<br>
          <code style="background: #fff; padding: 5px 10px; border-radius: 5px;">python -m http.server 8000</code><br>
          Then open <code style="background: #fff; padding: 5px 10px; border-radius: 5px;">http://localhost:8000</code> in your browser.
        </p>
      </div>
    `;
  }
  console.error(message);
}

function renderYearButtons(year) {
  const btn2024 = document.getElementById("year-2024-btn");
  const btn2025 = document.getElementById("year-2025-btn");
  if (btn2024) btn2024.classList.toggle("active", year === 2024);
  if (btn2025) btn2025.classList.toggle("active", year === 2025);
}

// ---------- Week navigation ----------
function renderWeekNav(yd) {
  const weekNav = document.getElementById("week-nav");
  if (!weekNav) {
    console.error("week-nav element not found!");
    return;
  }

  const weeks = Object.keys(yd.weeks || {}).map(Number).filter(w => !isNaN(w)).sort((a,b)=>a-b);
  
  if (weeks.length === 0) {
    weekNav.innerHTML = '<div style="padding: 20px; color: #c00;">No weeks found in data.</div>';
    return;
  }

  weekNav.className = "week-navigation"; // Ensure it has the right class
  weekNav.innerHTML = `
    <div class="week-nav-label">Weeks:</div>
    ${weeks.map(w => `
      <button class="week-button ${w===currentWeek ? "active" : ""}"
              onclick="showWeek(${w}, ${yd.year})"
              ${w===yd.current_week ? "data-current='true'" : ""}>
        Week ${w}
      </button>
    `).join("")}
  `;
}

// ---------- Primary view switching ----------
window.switchYear = function(year){
  // Show Weekly Matchups when switching year
  hideSharedPages();
  showWeeklyMatchups();
  loadYear(year).catch(err => console.error(err));
};

window.showWeek = function(week, year){
  // Only hide shared pages if we're not in Weekly Matchups
  const weeklyMatchupsPage = document.getElementById("weekly-matchups-content");
  if (!weeklyMatchupsPage || weeklyMatchupsPage.style.display === "none") {
    hideSharedPages();
  }

  const yd = yearDataCache[year];
  if (!yd) {
    console.error(`No data cached for year ${year}`);
    return;
  }

  currentWeek = week;
  currentMatchupIndex = 0;

  // Show week and matchup navigation (only if we're in Weekly Matchups)
  if (weeklyMatchupsPage && weeklyMatchupsPage.style.display !== "none") {
    const weekNav = document.getElementById("week-nav");
    const matchupNav = document.getElementById("matchup-nav");
    const content = document.getElementById("content");
    if (weekNav) {
      weekNav.style.display = "flex";
      weekNav.className = "week-navigation"; // Ensure correct class
    }
    if (matchupNav) {
      matchupNav.style.display = "flex";
      matchupNav.className = "matchup-tabs"; // Ensure correct class
    }
    if (content) content.style.display = "block";
  }

  // Update active week button
  document.querySelectorAll(".week-button").forEach(btn=>{
    btn.classList.toggle("active", btn.textContent.trim() === `Week ${week}`);
  });

  renderMatchupTabs(yd, week);
  showMatchup(week, 0, year);
};

function renderMatchupTabs(yd, week){
  const matchupNav = document.getElementById("matchup-nav");
  if (!matchupNav) {
    console.error("matchup-nav element not found!");
    return;
  }

  const matchups = yd.weeks[week] || [];
  if (matchups.length === 0) {
    matchupNav.innerHTML = '<div style="padding: 20px; color: #c00;">No matchups found for this week.</div>';
    return;
  }

  matchupNav.innerHTML = matchups.map((m, i) => `
      <button class="matchup-tab-button ${i===0 ? "active":""}"
              onclick="showMatchup(${week}, ${i}, ${yd.year})">
        ${escapeHtml(m.away ? m.away.name : 'Away')} @ ${escapeHtml(m.home ? m.home.name : 'Home')}
      </button>
  `).join("");
}

window.showMatchup = function(week, matchupIndex, year){
  const yd = yearDataCache[year];
  if (!yd) {
    console.error(`No data cached for year ${year}`);
    return;
  }

  currentMatchupIndex = matchupIndex;

  const matchups = yd.weeks[week] || [];
  const m = matchups[matchupIndex];
  if (!m) {
    const content = document.getElementById("content");
    if (content) {
      content.innerHTML = `<div style="padding:20px; text-align: center;">No matchup data found for Week ${week}, Matchup ${matchupIndex + 1}.</div>`;
    }
    return;
  }

  // Update active matchup tab
  document.querySelectorAll(".matchup-tab-button").forEach((btn, idx)=>{
    btn.classList.toggle("active", idx === matchupIndex);
  });

  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = renderMatchup(m);
  } else {
    console.error("content element not found!");
  }
};

// ---------- Rendering ----------
function renderMatchup(m){
  const awayWinner = m.away.score > m.home.score;
  const homeWinner = m.home.score > m.away.score;

  return `
    <div class="teams-container">
      ${renderTeamBox(m.away, "away-team", awayWinner)}
      ${renderTeamBox(m.home, "home-team", homeWinner)}
    </div>
  `;
}

function renderTeamBox(team, sideClass, isWinner){
  const winnerClass = isWinner ? "winner" : "loser";

  const rows = team.lineup.map(p => renderPlayerRow(p)).join("");

  return `
    <div class="team-box ${sideClass} ${winnerClass}">
      <div class="team-header">
        <h3>${escapeHtml(team.name)}</h3>
        <p class="owner">${escapeHtml(team.owner || "")}</p>
        <div class="score-box">
          <span class="score">${number(team.score)}</span>
          <span class="projected-score">Proj: ${number(team.projected)}</span>
        </div>
      </div>

      <table class="lineup-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Player</th>
            <th>Team</th>
            <th>Opp</th>
            <th>Points</th>
            <th>Proj</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayerRow(p){
  const perfClass = performanceClass(p.points, p.proj);
  const playingClass = (p.gamePlayed < 100 && !p.bye) ? "player-playing" : "player-finished";
  const benchClass = p.bench ? "player-bench" : "";

  return `
    <tr class="${playingClass} ${benchClass} ${perfClass}">
      <td>${escapeHtml(p.slot)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.proTeam)}</td>
      <td>${escapeHtml(p.opp)}</td>
      <td class="points">${number(p.points)}</td>
      <td class="projected">${number(p.proj)}</td>
    </tr>
  `;
}

// Match your old perf buckets (approx)
function performanceClass(points, proj){
  if (proj <= 0) return "";
  const ratio = points / proj;
  if (ratio >= 1.35) return "perf-amazing";
  if (ratio >= 1.15) return "perf-great";
  if (ratio >= 0.95) return "perf-good";
  if (ratio >= 0.75) return "perf-bad";
  if (ratio >= 0.55) return "perf-very-bad";
  return "perf-terrible";
}

// ---------- Shared pages visibility (Weekly Matchups/Player Comparisons/Stats/Teams) ----------
function hideSharedPages(){
  // These ids match what your python generator emits
  const idsToHide = [
    "weekly-matchups-content",
    "player-comparisons-content",
    "total-year-stats-content",
    "team-pages-content"
  ];
  idsToHide.forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

window.showWeeklyMatchups = function(){
  try {
    hideSharedPages();
    const weeklyMatchupsPage = document.getElementById("weekly-matchups-content");
    if (weeklyMatchupsPage) {
      weeklyMatchupsPage.style.display = "block";
      // Show week and matchup navigation
      const weekNav = document.getElementById("week-nav");
      const matchupNav = document.getElementById("matchup-nav");
      const content = document.getElementById("content");
      if (weekNav) {
        weekNav.style.display = "flex";
        weekNav.className = "week-navigation";
      }
      if (matchupNav) {
        matchupNav.style.display = "flex";
        matchupNav.className = "matchup-tabs";
      }
      if (content) {
        content.style.display = "block";
      }
      // If we have a current week, show it
      if (currentWeek && yearDataCache[currentYear]) {
        const yd = yearDataCache[currentYear];
        renderWeekNav(yd);
        showWeek(currentWeek, currentYear);
      }
    } else {
      console.error("weekly-matchups-content element not found!");
    }
  } catch (error) {
    console.error("Error in showWeeklyMatchups:", error);
  }
};

window.showPlayerComparisons = function(){
  try {
    hideMatchups();
    const playerComparisonsPage = document.getElementById("player-comparisons-content");
    if (playerComparisonsPage) {
      playerComparisonsPage.style.display = "block";
      // Show WR tab by default (first tab)
      showPlayerComparisonTab('wr');
    } else {
      console.error("player-comparisons-content element not found!");
    }
  } catch (error) {
    console.error("Error in showPlayerComparisons:", error);
  }
};

window.showPlayerComparisonTab = function(tab){
  // Hide all stats tab contents
  document.querySelectorAll('.stats-tab-content').forEach(el => {
    el.style.display = 'none';
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('.stats-tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab content
  let contentId;
  let tabButtonId;
  
  if (tab === 'wr') {
    contentId = 'wr-comparison-content';
    tabButtonId = 'player-comparison-tab-wr';
  } else if (tab === 'rb') {
    contentId = 'rb-comparison-content';
    tabButtonId = 'player-comparison-tab-rb';
  } else if (tab === 'defense') {
    contentId = 'defense-rankings-content';
    tabButtonId = 'player-comparison-tab-defense';
  }
  
  const content = document.getElementById(contentId);
  const tabButton = document.getElementById(tabButtonId);
  
  if (content) content.style.display = 'block';
  if (tabButton) tabButton.classList.add('active');
};

window.showTotalYearStats = function(){
  // Hide weekly matchups navigation elements first
  hideMatchups();
  
  // Hide all other shared pages (but NOT total-year-stats-content)
  const idsToHide = [
    "weekly-matchups-content",
    "player-comparisons-content",
    "team-pages-content"
  ];
  idsToHide.forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  
  // Now show only the total year stats content
  const totalYearStatsContent = document.getElementById("total-year-stats-content");
  if (totalYearStatsContent) {
    totalYearStatsContent.style.display = "block";
  }
};

window.showTeamPages = function(){
  try {
    // Hide weekly matchups navigation elements first
    hideMatchups();
    
    // Hide all other shared pages (but NOT team-pages-content)
    const idsToHide = [
      "weekly-matchups-content",
      "player-comparisons-content",
      "total-year-stats-content"
    ];
    idsToHide.forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    
    // Now show only the team pages content
    const teamPagesContent = document.getElementById("team-pages-content");
    if (teamPagesContent) {
      teamPagesContent.style.display = "block";
    } else {
      console.error("team-pages-content element not found!");
    }
  } catch (error) {
    console.error("Error in showTeamPages:", error);
  }
};

function hideMatchups(){
  // clear matchup UI and hide navigation to avoid white space
  const weekNav = document.getElementById("week-nav");
  const matchupNav = document.getElementById("matchup-nav");
  const content = document.getElementById("content");
  if (weekNav) {
    weekNav.innerHTML = "";
    weekNav.style.display = "none";
  }
  if (matchupNav) {
    matchupNav.innerHTML = "";
    matchupNav.style.display = "none";
  }
  if (content) {
    content.innerHTML = "";
    content.style.display = "none";
  }
}

function showOnly(id){
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}

// If your shared pages rely on these, keep them:
window.showStatsPage = function(pageName){
  document.querySelectorAll(".stats-page").forEach(p=>p.style.display="none");
  document.querySelectorAll(".stats-tab-button").forEach(b=>b.classList.remove("active"));
  const page = document.getElementById(`${pageName}-page`);
  if (page) page.style.display="block";
  const btn = document.querySelector(`.stats-tab-button[onclick*="${pageName}"]`);
  if (btn) btn.classList.add("active");
};

window.showVulturePercentage = function(team){
  document.querySelectorAll(".vulture-modal").forEach(m=>m.style.display="none");
  const modal = document.getElementById(`vulture-modal-${team}`);
  if (modal) modal.style.display="block";
};

window.closeVultureModal = function(){
  document.querySelectorAll(".vulture-modal").forEach(m=>m.style.display="none");
};

window.showWRTargetsPercentage = function(team){
  document.querySelectorAll(".targets-modal").forEach(m=>m.style.display="none");
  const modal = document.getElementById(`targets-modal-${team}`);
  if (modal) modal.style.display="block";
};

window.closeTargetsModal = function(){
  document.querySelectorAll(".targets-modal").forEach(m=>m.style.display="none");
};

window.showTeam = function(teamId){
  document.querySelectorAll(".team-content").forEach(c=>c.style.display="none");
  document.querySelectorAll(".team-tab-button").forEach(b=>b.classList.remove("active"));
  const content = document.getElementById(`team-${teamId}-content`);
  const btn = document.getElementById(`team-tab-${teamId}`);
  if (content) content.style.display="block";
  if (btn) btn.classList.add("active");
};

window.showTeamYear = function(teamId, year){
  document.querySelectorAll(`#team-${teamId}-content .team-year-content`).forEach(c=>c.style.display="none");
  document.querySelectorAll(`#team-${teamId}-content .year-tab-button`).forEach(b=>b.classList.remove("active"));
  const content = document.getElementById(`team-${teamId}-year-${year}-content`);
  const btn = document.getElementById(`team-${teamId}-year-${year}-tab`);
  if (content) content.style.display="block";
  if (btn) btn.classList.add("active");
};

window.showDefenseBreakdown = function(defense){
  document.querySelectorAll(".vulture-modal").forEach(m=>m.style.display="none");
  const modal = document.getElementById(`defense-breakdown-modal-${defense}`);
  if (modal) modal.style.display="block";
};

window.closeDefenseBreakdown = function(defense){
  const modal = document.getElementById(`defense-breakdown-modal-${defense}`);
  if (modal) modal.style.display="none";
};

// Verify all main functions are defined (for debugging on GitHub Pages)
if (typeof window.showWeeklyMatchups !== 'function') {
  console.error("ERROR: showWeeklyMatchups is not defined!");
}
if (typeof window.showPlayerComparisons !== 'function') {
  console.error("ERROR: showPlayerComparisons is not defined!");
}
if (typeof window.showTotalYearStats !== 'function') {
  console.error("ERROR: showTotalYearStats is not defined!");
}
if (typeof window.showTeamPages !== 'function') {
  console.error("ERROR: showTeamPages is not defined!");
}
console.log("app.js loaded - all functions should be available");

// ---------- utils ----------
function number(x){
  const n = Number(x);
  if (Number.isFinite(n)) return n.toFixed(2);
  return "0.00";
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}
