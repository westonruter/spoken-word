<?php
/**
 * Plugin Name: Text to Speech
 */

add_filter( 'the_content', function( $content ) {
	if ( is_feed() ) { // @todo Better condition.
		return $content;
	}
	ob_start();
	?>
	<fieldset hidden class="text-to-speech-controls">
		<legend><?php esc_html_e( 'Speak Article' ); ?></legend>
		<button type="button" class="play">Play</button>
		<button type="button" class="pause-resume" disabled>
			Pause/Resume
		</button>
		<button type="button" class="stop" disabled>Stop</button>
		<!-- Volume -->
		<!-- Rate -->
		<!-- Pitch -->
	</fieldset>
	<?php
	$controls = ob_get_clean();
	return $controls . $content;
}, 100 );

add_action( 'wp_enqueue_scripts', function() {
	wp_enqueue_script( 'text-to-speech', plugin_dir_url( __FILE__ ) . 'text-to-speech.js', array( 'jquery' ) );
	wp_enqueue_style( 'text-to-speech', plugin_dir_url( __FILE__ ) . 'text-to-speech.css' );
} );
