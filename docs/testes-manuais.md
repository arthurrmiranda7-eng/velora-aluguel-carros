# Roteiro de testes manuais

Inicie com `npm install` e `npm start`, abra `http://localhost:3000` e use um navegador atualizado. Os perfis fictícios usam a senha `Demo@123`. Crie períodos futuros, evitando reservas já aprovadas no mesmo automóvel. Cada teste descreve o resultado esperado; marque o resultado observado durante a validação.

| ID | Ação | Resultado esperado |
| --- | --- | --- |
| TM01 | Abrir o sistema sem login e tentar chamar `/api/requests` sem bearer | Tela de acesso; API responde 401 |
| TM02 | Entrar com senha incorreta | Mensagem de erro; nenhum acesso concedido |
| TM03 | Cadastrar cliente fictício com dados completos | Sessão criada, cadastro persistido e catálogo disponível |
| TM04 | Cadastrar e-mail/CPF duplicado ou CPF inválido | Operação recusada com mensagem; banco não duplica conta |
| TM05 | Informar até três empregadores com renda positiva | Cadastro aceito, rendas recuperadas na consulta |
| TM06 | Enviar quatro empregadores ou renda negativa pela API | Servidor recusa; não basta contornar a interface |
| TM07 | Editar endereço/profissão no perfil e recarregar | Novos valores permanecem |
| TM08 | Entrar como empresa e criar/editar cliente na área de clientes | CRUD visível e persistente; conta criada pode entrar |
| TM09 | Excluir cliente novo sem pedidos | Cliente removido e login deixa de funcionar |
| TM10 | Excluir cliente com pedido/contrato | 409; histórico preservado |
| TM11 | Criar pedido para três dias em carro disponível | Estado pendente, três diárias, total igual a diária × 3 |
| TM12 | Informar devolução igual/anterior à retirada ou data inválida | Pedido não é gravado |
| TM13 | Editar pedido pendente | Veículo/período/total atualizados, histórico registrado |
| TM14 | Cancelar um pedido pendente próprio | Estado cancelado; registro continua consultável |
| TM15 | Com outro cliente, tentar ler/alterar o pedido anterior | API bloqueia acesso; lista não expõe o pedido |
| TM16 | Entrar como empresa e avaliar pedido pendente com justificativa | Estado aprovado ou recusado; parecer no histórico |
| TM17 | Tentar aprovar como cliente ou sem justificativa | 403 ou erro de validação; estado inalterado |
| TM18 | Corrigir pedido recusado | Volta a pendente para nova análise |
| TM19 | Agente modificar pedido aprovado | Aprovação invalidada; contrato exige nova aprovação |
| TM20 | Executar contrato em pedido ainda pendente | Operação recusada |
| TM21 | Executar contrato sem crédito em pedido aprovado | Contrato vinculado e pedido contratado |
| TM22 | Tentar editar/cancelar pedido contratado ou contratar novamente | Operação recusada; único contrato preservado |
| TM23 | Criar pedidos pendentes sobrepostos para o mesmo carro e aprovar um | Segundo parecer favorável é bloqueado por conflito |
| TM24 | Criar período que inicia no dia de devolução de reserva anterior | Sem conflito, pois a devolução é exclusiva |
| TM25 | Banco executar contrato com crédito, parcelas e juros | Crédito vinculado ao próprio banco e contrato |
| TM26 | Empresa enviar crédito ou banco indicar outro banco concedente | Operação recusada |
| TM27 | Informar proprietário inexistente ou tipo incompatível | Contrato recusado sem gravação parcial |
| TM28 | Sair e tentar reutilizar token antigo | Sessão invalidada; API responde 401 |
| TM29 | Reiniciar servidor e entrar de novo | Cadastros/pedidos persistem em `db.json`; novo login necessário |
| TM30 | Testar em largura de 375 px e navegar por teclado | Conteúdo utilizável, formulários legíveis e controles acessíveis |
| TM31 | Parar a API durante uma gravação | Interface informa falha; não apresenta sucesso fictício |

## Registro de execução

Anote data, versão do navegador, cenário, resultado observado e evidência. Diferencie testes automatizados de API de testes visuais do navegador. Não marque todos os cenários como aprovados sem executá-los.

## Preparação de dados

Para CPF de teste, use valores fictícios que passem pelos dígitos verificadores; evite informações de pessoas reais. A base já utiliza `52998224725` e `11144477735`; use outro valor válido para um cadastro novo. Não interprete a validação matemática como consulta à Receita Federal.

Faça backup do `db.json` antes de restaurar os dados. A restauração elimina as alterações feitas durante a demonstração. Os testes automatizados devem usar arquivo temporário e não o banco da apresentação.
