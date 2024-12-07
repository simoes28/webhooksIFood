//Configuração inicial
const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const { getInfoKeys } = require("./server/firebase");

dotenv.config();

const app = express();
let keysIfood;

async function getAccessToken() {
  try {
    console.log("teste", keysIfood);
    const data = new URLSearchParams();
    data.append("grantType", "client_credentials");
    data.append("clientId", keysIfood?.clientId);
    data.append("clientSecret", keysIfood?.clientSecret);

    console.log(data);

    //Realizando busca do token
    if (keysIfood?.clientId && keysIfood?.clientSecret) {
      const response = await axios.post(
        "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",
        data
      );
    }
    //resposta
    return response?.data;
  } catch (error) {
    console.error(
      "Erro ao obter access token:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Não foi possível obter o access token.");
  }
}

//BUscando credenciais api
const fetchKeys = async () => {
  try {
    keysIfood = await getInfoKeys("keysIfood");
    console.log(keysIfood);
    getAccessToken();
  } catch (error) {
    console.error(
      "Erro ao obter keys:",
      error.response ? error.response.data : error.message
    );
  }
};
app.post("/", (req, res) => {
  fetchKeys();

  res.status(200).send(`funcionando`);
  console.log("Funcionou");
});

//middlewares validação de assinaturas
app.use("/webhook", (req, res, next) => {
  // 1. Recupere a assinatura recebida no header 'X-IFood-Signature'
  const signature = req.headers["x-ifood-signature"];

  if (!signature) {
    // Log de erro para depuração
    console.error("Assinatura não encontrada no cabeçalho");
    return res.status(400).json({ error: "Assinatura não encontrada" });
  }

  // 2. Recupere o corpo da requisição (payload) como string JSON
  const payload = JSON.stringify(req.body);

  // 3. Gerar a assinatura HMAC usando minha chave
  const generatedSignature = crypto
    .createHmac("sha256", apiClientSecret)
    .update(payload)
    .digest("hex"); //A assinatura será gerada em hexadecimal

  // 4. Comparar a assinatura gerada com a assinatura recebida
  if (generatedSignature === signature) {
    return next();
  }

  //Caso a assinatura não sejá reconhecida:
  console.error("Assinatura inválida");
  return res.status(403).json({ error: "Assinatura inválida" });
});

//Forma de ler JSON / middlewares
app.use(cors()); //Permite requisições de outras origens
app.use(morgan("dev")); //Log das requisições
app.use(express.json()); //PAra permitir o corpo das requisições em formato JSON
app.use(express.urlencoded({ extended: true })); //Para lidar com dados de formularios

//Rota inicial
app.post("/webhook", (req, res) => {
  console.log("Webhook recebido com sucesso!");
  res.status(202).send("Webhook processado com sucesso");
});

//configuração da porta, usando variavel de ambiente
const port = process.env.PORT || 8004;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
