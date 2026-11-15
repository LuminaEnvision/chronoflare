# André: resultado do teste independente do candidato v2

O teste que você autorizou foi executado. As suas quatro decisões foram registradas
(commit `4d265ad`) antes de qualquer download. Depois disso, baixamos as 1.868 datas que
nunca tinham sido examinadas (790 requisições, 28 blocos, nenhum bloco faltando) e
pontuamos o v2 congelado uma única vez, sem nenhum ajuste.

## Resultado

Visão combinada Terra + Aqua, modelo direto treinado em 2012–2019, com os seus limites:

| Métrica | v2 no teste independente | Benchmark, mesmos dias | Limite registrado | Passou |
| --- | --- | --- | --- | --- |
| Dias pareados / semanas elegíveis | 506 / 40 | iguais | pelo menos 120 / 25 | sim |
| Viés semanal (PBias) | −1,0% | −29,4% | entre −25% e +25% | sim |
| Spearman semanal | 0,965 | 0,971 | pelo menos 0,75 | sim |
| MAE semanal (MW) | 1.676 | 2.589 | abaixo do benchmark | sim |
| rMAE | 0,200 | 0,308 | no máximo 0,45 | sim |
| Cobertura dos intervalos diários | 72,7% | — | 70% a 92% | sim |
| Largura relativa mediana do intervalo | 1,74 | — | no máximo 2,0 | sim |

Todos os critérios registrados do teste direto, na visão combinada, foram cumpridos.

## O que pesar antes de decidir

- **Os anos recentes pesam pouco.** Dias pareados por ano: 143 (2020), 83 (2021),
  66 (2022), 73 (2023), 100 (2024), 28 (2025) e 13 (2026). O resultado diz mais sobre
  2020–2024 do que sobre 2025–2026.
- **O benchmark ainda ordena as semanas um pouco melhor** (Spearman 0,971 contra 0,965).
  O ganho do v2 está na magnitude, onde o benchmark subestima 29%.
- **A cobertura dos intervalos está perto do piso** (72,7% para um mínimo de 70%).
- **35 dos 506 dias** estão marcados como extrapolados além da faixa de treino.
- **Não existe teste retroativo independente.** Pela regra que você registrou, o resultado
  pós-hoc do v2 no retroativo (viés +12,6%, Spearman 0,925) vale como evidência descritiva.

## O que falta

A decisão entre Plano A e Plano B é sua. O script de pontuação nunca aprova a
harmonização, e nada no aplicativo foi alterado: o Plano B continua em vigor até você
decidir. Responda à equipe com a sua decisão e, se for Plano A, com o que pode ser
afirmado na entrega.

Detalhes completos: `docs/harmonization-v2-candidate.md` e
`docs/multiyear-evidence/v2-candidate/independent-summary-v2.json`.
