import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __CLIENT_VERSION__: JSON.stringify(pkg.version) },
  build: { minify: false },
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Starledger',
        version: pkg.version,
        // AGENTS.md §5: PTS only until toleration, removed in scope 14
        match: ['https://s808-en.ogame.gameforge.com/game/index.php*'],
        grant: [
          'GM_getValue',
          'GM_setValue',
          'GM_deleteValue',
          'GM_xmlhttpRequest',
          'GM_addStyle',
          'GM_registerMenuCommand',
        ],
        connect: ['*'],
      },
      build: { fileName: 'starledger.user.js' },
    }),
  ],
});
