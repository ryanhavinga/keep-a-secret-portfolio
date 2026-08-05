/* ============================================================
   KEEP A SECRET — SITE CONFIGURATION
   This is the only file you need to touch for normal updates.
   ============================================================ */

const CONFIG = {
  /* ---------- THE GATE ----------
     A doorman for an invite-only link, not real security. This password
     sits in this file, which anyone can read by viewing source, and the
     portfolio markup is in the page whether they type it or not. It stops
     the link being passed around; it does not stop anyone who looks. If
     the material behind it ever needs actually protecting, put the site
     behind your host's own password (Netlify and Cloudflare both do this
     server-side) instead of this.

     password : set to null to remove the gate entirely.
     remember : stay in for the rest of this browser tab. false asks again
                on every reload.
  ------------------------------------------------------------ */
  gate: {
    password: 'AUG26',
    remember: true
  },

  /* ---------- BRANDING ---------- */
  brand: {
    logo: 'Keep A Secret',       // top-left wordmark (rendered uppercase)
    sublogo: 'Private Demo Portal', // smaller line under it — set to null to hide
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
     bpm/key : shown under the artist line. Set either to null to hide that line
               entirely (e.g. for a track it doesn't make sense on).
  ------------------------------------------------------------ */
  tracks: [
    {
      title: 'Nergens Liever',
      artist: 'Gilles',
      artwork: 'img/track-1.png',
      audio: 'audio/track 1 - Nergens Liever.m4a',
      color: '#9d386f',
      duration: 194,
      bpm: 122,
      key: 'A Minor'
    },
    {
      title: 'Boemerang',
      artist: 'Gilles',
      artwork: 'img/track-2.png',
      audio: 'audio/track 2 - Boemerang.m4a',
      color: '#c465de',
      duration: 181,
      bpm: 128,
      key: 'F# Minor'
    },
    {
      title: 'Beter dan ooit',
      artist: 'Gilles — Akoestisch',
      artwork: 'img/track-3.png',
      audio: 'audio/track 3 - Beter dan ooit (Akoestisch).m4a',
      color: '#022137',
      duration: 208,
      bpm: 94,
      key: 'C Major'
    },
    {
      title: 'Alles Waar Je Spijt Van Hebt',
      artist: 'Unreleased',
      artwork: null,               // null  ->  DEMO placeholder card
      audio: 'audio/track 4 - Alles Waar Je Spijt Van Hebt.m4a',
      color: '#0e0e10',
      duration: 133,
      demo: true,
      bpm: 140,
      key: 'D Minor'
    }
  ],

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
    contact: 'contact@keepasecret.com'   // set to null to hide
  },

  /* ---------- CAROUSEL ORDER ----------
     Only the player is in the page now — the TikTok and Bio panels were
     removed from index.html and the big arrows step through tracks
     instead. Their content above is kept, unused, so putting either panel
     back is a matter of restoring its markup and adding it here again. */
  order: ['player']
};
