import fs from 'fs';

import sparqlTransformer from './main.mjs';

export default function (input, options = {}) {
    if (fs.existsSync(input) && fs.lstatSync(input).isFile()) {
        input = JSON.parse(fs.readFileSync(input, 'utf8'));
    }

    options.env = process && process.env;
    return sparqlTransformer(input, options);
}
