import isValidPath from 'is-valid-path';
import debugModule from 'debug-levels';
import sparqlClient from 'virtuoso-sparql-client';
import equal from 'fast-deep-equal';
import isNode from 'detect-node';
import jsonfile from 'jsonfile';

const debug = debugModule('jsonld-converter');
const DEFAULT_OPTIONS = {
  context: 'http://schema.org/',
  endpoint: 'http://dbpedia.org/sparql'
};

const KEY_VOCABULARIES = {
  JSONLD: {
    id: '@id',
    lang: '@language',
    value: '@value'
  },
  PROTO: {
    id: 'id',
    lang: 'language',
    value: 'value'
  }
};

function defaultSparql(endpoint) {
  let client = new sparqlClient.Client(endpoint);
  client.setOptions("application/json");
  return q => client.query(q);
}

function parsePrefixes(prefixes) {
  return Object.keys(prefixes)
    .map(p => `PREFIX ${p}: <${prefixes[p]}>`);
}

/**
 * Apply the prototype to a single line of query results
 */
function sparql2proto(line, proto, options) {
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
      instance[k] = toJsonldValue(line[variable], options);
  });
  return instance;
}

const XSD = 'http://www.w3.org/2001/XMLSchema#';

function xsd(resource) {
  return XSD + resource;
}
/**
 * Prepare the output managing languages and datatypes
 */
function toJsonldValue(input, options) {
  let [value, datatype] = input;
  switch (datatype) {
    case XSD('boolean'):
      return value != 'false' && value != 0; // jshint ignore:line
    case XSD('integer'):
    case XSD('nonPositiveInteger'):
    case XSD('negativeInteger'):
    case XSD('nonNegativeInteger'):
    case XSD('xs:positiveInteger'):
    case XSD('long'):
    case XSD('int'):
    case XSD('short'):
    case XSD('byte'):
    case XSD('unsignedLong'):
    case XSD('unsignedInt'):
    case XSD('unsignedShort'):
    case XSD('unsignedByte'):
      return parseInt(value);
    case XSD('decimal'):
    case XSD('float'):
    case XSD('double'):
      value = value.replace('INF', 'Infinity');
      return parseFloat(value);
  }
  // if here, it is a string or a date, that are not parsed

  let lang = input['xml:lang'];

  let voc = options.voc;
  if (lang) {
    let obj = {};
    obj[voc.lang] = lang;
    obj[voc.value] = value;
    return obj;
  }
  return value;
}

/**
 * Merge base and addition, by defining/adding in an
 * array the values in addition to the base object.
 * @return the base object merged.
 */
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
  if (isNode && isValidPath(input)) {
    debug.verbose('loading input from %s', path);
    input = jsonfile.readFileSync(input);
  }

  if (typeof input != 'object')
    throw new Error(`Input format not valid`);

  let opt = Object.assign({},
    DEFAULT_OPTIONS, {
      context: input['@context'],
    }, options);
  debug.debug('options:', JSON.stringify(opt, null, 2));

  let {
    proto,
    query
  } = jsonld2query(input);
  var isJsonLD = input['@graph'];
  var voc = KEY_VOCABULARIES[isJsonLD ? 'JSONLD' : 'PROTO'];
  opt.voc = voc;

  let sparqlFun = opt.sparqlFunction || defaultSparql(opt.endpoint);

  return sparqlFun(query).then((sparqlRes) => {
    debug.verbose(sparqlRes);
    let bindings = sparqlRes.results.bindings;
    // apply the proto
    let instances = bindings.map(b => sparql2proto(b, proto, opt));
    // merge lines with the same id
    let content = [];
    instances.reduce((old, inst) => {
      let id = inst[voc.id];
      if (old[voc.id] != id) {
        // it is a new one
        content.push(inst);
        return inst;
      }
      // otherwise modify previous one
      mergeObj(old, inst);
      return old;
    }, {});

    if (isJsonLD)
      return {
        '@context': opt.context,
        '@graph': content
      };
    return content;
  });
}

export function jsonld2query(input) {
  var proto = input['@graph'] || input.proto;
  if (Array.isArray(proto)) proto = proto[0];


  // get all props starting with '$'
  var modifiers = {};
  Object.keys(input)
    .filter(k => k.startsWith('$'))
    .forEach(k => {
      modifiers[k] = input[k];
      delete input[k];
    });

  var vars = ['?id'];
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
      let _var = options.includes('sample') ?
        `SAMPLE(${id}) AS ${id}` : id;
      vars.push(_var);
      return required ? q : `OPTIONAL { ${q} }`;
    })
    .concat(asArray(modifiers.$where));

  var limit = modifiers.$limit ? 'LIMIT ' + modifiers.$limit : '';
  var distinct = modifiers.$distinct === false ? '' : 'DISTINCT';
  var prefixes = modifiers.$prefixes ? parsePrefixes(modifiers.$prefixes) : [];

  var query = `${prefixes.join('\n')}
  SELECT ${distinct} ${vars.join(',')}
  WHERE {
    ${wheres.join('.\n')}
  }
  ${limit}
  `;

  debug.debug(query);
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
