"use strict";

module.exports = (app) => {
  const user = require("../controllers/user.controller.js");
  const league = require("../controllers/league.controller.js");
  const trade = require("../controllers/trade.controller.js");

  setTimeout(async () => {
    await user.user(app);
    await league.league(app);
    await trade.trades(app);
  }, 10 * 1000);

  setInterval(async () => {
    await user.user(app);
    await league.league(app);
    await trade.trades(app);
  }, 2 * 60 * 1000);
};
