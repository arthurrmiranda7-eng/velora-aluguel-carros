'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createApp } = require('../server.cjs');
const { makeSeed } = require('../scripts/seed.cjs');

// Cada teste usa seu próprio db.json e porta aleatória. O banco do projeto é preservado.
describe('Velora — API REST, permissões e regras de negócio', { concurrency: false }, () => {
  let directory, dbFile, server, base, accounts;

  async function start() {
    server = createApp({ dbFile }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }

  async function stop() {
    if (!server) return;
    const current = server;
    server = null;
    await new Promise((resolve, reject) => current.close(error => error ? reject(error) : resolve()));
  }

  async function api(endpoint, { method = 'GET', token, body } = {}) {
    const response = await fetch(base + endpoint, {
      method,
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, data, headers: response.headers };
  }

  async function login(email, password = 'Demo@123') {
    const response = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.ok(response.data.token);
    return response.data;
  }

  function expectStatus(result, allowed) {
    assert.ok([].concat(allowed).includes(result.status), `Esperado HTTP ${allowed}; recebido ${result.status}: ${JSON.stringify(result.data)}`);
    return result.data;
  }

  function future(offset = 100) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function client(overrides = {}) {
    return { name: 'Marina Teste', email: 'marina.teste@example.com', password: 'Teste@1234', cpf: '12345678909', rg: 'MG-9876543', address: 'Rua de Testes, 100, Centro, Belo Horizonte - MG', profession: 'Analista', employers: [{ name: 'Empresa de Testes', income: 6500 }], ...overrides };
  }

  async function register(overrides = {}) {
    const response = await api('/api/auth/register', { method: 'POST', body: client(overrides) });
    return expectStatus(response, 201);
  }

  async function request(overrides = {}, account = accounts.client) {
    const response = await api('/api/requests', { method: 'POST', token: account.token, body: { carId: 'car-kwid', startDate: future(100), endDate: future(104), creditRequested: false, notes: 'Pedido criado pelo teste de integração.', ...overrides } });
    return expectStatus(response, 201);
  }

  async function review(id, decision = 'approved', account = accounts.company) {
    return api(`/api/requests/${id}/review`, { method: 'POST', token: account.token, body: { decision, notes: 'Renda e documentação verificadas para este pedido.' } });
  }

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'velora-test-'));
    dbFile = path.join(directory, 'db.json');
    await fs.writeFile(dbFile, JSON.stringify(makeSeed()));
    await start();
    accounts = {
      client: await login('cliente@velora.com'),
      company: await login('empresa@velora.com'),
      bank: await login('banco@velora.com')
    };
  });

  afterEach(async () => {
    await stop();
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it('serve a interface e Bootstrap local e exige autenticação na API', async () => {
    const home = await api('/');
    assert.equal(home.status, 200);
    assert.match(home.data, /<html[^>]+lang=["']pt-BR/i);
    assert.match(home.data, /bootstrap/i);
    const stylesheet = await api('/vendor/bootstrap.min.css');
    assert.equal(stylesheet.status, 200);
    assert.match(stylesheet.data, /Bootstrap\s+v5\./);
    for (const endpoint of ['/api/clients', '/api/cars', '/api/requests', '/api/contracts']) {
      expectStatus(await api(endpoint), 401);
    }
    for (const endpoint of ['/db.json', '/seed-db.json', '/users']) {
      expectStatus(await api(endpoint), 404);
    }
  });

  it('autentica, mantém os papéis e encerra a sessão sem expor hashes', async () => {
    expectStatus(await api('/api/auth/login', { method: 'POST', body: { email: 'cliente@velora.com', password: 'senha-errada' } }), 401);
    for (const [role, account] of Object.entries(accounts)) {
      assert.equal(account.user.role, role);
      assert.equal(account.user.password, undefined);
      assert.equal(account.user.passwordHash, undefined);
      const me = expectStatus(await api('/api/auth/me', { token: account.token }), 200);
      assert.equal(me.id, account.user.id);
      assert.equal(me.passwordHash, undefined);
    }
    expectStatus(await api('/api/auth/logout', { method: 'POST', token: accounts.client.token }), [200, 204]);
    expectStatus(await api('/api/auth/me', { token: accounts.client.token }), 401);
  });

  it('cadastra um cliente, valida CPF/e-mail únicos e limita três rendimentos', async () => {
    const registered = await register({ id: 'bank-horizonte', role: 'bank', passwordHash: 'injetado' });
    assert.equal(registered.user.role, 'client');
    assert.notEqual(registered.user.id, 'bank-horizonte');
    assert.equal(registered.user.passwordHash, undefined);
    assert.equal((await login('marina.teste@example.com', 'Teste@1234')).user.id, registered.user.id);
    expectStatus(await api('/api/auth/register', { method: 'POST', body: client() }), [400, 409, 422]);
    expectStatus(await api('/api/auth/register', { method: 'POST', body: client({ email: 'outra@example.com' }) }), [400, 409, 422]);
    expectStatus(await api('/api/auth/register', { method: 'POST', body: client({ email: 'invalidcpf@example.com', cpf: '11111111111' }) }), [400, 422]);
    expectStatus(await api('/api/auth/register', { method: 'POST', body: client({ email: 'income@example.com', cpf: '39053344705', employers: Array.from({ length: 4 }, (_, index) => ({ name: `Empregador ${index}`, income: 1000 })) }) }), [400, 422]);
    expectStatus(await api('/api/auth/register', { method: 'POST', body: client({ email: 'negative@example.com', cpf: '39053344705', employers: [{ name: 'Renda inválida', income: -10 }] }) }), [400, 422]);
  });

  it('impede elevação de privilégio e isola os cadastros de clientes', async () => {
    const registered = await register();
    const own = expectStatus(await api('/api/clients', { token: registered.token }), 200);
    assert.deepEqual(own.map(user => user.id), [registered.user.id]);
    expectStatus(await api(`/api/clients/${accounts.client.user.id}`, { method: 'PATCH', token: registered.token, body: { name: 'Alteração indevida' } }), [403, 404]);
    const elevated = await api(`/api/clients/${registered.user.id}`, { method: 'PATCH', token: registered.token, body: { role: 'bank', name: 'Marina Atualizada' } });
    expectStatus(elevated, [200, 400, 403, 422]);
    const me = expectStatus(await api('/api/auth/me', { token: registered.token }), 200);
    assert.equal(me.role, 'client');
    const all = expectStatus(await api('/api/clients', { token: accounts.company.token }), 200);
    assert.ok(all.length >= 3);
    assert.ok(all.every(user => user.role === 'client' && !user.passwordHash));
    const edited = expectStatus(await api(`/api/clients/${registered.user.id}`, { method: 'PATCH', token: accounts.company.token, body: { profession: 'Arquiteta' } }), 200);
    assert.equal(edited.profession, 'Arquiteta');
    expectStatus(await api(`/api/clients/${registered.user.id}`, { method: 'DELETE', token: registered.token }), [200, 204]);
    expectStatus(await api('/api/auth/me', { token: registered.token }), 401);
  });

  it('permite ao agente criar e remover cliente sem vínculos e bloqueia criação por cliente', async () => {
    expectStatus(await api('/api/clients', { method: 'POST', token: accounts.client.token, body: client() }), 403);
    const created = expectStatus(await api('/api/clients', { method: 'POST', token: accounts.company.token, body: client() }), 201);
    assert.equal(created.email, 'marina.teste@example.com');
    assert.equal(created.role, 'client');
    assert.equal(created.passwordHash, undefined);
    assert.equal((await login('marina.teste@example.com', 'Teste@1234')).user.id, created.id);
    expectStatus(await api(`/api/clients/${created.id}`, { method: 'DELETE', token: accounts.bank.token }), 204);
    expectStatus(await api(`/api/clients/${created.id}`, { token: accounts.company.token }), 404);
  });

  it('valida datas, calcula diárias no servidor e permite editar e cancelar pedido', async () => {
    for (const dates of [ { startDate: future(104), endDate: future(100) }, { startDate: future(100), endDate: future(100) }, { startDate: '2026-02-30', endDate: future(100) } ]) {
      expectStatus(await api('/api/requests', { method: 'POST', token: accounts.client.token, body: { carId: 'car-kwid', ...dates } }), [400, 422]);
    }
    const created = await request({ total: 1, status: 'approved', clientId: 'client-pedro' });
    assert.equal(created.clientId, accounts.client.user.id);
    assert.equal(created.status, 'pending');
    assert.equal(created.days, 4);
    assert.equal(created.total, 356);
    const changed = expectStatus(await api(`/api/requests/${created.id}`, { method: 'PATCH', token: accounts.client.token, body: { endDate: future(105), notes: 'Prazo ampliado.' } }), 200);
    assert.equal(changed.days, 5);
    assert.equal(changed.total, 445);
    assert.ok(changed.history.length >= 2);
    const cancelled = expectStatus(await api(`/api/requests/${created.id}/cancel`, { method: 'POST', token: accounts.client.token }), 200);
    assert.equal(cancelled.status, 'cancelled');
    expectStatus(await api(`/api/requests/${created.id}`, { method: 'PATCH', token: accounts.client.token, body: { notes: 'Não pode editar cancelado.' } }), [400, 409, 422]);
  });

  it('isola pedidos e contratos entre clientes e protege a análise financeira', async () => {
    const other = await register();
    assert.deepEqual(expectStatus(await api('/api/requests', { token: other.token }), 200), []);
    assert.deepEqual(expectStatus(await api('/api/contracts', { token: other.token }), 200), []);
    const created = await request();
    expectStatus(await api(`/api/requests/${created.id}/cancel`, { method: 'POST', token: other.token }), [403, 404]);
    expectStatus(await review(created.id, 'approved', accounts.client), 403);
    expectStatus(await api(`/api/requests/${created.id}/review`, { method: 'POST', token: accounts.company.token, body: { decision: 'approved', notes: '' } }), [400, 422]);
    const rejected = expectStatus(await review(created.id, 'rejected'), 200);
    assert.equal(rejected.status, 'rejected');
    const resubmitted = expectStatus(await api(`/api/requests/${created.id}`, { method: 'PATCH', token: accounts.client.token, body: { notes: 'Documentação atualizada.' } }), 200);
    assert.equal(resubmitted.status, 'pending');
    assert.equal(expectStatus(await review(created.id), 200).status, 'approved');
  });

  it('exige aprovação, invalida parecer após edição e emite contrato uma única vez', async () => {
    const created = await request();
    const contractBody = { ownerType: 'company', ownerId: accounts.company.user.id };
    expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.company.token, body: contractBody }), [400, 409, 422]);
    expectStatus(await review(created.id), 200);
    const changed = expectStatus(await api(`/api/requests/${created.id}`, { method: 'PATCH', token: accounts.company.token, body: { notes: 'Agente alterou as condições.' } }), 200);
    assert.equal(changed.status, 'pending');
    expectStatus(await review(created.id), 200);
    expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.client.token, body: contractBody }), 403);
    const contract = expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.company.token, body: contractBody }), 201);
    assert.equal(contract.ownerType, 'company');
    assert.equal(contract.ownerId, accounts.company.user.id);
    assert.equal(contract.requestId, created.id);
    assert.equal(contract.total, 356);
    expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.company.token, body: contractBody }), [400, 409, 422]);
    const visible = expectStatus(await api('/api/contracts', { token: accounts.client.token }), 200);
    assert.ok(visible.some(item => item.id === contract.id));
    expectStatus(await api(`/api/clients/${accounts.client.user.id}`, { method: 'DELETE', token: accounts.company.token }), [400, 409, 422]);
  });

  it('concede crédito somente por banco e registra a titularidade do cliente', async () => {
    const created = await request({ creditRequested: true });
    expectStatus(await review(created.id, 'approved', accounts.bank), 200);
    const body = { ownerType: 'client', ownerId: accounts.client.user.id, credit: { bankId: accounts.bank.user.id, installments: 6, interestRate: 1.5 } };
    expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.company.token, body }), [400, 403, 422]);
    const contract = expectStatus(await api(`/api/requests/${created.id}/contract`, { method: 'POST', token: accounts.bank.token, body }), 201);
    assert.equal(contract.ownerType, 'client');
    assert.equal(contract.ownerId, accounts.client.user.id);
    assert.equal(contract.credit.bankId, accounts.bank.user.id);
    assert.equal(contract.credit.installments, 6);
    assert.equal(contract.credit.interestRate, 1.5);
  });

  it('bloqueia reservas aprovadas sobrepostas e aceita datas consecutivas', async () => {
    const first = await request();
    const overlapping = await request({ startDate: future(102), endDate: future(106) });
    const adjacent = await request({ startDate: future(104), endDate: future(107) });
    expectStatus(await review(first.id), 200);
    expectStatus(await review(overlapping.id), 409);
    assert.equal(expectStatus(await review(adjacent.id), 200).status, 'approved');
    expectStatus(await api(`/api/requests/${first.id}/contract`, { method: 'POST', token: accounts.company.token, body: { ownerType: 'bank', ownerId: accounts.bank.user.id } }), 201);
    expectStatus(await review(overlapping.id), 409);
  });

  it('persiste alterações em db.json após reiniciar o servidor', async () => {
    const created = await request({ notes: 'Este registro deve sobreviver à reinicialização.' });
    const disk = JSON.parse(await fs.readFile(dbFile, 'utf8'));
    assert.ok(disk.requests.some(item => item.id === created.id));
    assert.ok(disk.users.every(user => user.passwordHash && !user.password));
    await stop();
    await start();
    const account = await login('cliente@velora.com');
    const saved = expectStatus(await api('/api/requests', { token: account.token }), 200);
    assert.equal(saved.find(item => item.id === created.id).notes, 'Este registro deve sobreviver à reinicialização.');
  });
});
