const webpack = require('webpack');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['arweave.net', 'arweave.nyc'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'arweave.nyc',
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

    if (isServer) {
      // Polyfill `self` for server-side so that @permaweb/aoconnect
      // (which references `self` internally) can be imported during SSR.
      config.plugins.push(
        new webpack.BannerPlugin({
          raw: true,
          entryOnly: false,
          banner: 'if(typeof self==="undefined"){globalThis.self=globalThis;}',
        })
      );
    }

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
    const aoconnectResolved = require.resolve("@permaweb/aoconnect");

    config.resolve.alias = {
      ...config.resolve.alias,
      "$/utils": require.resolve("@dha-team/arbundles/build/node/esm/src/utils"),
      // Force Next/Webpack to use the ESM entry instead of the prebundled
      // `dist/browser.js` (which can trip Next's parser with newer aoconnect versions).
      "@permaweb/aoconnect": path.join(path.dirname(aoconnectResolved), "index.js"),
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
    "@permaweb/aoprofile",
    "@permaweb/libs",
    "@rainbow-me/rainbowkit",
    "wagmi",
    "viem",
  ],
  // Proxy API requests to the configured CU endpoint.
  // This can help avoid CORS issues in development.
  async rewrites() {
    const cuUrl = process.env.NEXT_PUBLIC_HYPERBEAM_URL ||
      process.env.NEXT_PUBLIC_AO_CU_URL ||
      'https://cu.ao-testnet.xyz';

    return [
      {
        source: '/api/ao/:path*',
        destination: `${cuUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
