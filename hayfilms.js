/*
 * HayFilms — Lampa plugin
 * Browses hayfilms.com (Armenian films and series, and films dubbed into Armenian) inside Lampa:
 * a side-menu page of rows, genre tiles and a filter, a search tab, and a "HayFilms" button on the
 * card that plays the best stream the page offers (csst/fsst mp4 up to 1080p, YouTube, armdb, ok.ru).
 * The site has no API, so pages are fetched as HTML (native Android request, so CORS doesn't apply).
 * Targets Lampa 3.x. Written in ES5 for old Android TV WebViews (Crosswalk).
 */
(function () {
    'use strict';

    if (window.plugin_hayfilms_ready) return;
    window.plugin_hayfilms_ready = true;

    var SOURCE = 'hayfilms';
    var SITE = 'https://hayfilms.com';
    // Lampa keys history, bookmarks and timelines by card id; keep ours clear of TMDB ids.
    var ID_OFFSET = 900000000;
    var CACHE_MS = 1000 * 60 * 20;
    var PER_PAGE = 12;

    // `am` is the Armenian site's slug (what we browse), `ru` the Russian one (what search returns).
    var CATEGORIES = [
        { id: 'arm_series', am: 'haykakan-serialner', ru: 'armyanskie-seriali', title: 'Հայկական սերիալներ' },
        { id: 'arm_movies', am: 'haykakan-filmer', ru: 'armyanskie-filmi', title: 'Հայկական ֆիլմեր' },
        { id: 'tr_series', am: 'serialner-hayeren-targmanutyamb', ru: 'seriali-na-armyanskom', title: 'Սերիալներ հայերեն թարգմանությամբ' },
        { id: 'tr_movies', am: 'filmer-hayeren', ru: 'filmi-na-armyanskom', title: 'Ֆիլմեր հայերեն թարգմանությամբ' },
        { id: 'dorama', am: 'doramaner-hayeren', ru: 'dorammi-na-armyanskom', title: 'Դորամաներ հայերեն' },
        { id: 'cartoons', am: 'multfilmer-hayeren', ru: 'multfilmy-armjanskim-perevodom', title: 'Մուլտֆիլմեր հայերեն' },
        { id: 'old', am: 'haykakan-hin-filmer', ru: 'armyanskie-starie-filmi', title: 'Հին հայկական ֆիլմեր' }
    ];

    // Russian-language sections: Lampa already has all of that, so they never show.
    var EXCLUDED_SLUGS = ['filmrus', 'filmerrussern'];

    // The site files genres under both Armenian and Russian names; each filter genre asks for all of them.
    // Mostly watched with children, so their genres come first.
    var GENRES = [
        { title: 'Մուլտֆիլմ', values: ['Մուլտֆիլմ'] },
        { title: 'Ընտանեկան', values: ['Ընտանեկան', 'ընտանեկան', 'Семейный'] },
        { title: 'Մանկական', values: ['Մանկական', 'Детский'] },
        { title: 'Արկածային', values: ['Արկածային', 'արկածային', 'Приключения'] },
        { title: 'Կատակերգություն', values: ['Կատակերգություն', 'Կոմեդիա', 'Комедия'] },
        { title: 'Ֆենտեզի', values: ['Ֆենտեզի', 'ֆենտեզի', 'Фэнтези'] },
        { title: 'Ֆանտաստիկա', values: ['Ֆանտաստիկա', 'ֆանտաստիկա', 'Фантастика'] },
        { title: 'Դրամա', values: ['Դրամա', 'Драма'] },
        { title: 'Մելոդրամա', values: ['Մելոդրամա', 'Мелодрама', 'мелодрама'] },
        { title: 'Մարտաֆիլմ', values: ['Մարտաֆիլմ', 'Боевик'] },
        { title: 'Քրեական', values: ['Քրեական', 'Криминал'] },
        { title: 'Դետեկտիվ', values: ['Դետեկտիվ', 'Детектив'] },
        { title: 'Թրիլլեր', values: ['Թրիլլեր', 'Триллер'] },
        { title: 'Պատմական', values: ['Պատմական', 'Исторические'] },
        { title: 'Ռազմական', values: ['Ռազմական', 'Պատերազմական', 'Военный'] },
        { title: 'Կենսագրական', values: ['Կենսագրություն', 'Биография'] },
        { title: 'Ռոմանտիկա', values: ['Ռոմանտիկա'] },
        { title: 'Սարսափ', values: ['Սարսափ', 'Ужасы'] },
        { title: 'Սպորտ', values: ['Սպորտ', 'Спорт'] },
        { title: 'Երաժշտական', values: ['Երաժշտական', 'Музыкальный', 'Мюзикл'] },
        { title: 'Սիթքոմ', values: ['Սիթքոմ', 'Ситком'] },
        { title: 'Վավերագրական', values: ['Վավերագրական'] },
        { title: 'Վեսթերն', values: ['Վեսթերն'] }
    ];

    var DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];

    var KIDS_TITLE = 'Երեխաների համար';
    var FAMILY_TITLE = 'Ընտանեկան ֆիլմեր';

    // Films to watch with children: these genres (Harry Potter is filed as adventure + fantasy)...
    var FAMILY_GENRES = ['Ընտանեկան', 'Մանկական', 'Ֆենտեզի', 'Ֆանտաստիկա', 'Արկածային'];
    // ...minus anything also filed under these.
    var GROWN_UP_GENRES = ['Սարսափ', 'Թրիլլեր', 'Քրեական', 'Մարտաֆիլմ', 'Ռազմական'];

    // The HayFilms page, top to bottom. Children's rows sit right under the new arrivals.
    var MAIN_ROWS = [
        { title: 'Նոր ավելացված', query: {}, limit: 24 },
        { title: 'Մուլտֆիլմեր և մանկական', query: { kids: '1' } },
        { title: FAMILY_TITLE, query: { family: '1' } },
        { cat: 'arm_series' },
        { cat: 'arm_movies' },
        { tiles: true },
        { title: 'Կատակերգություն', query: { genre: 'Կատակերգություն' } },
        { cat: 'tr_movies' },
        { cat: 'tr_series' },
        { cat: 'dorama' },
        { cat: 'old' },
        { title: 'Ֆանտաստիկա', query: { genre: 'Ֆանտաստիկա' } },
        { title: 'Արկածային', query: { genre: 'Արկածային' } },
        { title: 'Պատմական', query: { genre: 'Պատմական' } }
    ];

    // Stream hosts we can play, best first. Others on the site (VK, mail.ru, ...) are left out.
    var HOSTS = [
        { id: 'incvideo', name: 'HD', test: /(?:fsst|csst|incvideo\d*)\.online\/embed\//i },
        { id: 'youtube', name: 'YouTube', test: /youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\//i },
        { id: 'armdb', name: 'ArmDB', test: /armdb\.net\/embed\//i },
        { id: 'okru', name: 'OK', test: /ok\.ru\/videoembed\//i }
    ];

    var OKRU_QUALITY = { mobile: '144p', lowest: '240p', low: '360p', sd: '480p', hd: '720p', full: '1080p', quad: '1440p', ultra: '2160p' };

    var ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path fill="currentColor" fill-rule="evenodd" d="M6 1h12a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5V6a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/>' +
        '<path fill="currentColor" d="M9.5 7.5v9l7-4.5z"/>' +
        '</svg>';

    /* ---------- network ---------- */

    var pageCache = {};
    // Players of each opened page, by site id. Kept out of the card, which Lampa saves in history.
    var playersById = {};

    function absolute(url) {
        if (!url) return '';
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.charAt(0) === '/') return SITE + url;
        return url;
    }

    function fetchText(url, onload, onfail) {
        var hit = pageCache[url];

        if (hit && Date.now() - hit.time < CACHE_MS) {
            setTimeout(function () { onload(hit.text); }, 0);
            return;
        }

        var network = new Lampa.Reguest();

        network.timeout(20000);
        network.native(url, function (text) {
            if (typeof text !== 'string') text = text && text.responseText ? text.responseText : String(text || '');

            pageCache[url] = { text: text, time: Date.now() };
            onload(text);
        }, function (error) {
            if (onfail) onfail(error);
        }, false, {
            dataType: 'text',
            headers: { 'User-Agent': navigator.userAgent }
        });
    }

    function parseHtml(text) {
        return new DOMParser().parseFromString(text, 'text/html');
    }

    /* ---------- parsing ---------- */

    function hasArmenian(text) {
        return /[Ա-֏]/.test(text);
    }

    function clean(text) {
        return (text || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    // "Լուսէ / Luse (Սերիա 1-57) (2026)" -> title Լուսէ, original Luse, year 2026, episodes "1-57"
    function parseTitle(raw) {
        var text = clean(raw);
        var info = { year: '', episodes: '', status: '' };
        var year = text.match(/\((\d{4})\)\s*$/) || text.match(/(\d{4})\)?\s*$/);
        var episodes = text.match(/(?:Սերիա|Серия|Серии|Seria)\s*([\d]+(?:\s*[-–]\s*\d+)?)/i);
        var status = text.match(/Թրեյլեր|Անոնս|Շուտով/);

        if (year) info.year = year[1];
        if (episodes) info.episodes = episodes[1].replace(/\s+/g, '');
        if (status) info.status = status[0];

        text = text
            .replace(/\([^)]*(?:\d{4}|Սերիա|Серия|Серии|Seria|Թրեյլեր|Անոնս|Շուտով)[^)]*\)/gi, '')
            .replace(/[-–]\s*(?:Սերիա|Серия|Серии|Seria)\s*[\d\s\-–]*/gi, '')
            .replace(/\s+\d{4}\s*$/, '')
            .replace(/[\s\-–:]+$/, '');

        var parts = text.split(/\s+\/\s+/);
        var main = parts[0];

        for (var i = 0; i < parts.length; i++) {
            if (hasArmenian(parts[i])) {
                main = parts[i];
                break;
            }
        }

        var rest = parts.filter(function (part) { return part !== main; });

        info.title = clean(main);
        info.original = clean(rest.join(' / ')) || info.title;

        return info;
    }

    function slugOf(url) {
        var match = (url || '').match(/hayfilms\.com\/(?:am\/|en\/)?([^\/]+)\//);
        return match ? match[1] : '';
    }

    function categoryOf(url) {
        var slug = slugOf(url);

        for (var i = 0; i < CATEGORIES.length; i++) {
            if (CATEGORIES[i].am === slug || CATEGORIES[i].ru === slug) return CATEGORIES[i];
        }

        return null;
    }

    function isExcluded(url) {
        return EXCLUDED_SLUGS.indexOf(slugOf(url)) >= 0;
    }

    function siteId(url) {
        var match = (url || '').match(/\/(\d+)-[^\/]*\.html/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function makeCard(url, title, poster) {
        var info = parseTitle(title);
        var id = siteId(url);
        var badge = info.status || (info.episodes ? info.episodes + ' սեր.' : '');

        return {
            id: ID_OFFSET + id,
            hf_id: id,
            hf_url: url,
            source: SOURCE,
            title: info.title,
            original_title: info.original,
            img: absolute(poster),
            release_date: info.year ? info.year + '-01-01' : '',
            release_quality: badge,
            vote_average: 0,
            overview: ''
        };
    }

    function parseCards(doc) {
        var anchors = doc.querySelectorAll('a.poster.grid-item');
        var cards = [];
        var seen = {};

        for (var i = 0; i < anchors.length; i++) {
            var a = anchors[i];

            // Recommendations on a detail page are not part of the listing.
            if (a.parentNode && a.parentNode.closest && a.parentNode.closest('.pmovie__related')) continue;

            var url = absolute(a.getAttribute('href'));
            var img = a.querySelector('img');
            var name = a.querySelector('.poster__title');
            var title = (img && img.getAttribute('alt')) || (name && name.textContent) || '';

            if (!siteId(url) || seen[url] || isExcluded(url)) continue;

            seen[url] = true;
            cards.push(makeCard(url, title, img && (img.getAttribute('data-src') || img.getAttribute('src'))));
        }

        return cards;
    }

    function parseTotalPages(doc) {
        var links = doc.querySelectorAll('.pagination a, .navigation a');
        var max = 1;

        for (var i = 0; i < links.length; i++) {
            var match = (links[i].getAttribute('href') || '').match(/\/page\/(\d+)\//) ||
                (links[i].getAttribute('onclick') || '').match(/list_submit\((\d+)\)/);

            if (match) max = Math.max(max, parseInt(match[1], 10));
        }

        return max;
    }

    function hostOf(url) {
        for (var i = 0; i < HOSTS.length; i++) {
            if (HOSTS[i].test.test(url)) return HOSTS[i];
        }

        return null;
    }

    // Each player tab holds one film, or a series as a <select> or as episode buttons.
    function parsePlayers(doc) {
        var block = doc.querySelector('.pmovie__player.tabs-block');
        var players = [];

        if (!block) return players;

        var labels = block.querySelectorAll('.tabs-block__select span');
        var contents = block.querySelectorAll('.tabs-block__content');

        for (var i = 0; i < contents.length; i++) {
            var label = labels[i] ? clean(labels[i].textContent) : '';
            var box = contents[i];
            var episodes = [];

            if (/Русск|Ռուս/i.test(label)) continue;

            var options = box.querySelectorAll('select option[value]');
            var buttons = box.querySelectorAll('a.ep-btn[href]');

            if (options.length) {
                for (var o = 0; o < options.length; o++) episodes.push({ title: clean(options[o].textContent), url: absolute(options[o].getAttribute('value')) });
            }
            else if (buttons.length) {
                for (var b = 0; b < buttons.length; b++) episodes.push({ title: clean(buttons[b].textContent), url: absolute(buttons[b].getAttribute('href')) });
            }
            else {
                var frame = box.querySelector('iframe');
                var src = frame && (frame.getAttribute('src') || frame.getAttribute('data-src'));

                if (src) episodes.push({ title: '', url: absolute(src) });
            }

            episodes = episodes.filter(function (episode) { return hostOf(episode.url); });

            if (!episodes.length) continue;

            players.push({ label: label, host: hostOf(episodes[0].url), episodes: episodes, series: !!(options.length || buttons.length) });
        }

        // Best host first; within a host keep the site's order.
        players.sort(function (a, b) {
            return HOSTS.indexOf(a.host) - HOSTS.indexOf(b.host) || 0;
        });

        return players;
    }

    function infoRows(doc) {
        var rows = {};
        var items = doc.querySelectorAll('.pmovie__header-list li');

        for (var i = 0; i < items.length; i++) {
            var spans = [];

            for (var c = 0; c < items[i].children.length; c++) {
                if (items[i].children[c].tagName === 'SPAN') spans.push(items[i].children[c]);
            }

            if (spans.length < 2) continue;

            var label = clean(spans[0].textContent).replace(/:$/, '');
            var values = [];
            var links = spans[1].querySelectorAll('a');

            if (links.length) {
                for (var l = 0; l < links.length; l++) values.push(clean(links[l].textContent));
            }
            else values = clean(spans[1].textContent).split(/\s*,\s*/);

            if (/Год|Տարեթիվ|Year/i.test(label)) rows.year = values[0];
            else if (/Страна|Երկիր|Country/i.test(label)) rows.country = values;
            else if (/Жанр|Ժանր|Genre/i.test(label)) rows.genre = values;
            else if (/Режисс|Ռեժիսոր|Director/i.test(label)) rows.director = values;
            else if (/В ролях|Դերերում|Cast|Starring/i.test(label)) rows.cast = values;
        }

        return rows;
    }

    function parseDetail(text, url) {
        var doc = parseHtml(text);
        var h1 = doc.querySelector('h1');
        var poster = doc.querySelector('.pmovie__poster img');
        var descr = doc.querySelector('.full-text [itemprop="description"]') || doc.querySelector('.full-text');
        var rows = infoRows(doc);
        var card = makeCard(url, h1 ? h1.textContent : '', poster && (poster.getAttribute('data-src') || poster.getAttribute('src')));
        var overview = descr ? clean(descr.textContent) : '';
        var extra = [];

        if (rows.year && !card.release_date) card.release_date = rows.year + '-01-01';
        if (rows.director && rows.director.length) extra.push('Ռեժիսոր՝ ' + rows.director.join(', '));
        if (rows.cast && rows.cast.length) extra.push('Դերերում՝ ' + rows.cast.join(', '));

        card.overview = overview + (extra.length ? '\n\n' + extra.join('\n') : '');
        // A genre tag on the card opens our grid for it (Lampa pushes category_full with genre.url).
        card.genres = (rows.genre || []).map(function (name, index) {
            var genre = genreByValue(name);

            return { id: index + 1, name: genre.title, url: encodeQuery({ genre: genre.title }) };
        });
        card.production_countries = (rows.country || []).map(function (name) { return { iso_3166_1: '', name: name }; });
        card.production_companies = [];
        card.background_image = card.img;

        var players = parsePlayers(doc);
        var series = players.filter(function (player) { return player.series; })[0];

        if (series) card.number_of_episodes = series.episodes.length;

        var related = [];
        var anchors = doc.querySelectorAll('.pmovie__related a.poster');

        for (var i = 0; i < anchors.length; i++) {
            var href = absolute(anchors[i].getAttribute('href'));
            var img = anchors[i].querySelector('img');

            if (!siteId(href) || isExcluded(href)) continue;

            related.push(makeCard(href, img ? img.getAttribute('alt') : '', img && (img.getAttribute('data-src') || img.getAttribute('src'))));
        }

        return { card: card, players: players, related: related };
    }

    /* ---------- listings ---------- */

    // A listing query is kept in the activity url, e.g. "cat=haykakan-serialner&genre=Դրամա&decade=2010".
    function encodeQuery(query) {
        var parts = [];

        for (var key in query) {
            if (query[key]) parts.push(key + '=' + encodeURIComponent(query[key]));
        }

        return parts.join('&');
    }

    function decodeQuery(url) {
        var query = {};

        (url || '').split('&').forEach(function (part) {
            var pair = part.split('=');

            if (pair[0]) query[pair[0]] = decodeURIComponent(pair.slice(1).join('='));
        });

        return query;
    }

    function categoryById(id) {
        for (var i = 0; i < CATEGORIES.length; i++) {
            if (CATEGORIES[i].id === id) return CATEGORIES[i];
        }

        return null;
    }

    function genreByTitle(title) {
        for (var i = 0; i < GENRES.length; i++) {
            if (GENRES[i].title === title) return GENRES[i];
        }

        return title ? { title: title, values: [title] } : null;
    }

    // The site's genre name (Armenian or Russian) -> our genre, or a genre of its own.
    function genreByValue(value) {
        for (var i = 0; i < GENRES.length; i++) {
            if (GENRES[i].values.indexOf(value) >= 0 || GENRES[i].title.toLowerCase() === value.toLowerCase()) return GENRES[i];
        }

        return { title: value, values: [value] };
    }

    function pagedUrl(base, page) {
        return page > 1 ? base + 'page/' + page + '/' : base;
    }

    function genreBases(titles) {
        var bases = [];

        titles.forEach(function (title) {
            genreByTitle(title).values.forEach(function (value) {
                bases.push(SITE + '/am/xfsearch/genre/' + encodeURIComponent(value) + '/');
            });
        });

        return bases;
    }

    // Site listings that answer the query, before the client-side filters.
    function listingBases(query) {
        var genre = genreByTitle(query.genre);
        var category = categoryById(query.cat);

        // Cartoons section plus everything tagged cartoon or children's, whatever its section.
        if (query.kids) {
            return [SITE + '/am/' + categoryById('cartoons').am + '/'].concat(genreBases(['Մուլտֆիլմ', 'Մանկական']));
        }

        if (query.family) return genreBases(FAMILY_GENRES);

        if (genre) return genreBases([genre.title]);

        if (category) return [SITE + '/am/' + category.am + '/'];

        if (query.decade) {
            var years = [];
            var from = parseInt(query.decade, 10);

            for (var y = from; y < from + 10; y++) years.push(SITE + '/am/xfsearch/year/' + y + '/');

            return years;
        }

        return CATEGORIES.map(function (item) { return SITE + '/am/' + item.am + '/'; });
    }

    function yearOf(card) {
        return parseInt((card.release_date || '').slice(0, 4), 10) || 0;
    }

    function passesFilters(card, query) {
        if (query.family && grownUp.ids[card.hf_id]) return false;

        if (query.cat && query.genre) {
            var category = categoryOf(card.hf_url);

            if (!category || category.id !== query.cat) return false;
        }

        if (query.decade && (query.genre || query.cat || query.kids || query.family)) {
            var from = parseInt(query.decade, 10);
            var year = yearOf(card);

            if (year < from || year >= from + 10) return false;
        }

        return true;
    }

    // Page counts seen per listing, so merged listings stop asking for pages a listing doesn't have.
    var listingTotals = {};

    // Requests from the TV are slow (a page of rows takes ~20 s), so parsed listing pages are kept
    // on the device: a page under STALE_MS is used as is, an older one (up to KEEP_MS) is shown
    // at once and re-read in the background for next time.
    var LISTINGS_KEY = 'hayfilms_listings';
    var STALE_MS = 1000 * 60 * 60;
    var KEEP_MS = 1000 * 60 * 60 * 24 * 2;
    var MAX_LISTINGS = 160;
    var listings = null;
    var saveTimer = 0;

    function storedListings() {
        if (!listings) {
            listings = Lampa.Storage.get(LISTINGS_KEY, '{}') || {};

            if (typeof listings === 'string') {
                try { listings = JSON.parse(listings); } catch (e) { listings = {}; }
            }
        }

        return listings;
    }

    function saveListings() {
        clearTimeout(saveTimer);

        saveTimer = setTimeout(function () {
            var all = storedListings();
            var urls = Object.keys(all).filter(function (url) { return Date.now() - all[url].time < KEEP_MS; });

            urls.sort(function (a, b) { return all[b].time - all[a].time; });

            var kept = {};

            urls.slice(0, MAX_LISTINGS).forEach(function (url) { kept[url] = all[url]; });

            listings = kept;
            Lampa.Storage.set(LISTINGS_KEY, kept);
        }, 2000);
    }

    function readListing(base, page, done) {
        var url = pagedUrl(base, page);

        fetchText(url, function (text) {
            var doc = parseHtml(text);
            var answer = { results: parseCards(doc), total_pages: Math.max(parseTotalPages(doc), page) };

            storedListings()[url] = { time: Date.now(), results: answer.results, total_pages: answer.total_pages };
            saveListings();
            done(answer);
        }, function () {
            // A genre or year with no titles answers 404.
            var answer = { results: [], total_pages: page === 1 ? 0 : page - 1 };

            storedListings()[url] = { time: Date.now(), results: [], total_pages: answer.total_pages };
            saveListings();
            done(answer);
        });
    }

    function fetchListing(base, page, done) {
        if (listingTotals[base] !== undefined && page > listingTotals[base]) {
            return setTimeout(function () { done({ results: [], total_pages: listingTotals[base] }); }, 0);
        }

        var finish = function (answer) {
            listingTotals[base] = answer.total_pages;
            done(answer);
        };

        var kept = storedListings()[pagedUrl(base, page)];
        var age = kept ? Date.now() - kept.time : Infinity;

        if (age < KEEP_MS) {
            setTimeout(function () { finish({ results: kept.results, total_pages: kept.total_pages }); }, 0);

            if (age >= STALE_MS) readListing(base, page, function () {});

            return;
        }

        readListing(base, page, finish);
    }

    function gather(tasks, done) {
        var answers = [];
        var left = tasks.length;

        if (!left) return done(answers);

        tasks.forEach(function (task, index) {
            task(function (answer) {
                answers[index] = answer;
                left--;

                if (!left) done(answers);
            });
        });
    }

    // Every title filed under a grown-up genre. Reading them all takes some 35 pages, so the set is
    // stored on the device; a stale set is used at once and refreshed in the background.
    var GROWN_UP_KEY = 'hayfilms_grown_up';
    var GROWN_UP_LIFE = 1000 * 60 * 60 * 24 * 3;
    var grownUp = storedGrownUp();
    var grownUpLoading = false;

    function storedGrownUp() {
        var stored = Lampa.Storage.get(GROWN_UP_KEY, '{}') || {};
        var ids = {};

        if (typeof stored === 'string') {
            try { stored = JSON.parse(stored); } catch (e) { stored = {}; }
        }

        (stored.ids || []).forEach(function (id) { ids[id] = true; });

        return { ids: ids, time: stored.time || 0 };
    }

    function grownUpReady() {
        return grownUp.time > 0;
    }

    var grownUpWaiting = [];

    // First run on a device: the family list has to wait for the set once.
    function waitGrownUp(done) {
        grownUpWaiting.push(done);

        loadGrownUp(function () {
            var waiting = grownUpWaiting;

            grownUpWaiting = [];
            waiting.forEach(function (call) { call(); });
        });
    }

    function loadGrownUp(done) {
        if (grownUpLoading) return;

        grownUpLoading = true;

        var ids = {};

        gather(genreBases(GROWN_UP_GENRES).map(function (base) {
            return function (call) {
                fetchListing(base, 1, function (first) {
                    var rest = [];

                    for (var page = 2; page <= first.total_pages; page++) {
                        rest.push((function (number) {
                            return function (next) { fetchListing(base, number, next); };
                        })(page));
                    }

                    gather(rest, function (answers) {
                        [first].concat(answers).forEach(function (answer) {
                            answer.results.forEach(function (card) { ids[card.hf_id] = true; });
                        });

                        call();
                    });
                });
            };
        }), function () {
            grownUp = { ids: ids, time: Date.now() };
            grownUpLoading = false;

            Lampa.Storage.set(GROWN_UP_KEY, { ids: Object.keys(ids).map(Number), time: grownUp.time });

            if (done) done();
        });
    }

    // Reads site pages from `from` on, every base listing at once, merged newest first. When the
    // filters thin a page out it reads on (a few pages at most) until there's a screenful.
    // Answers {results, last: the last site page read, total: the site's page count}.
    function queryPages(query, from, done) {
        var bases = listingBases(query);
        var seen = {};
        var results = [];
        var total = 0;
        var page = from;

        if (query.family && Date.now() - grownUp.time >= GROWN_UP_LIFE) {
            if (!grownUpReady()) return waitGrownUp(function () { queryPages(query, from, done); });

            loadGrownUp();
        }

        function read() {
            gather(bases.map(function (base) {
                return function (call) { fetchListing(base, page, call); };
            }), function (answers) {
                answers.forEach(function (answer) {
                    total = Math.max(total, answer.total_pages);

                    answer.results.forEach(function (card) {
                        if (seen[card.hf_id] || !passesFilters(card, query)) return;

                        seen[card.hf_id] = true;
                        results.push(card);
                    });
                });

                if (results.length < PER_PAGE && page < total && page - from < 4) {
                    page++;
                    return read();
                }

                if (bases.length > 1) results.sort(function (a, b) { return b.hf_id - a.hf_id; });

                done({ results: results, last: page, total: Math.max(total, page) });
            });
        }

        read();
    }

    // The site also matches descriptions ("Հարրի" finds films that mention Harry), newest first;
    // put the titles that contain the words first, keeping the site's order otherwise.
    function rankByTitle(cards, text) {
        var words = text.toLowerCase().split(/\s+/).filter(function (word) { return word.length > 1; });

        function score(card) {
            var title = (card.title + ' ' + card.original_title).toLowerCase();
            var hits = 0;

            words.forEach(function (word) { if (title.indexOf(word) >= 0) hits++; });

            return hits;
        }

        return cards
            .map(function (card, index) { return { card: card, score: score(card), index: index }; })
            .sort(function (a, b) { return b.score - a.score || a.index - b.index; })
            .map(function (entry) { return entry.card; });
    }

    function searchPage(text, page, done) {
        var url = SITE + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(text) +
            (page > 1 ? '&search_start=' + page + '&result_from=' + ((page - 1) * PER_PAGE + 1) : '');

        fetchText(url, function (html) {
            var doc = parseHtml(html);

            done({ results: rankByTitle(parseCards(doc), text), page: page, total_pages: parseTotalPages(doc) });
        }, function () {
            done({ results: [], page: page, total_pages: 0 });
        });
    }

    function queryTitle(query) {
        var parts = [];
        var category = categoryById(query.cat);

        if (query.search) return 'HayFilms — ' + query.search;
        if (query.kids) parts.push(KIDS_TITLE);
        if (query.family) parts.push(FAMILY_TITLE);
        if (category) parts.push(category.title);
        if (query.genre) parts.push(query.genre);
        if (query.decade) parts.push(query.decade + '-ականներ');

        return parts.length ? parts.join(' · ') : 'HayFilms';
    }

    /* ---------- tiles (genre and filter cards) ---------- */

    var TILE_COLORS = [
        ['#e50914', '#5c0208'], ['#ff8a00', '#7a2e00'], ['#2f80ed', '#0b2a5c'], ['#9b51e0', '#3a0f63'],
        ['#27ae60', '#0b4224'], ['#eb5757', '#5e1414'], ['#00a8a8', '#063f3f'], ['#f2c94c', '#6b4d00']
    ];

    function escapeXml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function tileImage(text, index, symbol) {
        var color = TILE_COLORS[index % TILE_COLORS.length];
        var size = text.length > 12 ? 30 : text.length > 8 ? 36 : 44;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + color[0] + '"/><stop offset="1" stop-color="' + color[1] + '"/>' +
            '</linearGradient></defs>' +
            '<rect width="400" height="600" fill="url(#g)"/>' +
            (symbol ? '<text x="200" y="250" text-anchor="middle" font-size="120" fill="#fff" fill-opacity=".9" font-family="Arial, sans-serif">' + symbol + '</text>' : '') +
            '<text x="200" y="' + (symbol ? 380 : 315) + '" text-anchor="middle" font-size="' + size + '" font-weight="bold" fill="#fff" ' +
            'font-family="Noto Sans Armenian, Arial, sans-serif">' + escapeXml(text) + '</text>' +
            '</svg>';

        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function tile(title, action, index, symbol) {
        return {
            id: ID_OFFSET - 1000 - index,
            source: SOURCE,
            title: title,
            original_title: title,
            img: tileImage(title, index, symbol),
            hf_action: action
        };
    }

    function tilesRow() {
        var results = [
            tile('Ֆիլտր', { filter: true }, 0, '☰'),
            tile(KIDS_TITLE, { query: { kids: '1' } }, 1, '★'),
            tile(FAMILY_TITLE, { query: { family: '1' } }, 2, '♥')
        ];

        GENRES.forEach(function (genre, index) {
            results.push(tile(genre.title, { query: { genre: genre.title } }, index + 3));
        });

        return { title: 'Ժանրեր', results: results, total_pages: 1, source: SOURCE };
    }

    function openListing(query, replace) {
        var activity = {
            url: encodeQuery(query),
            title: queryTitle(query),
            component: 'category_full',
            source: SOURCE,
            page: 1
        };

        if (replace) Lampa.Activity.replace(activity, true);
        else Lampa.Activity.push(activity);
    }

    function selectStep(title, items, current, onSelect, onBack) {
        Lampa.Select.show({
            title: title,
            items: items.map(function (item) {
                return { title: item.title, value: item.value, selected: item.value === current };
            }),
            onSelect: function (item) { onSelect(item.value); },
            onBack: onBack
        });
    }

    // Category -> genre -> decade, each with "any". Ends by opening the matching grid.
    function showFilter(done, cancel) {
        var query = {};
        var anyItem = { title: 'Բոլորը', value: '' };

        var sections = [anyItem, { title: KIDS_TITLE, value: 'kids' }, { title: FAMILY_TITLE, value: 'family' }].concat(CATEGORIES.map(function (c) { return { title: c.title, value: c.id }; }));

        function pickDecade() {
            selectStep('Տարիներ', [anyItem].concat(DECADES.map(function (d) { return { title: d + '-ականներ', value: String(d) }; })), '', function (decade) {
                query.decade = decade;
                done(query);
            }, cancel);
        }

        selectStep('Բաժին', sections, '', function (cat) {
            if (cat === 'kids' || cat === 'family') {
                query[cat] = '1';
                return pickDecade();
            }

            query.cat = cat;

            selectStep('Ժանր', [anyItem].concat(GENRES.map(function (g) { return { title: g.title, value: g.title }; })), '', function (genre) {
                query.genre = genre;
                pickDecade();
            }, cancel);
        }, cancel);
    }

    /* ---------- source ---------- */

    function list(params, oncomplite, onerror) {
        var query = decodeQuery(params.url);
        var page = parseInt(params.page, 10) || 1;
        var finish = function (json) {
            if (!json.results.length && page === 1) onerror();
            else oncomplite(json);
        };

        if (query.search) return searchPage(query.search, page, finish);

        // Lampa counts its own pages; the site pages already read are remembered on the activity.
        queryPages(query, Math.max(page, params.hf_next || 1), function (answer) {
            params.hf_next = answer.last + 1;

            finish({ results: answer.results, page: page, total_pages: answer.last < answer.total ? page + 1 : page });
        });
    }

    function main(params, oncomplite, onerror) {
        var rows = MAIN_ROWS.map(function (row) {
            if (row.tiles) return function (call) { call(tilesRow()); };

            var category = categoryById(row.cat);
            var query = category ? { cat: category.id } : row.query;
            var title = category ? category.title : row.title;

            return function (call) {
                queryPages(query, 1, function (answer) {
                    call({
                        title: title,
                        results: row.limit ? answer.results.slice(0, row.limit) : answer.results,
                        total_pages: answer.total,
                        url: encodeQuery(query),
                        source: SOURCE
                    });
                });
            };
        });

        function loadPart(partLoaded, partEmpty) {
            // Two rows fill the first screen; the rest load as the viewer scrolls.
            Lampa.Api.partNext(rows, 2, partLoaded, partEmpty);
        }

        loadPart(oncomplite, onerror);

        return loadPart;
    }

    function full(params, oncomplite, onerror) {
        var card = params.card || {};

        // Genre and filter tiles open like cards; turn the card page into the grid they stand for.
        if (card.hf_action) {
            setTimeout(function () {
                if (card.hf_action.filter) {
                    showFilter(function (query) { openListing(query, true); }, function () { Lampa.Activity.backward(); });
                }
                else openListing(card.hf_action.query, true);
            }, 10);

            return;
        }

        if (!card.hf_url) return onerror();

        fetchText(card.hf_url, function (text) {
            var parsed = parseDetail(text, card.hf_url);

            playersById[parsed.card.hf_id] = parsed.players;

            // Keep what the listing knew if the page lacks it (e.g. the poster).
            for (var key in card) {
                if (parsed.card[key] === undefined || parsed.card[key] === '') parsed.card[key] = card[key];
            }

            // The episode badge suits a poster; the card page would show it as "Quality".
            parsed.card.release_quality = '';

            oncomplite({
                movie: parsed.card,
                simular: parsed.related.length ? { results: parsed.related } : undefined
            });
        }, onerror);
    }

    function search(params, oncomplite) {
        var text = decodeURIComponent(params.query || '');

        searchPage(text, 1, function (json) {
            json.title = 'HayFilms';
            json.query = text;
            oncomplite(json.results.length ? [json] : []);
        });
    }

    function discovery() {
        return {
            title: 'HayFilms',
            search: search,
            params: { save: true },
            onSelect: function (params, close) {
                close();
                Lampa.Router.call('full', params.element);
            },
            onMore: function (params, close) {
                close();
                openListing({ search: params.query });
            },
            onCancel: function () {}
        };
    }

    function registerSource() {
        var source = {};
        var tmdb = Lampa.Api.sources.tmdb;

        // Anything we don't answer (persons, seasons, ...) falls back to TMDB.
        for (var key in tmdb) source[key] = tmdb[key];

        source.main = main;
        source.list = list;
        source.category = list;
        source.full = full;
        source.search = search;
        source.discovery = discovery;

        Lampa.Api.sources[SOURCE] = source;
    }

    /* ---------- playback ---------- */

    function pick(text, pattern) {
        var match = text.match(pattern);
        return match ? match[1] : '';
    }

    function qualityRank(label) {
        return parseInt(label, 10) || 0;
    }

    // Lampa wants {url, quality:{"1080p": url, ...}} with the best quality as url.
    function withQualities(map) {
        var labels = Object.keys(map).sort(function (a, b) { return qualityRank(b) - qualityRank(a); });

        if (!labels.length) return null;

        return { url: map[labels[0]], quality: labels.length > 1 ? map : null, best: labels[0] };
    }

    function youtubeId(url) {
        return pick(url, /(?:embed\/|youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/);
    }

    function resolveIncvideo(url, done, fail) {
        fetchText(url, function (text) {
            var file = pick(text, /file\s*:\s*["']([^"']+)["']/);
            var map = {};

            if (!file) return fail();

            file.split(',').forEach(function (part) {
                var match = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/);

                if (match) map[match[1]] = match[2];
                else if (/^https?:/.test(part)) map['720p'] = part;
            });

            var stream = withQualities(map);

            if (!stream) return fail();

            stream.no_referrer = true;
            done(stream);
        }, fail);
    }

    function resolveArmdb(url, done, fail) {
        fetchText(url, function (text) {
            var path = pick(text, /baseStreamUrl\s*=\s*["']([^"']+)["']/);

            if (!path) return fail();

            done({ url: path.charAt(0) === '/' ? 'https://armdb.net' + path : path, best: 'HLS' });
        }, fail);
    }

    function resolveOkru(url, done, fail) {
        fetchText(url, function (text) {
            var doc = parseHtml(text);
            var node = doc.querySelector('[data-options]');
            var map = {};

            try {
                var options = JSON.parse(node.getAttribute('data-options'));
                var meta = options.flashvars.metadata;

                if (typeof meta === 'string') meta = JSON.parse(meta);

                (meta.videos || []).forEach(function (video) {
                    if (OKRU_QUALITY[video.name] && !video.disallowed) map[OKRU_QUALITY[video.name]] = video.url;
                });

                if (!Object.keys(map).length && meta.hlsManifestUrl) map.HLS = meta.hlsManifestUrl;
            }
            catch (e) {
                return fail();
            }

            var stream = withQualities(map);

            if (stream) done(stream);
            else fail();
        }, fail);
    }

    function resolveYoutube(url, done, fail) {
        var id = youtubeId(url);

        if (!id) return fail();

        done({ url: 'https://www.youtube.com/watch?v=' + id, youtube: id, best: 'YouTube' });
    }

    var RESOLVERS = { incvideo: resolveIncvideo, armdb: resolveArmdb, okru: resolveOkru, youtube: resolveYoutube };

    // Tries the episode on each player in order (best host first) until one gives a stream.
    function resolveEpisode(sources, done, fail) {
        var index = 0;

        function next() {
            if (index >= sources.length) return fail();

            var source = sources[index++];

            RESOLVERS[source.host.id](source.url, done, next);
        }

        next();
    }

    function episodeHash(card, index) {
        return Lampa.Utils.hash([SOURCE, card.hf_id, index].join('_'));
    }

    // Episode i of every player that has it, best host first.
    function episodeSources(players, index) {
        var sources = [];

        players.forEach(function (player) {
            var episode = player.episodes[index];

            if (episode) sources.push({ host: player.host, url: episode.url });
        });

        return sources;
    }

    function useYoutubeApp() {
        var setting = Lampa.Storage.get('hayfilms_youtube', 'app');

        return Lampa.Platform.is('android') && setting !== 'lampa' && Lampa.Android && Lampa.Android.openYoutube;
    }

    // incvideo refuses a foreign Referer; the inner player gets it from this page's policy.
    var referrerMeta = null;

    function setNoReferrer(on) {
        if (on && !referrerMeta) {
            referrerMeta = document.createElement('meta');
            referrerMeta.name = 'referrer';
            referrerMeta.content = 'no-referrer';
            document.head.appendChild(referrerMeta);
        }
        else if (!on && referrerMeta) {
            referrerMeta.parentNode.removeChild(referrerMeta);
            referrerMeta = null;
        }
    }

    function remember(card, index) {
        Lampa.Storage.set('hayfilms_last_' + card.hf_id, index);
    }

    function lastWatched(card) {
        var value = parseInt(Lampa.Storage.get('hayfilms_last_' + card.hf_id, '-1'), 10);
        return isNaN(value) ? -1 : value;
    }

    function markWatched(hash) {
        var view = Lampa.Timeline.view(hash);

        view.percent = 100;
        view.time = view.duration || 1;
        view.duration = view.duration || 1;
        view.hash = hash;

        Lampa.Timeline.update(view);
    }

    function playEpisodes(card, episodes, index) {
        var episode = episodes[index];

        Lampa.Loading.start(function () {
            Lampa.Loading.stop();
        });

        resolveEpisode(episode.sources, function (stream) {
            Lampa.Loading.stop();
            remember(card, index);

            var hash = episodeHash(card, index);

            if (stream.youtube && useYoutubeApp()) {
                markWatched(hash);
                Lampa.Android.openYoutube(stream.youtube);
                return;
            }

            var title = card.title + (episodes.length > 1 ? ' — ' + episode.title : '');
            var item = {
                title: title,
                url: stream.url,
                quality: stream.quality || undefined,
                timeline: Lampa.Timeline.view(hash),
                card: card
            };

            setNoReferrer(!!stream.no_referrer);

            if (episodes.length > 1) {
                var playlist = episodes.map(function (other, position) {
                    if (position === index) return item;

                    var entry = {
                        title: card.title + ' — ' + other.title,
                        timeline: Lampa.Timeline.view(episodeHash(card, position)),
                        card: card
                    };

                    // Resolved when the viewer moves to it; stream links expire.
                    entry.url = function (call) {
                        resolveEpisode(other.sources, function (next) {
                            remember(card, position);
                            setNoReferrer(!!next.no_referrer);
                            entry.url = next.url;
                            entry.quality = next.quality || undefined;
                            call();
                        }, function () {
                            Lampa.Noty.show('HayFilms: ' + other.title + ' — վիդեոն չգտնվեց');
                        });
                    };

                    return entry;
                });

                Lampa.Player.play(item);
                Lampa.Player.playlist(playlist);
            }
            else Lampa.Player.play(item);
        }, function () {
            Lampa.Loading.stop();
            Lampa.Noty.show('HayFilms: վիդեոն չգտնվեց');
        });
    }

    function episodeList(card) {
        var players = playersById[card.hf_id] || [];
        var count = 0;

        players.forEach(function (player) { count = Math.max(count, player.episodes.length); });

        var titled = players.filter(function (player) { return player.series; })[0] || players[0];
        var episodes = [];

        for (var i = 0; i < count; i++) {
            var named = titled && titled.episodes[i] && titled.episodes[i].title;

            episodes.push({ title: named || ('Սերիա ' + (i + 1)), sources: episodeSources(players, i) });
        }

        return episodes;
    }

    function watch(card) {
        var episodes = episodeList(card);

        if (!episodes.length) {
            Lampa.Noty.show('HayFilms: այս էջում դիտելու վիդեո չկա');
            return;
        }

        if (episodes.length === 1) return playEpisodes(card, episodes, 0);

        var last = lastWatched(card);
        var controller = Lampa.Controller.enabled().name;

        Lampa.Select.show({
            title: card.title,
            items: episodes.map(function (episode, index) {
                var view = Lampa.Timeline.view(episodeHash(card, index));
                var hosts = episode.sources.map(function (source) { return source.host.name; });

                return {
                    title: (view.percent >= 90 ? '✓ ' : '') + episode.title,
                    subtitle: (view.percent > 0 && view.percent < 90 ? view.percent + '% · ' : '') + hosts.join(', '),
                    selected: index === last,
                    index: index
                };
            }),
            onSelect: function (item) {
                Lampa.Controller.toggle(controller);
                playEpisodes(card, episodes, item.index);
            },
            onBack: function () {
                Lampa.Controller.toggle(controller);
            }
        });
    }

    function addButton(event) {
        var card = event.data && event.data.movie;

        if (!card || card.source !== SOURCE || !card.hf_id) return;

        var render = event.body;
        var container = render.find('.buttons--container');

        if (!container.length || render.find('.view--hayfilms').length) return;

        var best = (playersById[card.hf_id] || [])[0];
        var button = $('<div class="full-start__button selector view--online view--hayfilms" data-subtitle="hayfilms.com">' +
            ICON + '<span>HayFilms</span></div>');

        if (!best) button.addClass('hide');

        button.on('hover:enter', function () { watch(card); });

        container.prepend(button);
    }

    /* ---------- menu, settings, startup ---------- */

    function openMain() {
        Lampa.Activity.push({
            url: '',
            title: 'HayFilms',
            component: 'main',
            source: SOURCE,
            page: 1
        });
    }

    function addMenu() {
        $('.menu .menu__item[data-action="hayfilms"]').remove();

        Lampa.Menu.addButton(ICON, 'HayFilms', openMain).attr('data-action', 'hayfilms');
    }

    function addSettings() {
        if (!Lampa.SettingsApi) return;

        Lampa.SettingsApi.addComponent({ component: 'hayfilms', name: 'HayFilms', icon: ICON });

        Lampa.SettingsApi.addParam({
            component: 'hayfilms',
            param: {
                name: 'hayfilms_youtube',
                type: 'select',
                values: { app: 'YouTube հավելվածում', lampa: 'Lampa-ի player-ում' },
                default: 'app'
            },
            field: {
                name: 'YouTube վիդեոներ',
                description: 'Հայկական սերիալների մեծ մասը YouTube-ում է. հավելվածը միշտ տալիս է բարձր որակ'
            }
        });
    }

    function nameSelf() {
        if (!Lampa.Plugins || !Lampa.Plugins.get) return;

        var changed = false;

        Lampa.Plugins.get().forEach(function (plugin) {
            if (plugin.url && /\/hayfilms\.js(\?|$)/.test(plugin.url) && plugin.name !== 'HayFilms') {
                plugin.name = 'HayFilms';
                plugin.author = '@aaramg';
                changed = true;
            }
        });

        if (changed) Lampa.Plugins.save();
    }

    /* ---------- Armenian keyboard ---------- */

    // Armenian Phonetic, key for key (xkb "am phonetic"): the digit-row letters on top, then the
    // QWERTY rows (ք=Q ո=W ... խ=[ ծ=], ա=A ... լ=L շ=\, զ=Z ... մ=M). All 38 letters and և.
    var ARMENIAN_ROWS = [
        'է թ փ ձ ջ և ր չ ճ ժ',
        'ք ո ե ռ տ ը ւ ի օ պ խ ծ',
        'ա ս դ ֆ գ հ յ կ լ շ',
        'զ ղ ց վ բ ն մ'
    ];

    // Lampa's keyboard takes its layouts from a list we can't reach, but it builds a fresh
    // SimpleKeyboard each time; wrapping that class lets us add "hy" to the layout it is given.
    function armenianLayer(layout) {
        var en = layout.en || [];

        // Search keyboard: {MIC} ... {BKSP} / {LANG} ... / {SIM} ... {SPACE}
        if (en.length === 3 && en[0].indexOf('{BKSP}') >= 0 && en[1].indexOf('{LANG}') === 0) {
            return [
                (en[0].indexOf('{MIC}') === 0 ? '{MIC} ' : '') + ARMENIAN_ROWS[0] + ' {BKSP}',
                '{LANG} ' + ARMENIAN_ROWS[1],
                ARMENIAN_ROWS[2],
                '{SIM} ' + ARMENIAN_ROWS[3] + ' {SPACE}'
            ];
        }

        // Clarify keyboard: digits / three letter rows / {MIC} {LANG} {SPACE} {SEARCH}
        if (en.length === 5 && en[4].indexOf('{LANG}') >= 0) {
            return [en[0]].concat(ARMENIAN_ROWS).concat([en[4]]);
        }

        return null;
    }

    function addArmenianKeyboard() {
        var holder = window.SimpleKeyboard;
        var Original = holder && holder['default'];

        if (!Original || Original.hayfilms_wrapped) return;

        var Wrapped = function () {
            var args = Array.prototype.slice.call(arguments);
            var options = args[args.length - 1];

            try {
                if (options && options.layout && !options.layout.hy) {
                    var layer = armenianLayer(options.layout);

                    if (layer) options.layout.hy = layer;
                }
            }
            catch (e) {}

            return new (Function.prototype.bind.apply(Original, [null].concat(args)))();
        };

        Wrapped.prototype = Original.prototype;
        Wrapped.hayfilms_wrapped = true;

        for (var key in Original) {
            if (Original.hasOwnProperty(key)) Wrapped[key] = Original[key];
        }

        holder['default'] = Wrapped;

        // The keyboard's language button lists Lampa's language codes that have a layout.
        if (Lampa.Lang.addCodes && !Lampa.Lang.codes().hy) Lampa.Lang.addCodes({ hy: 'Հայերեն' });
    }

    function start() {
        registerSource();
        addSettings();
        addMenu();

        Lampa.Listener.follow('full', function (event) {
            if (event.type === 'complite') addButton(event);
        });

        try { addArmenianKeyboard(); } catch (e) {}

        Lampa.Player.listener.follow('destroy', function () {
            setNoReferrer(false);
        });

        try { nameSelf(); } catch (e) {}
    }

    if (window.appready) start();
    else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type == 'ready') start();
        });
    }
})();
