const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: { integrity: true },
    icon: './assets/icon',
    appBundleId: 'io.modelindex.app',
    appCategoryType: 'public.app-category.developer-tools',
    extraResource: [],
    // Ensure native modules are rebuilt for the packaged Electron ABI
    afterCopy: [],
  },
  rebuildConfig: {
    forceABI: 120,   // Electron v33 Node ABI — update when upgrading Electron
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: { owner: 'modelindex', name: 'modelindex' },
        prerelease: true,   // alpha releases are pre-releases
        draft: true,        // require manual promotion to avoid accidental deploys
      },
    },
  ],
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ModelIndex',
        setupIcon: './assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        background: './assets/dmg-background.png',
        format: 'ULFO',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'ModelIndex Contributors',
          homepage: 'https://github.com/modelindex/modelindex',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['linux'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-node-rebuild',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
