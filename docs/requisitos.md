# Requisitos, histórias e rastreabilidade

## Escopo e atores

O enunciado do LAB02 exige um sistema de aluguel acessível após cadastro prévio. O **cliente** gerencia os próprios pedidos. Os **agentes** (empresa e banco) avaliam e podem modificar pedidos. Um **banco** também pode conceder crédito associado ao aluguel. A conta de agente é fornecida no banco de demonstração; o cadastro público cria clientes.

## Histórias do usuário e critérios de aceitação

| ID | História | Critérios de aceitação |
| --- | --- | --- |
| HU01 | Como visitante, quero me cadastrar para utilizar o sistema. | Nome, e-mail, senha e identificação obrigatórios; CPF válido e único; cadastro cria perfil cliente; dados persistem. |
| HU02 | Como usuário, quero entrar e sair da conta para acessar as minhas funções. | Credenciais corretas criam sessão; credenciais inválidas são recusadas; sair invalida a sessão; API protegida retorna 401 sem sessão. |
| HU03 | Como cliente, quero consultar e atualizar meu cadastro. | RG, CPF, nome, endereço, profissão e rendas são consultáveis/editáveis; cliente não altera o papel; outro cliente não acessa o cadastro. |
| HU04 | Como contratante, quero informar empregadores e rendimentos. | Até três pares nome/renda; renda positiva e nome preenchido; quarto vínculo é recusado no servidor. |
| HU05 | Como agente, quero criar, consultar, editar e excluir clientes. | Operações persistem no JSON; resposta não inclui hash de senha; exclusão com pedidos/contratos é recusada para preservar referências. |
| HU06 | Como cliente, quero consultar os automóveis para escolher um aluguel. | Cada carro informa matrícula, ano, marca, modelo e placa; também exibe diária e características de apoio. |
| HU07 | Como cliente, quero criar um pedido para um período. | Carro existente; retirada hoje ou futura e devolução posterior; total calculado no servidor; pedido inicia como `pending`; registro aparece na conta. |
| HU08 | Como cliente, quero acompanhar meus pedidos e seus status. | Lista contém apenas pedidos próprios; detalhe apresenta veículo, período, total e histórico; novo login mantém os pedidos. |
| HU09 | Como cliente, quero modificar um pedido antes da contratação. | Pedido `pending` ou `rejected` aceita edição; reenvio volta para `pending`; total recalculado; estado contratado impede edição. |
| HU10 | Como cliente, quero cancelar um pedido. | Somente pedido próprio `pending` ou `approved`; estado passa para `cancelled`; operação fica no histórico e não remove o registro. |
| HU11 | Como agente, quero modificar pedidos para corrigir os dados. | Pedido não pode estar cancelado/contratado; edição exige nova avaliação; autoria fica registrada. |
| HU12 | Como agente, quero analisar financeiramente um pedido. | Exibe cadastro/rendas para análise; parecer obrigatório; `pending` pode passar a `approved` ou `rejected`; cliente não pode emitir parecer. |
| HU13 | Como agente, quero executar um contrato após aprovação. | Apenas `approved`; conflito de período revalidado; contrato criado uma vez; pedido passa para `contracted`. |
| HU14 | Como agente, quero indicar a titularidade do automóvel no contrato. | Tipo `client`, `company` ou `bank`; proprietário deve existir e ser compatível; contrato registra a titularidade. |
| HU15 | Como banco, quero associar crédito ao contrato. | Crédito opcional com número de parcelas e juros validados; banco concedente é o banco autenticado; empresa/cliente não concedem crédito. |
| HU16 | Como usuário, quero receber retorno de validação. | Campos inválidos e acesso negado produzem mensagens; falha de rede não deve ser exibida como sucesso. |

## Matriz de rastreabilidade do enunciado

| Requisito do PDF | Histórias | Modelo final | Implementação e verificação |
| --- | --- | --- | --- |
| Cadastro prévio obrigatório | HU01–HU03 | Usuário, Cliente; casos de uso de autenticação | `/api/auth/*`; tela de acesso; API bloqueia sessão ausente |
| CRUD de cliente | HU03–HU05 | Cliente + Renda | `/api/clients`; cadastro público e área de clientes/perfil |
| RG, CPF, nome, endereço, profissão | HU01, HU03 | Atributos de Cliente | `users` e validação de entrada |
| Até 3 empregadores e rendimentos | HU04 | Composição Cliente–Renda 0..3 | `employers`; validação no servidor |
| Cliente introduz/consulta/modifica/cancela pedidos | HU07–HU10 | Cliente → Pedido; estados | `/api/requests`; ações do cliente |
| Empresa e banco modificam/avaliam | HU11–HU12 | Agente, Empresa, Banco, Parecer | API por papel; ações de análise/edição |
| Parecer positivo precede contrato | HU12–HU13 | Pedido 0..1 Contrato | `/review`, `/contract`; máquina de estados |
| Propriedade de cliente/empresa/banco | HU14 | Titular no Contrato e Automóvel | `ownerType` e `ownerId`, validação de referência |
| Matrícula, ano, marca, modelo e placa | HU06 | Automóvel | `cars` e catálogo |
| Contrato de crédito por banco agente | HU15 | Contrato compõe Crédito; Banco concede | `contracts.credit`; banco emissor autorizado |
| Servidor central e clientes pela rede | HU02, HU16 | Componentes | navegador → Fetch HTTP → Node/JSON Server |
| Dois subsistemas | Todas | Pacotes e componentes | `public/` versus `server.cjs`/JSON Server |
| HTML, CSS, JS, Bootstrap 5, Fetch, JSON Server | Todas | Componentes | arquivos frontend, API e `db.json` |
| Casos de uso, histórias, classes, pacotes, componentes | Todas | `modelos/v1` e `modelos/v2` | fontes PlantUML, imagens finais, este documento |
| Revisão de modelos e comparação na apresentação | Todas | Registro de revisão | `modelos/REVISOES.md`, `apresentacao.md` |
| README do template | — | — | README adaptado; original incluído |
| GitHub atualizado com código e versões | — | — | Pacote pronto para publicar; exige push na conta do aluno |

## Regras complementares adotadas

1. Diárias calculadas pela diferença entre datas, com devolução exclusiva.
2. Alterar um pedido invalida a aprovação e exige nova análise.
3. Reservas aprovadas ou contratadas bloqueiam o mesmo carro em períodos sobrepostos; pedidos pendentes ainda podem concorrer.
4. Cancelamento é uma mudança de estado, não exclusão física.
5. Um pedido gera no máximo um contrato; após contrato, o pedido fica imutável.
6. A exclusão de cliente com histórico de pedidos/contratos retorna conflito.
7. CPF e e-mail identificam contas únicas. CPF com apenas dígitos repetidos ou verificadores incorretos é recusado.
8. Valores de orçamento são calculados no servidor, não confiados ao JSON enviado pelo navegador.

## Critério de conclusão acadêmica

Apresentar o fluxo executável, explicar a correspondência com os diagramas e mostrar as alterações de v1 para v2. O aluno deve preencher autoria e publicar o repositório; feedback de sala e versões previamente produzidas pelo aluno devem ser adicionados quando existirem, sem serem substituídos por um histórico fictício.
