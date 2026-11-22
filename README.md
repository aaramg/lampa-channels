# Lampa plugins by @aaramg

**Everything at once:** Settings → Extensions → Add plugin →

```
is.gd/lampar
```

That short link points to `all.js`, which loads every plugin below; plugins added there later reach
everyone on their next Lampa start. Or install a plugin on its own with its link below.

# Channels plugin for Lampa

Adds side-menu items for streaming brands. Each opens a page of TMDB rows:

- **Netflix**: new and popular series, films on Netflix (US), top rated, kids, animation, documentaries
- **HBO / Max**: new, HBO series, Max originals, films on HBO Max (US), HBO films, DC, top rated
- **Disney**: Disney+, Pixar, Walt Disney Animation, Marvel, Lucasfilm and Star Wars, Disney Channel / Junior, classics
- **Apple TV+**, **Prime Video**, **Hulu** (with FX), **Paramount+**
- **Studios**: Warner Bros., Universal, Columbia, DreamWorks, Illumination, A24, Ghibli, Legendary, Blumhouse
- **Kids**: Nickelodeon, Nick Jr., Cartoon Network, PBS Kids, DreamWorks, Illumination, Ghibli, Warner Bros. Animation

Rows named "on <service>" show that service's US catalog: TMDB has no streaming catalog for every country.
The other rows show what the network premiered or the studio made, which TMDB records worldwide.

Settings → Channels turns each menu item on or off.

Install: Settings → Extensions → Add plugin →

```
https://aaramg.github.io/lampa-channels/channels.js
```

Built for Lampa 3.x and written in ES5, so it runs on older Android TV WebViews.

# HayFilms plugin for Lampa

Adds a **HayFilms** side-menu item that browses two Armenian sites as one catalogue:
[hayfilms.com](https://hayfilms.com) and [armfilm.co](https://armfilm.co). Armenian films and series,
old Armenian films, Armenian cartoons, and films, series, doramas, cartoons and anime dubbed into
Armenian. Russian-language sections and titles are left out, because Lampa already covers them.

- Rows per section, new arrivals, kids and family rows, genre rows, and a **Ժանրեր** row of genre tiles
  plus **Ֆիլտր** (section → genre → decade). Genres and years come from hayfilms.com only
- Grids take both sites' next page at once and alternate them; a title both sites have shows once.
  The next two pages are read ahead in the background, so scrolling doesn't wait
- A **HayFilms** tab in Lampa's search (hayfilms.com's search plus an on-device list of armfilm.co's
  titles, built in the background once a week)
- A **HayFilms** button on the card plays the best stream either site has: HD mp4 (up to 1080p),
  YouTube, armfilm's HLS (720p), ArmDB or OK, falling back to the next if one fails. Series open an
  episode list (episodes matched by number across the sites) that marks watched episodes and
  remembers the last one. What you play is added to Lampa's History
- Settings → HayFilms: open YouTube videos in the YouTube app (default on Android, always full quality)
  or in Lampa's player

Install: Settings → Extensions → Add plugin →

```
https://aaramg.github.io/lampa-channels/hayfilms.js
```

The sites have no API, so the plugin reads their HTML through Lampa's native Android request, which
CORS doesn't apply to (so lists stay empty in a browser or on Tizen/webOS). If a site changes its
markup, the parser needs updating.
