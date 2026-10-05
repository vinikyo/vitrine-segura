const fs = require('node:fs');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;
const root = require('node:path').resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(`${root}/${file}`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Execute the actual source, exposing private functions only in this in-memory test module.
function load(file, dependencies = {}, suffix = '') {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile(file) + suffix)(
    name => dependencies[name] || require(name), module, module.exports,
  );
  return module.exports;
}
function harness() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(fs.readFileSync(`${root}/drizzle/0000_nostalgic_ironclad.sql`, 'utf8').replaceAll('--> statement-breakpoint', ''));
  const state = { user: { userId: 'alice', displayName: 'Alice Teste', email: 'alice@example.invalid' }, failDB: false, beforeBatch: null };
  const env = { DATA_KEY: 'ab'.repeat(32) };
  function prepare(sql) {
    let values = [];
    function statement() { if (state.failDB) throw Error('SQL connection password SECRET'); return sqlite.prepare(sql); }
    return {
      bind(...args) { values = args; return this; },
      async first() { return statement().get(...values) || null; },
      async all() { return { results: statement().all(...values) }; },
      async run() { const result = statement().run(...values); return { meta: { changes: Number(result.changes) } }; },
    };
  }
  env.DB = {
    prepare,
    async batch(statements) {
      if (state.beforeBatch) { const fn = state.beforeBatch; state.beforeBatch = null; fn(sqlite); }
      sqlite.exec('BEGIN');
      try { const results = []; for (const stmt of statements) results.push(await stmt.run()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const catalog = load('lib/catalog.ts');
  const api = load('app/api/store/route.ts', {
    'cloudflare:workers': { env },
    '../../chatgpt-auth': { getChatGPTUser: async () => state.user },
    '../../../lib/catalog': catalog,
  }, '\nmodule.exports.units = { crypt, profileSchema, productSchema };');
  const profile = { name: 'Pessoa Fictícia', cpf: '12345678900', phone: '11999999999', address: 'Rua de Teste, 10, Cidade Fictícia', cep: '12345678', card: '4242' };
  const product = { name: 'Produto Teste', description: 'Descrição de um produto fictício', category: 'Setup', price: 10000, stock: 3 };
  function user(id) { state.user = id ? { userId: id, displayName: `${id} Teste`, email: `${id}@example.invalid` } : null; }
  async function post(body, options = {}) {
    const headers = { Origin: 'https://vitrine.test', 'Content-Type': 'application/json', 'X-Vitrine-Request': '1', ...options.headers };
    for (const [key, value] of Object.entries(headers)) if (value === null) delete headers[key];
    return api.POST(new Request('https://vitrine.test/api/store', { method: 'POST', headers, body: options.raw ?? JSON.stringify(body) }));
  }
  async function createProduct(data = product) {
    const response = await post({ action: 'product', data });
    if (response.status !== 200) throw Error(`Fixture product: ${response.status}`);
    return sqlite.prepare('SELECT id FROM products ORDER BY rowid DESC LIMIT 1').get().id;
  }
  async function checkout(id, qty = 1, nonce = crypto.randomUUID()) {
    return post({ action: 'checkout', items: [{ id, qty }], nonce });
  }
  return { sqlite, state, env, api, units: api.units, catalog: catalog.catalog, profile, product, user, post, createProduct, checkout,
    saveProfile: () => post({ action: 'profile', data: profile }),
    json: async () => (await api.GET()).json(), close: () => sqlite.close(),
  };
}
module.exports = { harness, load };
