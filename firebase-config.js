// ==============================
// Firebase の設定（みんなの単語帳で使う）
// ==============================
//
// Firebase コンソール →「プロジェクトの設定」→「マイアプリ」の
// 「SDK の設定と構成」に出てくる firebaseConfig の中身を、下の null の代わりに貼る。
//
// 例：
// const firebaseConfig = {
//   apiKey: "....",
//   authDomain: "....firebaseapp.com",
//   projectId: "....",
//   storageBucket: "....",
//   messagingSenderId: "....",
//   appId: "...."
// };
//
// ※ この値は公開しても大丈夫な情報（ブラウザに見える前提のもの）。
//   データの守りは Firebase 側の「セキュリティルール」（firestore.rules）で行う。
//
// まだ設定していないときは null のまま。みんなの単語帳は「準備中」と表示される。

const firebaseConfig = {
  apiKey: "AIzaSyDp96QxV__q4oW_SyxUDmRJBgy3hZqICKs",
  authDomain: "memorai-e85b1.firebaseapp.com",
  projectId: "memorai-e85b1",
  storageBucket: "memorai-e85b1.firebasestorage.app",
  messagingSenderId: "310184388096",
  appId: "1:310184388096:web:2c0e679b42159caa0b5ae5",
  measurementId: "G-R18WHJ8YKQ"
};
