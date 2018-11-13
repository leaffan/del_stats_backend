var app = angular.module('delStatsApp', ['ngRoute', 'moment-picker'])

app.config(['$routeProvider', function($routeProvider){
    $routeProvider
        .when('/home', {
            templateUrl: 'home.html',
        })
        .when('/del_stats', {
            templateUrl: 'stats.html',
            controller: 'mainController'
        })
        .when('/player_profile/:team/:player_id',
        {
            templateUrl: 'player_profile.html',
            controller: 'plrController as ctrl'
        })
        .otherwise({
            redirectTo: '/del_stats'
        })
}]);

app.config(['momentPickerProvider', function(momentPickerProvider){
    momentPickerProvider.options({
        locale: 'de',
        format: 'L LTS',
        minView: 'decade',
        maxView: 'day',
        startView: 'month',
        autoclose: true
    })
}]);

app.controller('plrController', function($scope, $http, $routeParams) {

    var ctrl = this;

    $scope.tableSelect = 'basic_game_by_game';
    $scope.sortCriterion = 'date';

    // setting column sort order according to current and new sort criteria, and current sort order 
    $scope.setSortOrder = function (sortCriterion, oldSortCriterion, oldStatsSortDescending) {
        // if current criterion equals the new one
        if (oldSortCriterion === sortCriterion) {
            // just change sort direction
            return !oldStatsSortDescending;
        } else {
            // ascending for a few columns
            if ([
                    'goals', 'assists', 'shots_on_goal', 'points',
                    'shots_on_goal', 'shots_missed', 'shots_blocked',
                    'time_on_ice', 'shifts', 'pp_goals', 'sh_goals',
                    'time_on_ice_pp', 'time_on_ice_sh', 'pim', 'plus_minus'
                ].indexOf(sortCriterion) !== -1) {
                return true;
            } else {
                // otherwise descending sort order
                return false;
            }
        }
    };


    // loading stats from external json file
    $http.get('data/per_player/' + $routeParams.team + '_' + $routeParams.player_id + '.json').then(function (res) {
        $scope.player_stats = res.data;
        $scope.player_name = res.data[0].full_name;
    });


    $scope.model = {
        team: $routeParams.team,
        player_id: $routeParams.player_id,
        teams: {
            'AEV': 'augsburger-panther', 'KEC': 'koelner-haie',
            'RBM': 'ehc-red-bull-muenchen', 'IEC': 'iserlohn-roosters',
            'DEG': 'duesseldorfer-eg', 'SWW': 'schwenninger-wild-wings',
            'KEV': 'krefeld-pinguine', 'ING': 'erc-ingolstadt',
            'MAN': 'adler-mannheim', 'STR': 'straubing-tigers',
            'EBB': 'eisbaeren-berlin', 'NIT': 'thomas-sabo-ice-tigers',
            'WOB': 'grizzlys-wolfsburg', 'BHV': 'pinguins-bremerhaven'
        },
        countries: {
            'GER': 'de', 'CAN': 'ca', 'SWE': 'se', 'USA': 'us', 'FIN': 'fi',
            'ITA': 'it', 'NOR': 'no', 'FRA': 'fr', 'LVA': 'lv', 'SVK': 'sk',
            'DNK': 'dk', 'RUS': 'ru', 'SVN': 'si', 'HUN': 'hu', 'SLO': 'si',
        }
    }

    $scope.getTotal = function(attribute) {
        if ($scope.player_stats === undefined) {
            return;
        }
        var total = 0;
        for(var i = 0; i < $scope.player_stats.length; i++){
            total += $scope.player_stats[i][attribute];
        }
        return total;
    }

    $scope.getFilteredTotal = function(list, attribute) {
        if ($scope.player_stats === undefined) {
            return;
        }
        var total = 0;
        for(var i = 0; i < list.length; i++){
            total += list[i][attribute];
        }
        return total;
    }

    $scope.formatTime = function(time_on_ice) {
        return Math.floor(time_on_ice / 60) + ":" + ('00' + (time_on_ice % 60)).slice(-2)
    }


    $scope.dayFilter = function (a) {
        date_to_test = moment(a.game_date);
        if (ctrl.fromDate && ctrl.toDate) {
            if ((date_to_test > ctrl.fromDate) && (date_to_test < ctrl.toDate)) {
                return true;
            } else {
                return false;
            }
        } else if (ctrl.fromDate) {
            if (date_to_test > ctrl.fromDate) {
                return true;
            } else {
                return false;
            }
        } else if (ctrl.toDate) {
            if (date_to_test < ctrl.toDate) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    };


    $scope.setTextColor = function(score, opp_score) {
        if (score > opp_score) {
            return " green";
        }
        else if (opp_score > score) {
            return " red"
        }
        else {
            return ""
        }
    };

});

app.controller('mainController', function ($scope, $http) {
        // default table selection and sort criterion for skater page
        $scope.tableSelect = 'basic_stats';
        $scope.sortCriterion = 'points';
        // default sort order is descending
        $scope.statsSortDescending = true;

        // default filter values
        $scope.nameFilter = ''; // empty name filter
        $scope.teamFilter = ''; // empty name filter

        $scope.changeTable = function () {
            if ($scope.tableSelect === 'player_information') {
                $scope.sortCriterion = 'last_name';
                $scope.statsSortDescending = false;
            } else if ($scope.tableSelect === 'basic_stats') {
                $scope.sortCriterion = 'points';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'per_game_stats') {
                $scope.sortCriterion = 'points_per_game';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'time_on_ice_shift_stats') {
                $scope.sortCriterion = 'time_on_ice_seconds';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'power_play_stats') {
                $scope.sortCriterion = 'time_on_ice_pp_seconds';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'penalty_stats') {
                $scope.sortCriterion = 'pim_from_events';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'additional_stats') {
                $scope.sortCriterion = 'faceoff_pctg';
                $scope.statsSortDescending = true;
            } else if ($scope.tableSelect === 'per_60_stats') {
                $scope.sortCriterion = 'points_per_60';
                $scope.statsSortDescending = true;
            }
        };

        // setting column sort order according to current and new sort criteria, and current sort order 
        $scope.setSortOrder = function (sortCriterion, oldSortCriterion, oldStatsSortDescending) {
            // if current criterion equals the new one
            if (oldSortCriterion === sortCriterion) {
                // just change sort direction
                return !oldStatsSortDescending;
            } else {
                // ascending for a few columns
                if ([
                        'goals', 'assists', 'shots_on_goal', 'shot_pctg',
                        'points', 'game_played', 'points_per_game', 'goals_per_game',
                        'assists_per_game', 'primary_assists_per_game',
                        'secondary_assists_per_game', 'shots_on_goal_per_game',
                        'shots_on_goal_per_60', 'points_per_60', 'goals_per_60',
                        'primary_assists_per_60', 'secondary_assists_per_60',
                        'assists_per_60', 'time_on_ice_seconds',
                        'time_on_ice_pp_seconds', 'time_on_ice_sh_seconds', 'shifts',
                        'time_on_ice_per_game_seconds', 'shifts_per_game',
                        'time_on_ice_pp_per_game_seconds',
                        'time_on_ice_sh_per_game_seconds',
                        'pp_goals', 'pp_assists', 'pp_points',
                        'pp_goals_per_60', 'pp_assists_per_60', 'pp_points_per_60',
                        'shots', 'shots_missed', 'shots_blocked', 'faceoffs',
                        'faceoffs_lost', 'faceoffs_won', 'faceoff_pctg',
                        'blocked_shots', 'penalties', '_2min', '_5min',
                        '_10min', '_20min', 'lazy', 'roughing', 'reckless',
                        'other', 'pim_from_events'
                    ].indexOf(sortCriterion) !== -1) {
                    return true;
                } else {
                    // otherwise descending sort order
                    return false;
                }
            }
        };

        $scope.greaterThan = function (prop, val) {
            return function (item) {
                return item[prop] > val;
            }
        }

        $scope.minimumAgeFilter = function (a) {
            if ($scope.minimumAge) {
                if (a.age < $scope.minimumAge) {
                    return false;
                } else {
                    return true;
                }
            } else {
                return true;
            }
        }

        $scope.maximumAgeFilter = function (a) {
            if ($scope.maximumAge) {
                if (a.age > $scope.maximumAge) {
                    return false;
                } else {
                    return true;
                }
            } else {
                return true;
            }
        }

        // loading stats from external json file
        $http.get('data/del_player_game_stats_aggregated.json').then(function (res) {
            $scope.last_modified = res.data[0];
            $scope.stats = res.data[1];
        });
});