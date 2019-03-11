/* eslint no-underscore-dangle: "off" */

/** *****************
 * Debugging methods
 * (inspired from https://github.com/tilleps/debug-levels)
 ******************* */
const noop = () => {};

const logLevels = [
  'error',
  'warn',
  'log',
  'debug',
  'info',
  'verbose',
];

function getConsoleMethodFor(l) {
  let m = console.log;
  if (l !== 'debug' && console[l]) m = console[l];

  return function log(...args) {
    Function.prototype.apply.call(m, console, args);
  };
}

export default class Debugger {
  constructor(level) {
    this.level = level || 'log';
  }

  set level(level) {
    const key = logLevels.indexOf(level);
    if (key === -1) throw new Error('Log level found in allowed levels');
    this._level = key;
    this._updateLoggers();
  }

  get level() {
    return logLevels[this._level];
  }

  _updateLoggers() {
    const allowed = logLevels.slice(0, this._level + 1);
    const locked = logLevels.slice(this._level + 1);

    for (const l of allowed) {
      this[l] = getConsoleMethodFor(l);
    }
    for (const l of locked) this[l] = noop;
  }
}
