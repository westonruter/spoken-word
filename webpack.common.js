/* eslint-env node */

const path = require( 'path' );
const CleanWebpackPlugin = require( 'clean-webpack-plugin' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const nodeModulesPath = path.resolve( __dirname, 'node_modules' );

module.exports = {
	entry: {
		app: './src/index.js',
	},
	output: {
		path: path.resolve( __dirname, 'dist' ),
		filename: 'spoken-word.js',
		libraryTarget: 'window',
		library: 'spokenWord',
	},
	plugins: [
		new CleanWebpackPlugin( [ 'dist' ] ),
		new CopyWebpackPlugin(
			[
				nodeModulesPath + '/dialog-polyfill/dialog-polyfill.js',
				nodeModulesPath + '/dialog-polyfill/dialog-polyfill.css',
			]
		),
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				loader: 'babel-loader',
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: [ 'source-map-loader' ],
				enforce: 'pre',
			},
		],
	},
	resolve: {
		alias: {
			react: 'preact-compat',
			'react-dom': 'preact-compat',
			// Not necessary unless you consume a module using `createClass`.
			'create-react-class': 'preact-compat/lib/create-react-class',
		},
	},
};
