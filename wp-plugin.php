<?php
/**
 * Spoken Word
 *
 * @package   Spoken_Word
 * @author    Weston Ruter
 * @copyright 2018
 * @license   GPL-2.0+
 *
 * @wordpress-plugin
 * Plugin Name: Spoken Word
 * Description: Add text-to-speech (TTS) to content, with playback controls, read-along highlighting, multi-lingual support, and settings for rate, pitch, and voice.
 * Author: Weston Ruter
 * License: GPLv2+
 */

namespace Spoken_Word;

const VERSION = '0.1.0';

/**
 * Enqueue scripts.
 *
 * @since 0.1.0
 */
function enqueue_scripts() {
	wp_enqueue_style( 'dashicons' );
	wp_enqueue_style( 'spoken-word', plugin_dir_url( __FILE__ ) . 'css/style.css' );

	$handle = 'spoken-word';
	$src = plugin_dir_url( __FILE__ ) . 'dist/app.js';
	$deps = array();
	$in_footer = true;
	wp_enqueue_script( $handle, $src, $deps, VERSION, $in_footer );

	// Export locale data.
	wp_add_inline_script(
		'spoken-word',
		'spokenWord.setLocaleData( ' . json_encode( get_jed_locale_data( 'spoken-word' ) ) . ' );',
		'after'
	);

	// Initialize.
	$exports = array(
		'contentSelector' => '.hentry .entry-content, .h-entry .e-content, [itemprop="articleBody"]',
		'useDashicons' => true,
	);
	wp_add_inline_script( $handle, sprintf( 'spokenWord.init( %s );', wp_json_encode( $exports ) ), 'after' );

}
add_action( 'wp_enqueue_scripts', __NAMESPACE__ . '\enqueue_scripts' );

/**
 * Returns Jed-formatted localization data.
 *
 * @since 0.1.0
 *
 * @param string $domain Translation domain.
 * @return array
 */
function get_jed_locale_data( $domain ) {
	$translations = \get_translations_for_domain( $domain );

	$locale = array(
		'domain'      => $domain,
		'locale_data' => array(
			$domain => array(
				'' => array(
					'domain' => $domain,
					'lang'   => \is_admin() ? \get_user_locale() : \get_locale(),
				),
			),
		),
	);

	if ( ! empty( $translations->headers['Plural-Forms'] ) ) {
		$locale['locale_data'][ $domain ]['']['plural_forms'] = $translations->headers['Plural-Forms'];
	}

	foreach ( $translations->entries as $msgid => $entry ) {
		$locale['locale_data'][ $domain ][ $msgid ] = $entry->translations;
	}

	return $locale;
}

/**
 * Load plugin text domain for translations.
 *
 * @since 0.1.0
 */
function load_plugin_textdomain() {
	\load_plugin_textdomain(
		'spoken-word',
		false,
		plugin_basename( dirname( __FILE__ ) ) . '/languages/'
	);
}
add_action( 'plugins_loaded', __NAMESPACE__ . '\load_plugin_textdomain' );
