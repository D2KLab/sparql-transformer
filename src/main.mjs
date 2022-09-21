import equal from 'fast-deep-equal';
import objectAssignDeep from 'object-assign-deep';
import Debugger from './debugger';
import SparqlClient from './sparql-client';

const debug = new Debugger();
const INDENT = '    ';
const DEFAULT_OPTIONS = {
  context: 'http://schema.org/',
  endpoint: 'http://dbpedia.org/sparql',
  langTag: 'show',
};

const KEY_VOCABULARIES = {
  JSONLD: {
    id: '@id',
    lang: '@language',
    value: '@value',
  },
  PROTO: {
    id: 'id',
    lang: 'language',
    value: 'value',
  },
};

const LANG_REGEX = /^lang(?::(.+))?/i;

const AGGREGATES = ['sample', 'count', 'sum', 'min', 'max', 'avg'];

function defaultSparql(endpoint) {
  const client = new SparqlClient(endpoint);
  return (q, params) => client.query(q, params);
}

const XSD = 'http://www.w3.org/2001/XMLSchema#';

function xsd(resource) {
  return XSD + resource;
}

/*
 * Return the value as an array
 */
function asArray(v) {
  if (!v) return [];
  if (!Array.isArray(v)) return [v];
  return v;
}

/**
 * Add the "?" if absent
 */
function sparqlVar(input) {
  if (input.startsWith('?')) return input;
  return `?${input}`;
}

/**
 * An object with just the @type is considered empty
 */
function isEmptyObject(target) {
  return !Object.getOwnPropertyNames(target)
    .filter(p => ['@type', '$anchor'].includes(p))
    .length;
}

function parsePrefixes(prefixes) {
  return Object.keys(prefixes)
    .map(p => `PREFIX ${p}: <${prefixes[p]}>`);
}

function parseValues(values) {
  return Object.keys(values)
    .map((p) => {
      const vals = asArray(values[p]).map((v) => {
        if (v.startsWith('http')) return `<${v}>`;
        if (v.includes(':')) return v;
        if (v.match(/^.+@[a-z]{2,3}(_[A-Z]{2})?$/)) { // if language tag
          const x = v.split('@', 2);
          return `"${x[0]}"@${x[1]}`;
        }
        return `"${v}"`;
      });
      return `VALUES ${p} {${vals.join(' ')}}`;
    });
}

/**
 * Prepare the output managing languages and datatypes
 */
function toJsonldValue(input, options) {
  // eslint-disable-next-line prefer-const
  let { value, datatype } = input;
  switch (datatype) {
    case xsd('boolean'):
      // eslint-disable-next-line eqeqeq
      value = value !== 'false' && value != 0;
      break;
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
      value = parseInt(value);
      break;
    case xsd('decimal'):
    case xsd('float'):
    case xsd('double'):
      value = value.replace('INF', 'Infinity');
      value = parseFloat(value);
      break;
    default:
      // nothing to do
      break;
  }

  // I can't accept 0 if I want a string
  // eslint-disable-next-line valid-typeof
  if (options.accept && typeof value !== options.accept) return null;

  // nothing more to do for other types
  if (typeof value !== 'string') {
    return options.asList ? [value] : value;
  }

  // if here, it is a string or a date, that are not parsed
  const lang = input['xml:lang'];

  const { voc, langTag } = options;

  if (lang && langTag !== 'hide') {
    const obj = {};
    obj[voc.lang] = lang;
    obj[voc.value] = value;
    return obj;
  }
  return options.asList ? [value] : value;
}

/**
 * Apply the result of SPARQL to a single
 * property of the proto instance
 */
function fitIn(instance, line, options) {
  return function fittingFunction(k) {
    /* eslint-disable no-param-reassign */
    let variable = instance[k];

    // if value is an obj
    if (typeof variable === 'object') {
      const objAsList = variable.$list;

      const fiiFun = fitIn(variable, line, options);
      Object.keys(variable).forEach(fiiFun);

      if (isEmptyObject(variable)) delete instance[k];
      else if (objAsList) instance[k] = [instance[k]];
      return null;
    }

    if (typeof variable !== 'string') return null;
    if (!variable.startsWith('?')) return null;
    variable = variable.substring(1);
    let accept = null;
    let { langTag } = options;
    const asList = variable.includes('$list');
    variable = variable.replace('$list', '');
    if (variable.includes('$accept:')) [variable, accept] = variable.split('$accept:');
    if (variable.includes('$langTag:')) [variable, langTag] = variable.split('$langTag:');

    // variable not in result, delete from
    if (!line[variable]) delete instance[k];
    else {
      instance[k] = toJsonldValue(line[variable],
        Object.assign({}, options, { accept, langTag, asList }));
    }

    if (instance[k] === null) delete instance[k];

    return instance;
  };
}

/**
 * Apply the prototype to a single line of query results
 */
function sparql2proto(line, proto, options) {
  const instance = objectAssignDeep({}, proto); // clone proto

  const fiiFun = fitIn(instance, line, options);
  Object.keys(instance).forEach(fiiFun);
  return instance;
}

/**
 * Merge base and addition, by defining/adding in an
 * array the values in addition to the base object.
 * @return the base object merged.
 */
function mergeObj(base, addition) {
  Object.keys(addition).forEach((k) => {
    if (k === '$anchor') return;

    const b = base[k];
    let a = addition[k];
    const anchor = a.$anchor;

    if (!b) {
      base[k] = a;
      return;
    }

    // if a is array, I take its value
    if (Array.isArray(a)) [a] = a;

    if (Array.isArray(b)) {
      if (a[anchor]) {
        /* eslint-disable eqeqeq */
        const a0 = b.find(x => a[anchor] == x[anchor]); // same ids
        if (a0) {
          mergeObj(a0, a);
          return;
        }
      }
      if (!b.find(x => equal(a, x))) b.push(a);
      return;
    }
    if (equal(a, b)) return;

    // eslint-disable-next-line eqeqeq
    if (a[anchor] && a[anchor] == b[anchor]) { // same ids
      mergeObj(b, a);
    } else base[k] = [b, a];
  });

  return base;
}

function computeRootId(proto, prefix) {
  // check if an anchor is set
  let k = Object.keys(proto).find(key => typeof proto[key] === 'string' && proto[key].includes('$anchor'));

  // otherwise, check if one of the default anchors is there
  if (!k) {
    k = Object.keys(KEY_VOCABULARIES).find(key => !!proto[KEY_VOCABULARIES[key].id]);
    if (!k) return [null, false];

    k = KEY_VOCABULARIES[k].id;
  }

  const str = proto[k];
  // eslint-disable-next-line prefer-const
  let [_rootId, ...modifiers] = str.split('$');

  let required = modifiers.includes('required');
  if (_rootId) required = true;
  const aVar = modifiers.find(m => m.match('var:.+'));
  if (aVar) _rootId = sparqlVar(aVar.split(':')[1]);

  if (!_rootId) {
    _rootId = `?${prefix}r`;
    proto[k] += `$var:${_rootId}`;
  }

  proto.$anchor = k;
  proto.$list = proto[k].includes('$list');
  return [_rootId, required];
}

/**
 * Parse a single key in prototype
 */
function manageProtoKey(proto, vars = [], filters = [], wheres = [],
  mainLang = null, prefix = 'v', prevRoot = null, values = {}) {
  let [_rootId, _blockRequired] = computeRootId(proto, prefix);
  if (_rootId && Object.keys(values).includes(_rootId)) {
    _blockRequired = true;
  }
  _rootId = _rootId || prevRoot || '?id';
  return [function parsingFunc(k, i) {
    if (k === '$anchor' || k === '$list') return;
    let v = proto[k];

    if (typeof v === 'object') {
      let wheresInternal = [];
      const [mpkFun, bkReq] = manageProtoKey(v, vars, filters, wheresInternal,
        mainLang, prefix + i, _rootId, values);
      Object.keys(v).forEach(mpkFun);

      if (wheresInternal.length > 0) {
        wheresInternal = wheresInternal.filter(x => x).join('.\n');
        wheres.push(bkReq ? wheresInternal : `OPTIONAL { ${wheresInternal}}`);
      }

      return;
    }
    if (typeof v !== 'string') return;

    const is$ = v.startsWith('$');
    if (!is$ && !v.startsWith('?')) return;
    if (is$) v = v.substring(1);

    let options = [];
    if (v.includes('$')) [v, ...options] = v.split('$');

    const originalId = is$ ? (`?${prefix}${i}`) : v;
    let id = originalId;
    const givenVar = options.find(o => o.match('var:.*'));
    if (givenVar) {
      [, id] = givenVar.split(':');
      if (!id.startsWith('?')) id = `?${id}`;
    }
    const bestlang = options.find(o => o.match('bestlang[^$]*'));
    const accept = options.find(o => o.match('accept[^$]*'));
    const langTag = options.find(o => o.match('langTag[^$]*'));
    const aggregate = AGGREGATES.filter(aggr => options.includes(aggr))[0];

    const aggrWhat = is$ ? id : originalId;
    if (aggregate && !givenVar) {
      id = is$ ? originalId : `?${aggregate}_${originalId.replace('?', '')}`;
    }

    // assign a clean id to the prototype
    proto[k] = id;

    if (langTag) proto[k] += `$${langTag}`;
    if (bestlang) proto[k] += '$accept:string';
    else if (accept) proto[k] += `$${accept}`;
    if (options.includes('list') && id != _rootId) proto[k] += '$list';

    let aVar = id;
    if (aggregate) {
      const isDistinct = options.includes('distinct');
      aVar = `(${aggregate.toUpperCase()}(${isDistinct ? 'DISTINCT ' : ''}${aggrWhat}) AS ${id})`;
    }
    if (bestlang) {
      const lng = bestlang.includes(':') ? bestlang.split(':')[1] : mainLang;
      if (!lng) throw new Error('bestlang require a language declared inline or in the root');

      aVar = `(sql:BEST_LANGMATCH(${id}, "${lng}", "en") AS ${id})`;
    }
    if (!vars.includes(aVar)) {
      vars.push(aVar);
    }

    const langStr = options.find(o => o.match(LANG_REGEX));
    let langfilter = '';
    if (langStr) {
      const lang = langStr.match(LANG_REGEX)[1] || (mainLang && mainLang.split(/[;,]/)[0].trim());
      if (lang) {
        if (values[id] && typeof (values[id]) === 'string') {
          values[id] += `@${lang}`;
        } else {
          langfilter = `.\n${INDENT}FILTER(lang(${id}) = '${lang}')`;
        }
      }
    }

    const required = options.includes('required') || ['id', '@id'].includes(k) || values[id] || (aggregate && is$);

    const reverse = options.includes('reverse');
    if (is$) {
      const usePrevRoot = (id == _rootId) || (options.includes('prevRoot') && prevRoot);
      const subject = usePrevRoot ? prevRoot : _rootId;

      const subj = reverse ? id : subject;
      const obj = reverse ? subject : id;
      const q = `${subj} ${v} ${obj} ${langfilter}`;
      wheres.push(required ? q : `${INDENT}OPTIONAL { ${q} }`);
    }
  }, _blockRequired];
}

/**
* Remove development properties
*/
function cleanRecursively(instance) {
  if (typeof instance !== 'object') return; // if not object neither array
  if (Array.isArray(instance)) {
    instance.forEach(cleanRecursively);
    return;
  }

  delete instance.$anchor;
  delete instance.$list;
  Object.keys(instance).forEach(k => cleanRecursively(instance[k]));
}

/**
 * Transform all key of a object to a sparqlVariable
 * adding the '?' if required
 */
function normalizeValues(values) {
  if (!values) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    out[sparqlVar(key)] = value;
  }
  return out;
}

/**
 * Read the input and extract the query and the
 * prototype
 */
function jsonld2query(input) {
  let proto = input['@graph'] || input.proto;
  if (Array.isArray(proto)) [proto] = proto;

  // get all props starting with '$'
  const modifiers = {};
  Object.keys(input)
    .filter(k => k.startsWith('$'))
    .forEach((k) => {
      modifiers[k] = input[k];
      delete input[k];
    });

  const vars = [];
  const filters = asArray(modifiers.$filter);
  let wheres = asArray(modifiers.$where);
  const mainLang = modifiers.$lang;

  const valuesNormalized = normalizeValues(modifiers.$values);
  const [mpkFun] = manageProtoKey(proto, vars, filters, wheres, mainLang,
    undefined, undefined, valuesNormalized);
  Object.keys(proto).forEach(mpkFun);

  wheres = wheres.map(w => w.trim())
    .filter(w => w)
    .map(w => INDENT + w);

  const from = modifiers.$from ? `FROM <${modifiers.$from}>` : '';
  const limit = (modifiers.$limit && modifiers.$limitMode != 'library') ? `LIMIT ${modifiers.$limit}` : '';
  const offset = (modifiers.$offset && modifiers.$limitMode != 'library') ? `OFFSET ${modifiers.$offset}` : '';
  const distinct = modifiers.$distinct === false ? '' : 'DISTINCT';
  const prefixes = modifiers.$prefixes ? parsePrefixes(modifiers.$prefixes) : [];
  const values = modifiers.$values ? parseValues(valuesNormalized) : [];
  const orderby = modifiers.$orderby ? `ORDER BY ${asArray(modifiers.$orderby).join(' ')}` : '';
  const groupby = modifiers.$groupby ? `GROUP BY ${asArray(modifiers.$groupby).join(' ')}` : '';
  const having = modifiers.$having ? `HAVING (${asArray(modifiers.$having).join(' && ')})` : '';

  let query = `${prefixes.join('\n')}
  SELECT ${distinct} ${vars.join(' ')}
  ${from}
  WHERE {
${values.map(v => INDENT + v).join('\n')}
${wheres.join('.\n')}
${filters.map(f => `${INDENT}FILTER(${f})`).join('\n')}
  }
  ${groupby}
  ${having}
  ${orderby}
  ${limit}
  ${offset}
  `;

  query = query.replace(/\n+/g, '\n')
    .replace(/\n\s+\n/g, '\n')
    .replace(/\.+/g, '.');

  debug.debug(query);
  return {
    query,
    proto,
  };
}

export default function(baseInput, options = {}) {
  const input = objectAssignDeep({}, baseInput);
  const opt = Object.assign({},
    DEFAULT_OPTIONS, {
    context: input['@context'],
  }, options);

  if (opt.env && opt.env.DEBUG_LEVEL) debug.level = opt.env.DEBUG_LEVEL;
  // Override debug level if `debug` option is set
  if (opt.debug === true) debug.level = 'debug';
  if (opt.debug === false) debug.level = 'log';

  debug.verbose('options:', JSON.stringify(opt, null, 2));

  if (typeof input !== 'object') throw new Error('Input format not valid');

  // I save the info about hideLang before it is destroyed
  opt.langTag = input.$langTag || opt.langTag;

  const {
    proto,
    query,
  } = jsonld2query(input);

  const isJsonLD = input['@graph'];
  const voc = KEY_VOCABULARIES[isJsonLD ? 'JSONLD' : 'PROTO'];
  opt.voc = voc;

  const sparqlFun = opt.sparqlFunction || defaultSparql(opt.endpoint);

  return sparqlFun(query, opt.params).then((sparqlRes) => {
    const { bindings } = sparqlRes.results;
    let content = [];

    if (bindings.length) {
      // apply the proto
      const instances = bindings.map(b => sparql2proto(b, proto, opt));
      // merge lines with the same id

      const anchor = instances[0] && instances[0].$anchor;
      instances.forEach((inst) => {
        const id = inst[anchor];
        // search if we have already the same id
        const match = content.find(x => x[anchor] === id);
        if (!match) {
          // it is a new one
          content.push(inst);
          return;
        }
        // otherwise modify previous one
        mergeObj(match, inst);
      });

      // remove anchor tag
      content.forEach(cleanRecursively);
    }

    if (baseInput.$limit && baseInput.$limitMode == 'library') {
      const offset = baseInput.$offset || 0;
      content = content.slice(offset, offset + baseInput.$limit);
    }

    if (isJsonLD) {
      return {
        '@context': opt.context,
        '@graph': content,
      };
    }
    return content;
  });
}
