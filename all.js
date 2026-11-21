/*
 * Lampar — one link for all of @aaramg's Lampa plugins (short link: is.gd/lampar).
 * To add a plugin, put its file name in PLUGINS; everyone who installed the link gets it
 * on their next Lampa start. Each plugin guards against loading twice, so having one also
 * installed on its own does no harm. ES5 for old Android TV WebViews.
 */
(function () {
    'use strict';

    if (window.plugin_lampar_ready) return;
    window.plugin_lampar_ready = true;

    var BASE = 'https://aaramg.github.io/lampa-channels/';
    var NAME = 'Lampar';

    var PLUGINS = [
        'hayfilms.js',  // HayFilms: Armenian films and series from hayfilms.com
        'channels.js'   // Channels: Netflix, HBO / Max, Disney, Apple TV+, ...
    ];

    function load() {
        var urls = PLUGINS.map(function (file) { return BASE + file; });

        if (Lampa.Utils && Lampa.Utils.putScriptAsync) Lampa.Utils.putScriptAsync(urls, function () {});
        else {
            urls.forEach(function (url) {
                var script = document.createElement('script');

                script.src = url;
                document.head.appendChild(script);
            });
        }
    }

    // A plugin added by URL shows as "Untitled" in Settings → Extensions; name our entry.
    function nameSelf() {
        if (!Lampa.Plugins || !Lampa.Plugins.get) return;

        var changed = false;

        Lampa.Plugins.get().forEach(function (plugin) {
            if (plugin.url && /is\.gd\/lampar|\/lampa-channels\/all\.js/.test(plugin.url) && plugin.name !== NAME) {
                plugin.name = NAME;
                plugin.author = '@aaramg';
                changed = true;
            }
        });

        if (changed) Lampa.Plugins.save();
    }

    load();

    try { nameSelf(); } catch (e) {}
})();
