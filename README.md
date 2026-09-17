<p align="center">
  <img src="./src/assets/logo_amazon_aco.png" alt="Amazon Aço Logo" width="280">
</p>

<h1 align="center">Portal WMS & Controle de Estoques — Amazon Aço</h1>

<p align="center">
  <strong>Plataforma corporativa de auditoria em tempo real, inventário rotativo, rastreabilidade FEFO e controle operacional multidepósitos da rede Amazon Aço.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Versão-2.0.0-002f6c?style=for-the-badge&logo=react&logoColor=white" alt="Versão 2.0.0">
  <img src="https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%205-61DAFB?style=for-the-badge&logo=vite&logoColor=black" alt="React 18 + Vite">
  <img src="https://img.shields.io/badge/Backend-Supabase%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Realtime-WebSockets%20Ativo-F58327?style=for-the-badge&logo=websocket&logoColor=white" alt="Supabase Realtime">
  <img src="https://img.shields.io/badge/Estilização-Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare-pages&logoColor=white" alt="Cloudflare Pages">
</p>

<div align="center">

### 🚀 [Acessar Portal em Produção (Cloudflare Pages)](https://portal-estoque.pages.dev)

</div>

---

## 📌 Visão Geral

O **Portal de Controle de Estoques da Amazon Aço** (v2.0) é uma Single Page Application (SPA) reativa e de alta performance desenvolvida sob medida para a operação de almoxarifados, conferentes de depósito, auditores e supervisores de estoque.

Projetado para operar em campo tanto em coletores de dados e smartphones touch quanto em estações desktop nas lojas e centros de distribuição, o sistema sincroniza dados instantaneamente na nuvem com **Supabase (PostgreSQL)** e **WebSockets Realtime**.

---

## 🌟 Principais Recursos

### 1. 🔄 Atualização Reativa Instantânea (Sem F5)
- **Zero Latência no Feedback**: As contagens físicas individuais ou em lote são aplicadas instantaneamente na tela (`0ms`) via atualizações de estado otimistas.
- **Recálculo em Tempo Real**: Status (*Acurado*, *Ganho*, *Perda*), KPIs de acurácia, divergência e volume são recalculados no milissegundo do lançamento.
- **Sincronia Multi-Usuário via Realtime**: Graças aos canais WebSockets do Supabase (`supabase.channel`), contagens e trocas de etiquetas feitas por um conferente no galpão refletem instantaneamente no painel dos supervisores e demais operadores conectados, sem necessidade de atualizar a página (F5).

### 2. 🏷️ Controle Compartilhado de Troca Física de Etiquetas
- **Histórico Centralizado no Banco de Dados**: Marcações de etiquetas vinculadas diretamente à tabela `auditoria_estoque` do Supabase, preservando usuário, matrícula e data/hora.
- **Compartilhamento Multi-Dispositivo**: Todo o progresso de troca de etiquetas é compartilhado entre todos os usuários e aparelhos da rede.
- **Scoreboard de Etiquetas**: Placar de progresso com porcentagem dinâmica, acompanhamento de posições exigidas e isenção inteligente para materiais zerados e acurados.
- **Filtros Rápidos no Placar**: Alternância em 1 clique entre *Falta Trocar*, *Já Trocadas* e *Todas as Etiquetas*.

### 3. 📥 Importação Inteligente de Saldos
- **Modal Integrado**: Importação direta de planilhas (`.csv`, `.xlsx`, `.xls`) no menu da barra de filtros.
- **Mapeamento Flexível**: Identificação automática de colunas (`PRODUTO`, `FILIAL`, `ARMAZEM`, `QUANTIDADE`, `ENDERECO`, `CUSTO_UNITARIO`).
- **Processamento em Lotes**: Atualização direta das tabelas `saldo_comercio` ou `saldo_industria` com integridade relacional.

### 4. ⚡ Lançamento de Contagens em Massa
- Modal de digitação rápida em lote para múltiplos códigos e armazéns.
- Suporte a modo de contagem por **Peso** ou **Peça**, aplicando automaticamente o fator de conversão do catálogo SB1.
- Registro opcional de lote e data de validade integrado na mesma operação.

### 5. 🎯 Meta Diária Prioritária & Rota de Endereçamento
- **Banner de Meta Diária**: Algoritmo inteligente que seleciona automaticamente os 15 materiais mais críticos para contagem no dia (itens com divergência recente, sem conferência ou desatualizados há mais de 14 dias).
- **Ordenação por Rota de Endereçamento**: Ordena a lista física de produtos pelo corredor/prateleira/posição cadastrado no Protheus, acelerando a circulação do conferente no armazém.

### 6. 📊 Filtros Avançados & Exportação
- **Filtro Multi-Armazém**: Exibição seletiva apenas dos armazéns pertinentes à filial ou consulta.
- **Filtro de Status**: Acurados, Ganhos (sobras), Perdas (faltas) e Pendentes.
- **Tags & Fornecedores**: Seleção múltipla com modos de **Inclusão** e **Exclusão**.
- **Exportação Excel**: Geração de relatórios analíticos formatados em formato `.xlsx`.

---

## 🏪 Unidades e Filiais Atendidas

O sistema atende a rede de lojas e centros de distribuição da Amazon Aço:

| Código | Loja / Unidade | Localização | Endereço |
| :---: | :--- | :--- | :--- |
| **01** | **Loja Alvorada** | Manaus - AM | Rua Prof. Abílio Alencar, 1337 – Alvorada I |
| **02** | **Loja Matriz CD** | Manaus - AM | Av. Puraquequara, 5328 – Puraquequara |
| **04** | **Loja Raiz** | Manaus - AM | Av. Costa e Silva, 1257 – Raiz |
| **05** | **Loja Cidade Nova** | Manaus - AM | Av. Timbiras, 350 – Cidade Nova |
| **06** | **Loja Jorge Teixeira** | Manaus - AM | Av. Itaúba, 38 – Jorge Teixeira |
| **12** | **Loja Boa Vista** | Boa Vista - RR | Av. Venezuela, 1173 – Pricumã |
| **00** | **Visão Consolidada** | Global | Visão gerencial multiunidades para auditoria geral |

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Frontend Framework** | [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) (SPA ESModules) |
| **Estilização** | [Tailwind CSS 3.4](https://tailwindcss.com/) com design system corporativo da Amazon Aço |
| **Ícones** | [Lucide React](https://lucide.dev/) |
| **Planilhas & Dados** | [SheetJS (xlsx)](https://docs.sheetjs.com/) |
| **Efeitos Visuais** | [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti) para celebrações de metas atingidas |
| **Backend & Banco de Dados**| [Supabase](https://supabase.com/) (PostgreSQL 17 gerenciado, WebSockets Realtime, RPCs seguras) |
| **Infraestrutura & CDN** | [Cloudflare Pages](https://pages.cloudflare.com/) com deploy contínuo via Git |

---

## 📂 Estrutura do Projeto

```text
Painel de Controle de Estoque/
├── src/
│   ├── assets/                # Logos e ícones corporativos oficiais
│   ├── components/
│   │   ├── inventario/        # Componentes modulares do Inventário
│   │   │   ├── AuditHistoryModal.jsx  # Histórico detalhado de contagens do item
│   │   │   ├── CountModal.jsx         # Modal de registro de contagem física
│   │   │   ├── DailyGoalBanner.jsx    # Banner e indicador de meta diária
│   │   │   ├── EtiquetaButton.jsx     # Botão e badge interativo de etiqueta
│   │   │   ├── FilterBar.jsx          # Barra unificada de filtros e buscas
│   │   │   ├── FornecedoresModal.jsx  # Gestão de fornecedores por item
│   │   │   ├── ImportSaldoModal.jsx   # Importação de planilhas de saldo
│   │   │   ├── InventoryCard.jsx      # Card responsivo touch para mobile
│   │   │   ├── InventoryTable.jsx     # Tabela de alta densidade para desktop
│   │   │   ├── MassCountModal.jsx     # Lançador de contagens em lote
│   │   │   ├── Scoreboard.jsx         # Placar de progresso de etiquetas
│   │   │   └── TagsModal.jsx          # Gestão e atribuição rápida de tags
│   │   └── layout/
│   │       └── Navbar.jsx             # Barra de navegação, seletor de loja e tema
│   ├── context/
│   │   ├── AuthContext.jsx            # Gestão de autenticação, perfil e filiais
│   │   └── InventoryContext.jsx       # Estado global, cálculos e sincronização Realtime
│   ├── lib/
│   │   ├── audit.js                   # Utilitário de persistência de auditoria
│   │   └── supabase.js                # Cliente Supabase inicializado
│   ├── pages/
│   │   ├── InventarioPage.jsx         # Página principal do inventário rotativo
│   │   └── LoginPage.jsx              # Autenticação de usuários por matrícula
│   ├── utils/
│   │   ├── etiquetas.js               # Lógica de etiquetas compartilhadas e cache
│   │   ├── exportExcel.js             # Exportador de relatórios XLSX
│   │   └── formatters.js              # Formatadores de número, data e código
│   ├── App.jsx                        # Roteador raiz e provedores de contexto
│   ├── index.css                      # Diretivas Tailwind e estilizações globais
│   └── main.jsx                       # Ponto de montagem React
├── dist/                              # Artefatos compilados para produção
├── docs/                              # Espelho de distribuição web
├── package.json                       # Dependências e scripts
├── tailwind.config.js                 # Configuração de temas e cores
├── vite.config.js                     # Configurações de bundling e build Vite
└── wrangler.toml                      # Configuração de deploy no Cloudflare Pages
```

---

## 💻 Instalação e Desenvolvimento Local

Para rodar o projeto localmente:

```bash
# 1. Clonar o repositório
git clone https://github.com/CDiangell-dei/portal-estoque.git

# 2. Entrar na pasta do projeto
cd portal-estoque

# 3. Instalar dependências
npm install

# 4. Iniciar servidor de desenvolvimento
npm run dev

# 5. Gerar build de produção
npm run build
```

---

## 🚀 Pipeline de Deploy Automático

Qualquer alteração enviada para a branch `main` dispara automaticamente o build e deploy para o **Cloudflare Pages**:

```bash
# 1. Adicionar modificações
git add .

# 2. Criar commit descritivo
git commit -m "feat: melhorias no sistema"

# 3. Enviar para a branch principal
git push origin main
```

---

<p align="center">
  <strong>Amazon Aço — Tecnologia e Eficiência na Gestão de Estoques</strong><br>
  <sub>Portal corporativo de uso interno nas unidades fabris e comerciais.</sub>
</p>
