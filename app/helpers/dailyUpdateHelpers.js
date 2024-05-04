"use strict";

const { fetchState, fetchAllPlayers } = require("../api/sleeperApi");
const fs = require("fs");

const getState = async (app) => {
  const state = await fetchState();

  app.set(
    "state",
    {
      ...state,
      season: process.env.SEASON || state.season,
      league_season: process.env.SEASON || state.league_season,
    },
    0
  );
};

const getAllPlayers = async () => {
  let sleeper_players = await fetchAllPlayers();

  sleeper_players = Object.fromEntries(
    Object.keys(sleeper_players)
      .filter(
        (player_id) =>
          sleeper_players[player_id].active &&
          !["OL", "T", "OT", "G", "OG", "C"].includes(
            sleeper_players[player_id].position
          )
      )
      .map((key) => {
        const {
          position,
          fantasy_positions,
          college,
          number,
          birth_date,
          age,
          full_name,
          active,
          team,
          player_id,
          search_full_name,
          years_exp,
        } = sleeper_players[key];
        return [
          key,
          {
            position,
            fantasy_positions,
            college,
            number,
            birth_date,
            age,
            full_name,
            active,
            team,
            player_id,
            search_full_name,
            years_exp,
          },
        ];
      })
  );

  fs.writeFileSync("./data/allplayers.json", JSON.stringify(sleeper_players));
};

const getMain = async (app) => {
  await getState(app);

  if (process.env.NODE_ENV === "production") {
    await getAllPlayers();
  }
};

module.exports = {
  getMain: getMain,
};
