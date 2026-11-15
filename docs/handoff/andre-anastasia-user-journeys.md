# ChronoFlare — seis jornadas de usuários e teste de aceitação

Para André e Anastasia. Preparado em 15/11/2026 com base na main após a PR #52. Os valores de referência abaixo foram conferidos nos arquivos reais publicados; arredondamento esperado de uma casa decimal. São personas e necessidades propostas para o teste, não entrevistas de usuários já realizadas.

Site: https://chronoflare.vercel.app/

## Como usar este roteiro

Primeiro leia apenas a necessidade do usuário e tente resolver a tarefa sem olhar os passos. Anote onde hesitou. Depois execute os passos para verificar o comportamento e os valores. Isso separa dificuldade de descoberta de erro funcional.

Marque cada cenário: PASSOU, FALHOU, FICOU CONFUSO ou BLOQUEADO PELO AMBIENTE. Não considerar indisponibilidade de uma imagem externa como prova de erro nos dados; registrar o que falhou, a mensagem exibida e se as demais funções continuam acessíveis.

Divisão sugerida: André verifica interpretação científica nos casos 1, 3 e 4; Anastasia verifica navegação, comparação, mapa e celular nos casos 2, 5 e 6. Ambos fazem o caso 1. Reservar cerca de 25–40 minutos por pessoa. Se houver pouco tempo, priorizar 1, 2, 3 e 6.

Antes de começar: registrar aparelho, navegador/versão, tamanho aproximado da tela, data/hora e URL inicial. Testar o endereço público, não apenas localhost. Guardar a URL e uma captura ao registrar cada problema. Não enviar tokens ou dados pessoais.

## Caso 1 — pesquisadora quer entender o que aconteceu em um dia

### Necessidade da usuária

“Estou analisando o Pantanal. Quero saber o que o ChronoFlare estima para 1º de agosto de 2020, como isso se compara à observação S-NPP e qual é a incerteza.”

### Passo a passo

1. Abrir o site pela página inicial. Confirmar que a série real é a principal, sem precisar ativar o modo sintético.
2. Em Series, escolher “Harmonized · Terra + Aqua”; em Year, escolher 2020; em “Inspect a date”, escolher 2020-08-01. Alternativa direta:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01
3. Localizar o dia no calendário e selecionar sua célula. Confirmar que o painel “Inspect a solar day” mostra a mesma data.
4. Ler a estimativa, a referência S-NPP, o benchmark, o intervalo e o papel da data.
5. Trocar Series para “VIIRS · Suomi-NPP”. Conferir os turnos e a soma nativa dessa data. Voltar para a série harmonizada.
6. Copiar a URL, abrir em outra aba e verificar série, ano e data. Usar Voltar e Avançar para conferir a restauração das seleções.

### Resultado esperado

- Estimativa harmonizada: 11,455.6 MW; referência S-NPP: 10,966.4 MW; benchmark MODIS: 9,358.3 MW. O app formata números em inglês.
- Intervalo empírico de 80%: 6,447.5–17,346.5 MW.
- Papel: “Previously examined date”, evidência pós-hoc. Não é uma data independente de validação.
- A soma nativa S-NPP corresponde à referência do painel, sem mudar silenciosamente a data.
- O usuário consegue distinguir estimativa, observação e benchmark; nenhuma dessas medidas é apresentada como número de incêndios ou área queimada.

### Falhas e oportunidades a registrar

Valor ou data incorretos, troca de série sem atualização, URL que perde contexto, dificuldade para localizar o detalhe, rótulos que fazem parecer que a estimativa foi medida diretamente ou que o intervalo garante 80% de cobertura. Se o usuário precisar exportar esse resumo e não encontrar uma opção amigável, registrar como melhoria de produto, não inventar que o botão existe.

## Caso 2 — analista quer comparar dois anos sem misturar sensores

### Necessidade do usuário

“Quero comparar a atividade registrada em 2020 e 2024 no mesmo indicador, mas sem tirar conclusões de dias que não têm dados.”

### Passo a passo

1. Em Calendar, manter a série harmonizada, Year = 2020 e Compare with = 2024. Abrir:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-02&obs_compare=2024
2. Localizar “Same series · two years”. Identificar qual cor representa cada ano e confirmar que os dois usam o mesmo eixo vertical.
3. Em “Compare a month/day”, selecionar 08-02. Ler os dois valores e usar “Inspect date” em cada cartão, verificando ano e data do painel diário.
4. Consultar 08-01: em 2024 não há estimativa publicável nessa data. Verificar que a aplicação mostra a lacuna, sem substituir por zero ou conectar uma linha através dela.
5. Voltar à comparação 2020/2024 e depois trocar o segundo ano para 2023. Selecionar 02-29 no inspetor de mês/dia. Confirmar que 2023 informa que a data não existe e que a página continua funcionando.
6. Usar Voltar/Avançar e abrir a URL em outra aba. Confirmar que séries e anos selecionados são preservados. O controle de mês/dia do gráfico pode precisar ser selecionado novamente; se isso impedir o compartilhamento pretendido, registrar como melhoria de persistência.

### Resultado esperado

- Em 08-02: 2020 = 17,241.5 MW; 2024 = 73,035.4 MW.
- As duas linhas pertencem à mesma série; os anos não podem ser iguais.
- Datas ausentes aparecem como lacunas e pontos isolados continuam visíveis. Março não deve deslocar por causa do ano bissexto.
- 29/02/2023 não deve virar 01/03 nem deixar a página em branco, especialmente no Safari.
- Não aparece uma conclusão automática como “X% mais incêndios no ano”. A comparação é de FRP, com suporte incompleto.

### Falhas e oportunidades a registrar

Legenda difícil de identificar, fonte pequena, curvas indistinguíveis, gráfico cortado, ausência de indicação de rolagem, valores do cartão que não correspondem à data e URL que restaura anos errados. Perguntar se o usuário consegue comparar sem depender de passar o mouse.

## Caso 3 — comunicadora quer saber se uma lacuna significa ausência de fogo

### Necessidade da usuária

“Recebi uma imagem com poucos valores em 2025. Posso dizer que quase não houve fogo? Quero entender o que falta nos dados antes de publicar essa interpretação.”

### Passo a passo

1. Abrir a série harmonizada em 2025:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2025&obs_date=2025-08-01
2. Verificar a contagem anual e ler o resumo do Plano A. Consultar 01/08/2025, sem estimativa publicável.
3. Alterar a data para 05/10/2025. Confirmar que existe uma estimativa. Depois mudar Year para 2026 e verificar a contagem desse ano.
4. Testar uma data que não foi adquirida:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2012&obs_date=2012-01-01
5. Testar uma estimativa existente sem referência S-NPP completa:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2012&obs_date=2012-03-10
6. Pedir à usuária que explique, com suas palavras, a diferença entre falta de aquisição, falta de estimativa e falta da referência S-NPP.

### Resultado esperado

- Há 6 estimativas publicadas em 2025 e 5 em 2026. Isso não conta quantos dias tiveram fogo.
- 01/08/2025 permanece sem estimativa; 05/10/2025 mostra 2,809.6 MW.
- 01/01/2012 informa “Not acquired”, sem preencher valor, sem zero artificial e sem pular automaticamente para outro dia.
- 10/03/2012 mostra uma estimativa de 499.7 MW, mas referência S-NPP indisponível por falta de turno completo. O benchmark é 294.8 MW; o papel da data é treino.
- Ausência de referência não deve impedir a leitura da estimativa nem fabricar uma observação. A concordância no treino não é apresentada como validação.

### Falhas e oportunidades a registrar

“0 MW” usado como substituto de dado ausente, calendário que muda a seleção silenciosamente, aviso que some quando a fonte muda, textos que fazem a usuária concluir “sem fogo”, indisponibilidade sem explicação ou carregamento infinito. Se a distinção só ficar clara depois de André explicar, marcar FICOU CONFUSO e sugerir o texto que ajudaria.

## Caso 4 — avaliador quer entender se pode confiar na harmonização

### Necessidade do usuário

“Não quero apenas um gráfico bonito. Quero saber o que foi testado, qual foi o ganho e quais resultados não podem ser usados como validação.”

### Passo a passo

1. Abrir Methodology:
https://chronoflare.vercel.app/?view=methodology
2. Encontrar a tabela do teste independente e identificar número de dias/semanas, viés, MAE, benchmark, cobertura dos intervalos e limites.
3. Encontrar o registro da aprovação do Plano A e o histórico do v1 reprovado. Abrir os links de evidência sem perder a possibilidade de voltar ao site.
4. Nos gráficos “Before: uncalibrated MODIS benchmark” e “After: harmonized estimate”, identificar eixos, diagonal de igualdade e barras verticais.
5. Usar os botões de grupo para desligar “Training period” e “Previously examined”; manter “Independent test”. Depois reativar todos os grupos.
6. Abrir “Table view: dates behind the chart”. Conferir contagens de datas publicadas, pareadas e sem referência. Desligar todos os grupos e observar se o estado vazio é compreensível e não parece um erro ou série de zeros.
7. Consultar uma data independente no calendário:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-01-04

### Resultado esperado

- Avaliação registrada: 506 dias pareados / 40 semanas; viés aproximadamente −1.0%; MAE 1,675.5 MW versus 2,589.0 MW; Spearman 0.965; cobertura diária de 72.7% e largura relativa mediana de 1.74.
- Todos os critérios apresentados têm resultado em texto. Spearman do benchmark é ligeiramente maior; não há afirmação de superioridade em todas as métricas.
- O gráfico inicial contém 620 datas pareadas das 635 publicadas; 15 não têm S-NPP completo. Por grupo: treino 230 pareadas/232 publicadas; previamente examinadas 161/161; independente 229/242.
- O teste de 506 dias e o subconjunto publicado/plotado são claramente distinguíveis. Filtrar o gráfico não altera os números oficiais da tabela do teste.
- Os eixos dos dois painéis são logarítmicos e mantêm a mesma escala ao filtrar. Barras verticais são intervalos empíricos, não uma série temporal.
- 04/01/2020 mostra papel independente, estimativa 427.1 MW e S-NPP 1,082.6 MW. A referência fica acima do intervalo superior de 957.9 MW. Isso não é, por si só, um bug: o intervalo não garante conter toda observação.
- Permanecem visíveis as limitações de treino, de 2025–2026 e a ausência de teste retroativo independente.

### Falhas e oportunidades a registrar

Treino apresentado como validação, total de pontos confundido com amostra de teste, filtro que muda silenciosamente a escala, critérios sem unidade, links quebrados, estado vazio incompreensível ou impossibilidade de entender o gráfico sem explicação técnica. Se o usuário pedir os valores de um ponto no celular e não conseguir acessá-los, registrar a dificuldade; não pressupor que hover seja uma alternativa de toque suficiente.

## Caso 5 — analista quer localizar e inspecionar uma detecção

### Necessidade da usuária

“Quero ver onde o satélite registrou atividade no Pantanal e conferir um registro individual, com data, plataforma, FRP e confiança.”

### Passo a passo

1. Abrir Map:
https://chronoflare.vercel.app/?view=map
2. Em Geographic view, escolher “Pantanal · IBGE 2025”. Em Detection source, escolher “VIIRS · S-NPP”.
3. Selecionar uma janela válida de 01/08/2020 a 15/08/2020 em From/To. Conferir o total de registros apresentado e a tabela.
4. Acionar “View on map” em uma linha. Localizar o ponto selecionado e seus detalhes. Conferir data/hora UTC, FRP, plataforma, código de confiança e identificação do registro.
5. Trocar Detection source para “MODIS · Terra + Aqua” e Platform para Terra, depois Aqua. Confirmar que o filtro e os registros mudam sem mostrar um ponto selecionado da fonte anterior como se pertencesse à nova.
6. Alternar Satellite context e Land cover. A camada MapBiomas deve ser opcional e restrita à vista disponível. Se um provedor externo falhar, verificar a mensagem e se os registros continuam acessíveis.
7. Trocar a vista para Brazil download. Verificar a orientação próxima do controle MapBiomas desabilitado. Navegar uma página da tabela e testar a rolagem horizontal no celular.
8. Voltar para Calendar. Confirmar que o site não apresenta esse mapa como os pontos exatos de qualquer ano/data do calendário.

### Resultado esperado

- Filtros, contagem, tabela e seleção individual permanecem coerentes. A fonte e a plataforma são identificadas.
- Confiança aparece como “Nominal (n)”, “High (h)” ou classe numérica com o valor original preservado. O mapa é uma revisão de detecções, não uma aprovação de todos os registros.
- O mapa é explicitamente uma entrega separada de agosto de 2020. Contexto visual não gera focos nem mede área queimada.
- Tabela e controles continuam acessíveis se o mapa-base ou a imagem externa estiverem indisponíveis; a interface explica a falha sem ficar vazia.
- A tabela não aumenta a largura de toda a página; a coluna de aquisição e a identificação do registro continuam compreensíveis ao rolar.

### Falhas e oportunidades a registrar

Ponto errado, seleção antiga após trocar fonte, rótulo sem significado, controle cortado, tabela inacessível no toque, imagem de contexto que parece dado científico, falha de tiles sem explicação. A ausência de um vínculo entre uma célula histórica e suas detecções exatas pode ser uma necessidade futura, mas o app atual não promete esse vínculo.

## Caso 6 — analista abre um link no celular durante uma reunião

### Necessidade do usuário

“Recebi o link de um resultado. Quero abrir no iPhone, entender os valores, mudar a data e voltar para o mesmo contexto sem precisar de um computador.”

### Passo a passo

1. Em iPhone/Safari e, se possível, Android/Chrome, abrir o link do caso 1 em uma aba privada. Confirmar que o conteúdo não depende de login.
2. Testar os quatro controles do calendário, rolar lateralmente até os dias finais do mês e selecionar um dia. Verificar se a dica de rolagem ajuda a descobrir os dias 10–31.
3. Abrir Compare with = 2024 e consultar um mês/dia usando o seletor, sem hover. Fazer o teste de 29/02 do caso 2.
4. Abrir Methodology, alternar os grupos dos gráficos e acessar links de evidência. Voltar usando o navegador e confirmar os filtros do calendário.
5. Girar o aparelho e repetir a seleção de data. A página não deve perder o resultado nem exigir rolagem lateral global; tabelas e gráficos podem ter rolagem interna identificada.
6. Se houver opção de acessibilidade, ativar movimento reduzido. Em conexão lenta ou com limitação de rede do navegador, observar o loader: sem porcentagem simulada ou etapas inventadas, e sem prender conteúdo pronto.
7. No desktop, usar só teclado: Tab até a célula ativa, setas para mover foco, Enter/Espaço para selecionar. Esquerda/direita mudam o dia; cima/baixo mudam o mês; Home/End ficam no mês. Verificar que há um único dia na ordem de Tab e que mover foco não seleciona automaticamente.
8. Usar “Skip to content” e, se disponível, VoiceOver/TalkBack para ouvir um dia com valor e um sem estimativa. Registrar repetições excessivas ou informações impossíveis de identificar.

### Resultado esperado

Os valores do desktop e do celular coincidem para o mesmo link. Seletores abrem, controles não se sobrepõem, datas inválidas não quebram a página, foco é visível e os dados podem ser entendidos sem depender de cor ou hover. O loader comunica espera real; a preferência de movimento reduzido é respeitada. Se surgir um erro de rede, há orientação legível em vez de dados falsos.

### Falhas e oportunidades a registrar

Página em branco no Safari, data mudando sozinha, controles abaixo da área visível sem indicação, teclado virtual cobrindo ação essencial, foco preso, gráfico ilegível, toque sem resposta, porcentagem fictícia ou ausência de alternativa de inspeção no toque. Se não houver como testar um recurso assistivo, marcar NÃO TESTADO, sem inferir aprovação.

## Modelo para reportar cada problema

- Identificador: UC2-01, por exemplo.
- Pessoa que testou; aparelho; sistema; navegador e versão.
- URL exata; cenário e passo.
- O que eu queria descobrir.
- O que fiz, em ordem.
- O que eu esperava; o que aconteceu.
- O problema impede concluir a tarefa ou apenas torna a leitura difícil?
- Frequência: sempre, às vezes ou ocorreu uma vez.
- Captura/vídeo e horário aproximado, sem informações privadas.
- Tipo: dado/interpretação, navegação, visual, acessibilidade ou rede externa.
- Prioridade sugerida: P0 = informação científica errada, falsa conversão em zero ou jornada central quebrada; P1 = tarefa essencial muito difícil ou inacessível; P2 = clareza/apresentação com alternativa viável.

## Perguntas finais para achar o que falta

Sem ajuda, a pessoa consegue explicar o que é observado e o que é estimado? Entende por que um dia está vazio? Consegue comparar o mesmo indicador em dois anos, compartilhar o contexto e reconhecer os limites recentes? Descobre quando está em treino ou teste? Entende que o mapa é um lote separado?

Se a tarefa exigir download de tabela, resumo compartilhável, tradução ou ligação exata calendário–mapa que não existe, registrar a necessidade e sua importância. Não tratá-la como funcionalidade já implementada. Separar uma quebra do comportamento prometido de uma nova oportunidade de produto.

Conclusão de cada pessoa: o que passou; três maiores dificuldades; o que bloquearia uma demonstração; o que pode esperar. Não alterar modelo ou critério científico para fazer um cenário passar. Antes de finalizar o vídeo, priorizar falhas de dados, Safari em branco, navegação quebrada e mensagens que induzam interpretações erradas.
