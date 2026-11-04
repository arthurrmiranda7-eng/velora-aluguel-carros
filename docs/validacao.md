# Registro de validação da entrega

Validação realizada em 03/11/2026 com Node.js 24.22.1 e npm 11.9.0.

## Resultados

| Verificação | Resultado |
| --- | --- |
| `npm run check` | Sintaxe do servidor e JavaScript da interface válida |
| `npm test` | 14 testes aprovados, 0 falhas, 0 ignorados |
| API REST | 11 testes de integração aprovados |
| Interface + API | 3 fluxos de DOM aprovados com JSDOM, Bootstrap real e Fetch HTTP |
| PlantUML 1.2025.2 `-checkonly` | 9 diagramas válidos: 4 em v1 e 5 em v2 |
| Geração PlantUML `-tsvg` | 9 SVGs gerados diretamente das fontes incluídas |
| Recursos locais | Arquivos referenciados no HTML encontrados; SVGs com XML válido |
| Atalho Linux/macOS | `bash -n iniciar.sh` aprovado |

Os testes usam bancos temporários e portas locais aleatórias. O banco demonstrativo entregue permanece com 4 usuários, 6 automóveis, 4 pedidos e 1 contrato.

## Cenários cobertos

A suíte de API verifica autenticação e logout, recursos locais, bloqueio de acesso anônimo, hash não exposto, CPF e e-mail únicos, limite de rendimentos, isolamento de clientes, CRUD, proibição de elevação de privilégios, cálculo de diárias no servidor, datas inválidas, edição e cancelamento, parecer financeiro, novo parecer após edição, contratação única, propriedade do automóvel, crédito restrito ao banco, conflitos de reservas, datas adjacentes e persistência após reinício.

A suíte de interface executa os arquivos reais de HTML e JavaScript em JSDOM, carrega o Bootstrap e envia Fetch para o servidor real de teste. Os três fluxos são: login e criação de pedido; banco emitindo contrato com crédito; cadastro, edição e exclusão de cliente sem vínculos. As confirmações de formulário são aguardadas antes de ler o arquivo persistido.

## Limites da verificação

Não foi realizada inspeção visual em navegador real nem captura de tela, pois a ferramenta de navegação requerida pelo ambiente não estava disponível. JSDOM verifica eventos, formulários e DOM, mas não reproduz o motor de layout de um navegador. O roteiro em `testes-manuais.md` orienta a conferência de responsividade e interação visual em desktop e celular.

O atalho Windows foi incluído, mas não executado em Windows neste ambiente Linux. Os testes automáticos não avaliam serviços bancários, pagamentos ou assinaturas reais, que não fazem parte do protótipo.
