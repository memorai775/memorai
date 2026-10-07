// ==============================
// みんなの単語帳
// 利用者が作った単語帳を投稿・取り込みできる（Firebase を使う）
// app.js・mydecks.js の関数を使うので、その2つのあとに読み込む
// ==============================


// ------------------------------
// 決まりごと（firestore.rules と同じ数字にしておく）
// ------------------------------

const COMMUNITY_LIMITS = {
  title: 40,
  description: 200,
  nickname: 20,
  subject: 20,
  cardText: 200,
  maxCards: 500
};

// この件数以上通報された単語帳は一覧に出さない
const COMMUNITY_HIDE_REPORTS = 3;

// 一覧に読み込む件数（新着順）
const COMMUNITY_LIST_SIZE = 100;

const REPORT_REASONS = [
  "市販の単語帳・教科書などの丸写し",
  "不適切な内容",
  "内容がまちがいだらけ",
  "宣伝・いたずら",
  "その他"
];


// ------------------------------
// Firebase の準備
// ------------------------------

let communityDb = null;

let communityAuth = null;


// 使える状態なら true（設定がない・オフラインで SDK が読めないときは false）
function initCommunity() {

  if (communityDb) {

    return true;
  }


  if (
    typeof firebase === "undefined" ||
    typeof firebaseConfig === "undefined" ||
    !firebaseConfig
  ) {

    return false;
  }


  if (!firebase.apps.length) {

    firebase.initializeApp(firebaseConfig);
  }

  communityDb = firebase.firestore();

  communityAuth = firebase.auth();

  return true;
}


// ログイン状態が読み込まれるのを待ってから、ログイン中のユーザー（いなければ null）を返す
function getCommunityUser() {

  return new Promise(resolve => {

    const unsubscribe =
      communityAuth.onAuthStateChanged(user => {

        unsubscribe();

        resolve(user);
      });
  });
}


// ★ボタンを押した処理の中で、await より前に呼ぶこと
//   （iPhone の Safari などは、少し待ってから開くログイン画面をブロックする）
async function communitySignIn() {

  try {

    await communityAuth.signInWithPopup(
      new firebase.auth.GoogleAuthProvider()
    );

    return true;

  } catch (error) {

    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {

      return false;
    }


    const messages = {
      "auth/popup-blocked":
        "ログイン画面がブロックされました。ブラウザのポップアップの設定を確認してください。",
      "auth/unauthorized-domain":
        "このサイトからのログインが許可されていません（運営の設定待ちです）。",
      "auth/operation-not-supported-in-this-environment":
        "この開き方ではログインできません。ホーム画面のアイコンからではなく、Safari や Chrome で開いてください。",
      "auth/network-request-failed":
        "インターネットにつながっていないようです。"
    };

    alert(
      "ログインできませんでした。\n" +
      (messages[error.code] || "時間をおいてもう一度試してください。") +
      "\n（" + error.code + "）"
    );

    return false;
  }
}


// ログイン済みならそのユーザー、まだなら Google ログインを開いて、ログインできたユーザーを返す（できなければ null）
// ログイン状態はアプリを開いたときに読み込み始めているので、currentUser をそのまま使ってすぐにログイン画面を開く
async function requireCommunityUser() {

  if (!navigator.onLine) {

    alert("みんなの単語帳はインターネットにつながっているときだけ使えます。");

    return null;
  }


  if (!initCommunity()) {

    alert("みんなの単語帳は準備中です。もうしばらくお待ちください。");

    return null;
  }


  if (communityAuth.currentUser) {

    return communityAuth.currentUser;
  }

  const ok =
    await communitySignIn();

  return ok ? communityAuth.currentUser : null;
}


function getNickname() {

  return localStorage.getItem("memorai_nickname") || "";
}


function saveNickname(nickname) {

  localStorage.setItem("memorai_nickname", nickname);
}


// 投稿日などの表示（例：2026/10/07）
function formatDeckDate(timestamp) {

  if (!timestamp) {

    return "";
  }

  const date = timestamp.toDate();

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}


// すでに取り込んだ単語帳か
function isDeckImported(deckId) {

  return getMyDecks().some(deck => deck.importedFrom === deckId);
}


// 投稿できる自分の単語帳（自分で作ったもの・カードが1枚以上・まだ投稿していない）
function getPostableMyDecks() {

  const allCards = getCards();

  return getMyDecks().filter(
    deck =>
      !deck.importedFrom &&
      !deck.postedId &&
      getMyDeckCards(deck.id, allCards).length > 0
  );
}


// 画面上部の「← 戻る」
function backHeaderHTML() {

  return `
    <div class="study-header">

      <button id="backButton">
        ← 戻る
      </button>

    </div>
  `;
}


function showCommunityMessage(message) {

  document.querySelector("main").innerHTML = `

    <h1 class="page-title">
      みんなの単語帳
    </h1>

    <div class="form-card">
      <p class="community-note">
        ${message}
      </p>
    </div>

  `;
}


// ------------------------------
// 一覧画面
// ------------------------------

async function showCommunityPage(selectedSubject = "") {

  setActiveNav("communityNavButton");


  if (!navigator.onLine) {

    showCommunityMessage(
      "みんなの単語帳はインターネットにつながっているときだけ使えます。"
    );

    return;
  }


  if (!initCommunity()) {

    showCommunityMessage(
      "みんなの単語帳は準備中です。もうしばらくお待ちください。"
    );

    return;
  }


  showCommunityMessage("読み込み中…");


  let user;

  let decks;

  try {

    user = await getCommunityUser();

    const snapshot =
      await communityDb
        .collection("decks")
        .orderBy("createdAt", "desc")
        .limit(COMMUNITY_LIST_SIZE)
        .get();

    decks =
      snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(deck => (deck.reportCount || 0) < COMMUNITY_HIDE_REPORTS);

  } catch (error) {

    showCommunityMessage(
      "読み込めませんでした。時間をおいてもう一度開いてください。（" + escapeHTML(error.code || error.message) + "）"
    );

    return;
  }


  const subjects =
    [...new Set(decks.map(deck => deck.subject))];

  const shownDecks =
    selectedSubject
      ? decks.filter(deck => deck.subject === selectedSubject)
      : decks;


  const subjectOptions =
    ["", ...subjects]
      .map(subject => `
        <option
          value="${escapeHTML(subject)}"
          ${subject === selectedSubject ? "selected" : ""}
        >
          ${subject ? escapeHTML(subject) : "すべての科目"}
        </option>
      `)
      .join("");


  const deckHTML =
    shownDecks.length === 0
      ? `
        <div class="no-weak-card">
          まだ単語帳がありません。最初の1冊を投稿してみよう！
        </div>
      `
      : shownDecks
          .map(deck => `
            <div class="subject-card">

              <div class="subject-header">

                <div class="subject-name">
                  ${escapeHTML(deck.title)}
                </div>

              </div>


              <div class="subject-info deck-meta">

                <span>
                  ${escapeHTML(deck.subject)}・${Number(deck.cardCount) || 0}枚
                </span>

                <span>
                  ${escapeHTML(deck.authorName)}
                </span>

                <span>
                  ${formatDeckDate(deck.createdAt)}
                </span>

              </div>


              <button
                class="subject-study-button"
                data-deck-id="${escapeHTML(deck.id)}"
              >
                ${isDeckImported(deck.id) ? "✓ 取り込み済み・中を見る" : "📖 中を見る"}
              </button>

            </div>
          `)
          .join("");


  document.querySelector("main").innerHTML = `

    <h1 class="page-title">
      みんなの単語帳
    </h1>


    <p class="community-note">
      ${
        user
          ? `ログイン中（${escapeHTML(getNickname() || "ニックネーム未設定")}）・<button class="text-button" id="signOutButton">ログアウト</button>`
          : "見る・取り込むのはログインなしでできます。投稿にはログインが必要です。"
      }
    </p>


    <button
      class="start-button"
      id="postDeckButton"
      style="margin-bottom:12px;"
    >
      📤 自分の単語帳を投稿する
    </button>


    <button
      class="level-entry-button"
      id="rulesButton"
    >
      📜 投稿のルール
    </button>


    <div class="form-group">

      <label for="communitySubjectSelect">
        科目でしぼりこむ
      </label>

      <select id="communitySubjectSelect">
        ${subjectOptions}
      </select>

    </div>


    <div class="subject-list">

      ${deckHTML}

    </div>

  `;


  document
    .querySelector("#communitySubjectSelect")
    .addEventListener(
      "change",
      event => showCommunityPage(event.target.value)
    );


  document
    .querySelector("#postDeckButton")
    .addEventListener(
      "click",
      () => showChoosePostDeckPage()
    );


  document
    .querySelector("#rulesButton")
    .addEventListener(
      "click",
      () => showCommunityRulesPage(() => showCommunityPage(selectedSubject))
    );


  const signOutButton =
    document.querySelector("#signOutButton");

  if (signOutButton) {

    signOutButton.addEventListener(
      "click",
      async () => {

        await communityAuth.signOut();

        showCommunityPage(selectedSubject);
      }
    );
  }


  document
    .querySelectorAll("[data-deck-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => showDeckDetailPage(button.dataset.deckId)
      );
    });
}


// ------------------------------
// 単語帳の中身
// ------------------------------

async function showDeckDetailPage(deckId) {

  showCommunityMessage("読み込み中…");


  let user;

  let deck;

  let deckCards;

  try {

    user = await getCommunityUser();

    const [deckDoc, cardsDoc] =
      await Promise.all([
        communityDb.collection("decks").doc(deckId).get(),
        communityDb.collection("deckCards").doc(deckId).get()
      ]);

    if (!deckDoc.exists || !cardsDoc.exists) {

      showCommunityMessage("この単語帳は削除されました。");

      return;
    }

    deck = deckDoc.data();

    deckCards = cardsDoc.data().cards || [];

  } catch (error) {

    showCommunityMessage(
      "読み込めませんでした。（" + escapeHTML(error.code || error.message) + "）"
    );

    return;
  }


  const isOwner =
    user && user.uid === deck.authorUid;

  const imported =
    isDeckImported(deckId);


  const previewHTML =
    deckCards
      .slice(0, 10)
      .map(card => `
        <div class="weak-card">

          <div class="weak-content">

            <div class="weak-question">
              ${escapeHTML(card.q)}
            </div>

            <div class="weak-result">
              ${escapeHTML(card.a)}
            </div>

          </div>

        </div>
      `)
      .join("");


  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}


    <h1 class="page-title">
      ${escapeHTML(deck.title)}
    </h1>


    <div class="form-card">

      <p class="community-note">
        ${escapeHTML(deck.subject)}・${deckCards.length}枚・${escapeHTML(deck.authorName)}・${formatDeckDate(deck.createdAt)}
      </p>

      ${
        deck.description
          ? `<p class="deck-description">${escapeHTML(deck.description)}</p>`
          : ""
      }


      <button
        class="add-card-button"
        id="importDeckButton"
        ${imported ? "disabled" : ""}
      >
        ${imported ? "✓ 取り込み済み" : "📥 自分のカードに取り込む"}
      </button>

    </div>


    <h2 style="margin-top:30px;">
      カードの例（最初の${Math.min(10, deckCards.length)}枚）
    </h2>


    <div class="weak-card-list">

      ${previewHTML}

    </div>


    <div class="deck-actions">

      ${
        isOwner
          ? `<button class="text-button danger" id="deleteDeckButton">🗑 この単語帳を削除する</button>`
          : `<button class="text-button" id="reportDeckButton">🚩 この単語帳を通報する</button>`
      }

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener(
      "click",
      () => showCommunityPage()
    );


  document
    .querySelector("#importDeckButton")
    .addEventListener(
      "click",
      () => importDeck(deckId, deck, deckCards)
    );


  const deleteButton =
    document.querySelector("#deleteDeckButton");

  if (deleteButton) {

    deleteButton.addEventListener(
      "click",
      () => showDeleteDeckPage(deckId, deck)
    );
  }


  const reportButton =
    document.querySelector("#reportDeckButton");

  if (reportButton) {

    reportButton.addEventListener(
      "click",
      () => showReportDeckPage(deckId, deck)
    );
  }
}


// 取り込むと「単語帳」タブに自分の単語帳として入る（他の人の作品なので投稿はできない）
// カードはレベルなし（自分で追加したカードと同じ扱い）で、どの単語帳から来たかを残す
function importDeck(deckId, deck, deckCards) {

  if (isDeckImported(deckId)) {

    return;
  }


  const myDeck = {
    id: newMyDeckId(),
    title: String(deck.title || "取り込んだ単語帳").slice(0, COMMUNITY_LIMITS.title),
    subject: String(deck.subject || "その他").slice(0, COMMUNITY_LIMITS.subject),
    description: String(deck.description || "").slice(0, COMMUNITY_LIMITS.description),
    createdAt: Date.now(),
    importedFrom: deckId
  };

  const myDecks = getMyDecks();

  myDecks.push(myDeck);

  saveMyDecks(myDecks);


  // ★必ず保存されている全カードを取得してから追加する
  const allCards = getCards();

  // 数字の id にする（並べ替えで a.id - b.id を使っているため）
  const baseId = Date.now() * 1000;


  deckCards
    .slice(0, COMMUNITY_LIMITS.maxCards)
    .forEach((card, index) => {

      allCards.push({
        id: baseId + index,
        question: String(card.q || "").slice(0, COMMUNITY_LIMITS.cardText),
        answer: String(card.a || "").slice(0, COMMUNITY_LIMITS.cardText),
        subject: myDeck.subject,
        myDeckId: myDeck.id,
        deckId: deckId,
        deckTitle: myDeck.title,
        correct: 0,
        wrong: 0
      });
    });


  saveCards(allCards);

  cards = allCards;


  alert(
    `${deckCards.length}枚を取り込みました！\n「単語帳」タブから勉強できます。ホームの「新しいカード」にも少しずつ出てきます。`
  );

  showDeckDetailPage(deckId);
}


// ------------------------------
// 投稿画面
// ------------------------------

// 「みんな」タブから：投稿する単語帳を選ぶ
async function showChoosePostDeckPage() {

  // ★押した瞬間にログイン画面を開く（await の前に何もしない）
  const user =
    await requireCommunityUser();

  if (!user) {

    return;
  }


  const decks =
    getPostableMyDecks();


  if (decks.length === 0) {

    document.querySelector("main").innerHTML = `

      ${backHeaderHTML()}

      <h1 class="page-title">
        単語帳を投稿する
      </h1>

      <div class="form-card">

        <p class="community-note">
          投稿できる単語帳がありません。<br>
          「単語帳」タブで単語帳を作って、カードを1枚以上入れてから投稿してください。<br>
          （取り込んだ単語帳と、投稿済みの単語帳は投稿できません）
        </p>

        <button
          class="add-card-button"
          id="goMyDecksButton"
        >
          単語帳タブへ
        </button>

      </div>

    `;

    document
      .querySelector("#backButton")
      .addEventListener("click", () => showCommunityPage());

    document
      .querySelector("#goMyDecksButton")
      .addEventListener("click", showMyDecksPage);

    return;
  }


  const allCards = getCards();

  const deckHTML =
    decks
      .map(deck => `
        <div class="subject-card">

          <div class="subject-header">

            <div class="subject-name">
              ${escapeHTML(deck.title)}
            </div>

            <div class="subject-accuracy">
              ${getMyDeckCards(deck.id, allCards).length}枚
            </div>

          </div>

          <div class="subject-info">
            <span>${escapeHTML(deck.subject)}</span>
          </div>

          <button
            class="subject-study-button"
            data-post-deck-id="${escapeHTML(deck.id)}"
          >
            📤 この単語帳を投稿する
          </button>

        </div>
      `)
      .join("");


  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}

    <h1 class="page-title">
      投稿する単語帳を選ぶ
    </h1>

    <div class="subject-list">
      ${deckHTML}
    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", () => showCommunityPage());


  document
    .querySelectorAll("[data-post-deck-id]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => showPostDeckPage(button.dataset.postDeckId, () => showChoosePostDeckPage())
      );
    });
}


// 投稿の入力画面（タイトル・説明は単語帳のものが最初から入っている）
// onBack：戻るボタンで戻る先（省略時は単語帳の画面）
async function showPostDeckPage(myDeckId, onBack) {

  // ★押した瞬間にログイン画面を開く（await の前に何もしない）
  const user =
    await requireCommunityUser();

  if (!user) {

    return;
  }


  setActiveNav("communityNavButton");


  const myDeck =
    getMyDeck(myDeckId);

  const deckCards =
    getMyDeckCards(myDeckId);

  const goBack =
    onBack || (() => showMyDeckPage(myDeckId));


  if (!myDeck || myDeck.importedFrom || myDeck.postedId || deckCards.length === 0) {

    goBack();

    return;
  }


  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}


    <h1 class="page-title">
      単語帳を投稿する
    </h1>


    <div class="form-card">

      <p class="community-note">
        ${escapeHTML(myDeck.subject)}・${Math.min(deckCards.length, COMMUNITY_LIMITS.maxCards)}枚を投稿します。
        ${
          deckCards.length > COMMUNITY_LIMITS.maxCards
            ? `<br>（${COMMUNITY_LIMITS.maxCards}枚までなので、最初の${COMMUNITY_LIMITS.maxCards}枚だけになります）`
            : ""
        }
      </p>


      <div class="form-group">

        <label for="postTitleInput">
          単語帳のタイトル（${COMMUNITY_LIMITS.title}文字まで）
        </label>

        <input
          type="text"
          id="postTitleInput"
          maxlength="${COMMUNITY_LIMITS.title}"
          value="${escapeHTML(myDeck.title)}"
        >

      </div>


      <div class="form-group">

        <label for="postDescriptionInput">
          説明（任意・${COMMUNITY_LIMITS.description}文字まで）
        </label>

        <textarea
          id="postDescriptionInput"
          maxlength="${COMMUNITY_LIMITS.description}"
          placeholder="例：教科書の太字の語句を、自分で問題にしました。"
        >${escapeHTML(myDeck.description || "")}</textarea>

      </div>


      <div class="form-group">

        <label for="postNicknameInput">
          表示するニックネーム（${COMMUNITY_LIMITS.nickname}文字まで）
        </label>

        <input
          type="text"
          id="postNicknameInput"
          maxlength="${COMMUNITY_LIMITS.nickname}"
          value="${escapeHTML(getNickname())}"
          placeholder="本名は使わないでください"
        >

      </div>


      <label class="agree-row">
        <input type="checkbox" id="agreeRulesCheckbox">
        <span>
          <button class="text-button" id="rulesLinkButton">投稿のルール</button>を読んで、守ります
        </span>
      </label>


      <p
        class="settings-error"
        id="postError"
        hidden
      ></p>


      <button
        class="add-card-button"
        id="submitDeckButton"
      >
        📤 投稿する
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", goBack);


  document
    .querySelector("#rulesLinkButton")
    .addEventListener(
      "click",
      event => {

        event.preventDefault();

        showCommunityRulesPage(() => showPostDeckPage(myDeckId, onBack));
      }
    );


  document
    .querySelector("#submitDeckButton")
    .addEventListener(
      "click",
      () => submitDeck(user, myDeck, deckCards)
    );
}


async function submitDeck(user, myDeck, deckCards) {

  const title =
    document.querySelector("#postTitleInput").value.trim();

  const description =
    document.querySelector("#postDescriptionInput").value.trim();

  const nickname =
    document.querySelector("#postNicknameInput").value.trim();

  const agreed =
    document.querySelector("#agreeRulesCheckbox").checked;


  const postCards =
    deckCards
      .slice(0, COMMUNITY_LIMITS.maxCards)
      .map(card => ({
        q: card.question.slice(0, COMMUNITY_LIMITS.cardText),
        a: card.answer.slice(0, COMMUNITY_LIMITS.cardText)
      }));


  let error = "";

  if (!title) {

    error = "タイトルを入力してください。";

  } else if (!nickname) {

    error = "ニックネームを入力してください。";

  } else if (!agreed) {

    error = "投稿のルールを確認して、チェックを入れてください。";
  }


  const errorArea =
    document.querySelector("#postError");

  if (error) {

    errorArea.textContent = error;

    errorArea.hidden = false;

    return;
  }


  const submitButton =
    document.querySelector("#submitDeckButton");

  submitButton.disabled = true;

  submitButton.textContent = "投稿中…";


  saveNickname(nickname);


  // 単語帳の情報（一覧用）とカード本体を、同じ id で同時に保存する
  const deckRef =
    communityDb.collection("decks").doc();

  const cardsRef =
    communityDb.collection("deckCards").doc(deckRef.id);

  const batch =
    communityDb.batch();

  batch.set(deckRef, {
    title: title,
    description: description,
    subject: myDeck.subject.slice(0, COMMUNITY_LIMITS.subject),
    cardCount: postCards.length,
    authorUid: user.uid,
    authorName: nickname,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    reportCount: 0
  });

  batch.set(cardsRef, {
    authorUid: user.uid,
    cards: postCards
  });


  try {

    await batch.commit();

  } catch (error) {

    errorArea.textContent =
      "投稿できませんでした。（" + (error.code || error.message) + "）";

    errorArea.hidden = false;

    submitButton.disabled = false;

    submitButton.textContent = "📤 投稿する";

    return;
  }


  // 自分の単語帳に「投稿済み」を記録する（同じ単語帳を二重に投稿しないため）
  const latestDeck =
    getMyDeck(myDeck.id);

  if (latestDeck) {

    updateMyDeck({ ...latestDeck, postedId: deckRef.id });
  }


  alert(`「${title}」を投稿しました！`);

  showDeckDetailPage(deckRef.id);
}


// ------------------------------
// 削除（投稿した本人だけ）
// ------------------------------

function showDeleteDeckPage(deckId, deck) {

  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}

    <h1 class="page-title">
      単語帳を削除する
    </h1>

    <div class="form-card">

      <p class="community-note">
        「${escapeHTML(deck.title)}」をみんなの単語帳から削除します。<br>
        すでに取り込んだ人のカードは消えません。元には戻せません。
      </p>

      <button
        class="add-card-button danger-button"
        id="confirmDeleteButton"
      >
        削除する
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", () => showDeckDetailPage(deckId));


  document
    .querySelector("#confirmDeleteButton")
    .addEventListener(
      "click",
      async () => {

        const batch =
          communityDb.batch();

        batch.delete(communityDb.collection("decks").doc(deckId));

        batch.delete(communityDb.collection("deckCards").doc(deckId));

        try {

          await batch.commit();

        } catch (error) {

          alert("削除できませんでした。（" + (error.code || error.message) + "）");

          return;
        }

        // 自分の単語帳の「投稿済み」を外して、また投稿できるようにする
        getMyDecks()
          .filter(myDeck => myDeck.postedId === deckId)
          .forEach(myDeck => {

            const { postedId, ...rest } = myDeck;

            updateMyDeck(rest);
          });


        alert("削除しました。");

        showCommunityPage();
      }
    );
}


// ------------------------------
// 通報
// ------------------------------

async function showReportDeckPage(deckId, deck) {

  const user =
    await requireCommunityUser();

  if (!user) {

    return;
  }


  const reasonHTML =
    REPORT_REASONS
      .map((reason, index) => `
        <label class="agree-row">
          <input
            type="radio"
            name="reportReason"
            value="${index}"
            ${index === 0 ? "checked" : ""}
          >
          <span>${reason}</span>
        </label>
      `)
      .join("");


  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}

    <h1 class="page-title">
      単語帳を通報する
    </h1>

    <div class="form-card">

      <p class="community-note">
        「${escapeHTML(deck.title)}」の問題点を選んでください。<br>
        通報が${COMMUNITY_HIDE_REPORTS}件集まると、一覧に表示されなくなります。
      </p>

      ${reasonHTML}

      <button
        class="add-card-button"
        id="submitReportButton"
        style="margin-top:20px;"
      >
        通報する
      </button>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", () => showDeckDetailPage(deckId));


  document
    .querySelector("#submitReportButton")
    .addEventListener(
      "click",
      async () => {

        const reason =
          REPORT_REASONS[
            Number(document.querySelector('input[name="reportReason"]:checked').value)
          ];


        // 通報の記録（1人1回）と、通報数を1つ増やすのを同時に行う
        const batch =
          communityDb.batch();

        batch.set(
          communityDb.collection("reports").doc(`${deckId}_${user.uid}`),
          {
            deckId: deckId,
            uid: user.uid,
            reason: reason,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }
        );

        batch.update(
          communityDb.collection("decks").doc(deckId),
          {
            reportCount: firebase.firestore.FieldValue.increment(1)
          }
        );


        try {

          await batch.commit();

        } catch (error) {

          // すでに通報済みのときは、ルールで拒否される
          alert(
            error.code === "permission-denied"
              ? "この単語帳はすでに通報済みです。"
              : "通報できませんでした。（" + (error.code || error.message) + "）"
          );

          return;
        }


        alert("通報しました。ご協力ありがとうございます。");

        showCommunityPage();
      }
    );
}


// ------------------------------
// 投稿のルール
// ------------------------------

function showCommunityRulesPage(onBack) {

  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}

    <h1 class="page-title">
      投稿のルール
    </h1>

    <div class="form-card rules-text">

      <h3>投稿してよいもの</h3>
      <ul>
        <li>自分で考えて作った問題と答え</li>
        <li>授業のノートや、自分でまとめた内容をもとにした問題</li>
      </ul>

      <h3>投稿してはいけないもの</h3>
      <ul>
        <li>市販の単語帳・参考書・教科書・問題集の文章や問題を、そのまま写したもの（著作権の侵害になります）</li>
        <li>人を傷つける内容、差別的な内容、性的な内容</li>
        <li>本名・学校名・連絡先など、自分や他の人が特定できる情報</li>
        <li>宣伝、いたずら、意味のない内容</li>
      </ul>

      <h3>知っておいてほしいこと</h3>
      <ul>
        <li>投稿した単語帳は、メモライを使う誰でも見たり取り込んだりできます</li>
        <li>表示されるのはニックネームだけです。ログインに使った Google アカウントの名前やメールアドレスは表示されません</li>
        <li>自分の投稿はいつでも削除できます。ただし、すでに取り込んだ人のカードは消えません</li>
        <li>ルールに反する投稿は、通報や運営の判断で予告なく削除することがあります</li>
      </ul>

    </div>

  `;


  document
    .querySelector("#backButton")
    .addEventListener("click", onBack);
}


// ------------------------------
// ナビゲーション
// ------------------------------

document
  .querySelector("#communityNavButton")
  .addEventListener(
    "click",
    () => showCommunityPage()
  );


// アプリを開いたら（Firebase の SDK を読み終えたら）ログイン状態の読み込みを始めておく
// → 「投稿する」を押したとき、すぐログイン済みかどうかがわかり、ログイン画面をすぐ開ける
document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (navigator.onLine && initCommunity()) {

      communityAuth.onAuthStateChanged(() => {});
    }
  }
);
