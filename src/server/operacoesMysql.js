const { conexaoMySql } = require("./mysqlConfig");

//Função para busca de dados gerais das empresas nas tabelas FLYP
function buscarDados(nomeTabela) {
  return new Promise((resolve, reject) => {
    //Usando ? para evitar SQL injection
    const sql = `SELECT * FROM ??`;
    conexaoMySql.query(sql, [nomeTabela], (err, results) => {
      if (err) {
        reject("Erro ao consultar os dados: " + err.stack);
      } else {
        resolve(results);
      }
    });
  });
}

//Função para busca de dados com condições nas tabelas FLYP
function buscarDadosCondicao(nomeTabela, condicao) {
  return new Promise((resolve, reject) => {
    //Usando ? para evitar SQL injection
    const sql = `SELECT * FROM ?? WHERE ?`;
    conexaoMySql.query(sql, [nomeTabela, condicao], (err, results) => {
      if (err) {
        reject("Erro ao consultar os dados: " + err.stack);
      } else {
        resolve(results);
      }
    });
  });
}

//Função para adicionar dados
function adicionarDados(nomeTabela, dados) {
  return new Promise((resolve, reject) => {
    // Usando placeholders para segurança e evitando SQL Injection
    const sql = `INSERT INTO ?? SET ?`;

    conexaoMySql.query(sql, [nomeTabela, dados], (err, results) => {
      if (err) {
        reject("Erro ao inserir os dados: " + err.stack);
      } else {
        resolve(results);
      }
    });
  });
}

// Função para atualizar dados
function atualizarDados(nomeTabela, dados, condicao) {
  return new Promise((resolve, reject) => {
    // Usando placeholders para segurança e evitando SQL Injection
    const sql = `UPDATE ?? SET ? WHERE ?`;

    conexaoMySql.query(sql, [nomeTabela, dados, condicao], (err, results) => {
      if (err) {
        reject("Erro ao atualizar os dados: " + err.stack);
      } else {
        resolve(results);
      }
    });
  });
}

module.exports = {
  buscarDadosCondicao,
  buscarDados,
  adicionarDados,
  atualizarDados,
};
