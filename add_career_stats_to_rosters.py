#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import yaml
import json
import argparse

from operator import itemgetter
from collections import defaultdict

from utils import player_name_corrections

# loading external configuration
CONFIG = yaml.safe_load(open(os.path.join(os.path.dirname(os.path.realpath(__file__)), 'config.yml')))

SKATER_INTEGERS = ['gp', 'g', 'a', 'pts', 'plus_minus', 'pim', 'ppg', 'shg', 'gwg', 'sog']
GOALIE_INTEGERS = ['gp', 'w', 'l', 'so', 'ga', 'sv', 'toi', 'sa']

SKATER_MAPPING = {
    'season_type': 'season_type', 'team': 'team', 'gp': 'games_played', 'g': 'goals', 'a': 'assists',
    'pts': 'points', 'plus_minus': 'plus_minus', 'pim': 'pim', 'ppg': 'pp_goals', 'shg': 'sh_goals',
    'gwg': 'gw_goals', 'sog': 'shots_on_goal'
}
GOALIE_MAPPING = {
    'season_type': 'season_type', 'team': 'team', 'gp': 'games_played', 'w': 'w', 'l': 'l', 'so': 'so',
    'ga': 'goals_against', 'toi': 'toi', 'sa': 'shots_against'
}

TEAMGETTER = itemgetter('team')


def combine_season_statlines(season_stat_lines):
    """
    Combines multiple season stat lines (e.g. with more than one team in a season) into a single one.
    """
    combined_statline = defaultdict(int)
    for ssl in season_stat_lines:
        for skr_int in SKATER_INTEGERS:
            combined_statline[skr_int] += ssl[skr_int]
    else:
        if combined_statline['sog'] > 0:
            combined_statline['sh_pctg'] = round(combined_statline['g'] / combined_statline['sog'] * 100, 2)
        else:
            combined_statline['sh_pctg'] = 0.
        if combined_statline['gp'] > 0:
            combined_statline['gpg'] = round(combined_statline['g'] / combined_statline['gp'], 2)
            combined_statline['apg'] = round(combined_statline['a'] / combined_statline['gp'], 2)
            combined_statline['ptspg'] = round(combined_statline['pts'] / combined_statline['gp'], 2)
        else:
            combined_statline['gpg'] = 0.
            combined_statline['apg'] = 0.
            combined_statline['ptspg'] = 0.

    return combined_statline

def combine_seasons(seasons):
    """
    Aggregates skater stats through seasons, grouped by season type.
    """
    career_stats = dict()

    if not seasons:
        return career_stats

    # aggregating regular season and playoff stats first (if applicable)
    for season_type in ['RS', 'PO']:
        season_stats = list(filter(lambda d: d['season_type'] == season_type, seasons))
        if season_stats:
            career_stats[season_type] = dict()
            for key in SKATER_INTEGERS:
                career_stats[season_type][key] = sum(map(itemgetter(key), season_stats))
            else:
                calculate_rates_percentages(career_stats[season_type])
    # finally aggregating all player stats
    else:
        career_stats['all'] = dict()
        for key in SKATER_INTEGERS:
            career_stats['all'][key] = sum(map(itemgetter(key), seasons))
        else:
            calculate_rates_percentages(career_stats['all'])

    return career_stats


def combine_goalie_seasons(seasons):
    """
    Aggregates goalie stats through seasons, grouped by season type.
    """
    career_stats = dict()

    if not seasons:
        return career_stats
    
    # aggregating regular season and playoff stats first (if applicable)
    for season_type in ['RS', 'PO']:
        season_stats = list(filter(lambda d: d['season_type'] == season_type, seasons))
        if season_stats:
            career_stats[season_type] = dict()
            for key in GOALIE_INTEGERS:
                career_stats[season_type][key] = sum(map(itemgetter(key), season_stats))
            else:
                calculate_rates_percentages(career_stats[season_type], 'goalie')
    # finally aggregating all player stats
    else:
        career_stats['all'] = dict()
        for key in GOALIE_INTEGERS:
            career_stats['all'][key] = sum(map(itemgetter(key), seasons))
        else:
            calculate_rates_percentages(career_stats['all'], 'goalie')

    return career_stats


def calculate_rates_percentages(statline, plr_type='skater'):
    """
    Calculates percentages and rates for skater or goalie statlines.
    """
    if plr_type == 'skater':
        if statline['sog'] > 0:
            statline['sh_pctg'] = round(statline['g'] / statline['sog'] * 100, 2)
        else:
            statline['sh_pctg'] = 0.
        if statline['gp'] > 0:
            statline['gpg'] = round(statline['g'] / statline['gp'], 2)
            statline['apg'] = round(statline['a'] / statline['gp'], 2)
            statline['ptspg'] = round(statline['pts'] / statline['gp'], 2)
        else:
            statline['gpg'] = 0.
            statline['apg'] = 0.
            statline['ptspg'] = 0.
    elif plr_type == 'goalie':
        if statline['sa']:
            statline['sv_pctg'] = round(100 - statline['ga'] / statline['sa'] * 100., 3)
            statline['gaa'] = round(statline['ga'] * 3600 / statline['toi'], 2)
        else:
            statline['sv_pctg'] = None
            statline['gaa'] = None


if __name__ == '__main__':

    # retrieving arguments specified on command line
    parser = argparse.ArgumentParser(description='Add career stats to team roster stats.')
    parser.add_argument(
        '-s', '--season', dest='season', required=False, type=int,
        default=CONFIG['default_season'], choices=CONFIG['seasons'],
        metavar='season to download data for', 
        help="The season for which data will be processed")
    parser.add_argument(
        '-g', '--game_type', dest='game_type', required=False, default='RS',
        metavar='game type to download data for', choices=['RS', 'PO', 'MSC'],
        help="The game type for which data will be processed")

    args = parser.parse_args()
    season = args.season
    # TODO: do the following less awkward
    game_types = {
        k: v for (k, v) in CONFIG['game_types'].items() if v == args.game_type
    }
    game_type = list(game_types.keys()).pop(0)

    teams = CONFIG['teams']
    roster_stats_src_dir = os.path.join(CONFIG['base_data_dir'], 'roster_stats', str(season), str(game_type))
    goalie_stats_src_dir = os.path.join(CONFIG['tgt_processing_dir'], str(season))
    goalie_stats_src_path = os.path.join(goalie_stats_src_dir, 'del_goalie_game_stats_aggregated.json')
    goalie_stats = json.loads(open(goalie_stats_src_path).read())
    career_stats_src_path = os.path.join(CONFIG['tgt_processing_dir'], 'career_stats', 'updated_career_stats.json')
    career_stats = json.loads(open(career_stats_src_path).read())
    career_stats_per_player_src_dir = os.path.join(CONFIG['tgt_base_dir'], 'career_stats', 'per_player')
    career_stats_against_per_player_src_dir = os.path.join(
        CONFIG['base_data_dir'], 'career_stats_against', 'per_player')

    player_game_stats_src_path = os.path.join(CONFIG['tgt_processing_dir'], str(season), 'del_player_game_stats.json')
    player_game_stats = json.loads(open(player_game_stats_src_path).read())[-1]

    tgt_dir = os.path.join(CONFIG['tgt_processing_dir'], 'career_stats', 'per_team')
    if not os.path.isdir(tgt_dir):
        os.makedirs(tgt_dir)

    pre_2017_stats = dict()

    # fetching pre-2017 data first
    for f in os.listdir(career_stats_per_player_src_dir)[:]:
        if not f.endswith('.json'):
            continue
        plr_id = f.split('.')[0]
        if not plr_id.isdigit():
            continue
        plr_id = int(plr_id)
        # loading current player's career stats
        curr_plr_career_stats = json.loads(open(os.path.join(career_stats_per_player_src_dir, f)).read())
        # retaining only stats from before the 2017/18 season
        pre_2017_statlines = list(filter(lambda d: d['season'] < 2017, curr_plr_career_stats.get('seasons', list())))
        curr_plr_career_stats['seasons'] = pre_2017_statlines
        # re-creating career stats
        if curr_plr_career_stats['position'] == 'GK':
            curr_plr_career_stats['career'] = combine_goalie_seasons(pre_2017_statlines)
        else:
            curr_plr_career_stats['career'] = combine_seasons(pre_2017_statlines)

        pre_2017_stats[plr_id] = curr_plr_career_stats

    roster_stats_src_base_dir = os.path.join(CONFIG['base_data_dir'], 'roster_stats', str(CONFIG['default_season']))
    # retrieving player ids of interest, i.e. those from current season
    curr_season_plr_ids = set()
    for game_type in ['1', '3']:
        roster_stats_src_dir = os.path.join(roster_stats_src_base_dir, game_type)
        for f in os.listdir(roster_stats_src_dir)[:]:
            if not f.endswith('.json'):
                continue
            team_id = f.split('.')[0]
            if not team_id.isdigit():
                continue
            src_path = os.path.join(roster_stats_src_dir, f)
            curr_roster = json.loads(open(src_path).read())
            for plr in curr_roster:
                curr_season_plr_ids.add(plr['id'])

    up_to_date_career_stats = dict()

    # adding per-player per-season/playoff stats to pre-2017 stats
    for season in CONFIG['seasons'][1:]:
        src_dir = os.path.join(CONFIG['tgt_processing_dir'], str(season))
        skater_stats_src_path = os.path.join(src_dir, 'del_player_game_stats_aggregated.json')
        skater_stats = json.loads(open(skater_stats_src_path).read())[-1]
        for item in skater_stats:
            plr_id = item['player_id']
            if plr_id not in curr_season_plr_ids:
                continue
            if plr_id not in pre_2017_stats:
                print("No career stats for current season player: %s [%d]" % (item['full_name'], plr_id))
                continue
            if item['position'] == 'GK':
                continue
            if item['season_type'] not in ['RS', 'PO']:
                continue
            curr_plr_career_stats = pre_2017_stats[plr_id]
            season_statline = dict()
            season_statline['season'] = season
            for attr in SKATER_MAPPING:
                season_statline[attr] = item[SKATER_MAPPING[attr]]
            calculate_rates_percentages(season_statline)
            curr_plr_career_stats['seasons'].append(season_statline)
            curr_plr_career_stats['career'] = combine_seasons(curr_plr_career_stats['seasons'])

            up_to_date_career_stats[plr_id] = curr_plr_career_stats

        goalie_stats_src_path = os.path.join(src_dir, 'del_goalie_game_stats_aggregated.json')
        goalie_stats = json.loads(open(goalie_stats_src_path).read())
        for item in goalie_stats:
            plr_id = item['player_id']
            if plr_id not in curr_season_plr_ids:
                continue
            # if plr_id not in pre_2017_stats:
            #     print("No career stats for current season player: %s [%d]" % (item['full_name'], plr_id))
            #     continue
            if item['position'] != 'GK':
                continue
            if item['season_type'] not in ['RS', 'PO']:
                continue
            curr_plr_career_stats = pre_2017_stats[plr_id]
            season_statline = dict()
            season_statline['season'] = season
            for attr in GOALIE_MAPPING:
                season_statline[attr] = item[GOALIE_MAPPING[attr]]
            season_statline['sv'] = season_statline['sa'] - season_statline['ga']
            calculate_rates_percentages(season_statline, plr_type='goalie')
            curr_plr_career_stats['seasons'].append(season_statline)
            curr_plr_career_stats['career'] = combine_goalie_seasons(curr_plr_career_stats['seasons'])

            up_to_date_career_stats[plr_id] = curr_plr_career_stats

    # pre-season hack to include stats on roster pages for players with pre-2017 stats
    for plr_id in [1768, 1761, 1823, 1818, 126, 241, 124, 451, 469]:
        if plr_id in pre_2017_stats:
            # print("%d found in pre-2017 stats" % plr_id)
            up_to_date_career_stats[plr_id] = pre_2017_stats[plr_id]
        else:
            print("%d not found in pre-2017 stats" % plr_id)

    # updating per-team roster stats
    for game_type in [1]:
        roster_stats_src_dir = os.path.join(roster_stats_src_base_dir, str(game_type))
        for f in os.listdir(roster_stats_src_dir)[:]:
            if not f.endswith('.json'):
                continue
            team_id = f.split('.')[0]
            if not team_id.isdigit():
                continue
            team_id = int(team_id)
            src_path = os.path.join(roster_stats_src_dir, f)
            # loading current roster
            curr_roster = json.loads(open(src_path).read())
            # preparing set of processed player ids to avoid retaining wrongly existing
            # duplicate entries in team roster data (as happened with MSC semi-finalists in 2020)
            plr_ids_processed = set()
            # also since duplicate entries in original data exist we have to re-create roster
            # lists to avoid those duplicate entries
            updated_roster = list()

            for plr in curr_roster:
                plr_id = plr['id']
                # checking if player has already been processed
                if plr_id in plr_ids_processed:
                    continue
                # optionally correcting player name
                if plr_id in player_name_corrections:
                    corrected_player_name = player_name_corrections[plr_id]
                    if 'first_name' in corrected_player_name:
                        plr['firstname'] = corrected_player_name['first_name']
                    if 'last_name' in corrected_player_name:
                        plr['surname'] = corrected_player_name['last_name']
                    if 'full_name' in corrected_player_name:
                        plr['name'] = corrected_player_name['full_name']

                curr_plr_career_stats = up_to_date_career_stats.get(plr_id)

                # retaining career stats
                if curr_plr_career_stats and 'all' in curr_plr_career_stats['career']:
                    plr['career'] = curr_plr_career_stats['career']['all']
                # retaining career playoff stats
                if curr_plr_career_stats and 'PO' in curr_plr_career_stats['career']:
                    plr['career_po'] = curr_plr_career_stats['career']['PO']

                # retrieving current player's previous DEL teams
                if curr_plr_career_stats:
                    prev_teams = set(map(TEAMGETTER, curr_plr_career_stats['seasons']))
                    prev_teams.discard(CONFIG['teams'][team_id])
                    plr['prev_teams'] = sorted(list(prev_teams))
                else:
                    plr['prev_teams'] = list()

                if not curr_plr_career_stats:
                    print("+ No career stats found for player %s" % plr['name'])
                if curr_plr_career_stats:
                    prev_season_player_stats = list(filter(lambda d:
                        d['season'] == season - 1 and d['season_type'] == 'RS', curr_plr_career_stats['seasons']))
                else:
                    prev_season_player_stats = list()
                if prev_season_player_stats:
                    if len(prev_season_player_stats) > 1:
                        print("+ Multiple datasets from previous regular season found for player %s" % plr['name'])
                        if plr['position'] != 'GK':
                            plr['prev_season'] = dict(combine_season_statlines(prev_season_player_stats))
                        else:
                            pass
                            # TODO: take care of goalies with multiple season stat lines
                    else:
                        # retaining previous season's stats (if available)
                        plr['prev_season'] = prev_season_player_stats.pop(0)

                # dirty hack to adding goalie statistics to stats section
                for plr_tmp in career_stats:
                    if plr_tmp['position'] != 'GK':
                        continue
                    if plr_tmp['player_id'] != plr_id:
                        continue
                    current_goalie_season = list(
                        filter(lambda s: s['season'] == 2021 and s['season_type'] == 'RS', plr_tmp['seasons']))
                    if current_goalie_season:
                        current_goalie_season = current_goalie_season.pop(0)
                    else:
                        continue
                    if current_goalie_season and current_goalie_season['gp']:
                        plr['statistics']['w'] = current_goalie_season['w']
                        plr['statistics']['l'] = current_goalie_season['l']
                        plr['statistics']['gaa'] = current_goalie_season['gaa']
                        plr['statistics']['save_pctg'] = current_goalie_season['sv_pctg']
                        plr['statistics']['so'] = current_goalie_season['so']

                # retrieving stats against other teams
                opp_team_stats = dict()
                curr_player_game_stats = list(
                    filter(lambda pg: pg['player_id'] == plr_id and pg['season_type'] != 'MSC', player_game_stats))
                opp_teams = set(list(map(itemgetter('opp_team'), curr_player_game_stats)))
                for opp_team in opp_teams:
                    curr_player_opp_game_stats = list(
                        filter(lambda pg: pg['opp_team'] == opp_team and pg['time_on_ice'] > 0, curr_player_game_stats))
                    if curr_player_opp_game_stats:
                        single_opp_team_stats = dict()
                        single_opp_team_stats['gp'] = len(curr_player_opp_game_stats)
                        single_opp_team_stats['g'] = sum(map(itemgetter('goals'), curr_player_opp_game_stats))
                        single_opp_team_stats['a'] = sum(map(itemgetter('assists'), curr_player_opp_game_stats))
                        single_opp_team_stats['pts'] = sum(map(itemgetter('points'), curr_player_opp_game_stats))
                        single_opp_team_stats['gwg'] = sum(map(itemgetter('gw_goals'), curr_player_opp_game_stats))
                        single_opp_team_stats['pim'] = sum(map(itemgetter('pim_from_events'), curr_player_opp_game_stats))
                        opp_team_stats[opp_team] = single_opp_team_stats
                plr['opp_team_stats'] = opp_team_stats

                # calculating overall career stats against other teams
                career_against_stats_src_path = os.path.join(career_stats_against_per_player_src_dir, '%d.json' % plr_id)
                if os.path.isfile(career_against_stats_src_path):
                    career_against_stats = json.loads(open(career_against_stats_src_path).read())
                else:
                    career_against_stats = dict()

                if 'plr_games' in career_against_stats and 'season_games' in career_against_stats:
                    if career_against_stats['plr_games'] != career_against_stats['season_games']:
                        plr['game_discrepancy'] = True

                opp_team_stats_career = dict()

                if career_against_stats:
                    career_against_stats = career_against_stats['career_against']

                for opp_team in CONFIG['teams'].values():
                    single_career_opp_team_stats = defaultdict(int)
                    if opp_team in career_against_stats:
                        single_career_opp_team_stats['gp'] = career_against_stats[opp_team]['gp']
                        single_career_opp_team_stats['g'] = career_against_stats[opp_team]['g']
                        single_career_opp_team_stats['a'] = career_against_stats[opp_team]['a']
                        single_career_opp_team_stats['pts'] = career_against_stats[opp_team]['pts']
                        single_career_opp_team_stats['gwg'] = None
                        single_career_opp_team_stats['pim'] = career_against_stats[opp_team]['pim']
                    if opp_team in plr['opp_team_stats']:
                        single_career_opp_team_stats['gp'] += plr['opp_team_stats'][opp_team]['gp']
                        single_career_opp_team_stats['g'] += plr['opp_team_stats'][opp_team]['g']
                        single_career_opp_team_stats['a'] += plr['opp_team_stats'][opp_team]['a']
                        single_career_opp_team_stats['pts'] += plr['opp_team_stats'][opp_team]['pts']
                        single_career_opp_team_stats['pim'] += plr['opp_team_stats'][opp_team]['pim']
                    if single_career_opp_team_stats:
                        opp_team_stats_career[opp_team] = single_career_opp_team_stats

                plr['opp_team_stats_career'] = opp_team_stats_career

                updated_roster.append(plr)
                plr_ids_processed.add(plr_id)

            tgt_path = os.path.join(tgt_dir, "%s_stats.json" % CONFIG['teams'][team_id])
            open(tgt_path, 'w').write(json.dumps(updated_roster, indent=2))
