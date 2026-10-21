# Arcade em Grupo

Minijogos para 1 a 4 pessoas na mesma tela, com controle (USB), teclado ou mouse.
Roda direto no navegador, sem instalar nada.

## Como jogar

1. Abra `index.html` no Chrome, Edge ou Firefox (dois cliques no arquivo já funcionam).
2. Cada jogador aperta **AÇÃO** no seu dispositivo para entrar.
3. O Jogador 1 (anfitrião) aperta **AÇÃO** de novo para escolher o jogo.
4. **Esc** ou **Start** pausa a partida (dá para continuar, reiniciar ou voltar ao menu).
5. No lobby, **Esc**, **Start** ou um clique em *Configurações* abre as configurações.

| Dispositivo      | Mover           | Ação          | Extra          |
|------------------|-----------------|---------------|----------------|
| Teclado WASD     | W A S D         | F             | G              |
| Teclado Setas    | Setas           | Enter         | Shift direito  |
| Teclado IJKL     | I J K L         | U             | O              |
| Mouse            | Aponte o cursor | Botão esq.    | Botão dir.     |
| Controle (até 4) | Analógico/D-pad | A             | B / X          |

> Se o controle não aparecer, aperte qualquer botão nele: o navegador só reconhece controles depois do primeiro botão apertado.

## Jogos

| Jogo                 | Tipo   | Jogadores | Fases                                                 |
|----------------------|--------|-----------|-------------------------------------------------------|
| Masmorra Coop        | Coop   | 2–4       | 5 fases: gemas, placas de pressão, portas, espinhos, patrulhas |
| Escalada Coop        | Coop   | 2–4       | 5 fases de plataforma: torre humana (subir na cabeça do colega), molas, placas e portas |
| A Ilha Perdida       | Aventura | 2       | 5 fases (floresta, caverna, templo, ruínas, covil): espada, esquiva, chaves, baús, placas duplas e chefão |
| Chuva de Meteoros    | Coop   | 1–4       | 7 ondas de sobrevivência, com reviver e MVP por cristais |
| Batalha de Tanques   | Versus | 2–4       | 4 arenas em rodízio; vence quem fizer 3 rodadas |
| Motos de Luz         | Versus | 2–4       | 5 arenas com velocidade crescente; vence quem fizer 3 rodadas |
| Hóquei de Mesa       | Times  | 2–4       | 3 períodos (clássico, pinball, dois discos) + gol de ouro no empate |
| Batata Quente        | Festa  | 2–4       | 4 arenas em rodízio; quem fica com a bomba sai; vence quem fizer 3 rodadas |

Na **Ilha Perdida** (só para 2): AÇÃO = espada, EXTRA = esquiva (fica invulnerável por um instante). Cortem arbustos, abram baús para achar chaves, pisem os dois nas placas ao mesmo tempo para abrir portas e derrotem o Golem de Pedra. Quem cai é revivido pelo colega; se os dois caírem, a fase recomeça.

No Hóquei os jogadores são divididos alternadamente entre os times Laranja e Ciano (1x1, 2x1 ou 2x2). Com 3 jogadores, quem joga sozinho ganha um rebatedor maior e mais rápido.

### Modo Campeonato

Na tela de seleção, o botão **Modo Campeonato** sorteia até 4 jogos competitivos (versus, times e festa) que comportem o grupo. Cada vitória vale 1 ponto (no Hóquei, todos do time vencedor pontuam), e no final aparece o pódio.

O **placar da sessão** soma os pontos ao longo da noite: quem vence um versus ganha 1 ponto, e uma vitória coop dá 1 ponto para todos.

## Configurações

- **Jogadores:** nome (digite no teclado, ou use ◀ ▶ para escolher sugestões com o controle) e cor de cada vaga.
- **Controles:** remapeie as teclas dos três esquemas de teclado. Se a tecla já estiver em uso, as duas trocam de lugar.
- **Som:** volume geral (ou mudo).

Tudo fica salvo no navegador (`localStorage`) e volta na próxima vez que o jogo for aberto.

## Estrutura

```
index.html
css/style.css
js/core/input.js    Entrada unificada (teclado, mouse, controles)
js/core/engine.js   Laço do jogo, pausa, desenho, sons, partículas
js/core/scenes.js   Lobby, seleção de jogo, resultado, pódio
js/core/settings.js Configurações salvas e tela de configurações
js/games/*.js       Um arquivo por jogo
```

## Como adicionar um jogo

Crie `js/games/meujogo.js`, inclua-o no `index.html` e registre-o:

```js
class MeuJogo {
  constructor(players) { this.pausable = true; this.players = players; }
  update(dt) {
    for (const p of this.players) {
      const d = p.device.dir(x, y);        // direção (-1..1); o mouse aponta a partir de (x, y)
      if (p.device.pressed('a')) { /* ação */ }
    }
    // ao terminar:
    // Engine.finishGame({ title, subtitle, winners: [jogadores], lines: [{ player, text }] });
  }
  draw(ctx) { /* tela lógica de 1280x720 */ }
}

GAMES.push({
  id: 'meujogo', name: 'Meu Jogo', tag: 'VERSUS', min: 2, max: 4,
  desc: ['Linha 1', 'Linha 2', 'Linha 3'], controls: 'Mover: direcional',
  create: (ps) => new MeuJogo(ps),
  icon(ctx, x, y, t) { /* ícone do card */ },
});
```

As fases da Masmorra são mapas em texto (veja a legenda no topo de `dungeon.js`), então criar uma fase nova é só desenhar mais um mapa.
