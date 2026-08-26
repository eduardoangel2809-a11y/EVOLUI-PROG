# Reconhecimento de foto por IA — Evoluir

Esta função conecta o app à **API do Google Gemini** (camada gratuita, sem cartão de
crédito) para estimar calorias e macros a partir de uma foto do prato. A chave da API
fica só no servidor (nunca no HTML do app).

## Passo a passo

1. Crie uma chave de API gratuita em **https://aistudio.google.com/apikey**
   (login com conta Google, sem cartão de crédito).
2. Se ainda não tiver, instale o Firebase CLI: `npm install -g firebase-tools`
3. `firebase login`
4. Na raiz do seu projeto Firebase (onde fica o `firebase.json`), copie a pasta `functions/` para lá.
5. `cd functions && npm install`
6. Configure sua chave do Gemini como secret:
   `firebase functions:secrets:set GEMINI_API_KEY`
   (cole a chave gerada no passo 1 quando solicitado)
7. Deploy: `firebase deploy --only functions`
8. O terminal vai mostrar a URL da função, algo como:
   `https://us-central1-SEU_PROJETO.cloudfunctions.net/analyzeFoodPhoto`
9. Cole essa URL na constante `FOOD_PHOTO_FUNCTION_URL` no topo do `<script>` de `evoluir.html`.

## Sobre o custo e os limites

- A camada gratuita do Gemini **não pede cartão de crédito** e cobre o uso de um app
  pessoal/uso moderado sem custo.
- Ela tem **limites diários de requisições** que o Google ajusta com frequência (já
  reduziu esses limites mais de uma vez em 2026). Se um dia o limite for atingido, a
  função devolve erro e o app mostra a mensagem de "não foi possível analisar agora",
  permitindo registrar o alimento manualmente.
- Prompts e imagens enviados na camada gratuita podem ser usados pelo Google para
  melhorar os produtos deles — isso não acontece nas camadas pagas.
- O modelo usado é definido na constante `GEMINI_MODEL` em `functions/index.js`
  (atualmente `gemini-2.5-flash`). Se o Google descontinuar esse modelo na camada
  gratuita, confira o modelo atual em https://ai.google.dev/gemini-api/docs/pricing
  e troque o valor da constante.

## Fotos de evolução (Firebase Storage)

As fotos de evolução (frente/lado/costas) são enviadas direto do app para o Firebase
Storage — não passam pela Cloud Function. Para funcionar:

1. No Firebase Console, ative o **Storage** do seu projeto (se ainda não estiver ativo).
2. Configure as regras de segurança para que cada usuário só acesse suas próprias fotos,
   por exemplo:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/fotosEvolucao/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Nenhuma configuração extra é necessária no `evoluir.html` além do `firebaseConfig`
   já preenchido no topo do arquivo (o mesmo projeto usado para Auth e Firestore).
