/* eslint-env node */
/* jshint node:true */
/* eslint-disable no-param-reassign */

module.exports = function( grunt ) {
	grunt.initConfig( {

		pkg: grunt.file.readJSON( 'package.json' ),

		copy: {
			build: {
				src: [
					'wp-plugin.php',
					'css/*.css',
					'dist/*.js',
					'languages/*.pot',
					'readme.txt',
				],
				dest: 'build',
				expand: true,
				dot: true,
			},
		},

		// Clean up the build
		clean: {
			build: {
				src: [ 'build' ],
			},
		},

		// Shell actions
		shell: {
			options: {
				stdout: true,
				stderr: true,
			},
			readme: {
				command: './dev-lib/generate-markdown-readme', // Generate the readme.md.
			},
			build_dist: {
				command: 'npm run build-dist',
			},
			verify_matching_versions: {
				command: 'php bin/verify-version-consistency.php',
			},
			create_release_zip: {
				command: 'if [ ! -e build ]; then echo "Run grunt build first."; exit 1; fi; if [ -e <%= pkg.name %>.zip ]; then rm <%= pkg.name %>.zip; fi; cd build; zip -r ../<%= pkg.name %>.zip .; cd ..; echo; echo "ZIP of build: $(pwd)/<%= pkg.name %>.zip"',
			},
			lint: {
				command: 'CHECK_SCOPE=all bash dev-lib/pre-commit',
			},
		},

		// Deploys a git Repo to the WordPress SVN repo
		wp_deploy: {
			deploy: {
				options: {
					svn_user: 'westonruter',
					plugin_slug: '<%= pkg.name %>',
					build_dir: 'build',
					assets_dir: 'wp-assets',
				},
			},
		},

	} );

	// Load tasks
	grunt.loadNpmTasks( 'grunt-contrib-clean' );
	grunt.loadNpmTasks( 'grunt-contrib-copy' );
	grunt.loadNpmTasks( 'grunt-shell' );
	grunt.loadNpmTasks( 'grunt-wp-deploy' );

	// Register tasks
	grunt.registerTask( 'default', [
		'build',
	] );

	grunt.registerTask( 'readme', [
		'shell:readme',
	] );

	grunt.registerTask( 'build', [
		'readme',
		'copy',
		'shell:build_dist',
	] );

	grunt.registerTask( 'build-release-zip', [
		'build',
		'shell:create_release_zip',
	] );

	grunt.registerTask( 'deploy', [
		'shell:lint',
		'build',
		'shell:verify_matching_versions',
		'shell:create_release_zip',
		'wp_deploy',
		'clean',
	] );
};
