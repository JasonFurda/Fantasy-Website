/* app.js (JSON-on-demand renderer)
   Works with your existing CSS and shared-page HTML.

   Expected files:
     data-2025.json
     data-2024.json
*/

let yearDataCache = {};
let currentYear = 2025;
let currentWeek = null;
let currentMatchupIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Default to 2025 if present, else first available
  loadYear(currentYear).catch(err => {
    console.error("Error loading year:", err);
    showError(`Failed to load data: ${err.message}. Make sure you're running from a web server (not file://).`);
  });
});

// ---------- Data loading ----------
async function loadYear(year) {
  currentYear = year;

  if (!yearDataCache[year]) {
    try {
      const resp = await fetch(`data-${year}.json`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: Could not load data-${year}.json. Make sure the file exists and you're running from a web server.`);
      }
      yearDataCache[year] = await resp.json();
    } catch (err) {
      if (err.message.includes('fetch')) {
        throw new Error(`Cannot load JSON file. This usually means you're opening the HTML file directly. Please use a local web server (e.g., 'python -m http.server' or 'npx serve').`);
      }
      throw err;
    }
  }

  const yd = yearDataCache[year];
  if (!yd || !yd.weeks) {
    throw new Error(`Invalid data format in data-${year}.json`);
  }

  const weekKeys = Object.keys(yd.weeks).map(Number).filter(w => !isNaN(w));
  if (weekKeys.length === 0) {
    throw new Error(`No weeks found in data-${year}.json`);
  }

  currentWeek = yd.current_week || Math.max(...weekKeys);

  renderYearButtons(year);
  renderWeekNav(yd);
  showWeek(currentWeek, year);
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
  // hide shared pages when switching year
  hideSharedPages();
  loadYear(year).catch(err => console.error(err));
};

window.showWeek = function(week, year){
  hideSharedPages();

  const yd = yearDataCache[year];
  if (!yd) {
    console.error(`No data cached for year ${year}`);
    return;
  }

  currentWeek = week;
  currentMatchupIndex = 0;

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

// ---------- Shared pages visibility (RB/WR/Stats/Teams) ----------
function hideSharedPages(){
  // These ids match what your python generator emits
  const idsToHide = [
    "rb-comparison-content",
    "wr-comparison-content",
    "total-year-stats-content",
    "team-pages-content",
    "defense-rankings-content"
  ];
  idsToHide.forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
}

window.showRBComparison = function(){
  hideMatchups();
  showOnly("rb-comparison-content");
};

window.showWRComparison = function(){
  hideMatchups();
  showOnly("wr-comparison-content");
};

window.showTotalYearStats = function(){
  hideMatchups();
  showOnly("total-year-stats-content");
};

window.showTeamPages = function(){
  hideMatchups();
  showOnly("team-pages-content");
};

window.showDefenseRankings = function(){
  hideMatchups();
  showOnly("defense-rankings-content");
};

function hideMatchups(){
  // clear matchup UI but keep week nav visible
  const matchupNav = document.getElementById("matchup-nav");
  const content = document.getElementById("content");
  if (matchupNav) matchupNav.innerHTML = "";
  if (content) content.innerHTML = "";
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
