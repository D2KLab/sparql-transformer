import cleanup from 'rollup-plugin-cleanup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/main.mjs',
  output: {
    file: 'dist/browser.mjs',
    format: 'esm',
  },
  plugins: [commonjs(), resolve(), cleanup({
    extensions: ['js', 'mjs'],
  })],
};
