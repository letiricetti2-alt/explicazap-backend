const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const EVOLUTION_API_URL =
  "https://evolution-api-production-68d4.up.railway.app";

const EVOLUTION_API_KEY = "123456";

const INSTANCE_NAME = "explicazap";

async function perguntarAoGemini(mensagem) {
  const prompt = `
Você é o ExplicaZap, um professor infantil especializado em ajudar crianças pelo WhatsApp.

Regras:
- Responda em português do Brasil.
- Explique de forma simples.
- Seja amigável e educativo.
- Use exemplos fáceis.
- Não dê respostas ofensivas ou inadequadas.
- Ajude a criança a aprender.

Pergunta:
${mensagem}
`;

  const resposta = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    }
  );

  return (
    resposta.data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Não consegui responder agora 😢"
  );
}

app.get("/", (req, res) => {
  res.send("ExplicaZap online 🚀");
});

app.post("/webhook", async (req, res) => {
  try {
    const evento = req.body.event;

    if (evento !== "messages.upsert") {
      return res.sendStatus(200);
    }

    const data = req.body.data;

    if (data.key.fromMe) {
      return res.sendStatus(200);
    }

    const numero = data.key.remoteJid.replace("@s.whatsapp.net", "");

    const mensagem =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    if (!mensagem) {
      return res.sendStatus(200);
    }

    console.log(`Mensagem recebida de ${numero}: ${mensagem}`);

    const respostaIA = await perguntarAoGemini(mensagem);

    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        number: numero,
        text: respostaIA
      },
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error(error.response?.data || error.message);

    return res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
