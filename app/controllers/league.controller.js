"use strict";

const db = require("../models");
const User = db.users;
const League = db.leagues;
const Op = db.Sequelize.Op;
const axios = require("../api/axiosInstance");
const { updateLeagues } = require("../helpers/upsertLeagues");

exports.league = async (app) => {
  const total_batch_size = 50;

  console.log("Beginning League Sync...");

  const league_ids_queue = app.get("league_ids_queue");

  console.log(`${league_ids_queue.length} league ids in queue...`);

  const league_ids = await getLeagueIds(league_ids_queue, total_batch_size);

  let updated_leagues;

  try {
    updated_leagues = await updateLeagues(league_ids);

    const updated_league_ids = updated_leagues.map(
      (league) => league.league_id
    );

    app.set(
      "league_ids_queue",
      league_ids_queue.filter(
        (league_id) => !updated_league_ids.includes(league_id)
      )
    );

    app.set("league_ids_trades_queue", updated_league_ids);

    console.log(
      `${app.get("league_ids_queue").length} League Ids left in queue...`
    );
  } catch (error) {
    console.log(error.message);
  }

  app.set("syncing", false);
  console.log("League Sync Complete");
};

const getLeagueIds = async (league_ids_queue, total_batch_size) => {
  const league_ids_to_add = league_ids_queue.slice(0, total_batch_size);

  let league_ids_to_update;

  if (league_ids_to_add.length < total_batch_size) {
    let leagues_db = await League.findAll({
      order: [[db.sequelize.literal("settings->>'update_league'"), "ASC"]],
      limit: total_batch_size - league_ids_to_add.length,
      attributes: ["league_id"],
      raw: true,
    });

    league_ids_to_update = leagues_db.map((league) => league.league_id);
  }

  return [...league_ids_to_add, ...(league_ids_to_update || [])];
};
