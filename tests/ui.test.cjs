'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createApp } = require('../server.cjs');
const { makeSeed } = require('../scripts/seed.cjs');

// Testa o JavaScript e os componentes Bootstrap reais em DOM simulado.
// Não substitui uma verificação visual em navegador.
describe('Velora — formulários reais, Fetch API e persistência', { concurrency: false }, () => {
  let directory, dbFile, server, dom, window, document, errors;

  const q = selector => document.querySelector(selector);
  const click = selector => {
    const element = q(selector);
    assert.ok(element, `Elemento ausente: ${selector}`);
    element.click();
  };
  const submit = selector => {
    const form = q(selector);
    assert.ok(form, `Formulário ausente: ${selector}`);
    assert.equal(form.reportValidity(), true, `Formulário inválido: ${selector}`);
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  };
  async function until(condition, label) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    assert.fail(`Tempo esgotado: ${label}. Erros: ${errors.join('; ')}. Aviso: ${q('.form-error:not(.d-none)')?.textContent || q('#toasts')?.textContent || ''}`);
  }
  const disk = async () => JSON.parse(await fs.readFile(dbFile, 'utf8'));
  async function login(role) {
    click(`[data-action="demo"][data-role="${role}"]`);
    submit('#login-form');
    await until(() => q('.app-shell'), `login ${role}`);
    // Aguarda a conclusão dos efeitos da autenticação antes da próxima ação.
    await new Promise(resolve => setTimeout(resolve, 70));
  }
  async function navigate(hash, selector) {
    window.location.hash = hash;
    await until(() => q(selector), `navegar para ${hash}`);
  }

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'velora-ui-'));
    dbFile = path.join(directory, 'db.json');
    await fs.writeFile(dbFile, JSON.stringify(makeSeed()));
    server = createApp({ dbFile }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    errors = [];
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error.message));
    const html = await fs.readFile(path.join(__dirname, '../public/index.html'), 'utf8');
    dom = new JSDOM(html, { url: base, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console });
    window = dom.window;
    document = window.document;
    window.fetch = (url, options) => fetch(new URL(url, base), options);
    window.scrollTo = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.eval(await fs.readFile(path.join(__dirname, '../public/vendor/bootstrap.bundle.min.js'), 'utf8'));
    window.eval(await fs.readFile(path.join(__dirname, '../public/js/app.js'), 'utf8'));
    await until(() => q('#login-form'), 'tela de acesso');
  });
  afterEach(async () => {
    dom?.window.close();
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it('entra pelo acesso demonstrativo, cria pedido e mostra os dados confirmados pela API', async () => {
    await login('cliente');
    assert.match(q('.page-title').textContent, /Olá, Ana/);
    assert.equal(document.querySelectorAll('.stat-card').length, 4);
    click('[data-action="new-request"]');
    const form = q('#request-form');
    form.elements.notes.value = 'Pedido enviado pela interface em teste.';
    assert.match(q('#rental-estimate').textContent, /3 diárias/);
    submit('#request-form');
    await until(() => q('#toasts').textContent.includes('Pedido enviado para análise'), 'confirmação visual');
    const created = (await disk()).requests.find(r => r.notes === 'Pedido enviado pela interface em teste.');
    assert.equal(created.status, 'pending');
    assert.equal(created.total, 267);
    await navigate('requests', '#status-filter');
    assert.ok(q(`[data-action="request-detail"][data-id="${created.id}"]`));
    click(`[data-action="request-detail"][data-id="${created.id}"]`);
    assert.match(q('#modal-body').textContent, /Pedido enviado pela interface em teste/);
    assert.match(q('#modal-body').textContent, /Em análise/);
    assert.deepEqual(errors, []);
  });

  it('banco formaliza pedido aprovado com crédito e consulta o contrato gerado', async () => {
    await login('banco');
    await navigate('requests', '#status-filter');
    click('[data-action="request-detail"][data-id="PED-1002"]');
    click('[data-action="new-contract"][data-id="PED-1002"]');
    assert.equal(q('#with-credit').checked, true);
    assert.equal(q('#with-credit').disabled, true);
    const form = q('#contract-form');
    form.elements.ownerType.value = 'client';
    form.elements.ownerType.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(form.elements.ownerId.value, 'client-ana');
    form.elements.installments.value = '12';
    form.elements.interestRate.value = '1.25';
    form.elements.installments.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.match(q('#credit-estimate').textContent, /12 parcelas/);
    submit('#contract-form');
    await until(() => q('#toasts').textContent.includes('Contrato emitido'), 'contrato confirmado');
    const saved = await disk();
    const contract = saved.contracts.find(c => c.requestId === 'PED-1002');
    assert.equal(contract.ownerType, 'client');
    assert.equal(contract.credit.installments, 12);
    assert.equal(contract.credit.interestRate, 1.25);
    assert.equal(contract.credit.bankId, 'bank-horizonte');
    assert.equal(saved.requests.find(r => r.id === 'PED-1002').status, 'contracted');
    await navigate('contracts', '[data-action="contract-detail"]');
    click(`[data-action="contract-detail"][data-id="${contract.id}"]`);
    assert.match(q('.contract-paper').textContent, /Contrato de crédito associado/);
    assert.match(q('.contract-paper').textContent, /Banco Horizonte/);
    assert.ok(q('[data-action="download-contract"]'));
    assert.deepEqual(errors, []);
  });

  it('cadastra, atualiza e exclui um cliente sem vínculos pelos formulários da conta', async () => {
    click('[data-action="auth-toggle"]');
    const form = q('#register-form');
    const values = { name: 'Maria Interface', email: 'maria.ui@example.com', password: 'Teste@123', cpf: '39053344705', rg: 'MG-900123', profession: 'Analista', address: 'Rua do Teste, 55, Centro' };
    for (const [key, value] of Object.entries(values)) form.elements[key].value = value;
    click('[data-action="add-employer"]');
    q('.employer-name').value = 'Empresa UI'; q('.employer-income').value = '6500';
    submit('#register-form');
    await until(() => q('.app-shell'), 'cadastro e login automático');
    await new Promise(resolve => setTimeout(resolve, 70));
    const created = (await disk()).users.find(u => u.email === values.email);
    assert.ok(created);
    assert.equal(created.employers[0].income, 6500);
    await navigate('account', '[data-action="edit-client"]');
    click('[data-action="edit-client"]');
    q('#client-form').elements.profession.value = 'Arquiteta';
    submit('#client-form');
    await until(() => q('#toasts').textContent.includes('Cadastro atualizado'), 'atualização confirmada');
    assert.equal((await disk()).users.find(u => u.id === created.id).profession, 'Arquiteta');
    click('[data-action="delete-client"]');
    submit('#confirm-form');
    await until(() => q('#login-form'), 'retorno ao login após exclusão');
    assert.equal((await disk()).users.some(u => u.id === created.id), false);
    assert.equal(window.sessionStorage.getItem('velora.token'), null);
    assert.deepEqual(errors, []);
  });
});
