//Configuração inicial
const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");

//carregando variaveis ambiente
dotenv.config();
const urlApi = process.env.IFOOD_API_URL_ACCESSTOKEN;
const apiClientId = process.env.IFOOD_API_CLIENTID;
const apiClientSecret = process.env.IFOOD_API_CLIENTSECRET;

const app = express();

async function getAccessToken() {
  try {
    const data = new URLSearchParams();
    data.append("grantType", process.env.IFOOD_API_GRANT_TYPE);
    data.append("clientId", apiClientId);
    data.append("clientSecret", apiClientSecret);

    //Realizando busca do token
    const response = await axios.post(urlApi, data);

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

// getAccessToken()
//   .then((data) => {
//     console.log(data);
//   })
//   .catch((err) => {
//     console.error("Erro ao obter o token:", err.message);
//   });

app.post("/", (req, res) => {
  getAccessToken()
    .then((data) => {
      console.log(data);
    })
    .catch((err) => {
      console.error("Erro ao obter o token:", err.message);
    });
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
