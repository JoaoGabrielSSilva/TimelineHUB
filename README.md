# TimelineHUB

# TimelineHUB

> Organize a melhor ordem para jogar, ler ou assistir às suas franquias favoritas.

**TimelineHUB** é uma aplicação web para criar mapas visuais de franquias. Em vez de depender apenas de listas lineares, você pode conectar títulos por pré-requisitos e visualizar caminhos de consumo para jogos, livros, filmes, séries, animes, quadrinhos e outros formatos.

Acesse a versão publicada: [TimelineHUB](https://joaogabrielssilva.github.io/TimelineHUB/)

## Funcionalidades

- Criação e organização de múltiplas franquias.
- Suporte a jogos, livros, quadrinhos, filmes, séries, animes e outros tipos de mídia.
- Organização visual em formato de grafo.
- Conexões entre itens para indicar o que deve ser consumido antes de cada título.
- Suporte a múltiplos pré-requisitos por item.
- Status de progresso:
  - Não iniciado
  - Em andamento
  - Concluído
- Busca na Wikipedia para preencher título, descrição e capa de jogos.
- Capas personalizadas por item.
- Agrupamento de franquias por tipo.
- Estatísticas de progresso por franquia.
- Exportação de uma franquia individual em JSON.
- Exportação e importação de todos os dados do navegador.
- Carregamento de franquias estáticas publicadas na pasta `franquias/`.
- Persistência local com `localStorage`.
- Layout responsivo para telas menores.

## Como usar

1. Clique em **New franchise**.
2. Informe o nome, o tipo e uma descrição opcional.
3. Abra a franquia criada e clique em **Add item**.
4. Adicione os títulos que fazem parte dela.
5. Para cada item, defina:
   - Título
   - Tipo de mídia
   - Descrição opcional
   - Capa
   - Status de progresso
   - Quais itens devem vir antes dele
6. O TimelineHUB exibirá a ordem como um mapa visual.

## Estrutura do projeto

```text
TimelineHUB/
├── index.html      # Estrutura da interface
├── styles.css      # Estilos, layout e responsividade
├── app.js          # Estado, renderização e funcionalidades da aplicação
└── README.md       # Documentação do projeto
```

## Tecnologias

- HTML5
- CSS3
- JavaScript puro
- SVG para as conexões entre os itens
- Web Storage API (`localStorage`)
- Wikipedia API
- GitHub Pages

## Dados e persistência

Os dados criados pelo usuário são armazenados localmente no navegador por meio de `localStorage`.

Isso significa que:

- Os dados permanecem disponíveis ao atualizar a página no mesmo navegador.
- Limpar os dados do navegador pode remover as franquias salvas localmente.
- É recomendável usar a opção **Export** periodicamente para manter um backup.
- Arquivos exportados podem ser restaurados com a opção **Import**.

## Publicando franquias prontas

O projeto também pode carregar franquias em JSON publicadas junto ao site.

Para disponibilizar uma franquia no repositório:

1. Crie ou edite uma franquia no site.
2. Clique em **Export franchise**.
3. Adicione o arquivo exportado à pasta `franquias/`.
4. Inclua o nome desse arquivo em `franquias/index.json`.

Exemplo de `franquias/index.json`:

```json
[
  "the-legend-of-zelda.json",
  "final-fantasy.json"
]
```

Cada arquivo listado será carregado automaticamente quando o projeto estiver publicado em um servidor HTTP ou HTTPS, como o GitHub Pages.

## Próximos passos

Algumas possibilidades para a evolução do projeto:

- Adicionar filtros por status e tipo de mídia.
- Bloquear conexões circulares entre itens.
- Implementar suporte completo a Português e Inglês.
- Permitir compartilhar uma franquia por URL.
- Adicionar zoom e navegação aprimorada no mapa.
- Integrar fontes específicas para filmes, séries, livros e animes.
- Criar perfis de usuário e sincronização em nuvem.
- Permitir que a comunidade publique e vote em ordens de consumo.

## Licença

Este projeto ainda não possui uma licença definida.
