# World Soccer Legends: simulador de gestão de um clube de futebol

## Resumo

World Soccer Legends é um jogo de navegador em que o usuário assume a presidência de um clube de futebol. Ao longo da temporada, ele contrata atletas no mercado, escala o time, disputa um campeonato nacional de pontos corridos em três divisões e participa da Copa do Brasil. O mercado também oferece jogadores marcados como lendas: figuras históricas do futebol que podem ser contratadas e escaladas como os demais, com preço mais alto e negociação mais exigente. O placar de cada partida resulta de um modelo probabilístico aplicado à força do elenco escalado. O programa é uma aplicação estática em HTML, CSS e JavaScript, e a carreira permanece no armazenamento local do navegador.

## 1. Objetivo

O sistema permite conduzir uma carreira ao longo de várias temporadas. O presidente começa com um elenco base e um orçamento limitado, contrata jogadores, define a formação e disputa as rodadas. O desempenho esportivo altera a classificação, a premiação e a divisão do clube na temporada seguinte.

## 2. Estrutura competitiva

Cada divisão tem 20 clubes e 38 rodadas, em turno e returno. A vitória vale 3 pontos e a premiação de R$ 1 milhão. O empate vale 1 ponto e R$ 300 mil. Quatro clubes sobem e quatro descem entre as Séries A, B e C.

O presidente escolhe a divisão de estreia entre Série A e Série B. O orçamento inicial é de R$ 5 milhões e o elenco cabe no máximo 25 jogadores. São necessários pelo menos 18 atletas para disputar uma rodada. A partir da rodada 19, a Copa do Brasil corre em paralelo ao campeonato.

A premiação de fim de temporada depende da divisão e da colocação. O título vale R$ 35 milhões na Série A, R$ 18 milhões na Série B e R$ 12 milhões na Série C. O patrocínio da temporada seguinte é de R$ 20 milhões, R$ 14 milhões ou R$ 8 milhões, conforme a divisão em que o clube vai jogar. Na Copa, a premiação corresponde à fase mais avançada da campanha, com teto de R$ 25 milhões para o título.

## 3. Modelo da partida

A força de cada jogador é um inteiro associado ao atleta. A escalação de onze jogadores produz três índices do time: ataque, defesa e média geral. Cada posição entra com um peso próprio. Atacantes pesam no ataque; defensores e o goleiro pesam na defesa; volantes e meias dividem os dois lados.

Os gols são sorteados por uma distribuição de Poisson com esse. O autor do gol e o eventual assistente são escolhidos dentro da escalação, com pesos por posição. Cartões e indisponibilidade também entram na gestão do elenco entre as rodadas.

## 4. Arquitetura

A interface está em `index.html` e nas folhas `css/style.css`, `css/fonts.css` e `css/viewport-fit.css`. O programa usa módulos ES, carregados a partir de `js/app.js`.


| Módulo                     | Função                                               |
| -------------------------- | ---------------------------------------------------- |
| `js/app.js`                | Telas, mercado, temporada e ligação entre os módulos |
| `js/data.js`               | Carga dos elencos, formações e preço dos jogadores   |
| `js/league.js`             | Calendário, tabela e acesso/rebaixamento             |
| `js/match.js`              | Sorteio do placar                                    |
| `js/match-live.js`         | Narração da partida já calculada                     |
| `js/forces.js`             | Ataque, defesa e média da escalação                  |
| `js/market-negotiation.js` | Proposta e aceite no mercado                         |
| `js/discipline.js`         | Cartões e suspensão                                  |
| `js/copa-brasil.js`        | Chaveamento da copa                                  |
| `js/game-save.js`          | Gravação e leitura da carreira                       |
| `js/storage.js`            | Persistência no `localStorage`                       |
| `js/i18n.js`               | Textos em português e inglês                         |
| `js/crests.js`             | Escudos desenhados em canvas                         |


O navegador busca os arquivos estáticos e os JSON de dados, sem etapa de compilação. A carga dos módulos exige um servidor HTTP local. A abertura direta de `index.html` pelo protocolo `file://` impede essa carga.

## 5. Dados

Os arquivos ficam em `data/`:

- `all-players.json` — atletas disponíveis no mercado
- `club-squads-serie-a.json` — elencos da Série A
- `club-squads-serie-b.json` — elencos da Série B
- `club-squads-serie-c.json` — elencos da Série C

Cada atleta guarda nome, posições, número, idade e força. Os clubes do campeonato usam os nomes oficiais das séries nacionais. O elenco inicial do presidente é um grupo base, separado desses arquivos, calibrado para a força do pior time da divisão escolhida. As contratações passam a usar os nomes presentes nos JSON.

Áudio, fontes e imagens de apoio estão em `audio/`, `fonts/` e `img/`.

## 6. Instalação e execução

Requisitos:

- navegador atualizado (Edge, Chrome ou Firefox)
- Python 3 disponível no terminal, para o servidor local

A execução depende só do navegador e do Python 3.

### Windows

1. Abra a pasta `football-manager`.
2. Dê duplo clique em `INICIAR-JOGO.bat`.
3. O navegador abre em `http://localhost:8765/`.
4. Para encerrar, volte à janela do terminal e pressione Ctrl+C.

### Terminal

Na pasta `football-manager`:

```bash
python -m http.server 8765
```

Em seguida, acesse `http://localhost:8765/`.

Se a porta 8765 estiver ocupada, troque o número nos dois lugares: no comando e no endereço.

### Conferência rápida

1. A tela inicial mostra o título World Soccer Legends e a escolha de divisão.
2. Informe o nome do clube e inicie a temporada na Série B.
3. Pule o tutorial, se ele aparecer.
4. No painel, o botão de jogar a partida deve estar habilitado.
5. Dispute a rodada e confira o placar, a tabela e a notícia da rodada.
6. Recarregue a página: a carreira salva deve oferecer a opção de continuar.

## 7. Limites conhecidos

A simulação é estatística. Ela não reproduz um campo jogável nem o regulamento integral da Confederação Brasileira de Futebol. A força dos atletas é um índice do jogo, usado para preço, escalação e probabilidade de gols. A carreira existe apenas no navegador em que foi gravada; limpar os dados do site apaga o save.