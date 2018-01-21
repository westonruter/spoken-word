=== Spoken Word ===
Contributors: westonruter
Tags: tts, speech-synthesis, text-to-speech, audio, voice, read-along
Requires at least: 4.7
Tested up to: 4.9
Stable tag: 1.0.1
License: MIT
License URI: https://en.wikipedia.org/wiki/MIT_License
Requires PHP: 5.4

Add text-to-speech (TTS) to content, with playback controls, read-along highlighting, multi-lingual support, and settings for rate, pitch, and voice.

== Description ==

Add text-to-speech (TTS) to content, with playback controls, read-along highlighting, multi-lingual support, and settings for rate, pitch, and voice.

* Uses local text-to-speech engine in user's browser. Directly interfaces with the `speechSynthesis` browser API. Zero external requests or dependencies.
* Words are selected/highlighted as they are being spoken to allow you to read along.
* Skips speaking elements that should not be read, including footnote superscripts (the `sup` element).
* Pauses of different length added are between headings versus paragraphs.
* Controls remain in view during playback, with each the current text being spoken persistently being scrolled into view. (Requires browser support for `position:sticky`.)
* Back/forward controls allow you to skip to the next paragraph; when not speaking, the next paragraph to read will be selected entirely.
* Select text to read from that point; click on text during speech to immediately change position.
* Multi-lingual support, allowing embedded text with `[lang]` attribute to be spoken by the appropriate voice (assuming the user has it installed).
* Settings for changing the default voice (for each language), along with settings for the rate of speech and its pitch. (Not supported by all engines.) Changes can be made while speaking.
* Hit escape to pause during playback.
* Voice preferences are persistently stored in `localStorage`, with changes synced across windows (of a given site).
* Ability to use JS in standalone manner (such as in bookmarklet).
* Known to work in the latest desktop versions of Chrome, Firefox, and Safari. (Tested on OSX.) It does not work reliably in mobile/touch browsers on Android or iOS, apparently due both to the (still experimental) `speechSynthesis` API not being implemented well enough on those systems and/or programmatic range selection does not work the same way as on desktop. For these reasons, the functionality is disabled by default on mobile operating systems.

[Try it out](https://westonruter.github.io/spoken-word/test/example.html) on standalone example with some test content.

= Theme Config =

The settings for Spoken Word are presented in an HTML5 `dialog` element. For browsers that do not yet support this feature, the plugin bundles the [dialog-polyfill](https://github.com/GoogleChrome/dialog-polyfill). The polyfill is only included if it is detected the browser does not support `dialog` natively. The inclusion of the polyfill can be disabled by adding the following to your theme or plugin:

<pre lang="php">
add_filter( 'spoken_word_include_dialog_polyfill', '__return_false' );
</pre>

For themes that have a sticky header (such as the nav menu in Twenty Seventeen) you may need to add some additional CSS to ensure that the sticky-positioned playback controls do not get hidden behind the sticky header. For example in Twenty Seventeen, you can add the following to the Custom CSS in the Customizer:

<pre lang="css">
@media screen and (min-width: 782px) {
	body:not(.admin-bar) .spoken-word--active {
		top: calc( 0.5em + 70px );
	}
	body.admin-bar .spoken-word--active {
		top: calc( 0.5em + 32px + 70px );
	}
}
</pre>

= Internals =

A bookmarklet can be used to load the Spoken Word functionality into any site, even non-WordPress sites where the plugin is not installed. The key is to use the appropriate `contentSelector`:

<pre lang="js">
( () => {
	const link = document.createElement( 'link' );
	link.rel = 'stylesheet';
	link.href = 'https://unpkg.com/spoken-word/css/style.css';
	document.head.appendChild( link );

	const script = document.createElement( 'script' );
	script.src = 'https://unpkg.com/spoken-word/dist/spoken-word.js';
	script.addEventListener( 'load', () => {
		spokenWord.initialize( {
			contentSelector: [ /* 👈 Amend as desired. */
				'.hentry',
				'.entry-content',
				'.h-entry',
				'.e-content',
				'[itemprop="articleBody"]',
			].join( ', ' )
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

The dialog and the controls are rendered using [Preact](https://preactjs.com/). For a list of all the modules used by this plugin, see the [package.json](https://github.com/westonruter/spoken-word/blob/master/package.json).

This plugin is [developed on GitHub](https://github.com/westonruter/spoken-word) where the source can be viewed. Please [report issues](https://github.com/westonruter/spoken-word/issues) there. Pull requests welcome. The `spoken-word` package is also [published on npm](https://www.npmjs.com/package/spoken-word).

== Screenshots ==

1. Words are highlighted (selected) as they are spoken.
2. Change the rate, pitch, and voices used in speech.
3. Skip ahead to the desired paragraph with controls or via selecting with cursor.

== Changelog ==

= 1.0.1 (2018-01-21) =

Disable functionality in Android and iOS devices by default.

= 1.0.0 (2018-01-20) =

Initial release.
