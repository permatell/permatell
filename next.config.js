const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['arweave.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Add rule for handling ESM modules
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    // Add polyfills for node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        path: require.resolve('path-browserify'),
        zlib: require.resolve('browserify-zlib'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        assert: require.resolve('assert/'),
        os: require.resolve('os-browserify/browser'),
        url: require.resolve('url/'),
        process: require.resolve('process/browser'),
      };
      
      // Add process polyfill
      config.plugins.push(
        new (require('webpack')).ProvidePlugin({
          process: 'process/browser',
        })
      );
    }

    // Add specific alias for arbundles utils
    config.resolve.alias = {
      ...config.resolve.alias,
      "$/utils": require.resolve("@dha-team/arbundles/build/node/esm/src/utils"),
    };

    // Add specific handling for arbundles package
    config.module.rules.push({
      test: /node_modules\/@dha-team\/arbundles/,
      use: {
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env"],
          plugins: ["@babel/plugin-transform-modules-commonjs"],
        },
      },
    });

    return config;
  },
  transpilePackages: [
    "@ar.io/sdk",
    "@ardrive/turbo-sdk",
    "@dha-team/arbundles",
    "@permaweb/aoconnect",
  ],
  async rewrites() {
    return [
      {
        source: '/api/ao/:path*',
        destination: 'https://cu31.ao-testnet.xyz/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 