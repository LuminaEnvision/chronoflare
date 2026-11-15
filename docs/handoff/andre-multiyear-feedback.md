# André — resultado real do treinamento e da validação

Concluímos a aquisição pela API e a execução científica: 1.012 requisições,
2.450 dias solares candidatos e 514.168 detecções após qualidade e deduplicação.
A amostra cumpriu os mínimos: teste direto com 286 dias/25 semanas; retroativo
com 424 dias/34 semanas. Não precisamos baixar a base inteira nem de outra chave.

Os dois modelos foram ajustados separadamente, com seleção, pesos e resíduos
somente no treino, e congelados antes da avaliação final. No teste combinado:

- Direto: Spearman 0,867; PBias −36,58%; rMAE 0,375; cobertura diária dos
  intervalos 70,98%. O viés excedeu o limite de ±25%.
- O MAE calibrado foi 7.164,82 MW, contra 4.716,02 MW da comparação ingênua no
  mesmo conjunto de dias/semanas: não houve a melhora obrigatória.
- Retroativo: Spearman 0,918; PBias +16,45%; cobertura 75,71%. Os critérios
  combinados registrados para esse experimento passaram.

Portanto, o resultado é Plano B por desempenho real no teste direto — não mais
por falta de amostra ou por teste não executado. Mantivemos os limiares e não
ajustamos parâmetros depois de ver esses resultados para tentar aprovar.

Também preservamos uma linha com FRP negativo e 228 com FRP zero na auditoria,
excluindo-as cientificamente sem convertê-las em dias sem fogo. Uma duplicata
técnica foi removida após o filtro de qualidade.

Os parâmetros completos, pesos, quantis, folds e hashes estão em
`docs/multiyear-evidence/frozen-models.json`; as métricas de todas as visões estão
em `experiment-summary.json`. Os artefatos brutos permanecem disponíveis no
Actions por 90 dias, devendo ser preservados antes do vencimento.

Quando puder, sua leitura científica dos resultados será útil para a próxima
iteração. As regras das Entregas 3 e 4 estão implementadas; não há novo pedido
de especificação nem download manual agora. Qualquer novo método precisará de
uma nova avaliação independente, preservando esse resultado como ele é.

A combinação ingênua está documentada como MODIS nativo sem calibração, com os
mesmos pesos convexos congelados e a mesma disponibilidade de plataformas.
Ela foi apenas benchmark: seu desempenho não aprova juntar escalas originais.
A referência espacial oficial e a publicação de qualquer série derivada seguem
separadas da decisão numérica; a interface não habilitou harmonização.
