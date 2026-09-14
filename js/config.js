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
    // SHA-256 of "SEP26"
    passwordHash: 'd324ca2db4d1e8d85c21cb35336fc96de500e4e5ce0aa38823ff205a95369efe',
    remember: true
  },

  /* ---------- BRANDING ---------- */
  brand: {
    logo: 'Keep A Secret',       // top-left wordmark (rendered uppercase)
    sublogo: 'Demo Portal',      // smaller line under it — set to null to hide
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
      artwork: null,               // null  ->  DEMO placeholder card
      audio: 'audio/track 3 - Hoogtes.m4a',
      color: '#0e0e10',
      duration: 200,
      demo: true
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
