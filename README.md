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

Adds a **HayFilms** side-menu item that browses [hayfilms.com](https://hayfilms.com): Armenian films and
series, old Armenian films, and films, series, doramas and cartoons dubbed into Armenian. The site's
Russian-language sections are left out, because Lampa already covers them.

- Rows per section, new arrivals, genre rows, and a **Ժանրեր** row of genre tiles plus **Ֆիլտր**
  (section → genre → decade)
- A **HayFilms** tab in Lampa's search
- A **HayFilms** button on the card plays the page's best stream: HD mp4 (up to 1080p), YouTube, ArmDB or OK.
  Series open an episode list that marks watched episodes and remembers the last one
- Settings → HayFilms: open YouTube videos in the YouTube app (default on Android, always full quality)
  or in Lampa's player

Install: Settings → Extensions → Add plugin →

```
https://aaramg.github.io/lampa-channels/hayfilms.js
```

The site has no API, so the plugin reads its HTML through Lampa's native Android request, which CORS
doesn't apply to. If the site changes its markup, the parser needs updating.
