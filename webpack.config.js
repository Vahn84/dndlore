const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
	entry: './src/index.tsx',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.[contenthash].js',
		publicPath: '/',
		clean: true,
	},
	devServer: {
		static: {
			directory: path.join(__dirname, 'public'),
		},
		historyApiFallback: true,
		port: 3001,
		host: '0.0.0.0',
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js', '.jsx'],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
							['@babel/preset-react', { runtime: 'automatic' }],
							'@babel/preset-typescript',
						],
					},
				},
			},
			{
				test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
				type: 'asset/resource',
				generator: {
					filename: 'static/media/[name][hash][ext][query]',
				},
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
			{
				test: /\.s[ac]ss$/i,
				use: [
					'style-loader',

					{
						loader: 'css-loader',
						options: { importLoaders: 1 },
					},
					'sass-loader',
				],
			},
		],
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './public/index.html',
			inject: 'body',
		}),
		// DefinePlugin can be extended later for env vars
		new Dotenv({
			path: path.resolve(
				__dirname,
				process.env.NODE_ENV === 'production'
					? '.env.production'
					: '.env.development'
			),
			systemvars: true, // opzionale: permette override con env di sistema
			allowEmptyValues: true, // opzionale
			silent: true, // non fallire se il file .env.* non esiste nel container
		}),
	],
};
