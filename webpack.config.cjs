const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		index: './src/index.js',
		'test-cowboy': './src/test-cowboy.js',
	},
	resolve: {
		alias: {
			three: path.resolve(__dirname, 'node_modules/three'),
		},
		symlinks: false,
		preferAbsolute: true,
	},
	devServer: {
		static: {
			directory: path.join(__dirname, 'dist'),
		},
		host: '0.0.0.0',
		server: 'https',
		compress: true,
		port: 8081,
		client: {
			overlay: { warnings: false, errors: true },
		},
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	plugins: [
		new ESLintPlugin({
			extensions: ['js'],
			eslintPath: require.resolve('eslint'),
			overrideConfigFile: path.resolve(__dirname, './eslint.config.cjs'),
		}),
		new HtmlWebpackPlugin({
			template: './src/index.html',
			filename: 'index.html',
			chunks: ['index'],
		}),
		new HtmlWebpackPlugin({
			template: './src/test-cowboy.html',
			filename: 'test-cowboy.html',
			chunks: ['test-cowboy'],
		}),
		new CopyPlugin({
			patterns: [
				{ from: 'src/assets', to: 'assets' },
				{ from: 'src/favicon.ico', to: 'favicon.ico' }
			],
		}),
	],
	devtool: 'source-map',
};
