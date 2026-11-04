# Arquitetura da Velora

## Contexto e subsistemas

O navegador do cliente e os navegadores dos agentes se comunicam por HTTP com um servidor central Node.js. A execução local usa `localhost`; a topologia lógica corresponde ao acesso pela Internet descrito no enunciado, sem alegar que este pacote já esteja hospedado.

1. **Construção dinâmica de páginas:** HTML5 semântico, Bootstrap 5, CSS3 e JavaScript. O estado de navegação decide quais elementos são apresentados. A Fetch API envia e recebe JSON.
2. **Gestão de pedidos e contratos:** autenticação, autorização, validação de clientes, catálogo, pedidos, análise financeira e contratação. O JSON Server fornece a infraestrutura de persistência baseada em Lowdb e `db.json`.

A distribuição física fica simples: o mesmo processo entrega a interface e a API. A separação lógica permite mudar a interface sem duplicar regras financeiras no navegador.

## Mapeamento entre modelo e código

| Elemento conceitual | Representação implementada |
| --- | --- |
| Usuário e Cliente | Documento de `users`, com `role=client`; campos identificadores e profissionais |
| Agente | Documento de `users`, com `role=company` ou `role=bank` |
| Entidade empregadora / rendimento | Até três objetos em `user.employers` |
| Automóvel | Documento de `cars` |
| Pedido de aluguel | Documento de `requests`; referência ao cliente e ao carro |
| Parecer / evento | Registro de revisão e histórico dentro do pedido |
| Contrato de aluguel | Documento de `contracts` associado ao pedido aprovado |
| Contrato de crédito | Objeto opcional de crédito no contrato, vinculado ao banco concedente |
| Construção de páginas | Arquivos de `public/` e chamadas Fetch |
| Serviços e persistência | Rotas e regras de `server.cjs`, JSON Server/Lowdb, `db.json` |

Os diagramas de classes descrevem o domínio, sem afirmar que existam arquivos JavaScript com uma classe por entidade. A herança conceitual de Cliente/Agente é implementada pelo discriminador `role`; a composição de rendas e crédito é implementada como objetos aninhados.

## Fluxo de dados

Uma ação de formulário gera JSON. O servidor identifica a sessão, verifica o papel e o proprietário do recurso, valida os campos e aplica a transição. Depois persiste o documento e retorna a representação atualizada. A interface recarrega o recurso para refletir o estado confirmado.

Valores de diária, quantidade de dias e total são calculados no servidor. O período usa **retirada inclusiva e devolução exclusiva**: 10/12 a 13/12 corresponde a três diárias; devolver um veículo no dia da próxima retirada permite reservas adjacentes. A aprovação/contratação verifica conflito com pedidos aprovados ou contratados.

## Decisões e justificativas

- **Tecnologias do enunciado:** evita substituir JSON Server por outro banco ou Bootstrap por outro framework.
- **Mesma origem:** reduz configuração e permite iniciar o projeto com um comando.
- **Autorização no servidor:** esconder um botão não impede uma chamada HTTP indevida; a API decide o acesso.
- **Cadastro público de cliente:** uma pessoa não escolhe privilégios de banco/empresa ao criar uma conta. Os agentes fictícios são pré-cadastrados para a demonstração.
- **Pedido aprovado antes de contrato:** a separação preserva a análise financeira exigida.
- **Alteração invalida a análise anterior:** editar valor, carro ou período exige uma nova avaliação.
- **Histórico:** registra autoria e momento das alterações para facilitar acompanhamento e apresentação.
- **Arquivos locais:** a interface não depende de CDN durante o uso depois da instalação.

## Limites conhecidos

O JSON Server é uma API de prototipação, não uma infraestrutura bancária. As sessões são locais ao processo e podem exigir novo login após reinício; o banco JSON persiste. Não há recuperação de senha por e-mail, cobrança, avaliação real de crédito, assinatura eletrônica, LGPD operacional ou integração com bancos. A concessão de crédito registra condições demonstrativas; não transfere dinheiro. Contratos não possuem validade jurídica presumida.

O arquivo JSON não oferece transações distribuídas nem escalabilidade para concorrência de produção. Para uso real seriam necessários banco transacional, controles operacionais, HTTPS, recuperação de contas, observabilidade, cópias de segurança e revisão jurídica. Esses itens são limites do protótipo e não foram apresentados como funcionalidades concluídas.

## Modelagem e revisão

As fontes PlantUML em `modelos/v1` registram a interpretação inicial. `modelos/v2` inclui perfis, rendas compostas, crédito opcional, estados e componentes de autorização/persistência alinhados à solução. O arquivo `modelos/REVISOES.md` explica cada mudança. Diagramas não fornecidos pelo aluno/professor não foram reconstruídos como se fossem históricos reais.
