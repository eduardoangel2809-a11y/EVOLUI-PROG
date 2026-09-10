/**
 * Cloud Function: analyzeFoodPhoto
 * Recebe uma foto (base64) do app Evoluir, envia para a API do Google Gemini
 * (camada gratuita, sem cartão de crédito) pedindo uma estimativa nutricional em
 * JSON, e devolve o resultado ao app.
 *
 * A chave da API fica só aqui no servidor — nunca no HTML/JS do app.
 *
 * DEPLOY:
 *   1. Crie uma chave gratuita em https://aistudio.google.com/apikey (não pede cartão)
 *   2. cd functions && npm install
 *   3. firebase functions:secrets:set GEMINI_API_KEY
 *      (cole a chave gerada no passo 1 quando solicitado)
 *   4. firebase deploy --only functions
 *   5. Copie a URL gerada e cole em FOOD_PHOTO_FUNCTION_URL no evoluir.html
 *
 * OBS: os modelos e limites gratuitos do Gemini mudam com frequência — confira o
 * modelo atual disponível na camada gratuita em https://ai.google.dev/gemini-api/docs/pricing
 * e ajuste a constante GEMINI_MODEL abaixo se necessário.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash"; // troque aqui se o modelo gratuito mudar

const PROMPT = `Você é um assistente de nutrição. Olhe a foto de uma refeição e estime, de forma realista:
- um nome curto para o prato
- os alimentos e porções aproximadas visíveis
- calorias totais (kcal)
- proteínas, carboidratos e gorduras totais (em gramas)

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, sem markdown, neste formato exato:
{"nome":"string","itens":[{"alimento":"string","porcao":"string"}],"kcal":number,"proteinas":number,"carboidratos":number,"gorduras":number}

Se a imagem não mostrar comida com clareza, ainda assim retorne sua melhor estimativa possível e um nome como "Prato não identificado com clareza".`;

exports.analyzeFoodPhoto = onRequest(
  { secrets: [GEMINI_API_KEY], cors: true, region: "us-central1" },
  async (req, res) => {
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST") { res.status(405).json({ error: "Método não permitido" }); return; }

    try {
      const { imageBase64, mediaType } = req.body || {};
      if (!imageBase64) { res.status(400).json({ error: "imageBase64 é obrigatório" }); return; }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY.value()}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mediaType || "image/jpeg", data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.2 }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Erro da API Gemini:", data);
        res.status(502).json({ error: "Falha ao analisar a imagem" });
        return;
      }

      const textBlock = data?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
      if (!textBlock) { res.status(502).json({ error: "Resposta sem conteúdo de texto" }); return; }

      let parsed;
      try {
        const clean = textBlock.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
        parsed = JSON.parse(clean);
      } catch (e) {
        console.error("Erro ao interpretar JSON da IA:", textBlock);
        res.status(502).json({ error: "Resposta da IA em formato inesperado" });
        return;
      }

      res.status(200).json(parsed);
    } catch (err) {
      console.error("Erro interno:", err);
      res.status(500).json({ error: "Erro interno ao analisar a foto" });
    }
  }
);

