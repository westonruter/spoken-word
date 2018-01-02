/* eslint-env node */

const path = require( 'path' );
const CleanWebpackPlugin = require( 'clean-webpack-plugin' );

module.exports = {
	entry: './src/index.js',
	output: {
		path: path.resolve( __dirname, 'dist' ),
		filename: 'app.js',
		libraryTarget: 'window',
		library: 'spokenWord',
	},
	plugins: [
		new CleanWebpackPlugin( [ 'dist' ] ),
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
