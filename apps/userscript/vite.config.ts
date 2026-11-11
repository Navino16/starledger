import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __CLIENT_VERSION__: JSON.stringify(pkg.version) },
  build: {
    minify: false,
    // Keeps the `//!` compliance comments in the built file reviewers read (AGENTS.md §0)
    rolldownOptions: { output: { comments: { legal: true } } },
  },
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
          'GM_xmlhttpRequest',
          'GM_addStyle',
          'GM_registerMenuCommand',
        ],
        noframes: true,
        // AGENTS.md §1.9: only the user-configured server, contacted after consent; Tampermonkey asks before any undeclared domain
        connect: ['*'],
      },
      build: { fileName: 'starledger.user.js' },
    }),
  ],
});
