# Roteiro de apresentação — LAB02

Duração sugerida: 8–10 minutos. Execute `npm start` antes de apresentar e mantenha as credenciais de demonstração à mão. Use somente dados fictícios.

| Tempo | Demonstração | Relação com o enunciado |
| --- | --- | --- |
| 0–1 min | Apresentar problema, três perfis e stack | HTML/CSS/JS, Bootstrap, Fetch e JSON Server |
| 1–2 min | Abrir índice dos modelos; comparar v1 e v2 | Modelagem, revisão e alinhamento com código |
| 2–3 min | Criar cliente com RG/CPF, endereço, profissão e rendas | CRUD e limite de três empregadores |
| 3–4 min | Escolher carro, criar pedido futuro e consultar detalhes | Pedido e status pelo cliente |
| 4–5 min | Editar pedido e mostrar total recalculado; cancelar outro | Alteração e cancelamento com histórico |
| 5–6 min | Entrar como empresa, consultar renda e emitir parecer | Análise financeira e agentes |
| 6–7 min | Aprovar e executar contrato; mostrar titularidade | Parecer positivo e contrato |
| 7–8 min | Entrar como banco e contratar outro pedido com crédito | Banco concedente e crédito opcional |
| 8–9 min | Recarregar/reiniciar e mostrar persistência; executar testes | JSON Server, `db.json`, validação |
| 9–10 min | Mostrar estrutura, README e limites; abrir repositório do aluno | Entrega de código/modelos e reflexão |

## Comparação entre modelo e protótipo

Explique que Cliente e Agente são especializações conceituais implementadas por `role`. Mostre `employers` como composição de até três rendas, `requests` e `contracts` como documentos separados e `credit` como composição opcional do contrato. No diagrama de componentes, aponte o caminho navegador → Fetch → regras/sessão → JSON Server → `db.json`.

## Mudanças a justificar

A primeira versão foi refinada para incluir autenticação real no servidor, restrições de acesso, histórico, estados explícitos, cancelamento sem apagar o pedido, conflito de período e invalidação do parecer após edição. A divisão em dois subsistemas foi mantida, com pacotes lógicos detalhados na versão final.

Não afirme que o professor solicitou mudanças específicas ou aprovou modelos, a menos que exista esse feedback real. Se a turma produziu versões anteriores, adicione-as ao repositório e use-as na comparação.

## Antes de entregar

Preencha autoria no README. Publique o projeto na sua conta GitHub incluindo `docs/modelos/v1`, `docs/modelos/v2` e o código final. Verifique o endereço remoto e compartilhe o link solicitado pela disciplina. Nenhuma publicação remota é presumida por este pacote.
