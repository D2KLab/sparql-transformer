import isValidPath from 'is-valid-path';
import sparqlClient from 'virtuoso-sparql-client';
import equal from 'fast-deep-equal';
import isNode from 'detect-node';
import jsonfile from 'jsonfile';
import objectAssignDeep from 'object-assign-deep';
import Debugger from './debugger';

const debug = new Debugger();
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

function parseValues(values) {
  return Object.keys(values)
    .map(p => {
      let _v = asArray(values[p]).map(v => {
        if (v.startsWith('http')) return `<${v}>`;
        if (v.includes(':')) return v;
        return `"${v}"`;
      });
      return `VALUES ${sparqlVar(p)} {${_v.join(' ')}}`;
    });
}

/**
 * Apply the prototype to a single line of query results
 */
function sparql2proto(line, proto, options) {
  let instance = objectAssignDeep({}, proto);

  let fiiFun = fitIn(instance, line, options);
  Object.keys(instance).forEach(fiiFun);
  return instance;
}

/**
 * Apply the result of SPARQL to a single
 * property of the proto instance
 */
function fitIn(instance, line, options) {
  return function(k) {
    let variable = instance[k];
    // TODO if value is an obj
    if (typeof variable == 'object') {
      let fiiFun = fitIn(variable, line, options);
      Object.keys(variable).forEach(fiiFun);
      if (isEmptyObject(variable)) delete instance[k];
      return;
    }

    if (!variable.startsWith('?')) return;
    variable = variable.substring(1);

    // variable not in result, delete from
    if (!line[variable])
      delete instance[k];
    else
      instance[k] = toJsonldValue(line[variable], options);

    return instance;
  };
}

function isEmptyObject(target) {
  return !Object.getOwnPropertyNames(target).length;
}

const XSD = 'http://www.w3.org/2001/XMLSchema#';

function xsd(resource) {
  return XSD + resource;
}
/**
 * Prepare the output managing languages and datatypes
 */
function toJsonldValue(input, options) {
  let {
    value,
    datatype
  } = input;
  switch (datatype) {
    case xsd('boolean'):
      return value != 'false' && value != 0; // jshint ignore:line
    case xsd('integer'):
    case xsd('nonPositiveInteger'):
    case xsd('negativeInteger'):
    case xsd('nonNegativeInteger'):
    case xsd('xs:positiveInteger'):
    case xsd('long'):
    case xsd('int'):
    case xsd('short'):
    case xsd('byte'):
    case xsd('unsignedLong'):
    case xsd('unsignedInt'):
    case xsd('unsignedShort'):
    case xsd('unsignedByte'):
      return parseInt(value);
    case xsd('decimal'):
    case xsd('float'):
    case xsd('double'):
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
function mergeObj(base, addition, options) {
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

    let voc = options.voc;
    if (a[voc.id] && a[voc.id] == b[voc.id]) //same ids
      mergeObj(b, a, options);
    else base[k] = [b, a];
  });

  return base;
}

export default function(input, options = {}) {
  let opt = Object.assign({},
    DEFAULT_OPTIONS, {
      context: input['@context'],
    }, options);

  if (opt.debug) debug.level = 'debug';

  debug.verbose('options:', JSON.stringify(opt, null, 2));

  if (isNode && isValidPath(input)) {
    debug.verbose('loading input from %s', input);
    input = jsonfile.readFileSync(input);
  }

  if (typeof input != 'object')
    throw new Error(`Input format not valid`);

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
      mergeObj(old, inst, opt);
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

/**
 * Read the input and extract the query and the
 * prototype
 */
function jsonld2query(input) {
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

  var vars = [];
  var filters = asArray(modifiers.$filter);
  var wheres = asArray(modifiers.$where);

  let mpkFun = manageProtoKey(proto, vars, filters, wheres);
  Object.keys(proto).forEach(mpkFun);

  var limit = modifiers.$limit ? 'LIMIT ' + modifiers.$limit : '';
  var distinct = modifiers.$distinct === false ? '' : 'DISTINCT';
  var prefixes = modifiers.$prefixes ? parsePrefixes(modifiers.$prefixes) : [];
  var values = modifiers.$values ? parseValues(modifiers.$values) : [];
  var orderby = modifiers.$orderby ? 'ORDER BY ' + asArray(modifiers.$orderby).join(' ') : '';
  var groupby = modifiers.$groupby ? 'GROUP BY ' + asArray(modifiers.$groupby).join(' ') : '';
  var having = modifiers.$having ? `HAVING (${asArray(modifiers.$having).join(' && ')})` : '';

  var query = `${prefixes.join('\n')}
  SELECT ${distinct} ${vars.join(',')}
  WHERE {
    ${values.join('\n')}
    ${wheres.join('.\n')}
    ${filters.map(f=>`FILTER(${f})`).join('\n')}
  }
  ${groupby}
  ${having}
  ${orderby}
  ${limit}
  `;

  debug.debug(query);
  return {
    query,
    proto
  };
}

function computeRootId(proto, prefix) {
  let k = Object.keys(KEY_VOCABULARIES).find(k => !!proto[KEY_VOCABULARIES[k].id]);
  if (!k) return;

  k = KEY_VOCABULARIES[k].id;
  let str = proto[k];
  var [_rootId, ...modifiers] = str.split('$');

  let _var = modifiers.find(m => m.match('var:.+'));
  if (_var) {
    _rootId = sparqlVar(_var.split(':')[1]);
  }

  if (!_rootId) {
    _rootId = "?" + prefix + "r";
    proto[k] += '$var:' + _rootId;
  }

  proto[k] += '$prevRoot';
  return _rootId;
}

/**
 * Add the "?" if absent
 */
function sparqlVar(input) {
  'use strict';
  if (input.startsWith['?']) return input;
  return '?' + input;
}

/**
 * Parse a single key in prototype
 */
function manageProtoKey(proto, vars = [], filters = [], wheres = [], prefix = "v", prevRoot = null) {
  var _rootId = computeRootId(proto, prefix) || prevRoot || '?id';

  return function(k, i) {
    let v = proto[k];

    if (typeof v == 'object') {
      let mpkFun = manageProtoKey(v, vars, filters, wheres, prefix + i, _rootId);
      Object.keys(v).forEach(mpkFun);
      return;
    }

    let is$ = v.startsWith('$');
    if (!is$ && !v.startsWith('?')) return;
    if (is$) v = v.substring(1);

    let options = [];
    if (v.includes('$'))
      [v, ...options] = v.split('$');

    let required = options.includes('required');

    let id = is$ ? ('?' + prefix + i) : v;
    let _id = options.find(o => o.match('var:.*'));
    if (_id) {
      id = _id.split(':')[1];
      if (!id.startsWith('?')) id = '?' + id;
    }
    proto[k] = id;

    let _var = options.includes('sample') ?
      `SAMPLE(${id}) AS ${id}` : id;
    vars.push(_var);

    let _lang = options.find(o => o.match('lang:.*'));
    if (_lang) filters.push(`lang(${id}) = '${_lang.split(':')[1]}'`);

    if (is$) {
      let subject = options.includes('prevRoot') && prevRoot ? prevRoot : _rootId;
      let q = `${subject} ${v} ${id}`;
      wheres.push(required ? q : `OPTIONAL { ${q} }`);
    }
  };
}

function prepareGroupby(array = []) {
  array.forEach(s => delete s.desc);
  return prepareOrderby(array, 'GROUP BY');
}

function prepareOrderby(array = [], keyword = 'ORDER BY') {
  if (!array.length) return '';
  return keyword + ' ' +
    array.sort((a, b) => b.priority - a.priority)
    .map(s => s.desc ? `DESC(${s.variable})` : s.variable)
    .join(' ');
}

function parseOrder(str, variable) {
  let ord = {
    variable
  };
  let s = str.split(':');

  s.shift(); // first one is always 'order'

  if (s.includes('desc')) {
    ord.desc = true;
    s.splice(s.indexOf('desc'), 1);
  }

  let priority = s[0] && parseInt(s[0]);
  ord.priority = priority || 0;

  return ord;
}

function asArray(v) {
  if (!v) return [];
  if (!Array.isArray(v)) return [v];
  return v;
}
