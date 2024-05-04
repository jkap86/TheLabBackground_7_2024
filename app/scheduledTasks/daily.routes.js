"use strict";

const { getMain } = require("../helpers/dailyUpdateHelpers");

module.exports = async (app) => {
  await getMain(app);

  const now = new Date();
  const utc = now.setHours(9, 0, 0, 0);
  const delay = now - utc;

  setTimeout(() => {
    setInterval(async () => {
      console.log("Daily update starting...");

      await getMain(app);

      console.log("Daily update complete...");
    }, 24 * 60 * 60 * 1 * 1000);
  }, delay);
};
