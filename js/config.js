/* ============================================================
   KEEP A SECRET — SITE CONFIGURATION
   This is the only file you need to touch for normal updates.
   ============================================================ */

const CONFIG = {
  /* ---------- THE GATE ----------
     A doorman for an invite-only link, not real security. The portfolio
     markup is already in the page whether someone types the password or
     not, and this only ever runs in the visitor's own browser — nothing
     server-side is checking anything. It stops the link being casually
     passed around; it does not stop anyone determined. If the material
     behind it ever needs actually protecting, put the site behind your
     host's own password (Netlify and Cloudflare both do this
     server-side) instead of this.

     passwordHash : a SHA-256 hash of the real password, not the password
                    itself — so it isn't just sitting here in plain text
                    for anyone who opens this file to read straight off.
                    Set to null to remove the gate entirely.

                    To set or change the password: open this page in any
                    browser, open its JavaScript console, and run —

                      await crypto.subtle.digest('SHA-256',
                        new TextEncoder().encode('yournewpassword'))
                        .then(b => [...new Uint8Array(b)]
                        .map(x => x.toString(16).padStart(2, '0')).join(''))

                    — typing the password in capitals (the gate compares
                    case-insensitively, always against the uppercase
                    form), then paste the hex string it prints below.

     remember : stay in for the rest of this browser tab. false asks again
                on every reload.
  ------------------------------------------------------------ */
  gate: {
    // A single hash string, or a list — any one of them opens the gate.
    passwordHash: [
      'd324ca2db4d1e8d85c21cb35336fc96de500e4e5ce0aa38823ff205a95369efe', // "SEP26"
      '1f4b417790666d9e24d108e598ab1b1eceeb923c7025d4b3c41c205c025a112f'  // "OKT26"
    ],
    remember: true,

    /* A password that sends the visitor somewhere else, instead of into the
       portfolio. Same hashing as above (type it in capitals when making the
       hash). `to` is the page they land on; `key` is the session flag that
       page checks, so typing this password does NOT also open the portfolio
       and the Vault, and the other passwords don't open this page. */
    redirects: [
      {
        passwordHash: 'f6a3783cdc8378be169ca627487ad0b245e0bf4e9a65e8e7057896532ea02241',   // "HAP"
        to: 'publishing.html',
        key: 'kas-publishing'
      }
    ]
  },

  /* ---------- BRANDING ---------- */
  brand: {
    logo: 'Keep A Secret',       // top-left wordmark (rendered uppercase)
    sublogo: null,               // smaller line under it (was 'Demo Portal') — set to text to show
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
      title: 'Beter dan ooit - Akoestisch',
      artist: 'Gilles',
      artwork: 'img/track-3.jpg',
      audio: 'audio/track 3 - Beter dan ooit (Akoestisch).m4a',
      color: '#022137',
      duration: 167
    }
  ],

  /* ---------- PORTFOLIO (portfolio.html) ----------
     Everything we've made, on its own page: big covers stacked on a shelf,
     floating a little, and a click pulls one out into full view with its
     info beside it. `tracks` above is the player (the ones we feature);
     this is the whole catalogue. Order here is the order down the page.

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
       ink           : optional, 'dark' or 'light': the colour of the lettering on the shelf
                       edge. Left out, it is picked from how light the edge is.
       credits       : optional sections shown under the title, like a streaming
                       app's credits: [{ heading, people: [{ name, role }] }].
                       Overrides creditsByArtist for that one track. With neither, a
                       track shows just the artist and Keep A Secret as producer.
  ------------------------------------------------------------ */
  portfolio: {
    heading: 'Portfolio',
    /* How many covers the row holds when "All" is chosen. When there are
       fewer tracks than this, the set runs round again from the start until
       the row is full (7 tracks and 10 → the first 3 appear a second time).
       Never cuts real tracks: with more than this many, they all show. Choosing
       an artist in the filter shows their tracks once each, never repeated. */
    fill: 10,
    /* false: the track page is just the credits (listening is on the Player page).
       true: it also gets a play button and timeline for tracks that have audio. */
    listen: false,

    /* The credits on every track page, per artist (a track's own `credits` wins). */
    creditsByArtist: {
      'Gilles': [
        { heading: 'Artist', people: [{ name: 'Gilles', role: 'Main Artist' }] },
        { heading: 'Composition & Lyrics', people: [
          { name: 'Ryan Havinga', role: 'Composer • Lyricist' },
          { name: 'Kelvin Pasman', role: 'Composer • Lyricist' },
          { name: 'Joris Geluk', role: 'Composer • Lyricist' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Producer' }] }
      ],
      'Tim Tiago': [
        { heading: 'Artist', people: [{ name: 'Tim Tiago', role: 'Main Artist' }] },
        { heading: 'Composition & Lyrics', people: [
          { name: 'Tim Kurris', role: 'Lyricist • Composer' },
          { name: 'Ryan Havinga', role: 'Lyricist • Composer' },
          { name: 'Kelvin Pasman', role: 'Lyricist • Composer' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Studio Producer' }] }
      ],
      'Rosalie': [                                   // Incompleet and Liever Kwijt
        { heading: 'Artist', people: [{ name: 'Rosalie', role: 'Main Artist' }] },
        { heading: 'Composition & Lyrics', people: [
          { name: 'Kelvin Pasman, Ryan Havinga, Rosalie Zieleman', role: 'Composer' },
          { name: 'Rosalie Zieleman', role: 'Lyricist' }
        ] },
        { heading: 'Production & Engineering', people: [{ name: 'Keep A Secret', role: 'Producer' }] }
      ]
    },
    tracks: [
      { title: 'Nergens Liever',              artist: 'Gilles',     artwork: 'img/track-1.jpg',                 audio: 'audio/track 1 - Nergens Liever.m4a',                       color: '#9d386f', duration: 197 },
      { title: 'Beter dan ooit',              artist: 'Gilles',     artwork: 'img/Beter dan ooit - Gilles.jpg', audio: null,                                                      color: '#e8a100' },
      { title: 'Beter dan ooit - Akoestisch', artist: 'Gilles',     artwork: 'img/track-3.jpg',                 audio: 'audio/track 3 - Beter dan ooit (Akoestisch).m4a',          color: '#0a3a63', duration: 167 },
      { title: 'Boemerang',                   artist: 'Gilles',     artwork: 'img/Boemerang - Gilles.jpg',      audio: 'audio/track 2 - Boemerang.m4a',                            color: '#a54de0', duration: 190 },
      { title: 'Hoogtes',                     artist: 'Tim Tiago',  artwork: 'img/Hoogtes - Tim Tiago.jpg',     audio: 'audio/track 3 - Hoogtes.m4a',                              color: '#7a5a44', duration: 200, ink: 'dark' },
      { title: 'Incompleet',                  artist: 'Rosalie',    artwork: 'img/Incompleet - Rosalie.jpg',    audio: null,                                                      color: '#a8553a' },
      { title: 'Liever Kwijt',                artist: 'Rosalie',    artwork: 'img/Liever Kwijt - Rosalie.jpg',  audio: null,                                                      color: '#8a3fb0' }
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

  /* ---------- THE VAULT (vault.html) ----------
     Finished songs that aren't anyone's yet — written, produced and ready
     for an artist to cut. Kept apart from `tracks` above on purpose: those
     are the portfolio (records that are already out), these are what's
     available.

     Each entry is one safe-deposit box:
       title    : song title
       audio    : path to the .m4a (same rules as the tracks above —
                  under 25MB, see CLAUDE.md for the afconvert line)
       duration : fallback length in seconds, shown until the audio loads
       genre, bpm, key : optional — shown as one small line under the
                  title, and any you leave out are simply skipped
       status   : 'available' (default) | 'on hold' | 'cut'
                  'cut' keeps the box on the wall but takes the request
                  link away — a song that's been placed.
       note     : optional one-liner, e.g. 'Female vocal · Dutch'

     sealed : how many locked, empty boxes to show after the real ones —
              a wall with something still behind it. 0 for none. */
  vault: {
    eyebrow: 'The Vault',
    heading: 'Ready to cut',
    intro: 'Finished songs, written and produced in-house, held back for the right artist. Every box on this wall is available to cut.',
    contact: 'contact@keepasecret.nl',
    sealed: 2,
    tracks: [
      {
        title: 'Alles Waar Je Spijt Van Hebt',
        audio: 'audio/track 4 - Alles Waar Je Spijt Van Hebt.m4a',
        duration: 133,
        genre: null,
        bpm: null,
        key: null,
        status: 'available',
        note: null
      }
    ]
  },

  /* ---------- FOR PUBLISHERS (publishing.html) ----------
     English-language demos for the publishing team, reached by typing the
     HAP password at the door. A plain list, one row per song, top to bottom,
     under a single "Demos" heading.

       title, artist : shown on the row. artist is whoever sings the demo.
       genre         : optional, one small line under the artist
       note          : optional one-liner under that
       audio         : path to the .m4a (same rules as the tracks above —
                       under 25MB, see CLAUDE.md for the afconvert line).
                       Leave null and the row shows "Audio to follow".
       duration      : fallback length in seconds, shown until the audio loads

     ⚠ THE FOUR ROWS BELOW ARE PLACEHOLDERS so the layout has something to
     show. Replace them with the real demos before this goes anywhere.   */
  publishing: {
    heading: 'Demos',
    contact: 'contact@keepasecret.nl',
    tracks: [
      { title: 'Song Title One',   artist: 'Vocalist', genre: 'Pop',       note: null, audio: null, duration: 198 },
      { title: 'Song Title Two',   artist: 'Vocalist', genre: 'Alt-pop',   note: null, audio: null, duration: 187 },
      { title: 'Song Title Three', artist: 'Vocalist', genre: 'Pop / R&B', note: null, audio: null, duration: 204 },
      { title: 'Song Title Four',  artist: 'Vocalist', genre: 'Indie',     note: null, audio: null, duration: 176 }
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
     Small icon link, bottom-left of the page. Set url to null to hide it. */
  instagram: {
    url: 'https://www.instagram.com/keepasecretsshh/'
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
     removed from index.html and the big arrows step through tracks
     instead. Their content above is kept, unused, so putting either panel
     back is a matter of restoring its markup and adding it here again. */
  order: ['player']
};
