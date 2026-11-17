/*
 * The Disney plugin grew into Channels (channels.js), which keeps the Disney page and adds
 * Netflix, HBO / Max, Apple TV+, Prime Video, Hulu, Paramount+, Studios and Kids.
 * This file stays so TVs that installed disney.js by URL get Channels without reinstalling.
 */
(function () {
    'use strict';

    if (window.plugin_channels_ready) return;

    var script = document.createElement('script');
    script.src = 'https://aaramg.github.io/lampa-disney/channels.js';
    document.head.appendChild(script);
})();
