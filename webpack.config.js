/* eslint-env node */

const path = require( 'path' );

module.exports = {
	entry: './src/index.js',
	output: {
		path: path.resolve( __dirname, 'dist' ),
		filename: 'app.js',
		libraryTarget: 'window',
		library: 'spokenWord',
	},
	devtool: 'source-map',
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
