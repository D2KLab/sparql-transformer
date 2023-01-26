import isValidPath from 'is-valid-path';
import jsonfile from 'jsonfile';

import sparqlTransformer from './main.mjs';

export default function(input, options = {}) {
    if (isValidPath(input)) input = jsonfile.readFileSync(input);

    options.env = process && process.env;
    return sparqlTransformer(input, options);
}