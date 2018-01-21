<?php
/**
 * Spoken Word
 *
 * @package   Spoken_Word
 * @author    Weston Ruter
 * @copyright 2018
 * @license   MIT
 *
 * @wordpress-plugin
 * Plugin Name: Spoken Word
 * Description: Add text-to-speech (TTS) to content, with playback controls, read-along highlighting, multi-lingual support, and settings for rate, pitch, and voice.
 * Plugin URI: https://github.com/westonruter/spoken-word
 * Author: Weston Ruter
 * Author URI: https://weston.ruter.net/
 * License: MIT
 * Version: 1.0.1
 */

namespace Spoken_Word;

const VERSION = '1.0.1';

/**
 * Show admin notice when dist is not built.
 */
function add_build_required_admin_notice() {
	?>
	<div class="notice error">
		<p>
			<?php esc_html_e( 'You appear to be running Spoken Word from source. You must run the following to do so:', 'spoken-word' ); ?>
			<code>npm install; npm run build-dist</code>
		</p>
	</div>
	<?php
}

if ( ! file_exists( __DIR__ . '/dist/spoken-word.js' ) ) {
	add_action( 'admin_notices', __NAMESPACE__ . '\add_build_required_admin_notice' );
	return;
}

/**
 * Enqueue scripts.
 *
 * @since 0.1.0
 */
function enqueue_scripts() {
	wp_enqueue_style( 'dashicons' );
	wp_enqueue_style( 'spoken-word', plugin_dir_url( __FILE__ ) . 'css/style.css' );

	$handle    = 'spoken-word';
	$src       = plugin_dir_url( __FILE__ ) . 'dist/spoken-word.js';
	$deps      = array();
	$in_footer = true;
	wp_enqueue_script( $handle, $src, $deps, VERSION, $in_footer );

	/**
	 * Filters whether the dialog-polyfill should be included.
	 *
	 * @param bool $included Whether included.
	 */
	$dialog_polyfill_included = apply_filters( 'spoken_word_include_dialog_polyfill', true );

	if ( $dialog_polyfill_included ) {
		wp_add_inline_script(
			$handle,
			sprintf(
				'if ( ! ( "showModal" in document.createElement( "dialog" ) ) ) { document.write( %s ); }',
				wp_json_encode( sprintf(
					'<script src="%s"></script><link rel="stylesheet" href="%s">', // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet, WordPress.WP.EnqueuedResources.NonEnqueuedScript
					esc_url( plugin_dir_url( __FILE__ ) . 'dist/dialog-polyfill.js' ),
					esc_url( plugin_dir_url( __FILE__ ) . 'dist/dialog-polyfill.css' )
				) )
			)
		);
	}

	// Export locale data.
	wp_add_inline_script(
		'spoken-word',
		'spokenWord.setLocaleData( ' . wp_json_encode( get_jed_locale_data( 'spoken-word' ) ) . ' );',
		'after'
	);

	// Initialize.
	$exports = array(
		'contentSelector' => '.hentry .entry-content, .h-entry .e-content, [itemprop="articleBody"]',
		'useDashicons'    => true,
	);
	wp_add_inline_script( $handle, sprintf( 'spokenWord.initialize( %s );', wp_json_encode( $exports ) ), 'after' );

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
