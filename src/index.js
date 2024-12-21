//Configuração inicial
const express = require("express");
const { addMinutes, format } = require("date-fns");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const { getInfoKeys, updateDataToFirestore } = require("./server/firebase");
const {
  buscarDadosCondicao,
  buscarDados,
  adicionarDados,
  atualizarDados,
} = require("./server/operacoesMysql");

//Carregando variaveis de ambiente
dotenv.config();

const app = express();
let tokenApiIfood; //TOKEN da API do IFood
let keysIfood; // Busca do clientId e clientSecret da minha aplicação IFOOD
let cad_integracoesFlyp = []; //Armazena os dados de todas as integrações dentro do FLYP
let cad_empresasFlyp = []; //Armazena os dados de cada cliente dentro do flyp
let dados_pedidosFlyp = []; //Armazena todos os dados dos pedidos que estão registradas no flyp

//Forma de ler JSON / middlewares
app.use(cors()); //Permite requisições de outras origens
app.use(morgan("dev")); //Log das requisições
app.use(express.json()); //PAra permitir o corpo das requisições em formato JSON
app.use(express.urlencoded({ extended: true })); //Para lidar com dados de formularios

//Função para buscar o token IFood
async function getAccessToken() {
  try {
    const data = new URLSearchParams();
    data.append("grantType", "client_credentials");
    data.append("clientId", keysIfood[0]?.clientId);
    data.append("clientSecret", keysIfood[0]?.clientSecret);

    //Realizando busca do token
    const response = await axios.post(
      "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",
      data
    );
    if (!response) {
      console.error("Erro ao buscar o token de acesso. Nenhum retorno da api");
      return;
    }
    tokenApiIfood = response?.data?.accessToken;
    console.log(response?.data?.accessToken);

    //Salvando TOKEN IFOOD no banco de dados FIREBASE
    const accessTokenData = {
      accessToken: String(tokenApiIfood),
    };
    const saveToken = await updateDataToFirestore(
      "accessToken",
      "D41XCuWy0HIGSInpeMnW",
      accessTokenData
    );

    //Garantindo que o token seja gerado novamente automaticamente 20 minutos antes de expirar
    const validacaoTempo = parseFloat(
      (response?.data?.expiresIn - 1200) * 1000
    );
    setInterval(() => {
      if (!keysIfood[0]?.clientId || !keysIfood[0]?.clientSecret) {
        fetchKeys();
      } else {
        getAccessToken();
      }
    }, validacaoTempo);
  } catch (error) {
    console.error(
      "Erro ao obter access token:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Não foi possível obter o access token.");
  }
}

// função para buscar credenciais da minha aplicação IFood
const fetchKeys = async () => {
  try {
    keysIfood = await getInfoKeys("keysIfood");
    if (!keysIfood[0]?.clientId || !keysIfood[0]?.clientSecret) {
      throw new Error("Não foi possível obter clientId, clientSecret.");
    } else {
      getAccessToken();
    }
  } catch (error) {
    console.error(
      "Erro ao obter keys:",
      error.response ? error.response.data : error.message
    );
  }
};

//Função para realizar operações no banco FLYP
const operacaoBancoFlyp = async (data) => {
  //Validando se a operação é de consulta, adicionar ou atualizar algum dado
  if (
    !data?.operacao === "consultar" &&
    !data?.operacao === "adicionar" &&
    !data?.operacao === "atualizar"
  ) {
    console.info(`Operação (${data?.operacao}), invalida no banco FLYP`);
    return;
  }

  console.log(
    `Processando requisição. Operação: (${data?.operacao}). Tabela: (${data?.nomeTabela})`
  );

  try {
    if (data?.operacao === "consultar") {
      const response = await buscarDados(data?.nomeTabela);
      console.log(
        `Requisição realizada com sucesso! Operação: (${data?.operacao}). Tabela: (${data?.nomeTabela})`
      );
      return response;
    } else if (data?.operacao === "adicionar") {
      await adicionarDados(data?.nomeTabela, data?.dados);
      console.log(
        `Requisição realizada com sucesso! Operação: (${data?.operacao}). Tabela: (${data?.nomeTabela})`
      );
    } else if (data?.operacao === "atualizar") {
      await atualizarDados(data?.nomeTabela, data?.dados, data?.condicao);
      console.log(
        `Requisição realizada com sucesso! Operação: (${data?.operacao}). Tabela: (${data?.nomeTabela})`
      );
    }
  } catch (error) {
    console.error(
      `Erro ao realizar operação no banco FLYP. ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função chamada para atualizar os dados quando uma nova integração for registrada no FLYP
const consultarIntegracoes = async () => {
  try {
    const dataCadIntegracao = {
      operacao: "consultar",
      nomeTabela: "cad_integracao",
    };
    const dataCadEmpresa = {
      operacao: "consultar",
      nomeTabela: "cad_empresa",
    };

    cad_integracoesFlyp = await operacaoBancoFlyp(dataCadIntegracao);
    cad_empresasFlyp = await operacaoBancoFlyp(dataCadEmpresa);
  } catch (error) {
    console.error(
      `Erro ao atualizar lista de empresas: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função chamada para atualizar os dados de todos os pedidos
const consultarDadosPedidosFlyp = async () => {
  try {
    const data = {
      operacao: "consultar",
      nomeTabela: "int_ifood",
    };
    dados_pedidosFlyp = await operacaoBancoFlyp(data);
  } catch (error) {
    console.error(
      `Erro ao atualizar lista de pedidos: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para abertura de um novo pedido
const aberturaNovoPedido = async (data, tokenClienteFlyp) => {
  const dataAbrirChamado = {
    forma_pagamento: data?.fmr_pagamento,
    empresa_id: 0,
    retorno: data?.corridaComRetorno ? "S" : "N",
    data: data?.data,
    hora: data?.hora,
    paradas: [
      {
        nome_cliente_parada: data?.nome_cliente_parada,
        telefone_cliente_parada: data?.telefone_cliente_parada,
        endereco_parada: /*data?.endereco_parada*/ "Rua AK, 60",
        bairro_parada: /*data?.bairro_parada*/ "Delfino Magalhães",
        cidade_parada: /*data?.cidade_parada*/ "Montes Claros",
        estado_parada: /*data?.estado_parada*/ "MG",
        // lat_parada: data?.lat_parada,
        // lng_parada: data?.lng_parada,
        codigo_confirmacao: "0500",
        id_externo: `IFOOD ${data?.displayId}`,
      },
    ],
  };
  try {
    const responseNovoPedido = await axios.post(
      `https://integracao.flyp.com.br/abrir_entrega`,
      dataAbrirChamado,
      {
        headers: {
          Authorization: `Bearer ${tokenClienteFlyp}`, // Cabeçalho com o Bearer token
        },
      }
    );
    return responseNovoPedido;
  } catch (error) {
    console.error(
      `Erro ao realizar pedido: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para salvar novo pedido no banco do flyp
const salvarNovoPedidoFlyp = async (dadosSalvarPedidoFlyp) => {
  try {
    const data = {
      operacao: "adicionar",
      nomeTabela: "int_ifood",
      dados: dadosSalvarPedidoFlyp,
    };

    await operacaoBancoFlyp(data);
  } catch (error) {
    console.error(
      `Erro ao salvar pedido no flyp: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para alterar dados no banco FLYP
const atualizarDadosFlyp = async (nomeTabela, data, condicao) => {
  const dataRequisicao = {
    operacao: "atualizar",
    nomeTabela: nomeTabela,
    dados: data,
    condicao: condicao,
  };
  await operacaoBancoFlyp(dataRequisicao);
};

//Função para realizar o cancelamento do pedido
const cancelamentoPedido = async (data, tokenClienteFlyp) => {
  let statusPedidoFlyp = data?.status;
  let idPedidoFlyp = data?.id_mch;
  if (
    statusPedidoFlyp === "E" ||
    statusPedidoFlyp === "F" ||
    statusPedidoFlyp === "N" ||
    statusPedidoFlyp === "C" ||
    statusPedidoFlyp === "A"
  ) {
    console.error(
      `Não é possível realizar o cancelamento da OS (${idPedidoFlyp}), devido seu status está em (${statusPedidoFlyp})`
    );
  } else {
    try {
      let responseCancelamentoPedido = await axios.post(
        `https://integracao.flyp.com.br/cancelar_entrega`,
        {
          id_mch: idPedidoFlyp,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenClienteFlyp}`,
          },
        }
      );
      if (responseCancelamentoPedido?.data?.success === true) {
        let dataAtual = new Date();
        let dataHoraFormatado = format(dataAtual, "yyyy-MM-dd HH:mm:ss");

        let dadosAtualizarStatus = {
          operacao: "atualizar",
          nomeTabela: "int_ifood",
          dados: {
            status: "C",
            dt_status: dataHoraFormatado,
          },
          condicao: {
            id_mch: idPedidoFlyp,
          },
        };
        operacaoBancoFlyp(dadosAtualizarStatus);
      }
    } catch (error) {
      console.error(
        `Erro ao cancelar entrega. ${error}`,
        error.response ? error.response.data : error.message
      );
    }
  }
};

//Função que irá direcionar cada webhook do IFood para sua ação especifica
async function acoesWebhooksIFood(data) {
  let direcionamentoCode = data?.code;
  let direcionamentoFullCode = data?.fullCode;

  //Verificando se o webhook é de validação online ifood
  if (
    direcionamentoCode === "KEEPALIVE" &&
    direcionamentoFullCode === "KEEPALIVE"
  ) {
    return;
  }

  let idClientIFood = data?.merchantId;
  let idPedido = data?.orderId;

  //Formantando data da criação para envio
  let dataOriginalCriacaoPedido = data?.createdAt;
  let dataOriginal = new Date(dataOriginalCriacaoPedido);

  let empresaFiltro = await cad_integracoesFlyp?.find(
    (data) => data?.int_token === idClientIFood && data?.integracao === "ifood"
  );
  let tempoEspera = empresaFiltro?.tempoantecedencia;
  let dataOriginalEspera = addMinutes(dataOriginal, tempoEspera || 0);
  let dataOriginalFormatadaEspera = format(dataOriginalEspera, "dd-MM-yyyy");
  let horaOriginalFormatadaEspera = format(dataOriginalEspera, "HH:mm");
  let dataCriacaoPedidoIFood = format(dataOriginal, "yyyy-MM-dd HH:mm:ss");
  let fmr_pagamento = empresaFiltro?.tipo;
  let empresa_id = empresaFiltro?.cli_id;
  let integracao_id = empresaFiltro?.id;
  let detalhesEmpresa = await cad_empresasFlyp?.find(
    (data) => data?.id_machine === empresa_id
  );
  let responseTokenFlyp;
  let tokenClienteFlyp;
  try {
    if (
      direcionamentoCode === "CFM" &&
      direcionamentoFullCode === "CONFIRMED"
    ) {
      //Rota para confirmação do pedido

      //Buscando um novo token de conexão com api FLYP
      responseTokenFlyp = await axios.post(
        `https://integracao.flyp.com.br/token`,
        {
          api_key: detalhesEmpresa?.api_key,
        }
      );
      console.log("responseTokenFlyp: ", responseTokenFlyp?.data);
      tokenClienteFlyp = String(responseTokenFlyp?.data?.token);

      //Buscando informações do pedido na API IFOOD
      let responsePedido = await axios.get(
        `https://merchant-api.ifood.com.br/order/v1.0/orders/${idPedido}`,
        {
          params: {
            id: idPedido,
          },
          headers: {
            Authorization: `Bearer ${tokenApiIfood}`,
          },
        }
      );
      // console.log(
      //   "Dados do pedido, vindo da API IFOOD: ",
      //   responsePedido?.data
      // );

      // //definindo se possui retorno na entrega
      let corridaComRetorno =
        await responsePedido?.data?.payments?.methods?.find(
          (data) => data?.method === "CREDIT" || data?.method === "DEBIT"
        );

      //Somando tempo de espera para chamar corrida
      // dataOriginal.setMinutes(dataOriginal.getMinutes() + tempoEspera);

      //Dados para abrir um chamado na API FLYP (nova corrida)
      let dadosAbrirChamado = {
        fmr_pagamento: String(fmr_pagamento),
        data: String(dataOriginalFormatadaEspera),
        hora: String(horaOriginalFormatadaEspera),
        corridaComRetorno: corridaComRetorno,
        nome_cliente_parada: String(responsePedido?.data?.customer?.name),
        telefone_cliente_parada: String(
          responsePedido?.data?.customer?.phone?.number
        ),
        endereco_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.streetName
        ),
        bairro_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.neighborhood
        ),
        cidade_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.city
        ),
        estado_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.state
        ),
        lat_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.coordinates?.latitude
        ),
        lng_parada: String(
          responsePedido?.data?.delivery?.deliveryAddress?.coordinates
            ?.longitude
        ),
        codigo_confirmacao: String(responsePedido?.data?.delivery?.pickupCode),
        displayId: String(responsePedido?.data?.displayId),
      };

      //Chama função  para abrir um chamado na API FLYP (nova corrida)
      let responseNovoPedido = await aberturaNovoPedido(
        dadosAbrirChamado,
        tokenClienteFlyp
      );

      //Se API FLYP retornar o código id_mch, é sinal que funcionou e abriu a entrega, seguimos a logica
      if (responseNovoPedido?.data?.response?.id_mch) {
        console.log(
          `Solicitação de entrega realizada com sucesso. Data prevista: (${dataOriginalFormatadaEspera}). Horas: (${horaOriginalFormatadaEspera})`
        );

        let dadosSalvarPedidoFlyp = {
          int_id: integracao_id,
          order_id: responsePedido?.data?.displayId,
          json: JSON.stringify(dadosAbrirChamado),
          status: "G",
          id_mch: responseNovoPedido?.data?.response?.id_mch,
          dt_criacao_pedido_ifood: dataCriacaoPedidoIFood,
          dt_status: dataCriacaoPedidoIFood,
          dt_registro_solicitacao_flyp: new Date(),
          dt_abertura_corrida_mch: `${dataOriginalFormatadaEspera}  ${horaOriginalFormatadaEspera}`,
          response: JSON.stringify(responseNovoPedido?.data),
          order_string: idPedido,
        };
        await salvarNovoPedidoFlyp(dadosSalvarPedidoFlyp);
      } else {
        console.error(
          `Não foi possivel receber o id_mch da API FLYP. Erro: `,
          responseNovoPedido?.data
        );
      }
    } else if (
      direcionamentoCode === "CAN" &&
      direcionamentoFullCode === "CANCELLED"
    ) {
      //Rota para cancelamento

      //Buscando um novo token de conexão com api FLYP
      responseTokenFlyp = await axios.post(
        `https://integracao.flyp.com.br/token`,
        {
          api_key: detalhesEmpresa?.api_key,
        }
      );
      tokenClienteFlyp = String(responseTokenFlyp?.data?.token);

      //Consulta dados atualizações dos pedidos anteriores registrado no banco FLYP
      await consultarDadosPedidosFlyp();

      //Filtrando o pedido que deseja ser cancelado
      let filtrarPedidoCancelamento = await dados_pedidosFlyp?.find(
        (data) => data?.order_string === idPedido
      );

      //Validando se o pedido foi encontrado
      if (filtrarPedidoCancelamento) {
        cancelamentoPedido(filtrarPedidoCancelamento, tokenClienteFlyp);
      } else {
        console.error(
          `Não foi localizado o pedido (${idPedido}) para cancelamento.`
        );
      }
    }
  } catch (error) {
    console.error(
      `Erro ao executar a ação: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
}

//Função que irá direcionar cada webhook do FLYP para sua ação especifica
async function acoesWebhooksFlyp(data) {
  // console.log(data);
  let direcionamento = data?.status_solicitacao;
  let id_mch = data?.id_mch;
  if (direcionamento === "C") {
    //Rota para webhook de cancelamento vindo do FLYP
    await consultarDadosPedidosFlyp();
    let validacaoIdMch = dados_pedidosFlyp?.find(
      (data) => data?.id_mch == id_mch
    );

    //validando se o id_mch recebido no webhook é valido no banco
    if (!validacaoIdMch) {
      console.error(`id_mch (${id_mch}) inválido!`);
      return;
    }

    //Caso encontre o id_mch
    try {
      //Realizando o cancelamento do pedido no IFOOD
      await axios.post(
        `https://merchant-api.ifood.com.br/order/v1.0/orders/${validacaoIdMch?.order_string}/requestCancellation`,
        {
          reason: "Pedido cancelado pela central de entregas.",
          cancellationCode: "501",
        },
        {
          headers: {
            Authorization: `Bearer ${tokenApiIfood}`, // Cabeçalho com o Bearer token
          },
        }
      );

      //Iniciando preparação para salvar alteração no banco FLYP
      let dataAtual = new Date();
      let dataHoraFormatado = format(dataAtual, "yyyy-MM-dd HH:mm:ss");
      let dadosRequisicao = {
        status: direcionamento,
        dt_status: dataHoraFormatado,
      };
      let condicaoRequisicao = {
        id_mch: id_mch,
      };
      atualizarDadosFlyp("int_ifood", dadosRequisicao, condicaoRequisicao);
    } catch (error) {
      console.error(`Erro ao cancelar o pedido  no IFOOD: ${error}`);
    }
  }
}

//Rota de teste para inciar a operação
app.post("/", (req, res) => {
  fetchKeys();
  // buscarDadosCondicao("api_machine", {id: "2454"})
  //   .then((data) => {
  //     console.log(data);
  //   })
  //   .catch((err) => {
  //     console.error(err); // Exibe erro, caso ocorra
  //   });
  res.status(200).send(`funcionando`);
  console.log("Iniciando");
});

//Rota para novos cadastros de integração
app.post("/novaIntegracao", (req, res) => {
  consultarIntegracoes();
  res.status(202).send(`Empresas Atualizadas`);
});

app.post("/webhooksFlyp", (req, res) => {
  let data = req?.body;
  acoesWebhooksFlyp(data);
  res.status(202).send(`Webhook recebido com sucesso!`);
});

// app.post("/teste", async (req, res) => {
//   await consultarDadosPedidosFlyp();
//   console.log(dados_pedidosFlyp);
//   res.status(200).send(`TESTE`);
// });

//Validando assinatura IFood
app.use("/webhook", (req, res, next) => {
  // 1. Recupera a assinatura recebida no header 'X-IFood-Signature'
  let signature = req?.headers["x-ifood-signature"];
  let apiClientSecret = keysIfood[0]?.clientSecret;

  if (!signature) {
    // Log de erro para depuração
    console.error("Assinatura não encontrada no cabeçalho");
    return res.status(400).json({ error: "Assinatura não encontrada" });
  }

  // 2. Recupere o corpo da requisição (payload) como string JSON
  let payload = JSON.stringify(req?.body);
  // console.log(payload);

  if (!payload) {
    console.error("Corpo da requisição (payload) está vazio ou inválido");
    return res.status(400).json({ error: "Corpo da requisição inválido" });
  }

  // 3. Gerar a assinatura HMAC usando minha chave
  let generatedSignature = crypto
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

//Rota inicial para webhooks
app.post("/webhook", (req, res) => {
  let dataBody = req?.body;
  console.log("Webhook recebido com sucesso!");
  console.log("headers: ", req?.headers["x-ifood-signature"]);
  console.log("body: ", req?.body);
  acoesWebhooksIFood(dataBody);
  res.status(202).send("Webhook processado com sucesso");
});

//configuração da porta, usando variavel de ambiente
const port = process.env.PORT || 8004;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
