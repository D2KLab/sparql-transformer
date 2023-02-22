/* Minimal SPARQL client */
import axios from 'axios';

function validURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?' // protocol
        +
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' // domain name
        +
        '((\\d{1,3}\\.){3}\\d{1,3}))' // OR ip (v4) address
        +
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' // port and path
        +
        '(\\?[;&a-z\\d%_.~+=-]*)?' // query string
        +
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

export default class SparqlClient {
    constructor(endpoint) {
        if (!endpoint || !validURL(endpoint)) throw new Error(`Not valid endpoint: ${endpoint}`);

        this.endpoint = endpoint;
    }

    query(q, params = {}) {
        return axios.post(this.endpoint, new URLSearchParams({...params, query: q })).then((res) => {
            if (res.status % 100 == 2) return res.data; // all 2xx status (200, 206, ...)
            throw new Error(res.statusText);
        });
    }
}