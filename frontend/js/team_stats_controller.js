app.controller('teamStatsController', function($scope, $http, $routeParams, svc) {

    $scope.svc = svc;
    var ctrl = this;
    $scope.season = $routeParams.season;
    // setting default table selection and sort keys and criteria/order
    $scope.tableSelect = 'standings';
    $scope.seasonTypeSelect = 'RS'
    $scope.isStandingsView = true;
    $scope.isAttendanceView = false;
    $scope.sort_def = {
        // standings
        "points": ['points', 'score_diff', 'score'],
        "games_played": ['games_played', '-team'],
        // goal stats
        "goals_diff": ['goals_diff', 'goals'],
        "goals_diff_1": ['goals_diff_1', 'goals_1'],
        "goals_diff_2": ['goals_diff_2', 'goals_2'],
        "goals_diff_3": ['goals_diff_3', 'goals_3'],
        "goals_1": ['goals_1', 'goals_diff_1'],
        "goals_2": ['goals_2', 'goals_diff_2'],
        "goals_3": ['goals_3', 'goals_diff_3'],
        "opp_goals_1": ['opp_goals_1', '-goals_diff_1'],
        "opp_goals_2": ['opp_goals_2', '-goals_diff_2'],
        "opp_goals_3": ['opp_goals_3', '-goals_diff_3'],
        // shots
        "opp_shots_on_goal": ['opp_shots_on_goal', 'games_played'],
        "opp_shots": ['opp_shots', 'games_played'],
        "shots_on_goal": ['shots_on_goal', 'goals', 'games_played'],
        "shots": ['shots', 'games_played'],
        "faceoff_pctg": ['faceoff_pctg', 'faceoffs'],
        // special team stats
        "pp_pctg": ['pp_pctg', '-pp_opps'],
        "pp_goals": ['pp_goals', 'pp_pctg'],
        "sh_goals": ['sh_goals', '-sh_opps'],
        "opp_pp_goals": ['opp_pp_goals', '-pk_pctg'],
        "opp_sh_goals": ['opp_sh_goals', '-sh_opps'],
        // shot shares
        "corsi_for_pctg": ['corsi_for_pctg', 'shots'],
        "shots_on_goal_5v5": ['shots_on_goal_5v5', 'goals_5v5', '-games_played'],
        "goals_diff": ['goals_diff', 'goals', '-games_played'],
        "pt_pctg": ['pt_pctg', 'points', 'goals_diff', '-games_played']
    };
    $scope.sortConfig = {
        'sortKey': 'points',
        'sortCriteria': ['points', 'score_diff', 'score'],
        'sortDescending': true
    }

    // retrieving column headers (and abbreviations + explanations)
    $http.get('./js/team_stats_columns.json').then(function (res) {
        $scope.stats_cols = res.data;
    });
    // retrieving teams
    $http.get('./js/teams.json').then(function (res) {
        $scope.teams = res.data;
        // creating lookup structures...
        // ...for team locations
        $scope.team_location_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.location}), {});
        // ...for playoff participation indicator
        $scope.team_playoff_lookup = $scope.teams.reduce((o, key) => Object.assign(o, {[key.abbr]: key.po}), {});
    });
 
    // starting to watch filter selection lists
    // from date filter
    $scope.$watch('ctrl.fromDate', function() {
        if ($scope.team_stats) {
            $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
        }
    }, true);

    // to date filter
    $scope.$watch('ctrl.toDate', function() {
        if ($scope.team_stats) {
            $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
        }
    }, true);

    // situation filter, i.e. leading after 20, 40, etc.
    $scope.$watch('situationSelect', function() {
        if ($scope.team_stats) {
            $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
        }
    }, true);

    // home/road filter
    $scope.$watch('homeAwaySelect', function() {
        if ($scope.team_stats) {
            $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
        }
    }, true);

    // regular season/playoff filter
    $scope.$watch('seasonTypeSelect', function() {
        if ($scope.team_stats) {
            $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
        }
    }, true);

    // loading stats from external json file
    $http.get('data/' + $scope.season + '/del_team_game_stats.json').then(function (res) {
        $scope.last_modified = res.data[0];
        $scope.team_stats = res.data[1];
        $scope.filtered_team_stats = $scope.filterStats($scope.team_stats);
    });

    // setting average attendance for previous season
    // TODO: move to external file (arenas.json?)
    $scope.avg_attendance_last_season = {
        'EBB': 12026, 'KEC': 11573, 'MAN': 11422, 'DEG': 8531, 'AEV': 5481,
        'NIT': 5163, 'RBM': 4819, 'KEV': 4814, 'BHV': 4438, 'IEC': 4344,
        'STR': 4129, 'ING': 3883, 'SWW': 3576, 'WOB': 2815
    }

    // TODO: move to out-of-controller location
    $scope.filterStats = function (stats) {
        filtered_team_stats = {};
        if ($scope.team_stats === undefined)
            return filtered_team_stats;
        $scope.team_stats.forEach(element => {
            team = element['team'];
            if (!filtered_team_stats[team]) {
                // leaving out non-playoff teams in playoff standings
                if ($scope.seasonTypeSelect != 'PO' || $scope.team_playoff_lookup[team]) {
                    filtered_team_stats[team] = {};
                    filtered_team_stats[team]['team'] = team;
                    $scope.svc.stats_to_aggregate().forEach(category => {
                        filtered_team_stats[team][category] = 0;
                    });
                }
            }
            // determining for each team game element whether it will be
            // included (is_filtered = true) in display or not (is_filtered =
            // false)
            // element not included per default
            var is_filtered = false;
            // retrieving game date as moment structure
            date_to_test = moment(element.game_date);
            // if both a start and end date for a range have been set
            if (ctrl.fromDate && ctrl.toDate) {
                // checking if game date is located within selected time range
                if ((date_to_test >= ctrl.fromDate.startOf('day')) && (date_to_test <= ctrl.toDate.startOf('day'))) {
                    // checking additional filters
                    // if each home/road-game filter, game-situation filterm and season-type filter have been activated
                    if ($scope.homeAwaySelect && $scope.situationSelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    // if home/road-game filter and game-situation filter have been activated
                    else if ($scope.homeAwaySelect && $scope.situationSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    // if game-situation filter and season-type filter have been activated
                    else if ($scope.situationSelect && $scope.seasonTypeSelect) {
                        if (element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    // if home/road-game filter and season-type filter have been activated
                    else if ($scope.homeAwaySelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    // if only situation-type filter has been activated
                    else if ($scope.situationSelect) {
                        if (element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    // if only home/road-game filter has been activated
                    else if ($scope.homeAwaySelect) {
                        if ($scope.homeAwaySelect === element.home_road)
                            is_filtered = true;
                    }
                    // if only season-type filter has been activated
                    else if ($scope.seasonTypeSelect) {
                        if ($scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else {
                        is_filtered = true;
                    }
                }
            // if only a start date for a range has been set
            } else if (ctrl.fromDate) {
                // checking if game date is located within selected time range
                if (date_to_test >= ctrl.fromDate.startOf('day')) {
                    if ($scope.homeAwaySelect && $scope.situationSelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect && $scope.situationSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    else if ($scope.situationSelect && $scope.seasonTypeSelect) {
                        if (element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.situationSelect) {
                        if (element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect) {
                        if ($scope.homeAwaySelect === element.home_road)
                            is_filtered = true;
                    }
                    else if ($scope.seasonTypeSelect) {
                        if ($scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else {
                        is_filtered = true;
                    }
                }
            // if only an end date for a range has been set
            } else if (ctrl.toDate) {
                // checking if game date is located within selected time range
                if (date_to_test <= ctrl.toDate.startOf('day')) {
                    if ($scope.homeAwaySelect && $scope.situationSelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect && $scope.situationSelect) {
                        if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    else if ($scope.situationSelect && $scope.seasonTypeSelect) {
                        if (element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect && $scope.seasonTypeSelect) {
                        if ($scope.homeAwaySelect === element.home_road && $scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else if ($scope.situationSelect) {
                        if (element[$scope.situationSelect])
                            is_filtered = true;
                    }
                    else if ($scope.homeAwaySelect) {
                        if ($scope.homeAwaySelect === element.home_road)
                            is_filtered = true;
                    }
                    else if ($scope.seasonTypeSelect) {
                        if ($scope.seasonTypeSelect === element.season_type)
                            is_filtered = true;
                    }
                    else {
                        is_filtered = true;
                    }
                }
            } else {
                if ($scope.homeAwaySelect && $scope.situationSelect && $scope.seasonTypeSelect) {
                    if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                        is_filtered = true;
                }
                else if ($scope.homeAwaySelect && $scope.situationSelect) {
                    if ($scope.homeAwaySelect === element.home_road && element[$scope.situationSelect])
                        is_filtered = true;
                }
                else if ($scope.situationSelect && $scope.seasonTypeSelect) {
                    if (element[$scope.situationSelect] && $scope.seasonTypeSelect === element.season_type)
                        is_filtered = true;
                }
                else if ($scope.homeAwaySelect && $scope.seasonTypeSelect) {
                    if ($scope.homeAwaySelect === element.home_road && $scope.seasonTypeSelect === element.season_type)
                        is_filtered = true;
                }
                else if ($scope.situationSelect) {
                    if (element[$scope.situationSelect])
                        is_filtered = true;
                }
                else if ($scope.homeAwaySelect) {
                    if ($scope.homeAwaySelect === element.home_road)
                        is_filtered = true;
                }
                else if ($scope.seasonTypeSelect) {
                    if ($scope.seasonTypeSelect === element.season_type)
                        is_filtered = true;
                }
                else {
                    is_filtered = true;
                }
        }
            if (is_filtered) {
                $scope.svc.stats_to_aggregate().forEach(category => {
                    filtered_team_stats[team][category] += element[category];
                })
            }
        });
        filtered_team_stats = Object.values(filtered_team_stats);

        filtered_team_stats.forEach(element => {
            // calculating score and goal differentials
            element['score_diff'] = element['score'] - element['opp_score'];
            element['goals_diff'] = element['goals'] - element['opp_goals'];
            element['goals_diff_1'] = element['goals_1'] - element['opp_goals_1'];
            element['goals_diff_2'] = element['goals_2'] - element['opp_goals_2'];
            element['goals_diff_3'] = element['goals_3'] - element['opp_goals_3'];
            // calculating points percentage
            if (element['games_played']) {
                element['pt_pctg'] = parseFloat((element['points'] / (element['games_played'] * 3.) * 100).toFixed(2));
            } else {
                element['pt_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating shot zone percentages
            if (element['shots']) {
                element['sl_p'] = parseFloat(((element['sl_sh'] / element['shots']) * 100).toFixed(2));
                element['lf_p'] = parseFloat(((element['lf_sh'] / element['shots']) * 100).toFixed(2));
                element['rg_p'] = parseFloat(((element['rg_sh'] / element['shots']) * 100).toFixed(2));
                element['bl_p'] = parseFloat(((element['bl_sh'] / element['shots']) * 100).toFixed(2));
            } else {
                element['sl_p'] = parseFloat((0).toFixed(2));
                element['lf_p'] = parseFloat((0).toFixed(2));
                element['rg_p'] = parseFloat((0).toFixed(2));
                element['bl_p'] = parseFloat((0).toFixed(2));
            }
            // calculating zone percentages for shots against
            if (element['opp_shots']) {
                element['sl_p_a'] = parseFloat(((element['sl_sh_a'] / element['opp_shots']) * 100).toFixed(2));
                element['lf_p_a'] = parseFloat(((element['lf_sh_a'] / element['opp_shots']) * 100).toFixed(2));
                element['rg_p_a'] = parseFloat(((element['rg_sh_a'] / element['opp_shots']) * 100).toFixed(2));
                element['bl_p_a'] = parseFloat(((element['bl_sh_a'] / element['opp_shots']) * 100).toFixed(2));
            } else {
                element['sl_p_a'] = parseFloat((0).toFixed(2));
                element['lf_p_a'] = parseFloat((0).toFixed(2));
                element['rg_p_a'] = parseFloat((0).toFixed(2));
                element['bl_p_a'] = parseFloat((0).toFixed(2));
            }
            // calculating shooting, save and zone percentages for shots on goal
            if (element['shots_on_goal']) {
                element['shot_pctg'] = parseFloat(((element['goals'] / element['shots_on_goal']) * 100).toFixed(2));
                element['opp_save_pctg'] = parseFloat(((element['opp_saves'] / element['shots_on_goal']) * 100).toFixed(2));
                element['sl_og_p'] = parseFloat(((element['sl_og'] / element['shots_on_goal']) * 100).toFixed(2));
                element['lf_og_p'] = parseFloat(((element['lf_og'] / element['shots_on_goal']) * 100).toFixed(2));
                element['rg_og_p'] = parseFloat(((element['rg_og'] / element['shots_on_goal']) * 100).toFixed(2));
                element['bl_og_p'] = parseFloat(((element['bl_og'] / element['shots_on_goal']) * 100).toFixed(2));
            } else {
                element['shot_pct'] = parseFloat((0).toFixed(2));
                element['opp_save_pct'] = parseFloat((0).toFixed(2));
                element['sl_og_p'] = parseFloat((0).toFixed(2));
                element['lf_og_p'] = parseFloat((0).toFixed(2));
                element['rg_og_p'] = parseFloat((0).toFixed(2));
                element['bl_og_p'] = parseFloat((0).toFixed(2));
            }
            // calculating shooting and save percentages for shots on goal in 5-on-5 play
            if (element['shots_on_goal_5v5']) {
                element['shot_pctg_5v5'] = parseFloat(((element['goals_5v5'] / element['shots_on_goal_5v5']) * 100).toFixed(2));
                element['opp_save_pctg_5v5'] = parseFloat((((element['shots_on_goal_5v5'] - element['goals_5v5']) / element['shots_on_goal_5v5']) * 100).toFixed(2));
            } else {
                element['shot_pct_5v5'] = parseFloat((0).toFixed(2));
                element['opp_save_pct_5v5'] = parseFloat((0).toFixed(2));
            }
            // calculating opponent shooting, save and zone percentages for shots on goal against
            if (element['opp_shots_on_goal']) {
                element['opp_shot_pctg'] = parseFloat(((element['opp_goals'] / element['opp_shots_on_goal']) * 100).toFixed(2));
                element['save_pctg'] = parseFloat(((element['saves'] / element['opp_shots_on_goal']) * 100).toFixed(2));
                element['sl_og_p_a'] = parseFloat(((element['sl_og_a'] / element['opp_shots_on_goal']) * 100).toFixed(2));
                element['lf_og_p_a'] = parseFloat(((element['lf_og_a'] / element['opp_shots_on_goal']) * 100).toFixed(2));
                element['rg_og_p_a'] = parseFloat(((element['rg_og_a'] / element['opp_shots_on_goal']) * 100).toFixed(2));
                element['bl_og_p_a'] = parseFloat(((element['bl_og_a'] / element['opp_shots_on_goal']) * 100).toFixed(2));
            } else {
                element['opp_shot_pct'] = parseFloat((0).toFixed(2));
                element['save_pct'] = parseFloat((0).toFixed(2));
                element['sl_og_p_a'] = parseFloat((0).toFixed(2));
                element['lf_og_p_a'] = parseFloat((0).toFixed(2));
                element['rg_og_p_a'] = parseFloat((0).toFixed(2));
                element['bl_og_p_a'] = parseFloat((0).toFixed(2));
            }
            // calculating opponent shooting and save percentages for shots on goal against in 5-on-5 play
            if (element['opp_shots_on_goal_5v5']) {
                element['opp_shot_pctg_5v5'] = parseFloat(((element['opp_goals_5v5'] / element['opp_shots_on_goal_5v5']) * 100).toFixed(2));
                element['save_pctg_5v5'] = parseFloat((((element['opp_shots_on_goal_5v5'] - element['opp_goals_5v5']) / element['opp_shots_on_goal_5v5']) * 100).toFixed(2));
            } else {
                element['opp_shot_pct_5v5'] = parseFloat((0).toFixed(2));
                element['save_pct_5v5'] = parseFloat((0).toFixed(2));
            }
            // calculating PDO
            element['pdo'] = parseFloat((parseFloat(element['shot_pctg']) + parseFloat(element['save_pctg'])).toFixed(2));
            element['opp_pdo'] = parseFloat((parseFloat(element['opp_shot_pctg']) + parseFloat(element['opp_save_pctg'])).toFixed(2));
            // calculating PDO in 5-on-5 play
            element['pdo_5v5'] = parseFloat((parseFloat(element['shot_pctg_5v5']) + parseFloat(element['save_pctg_5v5'])).toFixed(2));
            element['opp_pdo_5v5'] = parseFloat((parseFloat(element['opp_shot_pctg_5v5']) + parseFloat(element['opp_save_pctg_5v5'])).toFixed(2));
            // calculating shots on goal for percentage
            if (element['shots_on_goal'] + element['opp_shots_on_goal']) {
                element['shot_for_pctg'] = parseFloat((element['shots_on_goal'] / (element['shots_on_goal'] + element['opp_shots_on_goal']) * 100).toFixed(2));
                element['opp_shot_for_pctg'] = parseFloat((element['opp_shots_on_goal'] / (element['shots_on_goal'] + element['opp_shots_on_goal']) * 100).toFixed(2));
            } else {
                element['shot_for_pctg'] = parseFloat((0).toFixed(2));
                element['opp_shot_for_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating unblocked shots (i.e. Fenwick) for percentage
            element['fenwick_events'] = element['shots_on_goal'] + element['shots_missed']; 
            element['opp_fenwick_events'] = element['opp_shots_on_goal'] + element['opp_shots_missed']; 
            if (element['fenwick_events'] + element['opp_fenwick_events']) {
                element['fenwick_for_pctg'] = parseFloat(((element['fenwick_events']) / (element['fenwick_events' ]+ element['opp_fenwick_events']) * 100).toFixed(2));
                element['opp_fenwick_for_pctg'] = parseFloat(((element['opp_fenwick_events']) / (element['fenwick_events' ]+ element['opp_fenwick_events']) * 100).toFixed(2));
            } else {
                element['fenwick_for_pctg'] = parseFloat((0).toFixed(2));
                element['opp_fenwick_for_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating shots (i.e. Corsi) for percentage
            if (element['shots'] + element['opp_shots']) {
                element['corsi_for_pctg'] = parseFloat((element['shots'] / (element['shots'] + element['opp_shots']) * 100).toFixed(2));
                element['opp_corsi_for_pctg'] = parseFloat((element['opp_shots'] / (element['shots'] + element['opp_shots']) * 100).toFixed(2));
            } else {
                element['corsi_for_pctg'] = parseFloat((0).toFixed(2));
                element['opp_corsi_for_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating power play percentage
            if (element['pp_opps']) {
                element['pp_pctg'] = parseFloat(((element['pp_goals'] / element['pp_opps']) * 100).toFixed(2));
            } else {
                element['pp_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating penalty killing percentage
            if (element['sh_opps']) {
                element['pk_pctg'] = parseFloat((100 - (element['opp_pp_goals'] / element['sh_opps']) * 100).toFixed(2));
            } else {
                element['pk_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating special teams goal differential and combined special team percentages
            element['pp_pk_gdiff'] = element['pp_goals'] + element['sh_goals'] - element['opp_pp_goals'] - element['opp_sh_goals'];
            element['pp_pk_comb_pctg'] = element['pp_pctg'] + element['pk_pctg'];
            // calculating team faceoff percentage
            if (element['faceoffs']) {
                element['faceoff_pctg'] = parseFloat(((element['faceoffs_won'] / element['faceoffs']) * 100).toFixed(2));
            } else {
                element['faceoff_pctg'] = parseFloat((0).toFixed(2));
            }
            // calculating team penalty minutes per game
            if (element['games_played']) {
                element['pim_per_game'] = parseFloat((element['pim'] / element['games_played']).toFixed(2));
            } else {
                element['pim_per_game'] = parseFloat((0).toFixed(2));
            }
            // calculating average attendance
            if (element['games_played']) {
                element['avg_attendance'] = parseFloat((element['attendance'] / element['games_played']).toFixed(0));
            } else {
                element['avg_attendance'] = 0;
            }
            // retrieving last year's average attendance
            element['avg_attendance_last_season'] = $scope.avg_attendance_last_season[element['team']];
            element['avg_attendance_delta'] = element['avg_attendance'] - element['avg_attendance_last_season']; 
            // calculating utilized attendance capacity
            if (element['capacity']) {
                element['util_capacity_pctg'] = parseFloat(((element['attendance'] / element['capacity']) * 100).toFixed(2));
            } else {
                element['util_capacity_pctg'] = parseFloat((0).toFixed(2));
            }
        });
        
        return filtered_team_stats;
    };

    // event function to call after table change
    $scope.changeTable = function () {
        if ($scope.tableSelect === 'standings') {
            if ($scope.situationSelect) {
                $scope.sortConfig = {
                    'sortKey': 'pt_pctg',
                    'sortCriteria': ['pt_pctg', 'points', 'goals_diff'],
                    'sortDescending': true
                }
            } else {
                $scope.sortConfig = {
                    'sortKey': 'points',
                    'sortCriteria': ['points', 'score_diff', 'score'],
                    'sortDescending': true
                }
            }
            $scope.isStandingsView = true;
            $scope.isAttendanceView = false;
        } else if ($scope.tableSelect === 'goal_stats') {
            $scope.sortConfig = {
                'sortKey': 'goals_diff',
                'sortCriteria': ['goals_diff', 'goals'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_stats') {
            $scope.sortConfig = {
                'sortKey': 'shots_on_goal',
                'sortCriteria': ['shots_on_goal', 'goals'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_stats_5v5') {
            $scope.sortConfig = {
                'sortKey': 'shots_on_goal_5v5',
                'sortCriteria': ['shots_on_goal_5v5', 'goals_5v5'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_shares') {
            $scope.sortConfig = {
                'sortKey': 'corsi_for_pctg',
                'sortCriteria': ['corsi_for_pctg', 'shots'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'attendance_stats') {
            $scope.sortConfig = {
                'sortKey': 'util_capacity_pctg',
                'sortCriteria': ['util_capacity_pctg', 'attendance'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = true;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'special_team_stats') {
            $scope.sortConfig = {
                'sortKey': 'pp_pctg',
                'sortCriteria': ['pp_pctg', '-pp_opps'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'additional_stats') {
            $scope.sortConfig = {
                'sortKey': 'faceoff_pctg',
                'sortCriteria': ['faceoff_pctg', 'faceoffs'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'penalty_stats') {
            $scope.sortConfig = {
                'sortKey': 'pim_per_game',
                'sortCriteria': ['pim_per_game', 'penalties'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_zones') {
            $scope.sortConfig = {
                'sortKey': 'shots',
                'sortCriteria': ['shots'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_on_goal_zones') {
            $scope.sortConfig = {
                'sortKey': 'shots_on_goal',
                'sortCriteria': ['shots_on_goal'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_zones_against') {
            $scope.sortConfig = {
                'sortKey': 'opp_shots',
                'sortCriteria': ['opp_shots'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        } else if ($scope.tableSelect === 'shot_on_goal_zones_against') {
            $scope.sortConfig = {
                'sortKey': 'opp_shots_on_goal',
                'sortCriteria': ['opp_shots_on_goal'],
                'sortDescending': true
            }
            $scope.isStandingsView = false;
            $scope.isAttendanceView = false;
            $scope.situationSelect = undefined;
        }
    };

    $scope.setSortOrder = function(sortKey, oldSortConfig) {
        ascendingAttrs = ['team'];
        // if previous sort key equals the new one
        if (oldSortConfig['sortKey'] == sortKey) {
            // just change sort direction
            return {
                'sortKey': oldSortConfig['sortKey'],
                'sortCriteria': oldSortConfig['sortCriteria'],
                'sortDescending': !oldSortConfig['sortDescending']
            }
        } else {
            // ascending sort order for a few columns
            if (ascendingAttrs.indexOf(sortKey) !== -1) {
                sort_descending = false;
            // otherwise descending sort order
            } else {
                sort_descending = true;
            }
            // retrieving actual (and minor) sort criteria from scope-wide
            // definition of sort criteria
            // use plain sort key if nothing has been defined otherwise
            sort_criteria = $scope.sort_def[sortKey] || sortKey;
            return {
                'sortKey': sortKey,
                'sortCriteria': sort_criteria,
                'sortDescending': sort_descending
            }
        }
    }

});
