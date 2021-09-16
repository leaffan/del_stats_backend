#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import yaml
import json
import requests

from copy import deepcopy

from lxml import html
from dateutil.parser import ParserError, parse

src_path = R"C:\del\roster_stats\2021\1\in.txt"
empty_stats_src_path = R"C:\del\roster_stats\empty_stats_section.json"
roster_stats_src_dir = R"C:\del\roster_stats\2021\1"

# loading external configuration
CONFIG = yaml.safe_load(open(os.path.join(
    os.path.dirname(os.path.realpath(__file__)), 'config.yml')))

plr_id = 9000

URL_TPL = "https://www.eliteprospects.com/search/player?q=%s"
PLR_TPL = "https://www.eliteprospects.com/player/"
DOB_URL_TPL = "dob=%s"
POS_URL_TPL = "position=%s"


def get_ep_info_for_player(plr):
    """
    Gets information from Eliteprospects for specified player.
    """
    full_name = " ".join((plr['first_name'], plr['last_name']))

    # searching by full name and (optionally) player dob first
    search_name = full_name.replace(" ", "+")
    url = URL_TPL % search_name

    # adding date of birth to search string (if available)
    if 'dob' in plr and plr['dob']:
        dob = parse(plr['dob']).date()
        url = "&".join((url, DOB_URL_TPL % dob))
    else:
        dob = None

    # adding position to search string (if available)
    if 'position' in plr:
        url = "&".join((url, POS_URL_TPL % plr['position'][0]))

    trs = get_trs_from_ep_plr_search(url)

    # alternatively searching by last name 
    if not trs and dob:
        url = URL_TPL % plr['last_name']
        url = "&".join((url, DOB_URL_TPL % dob))
        trs = get_trs_from_ep_plr_search(url)

    if not trs:
        print("\t-> No Eliteprospects candidate found for %s [%d]" % (full_name, plr['player_id']))
        return None, None

    if len(trs) > 1:
        print("\t-> Multiple Eliteprospects candidates found for %s [%d]" % (full_name, plr['player_id']))
        for tr in trs:
            ep_id, ep_dob = get_ep_id_dob_from_tr(tr, plr, False)
            print("\t\t-> %s (%s)" % (ep_id, ep_dob))
        return None, None

    ep_id, ep_dob = get_ep_id_dob_from_tr(trs.pop(0), plr)
    
    return ep_id, ep_dob


def get_trs_from_ep_plr_search(url):
    """
    Gets table rows of interest from Eliteprospects player search page.
    """
    r = requests.get(url)
    doc = html.fromstring(r.text)
    res_tbl = doc.xpath("//table[@class='table table-condensed table-striped players ']").pop(0)
    trs = res_tbl.xpath("tbody/tr/td[@class='name']/ancestor::tr")
    return trs

def get_ep_id_dob_from_tr(tr, plr, verbose=True):
    """
    Gets player id and date of birth from search result table row on Eliteprospects player search page.
    """
    orig_full_name = " ".join((plr['first_name'], plr['last_name']))
    name_and_pos = tr.xpath("td[@class='name']/span/a/text()").pop(0)
    if verbose:
        print("[%d]: %s (%s) -> %s" % (plr['player_id'], orig_full_name, plr['position'], name_and_pos))
    ep_id = tr.xpath("td[@class='name']/span/a/@href").pop(0)
    ep_id = ep_id.replace(PLR_TPL, "")
    ep_dob = tr.xpath("td[@class='date-of-birth']/span[@class='hidden-xs']/text()").pop(0)
    try:
        ep_dob = parse(ep_dob).date()
    except ParserError:
        print("Unable to parse date of birth %s" % ep_dob)
        ep_dob = None
    
    return ep_id, ep_dob


if __name__ == '__main__':

    all_players_src_path = os.path.join(CONFIG['tgt_processing_dir'], 'del_players.json')
    players = json.loads(open(all_players_src_path).read())
    print("%d players loaded from repository of all players" % len(players))

    # loading possibly existing Eliteprospects data sets
    # player ids
    tgt_id_path = os.path.join(CONFIG['tgt_processing_dir'], 'ep_ids.json')
    if os.path.isfile(tgt_id_path):
        ep_ids = json.loads(open(tgt_id_path).read())
    else:
        ep_ids = dict()
    # dates of birth
    tgt_dob_path = os.path.join(CONFIG['tgt_processing_dir'], 'ep_dobs.json')
    if os.path.isfile(tgt_dob_path):
        ep_dobs = json.loads(open(tgt_dob_path).read())
    else:
        ep_dobs = dict()

    for plr in list(players.values())[:]:
        if str(plr['player_id']) in ep_ids:
            continue
        # retrieving player id and date of birth from Eliteprospects
        ep_id, ep_dob = get_ep_info_for_player(plr)
        if ep_id:
            ep_ids[str(plr['player_id'])] = ep_id
        if ep_dob and not 'dob' in plr:
            ep_dobs[str(plr['player_id'])] = ep_dob

    ep_ids = dict(sorted(ep_ids.items()))
    ep_dobs = dict(sorted(ep_dobs.items()))

    open(tgt_id_path, 'w').write(json.dumps(ep_ids, indent=2, default=str))
    open(tgt_dob_path, 'w').write(json.dumps(ep_dobs, indent=2, default=str))
