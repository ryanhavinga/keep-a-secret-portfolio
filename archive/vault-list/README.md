# The Vault — the plain-list version (archived)

> **No password any more.** This version asks for a password through `js/nav.js` (`window.kasVault`), which has been
> removed from the site. To use it again, take out its `gate()` / door code and the gate markup, or bring the old
> `js/nav.js` password section back.

> **Naming.** This was written when the page was still called "The Vault": the files are `vault.html`, `css/vault.css`,
> `js/vault.js` and the content is `CONFIG.vault`. The live page is now **Demos** (`demos.html`, `css/demos.css`,
> `js/demos.js`, `CONFIG.demos`), so putting this back means either renaming it to match or using the old names.


The simple Vault page: a list grouped by language (Nederlandstalig / Engelstalig), one row per song, with play,
a timeline and a "Request" link. It is switched off while the 3D door version (`archive/vault-door/`) is on.

Put it back (from the site's root — this overwrites the live `vault.html`, `css/vault.css` and `js/vault.js`):

```bash
cp archive/vault-list/vault.html vault.html
cp archive/vault-list/css/vault.css css/vault.css
cp archive/vault-list/js/vault.js js/vault.js
```

The content is `CONFIG.vault` in `js/config.js` (`contact`, `tracks`, each with `language`, `audio`, …).
In `index.html` the prefetch links should be just `vault.html`, `css/vault.css` and `js/vault.js`.
