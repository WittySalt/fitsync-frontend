const os = require('os');
const path = require('path');

module.exports = function (config) {
  config.set({
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {},
      clearContext: false
    },
    jasmineHtmlReporter: {
      suppressAll: true
    },
    coverageReporter: {
      dir: path.join(__dirname, './coverage/fitsync-frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' } // lcov.info -> consumed by SonarQube
      ],
      // Coverage gate: build fails if coverage drops below these floors.
      // Set just under the current baseline (stmts ~73%, branches ~58%) so honest
      // regressions are caught while leaving a little headroom.
      check: {
        global: {
          statements: 70,
          lines: 70,
          functions: 68,
          branches: 50
        }
      }
    },
    reporters: ['progress', 'kjhtml'],
    customLaunchers: {
      ChromeHeadlessNoGpu: {
        base: 'ChromeHeadless',
        flags: [
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          `--user-data-dir=${path.join(os.tmpdir(), `karma-chrome-${Date.now()}`)}`
        ]
      }
    }
  });
};
