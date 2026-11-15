# André: teste independente do candidato v2 de harmonização

Este documento pede duas coisas: entender onde estamos e responder por escrito a quatro
decisões. Você não precisa rodar nada: o registro, o download e a pontuação ficam com a
equipe, e só acontecem depois da sua resposta. Nada aqui muda o que você registrou: os
limites, o modelo v1 congelado e o Plano B continuam intactos.

## Onde estamos

1. **O v1 foi reprovado no teste direto**: viés semanal −36,6% e MAE de 7.165 MW contra
   4.716 MW do benchmark. O ajuste e as previsões reproduzem exatamente; não há erro de
   aritmética.
2. **Causas diagnosticadas** ([relatório](../harmonization-diagnostics.md)):
   - O EQM trunca nos nós extremos. Na seca, o modelo não emite mais que ~25,7 mil MW por
     dia, e o S-NPP observou mais que isso em 49 dos 286 dias de teste. Esses dias
     concentram 78% da FRP semanal e respondem por −29,0 dos −36,6 pontos de viés.
   - A noite do Terra está pareada com a passagem errada do S-NPP. As datas solares estão
     corretas, mas o Terra passa às 21h–23h e o S-NPP às 0h–2h: na mesma data solar as
     passagens ficam a ~21 horas; com a data seguinte, a ~3 horas. No treino, o Spearman
     é 0,79 com a data seguinte contra 0,57 com a mesma data.
   - Mediana das razões e EQM de 99 quantis subestimam totais em dados de cauda pesada, e
     o viés registrado é uma razão de somas.
3. **Candidato v2** ([descrição](../harmonization-v2-candidate.md)), treinado só com o
   treino e congelado antes de qualquer pontuação. SHA-256:
   `3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba`. Ele muda quatro
   coisas: a noite do Terra vai para a data solar seguinte; os candidatos extrapolam
   (razão das somas, EQM com caudas proporcionais, razão mediana); a seleção usa o MAE
   semanal combinado fora do fold; dias extrapolados são marcados, com intervalo mais largo.
4. **Checagem pós-hoc, feita uma única vez** nos testes já examinados. Na visão combinada
   o v2 cumpre todos os critérios: direto com viés +10,5%, Spearman 0,962 e MAE 4.105
   contra 4.126 MW do benchmark; retroativo com viés +12,6% e Spearman 0,925. Isso **não**
   é validação independente, porque esses testes informaram o diagnóstico. Ressalvas: a
   melhora de MAE no direto é mínima e o v2 superestima nos dois sentidos.

## Por que ainda existe um teste independente possível

A aquisição atual cobre só parte do período de teste: de 2017 a 2024 temos 126 dias por
ano (1 de fevereiro a 3 ou 4 de abril e 1 de agosto a 2 de outubro). O modelo direto do
v2 foi treinado até 2019. Toda data de 2020 em diante que nunca foi baixada é um teste
legítimo para ele.

O plano congelado `science/configs/independent_holdout_plan.json` lista exatamente essas
datas: 1.868 dias solares em 28 blocos, 790 requisições, mesma região, mesmas fontes
(MODIS_SP e VIIRS_SNPP_SP) e mesmas regras.

| Período | Datas novas |
| --- | --- |
| 2020 a 2024 | janeiro; do início de abril (dia 4 ou 5) a 31 de julho; 3 de outubro a 31 de dezembro |
| 2025 | o ano inteiro |
| 2026 | 1 de janeiro a 2 de novembro |

2016 fica de fora: cai na janela de treino e o v2 já está congelado.

## O que você precisa decidir (antes de qualquer download)

1. **Aceitar o v2 congelado como candidato**, sem nenhum ajuste e com os mesmos limites.
2. **Aceitar a mudança de pareamento da noite do Terra.** O alvo não muda (S-NPP dia +
   noite da data solar); só a passagem noturna do Terra passa a estimar a noite do S-NPP
   da data seguinte.
3. **Regra para o teste retroativo.** O período 2012–2015 está completo e examinado, então
   não existe teste retroativo independente para o v2, e a sua regra de decisão exige o
   retroativo. Diga se o resultado pós-hoc do v2 basta como evidência descritiva ou
   registre outra regra.
4. **Regra se faltar suporte.** O direto exige 120 dias pareados e 25 semanas elegíveis.
   Sugestão: se os dados novos ficarem abaixo disso, permanece o Plano B, sem completar
   com datas já examinadas.

Dois riscos para pesar:

- As órbitas do Terra e do Aqua vêm derivando nos últimos anos; a relação com o S-NPP em
  2025–2026 pode diferir da do treino. Se o v2 falhar por isso, é um resultado real.
- Os meses mais recentes de 2026 podem ainda não existir em processamento padrão (SP).
  Blocos incompletos ficam fora da pontuação e aparecem listados no relatório.

## Como responder

Responda por mensagem à equipe, com as quatro decisões:

- (a) Aceita o v2 congelado como candidato, sem ajustes e com os seus limites? Sim ou não.
- (b) Aceita a mudança de pareamento da noite do Terra? Sim ou não.
- (c) Qual regra vale para o teste retroativo?
- (d) O que acontece se faltar suporte?

Se a resposta a (a) ou (b) for não, nada é baixado e permanece o Plano B, que continua
sendo a decisão oficial.

## O que a equipe faz com a sua resposta

1. **Registra as decisões em seu nome**, no arquivo
   `science/configs/independent_holdout.registration.json`, citando a sua mensagem e
   indicando quem a transcreveu. O commit desse arquivo vem antes de qualquer download:
   sem ele, o workflow e os scripts recusam a execução. Depois que alguém olhar os dados
   novos, eles deixam de ser independentes.
2. **Baixa os dados** pelo workflow *Independent holdout acquisition* e reconstrói as
   observações.
3. **Pontua uma única vez** o v2 congelado, só nas datas novas.
4. **Envia a você o resultado completo**, passe ou não. O relatório informa se todos os
   critérios registrados da visão combinada foram cumpridos. O script nunca aprova a
   harmonização: a decisão final entre Plano A e Plano B é sua, aplicando a regra
   registrada.

## Referência para a equipe: registro, download e pontuação

1. Copie `science/configs/independent_holdout.registration.proposed.json` para
   `science/configs/independent_holdout.registration.json`. Troque `status` para
   `registered`, preencha `registered_by` com o nome do André e `registered_at_utc` (UTC,
   terminando em `Z`), marque as duas decisões `accept_*` como `true` e escreva as regras
   (c) e (d) com as palavras dele. Acrescente um campo com a citação da mensagem e o nome
   de quem transcreveu. Faça o commit na `main` antes do passo seguinte.
2. Em Actions, rode o workflow **Independent holdout acquisition**. Se parar por limite
   da chave, rode de novo informando o `resume_run_id` da execução anterior.
3. Baixe os artefatos e pontue uma única vez:

```sh
gh run download 43719416857 --name scientific-experiment-evidence --dir science/outputs/harmonization-review
gh run download <RUN_ID> --name independent-holdout-observed --dir science/outputs/independent-holdout
python3 science/scripts/run_harmonization_v2.py score-independent \
  --observations science/outputs/harmonization-review/source-reconstruction/observations.json \
  --holdout-observations science/outputs/independent-holdout/observations.json \
  --frozen-dir docs/multiyear-evidence/v2-candidate \
  --expected-sha256 3c39071a245d071c60e0838d6092a793190f98e2416e2074bbf75911e00aa3ba \
  --output science/outputs/independent-holdout/score
```
