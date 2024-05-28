"use strict";

const {
  fetchLeague,
  fetchLeagueRosters,
  fetchLeagueUsers,
  fetchLeagueDrafts,
  fetchLeagueTradedPicks,
} = require("../api/sleeperApi");
const db = require("../models");
const User = db.users;
const League = db.leagues;
const Draft = db.drafts;

const updateLeagueRostersUsers = (rosters, users) => {
  let rosters_w_username = [];

  for (const roster of rosters) {
    const user = users.find((u) => u.user_id === roster.owner_id);

    const co_owners = roster.co_owners?.map((co) => {
      const co_user = users.find((u) => u.user_id === co);
      return {
        user_id: co_user?.user_id,
        username: co_user?.display_name,
        avatar: co_user?.avatar,
      };
    });

    rosters_w_username.push({
      taxi: roster.taxi,
      starters: roster.starters,
      settings: roster.settings,
      roster_id: roster.roster_id,
      reserve: roster.reserve,
      players: roster.players,
      user_id: roster.owner_id,
      username: user?.display_name,
      avatar: user?.avatar,
      co_owners,
    });
  }

  return rosters_w_username;
};

const getLeagueDraftPicks = ({ league, rosters, drafts, traded_picks }) => {
  let draft_picks_league = {};

  // only get picks if league is dynasty and at least 1 roster has players on it

  if (
    league.settings.type === 2 &&
    rosters?.find((r) => r.players?.length > 0)
  ) {
    // check if rookie draft for current season has occurred

    let draft_season;

    const upcoming_draft = drafts.find(
      (x) =>
        x.status !== "complete" &&
        x.settings.rounds === league.settings.draft_rounds
    );

    if (upcoming_draft) {
      draft_season = parseInt(league.season);
    } else {
      draft_season = parseInt(league.season) + 1;
    }

    const draft_order = upcoming_draft?.draft_order;

    rosters.forEach((roster) => {
      draft_picks_league[roster.roster_id] = [];

      // loop through seasons (draft season and next two seasons)

      for (let j = draft_season; j <= draft_season + 2; j++) {
        // loop through rookie draft rounds

        for (let k = 1; k <= league.settings.draft_rounds; k++) {
          // check if each rookie pick is in traded picks

          const isTraded = traded_picks.find(
            (pick) =>
              parseInt(pick.season) === j &&
              pick.round === k &&
              pick.roster_id === roster.roster_id
          );

          // if it is not in traded picks, add to original manager

          if (!isTraded) {
            draft_picks_league[roster.roster_id].push({
              season: j,
              round: k,
              roster_id: roster.roster_id,
              original_user: {
                avatar: roster.avatar,
                user_id: roster.user_id,
                username: roster.username,
              },
              order: (draft_order && draft_order[roster?.user_id]) || "NA",
            });
          }
        }
      }

      traded_picks
        .filter(
          (x) =>
            x.owner_id === roster.roster_id &&
            parseInt(x.season) >= draft_season
        )
        .forEach((pick) => {
          const original_roster = rosters.find(
            (r) => r.roster_id === pick.roster_id
          );

          draft_picks_league[roster.roster_id].push({
            season: parseInt(pick.season),
            round: pick.round,
            roster_id: pick.roster_id,
            original_user: {
              avatar: original_roster?.avatar,
              user_id: original_roster?.user_id,
              username: original_roster?.username,
            },
            order:
              (draft_order && draft_order[original_roster?.user_id]) || "NA",
          });
        });

      traded_picks
        .filter(
          (x) =>
            x.previous_owner_id === roster.roster_id &&
            parseInt(x.season) >= draft_season
        )
        .forEach((pick) => {
          const index = draft_picks_league[roster.roster_id].findIndex(
            (obj) => {
              return (
                obj.season === pick.season &&
                obj.round === pick.round &&
                obj.roster_id === pick.roster_id
              );
            }
          );

          if (index !== -1) {
            draft_picks_league[roster.roster_id].splice(index, 1);
          }
        });
    });
  }

  return draft_picks_league;
};

const updateLeagues = async (league_ids) => {
  const leagues_to_add = await Promise.all(
    league_ids.map(async (league_id) => {
      try {
        const league = await fetchLeague(league_id);

        const rosters = await fetchLeagueRosters(league.league_id);
        const users = await fetchLeagueUsers(league.league_id);

        const updated_rosters = updateLeagueRostersUsers(rosters, users); // Add user info to rosters

        const drafts = await fetchLeagueDrafts(league.league_id);

        // If League is Dynasty and any roster has players, fetch Traded Picks to get draft picks for each roster

        let draft_picks;

        if (
          league.settings.type === 2 &&
          rosters.find((r) => r.players?.length > 0)
        ) {
          const traded_picks = await fetchLeagueTradedPicks(league.league_id);

          draft_picks = getLeagueDraftPicks({
            league,
            rosters: updated_rosters,
            drafts,
            traded_picks,
          });
        }

        const updated_rosters_draft_picks = updated_rosters.map((roster) => {
          return {
            ...roster,
            draft_picks: draft_picks?.[roster.roster_id] || [],
          };
        });

        return {
          league_id: league.league_id,
          name: league.name,
          avatar: league.avatar,
          season: league.season,
          settings: {
            ...league.settings,
            status: league.status,
            update_league: new Date(),
          },
          scoring_settings: league.scoring_settings,
          roster_positions: league.roster_positions,
          rosters: updated_rosters_draft_picks,
          drafts: drafts,
        };
      } catch (err) {
        console.log(err.message);
        return {
          error: {
            league_id: league_id,
          },
        };
      }
    })
  );

  // Get data to populate associated Tables and through tables

  const user_data = [];
  const user_league_data = [];
  const draft_data = [];

  leagues_to_add.forEach((league) => {
    league.rosters
      ?.filter(
        (roster) => roster.players?.length > 0 && parseInt(roster.user_id) > 0
      ) // Only rosters with players and user_id
      ?.forEach((roster) => {
        // If user not already in user_data array push to array
        if (!user_data.find((u) => u.user_id === roster.user_id)) {
          user_data.push({
            user_id: roster.user_id,
            username: roster.username,
            avatar: roster.avatar,
            type: "LM",
          });
        }

        user_league_data.push({
          userUserId: roster.user_id,
          leagueLeagueId: league.league_id,
        });

        // If co_owners and co_owners not already in user_data array, push to array
        roster.co_owners?.forEach((co) => {
          if (!user_data.find((u) => u.user_id === co.user_id)) {
            user_data.push({
              user_id: co.user_id,
              username: co.username,
              avatar: co.avatar,
              type: "LM",
            });
          }

          user_league_data.push({
            userUserId: co.user_id,
            leagueLeagueId: league.league_id,
          });
        });
      });

    // Populate drafts table, exclude drafts with IDP or DEF
    league.drafts
      ?.filter(
        (draft) =>
          !draft.settings.slots_dl &&
          !draft.settings.slots_lb &&
          !draft.settings.slots_db &&
          !draft.settings.slots_idp_flex &&
          !draft.settings.slots_def
      )
      ?.forEach((draft) => {
        const {
          draft_id,
          type,
          status,
          start_time,
          last_picked,
          settings,
          draft_order,
        } = draft;

        const league_type =
          league.settings.type === 2
            ? "D"
            : league.settings.type === 0
            ? "R"
            : false;

        //  exclude draft data for Keeper drafts and Rookie drafts
        if (
          league_type &&
          draft.settings.rounds > league.settings.draft_rounds
        ) {
          draft_data.push({
            draft_id,
            type,
            status,
            start_time,
            last_picked,
            league_type,
            settings,
            draft_order,
            leagueLeagueId: league.league_id,
          });
        }
      });
  });

  await User.bulkCreate(user_data, {
    updateOnDuplicate: ["username", "avatar"],
  });

  await League.bulkCreate(
    leagues_to_add.filter((l) => l.league_id),
    {
      updateOnDuplicate: [
        "name",
        "avatar",
        "settings",
        "scoring_settings",
        "roster_positions",
        "rosters",
      ],
    }
  );

  await db.sequelize
    .model("userLeagues")
    .bulkCreate(user_league_data, { ignoreDuplicates: true });

  await Draft.bulkCreate(draft_data, {
    updateOnDuplicate: [
      "type",
      "status",
      "start_time",
      "last_picked",
      "league_type",
      "settings",
      "draft_order",
    ],
  });

  return leagues_to_add;
};

module.exports = {
  updateLeagues,
};
