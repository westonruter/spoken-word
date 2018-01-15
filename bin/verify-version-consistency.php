#!/usr/bin/env
<?php
/**
 * Verify versions referenced in plugin match.
 *
 * @codeCoverageIgnore
 * @package Spoken_Word
 */

if ( 'cli' !== php_sapi_name() ) {
	fwrite( STDERR, "Must run from CLI.\n" );
	exit( 1 );
}

$versions = array();

$versions['package.json']      = json_decode( file_get_contents( dirname( __FILE__ ) . '/../package.json' ) )->version;
$versions['package-lock.json'] = json_decode( file_get_contents( dirname( __FILE__ ) . '/../package-lock.json' ) )->version;
$versions['composer.json']     = json_decode( file_get_contents( dirname( __FILE__ ) . '/../composer.json' ) )->version;

$readme_txt = file_get_contents( dirname( __FILE__ ) . '/../readme.txt' );
if ( ! preg_match( '/Stable tag:\s+(?P<version>\S+)/i', $readme_txt, $matches ) ) {
	echo "Could not find stable tag in readme\n";
	exit( 1 );
}
$versions['readme.txt#stable-tag'] = $matches['version'];

if ( ! preg_match( '/== Changelog ==\s+=\s+(?P<version>\d+\.\d+(?:.\d+)?)/', $readme_txt, $matches ) ) {
	echo "Could not find version i  n readme.txt changelog\n";
	exit( 1 );
}
$versions['readme.txt#changelog'] = $matches['version'];

$readme_md = file_get_contents( dirname( __FILE__ ) . '/../readme.md' );
if ( ! preg_match( '/## Changelog ##\s+###\s+(?P<version>\d+\.\d+(?:.\d+)?)/', $readme_md, $matches ) ) {
	echo "Could not find version in readme.md changelog\n";
	exit( 1 );
}
$versions['readme.md#changelog'] = $matches['version'];

foreach ( glob( dirname( __FILE__ ) . '/../*.php' ) as $file ) {
	$plugin_file = file_get_contents( $file );
	if ( ! preg_match( '#\*\s+Plugin Name\s*:#', $plugin_file ) ) {
		continue;
	}
	if ( ! preg_match( '/\*\s*Version:\s*(?P<version>\d+\.\d+(?:.\d+)?)/', $plugin_file, $matches ) ) {
		echo "Could not find version in readme metadata ($plugin_file)\n";
		exit( 1 );
	}
	$versions['plugin.php#metadata'] = $matches['version'];

	if ( ! preg_match( '/define\( \'\w*VERSION\', \'(?P<version>[^\\\']+)\'/', $plugin_file, $matches ) && ! preg_match( '/const VERSION = \'(?P<version>[^\\\']+)\'/', $plugin_file, $matches ) ) {
		echo "Could not find version in VERSION constant\n";
		exit( 1 );
	}
	$versions['plugin.php#VERSION'] = $matches['version'];
}

fwrite( STDERR, "Version references:\n" );

echo json_encode( $versions, JSON_PRETTY_PRINT ) . "\n";

if ( 1 !== count( array_unique( $versions ) ) ) {
	fwrite( STDERR, "Error: Not all version references have been updated.\n" );
	exit( 1 );
}
