'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, scryptSync } = require('node:crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function makeSeed() {
  const now = new Date();
  const date = offset => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
    return d.toISOString().slice(0, 10);
  };
  const at = new Date().toISOString();
  const passwordHash = hashPassword('Demo@123');
  const users = [
    { id: 'client-ana', role: 'client', name: 'Ana Oliveira', email: 'cliente@velora.com', cpf: '52998224725', rg: 'MG-12.345.678', address: 'Rua dos Ipês, 145, Savassi, Belo Horizonte - MG', profession: 'Designer de produto', employers: [{ name: 'Estúdio Forma', income: 8200 }, { name: 'Projetos independentes', income: 2400 }], passwordHash, createdAt: at },
    { id: 'company-velora', role: 'company', name: 'Velora Mobilidade', email: 'empresa@velora.com', passwordHash, createdAt: at },
    { id: 'bank-horizonte', role: 'bank', name: 'Banco Horizonte', email: 'banco@velora.com', passwordHash, createdAt: at },
    { id: 'client-pedro', role: 'client', name: 'Pedro Santos', email: 'pedro@velora.com', cpf: '11144477735', rg: 'SP-45.678.901', address: 'Av. Afonso Pena, 900, Centro, Belo Horizonte - MG', profession: 'Engenheiro de software', employers: [{ name: 'Nexo Tecnologia', income: 12500 }], passwordHash, createdAt: at }
  ];
  const cars = [
    { id: 'car-kwid', registration: 'VEL-0001', year: 2025, brand: 'Renault', model: 'Kwid Zen', plate: 'RNT1A23', category: 'Econômico', transmission: 'Manual', fuel: 'Flex', seats: 5, dailyRate: 89, color: '#e8a842', ownerType: 'company', ownerId: 'company-velora' },
    { id: 'car-argo', registration: 'VEL-0002', year: 2025, brand: 'Fiat', model: 'Argo Drive', plate: 'FAT2B34', category: 'Compacto', transmission: 'Manual', fuel: 'Flex', seats: 5, dailyRate: 119, color: '#c13b43', ownerType: 'company', ownerId: 'company-velora' },
    { id: 'car-tcross', registration: 'VEL-0003', year: 2026, brand: 'Volkswagen', model: 'T-Cross Comfortline', plate: 'VWK3C45', category: 'SUV', transmission: 'Automático', fuel: 'Flex', seats: 5, dailyRate: 219, color: '#477a76', ownerType: 'company', ownerId: 'company-velora' },
    { id: 'car-compass', registration: 'VEL-0004', year: 2026, brand: 'Jeep', model: 'Compass Longitude', plate: 'JEP4D56', category: 'SUV', transmission: 'Automático', fuel: 'Flex', seats: 5, dailyRate: 289, color: '#616967', ownerType: 'company', ownerId: 'company-velora' },
    { id: 'car-corolla', registration: 'VEL-0005', year: 2025, brand: 'Toyota', model: 'Corolla XEi', plate: 'TYT5E67', category: 'Sedã', transmission: 'Automático', fuel: 'Flex', seats: 5, dailyRate: 249, color: '#b4bbc3', ownerType: 'bank', ownerId: 'bank-horizonte' },
    { id: 'car-bmw', registration: 'VEL-0006', year: 2026, brand: 'BMW', model: '320i Sport', plate: 'BMW6F78', category: 'Premium', transmission: 'Automático', fuel: 'Gasolina', seats: 5, dailyRate: 459, color: '#476982', ownerType: 'bank', ownerId: 'bank-horizonte' }
  ];
  const history = (action, actorName, note) => ({ at, action, actorName, note });
  const requests = [
    { id: 'PED-1001', clientId: 'client-ana', carId: 'car-tcross', startDate: date(7), endDate: date(12), days: 5, total: 1095, status: 'pending', notes: 'Viagem em família. Retirada pela manhã.', creditRequested: false, createdAt: at, updatedAt: at, history: [history('created', 'Ana Oliveira', 'Pedido enviado para análise financeira.')] },
    { id: 'PED-1002', clientId: 'client-ana', carId: 'car-corolla', startDate: date(16), endDate: date(21), days: 5, total: 1245, status: 'approved', notes: 'Compromissos profissionais.', creditRequested: true, createdAt: at, updatedAt: at, history: [history('created', 'Ana Oliveira', 'Pedido enviado para análise financeira.'), history('approved', 'Banco Horizonte', 'Renda compatível com o valor do aluguel. Parecer favorável.')] },
    { id: 'PED-1003', clientId: 'client-ana', carId: 'car-argo', startDate: date(25), endDate: date(28), days: 3, total: 357, status: 'contracted', notes: 'Fim de semana prolongado.', creditRequested: false, createdAt: at, updatedAt: at, history: [history('created', 'Ana Oliveira', 'Pedido enviado para análise financeira.'), history('approved', 'Velora Mobilidade', 'Documentação e renda verificadas.'), history('contracted', 'Velora Mobilidade', 'Contrato emitido com propriedade da empresa.')] },
    { id: 'PED-1004', clientId: 'client-ana', carId: 'car-kwid', startDate: date(32), endDate: date(34), days: 2, total: 178, status: 'cancelled', notes: '', creditRequested: false, createdAt: at, updatedAt: at, history: [history('created', 'Ana Oliveira', 'Pedido enviado para análise financeira.'), history('cancelled', 'Ana Oliveira', 'Pedido cancelado pelo cliente.')] }
  ];
  const contracts = [{ id: 'CTR-1001', requestId: 'PED-1003', clientId: 'client-ana', carId: 'car-argo', startDate: date(25), endDate: date(28), days: 3, total: 357, ownerType: 'company', ownerId: 'company-velora', credit: null, createdAt: at, status: 'active' }];
  return { users, cars, requests, contracts };
}

if (require.main === module) {
  if (!process.argv.includes('--reset')) {
    console.error('Para substituir os dados locais por exemplos, execute: npm run reset');
    process.exitCode = 1;
  } else {
    const target = path.join(__dirname, '..', 'db.json');
    if (fs.existsSync(target)) {
      const backup = `${target}.backup-${Date.now()}`;
      fs.copyFileSync(target, backup);
      console.log(`Backup dos dados anteriores: ${path.basename(backup)}`);
    }
    fs.writeFileSync(target, JSON.stringify(makeSeed(), null, 2) + '\n');
    console.log('Dados de demonstração restaurados. Reinicie o servidor para encerrar sessões antigas.');
  }
}

module.exports = { makeSeed, hashPassword };
