const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EVOLUTION_API_URL = "https://evolution-api-production-68d4.up.railway.app";
const EVOLUTION_API_KEY = "123456";
const INSTANCE_NAME = "explicazap";

// Modelos em ordem de fallback
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
];

async function perguntarAoGemini(mensagem) {
  if (!GEMINI_API_KEY) {
    console.error("[GEMINI] GEMINI_API_KEY não definida nas variáveis de ambiente");
    return null;
  }

  const prompt = `Você é o ExplicaZap, um professor infantil especializado em ajudar crianças pelo WhatsApp.

Regras:
- Responda em português do Brasil.
- Explique de forma simples e divertida.
- Seja amigável e educativo.
- Use exemplos fáceis do dia a dia.
- Não dê respostas ofensivas ou inadequadas.
- Respostas curtas, no máximo 3 parágrafos.

Pergunta da criança:
${mensagem}`;

  for (const model of GEMINI_MODELS) {
    try {
      console.log(`[GEMINI] Tentando modelo: ${model}`);

      const resposta = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.7,
          },
        },
        { timeout: 15000 }
      );

      const texto = resposta.data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (texto) {
        console.log(`[GEMINI] Resposta recebida do modelo ${model} (${texto.length} chars)`);
        return texto.trim();
      }

      console.warn(`[GEMINI] Modelo ${model} retornou resposta sem texto:`, JSON.stringify(resposta.data));

    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      console.error(`[GEMINI] Erro no modelo ${model} — status: ${status}`);
      console.error(`[GEMINI] Detalhe:`, JSON.stringify(data || err.message));

      // 404 = modelo não encontrado, tenta o próximo
      // 403 = key inválida, não adianta tentar outro modelo
      if (status === 403) {
        console.error("[GEMINI] API Key inválida ou sem permissão. Verifique GEMINI_API_KEY no Railway.");
        return null;
      }
    }
  }

  console.error("[GEMINI] Todos os modelos falharam.");
  return null;
}

async function enviarWhatsApp(numero, texto) {
  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      { number: numero, text: texto },
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );
    console.log(`[WHATSAPP] Mensagem enviada para ${numero}`);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(`[WHATSAPP] Erro ao enviar — status: ${status}`);
    console.error(`[WHATSAPP] Detalhe:`, JSON.stringify(data || err.message));
  }
}

app.get("/", (req, res) => {
  res.send("ExplicaZap online 🚀");
});

app.post("/webhook", async (req, res) => {
  // Responde 200 imediatamente para a Evolution não retentar
  res.sendStatus(200);

  try {
    const evento = req.body.event;
    console.log(`[WEBHOOK] Evento recebido: ${evento}`);

    if (evento !== "messages.upsert") return;

    const data = req.body.data;
    if (!data) {
      console.warn("[WEBHOOK] Payload sem campo data");
      return;
    }

    if (data.key?.fromMe) {
      console.log("[WEBHOOK] Mensagem própria ignorada");
      return;
    }

    const numero = data.key?.remoteJid?.replace("@s.whatsapp.net", "");
    const mensagem =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    if (!numero || !mensagem) {
      console.warn(`[WEBHOOK] Número ou mensagem vazia — numero: ${numero}, mensagem: "${mensagem}"`);
      return;
    }

    console.log(`[WEBHOOK] Mensagem de ${numero}: "${mensagem}"`);

    const respostaIA = await perguntarAoGemini(mensagem);

    if (respostaIA) {
      await enviarWhatsApp(numero, respostaIA);
    } else {
      // Fallback caso a IA falhe
      const fallback = "Oi! 😊 Tive um probleminha aqui, mas já já volto. Pode me perguntar de novo daqui a pouco!";
      console.warn("[WEBHOOK] IA indisponível, enviando mensagem de fallback");
      await enviarWhatsApp(numero, fallback);
    }

  } catch (err) {
    console.error("[WEBHOOK] Erro inesperado:", err.message);
  }
});

app.listen(PORT, () => {
  console.log(`[SERVER] ExplicaZap rodando na porta ${PORT}`);
  console.log(`[SERVER] GEMINI_API_KEY configurada: ${!!GEMINI_API_KEY}`);
  console.log(`[SERVER] Evolution URL: ${EVOLUTION_API_URL}`);
  console.log(`[SERVER] Instância: ${INSTANCE_NAME}`);
});
