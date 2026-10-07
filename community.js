// ==============================
// みんなの単語帳
// 利用者が作ったカードを投稿・取り込みできる（Firebase を使う）
// app.js の関数（getCards・saveCards・escapeHTML・setActiveNav など）を使うので、app.js のあとに読み込む
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


async function communitySignIn() {

  try {

    await communityAuth.signInWithPopup(
      new firebase.auth.GoogleAuthProvider()
    );

    return true;

  } catch (error) {

    if (error.code !== "auth/popup-closed-by-user") {

      alert(
        "ログインできませんでした。\nポップアップがブロックされていないか確認してください。\n（" + error.code + "）"
      );
    }

    return false;
  }
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

  return getCards().some(card => card.deckId === deckId);
}


// 自分で追加したカード（レベルなし・サンプルでも取り込みでもない）
function getOwnCards() {

  return getCards().filter(
    card =>
      !card.level &&
      !card.deckId &&
      !sampleCardIds.has(card.id)
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
      📤 自分のカードを投稿する
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
      showPostDeckPage
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


// 取り込んだカードは「自分で追加したカード」と同じ扱い（レベルなし）で、どの単語帳から来たかを残す
function importDeck(deckId, deck, deckCards) {

  if (isDeckImported(deckId)) {

    return;
  }


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
        subject: String(deck.subject || "その他").slice(0, COMMUNITY_LIMITS.subject),
        deckId: deckId,
        deckTitle: String(deck.title || "").slice(0, COMMUNITY_LIMITS.title),
        correct: 0,
        wrong: 0
      });
    });


  saveCards(allCards);

  cards = allCards;


  alert(
    `${deckCards.length}枚を取り込みました！\nホームの「新しいカード」から少しずつ出てきます。`
  );

  showDeckDetailPage(deckId);
}


// ------------------------------
// 投稿画面
// ------------------------------

async function showPostDeckPage() {

  let user =
    await getCommunityUser();


  if (!user) {

    const ok =
      await communitySignIn();

    if (!ok) {

      return;
    }

    user = communityAuth.currentUser;
  }


  const ownCards =
    getOwnCards();

  const subjects =
    [...new Set(ownCards.map(card => card.subject))];


  if (subjects.length === 0) {

    document.querySelector("main").innerHTML = `

      ${backHeaderHTML()}

      <h1 class="page-title">
        自分のカードを投稿する
      </h1>

      <div class="form-card">
        <p class="community-note">
          投稿できるのは、自分で追加したカードです。<br>
          下の「カード」から追加してから、もう一度開いてください。
        </p>
      </div>

    `;

    document
      .querySelector("#backButton")
      .addEventListener("click", () => showCommunityPage());

    return;
  }


  const subjectOptions =
    subjects
      .map(subject => {

        const count =
          ownCards.filter(card => card.subject === subject).length;

        return `
          <option value="${escapeHTML(subject)}">
            ${escapeHTML(subject)}（${count}枚）
          </option>
        `;
      })
      .join("");


  document.querySelector("main").innerHTML = `

    ${backHeaderHTML()}


    <h1 class="page-title">
      自分のカードを投稿する
    </h1>


    <div class="form-card">

      <div class="form-group">

        <label for="postSubjectSelect">
          投稿する科目
        </label>

        <select id="postSubjectSelect">
          ${subjectOptions}
        </select>

      </div>


      <div class="form-group">

        <label for="postTitleInput">
          単語帳のタイトル（${COMMUNITY_LIMITS.title}文字まで）
        </label>

        <input
          type="text"
          id="postTitleInput"
          maxlength="${COMMUNITY_LIMITS.title}"
          placeholder="例：鎌倉時代の重要語句まとめ"
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
        ></textarea>

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
    .addEventListener("click", () => showCommunityPage());


  document
    .querySelector("#rulesLinkButton")
    .addEventListener(
      "click",
      event => {

        event.preventDefault();

        showCommunityRulesPage(showPostDeckPage);
      }
    );


  document
    .querySelector("#submitDeckButton")
    .addEventListener(
      "click",
      () => submitDeck(user, ownCards)
    );
}


async function submitDeck(user, ownCards) {

  const subject =
    document.querySelector("#postSubjectSelect").value;

  const title =
    document.querySelector("#postTitleInput").value.trim();

  const description =
    document.querySelector("#postDescriptionInput").value.trim();

  const nickname =
    document.querySelector("#postNicknameInput").value.trim();

  const agreed =
    document.querySelector("#agreeRulesCheckbox").checked;


  const postCards =
    ownCards
      .filter(card => card.subject === subject)
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

  } else if (subject.length > COMMUNITY_LIMITS.subject) {

    error = `科目名が長すぎます（${COMMUNITY_LIMITS.subject}文字まで）。カードの科目名を短くしてください。`;

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
    subject: subject,
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

        alert("削除しました。");

        showCommunityPage();
      }
    );
}


// ------------------------------
// 通報
// ------------------------------

async function showReportDeckPage(deckId, deck) {

  let user =
    await getCommunityUser();


  if (!user) {

    const ok =
      await communitySignIn();

    if (!ok) {

      return;
    }

    user = communityAuth.currentUser;
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
