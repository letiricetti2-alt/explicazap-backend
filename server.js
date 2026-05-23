const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post("/webhook", async (req, res) => {
  try {
    console.log("Mensagem recebida:");
    console.log(JSON.stringify(req.body, null, 2));

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

    console.log(`Mensagem de ${numero}: ${mensagem}`);

    await axios.post(
      "https://evolution-api-production-68d4.up.railway.app/message/sendText/explicazap",
      {
        number: numero,
        text: `Você disse: ${mensagem}`
      },
      {
        headers: {
          apikey: "123456",
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
  res.send("Backend online 🚀");
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
