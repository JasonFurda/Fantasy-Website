"""
Generate HTML file with tabbed interface for all weeks' matchups
"""

from espn_api.football import League

# League configuration
LEAGUE_ID = 953181335
YEAR = 2025
ESPN_S2 = 'AEAXwngCrt5PQ2zc%2F2Si2z%2B8Syo4oDo1hs6gSsDACboeC7WNVJT5EWC1Hiu6gueWZgnEDv3IL%2FdPldXwm7f4PvTW4p7WEe8w20SfVmN3utCymMrKJExo5PSQtO62xFh2kIh9cPE0ZCQZxrPX%2F7kjSmfT5Mo2qlDq3dEBbMHJIIG3nJ03FDHzz8xalcpdf1M9ZcEFsOrDGKSJX%2BxlL18puksn9M2ACEzL0El8oFJcGA3mYGsIgreBQGwKa1ZKcsnJZegXIDhasPTrGqXk%2Fv81oGUdAYQzVmKwJfxadoywCRETwg7wnQpu8UpRcwVj9nCsDYHjeU%2BysosGhneVWtLFGKzf'
SWID = '{EC9E2E2E-468A-4AD9-B5CD-19E1D66BBF09}'

def get_owner_name(team):
    """Get owner display name from team"""
    if team.owners:
        return team.owners[0].get('displayName', team.owners[0].get('firstName', 'Unknown'))
    return "Unknown"

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
                season_stats = player.stats.get(0, {})
                season_breakdown = season_stats.get('breakdown', {})
                
                if season_breakdown:
                    # Use season totals if available
                    rb_data['rushing_attempts'] = season_breakdown.get('rushingAttempts', 0)
                    rb_data['rushing_yards'] = season_breakdown.get('rushingYards', 0)
                    rb_data['rushing_tds'] = season_breakdown.get('rushingTouchdowns', 0)
                    rb_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                    rb_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                    rb_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                    rb_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                    
                    # Count games played by counting weeks with stats
                    for week in range(1, league.current_week + 1):
                        week_stats = player.stats.get(week, {})
                        if week_stats and week_stats.get('breakdown'):
                            rb_data['games_played'] += 1
                else:
                    # Fallback: Aggregate stats across all weeks
                    for week in range(1, league.current_week + 1):
                        week_stats = player.stats.get(week, {})
                        if week_stats:
                            breakdown = week_stats.get('breakdown', {})
                            if breakdown:  # Player played this week
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
                    if hasattr(player, 'stats'):
                        season_stats = player.stats.get(0, {})
                        season_breakdown = season_stats.get('breakdown', {})
                        
                        if season_breakdown:
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
                                if week_stats and week_stats.get('breakdown'):
                                    rb_data['games_played'] += 1
                        else:
                            # Fallback: Aggregate stats across all weeks
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats:
                                    breakdown = week_stats.get('breakdown', {})
                                    if breakdown:
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
                season_stats = player.stats.get(0, {})
                season_breakdown = season_stats.get('breakdown', {})
                
                if season_breakdown:
                    # Use season totals if available
                    wr_data['targets'] = season_breakdown.get('receivingTargets', 0)
                    wr_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                    wr_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                    wr_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                    wr_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                    
                    # Count games played by counting weeks with stats
                    for week in range(1, league.current_week + 1):
                        week_stats = player.stats.get(week, {})
                        if week_stats and week_stats.get('breakdown'):
                            wr_data['games_played'] += 1
                else:
                    # Fallback: Aggregate stats across all weeks
                    for week in range(1, league.current_week + 1):
                        week_stats = player.stats.get(week, {})
                        if week_stats:
                            breakdown = week_stats.get('breakdown', {})
                            if breakdown:  # Player played this week
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
                    if hasattr(player, 'stats'):
                        season_stats = player.stats.get(0, {})
                        season_breakdown = season_stats.get('breakdown', {})
                        
                        if season_breakdown:
                            # Use season totals if available
                            wr_data['targets'] = season_breakdown.get('receivingTargets', 0)
                            wr_data['receptions'] = season_breakdown.get('receivingReceptions', 0)
                            wr_data['receiving_yards'] = season_breakdown.get('receivingYards', 0)
                            wr_data['receiving_tds'] = season_breakdown.get('receivingTouchdowns', 0)
                            wr_data['fumbles_lost'] = season_breakdown.get('lostFumbles', 0)
                            
                            # Count games played
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats and week_stats.get('breakdown'):
                                    wr_data['games_played'] += 1
                        else:
                            # Fallback: Aggregate stats across all weeks
                            for week in range(1, league.current_week + 1):
                                week_stats = player.stats.get(week, {})
                                if week_stats:
                                    breakdown = week_stats.get('breakdown', {})
                                    if breakdown:
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

def get_position_sort_order(slot_position):
    """Get sort order for positions: QB, RBs, WRs, TE, FLEX, D/ST, K, Bench"""
    position_order = {
        'QB': 1,
        'TQB': 1,  # Team QB
        'RB': 2,
        'WR': 3,
        'TE': 4,
        'RB/WR/TE': 5,  # FLEX
        'RB/WR': 5,  # Also FLEX
        'WR/TE': 5,  # Also FLEX
        'OP': 5,  # Offensive Player (FLEX)
        'D/ST': 6,
        'K': 7,
        'BE': 8,  # Bench
        'IR': 9,  # Injured Reserve (after bench)
    }
    return position_order.get(slot_position, 10)  # Unknown positions go last

def sort_lineup_by_position(players):
    """Sort players by position in the order: QB, RBs, WRs, TE, FLEX, D/ST, K, Bench"""
    return sorted(players, key=lambda p: (get_position_sort_order(p.slot_position), p.slot_position))

def format_player_row(player):
    """Format a player row for HTML"""
    status_class = "player-playing" if player.game_played == 100 else "player-pending"
    bye_class = "player-bye" if player.on_bye_week else ""
    bench_class = "player-bench" if player.slot_position == 'BE' else ""
    
    # Calculate performance vs projected
    if player.projected_points > 0:
        performance_diff = player.points - player.projected_points
        performance_pct = (performance_diff / player.projected_points) * 100
    else:
        performance_diff = 0
        performance_pct = 0
    
    # Determine performance class based on how much they over/under performed
    if performance_pct >= 50:
        perf_class = "perf-excellent"  # 50%+ over
    elif performance_pct >= 25:
        perf_class = "perf-great"  # 25-50% over
    elif performance_pct >= 10:
        perf_class = "perf-good"  # 10-25% over
    elif performance_pct >= 0:
        perf_class = "perf-slight-over"  # 0-10% over
    elif performance_pct >= -10:
        perf_class = "perf-slight-under"  # 0 to -10% under
    elif performance_pct >= -25:
        perf_class = "perf-bad"  # -10 to -25% under
    elif performance_pct >= -50:
        perf_class = "perf-very-bad"  # -25 to -50% under
    else:
        perf_class = "perf-terrible"  # -50%+ under
    
    return f"""
            <tr class="{status_class} {bye_class} {bench_class} {perf_class}">
                <td>{player.slot_position}</td>
                <td>{player.name}</td>
                <td>{player.proTeam}</td>
                <td>{player.pro_opponent if not player.on_bye_week else 'BYE'}</td>
                <td class="points">{player.points:.2f}</td>
                <td class="projected">{player.projected_points:.2f}</td>
            </tr>"""

def generate_week_content(league, box_scores, week, week_idx, year=None):
    """Generate HTML content for a specific week"""
    
    # Generate matchup tabs HTML
    matchup_tabs_html = ""
    matchup_content_html = ""
    year_suffix = f"-{year}" if year else ""
    
    for matchup_idx, matchup in enumerate(box_scores):
        if not matchup.home_team:
            continue
            
        matchup_id = f"week-{week}{year_suffix}-matchup-{matchup_idx}"
        tab_label = f"{matchup.away_team.team_name} @ {matchup.home_team.team_name}"
        
        # Determine winner
        if matchup.away_score > matchup.home_score:
            away_class = "winner"
            home_class = ""
        elif matchup.home_score > matchup.away_score:
            away_class = ""
            home_class = "winner"
        else:
            away_class = ""
            home_class = ""
        
        # Sort lineups by position order
        away_lineup_sorted = sort_lineup_by_position(matchup.away_lineup)
        home_lineup_sorted = sort_lineup_by_position(matchup.home_lineup)
        
        # Generate player rows
        away_players_html = "".join([format_player_row(player) for player in away_lineup_sorted])
        home_players_html = "".join([format_player_row(player) for player in home_lineup_sorted])
        
        # Matchup tab button
        year_param = year if year else YEAR
        matchup_tabs_html += f'<button class="matchup-tab-button" onclick="showMatchup({week}, {matchup_idx}, {year_param})">{tab_label}</button>\n'
        
        # Matchup content
        matchup_content_html += f"""
        <div id="week-{week}{year_suffix}-matchup-{matchup_idx}" class="matchup-content" style="display: {'block' if matchup_idx == 0 else 'none'};">
            <div class="teams-container">
                <!-- Away Team -->
                <div class="team-box away-team {away_class}">
                    <div class="team-header">
                        <h3>{matchup.away_team.team_name}</h3>
                        <p class="owner">{get_owner_name(matchup.away_team)}</p>
                        <div class="score-box">
                            <span class="score">{matchup.away_score:.2f}</span>
                            <span class="projected-score">Proj: {matchup.away_projected:.2f}</span>
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
                            {away_players_html}
                        </tbody>
                    </table>
                </div>
                
                <!-- Home Team -->
                <div class="team-box home-team {home_class}">
                    <div class="team-header">
                        <h3>{matchup.home_team.team_name}</h3>
                        <p class="owner">{get_owner_name(matchup.home_team)}</p>
                        <div class="score-box">
                            <span class="score">{matchup.home_score:.2f}</span>
                            <span class="projected-score">Proj: {matchup.home_projected:.2f}</span>
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
                            {home_players_html}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        """
    
    return matchup_tabs_html, matchup_content_html

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
    <div id="rb-comparison-content" class="rb-content" style="display: none;">
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
    <div id="wr-comparison-content" class="rb-content" style="display: none;">
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

def get_team_year_stats(league):
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
            if team.final_standing == 1:
                playoff_placement = "Champion"
            elif team.final_standing == 2:
                playoff_placement = "Runner-up"
            elif team.final_standing > 0:
                playoff_teams = getattr(league.settings, 'playoff_teams', 6)
                if team.final_standing <= playoff_teams:
                    playoff_placement = f"{team.final_standing}th Place"
                else:
                    playoff_placement = "Did not make playoffs"
        elif hasattr(team, 'standing_seed') and team.standing_seed:
            playoff_placement = f"#{team.standing_seed} Seed"
        elif hasattr(team, 'standing') and team.standing:
            standing = team.standing
            playoff_teams = getattr(league.settings, 'playoff_teams', 6)
            if standing <= playoff_teams:
                playoff_placement = f"#{standing} Seed"
            else:
                playoff_placement = "Did not make playoffs"
        
        # Get top 3 players by total points
        roster_players = []
        if hasattr(team, 'roster') and team.roster:
            for player in team.roster:
                if hasattr(player, 'total_points') and player.total_points:
                    roster_players.append({
                        'name': player.name,
                        'position': getattr(player, 'position', 'N/A'),
                        'total_points': player.total_points,
                        'avg_points': getattr(player, 'avg_points', 0),
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

def generate_team_pages_html(teams_2024_data, teams_2025_data):
    """Generate HTML for team pages with tabs for teams and years"""
    
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
    
    # Create team tabs
    team_tabs_html = ""
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
    
    return f"""
    <div id="team-pages-content" class="rb-content" style="display: none;">
        <div class="rb-header">
            <h2>Team Pages</h2>
            <p>View statistics and top players for each team by year. Click a team name to view their page, then switch between years.</p>
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

def find_club_performances(league, all_weeks_data):
    """Find teams that scored 200+ or sub-100 in any week"""
    club_200 = []  # Teams that scored 200+
    club_sub100 = []  # Teams that scored < 100
    
    for week, box_scores in all_weeks_data.items():
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
            elif matchup.away_score < 100:
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
            elif matchup.home_score < 100:
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

def generate_fraud_watch_html(league, all_weeks_data):
    """Generate HTML for fraud watch page and club pages"""
    fraud_data = calculate_fraud_watch(league)
    club_200, club_sub100 = find_club_performances(league, all_weeks_data)
    
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
    
    return f"""
    <div id="total-year-stats-content" class="year-stats-content" style="display: none;">
        <div class="stats-header">
            <h2>Total Year Stats</h2>
        </div>
        <div class="stats-tabs">
            <button class="stats-tab-button active" onclick="showStatsPage('fraud-watch')">Fraud Watch</button>
            <button class="stats-tab-button" onclick="showStatsPage('club-200')">200 Club</button>
            <button class="stats-tab-button" onclick="showStatsPage('club-sub100')">Sub 100 Club</button>
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
    </div>
    """

def generate_html(league, all_weeks_data, current_week, rbs, wrs, year=YEAR):
    """Generate HTML content with week navigation and matchup tabs for a specific year"""
    
    # Generate week navigation
    week_nav_html = ""
    week_content_html = ""
    year_suffix = f"-{year}"
    
    for week in sorted(all_weeks_data.keys()):
        week_idx = week - 1
        box_scores = all_weeks_data[week]
        is_current = week == current_week
        
        # Week navigation button
        week_nav_html += f'<button class="week-button" onclick="showWeek({week}, {year})" {"data-current='true'" if is_current else ""}>Week {week}</button>\n'
        
        # Get matchup tabs and content for this week
        matchup_tabs, matchup_content = generate_week_content(league, box_scores, week, week_idx, year)
        
        # Week content section
        week_content_html += f"""
        <div id="week-{week}{year_suffix}-content" class="week-content" style="display: {'block' if is_current else 'none'};">
            <div class="week-header">
                <h2>Week {week} Matchups - {year}</h2>
            </div>
            <div class="matchup-tabs">
                {matchup_tabs}
            </div>
            <div class="matchup-content-wrapper">
                {matchup_content}
            </div>
        </div>
        """
    
    # Wrap content in year section
    year_section_html = f"""
    <div id="year-{year}-section" class="year-section" style="display: {'block' if year == YEAR else 'none'};">
        <div class="week-navigation">
            <div class="week-nav-label">Weeks:</div>
            {week_nav_html}
        </div>
        {week_content_html}
    </div>
    """
    
    return year_section_html

def generate_shared_content_html(rbs, wrs, league_2025, all_weeks_data_2025, teams_2024_data, teams_2025_data):
    """Generate HTML content shared across years (RB comparison, WR comparison, Year Stats, Team Pages)"""
    
    # Add RB comparison content (using 2025 data)
    rb_comparison_html = generate_rb_comparison_html(rbs)
    
    # Add WR comparison content (using 2025 data)
    wr_comparison_html = generate_wr_comparison_html(wrs)
    
    # Add Total Year Stats content (using 2025 data)
    year_stats_html = generate_fraud_watch_html(league_2025, all_weeks_data_2025)
    
    # Add Team Pages content
    team_pages_html = generate_team_pages_html(teams_2024_data, teams_2025_data)
    
    return rb_comparison_html + wr_comparison_html + year_stats_html + team_pages_html

def generate_full_html(year_sections_html, shared_content_html, league_2025):
    """Generate complete HTML with all year sections"""
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{league_2025.settings.name if league_2025 else 'Fantasy League'} - All Weeks Matchups</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        
        .header p {{
            font-size: 1.2em;
            opacity: 0.9;
        }}
        
        .main-navigation {{
            background: #f8f9fa;
            padding: 15px 30px;
            border-bottom: 2px solid #e0e0e0;
            text-align: center;
        }}
        
        .rb-comparison-main-btn {{
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 1.1em;
            font-weight: 600;
            border-radius: 25px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
            display: inline-flex;
            align-items: center;
            gap: 10px;
        }}
        
        .rb-comparison-main-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
        }}
        
        .rb-comparison-main-btn.active {{
            background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
            box-shadow: 0 4px 15px rgba(245, 87, 108, 0.5);
        }}
        
        .rb-comparison-main-btn:hover {{
            transform: translateY(-2px);
        }}
        
        #year-stats-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(79, 172, 254, 0.4);
        }}
        
        #year-stats-btn.active {{
            background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
            box-shadow: 0 4px 15px rgba(79, 172, 254, 0.5);
        }}
        
        .btn-icon {{
            font-size: 1.3em;
        }}
        
        .week-navigation {{
            display: flex;
            align-items: center;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-bottom: 2px solid #dee2e6;
            overflow-x: auto;
            padding: 0;
            flex-wrap: wrap;
            gap: 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }}
        
        .week-nav-label {{
            padding: 18px 20px;
            font-weight: 700;
            color: #495057;
            white-space: nowrap;
            font-size: 0.95em;
            background: #e9ecef;
            border-right: 2px solid #dee2e6;
            letter-spacing: 0.5px;
        }}
        
        .week-button {{
            background: transparent;
            border: none;
            padding: 18px 28px;
            cursor: pointer;
            font-size: 1em;
            font-weight: 600;
            color: #6c757d;
            border-bottom: 3px solid transparent;
            border-right: 1px solid #dee2e6;
            transition: all 0.3s ease;
            white-space: nowrap;
            position: relative;
            min-width: 80px;
            text-align: center;
        }}
        
        .week-button::before {{
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: width 0.3s ease;
        }}
        
        .week-button:hover {{
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            color: #667eea;
            transform: translateY(-2px);
        }}
        
        .week-button:hover::before {{
            width: 100%;
        }}
        
        .week-button.active {{
            color: #667eea;
            background: white;
            box-shadow: 0 -2px 8px rgba(102, 126, 234, 0.15);
        }}
        
        .week-button.active::before {{
            width: 100%;
        }}
        
        .week-content {{
            padding: 30px 40px;
            background: white;
        }}
        
        .week-header {{
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }}
        
        .week-header h2 {{
            color: #333;
            font-size: 2.2em;
            margin: 0;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}
        
        .matchup-tabs {{
            display: flex;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-bottom: 2px solid #e9ecef;
            overflow-x: auto;
            padding: 0;
            margin-bottom: 25px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            gap: 0;
        }}
        
        .matchup-tab-button {{
            background: transparent;
            border: none;
            padding: 16px 24px;
            cursor: pointer;
            font-size: 0.95em;
            font-weight: 600;
            color: #6c757d;
            border-bottom: 3px solid transparent;
            border-right: 1px solid #e9ecef;
            transition: all 0.3s ease;
            white-space: nowrap;
            position: relative;
            min-width: 180px;
            text-align: center;
        }}
        
        .matchup-tab-button::after {{
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 3px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: all 0.3s ease;
            border-radius: 2px 2px 0 0;
        }}
        
        .matchup-tab-button:hover {{
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            color: #667eea;
            transform: translateY(-1px);
        }}
        
        .matchup-tab-button:hover::after {{
            width: 80%;
        }}
        
        .matchup-tab-button.active {{
            color: #667eea;
            background: white;
            box-shadow: 0 -2px 6px rgba(102, 126, 234, 0.1);
        }}
        
        .matchup-tab-button.active::after {{
            width: 100%;
        }}
        
        .matchup-tab-button:last-child {{
            border-right: none;
        }}
        
        .matchup-content-wrapper {{
            min-height: 400px;
        }}
        
        .matchup-content {{
            display: none;
        }}
        
        .rb-content {{
            padding: 30px;
        }}
        
        .rb-header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        .rb-header h2 {{
            color: #333;
            font-size: 2em;
            margin-bottom: 10px;
        }}
        
        .rb-header p {{
            color: #666;
            font-size: 1.1em;
        }}
        
        .rb-table-wrapper {{
            overflow-x: auto;
            margin-top: 20px;
        }}
        
        .rb-comparison-table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .rb-comparison-table th {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-weight: 600;
            font-size: 0.9em;
            position: sticky;
            top: 0;
            z-index: 10;
        }}
        
        .rb-comparison-table th:first-child,
        .rb-comparison-table td:first-child {{
            position: sticky;
            left: 0;
            background: white;
            z-index: 5;
        }}
        
        .rb-comparison-table th:first-child {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        
        .rb-comparison-table th:nth-child(2),
        .rb-comparison-table td:nth-child(2) {{
            position: sticky;
            left: 50px;
            background: white;
            z-index: 5;
            text-align: left;
            min-width: 150px;
        }}
        
        .rb-comparison-table th:nth-child(2) {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        
        .rb-comparison-table td {{
            padding: 10px 8px;
            text-align: center;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .rb-comparison-table tr:hover {{
            background: #f5f5f5;
        }}
        
        .rb-comparison-table tr:nth-child(even) {{
            background: #fafafa;
        }}
        
        .rb-comparison-table tr:nth-child(even):hover {{
            background: #f0f0f0;
        }}
        
        .rb-injured {{
            opacity: 0.7;
        }}
        
        .rb-fa {{
            background: #fff9e6 !important;
        }}
        
        .rb-fa:hover {{
            background: #fff3cc !important;
        }}
        
        .player-name {{
            font-weight: 600;
            color: #333;
        }}
        
        .points {{
            font-weight: bold;
            color: #667eea;
        }}
        
        .injury-status {{
            color: #d32f2f;
            font-weight: 600;
        }}
        
        .clickable-rb {{
            cursor: pointer;
            text-decoration: underline;
            color: #667eea !important;
        }}
        
        .clickable-rb:hover {{
            color: #764ba2 !important;
            background: #f0f0f0;
        }}
        
        .clickable-wr {{
            cursor: pointer;
            color: #667eea;
        }}
        
        .clickable-wr:hover {{
            color: #f5576c !important;
            background: #f0f0f0;
        }}
        
        .vulture-modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            overflow: auto;
        }}
        
        .vulture-modal-content {{
            background-color: white;
            margin: 5% auto;
            padding: 0;
            border-radius: 10px;
            width: 90%;
            max-width: 900px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            max-height: 85vh;
            display: flex;
            flex-direction: column;
        }}
        
        .vulture-modal-header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 10px 10px 0 0;
        }}
        
        .vulture-modal-header h2 {{
            margin: 0;
            font-size: 1.5em;
        }}
        
        .vulture-close {{
            color: white;
            font-size: 2em;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
        }}
        
        .vulture-close:hover {{
            opacity: 0.7;
        }}
        
        .vulture-info {{
            padding: 20px 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .vulture-info p {{
            margin: 5px 0;
        }}
        
        .vulture-explanation {{
            font-size: 0.9em;
            color: #666;
            font-style: italic;
        }}
        
        .vulture-table-wrapper {{
            padding: 20px 30px;
            overflow-y: auto;
            flex: 1;
        }}
        
        .vulture-table {{
            width: 100%;
            border-collapse: collapse;
        }}
        
        .vulture-table th {{
            background: #f5f5f5;
            color: #333;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #667eea;
        }}
        
        .vulture-table td {{
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .vulture-table tr:hover {{
            background: #f5f5f5;
        }}
        
        .vulture-pct {{
            font-weight: bold;
            text-align: center;
        }}
        
        .vulture-high {{
            color: #f5576c;
        }}
        
        .vulture-low {{
            color: #4caf50;
        }}
        
        .vulture-positive {{
            background: #fff5f5;
        }}
        
        .vulture-negative {{
            background: #f5fff5;
        }}
        
        .year-stats-content {{
            padding: 30px 40px;
            background: white;
        }}
        
        .stats-header {{
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }}
        
        .stats-header h2 {{
            color: #333;
            font-size: 2.2em;
            margin: 0;
            font-weight: 700;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}
        
        .stats-tabs {{
            display: flex;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-bottom: 2px solid #e9ecef;
            overflow-x: auto;
            padding: 0;
            margin-bottom: 25px;
            border-radius: 8px 8px 0 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            gap: 0;
        }}
        
        .stats-tab-button {{
            background: transparent;
            border: none;
            padding: 16px 24px;
            cursor: pointer;
            font-size: 0.95em;
            font-weight: 600;
            color: #6c757d;
            border-bottom: 3px solid transparent;
            border-right: 1px solid #e9ecef;
            transition: all 0.3s ease;
            white-space: nowrap;
            position: relative;
            min-width: 150px;
            text-align: center;
        }}
        
        .stats-tab-button::after {{
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 3px;
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            transition: all 0.3s ease;
            border-radius: 2px 2px 0 0;
        }}
        
        .stats-tab-button:hover {{
            background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
            color: #4facfe;
            transform: translateY(-1px);
        }}
        
        .stats-tab-button:hover::after {{
            width: 80%;
        }}
        
        .stats-tab-button.active {{
            color: #4facfe;
            background: white;
            box-shadow: 0 -2px 6px rgba(79, 172, 254, 0.1);
        }}
        
        .stats-tab-button.active::after {{
            width: 100%;
        }}
        
        .stats-page {{
            display: none;
        }}
        
        .page-header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        
        .page-header h3 {{
            color: #333;
            font-size: 1.8em;
            margin-bottom: 10px;
        }}
        
        .page-explanation {{
            color: #666;
            font-size: 1em;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.6;
        }}
        
        .stats-table-wrapper {{
            overflow-x: auto;
            margin-top: 20px;
        }}
        
        .stats-table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .stats-table th {{
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 12px;
            text-align: center;
            font-weight: 600;
            font-size: 0.9em;
        }}
        
        .stats-table td {{
            padding: 12px;
            text-align: center;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .stats-table tr:hover {{
            background: #f5f5f5;
        }}
        
        .stats-table tr:nth-child(even) {{
            background: #fafafa;
        }}
        
        .stats-table tr:nth-child(even):hover {{
            background: #f0f0f0;
        }}
        
        .team-name {{
            font-weight: 600;
            color: #333;
            text-align: left !important;
        }}
        
        .fraud-score {{
            font-weight: bold;
            font-size: 1.1em;
        }}
        
        .fraud-high {{
            background: #ffebee !important;
        }}
        
        .fraud-medium {{
            background: #fff3e0 !important;
        }}
        
        .fraud-low {{
            background: #f1f8e9 !important;
        }}
        
        .score-highlight {{
            font-weight: bold;
            font-size: 1.1em;
            color: #4caf50;
        }}
        
        .score-low {{
            font-weight: bold;
            font-size: 1.1em;
            color: #f44336;
        }}
        
        .result-win {{
            color: #4caf50;
            font-weight: bold;
        }}
        
        .result-loss {{
            color: #f44336;
            font-weight: bold;
        }}
        
        .week-link {{
            color: #4facfe;
            text-decoration: none;
            font-weight: 600;
            padding: 5px 10px;
            border-radius: 4px;
            transition: all 0.2s;
        }}
        
        .week-link:hover {{
            background: #e3f2fd;
            text-decoration: underline;
        }}
        
        .teams-container {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }}
        
        .team-box {{
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 20px;
            background: #fafafa;
            transition: all 0.3s;
        }}
        
        .team-box.winner {{
            border-color: #4caf50;
            background: #f1f8f4;
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
        }}
        
        .team-header {{
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #e0e0e0;
        }}
        
        .team-header h3 {{
            font-size: 1.5em;
            color: #333;
            margin-bottom: 5px;
        }}
        
        .owner {{
            color: #666;
            font-size: 0.9em;
            margin-bottom: 10px;
        }}
        
        .score-box {{
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 10px;
        }}
        
        .score {{
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }}
        
        .projected-score {{
            font-size: 1em;
            color: #999;
        }}
        
        .lineup-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        
        .lineup-table th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }}
        
        .lineup-table td {{
            padding: 10px 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        
        .lineup-table tr:hover {{
            background: #f5f5f5;
        }}
        
        .player-playing {{
            background: #e8f5e9;
        }}
        
        .player-pending {{
            background: #fff3e0;
        }}
        
        .player-bye {{
            background: #f5f5f5;
            color: #999;
        }}
        
        .player-bench {{
            background: #f5f5f5 !important;
            color: #999 !important;
            opacity: 0.6;
        }}
        
        .player-bench td {{
            color: #999 !important;
        }}
        
        /* Performance color coding - Green for overperformance */
        .perf-excellent {{
            background: #81c784 !important;  /* Deeper green */
        }}
        
        .perf-great {{
            background: #dcedc8 !important;
        }}
        
        .perf-good {{
            background: #e8f5e9 !important;
        }}
        
        .perf-slight-over {{
            background: #f1f8e9 !important;
        }}
        
        /* Performance color coding - Red for underperformance */
        .perf-slight-under {{
            background: #fff8e1 !important;  /* Lighter orange */
        }}
        
        .perf-bad {{
            background: #ffe0b2 !important;
        }}
        
        .perf-very-bad {{
            background: #ffccbc !important;
        }}
        
        .perf-terrible {{
            background: #e57373 !important;  /* Darker red */
        }}
        
        /* Override bench styling for performance colors */
        .player-bench.perf-excellent,
        .player-bench.perf-great,
        .player-bench.perf-good,
        .player-bench.perf-slight-over,
        .player-bench.perf-slight-under,
        .player-bench.perf-bad,
        .player-bench.perf-very-bad,
        .player-bench.perf-terrible {{
            background: #e0e0e0 !important;
            opacity: 0.5;
        }}
        
        .points {{
            font-weight: bold;
            color: #667eea;
        }}
        
        .projected {{
            color: #999;
        }}
        
        /* Team Pages Styles */
        .team-tabs-wrapper {{
            background: #f8f9fa;
            padding: 15px 30px;
            border-bottom: 2px solid #e0e0e0;
            overflow-x: auto;
        }}
        
        .team-tabs {{
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }}
        
        .team-tab-button {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 25px;
            font-size: 1em;
            font-weight: 600;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }}
        
        .team-tab-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }}
        
        .team-tab-button.active {{
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
        }}
        
        .team-content-wrapper {{
            padding: 30px;
        }}
        
        .team-year-tabs {{
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 15px;
        }}
        
        .year-tab-button {{
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 0.95em;
            font-weight: 600;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(17, 153, 142, 0.3);
        }}
        
        .year-tab-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
        }}
        
        .year-tab-button.active {{
            background: linear-gradient(135deg, #38ef7d 0%, #11998e 100%);
            box-shadow: 0 4px 12px rgba(17, 153, 142, 0.5);
        }}
        
        .team-year-content {{
            display: none;
        }}
        
        .team-year-content-wrapper {{
            min-height: 400px;
        }}
        
        .team-stats-header {{
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }}
        
        .team-stats-header h2 {{
            color: #667eea;
            margin-bottom: 5px;
        }}
        
        .team-owner {{
            color: #666;
            font-size: 1.1em;
        }}
        
        .team-record-info {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }}
        
        .record-box, .playoff-box {{
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }}
        
        .record-box h3, .playoff-box h3 {{
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.2em;
        }}
        
        .record-text {{
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }}
        
        .points-text {{
            color: #666;
            font-size: 1em;
            margin: 5px 0;
        }}
        
        .playoff-text {{
            font-size: 1.5em;
            font-weight: bold;
            color: #4caf50;
        }}
        
        .top-players-section {{
            margin-top: 30px;
        }}
        
        .top-players-section h3 {{
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.3em;
        }}
        
        .top-players-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }}
        
        .player-card {{
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            padding: 20px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .player-card:hover {{
            transform: translateY(-3px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
            border-color: #667eea;
        }}
        
        .player-name {{
            font-size: 1.2em;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 8px;
        }}
        
        .player-position {{
            color: #666;
            font-size: 0.95em;
            margin-bottom: 10px;
        }}
        
        .player-points {{
            font-size: 1.1em;
            font-weight: 600;
            color: #495057;
            margin-bottom: 5px;
        }}
        
        .player-avg {{
            color: #999;
            font-size: 0.9em;
        }}
        
        @media (max-width: 968px) {{
            .teams-container {{
                grid-template-columns: 1fr;
            }}
            
            .header h1 {{
                font-size: 1.8em;
            }}
            
            .team-record-info {{
                grid-template-columns: 1fr;
            }}
            
            .top-players-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{league_2025.settings.name if league_2025 else 'Fantasy League'}</h1>
            <p>All Weeks Matchups</p>
        </div>
        
        <div class="main-navigation">
            <button class="rb-comparison-main-btn" onclick="showRBComparison()" id="rb-comparison-btn">
                <span class="btn-icon">📊</span>
                <span class="btn-text">Running Back Comparison</span>
            </button>
            <button class="rb-comparison-main-btn" onclick="showWRComparison()" id="wr-comparison-btn" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);">
                <span class="btn-icon">🤾</span>
                <span class="btn-text">Wide Receiver Comparison</span>
            </button>
            <button class="rb-comparison-main-btn" onclick="showTotalYearStats()" id="year-stats-btn" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);">
                <span class="btn-icon">📈</span>
                <span class="btn-text">Total Year Stats</span>
            </button>
            <button class="rb-comparison-main-btn" onclick="showTeamPages()" id="team-pages-btn" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); box-shadow: 0 4px 15px rgba(250, 112, 154, 0.3);">
                <span class="btn-icon">👥</span>
                <span class="btn-text">Team Pages</span>
            </button>
        </div>
        
        <div class="year-selector" style="background: #f8f9fa; padding: 15px 30px; border-bottom: 2px solid #e0e0e0; text-align: center;">
            <div style="display: inline-flex; gap: 10px; align-items: center;">
                <span style="font-weight: 600; margin-right: 10px;">Year:</span>
                <button class="rb-comparison-main-btn" onclick="switchYear(2024)" id="year-2024-btn" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); box-shadow: 0 4px 15px rgba(17, 153, 142, 0.3);">
                    <span class="btn-icon">📅</span>
                    <span class="btn-text">2024</span>
                </button>
                <button class="rb-comparison-main-btn" onclick="switchYear(2025)" id="year-2025-btn" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); box-shadow: 0 4px 15px rgba(17, 153, 142, 0.3);">
                    <span class="btn-icon">📅</span>
                    <span class="btn-text">2025</span>
                </button>
            </div>
        </div>
        
        {year_sections_html}
        {shared_content_html}
    </div>
    
    <script>
        function showWeek(week, year) {{
            // Hide RB comparison
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) rbContent.style.display = 'none';
            
            // Hide WR comparison
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) wrContent.style.display = 'none';
            
            // Hide year stats
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) yearStatsContent.style.display = 'none';
            
            // Hide team pages
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) teamPagesContent.style.display = 'none';
            
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Show selected year section
            const selectedYearSection = document.getElementById('year-' + year + '-section');
            if (selectedYearSection) {{
                selectedYearSection.style.display = 'block';
            }}
            
            // Remove active class from RB button
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.remove('active');
            
            // Remove active class from WR button
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.remove('active');
            
            // Remove active class from year stats button
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.remove('active');
            
            // Remove active class from team pages button
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.remove('active');
            
            // Update active year button
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            const selectedYearBtn = document.getElementById('year-' + year + '-btn');
            if (selectedYearBtn) {{
                selectedYearBtn.classList.add('active');
            }}
            
            // Hide all week contents for this year
            const weekContents = selectedYearSection.querySelectorAll('.week-content');
            weekContents.forEach(content => {{
                content.style.display = 'none';
            }});
            
            // Remove active class from all week buttons for this year
            const weekButtons = selectedYearSection.querySelectorAll('.week-button');
            weekButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Show selected week content
            const weekContentId = 'week-' + week + '-' + year + '-content';
            const selectedWeek = document.getElementById(weekContentId);
            if (selectedWeek) {{
                selectedWeek.style.display = 'block';
            }}
            
            // Add active class to clicked week button
            if (event && event.target) {{
                event.target.classList.add('active');
            }}
            
            // Reset to first matchup of the selected week
            const firstMatchup = selectedWeek ? selectedWeek.querySelector('.matchup-tab-button') : null;
            if (firstMatchup) {{
                const matchupIndex = 0;
                showMatchup(week, matchupIndex, year);
                // Set first matchup tab as active
                const matchupButtons = selectedWeek.querySelectorAll('.matchup-tab-button');
                matchupButtons.forEach(btn => btn.classList.remove('active'));
                firstMatchup.classList.add('active');
            }}
        }}
        
        function showRBComparison() {{
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Hide year stats
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) yearStatsContent.style.display = 'none';
            
            // Hide WR comparison
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) wrContent.style.display = 'none';
            
            // Hide team pages
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) teamPagesContent.style.display = 'none';
            
            // Remove active class from all week buttons
            const weekButtons = document.querySelectorAll('.week-button');
            weekButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Remove active from year stats button
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.remove('active');
            
            // Remove active from team pages button
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.remove('active');
            
            // Remove active from WR button
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.remove('active');
            
            // Remove active from year buttons
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            
            // Show RB comparison
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) {{
                rbContent.style.display = 'block';
            }}
            
            // Add active class to RB button
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.add('active');
        }}
        
        function showTotalYearStats() {{
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Hide RB comparison
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) rbContent.style.display = 'none';
            
            // Hide WR comparison
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) wrContent.style.display = 'none';
            
            // Hide team pages
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) teamPagesContent.style.display = 'none';
            
            // Remove active class from all week buttons
            const weekButtons = document.querySelectorAll('.week-button');
            weekButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Remove active from RB button
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.remove('active');
            
            // Remove active from WR button
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.remove('active');
            
            // Remove active from team pages button
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.remove('active');
            
            // Remove active from year buttons
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            
            // Show year stats
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) {{
                yearStatsContent.style.display = 'block';
            }}
            
            // Add active class to year stats button
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.add('active');
        }}
        
        function showStatsPage(pageName) {{
            // Hide all stats pages
            const statsPages = document.querySelectorAll('.stats-page');
            statsPages.forEach(page => {{
                page.style.display = 'none';
            }});
            
            // Remove active class from all stats tab buttons
            const statsTabButtons = document.querySelectorAll('.stats-tab-button');
            statsTabButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Show selected page
            const selectedPage = document.getElementById(pageName + '-page');
            if (selectedPage) {{
                selectedPage.style.display = 'block';
            }}
            
            // Add active class to clicked button
            if (event && event.target) {{
                event.target.classList.add('active');
            }}
        }}
        
        function showMatchup(week, matchupIndex, year) {{
            // Get the year section first
            const yearSection = document.getElementById('year-' + year + '-section');
            if (!yearSection) return;
            
            // Hide all matchup contents for this week
            const weekContentId = 'week-' + week + '-' + year + '-content';
            const weekContent = document.getElementById(weekContentId);
            if (!weekContent) return;
            
            const matchupContents = weekContent.querySelectorAll('.matchup-content');
            matchupContents.forEach(content => {{
                content.style.display = 'none';
            }});
            
            // Remove active class from all matchup buttons for this week
            const matchupButtons = weekContent.querySelectorAll('.matchup-tab-button');
            matchupButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Show selected matchup content
            const matchupId = 'week-' + week + '-' + year + '-matchup-' + matchupIndex;
            const matchupElement = document.getElementById(matchupId);
            if (matchupElement) {{
                matchupElement.style.display = 'block';
            }}
            
            // Add active class to clicked matchup button
            if (event && event.target) {{
                event.target.classList.add('active');
            }}
        }}
        
        function showVulturePercentage(team) {{
            const modal = document.getElementById('vulture-modal-' + team);
            if (modal) {{
                modal.style.display = 'block';
            }}
        }}
        
        function closeVultureModal(team) {{
            const modal = document.getElementById('vulture-modal-' + team);
            if (modal) {{
                modal.style.display = 'none';
            }}
        }}
        
        function showWRComparison() {{
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Hide year stats
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) yearStatsContent.style.display = 'none';
            
            // Hide RB comparison
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) rbContent.style.display = 'none';
            
            // Hide team pages
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) teamPagesContent.style.display = 'none';
            
            // Remove active class from all week buttons
            const weekButtons = document.querySelectorAll('.week-button');
            weekButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Remove active from year stats button
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.remove('active');
            
            // Remove active from team pages button
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.remove('active');
            
            // Remove active from RB button
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.remove('active');
            
            // Remove active from year buttons
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            
            // Show WR comparison
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) {{
                wrContent.style.display = 'block';
            }}
            
            // Add active class to WR button
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.add('active');
        }}
        
        function switchYear(year) {{
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Show selected year section
            const selectedYearSection = document.getElementById('year-' + year + '-section');
            if (selectedYearSection) {{
                selectedYearSection.style.display = 'block';
            }}
            
            // Update active year button
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            const selectedYearBtn = document.getElementById('year-' + year + '-btn');
            if (selectedYearBtn) {{
                selectedYearBtn.classList.add('active');
            }}
            
            // Hide RB comparison, WR comparison, and year stats when switching years
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) rbContent.style.display = 'none';
            
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) wrContent.style.display = 'none';
            
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) yearStatsContent.style.display = 'none';
            
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) teamPagesContent.style.display = 'none';
            
            // Remove active from comparison buttons
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.remove('active');
            
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.remove('active');
            
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.remove('active');
            
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.remove('active');
        }}
        
        function showTeamPages() {{
            // Hide all year sections
            const yearSections = document.querySelectorAll('.year-section');
            yearSections.forEach(section => {{
                section.style.display = 'none';
            }});
            
            // Hide other content
            const rbContent = document.getElementById('rb-comparison-content');
            if (rbContent) rbContent.style.display = 'none';
            
            const wrContent = document.getElementById('wr-comparison-content');
            if (wrContent) wrContent.style.display = 'none';
            
            const yearStatsContent = document.getElementById('total-year-stats-content');
            if (yearStatsContent) yearStatsContent.style.display = 'none';
            
            // Remove active from year buttons
            const yearButtons = document.querySelectorAll('[id^="year-"][id$="-btn"]');
            yearButtons.forEach(btn => {{
                btn.classList.remove('active');
            }});
            
            // Remove active from all week buttons
            const weekButtons = document.querySelectorAll('.week-button');
            weekButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Remove active from other buttons
            const rbButton = document.getElementById('rb-comparison-btn');
            if (rbButton) rbButton.classList.remove('active');
            
            const wrButton = document.getElementById('wr-comparison-btn');
            if (wrButton) wrButton.classList.remove('active');
            
            const yearStatsBtn = document.getElementById('year-stats-btn');
            if (yearStatsBtn) yearStatsBtn.classList.remove('active');
            
            // Show team pages
            const teamPagesContent = document.getElementById('team-pages-content');
            if (teamPagesContent) {{
                teamPagesContent.style.display = 'block';
                
                // Show first team by default
                const firstTeamContent = teamPagesContent.querySelector('.team-content');
                if (firstTeamContent) {{
                    firstTeamContent.style.display = 'block';
                    const firstTeamTab = document.querySelector('.team-tab-button');
                    if (firstTeamTab) {{
                        firstTeamTab.classList.add('active');
                    }}
                    // Show 2025 year for first team
                    const firstTeamId = firstTeamContent.id.replace('team-', '').replace('-content', '');
                    showTeamYear(parseInt(firstTeamId), 2025);
                }}
            }}
            
            // Add active to team pages button
            const teamPagesBtn = document.getElementById('team-pages-btn');
            if (teamPagesBtn) teamPagesBtn.classList.add('active');
        }}
        
        function showTeam(teamId) {{
            // Hide all team contents
            const teamContents = document.querySelectorAll('.team-content');
            teamContents.forEach(content => {{
                content.style.display = 'none';
            }});
            
            // Remove active from all team tab buttons
            const teamTabButtons = document.querySelectorAll('.team-tab-button');
            teamTabButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Show selected team content
            const selectedTeamContent = document.getElementById('team-' + teamId + '-content');
            if (selectedTeamContent) {{
                selectedTeamContent.style.display = 'block';
            }}
            
            // Add active to clicked team tab button
            const teamTabBtn = document.getElementById('team-tab-' + teamId);
            if (teamTabBtn) {{
                teamTabBtn.classList.add('active');
            }}
            
            // Show 2025 year by default for this team
            showTeamYear(teamId, 2025);
        }}
        
        function showTeamYear(teamId, year) {{
            // Hide all year contents for this team
            const teamContent = document.getElementById('team-' + teamId + '-content');
            if (!teamContent) return;
            
            const yearContents = teamContent.querySelectorAll('.team-year-content');
            yearContents.forEach(content => {{
                content.style.display = 'none';
            }});
            
            // Remove active from all year tab buttons for this team
            const yearTabButtons = teamContent.querySelectorAll('.year-tab-button');
            yearTabButtons.forEach(button => {{
                button.classList.remove('active');
            }});
            
            // Show selected year content
            const selectedYearContent = document.getElementById('team-' + teamId + '-year-' + year + '-content');
            if (selectedYearContent) {{
                selectedYearContent.style.display = 'block';
            }}
            
            // Add active to clicked year tab button
            const yearTabBtn = document.getElementById('team-' + teamId + '-year-' + year + '-tab');
            if (yearTabBtn) {{
                yearTabBtn.classList.add('active');
            }}
        }}
        
        function showWRTargetsPercentage(team) {{
            const modal = document.getElementById('wr-targets-modal-' + team);
            if (modal) {{
                modal.style.display = 'block';
            }}
        }}
        
        function closeWRTargetsModal(team) {{
            const modal = document.getElementById('wr-targets-modal-' + team);
            if (modal) {{
                modal.style.display = 'none';
            }}
        }}
        
        // Close modal when clicking outside of it
        window.onclick = function(event) {{
            if (event.target.classList.contains('vulture-modal')) {{
                event.target.style.display = 'none';
            }}
            if (event.target.id && event.target.id.startsWith('wr-targets-modal-')) {{
                event.target.style.display = 'none';
            }}
        }}
        
        // Set current week as active on load and activate 2025 year button
        document.addEventListener('DOMContentLoaded', function() {{
            // Activate 2025 year button by default
            const year2025Btn = document.getElementById('year-2025-btn');
            if (year2025Btn) {{
                year2025Btn.classList.add('active');
            }}
            
            // Set current week as active in the visible year section
            const year2025Section = document.getElementById('year-2025-section');
            if (year2025Section) {{
                const currentWeekButton = year2025Section.querySelector('.week-button[data-current="true"]');
                if (currentWeekButton) {{
                    currentWeekButton.classList.add('active');
                    const week = currentWeekButton.textContent.replace('Week ', '');
                    const firstMatchup = year2025Section.querySelector('#week-' + week + '-2025-content .matchup-tab-button');
                    if (firstMatchup) {{
                        firstMatchup.classList.add('active');
                        const matchupIndex = 0;
                        showMatchup(parseInt(week), matchupIndex, 2025);
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>"""
    
    return html_content

def main():
    try:
        year_sections_html = ""
        league_2025 = None
        league_2024 = None
        all_weeks_data_2025 = None
        rbs_2025 = None
        wrs_2025 = None
        
        # Fetch data for both 2024 and 2025
        for year in [2025, 2024]:
            print(f"\n{'='*60}")
            print(f"Processing Year {year}")
            print(f"{'='*60}")
            
            try:
                print("Connecting to league...")
                league = League(league_id=LEAGUE_ID, year=year, espn_s2=ESPN_S2, swid=SWID)
                
                if year == 2025:
                    league_2025 = league
                elif year == 2024:
                    league_2024 = league
                
                current_week = league.current_week
                print(f"Current week: {current_week}")
                print(f"Fetching matchups for all weeks (1-{current_week})...")
                
                # Fetch all weeks' matchups
                all_weeks_data = {}
                for week in range(1, current_week + 1):
                    try:
                        print(f"  Fetching Week {week}...", end=" ")
                        box_scores = league.box_scores(week=week)
                        all_weeks_data[week] = box_scores
                        print(f"OK ({len(box_scores)} matchups)")
                    except Exception as e:
                        print(f"Error: {e}")
                        # Continue with other weeks even if one fails
                        continue
                
                if year == 2025:
                    all_weeks_data_2025 = all_weeks_data
                
                print("Generating HTML for year...")
                year_section_html = generate_html(league, all_weeks_data, current_week, None, None, year)
                year_sections_html += year_section_html
                
                print(f"✓ Year {year} HTML generated")
                
            except Exception as e:
                print(f"Error processing year {year}: {e}")
                import traceback
                traceback.print_exc()
                # Continue with other year even if one fails
                continue
        
        # Collect RB and WR data for 2025 only (for comparison pages)
        if league_2025:
            print("\nCollecting running backs for 2025...")
            rbs_2025 = collect_running_backs(league_2025)
            print(f"  Found {len(rbs_2025)} running backs")
            
            print("Collecting wide receivers for 2025...")
            wrs_2025 = collect_wide_receivers(league_2025)
            print(f"  Found {len(wrs_2025)} wide receivers")
            
            # Collect team data for both years
            print("\nCollecting team data for 2024...")
            teams_2024_data = get_team_year_stats(league_2024) if league_2024 else []
            print(f"  Found {len(teams_2024_data)} teams for 2024")
            
            print("Collecting team data for 2025...")
            teams_2025_data = get_team_year_stats(league_2025) if league_2025 else []
            print(f"  Found {len(teams_2025_data)} teams for 2025")
            
            print("Generating shared content (RB/WR comparisons, stats, team pages)...")
            shared_content_html = generate_shared_content_html(rbs_2025, wrs_2025, league_2025, all_weeks_data_2025, teams_2024_data, teams_2025_data)
        else:
            print("Warning: Could not get 2025 league data for comparisons")
            shared_content_html = ""
        
        print("\nGenerating full HTML...")
        html_content = generate_full_html(year_sections_html, shared_content_html, league_2025)
        
        filename = "index.html"
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f"\n{'='*60}")
        print(f"Success! HTML file created: {filename}")
        print(f"Open {filename} in your browser to view all weeks' matchups.")
        print(f"Use the year and week buttons to navigate.")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

