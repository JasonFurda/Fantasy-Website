"""
generate_matchups_html.py (JSON-on-demand version)

What this does:
- Fetches matchups for years in YEARS.
- Writes data-YYYY.json for each year (weeks, matchups, lineups).
- Writes a small index.html shell that loads app.js to render on demand.

To keep your RB/WR/Fraud/Team Pages:
- Paste your existing collect_running_backs, collect_wide_receivers,
  generate_shared_content_html, and any helpers below the marked block.
  (No changes needed to those functions.)
"""

from espn_api.football import League
import json
import os
import math

# ---------- League configuration ----------
LEAGUE_ID = 953181335
YEARS = [2025, 2024]  # order matters: first year becomes default view
YEAR_DEFAULT = YEARS[0]

# IMPORTANT: move these to env vars if you share the repo
ESPN_S2 = 'AEAXwngCrt5PQ2zc%2F2Si2z%2B8Syo4oDo1hs6gSsDACboeC7WNVJT5EWC1Hiu6gueWZgnEDv3IL%2FdPldXwm7f4PvTW4p7WEe8w20SfVmN3utCymMrKJExo5PSQtO62xFh2kIh9cPE0ZCQZxrPX%2F7kjSmfT5Mo2qlDq3dEBbMHJIIG3nJ03FDHzz8xalcpdf1M9ZcEFsOrDGKSJX%2BxlL18puksn9M2ACEzL0El8oFJcGA3mYGsIgreBQGwKa1ZKcsnJZegXIDhasPTrGqXk%2Fv81oGUdAYQzVmKwJfxadoywCRETwg7wnQpu8UpRcwVj9nCsDYHjeU%2BysosGhneVWtLFGKzf'
SWID = '{EC9E2E2E-468A-4AD9-B5CD-19E1D66BBF09}'

# ---------- Helpers ----------
def get_owner_name(team):
    if getattr(team, "owners", None):
        o = team.owners[0]
        return o.get("displayName", o.get("firstName", "Unknown"))
    return "Unknown"

def sort_lineup_by_position(lineup):
    """Sorts lineup into a stable, readable order."""
    order = ["QB","RB","WR","TE","FLEX","OP","RB/WR","RB/WR/TE","DST","D/ST","K","BE","IR"]
    idx = {pos:i for i,pos in enumerate(order)}
    def key(p):
        pos = getattr(p, "slot_position", "") or getattr(p, "lineupSlot", "")
        return idx.get(pos, 999), pos
    return sorted(lineup, key=key)

def player_to_dict(p):
    return {
        "slot": getattr(p, "slot_position", "") or getattr(p, "lineupSlot", ""),
        "name": getattr(p, "name", "Unknown"),
        "proTeam": getattr(p, "proTeam", "") or "",
        "opp": "BYE" if getattr(p, "on_bye_week", False) else getattr(p, "pro_opponent", "") or "",
        "points": round(getattr(p, "points", 0.0) or 0.0, 2),
        "proj": round(getattr(p, "projected_points", 0.0) or 0.0, 2),
        "gamePlayed": getattr(p, "game_played", 0) or 0,
        "bye": bool(getattr(p, "on_bye_week", False)),
        "injuryStatus": getattr(p, "injuryStatus", "") or "",
        "injured": bool(getattr(p, "injured", False)),
        "bench": (getattr(p, "slot_position", "") in ["BE", "IR"])
    }

def build_year_json(league, all_weeks_data, year):
    out = {
        "year": year,
        "current_week": league.current_week,
        "weeks": {}
    }

    for week in sorted(all_weeks_data.keys()):
        matchups = []
        for m in all_weeks_data[week]:
            if not m or not hasattr(m, 'home_team') or not m.home_team:
                continue

            try:
                away_lineup_raw = getattr(m, 'away_lineup', []) or []
                home_lineup_raw = getattr(m, 'home_lineup', []) or []
                away_lineup = []
                home_lineup = []
                for p in sort_lineup_by_position(away_lineup_raw):
                    try:
                        away_lineup.append(player_to_dict(p))
                    except Exception as e:
                        print(f"  Warning: Error converting away player to dict: {e}")
                for p in sort_lineup_by_position(home_lineup_raw):
                    try:
                        home_lineup.append(player_to_dict(p))
                    except Exception as e:
                        print(f"  Warning: Error converting home player to dict: {e}")
            except Exception as e:
                print(f"  Warning: Error processing lineup for week {week}: {e}")
                away_lineup = []
                home_lineup = []

            try:
                matchups.append({
                    "away": {
                        "id": getattr(m.away_team, 'team_id', 0) if m.away_team else 0,
                        "name": getattr(m.away_team, 'team_name', 'Unknown') if m.away_team else 'Unknown',
                        "owner": get_owner_name(m.away_team) if m.away_team else 'Unknown',
                        "score": round(getattr(m, 'away_score', 0.0) or 0.0, 2),
                        "projected": round(getattr(m, 'away_projected', 0.0) or 0.0, 2),
                        "lineup": away_lineup
                    },
                    "home": {
                        "id": getattr(m.home_team, 'team_id', 0) if m.home_team else 0,
                        "name": getattr(m.home_team, 'team_name', 'Unknown') if m.home_team else 'Unknown',
                        "owner": get_owner_name(m.home_team) if m.home_team else 'Unknown',
                        "score": round(getattr(m, 'home_score', 0.0) or 0.0, 2),
                        "projected": round(getattr(m, 'home_projected', 0.0) or 0.0, 2),
                        "lineup": home_lineup
                    }
                })
            except Exception as e:
                print(f"  Warning: Error processing matchup data for week {week}: {e}")
                continue

        out["weeks"][week] = matchups

    return out

def get_fantasy_art_images():
    """Get list of images from the fantasy-art folder"""
    fantasy_art_path = os.path.join(os.path.dirname(__file__), "fantasy-art")
    images = []
    
    if os.path.exists(fantasy_art_path):
        for filename in os.listdir(fantasy_art_path):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                images.append(f"fantasy-art/{filename}")
    
    return images

def generate_index_shell_html(shared_content_html, league_name="Fantasy League"):
    """
    Small HTML shell. app.js handles all week/matchup rendering now.
    We keep your class names/structure so existing CSS works.
    """
    # Get fantasy art images for the carousel
    fantasy_images = get_fantasy_art_images()
    
    # Generate image carousel HTML
    carousel_images_html = ""
    carousel_indicators_html = ""
    
    if fantasy_images:
        for idx, img_path in enumerate(fantasy_images):
            active_class = "active" if idx == 0 else ""
            # Add inline style to ensure non-active slides are hidden from the start
            style_attr = "" if idx == 0 else 'style="opacity: 0; visibility: hidden; z-index: 0;"'
            carousel_images_html += f"""
            <div class="carousel-slide {active_class}" {style_attr}>
                <img src="{img_path}" alt="Fantasy Art {idx + 1}" class="carousel-image">
            </div>
            """
            carousel_indicators_html += f"""
            <span class="carousel-indicator {active_class}" onclick="goToSlide({idx})"></span>
            """
    else:
        # Fallback if no images found
        carousel_images_html = """
            <div class="carousel-slide active">
                <div class="carousel-placeholder">No images found in fantasy-art folder</div>
            </div>
            """
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{league_name} - All Weeks Matchups</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{league_name}</h1>
      <p>All Weeks Matchups</p>
    </div>

    <!-- Main nav buttons -->
    <div class="main-navigation">
      <button class="rb-comparison-main-btn" onclick="showWeeklyMatchups()" id="weekly-matchups-btn"
        style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
        <span class="btn-icon">📅</span>
        <span class="btn-text">Weekly Matchups</span>
      </button>
      <button class="rb-comparison-main-btn" onclick="showPlayerComparisons()" id="player-comparisons-btn"
        style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <span class="btn-icon">📊</span>
        <span class="btn-text">Player Comparisons</span>
      </button>
      <button class="rb-comparison-main-btn" onclick="showTotalYearStats()" id="year-stats-btn"
        style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
        <span class="btn-icon">📈</span>
        <span class="btn-text">Total Year Stats</span>
      </button>
      <button class="rb-comparison-main-btn" onclick="showTeamPages()" id="team-pages-btn"
        style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
        <span class="btn-icon">👥</span>
        <span class="btn-text">Team Pages</span>
      </button>
    </div>

    <!-- Home Page with Image Carousel -->
    <div id="home-page-content" class="home-page-content">
      <div class="image-carousel-container">
        <div class="image-carousel">
          {carousel_images_html}
        </div>
        <div class="carousel-indicators">
          {carousel_indicators_html}
        </div>
      </div>
    </div>

    <!-- Shared pages are still injected here -->
    {shared_content_html}
  </div>

  <script src="app.js"></script>
</body>
</html>
"""

# -------------------------------------------------------------------
# OPTIONAL: paste your existing RB/WR/Fraud/Team functions here
# (collect_running_backs, collect_wide_receivers, generate_shared_content_html,
#  generate_rb_comparison_html, generate_wr_comparison_html,
#  generate_fraud_watch_html, generate_team_pages_html, etc.)
#
# Nothing in those needs to change for JSON rendering to work.
# -------------------------------------------------------------------

def get_team_name_for_player(player, league):
    """Get the fantasy team name that owns this player"""
    if player.onTeamId == 0:
        return "Free Agent"
    for team in league.teams:
        if team.team_id == player.onTeamId:
            return team.team_name
    return "Unknown"

def collect_running_backs(league):
    """Collect all running backs from all teams and free agents"""
    rbs = []
    
    # Get RBs from all teams
    for team in league.teams:
        for player in team.roster:
            if hasattr(player, 'position') and player.position == 'RB':
                rb_data = {
                    'name': player.name,
                    'team': get_team_name_for_player(player, league),
                    'proTeam': player.proTeam,
                    'total_points': player.total_points,
                    'avg_points': player.avg_points,
                    'rushing_attempts': 0,
                    'rushing_yards': 0,
                    'rushing_tds': 0,
                    'receptions': 0,
                    'receiving_yards': 0,
                    'receiving_tds': 0,
                    'fumbles_lost': 0,
                    'games_played': 0,
                    'injury_status': getattr(player, 'injuryStatus', ''),
                    'injured': getattr(player, 'injured', False)
                }
                
                # Try to get season totals from week 0 first
                season_stats = {}
                season_breakdown = {}
                if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                    season_stats = player.stats.get(0, {})
                    season_breakdown = season_stats.get('breakdown', {}) if isinstance(season_stats, dict) else {}
                
                if season_breakdown and isinstance(season_breakdown, dict):
                    # Use season totals if available
                    rb_data['rushing_attempts'] = season_breakdown.get('rushingAttempts', 0)
                    rb_data['rushing_yards'] = season_breakdown.get('rushingYards', 0)
                    rb_data['rushing_tds'] = season_breakdown.get('rushingTouchdowns', 0)
                    rb_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                    rb_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                    rb_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                    rb_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                    
                    # Count games played by counting weeks with stats
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        for week in range(1, league.current_week + 1):
                            week_stats = player.stats.get(week, {})
                            if week_stats and isinstance(week_stats, dict) and week_stats.get('breakdown'):
                                rb_data['games_played'] += 1
                else:
                    # Fallback: Aggregate stats across all weeks
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        for week in range(1, league.current_week + 1):
                            week_stats = player.stats.get(week, {})
                            if week_stats and isinstance(week_stats, dict):
                                breakdown = week_stats.get('breakdown', {})
                                if breakdown and isinstance(breakdown, dict):  # Player played this week
                                    rb_data['games_played'] += 1
                                    rb_data['rushing_attempts'] += breakdown.get('rushingAttempts', 0)
                                    rb_data['rushing_yards'] += breakdown.get('rushingYards', 0)
                                    rb_data['rushing_tds'] += breakdown.get('rushingTouchdowns', 0)
                                    rb_data['receptions'] += breakdown.get('receivingReceptions', 0)
                                    rb_data['receiving_yards'] += breakdown.get('receivingYards', 0)
                                    rb_data['receiving_tds'] += breakdown.get('receivingTouchdowns', 0)
                                    rb_data['fumbles_lost'] += breakdown.get('lostFumbles', 0)
                
                rbs.append(rb_data)
    
    # Get free agent RBs
    try:
        free_agent_rbs = league.free_agents(week=league.current_week, position='RB', size=100)
        for player in free_agent_rbs:
            if hasattr(player, 'position') and player.position == 'RB':
                # Check if we already have this player (avoid duplicates)
                if not any(rb['name'] == player.name for rb in rbs):
                    rb_data = {
                        'name': player.name,
                        'team': 'Free Agent',
                        'proTeam': player.proTeam,
                        'total_points': getattr(player, 'total_points', 0),
                        'avg_points': getattr(player, 'avg_points', 0),
                        'rushing_attempts': 0,
                        'rushing_yards': 0,
                        'rushing_tds': 0,
                        'receptions': 0,
                        'receiving_yards': 0,
                        'receiving_tds': 0,
                        'fumbles_lost': 0,
                        'games_played': 0,
                        'injury_status': getattr(player, 'injuryStatus', ''),
                        'injured': getattr(player, 'injured', False)
                    }
                    
                    # For free agents, try to get season totals from week 0 first
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        season_stats = player.stats.get(0, {})
                        season_breakdown = season_stats.get('breakdown', {}) if isinstance(season_stats, dict) else {}
                        
                        if season_breakdown and isinstance(season_breakdown, dict):
                            # Use season totals if available
                            rb_data['rushing_attempts'] = season_breakdown.get('rushingAttempts', 0)
                            rb_data['rushing_yards'] = season_breakdown.get('rushingYards', 0)
                            rb_data['rushing_tds'] = season_breakdown.get('rushingTouchdowns', 0)
                            rb_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                            rb_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                            rb_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                            rb_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                            
                            # Count games played
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats and isinstance(week_stats, dict) and week_stats.get('breakdown'):
                                    rb_data['games_played'] += 1
                        else:
                            # Fallback: Aggregate stats across all weeks
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats and isinstance(week_stats, dict):
                                    breakdown = week_stats.get('breakdown', {})
                                    if breakdown and isinstance(breakdown, dict):
                                        rb_data['games_played'] += 1
                                        rb_data['rushing_attempts'] += breakdown.get('rushingAttempts', 0)
                                        rb_data['rushing_yards'] += breakdown.get('rushingYards', 0)
                                        rb_data['rushing_tds'] += breakdown.get('rushingTouchdowns', 0)
                                        rb_data['receptions'] += breakdown.get('receivingReceptions', 0)
                                        rb_data['receiving_yards'] += breakdown.get('receivingYards', 0)
                                        rb_data['receiving_tds'] += breakdown.get('receivingTouchdowns', 0)
                                        rb_data['fumbles_lost'] += breakdown.get('lostFumbles', 0)
                    
                    rbs.append(rb_data)
    except Exception as e:
        print(f"  Note: Could not fetch free agent RBs: {e}")
    
    # Sort by total points descending
    rbs.sort(key=lambda x: x['total_points'], reverse=True)
    
    return rbs

def collect_draft_pick_values(league):
    """Collect draft pick values - compares draft position to points scored"""
    draft_values = []
    
    # Get draft picks
    if not hasattr(league, 'draft') or not league.draft:
        return draft_values
    
    # Create a mapping of player names to their total points
    player_points = {}
    
    # Get points from all teams' rosters
    for team in league.teams:
        if hasattr(team, 'roster') and team.roster:
            for player in team.roster:
                player_name = getattr(player, 'name', '')
                if player_name:
                    total_points = getattr(player, 'total_points', 0.0) or 0.0
                    # Use the higher value if player appears multiple times (shouldn't happen, but just in case)
                    if player_name not in player_points or total_points > player_points[player_name]:
                        player_points[player_name] = total_points
    
    # Process each draft pick
    total_draft_picks = len(league.draft)
    num_teams = len(league.teams) if hasattr(league, 'teams') else 12
    
    for idx, pick in enumerate(league.draft):
        # Get pick information
        player_name = getattr(pick, 'playerName', '') or getattr(pick, 'player_name', '')
        round_num = getattr(pick, 'round_num', 0) or 0
        round_pick = getattr(pick, 'round_pick', 0) or 0
        
        # Use the index in the draft list + 1 as the overall draft position
        # This is the most accurate since the draft list is in order
        draft_position = idx + 1
        
        # Get player's total points and position
        total_points = player_points.get(player_name, 0.0)
        
        # Get player position - only include TE, RB, WR
        position = None
        for team in league.teams:
            if hasattr(team, 'roster') and team.roster:
                for player in team.roster:
                    if getattr(player, 'name', '') == player_name:
                        position = getattr(player, 'position', '')
                        break
                if position:
                    break
        
        # Only include players who scored points and are TE, RB, or WR
        if total_points > 0 and player_name and position in ['TE', 'RB', 'WR']:
            # Calculate value: Make high points matter more than late draft pick
            # Formula: value = total_points^2 × sqrt(draft_position)
            # This squares points (making high scorers much more valuable) 
            # while reducing the impact of very late picks
            value = (total_points ** 2) * math.sqrt(draft_position)
            
            # Get team info
            team = getattr(pick, 'team', None)
            team_name = getattr(team, 'team_name', 'Unknown') if team else 'Unknown'
            
            draft_values.append({
                'player_name': player_name,
                'position': position,
                'draft_position': draft_position,
                'round_num': round_num,
                'round_pick': round_pick,
                'total_points': round(total_points, 2),
                'value': round(value, 2),
                'team_name': team_name
            })
    
    # Sort by value descending (higher value = better)
    draft_values.sort(key=lambda x: x['value'], reverse=True)
    
    return draft_values

def collect_wide_receivers(league):
    """Collect all wide receivers from all teams and free agents"""
    wrs = []
    
    # Get WRs from all teams
    for team in league.teams:
        for player in team.roster:
            if hasattr(player, 'position') and player.position == 'WR':
                wr_data = {
                    'name': player.name,
                    'team': get_team_name_for_player(player, league),
                    'proTeam': player.proTeam,
                    'total_points': player.total_points,
                    'avg_points': player.avg_points,
                    'targets': 0,
                    'receptions': 0,
                    'receiving_yards': 0,
                    'receiving_tds': 0,
                    'fumbles_lost': 0,
                    'games_played': 0,
                    'injury_status': getattr(player, 'injuryStatus', ''),
                    'injured': getattr(player, 'injured', False)
                }
                
                # Try to get season totals from week 0 first
                season_stats = {}
                season_breakdown = {}
                if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                    season_stats = player.stats.get(0, {})
                    season_breakdown = season_stats.get('breakdown', {}) if isinstance(season_stats, dict) else {}
                
                if season_breakdown and isinstance(season_breakdown, dict):
                    # Use season totals if available
                    wr_data['targets'] = season_breakdown.get('receivingTargets', 0)
                    wr_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                    wr_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                    wr_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                    wr_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                    
                    # Count games played by counting weeks with stats
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        for week in range(1, league.current_week + 1):
                            week_stats = player.stats.get(week, {})
                            if week_stats and isinstance(week_stats, dict) and week_stats.get('breakdown'):
                                wr_data['games_played'] += 1
                else:
                    # Fallback: Aggregate stats across all weeks
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        for week in range(1, league.current_week + 1):
                            week_stats = player.stats.get(week, {})
                            if week_stats and isinstance(week_stats, dict):
                                breakdown = week_stats.get('breakdown', {})
                                if breakdown and isinstance(breakdown, dict):  # Player played this week
                                    wr_data['games_played'] += 1
                                    wr_data['targets'] += breakdown.get('receivingTargets', 0)
                                    wr_data['receptions'] += breakdown.get('receivingReceptions', 0)
                                    wr_data['receiving_yards'] += breakdown.get('receivingYards', 0)
                                    wr_data['receiving_tds'] += breakdown.get('receivingTouchdowns', 0)
                                    wr_data['fumbles_lost'] += breakdown.get('lostFumbles', 0)
                
                wrs.append(wr_data)
    
    # Get free agent WRs
    try:
        free_agent_wrs = league.free_agents(week=league.current_week, position='WR', size=100)
        for player in free_agent_wrs:
            if hasattr(player, 'position') and player.position == 'WR':
                # Check if we already have this player (avoid duplicates)
                if not any(wr['name'] == player.name for wr in wrs):
                    wr_data = {
                        'name': player.name,
                        'team': 'Free Agent',
                        'proTeam': player.proTeam,
                        'total_points': getattr(player, 'total_points', 0),
                        'avg_points': getattr(player, 'avg_points', 0),
                        'targets': 0,
                        'receptions': 0,
                        'receiving_yards': 0,
                        'receiving_tds': 0,
                        'fumbles_lost': 0,
                        'games_played': 0,
                        'injury_status': getattr(player, 'injuryStatus', ''),
                        'injured': getattr(player, 'injured', False)
                    }
                    
                    # For free agents, try to get season totals from week 0 first
                    if hasattr(player, 'stats') and player.stats and isinstance(player.stats, dict):
                        season_stats = player.stats.get(0, {})
                        season_breakdown = season_stats.get('breakdown', {}) if isinstance(season_stats, dict) else {}
                        
                        if season_breakdown and isinstance(season_breakdown, dict):
                            # Use season totals if available
                            wr_data['targets'] = season_breakdown.get('receivingTargets', 0)
                            wr_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                            wr_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                            wr_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                            wr_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                            
                            # Count games played
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats and isinstance(week_stats, dict) and week_stats.get('breakdown'):
                                    wr_data['games_played'] += 1
                        else:
                            # Fallback: Aggregate stats across all weeks
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats and isinstance(week_stats, dict):
                                    breakdown = week_stats.get('breakdown', {})
                                    if breakdown and isinstance(breakdown, dict):
                                        wr_data['games_played'] += 1
                                        wr_data['targets'] += breakdown.get('receivingTargets', 0)
                                        wr_data['receptions'] += breakdown.get('receivingReceptions', 0)
                                        wr_data['receiving_yards'] += breakdown.get('receivingYards', 0)
                                        wr_data['receiving_tds'] += breakdown.get('receivingTouchdowns', 0)
                                        wr_data['fumbles_lost'] += breakdown.get('lostFumbles', 0)
                    
                    wrs.append(wr_data)
    except Exception as e:
        print(f"  Note: Could not fetch free agent WRs: {e}")
    
    # Sort by total points descending
    wrs.sort(key=lambda x: x['total_points'], reverse=True)
    
    return wrs

def group_rbs_by_nfl_team(rbs):
    """Group running backs by their NFL team"""
    teams = {}
    for rb in rbs:
        team = rb['proTeam']
        if team not in teams:
            teams[team] = []
        teams[team].append(rb)
    return teams

def calculate_vulture_percentage(team_rbs):
    """Calculate vulture percentage for RBs on a team"""
    # Calculate totals for the team
    total_touches = sum(rb['rushing_attempts'] + rb['receptions'] for rb in team_rbs)
    total_points = sum(rb['total_points'] for rb in team_rbs)
    
    if total_touches == 0 or total_points == 0:
        return []
    
    results = []
    for rb in team_rbs:
        touches = rb['rushing_attempts'] + rb['receptions']
        touch_pct = (touches / total_touches * 100) if total_touches > 0 else 0
        points_pct = (rb['total_points'] / total_points * 100) if total_points > 0 else 0
        vulture_pct = touch_pct - points_pct  # Positive = getting touches but not scoring, Negative = scoring more than touches suggest
        
        results.append({
            'rb': rb,
            'touch_pct': touch_pct,
            'points_pct': points_pct,
            'vulture_pct': vulture_pct,
            'touches': touches,
            'points': rb['total_points']
        })
    
    return results

def group_wrs_by_nfl_team(wrs):
    """Group wide receivers by their NFL team"""
    teams = {}
    for wr in wrs:
        team = wr['proTeam']
        if team not in teams:
            teams[team] = []
        teams[team].append(wr)
    return teams

def calculate_wr_targets_percentage(team_wrs):
    """Calculate target percentage and points percentage for WRs on a team"""
    # Calculate totals for the team
    total_targets = sum(wr['targets'] for wr in team_wrs)
    total_points = sum(wr['total_points'] for wr in team_wrs)
    
    if total_targets == 0 or total_points == 0:
        return []
    
    results = []
    for wr in team_wrs:
        targets = wr['targets']
        targets_pct = (targets / total_targets * 100) if total_targets > 0 else 0
        points_pct = (wr['total_points'] / total_points * 100) if total_points > 0 else 0
        
        results.append({
            'wr': wr,
            'targets': targets,
            'targets_pct': targets_pct,
            'points': wr['total_points'],
            'points_pct': points_pct
        })
    
    return results

def get_ordinal_suffix(n):
    """Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)"""
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"

def get_team_year_stats(league, all_weeks_data=None):
    """Get team statistics for a specific year including record, playoff placement, and top 3 players"""
    teams_data = []
    
    for team in league.teams:
        # Get team record
        wins = team.wins
        losses = team.losses
        ties = team.ties if hasattr(team, 'ties') else 0
        record = f"{wins}-{losses}" + (f"-{ties}" if ties > 0 else "")
        
        # Get playoff placement
        playoff_placement = "Unknown"
        standing = None
        
        if hasattr(team, 'final_standing') and team.final_standing:
            # If final_standing exists, the season is complete - show exact placement
            if team.final_standing == 1:
                playoff_placement = "Champion"
            elif team.final_standing == 2:
                playoff_placement = "Runner-up"
            elif team.final_standing > 0:
                # Show exact placement using ordinal suffix
                playoff_placement = f"{get_ordinal_suffix(team.final_standing)} Place"
        elif hasattr(team, 'standing_seed') and team.standing_seed:
            playoff_placement = f"#{team.standing_seed} Seed"
        elif hasattr(team, 'standing') and team.standing:
            standing = team.standing
            playoff_teams = getattr(league.settings, 'playoff_teams', 6)
            if standing <= playoff_teams:
                playoff_placement = f"#{standing} Seed"
            else:
                playoff_placement = "Did not make playoffs"
        
        # Get top 3 players by points earned while on this team
        roster_players = []
        if hasattr(team, 'roster') and team.roster:
            for player in team.roster:
                # Calculate points earned while on this team
                points_on_team = 0.0
                games_on_team = 0
                
                if all_weeks_data:
                    # Look through all weeks to find when this player was on this team
                    for week in sorted(all_weeks_data.keys()):
                        player_found_this_week = False
                        
                        for matchup in all_weeks_data[week]:
                            if not matchup or not hasattr(matchup, 'home_team') or not matchup.home_team:
                                continue
                            
                            # Check away team lineup
                            if matchup.away_team and matchup.away_team.team_id == team.team_id:
                                away_lineup = getattr(matchup, 'away_lineup', []) or []
                                for p in away_lineup:
                                    if hasattr(p, 'name') and p.name == player.name:
                                        # Check if player is in starting lineup (not bench)
                                        slot = getattr(p, 'slot_position', '') or getattr(p, 'lineupSlot', '')
                                        if slot in ['BE', 'IR']:
                                            # Skip bench players
                                            player_found_this_week = True
                                            break
                                        
                                        points = getattr(p, 'points', 0.0) or 0.0
                                        points_on_team += points
                                        if points > 0:
                                            games_on_team += 1
                                        player_found_this_week = True
                                        break
                                if player_found_this_week:
                                    break
                            
                            # Check home team lineup
                            if not player_found_this_week and matchup.home_team and matchup.home_team.team_id == team.team_id:
                                home_lineup = getattr(matchup, 'home_lineup', []) or []
                                for p in home_lineup:
                                    if hasattr(p, 'name') and p.name == player.name:
                                        # Check if player is in starting lineup (not bench)
                                        slot = getattr(p, 'slot_position', '') or getattr(p, 'lineupSlot', '')
                                        if slot in ['BE', 'IR']:
                                            # Skip bench players
                                            player_found_this_week = True
                                            break
                                        
                                        points = getattr(p, 'points', 0.0) or 0.0
                                        points_on_team += points
                                        if points > 0:
                                            games_on_team += 1
                                        player_found_this_week = True
                                        break
                                if player_found_this_week:
                                    break
                else:
                    # Fallback: use total_points if no matchup data available
                    points_on_team = getattr(player, 'total_points', 0.0) or 0.0
                    games_on_team = getattr(player, 'games_played', 0) or 0
                
                if points_on_team > 0:
                    avg_points = points_on_team / games_on_team if games_on_team > 0 else 0
                    roster_players.append({
                        'name': player.name,
                        'position': getattr(player, 'position', 'N/A'),
                        'total_points': round(points_on_team, 2),
                        'avg_points': round(avg_points, 2),
                        'proTeam': getattr(player, 'proTeam', 'N/A')
                    })
        
        # Sort by total points and get top 3
        roster_players.sort(key=lambda x: x['total_points'], reverse=True)
        top_3_players = roster_players[:3]
        
        # Get owner name
        owner = get_owner_name(team)
        
        teams_data.append({
            'team_id': team.team_id,
            'team_name': team.team_name,
            'owner': owner,
            'wins': wins,
            'losses': losses,
            'ties': ties,
            'record': record,
            'playoff_placement': playoff_placement,
            'points_for': team.points_for if hasattr(team, 'points_for') else 0,
            'points_against': team.points_against if hasattr(team, 'points_against') else 0,
            'top_3_players': top_3_players,
            'standing': standing
        })
    
    # Sort teams by wins (descending), then by points for (descending)
    teams_data.sort(key=lambda x: (x['wins'], x['points_for']), reverse=True)
    
    return teams_data

def calculate_fraud_watch(league):
    """Calculate fraud watch rankings for teams"""
    teams_data = []
    
    # Calculate league averages for normalization
    total_points_for = sum(team.points_for for team in league.teams)
    total_points_against = sum(team.points_against for team in league.teams)
    avg_points_for = total_points_for / len(league.teams) if len(league.teams) > 0 else 0
    avg_points_against = total_points_against / len(league.teams) if len(league.teams) > 0 else 0
    
    # Get min/max for percentile calculation
    points_for_list = [team.points_for for team in league.teams]
    points_against_list = [team.points_against for team in league.teams]
    min_points_for = min(points_for_list) if points_for_list else 0
    max_points_for = max(points_for_list) if points_for_list else 0
    min_points_against = min(points_against_list) if points_against_list else 0
    max_points_against = max(points_against_list) if points_against_list else 0
    
    for team in league.teams:
        total_games = team.wins + team.losses + team.ties
        win_pct = (team.wins / total_games * 100) if total_games > 0 else 0
        
        # Calculate percentile ranks (lower is better for frauds - means low points for/against)
        # Points For: lower is worse (frauds score less)
        if max_points_for > min_points_for:
            pf_percentile = ((team.points_for - min_points_for) / (max_points_for - min_points_for)) * 100
        else:
            pf_percentile = 50
        
        # Points Against: lower is better (frauds have easier schedules)
        if max_points_against > min_points_against:
            pa_percentile = ((team.points_against - min_points_against) / (max_points_against - min_points_against)) * 100
        else:
            pa_percentile = 50
        
        # Fraud score: High win % but low points for and low points against = fraud
        # Formula: Win % - (normalized PF with higher weight) - (normalized PA)
        # Higher score = more fraudulent
        # Higher weight on PF means teams with high points for get lower fraud scores
        fraud_score = win_pct - (pf_percentile * 0.75) - (pa_percentile * 0.5)
        
        teams_data.append({
            'team': team,
            'win_pct': win_pct,
            'pf_percentile': pf_percentile,
            'pa_percentile': pa_percentile,
            'fraud_score': fraud_score,
            'owner': get_owner_name(team)
        })
    
    # Sort by fraud score descending (highest fraud score = most fraudulent)
    teams_data.sort(key=lambda x: x['fraud_score'], reverse=True)
    
    return teams_data

def is_week_concluded(league, week, box_scores):
    """Check if a week has concluded by verifying all players' games are complete"""
    if week < league.current_week:
        return True  # Past weeks are always concluded
    
    if week > league.current_week:
        return False  # Future weeks haven't started
    
    # For current week, check if all players have completed their games
    # Look for any players whose games are still in progress
    for matchup in box_scores:
        if not matchup.home_team:
            continue
        
        # Check away team lineup
        away_lineup = getattr(matchup, 'away_lineup', []) or []
        for player in away_lineup:
            # game_played represents percentage of game completed (0-100)
            # If it's less than 100, the game is still in progress
            game_played = getattr(player, 'game_played', 100)
            on_bye = getattr(player, 'on_bye_week', False)
            
            # Skip bye week players, but check others
            if not on_bye:
                # If game_played is None or 0, might be game hasn't started
                # If game_played is between 1-99, game is in progress
                if game_played is None or (game_played is not None and game_played < 100):
                    return False  # At least one player's game is still in progress or hasn't started
        
        # Check home team lineup
        home_lineup = getattr(matchup, 'home_lineup', []) or []
        for player in home_lineup:
            game_played = getattr(player, 'game_played', 100)
            on_bye = getattr(player, 'on_bye_week', False)
            
            if not on_bye:
                if game_played is None or (game_played is not None and game_played < 100):
                    return False  # At least one player's game is still in progress or hasn't started
    
    return True  # All games appear to be complete

def find_club_performances(league, all_weeks_data):
    """Find teams that scored 200+ or sub-100 in any week"""
    club_200 = []  # Teams that scored 200+
    club_sub100 = []  # Teams that scored < 100
    
    for week, box_scores in all_weeks_data.items():
        # For sub-100 club, skip current week if it hasn't concluded
        # Always skip current week for sub-100 club to avoid showing incomplete scores
        skip_sub100_this_week = (week == league.current_week)
        
        for matchup in box_scores:
            if not matchup.home_team:
                continue
            
            # Check away team
            if matchup.away_score >= 200:
                club_200.append({
                    'team': matchup.away_team,
                    'score': matchup.away_score,
                    'week': week,
                    'opponent': matchup.home_team,
                    'opponent_score': matchup.home_score,
                    'won': matchup.away_score > matchup.home_score
                })
            elif matchup.away_score < 100 and not skip_sub100_this_week:
                club_sub100.append({
                    'team': matchup.away_team,
                    'score': matchup.away_score,
                    'week': week,
                    'opponent': matchup.home_team,
                    'opponent_score': matchup.home_score,
                    'won': matchup.away_score > matchup.home_score
                })
            
            # Check home team
            if matchup.home_score >= 200:
                club_200.append({
                    'team': matchup.home_team,
                    'score': matchup.home_score,
                    'week': week,
                    'opponent': matchup.away_team,
                    'opponent_score': matchup.away_score,
                    'won': matchup.home_score > matchup.away_score
                })
            elif matchup.home_score < 100 and not skip_sub100_this_week:
                club_sub100.append({
                    'team': matchup.home_team,
                    'score': matchup.home_score,
                    'week': week,
                    'opponent': matchup.away_team,
                    'opponent_score': matchup.away_score,
                    'won': matchup.home_score > matchup.away_score
                })
    
    # Sort by score (descending for 200 club, ascending for sub-100 club)
    club_200.sort(key=lambda x: x['score'], reverse=True)
    club_sub100.sort(key=lambda x: x['score'], reverse=False)
    
    return club_200, club_sub100

def generate_rb_comparison_html(rbs):
    """Generate HTML for running back comparison table"""
    
    if not rbs:
        return "<div class='rb-content'><p>No running backs found.</p></div>"
    
    # Group RBs by NFL team for vulture percentage
    teams_dict = group_rbs_by_nfl_team(rbs)
    
    # Generate table rows
    rows_html = ""
    for idx, rb in enumerate(rbs):
        injury_class = "rb-injured" if rb['injured'] else ""
        fa_class = "rb-fa" if rb['team'] == 'Free Agent' else ""
        
        ypc = rb['rushing_yards'] / rb['rushing_attempts'] if rb['rushing_attempts'] > 0 else 0
        ypr = rb['receiving_yards'] / rb['receptions'] if rb['receptions'] > 0 else 0
        total_tds = rb['rushing_tds'] + rb['receiving_tds']
        total_touches = rb['rushing_attempts'] + rb['receptions']
        
        # Make player name clickable
        rows_html += f"""
        <tr class="{injury_class} {fa_class}">
            <td>{idx + 1}</td>
            <td class="player-name clickable-rb" onclick="showVulturePercentage('{rb['proTeam']}')" title="Click to view vulture percentage for {rb['proTeam']} RBs">{rb['name']}</td>
            <td>{rb['team']}</td>
            <td>{rb['proTeam']}</td>
            <td class="points">{rb['total_points']:.2f}</td>
            <td>{rb['avg_points']:.2f}</td>
            <td>{rb['games_played']}</td>
            <td>{rb['rushing_attempts']}</td>
            <td>{rb['rushing_yards']}</td>
            <td>{ypc:.1f}</td>
            <td>{rb['rushing_tds']}</td>
            <td>{rb['receptions']}</td>
            <td>{rb['receiving_yards']}</td>
            <td>{ypr:.1f}</td>
            <td>{rb['receiving_tds']}</td>
            <td>{total_touches}</td>
            <td>{total_tds}</td>
            <td>{rb['fumbles_lost']}</td>
            <td class="injury-status">{rb['injury_status'] if rb['injury_status'] else '-'}</td>
        </tr>
        """
    
    # Generate vulture percentage modals for each NFL team
    vulture_modals_html = ""
    for team, team_rbs in teams_dict.items():
        if len(team_rbs) < 2:  # Need at least 2 RBs to compare
            continue
        
        vulture_data = calculate_vulture_percentage(team_rbs)
        vulture_data.sort(key=lambda x: x['touches'], reverse=True)
        
        vulture_rows = ""
        for data in vulture_data:
            rb = data['rb']
            vulture_class = "vulture-positive" if data['vulture_pct'] > 5 else "vulture-negative" if data['vulture_pct'] < -5 else ""
            
            vulture_rows += f"""
            <tr class="{vulture_class}">
                <td class="player-name">{rb['name']}</td>
                <td>{data['touches']}</td>
                <td>{data['touch_pct']:.1f}%</td>
                <td class="points">{data['points']:.2f}</td>
                <td>{data['points_pct']:.1f}%</td>
                <td class="vulture-pct {'vulture-high' if data['vulture_pct'] > 5 else 'vulture-low' if data['vulture_pct'] < -5 else ''}">{data['vulture_pct']:+.1f}%</td>
            </tr>
            """
        
        total_touches = sum(rb['rushing_attempts'] + rb['receptions'] for rb in team_rbs)
        total_points = sum(rb['total_points'] for rb in team_rbs)
        
        vulture_modals_html += f"""
        <div id="vulture-modal-{team}" class="vulture-modal">
            <div class="vulture-modal-content">
                <div class="vulture-modal-header">
                    <h2>{team} Running Backs - Vulture Percentage</h2>
                    <span class="vulture-close" onclick="closeVultureModal('{team}')">&times;</span>
                </div>
                <div class="vulture-info">
                    <p><strong>Total Team Touches:</strong> {total_touches} | <strong>Total Team Points:</strong> {total_points:.2f}</p>
                    <p class="vulture-explanation">Vulture % = Touch % - Points %. Positive means getting touches but not scoring proportionally. Negative means scoring more than touches suggest.</p>
                </div>
                <div class="vulture-table-wrapper">
                    <table class="vulture-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Total Touches</th>
                                <th>Touch %</th>
                                <th>Total Points</th>
                                <th>Points %</th>
                                <th>Vulture %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vulture_rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        """
    
    return f"""
            <div id="rb-comparison-content" class="rb-content stats-tab-content" style="display: none;">
        <div class="rb-header">
            <h2>Running Back Comparison</h2>
            <p>All running backs in the league, sorted by total fantasy points. Click a player name to view vulture percentage for their NFL team.</p>
        </div>
        <div class="rb-table-wrapper">
            <table class="rb-comparison-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Fantasy Team</th>
                        <th>NFL Team</th>
                        <th>Total Pts</th>
                        <th>Avg Pts</th>
                        <th>Games</th>
                        <th>Rush Att</th>
                        <th>Rush Yds</th>
                        <th>YPC</th>
                        <th>Rush TD</th>
                        <th>Rec</th>
                        <th>Rec Yds</th>
                        <th>YPR</th>
                        <th>Rec TD</th>
                        <th>Total Touches</th>
                        <th>Total TD</th>
                        <th>Fum Lost</th>
                        <th>Injury</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
        {vulture_modals_html}
    </div>
    """

def generate_wr_comparison_html(wrs):
    """Generate HTML for wide receiver comparison table"""
    
    if not wrs:
        return "<div class='rb-content'><p>No wide receivers found.</p></div>"
    
    # Group WRs by NFL team for target percentage
    teams_dict = group_wrs_by_nfl_team(wrs)
    
    # Generate table rows
    rows_html = ""
    for idx, wr in enumerate(wrs):
        injury_class = "rb-injured" if wr['injured'] else ""
        fa_class = "rb-fa" if wr['team'] == 'Free Agent' else ""
        
        ypr = wr['receiving_yards'] / wr['receptions'] if wr['receptions'] > 0 else 0
        catch_rate = (wr['receptions'] / wr['targets'] * 100) if wr['targets'] > 0 else 0
        
        # Make player name clickable
        rows_html += f"""
        <tr class="{injury_class} {fa_class}">
            <td>{idx + 1}</td>
            <td class="player-name clickable-wr" onclick="showWRTargetsPercentage('{wr['proTeam']}')" title="Click to view target percentage for {wr['proTeam']} WRs">{wr['name']}</td>
            <td>{wr['team']}</td>
            <td>{wr['proTeam']}</td>
            <td class="points">{wr['total_points']:.2f}</td>
            <td>{wr['avg_points']:.2f}</td>
            <td>{wr['games_played']}</td>
            <td>{wr['targets']}</td>
            <td>{wr['receptions']}</td>
            <td>{catch_rate:.1f}%</td>
            <td>{wr['receiving_yards']}</td>
            <td>{ypr:.1f}</td>
            <td>{wr['receiving_tds']}</td>
            <td>{wr['fumbles_lost']}</td>
            <td class="injury-status">{wr['injury_status'] if wr['injury_status'] else '-'}</td>
        </tr>
        """
    
    # Generate target percentage modals for each NFL team
    targets_modals_html = ""
    for team, team_wrs in teams_dict.items():
        if len(team_wrs) < 2:  # Need at least 2 WRs to compare
            continue
        
        targets_data = calculate_wr_targets_percentage(team_wrs)
        targets_data.sort(key=lambda x: x['targets'], reverse=True)
        
        targets_rows = ""
        for data in targets_data:
            wr = data['wr']
            
            targets_rows += f"""
            <tr>
                <td class="player-name">{wr['name']}</td>
                <td>{data['targets']}</td>
                <td>{data['targets_pct']:.1f}%</td>
                <td class="points">{data['points']:.2f}</td>
                <td>{data['points_pct']:.1f}%</td>
            </tr>
            """
        
        total_targets = sum(wr['targets'] for wr in team_wrs)
        total_points = sum(wr['total_points'] for wr in team_wrs)
        
        targets_modals_html += f"""
        <div id="wr-targets-modal-{team}" class="vulture-modal">
            <div class="vulture-modal-content">
                <div class="vulture-modal-header">
                    <h2>{team} Wide Receivers - Target & Points Distribution</h2>
                    <span class="vulture-close" onclick="closeWRTargetsModal('{team}')">&times;</span>
                </div>
                <div class="vulture-info">
                    <p><strong>Total Team Targets:</strong> {total_targets} | <strong>Total Team Points:</strong> {total_points:.2f}</p>
                    <p class="vulture-explanation">Shows the percentage of targets and points for each WR on the team.</p>
                </div>
                <div class="vulture-table-wrapper">
                    <table class="vulture-table">
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Total Targets</th>
                                <th>Target %</th>
                                <th>Total Points</th>
                                <th>Points %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {targets_rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        """
    
    return f"""
        <div id="wr-comparison-content" class="rb-content stats-tab-content" style="display: block;">
        <div class="rb-header">
            <h2>Wide Receiver Comparison</h2>
            <p>All wide receivers in the league, sorted by total fantasy points. Click a player name to view target and points percentage for their NFL team.</p>
        </div>
        <div class="rb-table-wrapper">
            <table class="rb-comparison-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Fantasy Team</th>
                        <th>NFL Team</th>
                        <th>Total Pts</th>
                        <th>Avg Pts</th>
                        <th>Games</th>
                        <th>Targets</th>
                        <th>Rec</th>
                        <th>Catch %</th>
                        <th>Rec Yds</th>
                        <th>YPR</th>
                        <th>Rec TD</th>
                        <th>Fum Lost</th>
                        <th>Injury</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
        {targets_modals_html}
    </div>
    """

def generate_mismanagement_rows(mismanagement_data):
    """Generate HTML rows for mismanagement leaderboard"""
    if not mismanagement_data:
        return '<tr><td colspan="9" style="text-align: center; padding: 20px;">No mismanagement data available</td></tr>'
    
    rows_html = ""
    for idx, data in enumerate(mismanagement_data):
        team = data['team']
        # Use percentage for classification - lower percentage = worse
        mismanagement_class = "fraud-high" if data['percentage_scored'] < 90 else "fraud-medium" if data['percentage_scored'] < 95 else "fraud-low"
        
        rows_html += f"""
        <tr class="{mismanagement_class}">
            <td>{idx + 1}</td>
            <td class="team-name">{team.team_name}</td>
            <td>{data['owner']}</td>
            <td class="fraud-score">{data['percentage_scored']:.2f}%</td>
            <td class="points">{data['total_optimal_points']:.2f}</td>
            <td class="points">{data['total_actual_points']:.2f}</td>
            <td>{data['total_mismanagement']:.2f}</td>
            <td>{data['avg_mismanagement']:.2f}</td>
            <td>{team.wins}-{team.losses}-{team.ties}</td>
        </tr>
        """
    
    return rows_html

def calculate_mismanagement_leaderboard(league, all_weeks_data):
    """Calculate mismanagement scores - difference between optimal and actual lineups"""
    team_mismanagement = {}
    
    # Initialize teams
    for team in league.teams:
        team_mismanagement[team.team_id] = {
            'team': team,
            'owner': get_owner_name(team),
            'total_mismanagement': 0.0,
            'total_optimal_points': 0.0,
            'total_actual_points': 0.0,
            'weeks': []
        }
    
    # Process each week
    for week in sorted(all_weeks_data.keys()):
        for matchup in all_weeks_data[week]:
            if not matchup or not hasattr(matchup, 'home_team') or not matchup.home_team:
                continue
            
            # Process away team
            if matchup.away_team:
                process_team_mismanagement(
                    matchup.away_team, 
                    getattr(matchup, 'away_lineup', []) or [],
                    week,
                    team_mismanagement
                )
            
            # Process home team
            if matchup.home_team:
                process_team_mismanagement(
                    matchup.home_team,
                    getattr(matchup, 'home_lineup', []) or [],
                    week,
                    team_mismanagement
                )
    
    # Convert to list and calculate percentage of optimal points scored
    mismanagement_list = []
    for team_id, data in team_mismanagement.items():
        # Calculate percentage: (actual / optimal) * 100
        # Lower percentage = worse mismanagement
        percentage_scored = (data['total_actual_points'] / data['total_optimal_points'] * 100) if data['total_optimal_points'] > 0 else 0
        
        mismanagement_list.append({
            'team': data['team'],
            'owner': data['owner'],
            'total_mismanagement': round(data['total_mismanagement'], 2),
            'total_optimal_points': round(data['total_optimal_points'], 2),
            'total_actual_points': round(data['total_actual_points'], 2),
            'avg_mismanagement': round(data['total_mismanagement'] / len(data['weeks']) if data['weeks'] else 0, 2),
            'percentage_scored': round(percentage_scored, 2),
            'weeks': data['weeks']
        })
    
    # Sort by percentage scored (ascending - lower percentage = worse mismanagement)
    mismanagement_list.sort(key=lambda x: x['percentage_scored'])
    return mismanagement_list

def process_team_mismanagement(team, lineup, week, team_mismanagement):
    """Calculate optimal vs actual lineup for a team in a given week"""
    if team.team_id not in team_mismanagement:
        return
    
    # Get all players (both starting and bench)
    all_players = []
    actual_starting_score = 0.0
    
    for player in lineup:
        slot = getattr(player, 'slot_position', '') or getattr(player, 'lineupSlot', '')
        points = getattr(player, 'points', 0.0) or 0.0
        position = getattr(player, 'position', '')
        
        # Store player info
        all_players.append({
            'name': getattr(player, 'name', 'Unknown'),
            'position': position,
            'slot': slot,
            'points': points
        })
        
        # Count actual starting lineup points (exclude bench)
        if slot not in ['BE', 'IR']:
            actual_starting_score += points
    
    # Calculate optimal lineup
    optimal_score = calculate_optimal_lineup_score(all_players)
    
    # Calculate mismanagement (difference)
    mismanagement = optimal_score - actual_starting_score
    
    # Store the data
    team_mismanagement[team.team_id]['total_mismanagement'] += mismanagement
    team_mismanagement[team.team_id]['total_optimal_points'] += optimal_score
    team_mismanagement[team.team_id]['total_actual_points'] += actual_starting_score
    team_mismanagement[team.team_id]['weeks'].append({
        'week': week,
        'optimal': round(optimal_score, 2),
        'actual': round(actual_starting_score, 2),
        'mismanagement': round(mismanagement, 2)
    })

def calculate_optimal_lineup_score(all_players):
    """Calculate the best possible lineup score from available players"""
    # Group players by position
    qbs = []
    rbs = []
    wrs = []
    tes = []
    dsts = []
    ks = []
    
    for p in all_players:
        pos = p['position']
        if pos == 'QB':
            qbs.append(p)
        elif pos == 'RB':
            rbs.append(p)
        elif pos == 'WR':
            wrs.append(p)
        elif pos == 'TE':
            tes.append(p)
        elif pos == 'DST' or pos == 'D/ST':
            dsts.append(p)
        elif pos == 'K':
            ks.append(p)
    
    # Sort by points descending
    qbs.sort(key=lambda x: x['points'], reverse=True)
    rbs.sort(key=lambda x: x['points'], reverse=True)
    wrs.sort(key=lambda x: x['points'], reverse=True)
    tes.sort(key=lambda x: x['points'], reverse=True)
    dsts.sort(key=lambda x: x['points'], reverse=True)
    ks.sort(key=lambda x: x['points'], reverse=True)
    
    # Build optimal lineup (standard: 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 D/ST, 1 K)
    optimal_score = 0.0
    
    # QB
    if qbs:
        optimal_score += qbs[0]['points']
    
    # RBs (2)
    for i in range(min(2, len(rbs))):
        optimal_score += rbs[i]['points']
    
    # WRs (2)
    for i in range(min(2, len(wrs))):
        optimal_score += wrs[i]['points']
    
    # TE
    if tes:
        optimal_score += tes[0]['points']
    
    # FLEX (best remaining RB/WR/TE)
    flex_candidates = []
    if len(rbs) > 2:
        flex_candidates.extend(rbs[2:])
    if len(wrs) > 2:
        flex_candidates.extend(wrs[2:])
    if len(tes) > 1:
        flex_candidates.extend(tes[1:])
    
    flex_candidates.sort(key=lambda x: x['points'], reverse=True)
    if flex_candidates:
        optimal_score += flex_candidates[0]['points']
    
    # D/ST
    if dsts:
        optimal_score += dsts[0]['points']
    
    # K
    if ks:
        optimal_score += ks[0]['points']
    
    return optimal_score

def collect_defense_rankings(league, all_weeks_data):
    """Collect defense rankings based on RB and WR points scored against them"""
    defense_stats = {}
    
    # Process each week
    for week in sorted(all_weeks_data.keys()):
        # Process players from matchups (lineups include starters and bench)
        for matchup in all_weeks_data[week]:
            if not matchup or not hasattr(matchup, 'home_team') or not matchup.home_team:
                continue
            
            # Get all players from both teams (lineup includes starters and bench)
            away_lineup = getattr(matchup, 'away_lineup', []) or []
            home_lineup = getattr(matchup, 'home_lineup', []) or []
            
            # Process all players from away team (including bench)
            for player in away_lineup:
                process_player_for_defense(player, defense_stats, week)
            
            # Process all players from home team (including bench)
            for player in home_lineup:
                process_player_for_defense(player, defense_stats, week)
        
        # Also process players from all team rosters to get complete data
        # This ensures we capture all RB/WR points, including players not in lineups
        # Note: We process roster players but the opponent info might not be available
        # The lineup players should have the most accurate opponent data
        try:
            for team in league.teams:
                if hasattr(team, 'roster') and team.roster:
                    for player in team.roster:
                        position = getattr(player, 'position', '')
                        if position not in ['RB', 'WR']:
                            continue
                        
                        # Check if player has stats for this week
                        if hasattr(player, 'stats') and player.stats:
                            if isinstance(player.stats, dict):
                                week_stats = player.stats.get(week, {})
                                if week_stats and isinstance(week_stats, dict):
                                    # Get points from week stats
                                    points = week_stats.get('points', 0.0) or 0.0
                                    if points > 0:  # Only process if player scored points
                                        # Try to get opponent - use pro_opponent if available, otherwise skip
                                        # (lineup players should have this, but roster players might not)
                                        opponent = getattr(player, 'pro_opponent', '') or ''
                                        
                                        if opponent and opponent != 'BYE' and opponent != 'None' and opponent != '':
                                            # Create a player-like object for processing
                                            class TempPlayer:
                                                def __init__(self, pos, pts, opp):
                                                    self.position = pos
                                                    self.points = pts
                                                    self.pro_opponent = opp
                                            
                                            temp_player = TempPlayer(position, points, opponent)
                                            process_player_for_defense(temp_player, defense_stats, week)
        except Exception as e:
            print(f"  Warning: Could not process all roster players for week {week}: {e}")
    
    # Convert to list and sort by total points against (ascending - lower is better)
    defense_list = []
    for defense, stats in defense_stats.items():
        # Filter out None, empty strings, and BYE
        if not defense or defense == 'None' or defense == '' or defense == 'BYE':
            continue
        if stats['total_points'] > 0:  # Only include defenses that have been played against
            defense_list.append({
                'defense': defense,
                'total_points': round(stats['total_points'], 2),
                'rb_points': round(stats['rb_points'], 2),
                'wr_points': round(stats['wr_points'], 2),
                'games': len(stats['games'])
            })
    
    # Sort by total points ascending (lower is better)
    defense_list.sort(key=lambda x: x['total_points'])
    
    return defense_list

def process_player_for_defense(player, defense_stats, week):
    """Process a player to track points scored against their opponent's defense"""
    position = getattr(player, 'position', '')
    points = getattr(player, 'points', 0.0) or 0.0
    
    # Only track RB and WR points
    if position not in ['RB', 'WR']:
        return
    
    # Get the opponent (the defense they played against)
    # Try multiple attributes in case the API uses different names
    opponent = getattr(player, 'pro_opponent', '') or getattr(player, 'opponent', '') or ''
    
    # Filter out invalid opponents
    if not opponent or opponent == 'BYE' or opponent == 'None' or opponent == '':
        return
    
    # Initialize defense if not exists
    if opponent not in defense_stats:
        defense_stats[opponent] = {
            'total_points': 0.0,
            'rb_points': 0.0,
            'wr_points': 0.0,
            'games': set()  # Track unique weeks to count games
        }
    
    # Add points (only count if player actually played and scored points)
    if points > 0:
        defense_stats[opponent]['total_points'] += points
        if position == 'RB':
            defense_stats[opponent]['rb_points'] += points
        elif position == 'WR':
            defense_stats[opponent]['wr_points'] += points
        
        # Track games (unique weeks) - only count weeks where points were scored
        defense_stats[opponent]['games'].add(week)

def generate_draft_pick_value_html(draft_values):
    """Generate HTML for draft pick value table"""
    
    if not draft_values:
        return "<div class='rb-content'><p>No draft pick value data found.</p></div>"
    
    # Generate table rows
    rows_html = ""
    for idx, player in enumerate(draft_values):
        # Calculate value per point (how much value per point scored)
        value_per_point = player['value'] / player['total_points'] if player['total_points'] > 0 else 0
        
        rows_html += f"""
        <tr>
            <td>{idx + 1}</td>
            <td class="player-name">{player['player_name']}</td>
            <td>{player['position']}</td>
            <td>{player['team_name']}</td>
            <td>{player['draft_position']}</td>
            <td>Round {player['round_num']}, Pick {player['round_pick']}</td>
            <td class="points">{player['total_points']:.2f}</td>
            <td class="points">{player['value']:.2f}</td>
            <td>{value_per_point:.2f}</td>
        </tr>
        """
    
    return f"""
        <div id="draft-pick-value-content" class="rb-content stats-tab-content" style="display: none;">
        <div class="rb-header">
            <h2>Draft Pick Value</h2>
            <p>Players ranked by draft pick value (TE, RB, WR only). Higher value indicates players who scored more points despite being picked later in the draft. Value = (Total Points)² × √(Draft Position). High point totals are weighted more heavily than late draft position.</p>
        </div>
        <div class="rb-table-wrapper">
            <table class="rb-comparison-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>Position</th>
                        <th>Team</th>
                        <th>Draft Position</th>
                        <th>Round/Pick</th>
                        <th>Total Points</th>
                        <th>Value</th>
                        <th>Value/Point</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
    </div>
    """

def generate_defense_rankings_html(defense_data):
    """Generate HTML for defense rankings table"""
    
    if not defense_data:
        return "<div class='rb-content'><p>No defense data found.</p></div>"
    
    # Generate table rows
    rows_html = ""
    for idx, defense in enumerate(defense_data):
        avg_points = defense['total_points'] / defense['games'] if defense['games'] > 0 else 0
        
        rows_html += f"""
        <tr>
            <td>{idx + 1}</td>
            <td class="player-name clickable-defense" onclick="showDefenseBreakdown('{defense['defense']}')" title="Click to view RB/WR breakdown for {defense['defense']}">{defense['defense']}</td>
            <td class="points">{defense['total_points']:.2f}</td>
            <td>{defense['rb_points']:.2f}</td>
            <td>{defense['wr_points']:.2f}</td>
            <td>{defense['games']}</td>
            <td>{avg_points:.2f}</td>
        </tr>
        """
    
    # Generate breakdown modals for each defense
    breakdown_modals_html = ""
    for defense in defense_data:
        rb_pct = (defense['rb_points'] / defense['total_points'] * 100) if defense['total_points'] > 0 else 0
        wr_pct = (defense['wr_points'] / defense['total_points'] * 100) if defense['total_points'] > 0 else 0
        
        breakdown_modals_html += f"""
        <div id="defense-breakdown-modal-{defense['defense']}" class="vulture-modal">
            <div class="vulture-modal-content">
                <div class="vulture-modal-header">
                    <h2>{defense['defense']} Defense - RB/WR Breakdown</h2>
                    <span class="vulture-close" onclick="closeDefenseBreakdown('{defense['defense']}')">&times;</span>
                </div>
                <div class="vulture-info">
                    <p><strong>Total Points Allowed (RB + WR):</strong> {defense['total_points']:.2f}</p>
                    <p><strong>Games Played:</strong> {defense['games']}</p>
                </div>
                <div class="vulture-table-wrapper">
                    <table class="vulture-table">
                        <thead>
                            <tr>
                                <th>Position</th>
                                <th>Total Points</th>
                                <th>Percentage</th>
                                <th>Avg per Game</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="player-name">Running Backs</td>
                                <td class="points">{defense['rb_points']:.2f}</td>
                                <td>{rb_pct:.1f}%</td>
                                <td>{(defense['rb_points'] / defense['games'] if defense['games'] > 0 else 0):.2f}</td>
                            </tr>
                            <tr>
                                <td class="player-name">Wide Receivers</td>
                                <td class="points">{defense['wr_points']:.2f}</td>
                                <td>{wr_pct:.1f}%</td>
                                <td>{(defense['wr_points'] / defense['games'] if defense['games'] > 0 else 0):.2f}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        """
    
    return f"""
        <div id="defense-rankings-content" class="rb-content stats-tab-content" style="display: none;">
        <div class="rb-header">
            <h2>Defense Rankings</h2>
            <p>NFL defenses ranked by total fantasy points allowed to RBs and WRs. Lower is better. Click a defense name to view the breakdown between RB and WR points.</p>
        </div>
        <div class="rb-table-wrapper">
            <table class="rb-comparison-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Defense</th>
                        <th>Total Points</th>
                        <th>RB Points</th>
                        <th>WR Points</th>
                        <th>Games</th>
                        <th>Avg per Game</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
        </div>
        {breakdown_modals_html}
    </div>
    """

def generate_fraud_watch_html(league, all_weeks_data):
    """Generate HTML for fraud watch page and club pages"""
    fraud_data = calculate_fraud_watch(league)
    club_200, club_sub100 = find_club_performances(league, all_weeks_data)
    mismanagement_data = calculate_mismanagement_leaderboard(league, all_weeks_data)
    
    # Fraud Watch rows
    fraud_rows_html = ""
    for idx, data in enumerate(fraud_data):
        team = data['team']
        fraud_class = "fraud-high" if data['fraud_score'] > 20 else "fraud-medium" if data['fraud_score'] > 10 else "fraud-low"
        
        fraud_rows_html += f"""
        <tr class="{fraud_class}">
            <td>{idx + 1}</td>
            <td class="team-name">{team.team_name}</td>
            <td>{data['owner']}</td>
            <td>{team.wins}-{team.losses}-{team.ties}</td>
            <td>{data['win_pct']:.1f}%</td>
            <td>{team.points_for:.2f}</td>
            <td>{data['pf_percentile']:.1f}%</td>
            <td>{team.points_against:.2f}</td>
            <td>{data['pa_percentile']:.1f}%</td>
            <td class="fraud-score">{data['fraud_score']:.1f}</td>
        </tr>
        """
    
    # 200 Club rows
    club_200_rows_html = ""
    for idx, data in enumerate(club_200):
        result = "W" if data['won'] else "L"
        result_class = "result-win" if data['won'] else "result-loss"
        club_200_rows_html += f"""
        <tr>
            <td>{idx + 1}</td>
            <td class="team-name">{data['team'].team_name}</td>
            <td class="score-highlight">{data['score']:.2f}</td>
            <td>Week {data['week']}</td>
            <td>vs {data['opponent'].team_name}</td>
            <td>{data['opponent_score']:.2f}</td>
            <td class="{result_class}">{result}</td>
            <td><a href="#" onclick="showWeek({data['week']}); return false;" class="week-link">View Matchup</a></td>
        </tr>
        """
    
    # Sub-100 Club rows
    club_sub100_rows_html = ""
    for idx, data in enumerate(club_sub100):
        result = "W" if data['won'] else "L"
        result_class = "result-win" if data['won'] else "result-loss"
        club_sub100_rows_html += f"""
        <tr>
            <td>{idx + 1}</td>
            <td class="team-name">{data['team'].team_name}</td>
            <td class="score-low">{data['score']:.2f}</td>
            <td>Week {data['week']}</td>
            <td>vs {data['opponent'].team_name}</td>
            <td>{data['opponent_score']:.2f}</td>
            <td class="{result_class}">{result}</td>
            <td><a href="#" onclick="showWeek({data['week']}); return false;" class="week-link">View Matchup</a></td>
        </tr>
        """
    
    # Mismanagement Leaderboard rows
    mismanagement_rows_html = generate_mismanagement_rows(mismanagement_data)
    
    return f"""
    <div id="total-year-stats-content" class="year-stats-content" style="display: none;">
        <div class="stats-header">
            <h2>Total Year Stats</h2>
        </div>
        <div class="stats-tabs">
            <button class="stats-tab-button active" onclick="showStatsPage('fraud-watch')">Fraud Watch</button>
            <button class="stats-tab-button" onclick="showStatsPage('club-200')">200 Club</button>
            <button class="stats-tab-button" onclick="showStatsPage('club-sub100')">Sub 100 Club</button>
            <button class="stats-tab-button" onclick="showStatsPage('mismanagement')">Mismanagement Leaderboard</button>
        </div>
        <div id="fraud-watch-page" class="stats-page" style="display: block;">
            <div class="page-header">
                <h3>Fraud Watch</h3>
                <p class="page-explanation">Teams ranked by fraud score. Higher scores indicate teams with good records but low points scored and easy schedules (low points against). These teams may be overperforming relative to their actual strength.</p>
            </div>
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Owner</th>
                            <th>Record</th>
                            <th>Win %</th>
                            <th>Points For</th>
                            <th>PF %ile</th>
                            <th>Points Against</th>
                            <th>PA %ile</th>
                            <th>Fraud Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fraud_rows_html}
                    </tbody>
                </table>
            </div>
        </div>
        <div id="club-200-page" class="stats-page" style="display: none;">
            <div class="page-header">
                <h3>200 Club</h3>
                <p class="page-explanation">Teams that scored 200+ points in a single week. Click "View Matchup" to see the full matchup details.</p>
            </div>
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Score</th>
                            <th>Week</th>
                            <th>Opponent</th>
                            <th>Opp Score</th>
                            <th>Result</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        {club_200_rows_html if club_200_rows_html else '<tr><td colspan="8" style="text-align: center; padding: 20px;">No teams scored 200+ points this season</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        <div id="club-sub100-page" class="stats-page" style="display: none;">
            <div class="page-header">
                <h3>Sub 100 Club</h3>
                <p class="page-explanation">Teams that scored under 100 points in a single week. Click "View Matchup" to see the full matchup details.</p>
            </div>
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Score</th>
                            <th>Week</th>
                            <th>Opponent</th>
                            <th>Opp Score</th>
                            <th>Result</th>
                            <th>Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        {club_sub100_rows_html if club_sub100_rows_html else '<tr><td colspan="8" style="text-align: center; padding: 20px;">No teams scored under 100 points this season</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
        <div id="mismanagement-page" class="stats-page" style="display: none;">
            <div class="page-header">
                <h3>Mismanagement Leaderboard</h3>
                <p class="page-explanation">Teams ranked by percentage of optimal points scored. This shows how well teams utilized their rosters - lower percentages indicate more points left on the bench. Teams are ranked from worst to best percentage.</p>
            </div>
            <div class="stats-table-wrapper">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team</th>
                            <th>Owner</th>
                            <th>% of Optimal</th>
                            <th>Max Possible Points</th>
                            <th>Actual Points</th>
                            <th>Points Left</th>
                            <th>Avg per Week</th>
                            <th>Record</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mismanagement_rows_html}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    """

def calculate_all_time_team_stats(teams_2024_data, teams_2025_data):
    """Calculate aggregated all-time stats for each team across all years"""
    all_time_stats = {}
    
    # Combine all team data
    all_teams_data = teams_2024_data + teams_2025_data
    
    for team_data in all_teams_data:
        team_id = team_data['team_id']
        
        if team_id not in all_time_stats:
            all_time_stats[team_id] = {
                'team_id': team_id,
                'team_name': team_data['team_name'],
                'owner': team_data['owner'],
                'wins': 0,
                'losses': 0,
                'ties': 0,
                'points_for': 0.0,
                'points_against': 0.0,
                'all_players': {}  # Dictionary to track players across years
            }
        
        # Aggregate wins, losses, ties
        all_time_stats[team_id]['wins'] += team_data['wins']
        all_time_stats[team_id]['losses'] += team_data['losses']
        all_time_stats[team_id]['ties'] += team_data.get('ties', 0)
        
        # Aggregate points
        all_time_stats[team_id]['points_for'] += team_data['points_for']
        all_time_stats[team_id]['points_against'] += team_data['points_against']
        
        # Aggregate players (combine points across years)
        for player in team_data['top_3_players']:
            player_name = player['name']
            if player_name not in all_time_stats[team_id]['all_players']:
                all_time_stats[team_id]['all_players'][player_name] = {
                    'name': player_name,
                    'position': player['position'],
                    'proTeam': player['proTeam'],
                    'total_points': 0.0,
                    'total_games': 0,
                    'avg_points': 0.0
                }
            
            # Add points and calculate games (approximate from avg)
            all_time_stats[team_id]['all_players'][player_name]['total_points'] += player['total_points']
            # Estimate games from avg points (if avg > 0)
            if player['avg_points'] > 0:
                estimated_games = int(player['total_points'] / player['avg_points'])
                all_time_stats[team_id]['all_players'][player_name]['total_games'] += estimated_games
    
    # Convert to list format and calculate final stats
    result = []
    for team_id, stats in all_time_stats.items():
        # Calculate record
        total_games = stats['wins'] + stats['losses'] + stats['ties']
        record = f"{stats['wins']}-{stats['losses']}" + (f"-{stats['ties']}" if stats['ties'] > 0 else "")
        
        # Get top 3 players by total points
        all_players_list = list(stats['all_players'].values())
        for player in all_players_list:
            if player['total_games'] > 0:
                player['avg_points'] = round(player['total_points'] / player['total_games'], 2)
            else:
                player['avg_points'] = 0.0
            player['total_points'] = round(player['total_points'], 2)
        
        all_players_list.sort(key=lambda x: x['total_points'], reverse=True)
        top_3_players = all_players_list[:3]
        
        result.append({
            'team_id': team_id,
            'team_name': stats['team_name'],
            'owner': stats['owner'],
            'wins': stats['wins'],
            'losses': stats['losses'],
            'ties': stats['ties'],
            'record': record,
            'playoff_placement': 'All Time',  # Special label for all-time view
            'points_for': round(stats['points_for'], 2),
            'points_against': round(stats['points_against'], 2),
            'top_3_players': top_3_players
        })
    
    # Sort teams by wins (descending), then by points for (descending) for standings
    result.sort(key=lambda x: (x['wins'], x['points_for']), reverse=True)
    
    return result

def generate_standings_html(teams_data, year_label):
    """Generate HTML table for standings"""
    if not teams_data:
        return f'<p>No standings data available for {year_label}</p>'
    
    # Teams are already sorted by wins then points_for in get_team_year_stats
    rows_html = ""
    for idx, team in enumerate(teams_data):
        win_pct = (team['wins'] / (team['wins'] + team['losses'] + team['ties']) * 100) if (team['wins'] + team['losses'] + team['ties']) > 0 else 0
        
        rows_html += f"""
        <tr>
            <td>{idx + 1}</td>
            <td class="team-name">{team['team_name']}</td>
            <td>{team['owner']}</td>
            <td>{team['record']}</td>
            <td>{win_pct:.1f}%</td>
            <td class="points">{team['points_for']:.2f}</td>
            <td class="points">{team['points_against']:.2f}</td>
            <td>{team['playoff_placement']}</td>
        </tr>
        """
    
    return f"""
    <div class="standings-table-wrapper">
        <table class="stats-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Owner</th>
                    <th>Record</th>
                    <th>Win %</th>
                    <th>Points For</th>
                    <th>Points Against</th>
                    <th>Playoff Result</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>
    """

def generate_team_pages_html(teams_2024_data, teams_2025_data):
    """Generate HTML for team pages with tabs for teams and years"""
    
    # Calculate all-time stats
    all_time_stats = calculate_all_time_team_stats(teams_2024_data, teams_2025_data)
    all_time_dict = {team['team_id']: team for team in all_time_stats}
    
    # Get unique team names and IDs across both years
    all_teams = {}
    for team in teams_2024_data:
        all_teams[team['team_id']] = {
            'team_name': team['team_name'],
            'owner': team['owner']
        }
    for team in teams_2025_data:
        all_teams[team['team_id']] = {
            'team_name': team['team_name'],
            'owner': team['owner']
        }
    
    # Create team tabs - add Standings button
    team_tabs_html = '<button class="team-tab-button" onclick="showTeam(\'standings\')" id="team-tab-standings">Standings</button>\n'
    team_content_html = ""
    
    # Create a mapping of team_id to data for each year
    teams_2024_dict = {team['team_id']: team for team in teams_2024_data}
    teams_2025_dict = {team['team_id']: team for team in teams_2025_data}
    
    # Generate tabs and content for each team
    for idx, (team_id, team_info) in enumerate(all_teams.items()):
        # Team tab button
        team_tabs_html += f'<button class="team-tab-button" onclick="showTeam({team_id})" id="team-tab-{team_id}">{team_info["team_name"]}</button>\n'
        
        # Team content section with year tabs
        year_tabs_html = ""
        year_content_html = ""
        
        # 2025 data
        team_2025 = teams_2025_dict.get(team_id)
        year_tabs_html += f'<button class="year-tab-button" onclick="showTeamYear({team_id}, 2025)" id="team-{team_id}-year-2025-tab">2025</button>\n'
        
        if team_2025:
            year_content_html += f"""
            <div id="team-{team_id}-year-2025-content" class="team-year-content" style="display: block;">
                <div class="team-stats-header">
                    <h2>{team_2025['team_name']} - 2025</h2>
                    <p class="team-owner">Owner: {team_2025['owner']}</p>
                </div>
                <div class="team-record-info">
                    <div class="record-box">
                        <h3>Record</h3>
                        <p class="record-text">{team_2025['record']}</p>
                        <p class="points-text">Points For: {team_2025['points_for']:.2f}</p>
                        <p class="points-text">Points Against: {team_2025['points_against']:.2f}</p>
                    </div>
                    <div class="playoff-box">
                        <h3>Playoff Result</h3>
                        <p class="playoff-text">{team_2025['playoff_placement']}</p>
                    </div>
                </div>
                <div class="top-players-section">
                    <h3>Top 3 Players</h3>
                    <div class="top-players-grid">
                        {''.join([f'''
                        <div class="player-card">
                            <div class="player-name">{player['name']}</div>
                            <div class="player-position">{player['position']} - {player['proTeam']}</div>
                            <div class="player-points">Total: {player['total_points']:.2f} pts</div>
                            <div class="player-avg">Avg: {player['avg_points']:.2f} pts</div>
                        </div>
                        ''' for player in team_2025['top_3_players']])}
                    </div>
                </div>
            </div>
            """
        else:
            year_content_html += f"""
            <div id="team-{team_id}-year-2025-content" class="team-year-content" style="display: block;">
                <p>No data available for 2025</p>
            </div>
            """
        
        # 2024 data
        team_2024 = teams_2024_dict.get(team_id)
        year_tabs_html += f'<button class="year-tab-button" onclick="showTeamYear({team_id}, 2024)" id="team-{team_id}-year-2024-tab">2024</button>\n'
        
        if team_2024:
            year_content_html += f"""
            <div id="team-{team_id}-year-2024-content" class="team-year-content" style="display: none;">
                <div class="team-stats-header">
                    <h2>{team_2024['team_name']} - 2024</h2>
                    <p class="team-owner">Owner: {team_2024['owner']}</p>
                </div>
                <div class="team-record-info">
                    <div class="record-box">
                        <h3>Record</h3>
                        <p class="record-text">{team_2024['record']}</p>
                        <p class="points-text">Points For: {team_2024['points_for']:.2f}</p>
                        <p class="points-text">Points Against: {team_2024['points_against']:.2f}</p>
                    </div>
                    <div class="playoff-box">
                        <h3>Playoff Result</h3>
                        <p class="playoff-text">{team_2024['playoff_placement']}</p>
                    </div>
                </div>
                <div class="top-players-section">
                    <h3>Top 3 Players</h3>
                    <div class="top-players-grid">
                        {''.join([f'''
                        <div class="player-card">
                            <div class="player-name">{player['name']}</div>
                            <div class="player-position">{player['position']} - {player['proTeam']}</div>
                            <div class="player-points">Total: {player['total_points']:.2f} pts</div>
                            <div class="player-avg">Avg: {player['avg_points']:.2f} pts</div>
                        </div>
                        ''' for player in team_2024['top_3_players']])}
                    </div>
                </div>
            </div>
            """
        else:
            year_content_html += f"""
            <div id="team-{team_id}-year-2024-content" class="team-year-content" style="display: none;">
                <p>No data available for 2024</p>
            </div>
            """
        
        # Total/All-time data
        team_total = all_time_dict.get(team_id)
        year_tabs_html += f'<button class="year-tab-button" onclick="showTeamYear({team_id}, \'total\')" id="team-{team_id}-year-total-tab">Total</button>\n'
        
        if team_total:
            year_content_html += f"""
            <div id="team-{team_id}-year-total-content" class="team-year-content" style="display: none;">
                <div class="team-stats-header">
                    <h2>{team_total['team_name']} - All Time</h2>
                    <p class="team-owner">Owner: {team_total['owner']}</p>
                </div>
                <div class="team-record-info">
                    <div class="record-box">
                        <h3>Record</h3>
                        <p class="record-text">{team_total['record']}</p>
                        <p class="points-text">Points For: {team_total['points_for']:.2f}</p>
                        <p class="points-text">Points Against: {team_total['points_against']:.2f}</p>
                    </div>
                    <div class="playoff-box">
                        <h3>Playoff Result</h3>
                        <p class="playoff-text">{team_total['playoff_placement']}</p>
                    </div>
                </div>
                <div class="top-players-section">
                    <h3>Top 3 Players (All Time)</h3>
                    <div class="top-players-grid">
                        {''.join([f'''
                        <div class="player-card">
                            <div class="player-name">{player['name']}</div>
                            <div class="player-position">{player['position']} - {player['proTeam']}</div>
                            <div class="player-points">Total: {player['total_points']:.2f} pts</div>
                            <div class="player-avg">Avg: {player['avg_points']:.2f} pts</div>
                        </div>
                        ''' for player in team_total['top_3_players']])}
                    </div>
                </div>
            </div>
            """
        else:
            year_content_html += f"""
            <div id="team-{team_id}-year-total-content" class="team-year-content" style="display: none;">
                <p>No all-time data available</p>
            </div>
            """
        
        # Team content wrapper
        team_content_html += f"""
        <div id="team-{team_id}-content" class="team-content" style="display: {'block' if idx == 0 else 'none'};">
            <div class="team-year-tabs">
                {year_tabs_html}
            </div>
            <div class="team-year-content-wrapper">
                {year_content_html}
            </div>
        </div>
        """
    
    # Generate standings content with year tabs
    standings_year_tabs_html = ""
    standings_content_html = ""
    
    # 2025 standings
    standings_year_tabs_html += '<button class="year-tab-button" onclick="showTeamYear(\'standings\', 2025)" id="team-standings-year-2025-tab">2025</button>\n'
    standings_2025_html = generate_standings_html(teams_2025_data, "2025")
    standings_content_html += f"""
    <div id="team-standings-year-2025-content" class="team-year-content" style="display: block;">
        <div class="team-stats-header">
            <h2>Standings - 2025</h2>
        </div>
        {standings_2025_html}
    </div>
    """
    
    # 2024 standings
    standings_year_tabs_html += '<button class="year-tab-button" onclick="showTeamYear(\'standings\', 2024)" id="team-standings-year-2024-tab">2024</button>\n'
    standings_2024_html = generate_standings_html(teams_2024_data, "2024")
    standings_content_html += f"""
    <div id="team-standings-year-2024-content" class="team-year-content" style="display: none;">
        <div class="team-stats-header">
            <h2>Standings - 2024</h2>
        </div>
        {standings_2024_html}
    </div>
    """
    
    # Total/All-time standings
    standings_year_tabs_html += '<button class="year-tab-button" onclick="showTeamYear(\'standings\', \'total\')" id="team-standings-year-total-tab">Total</button>\n'
    standings_total_html = generate_standings_html(all_time_stats, "All Time")
    standings_content_html += f"""
    <div id="team-standings-year-total-content" class="team-year-content" style="display: none;">
        <div class="team-stats-header">
            <h2>Standings - All Time</h2>
        </div>
        {standings_total_html}
    </div>
    """
    
    # Add standings content wrapper
    team_content_html += f"""
    <div id="team-standings-content" class="team-content" style="display: none;">
        <div class="team-year-tabs">
            {standings_year_tabs_html}
        </div>
        <div class="team-year-content-wrapper">
            {standings_content_html}
        </div>
    </div>
    """
    
    return f"""
    <div id="team-pages-content" class="rb-content" style="display: none;">
        <div class="rb-header">
            <h2>Team Pages</h2>
            <p>View statistics and top players for each team by year, or view league standings. Click a team name to view their page, then switch between years.</p>
        </div>
        <div class="team-tabs-wrapper">
            <div class="team-tabs">
                {team_tabs_html}
            </div>
        </div>
        <div class="team-content-wrapper">
            {team_content_html}
        </div>
    </div>
    """

def generate_shared_content_html(rbs, wrs, league_2025, all_weeks_data_2025, teams_2024_data, teams_2025_data):
    """Generate HTML content shared across years (Weekly Matchups, Player Comparisons, Year Stats, Team Pages)"""
    
    # Generate year selector buttons dynamically
    year_buttons_html = ""
    for year in YEARS:
        year_buttons_html += f"""
                <button class="rb-comparison-main-btn" onclick="switchYear({year})" id="year-{year}-btn"
                    style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
                    <span class="btn-icon">📅</span>
                    <span class="btn-text">{year}</span>
                </button>"""
    
    # Weekly Matchups content with year selector and navigation placeholders
    weekly_matchups_html = f"""
    <!-- Weekly Matchups page -->
    <div id="weekly-matchups-content" style="display: none;">
        <!-- Year selector -->
        <div class="year-selector" style="background: #f8f9fa; padding: 15px 30px; border-bottom: 2px solid #e0e0e0; text-align: center;">
            <div style="display: inline-flex; gap: 10px; align-items: center;">
                <span style="font-weight: 600; margin-right: 10px;">Year:</span>
                {year_buttons_html}
            </div>
        </div>
        
        <!-- These three are now empty; app.js fills them -->
        <div id="week-nav" class="week-navigation"></div>
        <div id="matchup-nav" class="matchup-tabs"></div>
        <div id="content" class="matchup-content-wrapper"></div>
    </div>
    """
    
    # Add RB comparison content (using 2025 data)
    rb_comparison_html = generate_rb_comparison_html(rbs)
    
    # Add WR comparison content (using 2025 data)
    wr_comparison_html = generate_wr_comparison_html(wrs)
    
    # Add Defense Rankings content (using 2025 data)
    defense_data = collect_defense_rankings(league_2025, all_weeks_data_2025)
    defense_rankings_html = generate_defense_rankings_html(defense_data)
    
    # Add Draft Pick Value content (using 2025 data)
    draft_values = collect_draft_pick_values(league_2025) if league_2025 else []
    draft_pick_value_html = generate_draft_pick_value_html(draft_values)
    
    # Wrap RB, WR, Defense, and Draft Pick Value in Player Comparisons with tabs
    player_comparisons_html = f"""
    <!-- Player Comparisons page with tabs -->
    <div id="player-comparisons-content" style="display: none;">
        <div class="stats-tabs-container">
            <button class="stats-tab-button active" onclick="showPlayerComparisonTab('wr')" id="player-comparison-tab-wr">
                Wide Receivers
            </button>
            <button class="stats-tab-button" onclick="showPlayerComparisonTab('rb')" id="player-comparison-tab-rb">
                Running Backs
            </button>
            <button class="stats-tab-button" onclick="showPlayerComparisonTab('defense')" id="player-comparison-tab-defense">
                Defense Rankings
            </button>
            <button class="stats-tab-button" onclick="showPlayerComparisonTab('draft')" id="player-comparison-tab-draft">
                Draft Pick Value
            </button>
        </div>
        
        {wr_comparison_html}
        {rb_comparison_html}
        {defense_rankings_html}
        {draft_pick_value_html}
    </div>
    """
    
    # Add Total Year Stats content (using 2025 data)
    year_stats_html = generate_fraud_watch_html(league_2025, all_weeks_data_2025)
    
    # Add Team Pages content
    team_pages_html = generate_team_pages_html(teams_2024_data, teams_2025_data)
    
    return weekly_matchups_html + player_comparisons_html + year_stats_html + team_pages_html


def main():
    # Check if credentials are set
    if ESPN_S2 == 'PUT_YOUR_ESPN_S2_HERE' or SWID == '{PUT_YOUR_SWID_HERE}':
        print("ERROR: Please set your ESPN_S2 and SWID credentials in the script!")
        print("Replace 'PUT_YOUR_ESPN_S2_HERE' and '{PUT_YOUR_SWID_HERE}' with your actual values.")
        return
    
    league_2025 = None
    league_2024 = None
    all_weeks_data_2025 = None

    shared_content_html = ""

    for year in YEARS:
        print(f"\nProcessing Year {year}")
        try:
            league = League(league_id=LEAGUE_ID, year=year, espn_s2=ESPN_S2, swid=SWID)
        except Exception as e:
            print(f"ERROR: Failed to connect to league for year {year}: {e}")
            continue

        if not league:
            print(f"ERROR: League object is None for year {year}")
            continue

        if year == 2025:
            league_2025 = league
        if year == 2024:
            league_2024 = league

        try:
            current_week = league.current_week
        except Exception as e:
            print(f"ERROR: Failed to get current week for year {year}: {e}")
            continue
        print(f"Current week for {year}: {current_week}")
        print(f"Fetching box scores weeks 1..{current_week}")

        all_weeks_data = {}
        for week in range(1, current_week + 1):
            try:
                box_scores = league.box_scores(week=week)
                all_weeks_data[week] = box_scores
                print(f"  Week {week}: OK ({len(box_scores)} matchups)")
            except Exception as e:
                print(f"  Week {week}: Error {e}")

        if year == 2025:
            all_weeks_data_2025 = all_weeks_data

        year_json = build_year_json(league, all_weeks_data, year)
        with open(f"data-{year}.json", "w", encoding="utf-8") as f:
            json.dump(year_json, f)
        print(f"Wrote data-{year}.json")

    # If you pasted your old shared generators above, this will work unchanged:
    if "generate_shared_content_html" in globals() and league_2025:
        print("\nGenerating shared pages (RB/WR/Stats/Teams) from 2025 data...")
        rbs_2025 = collect_running_backs(league_2025)
        wrs_2025 = collect_wide_receivers(league_2025)
        
        # Get matchup data for 2024 if available
        all_weeks_data_2024 = None
        if league_2024:
            try:
                all_weeks_data_2024 = {}
                current_week_2024 = league_2024.current_week
                for week in range(1, current_week_2024 + 1):
                    try:
                        box_scores = league_2024.box_scores(week=week)
                        all_weeks_data_2024[week] = box_scores
                    except Exception as e:
                        print(f"  Warning: Could not fetch week {week} for 2024: {e}")
            except Exception as e:
                print(f"  Warning: Could not fetch matchup data for 2024: {e}")
        
        teams_2024_data = get_team_year_stats(league_2024, all_weeks_data_2024) if league_2024 else []
        teams_2025_data = get_team_year_stats(league_2025, all_weeks_data_2025) if league_2025 else []
        shared_content_html = generate_shared_content_html(
            rbs_2025, wrs_2025, league_2025, all_weeks_data_2025,
            teams_2024_data, teams_2025_data
        )
    else:
        print("\nShared pages skipped (functions not present).")

    league_name = league_2025.settings.name if league_2025 else "Fantasy League"
    index_html = generate_index_shell_html(shared_content_html, league_name=league_name)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(index_html)

    print("\nDone! Outputs:")
    for year in YEARS:
        print(f" - data-{year}.json")
    print(" - index.html (tiny shell)")
    print("\nOpen index.html in your browser.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        print(f"\nError running script: {e}")
        print("\nFull traceback:")
        traceback.print_exc()
