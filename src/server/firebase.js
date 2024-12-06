import admin from "firebase-admin"; // Importação do Firebase Admin SDK
import dotenv from "dotenv"; // Importando o dotenv para carregar variáveis de ambiente

// Carregando variáveis de ambiente
dotenv.config(); // Isso permite que você acesse as variáveis de ambiente do arquivo .env

// Inicializando o Firebase Admin SDK com a chave privada
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Corrige a chave privada para a forma correta
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

// Obtendo instâncias do Auth e Firestore
const auth = admin.auth(); // Instância do Firebase Auth para autenticação
const db = admin.firestore(); // Instância do Firestore para interações com o banco de dados

// Funções para realizar operações de autenticação e banco de dados
// const createUser = async (email, password) => {
//   try {
//     const userRecord = await auth.createUser({
//       email,
//       password,
//     });
//     console.log("Usuário criado com sucesso:", userRecord.uid);
//   } catch (error) {
//     console.error("Erro ao criar usuário:", error);
//   }
// };

const saveDataToFirestore = async (collection, data) => {
  try {
    const docRef = db.collection(collection).doc;
    await docRef.set(data);
    console.log("Dados salvos com sucesso:");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
  }
};

const updateDataToFirestore = async (collection, docId, data) => {
  try {
    const docRef = db.collection(collection).doc(docId);
    await docRef.update(data);
    console.log("Dados atualizados com sucesso:", docId);
  } catch (error) {
    console.error("Erro ao atualizar dados:", error);
  }
};

// Exportando as instâncias para uso posterior em outros arquivos
export { auth, db, saveDataToFirestore, updateDataToFirestore };
