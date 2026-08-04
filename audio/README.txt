Drop your audio files in this folder.

What js/config.js currently points at:

  track 1 - Nergens Liever.m4a
  track 2 - Boemerang.m4a
  track 3 - Beter dan ooit (Akoestisch).m4a
  track 4 - Alles Waar Je Spijt Van Hebt.m4a

Any name works — just point the `audio:` field of the matching track in
js/config.js at it. Spaces are fine.

A note on format: the originals were ~50 MB WAV masters. Cloudflare Pages
(and most hosts) reject files over 25 MB, and a visitor would pay that
download before hearing anything either way. These are 256 kbps AAC
(.m4a) instead — about 5-7 MB a track, no audible difference on the kind
of speakers an A&R exec uses, and it plays natively in every modern
browser. macOS can make more of them without installing anything:

  afconvert -f m4af -d aac -b 256000 -q 127 -s 2 "master.wav" "track.m4a"

(macOS's afconvert can read MP3 but has no MP3 *encoder* — AAC is what it
actually produces. If you want true .mp3 files instead, encode them with
ffmpeg or a DAW's export instead.)

The WAV masters themselves are gitignored (audio/*.wav) rather than
deleted — keep them on this machine as your source files, just don't
expect them to end up in the repo or on the deployed site.

Until a file is here the player runs on a preview timeline and shows a small
"audio pending" line under the controls. Both go away on their own once real
audio loads.
