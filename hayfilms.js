/*
 * HayFilms — Lampa plugin
 * Browses two Armenian sites as one catalogue inside Lampa: hayfilms.com and armfilm.co (Armenian
 * films and series, and films, series and cartoons dubbed into Armenian). A side-menu page of rows,
 * genre tiles and a filter, a search tab, and a "HayFilms" button on the card that plays the best
 * stream either site offers (csst/fsst mp4 up to 1080p, YouTube, armdb HLS, ok.ru). A title both
 * sites have shows once, with the streams of both.
 * The sites have no API, so pages are fetched as HTML (native Android request, so CORS doesn't apply).
 * Targets Lampa 3.x. Written in ES5 for old Android TV WebViews (Crosswalk).
 */
(function () {
    'use strict';

    if (window.plugin_hayfilms_ready) return;
    window.plugin_hayfilms_ready = true;

    var SOURCE = 'hayfilms';
    var SITE = 'https://hayfilms.com';
    var AF_SITE = 'https://armfilm.co';
    // Lampa keys history, bookmarks and timelines by card id; keep ours clear of TMDB ids,
    // and the two sites' ids clear of each other.
    var ID_OFFSET = 900000000;
    var AF_OFFSET = 910000000;
    var CACHE_MS = 1000 * 60 * 20;
    var PER_PAGE = 12;

    // hayfilms.com: `am` is the Armenian site's slug (what we browse), `ru` the Russian one (what
    // search returns). armfilm.co: `af` are its sections under /hy/ that fall in the category.
    var CATEGORIES = [
        { id: 'arm_series', am: 'haykakan-serialner', ru: 'armyanskie-seriali', af: ['serialner'], title: 'Հայկական սերիալներ' },
        { id: 'arm_movies', am: 'haykakan-filmer', ru: 'armyanskie-filmi', af: ['haykakan-filmer'], title: 'Հայկական ֆիլմեր' },
        { id: 'tr_series', am: 'serialner-hayeren-targmanutyamb', ru: 'seriali-na-armyanskom', af: ['serialner-hayeren-tarkmanutyamb'], title: 'Սերիալներ հայերեն թարգմանությամբ' },
        { id: 'tr_movies', am: 'filmer-hayeren', ru: 'filmi-na-armyanskom', af: ['hayeren-filmer', 'mijazgayin-filmer-hayeren-targmanutyamb'], title: 'Ֆիլմեր հայերեն թարգմանությամբ' },
        { id: 'dorama', am: 'doramaner-hayeren', ru: 'dorammi-na-armyanskom', af: ['doramaner-hay'], title: 'Դորամաներ հայերեն' },
        { id: 'cartoons', am: 'multfilmer-hayeren', ru: 'multfilmy-armjanskim-perevodom', af: ['hayeren-multer'], title: 'Մուլտֆիլմեր հայերեն' },
        { id: 'arm_cartoons', af: ['multfilmer'], title: 'Հայկական մուլտֆիլմեր' },
        { id: 'anime', af: ['animener-hayeren'], title: 'Անիմե հայերեն' },
        { id: 'old', am: 'haykakan-hin-filmer', ru: 'armyanskie-starie-filmi', af: ['haykakan-hin-filmer'], title: 'Հին հայկական ֆիլմեր' }
    ];

    // armfilm.co files every episode of an Armenian series as its own post; we show the series.
    var AF_SERIES_SLUG = 'serialner';

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
        { cat: 'arm_cartoons' },
        { cat: 'arm_series' },
        { cat: 'arm_movies' },
        { tiles: true },
        { title: 'Կատակերգություն', query: { genre: 'Կատակերգություն' } },
        { cat: 'tr_movies' },
        { cat: 'tr_series' },
        { cat: 'dorama' },
        { cat: 'anime' },
        { cat: 'old' },
        { title: 'Ֆանտաստիկա', query: { genre: 'Ֆանտաստիկա' } },
        { title: 'Արկածային', query: { genre: 'Արկածային' } },
        { title: 'Պատմական', query: { genre: 'Պատմական' } }
    ];

    // Stream hosts we can play, best first. Others on the sites (VK, mail.ru, ...) are left out.
    // An armfilm.co episode page is a host of its own: its player is read when the episode plays.
    var HOSTS = [
        { id: 'incvideo', name: 'HD', test: /(?:fsst|csst|incvideo\d*)\.online\/embed\//i },
        { id: 'youtube', name: 'YouTube', test: /youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\//i },
        { id: 'armdborg', name: 'ARMFilm', test: /armdb\.org\/player\//i },
        { id: 'afpage', name: 'ARMFilm', test: /armfilm\.co\/.*\.html/i },
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

    function absolute(url, site) {
        if (!url) return '';
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.charAt(0) === '/') return (site || SITE) + url;
        return url;
    }

    // 'af' for armfilm.co, 'hf' for hayfilms.com.
    function siteOf(url) {
        return /armfilm\.co/i.test(url || '') ? 'af' : 'hf';
    }

    function cardSite(card) {
        return card.hf_site || (card.id >= AF_OFFSET ? 'af' : 'hf');
    }

    // Pages are big (an armfilm.co listing is ~150 KB), so only the latest few stay in memory.
    var PAGE_CACHE_MAX = 30;

    // armfilm.co answers 503 to a burst of requests, so at most two go to it at a time, and a failed
    // one is tried once more.
    var AF_PARALLEL = 2;
    var afActive = 0;
    var afQueue = [];

    function afSlot(run) {
        if (afActive < AF_PARALLEL) {
            afActive++;
            run(function () {
                afActive--;

                var next = afQueue.shift();

                if (next) afSlot(next);
            });
        }
        else afQueue.push(run);
    }

    // `background`: the armfilm index crawl, which neither counts as busy nor fills the cache.
    function fetchText(url, onload, onfail, background, retried) {
        var hit = pageCache[url];

        if (hit && Date.now() - hit.time < CACHE_MS) {
            setTimeout(function () { onload(hit.text); }, 0);
            return;
        }

        if (siteOf(url) === 'af' && !retried) {
            return afSlot(function (release) {
                fetchText(url, function (text) {
                    release();
                    onload(text);
                }, function (error) {
                    setTimeout(function () {
                        fetchText(url, function (text) {
                            release();
                            onload(text);
                        }, function (again) {
                            release();
                            if (onfail) onfail(again);
                        }, background, true);
                    }, 1500);
                }, background, true);
            });
        }

        var network = new Lampa.Reguest();
        var settled = false;
        var settle = function () {
            if (settled) return false;

            settled = true;
            if (!background) busy--;
            return true;
        };

        if (!background) busy++;

        network.timeout(20000);
        network.native(url, function (text) {
            if (!settle()) return;

            if (typeof text !== 'string') text = text && text.responseText ? text.responseText : String(text || '');

            if (!background) {
                pageCache[url] = { text: text, time: Date.now() };
                trimPageCache();
            }

            onload(text);
        }, function (error) {
            if (!settle()) return;
            if (onfail) onfail(error);
        }, false, {
            dataType: 'text',
            headers: { 'User-Agent': navigator.userAgent }
        });

        // A request that never answers must not keep the index crawl waiting for good.
        if (!background) setTimeout(settle, 25000);
    }

    function trimPageCache() {
        var urls = Object.keys(pageCache);

        if (urls.length <= PAGE_CACHE_MAX) return;

        urls.sort(function (a, b) { return pageCache[a].time - pageCache[b].time; });
        urls.slice(0, urls.length - PAGE_CACHE_MAX).forEach(function (url) { delete pageCache[url]; });
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
        var af = siteOf(url) === 'af';
        var slug = af ? ((url || '').match(/armfilm\.co\/(?:hy\/)?([^\/]+)\//) || [0, ''])[1] : slugOf(url);

        for (var i = 0; i < CATEGORIES.length; i++) {
            var category = CATEGORIES[i];

            if (af ? (category.af || []).indexOf(slug) >= 0 : category.am === slug || category.ru === slug) return category;
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
            hf_site: 'hf',
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

    // "Սպիտակ տան գրոհը [2013/ֆիլմ/հայերեն/12+]" -> title, year 2013, language հայերեն;
    // "Գոյամարտ [սերիա 213 Full]" -> title Գոյամարտ, episode 213.
    function parseAfTitle(raw) {
        var text = clean(raw);
        var bracket = (text.match(/\[([^\]]*)\]/) || [0, ''])[1];
        var info = { year: '', lang: '', episode: 0 };

        bracket.split('/').forEach(function (part) {
            part = clean(part);

            if (/^\d{4}$/.test(part)) info.year = part;
            else if (/^(?:հայերեն|ռուսերեն|անգլերեն|ռուս|рус)/i.test(part)) info.lang = part;
        });

        var episode = bracket.match(/սերիա\s*(\d+)/i) || text.match(/սերիա\s*(\d+)/i);

        if (episode) info.episode = parseInt(episode[1], 10);

        info.title = clean(text.replace(/\[[^\]]*\]/g, '').split(/\s+\/\s+/)[0]);

        return info;
    }

    function makeAfCard(url, rawTitle, poster) {
        var info = parseAfTitle(rawTitle);
        var id = siteId(url);

        return {
            id: AF_OFFSET + id,
            hf_id: id,
            hf_site: 'af',
            hf_url: url,
            source: SOURCE,
            title: info.title,
            original_title: info.title,
            img: absolute(poster, AF_SITE),
            release_date: info.year ? info.year + '-01-01' : '',
            release_quality: info.episode ? 'սերիա ' + info.episode : '',
            vote_average: 0,
            overview: '',
            hf_lang: info.lang,
            hf_episode: info.episode
        };
    }

    function isArmenianLanguage(lang) {
        return !lang || /հայերեն/i.test(lang);
    }

    // armfilm.co listing: a "shortstory" block with a poster link, a title and fields such as
    // "Թարգմանությունը: [Հայերեն]". Titles in another language are left out. In the Armenian series
    // section every post is an episode; only the newest episode of each series stays, as the series.
    function parseAfCards(doc, base) {
        // Sections use <article class="shortstory"> or <div class="shortstory">; side carousels sit
        // outside #dle-content.
        var articles = doc.querySelectorAll('#dle-content .shortstory');

        if (!articles.length) articles = doc.querySelectorAll('.shortstory');
        // Only the whole section is grouped; a series' own section lists all its episodes.
        var series = base === AF_SITE + '/hy/' + AF_SERIES_SLUG + '/';
        var cards = [];
        var seen = {};

        for (var i = 0; i < articles.length; i++) {
            var link = articles[i].querySelector('a.short-imgposter');
            var img = link && link.querySelector('img');

            if (!link || !img) continue;

            var url = absolute(link.getAttribute('href'), AF_SITE);
            var card = makeAfCard(url, img.getAttribute('title') || img.getAttribute('alt') || '', img.getAttribute('data-src') || img.getAttribute('src'));
            var fields = articles[i].querySelectorAll('.short-fileds div');

            for (var f = 0; f < fields.length; f++) {
                if (/Թարգմանությ|Перевод/i.test(fields[f].textContent)) {
                    var value = fields[f].querySelector('span');

                    card.hf_lang = card.hf_lang || clean(value ? value.textContent : '').replace(/[\[\]]/g, '');
                }
            }

            if (!siteId(url) || !card.title || !isArmenianLanguage(card.hf_lang)) continue;

            var key = series && card.hf_episode ? 'series:' + titleKey(card.title) : url;

            if (seen[key]) continue;

            if (series && card.hf_episode) card.hf_series = true;

            seen[key] = true;
            cards.push(card);
        }

        return cards;
    }

    // Titles compared across the two sites: lower case, letters and digits only.
    function titleKey(title) {
        return (title || '').toLowerCase().replace(/[^0-9a-zա-ֆа-яё]+/g, '');
    }

    // The Latin name of a card, when it has one apart from its title ("Goyamart").
    function latinKey(card) {
        var key = titleKey(card.original_title);

        return key && key !== titleKey(card.title) && /^[0-9a-z]+$/.test(key) ? key : '';
    }

    // The same title on both sites: same Armenian (or same Latin) name, and the same year when
    // both know it.
    function sameTitle(a, b) {
        var armenian = titleKey(a.title) && titleKey(a.title) === titleKey(b.title);
        var latin = latinKey(a) && latinKey(a) === latinKey(b);

        if (!armenian && !latin) return false;

        var ya = yearOf(a);
        var yb = yearOf(b);

        return !ya || !yb || ya === yb;
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

    // "Սերիա 12", "12", "սերիա 12 Full" -> 12; otherwise its place in the list.
    function episodeNumber(title, index) {
        var match = (title || '').match(/(\d+)/);

        return match ? parseInt(match[1], 10) : index + 1;
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

            episodes.forEach(function (episode, index) { episode.number = episodeNumber(episode.title, index); });

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

    function hostById(id) {
        for (var i = 0; i < HOSTS.length; i++) {
            if (HOSTS[i].id === id) return HOSTS[i];
        }

        return null;
    }

    // An armfilm.co page: a film with one player, a dubbed series whose episodes are pages of the post
    // (a "sel_page" <select>), or one episode of an Armenian series, which links to the series section.
    function parseAfDetail(text, url) {
        var doc = parseHtml(text);
        var h1 = doc.querySelector('h1.ftitle') || doc.querySelector('h1');
        var og = doc.querySelector('meta[property="og:image"]');
        var card = makeAfCard(url, h1 ? h1.textContent : '', og ? og.getAttribute('content') : '');
        var fields = doc.querySelectorAll('.f-fields li');
        var rows = {};
        var seriesUrl = '';

        for (var i = 0; i < fields.length; i++) {
            var label = clean((fields[i].querySelector('small') || {}).textContent || '');
            var value = fields[i].querySelector('span');
            var valueText = clean(value ? value.textContent : '');

            if (/Ռեժիս/.test(label)) rows.director = valueText;
            else if (/Դերասան/.test(label)) rows.cast = valueText;
            else if (/երկիր/.test(label)) rows.country = clean(valueText.split('|')[1] || '');
            else if (/Թարգմանությ/.test(label)) card.hf_lang = valueText.replace(/[\[\]]/g, '');

            var links = fields[i].querySelectorAll('a[href]');

            for (var l = 0; l < links.length; l++) {
                var href = absolute(links[l].getAttribute('href'), AF_SITE);

                if (/\/serialner\/[a-z0-9_-]+\/$/i.test(href)) seriesUrl = href;
            }
        }

        var heading = doc.querySelector('.maintitle');
        var descr = doc.querySelector('.f-text');
        var named = [heading ? heading.textContent : '', descr ? descr.textContent : ''].map(clean).filter(function (text) { return / \/ /.test(text); })[0] || '';
        var latin = clean((named.split(/\s+\/\s+/)[1] || '').replace(/\b(?:seria|season|eterashrjan)\b.*$/i, '').replace(/[^A-Za-z0-9 .:'-].*$/, ''));

        if (!latin && seriesUrl) latin = seriesUrl.replace(/\/$/, '').split('/').pop().replace(/-\d{4}$/, '').replace(/-/g, ' ');
        if (latin) card.original_title = latin;

        var overview = descr ? clean(descr.textContent.replace(/Ուղարկել նշագրություն/g, '')) : '';
        var extra = [];

        if (rows.director) extra.push('Ռեժիսոր՝ ' + rows.director);
        if (rows.cast) extra.push('Դերերում՝ ' + rows.cast);

        card.overview = overview + (extra.length ? '\n\n' + extra.join('\n') : '');
        card.genres = [];
        card.production_countries = rows.country ? [{ iso_3166_1: '', name: rows.country }] : [];
        card.production_companies = [];
        card.background_image = card.img;

        var players = [];
        var pages = doc.querySelectorAll('select.sel_page option[value]');
        var episodes = [];

        for (var p = 0; p < pages.length; p++) {
            var pageUrl = absolute(pages[p].getAttribute('value'), AF_SITE);

            if (pageUrl) episodes.push({ title: 'Սերիա ' + clean(pages[p].textContent), url: pageUrl, number: episodeNumber(pages[p].textContent, episodes.length) });
        }

        if (episodes.length) players.push({ label: 'ARMFilm', host: hostById('afpage'), episodes: episodes, series: true });
        else if (!(card.hf_episode && seriesUrl)) {
            var frame = afPlayerFrame(doc);

            if (frame) players.push({ label: 'ARMFilm', host: hostOf(frame), episodes: [{ title: '', url: frame, number: 1 }], series: false });
        }

        if (episodes.length) card.number_of_episodes = episodes.length;

        return { card: card, players: players, related: [], seriesUrl: card.hf_episode ? seriesUrl : '' };
    }

    // The page's own player: #activeplayer, else the first iframe of a host we can play.
    function afPlayerFrame(doc) {
        var frames = doc.querySelectorAll('iframe#activeplayer, iframe[src]');

        for (var i = 0; i < frames.length; i++) {
            var src = absolute(frames[i].getAttribute('src') || frames[i].getAttribute('data-src') || '', AF_SITE);
            var host = src && hostOf(src);

            if (host && host.id !== 'afpage') return src;
        }

        return '';
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

    // The listings of a category on both sites.
    function categoryBases(category) {
        var bases = category.am ? [SITE + '/am/' + category.am + '/'] : [];

        (category.af || []).forEach(function (slug) { bases.push(AF_SITE + '/hy/' + slug + '/'); });

        return bases;
    }

    // Site listings that answer the query, before the client-side filters. Genres and years exist
    // only on hayfilms.com (armfilm.co files titles by country), so those read hayfilms alone.
    function listingBases(query) {
        var genre = genreByTitle(query.genre);
        var category = categoryById(query.cat);

        // Cartoon sections plus everything tagged cartoon or children's, whatever its section.
        if (query.kids) {
            return categoryBases(categoryById('cartoons'))
                .concat(categoryBases(categoryById('arm_cartoons')))
                .concat(genreBases(['Մուլտֆիլմ', 'Մանկական']));
        }

        if (query.family) return genreBases(FAMILY_GENRES);

        if (genre) return genreBases([genre.title]);

        if (category) return categoryBases(category);

        if (query.decade) {
            var years = [];
            var from = parseInt(query.decade, 10);

            for (var y = from; y < from + 10; y++) years.push(SITE + '/am/xfsearch/year/' + y + '/');

            return years;
        }

        var all = [];

        CATEGORIES.forEach(function (item) { all = all.concat(categoryBases(item)); });

        return all;
    }

    function yearOf(card) {
        return parseInt((card.release_date || '').slice(0, 4), 10) || 0;
    }

    function passesFilters(card, query) {
        if (query.family && cardSite(card) === 'hf' && grownUp.ids[card.hf_id]) return false;

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
            var af = siteOf(base) === 'af';
            var answer = { results: af ? parseAfCards(doc, base) : parseCards(doc), total_pages: Math.max(parseTotalPages(doc), page) };

            if (af) indexAdd(answer.results);

            storedListings()[url] = { time: Date.now(), results: answer.results, total_pages: answer.total_pages };
            saveListings();
            done(answer);
        }, function () {
            // A genre or year with no titles answers 404; a busy site answers 503. Neither is kept, so
            // a page that failed is read again next time.
            done({ results: [], total_pages: page === 1 ? 0 : page - 1 });
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

    // Reads site pages from `from` on, every base listing of both sites at once. Each site's cards are
    // ordered newest first (ids only compare within a site), then the two sites take turns, so neither
    // buries the other. A title both sites have shows once: the later one is folded into the first as
    // hf_alt, which the card page uses for the other site's streams. `memo` (the activity, for grids)
    // carries the titles already shown across pages. When the filters thin a page out it reads on
    // (a few pages at most) until there's a screenful.
    // Answers {results, last: the last site page read, total: the site's page count}.
    function queryPages(query, from, done, memo) {
        var bases = listingBases(query);
        var seen = {};
        var bySite = { hf: [], af: [] };
        var shown = 0;
        var total = 0;
        var page = from;

        memo = memo || {};
        memo.hf_titles = memo.hf_titles || {};

        if (query.family && Date.now() - grownUp.time >= GROWN_UP_LIFE) {
            if (!grownUpReady()) return waitGrownUp(function () { queryPages(query, from, done, memo); });

            loadGrownUp();
        }

        function read() {
            gather(bases.map(function (base) {
                return function (call) { fetchListing(base, page, call); };
            }), function (answers) {
                answers.forEach(function (answer) {
                    total = Math.max(total, answer.total_pages);

                    answer.results.forEach(function (card) {
                        if (seen[card.id] || !passesFilters(card, query)) return;

                        seen[card.id] = true;
                        bySite[cardSite(card)].push(card);
                        shown++;
                    });
                });

                if (shown < PER_PAGE && page < total && page - from < 4) {
                    page++;
                    return read();
                }

                done({ results: mergeSites(bySite, memo.hf_titles), last: page, total: Math.max(total, page) });
            });
        }

        read();
    }

    /* ---------- armfilm.co index ---------- */

    // armfilm.co's own search is Google's, out of our reach, so the plugin keeps a list of the
    // site's titles on the device: every armfilm listing read adds to it, and once a week it reads
    // the sections through in the background, one page at a time and only while nothing else is
    // loading (requests from the TV may queue one behind another). It answers search and finds a
    // hayfilms title's twin on armfilm.co. Entries: id -> [title, year, url path, poster path, badge].
    var AF_INDEX_KEY = 'hayfilms_af_index';
    var AF_INDEX_LIFE = 1000 * 60 * 60 * 24 * 7;
    var AF_SERIES_PAGES = 5;
    var AF_IMG = 'https://amimg.intrdb.com/uploads/posts/';
    var afIndex = null;
    var afIndexTimer = 0;
    var afCrawling = false;
    var busy = 0;

    function storedAfIndex() {
        if (!afIndex) {
            var stored = Lampa.Storage.get(AF_INDEX_KEY, '{}') || {};

            if (typeof stored === 'string') {
                try { stored = JSON.parse(stored); } catch (e) { stored = {}; }
            }

            afIndex = { time: stored.time || 0, items: stored.items || {} };
        }

        return afIndex;
    }

    // The index is a few hundred KB of JSON: written at most every 20 s, and once when a crawl ends.
    function saveAfIndex(now) {
        clearTimeout(afIndexTimer);

        afIndexTimer = setTimeout(function () {
            Lampa.Storage.set(AF_INDEX_KEY, storedAfIndex());
        }, now ? 0 : 20000);
    }

    function indexAdd(cards) {
        var items = storedAfIndex().items;
        var changed = false;

        cards.forEach(function (card) {
            if (cardSite(card) !== 'af' || !card.hf_id || (card.hf_episode && !card.hf_series)) return;

            var entry = [
                card.title,
                yearOf(card) || 0,
                card.hf_url.replace(AF_SITE, ''),
                (card.img || '').replace(AF_IMG, '~'),
                card.release_quality || ''
            ];

            if (JSON.stringify(items[card.hf_id]) !== JSON.stringify(entry)) {
                items[card.hf_id] = entry;
                changed = true;
            }
        });

        if (changed) saveAfIndex();
    }

    function indexCard(id) {
        var entry = storedAfIndex().items[id];

        if (!entry) return null;

        return {
            id: AF_OFFSET + parseInt(id, 10),
            hf_id: parseInt(id, 10),
            hf_site: 'af',
            hf_url: AF_SITE + entry[2],
            source: SOURCE,
            title: entry[0],
            original_title: entry[0],
            img: entry[3].charAt(0) === '~' ? AF_IMG + entry[3].slice(1) : entry[3],
            release_date: entry[1] ? entry[1] + '-01-01' : '',
            release_quality: entry[4] || '',
            vote_average: 0,
            overview: ''
        };
    }

    function searchAfIndex(text) {
        var words = text.toLowerCase().split(/\s+/).map(titleKey).filter(function (word) { return word.length > 1; });
        var items = storedAfIndex().items;
        var found = [];

        if (!words.length) return found;

        for (var id in items) {
            var key = titleKey(items[id][0]);

            if (words.every(function (word) { return key.indexOf(word) >= 0; })) found.push(indexCard(id));
        }

        return newestFirst(found).slice(0, 60);
    }

    function findAfTwin(card) {
        var items = storedAfIndex().items;
        var key = titleKey(card.title);

        for (var id in items) {
            if (titleKey(items[id][0]) !== key) continue;

            var twin = indexCard(id);

            if (sameTitle(card, twin)) return twin;
        }

        return null;
    }

    // Reads every armfilm.co section (the Armenian series section only its first pages: older posts
    // there are single episodes) into the index, politely, in the background.
    function crawlAfIndex() {
        if (afCrawling || Date.now() - storedAfIndex().time < AF_INDEX_LIFE) return;

        afCrawling = true;

        var queue = [];

        CATEGORIES.forEach(function (category) {
            (category.af || []).forEach(function (slug) {
                queue.push({ base: AF_SITE + '/hy/' + slug + '/', page: 1, last: slug === AF_SERIES_SLUG ? AF_SERIES_PAGES : 0 });
            });
        });

        function next() {
            if (busy > 0) return setTimeout(next, 1500);

            var job = queue.shift();

            if (!job) {
                storedAfIndex().time = Date.now();
                saveAfIndex(true);
                afCrawling = false;
                return;
            }

            fetchText(pagedUrl(job.base, job.page), function (text) {
                var doc = parseHtml(text);
                var total = parseTotalPages(doc);

                indexAdd(parseAfCards(doc, job.base));

                if (job.page === 1) {
                    var last = job.last ? Math.min(job.last, total) : total;

                    for (var page = 2; page <= last; page++) queue.push({ base: job.base, page: page });
                }

                setTimeout(next, 300);
            }, function () {
                setTimeout(next, 300);
            }, true);
        }

        setTimeout(next, 15000);
    }

    function newestFirst(cards) {
        return cards.slice().sort(function (a, b) { return b.hf_id - a.hf_id; });
    }

    // hayfilms, armfilm, hayfilms, ... with one card per title (each site newest first, or as given with
    // keepOrder, for search results). A twin on this page is folded into its
    // card; `titles` (small: site and year per title key) drops twins of cards shown on earlier pages.
    function mergeSites(bySite, titles, keepOrder) {
        var hf = keepOrder ? bySite.hf : newestFirst(bySite.hf);
        var af = keepOrder ? bySite.af : newestFirst(bySite.af);
        var results = [];
        var here = {};
        var length = Math.max(hf.length, af.length);

        function add(card) {
            var key = titleKey(card.title);
            var twin = here[key];
            var before = titles[key];
            var year = yearOf(card);

            if (twin && twin.hf_site !== card.hf_site && sameTitle(twin, card)) {
                if (!twin.hf_alt) twin.hf_alt = { id: card.id, hf_id: card.hf_id, url: card.hf_url, site: card.hf_site };
                return;
            }

            if (!twin && before && before.site !== card.hf_site && (!before.year || !year || before.year === year)) return;

            if (!twin) here[key] = card;
            if (key && !before) titles[key] = { site: card.hf_site, year: year };

            results.push(card);
        }

        for (var i = 0; i < length; i++) {
            if (hf[i]) add(hf[i]);
            if (af[i]) add(af[i]);
        }

        return results;
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

        if (query.search) return searchBoth(query.search, page, finish);

        // Lampa counts its own pages; the site pages already read are remembered on the activity.
        // Lampa keeps the first answer's total_pages for good (category next.js), so that must be
        // the site's real page count; pages past the end answer quickly with nothing.
        // Scrolling asks for the next page; the page picker jumps (same object, page set directly),
        // and then we start reading at the chosen page.
        var from = params.hf_page !== undefined && page === params.hf_page + 1 ? Math.max(page, params.hf_next || 1) : page;

        params.hf_page = page;

        queryPages(query, from, function (answer) {
            params.hf_next = answer.last + 1;

            finish({ results: answer.results, page: page, total_pages: Math.max(answer.total, page) });

            // Lampa asks for the next page only once the viewer reaches the end of the grid. Read the
            // next two now, in the background, into the listing store, so they're there the moment
            // they're asked for and the grid just goes on (pages already stored cost nothing).
            setTimeout(function () { prefetch(query, answer.last + 1, answer.total, 2); }, 500);
        }, params);
    }

    function prefetch(query, from, total, pages) {
        if (pages < 1 || from > total) return;

        queryPages(query, from, function (answer) {
            prefetch(query, answer.last + 1, answer.total, pages - 1);
        }, {});
    }

    function main(params, oncomplite, onerror) {
        crawlAfIndex();

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

    // One site's page for a card: {card, players, related}. An armfilm.co Armenian series episode
    // brings the episodes of the whole series.
    function loadDetail(site, url, done, fail) {
        fetchText(url, function (text) {
            if (site !== 'af') return done(parseDetail(text, url));

            var parsed = parseAfDetail(text, url);

            if (!parsed.seriesUrl) return done(parsed);

            loadAfSeries(parsed.seriesUrl, function (episodes) {
                if (episodes.length) {
                    parsed.players = [{ label: 'ARMFilm', host: hostById('afpage'), episodes: episodes, series: true }];
                    parsed.card.number_of_episodes = episodes.length;
                }

                done(parsed);
            });
        }, fail);
    }

    // Every episode of an armfilm.co Armenian series: all pages of its section, oldest first.
    function loadAfSeries(base, done) {
        fetchListing(base, 1, function (first) {
            var tasks = [];

            for (var page = 2; page <= first.total_pages; page++) {
                tasks.push((function (number) {
                    return function (next) { fetchListing(base, number, next); };
                })(page));
            }

            gather(tasks, function (answers) {
                var byNumber = {};

                [first].concat(answers).forEach(function (answer) {
                    answer.results.forEach(function (card) {
                        var number = card.hf_episode;

                        if (number && !byNumber[number]) byNumber[number] = { title: 'Սերիա ' + number, url: card.hf_url, number: number };
                    });
                });

                done(Object.keys(byNumber).map(function (number) { return byNumber[number]; })
                    .sort(function (a, b) { return a.number - b.number; }));
            });
        });
    }

    // The same title on the other site: the twin a listing folded in, else the armfilm index for a
    // hayfilms card, else hayfilms' search (Armenian, then Latin name) for an armfilm card.
    function findTwin(card, done) {
        if (card.hf_alt && card.hf_alt.url) return done(card.hf_alt.site, card.hf_alt.url);

        if (cardSite(card) === 'hf') {
            var twin = findAfTwin(card);

            return done(twin ? 'af' : '', twin ? twin.hf_url : '');
        }

        var names = [card.title];

        if (latinKey(card)) names.push(card.original_title);

        (function tryName() {
            var name = names.shift();

            if (!name) return done('', '');

            searchPage(name, 1, function (json) {
                var found = json.results.filter(function (other) { return sameTitle(card, other); })[0];

                if (found) done('hf', found.hf_url);
                else tryName();
            });
        })();
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

        var site = cardSite(card);

        // Lampa keeps only its own card fields in history and bookmarks (Utils.clearCard), so a card
        // opened from there has lost hf_url; both sites still find the page by its id.
        if (!card.hf_url && card.id > ID_OFFSET) {
            card.hf_id = card.id - (site === 'af' ? AF_OFFSET : ID_OFFSET);
            card.hf_url = (site === 'af' ? AF_SITE : SITE) + '/index.php?newsid=' + card.hf_id;
        }

        if (!card.hf_url) return onerror();

        loadDetail(site, card.hf_url, function (parsed) {
            var movie = parsed.card;

            // Keep what the listing knew if the page lacks it (e.g. the poster).
            for (var key in card) {
                if (movie[key] === undefined || movie[key] === '') movie[key] = card[key];
            }

            // A newsid link carries no id in its path; the card's own id is the reliable one.
            movie.id = card.id || movie.id;
            movie.hf_id = card.hf_id || movie.hf_id;
            movie.hf_url = card.hf_url;
            movie.hf_site = site;

            var answered = false;

            function answer(twin) {
                if (answered) return;

                answered = true;

                var players = parsed.players;

                if (twin) {
                    players = players.concat(twin.players);

                    // The other site may know what this one doesn't (genres, a description).
                    ['overview', 'genres', 'production_countries', 'img', 'background_image', 'release_date'].forEach(function (field) {
                        var mine = movie[field];

                        if (!mine || (mine.length === 0)) movie[field] = twin.card[field];
                    });
                }

                players.sort(function (a, b) { return HOSTS.indexOf(a.host) - HOSTS.indexOf(b.host); });
                playersById[movie.id] = players;

                var episodes = episodeList(movie);

                if (episodes.length > 1) movie.number_of_episodes = episodes.length;

                // The episode badge suits a poster; the card page would show it as "Quality".
                movie.release_quality = '';

                oncomplite({
                    movie: movie,
                    simular: parsed.related.length ? { results: parsed.related } : undefined
                });
            }

            // The other site's page is a bonus: a slow one must not hold the card back.
            setTimeout(function () { answer(null); }, 12000);

            findTwin(movie, function (twinSite, twinUrl) {
                if (!twinSite || twinUrl === movie.hf_url) return answer(null);

                loadDetail(twinSite, twinUrl, answer, function () { answer(null); });
            });
        }, onerror);
    }

    // hayfilms' own search plus the armfilm index, one card per title, best title matches first.
    function searchBoth(text, page, done) {
        crawlAfIndex();

        searchPage(text, page, function (json) {
            var af = page === 1 ? searchAfIndex(text) : [];

            json.results = rankByTitle(mergeSites({ hf: json.results, af: af }, {}, true), text);
            done(json);
        });
    }

    function search(params, oncomplite) {
        var text = decodeURIComponent(params.query || '');

        searchBoth(text, 1, function (json) {
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

            var labels = Object.keys(map);

            if (!labels.length) return fail();

            gather(labels.map(function (label) {
                return function (call) {
                    directUrl(map[label], function (direct) {
                        map[label] = direct;
                        call();
                    });
                };
            }), function () {
                var stream = withQualities(map);

                stream.no_referrer = true;
                done(stream);
            });
        }, fail);
    }

    // An incvideo link is https and redirects to its CDN host. VLC on Android TV restarts its
    // player while starting (twice when an app opens it for a result, as ByLampa does), which
    // cuts that slow TLS-plus-redirect connection, so VLC gives up. The CDN serves the same
    // file over plain http for hours, so on Android we follow the redirect ourselves and hand
    // players that final http link, which opens as fast as a TorrServe one. Any failure keeps
    // the original link.
    function directUrl(url, done) {
        if (!Lampa.Platform.is('android')) return done(url);

        var network = new Lampa.Reguest();
        var finished = false;
        var finish = function (result) {
            if (finished) return;

            finished = true;
            done(result);
        };

        network.timeout(10000);
        network.native(url, function (response) {
            var data = response;

            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { data = null; }
            }

            var current = data && typeof data === 'object' ? data.currentUrl : '';

            if (current && /^https?:\/\//.test(current) && current !== url) finish(current.replace(/^https:/, 'http:'));
            else finish(url);
        }, function () {
            finish(url);
        }, false, {
            returnHeaders: true,
            headers: { Range: 'bytes=0-0' }
        });
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

    // armdb.org player (armfilm.co): Playerjs with file: atob("[480p]https://hls…/p_0.m3u8,[720p]…").
    function resolveArmdbOrg(url, done, fail) {
        fetchText(url, function (text) {
            var encoded = pick(text, /atob\(\s*["']([A-Za-z0-9+\/=]+)["']\s*\)/);
            var file = '';
            var map = {};

            try { file = encoded ? window.atob(encoded) : pick(text, /file\s*:\s*["'](https?:[^"']+)["']/); } catch (e) {}

            if (!file) return fail();

            file.split(',').forEach(function (part) {
                var match = part.match(/^\s*\[([^\]]+)\]\s*(\S+)/);

                if (match) map[match[1]] = match[2];
                else if (/^\s*https?:/.test(part)) map.HLS = clean(part);
            });

            var stream = withQualities(map);

            if (stream) done(stream);
            else fail();
        }, fail);
    }

    // An armfilm.co episode page: read its player, then resolve that.
    function resolveAfPage(url, done, fail) {
        fetchText(url, function (text) {
            var frame = afPlayerFrame(parseHtml(text));
            var host = frame && hostOf(frame);

            if (!host || !RESOLVERS[host.id]) return fail();

            RESOLVERS[host.id](frame, done, fail);
        }, fail);
    }

    var RESOLVERS = {
        incvideo: resolveIncvideo,
        armdborg: resolveArmdbOrg,
        afpage: resolveAfPage,
        armdb: resolveArmdb,
        okru: resolveOkru,
        youtube: resolveYoutube
    };

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

    // `key` is the episode number minus one (0 for a film), which for hayfilms series is the index
    // the plugin used before armfilm.co joined, so watched marks carry over.
    function episodeHash(card, key) {
        var parts = cardSite(card) === 'af' ? [SOURCE, 'af', card.hf_id, key] : [SOURCE, card.hf_id, key];

        return Lampa.Utils.hash(parts.join('_'));
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

    function lastKey(card) {
        return 'hayfilms_last_' + (cardSite(card) === 'af' ? 'af_' : '') + card.hf_id;
    }

    function remember(card, key) {
        Lampa.Storage.set(lastKey(card), key);
    }

    function lastWatched(card) {
        var value = parseInt(Lampa.Storage.get(lastKey(card), '-1'), 10);
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

        // Lampa adds only torrents to History by itself; online sources add what they play.
        try { Lampa.Favorite.add('history', card, 100); } catch (e) {}

        Lampa.Loading.start(function () {
            Lampa.Loading.stop();
        });

        resolveEpisode(episode.sources, function (stream) {
            Lampa.Loading.stop();
            remember(card, episode.key);

            var hash = episodeHash(card, episode.key);

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
                        timeline: Lampa.Timeline.view(episodeHash(card, other.key)),
                        card: card
                    };

                    // Resolved when the viewer moves to it; stream links expire.
                    entry.url = function (call) {
                        resolveEpisode(other.sources, function (next) {
                            remember(card, other.key);
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

    // A film: one entry with every player's stream, best first. A series: one entry per episode
    // number, with that episode from every player (both sites), best first; a lone film-player beside
    // a series (a trailer, say) is left out.
    function episodeList(card) {
        var players = playersById[card.id] || [];
        var series = players.filter(function (player) { return player.series; }).length > 0;

        if (!series) {
            var sources = [];

            players.forEach(function (player) {
                if (player.episodes[0]) sources.push({ host: player.host, url: player.episodes[0].url });
            });

            return sources.length ? [{ title: '', key: 0, number: 1, sources: sources }] : [];
        }

        var byNumber = {};

        players.forEach(function (player) {
            if (!player.series) return;

            player.episodes.forEach(function (episode, index) {
                var number = episode.number || index + 1;
                var entry = byNumber[number];

                if (!entry) entry = byNumber[number] = { title: episode.title || ('Սերիա ' + number), key: number - 1, number: number, sources: [] };

                entry.sources.push({ host: player.host, url: episode.url });
            });
        });

        return Object.keys(byNumber)
            .map(function (number) { return byNumber[number]; })
            .sort(function (a, b) { return a.number - b.number; });
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
                var view = Lampa.Timeline.view(episodeHash(card, episode.key));
                var hosts = [];

                episode.sources.forEach(function (source) {
                    if (hosts.indexOf(source.host.name) < 0) hosts.push(source.host.name);
                });

                return {
                    title: (view.percent >= 90 ? '✓ ' : '') + episode.title,
                    subtitle: (view.percent > 0 && view.percent < 90 ? view.percent + '% · ' : '') + hosts.join(', '),
                    selected: episode.key === last,
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

        var best = (playersById[card.id] || [])[0];
        var button = $('<div class="full-start__button selector view--online view--hayfilms" data-subtitle="hayfilms.com · armfilm.co">' +
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
        // For tests and troubleshooting from a console: what the card pages found.
        window.hayfilms_debug = { players: playersById, episodes: episodeList, twin: findTwin };

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
