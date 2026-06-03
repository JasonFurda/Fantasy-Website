/**
 * Homepage content — EDIT THIS FILE to change what the homepage shows.
 *
 * `mode` switches the whole homepage:
 *   - "recap"     → offseason: rotating art spotlight + champion banner + playoff bracket
 *   - "divisions" → in-season: standings split into the two league divisions
 *
 * When the 2026 season starts: set mode to "divisions", fill in `divisions` below,
 * and the homepage flips automatically. Everything here is plain data — no code changes needed.
 */

export type ArtPiece = {
  src: string; // path under /public
  title: string;
  caption?: string;
};

export type BracketGame = {
  round: string; // e.g. "Semifinal", "Championship"
  winner: string; // must match a team `name` in the DB for that season
  winnerScore: number;
  loser: string;
  loserScore: number;
};

export type Division = {
  name: string;
  teamNames: string[]; // team `name`s in the DB for the season
};

export type HomepageConfig = {
  mode: "recap" | "divisions";

  recap: {
    seasonYear: number;
    champion: {
      teamName: string;
      owner: string;
      blurb: string;
    };
    /** Ordered earliest round → final. */
    bracket: BracketGame[];
    /** Rotating art spotlight. First entry shows first. */
    art: ArtPiece[];
    artRotationMs: number;
  };

  divisions: {
    seasonYear: number;
    divisions: Division[];
  };
};

export const homepageConfig: HomepageConfig = {
  mode: "recap",

  recap: {
    seasonYear: 2025,
    champion: {
      teamName: "Jaxjigba",
      owner: "fflubb",
      blurb:
        "Top seed wire to wire, then dropped 230.3 in the final to take the crown.",
    },
    bracket: [
      {
        round: "Semifinal",
        winner: "Jaxjigba",
        winnerScore: 172.92,
        loser: "MCDC",
        loserScore: 138.2,
      },
      {
        round: "Semifinal",
        winner: "Brown Squad",
        winnerScore: 171.94,
        loser: "Straight Dak'n it",
        loserScore: 141.32,
      },
      {
        round: "Championship",
        winner: "Jaxjigba",
        winnerScore: 230.3,
        loser: "Brown Squad",
        loserScore: 142.06,
      },
    ],
    // Reorder / remove / retitle freely. Files live in /public/art.
    art: [
      { src: "/art/jason-vs-varca-kicker-bowl.jpg", title: "Jason vs Varca — Kicker Bowl" },
      { src: "/art/brum-vs-varca-playoffs.jpg", title: "Brum vs Varca — Playoffs" },
      { src: "/art/west-vs-yeakel-playoffs.jpg", title: "West vs Yeakel — Playoffs" },
      { src: "/art/me-vs-duck-playoffs.jpg", title: "Me vs Duck — Playoffs" },
      { src: "/art/mich-vs-viola-playoffs.jpg", title: "Mich vs Viola — Playoffs" },
      { src: "/art/me-v-west.png", title: "Me vs West" },
      { src: "/art/me-v-mich.png", title: "Me vs Mich" },
      { src: "/art/me-v-brum.png", title: "Me vs Brum" },
      { src: "/art/me-v-varca.png", title: "Me vs Varca" },
      { src: "/art/me-v-sauce.png", title: "Me vs Sauce" },
      { src: "/art/m-v-bluff.png", title: "M vs Bluff" },
      { src: "/art/me-vs-duck.jpg", title: "Me vs Duck" },
      { src: "/art/mich-vs-jason.jpg", title: "Mich vs Jason" },
      { src: "/art/jason-vs-west-2.jpg", title: "Jason vs West" },
      { src: "/art/duck-v-west-loss.png", title: "Duck vs West" },
      { src: "/art/duck-death.png", title: "Duck Death" },
    ],
    artRotationMs: 10000,
  },

  // ---- Fill this in when the 2026 season starts, then set mode: "divisions". ----
  divisions: {
    seasonYear: 2026,
    divisions: [
      { name: "Division 1", teamNames: [] },
      { name: "Division 2", teamNames: [] },
    ],
  },
};
