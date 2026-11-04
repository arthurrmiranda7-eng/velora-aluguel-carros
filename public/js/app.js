const $ = (s, root = document) => root.querySelector(s);
const app = $('#app');
const state = { user: null, cars: [], clients: [], agents: [], requests: [], contracts: [], view: 'dashboard', query: '', filter: '', category: '', authMode: 'login' };
let token = sessionStorage.getItem('velora.token');
let modal;
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  car: '<path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3Z"/><path d="M5 7h14M3 12h18M6 18v3m12-3v3M6 15h2m8 0h2"/>',
  file: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8m-8 4h6"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M1 21v-3a8 8 0 0 1 16 0v3m0-18a4 4 0 0 1 0 8m3 4a7 7 0 0 1 3 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  logout: '<path d="M9 4H3v16h6m6-13 5 5-5 5m-7-5h12"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-1 .5-2 1-2 3M12 17h.01"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  shield: '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM8 12l3 3 5-6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  wallet: '<path d="M3 6V3h16v5H3v13h18V8H3m13 5h5v4h-5z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
const date = value => value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR') : '—';
const roleName = role => ({ client: 'Cliente', company: 'Empresa parceira', bank: 'Banco parceiro' }[role] || role);
const labels = { pending: 'Em análise', approved: 'Aprovado', rejected: 'Não aprovado', cancelled: 'Cancelado', contracted: 'Contratado', active: 'Ativo' };
const badge = status => `<span class="status-badge ${esc(status)}"><span></span>${esc(labels[status] || status)}</span>`;
const isAgent = () => state.user?.role !== 'client';
const carById = id => state.cars.find(c => String(c.id) === String(id));
const clientById = id => state.clients.find(c => String(c.id) === String(id));
const nameById = id => [state.user, ...state.clients, ...state.agents].find(u => String(u.id) === String(id))?.name || 'Cadastro vinculado';
const carImage = car => `assets/${/suv/i.test(car?.category || '') ? 'suv' : /hatch|econ/i.test(car?.category || '') ? 'hatch' : 'sedan'}-car.svg`;
const initials = name => String(name).split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const shortId = id => `#${String(id).slice(0, 8).toUpperCase()}`;
const dayISO = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.user) { token = null; sessionStorage.removeItem('velora.token'); state.user = null; renderAuth(); }
    throw new Error(data.error || data.message || 'Não foi possível concluir. Tente novamente.');
  }
  return data;
}
function toast(message, danger = false) {
  const el = document.createElement('div'); el.className = `toast align-items-center border-0 ${danger ? 'text-bg-danger' : 'text-bg-dark'}`; el.setAttribute('role', danger ? 'alert' : 'status');
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar aviso"></button></div>`;
  $('#toasts').append(el); const t = new bootstrap.Toast(el, { delay: 5000 }); el.addEventListener('hidden.bs.toast', () => el.remove()); t.show();
}
function showModal(title, content) {
  $('#modal-title').textContent = title; $('#modal-body').innerHTML = content;
  modal = bootstrap.Modal.getOrCreateInstance($('#app-modal')); modal.show();
}
const formError = '<div class="alert alert-danger d-none form-error" role="alert"></div>';
const field = (name, label, value = '', type = 'text', extra = '') => `<div class="${type === 'textarea' ? 'col-12' : 'col-md-6'}"><label class="form-label" for="f-${name}">${label}</label>${type === 'textarea' ? `<textarea class="form-control" id="f-${name}" name="${name}" rows="3" ${extra}>${esc(value)}</textarea>` : `<input class="form-control" id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`;
const formFooter = (text = 'Salvar alterações') => `<div class="d-flex justify-content-end gap-2 border-top pt-3 mt-4"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Voltar</button><button type="submit" class="btn btn-primary">${text} ${icon('arrow')}</button></div>`;

function renderAuth() {
  app.innerHTML = `<div class="auth-layout"><section class="auth-story"><a href="#" class="brand auth-brand" aria-label="Velora início"><span class="brand-mark">v</span>velora<span class="brand-dot">.</span></a><div class="auth-story-content"><span class="eyebrow">MOBILIDADE COM LIBERDADE</span><h1>Seu próximo<br>caminho começa<br>aqui<span style="color:#92dfc5">.</span></h1><p>Encontre o carro ideal. Acompanhe cada etapa.<br>Deixe a burocracia para trás.</p><img src="assets/sedan-car.svg" alt="Ilustração de um automóvel sedan" class="auth-car"><div class="d-flex gap-4 flex-wrap mt-4"><span>${icon('shield')} Gestão transparente</span><span>${icon('check')} Tudo em um só lugar</span></div></div><small>Velora · Sistema de aluguel de automóveis</small></section><main class="auth-panel" id="main-content"><div class="auth-card"><div class="mb-4"><span class="eyebrow">BEM-VINDO À VELORA</span><h2>${state.authMode === 'login' ? 'Bom ter você por aqui.' : 'Vamos começar sua jornada.'}</h2><p class="text-secondary">${state.authMode === 'login' ? 'Entre na sua conta para seguir em frente.' : 'Crie sua conta para solicitar um aluguel.'}</p></div>${state.authMode === 'login' ? loginForm() : registerForm()}<p class="text-center small mt-4">${state.authMode === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'} <button class="btn btn-link p-0 small" data-action="auth-toggle">${state.authMode === 'login' ? 'Cadastre-se' : 'Entrar'}</button></p><div class="auth-demo"><span class="eyebrow">EXPLORE O PROJETO</span><p class="small text-secondary mb-2">Preencha um acesso de demonstração:</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-sm btn-outline-secondary" data-action="demo" data-role="cliente">${icon('user')} Cliente</button><button class="btn btn-sm btn-outline-secondary" data-action="demo" data-role="empresa">${icon('car')} Empresa</button><button class="btn btn-sm btn-outline-secondary" data-action="demo" data-role="banco">${icon('wallet')} Banco</button></div><small class="text-secondary d-block mt-2">Senha dos acessos: <code>Demo@123</code> · Dados fictícios</small></div><p class="small text-secondary mt-4 mb-0">Protótipo acadêmico · Laboratório 02 / DIW</p></div></main></div>`;
}
function loginForm() { return `<form id="login-form">${formError}<div class="mb-3"><label for="login-email" class="form-label">E-mail</label><input class="form-control" id="login-email" name="email" type="email" autocomplete="username" placeholder="seu@email.com" required maxlength="160"></div><div class="mb-4"><label for="login-password" class="form-label">Senha</label><input class="form-control" id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" required></div><button class="btn btn-primary w-100" type="submit">Entrar na minha conta ${icon('arrow')}</button></form>`; }
function personalFields(user = {}, includePassword = true) {
  return `<div class="row g-3">${field('name', 'Nome completo', user.name, 'text', 'required minlength="3" maxlength="100" autocomplete="name"')}${field('email', 'E-mail', user.email, 'email', 'required maxlength="160" autocomplete="email"')}${includePassword ? field('password', 'Senha (mínimo 8 caracteres)', '', 'password', 'required minlength="8" maxlength="128" autocomplete="new-password"') : ''}${field('cpf', 'CPF', user.cpf, 'text', 'required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')}${field('rg', 'RG', user.rg, 'text', 'required maxlength="20"')}${field('profession', 'Profissão', user.profession, 'text', 'required maxlength="100"')}${field('address', 'Endereço completo', user.address, 'text', 'required minlength="5" maxlength="240" autocomplete="street-address"')}</div><div class="d-flex align-items-center justify-content-between mt-4 mb-2"><h3 class="fs-6 mb-0">Empregadores e rendimentos</h3><button type="button" class="btn btn-sm btn-outline-primary" data-action="add-employer">${icon('plus')} Adicionar</button></div><p class="small text-secondary">Informe até 3 fontes de renda mensais. Se não possuir, deixe sem empregadores.</p><div class="employers-list">${(user.employers || []).map(employerRow).join('')}</div>`;
}
function employerRow(e = {}, i = 0) { return `<div class="income-row row g-2 mb-2"><div class="col-7"><label class="visually-hidden" for="employer-${i}">Nome do empregador</label><input id="employer-${i}" class="form-control employer-name" value="${esc(e.name || '')}" placeholder="Nome do empregador" required maxlength="100"></div><div class="col-4"><label class="visually-hidden" for="income-${i}">Renda mensal em reais</label><input id="income-${i}" class="form-control employer-income" type="number" min="0.01" step="0.01" value="${esc(e.income || '')}" placeholder="Renda R$" required></div><div class="col-1 d-flex justify-content-center"><button type="button" class="btn btn-light px-1" data-action="remove-employer" aria-label="Remover empregador">${icon('close')}</button></div></div>`; }
function registerForm() { return `<form id="register-form">${formError}${personalFields()}<button class="btn btn-primary w-100 mt-4" type="submit">Criar minha conta ${icon('arrow')}</button><small class="text-secondary d-block mt-2">Use dados fictícios neste ambiente de demonstração.</small></form>`; }
async function loadData() {
  const [cars, clients, agents, requests, contracts] = await Promise.all([api('/cars'), api('/clients'), api('/agents'), api('/requests'), api('/contracts')]);
  Object.assign(state, { cars, clients, agents, requests, contracts });
}
function renderShell() {
  const agent = isAgent();
  const nav = [['dashboard', 'grid', 'Visão geral'], ['fleet', 'car', 'Explorar frota'], ['requests', 'file', agent ? 'Pedidos de aluguel' : 'Meus pedidos'], ['contracts', 'shield', agent ? 'Contratos' : 'Meus contratos'], ...(agent ? [['clients', 'users', 'Clientes']] : [])];
  app.innerHTML = `<div class="app-shell"><div class="sidebar-overlay" data-action="close-menu"></div><aside class="sidebar"><a class="brand" href="#dashboard"><span class="brand-mark">v</span>velora<span class="brand-dot">.</span></a><div class="sidebar-label">SEU ESPAÇO</div><nav aria-label="Navegação principal">${nav.map(([id, ic, text]) => `<a href="#${id}" class="nav-link ${state.view === id ? 'active' : ''}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${text}</span>${id === 'requests' && state.requests.filter(r => r.status === 'pending').length ? `<span class="nav-count">${state.requests.filter(r => r.status === 'pending').length}</span>` : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-tip">${icon('spark')}<p>O próximo destino<br>é você quem escolhe.</p><a href="#help">Conheça a Velora ${icon('arrow')}</a></div><nav aria-label="Conta"><a class="nav-link ${state.view === 'help' ? 'active' : ''}" href="#help">${icon('help')} Central de ajuda</a><a class="nav-link ${state.view === 'account' ? 'active' : ''}" href="#account">${icon('user')} Minha conta</a></nav><div class="profile-mini"><div class="avatar">${esc(initials(state.user.name))}</div><div class="profile-info"><strong>${esc(state.user.name)}</strong><small>${roleName(state.user.role)}</small></div><button class="btn btn-sm btn-logout" data-action="logout" aria-label="Sair da conta" title="Sair">${icon('logout')}</button></div></div></aside><div class="main-panel"><header class="topbar"><div class="d-flex align-items-center gap-3"><button class="btn mobile-toggle" data-action="toggle-menu" aria-label="Abrir navegação" aria-expanded="false">${icon('menu')}</button><span class="topbar-title">${icon('pin')} Mobilidade que acompanha você</span></div><div class="topbar-actions"><span class="workspace-tag">${agent ? 'Área do agente' : 'Área do cliente'}</span><a class="avatar avatar-sm" href="#account" aria-label="Abrir minha conta">${esc(initials(state.user.name))}</a></div></header><main id="main-content" class="content" tabindex="-1">${renderView()}</main><footer class="app-footer"><span>© ${new Date().getFullYear()} Velora. Seu próximo caminho.</span><span>Protótipo acadêmico · DIW</span></footer></div></div>`;
}
function heading(eyebrow, title, subtitle, action = '') { return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p></div><div class="heading-actions">${action}</div></div>`; }
function newButton() { return `<button class="btn btn-primary" data-action="new-request">${icon('plus')} Novo pedido</button>`; }
function renderView() { return ({ dashboard, fleet, requests: requestPage, contracts: contractsPage, clients: clientsPage, account: accountPage, help: helpPage }[state.view] || dashboard)(); }
function stat(ic, label, value, foot, tint = '') { return `<div class="stat-card"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${tint}">${icon(ic)}</span></div><strong class="stat-value">${value}</strong><span class="stat-foot">${foot}</span></div>`; }
function dashboard() {
  const pending = state.requests.filter(r => r.status === 'pending').length;
  const sorted = [...state.requests].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return heading('SEU PAINEL DE MOBILIDADE', `Olá, ${esc(state.user.name.split(' ')[0])}<span class="text-teal">.</span>`, isAgent() ? 'Acompanhe os pedidos e mantenha cada etapa em movimento.' : 'Tudo pronto para o seu próximo destino?', !isAgent() ? newButton() : `<a class="btn btn-primary" href="#requests">${icon('file')} Analisar pedidos</a>`) +
  `<section class="hero-banner"><div class="hero-copy"><span class="hero-label">${isAgent() ? 'GESTÃO SIMPLES. CAMINHOS ABERTOS.' : 'MAIS LIBERDADE PARA IR ALÉM'}</span><h2>${isAgent() ? 'Boas decisões.<br>Novos caminhos.' : 'O carro certo para<br>o seu próximo capítulo.'}</h2><p>${isAgent() ? 'Do primeiro pedido à assinatura do contrato,<br>acompanhe tudo com clareza.' : 'Escolha seu carro, faça seu pedido<br>e acompanhe tudo por aqui.'}</p><a class="btn btn-hero" href="${isAgent() ? '#requests' : '#fleet'}">${isAgent() ? 'Ver pedidos' : 'Explorar a frota'} ${icon('arrow')}</a></div><div class="hero-art"><span class="hero-circle"></span><img src="assets/sedan-car.svg" alt="Sedan da frota Velora"></div><span class="hero-caption">VÁ MAIS LONGE. VÁ DE VELORA.</span></section>
  <section class="stats-grid" aria-label="Resumo da conta">${stat('file', isAgent() ? 'Total de pedidos' : 'Meus pedidos', state.requests.length, 'Sua jornada em números')}${stat('clock', 'Em análise', pending, pending ? 'Aguardando parecer financeiro' : 'Tudo em dia por aqui', 'amber')}${stat('shield', 'Contratos ativos', state.contracts.filter(c => c.status === 'active').length, 'Aluguéis formalizados', 'green')}${stat('car', 'Veículos na frota', state.cars.length, 'Encontre seu próximo carro', 'blue')}</section>
  <section class="panel"><div class="panel-header"><div><h2>Pedidos recentes</h2><p>${isAgent() ? 'Os últimos movimentos da operação.' : 'Acompanhe cada etapa dos seus aluguéis.'}</p></div><a class="text-link" href="#requests">Ver todos ${icon('arrow')}</a></div>${sorted.length ? requestTable(sorted.slice(0, 4)) : empty('file', 'Sua próxima viagem começa com um pedido', 'Explore os veículos e escolha o que combina com você.', '<a href="#fleet" class="btn btn-primary">Explorar frota</a>')}</section>
  <section class="mt-4"><div class="section-heading"><div><span class="eyebrow">ESCOLHA SEU PRÓXIMO CAMINHO</span><h2>Uma frota. Muitas possibilidades.</h2></div><a class="text-link" href="#fleet">Conhecer a frota ${icon('arrow')}</a></div><div class="fleet-grid">${state.cars.slice(0, 3).map(carCard).join('')}</div></section>`;
}
function empty(ic, title, text, button = '') { return `<div class="empty-state"><div class="empty-icon">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${button}</div>`; }
function carCard(car) { return `<article class="car-card"><div class="car-visual"><span class="car-tag">${esc(car.category)}</span><img src="${carImage(car)}" alt="Ilustração de ${esc(car.brand)} ${esc(car.model)}" loading="lazy"><span class="car-year">${esc(car.year)}</span></div><div class="car-body"><p class="car-brand">${esc(car.brand)}</p><h3>${esc(car.model)}</h3><div class="car-specs"><span>${icon('users')} ${esc(car.seats)} lugares</span><span>${icon('car')} ${esc(car.transmission)}</span><span>${esc(car.fuel)}</span></div><div class="car-footer"><div><strong class="car-price">${money(car.dailyRate)}</strong><small> / diária</small></div><button class="btn btn-outline-primary btn-sm" data-action="${isAgent() ? 'car-detail' : 'new-request'}" data-id="${esc(car.id)}">${isAgent() ? 'Detalhes' : 'Escolher'} ${icon('arrow')}</button></div></div></article>`; }
function fleet() {
  const cars = state.cars.filter(c => (!state.category || c.category === state.category) && `${c.brand} ${c.model} ${c.plate}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  return heading('ENCONTRE SEU CARRO', 'Liberdade em cada escolha.', 'Do dia a dia à próxima aventura. Escolha o carro que acompanha você.') + `<div class="filter-bar"><div class="search-field">${icon('search')}<input class="form-control" id="search" aria-label="Buscar veículo" placeholder="Busque por marca, modelo ou placa" value="${esc(state.query)}"></div><select class="form-select filter-select" id="category-filter" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${[...new Set(state.cars.map(c => c.category))].map(c => `<option ${state.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><span class="text-secondary small" id="result-count">${cars.length} veículos</span></div><div id="filtered-results">${cars.length ? `<div class="fleet-grid">${cars.map(carCard).join('')}</div>` : empty('car', 'Nenhum veículo encontrado', 'Tente outra marca, modelo ou categoria.')}</div><p class="small text-secondary mt-4">${icon('help')} Valores por diária. A disponibilidade é confirmada para o período escolhido durante a análise do pedido.</p>`;
}
function requestTable(rows) {
  return `<div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th scope="col">Veículo / pedido</th>${isAgent() ? '<th scope="col">Cliente</th>' : ''}<th scope="col">Período</th><th scope="col">Valor total</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Ações</span></th></tr></thead><tbody>${rows.map(r => { const c = carById(r.carId); return `<tr><td><div class="vehicle-cell"><div class="vehicle-thumb"><img src="${carImage(c)}" alt=""></div><div><strong>${esc(c ? `${c.brand} ${c.model}` : 'Veículo')}</strong><small>${shortId(r.id)}</small></div></div></td>${isAgent() ? `<td>${esc(clientById(r.clientId)?.name || 'Cliente')}</td>` : ''}<td><span class="text-nowrap">${date(r.startDate)} → ${date(r.endDate)}</span><small class="d-block text-secondary">${r.days} ${r.days === 1 ? 'diária' : 'diárias'}</small></td><td><strong>${money(r.total)}</strong></td><td>${badge(r.status)}</td><td><button class="btn btn-sm btn-light" data-action="request-detail" data-id="${esc(r.id)}" aria-label="Ver pedido ${shortId(r.id)}">Detalhes ${icon('chevron')}</button></td></tr>`; }).join('')}</tbody></table></div>`;
}
function requestPage() {
  const rows = [...state.requests].sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))).filter(r => (!state.filter || r.status === state.filter) && `${r.id} ${carById(r.carId)?.brand} ${carById(r.carId)?.model} ${clientById(r.clientId)?.name || ''}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  return heading('ACOMPANHE SUA JORNADA', isAgent() ? 'Pedidos de aluguel' : 'Meus pedidos', isAgent() ? 'Analise, avalie e transforme pedidos em novos caminhos.' : 'Do primeiro passo ao contrato. Cada etapa, bem aqui.', !isAgent() ? newButton() : '') + `<div class="filter-bar"><div class="search-field">${icon('search')}<input class="form-control" id="search" aria-label="Buscar pedido" placeholder="Busque por veículo ou número do pedido" value="${esc(state.query)}"></div><select class="form-select filter-select" id="status-filter" aria-label="Filtrar por status"><option value="">Todos os status</option>${Object.entries(labels).filter(([key]) => key !== 'active').map(([key,text]) => `<option value="${key}" ${state.filter === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div><section class="panel" id="filtered-results">${rows.length ? requestTable(rows) : empty('file', 'Nenhum pedido por aqui', 'Seus pedidos e os próximos passos aparecerão nesta área.', !isAgent() ? newButton() : '')}</section>`;
}
function contractsPage() {
  return heading('SEUS ACORDOS, COM CLAREZA', isAgent() ? 'Contratos' : 'Meus contratos', 'Todos os detalhes dos aluguéis formalizados em um só lugar.') + `<section class="panel">${state.contracts.length ? `<div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>Contrato / veículo</th><th>Período</th><th>Valor</th><th>Modalidade</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.contracts.map(c => `<tr><td><strong>${shortId(c.id)}</strong><small class="d-block text-secondary">${esc(carById(c.carId)?.model)}</small></td><td>${date(c.startDate)} → ${date(c.endDate)}</td><td>${money(c.total)}</td><td>${c.credit ? 'Com crédito bancário' : 'Aluguel direto'}</td><td>${badge(c.status)}</td><td><button class="btn btn-light btn-sm" data-action="contract-detail" data-id="${esc(c.id)}">Ver contrato ${icon('chevron')}</button></td></tr>`).join('')}</tbody></table></div>` : empty('shield', 'Seus contratos vão morar aqui', 'Após a aprovação financeira, um agente pode formalizar o aluguel.')}</section>`;
}
function clientsPage() {
  if (!isAgent()) return dashboard();
  const rows = state.clients.filter(c => `${c.name} ${c.email} ${c.cpf}`.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
  return heading('RELAÇÕES QUE MOVEM', 'Clientes', 'Cadastro completo e informações para uma análise responsável.', '<button class="btn btn-primary" data-action="new-client">' + icon('plus') + ' Cadastrar cliente</button>') + `<div class="filter-bar"><div class="search-field">${icon('search')}<input class="form-control" id="search" aria-label="Buscar cliente" placeholder="Busque por nome, CPF ou e-mail" value="${esc(state.query)}"></div></div><section class="panel" id="filtered-results">${rows.length ? `<div class="table-responsive"><table class="table data-table align-middle"><thead><tr><th>Cliente</th><th>CPF</th><th>Profissão</th><th>Renda mensal</th><th>Ações</th></tr></thead><tbody>${rows.map(c => `<tr><td><div class="d-flex gap-3 align-items-center"><span class="avatar">${esc(initials(c.name))}</span><div><strong>${esc(c.name)}</strong><small class="d-block text-secondary">${esc(c.email)}</small></div></div></td><td>${esc(c.cpf)}</td><td>${esc(c.profession)}</td><td>${money((c.employers || []).reduce((s,e) => s + Number(e.income), 0))}</td><td><button class="btn btn-sm btn-light" data-action="client-detail" data-id="${esc(c.id)}">Detalhes ${icon('chevron')}</button></td></tr>`).join('')}</tbody></table></div>` : empty('users', 'Nenhum cliente encontrado', 'Ajuste a busca ou cadastre um novo cliente.')}</section>`;
}
function detail(label, value) { return `<div class="detail-block"><span class="detail-label">${label}</span><div class="detail-value">${value}</div></div>`; }
function accountPage() {
  const u = state.user;
  return heading('DO SEU JEITO', 'Minha conta', 'Mantenha suas informações atualizadas para seguir em frente.') + `<section class="panel p-4"><div class="d-flex gap-3 align-items-center mb-4"><div class="avatar avatar-lg">${esc(initials(u.name))}</div><div><h2 class="mb-1">${esc(u.name)}</h2><span class="workspace-tag">${roleName(u.role)}</span></div></div><div class="detail-grid">${detail('E-mail', esc(u.email))}${detail('Perfil de acesso', roleName(u.role))}${u.role === 'client' ? `${detail('CPF', esc(u.cpf))}${detail('RG', esc(u.rg))}${detail('Profissão', esc(u.profession))}${detail('Endereço', esc(u.address))}${detail('Renda mensal total', money((u.employers || []).reduce((s,e) => s + Number(e.income), 0)))}` : ''}</div>${u.role === 'client' ? `<div class="d-flex flex-wrap gap-2 mt-4"><button class="btn btn-primary" data-action="edit-client" data-id="${esc(u.id)}">${icon('edit')} Editar meus dados</button><button class="btn btn-outline-danger" data-action="delete-client" data-id="${esc(u.id)}">Excluir minha conta</button></div><p class="small text-secondary mt-3 mb-0">Para preservar o histórico, contas com pedidos ou contratos vinculados não podem ser excluídas.</p>` : '<p class="text-secondary mt-4 mb-0">Os acessos de agentes são previamente provisionados neste protótipo.</p>'}</section>`;
}
function helpPage() {
  return heading('CADA ETAPA, SEM COMPLICAÇÃO', 'Central de ajuda', 'Entenda como seu pedido se transforma em um novo caminho.') + `<div class="row g-4"><div class="col-lg-8"><section class="panel p-4"><h2 class="mb-4">Como funciona a Velora</h2><div class="timeline">${[['01', 'Escolha o seu carro', 'Explore a frota, informe o período e envie seu pedido. O total considera a quantidade de diárias; a devolução encerra o período.'], ['02', 'Análise financeira', 'Empresas e bancos avaliam seus dados e rendimentos. Você acompanha o parecer e a justificativa no pedido.'], ['03', 'Contrato e próximo destino', 'Com a aprovação, um agente formaliza o contrato e define o proprietário. Se houver crédito, a concessão é feita por um banco.']].map(([n,t,d]) => `<div class="timeline-item"><span class="timeline-number">${n}</span><h3>${t}</h3><p>${d}</p></div>`).join('')}</div><h3 class="fs-6 mt-4">Posso alterar ou cancelar?</h3><p class="text-secondary">Pedidos em análise ou não aprovados podem ser editados. Ao editar, eles voltam à análise. Pedidos em análise ou aprovados podem ser cancelados; contratos já formalizados preservam seu histórico.</p><h3 class="fs-6">Quando um veículo está disponível?</h3><p class="text-secondary mb-0">A API verifica o período ao aprovar ou formalizar. Pedidos aprovados e contratados reservam o veículo; datas de devolução e retirada no mesmo dia são permitidas.</p></section></div><div class="col-lg-4"><section class="help-card"><span class="stat-icon">${icon('shield')}</span><h2>Um projeto completo.<br>Uma experiência clara.</h2><p>HTML5, CSS3 e JavaScript, com Bootstrap 5 na interface e JSON Server na persistência.</p><hr><span class="eyebrow">LABORATÓRIO 02 · DIW</span><p class="small mt-3">Este é um protótipo acadêmico. Não realiza pagamentos, assinaturas digitais, análise de crédito real ou integração com bancos.</p><p class="small mb-0">A documentação, a modelagem e o roteiro de apresentação acompanham o código-fonte na pasta <code>docs/</code>.</p></section></div></div>`;
}

function requestForm(id = '', carId = '') {
  const r = state.requests.find(r => r.id === id);
  const selected = r?.carId || carId || state.cars[0]?.id;
  const options = state.cars.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(`${c.brand} ${c.model} · ${c.category}`)} — ${money(c.dailyRate)}/dia</option>`).join('');
  showModal(r ? `Editar pedido ${shortId(r.id)}` : 'Seu próximo caminho começa aqui', `<form id="request-form" data-id="${esc(id)}">${formError}<ol class="progress-steps"><li class="step active">Seu pedido</li><li class="step">Análise</li><li class="step">Contrato</li></ol><div class="mb-3"><label class="form-label" for="request-car">Escolha o veículo</label><select class="form-select" name="carId" id="request-car" required>${options}</select></div><div class="row g-3">${field('startDate', 'Data de retirada', r?.startDate || dayISO(1), 'date', `required min="${dayISO()}"`)}${field('endDate', 'Data de devolução', r?.endDate || dayISO(4), 'date', `required min="${dayISO(1)}"`)}${field('notes', 'Observações (opcional)', r?.notes || '', 'textarea', 'maxlength="2000" placeholder="Algo que precisamos saber sobre o seu aluguel?"')}</div><div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="credit-requested" name="creditRequested" ${r?.creditRequested ? 'checked' : ''}><label class="form-check-label" for="credit-requested">Desejo solicitar crédito a um banco parceiro</label></div><p class="form-text">A solicitação de crédito depende de análise. Apenas um banco pode emitir o contrato com financiamento.</p><div class="rental-estimate" id="rental-estimate" aria-live="polite"></div><p class="small text-secondary mt-2">O total é calculado na API. A devolução não conta como uma diária adicional.</p>${r ? '<div class="alert alert-warning mt-3">A edição devolve o pedido à análise financeira e invalida um parecer anterior.</div>' : ''}${formFooter(r ? 'Salvar e reenviar' : 'Enviar pedido')}</form>`);
  updateEstimate();
}
function updateEstimate() {
  const f = $('#request-form'); if (!f) return;
  const c = carById(f.elements.carId.value);
  const days = Math.round((Date.parse(f.elements.endDate.value) - Date.parse(f.elements.startDate.value)) / 86400000);
  $('#rental-estimate').innerHTML = days > 0 && days <= 365 ? `<div><span>Estimativa do seu aluguel</span><div>${days} ${days === 1 ? 'diária' : 'diárias'} × ${money(c?.dailyRate)}</div></div><strong>${money(days * c.dailyRate)}</strong>` : '<span>Escolha um período de 1 a 365 diárias para calcular o valor.</span>';
}
function showRequest(id) {
  const r = state.requests.find(r => r.id === id); if (!r) return;
  const c = carById(r.carId); const client = clientById(r.clientId);
  const editable = (isAgent() ? ['pending', 'approved', 'rejected'] : ['pending', 'rejected']).includes(r.status);
  const contract = state.contracts.find(c => c.requestId === r.id);
  const historyLabels = { created: 'Pedido enviado', updated: 'Pedido atualizado', approved: 'Parecer favorável', rejected: 'Parecer desfavorável', cancelled: 'Pedido cancelado', contracted: 'Contrato emitido' };
  showModal(`Pedido ${shortId(r.id)}`, `<div class="selected-car"><img src="${carImage(c)}" alt=""><div><p>${esc(c?.brand)} · ${esc(c?.category)}</p><h3>${esc(c?.model)}</h3><p>${esc(c?.plate)} · ${esc(c?.year)}</p></div><div class="ms-auto">${badge(r.status)}</div></div><div class="detail-grid">${detail('Cliente', esc(client?.name || state.user.name))}${detail('Período', `${date(r.startDate)} → ${date(r.endDate)}`)}${detail('Diárias', `${r.days} × ${money(c?.dailyRate)}`)}${detail('Valor total', money(r.total))}${detail('Modalidade solicitada', r.creditRequested ? 'Com crédito bancário' : 'Aluguel direto')}${detail('Criado em', date(r.createdAt))}</div>${r.notes ? `<h3 class="detail-section-title">Observações do pedido</h3><p class="notes-box">${esc(r.notes)}</p>` : ''}${isAgent() && client ? `<h3 class="detail-section-title">Informações financeiras do cliente</h3><div class="review-summary"><div class="detail-grid">${detail('Profissão', esc(client.profession))}${detail('Renda mensal declarada', money((client.employers || []).reduce((s,e) => s + Number(e.income), 0)))}</div>${(client.employers || []).map(e => `<p class="small mb-0 mt-2">${esc(e.name)} · ${money(e.income)}/mês</p>`).join('') || '<p class="small mt-2 mb-0">Nenhum empregador informado.</p>'}</div>` : ''}<h3 class="detail-section-title">Acompanhe cada etapa</h3><div class="timeline">${(r.history || []).map(h => `<div class="timeline-item"><strong>${esc(historyLabels[h.action] || h.action)}</strong><p>${esc(h.note || h.notes || '')}</p><small>${esc(h.actorName)} · ${date(h.at)} ${new Date(h.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></div>`).join('')}</div><div class="d-flex flex-wrap gap-2 border-top pt-3 mt-4">${editable ? `<button class="btn btn-outline-primary" data-action="edit-request" data-id="${esc(r.id)}">${icon('edit')} Editar pedido</button>` : ''}${!isAgent() && ['pending', 'approved'].includes(r.status) ? `<button class="btn btn-outline-danger" data-action="cancel-request" data-id="${esc(r.id)}">Cancelar pedido</button>` : ''}${isAgent() && r.status === 'pending' ? `<button class="btn btn-primary" data-action="review-request" data-id="${esc(r.id)}">${icon('check')} Avaliar pedido</button>` : ''}${isAgent() && r.status === 'approved' && (!r.creditRequested || state.user.role === 'bank') ? `<button class="btn btn-primary" data-action="new-contract" data-id="${esc(r.id)}">${icon('shield')} Emitir contrato</button>` : ''}${contract ? `<button class="btn btn-primary" data-action="contract-detail" data-id="${esc(contract.id)}">Ver contrato ${icon('arrow')}</button>` : ''}</div>${isAgent() && r.status === 'approved' && r.creditRequested && state.user.role !== 'bank' ? '<div class="alert alert-info mt-3 mb-0">O cliente solicitou crédito. Um banco parceiro deve concedê-lo e emitir o contrato.</div>' : ''}`);
}
function reviewForm(id) {
  const r = state.requests.find(r => r.id === id); const u = clientById(r.clientId);
  showModal('Análise financeira do pedido', `<form id="review-form" data-id="${esc(id)}">${formError}<div class="review-summary">${detail('Cliente', esc(u?.name))}${detail('Valor do pedido', money(r.total))}${detail('Rendimentos mensais declarados', money((u?.employers || []).reduce((s,e) => s + Number(e.income), 0)))}</div><div class="mb-3"><label class="form-label" for="review-decision">Parecer financeiro</label><select class="form-select" id="review-decision" name="decision" required><option value="">Selecione o parecer</option><option value="approved">Aprovar pedido</option><option value="rejected">Não aprovar pedido</option></select></div><label class="form-label" for="review-notes">Justificativa do parecer</label><textarea class="form-control" id="review-notes" name="notes" rows="4" required maxlength="2000" placeholder="Registre a fundamentação da análise. O cliente poderá consultá-la."></textarea><p class="form-text">A aprovação verifica a disponibilidade do veículo. O contrato será emitido em uma etapa seguinte.</p>${formFooter('Registrar parecer')}</form>`);
}
function contractForm(id) {
  const r = state.requests.find(r => r.id === id); const car = carById(r.carId);
  showModal('Formalizar contrato de aluguel', `<form id="contract-form" data-id="${esc(id)}">${formError}<div class="review-summary">${detail('Pedido aprovado', `${shortId(id)} · ${esc(car?.model)}`)}${detail('Valor do aluguel', money(r.total))}</div><div class="row g-3"><div class="col-md-6"><label for="owner-type" class="form-label">Tipo de proprietário do veículo</label><select id="owner-type" name="ownerType" class="form-select"><option value="company">Empresa</option><option value="client">Cliente contratante</option><option value="bank">Banco</option></select></div><div class="col-md-6"><label for="owner-id" class="form-label">Registrar propriedade em nome de</label><select id="owner-id" name="ownerId" class="form-select" required></select></div></div>${state.user.role === 'bank' ? `<div class="form-check mt-4"><input type="checkbox" class="form-check-input" id="with-credit" name="withCredit" ${r.creditRequested ? 'checked disabled' : ''}><label class="form-check-label" for="with-credit">Associar contrato de crédito bancário</label></div><div id="credit-fields" class="mt-3 ${r.creditRequested ? '' : 'd-none'}"><div class="alert alert-info">Crédito concedido por <strong>${esc(state.user.name)}</strong>. Sistema de parcelas fixas (Price), sem tarifas adicionais.</div><div class="row g-3">${field('installments', 'Quantidade de parcelas', 6, 'number', 'min="1" max="60" step="1" required')}${field('interestRate', 'Taxa de juros mensal (%)', 1.5, 'number', 'min="0" max="20" step="0.01" required')}</div><div id="credit-estimate" class="rental-estimate" aria-live="polite"></div></div>` : '<p class="form-text mt-3">Aluguel direto, sem crédito bancário associado.</p>'}<div class="alert alert-warning mt-4">Ao emitir, o pedido será contratado e seus dados não poderão mais ser editados. O veículo será registrado em nome do proprietário escolhido.</div>${formFooter('Emitir contrato')}</form>`);
  updateOwners(r); updateCredit(r);
}
function updateOwners(r) {
  const type = $('#owner-type').value;
  const owners = type === 'client' ? state.clients.filter(c => c.id === r.clientId) : state.agents.filter(a => a.role === type);
  $('#owner-id').innerHTML = owners.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
}
function updateCredit(r) {
  const form = $('#contract-form'); const box = $('#credit-estimate'); if (!box) return;
  const n = Number(form.elements.installments.value); const rate = Number(form.elements.interestRate.value) / 100;
  if (n < 1 || n > 60 || rate < 0 || rate > .2) { box.textContent = 'Informe de 1 a 60 parcelas e uma taxa mensal entre 0% e 20%.'; return; }
  const installment = Math.round((rate === 0 ? r.total / n : r.total * rate / (1 - Math.pow(1 + rate, -n))) * 100) / 100;
  box.innerHTML = `<div><span>Estimativa de crédito · ${n} parcelas</span><div>Total financiado: ${money(installment * n)}</div></div><strong>${money(installment)}<small>/mês</small></strong>`;
}
function contractContent(c) {
  const u = clientById(c.clientId); const car = carById(c.carId);
  return `<article class="contract-paper"><header class="contract-header"><div class="brand"><span class="brand-mark">v</span>velora.</div><div><h2>Contrato de aluguel de automóvel</h2><p>${shortId(c.id)} · Emitido em ${date(c.createdAt)}</p></div></header><div class="detail-grid">${detail('Situação', badge(c.status))}${detail('Pedido de origem', shortId(c.requestId))}</div><h3>01 · Contratante</h3><div class="detail-grid">${detail('Nome', esc(u?.name))}${detail('CPF / RG', `${esc(u?.cpf)} / ${esc(u?.rg)}`)}${detail('Endereço', esc(u?.address))}${detail('Contato', esc(u?.email))}</div><h3>02 · Veículo e propriedade</h3><div class="detail-grid">${detail('Automóvel', `${esc(car?.brand)} ${esc(car?.model)} · ${esc(car?.year)}`)}${detail('Placa / matrícula', `${esc(car?.plate)} / ${esc(car?.registration)}`)}${detail('Tipo de proprietário', roleName(c.ownerType))}${detail('Proprietário registrado', esc(nameById(c.ownerId)))}</div><h3>03 · Período e valor</h3><div class="detail-grid">${detail('Retirada', date(c.startDate))}${detail('Devolução', date(c.endDate))}${detail('Quantidade de diárias', c.days ?? Math.round((Date.parse(c.endDate) - Date.parse(c.startDate)) / 86400000))}${detail('Valor do aluguel', money(c.total))}</div>${c.credit ? `<h3>04 · Contrato de crédito associado</h3><div class="detail-grid">${detail('Banco concedente', esc(nameById(c.credit.bankId)))}${detail('Identificação do crédito', esc(c.credit.id))}${detail('Principal', money(c.credit.principal))}${detail('Juros mensais', `${esc(c.credit.interestRate)}%`)}${detail('Parcelas fixas', `${c.credit.installments} × ${money(c.credit.installmentAmount)}`)}${detail('Total financiado', money(c.credit.totalFinanced))}</div><p class="contract-note">Amortização Price. A soma considera parcelas arredondadas para centavos. Simulação acadêmica, sem cobrança ou concessão de crédito real.</p>` : '<p>Modalidade de aluguel direto, sem contrato de crédito associado.</p>'}<div class="contract-total"><span>Valor do aluguel${c.credit ? ' (antes dos juros)' : ''}</span><strong>${money(c.total)}</strong></div><p class="contract-note">Documento de demonstração acadêmica. A emissão registra a formalização no sistema; não constitui assinatura digital nem contrato jurídico válido. Dados cadastrais exibidos refletem o cadastro atual. Nenhum pagamento é processado.</p></article>`;
}
function showContract(id) {
  const c = state.contracts.find(c => c.id === id); if (!c) return;
  showModal(`Contrato ${shortId(c.id)}`, `${contractContent(c)}<div class="contract-actions"><button class="btn btn-outline-primary" data-action="download-contract" data-id="${esc(c.id)}">${icon('download')} Baixar contrato HTML</button><button type="button" class="btn btn-light" data-bs-dismiss="modal">Fechar</button></div>`);
}
function downloadContract(id) {
  const c = state.contracts.find(c => c.id === id);
  // Standalone readable document, with no external files or scripts.
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Velora · Contrato ${esc(c.id)}</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#15363b;max-width:850px;margin:40px auto;padding:24px}h3{margin-top:32px}.contract-header{display:flex;justify-content:space-between;border-bottom:1px solid #ddd}.brand{font-size:28px;font-weight:bold}.brand-mark{display:none}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.detail-label{display:block;font-size:12px;color:#666}.detail-value{overflow-wrap:anywhere}.contract-total{margin:30px 0;padding:20px;background:#edf5f0;display:flex;justify-content:space-between}.contract-note{font-size:12px;color:#666}@media(max-width:500px){.detail-grid{grid-template-columns:1fr}.contract-header{display:block}}</style>${contractContent(c)}</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `velora-contrato-${c.id}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function clientForm(id = '') {
  const u = state.clients.find(c => c.id === id);
  showModal(u ? 'Editar cadastro do cliente' : 'Cadastrar novo cliente', `<form id="client-form" data-id="${esc(id)}">${formError}${personalFields(u, !u)}${u ? '<p class="form-text mt-3">A senha atual será mantida.</p>' : '<p class="form-text mt-3">O cliente poderá acessar com o e-mail e a senha informados.</p>'}${formFooter(u ? 'Salvar cadastro' : 'Cadastrar cliente')}</form>`);
}
function showClient(id) {
  const u = clientById(id); if (!u) return;
  showModal('Detalhes do cliente', `<div class="d-flex gap-3 align-items-center mb-4"><span class="avatar avatar-lg">${esc(initials(u.name))}</span><div><h3 class="fs-5 mb-1">${esc(u.name)}</h3><p class="text-secondary mb-0">${esc(u.email)}</p></div></div><div class="detail-grid">${detail('CPF', esc(u.cpf))}${detail('RG', esc(u.rg))}${detail('Endereço', esc(u.address))}${detail('Profissão', esc(u.profession))}</div><h3 class="detail-section-title">Empregadores e rendimentos mensais</h3>${(u.employers || []).map(e => `<p class="notes-box">${esc(e.name)} <strong class="float-end">${money(e.income)}</strong></p>`).join('') || '<p class="text-secondary">Nenhum empregador informado.</p>'}<div class="income-summary"><span>Rendimento mensal total</span><strong>${money((u.employers || []).reduce((s,e) => s + Number(e.income), 0))}</strong></div><div class="d-flex gap-2 mt-4"><button class="btn btn-primary" data-action="edit-client" data-id="${esc(id)}">${icon('edit')} Editar cadastro</button><button class="btn btn-outline-danger" data-action="delete-client" data-id="${esc(id)}">Excluir cliente</button></div>`);
}
function showCar(id) {
  const c = carById(id); if (!c) return;
  showModal(`${c.brand} ${c.model}`, `<div class="car-visual mb-4"><img src="${carImage(c)}" alt="Ilustração do veículo"></div><div class="detail-grid">${detail('Marca e modelo', `${esc(c.brand)} ${esc(c.model)}`)}${detail('Ano', esc(c.year))}${detail('Matrícula', esc(c.registration))}${detail('Placa', esc(c.plate))}${detail('Categoria', esc(c.category))}${detail('Câmbio / combustível', `${esc(c.transmission)} / ${esc(c.fuel)}`)}${detail('Diária', money(c.dailyRate))}${detail('Proprietário registrado', `${roleName(c.ownerType)} · ${esc(nameById(c.ownerId))}`)}</div>`);
}
function confirmAction(title, text, endpoint, method, callback, buttonText) {
  showModal(title, `<form id="confirm-form" data-endpoint="${esc(endpoint)}" data-method="${esc(method)}" data-callback="${esc(callback || '')}">${formError}<div class="alert alert-warning">${text}</div><p class="text-secondary">Confirme abaixo para concluir esta ação.</p><div class="d-flex justify-content-end gap-2"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Voltar</button><button class="btn btn-danger" type="submit">${buttonText || 'Confirmar'}</button></div></form>`);
}
function getPersonalData(form) {
  const result = Object.fromEntries(new FormData(form));
  result.employers = [...form.querySelectorAll('.income-row')].map(row => ({ name: $('.employer-name', row).value, income: Number($('.employer-income', row).value) }));
  return result;
}
async function authenticated(data) {
  token = data.token; state.user = data.user; sessionStorage.setItem('velora.token', token);
  state.view = 'dashboard'; state.query = ''; state.filter = ''; history.replaceState(null, '', '#dashboard'); await loadData(); renderShell();
}
async function refresh() {
  await loadData();
  state.user = await api('/auth/me'); renderShell();
}

// Delegated events keep dynamic pages and modal content interactive without inline JavaScript.
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action; const id = button.dataset.id;
  try {
    if (action === 'auth-toggle') { state.authMode = state.authMode === 'login' ? 'register' : 'login'; renderAuth(); }
    else if (action === 'demo') { state.authMode = 'login'; renderAuth(); $('#login-email').value = `${button.dataset.role}@velora.com`; $('#login-password').value = 'Demo@123'; $('#login-email').focus(); }
    else if (action === 'logout') {
      button.disabled = true;
      await api('/auth/logout', { method: 'POST', body: {} });
      token = null; state.user = null; sessionStorage.removeItem('velora.token'); location.hash = ''; renderAuth();
    }
    else if (action === 'toggle-menu') { const open = $('.sidebar').classList.toggle('open'); $('.sidebar-overlay').classList.toggle('show', open); button.setAttribute('aria-expanded', String(open)); }
    else if (action === 'close-menu') { $('.sidebar').classList.remove('open'); $('.sidebar-overlay').classList.remove('show'); $('.mobile-toggle').setAttribute('aria-expanded', 'false'); }
    else if (action === 'add-employer') {
      const form = button.closest('form'); const list = $('.employers-list', form); const count = list.children.length;
      if (count >= 3) return toast('É permitido informar no máximo 3 fontes de renda.', true);
      list.insertAdjacentHTML('beforeend', employerRow({}, Date.now())); $('.income-row:last-child input', list).focus();
    }
    else if (action === 'remove-employer') button.closest('.income-row').remove();
    else if (action === 'new-request') requestForm('', id);
    else if (action === 'edit-request') requestForm(id);
    else if (action === 'request-detail') showRequest(id);
    else if (action === 'review-request') reviewForm(id);
    else if (action === 'new-contract') contractForm(id);
    else if (action === 'contract-detail') showContract(id);
    else if (action === 'download-contract') downloadContract(id);
    else if (action === 'car-detail') showCar(id);
    else if (action === 'new-client') clientForm();
    else if (action === 'edit-client') clientForm(id);
    else if (action === 'client-detail') showClient(id);
    else if (action === 'cancel-request') confirmAction('Cancelar pedido de aluguel', 'O pedido será cancelado e deixará de reservar o veículo. Para alugar novamente, será necessário criar outro pedido.', `/requests/${id}/cancel`, 'POST', '', 'Confirmar cancelamento');
    else if (action === 'delete-client') confirmAction(id === state.user.id ? 'Excluir minha conta' : 'Excluir cadastro do cliente', 'A exclusão é permanente. Cadastros com pedidos, contratos ou veículos vinculados são preservados e não podem ser excluídos.', `/clients/${id}`, 'DELETE', id === state.user.id ? 'logout' : '', 'Excluir cadastro');
  } catch (error) { button.disabled = false; toast(error.message, true); }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  if (!['login-form','register-form','request-form','review-form','contract-form','client-form','confirm-form'].includes(form.id)) return;
  event.preventDefault(); if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]'); const oldText = submit.innerHTML;
  submit.disabled = true; submit.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Aguarde…';
  const errorBox = $('.form-error', form); errorBox.classList.add('d-none');
  try {
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'login-form') await authenticated(await api('/auth/login', { method: 'POST', body: data }));
    else if (form.id === 'register-form') { await authenticated(await api('/auth/register', { method: 'POST', body: getPersonalData(form) })); toast('Sua conta foi criada. Bem-vindo à Velora!'); }
    else {
      let message = '';
      if (form.id === 'request-form') {
        await api(`/requests${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PATCH' : 'POST', body: { ...data, creditRequested: form.elements.creditRequested.checked } }); message = form.dataset.id ? 'Pedido atualizado e reenviado para análise.' : 'Pedido enviado para análise financeira.';
      } else if (form.id === 'review-form') { await api(`/requests/${form.dataset.id}/review`, { method: 'POST', body: data }); message = 'Parecer financeiro registrado.'; }
      else if (form.id === 'contract-form') {
        const body = { ownerType: data.ownerType, ownerId: data.ownerId };
        if (form.elements.withCredit?.checked) body.credit = { bankId: state.user.id, installments: Number(data.installments), interestRate: Number(data.interestRate) };
        await api(`/requests/${form.dataset.id}/contract`, { method: 'POST', body }); message = 'Contrato emitido com sucesso.';
      } else if (form.id === 'client-form') { await api(`/clients${form.dataset.id ? `/${form.dataset.id}` : ''}`, { method: form.dataset.id ? 'PATCH' : 'POST', body: getPersonalData(form) }); message = form.dataset.id ? 'Cadastro atualizado.' : 'Cliente cadastrado com sucesso.'; }
      else if (form.id === 'confirm-form') {
        await api(form.dataset.endpoint, { method: form.dataset.method, ...(form.dataset.method === 'POST' ? { body: {} } : {}) });
        if (form.dataset.callback === 'logout') { modal.hide(); token = null; sessionStorage.removeItem('velora.token'); state.user = null; state.authMode = 'login'; renderAuth(); toast('Conta excluída.'); return; }
        message = form.dataset.method === 'DELETE' ? 'Cadastro excluído.' : 'Pedido cancelado.';
      }
      modal.hide(); await refresh(); toast(message);
    }
  } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('d-none'); errorBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  finally { submit.disabled = false; submit.innerHTML = oldText; }
});
let searchTimer;
document.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'search') {
    state.query = target.value; clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const cursor = target.selectionStart;
      $('#main-content').innerHTML = renderView(); const input = $('#search'); input.focus(); input.setSelectionRange(cursor, cursor);
    }, 220);
  }
  if (target.closest('#request-form')) updateEstimate();
  if (target.closest('#contract-form')) updateCredit(state.requests.find(r => r.id === $('#contract-form').dataset.id));
});
document.addEventListener('change', event => {
  if (event.target.id === 'status-filter') { state.filter = event.target.value; $('#main-content').innerHTML = renderView(); }
  if (event.target.id === 'category-filter') { state.category = event.target.value; $('#main-content').innerHTML = renderView(); }
  if (event.target.id === 'owner-type') updateOwners(state.requests.find(r => r.id === $('#contract-form').dataset.id));
  if (event.target.id === 'with-credit') $('#credit-fields').classList.toggle('d-none', !event.target.checked);
});
window.addEventListener('hashchange', async () => {
  if (!state.user) return;
  const view = location.hash.slice(1);
  const allowed = ['dashboard', 'fleet', 'requests', 'contracts', 'account', 'help', ...(isAgent() ? ['clients'] : [])];
  state.view = allowed.includes(view) ? view : 'dashboard'; state.query = ''; state.filter = ''; state.category = '';
  clearTimeout(searchTimer);
  try { await loadData(); if (!state.user) return; renderShell(); $('#main-content').focus({ preventScroll: true }); window.scrollTo(0, 0); }
  catch (error) { toast(error.message, true); }
});
async function boot() {
  if (!token) { renderAuth(); return; }
  try {
    state.user = await api('/auth/me');
    const view = location.hash.slice(1); state.view = ['dashboard','fleet','requests','contracts','account','help', ...(isAgent() ? ['clients'] : [])].includes(view) ? view : 'dashboard';
    await loadData(); renderShell();
  } catch (error) {
    token = null; state.user = null; sessionStorage.removeItem('velora.token'); renderAuth(); toast(error.message, true);
  }
}
boot();
