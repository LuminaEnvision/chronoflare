# Feedback para André — indicador v1.1

André, obrigado! A v1.1 fechou os quatro pontos da Entrega 3; não ficaram novas
perguntas dessa entrega. Já implementamos filtro antes da deduplicação, desempate
determinístico, exigência D+N para a estimativa diária, semanas ISO com mínimo de
cinco dias pareados, regularização dos pesos e os pisos de amostra.

Usamos o documento principal v1.1 como canônico: valor semanal equivalente a sete
dias (`7/n × soma pareada`). A média diária fica apenas como diagnóstico. Assim,
os limiares de MAE da Entrega 4 precisam estar nessa mesma escala semanal. Também
fixamos `round(valor_float64, 5)` do Python, conforme o exemplo de implementação;
não presumimos que todo motor SQL/NumPy seja idêntico em empates de representação.

Reconstruímos os dois lotes sem novas chamadas à NASA. Após qualidade e seleção
pela chave, ficaram 5.227 observações em 2019 e 30.132 em 2020. Não houve exclusão
por duplicata nesses lotes. Todos os registros brutos e motivos continuam
preservados para auditoria.

O piso novo deixou claro o limite atual: temos apenas um ano no treino e menos de
30 dias pareados por estrato, então nenhum estrato pode ser calibrado ainda.
O Aqua noturno de 2020 também tem apenas 13 dias pareados, abaixo dos 15 do teste.
Não utilizamos dados de teste para completar o treino nem inventamos parâmetros.

A receita dos intervalos de 80% está registrada e a aritmética está testada, mas
os quantis reais ainda precisam vir do treino OOF e a cobertura precisa ser
validada. A harmonização continua bloqueada. Agora seguimos aguardando a Entrega 4
com os critérios de aprovação, além da ampliação dos dados por aqui. Não precisa
baixar novos arquivos nem reenviar os esclarecimentos anteriores.
