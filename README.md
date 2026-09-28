# 📱 FinançaConsciente

## Protótipo Navegavel
* [Link](https://www.figma.com/make/RaCB9kJA4M0WUmL59WrMYr/High-Fidelity-Mobile-Finance-App?t=qDbMjgH9bQiAdeNi-1)

---

> **O aplicativo de educação financeira que ajuda você a gerenciar seu dinheiro e combater a compulsividade por compras através de inteligência artificial e gamificação.**

O **FinançaConsciente** é uma ferramenta abrangente de controle de gastos desenvolvida como projeto acadêmico. Seu diferencial é o foco na psicologia financeira, utilizando análises comportamentais, quarentena de desejos, assistentes de IA e metas realistas para promover o consumo consciente.

---

## 🛠️ Tecnologias Utilizadas (Stack)

O projeto segue os princípios da **Clean Architecture** e é dividido em:

*   **Frontend Mobile:** React Native (Compilado para Android API 21+)
*   **Backend API:** Node.js com Express (RESTful)
*   **Banco de Dados Local (Mobile):** SQLite (Offline-First)
*   **Segurança:** Autenticação JWT, HTTPS estrito, senhas com Bcrypt
*   **Design System:** Material Design 3 (com suporte a Modo Escuro)

---

## 📅 Backlog do Produto (Metodologia Ágil)

O desenvolvimento está estruturado em entregas iterativas (Sprints) focadas na construção de um MVP (Produto Mínimo Viável) até alcançar as integrações avançadas.

### 🏃 Sprint 1: Fundação e MVP (O Básico Bem Feito)
**Meta:** Construir a base arquitetural, garantir a segurança dos dados e permitir o controle financeiro básico (receitas, despesas e saldos).

*   **[RNF-Setup]** Inicializar React Native, repositório Git Flow e backend Express. Implementar banco SQLite local (Offline-first) e criptografia de senhas.
*   **[US 1.1] Cadastro de Renda (RF01):** Como usuário, quero cadastrar, editar e excluir minhas fontes de renda (fixas/variáveis) para saber quanto ganho no mês.
*   **[US 1.2] Registro de Despesas (RF02):** Como usuário, quero registrar minhas despesas diárias e anexar a foto do comprovante via câmera.
*   **[US 1.3] Dashboard em Tempo Real (RF04):** Como usuário, quero ver um painel logo na tela inicial mostrando meu saldo consolidado, receitas e despesas.
*   **[US 1.4] Cofres Virtuais (RF49):** Como usuário, quero criar cofres (sub-saldos) para separar mentalmente meu dinheiro (ex: Viagem, Aluguel).
*   **[US 1.5] Prevenção de Duplicatas (RF58):** Como sistema, devo detectar se o usuário está tentando lançar uma mesma despesa duas vezes e emitir um alerta.

### 🏃 Sprint 2: Planejamento, Inteligência e Relatórios
**Meta:** Expandir o controle permitindo planejamento futuro (metas/orçamentos) e adicionar as primeiras inteligências do sistema (OCR e Extratos).

*   **[RNF-Setup]** Otimizar renderização de listas no React Native (FlashList) e implementar logs estruturados (Winston) no Node.js.
*   **[US 2.1] Orçamentos Mensais (RF05):** Como usuário, quero definir tetos de gastos por categoria e receber notificações push se eu estiver perto do limite.
*   **[US 2.2] Metas Financeiras (RF10, RF57):** Como usuário, quero cadastrar metas de curto e longo prazo para que o app calcule quanto preciso poupar mensalmente.
*   **[US 2.3] Contas Recorrentes (RF12, RF20, RF54):** Como usuário, quero cadastrar despesas fixas para que o app agende lembretes de faturas e crie os lançamentos sozinho.
*   **[US 2.4] Scanner OCR de Recibos (RF11):** Como usuário, quero fotografar um recibo e deixar o app preencher o valor e a data automaticamente.
*   **[US 2.5] Categorização Automática (RF21):** Como sistema, devo usar Machine Learning básico para categorizar as despesas que o usuário digita.
*   **[US 2.6] Relatórios e Patrimônio (RF06, RF25):** Como usuário, quero exportar relatórios em PDF/CSV e visualizar o gráfico do meu Patrimônio Líquido.
*   **[US 2.7] Importação Bancária (RF31):** Como usuário, quero importar arquivos OFX/CSV do meu banco para evitar digitação manual.

### 🏃 Sprint 3: Gamificação, Automações e IA
**Meta:** Implementar os diferenciais do aplicativo com inteligência artificial conversacional, mecânicas de gamificação e combate à compulsividade.

*   **[RNF-Setup]** Realizar testes de carga na API Node.js e otimizar o peso final do pacote APK (Android).
*   **[US 3.1] Quarentena de Desejos (RF03, RF14):** Como usuário impulsivo, quero ter uma "Lista de Desejos" com dias de espera obrigatórios e receber alertas reflexivos antes de compras perigosas.
*   **[US 3.2] Chatbot IA e Voz (RF64, RF44):** Como usuário, quero falar comandos de voz para registrar gastos e conversar com um Assistente IA para tirar dúvidas sobre minhas finanças.
*   **[US 3.3] Sync WebSockets e Nuvem (RF23, RF24):** Como usuário, quero sincronização em tempo real entre dispositivos e backup automático no Google Drive.
*   **[US 3.4] Desafios e Recompensas (RF09, RF27, RF37):** Como usuário, quero participar de desafios financeiros gamificados para ganhar insígnias e pontuações.
*   **[US 3.5] Motor de Regras e Vigilante (RF63, RF22):** Como usuário avançado, quero criar regras do tipo "Se X, faça Y" e ativar o corte automático de orçamento.
*   **[US 3.6] Proteção Biométrica (RF46):** Como usuário, quero proteger ações críticas (exclusão de contas/transferências) com minha impressão digital.
*   **[US 3.7] Notificações por Geofencing (RF45):** Como usuário, quero receber um alerta se eu entrar em um shopping e meu orçamento de lazer já estiver estourado.

---

## 📋 Lista Completa de Requisitos

Abaixo está o mapeamento técnico completo exigido para o escopo do projeto (Documentação de Engenharia de Requisitos):

<details>
<summary><strong>👉 Clique aqui para expandir os Requisitos Funcionais (RF)</strong></summary>

*   **RF01 - Cadastro de Fontes de Renda:** Módulo para o usuário registrar e categorizar seus ganhos (fixos ou variáveis).
*   **RF02 - Registro de Despesas com Anexo:** Lançamento de gastos diários com suporte a upload de fotos de comprovantes.
*   **RF03 - Lista de Desejos (Controle de Compulsividade):** Cadastro de itens com período de quarentena de dias antes da liberação da compra.
*   **RF04 - Dashboard Financeiro em Tempo Real:** Painel reativo consolidando saldo, receitas, despesas e uso do orçamento.
*   **RF05 - Orçamentos Mensais por Categoria:** Definição de limites de gastos com disparos de notificações push.
*   **RF06 - Relatórios Detalhados e Exportação:** Geração de extratos com filtros e exportação para arquivos PDF ou CSV.
*   **RF07 - Análise de Tendências (Gráficos):** Identificação de padrões históricos de consumo consolidados em gráficos de linha.
*   **RF08 - Simulação de Investimentos:** Calculadora projetando rendimentos futuros baseada em juros compostos (CDB, Poupança, etc).
*   **RF09 - Desafios Financeiros (Gamificação):** Sistema de metas de restrição de gastos que gera insígnias e recompensas.
*   **RF10 - Metas Financeiras:** Criação de objetivos calculando automaticamente a quantia mensal a ser poupada.
*   **RF11 - Scanner de Recibos com OCR:** Câmera que lê a nota fiscal e converte a imagem preenchendo os dados automaticamente.
*   **RF12 - Agendamento de Contas Recorrentes:** Cadastro de contas mensais gerando lembretes locais para pagamentos.
*   **RF13 - Múltiplos Perfis Financeiros:** Capacidade de separar contextos financeiros distintos na mesma conta.
*   **RF14 - Análise de Compulsão:** Gatilho que interrompe compras por impulso baseado no histórico e padrões de horário/loja.
*   **RF15 - Compartilhamento Seguro de Relatórios:** Criação de links criptografados temporários para consultoria financeira.
*   **RF16 - Central de Educação Financeira:** Feed de artigos para leitura salvos no aparelho (cache) para acesso offline.
*   **RF17 - Cálculo de Custo Real:** Visão analítica embutindo custo de oportunidade e depreciação em uma compra.
*   **RF18 - Simulador de Cenários Financeiros:** Calculadora interativa prevendo impactos no longo prazo ao cortar gastos.
*   **RF19 - Integração de CNPJ:** Chamada de API Governamental para validar situação fiscal de empresas/prestadores.
*   **RF20 - Lembretes de Fatura de Cartão:** Alertas progressivos para pagamento com base em dados de fechamento e vencimento.
*   **RF21 - Categorização Automática (Machine Learning):** IA no backend classificando a categoria do gasto através de palavras-chave.
*   **RF22 - Modo Vigilante (Recomposição de Orçamento):** Compensação automática cortando saldo de uma categoria quando outra estoura.
*   **RF23 - Sincronização WebSockets:** Comunicação full-duplex mantendo os dados atualizados ao vivo entre dispositivos.
*   **RF24 - Backup Automático em Nuvem:** Exportação encriptada diária de banco de dados para o Google Drive.
*   **RF25 - Gráfico de Patrimônio Líquido:** Indicador da evolução da riqueza totalizada (ativos menos passivos).
*   **RF26 - Extensão de Navegador Integrada:** Popup via Web/Desktop para exibir limites quando logado em sites de e-commerce.
*   **RF27 - Programa de Fidelidade:** Pontuação convertível em descontos baseada em bons comportamentos financeiros.
*   **RF28 - Alertas Personalizados:** O usuário constrói lógicas/gatilhos (ex: se o saldo < X, notificar).
*   **RF29 - Orçamento Familiar Compartilhado:** Consolidação de múltiplas contas do sistema no mesmo painel (com controle de permissões).
*   **RF30 - Taxa de Esforço Financeiro:** Indicador de quanto da renda líquida está engessada em despesas fixas.
*   **RF31 - Importação de Extrato Bancário (OFX/CSV):** Leitura automática de dados exportados do banco.
*   **RF32 - Impacto Financeiro da Compra Parcelada:** Comparativo evidenciando o peso dos juros e o custo de oportunidade da parcela.
*   **RF33 - Relatório Semanal por E-mail:** Job backend gerando relatórios HTML enviados via Nodemailer semanalmente.
*   **RF34 - Orçamento Flexível:** Funcionalidade para transferir verba que sobrou de uma categoria para outra.
*   **RF35 - Subcategorias em Níveis:** Hierarquia de organização em árvore (Ex: Lazer -> Cinema).
*   **RF36 - Média Móvel de Gastos:** Visualização comparando o gasto diário/semanal atual com os períodos anteriores.
*   **RF37 - Desafio de Economia Micro:** Sugestões práticas diárias (ex: "corte o café fora") para bater metas curtas.
*   **RF38 - Notas e Lembretes por Transação:** Campo extra para anotar contexto nas despesas (ex: "Presente do João").
*   **RF39 - Modo Auditoria (Fine Tuning ML):** Interface onde o usuário corrige as categorias dadas pela IA, treinando o algoritmo.
*   **RF40 - Rede de Apoio Social:** Interação estilo rede social para compartilhar progressos (ocultando valores exatos).
*   **RF41 - Taxa de Poupança Real:** % efetiva do que sobrou da renda no fim do mês contra benchmark de especialistas.
*   **RF42 - Lembretes de Renegociação Contratual:** Agendamento alertando o fim de contratos (internet/seguro) com dicas de negociação.
*   **RF43 - Clusterização de Perfil Financeiro:** Classificação automática do estilo do usuário (Conservador/Arrojado).
*   **RF44 - Input por Comando de Voz (NLP):** Conversão de áudio do microfone para texto, preenchendo o formulário de despesa.
*   **RF45 - Notificação Contextual (Geofencing):** Alerta via GPS ao chegar perto de locais de compra com limite de categoria estourado.
*   **RF46 - Autenticação Biométrica:** Validação via digital/FaceID para exclusão de despesas e aprovações sensíveis.
*   **RF47 - Log Audit Trail:** Relatório interno de rastreabilidade (criações, edições, exclusões) no banco.
*   **RF48 - Relatório Contábil/Fiscal:** Consolidação para exportação em padrões aceitos pela Receita Federal.
*   **RF49 - Cofres Virtuais:** Divisão de saldos da conta principal em "gavetas" com objetivos específicos.
*   **RF50 - Modo Infantil/Gamificado:** UI colorida, focada em mesadas virtuais e com controle parental.
*   **RF51 - Agendamento de Transferências Internas:** Movimentação automatizada de saldo entre contas locais do usuário.
*   **RF52 - Comparativo Média Nacional:** Benchmarking anônimo contra a base de usuários do aplicativo (LGPD-compliant).
*   **RF53 - Fluxo de Caixa Linear:** Forecast (previsão) de saldos e dívidas num horizonte futuro de 12 meses.
*   **RF54 - Transações Recorrentes Dinâmicas:** Replicação automática mensal/anual de despesas programadas.
*   **RF55 - Amortização de Dívidas:** Dashboard para cálculo de impacto de financiamentos/empréstimos no orçamento.
*   **RF56 - Tematização Automática (Modo Escuro):** Adaptação do estilo visual de acordo com as preferências do sistema operacional.
*   **RF57 - Metas de Curto Prazo:** Tracker focado em conversão diária (ex: poupar R$ 5/dia em um período de 30 dias).
*   **RF58 - Detecção Anti-Duplicidade:** Alerta heurístico de input caso a despesa tenha valores e horas idênticas.
*   **RF59 - Projetos Fechados (Orçamento de Viagem):** Separação temporária de gastos sob uma mesma rubrica que não afeta os gráficos diários.
*   **RF60 - Cartão de Progresso (Redes Sociais):** Geração nativa de imagem com % de conclusão de meta para Instagram/WhatsApp.
*   **RF61 - Workspace Empresarial (CNPJ):** Separação de finanças Pessoa Física (PF) e Jurídica (PJ) na mesma plataforma.
*   **RF62 - Score Health (Índice de Saúde Financeira):** Nota unificada de 0 a 100 ponderando diversos comportamentos.
*   **RF63 - Motor Customizado de Automações:** Interface "If/Then" para construção de regras de negócio pelo usuário.
*   **RF64 - IA Chatbot (Assistente Virtual):** Tela de conversa natural utilizando processamento de linguagem (ex: Dialogflow).
</details>

<details>
<summary><strong>👉 Clique aqui para expandir os Requisitos Não Funcionais (RNF)</strong></summary>

*   **RNF01 - Stack e Clean Architecture:** Desenvolvimento obrigatório em Node.js/Express (Back) e React Native (Front Mobile Android).
*   **RNF02 - Alta Performance de Renderização:** Otimização para longas listas utilizando Virtualização (ex: FlashList) e Memoization (React.memo).
*   **RNF03 - Criptografia de Segurança:** Uso obrigatório de HTTPS estrito (SSL/TLS) e Bcrypt para hashing de senhas.
*   **RNF04 - Banco Offline-First:** Capacidade de lançar despesas sem internet utilizando SQLite local com posterior Sincronização.
*   **RNF05 - Design System (Material Design):** Padronização UI/UX seguindo diretrizes oficiais do Google para Android.
*   **RNF06 - Testes de Carga e Escalabilidade:** API REST preparada para suportar milhares de acessos concorrentes.
*   **RNF07 - Logs Estruturados:** Padronização de logs (Winston) facilitando debug e rastreabilidade na produção.
*   **RNF08 - Retrocompatibilidade Android (API 21+):** Suporte garantido desde o Android 5.0 Lollipop.
*   **RNF09 - Metodologia Ágil e Versionamento:** Controle de código hospedado via Git em repositório privado utilizando Git Flow.
*   **RNF10 - Otimização de Bandwidth e APK:** Compressão de requisições, lazy-loading de assets e minificação para reduzir o peso do aplicativo.
</details>

---

## 🚀 Como rodar o projeto

O repositório é um monorepo com duas pastas:

```
backend/   API REST em Node.js + Express + SQLite (Clean Architecture)
mobile/    App React Native 0.73 para Android (API 21+), SQLite local e Material Design 3
```

### Backend (API)

Pré-requisitos: Node.js 20 ou superior.

```bash
cd backend
npm install
cp .env.example .env      # edite o JWT_SECRET
npm run dev               # sobe em http://localhost:3333/api
npm test                  # roda os testes
```

Rotas disponíveis:

| Método | Rota                 | Descrição                                  |
|--------|----------------------|--------------------------------------------|
| GET    | `/api/health`        | Verifica se a API está no ar               |
| POST   | `/api/auth/register` | Cadastra usuário (senha salva com Bcrypt)  |
| POST   | `/api/auth/login`    | Faz login e devolve um token JWT           |
| GET    | `/api/me`            | Rota protegida: exige `Authorization: Bearer <token>` |

Camadas em `backend/src`: `domain` (entidades e regras), `application` (casos de uso), `infrastructure` (SQLite, Bcrypt, JWT) e `interfaces/http` (rotas, controllers e middlewares). A montagem de tudo fica em `main/container.js`.

> Em produção a API deve rodar atrás de HTTPS (TLS). O `helmet` já envia o cabeçalho `Strict-Transport-Security`.

### Mobile (Android)

Pré-requisitos: Node.js 18+, JDK 17 e Android Studio com um emulador ou celular conectado ([guia oficial de ambiente](https://reactnative.dev/docs/0.73/environment-setup)).

```bash
cd mobile
npm install
npm start                 # terminal 1: Metro bundler
npm run android           # terminal 2: instala e abre o app
npm test                  # testes com Jest
```

O app usa React Native **0.73**, a última versão que ainda suporta Android 5.0 (API 21), como pede o RNF08. O banco local fica em `src/data/database` (as migrações ficam em `migrations.ts`) e o tema Material 3 claro/escuro em `src/presentation/theme`.

### Fluxo Git (Git Flow)

* `main`: versões entregues
* `develop`: integração das sprints
* `feature/<item>`: uma branch por User Story, com PR para `develop`

---

## ✅ Definition of Done (Critérios de Aceitação Gerais)
Todas as User Stories desenvolvidas devem obedecer aos seguintes critérios para serem consideradas concluídas:
1. Valores monetários devem ser tratados e impedidos de serem negativos.
2. Tratamento adequado contra divisão por zero nos gráficos (especialmente no início do mês, sem dados).
3. Proteção em rotas da API (Middlewares de Autenticação JWT).
4. Código seguindo padronização Material Design 3 na interface mobile.
5. Formulários passando por validação de campos vazios e formatos de arquivos/datas.

---
*Projeto acadêmico de Desenvolvimento de Software.*
