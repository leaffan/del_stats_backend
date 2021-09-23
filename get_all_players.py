#!/usr/bin/env python
# -*- coding: utf-8 -*-

import re
import os
import yaml
import json

from utils import calculate_age, player_name_corrections, correct_player_name, iso_country_codes
from get_players_from_ep import get_ep_info_for_player

# loading external configuration
CONFIG = yaml.safe_load(open(os.path.join(os.path.dirname(os.path.realpath(__file__)), 'config.yml')))

POSITION_MAPPING = {'CE': 'FO', 'LW': 'FO', 'RW': 'FO', 'LD': 'DE', 'RD': 'DE'}

if __name__ == '__main__':

    roster_stats_src_dir = os.path.join(CONFIG['base_data_dir'], 'roster_stats')

    # loading source files with Eliteprospects ids and dates of birth (if available)
    ep_ids_src_path = os.path.join(CONFIG['tgt_processing_dir'], 'ep_ids.json')
    ep_dobs_src_path = os.path.join(CONFIG['tgt_processing_dir'], 'ep_dobs.json')

    if os.path.isfile(ep_ids_src_path):
        ep_ids = json.loads(open(ep_ids_src_path).read())
    else:
        ep_ids = dict()
    if os.path.isfile(ep_dobs_src_path):
        ep_dobs = json.loads(open(ep_dobs_src_path).read())
    else:
        ep_dobs = dict()

    tgt_path = os.path.join(CONFIG['tgt_processing_dir'], 'del_players.json')

    print("+ Retrieving all players from roster stats in %s" % roster_stats_src_dir)

    # trying to load data from already existing target file
    if os.path.isfile(tgt_path):
        all_players_orig = json.loads(open(tgt_path).read())
        all_players = {int(k): v for (k, v) in all_players_orig.items()}
    else:
        all_players = dict()

    SEASON_SEASON_TYPE_TEAM_ID_REGEX = re.compile(R"(\d+)\%s(\d)\%s(\d+)\.json" % (os.sep, os.sep))

    for src_dir, dirs, fnames in os.walk(roster_stats_src_dir):
        dirs.sort()
        for fname in fnames:
            src_path = os.path.join(src_dir, fname)
            match = re.search(SEASON_SEASON_TYPE_TEAM_ID_REGEX, src_path)
            if not match:
                continue
            season, season_type_id, team_id = (match.group(1), match.group(2), match.group(3))
            season_type = CONFIG['game_types'][int(season_type_id)]
            team = CONFIG['teams'][int(team_id)]
            roster = json.loads(open(src_path).read())
            print("+ Loading %d players from %s %s %s roster" % (len(roster), season, team, season_type))
            for plr in roster:
                single_plr = dict()
                single_plr['player_id'] = int(plr['id'])
                single_plr['first_name'] = plr['firstname']
                single_plr['last_name'] = plr['surname']
                if int(plr['id']) in player_name_corrections:
                    correct_player_name(single_plr)
                single_plr['position'] = plr['position']
                # adjusting position (if necessary)
                if plr['position'] in POSITION_MAPPING:
                    single_plr['position'] = POSITION_MAPPING[plr['position']]
                elif plr['position'] not in ['GK', 'DE', 'FO']:
                    print("\t", plr['position'], plr['surname'])
                single_plr['hand'] = plr['stick']
                # integrating date of birth retrieved via Eliteprospects (if available)
                if str(plr['id']) in ep_dobs:
                    single_plr['dob'] = ep_dobs[str(plr['id'])]
                    single_plr['age'] = calculate_age(single_plr['dob'])
                elif 'dateOfBirth' in plr:
                    single_plr['dob'] = plr['dateOfBirth']
                    single_plr['age'] = calculate_age(single_plr['dob'])
                if plr['nationalityShort'] in iso_country_codes:
                    single_plr['iso_country'] = iso_country_codes[plr['nationalityShort']]
                else:
                    print("Nationality abbreviation not recognized: %s" % plr['nationalityShort'])
                    single_plr['iso_country'] = 'n/a'
                # integrating player id retrieved via Eliteprospects (if available)
                if str(plr['id']) in ep_ids:
                    single_plr['ep_id'] = ep_ids[str(plr['id'])]
                # otherwise retrieving player id from Eliteprospects
                else:
                    print("Retrieving information about %s %s from Eliteprospects" % (
                        single_plr['first_name'], single_plr['last_name']))
                    ep_id, ep_dob = get_ep_info_for_player(single_plr)
                    if ep_id:
                        single_plr['ep_id'] = ep_id
                        ep_ids[str(plr['id'])] = ep_id
                    if ep_dob and not 'dob' in single_plr:
                        single_plr['dob'] = ep_dob
                        single_plr['age'] = calculate_age(str(single_plr['dob']))
                        ep_dobs[str(plr['id'])] = ep_dob
                all_players[single_plr['player_id']] = single_plr

    all_players = dict(sorted(all_players.items()))

    open(tgt_path, 'w').write(json.dumps(all_players, indent=2, default=str))
    open(ep_ids_src_path, 'w').write(json.dumps(ep_ids, indent=2, default=str))
    open(ep_dobs_src_path, 'w').write(json.dumps(ep_dobs, indent=2, default=str))