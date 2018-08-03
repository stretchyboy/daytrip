const path = require('path');
//var HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

  module.exports = {
    mode:"development",
    entry: './src/main.js',
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist')
    },
    plugins: [
      //new HardSourceWebpackPlugin(),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "[name].css",
        chunkFilename: "[id].css"
      })
  ],
   module: {
     rules: [
        {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              // you can specify a publicPath here
              // by default it use publicPath in webpackOptions.output
              outputPath: "~/dist/",
              publicPath: '/'
            }
          },
          "css-loader"
        ]
      },
       /*{
         test: /\.css$/,
         use: [
           'style-loader',
           'css-loader'
         ]
       },*/
          {
         test: /\.(png|svg|jpg|gif)$/,
         use: [
           {
             loader: 'file-loader',
            options: {
               // name: '[name].[ext]',
               outputPath: "~/dist/",
              publicPath: '/'
            }
           }
         ]
       },
            {
                test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
                use: [{
                    loader: 'file-loader',
                    options: {
                       // name: '[name].[ext]',
                        outputPath: '~/dist/fonts/',
                      publicPath: '/fonts/'
                    }
                }]
            }
     ]
   }
  };