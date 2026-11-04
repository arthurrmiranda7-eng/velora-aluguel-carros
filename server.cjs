'use strict';

// JSON Server provides the HTTP application and the lowdb JSON persistence.
// Domain routes keep authorization, validation and related writes together.
const jsonServer = require('json-server');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, timingSafeEqual, scryptSync } = require('node:crypto');
const { makeSeed, hashPassword } = require('./scripts/seed.cjs');

const ROOT = __dirname;
const AGENT_ROLES = ['company', 'bank'];
const SESSION_DURATION = 8 * 60 * 60 * 1000;
const NOW = () => new Date().toISOString();
const publicUser = ({ passwordHash, ...user }) => user;
const id = prefix => `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`;
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const text = (value, label, max = 200, required = true) => {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > max) {
    fail(400, `${label}: informe ${required ? 'um valor' : 'um texto'} de até ${max} caracteres.`);
  }
  return value.trim();
};

function validCpf(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let n = 0; n < size; n++) sum += Number(value[n]) * (size + 1 - n);
    const digit = (sum * 10 % 11) % 10;
    if (digit !== Number(value[size])) return false;
  }
  return true;
}

function clientData(body, current = {}) {
  const merged = { ...current, ...body };
  const name = text(merged.name, 'Nome', 120);
  const email = text(merged.email, 'E-mail', 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Informe um e-mail válido.');
  const cpf = String(merged.cpf ?? '').replace(/[.\-\s]/g, '');
  if (!validCpf(cpf)) fail(400, 'Informe um CPF válido, incluindo os dígitos verificadores.');
  const rg = text(merged.rg, 'RG', 30);
  const address = text(merged.address, 'Endereço', 300);
  const profession = text(merged.profession, 'Profissão', 120);
  if (!Array.isArray(merged.employers) || merged.employers.length > 3) fail(400, 'Informe no máximo três fontes de renda.');
  const employers = merged.employers.map(employer => {
    if (!employer || typeof employer !== 'object') fail(400, 'Fonte de renda inválida.');
    const employerName = text(employer.name, 'Entidade empregadora', 120);
    const income = Number(employer.income);
    if (!Number.isFinite(income) || income <= 0 || income > 10000000) fail(400, 'O rendimento mensal deve ser maior que zero e até R$ 10.000.000.');
    return { name: employerName, income: Math.round(income * 100) / 100 };
  });
  return { name, email, cpf, rg, address, profession, employers };
}

function passwordValue(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) fail(400, 'A senha deve ter entre 8 e 128 caracteres.');
  return password;
}

function passwordMatches(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected) return false;
  const candidate = scryptSync(password, salt, 64);
  const buffer = Buffer.from(expected, 'hex');
  return buffer.length === candidate.length && timingSafeEqual(candidate, buffer);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function requestData(body, state, current = {}) {
  const merged = { ...current, ...body };
  const car = state.cars.find(car => car.id === merged.carId);
  if (!car) fail(400, 'Selecione um veículo existente.');
  if (!validDate(merged.startDate) || !validDate(merged.endDate)) fail(400, 'Informe datas válidas no formato AAAA-MM-DD.');
  const today = new Date().toISOString().slice(0, 10);
  if (merged.startDate < today) fail(400, 'A retirada deve ser hoje ou em uma data futura.');
  const days = Math.round((Date.parse(merged.endDate) - Date.parse(merged.startDate)) / 86400000);
  if (days < 1 || days > 365) fail(400, 'O aluguel deve durar de 1 a 365 diárias.');
  if (typeof merged.creditRequested !== 'boolean') fail(400, 'Informe se deseja crédito.');
  const notes = text(merged.notes ?? '', 'Observações', 2000, false);
  const total = Math.round(days * car.dailyRate * 100) / 100;
  return { carId: car.id, startDate: merged.startDate, endDate: merged.endDate, days, total, notes, creditRequested: merged.creditRequested };
}

function ensureAvailable(state, request) {
  const conflict = state.requests.some(other => other.id !== request.id && other.carId === request.carId && ['approved', 'contracted'].includes(other.status) && request.startDate < other.endDate && request.endDate > other.startDate);
  if (conflict) fail(409, 'O veículo já possui uma reserva aprovada ou contratada nesse período. Escolha outras datas ou outro veículo.');
}

function createApp(options = {}) {
  const dbFile = options.dbFile || process.env.DB_FILE || path.join(ROOT, 'db.json');
  if (!fs.existsSync(dbFile)) {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(makeSeed(), null, 2) + '\n');
  }
  const app = jsonServer.create();
  const router = jsonServer.router(dbFile);
  const db = router.db;
  const sessions = new Map();
  const attempts = new Map();
  app.db = db;
  app.sessions = sessions;
  app.set('x-powered-by', false);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(jsonServer.defaults({ static: path.join(ROOT, 'public'), logger: false, noCors: true }));
  app.get('/vendor/bootstrap.min.css', (_, res) => res.sendFile(path.join(ROOT, 'node_modules/bootstrap/dist/css/bootstrap.min.css')));
  app.get('/vendor/bootstrap.bundle.min.js', (_, res) => res.sendFile(path.join(ROOT, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js')));
  app.use('/api', jsonServer.bodyParser);
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ error: 'Corpo JSON inválido.' });
    next();
  });
  const route = handler => (req, res, next) => { try { handler(req, res); } catch (error) { next(error); } };
  const state = () => db.getState();
  const mutate = callback => {
    const draft = structuredClone(state());
    const result = callback(draft);
    db.setState(draft).write();
    return result;
  };
  const uniqueClient = (draft, data, except) => {
    if (draft.users.some(user => user.id !== except && user.email === data.email)) fail(409, 'Este e-mail já está cadastrado.');
    if (draft.users.some(user => user.id !== except && user.cpf === data.cpf)) fail(409, 'Este CPF já está cadastrado.');
  };
  const agent = user => { if (!AGENT_ROLES.includes(user.role)) fail(403, 'Esta ação é exclusiva de empresas e bancos agentes.'); };
  const issueSession = user => {
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_DURATION });
    return { token, user: publicUser(user) };
  };
  const history = (request, user, action, note) => {
    request.updatedAt = NOW();
    request.history.push({ at: request.updatedAt, action, actorName: user.name, note });
  };
  const findRequest = (draft, req) => {
    const request = draft.requests.find(item => item.id === req.params.id);
    if (!request || (req.user.role === 'client' && request.clientId !== req.user.id)) fail(404, 'Pedido não encontrado.');
    return request;
  };

  app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'Velora • JSON Server' }));
  app.post('/api/auth/register', route((req, res) => {
    const data = clientData(req.body);
    const passwordHash = hashPassword(passwordValue(req.body.password));
    const user = mutate(draft => {
      uniqueClient(draft, data);
      const user = { id: id('CLI'), role: 'client', ...data, passwordHash, createdAt: NOW() };
      draft.users.push(user);
      return user;
    });
    res.status(201).json(issueSession(user));
  }));
  app.post('/api/auth/login', route((req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const key = `${req.ip}:${email}`;
    const attempt = attempts.get(key);
    if (attempt && attempt.count >= 12 && attempt.until > Date.now()) fail(429, 'Muitas tentativas. Aguarde 5 minutos para tentar novamente.');
    const user = state().users.find(user => user.email === email);
    if (!user || !passwordMatches(req.body.password, user.passwordHash)) {
      const record = attempt && attempt.until > Date.now() ? attempt : { count: 0, until: Date.now() + 300000 };
      record.count++;
      attempts.set(key, record);
      fail(401, 'E-mail ou senha inválidos.');
    }
    attempts.delete(key);
    res.json(issueSession(user));
  }));

  app.use('/api', (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now()) {
      if (session) sessions.delete(token);
      return res.status(401).json({ error: 'Sua sessão expirou. Entre novamente.' });
    }
    const user = state().users.find(user => user.id === session.userId);
    if (!user) { sessions.delete(token); return res.status(401).json({ error: 'Conta não encontrada. Entre novamente.' }); }
    req.user = user;
    req.token = token;
    next();
  });
  app.get('/api/auth/me', (req, res) => res.json(publicUser(req.user)));
  app.post('/api/auth/logout', (req, res) => { sessions.delete(req.token); res.json({ success: true }); });
  app.get('/api/cars', (_, res) => res.json(state().cars));
  app.get('/api/agents', (_, res) => res.json(state().users.filter(user => AGENT_ROLES.includes(user.role)).map(({ id, name, role }) => ({ id, name, role }))));
  app.get('/api/users', (_, res) => res.json(state().users.filter(user => AGENT_ROLES.includes(user.role)).map(({ id, name, role }) => ({ id, name, role }))));

  app.get('/api/clients', (req, res) => res.json(state().users.filter(user => user.role === 'client' && (req.user.role !== 'client' || user.id === req.user.id)).map(publicUser)));
  app.get('/api/clients/:id', route((req, res) => {
    const user = state().users.find(user => user.id === req.params.id && user.role === 'client');
    if (!user || (req.user.role === 'client' && user.id !== req.user.id)) fail(404, 'Cliente não encontrado.');
    res.json(publicUser(user));
  }));
  app.post('/api/clients', route((req, res) => {
    agent(req.user);
    const data = clientData(req.body);
    const passwordHash = hashPassword(passwordValue(req.body.password));
    const user = mutate(draft => {
      uniqueClient(draft, data);
      const user = { id: id('CLI'), role: 'client', ...data, passwordHash, createdAt: NOW() };
      draft.users.push(user);
      return user;
    });
    res.status(201).json(publicUser(user));
  }));
  app.patch('/api/clients/:id', route((req, res) => {
    if (req.user.role === 'client' && req.params.id !== req.user.id) fail(403, 'Você pode alterar somente seu próprio cadastro.');
    const user = mutate(draft => {
      const current = draft.users.find(user => user.id === req.params.id && user.role === 'client');
      if (!current) fail(404, 'Cliente não encontrado.');
      const data = clientData(req.body, current);
      uniqueClient(draft, data, current.id);
      Object.assign(current, data, { updatedAt: NOW() });
      if (req.body.password !== undefined && req.body.password !== '') current.passwordHash = hashPassword(passwordValue(req.body.password));
      return current;
    });
    if (req.body.password) for (const [token, session] of sessions) if (session.userId === user.id && token !== req.token) sessions.delete(token);
    res.json(publicUser(user));
  }));
  app.delete('/api/clients/:id', route((req, res) => {
    if (req.user.role === 'client' && req.params.id !== req.user.id) fail(403, 'Você pode excluir somente seu próprio cadastro.');
    mutate(draft => {
      const current = draft.users.find(user => user.id === req.params.id && user.role === 'client');
      if (!current) fail(404, 'Cliente não encontrado.');
      if (draft.requests.some(request => request.clientId === current.id) || draft.contracts.some(contract => contract.clientId === current.id) || draft.cars.some(car => car.ownerType === 'client' && car.ownerId === current.id)) fail(409, 'Este cliente possui pedidos, contratos ou um veículo registrado. O cadastro é preservado para manter o histórico.');
      draft.users = draft.users.filter(user => user.id !== current.id);
    });
    for (const [token, session] of sessions) if (session.userId === req.params.id) sessions.delete(token);
    res.status(204).end();
  }));

  app.get('/api/requests', (req, res) => res.json(state().requests.filter(request => req.user.role !== 'client' || request.clientId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  app.get('/api/requests/:id', route((req, res) => res.json(findRequest(state(), req))));
  app.post('/api/requests', route((req, res) => {
    if (req.user.role !== 'client') fail(403, 'Somente clientes podem criar pedidos de aluguel.');
    const result = mutate(draft => {
      const data = requestData(req.body, draft);
      ensureAvailable(draft, data);
      const request = { id: id('PED'), clientId: req.user.id, ...data, status: 'pending', createdAt: NOW(), updatedAt: NOW(), history: [] };
      history(request, req.user, 'created', 'Pedido enviado para análise financeira.');
      draft.requests.push(request);
      return request;
    });
    res.status(201).json(result);
  }));
  app.patch('/api/requests/:id', route((req, res) => {
    const result = mutate(draft => {
      const request = findRequest(draft, req);
      const allowed = req.user.role === 'client' ? ['pending', 'rejected'] : ['pending', 'approved', 'rejected'];
      if (!allowed.includes(request.status)) fail(409, 'Este pedido não pode ser alterado na situação atual.');
      const data = requestData(req.body, draft, request);
      ensureAvailable(draft, { ...request, ...data });
      Object.assign(request, data, { status: 'pending' });
      history(request, req.user, 'updated', 'Pedido atualizado e reenviado para análise financeira.');
      return request;
    });
    res.json(result);
  }));
  app.post('/api/requests/:id/cancel', route((req, res) => {
    if (req.user.role !== 'client') fail(403, 'O cancelamento é feito pelo cliente responsável pelo pedido.');
    const result = mutate(draft => {
      const request = findRequest(draft, req);
      if (!['pending', 'approved'].includes(request.status)) fail(409, 'Somente pedidos em análise ou aprovados podem ser cancelados.');
      request.status = 'cancelled';
      history(request, req.user, 'cancelled', 'Pedido cancelado pelo cliente.');
      return request;
    });
    res.json(result);
  }));
  app.post('/api/requests/:id/review', route((req, res) => {
    agent(req.user);
    const decision = req.body.decision;
    if (!['approved', 'rejected'].includes(decision)) fail(400, 'O parecer deve aprovar ou reprovar o pedido.');
    const notes = text(req.body.notes, 'Justificativa do parecer', 2000);
    const result = mutate(draft => {
      const request = findRequest(draft, req);
      if (request.status !== 'pending') fail(409, 'Somente pedidos em análise podem receber um parecer.');
      if (request.startDate < new Date().toISOString().slice(0, 10)) fail(409, 'A data de retirada já passou. Atualize o pedido antes de avaliá-lo.');
      if (decision === 'approved') ensureAvailable(draft, request);
      request.status = decision;
      history(request, req.user, decision, notes);
      return request;
    });
    res.json(result);
  }));
  app.post('/api/requests/:id/contract', route((req, res) => {
    agent(req.user);
    const result = mutate(draft => {
      const request = findRequest(draft, req);
      if (request.status !== 'approved') fail(409, 'Apenas pedidos aprovados podem gerar um contrato.');
      if (request.startDate < new Date().toISOString().slice(0, 10)) fail(409, 'A data de retirada já passou. Atualize o pedido antes de contratar.');
      ensureAvailable(draft, request);
      const ownerType = req.body.ownerType;
      const ownerId = req.body.ownerId;
      if (!['client', 'company', 'bank'].includes(ownerType)) fail(400, 'Selecione o tipo de proprietário.');
      const owner = draft.users.find(user => user.id === ownerId && user.role === ownerType);
      if (!owner || (ownerType === 'client' && owner.id !== request.clientId)) fail(400, 'Proprietário inválido para este contrato.');
      let credit = null;
      if (req.body.credit != null) {
        if (req.user.role !== 'bank') fail(403, 'Somente um banco agente pode conceder o crédito.');
        const bankId = req.body.credit.bankId;
        if (bankId !== req.user.id) fail(403, 'O banco só pode conceder crédito em seu próprio nome.');
        const installments = Number(req.body.credit.installments);
        const interestRate = Number(req.body.credit.interestRate);
        if (!Number.isInteger(installments) || installments < 1 || installments > 60) fail(400, 'O crédito deve ter de 1 a 60 parcelas.');
        if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 20) fail(400, 'A taxa mensal deve estar entre 0% e 20%.');
        // Fixed-payment amortization (Price). Rate is a percentage per month.
        const rate = interestRate / 100;
        const installmentAmount = Math.round((rate === 0 ? request.total / installments : request.total * rate / (1 - Math.pow(1 + rate, -installments))) * 100) / 100;
        credit = { id: id('CRD'), bankId, principal: request.total, installments, interestRate, installmentAmount, totalFinanced: Math.round(installmentAmount * installments * 100) / 100 };
      }
      if (request.creditRequested && !credit) fail(400, 'Este pedido solicita crédito. Um banco deve emitir o contrato com os dados do financiamento.');
      const contract = { id: id('CTR'), requestId: request.id, clientId: request.clientId, carId: request.carId, startDate: request.startDate, endDate: request.endDate, days: request.days, total: request.total, ownerType, ownerId, credit, createdAt: NOW(), status: 'active' };
      draft.contracts.push(contract);
      request.status = 'contracted';
      history(request, req.user, 'contracted', `Contrato ${contract.id} emitido${credit ? ' com crédito bancário' : ''}.`);
      const car = draft.cars.find(car => car.id === request.carId);
      car.ownerType = ownerType;
      car.ownerId = ownerId;
      return contract;
    });
    res.status(201).json(result);
  }));
  app.get('/api/contracts', (req, res) => res.json(state().contracts.filter(contract => req.user.role !== 'client' || contract.clientId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  app.get('/api/contracts/:id', route((req, res) => {
    const contract = state().contracts.find(contract => contract.id === req.params.id);
    if (!contract || (req.user.role === 'client' && contract.clientId !== req.user.id)) fail(404, 'Contrato não encontrado.');
    res.json(contract);
  }));
  app.use('/api', (_, res) => res.status(404).json({ error: 'Recurso da API não encontrado.' }));
  app.use((_, res) => res.status(404).send('Página não encontrada. Acesse a página inicial em /.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('Erro interno na API:', error.message);
    res.status(status).json({ error: status >= 500 ? 'Não foi possível concluir a operação. Tente novamente.' : error.message });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser uma porta válida.');
  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\nVelora pronta em http://localhost:${port}\nAPI REST e persistência: JSON Server\nContas de demonstração e instruções: README.md\n`);
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`A porta ${port} já está em uso. Encerre o processo anterior ou execute com outra PORT.`);
    else console.error('Falha ao iniciar:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApp, validCpf, requestData, passwordMatches };
