const path = require( 'path' );

module.exports = {
	entry: './src/index.js',
	output: {
		path: path.resolve( __dirname, 'dist' ),
		filename: 'app.js'
	},
	module: {
		rules: [
			{ test: /\.js$/, exclude: /node_modules/, loader: "babel-loader" }
		]
	}
};
