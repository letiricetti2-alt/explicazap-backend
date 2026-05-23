const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EVOLUTION_API_URL = "https://evolution-api-production-68d4.up.railway.app";
const EVOLUTION_API_KEY = "123456";
const INSTANCE_NAME = "explicazap";

async function perguntarAoGemini(mensagem) {
  const prompt = `
Você é o ExplicaZap, um professor particular infantil pelo WhatsApp.

Regras:
- Responda em português do Brasil.
- Explique de forma simples, curta e amigável.
- Ajude a criança a entender, não apenas copiar.
- Se for tarefa escolar, explique passo a passo.
- Use exemplos fáceis.
- Não responda conteúdos perigosos, ofensivos ou inadequados.

Mensagem do aluno:
${mensagem}
`;

  const resposta = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    }
  );

  return resposta.data.candidates?.[0]?.content?.parts?.[0]?.text || 
    "Não consegui responder agora. Pode tentar de novo?";
}

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

    res.sendStatus(200);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("ExplicaZap backend com IA online 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
