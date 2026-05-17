// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from "./meta/_journal.json";
import m0000 from "./0000_slow_demogoblin.sql";
import m0001 from "./0001_massive_blackheart.sql";
import m0002 from "./0002_real_jigsaw.sql";
import m0003 from "./0003_puzzling_robin_chapel.sql";
import m0004 from "./0004_mushy_spacker_dave.sql";
import m0005 from "./0005_chubby_miek.sql";

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
    m0004,
    m0005,
  },
};
