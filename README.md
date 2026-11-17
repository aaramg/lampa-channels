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
