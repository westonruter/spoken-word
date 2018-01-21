=== Spoken Word ===
Contributors: westonruter
Tags: tts, text-to-speech, audio, voice, read-along
Requires at least: 4.7
Tested up to: 4.9
Stable tag: 0.1.0
License: MIT
License URI: https://en.wikipedia.org/wiki/MIT_License
Requires PHP: 5.4

Add text-to-speech (TTS) to content, with playback controls, read-along highlighting, multi-lingual support, and settings for rate, pitch, and voice.

== Description ==

* Uses local text-to-speech engine in user's browser. Directly interfaces with the `speechSynthesis` browser API. Zero external requests or dependencies.
* Words are selected/highlighted as they are being spoken to allow you to read along.
* Pauses of different length added are between headings versus paragraphs.
* Controls remain in view during playback, with each the current text being spoken persistently being scrolled into view. (Requires browser support for `position:sticky`.)
* Back/forward controls allow you to skip to the next paragraph; when not speaking, the next paragraph to read will be selected entirely.
* Select text to read from that point; click on text during speech to immediately change position.
* Multi-lingual support, allowing embedded text with `[lang]` attribute to be spoken by the appropriate voice (assuming the user has it installed).
* Settings for changing the default voice (for each language), along with settings for the rate of speech and its pitch. (Not supported by all engines.) Changes can be made while speaking.
* Hit escape to pause during playback.
* Voice preferences are persistently stored in `localStorage`, with changes synced across windows (of a given site).
* Ability to use JS in standalone manner (such as in bookmarklet).

A bookmarklet can be used to load the Spoken Word functionality into any site, even non-WordPress sites where the plugin is not installed. The key is to use the appropriate `contentSelector`:

<pre lang="js">
( () => {
	const link = document.createElement( 'link' );
	link.rel = 'stylesheet';
	link.href = 'https://example.com/wp-content/plugins/spoken-word/css/style.css';
	document.head.appendChild( link );

	const script = document.createElement( 'script' );
	script.src = 'https://example.com/wp-content/plugins/spoken-word/dist/spoken-word.js';
	script.addEventListener( 'load', () => {
		spokenWord.initialize( {
			contentSelector: 'article'
		} );
	} );
	document.head.appendChild( script );
} )();
</pre>

The `spokenWord.initialize()` function takes an object as its argument which can have the following properties:

<pre>
 * @param {string}  contentSelector         - CSS Selector to find the elements for speaking.
 * @param {Element} rootElement             - Root element within which to look for content.
 * @param {Object}  chunkifyOptions         - Options passed into chunkify.
 * @param {boolean} useDashicons            - Whether to use Dashicons.
 * @param {Object}  defaultUtteranceOptions - Default utterance options when none are supplied from localStorage.
</pre>

The settings for Spoken Word are presented in an HTML5 `dialog` element. For browsers that do not yet support this feature, the plugin bundles the [dialog-polyfill](https://github.com/GoogleChrome/dialog-polyfill). The polyfill is only included if it is detected the browser does not support `dialog` natively. The inclusion of the polyfill can be disabled by adding the following to your theme or plugin:

<pre lang="php">
add_filter( 'spoken_word_include_dialog_polyfill', '__return_false' );
</pre>

The dialog and the controls are rendered using [Preact](https://preactjs.com/). For a list of all the modules used by this plugin, see the [package.json](https://github.com/westonruter/spoken-word/blob/master/package.json).

This plugin is [developed on GitHub](https://github.com/westonruter/spoken-word) where the source can be viewed. Please [report issues](https://github.com/westonruter/spoken-word/issues) there. Pull requests welcome.

== Changelog ==

= 0.1.0 (Unreleased) =

* Initial release.
