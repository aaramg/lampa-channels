/*
 * Channels — Lampa plugin
 * Adds one side-menu item per streaming brand (Netflix, HBO / Max, Disney, Apple TV+, Prime Video,
 * Hulu, Paramount+) plus Studios and Kids. Each opens a page of TMDB rows.
 * Settings → Channels turns each menu item on or off.
 * Targets Lampa 3.x. Written in ES5 for old Android TV WebViews (Crosswalk).
 */
(function () {
    'use strict';

    if (window.plugin_channels_ready) return;
    window.plugin_channels_ready = true;

    var SOURCE = 'channels';
    var DAY = 1000 * 60 * 60 * 24;
    // Lampa's request cache measures a cached answer's life in minutes.
    var MINUTES_PER_DAY = 60 * 24;

    // TMDB has no streaming catalog for Armenia, so "on <service> now" rows read the US catalog.
    var CATALOG_REGION = 'US';

    // TMDB ids (checked against the TMDB API)
    var NET = {
        netflix: 213, hbo: 49, max: 3186, apple: 2552, prime: 1024, hulu: 453, fx: 88, paramount_plus: 4330,
        disney_plus: 2739, disney_channel: 54, disney_junior: 281,
        nickelodeon: 13, nick_jr: 35, cartoon_network: 56, pbs_kids: 122
    };
    var CO = {
        disney: 2, pixar: 3, lucasfilm: 1, marvel: 420, wdas: 6125, wd_productions: 3166,
        hbo_films: 7429, dc_studios: 184898, dc_entertainment: 9993, dc_films: 128064,
        apple: 194232, amazon_mgm: 210099, paramount: 4,
        warner: 174, universal: 33, columbia: 5, dreamworks: 521, dreamworks_tv: 42141, illumination: 6704,
        a24: 41077, ghibli: 10342, legendary: 923, blumhouse: 3172, wb_animation: 2785
    };
    var PROVIDER = { netflix: 8, max: 1899, prime: 9 };
    var GENRE = { animation: 16, documentary: 99, kids: 10762 };

    function isoDate(offsetDays) {
        return new Date(Date.now() + (offsetDays || 0) * DAY).toISOString().slice(0, 10);
    }

    function anyOf(ids) {
        return ids.join('|');
    }

    function query(path, params) {
        var parts = [];

        for (var key in params) parts.push(key + '=' + params[key]);

        return path + '?' + parts.join('&');
    }

    function tv(params) {
        if (!params.sort_by) params.sort_by = 'popularity.desc';

        return query('discover/tv', params);
    }

    // Movies are limited to ones already released, so announced titles don't fill the rows.
    function movie(params) {
        if (!params.sort_by) params.sort_by = 'popularity.desc';
        if (!params['primary_release_date.lte']) params['primary_release_date.lte'] = isoDate(0);

        return query('discover/movie', params);
    }

    function newTv(params) {
        params['first_air_date.gte'] = isoDate(-365);
        params['first_air_date.lte'] = isoDate(0);

        return tv(params);
    }

    function newMovies(params) {
        params['primary_release_date.gte'] = isoDate(-365);

        return movie(params);
    }

    function topRated(params, minVotes) {
        params['vote_count.gte'] = minVotes;
        params.sort_by = 'vote_average.desc';

        return params;
    }

    function onService(provider) {
        return movie({ with_watch_providers: provider, watch_region: CATALOG_REGION, 'vote_count.gte': 50 });
    }

    function title(en, ru, uk) {
        return { en: en, ru: ru, uk: uk || ru };
    }

    // Each row: [title, TMDB discover request, cache life in days]
    function brands() {
        return [
            {
                id: 'netflix', name: 'Netflix', icon: letterIcon('N'),
                rows: [
                    [title('New Netflix series', 'Новые сериалы Netflix', 'Нові серіали Netflix'), newTv({ with_networks: NET.netflix }), 1],
                    [title('Popular on Netflix', 'Популярное на Netflix', 'Популярне на Netflix'), tv({ with_networks: NET.netflix }), 2],
                    [title('Films on Netflix (US)', 'Фильмы на Netflix (США)', 'Фільми на Netflix (США)'), onService(PROVIDER.netflix), 2],
                    [title('Top rated Netflix series', 'Лучшие сериалы Netflix', 'Найкращі серіали Netflix'), tv(topRated({ with_networks: NET.netflix }, 500)), 14],
                    [title('Netflix for kids', 'Netflix для детей', 'Netflix для дітей'), tv({ with_networks: NET.netflix, with_genres: GENRE.kids }), 7],
                    [title('Netflix animation', 'Анимация Netflix', 'Анімація Netflix'), tv({ with_networks: NET.netflix, with_genres: GENRE.animation }), 7],
                    [title('Netflix documentaries', 'Документальное на Netflix', 'Документальне на Netflix'), tv({ with_networks: NET.netflix, with_genres: GENRE.documentary }), 7]
                ]
            },
            {
                id: 'hbo', name: 'HBO / Max', icon: letterIcon('HBO'),
                rows: [
                    [title('New on HBO and Max', 'Новое на HBO и Max', 'Нове на HBO та Max'), newTv({ with_networks: anyOf([NET.hbo, NET.max]) }), 1],
                    [title('HBO series', 'Сериалы HBO', 'Серіали HBO'), tv({ with_networks: NET.hbo }), 2],
                    [title('Max originals', 'Оригинальные сериалы Max', 'Оригінальні серіали Max'), tv({ with_networks: NET.max }), 2],
                    [title('Films on HBO Max (US)', 'Фильмы на HBO Max (США)', 'Фільми на HBO Max (США)'), onService(PROVIDER.max), 2],
                    [title('HBO films', 'Фильмы HBO', 'Фільми HBO'), movie({ with_companies: CO.hbo_films }), 7],
                    [title('DC movies', 'DC — фильмы', 'DC — фільми'), movie({ with_companies: anyOf([CO.dc_studios, CO.dc_entertainment, CO.dc_films]) }), 7],
                    [title('DC series', 'DC — сериалы', 'DC — серіали'), tv({ with_companies: anyOf([CO.dc_studios, CO.dc_entertainment]) }), 7],
                    [title('Top rated HBO', 'Лучшее от HBO', 'Найкраще від HBO'), tv(topRated({ with_networks: NET.hbo }, 500)), 14]
                ]
            },
            {
                id: 'disney', name: 'Disney', icon: castleIcon(),
                rows: [
                    [title('New on Disney+', 'Новое на Disney+', 'Нове на Disney+'), newTv({ with_networks: NET.disney_plus }), 1],
                    [title('New Disney movies', 'Новые фильмы Disney', 'Нові фільми Disney'), newMovies({ with_companies: anyOf([CO.disney, CO.pixar, CO.wdas, CO.marvel, CO.lucasfilm]) }), 1],
                    [title('Popular on Disney+', 'Популярное на Disney+', 'Популярне на Disney+'), tv({ with_networks: NET.disney_plus }), 2],
                    [title('Pixar', 'Pixar'), movie({ with_companies: CO.pixar }), 7],
                    [title('Walt Disney Animation', 'Walt Disney Animation'), movie({ with_companies: CO.wdas }), 7],
                    [title('Marvel movies', 'Marvel — фильмы', 'Marvel — фільми'), movie({ with_companies: CO.marvel }), 3],
                    [title('Marvel series', 'Marvel — сериалы', 'Marvel — серіали'), tv({ with_companies: CO.marvel }), 3],
                    [title('Lucasfilm movies', 'Фильмы Lucasfilm', 'Фільми Lucasfilm'), movie({ with_companies: CO.lucasfilm }), 7],
                    [title('Star Wars series', 'Звёздные войны — сериалы', 'Зоряні війни — серіали'), tv({ with_companies: CO.lucasfilm }), 7],
                    [title('Walt Disney Pictures', 'Фильмы Walt Disney Pictures', 'Фільми Walt Disney Pictures'), movie({ with_companies: CO.disney, without_companies: CO.pixar }), 7],
                    [title('Disney Junior', 'Disney Junior — для малышей', 'Disney Junior — для малят'), tv({ with_networks: NET.disney_junior }), 7],
                    [title('Disney Channel', 'Disney Channel'), tv({ with_networks: NET.disney_channel }), 7],
                    [title('Disney classics', 'Классика Disney', 'Класика Disney'), movie({ with_companies: anyOf([CO.disney, CO.wdas, CO.wd_productions]), with_genres: GENRE.animation, 'primary_release_date.lte': '1999-12-31', 'vote_count.gte': 200, sort_by: 'vote_count.desc' }), 14],
                    [title('Top rated Disney', 'Лучшее от Disney', 'Найкраще від Disney'), movie(topRated({ with_companies: anyOf([CO.disney, CO.pixar, CO.wdas]) }, 1000)), 14]
                ]
            },
            {
                id: 'apple', name: 'Apple TV+', icon: letterIcon('tv+'),
                rows: [
                    [title('New on Apple TV+', 'Новое на Apple TV+', 'Нове на Apple TV+'), newTv({ with_networks: NET.apple }), 1],
                    [title('Popular on Apple TV+', 'Популярное на Apple TV+', 'Популярне на Apple TV+'), tv({ with_networks: NET.apple }), 2],
                    [title('Apple films', 'Фильмы Apple', 'Фільми Apple'), movie({ with_companies: CO.apple }), 7],
                    [title('Top rated Apple TV+', 'Лучшее на Apple TV+', 'Найкраще на Apple TV+'), tv(topRated({ with_networks: NET.apple }, 200)), 14]
                ]
            },
            {
                id: 'prime', name: 'Prime Video', icon: letterIcon('P'),
                rows: [
                    [title('New on Prime Video', 'Новое на Prime Video', 'Нове на Prime Video'), newTv({ with_networks: NET.prime }), 1],
                    [title('Popular on Prime Video', 'Популярное на Prime Video', 'Популярне на Prime Video'), tv({ with_networks: NET.prime }), 2],
                    [title('Amazon MGM films', 'Фильмы Amazon MGM', 'Фільми Amazon MGM'), movie({ with_companies: CO.amazon_mgm }), 7],
                    [title('Films on Prime Video (US)', 'Фильмы на Prime Video (США)', 'Фільми на Prime Video (США)'), onService(PROVIDER.prime), 2],
                    [title('Top rated Prime Video', 'Лучшее на Prime Video', 'Найкраще на Prime Video'), tv(topRated({ with_networks: NET.prime }, 300)), 14]
                ]
            },
            {
                id: 'hulu', name: 'Hulu', icon: letterIcon('H'),
                rows: [
                    [title('New on Hulu', 'Новое на Hulu', 'Нове на Hulu'), newTv({ with_networks: NET.hulu }), 1],
                    [title('Popular on Hulu', 'Популярное на Hulu', 'Популярне на Hulu'), tv({ with_networks: NET.hulu }), 2],
                    [title('FX series', 'Сериалы FX', 'Серіали FX'), tv({ with_networks: NET.fx }), 7],
                    [title('Top rated Hulu', 'Лучшее на Hulu', 'Найкраще на Hulu'), tv(topRated({ with_networks: NET.hulu }, 200)), 14]
                ]
            },
            {
                id: 'paramount', name: 'Paramount+', icon: letterIcon('P+'),
                rows: [
                    [title('New on Paramount+', 'Новое на Paramount+', 'Нове на Paramount+'), newTv({ with_networks: NET.paramount_plus }), 1],
                    [title('Popular on Paramount+', 'Популярное на Paramount+', 'Популярне на Paramount+'), tv({ with_networks: NET.paramount_plus }), 2],
                    [title('New Paramount films', 'Новые фильмы Paramount', 'Нові фільми Paramount'), newMovies({ with_companies: CO.paramount }), 1],
                    [title('Paramount Pictures', 'Paramount Pictures'), movie({ with_companies: CO.paramount }), 7]
                ]
            },
            {
                id: 'studios', name: title('Studios', 'Студии', 'Студії'), icon: letterIcon('S'),
                rows: [
                    [title('Warner Bros.', 'Warner Bros.'), movie({ with_companies: CO.warner }), 7],
                    [title('Universal', 'Universal'), movie({ with_companies: CO.universal }), 7],
                    [title('Columbia Pictures', 'Columbia Pictures'), movie({ with_companies: CO.columbia }), 7],
                    [title('DreamWorks Animation', 'DreamWorks Animation'), movie({ with_companies: CO.dreamworks }), 7],
                    [title('Illumination', 'Illumination'), movie({ with_companies: CO.illumination }), 7],
                    [title('A24', 'A24'), movie({ with_companies: CO.a24 }), 7],
                    [title('Studio Ghibli', 'Студия Гибли', 'Студія Гіблі'), movie({ with_companies: CO.ghibli }), 14],
                    [title('Legendary', 'Legendary'), movie({ with_companies: CO.legendary }), 7],
                    [title('Blumhouse', 'Blumhouse'), movie({ with_companies: CO.blumhouse }), 7]
                ]
            },
            {
                id: 'kids', name: title('Kids', 'Детям', 'Дітям'), icon: letterIcon('K'),
                rows: [
                    [title('Nickelodeon', 'Nickelodeon'), tv({ with_networks: NET.nickelodeon }), 7],
                    [title('Nick Jr.', 'Nick Jr.'), tv({ with_networks: NET.nick_jr }), 7],
                    [title('Cartoon Network', 'Cartoon Network'), tv({ with_networks: NET.cartoon_network }), 7],
                    [title('PBS Kids', 'PBS Kids'), tv({ with_networks: NET.pbs_kids }), 7],
                    [title('DreamWorks movies', 'DreamWorks — мультфильмы', 'DreamWorks — мультфільми'), movie({ with_companies: CO.dreamworks }), 7],
                    [title('DreamWorks series', 'DreamWorks — мультсериалы', 'DreamWorks — мультсеріали'), tv({ with_companies: CO.dreamworks_tv }), 7],
                    [title('Illumination', 'Illumination'), movie({ with_companies: CO.illumination }), 7],
                    [title('Studio Ghibli', 'Студия Гибли', 'Студія Гіблі'), movie({ with_companies: CO.ghibli }), 14],
                    [title('Warner Bros. Animation', 'Warner Bros. Animation'), movie({ with_companies: CO.wb_animation }), 7]
                ]
            }
        ];
    }

    function letterIcon(text) {
        var size = text.length > 2 ? 8 : text.length > 1 ? 11 : 16;

        return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
            // The frame is a filled ring, not a stroke: the menu fills a highlighted icon's shapes.
            '<path fill="currentColor" fill-rule="evenodd" d="M6 1h12a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5V6a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/>' +
            '<text x="12" y="12" dy=".35em" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="' + size + '" fill="currentColor">' + text + '</text>' +
            '</svg>';
    }

    function castleIcon() {
        return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M12 1.5l1.6 3.2H12.9V7h1.6V5.6h1.4V7h1.6V4.7h-.7L18.4 2l1.6 2.7h-.7V8.5l1.7 1.3v12.7h-6.6v-4.8a2.4 2.4 0 0 0-4.8 0v4.8H3V9.8l1.7-1.3V4.7H4L5.6 2l1.6 2.7h-.7V7h1.6V5.6h1.4V7h1.6V4.7h-.7z"/>' +
            '</svg>';
    }

    function brandById(id) {
        var list = brands();

        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i];
        }

        return null;
    }

    function brandName(brand) {
        return typeof brand.name === 'string' ? brand.name : Lampa.Lang.translate('channels_' + brand.id);
    }

    function rowKey(brand, index) {
        return 'channels_' + brand.id + '_' + index;
    }

    function addTranslations() {
        var phrases = {
            channels_title:    title('Channels', 'Каналы', 'Канали'),
            channels_settings: title('Side-menu items', 'Пункты бокового меню', 'Пункти бічного меню')
        };

        brands().forEach(function (brand) {
            if (typeof brand.name !== 'string') phrases['channels_' + brand.id] = brand.name;

            brand.rows.forEach(function (row, index) {
                phrases[rowKey(brand, index)] = row[0];
            });
        });

        Lampa.Lang.add(phrases);
    }

    function main(params, oncomplite, onerror) {
        var tmdb = Lampa.Api.sources.tmdb;
        var brand = brandById(params.channel);

        if (!brand) {
            onerror();
            return function () {};
        }

        var parts = brand.rows.map(function (row, index) {
            return function (call) {
                tmdb.get(row[1], {}, function (json) {
                    json.title = Lampa.Lang.translate(rowKey(brand, index));
                    call(json);
                }, call, { life: MINUTES_PER_DAY * row[2] });
            };
        });

        function loadPart(partLoaded, partEmpty) {
            Lampa.Api.partNext(parts, 5, partLoaded, partEmpty);
        }

        loadPart(oncomplite, onerror);

        return loadPart;
    }

    function registerSource() {
        // Copy the TMDB source so anything that looks up activity.source still works,
        // but leave out discovery, so search doesn't get a duplicate TMDB tab.
        var source = {};
        var tmdb = Lampa.Api.sources.tmdb;

        for (var key in tmdb) source[key] = tmdb[key];

        delete source.discovery;
        source.main = main;

        Lampa.Api.sources[SOURCE] = source;
    }

    function open(brand) {
        Lampa.Activity.push({
            url: '',
            title: brandName(brand),
            component: 'main',
            source: SOURCE,
            channel: brand.id,
            page: 1
        });
    }

    function settingKey(brand) {
        return 'channels_show_' + brand.id;
    }

    function isShown(brand) {
        var value = Lampa.Storage.get(settingKey(brand), true);

        return value !== false && value !== 'false';
    }

    function menuItem(brand) {
        return $('.menu .menu__item[data-action="channels_' + brand.id + '"]');
    }

    // Rebuilt in brand order, so a brand turned back on returns to its own place.
    function refreshMenu() {
        brands().forEach(function (brand) {
            menuItem(brand).remove();
        });

        brands().forEach(function (brand) {
            if (!isShown(brand)) return;

            Lampa.Menu.addButton(brand.icon, brandName(brand), function () {
                open(brand);
            }).attr('data-action', 'channels_' + brand.id);
        });
    }

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addComponent({
            component: 'channels',
            name: Lampa.Lang.translate('channels_title'),
            icon: letterIcon('N')
        });

        brands().forEach(function (brand) {
            Lampa.SettingsApi.addParam({
                component: 'channels',
                param: { name: settingKey(brand), type: 'trigger', default: true },
                field: { name: brandName(brand), description: Lampa.Lang.translate('channels_settings') },
                onChange: refreshMenu
            });
        });
    }

    // A plugin added by URL in Settings → Extensions has no name and shows as "Untitled".
    // Name our entry.
    function nameSelf() {
        if (!Lampa.Plugins || !Lampa.Plugins.get) return;

        var changed = false;

        Lampa.Plugins.get().forEach(function (plugin) {
            if (plugin.url && /\/channels\.js(\?|$)/.test(plugin.url) && plugin.name !== 'Channels') {
                plugin.name = 'Channels';
                plugin.author = '@aaramg';
                changed = true;
            }
        });

        if (changed) Lampa.Plugins.save();
    }

    function start() {
        addTranslations();
        registerSource();
        addSettings();
        refreshMenu();

        try { nameSelf(); } catch (e) {}
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') start();
        });
    }
})();
