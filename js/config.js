/* ============================================================
   KEEP A SECRET — SITE CONFIGURATION
   This is the only file you need to touch for normal updates.
   ============================================================ */

const CONFIG = {
  /* ---------- BRANDING ---------- */
  brand: {
    logo: 'Keep A Secret',       // top-left wordmark (rendered uppercase)
    logoImage: null,             // optional: 'img/logo.svg' — replaces the text wordmark
    tagline: 'Contact'           // small top-right label
  },

  /* ---------- TRACKS ----------
     artwork : path to a square image, or null to use the DEMO placeholder card
     audio   : path to an audio file. Drop your files in /audio and point here.
               If the file is missing the player still runs on a preview timeline.
     color   : fallback dominant colour of the artwork (hex).
               The player samples the real image at runtime; this is the safety net.
     duration: fallback length in seconds, used only when no audio file loads.
  ------------------------------------------------------------ */
  tracks: [
    {
      title: 'Nergens Liever',
      artist: 'Gilles',
      artwork: 'img/track-1.jpg',
      audio: 'audio/track 1 - Nergens Liever.m4a',
      color: '#9d386f',
      duration: 197
    },
    {
      title: 'Hoogtes',
      artist: 'Tim Tiago',
      artwork: 'img/Hoogtes - Tim Tiago.jpg',
      audio: 'audio/track 3 - Hoogtes.m4a',
      color: '#7a5a44',
      duration: 200
    },
    {
      title: 'Beter dan ooit (Akoestisch)',
      artist: 'Gilles',
      artwork: 'img/track-3.jpg',
      audio: 'audio/track 3 - Beter dan ooit (Akoestisch).m4a',
      color: '#022137',
      duration: 167
    },
    // …and the rest of the portfolio's releases, so the player holds all of them.
    {
      title: 'Beter dan ooit',
      artist: 'Gilles',
      artwork: 'img/Beter dan ooit - Gilles.jpg',
      audio: 'audio/track 5 - Beter dan ooit.m4a',
      color: '#e8a100',
      duration: 172
    },
    {
      title: 'Boemerang',
      artist: 'Gilles',
      artwork: 'img/Boemerang - Gilles.jpg',
      audio: 'audio/track 2 - Boemerang.m4a',
      color: '#a54de0',
      duration: 190
    },
    {
      title: 'Incompleet',
      artist: 'Rosalie',
      artwork: 'img/Incompleet - Rosalie.jpg',
      audio: 'audio/track 6 - Incompleet.m4a',
      color: '#a8553a',
      duration: 229
    },
    {
      title: 'Liever Kwijt',
      artist: 'Rosalie',
      artwork: 'img/Liever Kwijt - Rosalie.jpg',
      audio: 'audio/track 7 - Liever Kwijt.m4a',
      color: '#8a3fb0',
      duration: 176
    }
  ],

  /* ---------- PORTFOLIO (index.html, the landing page) ----------
     Everything we've made, on its own page: big covers stacked on a shelf,
     floating a little, and a click pulls one out into full view with its
     info beside it. `tracks` above is the old player's list (no longer used: the phone player on player.html now plays
     this list); this is the whole catalogue. Order here is the order down the page.

       title, artist : shown on the shelf edge and in the info panel
       artwork       : path to a square image (needed — the page is the covers).
                       The bigger the better: they're shown up to ~700px wide.
       color         : fallback tint (hex) for the shelf edge. The page samples
                       the artwork itself; this is the safety net.
       audio         : optional path to the .m4a. Only used when `listen: true` below —
                       then the info panel gets a play button and timeline.
       year, note    : optional, one small line each in the info panel
       links         : optional, e.g. [{ label: 'Spotify', url: 'https://…' }]
       spotify, apple: optional links to the track on Spotify / Apple Music, for the
                       two small icons bottom right. Without one the icon opens a
                       search for "title artist" instead.
       credits       : optional sections shown under the title, like a streaming
                       app's credits: [{ heading, people: [{ name, role }] }].
                       Overrides creditsByArtist for that one track. With neither, a
                       track shows just the artist and Keep A Secret as producer.
  ------------------------------------------------------------ */
  portfolio: {
    heading: 'Portfolio',
    /* How many covers the row holds. When there are fewer tracks than this, the set runs round again from
       the start until the row is full (7 tracks and 10 → the first 3 appear a second time). Never cuts real
       tracks: with more than this many, they all show. */
    fill: 10,
    /* false: the track page is just the credits (listening is on the Player page).
       true: it also gets a play button and timeline for tracks that have audio. */
    listen: false,

    /* The credits on every track page, per artist (a track's own `credits` wins). */
    creditsByArtist: {
      'Gilles': [
        { heading: 'Composition & Lyrics', people: [
          { name: 'Ryan Havinga', role: 'Composer • Lyricist' },
          { name: 'Kelvin Pasman', role: 'Composer • Lyricist' },
          { name: 'Joris Geluk', role: 'Composer • Lyricist' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Producer' }] }
      ],
      'Tim Tiago': [
        { heading: 'Composition & Lyrics', people: [
          { name: 'Tim Kurris', role: 'Lyricist • Composer' },
          { name: 'Ryan Havinga', role: 'Lyricist • Composer' },
          { name: 'Kelvin Pasman', role: 'Lyricist • Composer' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Studio Producer' }] }
      ],
      'Rosalie': [                                   // Incompleet and Liever Kwijt
        { heading: 'Composition & Lyrics', people: [
          { name: 'Kelvin Pasman, Ryan Havinga, Rosalie Zieleman', role: 'Composer' },
          { name: 'Rosalie Zieleman', role: 'Lyricist' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Producer' }] }
      ]
    },
    tracks: [
      { title: 'Nergens Liever',              artist: 'Gilles',     artwork: 'img/track-1.jpg',                 audio: 'audio/track 1 - Nergens Liever.m4a',                       color: '#9d386f', duration: 197 },
      { title: 'Beter dan ooit',              artist: 'Gilles',     artwork: 'img/Beter dan ooit - Gilles.jpg', audio: 'audio/track 5 - Beter dan ooit.m4a',                       color: '#e8a100', duration: 172 },
      { title: 'Beter dan ooit (Akoestisch)', artist: 'Gilles',     artwork: 'img/track-3.jpg',                 audio: 'audio/track 3 - Beter dan ooit (Akoestisch).m4a',          color: '#0a3a63', duration: 167 },
      { title: 'Boemerang',                   artist: 'Gilles',     artwork: 'img/Boemerang - Gilles.jpg',      audio: 'audio/track 2 - Boemerang.m4a',                            color: '#a54de0', duration: 190 },
      { title: 'Hoogtes',                     artist: 'Tim Tiago',  artwork: 'img/Hoogtes - Tim Tiago.jpg',     audio: 'audio/track 3 - Hoogtes.m4a',                              color: '#7a5a44', duration: 200 },
      { title: 'Incompleet',                  artist: 'Rosalie',    artwork: 'img/Incompleet - Rosalie.jpg',    audio: 'audio/track 6 - Incompleet.m4a',                            color: '#a8553a', duration: 229 },
      { title: 'Liever Kwijt',                artist: 'Rosalie',    artwork: 'img/Liever Kwijt - Rosalie.jpg',  audio: 'audio/track 7 - Liever Kwijt.m4a',                          color: '#8a3fb0', duration: 176 }
    ]
  },

  /* ---------- ARCHIVED TRACKS ----------
     Taken off the live site but kept here for reference — their audio/
     artwork files are untouched on disk. Move an entry back into `tracks`
     above (and give it its own object again) to bring it back live. */
  archivedTracks: [
    {
      title: 'Boemerang',
      artist: 'Gilles',
      artwork: 'img/track-2.jpg',
      audio: 'audio/track 2 - Boemerang.m4a',
      color: '#c465de',
      duration: 189
    },
    {
      title: 'Alles Waar Je Spijt Van Hebt',
      artist: 'Unreleased',
      artwork: null,
      audio: 'audio/track 4 - Alles Waar Je Spijt Van Hebt.m4a',
      color: '#0e0e10',
      duration: 133,
      demo: true
    }
  ],

  /* ---------- DEMOS (demos.html) ----------
     Unreleased songs that aren't anyone's yet — written, produced and ready for an artist to cut. Kept
     apart from `tracks` above on purpose: those are the portfolio (records that are already out), these
     are what's available. A plain list, one row per song, in groups by language, each under its own
     heading.

       contact  : where each row's "Request" link sends its email (subject: "Demo request: <title>"); a collection can
                  switch that link off for its rows with request: false

     Each entry in `tracks` is one row:
       title    : song title
       language : the heading it is listed under, e.g. 'Nederlandstalig' or
                  'Engelstalig'. The groups come in the order they first
                  appear here; a song with no language sits above them all.
       audio    : path to the .m4a (same rules as the tracks above —
                  under 25MB, see CLAUDE.md for the afconvert line).
                  Leave null and the row shows "Audio to follow".
       duration : fallback length in seconds, shown until the audio loads
       year, genre, bpm, key : optional — shown as one small line under the
                  title (year first), and any you leave out are simply skipped
       status   : 'available' (default) | 'on hold' | 'cut'
                  the last two swap the Request link for their label —
                  'cut' is a song that's been placed.
       note     : optional one-liner, e.g. 'Female vocal' */
  demos: {
    contact: 'contact@keepasecret.nl',
    /* Collections: the Demos page lists nothing until a code is typed into the bar at the top; then it shows only the
       demos tagged with that code (collections: ['HAP'] on a track) — e.g. a shortlist for one publisher. A demo with no
       collection is not shown anywhere. It is not a password: a link ending in ?code=HAP opens a collection straight
       away, and the files themselves are still on the server for anyone who goes looking. */
    collections: {
      HAP: { name: 'Holland America Publishing', request: false }     // request: false — no Request link on its rows
    },
    tracks: [
      /* Nederlandstalig is switched off for now — take the comment marks away to bring it back (the heading comes with it):
      {
        title: 'Alles Waar Je Spijt Van Hebt',
        language: 'Nederlandstalig',
        audio: 'audio/track 4 - Alles Waar Je Spijt Van Hebt.m4a',
        duration: 133,
        genre: null,
        bpm: null,
        key: null,
        status: 'available',
        note: null
      },
      */
      { title: 'Give Ya What U Like', language: 'Engelstalig', audio: 'audio/demo - Give Ya What U Like.mp3', duration: 180, year: 2021, collections: ['HAP'], status: 'available' },
      { title: 'Fast Life',           language: 'Engelstalig', audio: 'audio/demo - Fast Life.mp3',           duration: 154, year: 2021, collections: ['HAP'], status: 'available' },
      { title: 'No Safe Flights',     language: 'Engelstalig', audio: 'audio/demo - No Safe Flights.m4a',     duration: 43,  year: 2021, collections: ['HAP'], status: 'available' }
    ]
  },

  /* ---------- TIKTOK ----------
     url     : where the block sends people when clicked
     videoId : optional. The numeric id from a TikTok video URL
               (…/video/7412345678901234567). Set it to embed the video
               inside the block instead of the placeholder card.
  ------------------------------------------------------------ */
  tiktok: {
    url: 'https://www.tiktok.com/@ryanhavinga_/video/7649781964077108512',
    handle: '@ryanhavinga_',
    videoId: null,
    thumbnail: 'img/tiktok-thumb.jpg',   // shown until videoId is set — set to null for the plain glyph card
    caption: "Behind 'Boemerang'"
  },

  /* ---------- SOCIAL ----------
     Two small icon links, bottom-left of the portfolio page. Set a url to
     null to hide its icon. */
  instagram: {
    url: 'https://www.instagram.com/keepasecretsshh/'
  },
  spotify: {
    url: 'https://open.spotify.com/playlist/3aHcZPExAEuciBcZjU3cUL?si=1bcb96a9274a4811'
  },

  /* ---------- BIO ---------- */
  bio: {
    eyebrow: 'The Statement',
    heading: 'Keep A Secret',
    paragraphs: [
      'A producer working quietly between the lines — records built in low light, mixed for the space between a verse and the moment it lands.',
      'The catalogue moves through pop, alternative and everything that refuses a genre. Some of it is released. Most of it is not.',
      'Placements, sessions and unreleased material are shared here by invitation only.'
    ],
    contact: 'contact@keepasecret.nl'   // set to null to hide
  },

  /* ---------- CAROUSEL ORDER ----------
     Only the player is in the page now — the TikTok and Bio panels were
     removed from player.html and the big arrows step through tracks
     instead. Their content above is kept, unused, so putting either panel
     back is a matter of restoring its markup and adding it here again. */
  order: ['player']
};
