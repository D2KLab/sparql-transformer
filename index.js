import fs from 'fs';
import isValidPath from 'is-valid-path';
import debugModule from 'debug-levels';
import sparqlClient from 'virtuoso-sparql-client';
import equal from 'fast-deep-equal';

const debug = debugModule('jsonld-converter');
const DEFAULT_OPTIONS = {
  context: 'http://schema.org/',
  endpoint: 'http://dbpedia.org/sparql'
};

function defaultSparql(endpoint) {
  let client = new sparqlClient.Client(endpoint);
  client.setOptions("application/json");
  return q => client.query(q);
}

function sparql2proto(line, proto) {
  let instance = Object.assign({}, proto);
  let lineKeys = Object.keys(line);

  Object.keys(instance).forEach(k => {
    let variable = instance[k];
    // TODO if value is an obj
    // not a variable, continue
    if (!variable.startsWith('?')) return;
    variable = variable.substring(1);
    // variable not in result, delete from
    if (!lineKeys.includes(variable))
      delete instance[k];
    else
      instance[k] = toJsonldValue(line[variable]);
  });
  return instance;
}

function toJsonldValue(input) {
  let value = input.value;
  let lang = input['xml:lang'];

  if (lang)
    return {
      '@value': value,
      '@language': lang
    };

  return value;
}

function mergeObj(base, addition) {
  Object.keys(addition).forEach(k => {
    let b = base[k],
      a = addition[k];

    if (!b) {
      base[k] = a;
      return;
    }

    if (Array.isArray(b)) {
      if (!b.find(x => equal(a, x)))
        b.push(a);
      return;
    }
    if (equal(a, b)) return;
    else base[k] = [b, a];
  });

  return base;
}


export default function schemaConv(input, options = {}) {
  if (isValidPath(input)) {
    debug.verbose('loading input from %s', input);
    if (!fs.existsSync(input))
      throw new Error(`Unable to find file ${input}`);
    input = JSON.parse(fs.readFileSync(input, 'utf8'));
  }
  if (typeof input != 'object')
    throw new Error(`Input format not valid`);

  let opt = Object.assign({}, DEFAULT_OPTIONS, options);
  debug.debug('options:', JSON.stringify(opt, null, 2));

  let {
    proto,
    query
  } = jsonld2query(input);

  let sparqlFun = opt.sparqlFunction || defaultSparql(opt.endpoint);

  return sparqlFun(query).then((sparqlRes) => {
    debug.verbose(sparqlRes);
    let bindings = sparqlRes.results.bindings;
    // apply the proto
    let instances = bindings.map(b => sparql2proto(b, proto));
    // merge lines with the same id
    let content = [];
    instances.reduce((old, inst) => {
      let id = inst['@id'];
      if (old['@id'] != id) {
        // it is a new one
        content.push(inst);
        return inst;
      }
      // otherwise modify previous one
      mergeObj(old, inst);
      return old;
    }, {});

    console.log(content);
    var data = {
      '@context': opt.context,
      '@graph': content
    };
    return data;
  });
}

export function jsonld2query(input) {
  var proto = input['@graph'][0];

  // get all props starting with '$'
  var modifiers = {};
  Object.keys(input)
    .filter(k => k.startsWith('$'))
    .forEach(k => {
      modifiers[k] = input[k];
      delete input[k];
    });

  var wheres = Object.keys(proto)
    .filter(k => proto[k].startsWith('$'))
    .map((k, i) => {
      let v = proto[k].substring(1);
      let options = [];
      if (v.includes('$'))
        [v, ...options] = v.split('$');
      let required = options.includes('required');
      let id = '?v' + i;
      proto[k] = id;

      let q = `?id ${v} ${id}`;
      return required ? q : `OPTIONAL { ${q} }`;
    })
    .concat(asArray(modifiers.$where));

  var limit = modifiers.$limit ? 'LIMIT ' + modifiers.$limit : '';

  var query = `SELECT DISTINCT *
  WHERE {
    ${wheres.join('.\n')}
  }
  ${limit}
  `;

  return {
    query,
    proto
  };
}


function asArray(v) {
  if (!v) return [];
  if (!Array.isArray(v)) return [v];
  return v;
}
