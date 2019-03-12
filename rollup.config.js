import cleanup from 'rollup-plugin-cleanup';

export default {
  input: 'src/main.mjs',
  output: {
    file: 'dist/browser.mjs',
    format: 'esm',
  },
  external: [
    'fast-deep-equal',
    'object-assign-deep',
    'axios',
  ],
  plugins: [cleanup({
    extensions: ['js', 'mjs'],
  })],
};
