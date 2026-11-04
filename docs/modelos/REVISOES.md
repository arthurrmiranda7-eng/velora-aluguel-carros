# Registro de revisão dos modelos

As duas versões foram preparadas como iterações desta solução. **Não representam modelos entregues anteriormente em aula nem feedback real do professor**, pois esses materiais não foram fornecidos. O aluno pode acrescentar seu histórico autêntico preservando as versões.

| Modelo | v1: interpretação inicial | v2: refinamento alinhado ao código | Motivo |
| --- | --- | --- | --- |
| Casos de uso | Cliente cadastra/solicita; agente avalia/contrata | Login, CRUD, edição/cancelamento, consulta de status, propriedade e crédito; Banco especializa Agente | Cobrir todos os papéis e operações do PDF |
| Classes | Cliente, Automóvel, Pedido, Contrato, Agente | Usuário com papéis, renda composta 0..3, histórico/parecer e crédito opcional concedido por Banco | Representar atributos e relações persistidos |
| Pacotes | Interface, domínio, persistência | Dois subsistemas explícitos; apresentação usa API autenticada; gestão compõe autenticação, cadastro, frota, pedidos, contratos e persistência | Mostrar divisão sugerida no enunciado e dependências reais |
| Componentes | Navegador → servidor → JSON | Bootstrap local, JavaScript/Fetch, arquivos estáticos, middlewares de sessão/regras, JSON Server/Lowdb e `db.json` | Correspondência concreta com a execução |
| Estados | Implícitos em Pedido | Diagrama adicional com pendente, aprovado, recusado, cancelado e contratado | Impedir contratação sem análise e explicitar reenvio |

## Convenções de implementação

- A especialização conceitual de Usuário em Cliente/Agente é representada em `users.role`, sem duplicar contas.
- Rendas ficam em `employers` e o crédito no objeto `contract.credit`.
- Pareceres e ações ficam no histórico do pedido; não existe uma coleção independente de pareceres.
- O proprietário é uma referência discriminada por `ownerType` e `ownerId`, validada no servidor.
- Os diagramas de pacotes são lógicos; não prometem uma pasta física por pacote quando o protótipo usa um servidor compacto.
- Os SVGs de v1 e v2 foram gerados diretamente das respectivas fontes PlantUML, validadas com PlantUML 1.2025.2. Fontes e imagens representam os mesmos modelos.

## Como reproduzir e revisar

Abra qualquer `.puml` no PlantUML (aplicativo local ou extensão de editor). Para gerar imagens com PlantUML: `java -jar plantuml.jar -tsvg -charset UTF-8 docs/modelos/v1/*.puml docs/modelos/v2/*.puml`. Para conferir a sintaxe sem gerar imagens, use `-checkonly`. Essas ferramentas são opcionais para usar a aplicação; as imagens prontas já acompanham o pacote.

Ao mudar entidades, permissões ou fluxos: registre a decisão, copie o modelo para uma próxima versão, atualize a rastreabilidade e confirme o comportamento no sistema antes da apresentação.
