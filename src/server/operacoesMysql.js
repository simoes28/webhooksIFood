const { pool } = require("./mysqlConfig");

// Função para buscar dados gerais das empresas nas tabelas FLYP
async function buscarDados(nomeTabela) {
  try {
    const conexao = await pool.promise().getConnection(); // Usando pool.promise() para usar async/await
    const sql = `SELECT * FROM ??`;
    const [results] = await conexao.query(sql, [nomeTabela]);
    conexao.release(); // Libera a conexão para o pool
    return results;
  } catch (err) {
    console.error("Erro ao consultar os dados: " + err.stack);
    throw new Error("Erro ao consultar os dados: " + err.stack);
  }
}

// Função para busca de dados com condições nas tabelas FLYP
async function buscarDadosCondicao(nomeTabela, condicao) {
  try {
    const conexao = await pool.promise().getConnection();
    const sql = `SELECT * FROM ?? WHERE ?`;
    const [results] = await conexao.query(sql, [nomeTabela, condicao]);
    conexao.release();
    return results;
  } catch (err) {
    console.error("Erro ao consultar os dados: " + err.stack);
    throw new Error("Erro ao consultar os dados: " + err.stack);
  }
}

// Função para adicionar dados
async function adicionarDados(nomeTabela, dados) {
  try {
    const conexao = await pool.promise().getConnection();
    const sql = `INSERT INTO ?? SET ?`;
    const [results] = await conexao.query(sql, [nomeTabela, dados]);
    conexao.release();
    return results;
  } catch (err) {
    console.error("Erro ao inserir os dados: " + err.stack);
    throw new Error("Erro ao inserir os dados: " + err.stack);
  }
}

// Função para atualizar dados
async function atualizarDados(nomeTabela, dados, condicao) {
  try {
    const conexao = await pool.promise().getConnection();
    const sql = `UPDATE ?? SET ? WHERE ?`;
    const [results] = await conexao.query(sql, [nomeTabela, dados, condicao]);
    conexao.release();
    return results;
  } catch (err) {
    console.error("Erro ao atualizar os dados: " + err.stack);
    throw new Error("Erro ao atualizar os dados: " + err.stack);
  }
}

module.exports = {
  buscarDadosCondicao,
  buscarDados,
  adicionarDados,
  atualizarDados,
};