/*******************
 * Debugging methods
 * (inspired from https://github.com/tilleps/debug-levels)
 ********************/
import nodeNoop from 'node-noop';
const noop = nodeNoop.noop;

const logLevels = [
  'error',
  'warn',
  'log',
  'debug',
  'info',
  'verbose'
];

function getConsoleMethodFor(l) {
  let m = console.log;
  if (l != 'debug' && console[l])
    m = console[l];

  return function() {
    Function.prototype.apply.call(m, console, arguments);
  };
}

export default class Debugger {
  constructor(level) {
    this.level = level || process.env.DEBUG_LEVEL || 'log';
  }

  set level(level) {
    var key = logLevels.indexOf(level);
    if (key == -1)
      throw new Error('Log level found in allowed levels');
    this._level = key;
    this._updateLoggers();
  }

  get level() {
    return logLevels[this._level];
  }

  _updateLoggers() {
    let allowed = logLevels.slice(0, this._level + 1);
    let locked = logLevels.slice(this._level + 1);

    for (let l of allowed) {
      this[l] = getConsoleMethodFor(l);
    }
    for (let l of locked)
      this[l] = noop;
  }
}
